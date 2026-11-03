package com.github.abri02.link.messaging.workspace

import com.github.abri02.link.messaging.support.PostgresIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class WorkspaceMemberRepositoryTest : PostgresIntegrationTest() {

    @Autowired lateinit var workspaces: WorkspaceRepository
    @Autowired lateinit var workspaceMembers: WorkspaceMemberRepository

    @Test
    fun `countByWorkspaceIdAndRole counts only that role in that workspace`() {
        val ws = workspaces.save(Workspace(name = "Count", slug = "count-${System.nanoTime()}", ownerId = 1L))
        val other = workspaces.save(Workspace(name = "Other", slug = "other-${System.nanoTime()}", ownerId = 9L))
        workspaceMembers.save(WorkspaceMember(workspaceId = ws.id!!, userId = 1L, role = WorkspaceRole.OWNER))
        workspaceMembers.save(WorkspaceMember(workspaceId = ws.id, userId = 2L, role = WorkspaceRole.OWNER))
        workspaceMembers.save(WorkspaceMember(workspaceId = ws.id, userId = 3L, role = WorkspaceRole.ADMIN))
        workspaceMembers.save(WorkspaceMember(workspaceId = other.id!!, userId = 9L, role = WorkspaceRole.OWNER))

        assertThat(workspaceMembers.countByWorkspaceIdAndRole(ws.id, WorkspaceRole.OWNER)).isEqualTo(2L)
        assertThat(workspaceMembers.countByWorkspaceIdAndRole(ws.id, WorkspaceRole.ADMIN)).isEqualTo(1L)
        assertThat(workspaceMembers.countByWorkspaceIdAndRole(ws.id, WorkspaceRole.GUEST)).isEqualTo(0L)
        assertThat(workspaceMembers.countByWorkspaceIdAndRole(other.id, WorkspaceRole.OWNER)).isEqualTo(1L)
    }
}
