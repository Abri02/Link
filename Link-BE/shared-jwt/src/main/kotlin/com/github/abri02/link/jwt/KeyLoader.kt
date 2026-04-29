package com.github.abri02.link.jwt

import java.security.KeyFactory
import java.security.interfaces.RSAPrivateKey
import java.security.interfaces.RSAPublicKey
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import java.util.Base64

object KeyLoader {

    fun privateKey(pem: String = classpathText("/keys/private.pem")): RSAPrivateKey {
        val der = decodePem(pem)
        return KeyFactory.getInstance("RSA")
            .generatePrivate(PKCS8EncodedKeySpec(der)) as RSAPrivateKey
    }

    fun publicKey(pem: String = classpathText("/keys/public.pem")): RSAPublicKey {
        val der = decodePem(pem)
        return KeyFactory.getInstance("RSA")
            .generatePublic(X509EncodedKeySpec(der)) as RSAPublicKey
    }

    private fun decodePem(pem: String): ByteArray =
        Base64.getDecoder().decode(
            pem.lines()
                .filter { !it.startsWith("-----") }
                .joinToString("")
        )

    private fun classpathText(path: String): String =
        KeyLoader::class.java.getResourceAsStream(path)!!.bufferedReader().readText()
}
