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
import org.springframework.data.domain.PageRequest
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit

class MessageRepositoryTest : PostgresIntegrationTest() {

    @Autowired lateinit var workspaces: WorkspaceRepository
    @Autowired lateinit var channels: ChannelRepository
    @Autowired lateinit var channelMembers: ChannelMemberRepository
    @Autowired lateinit var messages: MessageRepository
    @Autowired lateinit var mentions: MessageMentionRepository

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
    fun `countMentionsByChannel counts unread mentions of the user including thread replies`() {
        val ws = workspaces.save(Workspace(name = "D5", slug = "d5-${System.nanoTime()}", ownerId = 1L))
        val general = channels.save(Channel(workspaceId = ws.id!!, name = "general", createdBy = 1L))
        val random = channels.save(Channel(workspaceId = ws.id, name = "random", createdBy = 1L))

        // general: user 2 read up to `read`. Two newer mentions count (one of them a thread reply).
        val read = send(general.id!!, 1L)
        mention(read.id!!, 2L)                                   // already read
        val parent = send(general.id, 1L)
        mention(parent.id!!, 2L)
        mention(send(general.id, 1L, parentId = parent.id).id!!, 2L)
        mention(send(general.id, 1L, deleted = true).id!!, 2L)   // deleted
        mention(send(general.id, 1L).id!!, 3L)                   // someone else's mention
        send(general.id, 1L)                                     // no mention
        channelMembers.save(ChannelMember(channelId = general.id, userId = 2L, lastReadMessageId = read.id))

        // random: no marker yet, so the mention is unread. Only the asked-for channels are counted.
        mention(send(random.id!!, 1L).id!!, 2L)
        channelMembers.save(ChannelMember(channelId = random.id, userId = 2L))

        assertThat(messages.mentionCounts(2L, listOf(general.id)))
            .containsExactlyInAnyOrderEntriesOf(mapOf(general.id to 2L))
        assertThat(messages.mentionCounts(2L, listOf(general.id, random.id)))
            .containsExactlyInAnyOrderEntriesOf(mapOf(general.id to 2L, random.id to 1L))
        // Mentions in channels the user isn't a member of never count.
        assertThat(messages.mentionCounts(3L, listOf(general.id))).isEmpty()
        assertThat(messages.mentionCounts(2L, emptyList())).isEmpty()
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

    @Test
    fun `history queries leave out messages older than the cutoff`() {
        val ws = workspaces.save(Workspace(name = "F5", slug = "f5-${System.nanoTime()}", ownerId = 1L))
        val ch = channels.save(Channel(workspaceId = ws.id!!, name = "general", createdBy = 1L))
        val cutoff = Instant.now().minus(90, ChronoUnit.DAYS)
        val old = messages.save(Message(channelId = ch.id!!, authorId = 1L, body = "needle old", createdAt = cutoff.minus(1, ChronoUnit.DAYS)))
        val recent = messages.save(Message(channelId = ch.id, authorId = 1L, body = "needle new", createdAt = cutoff.plus(1, ChronoUnit.DAYS)))
        val page = PageRequest.of(0, 10)

        assertThat(messages.findByChannelIdAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(ch.id, cutoff, page).map { it.id })
            .containsExactly(recent.id)
        assertThat(messages.findByChannelIdAndBodyContainingIgnoreCaseAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(ch.id, "NEEDLE", cutoff, page).map { it.id })
            .containsExactly(recent.id)
        assertThat(messages.findByChannelIdAndIdLessThanAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(ch.id, recent.id!! + 1, cutoff, page).map { it.id })
            .containsExactly(recent.id)
        // The Premium cutoff keeps everything, newest first.
        assertThat(messages.findByChannelIdAndParentMessageIdIsNullAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(ch.id, Instant.EPOCH, page).map { it.id })
            .containsExactly(recent.id, old.id)
    }

    private fun mention(messageId: Long, userId: Long) = mentions.save(MessageMention(messageId, userId))

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
