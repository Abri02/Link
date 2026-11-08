package com.github.abri02.link.files

import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.multipart.MaxUploadSizeExceededException

/** Above the Premium limit no plan would help, so this is a 413 and not the 402 of a plan limit. */
@RestControllerAdvice
class UploadExceptionHandler {

    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun tooLarge(e: MaxUploadSizeExceededException): ResponseEntity<PlanLimitResponse> =
        ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
            .body(PlanLimitResponse("Files can be at most 20 MB", "FILE_TOO_LARGE"))
}
