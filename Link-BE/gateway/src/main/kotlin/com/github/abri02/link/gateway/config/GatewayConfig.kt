package com.github.abri02.link.gateway.config

import com.github.abri02.link.jwt.JwtVerifier
import com.github.abri02.link.jwt.KeyLoader
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.reactive.CorsWebFilter
import org.springframework.web.cors.reactive.UrlBasedCorsConfigurationSource

@Configuration
class GatewayConfig {

    @Bean
    fun jwtVerifier(): JwtVerifier = JwtVerifier(KeyLoader.publicKey())

    /**
     * Explicit CorsWebFilter at HIGHEST_PRECEDENCE ensures CORS headers are present
     * on every response — including 401s returned by JwtCookieFilter — and that
     * preflight OPTIONS requests are resolved before the JWT filter runs.
     *
     * This replaces the globalcors YAML block, which doesn't guarantee header
     * injection when a downstream WebFilter short-circuits the chain.
     */
    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    fun corsWebFilter(): CorsWebFilter {
        val config = CorsConfiguration().apply {
            allowedOrigins = listOf("http://localhost:5173")
            allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            allowedHeaders = listOf("*")
            allowCredentials = true
            maxAge = 3600L
        }
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", config)
        return CorsWebFilter(source)
    }
}
