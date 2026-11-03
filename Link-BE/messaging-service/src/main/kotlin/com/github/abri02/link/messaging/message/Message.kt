package com.github.abri02.link.messaging.message

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/** SYSTEM messages record conversation events (join, leave, rename). Their author is the actor. */
enum class MessageType { USER, SYSTEM }

@Entity
@Table(name = "message", schema = "messaging")
class Message(

    @Column(nullable = false)
    val channelId: Long,

    @Column(nullable = false)
    val authorId: Long,

    @Column(nullable = false, columnDefinition = "TEXT")
    var body: String,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now(),

    @Column
    var editedAt: Instant? = null,

    @Column
    var deletedAt: Instant? = null,

    @Column
    val parentMessageId: Long? = null,

    @Column
    val attachmentId: Long? = null,

    @Column(columnDefinition = "TEXT")
    val attachmentName: String? = null,

    @Column(columnDefinition = "TEXT")
    val attachmentMime: String? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    val type: MessageType = MessageType.USER

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
