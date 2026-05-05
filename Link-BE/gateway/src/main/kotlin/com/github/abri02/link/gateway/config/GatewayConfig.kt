package com.github.abri02.link.gateway.config

import com.github.abri02.link.jwt.JwtVerifier
import com.github.abri02.link.jwt.KeyLoader
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class GatewayConfig {

    @Bean
    fun jwtVerifier(): JwtVerifier = JwtVerifier(KeyLoader.publicKey())
}
