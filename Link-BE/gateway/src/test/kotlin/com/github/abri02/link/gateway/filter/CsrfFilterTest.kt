package com.github.abri02.link.gateway.filter

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.http.HttpCookie
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.mock.http.server.reactive.MockServerHttpRequest
import org.springframework.mock.web.server.MockServerWebExchange
import reactor.core.publisher.Mono

class CsrfFilterTest {

    private val filter = CsrfFilter()
    private var forwarded = false
    private val chain = GatewayFilterChain {
        forwarded = true
        Mono.empty()
    }

    private fun run(
        method: HttpMethod,
        path: String = "/api/workspaces",
        cookie: String? = null,
        header: String? = null
    ): MockServerWebExchange {
        val builder = MockServerHttpRequest.method(method, path)
        cookie?.let { builder.cookie(HttpCookie(CsrfFilter.COOKIE, it)) }
        header?.let { builder.header(CsrfFilter.HEADER, it) }
        val exchange = MockServerWebExchange.from(builder)
        filter.filter(exchange, chain).block()
        return exchange
    }

    private fun assertRejected(exchange: MockServerWebExchange) {
        assertThat(exchange.response.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        assertThat(forwarded).isFalse()
    }

    @Test
    fun `POST without the header returns 403`() = assertRejected(run(HttpMethod.POST, cookie = "abc"))

    @Test
    fun `POST without the cookie returns 403`() = assertRejected(run(HttpMethod.POST, header = "abc"))

    @Test
    fun `POST with a header that differs from the cookie returns 403`() =
        assertRejected(run(HttpMethod.POST, cookie = "abc", header = "xyz"))

    @Test
    fun `POST with empty cookie and header returns 403`() =
        assertRejected(run(HttpMethod.POST, cookie = "", header = ""))

    @Test
    fun `PUT PATCH and DELETE are checked too`() {
        listOf(HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE).forEach { assertRejected(run(it, cookie = "abc")) }
    }

    @Test
    fun `POST with a matching header is forwarded`() {
        val exchange = run(HttpMethod.POST, cookie = "abc", header = "abc")
        assertThat(forwarded).isTrue()
        assertThat(exchange.response.statusCode).isNotEqualTo(HttpStatus.FORBIDDEN)
    }

    @Test
    fun `GET without a token is forwarded and receives a readable cookie`() {
        val exchange = run(HttpMethod.GET)
        assertThat(forwarded).isTrue()
        val cookie = exchange.response.cookies.getFirst(CsrfFilter.COOKIE)!!
        assertThat(cookie.value).isNotBlank()
        assertThat(cookie.isHttpOnly).isFalse()
        assertThat(cookie.path).isEqualTo("/")
    }

    @Test
    fun `an existing token is not replaced`() {
        val exchange = run(HttpMethod.GET, cookie = "abc")
        assertThat(exchange.response.cookies.getFirst(CsrfFilter.COOKIE)).isNull()
    }

    @Test
    fun `a rejected request still receives a token`() {
        val exchange = run(HttpMethod.POST)
        assertRejected(exchange)
        assertThat(exchange.response.cookies.getFirst(CsrfFilter.COOKIE)).isNotNull()
    }

    @Test
    fun `OPTIONS preflight is not checked`() {
        run(HttpMethod.OPTIONS)
        assertThat(forwarded).isTrue()
    }

    @Test
    fun `signup login and the Stripe webhook are exempt`() {
        listOf("/api/auth/signup", "/api/auth/login", "/api/payments/webhook").forEach {
            forwarded = false
            run(HttpMethod.POST, path = it)
            assertThat(forwarded).isTrue()
        }
    }

    @Test
    fun `refresh and logout are checked`() {
        listOf("/api/auth/refresh", "/api/auth/logout").forEach { assertRejected(run(HttpMethod.POST, path = it)) }
    }
}
