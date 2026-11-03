package com.github.abri02.link.messaging.channel

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.support.respond
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
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt

@ExtendWith(MockitoExtension::class)
class DmControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository

    private lateinit var controller: DmController

    @BeforeEach
    fun setup() {
        controller = DmController(
            WorkspaceAccess(workspaces, workspaceMembers, channels, channelMembers),
            workspaceMembers, channels, channelMembers
        )
    }

    @Test
    fun `open returns 403 when caller is GUEST`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.GUEST))

        val res = respond { controller.open(buildJwt(1L), 1L, OpenDmRequest(targetUserId = 2L)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(channels, never()).save(any<Channel>())
    }

    @Test
    fun `open returns 403 when caller is not a workspace member`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 1L)).willReturn(null)

        val res = respond { controller.open(buildJwt(1L), 1L, OpenDmRequest(targetUserId = 2L)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `open returns 400 when the target is not a workspace member`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 1L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 1L, role = WorkspaceRole.MEMBER))
        given(workspaceMembers.existsByWorkspaceIdAndUserId(1L, 2L)).willReturn(false)

        val res = respond { controller.open(buildJwt(1L), 1L, OpenDmRequest(targetUserId = 2L)) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
    }

    private fun buildJwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .claim(Claims.EMAIL, "u$userId@test.com")
        .claim(Claims.USERNAME, "user$userId")
        .build()
}
