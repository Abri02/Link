package com.github.abri02.link.messaging.message

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.given
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant

@ExtendWith(MockitoExtension::class)
class MessageControllerTest {

    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository
    @Mock private lateinit var messages: MessageRepository

    private lateinit var controller: MessageController

    @BeforeEach
    fun setup() {
        controller = MessageController(channels, channelMembers, messages)
    }

    // ── send ──────────────────────────────────────────────────────────

    @Test
    fun `send returns 404 when channel does not exist`() {
        given(channels.existsById(99L)).willReturn(false)

        val res = controller.send(buildJwt(1L), 99L, SendMessageRequest("Hello"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `send returns 403 when caller is not a channel member`() {
        given(channels.existsById(1L)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(false)

        val res = controller.send(buildJwt(1L), 1L, SendMessageRequest("Hello"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `send returns 400 for blank body`() {
        given(channels.existsById(1L)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)

        val res = controller.send(buildJwt(1L), 1L, SendMessageRequest("   "))
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `send returns 201 with saved message`() {
        given(channels.existsById(1L)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
        given(messages.save(any<Message>())).willReturn(buildMessage(id = 7L, channelId = 1L, authorId = 1L, body = "Hello"))

        val res = controller.send(buildJwt(1L), 1L, SendMessageRequest("Hello"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val body = res.body as MessageResponse
        assertThat(body.id).isEqualTo(7L)
        assertThat(body.body).isEqualTo("Hello")
    }

    // ── list ──────────────────────────────────────────────────────────

    @Test
    fun `list returns 403 when caller is not a channel member`() {
        given(channels.existsById(1L)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(false)

        val res = controller.list(buildJwt(1L), 1L, before = null, limit = 50)
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    // ── helpers ───────────────────────────────────────────────────────

    private fun buildJwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .claim(Claims.EMAIL, "u$userId@test.com")
        .claim(Claims.USERNAME, "user$userId")
        .build()

    private fun buildMessage(id: Long, channelId: Long, authorId: Long, body: String): Message {
        val msg = Message(channelId = channelId, authorId = authorId, body = body)
        Message::class.java.getDeclaredField("id").apply { isAccessible = true }.set(msg, id)
        return msg
    }
}
