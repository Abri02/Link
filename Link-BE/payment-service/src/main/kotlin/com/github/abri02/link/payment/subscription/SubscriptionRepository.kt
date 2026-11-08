package com.github.abri02.link.payment.subscription

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface SubscriptionRepository : JpaRepository<Subscription, Long> {
    fun findByStripeSubscriptionId(stripeSubscriptionId: String): Subscription?
}
