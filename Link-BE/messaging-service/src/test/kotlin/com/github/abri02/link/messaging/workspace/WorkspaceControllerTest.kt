package com.github.abri02.link.messaging.workspace

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.channel.Channel
import com.github.abri02.link.messaging.channel.ChannelKind
import com.github.abri02.link.messaging.channel.ChannelMember
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import com.github.abri02.link.messaging.access.PlanLimitResponse
import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.support.respond
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.times
import org.mockito.kotlin.verify
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class WorkspaceControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var members: WorkspaceMemberRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository
    @Mock private lateinit var authService: AuthServiceClient

    private lateinit var controller: WorkspaceController

    @BeforeEach
    fun setup() {
        controller = WorkspaceController(
            workspaces, members, channels, channelMembers, authService,
            WorkspaceAccess(workspaces, members, channels, channelMembers)
        )
    }

    // ── create ────────────────────────────────────────────────────────

    @Test
    fun `create with blank name returns 400`() {
        val res = controller.create(buildJwt(1L), CreateWorkspaceRequest("  "))
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        assertThat((res.body as ErrorResponse).message).containsIgnoringCase("name")
    }

    @Test
    fun `create normalizes name to a url-safe slug`() {
        given(workspaces.existsBySlug(any<String>())).willReturn(false)
        given(workspaces.save(any<Workspace>())).willReturn(buildWorkspace(1L, "My Workspace", "my-workspace", 1L))
        given(channels.save(any<Channel>())).willReturn(buildChannel(1L, 1L))

        val captor = argumentCaptor<Workspace>()
        controller.create(buildJwt(1L), CreateWorkspaceRequest("My Workspace"))
        verify(workspaces).save(captor.capture())

        assertThat(captor.firstValue.slug).isEqualTo("my-workspace")
    }

    @Test
    fun `create returns 201 with workspace response`() {
        given(workspaces.existsBySlug(any<String>())).willReturn(false)
        given(workspaces.save(any<Workspace>())).willReturn(buildWorkspace(42L, "Launch Team", "launch-team", 1L))
        given(channels.save(any<Channel>())).willReturn(buildChannel(1L, 42L))

        val res = controller.create(buildJwt(1L), CreateWorkspaceRequest("Launch Team"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val body = res.body as WorkspaceResponse
        assertThat(body.name).isEqualTo("Launch Team")
        assertThat(body.slug).isEqualTo("launch-team")
    }

    // ── addMember ─────────────────────────────────────────────────────

    @Test
    fun `addMember returns 404 when workspace does not exist`() {
        given(workspaces.existsById(99L)).willReturn(false)

        val res = respond { controller.addMember(buildJwt(1L), 99L, AddMemberRequest(userId = 2L)) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `addMember returns 403 when caller is not a workspace member`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.findByWorkspaceIdAndUserId(1L, 1L)).willReturn(null)

        val res = respond { controller.addMember(buildJwt(1L), 1L, AddMemberRequest(userId = 2L)) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `addMember returns 403 when caller is not OWNER or ADMIN`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.MEMBER))

        val res = respond { controller.addMember(buildJwt(1L), 1L, AddMemberRequest(userId = 2L)) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        assertThat((res.body as com.github.abri02.link.messaging.channel.ErrorResponse).message)
            .isEqualTo("Only OWNER or ADMIN can add members")
    }

    @Test
    fun `addMember returns 409 when user is already a member`() {
        given(members.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.OWNER))
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.existsByWorkspaceIdAndUserId(1L, 2L)).willReturn(true)

        val res = controller.addMember(buildJwt(1L), 1L, AddMemberRequest(userId = 2L))
        assertThat(res.statusCode).isEqualTo(HttpStatus.CONFLICT)
    }

    @Test
    fun `addMember joins the new member to PUBLIC channels only`() {
        stubOwnerAddingNewUser(newUserId = 2L)
        given(channels.findByWorkspaceIdAndKind(1L, ChannelKind.PUBLIC)).willReturn(listOf(buildChannel(10L, 1L)))

        val res = controller.addMember(buildJwt(1L), 1L, AddMemberRequest(userId = 2L))

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val saved = argumentCaptor<ChannelMember>()
        verify(channelMembers, times(1)).save(saved.capture())
        assertThat(saved.firstValue.channelId).isEqualTo(10L)
        assertThat(saved.firstValue.userId).isEqualTo(2L)
        verify(channels, never()).findByWorkspaceId(any())
    }

    // ── plan: guest limit ─────────────────────────────────────────────

    @Test
    fun `adding a 4th guest returns 402 on the FREE plan`() {
        givenOwnerOnPlan(WorkspacePlan.FREE, guests = 3L)
        given(members.existsByWorkspaceIdAndUserId(1L, 2L)).willReturn(false)

        val res = respond { controller.addMember(buildJwt(1L), 1L, AddMemberRequest(2L, WorkspaceRole.GUEST)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.PAYMENT_REQUIRED)
        assertThat((res.body as PlanLimitResponse).code).isEqualTo("GUEST_LIMIT_REACHED")
        verify(members, never()).save(any<WorkspaceMember>())
    }

    @Test
    fun `inviting a 4th guest returns 402 on the FREE plan`() {
        givenOwnerOnPlan(WorkspacePlan.FREE, guests = 3L)
        given(members.existsByWorkspaceIdAndUserId(1L, 2L)).willReturn(false)
        given(authService.lookup("bob", "Bearer tok")).willReturn(UserLookupResult(2L, "bob", "Bob"))

        val res = respond { controller.inviteMember(buildJwt(1L), 1L, InviteRequest("bob", WorkspaceRole.GUEST), "Bearer tok") }

        assertThat(res.statusCode).isEqualTo(HttpStatus.PAYMENT_REQUIRED)
        verify(members, never()).save(any<WorkspaceMember>())
    }

    @Test
    fun `the 3rd guest is allowed on the FREE plan`() {
        givenOwnerOnPlan(WorkspacePlan.FREE, guests = 2L)
        given(members.existsByWorkspaceIdAndUserId(1L, 2L)).willReturn(false)
        given(members.save(any<WorkspaceMember>())).willAnswer { it.arguments[0] }
        given(channels.findByWorkspaceIdAndKind(1L, ChannelKind.PUBLIC)).willReturn(emptyList())

        val res = respond { controller.addMember(buildJwt(1L), 1L, AddMemberRequest(2L, WorkspaceRole.GUEST)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
    }

    @Test
    fun `a PREMIUM workspace has no guest limit`() {
        givenOwnerOnPlan(WorkspacePlan.PREMIUM, guests = null)
        given(members.existsByWorkspaceIdAndUserId(1L, 2L)).willReturn(false)
        given(members.save(any<WorkspaceMember>())).willAnswer { it.arguments[0] }
        given(channels.findByWorkspaceIdAndKind(1L, ChannelKind.PUBLIC)).willReturn(emptyList())

        val res = respond { controller.addMember(buildJwt(1L), 1L, AddMemberRequest(2L, WorkspaceRole.GUEST)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
    }

    @Test
    fun `a MEMBER can still be added when the guest limit is reached`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.OWNER))
        given(members.existsByWorkspaceIdAndUserId(1L, 2L)).willReturn(false)
        given(members.save(any<WorkspaceMember>())).willAnswer { it.arguments[0] }
        given(channels.findByWorkspaceIdAndKind(1L, ChannelKind.PUBLIC)).willReturn(emptyList())

        val res = respond { controller.addMember(buildJwt(1L), 1L, AddMemberRequest(2L, WorkspaceRole.MEMBER)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        verify(members, never()).countByWorkspaceIdAndRole(1L, WorkspaceRole.GUEST)
    }

    @Test
    fun `changing a member to GUEST returns 402 when the FREE limit is reached`() {
        givenOwnerOnPlan(WorkspacePlan.FREE, guests = 3L)
        given(members.findByWorkspaceIdAndUserId(1L, 2L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 2L, role = WorkspaceRole.MEMBER))

        val res = respond { controller.changeRole(buildJwt(1L), 1L, 2L, ChangeRoleRequest(WorkspaceRole.GUEST)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.PAYMENT_REQUIRED)
        verify(members, never()).save(any<WorkspaceMember>())
    }

    @Test
    fun `a guest over the limit can stay a guest after a downgrade`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.OWNER))
        given(members.findByWorkspaceIdAndUserId(1L, 2L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 2L, role = WorkspaceRole.GUEST))
        given(members.save(any<WorkspaceMember>())).willAnswer { it.arguments[0] }

        val res = respond { controller.changeRole(buildJwt(1L), 1L, 2L, ChangeRoleRequest(WorkspaceRole.GUEST)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
    }

    private fun givenOwnerOnPlan(plan: WorkspacePlan, guests: Long?) {
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.OWNER))
        given(workspaces.findById(1L)).willReturn(Optional.of(Workspace(name = "W", slug = "w", ownerId = 1L, plan = plan)))
        if (guests != null) given(members.countByWorkspaceIdAndRole(1L, WorkspaceRole.GUEST)).willReturn(guests)
    }

    // ── inviteMember ──────────────────────────────────────────────────

    @Test
    fun `inviteMember returns 403 when caller is GUEST role`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.GUEST))

        val res = respond { controller.inviteMember(buildJwt(1L), 1L, InviteRequest("bob"), "Bearer tok") }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `inviteMember lets an admin invite someone as GUEST`() {
        given(members.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.ADMIN))
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.existsByWorkspaceIdAndUserId(1L, 2L)).willReturn(false)
        given(members.save(any<WorkspaceMember>())).willAnswer { it.arguments[0] }
        given(authService.lookup("bob", "Bearer tok")).willReturn(UserLookupResult(2L, "bob", "Bob"))

        val res = controller.inviteMember(buildJwt(1L), 1L, InviteRequest("bob", WorkspaceRole.GUEST), "Bearer tok")

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        assertThat((res.body as WorkspaceMemberResponse).role).isEqualTo("GUEST")
    }

    @Test
    fun `inviteMember returns 400 when inviting as ADMIN or OWNER`() {
        for (role in listOf(WorkspaceRole.ADMIN, WorkspaceRole.OWNER)) {
            given(workspaces.existsById(1L)).willReturn(true)
            given(members.findByWorkspaceIdAndUserId(1L, 1L))
                .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.OWNER))

            val res = controller.inviteMember(buildJwt(1L), 1L, InviteRequest("bob", role), "Bearer tok")

            assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        }
        verify(authService, never()).lookup(any(), any())
        verify(members, never()).save(any<WorkspaceMember>())
    }

    @Test
    fun `inviteMember returns 403 when a MEMBER tries to invite a guest`() {
        stubCaller(WorkspaceRole.MEMBER)

        val res = respond { controller.inviteMember(buildJwt(1L), 1L, InviteRequest("bob", WorkspaceRole.GUEST), "Bearer tok") }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(members, never()).save(any<WorkspaceMember>())
    }

    @Test
    fun `addMember returns 400 when adding as OWNER`() {
        stubCaller(WorkspaceRole.OWNER)

        val res = controller.addMember(buildJwt(1L), 1L, AddMemberRequest(userId = 2L, role = WorkspaceRole.OWNER))

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        verify(members, never()).save(any<WorkspaceMember>())
    }

    // ── listMembers ───────────────────────────────────────────────────

    @Test
    fun `listMembers returns 403 when caller is not a workspace member`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.findByWorkspaceIdAndUserId(1L, 1L)).willReturn(null)

        val res = respond { controller.listMembers(buildJwt(1L), 1L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `inviteMember does not join the invitee to PRIVATE or DM channels`() {
        stubOwnerAddingNewUser(newUserId = 2L)
        given(authService.lookup("bob", "Bearer tok")).willReturn(UserLookupResult(2L, "bob", "Bob"))
        given(channels.findByWorkspaceIdAndKind(1L, ChannelKind.PUBLIC)).willReturn(listOf(buildChannel(10L, 1L)))

        val res = controller.inviteMember(buildJwt(1L), 1L, InviteRequest("bob"), "Bearer tok")

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val saved = argumentCaptor<ChannelMember>()
        verify(channelMembers, times(1)).save(saved.capture())
        assertThat(saved.allValues.map { it.channelId }).containsExactly(10L)
        verify(channels, never()).findByWorkspaceId(any())
    }

    // ── changeRole ────────────────────────────────────────────────────

    @Test
    fun `changeRole lets the owner promote a member to admin`() {
        stubCaller(WorkspaceRole.OWNER)
        val target = WorkspaceMember(workspaceId = 1L, userId = 2L, role = WorkspaceRole.MEMBER)
        given(members.findByWorkspaceIdAndUserId(1L, 2L)).willReturn(target)
        given(members.save(any<WorkspaceMember>())).willAnswer { it.arguments[0] }

        val res = respond { controller.changeRole(buildJwt(1L), 1L, 2L, ChangeRoleRequest(WorkspaceRole.ADMIN)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat((res.body as WorkspaceMemberResponse).role).isEqualTo("ADMIN")
        assertThat(target.role).isEqualTo(WorkspaceRole.ADMIN)
    }

    @Test
    fun `changeRole returns 403 when caller is ADMIN`() {
        stubCaller(WorkspaceRole.ADMIN)

        val res = respond { controller.changeRole(buildJwt(1L), 1L, 2L, ChangeRoleRequest(WorkspaceRole.ADMIN)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(members, never()).save(any<WorkspaceMember>())
    }

    @Test
    fun `changeRole returns 403 when caller is not a workspace member`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.findByWorkspaceIdAndUserId(1L, 1L)).willReturn(null)

        val res = respond { controller.changeRole(buildJwt(1L), 1L, 2L, ChangeRoleRequest(WorkspaceRole.ADMIN)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `changeRole returns 404 when workspace does not exist`() {
        given(workspaces.existsById(99L)).willReturn(false)

        val res = respond { controller.changeRole(buildJwt(1L), 99L, 2L, ChangeRoleRequest(WorkspaceRole.ADMIN)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `changeRole returns 404 when target is not a member`() {
        stubCaller(WorkspaceRole.OWNER)
        given(members.findByWorkspaceIdAndUserId(1L, 2L)).willReturn(null)

        val res = respond { controller.changeRole(buildJwt(1L), 1L, 2L, ChangeRoleRequest(WorkspaceRole.ADMIN)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `changeRole returns 409 when demoting the last owner`() {
        val owner = stubCaller(WorkspaceRole.OWNER)
        given(members.countByWorkspaceIdAndRole(1L, WorkspaceRole.OWNER)).willReturn(1L)

        val res = respond { controller.changeRole(buildJwt(1L), 1L, 1L, ChangeRoleRequest(WorkspaceRole.ADMIN)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.CONFLICT)
        assertThat(owner.role).isEqualTo(WorkspaceRole.OWNER)
        verify(members, never()).save(any<WorkspaceMember>())
    }

    @Test
    fun `changeRole lets an owner step down when another owner exists`() {
        val owner = stubCaller(WorkspaceRole.OWNER)
        given(members.countByWorkspaceIdAndRole(1L, WorkspaceRole.OWNER)).willReturn(2L)
        given(members.save(any<WorkspaceMember>())).willAnswer { it.arguments[0] }

        val res = respond { controller.changeRole(buildJwt(1L), 1L, 1L, ChangeRoleRequest(WorkspaceRole.MEMBER)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(owner.role).isEqualTo(WorkspaceRole.MEMBER)
    }

    // ── removeMember ──────────────────────────────────────────────────

    @Test
    fun `removeMember lets an admin remove a member and drops their channel memberships`() {
        stubCaller(WorkspaceRole.ADMIN)
        val target = stubTarget(WorkspaceRole.MEMBER)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 2L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(channelMembers).deleteByWorkspaceIdAndUserId(1L, 2L)
        verify(members).delete(target)
    }

    @Test
    fun `removeMember lets an owner remove an admin`() {
        stubCaller(WorkspaceRole.OWNER)
        val target = stubTarget(WorkspaceRole.ADMIN)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 2L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(members).delete(target)
    }

    @Test
    fun `removeMember lets an owner remove another owner`() {
        stubCaller(WorkspaceRole.OWNER)
        val target = stubTarget(WorkspaceRole.OWNER)
        given(members.countByWorkspaceIdAndRole(1L, WorkspaceRole.OWNER)).willReturn(2L)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 2L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(members).delete(target)
    }

    @Test
    fun `removeMember returns 403 when an admin tries to remove an owner`() {
        stubCaller(WorkspaceRole.ADMIN)
        stubTarget(WorkspaceRole.OWNER)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 2L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verifyNothingRemoved()
    }

    @Test
    fun `removeMember returns 403 when caller is MEMBER`() {
        stubCaller(WorkspaceRole.MEMBER)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 2L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verifyNothingRemoved()
    }

    @Test
    fun `removeMember returns 403 when caller is GUEST`() {
        stubCaller(WorkspaceRole.GUEST)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 2L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verifyNothingRemoved()
    }

    @Test
    fun `removeMember returns 403 when caller is not a workspace member`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.findByWorkspaceIdAndUserId(1L, 1L)).willReturn(null)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 2L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verifyNothingRemoved()
    }

    @Test
    fun `removeMember returns 404 when workspace does not exist`() {
        given(workspaces.existsById(99L)).willReturn(false)

        val res = respond { controller.removeMember(buildJwt(1L), 99L, 2L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `removeMember returns 404 when target is not a member`() {
        stubCaller(WorkspaceRole.OWNER)
        given(members.findByWorkspaceIdAndUserId(1L, 2L)).willReturn(null)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 2L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
        verifyNothingRemoved()
    }

    @Test
    fun `removeMember on yourself lets a member leave`() {
        val me = stubCaller(WorkspaceRole.MEMBER)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 1L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(channelMembers).deleteByWorkspaceIdAndUserId(1L, 1L)
        verify(members).delete(me)
    }

    @Test
    fun `removeMember on yourself lets a guest leave`() {
        val me = stubCaller(WorkspaceRole.GUEST)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 1L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(members).delete(me)
    }

    @Test
    fun `removeMember on yourself lets an owner leave when another owner exists`() {
        val me = stubCaller(WorkspaceRole.OWNER)
        given(members.countByWorkspaceIdAndRole(1L, WorkspaceRole.OWNER)).willReturn(2L)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 1L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(members).delete(me)
    }

    @Test
    fun `removeMember returns 409 when the last owner tries to leave`() {
        stubCaller(WorkspaceRole.OWNER)
        given(members.countByWorkspaceIdAndRole(1L, WorkspaceRole.OWNER)).willReturn(1L)

        val res = respond { controller.removeMember(buildJwt(1L), 1L, 1L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.CONFLICT)
        assertThat((res.body as ErrorResponse).message).contains("last OWNER")
        verifyNothingRemoved()
    }

    // ── helpers ───────────────────────────────────────────────────────

    private fun stubTarget(role: WorkspaceRole): WorkspaceMember {
        val target = WorkspaceMember(workspaceId = 1L, userId = 2L, role = role)
        given(members.findByWorkspaceIdAndUserId(1L, 2L)).willReturn(target)
        return target
    }

    private fun verifyNothingRemoved() {
        verify(channelMembers, never()).deleteByWorkspaceIdAndUserId(any(), any())
        verify(members, never()).delete(any<WorkspaceMember>())
    }

    private fun stubCaller(role: WorkspaceRole): WorkspaceMember {
        val caller = WorkspaceMember(workspaceId = 1L, userId = 1L, role = role)
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.findByWorkspaceIdAndUserId(1L, 1L)).willReturn(caller)
        return caller
    }

    private fun stubOwnerAddingNewUser(newUserId: Long) {
        given(members.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.OWNER))
        given(workspaces.existsById(1L)).willReturn(true)
        given(members.existsByWorkspaceIdAndUserId(1L, newUserId)).willReturn(false)
        given(members.save(any<WorkspaceMember>())).willAnswer { it.arguments[0] }
    }

    private fun buildJwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .claim(Claims.EMAIL, "u$userId@test.com")
        .claim(Claims.USERNAME, "user$userId")
        .build()

    private fun buildWorkspace(id: Long, name: String, slug: String, ownerId: Long): Workspace {
        val ws = Workspace(name = name, slug = slug, ownerId = ownerId)
        Workspace::class.java.getDeclaredField("id").apply { isAccessible = true }.set(ws, id)
        return ws
    }

    private fun buildChannel(id: Long, workspaceId: Long): Channel {
        val ch = Channel(workspaceId = workspaceId, name = "general", createdBy = 1L)
        Channel::class.java.getDeclaredField("id").apply { isAccessible = true }.set(ch, id)
        return ch
    }
}
