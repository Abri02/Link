package com.github.abri02.link.messaging.config

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Answers
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.given
import org.mockito.kotlin.mock
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.springframework.web.socket.config.annotation.StompEndpointRegistry
import org.springframework.web.socket.config.annotation.StompWebSocketEndpointRegistration

@ExtendWith(MockitoExtension::class)
class WebSocketConfigTest {

    @Mock lateinit var stompAuthChannelInterceptor: StompAuthChannelInterceptor
    @Mock lateinit var jwtHandshakeInterceptor: JwtHandshakeInterceptor
    @Mock lateinit var registry: StompEndpointRegistry

    private val registration: StompWebSocketEndpointRegistration = mock(defaultAnswer = Answers.RETURNS_SELF)

    @Test
    fun `ws endpoint only allows the configured origins`() {
        given(registry.addEndpoint("/ws")).willReturn(registration)
        val config = WebSocketConfig(
            stompAuthChannelInterceptor,
            jwtHandshakeInterceptor,
            arrayOf("http://localhost:5173", "https://link.example")
        )

        config.registerStompEndpoints(registry)

        verify(registration).setAllowedOrigins("http://localhost:5173", "https://link.example")
        verify(registration, never()).setAllowedOriginPatterns(any())
        verify(registration).addInterceptors(jwtHandshakeInterceptor)
    }
}
