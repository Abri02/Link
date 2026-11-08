package com.github.abri02.link.messaging.message

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.channel.ChannelMember
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import com.github.abri02.link.messaging.workspace.MemberWithUsername
import com.github.abri02.link.messaging.workspace.WorkspaceMember
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRole
import com.github.abri02.link.messaging.access.PlanLimitResponse
import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.workspace.Workspace
import com.github.abri02.link.messaging.workspace.WorkspacePlan
import com.github.abri02.link.messaging.support.respond
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.within
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argThat
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.verifyNoInteractions
import org.springframework.data.domain.Pageable
import org.springframework.http.HttpStatus
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.oauth2.jwt.Jwt
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class MessageControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository
    @Mock private lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock private lateinit var messages: MessageRepository
    @Mock private lateinit var reactions: MessageReactionRepository
    @Mock private lateinit var mentions: MessageMentionRepository
    @Mock private lateinit var broker: SimpMessagingTemplate

    private lateinit var controller: MessageController

    @BeforeEach
    fun setup() {
        controller = MessageController(
            WorkspaceAccess(workspaces, workspaceMembers, channels, channelMembers),
            channelMembers, workspaceMembers, messages, mentions, reactions, broker
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
    fun `send lets a GUEST post in a channel they belong to`() {
        // Guests are checked by channel membership only; their workspace role doesn't matter here.
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
        given(messages.save(any<Message>())).willReturn(buildMessage(id = 7L, channelId = 1L, authorId = 1L, body = "Hello"))
        given(channelMembers.findByChannelId(1L)).willReturn(emptyList())

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("Hello")) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        verifyNoInteractions(workspaceMembers)
    }

    @Test
    fun `send returns 400 for blank body`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("   ")) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `send returns 201 with saved message`() {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
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
        givenChannelMember(1L, 10L, 1L)
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
    fun `send stores mentions of channel members and flags their notification`() {
        givenChannelMember(1L, 10L, 1L)
        val text = "hi @bob @carol @dave @user1 @nobody"
        given(messages.save(any<Message>())).willReturn(buildMessage(id = 7L, channelId = 1L, authorId = 1L, body = text))
        // carol is in the workspace but not in the channel. The author mentioning themselves doesn't count.
        given(channelMembers.findByChannelId(1L)).willReturn(
            listOf(ChannelMember(1L, 1L), ChannelMember(1L, 2L), ChannelMember(1L, 4L))
        )
        given(workspaceMembers.findMembersWithUsernameByWorkspaceId(10L))
            .willReturn(listOf(named(1L, "user1"), named(2L, "bob"), named(3L, "carol"), named(4L, "erin")))

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest(text)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        verify(mentions).saveAll(argThat<List<MessageMention>> { map { it.messageId to it.userId } == listOf(7L to 2L) })
        verify(broker).convertAndSendToUser("2", "/queue/notifications", NotificationEvent(1L, 1L, text, mention = true))
        verify(broker).convertAndSendToUser("4", "/queue/notifications", NotificationEvent(1L, 1L, text, mention = false))
        verify(broker, never()).convertAndSendToUser(eq("3"), any(), any<Any>())
        verify(broker, never()).convertAndSendToUser(eq("1"), any(), any<Any>())
    }

    @Test
    fun `send skips the member lookup when the body has no mentions`() {
        givenChannelMember(1L, 10L, 1L)
        val text = "mail me at a@b.com"
        given(messages.save(any<Message>())).willReturn(buildMessage(id = 7L, channelId = 1L, authorId = 1L, body = text))
        given(channelMembers.findByChannelId(1L)).willReturn(listOf(ChannelMember(1L, 2L)))

        respond { controller.send(buildJwt(1L), 1L, SendMessageRequest(text)) }

        verify(workspaceMembers, never()).findMembersWithUsernameByWorkspaceId(any())
        verifyNoInteractions(mentions)
        verify(broker).convertAndSendToUser("2", "/queue/notifications", NotificationEvent(1L, 1L, text, mention = false))
    }

    @Test
    fun `send notifies only the mentioned users of a thread reply`() {
        givenChannelMember(1L, 10L, 1L)
        given(messages.findById(5L)).willReturn(Optional.of(buildMessage(id = 5L, channelId = 1L, authorId = 2L, body = "Parent")))
        given(messages.save(any<Message>())).willReturn(
            buildMessage(id = 8L, channelId = 1L, authorId = 1L, body = "@bob look", parentMessageId = 5L)
        )
        given(channelMembers.findByChannelId(1L)).willReturn(
            listOf(ChannelMember(1L, 1L), ChannelMember(1L, 2L), ChannelMember(1L, 3L))
        )
        given(workspaceMembers.findMembersWithUsernameByWorkspaceId(10L))
            .willReturn(listOf(named(1L, "user1"), named(2L, "bob"), named(3L, "carol")))

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("@bob look", parentMessageId = 5L)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        verify(mentions).saveAll(argThat<List<MessageMention>> { map { it.userId } == listOf(2L) })
        verify(broker).convertAndSendToUser(
            "2", "/queue/notifications",
            NotificationEvent(1L, 1L, "@bob look", mention = true, parentMessageId = 5L)
        )
        verify(broker, never()).convertAndSendToUser(eq("3"), any(), any<Any>())
    }

    @Test
    fun `send returns 400 when parent message does not exist`() {
        givenChannelMember(channelId = 1L, workspaceId = 10L, userId = 1L)
        given(messages.findById(5L)).willReturn(Optional.empty())

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("Reply", parentMessageId = 5L)) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(messages, never()).save(any<Message>())
    }

    @Test
    fun `send returns 400 when parent message is in another channel`() {
        givenChannelMember(channelId = 1L, workspaceId = 10L, userId = 1L)
        given(messages.findById(5L)).willReturn(Optional.of(buildMessage(id = 5L, channelId = 2L, authorId = 2L, body = "Elsewhere")))

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("Reply", parentMessageId = 5L)) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(messages, never()).save(any<Message>())
        verifyNoInteractions(broker)
    }

    @Test
    fun `send returns 400 when replying to a system message`() {
        givenChannelMember(channelId = 1L, workspaceId = 10L, userId = 1L)
        given(messages.findById(5L)).willReturn(Optional.of(
            buildMessage(id = 5L, channelId = 1L, authorId = 2L, body = "bob left the conversation", type = MessageType.SYSTEM)
        ))

        val res = respond { controller.send(buildJwt(1L), 1L, SendMessageRequest("Reply", parentMessageId = 5L)) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(messages, never()).save(any<Message>())
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
        given(messages.findByChannelIdAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(any<Long>(), any<Instant>(), any<Pageable>()))
            .willReturn(emptyList())
        given(reactions.findByMessageIdIn(emptyList())).willReturn(emptyList())

        val res = respond { controller.list(buildJwt(1L), 1L, before = null, limit = 50, q = null) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        @Suppress("UNCHECKED_CAST")
        assertThat(res.body as List<MessageResponse>).isEmpty()
    }

    // ── plan: message history ─────────────────────────────────────────

    @Test
    fun `list on the FREE plan only asks for the last 90 days`() {
        givenMemberOfChannelOnPlan(WorkspacePlan.FREE)
        val since = argumentCaptor<Instant>()
        given(messages.findByChannelIdAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(eq(1L), since.capture(), any<Pageable>()))
            .willReturn(emptyList())

        respond { controller.list(buildJwt(1L), 1L, before = null, limit = 50, q = null) }

        assertThat(since.firstValue)
            .isCloseTo(Instant.now().minus(90, ChronoUnit.DAYS), within(1, ChronoUnit.MINUTES))
    }

    @Test
    fun `list on the PREMIUM plan has no time limit`() {
        givenMemberOfChannelOnPlan(WorkspacePlan.PREMIUM)
        given(messages.findByChannelIdAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(eq(1L), eq(Instant.EPOCH), any<Pageable>()))
            .willReturn(emptyList())

        val res = respond { controller.list(buildJwt(1L), 1L, before = null, limit = 50, q = null) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
    }

    @Test
    fun `search and paging on the FREE plan use the same 90 day limit`() {
        givenMemberOfChannelOnPlan(WorkspacePlan.FREE)
        val since = argumentCaptor<Instant>()
        given(messages.findByChannelIdAndBodyContainingIgnoreCaseAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(eq(1L), eq("hi"), since.capture(), any<Pageable>()))
            .willReturn(emptyList())
        given(messages.findByChannelIdAndIdLessThanAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(eq(1L), eq(9L), since.capture(), any<Pageable>()))
            .willReturn(emptyList())

        respond { controller.list(buildJwt(1L), 1L, before = null, limit = 50, q = "hi") }
        respond { controller.list(buildJwt(1L), 1L, before = 9L, limit = 50, q = null) }

        val cutoff = Instant.now().minus(90, ChronoUnit.DAYS)
        assertThat(since.allValues).hasSize(2).allSatisfy {
            assertThat(it).isCloseTo(cutoff, within(1, ChronoUnit.MINUTES))
        }
    }

    @Test
    fun `thread of a parent older than 90 days returns 402 on the FREE plan`() {
        givenMemberOfChannelOnPlan(WorkspacePlan.FREE)
        given(messages.findById(5L)).willReturn(Optional.of(oldMessage()))

        val res = respond { controller.thread(buildJwt(1L), 1L, 5L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.PAYMENT_REQUIRED)
        assertThat((res.body as PlanLimitResponse).code).isEqualTo("HISTORY_LIMIT_REACHED")
        verify(messages, never()).findByParentMessageIdAndDeletedAtIsNullOrderByCreatedAtAsc(any())
    }

    @Test
    fun `thread of a parent older than 90 days stays readable on the PREMIUM plan`() {
        givenMemberOfChannelOnPlan(WorkspacePlan.PREMIUM)
        given(messages.findById(5L)).willReturn(Optional.of(oldMessage()))
        given(messages.findByParentMessageIdAndDeletedAtIsNullOrderByCreatedAtAsc(5L)).willReturn(emptyList())
        given(reactions.findByMessageIdIn(emptyList())).willReturn(emptyList())

        val res = respond { controller.thread(buildJwt(1L), 1L, 5L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
    }

    private fun givenMemberOfChannelOnPlan(plan: WorkspacePlan) {
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(true)
        given(workspaces.findById(10L)).willReturn(Optional.of(Workspace(name = "W", slug = "w", ownerId = 1L, plan = plan)))
    }

    private fun oldMessage() = Message(
        channelId = 1L, authorId = 2L, body = "Old", createdAt = Instant.now().minus(91, ChronoUnit.DAYS)
    ).also { Message::class.java.getDeclaredField("id").apply { isAccessible = true }.set(it, 5L) }

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

    @Test
    fun `edit returns 400 for a system message, even for its actor`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 1L, body = "alice added bob", type = MessageType.SYSTEM)
        given(messages.findById(1L)).willReturn(Optional.of(msg))

        val res = controller.edit(buildJwt(1L), 1L, 1L, EditMessageRequest("Hacked"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(messages, never()).save(any<Message>())
    }

    @Test
    fun `delete returns 400 for a system message`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 1L, body = "alice added bob", type = MessageType.SYSTEM)
        given(messages.findById(1L)).willReturn(Optional.of(msg))

        val res = respond { controller.delete(buildJwt(1L), 1L, 1L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(messages, never()).save(any<Message>())
    }

    // ── delete ────────────────────────────────────────────────────────

    @Test
    fun `delete returns 403 when a plain member deletes another user's message`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 2L, body = "Hi")
        given(messages.findById(1L)).willReturn(Optional.of(msg))
        givenMemberOfChannel(channelId = 1L, workspaceId = 10L, userId = 1L)

        val res = respond { controller.delete(buildJwt(1L), 1L, 1L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(messages, never()).save(any<Message>())
        verifyNoInteractions(broker)
    }

    @Test
    fun `delete returns 403 when a guest deletes another user's message`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 2L, body = "Hi")
        given(messages.findById(1L)).willReturn(Optional.of(msg))
        givenMemberOfChannel(channelId = 1L, workspaceId = 10L, userId = 1L, role = WorkspaceRole.GUEST)

        val res = respond { controller.delete(buildJwt(1L), 1L, 1L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(messages, never()).save(any<Message>())
    }

    @Test
    fun `delete lets an ADMIN delete another user's message`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 2L, body = "Hi")
        given(messages.findById(1L)).willReturn(Optional.of(msg))
        given(messages.save(any<Message>())).willReturn(msg)
        givenMemberOfChannel(channelId = 1L, workspaceId = 10L, userId = 1L, role = WorkspaceRole.ADMIN)

        val res = respond { controller.delete(buildJwt(1L), 1L, 1L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        assertThat(msg.deletedAt).isNotNull()
        verify(broker).convertAndSend(eq("/topic/channel.1.deletes"), any<DeletedEvent>())
    }

    @Test
    fun `delete lets an OWNER delete another user's message`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 2L, body = "Hi")
        given(messages.findById(1L)).willReturn(Optional.of(msg))
        given(messages.save(any<Message>())).willReturn(msg)
        givenMemberOfChannel(channelId = 1L, workspaceId = 10L, userId = 1L, role = WorkspaceRole.OWNER)

        val res = respond { controller.delete(buildJwt(1L), 1L, 1L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        assertThat(msg.deletedAt).isNotNull()
    }

    @Test
    fun `delete returns 403 when an ADMIN is not a member of the channel`() {
        val msg = buildMessage(id = 1L, channelId = 1L, authorId = 2L, body = "Hi")
        given(messages.findById(1L)).willReturn(Optional.of(msg))
        given(channels.findById(1L)).willReturn(Optional.of(buildChannel(1L, 10L)))
        given(channelMembers.existsByChannelIdAndUserId(1L, 1L)).willReturn(false)

        val res = respond { controller.delete(buildJwt(1L), 1L, 1L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(messages, never()).save(any<Message>())
    }

    @Test
    fun `delete returns 404 when message does not exist`() {
        given(messages.findById(1L)).willReturn(Optional.empty())

        val res = respond { controller.delete(buildJwt(1L), 1L, 1L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `delete returns 404 when message belongs to another channel`() {
        val msg = buildMessage(id = 1L, channelId = 2L, authorId = 1L, body = "Hi")
        given(messages.findById(1L)).willReturn(Optional.of(msg))

        val res = respond { controller.delete(buildJwt(1L), 1L, 1L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
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

    /** Stubs only the channel lookup and channel membership (enough for send). */
    private fun givenChannelMember(channelId: Long, workspaceId: Long, userId: Long) {
        given(channels.findById(channelId)).willReturn(Optional.of(buildChannel(channelId, workspaceId)))
        given(channelMembers.existsByChannelIdAndUserId(channelId, userId)).willReturn(true)
    }

    private fun givenMemberOfChannel(
        channelId: Long, workspaceId: Long, userId: Long, role: WorkspaceRole = WorkspaceRole.MEMBER
    ) {
        givenChannelMember(channelId, workspaceId, userId)
        given(workspaces.existsById(workspaceId)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(workspaceId, userId))
            .willReturn(WorkspaceMember(workspaceId = workspaceId, userId = userId, role = role))
    }

    private fun named(id: Long, username: String) = object : MemberWithUsername {
        override fun getUserId() = id
        override fun getUsername() = username
        override fun getRole() = WorkspaceRole.MEMBER.name
    }

    private fun buildJwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .claim(Claims.EMAIL, "u$userId@test.com")
        .claim(Claims.USERNAME, "user$userId")
        .build()

    private fun buildMessage(
        id: Long, channelId: Long, authorId: Long, body: String, parentMessageId: Long? = null,
        type: MessageType = MessageType.USER
    ): Message {
        val msg = Message(channelId = channelId, authorId = authorId, body = body, parentMessageId = parentMessageId, type = type)
        Message::class.java.getDeclaredField("id").apply { isAccessible = true }.set(msg, id)
        return msg
    }

    private fun buildChannel(id: Long, workspaceId: Long): com.github.abri02.link.messaging.channel.Channel {
        val ch = com.github.abri02.link.messaging.channel.Channel(workspaceId = workspaceId, name = "general", createdBy = 1L)
        com.github.abri02.link.messaging.channel.Channel::class.java.getDeclaredField("id").apply { isAccessible = true }.set(ch, id)
        return ch
    }
}
