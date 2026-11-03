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
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.springframework.http.HttpStatus
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class ConversationControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository
    @Mock private lateinit var messages: MessageRepository
    @Mock private lateinit var broker: SimpMessagingTemplate

    private lateinit var controller: ConversationController

    private val ws = 1L

    @BeforeEach
    fun setup() {
        controller = ConversationController(
            WorkspaceAccess(workspaces, workspaceMembers, channels, channelMembers),
            workspaceMembers, channels, channelMembers, messages, broker
        )
    }

    // ── open ────────────────────────────────────────────────────────────────

    @Test
    fun `open returns 403 when caller is GUEST`() {
        callerRole(1L, WorkspaceRole.GUEST)

        val res = respond { controller.open(jwt(1L), ws, OpenConversationRequest(targetUserId = 2L)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(channels, never()).save(any<Channel>())
    }

    @Test
    fun `open returns 403 when caller is not a workspace member`() {
        given(workspaces.existsById(ws)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(ws, 1L)).willReturn(null)

        val res = respond { controller.open(jwt(1L), ws, OpenConversationRequest(userIds = listOf(2L, 3L))) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `open returns 400 when a picked user is not a workspace member`() {
        callerRole(1L, WorkspaceRole.MEMBER)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(ws, 2L)).willReturn(true)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(ws, 3L)).willReturn(false)

        val res = respond { controller.open(jwt(1L), ws, OpenConversationRequest(userIds = listOf(2L, 3L))) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(channels, never()).save(any<Channel>())
    }

    @Test
    fun `open returns 400 when only the caller is picked`() {
        callerRole(1L, WorkspaceRole.MEMBER)

        val res = respond { controller.open(jwt(1L), ws, OpenConversationRequest(targetUserId = 1L)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `open returns 400 when more than 8 other users are picked`() {
        callerRole(1L, WorkspaceRole.MEMBER)

        val res = respond { controller.open(jwt(1L), ws, OpenConversationRequest(userIds = (2L..10L).toList())) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(channels, never()).save(any<Channel>())
    }

    @Test
    fun `open returns 400 when the title is longer than 80 characters`() {
        callerRole(1L, WorkspaceRole.MEMBER)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(eq(ws), any())).willReturn(true)

        val res = respond {
            controller.open(jwt(1L), ws, OpenConversationRequest(userIds = listOf(2L, 3L), title = "x".repeat(81)))
        }

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `open creates a GROUP_DM with every picked user and notifies them`() {
        callerRole(1L, WorkspaceRole.MEMBER)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(eq(ws), any())).willReturn(true)
        given(channels.findByWorkspaceIdAndMemberKey(ws, "1,2,3")).willReturn(null)
        given(channels.save(any<Channel>())).willAnswer { withId(it.arguments[0] as Channel, 50L) }
        usernames(1L to "alice", 2L to "bob", 3L to "carol")

        val res = respond {
            controller.open(jwt(1L), ws, OpenConversationRequest(userIds = listOf(3L, 2L), title = "  Launch  "))
        }

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val body = res.body as ConversationResponse
        assertThat(body.kind).isEqualTo("GROUP_DM")
        assertThat(body.title).isEqualTo("Launch")
        assertThat(body.members.map { it.username }).containsExactly("alice", "bob", "carol")
        val saved = argumentCaptor<Channel>().also { verify(channels).save(it.capture()) }.firstValue
        assertThat(saved.memberKey).isEqualTo("1,2,3")
        verify(channelMembers, times(3)).save(any<ChannelMember>())
        verify(broker, times(3)).convertAndSendToUser(any(), eq("/queue/conversations"), any<Any>())
    }

    @Test
    fun `open with targetUserId creates a 1-on-1 DM without a title`() {
        callerRole(1L, WorkspaceRole.MEMBER)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(ws, 2L)).willReturn(true)
        given(channels.findByWorkspaceIdAndMemberKey(ws, "1,2")).willReturn(null)
        given(channels.save(any<Channel>())).willAnswer { withId(it.arguments[0] as Channel, 50L) }
        usernames(1L to "alice", 2L to "bob")

        val res = respond {
            controller.open(jwt(1L), ws, OpenConversationRequest(targetUserId = 2L, title = "ignored"))
        }

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val body = res.body as ConversationResponse
        assertThat(body.kind).isEqualTo("DM")
        assertThat(body.title).isNull()
        val saved = argumentCaptor<Channel>().also { verify(channels).save(it.capture()) }.firstValue
        assertThat(saved.name).isEqualTo("dm-1-2")
    }

    @Test
    fun `open returns the existing conversation for the same member set`() {
        callerRole(1L, WorkspaceRole.MEMBER)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(eq(ws), any())).willReturn(true)
        val existing = conversation(40L, ChannelKind.GROUP_DM, "1,2,3")
        given(channels.findByWorkspaceIdAndMemberKey(ws, "1,2,3")).willReturn(existing)
        members(40L, 1L, 2L, 3L)
        usernames(1L to "alice", 2L to "bob", 3L to "carol")

        val res = respond { controller.open(jwt(1L), ws, OpenConversationRequest(userIds = listOf(3L, 2L, 1L))) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat((res.body as ConversationResponse).id).isEqualTo(40L)
        verify(channels, never()).save(any<Channel>())
        verify(channelMembers, never()).save(any<ChannelMember>())
    }

    // ── list ────────────────────────────────────────────────────────────────

    @Test
    fun `list returns each conversation once with all its members`() {
        callerRole(1L, WorkspaceRole.GUEST)
        val dm = conversation(40L, ChannelKind.DM, "1,2")
        val group = conversation(41L, ChannelKind.GROUP_DM, "1,2,3").apply { title = "Launch" }
        given(channels.findConversationsForUser(ws, 1L)).willReturn(listOf(dm, group))
        given(channelMembers.findByChannelIdIn(listOf(40L, 41L))).willReturn(
            listOf(ChannelMember(40L, 1L), ChannelMember(40L, 2L), ChannelMember(41L, 1L), ChannelMember(41L, 2L), ChannelMember(41L, 3L))
        )
        usernames(1L to "alice", 2L to "bob", 3L to "carol")

        val res = respond { controller.list(jwt(1L), ws) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        @Suppress("UNCHECKED_CAST")
        val body = res.body as List<ConversationResponse>
        assertThat(body.map { it.id }).containsExactly(40L, 41L)
        assertThat(body[0].members.map { it.userId }).containsExactly(1L, 2L)
        assertThat(body[1].title).isEqualTo("Launch")
        assertThat(body[1].members.map { it.username }).containsExactly("alice", "bob", "carol")
    }

    @Test
    fun `list returns 403 when caller is not a workspace member`() {
        given(workspaces.existsById(ws)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(ws, 1L)).willReturn(null)

        val res = respond { controller.list(jwt(1L), ws) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    // ── addMembers ──────────────────────────────────────────────────────────

    @Test
    fun `addMembers to a 1-on-1 DM creates a new group DM and leaves the DM unchanged`() {
        callerInConversation(1L, conversation(40L, ChannelKind.DM, "1,2"), WorkspaceRole.MEMBER)
        members(40L, 1L, 2L)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(ws, 3L)).willReturn(true)
        given(channels.findByWorkspaceIdAndMemberKey(ws, "1,2,3")).willReturn(null)
        given(channels.save(any<Channel>())).willAnswer { withId(it.arguments[0] as Channel, 51L) }
        usernames(1L to "alice", 2L to "bob", 3L to "carol")

        val res = respond { controller.addMembers(jwt(1L), 40L, AddConversationMembersRequest(listOf(3L))) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val body = res.body as ConversationResponse
        assertThat(body.id).isEqualTo(51L)
        assertThat(body.kind).isEqualTo("GROUP_DM")
        val saved = argumentCaptor<ChannelMember>().also { verify(channelMembers, times(3)).save(it.capture()) }.allValues
        assertThat(saved).allMatch { it.channelId == 51L }
        verify(messages, never()).save(any<Message>())
    }

    @Test
    fun `addMembers to a group DM adds people, recomputes the key and posts a system message`() {
        val group = conversation(41L, ChannelKind.GROUP_DM, "1,2,3")
        callerInConversation(1L, group, WorkspaceRole.MEMBER)
        members(41L, 1L, 2L, 3L)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(ws, 4L)).willReturn(true)
        given(channels.findByWorkspaceIdAndMemberKey(ws, "1,2,3,4")).willReturn(null)
        given(messages.save(any<Message>())).willAnswer { withId(it.arguments[0] as Message, 900L) }
        usernames(1L to "alice", 2L to "bob", 3L to "carol", 4L to "dave")

        val res = respond { controller.addMembers(jwt(1L), 41L, AddConversationMembersRequest(listOf(4L, 2L))) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat((res.body as ConversationResponse).members.map { it.userId }).containsExactly(1L, 2L, 3L, 4L)
        assertThat(group.memberKey).isEqualTo("1,2,3,4")
        verify(channelMembers, times(1)).save(any<ChannelMember>())
        val system = argumentCaptor<Message>().also { verify(messages).save(it.capture()) }.firstValue
        assertThat(system.type).isEqualTo(MessageType.SYSTEM)
        assertThat(system.body).isEqualTo("alice added dave")
        verify(broker).convertAndSend(eq("/topic/channel.41"), any<Any>())
        verify(broker, times(4)).convertAndSendToUser(any(), eq("/queue/conversations"), any<Any>())
    }

    @Test
    fun `addMembers returns 403 when caller is GUEST`() {
        callerInConversation(1L, conversation(41L, ChannelKind.GROUP_DM, "1,2,3"), WorkspaceRole.GUEST)

        val res = respond { controller.addMembers(jwt(1L), 41L, AddConversationMembersRequest(listOf(4L))) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(channelMembers, never()).save(any<ChannelMember>())
    }

    @Test
    fun `addMembers returns 400 when the conversation would have more than 9 people`() {
        callerInConversation(1L, conversation(41L, ChannelKind.GROUP_DM, "1,2,3,4,5,6,7,8"), WorkspaceRole.MEMBER)
        members(41L, *(1L..8L).toList().toLongArray())

        val res = respond { controller.addMembers(jwt(1L), 41L, AddConversationMembersRequest(listOf(9L, 10L))) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(channelMembers, never()).save(any<ChannelMember>())
    }

    @Test
    fun `addMembers returns 400 when a picked user is not a workspace member`() {
        callerInConversation(1L, conversation(41L, ChannelKind.GROUP_DM, "1,2,3"), WorkspaceRole.MEMBER)
        members(41L, 1L, 2L, 3L)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(ws, 4L)).willReturn(false)

        val res = respond { controller.addMembers(jwt(1L), 41L, AddConversationMembersRequest(listOf(4L))) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `addMembers returns 403 when caller is not in the conversation`() {
        given(channels.findById(41L)).willReturn(Optional.of(conversation(41L, ChannelKind.GROUP_DM, "2,3,4")))
        given(channelMembers.existsByChannelIdAndUserId(41L, 1L)).willReturn(false)

        val res = respond { controller.addMembers(jwt(1L), 41L, AddConversationMembersRequest(listOf(5L))) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `addMembers returns 404 for a regular channel`() {
        given(channels.findById(7L)).willReturn(Optional.of(withId(Channel(workspaceId = ws, name = "general", createdBy = 1L), 7L)))
        given(channelMembers.existsByChannelIdAndUserId(7L, 1L)).willReturn(true)

        val res = respond { controller.addMembers(jwt(1L), 7L, AddConversationMembersRequest(listOf(5L))) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    // ── leave ───────────────────────────────────────────────────────────────

    @Test
    fun `leave removes the caller, posts a system message and notifies everyone`() {
        val group = conversation(41L, ChannelKind.GROUP_DM, "1,2,3")
        given(channels.findById(41L)).willReturn(Optional.of(group))
        given(channelMembers.existsByChannelIdAndUserId(41L, 3L)).willReturn(true)
        members(41L, 1L, 2L)
        given(channels.findByWorkspaceIdAndMemberKey(ws, "1,2")).willReturn(null)
        given(messages.save(any<Message>())).willAnswer { withId(it.arguments[0] as Message, 900L) }
        usernames(1L to "alice", 2L to "bob", 3L to "carol")

        val res = respond { controller.leave(jwt(3L), 41L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(channelMembers).deleteByChannelIdAndUserId(41L, 3L)
        assertThat(group.memberKey).isEqualTo("1,2")
        val system = argumentCaptor<Message>().also { verify(messages).save(it.capture()) }.firstValue
        assertThat(system.body).isEqualTo("carol left the conversation")
        val events = argumentCaptor<Any>()
        verify(broker, times(3)).convertAndSendToUser(any(), eq("/queue/conversations"), events.capture())
        assertThat(events.allValues.map { (it as ConversationEvent).type }).containsExactly("UPSERT", "UPSERT", "REMOVED")
    }

    @Test
    fun `leave nulls the member key when the remaining people already have a conversation`() {
        val group = conversation(41L, ChannelKind.GROUP_DM, "1,2,3")
        given(channels.findById(41L)).willReturn(Optional.of(group))
        given(channelMembers.existsByChannelIdAndUserId(41L, 3L)).willReturn(true)
        members(41L, 1L, 2L)
        given(channels.findByWorkspaceIdAndMemberKey(ws, "1,2")).willReturn(conversation(40L, ChannelKind.DM, "1,2"))
        given(messages.save(any<Message>())).willAnswer { withId(it.arguments[0] as Message, 900L) }
        usernames(1L to "alice", 2L to "bob", 3L to "carol")

        val res = respond { controller.leave(jwt(3L), 41L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        assertThat(group.memberKey).isNull()
    }

    @Test
    fun `leave lets a GUEST leave a group DM`() {
        val group = conversation(41L, ChannelKind.GROUP_DM, "1,2,3")
        given(channels.findById(41L)).willReturn(Optional.of(group))
        given(channelMembers.existsByChannelIdAndUserId(41L, 3L)).willReturn(true)
        members(41L, 1L, 2L)
        given(messages.save(any<Message>())).willAnswer { withId(it.arguments[0] as Message, 900L) }
        usernames(3L to "guest")

        val res = respond { controller.leave(jwt(3L), 41L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
    }

    @Test
    fun `leave returns 400 for a 1-on-1 DM`() {
        given(channels.findById(40L)).willReturn(Optional.of(conversation(40L, ChannelKind.DM, "1,2")))
        given(channelMembers.existsByChannelIdAndUserId(40L, 1L)).willReturn(true)

        val res = respond { controller.leave(jwt(1L), 40L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(channelMembers, never()).deleteByChannelIdAndUserId(any(), any())
    }

    @Test
    fun `a user who left gets 403 on the conversation`() {
        given(channels.findById(41L)).willReturn(Optional.of(conversation(41L, ChannelKind.GROUP_DM, "1,2")))
        given(channelMembers.existsByChannelIdAndUserId(41L, 3L)).willReturn(false)

        val leaveAgain = respond { controller.leave(jwt(3L), 41L) }
        val rename = respond { controller.rename(jwt(3L), 41L, RenameConversationRequest("back")) }

        assertThat(leaveAgain.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        assertThat(rename.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    // ── rename ──────────────────────────────────────────────────────────────

    @Test
    fun `rename sets the title, posts a system message and notifies members`() {
        val group = conversation(41L, ChannelKind.GROUP_DM, "1,2,3")
        callerInConversation(1L, group, WorkspaceRole.MEMBER)
        members(41L, 1L, 2L, 3L)
        given(messages.save(any<Message>())).willAnswer { withId(it.arguments[0] as Message, 900L) }
        usernames(1L to "alice", 2L to "bob", 3L to "carol")

        val res = respond { controller.rename(jwt(1L), 41L, RenameConversationRequest(" Launch ")) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(group.title).isEqualTo("Launch")
        val system = argumentCaptor<Message>().also { verify(messages).save(it.capture()) }.firstValue
        assertThat(system.body).isEqualTo("alice renamed the conversation to \"Launch\"")
        verify(broker, times(3)).convertAndSendToUser(any(), eq("/queue/conversations"), any<Any>())
    }

    @Test
    fun `rename with a blank title clears it`() {
        val group = conversation(41L, ChannelKind.GROUP_DM, "1,2,3").apply { title = "Old" }
        callerInConversation(1L, group, WorkspaceRole.MEMBER)
        members(41L, 1L, 2L, 3L)
        given(messages.save(any<Message>())).willAnswer { withId(it.arguments[0] as Message, 900L) }
        usernames(1L to "alice")

        val res = respond { controller.rename(jwt(1L), 41L, RenameConversationRequest("  ")) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(group.title).isNull()
    }

    @Test
    fun `rename returns 403 when caller is GUEST`() {
        callerInConversation(1L, conversation(41L, ChannelKind.GROUP_DM, "1,2,3"), WorkspaceRole.GUEST)

        val res = respond { controller.rename(jwt(1L), 41L, RenameConversationRequest("Launch")) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(channels, never()).save(any<Channel>())
    }

    @Test
    fun `rename returns 400 for a 1-on-1 DM`() {
        callerInConversation(1L, conversation(40L, ChannelKind.DM, "1,2"), WorkspaceRole.MEMBER)

        val res = respond { controller.rename(jwt(1L), 40L, RenameConversationRequest("Launch")) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `rename returns 400 when the title is longer than 80 characters`() {
        callerInConversation(1L, conversation(41L, ChannelKind.GROUP_DM, "1,2,3"), WorkspaceRole.MEMBER)

        val res = respond { controller.rename(jwt(1L), 41L, RenameConversationRequest("x".repeat(81))) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private fun callerRole(userId: Long, role: WorkspaceRole) {
        given(workspaces.existsById(ws)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(ws, userId))
            .willReturn(WorkspaceMember(workspaceId = ws, userId = userId, role = role))
    }

    private fun callerInConversation(userId: Long, conversation: Channel, role: WorkspaceRole) {
        given(channels.findById(conversation.id!!)).willReturn(Optional.of(conversation))
        given(channelMembers.existsByChannelIdAndUserId(conversation.id!!, userId)).willReturn(true)
        callerRole(userId, role)
    }

    private fun members(channelId: Long, vararg userIds: Long) {
        given(channelMembers.findByChannelId(channelId)).willReturn(userIds.map { ChannelMember(channelId, it) })
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

    private fun conversation(id: Long, kind: ChannelKind, key: String) = withId(
        Channel(workspaceId = ws, name = "conv-$id", kind = kind, createdBy = 1L, memberKey = key), id
    )

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
