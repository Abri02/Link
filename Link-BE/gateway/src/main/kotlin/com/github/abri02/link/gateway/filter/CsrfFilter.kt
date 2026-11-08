package com.github.abri02.link.gateway.filter

import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * Double-submit CSRF protection. Every response to a browser without a token sets a
 * JS-readable XSRF-TOKEN cookie, and state-changing requests must echo it in the
 * X-XSRF-TOKEN header. Another site can make the browser send the cookie but can't read it.
 *
 * Signup and login are exempt because a fresh browser may not have a token yet, and the
 * Stripe webhook is exempt because Stripe has no cookies (payment-service verifies its signature).
 */
@Component
class CsrfFilter : GlobalFilter, Ordered {

    companion object {
        const val COOKIE = "XSRF-TOKEN"
        const val HEADER = "X-XSRF-TOKEN"
        private val SAFE_METHODS = setOf(HttpMethod.GET, HttpMethod.HEAD, HttpMethod.OPTIONS, HttpMethod.TRACE)
        private val EXEMPT_PATHS = setOf(
            "/api/auth/signup",
            "/api/auth/login",
            "/api/payments/webhook"
        )
        private val random = SecureRandom()
    }

    // Before JwtCookieFilter, so that its 401 responses also carry the token cookie.
    override fun getOrder(): Int = -2

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val request = exchange.request
        val cookie = request.cookies.getFirst(COOKIE)?.value
        if (cookie.isNullOrEmpty()) {
            exchange.response.addCookie(newTokenCookie())
        }

        if (request.method in SAFE_METHODS || request.uri.path in EXEMPT_PATHS) {
            return chain.filter(exchange)
        }

        if (!matches(cookie, request.headers.getFirst(HEADER))) {
            exchange.response.statusCode = HttpStatus.FORBIDDEN
            return exchange.response.setComplete()
        }
        return chain.filter(exchange)
    }

    private fun matches(cookie: String?, header: String?): Boolean {
        if (cookie.isNullOrEmpty() || header.isNullOrEmpty()) return false
        return MessageDigest.isEqual(cookie.toByteArray(), header.toByteArray())
    }

    private fun newTokenCookie(): ResponseCookie {
        val bytes = ByteArray(32).also(random::nextBytes)
        val token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes)
        return ResponseCookie.from(COOKIE, token)
            .httpOnly(false) // apiClient has to read it
            .secure(false)
            .sameSite("Lax")
            .path("/")
            .build()
    }
}
