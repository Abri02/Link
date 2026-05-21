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
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.CookieValue
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
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
data class MeResponse(val id: Long, val email: String, val username: String)
data class UserLookupResponse(val id: Long, val username: String, val displayName: String)

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

    @PostMapping("/refresh")
    @Transactional
    fun refresh(
        @CookieValue(name = "LINK_REFRESH", required = false) rawRefresh: String?
    ): ResponseEntity<*> {
        if (rawRefresh == null)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("No refresh token"))

        val hash = sha256(rawRefresh)
        val stored = tokens.findByTokenHash(hash)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("Invalid refresh token"))

        if (stored.revokedAt != null)
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("Refresh token revoked"))
        if (stored.expiresAt.isBefore(Instant.now()))
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("Refresh token expired"))

        val user = users.findById(stored.userId).orElse(null)
            ?: return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(ErrorResponse("User not found"))

        // Revoke the consumed token — each refresh token is single-use (rotation).
        // If an attacker steals a refresh token and uses it first, the real user's
        // next refresh will fail (token already revoked), signalling a possible theft.
        stored.revokedAt = Instant.now()
        tokens.save(stored)

        return ResponseEntity.noContent()
            .headers(mintAndStoreCookies(user))
            .build<Void>()
    }

    @PostMapping("/logout")
    fun logout(
        @CookieValue(name = "LINK_REFRESH", required = false) rawRefresh: String?
    ): ResponseEntity<Void> {
        if (rawRefresh != null) {
            val hash = sha256(rawRefresh)
            tokens.findByTokenHash(hash)?.let { token ->
                if (token.revokedAt == null) {
                    token.revokedAt = Instant.now()
                    tokens.save(token)
                }
            }
        }

        val clearSession = ResponseCookie.from("LINK_SESSION", "")
            .httpOnly(true).secure(false).sameSite("Lax").path("/").maxAge(0).build()
        val clearRefresh = ResponseCookie.from("LINK_REFRESH", "")
            .httpOnly(true).secure(false).sameSite("Strict").path("/api/auth/refresh").maxAge(0).build()

        return ResponseEntity.noContent()
            .header(HttpHeaders.SET_COOKIE, clearSession.toString())
            .header(HttpHeaders.SET_COOKIE, clearRefresh.toString())
            .build()
    }

    @GetMapping("/lookup")
    fun lookup(@RequestParam q: String): ResponseEntity<*> {
        val user = users.findByUsername(q) ?: users.findByEmail(q)
            ?: return ResponseEntity.notFound().build<Void>()
        return ResponseEntity.ok(UserLookupResponse(user.id!!, user.username, user.displayName))
    }

    @GetMapping("/me")
    fun me(@AuthenticationPrincipal jwt: Jwt): ResponseEntity<MeResponse> =
        ResponseEntity.ok(
            MeResponse(
                id = jwt.subject.toLong(),
                email = jwt.getClaim(Claims.EMAIL),
                username = jwt.getClaim(Claims.USERNAME)
            )
        )

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
