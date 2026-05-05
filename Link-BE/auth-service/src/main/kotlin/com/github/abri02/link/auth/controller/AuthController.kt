package com.github.abri02.link.auth.controller

import com.github.abri02.link.auth.token.RefreshToken
import com.github.abri02.link.auth.token.RefreshTokenRepository
import com.github.abri02.link.auth.user.AuthUser
import com.github.abri02.link.auth.user.AuthUserRepository
import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.jwt.JwtSigner
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseCookie
import org.springframework.http.ResponseEntity
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.security.MessageDigest
import java.time.Instant
import java.util.Base64
import java.util.UUID

// ---------- request / response shapes ----------

data class SignupRequest(
    val email: String,
    val username: String,
    val password: String,
    val displayName: String? = null
)

data class LoginRequest(
    val email: String,
    val password: String
)

data class ErrorResponse(val message: String)

// ---------- controller ----------

@RestController
@RequestMapping("/auth")
class AuthController(
    private val users: AuthUserRepository,
    private val tokens: RefreshTokenRepository,
    private val jwtSigner: JwtSigner,
    private val passwordEncoder: PasswordEncoder
) {

    @PostMapping("/signup")
    fun signup(@RequestBody req: SignupRequest): ResponseEntity<*> {
        // Basic input validation
        if (req.email.isBlank() || !req.email.contains("@"))
            return ResponseEntity.badRequest().body(ErrorResponse("Invalid email address"))
        if (req.username.isBlank() || req.username.length < 3 || req.username.length > 50)
            return ResponseEntity.badRequest().body(ErrorResponse("Username must be 3–50 characters"))
        if (req.password.length < 8)
            return ResponseEntity.badRequest().body(ErrorResponse("Password must be at least 8 characters"))

        // Uniqueness checks — return 409 Conflict so the frontend can show a specific message
        if (users.findByEmail(req.email) != null)
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse("Email is already registered"))
        if (users.findByUsername(req.username) != null)
            return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse("Username is already taken"))

        val user = users.save(
            AuthUser(
                email = req.email,
                username = req.username,
                displayName = req.displayName ?: req.username,
                passwordHash = passwordEncoder.encode(req.password)!!
            )
        )

        return ResponseEntity.status(HttpStatus.CREATED)
            .headers(mintAndStoreCookies(user))
            .build<Void>()
    }

    @PostMapping("/login")
    fun login(@RequestBody req: LoginRequest): ResponseEntity<*> {
        val user = users.findByEmail(req.email)
            // Return the same message whether the email is wrong or the password is wrong.
            // A different message ("email not found" vs "wrong password") would let an
            // attacker enumerate which emails are registered.
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("Invalid credentials"))

        if (!passwordEncoder.matches(req.password, user.passwordHash))
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("Invalid credentials"))

        return ResponseEntity.noContent()
            .headers(mintAndStoreCookies(user))
            .build<Void>()
    }

    // ----- helpers -----

    private fun mintAndStoreCookies(user: AuthUser): HttpHeaders {
        val jwt = jwtSigner.sign(
            userId = user.id!!,
            email = user.email,
            username = user.username
        )

        // Generate a random opaque string as the refresh token value.
        // UUID gives 122 bits of entropy — plenty for an unguessable token.
        val rawRefresh = UUID.randomUUID().toString()

        // Store only the hash so a DB dump cannot be used to steal sessions.
        tokens.save(
            RefreshToken(
                userId = user.id,
                tokenHash = sha256(rawRefresh),
                expiresAt = Instant.now().plusSeconds(Claims.REFRESH_TTL_SECONDS)
            )
        )

        // LINK_SESSION: carries the JWT; sent on every request to every path.
        val sessionCookie = ResponseCookie.from("LINK_SESSION", jwt)
            .httpOnly(true)   // JavaScript cannot read this cookie
            .secure(false)    // set to true in production (requires HTTPS)
            .sameSite("Lax")  // sent on same-site requests + top-level navigations
            .path("/")
            .maxAge(Claims.ACCESS_TTL_SECONDS)
            .build()

        // LINK_REFRESH: long-lived; browser only sends it to the refresh endpoint.
        val refreshCookie = ResponseCookie.from("LINK_REFRESH", rawRefresh)
            .httpOnly(true)
            .secure(false)
            .sameSite("Strict") // never sent on cross-site requests (stricter than Lax)
            .path("/api/auth/refresh")
            .maxAge(Claims.REFRESH_TTL_SECONDS)
            .build()

        return HttpHeaders().apply {
            add(HttpHeaders.SET_COOKIE, sessionCookie.toString())
            add(HttpHeaders.SET_COOKIE, refreshCookie.toString())
        }
    }

    private fun sha256(input: String): String =
        Base64.getEncoder().encodeToString(
            MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        )
}
