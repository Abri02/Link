package com.github.abri02.link.messaging.call

import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.channel.Channel
import com.github.abri02.link.messaging.channel.ChannelKind
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import com.github.abri02.link.messaging.workspace.Workspace
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspacePlan
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.Mockito.lenient
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.eq
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import java.time.Instant
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class CallSignalControllerTest {

    @Mock lateinit var channels: ChannelRepository
    @Mock lateinit var channelMembers: ChannelMemberRepository
    @Mock lateinit var calls: CallRepository
    @Mock lateinit var workspaces: WorkspaceRepository
    @Mock lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock lateinit var broker: SimpMessagingTemplate

    private lateinit var controller: CallSignalController

    private val caller = 1L
    private val callee = 2L
    private val dmId = 10L

    @BeforeEach
    fun setup() {
        controller = CallSignalController(
            channels, channelMembers, calls,
            WorkspaceAccess(workspaces, workspaceMembers, channels, channelMembers), broker
        )
    }

    @Test
    fun `member signal is relayed to the other DM member with fromUserId taken from the token`() {
        givenDm(ChannelKind.DM, caller, callee)
        val sdp = mapOf("type" to "offer", "sdp" to "v=0")

        controller.signal(
            CallSignal(CallSignalType.OFFER, "c1", toUserId = callee, channelId = dmId, fromUserId = 999L, payload = sdp),
            principal(caller)
        )

        verify(broker).convertAndSendToUser(
            "2",
            "/queue/call",
            CallSignal(CallSignalType.OFFER, "c1", toUserId = callee, channelId = dmId, fromUserId = caller, payload = sdp)
        )
        verify(calls, never()).save(any())
    }

    @Test
    fun `signal from a non-member of the DM is dropped`() {
        given(channels.findById(dmId)).willReturn(Optional.of(channel(ChannelKind.DM)))
        given(channelMembers.existsByChannelIdAndUserId(dmId, 3L)).willReturn(false)

        controller.signal(invite(to = callee), principal(3L))

        verifyNotRelayed()
    }

    @Test
    fun `signal to a user who is not in the DM is dropped`() {
        given(channels.findById(dmId)).willReturn(Optional.of(channel(ChannelKind.DM)))
        given(channelMembers.existsByChannelIdAndUserId(dmId, caller)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(dmId, 3L)).willReturn(false)

        controller.signal(invite(to = 3L), principal(caller))

        verifyNotRelayed()
    }

    @Test
    fun `signals in a group DM or a channel are dropped`() {
        for (kind in listOf(ChannelKind.GROUP_DM, ChannelKind.PUBLIC, ChannelKind.PRIVATE)) {
            given(channels.findById(dmId)).willReturn(Optional.of(channel(kind)))
            controller.signal(invite(to = callee), principal(caller))
        }

        verify(channelMembers, never()).existsByChannelIdAndUserId(any(), any())
        verifyNotRelayed()
    }

    @Test
    fun `signal for an unknown channel is dropped`() {
        given(channels.findById(dmId)).willReturn(Optional.empty())

        controller.signal(invite(to = callee), principal(caller))

        verifyNotRelayed()
    }

    @Test
    fun `signal to yourself, with a blank or too long callId, or without a JWT principal is dropped`() {
        controller.signal(invite(to = caller), principal(caller))
        controller.signal(invite(to = callee).copy(callId = " "), principal(caller))
        controller.signal(invite(to = callee).copy(callId = "x".repeat(65)), principal(caller))
        controller.signal(invite(to = callee)) { "anonymous" }

        verify(channels, never()).findById(any())
        verifyNotRelayed()
    }

    @Test
    fun `accept stores a call record with the inviter as caller`() {
        givenDm(ChannelKind.DM, callee, caller)
        given(calls.existsByCallId("c1")).willReturn(false)
        givenSaveReturnsArgument()

        controller.signal(CallSignal(CallSignalType.ACCEPT, "c1", toUserId = caller, channelId = dmId), principal(callee))

        val saved = argumentCaptor<Call>()
        verify(calls).save(saved.capture())
        assertThat(saved.firstValue.callId).isEqualTo("c1")
        assertThat(saved.firstValue.channelId).isEqualTo(dmId)
        assertThat(saved.firstValue.callerId).isEqualTo(caller)
        assertThat(saved.firstValue.calleeId).isEqualTo(callee)
        assertThat(saved.firstValue.endedAt).isNull()
        verify(broker).convertAndSendToUser(any(), any(), any<Any>())
    }

    @Test
    fun `a repeated accept for the same callId does not store a second record`() {
        givenDm(ChannelKind.DM, callee, caller)
        given(calls.existsByCallId("c1")).willReturn(true)

        controller.signal(CallSignal(CallSignalType.ACCEPT, "c1", toUserId = caller, channelId = dmId), principal(callee))

        verify(calls, never()).save(any())
    }

    @Test
    fun `hangup by either participant sets endedAt`() {
        givenDm(ChannelKind.DM, callee, caller)
        val call = Call("c1", dmId, callerId = caller, calleeId = callee, startedAt = Instant.now().minusSeconds(30))
        given(calls.findByCallId("c1")).willReturn(call)
        givenSaveReturnsArgument()

        controller.signal(CallSignal(CallSignalType.HANGUP, "c1", toUserId = caller, channelId = dmId), principal(callee))

        assertThat(call.endedAt).isNotNull().isAfter(call.startedAt)
        verify(calls).save(call)
    }

    @Test
    fun `hangup for a call of another channel or an already ended call does not change it`() {
        givenDm(ChannelKind.DM, caller, callee)
        val otherChannel = Call("c1", 99L, callerId = caller, calleeId = callee)
        val ended = Call("c2", dmId, callerId = caller, calleeId = callee, endedAt = Instant.EPOCH)
        whenever(calls.findByCallId("c1")).thenReturn(otherChannel)
        whenever(calls.findByCallId("c2")).thenReturn(ended)

        controller.signal(CallSignal(CallSignalType.HANGUP, "c1", toUserId = callee, channelId = dmId), principal(caller))
        controller.signal(CallSignal(CallSignalType.HANGUP, "c2", toUserId = callee, channelId = dmId), principal(caller))

        assertThat(otherChannel.endedAt).isNull()
        assertThat(ended.endedAt).isEqualTo(Instant.EPOCH)
        verify(calls, never()).save(any())
    }

    @Test
    fun `hangup by someone who was not in the call does not end it`() {
        givenDm(ChannelKind.DM, caller, callee)
        val call = Call("c1", dmId, callerId = 5L, calleeId = 6L)
        given(calls.findByCallId("c1")).willReturn(call)

        controller.signal(CallSignal(CallSignalType.HANGUP, "c1", toUserId = callee, channelId = dmId), principal(caller))

        assertThat(call.endedAt).isNull()
        verify(calls, never()).save(any())
    }

    // ── plan: video calls ─────────────────────────────────────────────

    @Test
    fun `an INVITE on the FREE plan is refused and never reaches the callee`() {
        givenDm(ChannelKind.DM, caller, callee, WorkspacePlan.FREE)

        controller.signal(invite(to = callee), principal(caller))

        verify(broker).convertAndSendToUser(
            "1",
            "/queue/call",
            CallSignal(CallSignalType.PREMIUM_REQUIRED, "c1", toUserId = caller, channelId = dmId, fromUserId = callee)
        )
        verify(broker, never()).convertAndSendToUser(eq("2"), any(), any<Any>())
    }

    @Test
    fun `an ACCEPT on the FREE plan is refused and stores no call`() {
        givenDm(ChannelKind.DM, callee, caller, WorkspacePlan.FREE)

        controller.signal(CallSignal(CallSignalType.ACCEPT, "c1", toUserId = caller, channelId = dmId), principal(callee))

        verify(calls, never()).save(any())
        verify(broker, never()).convertAndSendToUser(eq("1"), any(), any<Any>())
    }

    @Test
    fun `an OFFER without a running call is dropped on the FREE plan`() {
        givenDm(ChannelKind.DM, caller, callee, WorkspacePlan.FREE)
        given(calls.findByCallId("c1")).willReturn(null)

        controller.signal(offer(), principal(caller))

        verifyNotRelayed()
    }

    @Test
    fun `an OFFER for an ended call or a call of another channel is dropped on the FREE plan`() {
        givenDm(ChannelKind.DM, caller, callee, WorkspacePlan.FREE)
        given(calls.findByCallId("c1")).willReturn(Call("c1", dmId, caller, callee, endedAt = Instant.EPOCH))
        given(calls.findByCallId("c2")).willReturn(Call("c2", 99L, caller, callee))

        controller.signal(offer(), principal(caller))
        controller.signal(offer().copy(callId = "c2"), principal(caller))

        verifyNotRelayed()
    }

    @Test
    fun `a call already running keeps signaling after a downgrade`() {
        givenDm(ChannelKind.DM, caller, callee, WorkspacePlan.FREE)
        given(calls.findByCallId("c1")).willReturn(Call("c1", dmId, caller, callee))

        controller.signal(offer(), principal(caller))

        verify(broker).convertAndSendToUser("2", "/queue/call", offer().copy(fromUserId = caller))
    }

    @Test
    fun `a HANGUP is relayed on the FREE plan without looking up the plan`() {
        givenDm(ChannelKind.DM, caller, callee, WorkspacePlan.FREE)
        given(calls.findByCallId("c1")).willReturn(null)

        controller.signal(CallSignal(CallSignalType.HANGUP, "c1", toUserId = callee, channelId = dmId), principal(caller))

        verify(workspaces, never()).findById(any())
        verify(broker).convertAndSendToUser(eq("2"), eq("/queue/call"), any<Any>())
    }

    @Test
    fun `a client can't send PREMIUM_REQUIRED itself`() {
        controller.signal(CallSignal(CallSignalType.PREMIUM_REQUIRED, "c1", toUserId = callee, channelId = dmId), principal(caller))

        verify(channels, never()).findById(any())
        verifyNotRelayed()
    }

    private fun offer() = CallSignal(CallSignalType.OFFER, "c1", toUserId = callee, channelId = dmId)

    private fun givenDm(kind: ChannelKind, from: Long, to: Long, plan: WorkspacePlan = WorkspacePlan.PREMIUM) {
        given(channels.findById(dmId)).willReturn(Optional.of(channel(kind)))
        given(channelMembers.existsByChannelIdAndUserId(dmId, from)).willReturn(true)
        given(channelMembers.existsByChannelIdAndUserId(dmId, to)).willReturn(true)
        // Lenient: REJECT and HANGUP never look at the plan.
        lenient().whenever(workspaces.findById(1L))
            .thenReturn(Optional.of(Workspace(name = "W", slug = "w", ownerId = caller, plan = plan)))
    }

    private fun givenSaveReturnsArgument() {
        given(calls.save(any<Call>())).willAnswer { it.arguments[0] }
    }

    private fun invite(to: Long) = CallSignal(CallSignalType.INVITE, "c1", toUserId = to, channelId = dmId)

    private fun verifyNotRelayed() {
        verify(broker, never()).convertAndSendToUser(any(), any(), any<Any>())
        verify(calls, never()).save(any())
    }

    private fun channel(kind: ChannelKind) =
        Channel(workspaceId = 1L, name = "dm", kind = kind, createdBy = caller).also { setId(it, dmId) }

    private fun setId(entity: Any, id: Long) {
        val field = entity.javaClass.getDeclaredField("id")
        field.isAccessible = true
        field.set(entity, id)
    }

    private fun principal(userId: Long) = JwtAuthenticationToken(
        Jwt.withTokenValue("tok")
            .header("alg", "RS256")
            .subject(userId.toString())
            .build(),
        emptyList()
    )
}
