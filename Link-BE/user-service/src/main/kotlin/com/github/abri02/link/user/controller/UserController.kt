package com.github.abri02.link.user.controller

import com.github.abri02.link.jwt.Claims
import com.github.abri02.link.user.profile.UserProfile
import com.github.abri02.link.user.profile.UserProfileRepository
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

data class UserProfileResponse(
    val id: Long,
    val email: String,
    val username: String,
    val displayName: String,
    val avatarUrl: String?,
    val status: String?
)

data class UpdateProfileRequest(
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val status: String? = null
)

@RestController
@RequestMapping("/users")
class UserController(private val profiles: UserProfileRepository) {

    @GetMapping("/me")
    @Transactional
    fun me(@AuthenticationPrincipal jwt: Jwt): ResponseEntity<UserProfileResponse> {
        val userId = jwt.subject.toLong()
        val profile = profiles.findById(userId).orElseGet {
            profiles.save(
                UserProfile(
                    id = userId,
                    displayName = jwt.getClaim<String?>(Claims.USERNAME) ?: jwt.getClaim(Claims.EMAIL)
                )
            )
        }
        return ResponseEntity.ok(profile.toResponse(jwt))
    }

    @PatchMapping("/me")
    @Transactional
    fun updateMe(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody req: UpdateProfileRequest
    ): ResponseEntity<UserProfileResponse> {
        val userId = jwt.subject.toLong()
        val profile = profiles.findById(userId).orElseGet {
            profiles.save(
                UserProfile(
                    id = userId,
                    displayName = jwt.getClaim<String?>(Claims.USERNAME) ?: jwt.getClaim(Claims.EMAIL)
                )
            )
        }
        req.displayName?.let { profile.displayName = it }
        req.avatarUrl?.let { profile.avatarUrl = it }
        req.status?.let { profile.status = it }
        profiles.save(profile)
        return ResponseEntity.ok(profile.toResponse(jwt))
    }

    private fun UserProfile.toResponse(jwt: Jwt) = UserProfileResponse(
        id = id,
        email = jwt.getClaim(Claims.EMAIL),
        username = jwt.getClaim(Claims.USERNAME),
        displayName = displayName,
        avatarUrl = avatarUrl,
        status = status
    )
}
