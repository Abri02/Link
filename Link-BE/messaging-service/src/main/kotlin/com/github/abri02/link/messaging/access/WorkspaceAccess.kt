package com.github.abri02.link.messaging.access

import com.github.abri02.link.messaging.channel.Channel
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import com.github.abri02.link.messaging.workspace.WorkspaceMember
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspacePlan
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRole
import org.springframework.stereotype.Service
import java.time.Instant
import java.time.temporal.ChronoUnit

class ForbiddenException(message: String) : RuntimeException(message)

class NotFoundException(message: String) : RuntimeException(message)

/** A limit of the workspace's plan was hit (README §3.7). Mapped to 402 with a machine-readable [code]. */
class PlanLimitException(val code: String, message: String) : RuntimeException(message)

const val FREE_GUEST_LIMIT = 3
const val FREE_HISTORY_DAYS = 90L

/**
 * Central workspace / channel authorization checks. Each method returns what it looked up,
 * or throws [NotFoundException] (404) / [ForbiddenException] (403), which
 * [AccessExceptionHandler] turns into an `ErrorResponse`.
 */
@Service
class WorkspaceAccess(
    private val workspaces: WorkspaceRepository,
    private val workspaceMembers: WorkspaceMemberRepository,
    private val channels: ChannelRepository,
    private val channelMembers: ChannelMemberRepository
) {

    fun requireMember(workspaceId: Long, userId: Long): WorkspaceMember {
        if (!workspaces.existsById(workspaceId)) throw NotFoundException("Workspace not found")
        return workspaceMembers.findByWorkspaceIdAndUserId(workspaceId, userId)
            ?: throw ForbiddenException("Not a member of this workspace")
    }

    fun requireRole(
        workspaceId: Long,
        userId: Long,
        vararg roles: WorkspaceRole,
        reason: String = "Insufficient workspace role"
    ): WorkspaceMember {
        val member = requireMember(workspaceId, userId)
        if (member.role !in roles) throw ForbiddenException(reason)
        return member
    }

    /** Returns the channel, so callers can read its `workspaceId` without a second lookup. */
    fun requireChannelMember(channelId: Long, userId: Long): Channel {
        val channel = channels.findById(channelId).orElse(null)
            ?: throw NotFoundException("Channel not found")
        if (!channelMembers.existsByChannelIdAndUserId(channelId, userId))
            throw ForbiddenException("Not a member of this channel")
        return channel
    }

    /** A workspace that can't be found counts as FREE, so a missing row never unlocks anything. */
    fun planOf(workspaceId: Long): WorkspacePlan =
        workspaces.findById(workspaceId).map { it.plan }.orElse(WorkspacePlan.FREE)

    /** Messages created before this instant are hidden. Premium workspaces see everything. */
    fun historyCutoff(workspaceId: Long): Instant =
        if (planOf(workspaceId) == WorkspacePlan.PREMIUM) Instant.EPOCH
        else Instant.now().minus(FREE_HISTORY_DAYS, ChronoUnit.DAYS)

    /** Call before adding a guest. Guests over the limit after a downgrade keep their access. */
    fun requireGuestSlot(workspaceId: Long) {
        if (planOf(workspaceId) == WorkspacePlan.PREMIUM) return
        if (workspaceMembers.countByWorkspaceIdAndRole(workspaceId, WorkspaceRole.GUEST) >= FREE_GUEST_LIMIT)
            throw PlanLimitException("GUEST_LIMIT_REACHED", "The Free plan allows at most $FREE_GUEST_LIMIT guests")
    }
}
