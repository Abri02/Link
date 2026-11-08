package com.github.abri02.link.payment.subscription

import com.github.abri02.link.payment.access.WorkspaceAccessClient
import com.github.abri02.link.payment.access.WorkspaceMembership
import com.stripe.exception.ApiConnectionException
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.verify
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class PaymentControllerTest {

    @Mock private lateinit var subscriptions: SubscriptionRepository
    @Mock private lateinit var access: WorkspaceAccessClient
    @Mock private lateinit var stripe: StripeGateway

    private lateinit var controller: PaymentController

    private val jwt = Jwt.withTokenValue("tok").header("alg", "RS256").subject("7").build()
    private val req = BillingSessionRequest(1L)

    @BeforeEach
    fun setup() {
        controller = PaymentController(subscriptions, access, stripe)
    }

    private fun caller(membership: WorkspaceMembership) {
        given(access.membership(1L, "tok")).willReturn(membership)
    }

    private fun owner() {
        caller(WorkspaceMembership.Member("OWNER"))
        given(stripe.configured).willReturn(true)
    }

    private fun existing(status: String, customerId: String? = "cus_1") {
        given(subscriptions.findById(1L))
            .willReturn(Optional.of(Subscription(1L, stripeCustomerId = customerId, status = status)))
    }

    // checkout-session

    @Test
    fun `checkout returns the Stripe url for the owner of a workspace with no subscription`() {
        owner()
        given(subscriptions.findById(1L)).willReturn(Optional.empty())
        given(stripe.createCheckoutUrl(1L, null)).willReturn("https://stripe/checkout")

        val res = controller.checkoutSession(jwt, req)

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(res.body).isEqualTo(BillingSessionResponse("https://stripe/checkout"))
    }

    @Test
    fun `checkout reuses the customer of a canceled subscription`() {
        owner()
        existing("canceled")
        given(stripe.createCheckoutUrl(1L, "cus_1")).willReturn("https://stripe/checkout")

        assertThat(controller.checkoutSession(jwt, req).statusCode).isEqualTo(HttpStatus.OK)
    }

    @Test
    fun `checkout returns 409 when a subscription is still open`() {
        for (status in listOf("active", "trialing", "past_due", "unpaid")) {
            owner()
            existing(status)

            assertThat(controller.checkoutSession(jwt, req).statusCode).isEqualTo(HttpStatus.CONFLICT)
        }
        verify(stripe, never()).createCheckoutUrl(any(), anyOrNull())
    }

    @Test
    fun `checkout returns 403 when caller is an ADMIN`() {
        caller(WorkspaceMembership.Member("ADMIN"))

        assertThat(controller.checkoutSession(jwt, req).statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(stripe, never()).createCheckoutUrl(any(), anyOrNull())
    }

    @Test
    fun `checkout returns 403 when caller is not a member`() {
        caller(WorkspaceMembership.NotMember)

        assertThat(controller.checkoutSession(jwt, req).statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `checkout returns 404 when the workspace does not exist`() {
        caller(WorkspaceMembership.NoWorkspace)

        assertThat(controller.checkoutSession(jwt, req).statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `checkout returns 503 when Stripe is not configured`() {
        caller(WorkspaceMembership.Member("OWNER"))
        given(stripe.configured).willReturn(false)

        assertThat(controller.checkoutSession(jwt, req).statusCode).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE)
    }

    @Test
    fun `checkout returns 502 when Stripe fails`() {
        owner()
        given(subscriptions.findById(1L)).willReturn(Optional.empty())
        given(stripe.createCheckoutUrl(1L, null)).willThrow(ApiConnectionException("down"))

        assertThat(controller.checkoutSession(jwt, req).statusCode).isEqualTo(HttpStatus.BAD_GATEWAY)
    }

    // portal-session

    @Test
    fun `portal returns the Stripe url for the owner`() {
        owner()
        existing("active")
        given(stripe.createPortalUrl("cus_1")).willReturn("https://stripe/portal")

        val res = controller.portalSession(jwt, req)

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(res.body).isEqualTo(BillingSessionResponse("https://stripe/portal"))
    }

    @Test
    fun `portal returns 404 when the workspace has no billing account`() {
        owner()
        given(subscriptions.findById(1L)).willReturn(Optional.empty())

        assertThat(controller.portalSession(jwt, req).statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `portal returns 403 when caller is a MEMBER`() {
        caller(WorkspaceMembership.Member("MEMBER"))

        assertThat(controller.portalSession(jwt, req).statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(stripe, never()).createPortalUrl(any())
    }

    @Test
    fun `portal returns 503 when Stripe is not configured`() {
        caller(WorkspaceMembership.Member("OWNER"))
        given(stripe.configured).willReturn(false)

        assertThat(controller.portalSession(jwt, req).statusCode).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE)
    }

    @Test
    fun `portal returns 502 when Stripe fails`() {
        owner()
        existing("active")
        given(stripe.createPortalUrl("cus_1")).willThrow(ApiConnectionException("down"))

        assertThat(controller.portalSession(jwt, req).statusCode).isEqualTo(HttpStatus.BAD_GATEWAY)
    }

    // subscription

    @Test
    fun `subscription returns FREE when there is no row`() {
        caller(WorkspaceMembership.Member("GUEST"))
        given(subscriptions.findById(1L)).willReturn(Optional.empty())

        val res = controller.subscription(jwt, 1L)

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(res.body).isEqualTo(SubscriptionResponse(1L, "FREE", null, null))
    }

    @Test
    fun `subscription returns PREMIUM with the period end for an active subscription`() {
        val end = Instant.parse("2026-12-01T00:00:00Z")
        caller(WorkspaceMembership.Member("MEMBER"))
        given(subscriptions.findById(1L))
            .willReturn(Optional.of(Subscription(1L, status = "active", currentPeriodEnd = end)))

        assertThat(controller.subscription(jwt, 1L).body)
            .isEqualTo(SubscriptionResponse(1L, "PREMIUM", "active", end))
    }

    @Test
    fun `subscription returns FREE for a canceled subscription`() {
        caller(WorkspaceMembership.Member("OWNER"))
        existing("canceled")

        assertThat(controller.subscription(jwt, 1L).body)
            .isEqualTo(SubscriptionResponse(1L, "FREE", "canceled", null))
    }

    @Test
    fun `subscription returns 403 when caller is not a member`() {
        caller(WorkspaceMembership.NotMember)

        assertThat(controller.subscription(jwt, 1L).statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `subscription returns 404 when the workspace does not exist`() {
        caller(WorkspaceMembership.NoWorkspace)

        assertThat(controller.subscription(jwt, 1L).statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }
}
