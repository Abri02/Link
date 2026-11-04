package com.github.abri02.link.messaging.call

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository
import java.time.Instant

/**
 * One answered 1-on-1 call. Written when the callee accepts and closed when either side hangs up,
 * so `endedAt - startedAt` is the call's duration. Unanswered or rejected calls are not stored.
 */
@Entity
@Table(name = "call", schema = "messaging")
class Call(

    /** Client-generated id that every signal of the same call carries. */
    @Column(nullable = false, unique = true, length = 64)
    val callId: String,

    /** The 1-on-1 DM channel the call belongs to. */
    @Column(nullable = false)
    val channelId: Long,

    @Column(nullable = false)
    val callerId: Long,

    @Column(nullable = false)
    val calleeId: Long,

    @Column(nullable = false)
    val startedAt: Instant = Instant.now(),

    @Column
    var endedAt: Instant? = null

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}

@Repository
interface CallRepository : JpaRepository<Call, Long> {
    fun findByCallId(callId: String): Call?
    fun existsByCallId(callId: String): Boolean
}
