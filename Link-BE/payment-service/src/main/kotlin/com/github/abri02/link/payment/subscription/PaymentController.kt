package com.github.abri02.link.payment.subscription

import com.github.abri02.link.payment.access.WorkspaceAccessClient
import com.github.abri02.link.payment.access.WorkspaceMembership
import com.stripe.exception.StripeException
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

data class ErrorResponse(val message: String)
data class BillingSessionRequest(val workspaceId: Long)
data class BillingSessionResponse(val url: String)
data class SubscriptionResponse(
    val workspaceId: Long,
    val plan: String,
    val status: String?,
    val currentPeriodEnd: Instant?
)

/** Stripe statuses where a subscription still exists, so a new Checkout would double-bill. */
private val OPEN_STATUSES = PREMIUM_STATUSES + setOf("past_due", "unpaid")

@RestController
@RequestMapping("/payments")
class PaymentController(
    private val subscriptions: SubscriptionRepository,
    private val access: WorkspaceAccessClient,
    private val stripe: StripeGateway
) {

    private val log = LoggerFactory.getLogger(PaymentController::class.java)

    @PostMapping("/checkout-session")
    fun checkoutSession(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody req: BillingSessionRequest
    ): ResponseEntity<*> {
        ownerError(req.workspaceId, jwt)?.let { return it }
        if (!stripe.configured) return notConfigured()

        val existing = subscriptions.findById(req.workspaceId).orElse(null)
        if (existing != null && existing.status in OPEN_STATUSES) {
            return error(HttpStatus.CONFLICT, "This workspace already has a subscription")
        }
        return stripeCall { stripe.createCheckoutUrl(req.workspaceId, existing?.stripeCustomerId) }
    }

    @PostMapping("/portal-session")
    fun portalSession(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody req: BillingSessionRequest
    ): ResponseEntity<*> {
        ownerError(req.workspaceId, jwt)?.let { return it }
        if (!stripe.configured) return notConfigured()

        val customerId = subscriptions.findById(req.workspaceId).orElse(null)?.stripeCustomerId
            ?: return error(HttpStatus.NOT_FOUND, "This workspace has no billing account")
        return stripeCall { stripe.createPortalUrl(customerId) }
    }

    @GetMapping("/subscription")
    fun subscription(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestParam workspaceId: Long
    ): ResponseEntity<*> {
        when (access.membership(workspaceId, jwt.tokenValue)) {
            WorkspaceMembership.NoWorkspace -> return error(HttpStatus.NOT_FOUND, "Workspace not found")
            WorkspaceMembership.NotMember -> return error(HttpStatus.FORBIDDEN, "Not a member of this workspace")
            is WorkspaceMembership.Member -> Unit
        }
        val current = subscriptions.findById(workspaceId).orElse(null)
        return ResponseEntity.ok(
            SubscriptionResponse(workspaceId, current?.plan ?: "FREE", current?.status, current?.currentPeriodEnd)
        )
    }

    /** The error response when the caller isn't the workspace OWNER, or null when they are. */
    private fun ownerError(workspaceId: Long, jwt: Jwt): ResponseEntity<ErrorResponse>? =
        when (val membership = access.membership(workspaceId, jwt.tokenValue)) {
            WorkspaceMembership.NoWorkspace -> error(HttpStatus.NOT_FOUND, "Workspace not found")
            WorkspaceMembership.NotMember -> error(HttpStatus.FORBIDDEN, "Not a member of this workspace")
            is WorkspaceMembership.Member ->
                if (membership.role == "OWNER") null
                else error(HttpStatus.FORBIDDEN, "Only the workspace owner can manage billing")
        }

    private fun stripeCall(createUrl: () -> String): ResponseEntity<*> =
        try {
            ResponseEntity.ok(BillingSessionResponse(createUrl()))
        } catch (e: StripeException) {
            log.error("Stripe request failed: {}", e.message)
            error(HttpStatus.BAD_GATEWAY, "The payment provider request failed")
        }

    private fun notConfigured() = error(HttpStatus.SERVICE_UNAVAILABLE, "Payments are not configured")

    private fun error(status: HttpStatus, message: String) =
        ResponseEntity.status(status).body(ErrorResponse(message))
}
