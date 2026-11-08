package com.github.abri02.link.messaging.message

import com.github.abri02.link.messaging.access.FREE_HISTORY_DAYS
import com.github.abri02.link.messaging.access.PlanLimitException
import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRole
import org.springframework.data.domain.PageRequest
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

data class SendMessageRequest(
    val body: String,
    val parentMessageId: Long? = null,
    val attachmentId: Long? = null,
    val attachmentName: String? = null,
    val attachmentMime: String? = null
)
data class EditMessageRequest(val body: String)
data class DeletedEvent(val messageId: Long, val channelId: Long)

data class MessageResponse(
    val id: Long,
    val channelId: Long,
    val authorId: Long,
    val body: String,
    val createdAt: Instant,
    val editedAt: Instant?,
    val parentMessageId: Long?,
    val reactions: Map<String, List<Long>> = emptyMap(),
    val replyCount: Int = 0,
    val attachmentId: Long? = null,
    val attachmentName: String? = null,
    val attachmentMime: String? = null,
    val type: String = MessageType.USER.name
)

/**
 * Sent on `/user/queue/notifications`. Top-level messages notify every other channel member.
 * Thread replies only notify the users they mention. `mention` is true for mentioned users.
 */
data class NotificationEvent(
    val channelId: Long,
    val authorId: Long,
    val bodyPreview: String,
    val mention: Boolean = false,
    val parentMessageId: Long? = null
)

data class ErrorResponse(val message: String)

