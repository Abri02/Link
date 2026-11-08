package com.github.abri02.link.messaging.workspace

import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import com.github.abri02.link.messaging.support.respond
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.given
import org.mockito.kotlin.mock
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt

@ExtendWith(MockitoExtension::class)
class WorkspaceMembershipControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository

    private lateinit var controller: WorkspaceMembershipController

    @BeforeEach
    fun setup() {
        controller = WorkspaceMembershipController(WorkspaceAccess(workspaces, workspaceMembers, channels, channelMembers))
    }

    @Test
    fun `check returns the caller's role when they are a member`() {
        val member = mock<WorkspaceMember>()
        given(member.role).willReturn(WorkspaceRole.OWNER)
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 7L)).willReturn(member)

        val res = respond { controller.check(buildJwt(7L), 1L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(res.body).isEqualTo(WorkspaceMembershipResponse(WorkspaceRole.OWNER))
    }

    @Test
    fun `check returns 403 when caller is not a member`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 7L)).willReturn(null)

        val res = respond { controller.check(buildJwt(7L), 1L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `check returns 404 when the workspace does not exist`() {
        given(workspaces.existsById(99L)).willReturn(false)

        val res = respond { controller.check(buildJwt(7L), 99L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    private fun buildJwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .build()
}
