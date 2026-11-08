package com.github.abri02.link.messaging.access

import com.github.abri02.link.messaging.channel.ErrorResponse
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

data class PlanLimitResponse(val message: String, val code: String)

@RestControllerAdvice
class AccessExceptionHandler {

    @ExceptionHandler(ForbiddenException::class)
    fun forbidden(e: ForbiddenException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.FORBIDDEN).body(ErrorResponse(e.message ?: "Forbidden"))

    @ExceptionHandler(NotFoundException::class)
    fun notFound(e: NotFoundException): ResponseEntity<ErrorResponse> =
        ResponseEntity.status(HttpStatus.NOT_FOUND).body(ErrorResponse(e.message ?: "Not found"))

    @ExceptionHandler(PlanLimitException::class)
    fun planLimit(e: PlanLimitException): ResponseEntity<PlanLimitResponse> =
        ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED)
            .body(PlanLimitResponse(e.message ?: "Plan limit reached", e.code))
}
