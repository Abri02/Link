package com.github.abri02.link.files

import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpHeaders
import org.springframework.web.client.RestClient

/**
 * Asks messaging-service whether the caller is a member of a channel. The caller's own JWT is
 * forwarded, so messaging-service decides with its normal auth and no service token is needed.
 */
class ChannelAccessClient(private val rest: RestClient) {

    fun isMember(channelId: Long, bearerToken: String): Boolean =
        rest.get()
            .uri("/channels/{channelId}/membership", channelId)
            .header(HttpHeaders.AUTHORIZATION, "Bearer $bearerToken")
            .exchange { _, res -> res.statusCode.is2xxSuccessful }

    /** The plan of the channel's workspace, or null if the caller isn't a member of the channel. */
    fun planIfMember(channelId: Long, bearerToken: String): String? =
        rest.get()
            .uri("/channels/{channelId}/membership", channelId)
            .header(HttpHeaders.AUTHORIZATION, "Bearer $bearerToken")
            .exchange<String?> { _, res ->
                if (res.statusCode.is2xxSuccessful) res.bodyTo(Map::class.java)?.get("plan") as? String ?: "FREE"
                else null
            }
}

@Configuration
class ChannelAccessConfig {
    @Bean
    fun channelAccessClient(@Value("\${messaging.url}") messagingUrl: String) =
        ChannelAccessClient(RestClient.create(messagingUrl))
}
