package com.github.abri02.link.messaging.channel

import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
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

data class OpenDmRequest(val targetUserId: Long)

data class DmResponse(
    val id: Long,
    val workspaceId: Long,
    val otherUserId: Long,
    val otherUsername: String
)

@RestController
@RequestMapping("/workspaces/{workspaceId}/dms")
class DmController(
    private val access: WorkspaceAccess,
    private val workspaceMembers: WorkspaceMemberRepository,
    private val channels: ChannelRepository,
    private val channelMembers: ChannelMemberRepository
) {

    @PostMapping
    @Transactional
    fun open(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable workspaceId: Long,
        @RequestBody req: OpenDmRequest
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()

        access.requireRole(
            workspaceId, callerId, WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.MEMBER,
            reason = "Guests cannot open direct messages"
        )

        if (!workspaceMembers.existsByWorkspaceIdAndUserId(workspaceId, req.targetUserId))
            return ResponseEntity.badRequest().body(ErrorResponse("Target user is not a member of this workspace"))

        if (req.targetUserId == callerId)
            return ResponseEntity.badRequest().body(ErrorResponse("Cannot open a DM with yourself"))

        // Return existing DM if one already exists between these two users.
        val existingId = channels.findDmChannelId(workspaceId, callerId, req.targetUserId)
        if (existingId != null) {
            val dms = channels.findDmsForUser(workspaceId, callerId)
            val dm = dms.first { it.getId() == existingId }
            return ResponseEntity.ok(DmResponse(dm.getId(), dm.getWorkspaceId(), dm.getOtherUserId(), dm.getOtherUsername()))
        }

        // Create new DM channel. Name encodes both user IDs so it's unique per pair.
        val dmName = "dm-${minOf(callerId, req.targetUserId)}-${maxOf(callerId, req.targetUserId)}"
        val channel = channels.save(
            Channel(workspaceId = workspaceId, name = dmName, kind = ChannelKind.DM, createdBy = callerId)
        )
        channelMembers.save(ChannelMember(channelId = channel.id!!, userId = callerId))
        channelMembers.save(ChannelMember(channelId = channel.id, userId = req.targetUserId))

        val dm = channels.findDmsForUser(workspaceId, callerId).first { it.getId() == channel.id }
        return ResponseEntity.status(HttpStatus.CREATED)
            .body(DmResponse(dm.getId(), dm.getWorkspaceId(), dm.getOtherUserId(), dm.getOtherUsername()))
    }

    @GetMapping
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable workspaceId: Long
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()

        access.requireMember(workspaceId, callerId)

        val dms = channels.findDmsForUser(workspaceId, callerId)
            .map { DmResponse(it.getId(), it.getWorkspaceId(), it.getOtherUserId(), it.getOtherUsername()) }

        return ResponseEntity.ok(dms)
    }
}
