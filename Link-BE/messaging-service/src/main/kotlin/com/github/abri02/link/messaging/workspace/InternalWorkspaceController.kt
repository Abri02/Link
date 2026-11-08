package com.github.abri02.link.messaging.workspace

import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import java.security.MessageDigest

data class UpdatePlanRequest(val plan: WorkspacePlan)

/**
 * Service-to-service API, protected by a shared token instead of a user JWT. The gateway
 * refuses every path under /api/internal. An unset token refuses every call.
 */
@RestController
class InternalWorkspaceController(
    private val workspaces: WorkspaceRepository,
    @Value("\${link.internal.service-token}") private val serviceToken: String
) {

    @PatchMapping("/internal/workspaces/{workspaceId}/plan")
    fun updatePlan(
        @RequestHeader("X-Internal-Token", required = false) token: String?,
        @PathVariable workspaceId: Long,
        @RequestBody req: UpdatePlanRequest
    ): ResponseEntity<Unit> {
        if (!validToken(token)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build()
        val workspace = workspaces.findById(workspaceId).orElse(null)
            ?: return ResponseEntity.notFound().build()
        workspace.plan = req.plan
        workspaces.save(workspace)
        return ResponseEntity.noContent().build()
    }

    private fun validToken(token: String?) =
        serviceToken.isNotBlank() && token != null &&
            MessageDigest.isEqual(token.toByteArray(), serviceToken.toByteArray())
}
