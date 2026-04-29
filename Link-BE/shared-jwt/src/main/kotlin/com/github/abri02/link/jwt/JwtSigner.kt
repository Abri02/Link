package com.github.abri02.link.jwt

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.RSASSASigner
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import java.security.interfaces.RSAPrivateKey
import java.time.Instant
import java.util.Date
import java.util.UUID

class JwtSigner(private val privateKey: RSAPrivateKey) {

    fun sign(
        userId: Long,
        email: String,
        username: String,
        roles: List<String> = listOf("ROLE_USER"),
        ttlSeconds: Long = Claims.ACCESS_TTL_SECONDS
    ): String {
        val now = Instant.now()
        val claims = JWTClaimsSet.Builder()
            .issuer(Claims.ISSUER)
            .subject(userId.toString())
            .claim(Claims.EMAIL, email)
            .claim(Claims.USERNAME, username)
            .claim(Claims.ROLES, roles)
            .issueTime(Date.from(now))
            .expirationTime(Date.from(now.plusSeconds(ttlSeconds)))
            .jwtID(UUID.randomUUID().toString())
            .build()

        return SignedJWT(JWSHeader(JWSAlgorithm.RS256), claims)
            .also { it.sign(RSASSASigner(privateKey)) }
            .serialize()
    }
}
