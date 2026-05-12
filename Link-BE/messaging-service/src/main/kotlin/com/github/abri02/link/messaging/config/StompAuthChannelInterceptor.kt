package com.github.abri02.link.messaging.config

import org.springframework.context.annotation.Lazy
import org.springframework.context.event.EventListener
import org.springframework.messaging.Message
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.ChannelInterceptor
import org.springframework.messaging.support.MessageHeaderAccessor
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component
import org.springframework.web.socket.messaging.SessionDisconnectEvent
import java.util.concurrent.ConcurrentHashMap

data class PresenceEvent(val userId: Long, val online: Boolean)

@Component
class StompAuthChannelInterceptor(
    private val jwtDecoder: JwtDecoder,
    @Lazy private val broker: SimpMessagingTemplate
) : ChannelInterceptor {

    // sessionId → (userId, tokenValue) — needed for presence on disconnect
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
                    val userId = jwt.subject.toLong()
                    sessionStore[sid] = Pair(userId, jwt.tokenValue)
                    broker.convertAndSend("/topic/presence", PresenceEvent(userId, online = true))
                }
            }

            StompCommand.DISCONNECT -> {
                publishOffline(accessor.sessionId)
            }

            else -> {}
        }

        return message
    }

    // Catches abrupt closes (browser tab killed) where no STOMP DISCONNECT frame is sent
    @EventListener
    fun onSessionDisconnect(event: SessionDisconnectEvent) {
        publishOffline(event.sessionId)
    }

    private fun publishOffline(sessionId: String?) {
        sessionId?.let { sid ->
            sessionStore.remove(sid)?.let { (userId, _) ->
                broker.convertAndSend("/topic/presence", PresenceEvent(userId, online = false))
            }
        }
    }
}
