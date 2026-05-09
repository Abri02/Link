package com.github.abri02.link.auth.controller

import com.github.abri02.link.auth.token.RefreshTokenRepository
import com.github.abri02.link.auth.user.AuthUser
import com.github.abri02.link.auth.user.AuthUserRepository
import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.jwt.JwtSigner
import com.github.abri02.link.jwt.KeyLoader
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.given
import org.springframework.http.HttpStatus
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt

@ExtendWith(MockitoExtension::class)
class AuthControllerTest {

    @Mock private lateinit var users: AuthUserRepository
    @Mock private lateinit var tokens: RefreshTokenRepository

    private lateinit var controller: AuthController

    @BeforeEach
    fun setup() {
        // Real implementations — private key is on the test classpath from src/main/resources
        controller = AuthController(users, tokens, JwtSigner(KeyLoader.privateKey()), BCryptPasswordEncoder())
    }

    // ── signup validation ──────────────────────────────────────────────

    @Test
    fun `signup with invalid email returns 400`() {
        val res = controller.signup(SignupRequest("not-an-email", "testuser", "SecurePass1!"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        assertThat((res.body as ErrorResponse).message).containsIgnoringCase("email")
    }

    @Test
    fun `signup with username shorter than 3 chars returns 400`() {
        val res = controller.signup(SignupRequest("test@test.com", "ab", "SecurePass1!"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        assertThat((res.body as ErrorResponse).message).containsIgnoringCase("username")
    }

    @Test
    fun `signup with password shorter than 8 chars returns 400`() {
        val res = controller.signup(SignupRequest("test@test.com", "testuser", "short"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.BAD_REQUEST)
        assertThat((res.body as ErrorResponse).message).containsIgnoringCase("password")
    }

    @Test
    fun `signup with duplicate email returns 409`() {
        given(users.findByEmail("dupe@test.com")).willReturn(buildUser(email = "dupe@test.com"))

        val res = controller.signup(SignupRequest("dupe@test.com", "newuser", "SecurePass1!"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.CONFLICT)
        assertThat((res.body as ErrorResponse).message).containsIgnoringCase("email")
    }

    @Test
    fun `signup with duplicate username returns 409`() {
        given(users.findByEmail("new@test.com")).willReturn(null)
        given(users.findByUsername("taken")).willReturn(buildUser(username = "taken"))

        val res = controller.signup(SignupRequest("new@test.com", "taken", "SecurePass1!"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.CONFLICT)
        assertThat((res.body as ErrorResponse).message).containsIgnoringCase("username")
    }

    @Test
    fun `signup with valid data returns 201 and sets cookies`() {
        given(users.findByEmail("new@test.com")).willReturn(null)
        given(users.findByUsername("newuser")).willReturn(null)
        given(users.save(any<AuthUser>())).willReturn(buildUser(id = 1L, email = "new@test.com", username = "newuser"))

        val res = controller.signup(SignupRequest("new@test.com", "newuser", "SecurePass1!"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        assertThat(res.headers["Set-Cookie"]).isNotEmpty()
    }

    // ── login ─────────────────────────────────────────────────────────

    @Test
    fun `login with unknown email returns 401`() {
        given(users.findByEmail("ghost@test.com")).willReturn(null)

        val res = controller.login(LoginRequest("ghost@test.com", "AnyPass1!"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.UNAUTHORIZED)
        assertThat((res.body as ErrorResponse).message).containsIgnoringCase("credentials")
    }

    @Test
    fun `login with wrong password returns 401`() {
        val encoder = BCryptPasswordEncoder()
        val user = buildUser(email = "user@test.com", passwordHash = encoder.encode("CorrectPass1!")!!)
        given(users.findByEmail("user@test.com")).willReturn(user)

        val res = controller.login(LoginRequest("user@test.com", "WrongPass!"))
        assertThat(res.statusCode).isEqualTo(HttpStatus.UNAUTHORIZED)
    }

    // ── me ────────────────────────────────────────────────────────────

    @Test
    fun `me returns id, email and username from JWT claims`() {
        val jwt = Jwt.withTokenValue("tok")
            .header("alg", "RS256")
            .subject("99")
            .claim(Claims.EMAIL, "me@test.com")
            .claim(Claims.USERNAME, "myhandle")
            .build()

        val res = controller.me(jwt)
        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        val body = res.body!!
        assertThat(body.id).isEqualTo(99L)
        assertThat(body.email).isEqualTo("me@test.com")
        assertThat(body.username).isEqualTo("myhandle")
    }

    // ── helpers ───────────────────────────────────────────────────────

    private fun buildUser(
        id: Long = 1L,
        email: String = "user@test.com",
        username: String = "testuser",
        passwordHash: String = "hash"
    ): AuthUser {
        val user = AuthUser(username = username, displayName = username, email = email, passwordHash = passwordHash)
        AuthUser::class.java.getDeclaredField("id").apply { isAccessible = true }.set(user, id)
        return user
    }
}
