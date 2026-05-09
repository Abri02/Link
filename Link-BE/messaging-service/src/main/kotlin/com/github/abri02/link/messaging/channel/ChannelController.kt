package com.github.abri02.link.messaging.channel

import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
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
    val createdAt: Instant
)

data class ErrorResponse(val message: String)

@RestController
@RequestMapping("/workspaces/{workspaceId}/channels")
class ChannelController(
    private val workspaces: WorkspaceRepository,
    private val workspaceMembers: WorkspaceMemberRepository,
    private val channels: ChannelRepository,
    private val channelMembers: ChannelMemberRepository
) {

    @PostMapping
    @Transactional
    fun create(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable workspaceId: Long,
        @RequestBody req: CreateChannelRequest
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()

        if (!workspaces.existsById(workspaceId))
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Workspace not found"))

        if (!workspaceMembers.existsByWorkspaceIdAndUserId(workspaceId, userId))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse("Not a member of this workspace"))

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

        if (!workspaces.existsById(workspaceId))
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Workspace not found"))

        if (!workspaceMembers.existsByWorkspaceIdAndUserId(workspaceId, userId))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse("Not a member of this workspace"))

        return ResponseEntity.ok(channels.findByWorkspaceId(workspaceId).map { it.toResponse() })
    }

    private fun Channel.toResponse() = ChannelResponse(id!!, workspaceId, name, kind.name, createdBy, createdAt)
}
