package com.github.abri02.link.jwt

import com.nimbusds.jose.crypto.RSASSAVerifier
import com.nimbusds.jwt.SignedJWT
import java.security.interfaces.RSAPublicKey
import java.util.Date

class JwtVerifier(private val publicKey: RSAPublicKey) {

    fun verify(token: String): Boolean = try {
        val signed = SignedJWT.parse(token)
        signed.verify(RSASSAVerifier(publicKey)) &&
            signed.jwtClaimsSet.expirationTime.after(Date())
    } catch (e: Exception) {
        false
    }
}
