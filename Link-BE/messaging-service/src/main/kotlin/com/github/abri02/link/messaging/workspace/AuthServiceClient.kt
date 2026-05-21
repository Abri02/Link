package com.github.abri02.link.messaging.workspace

import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Component
import org.springframework.web.client.HttpClientErrorException
import org.springframework.web.client.RestClient

data class UserLookupResult(val id: Long, val username: String, val displayName: String)

@Component
class AuthServiceClient(@Value("\${auth-service.url}") baseUrl: String) {
    private val restClient = RestClient.create(baseUrl)

    fun lookup(identifier: String, authorization: String): UserLookupResult? =
        try {
            restClient.get()
                .uri("/auth/lookup?q={q}", identifier)
                .header(HttpHeaders.AUTHORIZATION, authorization)
                .retrieve()
                .body(UserLookupResult::class.java)
        } catch (_: HttpClientErrorException.NotFound) {
            null
        }
}
