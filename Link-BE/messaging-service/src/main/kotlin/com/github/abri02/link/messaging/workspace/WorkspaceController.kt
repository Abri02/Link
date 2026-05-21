package com.github.abri02.link.messaging.workspace

import com.github.abri02.link.messaging.channel.Channel
import com.github.abri02.link.messaging.channel.ChannelMember
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

data class CreateWorkspaceRequest(val name: String)

data class AddMemberRequest(val userId: Long, val role: WorkspaceRole = WorkspaceRole.MEMBER)

data class InviteRequest(val identifier: String, val role: WorkspaceRole = WorkspaceRole.MEMBER)

data class WorkspaceResponse(
    val id: Long,
    val name: String,
    val slug: String,
    val ownerId: Long,
    val createdAt: Instant
)

data class WorkspaceMemberResponse(
    val workspaceId: Long,
    val userId: Long,
    val role: String
)

data class MemberDetailResponse(
    val userId: Long,
    val username: String,
    val role: String
)

data class ErrorResponse(val message: String)

@RestController
@RequestMapping("/workspaces")
class WorkspaceController(
    private val workspaces: WorkspaceRepository,
    private val members: WorkspaceMemberRepository,
    private val channels: ChannelRepository,
    private val channelMembers: ChannelMemberRepository,
    private val authService: AuthServiceClient
) {

    @PostMapping
    @Transactional
    fun create(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody req: CreateWorkspaceRequest
    ): ResponseEntity<*> {
        if (req.name.isBlank() || req.name.length > 100)
            return ResponseEntity.badRequest().body(ErrorResponse("Name must be 1–100 characters"))

        val slug = req.name.trim()
            .lowercase()
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
            .let { base ->
                var candidate = base
                var suffix = 1
                while (workspaces.existsBySlug(candidate)) {
                    candidate = "$base-$suffix"
                    suffix++
                }
                candidate
            }

        val userId = jwt.subject.toLong()
        val workspace = workspaces.save(Workspace(name = req.name.trim(), slug = slug, ownerId = userId))

        members.save(WorkspaceMember(workspaceId = workspace.id!!, userId = userId, role = WorkspaceRole.OWNER))

        val general = channels.save(
            Channel(workspaceId = workspace.id, name = "general", createdBy = userId)
        )
        channelMembers.save(ChannelMember(channelId = general.id!!, userId = userId))

        return ResponseEntity.status(HttpStatus.CREATED).body(workspace.toResponse())
    }

    @GetMapping
    fun list(@AuthenticationPrincipal jwt: Jwt): ResponseEntity<List<WorkspaceResponse>> {
        val userId = jwt.subject.toLong()
        val ids = members.findWorkspaceIdsByUserId(userId)
        if (ids.isEmpty()) return ResponseEntity.ok(emptyList())
        return ResponseEntity.ok(workspaces.findAllById(ids).map { it.toResponse() })
    }

    @PostMapping("/{id}/members")
    @Transactional
    fun addMember(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: Long,
        @RequestBody req: AddMemberRequest
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()
        val callerMembership = members.findByWorkspaceIdAndUserId(id, callerId)
            ?: return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse("Not a member of this workspace"))

        if (callerMembership.role !in listOf(WorkspaceRole.OWNER, WorkspaceRole.ADMIN))
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse("Only OWNER or ADMIN can add members"))

        if (!workspaces.existsById(id))
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Workspace not found"))

        if (members.existsByWorkspaceIdAndUserId(id, req.userId))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse("User is already a member"))

        val newMember = members.save(
            WorkspaceMember(workspaceId = id, userId = req.userId, role = req.role)
        )

        channels.findByWorkspaceId(id).forEach { ch ->
            if (!channelMembers.existsByChannelIdAndUserId(ch.id!!, req.userId)) {
                channelMembers.save(ChannelMember(channelId = ch.id, userId = req.userId))
            }
        }

        return ResponseEntity.status(HttpStatus.CREATED)
            .body(WorkspaceMemberResponse(newMember.workspaceId, newMember.userId, newMember.role.name))
    }

    @PostMapping("/{id}/members/invite")
    @Transactional
    fun inviteMember(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: Long,
        @RequestBody req: InviteRequest,
        @RequestHeader(HttpHeaders.AUTHORIZATION) authorization: String
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()
        val callerMembership = members.findByWorkspaceIdAndUserId(id, callerId)
            ?: return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse("Not a member of this workspace"))

        if (callerMembership.role !in listOf(WorkspaceRole.OWNER, WorkspaceRole.ADMIN))
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse("Only OWNER or ADMIN can invite members"))

        if (!workspaces.existsById(id))
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Workspace not found"))

        val user = authService.lookup(req.identifier, authorization)
            ?: return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ErrorResponse("No user found with that username or email"))

        if (members.existsByWorkspaceIdAndUserId(id, user.id))
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse("User is already a member"))

        val newMember = members.save(
            WorkspaceMember(workspaceId = id, userId = user.id, role = req.role)
        )

        channels.findByWorkspaceId(id).forEach { ch ->
            if (!channelMembers.existsByChannelIdAndUserId(ch.id!!, user.id)) {
                channelMembers.save(ChannelMember(channelId = ch.id, userId = user.id))
            }
        }

        return ResponseEntity.status(HttpStatus.CREATED)
            .body(WorkspaceMemberResponse(newMember.workspaceId, newMember.userId, newMember.role.name))
    }

    @GetMapping("/{id}/members")
    fun listMembers(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: Long
    ): ResponseEntity<*> {
        val callerId = jwt.subject.toLong()
        if (!members.existsByWorkspaceIdAndUserId(id, callerId))
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ErrorResponse("Not a member of this workspace"))

        val result = members.findMembersWithUsernameByWorkspaceId(id)
        return ResponseEntity.ok(result.map { MemberDetailResponse(it.getUserId(), it.getUsername(), it.getRole()) })
    }

    private fun Workspace.toResponse() = WorkspaceResponse(id!!, name, slug, ownerId, createdAt)
}
