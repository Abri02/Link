package com.github.abri02.link.messaging.support

import com.github.abri02.link.messaging.channel.Channel
import com.github.abri02.link.messaging.channel.ChannelKind
import com.github.abri02.link.messaging.channel.ChannelMember
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import com.github.abri02.link.messaging.workspace.Workspace
import com.github.abri02.link.messaging.workspace.WorkspaceMember
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRole
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class RepositorySmokeTest : PostgresIntegrationTest() {

    @Autowired lateinit var workspaces: WorkspaceRepository
    @Autowired lateinit var workspaceMembers: WorkspaceMemberRepository
    @Autowired lateinit var channels: ChannelRepository
    @Autowired lateinit var channelMembers: ChannelMemberRepository

    @Test
    fun `saves and loads a workspace, channel and members against real postgres`() {
        val slug = "smoke-${System.nanoTime()}"
        val ws = workspaces.save(Workspace(name = "Smoke", slug = slug, ownerId = 1L))
        workspaceMembers.save(WorkspaceMember(workspaceId = ws.id!!, userId = 1L, role = WorkspaceRole.OWNER))
        val general = channels.save(Channel(workspaceId = ws.id, name = "general", createdBy = 1L))
        channelMembers.save(ChannelMember(channelId = general.id!!, userId = 1L))

        assertThat(workspaces.findById(ws.id).get().slug).isEqualTo(slug)
        assertThat(workspaces.existsBySlug(slug)).isTrue()
        assertThat(workspaceMembers.findByWorkspaceIdAndUserId(ws.id, 1L)?.role).isEqualTo(WorkspaceRole.OWNER)
        assertThat(workspaceMembers.findWorkspaceIdsByUserId(1L)).contains(ws.id)
        assertThat(channels.findByWorkspaceId(ws.id).map { it.name }).containsExactly("general")
        assertThat(channels.findByWorkspaceId(ws.id).single().kind).isEqualTo(ChannelKind.PUBLIC)
        assertThat(channelMembers.existsByChannelIdAndUserId(general.id, 1L)).isTrue()
        assertThat(channelMembers.existsByChannelIdAndUserId(general.id, 2L)).isFalse()
    }
}
