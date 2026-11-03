package com.github.abri02.link.messaging.channel

import com.github.abri02.link.messaging.support.PostgresIntegrationTest
import com.github.abri02.link.messaging.workspace.Workspace
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.transaction.annotation.Transactional

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
    fun `findJoinedChannels returns only the public and private channels the user is in`() {
        val ws = workspaces.save(Workspace(name = "A2", slug = "a2-${System.nanoTime()}", ownerId = 1L))
        val other = workspaces.save(Workspace(name = "Other", slug = "a2-other-${System.nanoTime()}", ownerId = 1L))
        val general = channels.save(Channel(workspaceId = ws.id!!, name = "general", createdBy = 1L))
        channels.save(Channel(workspaceId = ws.id, name = "random", createdBy = 1L))
        val secret = channels.save(Channel(workspaceId = ws.id, name = "secret", kind = ChannelKind.PRIVATE, createdBy = 1L))
        val dm = channels.save(Channel(workspaceId = ws.id, name = "dm-1-2", kind = ChannelKind.DM, createdBy = 1L))
        val otherSecret = channels.save(Channel(workspaceId = other.id!!, name = "secret", kind = ChannelKind.PRIVATE, createdBy = 1L))
        channelMembers.save(ChannelMember(channelId = general.id!!, userId = 1L))
        channelMembers.save(ChannelMember(channelId = general.id, userId = 2L))
        channelMembers.save(ChannelMember(channelId = secret.id!!, userId = 1L))
        channelMembers.save(ChannelMember(channelId = dm.id!!, userId = 1L))
        channelMembers.save(ChannelMember(channelId = dm.id, userId = 2L))
        channelMembers.save(ChannelMember(channelId = otherSecret.id!!, userId = 2L))

        assertThat(channels.findJoinedChannels(ws.id, 1L).map { it.name }).containsExactly("general", "secret")
        assertThat(channels.findJoinedChannels(ws.id, 2L).map { it.name }).containsExactly("general")
        assertThat(channels.findJoinedChannels(ws.id, 3L)).isEmpty()
    }

    @Test
    fun `findBrowsableChannels returns public channels the user is not in, sorted by name`() {
        val ws = workspaces.save(Workspace(name = "D2", slug = "d2-${System.nanoTime()}", ownerId = 1L))
        val other = workspaces.save(Workspace(name = "Other", slug = "d2-other-${System.nanoTime()}", ownerId = 1L))
        val general = channels.save(Channel(workspaceId = ws.id!!, name = "general", createdBy = 1L))
        channels.save(Channel(workspaceId = ws.id, name = "zeta", createdBy = 1L))
        channels.save(Channel(workspaceId = ws.id, name = "alpha", createdBy = 1L))
        channels.save(Channel(workspaceId = ws.id, name = "secret", kind = ChannelKind.PRIVATE, createdBy = 1L))
        channels.save(Channel(workspaceId = ws.id, name = "dm-1-2", kind = ChannelKind.DM, createdBy = 1L))
        channels.save(Channel(workspaceId = other.id!!, name = "elsewhere", createdBy = 1L))
        channelMembers.save(ChannelMember(channelId = general.id!!, userId = 2L))

        assertThat(channels.findBrowsableChannels(ws.id, 2L).map { it.name }).containsExactly("alpha", "zeta")
        assertThat(channels.findBrowsableChannels(ws.id, 3L).map { it.name }).containsExactly("alpha", "general", "zeta")
    }

    @Test
    @Transactional
    fun `deleteByWorkspaceIdAndUserId removes the user only from that workspace's channels`() {
        val ws = workspaces.save(Workspace(name = "B4", slug = "b4-${System.nanoTime()}", ownerId = 1L))
        val other = workspaces.save(Workspace(name = "Other", slug = "b4-other-${System.nanoTime()}", ownerId = 1L))
        val general = channels.save(Channel(workspaceId = ws.id!!, name = "general", createdBy = 1L))
        val secret = channels.save(Channel(workspaceId = ws.id, name = "secret", kind = ChannelKind.PRIVATE, createdBy = 1L))
        val dm = channels.save(Channel(workspaceId = ws.id, name = "dm-1-2", kind = ChannelKind.DM, createdBy = 1L))
        val otherGeneral = channels.save(Channel(workspaceId = other.id!!, name = "general", createdBy = 1L))
        listOf(general, secret, dm, otherGeneral).forEach { channelMembers.save(ChannelMember(channelId = it.id!!, userId = 2L)) }
        channelMembers.save(ChannelMember(channelId = general.id!!, userId = 1L))
        channelMembers.save(ChannelMember(channelId = dm.id!!, userId = 1L))

        val deleted = channelMembers.deleteByWorkspaceIdAndUserId(ws.id, 2L)

        assertThat(deleted).isEqualTo(3)
        assertThat(channelMembers.existsByChannelIdAndUserId(general.id, 2L)).isFalse()
        assertThat(channelMembers.existsByChannelIdAndUserId(secret.id!!, 2L)).isFalse()
        assertThat(channelMembers.existsByChannelIdAndUserId(dm.id, 2L)).isFalse()
        assertThat(channelMembers.existsByChannelIdAndUserId(otherGeneral.id!!, 2L)).isTrue()
        assertThat(channelMembers.existsByChannelIdAndUserId(general.id, 1L)).isTrue()
        assertThat(channelMembers.existsByChannelIdAndUserId(dm.id, 1L)).isTrue()
    }

    @Test
    fun `findConversationsForUser returns the user's DMs and group DMs in that workspace only`() {
        val ws = workspaces.save(Workspace(name = "D1", slug = "d1-${System.nanoTime()}", ownerId = 1L))
        val other = workspaces.save(Workspace(name = "Other", slug = "d1-other-${System.nanoTime()}", ownerId = 1L))
        val general = channels.save(Channel(workspaceId = ws.id!!, name = "general", createdBy = 1L))
        val dm = channels.save(Channel(workspaceId = ws.id, name = "dm-1-2", kind = ChannelKind.DM, createdBy = 1L, memberKey = "1,2"))
        val group = channels.save(Channel(workspaceId = ws.id, name = "group-dm-1-2-3", kind = ChannelKind.GROUP_DM, createdBy = 1L, memberKey = "1,2,3"))
        val notMine = channels.save(Channel(workspaceId = ws.id, name = "dm-2-3", kind = ChannelKind.DM, createdBy = 2L, memberKey = "2,3"))
        val otherWsDm = channels.save(Channel(workspaceId = other.id!!, name = "dm-1-2", kind = ChannelKind.DM, createdBy = 1L, memberKey = "1,2"))
        channelMembers.save(ChannelMember(channelId = general.id!!, userId = 1L))
        listOf(1L, 2L).forEach { channelMembers.save(ChannelMember(channelId = dm.id!!, userId = it)) }
        listOf(1L, 2L, 3L).forEach { channelMembers.save(ChannelMember(channelId = group.id!!, userId = it)) }
        listOf(2L, 3L).forEach { channelMembers.save(ChannelMember(channelId = notMine.id!!, userId = it)) }
        listOf(1L, 2L).forEach { channelMembers.save(ChannelMember(channelId = otherWsDm.id!!, userId = it)) }

        val conversations = channels.findConversationsForUser(ws.id, 1L)

        assertThat(conversations.map { it.id }).containsExactly(dm.id, group.id)
        assertThat(channelMembers.findByChannelIdIn(conversations.map { it.id!! }).map { it.channelId to it.userId })
            .containsExactlyInAnyOrder(dm.id!! to 1L, dm.id!! to 2L, group.id!! to 1L, group.id!! to 2L, group.id!! to 3L)
    }

    @Test
    fun `findByWorkspaceIdAndMemberKey finds the conversation for that member set in that workspace`() {
        val ws = workspaces.save(Workspace(name = "D1k", slug = "d1k-${System.nanoTime()}", ownerId = 1L))
        val other = workspaces.save(Workspace(name = "Other", slug = "d1k-other-${System.nanoTime()}", ownerId = 1L))
        val group = channels.save(Channel(workspaceId = ws.id!!, name = "g", kind = ChannelKind.GROUP_DM, createdBy = 1L, memberKey = "1,2,3"))
        channels.save(Channel(workspaceId = other.id!!, name = "g", kind = ChannelKind.GROUP_DM, createdBy = 1L, memberKey = "1,2,3"))

        assertThat(channels.findByWorkspaceIdAndMemberKey(ws.id, "1,2,3")?.id).isEqualTo(group.id)
        assertThat(channels.findByWorkspaceIdAndMemberKey(ws.id, "1,2")).isNull()
    }

    @Test
    fun `member key is unique per workspace, but channels without one don't clash`() {
        val ws = workspaces.save(Workspace(name = "D1u", slug = "d1u-${System.nanoTime()}", ownerId = 1L))
        channels.save(Channel(workspaceId = ws.id!!, name = "a", createdBy = 1L))
        channels.save(Channel(workspaceId = ws.id, name = "b", createdBy = 1L))
        channels.save(Channel(workspaceId = ws.id, name = "dm-1-2", kind = ChannelKind.DM, createdBy = 1L, memberKey = "1,2"))

        assertThatThrownBy {
            channels.saveAndFlush(Channel(workspaceId = ws.id, name = "g", kind = ChannelKind.GROUP_DM, createdBy = 1L, memberKey = "1,2"))
        }.isInstanceOf(DataIntegrityViolationException::class.java)
    }

    @Test
    @Transactional
    fun `deleteByChannelIdAndUserId removes only that user from that conversation`() {
        val ws = workspaces.save(Workspace(name = "D1l", slug = "d1l-${System.nanoTime()}", ownerId = 1L))
        val group = channels.save(Channel(workspaceId = ws.id!!, name = "g", kind = ChannelKind.GROUP_DM, createdBy = 1L, memberKey = "1,2,3"))
        val dm = channels.save(Channel(workspaceId = ws.id, name = "dm-1-3", kind = ChannelKind.DM, createdBy = 1L, memberKey = "1,3"))
        listOf(1L, 2L, 3L).forEach { channelMembers.save(ChannelMember(channelId = group.id!!, userId = it)) }
        listOf(1L, 3L).forEach { channelMembers.save(ChannelMember(channelId = dm.id!!, userId = it)) }

        val deleted = channelMembers.deleteByChannelIdAndUserId(group.id!!, 3L)

        assertThat(deleted).isEqualTo(1)
        assertThat(channelMembers.findByChannelId(group.id).map { it.userId }).containsExactlyInAnyOrder(1L, 2L)
        assertThat(channelMembers.existsByChannelIdAndUserId(dm.id!!, 3L)).isTrue()
    }
}
