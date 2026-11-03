package com.github.abri02.link.messaging.config

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.message.Message
import com.github.abri02.link.messaging.message.MessageRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.springframework.messaging.MessageChannel
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.messaging.simp.stomp.StompCommand
import org.springframework.messaging.simp.stomp.StompHeaderAccessor
import org.springframework.messaging.support.MessageBuilder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class StompAuthChannelInterceptorTest {

    @Mock lateinit var jwtDecoder: JwtDecoder
    @Mock lateinit var broker: SimpMessagingTemplate
    @Mock lateinit var channelMembers: ChannelMemberRepository
    @Mock lateinit var messages: MessageRepository
    @Mock lateinit var messageChannel: MessageChannel

    private lateinit var interceptor: StompAuthChannelInterceptor

    @BeforeEach
    fun setup() {
        interceptor = StompAuthChannelInterceptor(jwtDecoder, broker, channelMembers, messages)
    }

    // ── channel topics ────────────────────────────────────────────────

    @Test
    fun `subscribe to channel topic is allowed for a channel member`() {
        given(channelMembers.existsByChannelIdAndUserId(5L, 1L)).willReturn(true)

        val frame = subscribe("/topic/channel.5", userId = 1L)
        assertThat(interceptor.preSend(frame, messageChannel)).isSameAs(frame)
    }

    @Test
    fun `subscribe to channel topic is dropped for a non-member`() {
        given(channelMembers.existsByChannelIdAndUserId(5L, 2L)).willReturn(false)

        assertThat(interceptor.preSend(subscribe("/topic/channel.5", userId = 2L), messageChannel)).isNull()
    }

    @Test
    fun `subscribe to channel edits and deletes topics checks membership of that channel`() {
        given(channelMembers.existsByChannelIdAndUserId(5L, 1L)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(6L, 1L)).willReturn(false)

        assertThat(interceptor.preSend(subscribe("/topic/channel.5.edits", 1L), messageChannel)).isNotNull()
        assertThat(interceptor.preSend(subscribe("/topic/channel.6.deletes", 1L), messageChannel)).isNull()
    }

    @Test
    fun `subscribe to reactions topic checks channel membership`() {
        given(channelMembers.existsByChannelIdAndUserId(5L, 1L)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(5L, 2L)).willReturn(false)

        assertThat(interceptor.preSend(subscribe("/topic/reactions.5", 1L), messageChannel)).isNotNull()
        assertThat(interceptor.preSend(subscribe("/topic/reactions.5", 2L), messageChannel)).isNull()
    }

    // ── thread topics ─────────────────────────────────────────────────

    @Test
    fun `subscribe to thread topic resolves the parent message to its channel`() {
        given(messages.findById(100L)).willReturn(Optional.of(Message(channelId = 5L, authorId = 1L, body = "hi")))
        given(channelMembers.existsByChannelIdAndUserId(5L, 1L)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(5L, 2L)).willReturn(false)

        assertThat(interceptor.preSend(subscribe("/topic/thread.100", 1L), messageChannel)).isNotNull()
        assertThat(interceptor.preSend(subscribe("/topic/thread.100", 2L), messageChannel)).isNull()
    }

    @Test
    fun `subscribe to thread topic is dropped when the parent message does not exist`() {
        given(messages.findById(999L)).willReturn(Optional.empty())

        assertThat(interceptor.preSend(subscribe("/topic/thread.999", 1L), messageChannel)).isNull()
        verify(channelMembers, never()).existsByChannelIdAndUserId(any(), any())
    }

    // ── invalid / malicious destinations ──────────────────────────────

    @Test
    fun `wildcard and malformed channel destinations are dropped`() {
        listOf("/topic/*", "/topic/channel.*", "/topic/**", "/topic/channel.abc", "/topic/reactions.5.x", "/topic/thread.")
            .forEach { dest ->
                assertThat(interceptor.preSend(subscribe(dest, 1L), messageChannel)).`as`(dest).isNull()
            }
        verify(channelMembers, never()).existsByChannelIdAndUserId(any(), any())
    }

    @Test
    fun `subscribe to channel topic without an authenticated user is dropped`() {
        assertThat(interceptor.preSend(subscribe("/topic/channel.5", userId = null), messageChannel)).isNull()
    }

    // ── pass-through ──────────────────────────────────────────────────

    @Test
    fun `presence and user queue topics pass through without a membership check`() {
        listOf("/topic/presence", "/user/queue/notifications").forEach { dest ->
            val frame = subscribe(dest, 1L)
            assertThat(interceptor.preSend(frame, messageChannel)).isSameAs(frame)
        }
        verify(channelMembers, never()).existsByChannelIdAndUserId(any(), any())
    }

    // ── SEND ──────────────────────────────────────────────────────────

    @Test
    fun `send to an app destination passes through`() {
        val frame = send("/app/typing")
        assertThat(interceptor.preSend(frame, messageChannel)).isSameAs(frame)
    }

    @Test
    fun `send straight to a broker topic or queue is dropped`() {
        listOf("/topic/channel.5.typing", "/topic/presence", "/queue/x", "/user/queue/notifications").forEach { dest ->
            assertThat(interceptor.preSend(send(dest), messageChannel)).`as`(dest).isNull()
        }
    }

    // ── helpers ───────────────────────────────────────────────────────

    private fun send(destination: String): org.springframework.messaging.Message<ByteArray> {
        val accessor = StompHeaderAccessor.create(StompCommand.SEND)
        accessor.destination = destination
        accessor.sessionId = "s1"
        accessor.user = JwtAuthenticationToken(buildJwt(1L), emptyList())
        accessor.setLeaveMutable(true)
        return MessageBuilder.createMessage(ByteArray(0), accessor.messageHeaders)
    }

    private fun subscribe(destination: String, userId: Long?): org.springframework.messaging.Message<ByteArray> {
        val accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE)
        accessor.destination = destination
        accessor.sessionId = "s1"
        accessor.subscriptionId = "sub-1"
        if (userId != null) accessor.user = JwtAuthenticationToken(buildJwt(userId), emptyList())
        accessor.setLeaveMutable(true)
        return MessageBuilder.createMessage(ByteArray(0), accessor.messageHeaders)
    }

    private fun buildJwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .claim(Claims.EMAIL, "u$userId@test.com")
        .claim(Claims.USERNAME, "user$userId")
        .build()
}