@RestController
@RequestMapping("/channels/{channelId}/messages")
class MessageController(
    private val access: WorkspaceAccess,
    private val channelMembers: ChannelMemberRepository,
    private val workspaceMembers: WorkspaceMemberRepository,
    private val messages: MessageRepository,
    private val mentions: MessageMentionRepository,
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

        val channel = access.requireChannelMember(channelId, userId)

        if (req.body.isBlank())
            return ResponseEntity.badRequest().body(ErrorResponse("Message body cannot be empty"))

        if (req.parentMessageId != null) {
            val parent = messages.findById(req.parentMessageId).orElse(null)
            if (parent == null || parent.channelId != channelId)
                return ResponseEntity.badRequest().body(ErrorResponse("Parent message not found in this channel"))
            if (parent.type == MessageType.SYSTEM)
                return ResponseEntity.badRequest().body(ErrorResponse("Can't reply to a system message"))
        }

        val message = messages.save(
            Message(
                channelId = channelId,
                authorId = userId,
                body = req.body.trim(),
                parentMessageId = req.parentMessageId,
                attachmentId = req.attachmentId,
                attachmentName = req.attachmentName,
                attachmentMime = req.attachmentMime
            )
        )
        val response = message.toResponse()
        val preview = response.body.take(100)
        val memberIds by lazy { channelMembers.findByChannelId(channelId).map { it.userId }.toSet() }
        val mentioned = saveMentions(message, channel.workspaceId) { memberIds }

        if (message.parentMessageId == null) {
            broker.convertAndSend("/topic/channel.$channelId", response)
            memberIds.filter { it != userId }.forEach {
                notify(it, NotificationEvent(channelId, userId, preview, mention = it in mentioned))
            }
        } else {
            broker.convertAndSend("/topic/thread.${message.parentMessageId}", response)
            mentioned.forEach {
                notify(it, NotificationEvent(channelId, userId, preview, mention = true, parentMessageId = message.parentMessageId))
            }
        }

        return ResponseEntity.status(HttpStatus.CREATED).body(response)
    }

    /**
     * Stores a mention for every `@username` in the body that is a member of this channel (other
     * than the author) and returns their ids. Workspace members outside the channel are ignored,
     * so a channel's content never reaches people who can't read it.
     */
    private fun saveMentions(message: Message, workspaceId: Long, channelMemberIds: () -> Set<Long>): Set<Long> {
        if (MentionParser.tokens(message.body).isEmpty()) return emptySet()
        val memberIds = channelMemberIds()
        val usernames = workspaceMembers.findMembersWithUsernameByWorkspaceId(workspaceId)
            .filter { it.getUserId() in memberIds && it.getUserId() != message.authorId }
            .associate { it.getUserId() to it.getUsername() }
        val mentioned = MentionParser.resolve(message.body, usernames)
        if (mentioned.isNotEmpty()) mentions.saveAll(mentioned.map { MessageMention(message.id!!, it) })
        return mentioned
    }

    private fun notify(userId: Long, event: NotificationEvent) =
        broker.convertAndSendToUser(userId.toString(), "/queue/notifications", event)

    @GetMapping
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long,
        @RequestParam(required = false) before: Long?,
        @RequestParam(defaultValue = "50") limit: Int,
        @RequestParam(required = false) q: String?
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()

        val channel = access.requireChannelMember(channelId, userId)
        val since = access.historyCutoff(channel.workspaceId)

        val pageSize = limit.coerceIn(1, 100)
        val page = PageRequest.of(0, pageSize)

        val result = when {
            !q.isNullOrBlank() ->
                messages.findByChannelIdAndBodyContainingIgnoreCaseAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(
                    channelId, q.trim(), since, page
                )
            before != null ->
                messages.findByChannelIdAndIdLessThanAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(channelId, before, since, page)
            else ->
                messages.findByChannelIdAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(channelId, since, page)
        }

        val ordered = result.reversed()
        val reactionsByMessage = reactions.findByMessageIdIn(ordered.map { it.id!! })
            .groupBy { it.messageId }
            .mapValues { (_, rxns) -> rxns.groupBy({ it.emoji }, { it.userId }) }
        val topLevelIds = ordered.filter { it.parentMessageId == null }.mapNotNull { it.id }
        val replyCounts = if (topLevelIds.isNotEmpty())
            messages.countRepliesByParentIds(topLevelIds).associate { it.getParentMessageId() to it.getCount().toInt() }
        else emptyMap()
        return ResponseEntity.ok(ordered.map {
            it.toResponse(reactionsByMessage[it.id] ?: emptyMap(), replyCounts[it.id] ?: 0)
        })
    }

    @GetMapping("/{messageId}/thread")
    fun thread(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long,
        @PathVariable messageId: Long
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()

        val channel = access.requireChannelMember(channelId, userId)

        val parent = messages.findById(messageId).orElse(null)
        if (parent == null || parent.channelId != channelId)
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Message not found"))

        if (parent.createdAt.isBefore(access.historyCutoff(channel.workspaceId)))
            throw PlanLimitException("HISTORY_LIMIT_REACHED", "The Free plan shows the last $FREE_HISTORY_DAYS days of messages")

        val replies = messages.findByParentMessageIdAndDeletedAtIsNullOrderByCreatedAtAsc(messageId)
        val reactionsByMessage = reactions.findByMessageIdIn(replies.map { it.id!! })
            .groupBy { it.messageId }
            .mapValues { (_, rxns) -> rxns.groupBy({ it.emoji }, { it.userId }) }
        return ResponseEntity.ok(replies.map { it.toResponse(reactionsByMessage[it.id] ?: emptyMap()) })
    }

    @PatchMapping("/{messageId}")
    @Transactional
    fun edit(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long,
        @PathVariable messageId: Long,
        @RequestBody req: EditMessageRequest
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()
        val message = messages.findById(messageId).orElse(null)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Message not found"))

        if (message.channelId != channelId)
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Message not found"))

        if (message.type == MessageType.SYSTEM)
            return ResponseEntity.badRequest().body(ErrorResponse("System messages can't be edited"))

        if (message.authorId != userId)
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse("Not the author"))

        if (req.body.isBlank())
            return ResponseEntity.badRequest().body(ErrorResponse("Message body cannot be empty"))

        message.body = req.body.trim()
        message.editedAt = Instant.now()
        val response = messages.save(message).toResponse()
        broker.convertAndSend("/topic/channel.$channelId.edits", response)
        return ResponseEntity.ok(response)
    }

    @DeleteMapping("/{messageId}")
    @Transactional
    fun delete(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long,
        @PathVariable messageId: Long
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()
        val message = messages.findById(messageId).orElse(null)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Message not found"))

        if (message.channelId != channelId)
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Message not found"))

        if (message.type == MessageType.SYSTEM)
            return ResponseEntity.badRequest().body(ErrorResponse("System messages can't be deleted"))

        // Authors can delete their own messages. Anyone else must be a member of the channel
        // and a workspace OWNER/ADMIN (moderation).
        if (message.authorId != userId) {
            val channel = access.requireChannelMember(channelId, userId)
            access.requireRole(
                channel.workspaceId, userId, WorkspaceRole.OWNER, WorkspaceRole.ADMIN,
                reason = "Only the author or a workspace owner/admin can delete this message"
            )
        }

        message.deletedAt = Instant.now()
        messages.save(message)
        broker.convertAndSend("/topic/channel.$channelId.deletes", DeletedEvent(messageId, channelId))
        return ResponseEntity.noContent().build<Unit>()
    }
}

fun Message.toResponse(rxns: Map<String, List<Long>> = emptyMap(), replyCount: Int = 0) =
    MessageResponse(id!!, channelId, authorId, body, createdAt, editedAt, parentMessageId, rxns, replyCount,
        attachmentId, attachmentName, attachmentMime, type.name)
