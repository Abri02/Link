package com.github.abri02.link.payment.subscription

import com.stripe.param.checkout.SessionCreateParams
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class StripeGatewayTest {

    private val gateway = StripeGateway("sk_test", "price_1", "whsec_1", "http://app")

    @Test
    fun `checkout params tag the session and subscription with the workspace id`() {
        val params = gateway.checkoutParams(5L, null)

        assertThat(params.mode).isEqualTo(SessionCreateParams.Mode.SUBSCRIPTION)
        assertThat(params.lineItems.single().price).isEqualTo("price_1")
        assertThat(params.clientReferenceId).isEqualTo("5")
        assertThat(params.metadata).containsEntry("workspaceId", "5")
        assertThat(params.subscriptionData.metadata).containsEntry("workspaceId", "5")
        assertThat(params.successUrl).isEqualTo("http://app/billing/success?workspaceId=5")
        assertThat(params.cancelUrl).isEqualTo("http://app/billing/cancel?workspaceId=5")
        assertThat(params.customer).isNull()
    }

    @Test
    fun `checkout params reuse an existing customer`() {
        assertThat(gateway.checkoutParams(5L, "cus_1").customer).isEqualTo("cus_1")
    }

    @Test
    fun `configured is false when the secret key or price id is blank`() {
        assertThat(gateway.configured).isTrue()
        assertThat(StripeGateway("", "price_1", "whsec_1", "http://app").configured).isFalse()
        assertThat(StripeGateway("sk_test", "", "whsec_1", "http://app").configured).isFalse()
    }
}
