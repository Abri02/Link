package com.github.abri02.link.payment.subscription

import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.JsonNode
import java.time.Instant

/**
 * Applies Stripe events to the subscription table and pushes the resulting plan to
 * messaging-service. Everything runs in one transaction: any failure also undoes the event
 * claim, so the controller's 5xx makes Stripe redeliver and the event is applied from scratch.
 */
@Service
class StripeWebhookService(
    private val subscriptions: SubscriptionRepository,
    private val processedEvents: ProcessedEventRepository,
    private val planClient: WorkspacePlanClient
) {

    private val log = LoggerFactory.getLogger(StripeWebhookService::class.java)

    @Transactional
    fun handle(event: StripeWebhookEvent) {
        if (event.type !in HANDLED_TYPES) return
        if (processedEvents.claim(event.id) == 0) {
            log.info("Ignoring duplicate Stripe event {}", event.id)
            return
        }
        val changed = when (event.type) {
            CHECKOUT_COMPLETED -> applyCheckout(event)
            SUBSCRIPTION_UPDATED -> applySubscription(event, event.data.text("status"))
            SUBSCRIPTION_DELETED -> applySubscription(event, "canceled")
            else -> applyPaymentFailed(event)
        } ?: return
        planClient.updatePlan(changed.workspaceId, changed.plan)
    }

    private fun applyCheckout(event: StripeWebhookEvent): Subscription? {
        val session = event.data
        if (session.text("mode") != "subscription") return null
        val workspaceId = (session.metadataWorkspaceId() ?: session.text("client_reference_id")?.toLongOrNull())
            ?: return ignored(event, "no workspace id")
        val status = if (session.text("payment_status") == "unpaid") "incomplete" else "active"
        val subscriptionId = session.text("subscription")
        return upsert(workspaceId, event, status) { row ->
            if (row.stripeSubscriptionId != subscriptionId) row.currentPeriodEnd = null
            row.stripeCustomerId = session.text("customer") ?: row.stripeCustomerId
            row.stripeSubscriptionId = subscriptionId
        }
    }

    private fun applySubscription(event: StripeWebhookEvent, status: String?): Subscription? {
        val stripeSub = event.data
        val subscriptionId = stripeSub.text("id")
        val workspaceId = stripeSub.metadataWorkspaceId()
            ?: subscriptionId?.let { subscriptions.findByStripeSubscriptionId(it)?.workspaceId }
            ?: return ignored(event, "unknown subscription")
        if (status == null) return ignored(event, "no status")
        return upsert(workspaceId, event, status) { row ->
            row.stripeCustomerId = stripeSub.text("customer") ?: row.stripeCustomerId
            row.stripeSubscriptionId = subscriptionId
            row.currentPeriodEnd = stripeSub.currentPeriodEnd() ?: row.currentPeriodEnd
        }
    }

    /** Only downgrades a paying subscription, so a canceled one can't come back as past_due. */
    private fun applyPaymentFailed(event: StripeWebhookEvent): Subscription? {
        val subscriptionId = event.data.invoiceSubscriptionId() ?: return ignored(event, "no subscription")
        val row = subscriptions.findByStripeSubscriptionId(subscriptionId)
            ?: return ignored(event, "unknown subscription")
        if (row.status !in PREMIUM_STATUSES || row.isNewerThan(event)) return null
        row.status = "past_due"
        row.lastEventAt = event.created
        subscriptions.save(row)
        return row
    }

    /** Stripe doesn't guarantee delivery order, so an event older than the last applied one is dropped. */
    private fun upsert(
        workspaceId: Long,
        event: StripeWebhookEvent,
        status: String,
        change: (Subscription) -> Unit
    ): Subscription? {
        val row = subscriptions.findById(workspaceId).orElse(null) ?: Subscription(workspaceId, status = status)
        if (row.isNewerThan(event)) return null
        change(row)
        row.status = status
        row.lastEventAt = event.created
        subscriptions.save(row)
        return row
    }

    private fun Subscription.isNewerThan(event: StripeWebhookEvent) =
        lastEventAt?.isAfter(event.created) == true

    private fun ignored(event: StripeWebhookEvent, reason: String): Subscription? {
        log.warn("Ignoring Stripe event {} ({}): {}", event.id, event.type, reason)
        return null
    }

    private fun JsonNode.text(name: String): String? =
        get(name)?.takeIf { it.isString }?.stringValue()

    private fun JsonNode.metadataWorkspaceId(): Long? =
        get("metadata")?.text("workspaceId")?.toLongOrNull()

    /** Newer Stripe API versions moved the period end from the subscription to its items. */
    private fun JsonNode.currentPeriodEnd(): Instant? =
        (get("current_period_end") ?: get("items")?.get("data")?.get(0)?.get("current_period_end"))
            ?.takeIf { it.isNumber }
            ?.let { Instant.ofEpochSecond(it.longValue()) }

    /** Newer Stripe API versions moved the invoice's subscription id under parent. */
    private fun JsonNode.invoiceSubscriptionId(): String? =
        text("subscription") ?: get("parent")?.get("subscription_details")?.text("subscription")

    private companion object {
        const val CHECKOUT_COMPLETED = "checkout.session.completed"
        const val SUBSCRIPTION_UPDATED = "customer.subscription.updated"
        const val SUBSCRIPTION_DELETED = "customer.subscription.deleted"
        const val PAYMENT_FAILED = "invoice.payment_failed"
        val HANDLED_TYPES = setOf(CHECKOUT_COMPLETED, SUBSCRIPTION_UPDATED, SUBSCRIPTION_DELETED, PAYMENT_FAILED)
    }
}
