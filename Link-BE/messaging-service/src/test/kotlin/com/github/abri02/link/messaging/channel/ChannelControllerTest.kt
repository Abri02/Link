package com.github.abri02.link.messaging.channel

import com.github.abri02.link.jwt.Claims
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
import org.mockito.kotlin.given
import org.mockito.kotlin.verify
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt

@ExtendWith(MockitoExtension::class)
class ChannelControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository

    private lateinit var controller: ChannelController

    @BeforeEach
    fun setup() {
        controller = ChannelController(workspaces, workspaceMembers, channels, channelMembers)
    }

    // ── create ────────────────────────────────────────────────────────

    @Test
    fun `create returns 404 when workspace does not exist`() {
        given(workspaces.existsById(99L)).willReturn(false)

        val res = controller.create(buildJwt(1L), 99L, CreateChannelRequest("alerts"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    @Test
    fun `create returns 403 when caller is not a workspace member`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 1L)).willReturn(null)

        val res = controller.create(buildJwt(1L), 1L, CreateChannelRequest("alerts"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `create returns 403 when caller is MEMBER role`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.MEMBER))

        val res = controller.create(buildJwt(1L), 1L, CreateChannelRequest("alerts"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `create returns 403 when caller is GUEST role`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.GUEST))

        val res = controller.create(buildJwt(1L), 1L, CreateChannelRequest("alerts"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `create returns 400 for blank channel name`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.ADMIN))

        val res = controller.create(buildJwt(1L), 1L, CreateChannelRequest("  "))
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    @Test
    fun `create normalizes channel name to lowercase kebab-case`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.OWNER))
        given(channels.existsByWorkspaceIdAndName(1L, "my-alerts")).willReturn(false)
        given(channels.save(any<Channel>())).willReturn(buildChannel(1L, 1L, "my-alerts"))

        val captor = argumentCaptor<Channel>()
        controller.create(buildJwt(1L), 1L, CreateChannelRequest("My Alerts"))
        verify(channels).save(captor.capture())

        assertThat(captor.firstValue.name).isEqualTo("my-alerts")
    }

    @Test
    fun `create returns 409 for duplicate channel name`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.ADMIN))
        given(channels.existsByWorkspaceIdAndName(1L, "general")).willReturn(true)

        val res = controller.create(buildJwt(1L), 1L, CreateChannelRequest("general"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.CONFLICT)
    }

    // ── list ──────────────────────────────────────────────────────────

    @Test
    fun `list returns 403 when caller is not a workspace member`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.existsByWorkspaceIdAndUserId(1L, 1L)).willReturn(false)

        val res = controller.list(buildJwt(1L), 1L)
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    // ── helpers ───────────────────────────────────────────────────────

    private fun buildJwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .claim(Claims.EMAIL, "u$userId@test.com")
        .claim(Claims.USERNAME, "user$userId")
        .build()

    private fun buildChannel(id: Long, workspaceId: Long, name: String): Channel {
        val ch = Channel(workspaceId = workspaceId, name = name, createdBy = 1L)
        Channel::class.java.getDeclaredField("id").apply { isAccessible = true }.set(ch, id)
        return ch
    }
}
