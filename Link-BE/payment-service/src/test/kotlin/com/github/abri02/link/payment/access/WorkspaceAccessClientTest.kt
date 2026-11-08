package com.github.abri02.link.payment.access

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient

class WorkspaceAccessClientTest {

    private val url = "http://messaging/workspaces/5/membership"
    private lateinit var server: MockRestServiceServer
    private lateinit var client: WorkspaceAccessClient

    @BeforeEach
    fun setup() {
        val builder = RestClient.builder().baseUrl("http://messaging")
        server = MockRestServiceServer.bindTo(builder).build()
        client = WorkspaceAccessClient(builder.build())
    }

    @Test
    fun `membership forwards the caller token and returns the role`() {
        server.expect(requestTo(url))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer tok"))
            .andRespond(withSuccess("""{"role":"OWNER"}""", MediaType.APPLICATION_JSON))

        assertThat(client.membership(5L, "tok")).isEqualTo(WorkspaceMembership.Member("OWNER"))
        server.verify()
    }

    @Test
    fun `membership returns NotMember on 403`() {
        server.expect(requestTo(url)).andRespond(withStatus(HttpStatus.FORBIDDEN))

        assertThat(client.membership(5L, "tok")).isEqualTo(WorkspaceMembership.NotMember)
    }

    @Test
    fun `membership returns NoWorkspace on 404`() {
        server.expect(requestTo(url)).andRespond(withStatus(HttpStatus.NOT_FOUND))

        assertThat(client.membership(5L, "tok")).isEqualTo(WorkspaceMembership.NoWorkspace)
    }

    @Test
    fun `membership throws on an unexpected status instead of granting access`() {
        server.expect(requestTo(url)).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR))

        assertThatThrownBy { client.membership(5L, "tok") }.isInstanceOf(Exception::class.java)
    }
}
