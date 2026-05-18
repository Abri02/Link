package com.github.abri02.link.messaging.message

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface MessageReactionRepository : JpaRepository<MessageReaction, Long> {
    fun findByMessageIdIn(messageIds: List<Long>): List<MessageReaction>
    fun findByMessageId(messageId: Long): List<MessageReaction>
    fun existsByMessageIdAndUserIdAndEmoji(messageId: Long, userId: Long, emoji: String): Boolean
    fun deleteByMessageIdAndUserIdAndEmoji(messageId: Long, userId: Long, emoji: String)
}
