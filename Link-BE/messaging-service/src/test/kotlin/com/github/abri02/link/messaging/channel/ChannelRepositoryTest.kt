package com.github.abri02.link.messaging.channel

import com.github.abri02.link.messaging.support.PostgresIntegrationTest
import com.github.abri02.link.messaging.workspace.Workspace
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class ChannelRepositoryTest : PostgresIntegrationTest() {

    @Autowired lateinit var workspaces: WorkspaceRepository
    @Autowired lateinit var channels: ChannelRepository
    @Autowired lateinit var channelMembers: ChannelMemberRepository

    @Test
    fun `findByWorkspaceIdAndKind returns only channels of that kind in that workspace`() {
        val ws = workspaces.save(Workspace(name = "A1", slug = "a1-${System.nanoTime()}", ownerId = 1L))
        val other = workspaces.save(Workspace(name = "Other", slug = "a1-other-${System.nanoTime()}", ownerId = 1L))
        channels.save(Channel(workspaceId = ws.id!!, name = "general", createdBy = 1L))
        channels.save(Channel(workspaceId = ws.id, name = "random", createdBy = 1L))
        channels.save(Channel(workspaceId = ws.id, name = "secret", kind = ChannelKind.PRIVATE, createdBy = 1L))
        channels.save(Channel(workspaceId = ws.id, name = "dm-1-2", kind = ChannelKind.DM, createdBy = 1L))
        channels.save(Channel(workspaceId = other.id!!, name = "general", createdBy = 1L))

        val public = channels.findByWorkspaceIdAndKind(ws.id, ChannelKind.PUBLIC)

        assertThat(public.map { it.name }).containsExactlyInAnyOrder("general", "random")
        assertThat(public).allMatch { it.workspaceId == ws.id && it.kind == ChannelKind.PUBLIC }
    }

    @Test
    fun `findVisibleChannels hides private channels from non-members and excludes DMs`() {
        val ws = workspaces.save(Workspace(name = "A2", slug = "a2-${System.nanoTime()}", ownerId = 1L))
        val other = workspaces.save(Workspace(name = "Other", slug = "a2-other-${System.nanoTime()}", ownerId = 1L))
        val general = channels.save(Channel(workspaceId = ws.id!!, name = "general", createdBy = 1L))
        val secret = channels.save(Channel(workspaceId = ws.id, name = "secret", kind = ChannelKind.PRIVATE, createdBy = 1L))
        val dm = channels.save(Channel(workspaceId = ws.id, name = "dm-1-2", kind = ChannelKind.DM, createdBy = 1L))
        val otherSecret = channels.save(Channel(workspaceId = other.id!!, name = "secret", kind = ChannelKind.PRIVATE, createdBy = 1L))
        channelMembers.save(ChannelMember(channelId = general.id!!, userId = 1L))
        channelMembers.save(ChannelMember(channelId = secret.id!!, userId = 1L))
        channelMembers.save(ChannelMember(channelId = dm.id!!, userId = 1L))
        channelMembers.save(ChannelMember(channelId = dm.id, userId = 2L))
        channelMembers.save(ChannelMember(channelId = otherSecret.id!!, userId = 2L))

        val forMember = channels.findVisibleChannels(ws.id, 1L)
        val forNonMember = channels.findVisibleChannels(ws.id, 2L)

        assertThat(forMember.map { it.name }).containsExactly("general", "secret")
        assertThat(forNonMember.map { it.name }).containsExactly("general")
    }
}
