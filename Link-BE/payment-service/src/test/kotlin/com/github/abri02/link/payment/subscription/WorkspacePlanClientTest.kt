package com.github.abri02.link.payment.subscription

import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.content
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.web.client.RestClient

class WorkspacePlanClientTest {

    private val url = "http://messaging/internal/workspaces/5/plan"
    private lateinit var server: MockRestServiceServer
    private lateinit var client: WorkspacePlanClient

    @BeforeEach
    fun setup() {
        val builder = RestClient.builder().baseUrl("http://messaging")
        server = MockRestServiceServer.bindTo(builder).build()
        client = WorkspacePlanClient(builder.build(), "svc-token")
    }

    @Test
    fun `updatePlan sends the plan with the service token`() {
        server.expect(requestTo(url))
            .andExpect(method(HttpMethod.PATCH))
            .andExpect(header("X-Internal-Token", "svc-token"))
            .andExpect(content().json("""{"plan":"PREMIUM"}"""))
            .andRespond(withStatus(HttpStatus.NO_CONTENT))

        client.updatePlan(5L, "PREMIUM")
        server.verify()
    }

    @Test
    fun `updatePlan does not fail when the workspace is gone`() {
        server.expect(requestTo(url)).andRespond(withStatus(HttpStatus.NOT_FOUND))

        assertThatCode { client.updatePlan(5L, "FREE") }.doesNotThrowAnyException()
    }

    @Test
    fun `updatePlan throws on any other response so Stripe retries`() {
        server.expect(requestTo(url)).andRespond(withStatus(HttpStatus.FORBIDDEN))

        assertThatThrownBy { client.updatePlan(5L, "FREE") }.isInstanceOf(IllegalStateException::class.java)
    }
}
