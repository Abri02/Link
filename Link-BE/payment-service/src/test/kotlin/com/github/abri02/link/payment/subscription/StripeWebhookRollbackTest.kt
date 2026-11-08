package com.github.abri02.link.payment.subscription

import com.github.abri02.link.payment.support.PostgresIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.mockito.Mockito.reset
import org.mockito.kotlin.doThrow
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.test.context.bean.override.mockito.MockitoBean
import tools.jackson.databind.json.JsonMapper
import java.time.Instant

class StripeWebhookRollbackTest : PostgresIntegrationTest() {

    @Autowired lateinit var service: StripeWebhookService
    @Autowired lateinit var subscriptions: SubscriptionRepository
    @MockitoBean lateinit var planClient: WorkspacePlanClient

    private val event = StripeWebhookEvent(
        "evt_rollback",
        "customer.subscription.updated",
        Instant.ofEpochSecond(1_000),
        JsonMapper.builder().build().readTree(
            """{"id":"sub_rb","customer":"cus_rb","status":"active","metadata":{"workspaceId":"77"}}"""
        )
    )

    @Test
    fun `a failed plan update rolls everything back so the retry applies the event`() {
        doThrow(IllegalStateException("messaging down")).whenever(planClient).updatePlan(77L, "PREMIUM")

        assertThatThrownBy { service.handle(event) }.isInstanceOf(IllegalStateException::class.java)
        assertThat(subscriptions.findById(77L)).isEmpty

        reset(planClient)
        service.handle(event)

        assertThat(subscriptions.findById(77L).orElseThrow().status).isEqualTo("active")
        verify(planClient).updatePlan(77L, "PREMIUM")
    }
}
