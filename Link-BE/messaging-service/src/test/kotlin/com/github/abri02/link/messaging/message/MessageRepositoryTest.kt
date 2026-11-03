package com.github.abri02.link.messaging.message

import com.github.abri02.link.messaging.channel.Channel
import com.github.abri02.link.messaging.channel.ChannelMember
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import com.github.abri02.link.messaging.support.PostgresIntegrationTest
import com.github.abri02.link.messaging.workspace.Workspace
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

class MessageRepositoryTest : PostgresIntegrationTest() {

    @Autowired lateinit var workspaces: WorkspaceRepository
    @Autowired lateinit var channels: ChannelRepository
    @Autowired lateinit var channelMembers: ChannelMemberRepository
    @Autowired lateinit var messages: MessageRepository

    @Test
    fun `countUnreadByChannel counts top-level messages by others after the read marker`() {
        val ws = workspaces.save(Workspace(name = "D4", slug = "d4-${System.nanoTime()}", ownerId = 1L))
        val general = channels.save(Channel(workspaceId = ws.id!!, name = "general", createdBy = 1L))
        val random = channels.save(Channel(workspaceId = ws.id, name = "random", createdBy = 1L))
        val quiet = channels.save(Channel(workspaceId = ws.id, name = "quiet", createdBy = 1L))

        // general: user 2 read up to `read`. Only the two newer USER messages by others count.
        val read = send(general.id!!, 1L)
        send(general.id, 1L)
        val parent = send(general.id, 3L)
        send(general.id, 1L, parentId = parent.id)               // thread reply
        send(general.id, 2L)                                     // own message
        send(general.id, 1L, deleted = true)                     // deleted
        send(general.id, 1L, type = MessageType.SYSTEM)          // system message
        channelMembers.save(ChannelMember(channelId = general.id, userId = 2L, lastReadMessageId = read.id))
        // Another user's marker doesn't affect user 2.
        channelMembers.save(ChannelMember(channelId = general.id, userId = 1L, lastReadMessageId = parent.id))

        // random: no marker yet, so everything by others is unread.
        send(random.id!!, 1L)
        send(random.id, 1L)
        channelMembers.save(ChannelMember(channelId = random.id, userId = 2L))

        // quiet: read up to the latest message, so nothing is left.
        val last = send(quiet.id!!, 1L)
        channelMembers.save(ChannelMember(channelId = quiet.id, userId = 2L, lastReadMessageId = last.id))

        val counts = messages.unreadCounts(2L, listOf(general.id, random.id, quiet.id))

        assertThat(counts).containsExactlyInAnyOrderEntriesOf(mapOf(general.id to 2L, random.id to 2L))
        // Channels the user isn't in are never counted.
        assertThat(messages.unreadCounts(4L, listOf(general.id, random.id))).isEmpty()
    }

    @Test
    @Transactional
    fun `markRead moves the marker forward but never back`() {
        val ws = workspaces.save(Workspace(name = "D4m", slug = "d4m-${System.nanoTime()}", ownerId = 1L))
        val ch = channels.save(Channel(workspaceId = ws.id!!, name = "general", createdBy = 1L))
        val first = send(ch.id!!, 1L)
        val second = send(ch.id, 1L)
        channelMembers.save(ChannelMember(channelId = ch.id, userId = 2L))
        channelMembers.flush()

        assertThat(messages.findLatestMessageId(ch.id)).isEqualTo(second.id)
        assertThat(channelMembers.markRead(ch.id, 2L, second.id!!)).isEqualTo(1)
        assertThat(channelMembers.markRead(ch.id, 2L, first.id!!)).isEqualTo(0)
        assertThat(channelMembers.markRead(ch.id, 3L, second.id)).isEqualTo(0)
        assertThat(messages.findLatestMessageId(-1L)).isNull()

        // The bulk update bypasses the persistence context, so the counts show the stored marker.
        assertThat(messages.unreadCounts(2L, listOf(ch.id))).isEmpty()
    }

    private fun send(
        channelId: Long,
        authorId: Long,
        parentId: Long? = null,
        deleted: Boolean = false,
        type: MessageType = MessageType.USER
    ) = messages.save(
        Message(
            channelId = channelId, authorId = authorId, body = "m", parentMessageId = parentId,
            deletedAt = if (deleted) Instant.now() else null, type = type
        )
    )
}
