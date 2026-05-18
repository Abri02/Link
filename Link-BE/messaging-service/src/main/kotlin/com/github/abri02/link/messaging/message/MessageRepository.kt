package com.github.abri02.link.messaging.message

import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface MessageRepository : JpaRepository<Message, Long> {
    fun findByChannelIdAndDeletedAtIsNullOrderByCreatedAtDesc(
        channelId: Long,
        pageable: Pageable
    ): List<Message>

    fun findByChannelIdAndIdLessThanAndDeletedAtIsNullOrderByCreatedAtDesc(
        channelId: Long,
        beforeId: Long,
        pageable: Pageable
    ): List<Message>

    fun findByChannelIdAndBodyContainingIgnoreCaseAndDeletedAtIsNullOrderByCreatedAtDesc(
        channelId: Long,
        query: String,
        pageable: Pageable
    ): List<Message>
}
