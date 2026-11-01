package com.github.abri02.link.messaging.config

import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.message.MessageRepository
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
    @Lazy private val broker: SimpMessagingTemplate,
    private val channelMembers: ChannelMemberRepository,
    private val messages: MessageRepository
) : ChannelInterceptor {

    companion object {
        private val WILDCARD_CHARS = setOf('*', '?', '{', '}')
        private val CHANNEL_TOPIC = Regex("""/topic/channel\.(\d+)(\.[a-z]+)?""")
        private val REACTIONS_TOPIC = Regex("""/topic/reactions\.(\d+)""")
        private val THREAD_TOPIC = Regex("""/topic/thread\.(\d+)""")
    }

    // sessionId → (userId, tokenValue) — needed for presence on disconnect
    val sessionStore = ConcurrentHashMap<String, Pair<Long, String>>()

    override fun preSend(message: Message<*>, channel: MessageChannel): Message<*>? {
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

            StompCommand.SUBSCRIBE -> {
                // Returning null drops the frame: the subscription is never registered,
                // and the rest of the connection keeps working.
                if (!canSubscribe(accessor)) return null
            }

            StompCommand.DISCONNECT -> {
                publishOffline(accessor.sessionId)
            }

            else -> {}
        }

        return message
    }

    /**
     * Channel-scoped topics require channel membership. Wildcard destinations are rejected because
     * the simple broker would match them against every channel's topic. Other topics
     * (presence, /user/queue/...) pass through.
     */
    private fun canSubscribe(accessor: StompHeaderAccessor): Boolean {
        val destination = accessor.destination ?: return false
        if (destination.any { it in WILDCARD_CHARS }) return false

        val channelId: Long? = when {
            destination.startsWith("/topic/channel.") ->
                CHANNEL_TOPIC.matchEntire(destination)?.groupValues?.get(1)?.toLongOrNull()
            destination.startsWith("/topic/reactions.") ->
                REACTIONS_TOPIC.matchEntire(destination)?.groupValues?.get(1)?.toLongOrNull()
            destination.startsWith("/topic/thread.") ->
                THREAD_TOPIC.matchEntire(destination)?.groupValues?.get(1)?.toLongOrNull()
                    ?.let { parentId -> messages.findById(parentId).orElse(null)?.channelId }
            else -> return true
        }

        val userId = (accessor.user as? JwtAuthenticationToken)?.token?.subject?.toLongOrNull()
        if (channelId == null || userId == null) return false
        return channelMembers.existsByChannelIdAndUserId(channelId, userId)
    }

    // Catches abrupt closes (browser tab killed) where no STOMP DISCONNECT frame is sent
    @EventListener
    fun onSessionDisconnect(event: SessionDisconnectEvent) {
        publishOffline(event.sessionId)
    }

    private fun publishOffline(sessionId: String?) {
        sessionId?.let { sid ->
            sessionStore.remove(sid)?.let { (userId, _) ->
                // Only broadcast offline if this was the user's last active session.
                val stillConnected = sessionStore.values.any { it.first == userId }
                if (!stillConnected) {
                    broker.convertAndSend("/topic/presence", PresenceEvent(userId, online = false))
                }
            }
        }
    }
}
