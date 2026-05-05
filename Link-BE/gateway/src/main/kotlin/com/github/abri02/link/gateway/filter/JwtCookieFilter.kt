package com.github.abri02.link.gateway.filter

import com.github.abri02.link.jwt.JwtVerifier
import org.springframework.cloud.gateway.filter.GatewayFilterChain
import org.springframework.cloud.gateway.filter.GlobalFilter
import org.springframework.core.Ordered
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import org.springframework.web.server.ServerWebExchange
import reactor.core.publisher.Mono

/**
 * Reads the LINK_SESSION cookie, verifies the JWT signature and expiry, then
 * adds "Authorization: Bearer <jwt>" so downstream services can run as plain
 * Spring OAuth2 resource servers without touching cookies.
 *
 * Public paths (signup, login, refresh, logout) bypass JWT validation because
 * they either establish or tear down the session rather than consuming it.
 */
@Component
class JwtCookieFilter(private val jwtVerifier: JwtVerifier) : GlobalFilter, Ordered {

    companion object {
        private val PUBLIC_PATHS = setOf(
            "/api/auth/signup",
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/auth/logout"
        )
    }

    override fun getOrder(): Int = -1

    override fun filter(exchange: ServerWebExchange, chain: GatewayFilterChain): Mono<Void> {
        val path = exchange.request.uri.path

        if (path in PUBLIC_PATHS) {
            return chain.filter(exchange)
        }

        val token = exchange.request.cookies.getFirst("LINK_SESSION")?.value
            ?: return reject(exchange)

        if (!jwtVerifier.verify(token)) {
            return reject(exchange)
        }

        val forwarded = exchange.request.mutate()
            .header(HttpHeaders.AUTHORIZATION, "Bearer $token")
            .build()
        return chain.filter(exchange.mutate().request(forwarded).build())
    }

    private fun reject(exchange: ServerWebExchange): Mono<Void> {
        exchange.response.statusCode = HttpStatus.UNAUTHORIZED
        return exchange.response.setComplete()
    }
}
