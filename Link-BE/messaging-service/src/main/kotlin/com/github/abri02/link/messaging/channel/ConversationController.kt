package com.github.abri02.link.messaging.channel

import com.github.abri02.link.messaging.access.NotFoundException
import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.message.Message
import com.github.abri02.link.messaging.message.MessageRepository
import com.github.abri02.link.messaging.message.MessageType
import com.github.abri02.link.messaging.message.toResponse
import com.github.abri02.link.messaging.message.unreadCounts
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRole
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
import org.springframework.web.bind.annotation.RestController

/** `userIds` opens a DM (one other user) or a group DM (2–8). `targetUserId` is the old 1-on-1 form. */
data class OpenConversationRequest(
    val userIds: List<Long>? = null,
    val targetUserId: Long? = null,
    val title: String? = null
)

data class AddConversationMembersRequest(val userIds: List<Long> = emptyList())

data class RenameConversationRequest(val title: String? = null)

data class ConversationMemberResponse(val userId: Long, val username: String)

data class ConversationResponse(
    val id: Long,
    val workspaceId: Long,
    val kind: String,
    val title: String?,
    val members: List<ConversationMemberResponse>,
    /** Only filled in by the conversation list. Everywhere else it's 0. */
    val unreadCount: Long = 0
)

/** Sent on `/user/queue/conversations`. `UPSERT`: show or refresh it. `REMOVED`: the user left it. */
data class ConversationEvent(val type: String, val conversation: ConversationResponse)

/**
 * 1-on-1 DMs and group DMs. Both are channels whose `memberKey` (sorted member ids) is used to
 * return the existing conversation when the same people are picked again.
 */
