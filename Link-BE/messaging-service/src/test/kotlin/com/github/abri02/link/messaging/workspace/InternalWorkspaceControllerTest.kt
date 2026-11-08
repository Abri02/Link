package com.github.abri02.link.messaging.workspace

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.springframework.http.HttpStatus
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class InternalWorkspaceControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository

    private lateinit var controller: InternalWorkspaceController

    private val premium = UpdatePlanRequest(WorkspacePlan.PREMIUM)

    @BeforeEach
    fun setup() {
        controller = InternalWorkspaceController(workspaces, "svc-token")
    }

    @Test
    fun `updatePlan stores the plan`() {
        val workspace = Workspace(name = "w", slug = "w", ownerId = 1L)
        given(workspaces.findById(5L)).willReturn(Optional.of(workspace))

        val res = controller.updatePlan("svc-token", 5L, premium)

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        assertThat(workspace.plan).isEqualTo(WorkspacePlan.PREMIUM)
        verify(workspaces).save(workspace)
    }

    @Test
    fun `updatePlan returns 403 for a wrong or missing token`() {
        assertThat(controller.updatePlan("wrong", 5L, premium).statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        assertThat(controller.updatePlan(null, 5L, premium).statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(workspaces, never()).save(any<Workspace>())
    }

    @Test
    fun `updatePlan refuses every call when no token is configured`() {
        val unconfigured = InternalWorkspaceController(workspaces, "")

        assertThat(unconfigured.updatePlan("", 5L, premium).statusCode).isEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `updatePlan returns 404 when the workspace does not exist`() {
        given(workspaces.findById(99L)).willReturn(Optional.empty())

        assertThat(controller.updatePlan("svc-token", 99L, premium).statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }
}
