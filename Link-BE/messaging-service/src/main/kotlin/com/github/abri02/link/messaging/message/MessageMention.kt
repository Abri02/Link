package com.github.abri02.link.messaging.message

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

/** A channel member who was @mentioned in a message. Written once, when the message is sent. */
@Entity
@Table(
    name = "message_mention",
    schema = "messaging",
    uniqueConstraints = [UniqueConstraint(columnNames = ["message_id", "user_id"])]
)
class MessageMention(

    @Column(nullable = false)
    val messageId: Long,

    @Column(nullable = false)
    val userId: Long

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}

@Repository
interface MessageMentionRepository : JpaRepository<MessageMention, Long>
