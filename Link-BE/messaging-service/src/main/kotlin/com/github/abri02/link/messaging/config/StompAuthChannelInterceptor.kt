package com.github.abri02.link.messaging.config

import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component
import java.util.concurrent.ConcurrentHashMap

@Component
class StompAuthChannelInterceptor(private val jwtDecoder: JwtDecoder) : ChannelInterceptor {

    // sessionId → (userId, rawToken) — needed to call presence on DISCONNECT
    val sessionStore = ConcurrentHashMap<String, Pair<Long, String>>()

    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*> {
        val accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor::class.java)
            ?: return message

        when (accessor.command) {
            StompCommand.CONNECT -> {
                // Primary path: principal already validated during HTTP handshake by JwtHandshakeInterceptor
                val fromHandshake = accessor.sessionAttributes?.get("principal") as? JwtAuthenticationToken

                val auth = if (fromHandshake != null) {
                    fromHandshake
                } else {
                    // Fallback: STOMP native Authorization header (direct connection, no gateway)
                    val raw = accessor.getFirstNativeHeader("Authorization")
                        ?.removePrefix("Bearer ")
                        ?: throw org.springframework.messaging.MessagingException("Missing Authorization header")
                    val jwt = jwtDecoder.decode(raw)
                    JwtAuthenticationToken(jwt, emptyList())
                }

                accessor.user = auth

                accessor.sessionId?.let { sid ->
                    val jwt = auth.token
                    sessionStore[sid] = Pair(jwt.subject.toLong(), jwt.tokenValue)
                }
            }

            StompCommand.DISCONNECT -> {
                accessor.sessionId?.let { sessionStore.remove(it) }
            }

            else -> {}
        }

        return message
    }
}
