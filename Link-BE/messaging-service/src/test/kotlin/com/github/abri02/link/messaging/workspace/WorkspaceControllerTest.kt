package com.github.abri02.link.messaging.workspace

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.channel.Channel
import com.github.abri02.link.messaging.channel.ChannelMember
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.given
import org.mockito.kotlin.verify
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt

@ExtendWith(MockitoExtension::class)
class WorkspaceControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var members: WorkspaceMemberRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository

    private lateinit var controller: WorkspaceController

    @BeforeEach
    fun setup() {
        controller = WorkspaceController(workspaces, members, channels, channelMembers)
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
    fun `addMember returns 403 when caller is not a workspace member`() {
        given(members.findByWorkspaceIdAndUserId(1L, 1L)).willReturn(null)

        val res = controller.addMember(buildJwt(1L), 1L, AddMemberRequest(userId = 2L))
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `addMember returns 403 when caller is not OWNER or ADMIN`() {
        given(members.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.MEMBER))

        val res = controller.addMember(buildJwt(1L), 1L, AddMemberRequest(userId = 2L))
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
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

    // ── helpers ───────────────────────────────────────────────────────

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
