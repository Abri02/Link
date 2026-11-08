package com.github.abri02.link.payment.subscription

import com.stripe.net.Webhook
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.http.HttpStatus
import java.time.Instant
import java.util.Optional

/** Real signature checking and event handling. Only the database and the plan call are mocked. */
@ExtendWith(MockitoExtension::class)
class StripeWebhookControllerTest {

    private val secret = "whsec_test"

    @Mock private lateinit var subscriptions: SubscriptionRepository
    @Mock private lateinit var processedEvents: ProcessedEventRepository
    @Mock private lateinit var planClient: WorkspacePlanClient

    private lateinit var controller: StripeWebhookController

    @BeforeEach
    fun setup() {
        controller = StripeWebhookController(
            StripeGateway("sk_test", "price_1", secret, "http://app"),
            StripeWebhookService(subscriptions, processedEvents, planClient)
        )
    }

    private fun payload(type: String, obj: String, id: String = "evt_1", created: Long = 2_000) =
        """{"id":"$id","object":"event","type":"$type","created":$created,"data":{"object":$obj}}"""

    private fun sign(payload: String, key: String = secret): String {
        val timestamp = Webhook.Util.getTimeNow()
        val signature = Webhook.Util.computeHmacSha256(key, "$timestamp.$payload")
        return "t=$timestamp,v1=$signature"
    }

    private fun post(payload: String) = controller.webhook(sign(payload), payload)

    private fun newEvent() {
        given(processedEvents.claim("evt_1")).willReturn(1)
    }

    private fun savedRow() = argumentCaptor<Subscription>().also { verify(subscriptions).save(it.capture()) }.firstValue

    private fun existing(status: String, lastEventAt: Instant? = null) =
        Subscription(
            5L,
            stripeCustomerId = "cus_1",
            stripeSubscriptionId = "sub_1",
            status = status,
            lastEventAt = lastEventAt
        )

    private val checkout =
        """{"mode":"subscription","payment_status":"paid","customer":"cus_1","subscription":"sub_1","client_reference_id":"5","metadata":{"workspaceId":"5"}}"""

    private fun subscriptionObject(status: String) =
        """{"id":"sub_1","customer":"cus_1","status":"$status","metadata":{"workspaceId":"5"},"items":{"data":[{"current_period_end":3000}]}}"""

    // signature

    @Test
    fun `webhook returns 400 for a bad signature and changes nothing`() {
        val body = payload("checkout.session.completed", checkout)

        val res = controller.webhook(sign(body, "whsec_wrong"), body)

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(processedEvents, never()).claim(any())
    }

