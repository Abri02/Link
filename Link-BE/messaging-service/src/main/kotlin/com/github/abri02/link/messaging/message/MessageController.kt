package com.github.abri02.link.messaging.message

import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

data class SendMessageRequest(val body: String, val parentMessageId: Long? = null)

data class MessageResponse(
    val id: Long,
    val channelId: Long,
    val authorId: Long,
    val body: String,
    val createdAt: Instant,
    val editedAt: Instant?,
    val parentMessageId: Long?,
    val reactions: Map<String, List<Long>> = emptyMap()
)

data class NotificationEvent(
    val channelId: Long,
    val authorId: Long,
    val bodyPreview: String
)

data class ErrorResponse(val message: String)

@RestController
@RequestMapping("/channels/{channelId}/messages")
class MessageController(
    private val channels: ChannelRepository,
    private val channelMembers: ChannelMemberRepository,
    private val messages: MessageRepository,
    private val reactions: MessageReactionRepository,
    private val broker: SimpMessagingTemplate
) {

    @PostMapping
    @Transactional
    fun send(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long,
        @RequestBody req: SendMessageRequest
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()

        if (!channels.existsById(channelId))
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Channel not found"))

        if (!channelMembers.existsByChannelIdAndUserId(channelId, userId))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse("Not a member of this channel"))

        if (req.body.isBlank())
            return ResponseEntity.badRequest().body(ErrorResponse("Message body cannot be empty"))

        val message = messages.save(
            Message(
                channelId = channelId,
                authorId = userId,
                body = req.body.trim(),
                parentMessageId = req.parentMessageId
            )
        )
        val response = message.toResponse()
        broker.convertAndSend("/topic/channel.$channelId", response)

        val preview = response.body.take(100)
        val notification = NotificationEvent(channelId, userId, preview)
        channelMembers.findByChannelId(channelId)
            .filter { it.userId != userId }
            .forEach { broker.convertAndSendToUser(it.userId.toString(), "/queue/notifications", notification) }

        return ResponseEntity.status(HttpStatus.CREATED).body(response)
    }

    @GetMapping
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long,
        @RequestParam(required = false) before: Long?,
        @RequestParam(defaultValue = "50") limit: Int,
        @RequestParam(required = false) q: String?
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()

        if (!channels.existsById(channelId))
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Channel not found"))

        if (!channelMembers.existsByChannelIdAndUserId(channelId, userId))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse("Not a member of this channel"))

        val pageSize = limit.coerceIn(1, 100)
        val page = PageRequest.of(0, pageSize)

        val result = when {
            !q.isNullOrBlank() ->
                messages.findByChannelIdAndBodyContainingIgnoreCaseAndDeletedAtIsNullOrderByCreatedAtDesc(
                    channelId, q.trim(), page
                )
            before != null ->
                messages.findByChannelIdAndIdLessThanAndDeletedAtIsNullOrderByCreatedAtDesc(channelId, before, page)
            else ->
                messages.findByChannelIdAndDeletedAtIsNullOrderByCreatedAtDesc(channelId, page)
        }

        val ordered = result.reversed()
        val reactionsByMessage = reactions.findByMessageIdIn(ordered.map { it.id!! })
            .groupBy { it.messageId }
            .mapValues { (_, rxns) -> rxns.groupBy({ it.emoji }, { it.userId }) }
        return ResponseEntity.ok(ordered.map { it.toResponse(reactionsByMessage[it.id] ?: emptyMap()) })
    }

    private fun Message.toResponse(rxns: Map<String, List<Long>> = emptyMap()) =
        MessageResponse(id!!, channelId, authorId, body, createdAt, editedAt, parentMessageId, rxns)
}
