package com.github.abri02.link.messaging.channel

import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.message.MessageRepository
import com.github.abri02.link.messaging.message.unreadCounts
import com.github.abri02.link.messaging.workspace.WorkspaceRole
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

data class CreateChannelRequest(val name: String, val kind: ChannelKind = ChannelKind.PUBLIC)

data class ChannelResponse(
    val id: Long,
    val workspaceId: Long,
    val name: String,
    val kind: String,
    val createdBy: Long,
    val createdAt: Instant,
    /** Only filled in by the channel list. Everywhere else it's 0. */
    val unreadCount: Long = 0
)

data class ErrorResponse(val message: String)

@RestController
@RequestMapping("/workspaces/{workspaceId}/channels")
class ChannelController(
    private val access: WorkspaceAccess,
    private val channels: ChannelRepository,
    private val channelMembers: ChannelMemberRepository,
    private val messages: MessageRepository
) {

    @PostMapping
    @Transactional
    fun create(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable workspaceId: Long,
        @RequestBody req: CreateChannelRequest
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()

        access.requireRole(
            workspaceId, userId, WorkspaceRole.OWNER, WorkspaceRole.ADMIN,
            reason = "Only OWNER or ADMIN can create channels"
        )

        if (req.name.isBlank() || req.name.length > 80)
            return ResponseEntity.badRequest().body(ErrorResponse("Channel name must be 1–80 characters"))

        val normalizedName = req.name.trim().lowercase().replace(Regex("\\s+"), "-")

        if (channels.existsByWorkspaceIdAndName(workspaceId, normalizedName))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse("Channel name already taken"))

        val channel = channels.save(
            Channel(workspaceId = workspaceId, name = normalizedName, kind = req.kind, createdBy = userId)
        )
        channelMembers.save(ChannelMember(channelId = channel.id!!, userId = userId))

        return ResponseEntity.status(HttpStatus.CREATED).body(channel.toResponse())
    }

    @GetMapping
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable workspaceId: Long
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()

        access.requireMember(workspaceId, userId)

        val joined = channels.findJoinedChannels(workspaceId, userId)
        val unread = messages.unreadCounts(userId, joined.map { it.id!! })
        return ResponseEntity.ok(joined.map { it.toResponse(unread[it.id] ?: 0) })
    }

    /** Public channels the caller can join. Guests only use the channels they were added to. */
    @GetMapping("/browse")
    fun browse(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable workspaceId: Long
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()

        access.requireRole(
            workspaceId, userId, WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER,
            reason = "Guests cannot browse channels"
        )

        return ResponseEntity.ok(channels.findBrowsableChannels(workspaceId, userId).map { it.toResponse() })
    }
}

fun Channel.toResponse(unreadCount: Long = 0) =
    ChannelResponse(id!!, workspaceId, name, kind.name, createdBy, createdAt, unreadCount)
