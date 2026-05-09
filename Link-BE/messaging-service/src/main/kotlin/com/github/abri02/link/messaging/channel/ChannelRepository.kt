package com.github.abri02.link.messaging.channel

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface ChannelRepository : JpaRepository<Channel, Long> {
    fun findByWorkspaceId(workspaceId: Long): List<Channel>
    fun existsByWorkspaceIdAndName(workspaceId: Long, name: String): Boolean
}

@Repository
interface ChannelMemberRepository : JpaRepository<ChannelMember, Long> {
    fun existsByChannelIdAndUserId(channelId: Long, userId: Long): Boolean
}
