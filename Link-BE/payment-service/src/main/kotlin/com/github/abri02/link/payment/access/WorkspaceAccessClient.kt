package com.github.abri02.link.payment.access

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.web.client.RestClient

sealed interface WorkspaceMembership {
    data class Member(val role: String) : WorkspaceMembership
    data object NotMember : WorkspaceMembership
    data object NoWorkspace : WorkspaceMembership
}

private data class MembershipBody(val role: String)

/**
 * Asks messaging-service for the caller's role in a workspace. The caller's own JWT is
 * forwarded, so messaging-service decides with its normal auth and no service token is needed.
 * Any other response throws, so billing is refused when the role can't be determined.
 */
class WorkspaceAccessClient(private val rest: RestClient) {

    fun membership(workspaceId: Long, bearerToken: String): WorkspaceMembership =
        rest.get()
            .uri("/workspaces/{workspaceId}/membership", workspaceId)
            .header(HttpHeaders.AUTHORIZATION, "Bearer $bearerToken")
            .exchange { _, res ->
                when {
                    res.statusCode.is2xxSuccessful ->
                        WorkspaceMembership.Member(res.bodyTo(MembershipBody::class.java)!!.role)
                    res.statusCode == HttpStatus.FORBIDDEN -> WorkspaceMembership.NotMember
                    res.statusCode == HttpStatus.NOT_FOUND -> WorkspaceMembership.NoWorkspace
                    else -> throw IllegalStateException("Membership lookup failed: ${res.statusCode}")
                }
            }
}

@Configuration
class WorkspaceAccessConfig {
    @Bean
    fun workspaceAccessClient(@Value("\${messaging.url}") messagingUrl: String) =
        WorkspaceAccessClient(RestClient.create(messagingUrl))
}
