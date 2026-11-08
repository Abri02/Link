package com.github.abri02.link.payment.subscription

import com.github.abri02.link.payment.support.PostgresIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.dao.DataIntegrityViolationException
import java.time.Instant
import java.time.temporal.ChronoUnit

class SubscriptionRepositoryTest : PostgresIntegrationTest() {

    @Autowired
    lateinit var subscriptions: SubscriptionRepository

    @Test
    fun `saves and loads a subscription by workspace id`() {
        val periodEnd = Instant.now().plus(30, ChronoUnit.DAYS).truncatedTo(ChronoUnit.SECONDS)
        subscriptions.save(
            Subscription(
                workspaceId = 1L,
                stripeCustomerId = "cus_1",
                stripeSubscriptionId = "sub_1",
                status = "active",
                currentPeriodEnd = periodEnd
            )
        )

        val loaded = subscriptions.findById(1L).orElseThrow()

        assertThat(loaded.stripeCustomerId).isEqualTo("cus_1")
        assertThat(loaded.stripeSubscriptionId).isEqualTo("sub_1")
        assertThat(loaded.status).isEqualTo("active")
        assertThat(loaded.currentPeriodEnd).isEqualTo(periodEnd)
    }

    @Test
    fun `rejects a Stripe subscription id already used by another workspace`() {
        subscriptions.save(Subscription(workspaceId = 2L, stripeSubscriptionId = "sub_dup", status = "active"))

        assertThatThrownBy {
            subscriptions.saveAndFlush(
                Subscription(workspaceId = 3L, stripeSubscriptionId = "sub_dup", status = "active")
            )
        }.isInstanceOf(DataIntegrityViolationException::class.java)
    }
}
