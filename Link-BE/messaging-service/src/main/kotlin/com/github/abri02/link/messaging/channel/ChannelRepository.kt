package com.github.abri02.link.messaging.channel

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

interface DmView {
    fun getId(): Long
    fun getWorkspaceId(): Long
    fun getOtherUserId(): Long
    fun getOtherUsername(): String
}

@Repository
interface ChannelRepository : JpaRepository<Channel, Long> {
    fun findByWorkspaceIdAndKindNot(workspaceId: Long, kind: ChannelKind): List<Channel>
    fun findByWorkspaceId(workspaceId: Long): List<Channel>
    fun findByWorkspaceIdAndKind(workspaceId: Long, kind: ChannelKind): List<Channel>
    fun existsByWorkspaceIdAndName(workspaceId: Long, name: String): Boolean

    @Query(value = """
        SELECT cm1.channel_id
        FROM messaging.channel_member cm1
        JOIN messaging.channel_member cm2 ON cm1.channel_id = cm2.channel_id
        JOIN messaging.channel c ON c.id = cm1.channel_id
        WHERE c.kind = 'DM'
          AND c.workspace_id = :workspaceId
          AND cm1.user_id = :userId1
          AND cm2.user_id = :userId2
        LIMIT 1
    """, nativeQuery = true)
    fun findDmChannelId(@Param("workspaceId") workspaceId: Long, @Param("userId1") userId1: Long, @Param("userId2") userId2: Long): Long?

    @Query(value = """
        SELECT c.id, c.workspace_id, cm_other.user_id AS other_user_id, u.username AS other_username
        FROM messaging.channel c
        JOIN messaging.channel_member cm_me    ON cm_me.channel_id    = c.id AND cm_me.user_id    = :userId
        JOIN messaging.channel_member cm_other ON cm_other.channel_id = c.id AND cm_other.user_id <> :userId
        JOIN auth.auth_user u ON u.id = cm_other.user_id
        WHERE c.workspace_id = :workspaceId AND c.kind = 'DM'
    """, nativeQuery = true)
    fun findDmsForUser(@Param("workspaceId") workspaceId: Long, @Param("userId") userId: Long): List<DmView>
}

@Repository
interface ChannelMemberRepository : JpaRepository<ChannelMember, Long> {
    fun existsByChannelIdAndUserId(channelId: Long, userId: Long): Boolean
    fun findByChannelId(channelId: Long): List<ChannelMember>
}
