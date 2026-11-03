package com.github.abri02.link.messaging.channel

import com.github.abri02.link.messaging.access.WorkspaceAccess
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RestController

/**
 * Lets other services (file-service) ask "is the caller a member of this channel?"
 * with the caller's own JWT. 204 = member, 403 = not a member, 404 = no such channel.
 */
@RestController
class ChannelMembershipController(
    private val access: WorkspaceAccess
) {

    @GetMapping("/channels/{channelId}/membership")
    fun check(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long
    ): ResponseEntity<*> {
        access.requireChannelMember(channelId, jwt.subject.toLong())
        return ResponseEntity.noContent().build<Unit>()
    }
}
