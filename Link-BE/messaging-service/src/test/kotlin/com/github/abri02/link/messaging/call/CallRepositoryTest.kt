package com.github.abri02.link.messaging.call

import com.github.abri02.link.messaging.support.PostgresIntegrationTest
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.dao.DataIntegrityViolationException
import java.time.Instant

class CallRepositoryTest : PostgresIntegrationTest() {

    @Autowired lateinit var calls: CallRepository

    @Test
    fun `saves a call, finds it by callId and stores endedAt`() {
        val callId = "call-${System.nanoTime()}"
        val call = calls.save(Call(callId, channelId = 7L, callerId = 1L, calleeId = 2L))

        assertThat(calls.existsByCallId(callId)).isTrue()
        assertThat(calls.existsByCallId("missing-$callId")).isFalse()
        assertThat(calls.findByCallId("missing-$callId")).isNull()

        val loaded = calls.findByCallId(callId)!!
        assertThat(loaded.id).isEqualTo(call.id)
        assertThat(loaded.endedAt).isNull()

        loaded.endedAt = Instant.now()
        calls.save(loaded)
        assertThat(calls.findByCallId(callId)!!.endedAt).isNotNull()
    }

    @Test
    fun `callId is unique`() {
        val callId = "dup-${System.nanoTime()}"
        calls.save(Call(callId, channelId = 7L, callerId = 1L, calleeId = 2L))

        assertThatThrownBy { calls.saveAndFlush(Call(callId, channelId = 7L, callerId = 1L, calleeId = 2L)) }
            .isInstanceOf(DataIntegrityViolationException::class.java)
    }
}
