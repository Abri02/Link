package com.github.abri02.link.messaging.workspace

import com.github.abri02.link.messaging.access.WorkspaceAccess
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController

data class WorkspaceMembershipResponse(val role: WorkspaceRole)

/**
 * Lets other services (payment-service) ask "what is the caller's role in this workspace?"
 * with the caller's own JWT. 200 = member, 403 = not a member, 404 = no such workspace.
 */
@RestController
class WorkspaceMembershipController(
    private val access: WorkspaceAccess
) {

    @GetMapping("/workspaces/{workspaceId}/membership")
    fun check(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable workspaceId: Long
    ): ResponseEntity<WorkspaceMembershipResponse> {
        val member = access.requireMember(workspaceId, jwt.subject.toLong())
        return ResponseEntity.ok(WorkspaceMembershipResponse(member.role))
    }
}
