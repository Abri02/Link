package com.github.abri02.link.messaging.presence

import com.github.abri02.link.messaging.config.StompAuthChannelInterceptor
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/presence")
class PresenceController(private val interceptor: StompAuthChannelInterceptor) {

    @GetMapping("/online")
    fun onlineUserIds(): Set<Long> =
        interceptor.sessionStore.values.map { it.first }.toSet()
}
