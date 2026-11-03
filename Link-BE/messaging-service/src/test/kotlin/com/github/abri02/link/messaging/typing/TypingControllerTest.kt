package com.github.abri02.link.messaging.typing

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken

@ExtendWith(MockitoExtension::class)
class TypingControllerTest {

    @Mock lateinit var channelMembers: ChannelMemberRepository
    @Mock lateinit var broker: SimpMessagingTemplate

    private lateinit var controller: TypingController

    @BeforeEach
    fun setup() {
        controller = TypingController(channelMembers, broker)
    }

    @Test
    fun `member typing is broadcast to the channel typing topic with the username from the token`() {
        given(channelMembers.existsByChannelIdAndUserId(5L, 1L)).willReturn(true)

        controller.typing(TypingRequest(5L), principal(1L))

        verify(broker).convertAndSend("/topic/channel.5.typing", TypingEvent(5L, 1L, "user1"))
    }

    @Test
    fun `non-member typing is not broadcast`() {
        given(channelMembers.existsByChannelIdAndUserId(5L, 2L)).willReturn(false)

        controller.typing(TypingRequest(5L), principal(2L))

        verify(broker, never()).convertAndSend(any<String>(), any<Any>())
    }

    @Test
    fun `typing from a principal that is not a JWT token is ignored`() {
        controller.typing(TypingRequest(5L)) { "anonymous" }

        verify(channelMembers, never()).existsByChannelIdAndUserId(any(), any())
        verify(broker, never()).convertAndSend(any<String>(), any<Any>())
    }

    private fun principal(userId: Long) = JwtAuthenticationToken(
        Jwt.withTokenValue("tok")
            .header("alg", "RS256")
            .subject(userId.toString())
            .claim(Claims.USERNAME, "user$userId")
            .build(),
        emptyList()
    )
}
