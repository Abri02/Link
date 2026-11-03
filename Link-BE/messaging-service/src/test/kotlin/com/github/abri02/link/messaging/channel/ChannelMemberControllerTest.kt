package com.github.abri02.link.messaging.channel

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.message.Message
import com.github.abri02.link.messaging.message.MessageRepository
import com.github.abri02.link.messaging.message.MessageType
import com.github.abri02.link.messaging.support.respond
import com.github.abri02.link.messaging.workspace.MemberWithUsername
import com.github.abri02.link.messaging.workspace.WorkspaceMember
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRole
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.anyOrNull
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.springframework.http.HttpStatus
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class ChannelMemberControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository
    @Mock private lateinit var messages: MessageRepository
    @Mock private lateinit var broker: SimpMessagingTemplate

    private lateinit var controller: ChannelMemberController

    private val ws = 1L

    @BeforeEach
    fun setup() {
        controller = ChannelMemberController(
            WorkspaceAccess(workspaces, workspaceMembers, channels, channelMembers),
            workspaceMembers, channels, channelMembers, messages, broker
        )
    }

    // ── list ────────────────────────────────────────────────────────────────

    @Test
    fun `list returns the members with usernames`() {
        val secret = channel(20L, ChannelKind.PRIVATE, "secret")
        inChannel(2L, secret)
        given(channelMembers.findByChannelId(20L)).willReturn(listOf(ChannelMember(20L, 3L), ChannelMember(20L, 2L)))
        usernames(2L to "bob", 3L to "carol")

        val res = respond { controller.list(jwt(2L), 20L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        @Suppress("UNCHECKED_CAST")
        val body = res.body as List<ChannelMemberResponse>
        assertThat(body).containsExactly(ChannelMemberResponse(2L, "bob"), ChannelMemberResponse(3L, "carol"))
    }

    @Test
    fun `list returns 403 for a non-member and 404 for a DM`() {
        val secret = channel(20L, ChannelKind.PRIVATE, "secret")
        given(channels.findById(20L)).willReturn(Optional.of(secret))
        given(channelMembers.existsByChannelIdAndUserId(20L, 9L)).willReturn(false)
        val dm = channel(30L, ChannelKind.DM, "dm-1-2")
        inChannel(2L, dm)

        assertThat(respond { controller.list(jwt(9L), 20L) }.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        assertThat(respond { controller.list(jwt(2L), 30L) }.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    // ── join ────────────────────────────────────────────────────────────────

    @Test
    fun `join adds the caller to a public channel, posts a system message and notifies them`() {
        val random = channel(10L, ChannelKind.PUBLIC, "random")
        given(channels.findById(10L)).willReturn(Optional.of(random))
        role(2L, WorkspaceRole.MEMBER)
        given(channelMembers.existsByChannelIdAndUserId(10L, 2L)).willReturn(false)
        usernames(2L to "bob")
        givenMessageSaves()

        val res = respond { controller.join(jwt(2L), 10L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat((res.body as ChannelResponse).id).isEqualTo(10L)
        val saved = argumentCaptor<ChannelMember>()
        verify(channelMembers).save(saved.capture())
        assertThat(saved.firstValue.userId).isEqualTo(2L)
        assertSystemMessage(10L, "bob joined the channel")
        verifyEvent(2L, "UPSERT", 10L)
    }

    @Test
    fun `join returns 403 for GUEST`() {
        given(channels.findById(10L)).willReturn(Optional.of(channel(10L, ChannelKind.PUBLIC, "random")))
        role(2L, WorkspaceRole.GUEST)

        val res = respond { controller.join(jwt(2L), 10L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(channelMembers, never()).save(any<ChannelMember>())
    }

    @Test
    fun `join returns 403 when caller is not a workspace member`() {
        given(channels.findById(10L)).willReturn(Optional.of(channel(10L, ChannelKind.PUBLIC, "random")))
        given(workspaces.existsById(ws)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(ws, 9L)).willReturn(null)

        assertThat(respond { controller.join(jwt(9L), 10L) }.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `join returns 404 for a private channel, a DM or a missing channel`() {
        given(channels.findById(20L)).willReturn(Optional.of(channel(20L, ChannelKind.PRIVATE, "secret")))
        given(channels.findById(30L)).willReturn(Optional.of(channel(30L, ChannelKind.DM, "dm-1-2")))
        given(channels.findById(99L)).willReturn(Optional.empty())

        for (id in listOf(20L, 30L, 99L)) {
            assertThat(respond { controller.join(jwt(2L), id) }.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
        }
        verify(channelMembers, never()).save(any<ChannelMember>())
    }

    @Test
    fun `join returns 409 when already a member`() {
        given(channels.findById(10L)).willReturn(Optional.of(channel(10L, ChannelKind.PUBLIC, "random")))
        role(2L, WorkspaceRole.MEMBER)
        given(channelMembers.existsByChannelIdAndUserId(10L, 2L)).willReturn(true)

        assertThat(respond { controller.join(jwt(2L), 10L) }.statusCode).isEqualTo(HttpStatus.CONFLICT)
    }

    // ── leave ───────────────────────────────────────────────────────────────

    @Test
    fun `leave removes the caller from a public channel and notifies them`() {
        val random = channel(10L, ChannelKind.PUBLIC, "random")
        inChannel(2L, random)
        usernames(2L to "bob")
        givenMessageSaves()

        val res = respond { controller.leave(jwt(2L), 10L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(channelMembers).deleteByChannelIdAndUserId(10L, 2L)
        assertSystemMessage(10L, "bob left the channel")
        verifyEvent(2L, "REMOVED", 10L)
    }

    @Test
    fun `a guest can leave a private channel`() {
        // No role lookup: leaving only needs channel membership.
        inChannel(2L, channel(20L, ChannelKind.PRIVATE, "secret"))
        usernames(2L to "guest")
        givenMessageSaves()

        assertThat(respond { controller.leave(jwt(2L), 20L) }.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(channelMembers).deleteByChannelIdAndUserId(20L, 2L)
    }

    @Test
    fun `leave returns 400 for #general`() {
        inChannel(2L, channel(10L, ChannelKind.PUBLIC, "general"))

        assertThat(respond { controller.leave(jwt(2L), 10L) }.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(channelMembers, never()).deleteByChannelIdAndUserId(any(), any())
    }

    @Test
    fun `leave returns 403 for a non-member and 404 for a group DM`() {
        given(channels.findById(10L)).willReturn(Optional.of(channel(10L, ChannelKind.PUBLIC, "random")))
        given(channelMembers.existsByChannelIdAndUserId(10L, 9L)).willReturn(false)
        inChannel(2L, channel(30L, ChannelKind.GROUP_DM, "group-dm-1-2-3"))

        assertThat(respond { controller.leave(jwt(9L), 10L) }.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        assertThat(respond { controller.leave(jwt(2L), 30L) }.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
        verify(channelMembers, never()).deleteByChannelIdAndUserId(any(), any())
    }

    // ── add (private) ───────────────────────────────────────────────────────

    @Test
    fun `admin adds a workspace member to a private channel`() {
        val secret = channel(20L, ChannelKind.PRIVATE, "secret", createdBy = 1L)
        inChannel(2L, secret)
        role(2L, WorkspaceRole.ADMIN)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(ws, 3L)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(20L, 3L)).willReturn(false)
        usernames(2L to "admin", 3L to "carol")
        givenMessageSaves()

        val res = respond { controller.add(jwt(2L), 20L, 3L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        assertThat(res.body).isEqualTo(ChannelMemberResponse(3L, "carol"))
        val saved = argumentCaptor<ChannelMember>()
        verify(channelMembers).save(saved.capture())
        assertThat(saved.firstValue.channelId to saved.firstValue.userId).isEqualTo(20L to 3L)
        assertSystemMessage(20L, "admin added carol")
        verifyEvent(3L, "UPSERT", 20L)
    }

    @Test
    fun `the channel creator can add people even with the MEMBER role`() {
        val secret = channel(20L, ChannelKind.PRIVATE, "secret", createdBy = 2L)
        inChannel(2L, secret)
        role(2L, WorkspaceRole.MEMBER)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(ws, 3L)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(20L, 3L)).willReturn(false)
        usernames(2L to "bob", 3L to "guest")
        givenMessageSaves()

        assertThat(respond { controller.add(jwt(2L), 20L, 3L) }.statusCode).isEqualTo(HttpStatus.CREATED)
    }

    @Test
    fun `add returns 403 for a MEMBER who did not create the channel`() {
        inChannel(2L, channel(20L, ChannelKind.PRIVATE, "secret", createdBy = 1L))
        role(2L, WorkspaceRole.MEMBER)

        assertThat(respond { controller.add(jwt(2L), 20L, 3L) }.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(channelMembers, never()).save(any<ChannelMember>())
    }

    @Test
    fun `add returns 403 for an admin who is not in the private channel`() {
        given(channels.findById(20L)).willReturn(Optional.of(channel(20L, ChannelKind.PRIVATE, "secret")))
        given(channelMembers.existsByChannelIdAndUserId(20L, 2L)).willReturn(false)

        assertThat(respond { controller.add(jwt(2L), 20L, 3L) }.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `add returns 400 for a public channel and when the user is not in the workspace`() {
        inChannel(2L, channel(10L, ChannelKind.PUBLIC, "random"))
        val secret = channel(20L, ChannelKind.PRIVATE, "secret")
        inChannel(2L, secret)
        role(2L, WorkspaceRole.OWNER)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(ws, 9L)).willReturn(false)

        assertThat(respond { controller.add(jwt(2L), 10L, 3L) }.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        assertThat(respond { controller.add(jwt(2L), 20L, 9L) }.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(channelMembers, never()).save(any<ChannelMember>())
    }

    @Test
    fun `add returns 409 when the user is already in the channel`() {
        inChannel(2L, channel(20L, ChannelKind.PRIVATE, "secret"))
        role(2L, WorkspaceRole.OWNER)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(ws, 3L)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(20L, 3L)).willReturn(true)

        assertThat(respond { controller.add(jwt(2L), 20L, 3L) }.statusCode).isEqualTo(HttpStatus.CONFLICT)
    }

    @Test
    fun `add returns 404 for a missing channel`() {
        given(channels.findById(99L)).willReturn(Optional.empty())

        assertThat(respond { controller.add(jwt(2L), 99L, 3L) }.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    // ── remove (private) ────────────────────────────────────────────────────

    @Test
    fun `owner removes a member from a private channel and notifies them`() {
        inChannel(2L, channel(20L, ChannelKind.PRIVATE, "secret"))
        role(2L, WorkspaceRole.OWNER)
        given(channelMembers.existsByChannelIdAndUserId(20L, 3L)).willReturn(true)
        usernames(2L to "owner", 3L to "carol")
        givenMessageSaves()

        val res = respond { controller.remove(jwt(2L), 20L, 3L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(channelMembers).deleteByChannelIdAndUserId(20L, 3L)
        assertSystemMessage(20L, "owner removed carol")
        verifyEvent(3L, "REMOVED", 20L)
    }

    @Test
    fun `remove returns 403 for a MEMBER who did not create the channel`() {
        inChannel(2L, channel(20L, ChannelKind.PRIVATE, "secret", createdBy = 1L))
        role(2L, WorkspaceRole.MEMBER)

        assertThat(respond { controller.remove(jwt(2L), 20L, 3L) }.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(channelMembers, never()).deleteByChannelIdAndUserId(any(), any())
    }

    @Test
    fun `remove returns 400 for yourself and 404 for someone not in the channel`() {
        inChannel(2L, channel(20L, ChannelKind.PRIVATE, "secret"))
        role(2L, WorkspaceRole.ADMIN)
        given(channelMembers.existsByChannelIdAndUserId(20L, 3L)).willReturn(false)

        assertThat(respond { controller.remove(jwt(2L), 20L, 2L) }.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        assertThat(respond { controller.remove(jwt(2L), 20L, 3L) }.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
        verify(channelMembers, never()).deleteByChannelIdAndUserId(any(), any())
    }

    @Test
    fun `remove returns 400 for a public channel`() {
        inChannel(2L, channel(10L, ChannelKind.PUBLIC, "random"))

        assertThat(respond { controller.remove(jwt(2L), 10L, 3L) }.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private fun role(userId: Long, role: WorkspaceRole) {
        given(workspaces.existsById(ws)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(ws, userId))
            .willReturn(WorkspaceMember(workspaceId = ws, userId = userId, role = role))
    }

    private fun inChannel(userId: Long, channel: Channel) {
        given(channels.findById(channel.id!!)).willReturn(Optional.of(channel))
        given(channelMembers.existsByChannelIdAndUserId(channel.id!!, userId)).willReturn(true)
    }

    private fun usernames(vararg names: Pair<Long, String>) {
        given(workspaceMembers.findMembersWithUsernameByWorkspaceId(ws)).willReturn(names.map { (id, name) ->
            object : MemberWithUsername {
                override fun getUserId() = id
                override fun getUsername() = name
                override fun getRole() = "MEMBER"
            }
        })
    }

    private fun givenMessageSaves() {
        given(messages.save(any<Message>())).willAnswer { withId(it.getArgument<Message>(0), 500L) }
    }

    private fun assertSystemMessage(channelId: Long, body: String) {
        val saved = argumentCaptor<Message>()
        verify(messages).save(saved.capture())
        assertThat(saved.firstValue.channelId).isEqualTo(channelId)
        assertThat(saved.firstValue.type).isEqualTo(MessageType.SYSTEM)
        assertThat(saved.firstValue.body).isEqualTo(body)
        verify(broker).convertAndSend(eq("/topic/channel.$channelId"), anyOrNull<Any>())
    }

    private fun verifyEvent(userId: Long, type: String, channelId: Long) {
        val event = argumentCaptor<Any>()
        verify(broker).convertAndSendToUser(eq(userId.toString()), eq("/queue/channels"), event.capture())
        val sent = event.firstValue as ChannelEvent
        assertThat(sent.type).isEqualTo(type)
        assertThat(sent.channel.id).isEqualTo(channelId)
    }

    private fun channel(id: Long, kind: ChannelKind, name: String, createdBy: Long = 1L) =
        withId(Channel(workspaceId = ws, name = name, kind = kind, createdBy = createdBy), id)

    private fun <T : Any> withId(entity: T, id: Long): T {
        entity::class.java.getDeclaredField("id").apply { isAccessible = true }.set(entity, id)
        return entity
    }

    private fun jwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .claim(Claims.EMAIL, "u$userId@test.com")
        .claim(Claims.USERNAME, "user$userId")
        .build()
}
