package com.github.abri02.link.auth.token

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "refresh_token", schema = "auth")
class RefreshToken(

    @Column(nullable = false)
    val userId: Long,

    // We never store the raw token — only its SHA-256 hash.
    // If the database leaks, the attacker gets hashes they cannot reverse.
    @Column(nullable = false, unique = true)
    val tokenHash: String,

    @Column(nullable = false)
    val expiresAt: Instant,

    var revokedAt: Instant? = null

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
