package com.github.abri02.link.messaging.message

import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRole
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

data class ReactionUpdateEvent(
    val messageId: Long,
    val channelId: Long,
    val reactions: Map<String, List<Long>>
)

@RestController
@RequestMapping("/messages/{messageId}/reactions/{emoji}")
class ReactionController(
    private val messages: MessageRepository,
    private val channels: ChannelRepository,
    private val channelMembers: ChannelMemberRepository,
    private val workspaceMembers: WorkspaceMemberRepository,
    private val reactions: MessageReactionRepository,
    private val broker: SimpMessagingTemplate
) {

    @PostMapping
    @Transactional
    fun add(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable messageId: Long,
        @PathVariable emoji: String
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()
        val message = messages.findById(messageId).orElse(null)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Message not found"))

        if (!channelMembers.existsByChannelIdAndUserId(message.channelId, userId))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse("Not a member of this channel"))

        val channel = channels.findById(message.channelId).orElse(null)
        if (channel != null) {
            val role = workspaceMembers.findByWorkspaceIdAndUserId(channel.workspaceId, userId)?.role
            if (role == WorkspaceRole.GUEST)
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse("Guests cannot react to messages"))
        }

        if (!reactions.existsByMessageIdAndUserIdAndEmoji(messageId, userId, emoji))
            reactions.save(MessageReaction(messageId = messageId, userId = userId, emoji = emoji))

        broadcast(messageId, message.channelId)
        return ResponseEntity.ok().build<Unit>()
    }

    @DeleteMapping
    @Transactional
    fun remove(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable messageId: Long,
        @PathVariable emoji: String
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()
        val message = messages.findById(messageId).orElse(null)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Message not found"))

        if (!channelMembers.existsByChannelIdAndUserId(message.channelId, userId))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse("Not a member of this channel"))

        reactions.deleteByMessageIdAndUserIdAndEmoji(messageId, userId, emoji)

        broadcast(messageId, message.channelId)
        return ResponseEntity.noContent().build<Unit>()
    }

    private fun broadcast(messageId: Long, channelId: Long) {
        val byEmoji = reactions.findByMessageId(messageId)
            .groupBy({ it.emoji }, { it.userId })
        broker.convertAndSend("/topic/reactions.$channelId", ReactionUpdateEvent(messageId, channelId, byEmoji))
    }
}
