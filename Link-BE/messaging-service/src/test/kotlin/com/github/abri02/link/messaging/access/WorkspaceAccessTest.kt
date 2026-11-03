package com.github.abri02.link.messaging.access

import com.github.abri02.link.messaging.channel.Channel
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import com.github.abri02.link.messaging.workspace.WorkspaceMember
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRole
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
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
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class WorkspaceAccessTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository

    private lateinit var access: WorkspaceAccess

    @BeforeEach
    fun setup() {
        access = WorkspaceAccess(workspaces, workspaceMembers, channels, channelMembers)
    }

    // ── requireMember ─────────────────────────────────────────────────

    @Test
    fun `requireMember returns the membership for a member`() {
        val member = WorkspaceMember(workspaceId = 1L, userId = 2L, role = WorkspaceRole.MEMBER)
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 2L)).willReturn(member)

        assertThat(access.requireMember(1L, 2L)).isSameAs(member)
    }

    @Test
    fun `requireMember throws NotFound when workspace does not exist`() {
        given(workspaces.existsById(99L)).willReturn(false)

        assertThatThrownBy { access.requireMember(99L, 2L) }
            .isInstanceOf(NotFoundException::class.java)
            .hasMessage("Workspace not found")
        verify(workspaceMembers, never()).findByWorkspaceIdAndUserId(any(), any())
    }

    @Test
    fun `requireMember throws Forbidden for a non-member`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 2L)).willReturn(null)

        assertThatThrownBy { access.requireMember(1L, 2L) }
            .isInstanceOf(ForbiddenException::class.java)
            .hasMessage("Not a member of this workspace")
    }

    // ── requireRole ───────────────────────────────────────────────────

    @Test
    fun `requireRole returns the membership when the role is allowed`() {
        val admin = WorkspaceMember(workspaceId = 1L, userId = 2L, role = WorkspaceRole.ADMIN)
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 2L)).willReturn(admin)

        assertThat(access.requireRole(1L, 2L, WorkspaceRole.OWNER, WorkspaceRole.ADMIN)).isSameAs(admin)
    }

    @Test
    fun `requireRole throws Forbidden with the given reason when the role is not allowed`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 2L))
            .willReturn(WorkspaceMember(workspaceId = 1L, userId = 2L, role = WorkspaceRole.GUEST))

        assertThatThrownBy { access.requireRole(1L, 2L, WorkspaceRole.OWNER, reason = "Owners only") }
            .isInstanceOf(ForbiddenException::class.java)
            .hasMessage("Owners only")
    }

    @Test
    fun `requireRole throws Forbidden for a non-member`() {
        given(workspaces.existsById(1L)).willReturn(true)
        given(workspaceMembers.findByWorkspaceIdAndUserId(1L, 2L)).willReturn(null)

        assertThatThrownBy { access.requireRole(1L, 2L, WorkspaceRole.OWNER) }
            .isInstanceOf(ForbiddenException::class.java)
            .hasMessage("Not a member of this workspace")
    }

    @Test
    fun `requireRole throws NotFound when workspace does not exist`() {
        given(workspaces.existsById(99L)).willReturn(false)

        assertThatThrownBy { access.requireRole(99L, 2L, WorkspaceRole.OWNER) }
            .isInstanceOf(NotFoundException::class.java)
    }

    // ── requireChannelMember ──────────────────────────────────────────

    @Test
    fun `requireChannelMember returns the channel for a member`() {
        val channel = Channel(workspaceId = 1L, name = "general", createdBy = 1L)
        given(channels.findById(5L)).willReturn(Optional.of(channel))
        given(channelMembers.existsByChannelIdAndUserId(5L, 2L)).willReturn(true)

        assertThat(access.requireChannelMember(5L, 2L)).isSameAs(channel)
    }

    @Test
    fun `requireChannelMember throws NotFound when channel does not exist`() {
        given(channels.findById(99L)).willReturn(Optional.empty())

        assertThatThrownBy { access.requireChannelMember(99L, 2L) }
            .isInstanceOf(NotFoundException::class.java)
            .hasMessage("Channel not found")
    }

    @Test
    fun `requireChannelMember throws Forbidden for a non-member`() {
        given(channels.findById(5L)).willReturn(Optional.of(Channel(workspaceId = 1L, name = "secret", createdBy = 1L)))
        given(channelMembers.existsByChannelIdAndUserId(5L, 2L)).willReturn(false)

        assertThatThrownBy { access.requireChannelMember(5L, 2L) }
            .isInstanceOf(ForbiddenException::class.java)
            .hasMessage("Not a member of this channel")
    }

    // ── AccessExceptionHandler ────────────────────────────────────────

    @Test
    fun `handler maps exceptions to 403 and 404 with an ErrorResponse body`() {
        val handler = AccessExceptionHandler()

        val forbidden = handler.forbidden(ForbiddenException("nope"))
        assertThat(forbidden.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        assertThat(forbidden.body?.message).isEqualTo("nope")

        val notFound = handler.notFound(NotFoundException("gone"))
        assertThat(notFound.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
        assertThat(notFound.body?.message).isEqualTo("gone")
    }
}
