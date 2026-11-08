package com.github.abri02.link.payment.subscription

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.web.client.RestClient
import java.net.http.HttpClient
import java.time.Duration

/**
 * Tells messaging-service which plan a workspace is on. There is no user JWT on a webhook, so
 * this call authenticates with the shared service token. Failures throw so Stripe retries;
 * a deleted workspace doesn't, because retrying can never succeed.
 */
class WorkspacePlanClient(private val rest: RestClient, private val serviceToken: String) {

    private val log = LoggerFactory.getLogger(WorkspacePlanClient::class.java)

    fun updatePlan(workspaceId: Long, plan: String) {
        rest.patch()
            .uri("/internal/workspaces/{workspaceId}/plan", workspaceId)
            .header(SERVICE_TOKEN_HEADER, serviceToken)
            .contentType(MediaType.APPLICATION_JSON)
            .body(mapOf("plan" to plan))
            .exchange { _, res ->
                when {
                    res.statusCode.is2xxSuccessful -> Unit
                    res.statusCode == HttpStatus.NOT_FOUND ->
                        log.warn("Workspace {} no longer exists, plan not updated", workspaceId)
                    else -> throw IllegalStateException("Plan update failed: ${res.statusCode}")
                }
            }
    }

    private companion object {
        const val SERVICE_TOKEN_HEADER = "X-Internal-Token"
    }
}

@Configuration
class WorkspacePlanClientConfig {
    @Bean
    fun workspacePlanClient(
        @Value("\${messaging.url}") messagingUrl: String,
        @Value("\${link.internal.service-token}") serviceToken: String
    ): WorkspacePlanClient {
        // The call runs inside the webhook's transaction, so it must not hang.
        val httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build()
        val requestFactory = JdkClientHttpRequestFactory(httpClient).apply {
            setReadTimeout(Duration.ofSeconds(5))
        }
        return WorkspacePlanClient(
            RestClient.builder().baseUrl(messagingUrl).requestFactory(requestFactory).build(),
            serviceToken
        )
    }
}
