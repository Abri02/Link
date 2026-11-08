package com.github.abri02.link.payment.subscription

import com.stripe.StripeClient
import com.stripe.exception.StripeException
import com.stripe.param.checkout.SessionCreateParams
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import com.stripe.param.billingportal.SessionCreateParams as PortalSessionCreateParams

/** The only class that talks to Stripe. Keys come from the environment and may be unset locally. */
@Component
class StripeGateway(
    @Value("\${stripe.secret-key}") private val secretKey: String,
    @Value("\${stripe.price-id}") private val priceId: String,
    @Value("\${link.frontend-url}") private val frontendUrl: String
) {

    private val client by lazy { StripeClient(secretKey) }

    val configured: Boolean get() = secretKey.isNotBlank() && priceId.isNotBlank()

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
