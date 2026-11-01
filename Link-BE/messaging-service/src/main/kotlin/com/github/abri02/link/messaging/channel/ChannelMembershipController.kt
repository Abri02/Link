package com.github.abri02.link.messaging.channel

import org.springframework.http.HttpStatus
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
    private val channels: ChannelRepository,
    private val channelMembers: ChannelMemberRepository
) {

    @GetMapping("/channels/{channelId}/membership")
    fun check(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable channelId: Long
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()

        if (!channels.existsById(channelId))
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse("Channel not found"))

        if (!channelMembers.existsByChannelIdAndUserId(channelId, userId))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse("Not a member of this channel"))

        return ResponseEntity.noContent().build<Unit>()
    }
}
