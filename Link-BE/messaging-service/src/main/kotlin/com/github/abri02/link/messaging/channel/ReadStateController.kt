package com.github.abri02.link.messaging.channel

import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.message.MessageRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Read state of channels, DMs and group DMs. The unread counts themselves are returned by the
 * channel and conversation list endpoints.
 */
@RestController
class ReadStateController(
    private val access: WorkspaceAccess,
    private val channelMembers: ChannelMemberRepository,
    private val messages: MessageRepository
) {

    /** Marks everything in the channel as read for the caller. */
    @PostMapping("/channels/{channelId}/read")
    @Transactional
    fun markRead(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()

        access.requireChannelMember(channelId, userId)

        messages.findLatestMessageId(channelId)?.let { channelMembers.markRead(channelId, userId, it) }
        return ResponseEntity.noContent().build<Unit>()
    }
}
