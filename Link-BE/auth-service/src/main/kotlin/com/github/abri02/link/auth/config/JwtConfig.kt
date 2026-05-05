package com.github.abri02.link.auth.config

import com.github.abri02.link.jwt.JwtSigner
import com.github.abri02.link.jwt.KeyLoader
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder

@Configuration
class JwtConfig {

    @Bean
    fun jwtSigner(): JwtSigner = JwtSigner(KeyLoader.privateKey())

    @Bean
    fun passwordEncoder(): PasswordEncoder = BCryptPasswordEncoder()
}
