package com.github.abri02.link.jwt

object Claims {
    const val EMAIL = "email"
    const val USERNAME = "username"
    const val ROLES = "roles"

    const val ISSUER = "link"
    const val ACCESS_TTL_SECONDS = 900L   // 15 min
    const val REFRESH_TTL_SECONDS = 604800L  // 7 days
}
