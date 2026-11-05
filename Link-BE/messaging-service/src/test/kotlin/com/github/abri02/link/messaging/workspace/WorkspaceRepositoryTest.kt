package com.github.abri02.link.messaging.workspace

import com.github.abri02.link.messaging.support.PostgresIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.jdbc.core.JdbcTemplate

class WorkspaceRepositoryTest : PostgresIntegrationTest() {

    @Autowired lateinit var workspaces: WorkspaceRepository
    @Autowired lateinit var jdbc: JdbcTemplate

    @Test
    fun `new workspace defaults to FREE plan`() {
        val ws = workspaces.save(Workspace(name = "Plan", slug = "plan-${System.nanoTime()}", ownerId = 1L))

        assertThat(workspaces.findById(ws.id!!).get().plan).isEqualTo(WorkspacePlan.FREE)
    }

    @Test
    fun `plan is persisted as PREMIUM after an update`() {
        val ws = workspaces.save(Workspace(name = "Paid", slug = "paid-${System.nanoTime()}", ownerId = 1L))
        ws.plan = WorkspacePlan.PREMIUM
        workspaces.save(ws)

        assertThat(workspaces.findById(ws.id!!).get().plan).isEqualTo(WorkspacePlan.PREMIUM)
    }

    @Test
    fun `row inserted without a plan gets the FREE database default`() {
        val slug = "legacy-${System.nanoTime()}"
        jdbc.update(
            "insert into messaging.workspace (name, slug, owner_id, created_at) values (?, ?, ?, now())",
            "Legacy", slug, 1L,
        )

        assertThat(workspaces.findAll().single { it.slug == slug }.plan).isEqualTo(WorkspacePlan.FREE)
    }
}
