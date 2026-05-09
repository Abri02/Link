package com.github.abri02.link.user.controller

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.user.profile.UserProfile
import com.github.abri02.link.user.profile.UserProfileRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.given
import org.springframework.http.HttpStatus
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class UserControllerTest {

    @Mock private lateinit var profiles: UserProfileRepository

    private lateinit var controller: UserController

    @BeforeEach
    fun setup() {
        controller = UserController(profiles)
    }

    @Test
    fun `me returns existing profile with JWT claims`() {
        val jwt = buildJwt(userId = 7L, email = "alice@test.com", username = "alice")
        val profile = UserProfile(id = 7L, displayName = "Alice")
        given(profiles.findById(7L)).willReturn(Optional.of(profile))

        val res = controller.me(jwt)
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        val body = res.body!!
        assertThat(body.id).isEqualTo(7L)
        assertThat(body.email).isEqualTo("alice@test.com")
        assertThat(body.username).isEqualTo("alice")
        assertThat(body.displayName).isEqualTo("Alice")
    }

    @Test
    fun `me creates profile lazily when none exists`() {
        val jwt = buildJwt(userId = 8L, email = "bob@test.com", username = "bob")
        val created = UserProfile(id = 8L, displayName = "bob")
        given(profiles.findById(8L)).willReturn(Optional.empty())
        given(profiles.save(any<UserProfile>())).willReturn(created)

        val res = controller.me(jwt)
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(res.body!!.displayName).isEqualTo("bob")
    }

    @Test
    fun `updateMe updates display name`() {
        val jwt = buildJwt(userId = 9L, email = "carol@test.com", username = "carol")
        val profile = UserProfile(id = 9L, displayName = "Old Name")
        given(profiles.findById(9L)).willReturn(Optional.of(profile))
        given(profiles.save(any<UserProfile>())).willReturn(profile)

        val res = controller.updateMe(jwt, UpdateProfileRequest(displayName = "New Name"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(res.body!!.displayName).isEqualTo("New Name")
    }

    @Test
    fun `updateMe updates avatar url`() {
        val jwt = buildJwt(userId = 10L, email = "dave@test.com", username = "dave")
        val profile = UserProfile(id = 10L, displayName = "Dave")
        given(profiles.findById(10L)).willReturn(Optional.of(profile))
        given(profiles.save(any<UserProfile>())).willReturn(profile)

        val res = controller.updateMe(jwt, UpdateProfileRequest(avatarUrl = "https://example.com/avatar.png"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(res.body!!.avatarUrl).isEqualTo("https://example.com/avatar.png")
    }

    // ── helpers ───────────────────────────────────────────────────────

    private fun buildJwt(userId: Long, email: String = "user@test.com", username: String = "user") =
        Jwt.withTokenValue("tok")
            .header("alg", "RS256")
            .subject(userId.toString())
            .claim(Claims.EMAIL, email)
            .claim(Claims.USERNAME, username)
            .build()
}
