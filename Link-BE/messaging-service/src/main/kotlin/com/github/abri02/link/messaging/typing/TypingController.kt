package com.github.abri02.link.messaging.typing

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Controller
import java.security.Principal

data class TypingRequest(val channelId: Long)

data class TypingEvent(val channelId: Long, val userId: Long, val username: String)

/**
 * Clients SEND `{ channelId }` to `/app/typing` while the user types. The event is not stored;
 * it is relayed to `/topic/channel.{id}.typing` only if the sender is a member of that channel.
 * Non-members are silently ignored (there is no reply channel for a fire-and-forget frame).
 */
@Controller
class TypingController(
    private val channelMembers: ChannelMemberRepository,
    private val broker: SimpMessagingTemplate
) {

    // Non-null on purpose: Spring 7 resolves a nullable Kotlin `Principal?` as an Optional,
    // which fails with "argument type mismatch". The interceptor guarantees a user on CONNECT.
    @MessageMapping("/typing")
    fun typing(request: TypingRequest, principal: Principal) {
        val jwt = (principal as? JwtAuthenticationToken)?.token ?: return
        val userId = jwt.subject.toLongOrNull() ?: return
        if (!channelMembers.existsByChannelIdAndUserId(request.channelId, userId)) return

        val username = jwt.getClaimAsString(Claims.USERNAME) ?: "Someone"
        broker.convertAndSend(
            "/topic/channel.${request.channelId}.typing",
            TypingEvent(request.channelId, userId, username)
        )
    }
}
