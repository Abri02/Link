package com.github.abri02.link.messaging.workspace

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.stereotype.Repository

@Repository
interface WorkspaceRepository : JpaRepository<Workspace, Long> {
    fun existsBySlug(slug: String): Boolean
}

@Repository
interface WorkspaceMemberRepository : JpaRepository<WorkspaceMember, Long> {
    fun findByWorkspaceIdAndUserId(workspaceId: Long, userId: Long): WorkspaceMember?
    fun existsByWorkspaceIdAndUserId(workspaceId: Long, userId: Long): Boolean

    @Query("SELECT wm.workspaceId FROM WorkspaceMember wm WHERE wm.userId = :userId")
    fun findWorkspaceIdsByUserId(userId: Long): List<Long>
}
