package com.github.abri02.link.payment.subscription

import com.github.abri02.link.payment.support.PostgresIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired

class ProcessedEventRepositoryTest : PostgresIntegrationTest() {

    @Autowired
    lateinit var processedEvents: ProcessedEventRepository

    @Test
    fun `claim returns 1 for a new event and 0 for a repeated one`() {
        assertThat(processedEvents.claim("evt_claim")).isEqualTo(1)
        assertThat(processedEvents.claim("evt_claim")).isEqualTo(0)
        assertThat(processedEvents.claim("evt_other")).isEqualTo(1)
    }
}
