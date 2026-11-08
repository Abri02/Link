package com.github.abri02.link.messaging.channel

import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.support.respond
import com.github.abri02.link.messaging.workspace.Workspace
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspacePlan
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.given
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class ChannelMembershipControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository

    private lateinit var controller: ChannelMembershipController

    @BeforeEach
    fun setup() {
        controller = ChannelMembershipController(WorkspaceAccess(workspaces, workspaceMembers, channels, channelMembers))
    }

    @Test
    fun `check returns 200 with the workspace plan when caller is a channel member`() {
        given(channels.findById(5L)).willReturn(Optional.of(Channel(workspaceId = 1L, name = "general", createdBy = 1L)))
        given(channelMembers.existsByChannelIdAndUserId(5L, 1L)).willReturn(true)
        given(workspaces.findById(1L)).willReturn(
            Optional.of(Workspace(name = "W", slug = "w", ownerId = 1L, plan = WorkspacePlan.PREMIUM))
        )

        val res = respond { controller.check(buildJwt(1L), 5L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(res.body).isEqualTo(ChannelMembershipResponse(WorkspacePlan.PREMIUM))
    }

    @Test
    fun `check returns 403 when caller is not a channel member`() {
        given(channels.findById(5L)).willReturn(Optional.of(Channel(workspaceId = 1L, name = "general", createdBy = 1L)))
        given(channelMembers.existsByChannelIdAndUserId(5L, 1L)).willReturn(false)

        val res = respond { controller.check(buildJwt(1L), 5L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `check returns 404 when channel does not exist`() {
        given(channels.findById(99L)).willReturn(Optional.empty())

        val res = respond { controller.check(buildJwt(1L), 99L) }
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    private fun buildJwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .build()
}
