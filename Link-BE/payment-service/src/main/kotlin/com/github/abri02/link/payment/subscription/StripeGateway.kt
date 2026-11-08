package com.github.abri02.link.payment.subscription

import com.stripe.StripeClient
import com.stripe.exception.SignatureVerificationException
import com.stripe.exception.StripeException
import com.stripe.net.Webhook
import com.stripe.param.checkout.SessionCreateParams
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import tools.jackson.core.JacksonException
import tools.jackson.databind.JsonNode
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import com.stripe.param.billingportal.SessionCreateParams as PortalSessionCreateParams

/** [data] is Stripe's raw object, read by field so the code doesn't depend on one API version. */
data class StripeWebhookEvent(val id: String, val type: String, val created: Instant, val data: JsonNode)

/** The only class that talks to Stripe. Keys come from the environment and may be unset locally. */
@Component
class StripeGateway(
    @Value("\${stripe.secret-key}") private val secretKey: String,
    @Value("\${stripe.price-id}") private val priceId: String,
    @Value("\${stripe.webhook-secret}") private val webhookSecret: String,
    @Value("\${link.frontend-url}") private val frontendUrl: String
) {

    private val client by lazy { StripeClient(secretKey) }

    private val json = JsonMapper.builder().build()

    val configured: Boolean get() = secretKey.isNotBlank() && priceId.isNotBlank()

    val webhookConfigured: Boolean get() = webhookSecret.isNotBlank()

    /** Returns the event, or null when the signature or payload is invalid. */
    fun parseWebhook(payload: String, signature: String): StripeWebhookEvent? =
        try {
            Webhook.Signature.verifyHeader(payload, signature, webhookSecret, Webhook.DEFAULT_TOLERANCE)
            val event = json.readTree(payload)
            StripeWebhookEvent(
                event.required("id").stringValue(),
                event.required("type").stringValue(),
                Instant.ofEpochSecond(event.required("created").longValue()),
                event.required("data").required("object")
            )
        } catch (_: SignatureVerificationException) {
            null
        } catch (_: JacksonException) {
            null
        }

    @Throws(StripeException::class)
    fun createCheckoutUrl(workspaceId: Long, customerId: String?): String =
        client.v1().checkout().sessions().create(checkoutParams(workspaceId, customerId)).url

    @Throws(StripeException::class)
    fun createPortalUrl(customerId: String): String =
        client.v1().billingPortal().sessions().create(
            PortalSessionCreateParams.builder()
                .setCustomer(customerId)
                .setReturnUrl(frontendUrl)
                .build()
        ).url

    /** The workspace id is stored on both objects so the webhook (F4) can match events to it. */
    internal fun checkoutParams(workspaceId: Long, customerId: String?): SessionCreateParams {
        val id = workspaceId.toString()
        val builder = SessionCreateParams.builder()
            .setMode(SessionCreateParams.Mode.SUBSCRIPTION)
            .addLineItem(
                SessionCreateParams.LineItem.builder().setPrice(priceId).setQuantity(1L).build()
            )
            .setSuccessUrl("$frontendUrl/billing/success?workspaceId=$id")
            .setCancelUrl("$frontendUrl/billing/cancel?workspaceId=$id")
            .setClientReferenceId(id)
            .putMetadata("workspaceId", id)
            .setSubscriptionData(
                SessionCreateParams.SubscriptionData.builder().putMetadata("workspaceId", id).build()
            )
        customerId?.let { builder.setCustomer(it) }
        return builder.build()
    }
}
