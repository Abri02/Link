package com.github.abri02.link.payment.subscription

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** One subscription per workspace. [status] holds Stripe's status string as received. */
@Entity
@Table(name = "subscription", schema = "payments")
class Subscription(

    @Id
    val workspaceId: Long,

    @Column(unique = true)
    var stripeCustomerId: String? = null,

    @Column(unique = true)
    var stripeSubscriptionId: String? = null,

    @Column(nullable = false, length = 32)
    var status: String,

    @Column
    var currentPeriodEnd: Instant? = null
)
