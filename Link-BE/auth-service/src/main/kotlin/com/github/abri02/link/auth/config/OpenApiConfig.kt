package com.github.abri02.link.auth.config

import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.security.SecurityRequirement
import io.swagger.v3.oas.models.security.SecurityScheme
import io.swagger.v3.oas.models.Components
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class OpenApiConfig {

    @Bean
    fun openApi(): OpenAPI = OpenAPI()
        .info(
            Info()
                .title("Link — Auth Service")
                .description("Signup, login, refresh, logout, and /me endpoints. Cookies are set by the server; pass the JWT as a Bearer token to test authenticated endpoints directly.")
                .version("v1")
        )
        .components(
            Components().addSecuritySchemes(
                "bearer",
                SecurityScheme()
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")
                    .description("Paste the value of the LINK_SESSION cookie here to test authenticated endpoints.")
            )
        )
        .addSecurityItem(SecurityRequirement().addList("bearer"))
}
