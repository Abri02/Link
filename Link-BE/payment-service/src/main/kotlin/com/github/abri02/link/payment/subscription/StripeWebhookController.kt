package com.github.abri02.link.payment.subscription

import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/** Public endpoint (no JWT): the Stripe signature is what authenticates the request. */
@RestController
@RequestMapping("/payments")
class StripeWebhookController(
    private val stripe: StripeGateway,
    private val webhooks: StripeWebhookService
) {

    private val log = LoggerFactory.getLogger(StripeWebhookController::class.java)

    @PostMapping("/webhook")
    fun webhook(
        @RequestHeader("Stripe-Signature", required = false) signature: String?,
        @RequestBody payload: String
    ): ResponseEntity<*> {
        if (!stripe.webhookConfigured) {
            return error(HttpStatus.SERVICE_UNAVAILABLE, "Payments are not configured")
        }
        val event = signature?.let { stripe.parseWebhook(payload, it) }
            ?: return error(HttpStatus.BAD_REQUEST, "Invalid signature")
        return try {
            webhooks.handle(event)
            ResponseEntity.ok().build<Unit>()
        } catch (e: RuntimeException) {
            log.error("Stripe event {} failed, Stripe will retry", event.id, e)
            error(HttpStatus.INTERNAL_SERVER_ERROR, "Event could not be processed")
        }
    }

    private fun error(status: HttpStatus, message: String) =
        ResponseEntity.status(status).body(ErrorResponse(message))
}
