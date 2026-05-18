package com.github.abri02.link.messaging.message

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "message_reaction", schema = "messaging")
class MessageReaction(

    @Column(nullable = false)
    val messageId: Long,

    @Column(nullable = false)
    val userId: Long,

    @Column(nullable = false, length = 10)
    val emoji: String

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
