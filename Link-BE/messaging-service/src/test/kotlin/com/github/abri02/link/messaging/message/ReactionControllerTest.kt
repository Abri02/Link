package com.github.abri02.link.messaging.message

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import com.github.abri02.link.messaging.workspace.WorkspaceMember
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRole
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.given
import org.springframework.http.HttpStatus
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class ReactionControllerTest {

    @Mock private lateinit var messages: MessageRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository
    @Mock private lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock private lateinit var reactions: MessageReactionRepository
    @Mock private lateinit var broker: SimpMessagingTemplate

    private lateinit var controller: ReactionController

    @BeforeEach
    fun setup() {
        controller = ReactionController(messages, channels, channelMembers, workspaceMembers, reactions, broker)
    }

    // ── add ───────────────────────────────────────────────────────────

    @Test
    fun `add returns 404 when message does not exist`() {
        given(messages.findById(99L)).willReturn(Optional.empty())

        val res = controller.add(buildJwt(1L), 99L, "👍")
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `add returns 403 when caller is not a channel member`() {
        given(messages.findById(1L)).willReturn(Optional.of(buildMessage(1L, channelId = 10L)))
        given(channelMembers.existsByChannelIdAndUserId(10L, 1L)).willReturn(false)

        val res = controller.add(buildJwt(1L), 1L, "👍")
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `add returns 403 for GUEST role`() {
        given(messages.findById(1L)).willReturn(Optional.of(buildMessage(1L, channelId = 10L)))
        given(channelMembers.existsByChannelIdAndUserId(10L, 1L)).willReturn(true)
        given(channels.findById(10L)).willReturn(Optional.of(buildChannel(10L, workspaceId = 5L)))
        given(workspaceMembers.findByWorkspaceIdAndUserId(5L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 5L, userId = 1L, role = WorkspaceRole.GUEST))

        val res = controller.add(buildJwt(1L), 1L, "👍")
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `add returns 200 and saves reaction when not already reacted`() {
        given(messages.findById(1L)).willReturn(Optional.of(buildMessage(1L, channelId = 10L)))
        given(channelMembers.existsByChannelIdAndUserId(10L, 1L)).willReturn(true)
        given(channels.findById(10L)).willReturn(Optional.of(buildChannel(10L, workspaceId = 5L)))
        given(workspaceMembers.findByWorkspaceIdAndUserId(5L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 5L, userId = 1L, role = WorkspaceRole.MEMBER))
        given(reactions.existsByMessageIdAndUserIdAndEmoji(1L, 1L, "👍")).willReturn(false)
        given(reactions.save(any<MessageReaction>())).willReturn(MessageReaction(1L, 1L, "👍"))
        given(reactions.findByMessageId(1L)).willReturn(listOf(MessageReaction(1L, 1L, "👍")))

        val res = controller.add(buildJwt(1L), 1L, "👍")
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
    }

    @Test
    fun `add returns 200 and skips save when already reacted`() {
        given(messages.findById(1L)).willReturn(Optional.of(buildMessage(1L, channelId = 10L)))
        given(channelMembers.existsByChannelIdAndUserId(10L, 1L)).willReturn(true)
        given(channels.findById(10L)).willReturn(Optional.of(buildChannel(10L, workspaceId = 5L)))
        given(workspaceMembers.findByWorkspaceIdAndUserId(5L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 5L, userId = 1L, role = WorkspaceRole.MEMBER))
        given(reactions.existsByMessageIdAndUserIdAndEmoji(1L, 1L, "👍")).willReturn(true)
        given(reactions.findByMessageId(1L)).willReturn(listOf(MessageReaction(1L, 1L, "👍")))

        val res = controller.add(buildJwt(1L), 1L, "👍")
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
    }

    // ── remove ────────────────────────────────────────────────────────

    @Test
    fun `remove returns 404 when message does not exist`() {
        given(messages.findById(99L)).willReturn(Optional.empty())

        val res = controller.remove(buildJwt(1L), 99L, "👍")
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `remove returns 403 when caller is not a channel member`() {
        given(messages.findById(1L)).willReturn(Optional.of(buildMessage(1L, channelId = 10L)))
        given(channelMembers.existsByChannelIdAndUserId(10L, 1L)).willReturn(false)

        val res = controller.remove(buildJwt(1L), 1L, "👍")
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `remove returns 204 and deletes reaction`() {
        given(messages.findById(1L)).willReturn(Optional.of(buildMessage(1L, channelId = 10L)))
        given(channelMembers.existsByChannelIdAndUserId(10L, 1L)).willReturn(true)
        given(reactions.findByMessageId(1L)).willReturn(emptyList())

        val res = controller.remove(buildJwt(1L), 1L, "👍")
        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
    }

    // ── helpers ───────────────────────────────────────────────────────

    private fun buildJwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .claim(Claims.EMAIL, "u$userId@test.com")
        .claim(Claims.USERNAME, "user$userId")
        .build()

    private fun buildMessage(id: Long, channelId: Long): Message {
        val msg = Message(channelId = channelId, authorId = 1L, body = "test")
        Message::class.java.getDeclaredField("id").apply { isAccessible = true }.set(msg, id)
        return msg
    }

    private fun buildChannel(id: Long, workspaceId: Long): com.github.abri02.link.messaging.channel.Channel {
        val ch = com.github.abri02.link.messaging.channel.Channel(workspaceId = workspaceId, name = "general", createdBy = 1L)
        com.github.abri02.link.messaging.channel.Channel::class.java.getDeclaredField("id").apply { isAccessible = true }.set(ch, id)
        return ch
    }
}
