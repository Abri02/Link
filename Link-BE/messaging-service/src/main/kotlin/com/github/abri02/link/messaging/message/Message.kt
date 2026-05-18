package com.github.abri02.link.messaging.message

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

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

    @Column(columnDefinition = "TEXT")
    val attachmentUrl: String? = null,

    @Column(columnDefinition = "TEXT")
    val attachmentName: String? = null,

    @Column(columnDefinition = "TEXT")
    val attachmentMime: String? = null

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
