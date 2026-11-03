package com.github.abri02.link.messaging.message

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.channel.ChannelMember
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import com.github.abri02.link.messaging.workspace.WorkspaceMember
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRole
import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.support.respond
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.eq
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpStatus
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class MessageControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository
    @Mock private lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock private lateinit var messages: MessageRepository
    @Mock private lateinit var reactions: MessageReactionRepository
    @Mock private lateinit var broker: SimpMessagingTemplate

    private lateinit var controller: MessageController

    @BeforeEach
    fun setup() {
        controller = MessageController(
            WorkspaceAccess(workspaces, workspaceMembers, channels, channelMembers),
            channelMembers, messages, reactions, broker
        )
    }

    // ── send ──────────────────────────────────────────────────────────

    @Test
    fun `send returns 404 when channel does not exist`() {
        given(channels.findById(99L)).willReturn(Optional.empty())

        val res = respond { controller.send(buildJwt(1L), 99L, SendMessageRequest("Hello")) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `send returns 403 when caller is not a channel member`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(false)

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("Hello")) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `send returns 403 for GUEST role`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
        given(workspaces.existsById(10L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(10L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 10L, userId = 1L, role = WorkspaceRole.GUEST))

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("Hello")) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `send returns 400 for blank body`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
        given(workspaces.existsById(10L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(10L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 10L, userId = 1L, role = WorkspaceRole.MEMBER))

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("   ")) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `send returns 201 with saved message`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
        given(workspaces.existsById(10L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(10L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 10L, userId = 1L, role = WorkspaceRole.MEMBER))
        given(messages.save(any<Message>())).willReturn(buildMessage(id = 7L, channelId = 1L, authorId = 1L, body = "Hello"))
        given(channelMembers.findByChannelId(1L)).willReturn(emptyList())

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("Hello")) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val body = res.body as MessageResponse
        assertThat(body.id).isEqualTo(7L)
        assertThat(body.body).isEqualTo("Hello")
    }

    @Test
    fun `send stores attachment id name and mime`() {
        givenMemberOfChannel(1L, 10L, 1L)
        given(messages.save(any<Message>())).willAnswer { inv ->
            (inv.arguments[0] as Message).also {
                Message::class.java.getDeclaredField("id").apply { isAccessible = true }.set(it, 9L)
            }
        }
        given(channelMembers.findByChannelId(1L)).willReturn(emptyList())

        val res = controller.send(
            buildJwt(1L), 1L,
            SendMessageRequest("photo.png", attachmentId = 33L, attachmentName = "photo.png", attachmentMime = "image/png")
        )

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val body = res.body as MessageResponse
        assertThat(body.attachmentId).isEqualTo(33L)
        assertThat(body.attachmentName).isEqualTo("photo.png")
        assertThat(body.attachmentMime).isEqualTo("image/png")
    }

    @Test
    fun `send with parentMessageId stores reply and does not notify channel members`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
        given(workspaces.existsById(10L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(10L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 10L, userId = 1L, role = WorkspaceRole.MEMBER))
        given(messages.findById(5L)).willReturn(Optional.of(buildMessage(id = 5L, channelId = 1L, authorId = 2L, body = "Parent")))
        given(messages.save(any<Message>())).willReturn(
            buildMessage(id = 8L, channelId = 1L, authorId = 1L, body = "Reply", parentMessageId = 5L)
        )

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("Reply", parentMessageId = 5L)) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val body = res.body as MessageResponse
        assertThat(body.parentMessageId).isEqualTo(5L)
        verify(broker).convertAndSend(eq("/topic/thread.5"), any<MessageResponse>())
        verify(channelMembers, never()).findByChannelId(any())
    }

    @Test
    fun `send returns 400 when parent message does not exist`() {
        givenMemberOfChannel(channelId = 1L, workspaceId = 10L, userId = 1L)
        given(messages.findById(5L)).willReturn(Optional.empty())

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("Reply", parentMessageId = 5L)) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(messages, never()).save(any<Message>())
    }

    @Test
    fun `send returns 400 when parent message is in another channel`() {
        givenMemberOfChannel(channelId = 1L, workspaceId = 10L, userId = 1L)
        given(messages.findById(5L)).willReturn(Optional.of(buildMessage(id = 5L, channelId = 2L, authorId = 2L, body = "Elsewhere")))

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("Reply", parentMessageId = 5L)) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(messages, never()).save(any<Message>())
        verifyNoInteractions(broker)
    }

    // ── thread ────────────────────────────────────────────────────────

    @Test
    fun `thread returns 404 when channel does not exist`() {
        given(channels.findById(99L)).willReturn(Optional.empty())

        val res = respond { controller.thread(buildJwt(1L), 99L, 5L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `thread returns 403 when caller is not a channel member`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(false)

        val res = respond { controller.thread(buildJwt(1L), 1L, 5L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `thread returns 404 when message does not exist`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
        given(messages.findById(5L)).willReturn(Optional.empty())

        val res = respond { controller.thread(buildJwt(1L), 1L, 5L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `thread returns 404 when message belongs to another channel`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
        given(messages.findById(5L)).willReturn(Optional.of(buildMessage(id = 5L, channelId = 2L, authorId = 2L, body = "Secret")))

        val res = respond { controller.thread(buildJwt(1L), 1L, 5L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
        verify(messages, never()).findByParentMessageIdAndDeletedAtIsNullOrderByCreatedAtAsc(any())
    }

    @Test
    fun `thread returns replies when message belongs to the channel`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
        given(messages.findById(5L)).willReturn(Optional.of(buildMessage(id = 5L, channelId = 1L, authorId = 2L, body = "Parent")))
        given(messages.findByParentMessageIdAndDeletedAtIsNullOrderByCreatedAtAsc(5L))
            .willReturn(listOf(buildMessage(id = 6L, channelId = 1L, authorId = 1L, body = "Reply", parentMessageId = 5L)))
        given(reactions.findByMessageIdIn(listOf(6L))).willReturn(emptyList())

        val res = respond { controller.thread(buildJwt(1L), 1L, 5L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        @Suppress("UNCHECKED_CAST")
        val body = res.body as List<MessageResponse>
        assertThat(body.map { it.id }).containsExactly(6L)
    }

    // ── list ──────────────────────────────────────────────────────────

    @Test
    fun `list returns 404 when channel does not exist`() {
        given(channels.findById(99L)).willReturn(Optional.empty())

        val res = respond { controller.list(buildJwt(1L), 99L, before = null, limit = 50, q = null) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `list returns 403 when caller is not a channel member`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(false)

        val res = respond { controller.list(buildJwt(1L), 1L, before = null, limit = 50, q = null) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `list returns empty list when no messages exist`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
        given(messages.findByChannelIdAndParentMessageIdIsNullAndDeletedAtIsNullOrderByCreatedAtDesc(any<Long>(), any<Pageable>()))
            .willReturn(emptyList())
        given(reactions.findByMessageIdIn(emptyList())).willReturn(emptyList())

        val res = respond { controller.list(buildJwt(1L), 1L, before = null, limit = 50, q = null) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        @Suppress("UNCHECKED_CAST")
        assertThat(res.body as List<MessageResponse>).isEmpty()
    }

    // ── edit ──────────────────────────────────────────────────────────

    @Test
    fun `edit returns 404 when message does not exist`() {
        given(messages.findById(99L)).willReturn(Optional.empty())

        val res = controller.edit(buildJwt(1L), 1L, 99L, EditMessageRequest("New body"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `edit returns 403 when caller is not the author`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 2L, body = "Original")
        given(messages.findById(1L)).willReturn(Optional.of(msg))

        val res = controller.edit(buildJwt(1L), 1L, 1L, EditMessageRequest("New body"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `edit returns 400 for blank body`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 1L, body = "Original")
        given(messages.findById(1L)).willReturn(Optional.of(msg))

        val res = controller.edit(buildJwt(1L), 1L, 1L, EditMessageRequest("  "))
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `edit updates message body and returns 200`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 1L, body = "Original")
        given(messages.findById(1L)).willReturn(Optional.of(msg))
        given(messages.save(any<Message>())).willReturn(buildMessage(id = 1L, channelId = 1L, authorId = 1L, body = "Updated"))

        val res = controller.edit(buildJwt(1L), 1L, 1L, EditMessageRequest("Updated"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat((res.body as MessageResponse).body).isEqualTo("Updated")
    }

    // ── delete ────────────────────────────────────────────────────────

    @Test
    fun `delete returns 403 when caller is not the author`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 2L, body = "Hi")
        given(messages.findById(1L)).willReturn(Optional.of(msg))

        val res = controller.delete(buildJwt(1L), 1L, 1L)
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `delete soft-deletes and returns 204`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 1L, body = "Hi")
        given(messages.findById(1L)).willReturn(Optional.of(msg))
        given(messages.save(any<Message>())).willReturn(msg)

        val res = controller.delete(buildJwt(1L), 1L, 1L)
        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
    }

    // ── helpers ───────────────────────────────────────────────────────

    private fun givenMemberOfChannel(channelId: Long, workspaceId: Long, userId: Long) {
        given(channels.findById(channelId)).willReturn(Optional.of(buildChannel(channelId, workspaceId)))
        given(channelMembers.existsByChannelIdAndUserId(channelId, userId)).willReturn(true)
        given(workspaces.existsById(workspaceId)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(workspaceId, userId))
            .willReturn(WorkspaceMember(workspaceId = workspaceId, userId = userId, role = WorkspaceRole.MEMBER))
    }

    private fun buildJwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .claim(Claims.EMAIL, "u$userId@test.com")
        .claim(Claims.USERNAME, "user$userId")
        .build()

    private fun buildMessage(
        id: Long, channelId: Long, authorId: Long, body: String, parentMessageId: Long? = null
    ): Message {
        val msg = Message(channelId = channelId, authorId = authorId, body = body, parentMessageId = parentMessageId)
        Message::class.java.getDeclaredField("id").apply { isAccessible = true }.set(msg, id)
        return msg
    }

    private fun buildChannel(id: Long, workspaceId: Long): com.github.abri02.link.messaging.channel.Channel {
        val ch = com.github.abri02.link.messaging.channel.Channel(workspaceId = workspaceId, name = "general", createdBy = 1L)
        com.github.abri02.link.messaging.channel.Channel::class.java.getDeclaredField("id").apply { isAccessible = true }.set(ch, id)
        return ch
    }
}
