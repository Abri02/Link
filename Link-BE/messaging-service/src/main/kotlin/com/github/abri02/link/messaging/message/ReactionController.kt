package com.github.abri02.link.messaging.message

import com.github.abri02.link.messaging.access.WorkspaceAccess
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
    private val access: WorkspaceAccess,
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

        access.requireChannelMember(message.channelId, userId)

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

        access.requireChannelMember(message.channelId, userId)

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