    @Test
    fun `webhook returns 400 for a missing signature`() {
        assertThat(controller.webhook(null, "{}").statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `webhook returns 400 for a malformed payload`() {
        assertThat(post("not json").statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `webhook returns 503 when the webhook secret is not configured`() {
        val unconfigured = StripeWebhookController(
            StripeGateway("sk_test", "price_1", "", "http://app"),
            StripeWebhookService(subscriptions, processedEvents, planClient)
        )

        assertThat(unconfigured.webhook("sig", "{}").statusCode).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE)
    }

    // idempotency and retries

    @Test
    fun `a duplicate event is acknowledged without being applied again`() {
        given(processedEvents.claim("evt_1")).willReturn(0)

        val res = post(payload("checkout.session.completed", checkout))

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        verify(subscriptions, never()).save(any<Subscription>())
        verify(planClient, never()).updatePlan(any(), any())
    }

    @Test
    fun `event types that are not handled are acknowledged and not recorded`() {
        val res = post(payload("customer.created", "{}"))

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        verify(processedEvents, never()).claim(any())
    }

    @Test
    fun `webhook returns 500 so Stripe retries when the plan update fails`() {
        newEvent()
        given(subscriptions.findById(5L)).willReturn(Optional.empty())
        doThrow(IllegalStateException("messaging down")).whenever(planClient).updatePlan(5L, "PREMIUM")

        val res = post(payload("checkout.session.completed", checkout))

        assertThat(res.statusCode).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR)
    }

    // checkout.session.completed

    @Test
    fun `checkout completed creates the subscription and sets PREMIUM`() {
        newEvent()
        given(subscriptions.findById(5L)).willReturn(Optional.empty())

        val res = post(payload("checkout.session.completed", checkout))

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        val row = savedRow()
        assertThat(row.workspaceId).isEqualTo(5L)
        assertThat(row.stripeCustomerId).isEqualTo("cus_1")
        assertThat(row.stripeSubscriptionId).isEqualTo("sub_1")
        assertThat(row.status).isEqualTo("active")
        assertThat(row.lastEventAt).isEqualTo(Instant.ofEpochSecond(2_000))
        verify(planClient).updatePlan(5L, "PREMIUM")
    }

    @Test
    fun `checkout completed falls back to the client reference id`() {
        newEvent()
        given(subscriptions.findById(5L)).willReturn(Optional.empty())
        val session =
            """{"mode":"subscription","payment_status":"paid","customer":"cus_1","subscription":"sub_1","client_reference_id":"5"}"""

        post(payload("checkout.session.completed", session))

        verify(planClient).updatePlan(5L, "PREMIUM")
    }

    @Test
    fun `an unpaid checkout does not grant Premium`() {
        newEvent()
        given(subscriptions.findById(5L)).willReturn(Optional.empty())
        val session = checkout.replace("\"paid\"", "\"unpaid\"")

        post(payload("checkout.session.completed", session))

        assertThat(savedRow().status).isEqualTo("incomplete")
        verify(planClient).updatePlan(5L, "FREE")
    }

    @Test
    fun `a checkout without a workspace id is acknowledged and ignored`() {
        newEvent()
        val session = """{"mode":"subscription","payment_status":"paid","customer":"cus_1","subscription":"sub_1"}"""

        val res = post(payload("checkout.session.completed", session))

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        verify(subscriptions, never()).save(any<Subscription>())
        verify(planClient, never()).updatePlan(any(), any())
    }

    // customer.subscription.updated / deleted

    @Test
    fun `subscription updated stores status and the item period end`() {
        newEvent()
        given(subscriptions.findById(5L)).willReturn(Optional.of(existing("active")))

        post(payload("customer.subscription.updated", subscriptionObject("past_due")))

        val row = savedRow()
        assertThat(row.status).isEqualTo("past_due")
        assertThat(row.currentPeriodEnd).isEqualTo(Instant.ofEpochSecond(3_000))
        verify(planClient).updatePlan(5L, "FREE")
    }

    @Test
    fun `subscription updated reads the top-level period end of older API versions`() {
        newEvent()
        given(subscriptions.findById(5L)).willReturn(Optional.of(existing("past_due")))
        val obj = """{"id":"sub_1","status":"active","current_period_end":4000,"metadata":{"workspaceId":"5"}}"""

        post(payload("customer.subscription.updated", obj))

        assertThat(savedRow().currentPeriodEnd).isEqualTo(Instant.ofEpochSecond(4_000))
        verify(planClient).updatePlan(5L, "PREMIUM")
    }

    @Test
    fun `subscription updated without metadata finds the row by subscription id`() {
        newEvent()
        val row = existing("active")
        given(subscriptions.findByStripeSubscriptionId("sub_1")).willReturn(row)
        given(subscriptions.findById(5L)).willReturn(Optional.of(row))

        post(payload("customer.subscription.updated", """{"id":"sub_1","status":"unpaid"}"""))

        verify(planClient).updatePlan(5L, "FREE")
    }

    @Test
    fun `an out-of-order older event is dropped`() {
        newEvent()
        given(subscriptions.findById(5L))
            .willReturn(Optional.of(existing("canceled", lastEventAt = Instant.ofEpochSecond(5_000))))

        val res = post(payload("customer.subscription.updated", subscriptionObject("active")))

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        verify(subscriptions, never()).save(any<Subscription>())
        verify(planClient, never()).updatePlan(any(), any())
    }

    @Test
    fun `subscription deleted cancels and sets FREE`() {
        newEvent()
        given(subscriptions.findById(5L)).willReturn(Optional.of(existing("active")))

        post(payload("customer.subscription.deleted", subscriptionObject("canceled")))

        assertThat(savedRow().status).isEqualTo("canceled")
        verify(planClient).updatePlan(5L, "FREE")
    }

    // invoice.payment_failed

    @Test
    fun `payment failed marks an active subscription past due`() {
        newEvent()
        given(subscriptions.findByStripeSubscriptionId("sub_1")).willReturn(existing("active"))

        post(payload("invoice.payment_failed", """{"subscription":"sub_1"}"""))

        assertThat(savedRow().status).isEqualTo("past_due")
        verify(planClient).updatePlan(5L, "FREE")
    }

    @Test
    fun `payment failed reads the nested subscription id of newer API versions`() {
        newEvent()
        given(subscriptions.findByStripeSubscriptionId("sub_1")).willReturn(existing("active"))

        post(payload("invoice.payment_failed", """{"parent":{"subscription_details":{"subscription":"sub_1"}}}"""))

        verify(planClient).updatePlan(5L, "FREE")
    }

    @Test
    fun `payment failed does not reopen a canceled subscription`() {
        newEvent()
        given(subscriptions.findByStripeSubscriptionId("sub_1")).willReturn(existing("canceled"))

        post(payload("invoice.payment_failed", """{"subscription":"sub_1"}"""))

        verify(subscriptions, never()).save(any<Subscription>())
        verify(planClient, never()).updatePlan(any(), any())
    }

    @Test
    fun `payment failed for an unknown subscription is acknowledged and ignored`() {
        newEvent()
        given(subscriptions.findByStripeSubscriptionId("sub_x")).willReturn(null)

        val res = post(payload("invoice.payment_failed", """{"subscription":"sub_x"}"""))

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        verify(planClient, never()).updatePlan(any(), any())
    }
}