@RestController
class ConversationController(
    private val access: WorkspaceAccess,
    private val workspaceMembers: WorkspaceMemberRepository,
    private val channels: ChannelRepository,
    private val channelMembers: ChannelMemberRepository,
    private val messages: MessageRepository,
    private val broker: SimpMessagingTemplate
) {

    companion object {
        /** Besides the creator. */
        const val MAX_OTHER_MEMBERS = 8
        const val MAX_TITLE_LENGTH = 80
        private val NON_GUEST = arrayOf(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)

        fun memberKey(userIds: Collection<Long>) = userIds.toSortedSet().joinToString(",")
    }

    @PostMapping("/workspaces/{workspaceId}/dms")
    @Transactional
    fun open(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable workspaceId: Long,
        @RequestBody req: OpenConversationRequest
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()

        access.requireRole(workspaceId, callerId, *NON_GUEST, reason = "Guests cannot start conversations")

        val others = (req.userIds ?: listOfNotNull(req.targetUserId)).toSet() - callerId
        if (others.isEmpty())
            return ResponseEntity.badRequest().body(ErrorResponse("Pick at least one other workspace member"))
        if (others.size > MAX_OTHER_MEMBERS)
            return ResponseEntity.badRequest().body(ErrorResponse("A conversation can have at most ${MAX_OTHER_MEMBERS + 1} people"))
        if (others.any { !workspaceMembers.existsByWorkspaceIdAndUserId(workspaceId, it) })
            return ResponseEntity.badRequest().body(ErrorResponse("Every user must be a member of this workspace"))

        val title = req.title?.trim()?.ifEmpty { null }
        if (title != null && title.length > MAX_TITLE_LENGTH)
            return ResponseEntity.badRequest().body(ErrorResponse("Title must be at most $MAX_TITLE_LENGTH characters"))

        return openOrCreate(workspaceId, callerId, others + callerId, title)
    }

    @GetMapping("/workspaces/{workspaceId}/dms")
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable workspaceId: Long
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()

        access.requireMember(workspaceId, callerId)

        val conversations = channels.findConversationsForUser(workspaceId, callerId)
        if (conversations.isEmpty()) return ResponseEntity.ok(emptyList<ConversationResponse>())

        val membersByChannel = channelMembers.findByChannelIdIn(conversations.map { it.id!! })
            .groupBy({ it.channelId }, { it.userId })
        val names = usernames(workspaceId)
        val unread = messages.unreadCounts(callerId, conversations.map { it.id!! })
        return ResponseEntity.ok(conversations.map {
            it.toResponse(membersByChannel[it.id].orEmpty(), names).copy(unreadCount = unread[it.id] ?: 0)
        })
    }

    /** Adding people to a 1-on-1 DM opens a new group DM. Adding to a group DM grows it. */
    @PostMapping("/dms/{conversationId}/members")
    @Transactional
    fun addMembers(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable conversationId: Long,
        @RequestBody req: AddConversationMembersRequest
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()
        val conversation = requireConversation(conversationId, callerId)
        val workspaceId = conversation.workspaceId

        access.requireRole(workspaceId, callerId, *NON_GUEST, reason = "Guests cannot add people to conversations")

        val current = memberIds(conversationId)
        val added = req.userIds.toSet() - current
        if (added.isEmpty())
            return ResponseEntity.badRequest().body(ErrorResponse("Pick at least one person who isn't in the conversation"))
        if (current.size + added.size > MAX_OTHER_MEMBERS + 1)
            return ResponseEntity.badRequest().body(ErrorResponse("A conversation can have at most ${MAX_OTHER_MEMBERS + 1} people"))
        if (added.any { !workspaceMembers.existsByWorkspaceIdAndUserId(workspaceId, it) })
            return ResponseEntity.badRequest().body(ErrorResponse("Every user must be a member of this workspace"))

        if (conversation.kind == ChannelKind.DM)
            return openOrCreate(workspaceId, callerId, current + added, title = null)

        added.forEach { channelMembers.save(ChannelMember(channelId = conversationId, userId = it)) }
        val all = current + added
        updateMemberKey(conversation, all)

        val names = usernames(workspaceId)
        postSystemMessage(conversationId, callerId, "${names.nameOf(callerId)} added ${added.joinToString { names.nameOf(it) }}")
        val response = conversation.toResponse(all, names)
        notify(all, "UPSERT", response)
        return ResponseEntity.ok(response)
    }

    @DeleteMapping("/dms/{conversationId}/members/me")
    @Transactional
    fun leave(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable conversationId: Long
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()
        val conversation = requireConversation(conversationId, callerId)

        if (conversation.kind == ChannelKind.DM)
            return ResponseEntity.badRequest().body(ErrorResponse("You can't leave a 1-on-1 conversation"))

        channelMembers.deleteByChannelIdAndUserId(conversationId, callerId)
        val remaining = memberIds(conversationId) - callerId
        updateMemberKey(conversation, remaining)

        val names = usernames(conversation.workspaceId)
        postSystemMessage(conversationId, callerId, "${names.nameOf(callerId)} left the conversation")
        val response = conversation.toResponse(remaining, names)
        notify(remaining, "UPSERT", response)
        notify(setOf(callerId), "REMOVED", response)
        return ResponseEntity.noContent().build<Unit>()
    }

    @PatchMapping("/dms/{conversationId}")
    @Transactional
    fun rename(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable conversationId: Long,
        @RequestBody req: RenameConversationRequest
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()
        val conversation = requireConversation(conversationId, callerId)

        access.requireRole(conversation.workspaceId, callerId, *NON_GUEST, reason = "Guests cannot rename conversations")

        if (conversation.kind == ChannelKind.DM)
            return ResponseEntity.badRequest().body(ErrorResponse("1-on-1 conversations can't be renamed"))

        val title = req.title?.trim()?.ifEmpty { null }
        if (title != null && title.length > MAX_TITLE_LENGTH)
            return ResponseEntity.badRequest().body(ErrorResponse("Title must be at most $MAX_TITLE_LENGTH characters"))

        conversation.title = title
        channels.save(conversation)

        val names = usernames(conversation.workspaceId)
        val actor = names.nameOf(callerId)
        postSystemMessage(
            conversationId, callerId,
            if (title != null) "$actor renamed the conversation to \"$title\"" else "$actor removed the conversation name"
        )
        val members = memberIds(conversationId)
        val response = conversation.toResponse(members, names)
        notify(members, "UPSERT", response)
        return ResponseEntity.ok(response)
    }

    private fun openOrCreate(workspaceId: Long, creatorId: Long, memberIds: Set<Long>, title: String?): ResponseEntity<*> {
        val key = memberKey(memberIds)
        channels.findByWorkspaceIdAndMemberKey(workspaceId, key)?.let { existing ->
            return ResponseEntity.ok(existing.toResponse(memberIds(existing.id!!), usernames(workspaceId)))
        }

        val kind = if (memberIds.size == 2) ChannelKind.DM else ChannelKind.GROUP_DM
        val prefix = if (kind == ChannelKind.DM) "dm-" else "group-dm-"
        val channel = channels.save(
            Channel(
                workspaceId = workspaceId,
                name = (prefix + key.replace(',', '-')).take(80),
                kind = kind,
                createdBy = creatorId,
                title = if (kind == ChannelKind.GROUP_DM) title else null,
                memberKey = key
            )
        )
        memberIds.forEach { channelMembers.save(ChannelMember(channelId = channel.id!!, userId = it)) }

        val response = channel.toResponse(memberIds, usernames(workspaceId))
        notify(memberIds, "UPSERT", response)
        return ResponseEntity.status(HttpStatus.CREATED).body(response)
    }

    /** Channel membership, plus 404 for regular channels so this API can't change them. */
    private fun requireConversation(conversationId: Long, userId: Long): Channel {
        val channel = access.requireChannelMember(conversationId, userId)
        if (channel.kind != ChannelKind.DM && channel.kind != ChannelKind.GROUP_DM)
            throw NotFoundException("Conversation not found")
        return channel
    }

    /**
     * Keeps `memberKey` equal to the current members. If another conversation already has that
     * key, this one gets null so it is no longer returned when someone opens that member set.
     */
    private fun updateMemberKey(conversation: Channel, memberIds: Set<Long>) {
        val key = if (memberIds.isEmpty()) null else memberKey(memberIds)
        val taken = key != null &&
            channels.findByWorkspaceIdAndMemberKey(conversation.workspaceId, key)?.let { it.id != conversation.id } == true
        conversation.memberKey = if (taken) null else key
        channels.save(conversation)
    }

    private fun postSystemMessage(conversationId: Long, actorId: Long, body: String) {
        val message = messages.save(
            Message(channelId = conversationId, authorId = actorId, body = body, type = MessageType.SYSTEM)
        )
        broker.convertAndSend("/topic/channel.$conversationId", message.toResponse())
    }

    private fun notify(userIds: Collection<Long>, type: String, conversation: ConversationResponse) {
        val event = ConversationEvent(type, conversation)
        userIds.forEach { broker.convertAndSendToUser(it.toString(), "/queue/conversations", event) }
    }

    private fun memberIds(conversationId: Long): Set<Long> =
        channelMembers.findByChannelId(conversationId).map { it.userId }.toSet()

    private fun usernames(workspaceId: Long): Map<Long, String> =
        workspaceMembers.findMembersWithUsernameByWorkspaceId(workspaceId).associate { it.getUserId() to it.getUsername() }

    private fun Map<Long, String>.nameOf(userId: Long) = this[userId] ?: "User $userId"

    private fun Channel.toResponse(memberIds: Collection<Long>, names: Map<Long, String>) = ConversationResponse(
        id = id!!,
        workspaceId = workspaceId,
        kind = kind.name,
        title = title,
        members = memberIds.sorted().map { ConversationMemberResponse(it, names.nameOf(it)) }
    )
}
