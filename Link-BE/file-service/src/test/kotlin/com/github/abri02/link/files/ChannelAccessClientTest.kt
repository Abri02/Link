package com.github.abri02.link.files

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.web.client.RestClient

class ChannelAccessClientTest {

    private lateinit var server: MockRestServiceServer
    private lateinit var client: ChannelAccessClient

    @BeforeEach
    fun setup() {
        val builder = RestClient.builder().baseUrl("http://messaging")
        server = MockRestServiceServer.bindTo(builder).build()
        client = ChannelAccessClient(builder.build())
    }

    @Test
    fun `isMember forwards the caller token and returns true on 204`() {
        server.expect(requestTo("http://messaging/channels/5/membership"))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer tok"))
            .andRespond(withStatus(HttpStatus.NO_CONTENT))

        assertThat(client.isMember(5L, "tok")).isTrue()
        server.verify()
    }

    @Test
    fun `isMember returns false on 403`() {
        server.expect(requestTo("http://messaging/channels/5/membership"))
            .andRespond(withStatus(HttpStatus.FORBIDDEN))

        assertThat(client.isMember(5L, "tok")).isFalse()
    }

    @Test
    fun `isMember returns false on 404`() {
        server.expect(requestTo("http://messaging/channels/5/membership"))
            .andRespond(withStatus(HttpStatus.NOT_FOUND))

        assertThat(client.isMember(5L, "tok")).isFalse()
    }
}
