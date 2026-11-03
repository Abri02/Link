package com.github.abri02.link.messaging.workspace

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import org.springframework.stereotype.Repository

interface MemberWithUsername {
    fun getUserId(): Long
    fun getUsername(): String
    fun getRole(): String
}

@Repository
interface WorkspaceRepository : JpaRepository<Workspace, Long> {
    fun existsBySlug(slug: String): Boolean
}

@Repository
interface WorkspaceMemberRepository : JpaRepository<WorkspaceMember, Long> {
    fun findByWorkspaceIdAndUserId(workspaceId: Long, userId: Long): WorkspaceMember?
    fun existsByWorkspaceIdAndUserId(workspaceId: Long, userId: Long): Boolean
    fun countByWorkspaceIdAndRole(workspaceId: Long, role: WorkspaceRole): Long

    @Query("SELECT wm.workspaceId FROM WorkspaceMember wm WHERE wm.userId = :userId")
    fun findWorkspaceIdsByUserId(userId: Long): List<Long>

    @Query(value = """
        SELECT wm.user_id, u.username, wm.role
        FROM messaging.workspace_member wm
        JOIN auth.auth_user u ON u.id = wm.user_id
        WHERE wm.workspace_id = :workspaceId
    """, nativeQuery = true)
    fun findMembersWithUsernameByWorkspaceId(@Param("workspaceId") workspaceId: Long): List<MemberWithUsername>
}
