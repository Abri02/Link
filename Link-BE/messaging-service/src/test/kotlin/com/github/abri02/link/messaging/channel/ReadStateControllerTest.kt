package com.github.abri02.link.messaging.channel

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.messaging.access.WorkspaceAccess
import com.github.abri02.link.messaging.message.MessageRepository
import com.github.abri02.link.messaging.support.respond
import com.github.abri02.link.messaging.workspace.WorkspaceMemberRepository
import com.github.abri02.link.messaging.workspace.WorkspaceRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.given
import org.mockito.kotlin.never
import org.mockito.kotlin.verify
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class ReadStateControllerTest {

    @Mock private lateinit var workspaces: WorkspaceRepository
    @Mock private lateinit var workspaceMembers: WorkspaceMemberRepository
    @Mock private lateinit var channels: ChannelRepository
    @Mock private lateinit var channelMembers: ChannelMemberRepository
    @Mock private lateinit var messages: MessageRepository

    private lateinit var controller: ReadStateController

    private val channel = Channel(workspaceId = 1L, name = "general", createdBy = 1L).also {
        Channel::class.java.getDeclaredField("id").apply { isAccessible = true }.set(it, 10L)
    }

    @BeforeEach
    fun setup() {
        controller = ReadStateController(
            WorkspaceAccess(workspaces, workspaceMembers, channels, channelMembers), channelMembers, messages
        )
    }

    @Test
    fun `markRead moves the caller's marker to the latest message`() {
        given(channels.findById(10L)).willReturn(Optional.of(channel))
        given(channelMembers.existsByChannelIdAndUserId(10L, 2L)).willReturn(true)
        given(messages.findLatestMessageId(10L)).willReturn(55L)

        val res = respond { controller.markRead(jwt(2L), 10L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(channelMembers).markRead(10L, 2L, 55L)
    }

    @Test
    fun `markRead on an empty channel changes nothing`() {
        given(channels.findById(10L)).willReturn(Optional.of(channel))
        given(channelMembers.existsByChannelIdAndUserId(10L, 2L)).willReturn(true)
        given(messages.findLatestMessageId(10L)).willReturn(null)

        val res = respond { controller.markRead(jwt(2L), 10L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NO_CONTENT)
        verify(channelMembers, never()).markRead(any(), any(), any())
    }

    @Test
    fun `markRead returns 403 when caller is not in the channel`() {
        given(channels.findById(10L)).willReturn(Optional.of(channel))
        given(channelMembers.existsByChannelIdAndUserId(10L, 3L)).willReturn(false)

        val res = respond { controller.markRead(jwt(3L), 10L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verify(channelMembers, never()).markRead(any(), any(), any())
    }

    @Test
    fun `markRead returns 404 when the channel does not exist`() {
        given(channels.findById(99L)).willReturn(Optional.empty())

        val res = respond { controller.markRead(jwt(2L), 99L) }

        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    private fun jwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .claim(Claims.EMAIL, "u$userId@test.com")
        .claim(Claims.USERNAME, "user$userId")
        .build()
}
