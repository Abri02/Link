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
}
