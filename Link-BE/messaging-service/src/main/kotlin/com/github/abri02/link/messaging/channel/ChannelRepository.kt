package com.github.abri02.link.messaging.channel

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

@Repository
interface ChannelRepository : JpaRepository<Channel, Long> {
    fun findByWorkspaceId(workspaceId: Long): List<Channel>
    fun findByWorkspaceIdAndKind(workspaceId: Long, kind: ChannelKind): List<Channel>
    fun existsByWorkspaceIdAndName(workspaceId: Long, name: String): Boolean

    /** PUBLIC and PRIVATE channels of the workspace that the user is a member of. DMs are excluded. */
    @Query("""
        SELECT c FROM Channel c
        WHERE c.workspaceId = :workspaceId
          AND c.kind IN (com.github.abri02.link.messaging.channel.ChannelKind.PUBLIC,
                         com.github.abri02.link.messaging.channel.ChannelKind.PRIVATE)
          AND EXISTS (SELECT 1 FROM ChannelMember cm WHERE cm.channelId = c.id AND cm.userId = :userId)
        ORDER BY c.id
    """)
    fun findJoinedChannels(@Param("workspaceId") workspaceId: Long, @Param("userId") userId: Long): List<Channel>

    /** PUBLIC channels of the workspace that the user is not a member of, by name. */
    @Query("""
        SELECT c FROM Channel c
        WHERE c.workspaceId = :workspaceId
          AND c.kind = com.github.abri02.link.messaging.channel.ChannelKind.PUBLIC
          AND NOT EXISTS (SELECT 1 FROM ChannelMember cm WHERE cm.channelId = c.id AND cm.userId = :userId)
        ORDER BY c.name
    """)
    fun findBrowsableChannels(@Param("workspaceId") workspaceId: Long, @Param("userId") userId: Long): List<Channel>

    fun findByWorkspaceIdAndMemberKey(workspaceId: Long, memberKey: String): Channel?

    /** DMs and group DMs of the workspace that the user is a member of, oldest first. */
    @Query("""
        SELECT c FROM Channel c
        WHERE c.workspaceId = :workspaceId
          AND c.kind IN (com.github.abri02.link.messaging.channel.ChannelKind.DM,
                         com.github.abri02.link.messaging.channel.ChannelKind.GROUP_DM)
          AND EXISTS (SELECT 1 FROM ChannelMember cm WHERE cm.channelId = c.id AND cm.userId = :userId)
        ORDER BY c.id
    """)
    fun findConversationsForUser(@Param("workspaceId") workspaceId: Long, @Param("userId") userId: Long): List<Channel>
}

@Repository
interface ChannelMemberRepository : JpaRepository<ChannelMember, Long> {
    fun existsByChannelIdAndUserId(channelId: Long, userId: Long): Boolean
    fun findByChannelId(channelId: Long): List<ChannelMember>
    fun findByChannelIdIn(channelIds: Collection<Long>): List<ChannelMember>

    @Modifying
    @Query("DELETE FROM ChannelMember cm WHERE cm.channelId = :channelId AND cm.userId = :userId")
    fun deleteByChannelIdAndUserId(@Param("channelId") channelId: Long, @Param("userId") userId: Long): Int

    /** Removes the user from every channel (public, private and DM) of the workspace. */
    @Modifying
    @Query("""
        DELETE FROM ChannelMember cm
        WHERE cm.userId = :userId
          AND cm.channelId IN (SELECT c.id FROM Channel c WHERE c.workspaceId = :workspaceId)
    """)
    fun deleteByWorkspaceIdAndUserId(@Param("workspaceId") workspaceId: Long, @Param("userId") userId: Long): Int
}
