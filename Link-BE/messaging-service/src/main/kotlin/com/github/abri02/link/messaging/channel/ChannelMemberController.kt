package com.github.abri02.link.messaging.channel

import com.github.abri02.link.messaging.access.ForbiddenException
import com.github.abri02.link.messaging.access.NotFoundException
import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.message.Message
import com.github.abri02.link.messaging.message.MessageRepository
import com.github.abri02.link.messaging.message.MessageType
import com.github.abri02.link.messaging.message.toResponse
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
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController

data class ChannelMemberResponse(val userId: Long, val username: String)

/** Sent on `/user/queue/channels`. `UPSERT`: show it in the sidebar. `REMOVED`: the user is no longer in it. */
data class ChannelEvent(val type: String, val channel: ChannelResponse)

/**
 * Membership of regular channels (PUBLIC / PRIVATE). DMs and group DMs use [ConversationController].
 * - Anyone except guests can join a public channel. Anyone can leave a channel, except #general.
 * - Private channel members are managed by workspace OWNER/ADMIN or the channel creator, who must
 *   be in the channel themselves.
 */
@RestController
class ChannelMemberController(
    private val access: WorkspaceAccess,
    private val workspaceMembers: WorkspaceMemberRepository,
    private val channels: ChannelRepository,
    private val channelMembers: ChannelMemberRepository,
    private val messages: MessageRepository,
    private val broker: SimpMessagingTemplate
) {

    companion object {
        /** The channel every workspace starts with. It can't be left. */
        const val DEFAULT_CHANNEL = "general"
        private val NON_GUEST = arrayOf(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER)
    }

    @GetMapping("/channels/{channelId}/members")
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long
    ): ResponseEntity<*> {
        val channel = requireRegularChannel(channelId, jwt.subject.toLong())
        val names = usernames(channel.workspaceId)
        return ResponseEntity.ok(
            channelMembers.findByChannelId(channelId).map { it.userId }.sorted()
                .map { ChannelMemberResponse(it, names.nameOf(it)) }
        )
    }

    @PostMapping("/channels/{channelId}/members/me")
    @Transactional
    fun join(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()
        val channel = channels.findById(channelId).orElse(null)
        // Private channels and DMs look the same as missing ones, so their ids can't be probed.
        if (channel == null || channel.kind != ChannelKind.PUBLIC) throw NotFoundException("Channel not found")

        access.requireRole(channel.workspaceId, callerId, *NON_GUEST, reason = "Guests cannot join channels")

        if (channelMembers.existsByChannelIdAndUserId(channelId, callerId))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse("You're already in this channel"))

        channelMembers.save(ChannelMember(channelId = channelId, userId = callerId))
        postSystemMessage(channelId, callerId, "${usernames(channel.workspaceId).nameOf(callerId)} joined the channel")
        notify(callerId, "UPSERT", channel)
        return ResponseEntity.ok(channel.toResponse())
    }

    @DeleteMapping("/channels/{channelId}/members/me")
    @Transactional
    fun leave(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()
        val channel = requireRegularChannel(channelId, callerId)

        if (channel.kind == ChannelKind.PUBLIC && channel.name == DEFAULT_CHANNEL)
            return ResponseEntity.badRequest().body(ErrorResponse("You can't leave #$DEFAULT_CHANNEL"))

        channelMembers.deleteByChannelIdAndUserId(channelId, callerId)
        postSystemMessage(channelId, callerId, "${usernames(channel.workspaceId).nameOf(callerId)} left the channel")
        notify(callerId, "REMOVED", channel)
        return ResponseEntity.noContent().build<Unit>()
    }

    @PostMapping("/channels/{channelId}/members/{userId}")
    @Transactional
    fun add(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long,
        @PathVariable userId: Long
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()
        val channel = requireRegularChannel(channelId, callerId)
        if (channel.kind != ChannelKind.PRIVATE) return publicChannelError()
        requireManager(channel, callerId)

        if (!workspaceMembers.existsByWorkspaceIdAndUserId(channel.workspaceId, userId))
            return ResponseEntity.badRequest().body(ErrorResponse("The user must be a member of this workspace"))
        if (channelMembers.existsByChannelIdAndUserId(channelId, userId))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse("The user is already in this channel"))

        channelMembers.save(ChannelMember(channelId = channelId, userId = userId))
        val names = usernames(channel.workspaceId)
        postSystemMessage(channelId, callerId, "${names.nameOf(callerId)} added ${names.nameOf(userId)}")
        notify(userId, "UPSERT", channel)
        return ResponseEntity.status(HttpStatus.CREATED).body(ChannelMemberResponse(userId, names.nameOf(userId)))
    }

    @DeleteMapping("/channels/{channelId}/members/{userId}")
    @Transactional
    fun remove(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long,
        @PathVariable userId: Long
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()
        val channel = requireRegularChannel(channelId, callerId)
        if (channel.kind != ChannelKind.PRIVATE) return publicChannelError()
        requireManager(channel, callerId)

        if (userId == callerId)
            return ResponseEntity.badRequest().body(ErrorResponse("Use leave to remove yourself"))
        if (!channelMembers.existsByChannelIdAndUserId(channelId, userId))
            throw NotFoundException("The user is not in this channel")

        channelMembers.deleteByChannelIdAndUserId(channelId, userId)
        val names = usernames(channel.workspaceId)
        postSystemMessage(channelId, callerId, "${names.nameOf(callerId)} removed ${names.nameOf(userId)}")
        notify(userId, "REMOVED", channel)
        return ResponseEntity.noContent().build<Unit>()
    }

    /** Channel membership, plus 404 for DMs and group DMs so this API can't change them. */
    private fun requireRegularChannel(channelId: Long, userId: Long): Channel {
        val channel = access.requireChannelMember(channelId, userId)
        if (channel.kind != ChannelKind.PUBLIC && channel.kind != ChannelKind.PRIVATE)
            throw NotFoundException("Channel not found")
        return channel
    }

    private fun publicChannelError() =
        ResponseEntity.badRequest().body(ErrorResponse("Only private channels have managed members. Public channels are joined from Browse channels"))

    private fun requireManager(channel: Channel, callerId: Long) {
        val member = access.requireMember(channel.workspaceId, callerId)
        val isManager = member.role == WorkspaceRole.OWNER || member.role == WorkspaceRole.ADMIN ||
            channel.createdBy == callerId
        if (!isManager) throw ForbiddenException("Only an OWNER, ADMIN or the channel creator can manage members")
    }

    private fun postSystemMessage(channelId: Long, actorId: Long, body: String) {
        val message = messages.save(
            Message(channelId = channelId, authorId = actorId, body = body, type = MessageType.SYSTEM)
        )
        broker.convertAndSend("/topic/channel.$channelId", message.toResponse())
    }

    private fun notify(userId: Long, type: String, channel: Channel) =
        broker.convertAndSendToUser(userId.toString(), "/queue/channels", ChannelEvent(type, channel.toResponse()))

    private fun usernames(workspaceId: Long): Map<Long, String> =
        workspaceMembers.findMembersWithUsernameByWorkspaceId(workspaceId).associate { it.getUserId() to it.getUsername() }

    private fun Map<Long, String>.nameOf(userId: Long) = this[userId] ?: "User $userId"
}
