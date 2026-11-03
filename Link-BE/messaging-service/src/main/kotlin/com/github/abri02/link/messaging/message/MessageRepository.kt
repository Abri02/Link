package com.github.abri02.link.messaging.message

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

interface ReplyCountProjection {
    fun getParentMessageId(): Long
    fun getCount(): Long
}

interface UnreadCountProjection {
    fun getChannelId(): Long
    fun getCount(): Long
}

@Repository
interface MessageRepository : JpaRepository<Message, Long> {
    fun findByChannelIdAndParentMessageIdIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(
        channelId: Long,
        pageable: Pageable
    ): List<Message>

    fun findByChannelIdAndIdLessThanAndParentMessageIdIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(
        channelId: Long,
        beforeId: Long,
        pageable: Pageable
    ): List<Message>

    fun findByChannelIdAndBodyContainingIgnoreCaseAndParentMessageIdIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(
        channelId: Long,
        query: String,
        pageable: Pageable
    ): List<Message>

    fun findByParentMessageIdAndDeletedAtIsNullOrderByCreatedAtAsc(
        parentMessageId: Long
    ): List<Message>

    @Query("""
        SELECT m.parentMessageId as parentMessageId, COUNT(m) as count
        FROM Message m
        WHERE m.parentMessageId IN :ids AND m.deletedAt IS NULL
        GROUP BY m.parentMessageId
    """)
    fun countRepliesByParentIds(@Param("ids") ids: List<Long>): List<ReplyCountProjection>

    @Query("SELECT MAX(m.id) FROM Message m WHERE m.channelId = :channelId")
    fun findLatestMessageId(@Param("channelId") channelId: Long): Long?

    /**
     * Unread messages per channel for the user: top-level, not deleted USER messages by someone
     * else, newer than the user's read marker. Channels with nothing unread are left out.
     */
    @Query("""
        SELECT m.channelId as channelId, COUNT(m) as count
        FROM Message m, ChannelMember cm
        WHERE cm.userId = :userId AND cm.channelId IN :channelIds
          AND m.channelId = cm.channelId
          AND (cm.lastReadMessageId IS NULL OR m.id > cm.lastReadMessageId)
          AND m.authorId <> :userId
          AND m.parentMessageId IS NULL AND m.deletedAt IS NULL
          AND m.type = com.github.abri02.link.messaging.message.MessageType.USER
        GROUP BY m.channelId
    """)
    fun countUnreadByChannel(
        @Param("userId") userId: Long,
        @Param("channelIds") channelIds: Collection<Long>
    ): List<UnreadCountProjection>
}

/** Unread count per channel id. Channels that aren't in the map have nothing unread. */
fun MessageRepository.unreadCounts(userId: Long, channelIds: Collection<Long>): Map<Long, Long> =
    if (channelIds.isEmpty()) emptyMap()
    else countUnreadByChannel(userId, channelIds).associate { it.getChannelId() to it.getCount() }
