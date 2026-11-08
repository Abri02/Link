package com.github.abri02.link.payment.subscription

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

/** A Stripe event that was already applied. Stripe delivers at least once, so events can repeat. */
@Entity
@Table(name = "processed_event", schema = "payments")
class ProcessedEvent(

    @Id
    @Column(length = 255)
    val eventId: String,

    @Column(nullable = false)
    val processedAt: Instant = Instant.now()
)

@Repository
interface ProcessedEventRepository : JpaRepository<ProcessedEvent, String> {

    /**
     * Records the event and returns 1, or returns 0 if it was already recorded. A concurrent
     * delivery of the same event waits here until the first transaction commits or rolls back.
     */
    @Transactional
    @Modifying
    @Query(
        value = """
            INSERT INTO payments.processed_event (event_id, processed_at)
            VALUES (:eventId, now())
            ON CONFLICT (event_id) DO NOTHING
        """,
        nativeQuery = true
    )
    fun claim(@Param("eventId") eventId: String): Int
}
