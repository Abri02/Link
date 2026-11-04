package com.github.abri02.link.messaging.call

import com.github.abri02.link.messaging.channel.ChannelKind
import com.github.abri02.link.messaging.channel.ChannelMemberRepository
import com.github.abri02.link.messaging.channel.ChannelRepository
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Controller
import org.springframework.transaction.annotation.Transactional
import java.security.Principal
import java.time.Instant

enum class CallSignalType { INVITE, ACCEPT, REJECT, HANGUP, OFFER, ANSWER, ICE }

/**
 * A WebRTC signaling frame. The client SENDs it to `/app/call.signal`; the recipient receives it on
 * `/user/queue/call`. `fromUserId` is ignored on input and set from the caller's token.
 * `payload` carries the SDP (`OFFER`/`ANSWER`) or ICE candidate (`ICE`) as-is.
 */
data class CallSignal(
    val type: CallSignalType,
    val callId: String,
    val toUserId: Long,
    val channelId: Long,
    val fromUserId: Long? = null,
    val payload: Map<String, Any?>? = null
)

/**
 * Relays WebRTC signaling between the two members of a 1-on-1 DM. Anyone in the DM (guests
 * included) can call the other member. Invalid frames are dropped silently, as there is no reply
 * channel for a fire-and-forget SEND.
 */
@Controller
class CallSignalController(
    private val channels: ChannelRepository,
    private val channelMembers: ChannelMemberRepository,
    private val calls: CallRepository,
    private val broker: SimpMessagingTemplate
) {

    companion object {
        const val MAX_CALL_ID_LENGTH = 64
    }

    // Non-null Principal on purpose, see TypingController.
    @MessageMapping("/call.signal")
    @Transactional
    fun signal(signal: CallSignal, principal: Principal) {
        val fromUserId = (principal as? JwtAuthenticationToken)?.token?.subject?.toLongOrNull() ?: return
        if (signal.callId.isBlank() || signal.callId.length > MAX_CALL_ID_LENGTH) return
        if (signal.toUserId == fromUserId) return

        val channel = channels.findById(signal.channelId).orElse(null) ?: return
        if (channel.kind != ChannelKind.DM) return
        if (!channelMembers.existsByChannelIdAndUserId(channel.id!!, fromUserId)) return
        if (!channelMembers.existsByChannelIdAndUserId(channel.id, signal.toUserId)) return

        record(signal, fromUserId)

        broker.convertAndSendToUser(
            signal.toUserId.toString(),
            "/queue/call",
            signal.copy(fromUserId = fromUserId)
        )
    }

    /** The callee's ACCEPT starts the call record; either side's HANGUP ends it. */
    private fun record(signal: CallSignal, fromUserId: Long) {
        when (signal.type) {
            CallSignalType.ACCEPT -> {
                if (calls.existsByCallId(signal.callId)) return
                calls.save(
                    Call(
                        callId = signal.callId,
                        channelId = signal.channelId,
                        callerId = signal.toUserId,
                        calleeId = fromUserId
                    )
                )
            }
            CallSignalType.HANGUP -> {
                val call = calls.findByCallId(signal.callId) ?: return
                if (call.channelId != signal.channelId || call.endedAt != null) return
                if (fromUserId != call.callerId && fromUserId != call.calleeId) return
                call.endedAt = Instant.now()
                calls.save(call)
            }
            else -> {}
        }
    }
}
