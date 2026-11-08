package com.github.abri02.link.messaging.support

import com.github.abri02.link.messaging.access.AccessExceptionHandler
import com.github.abri02.link.messaging.access.ForbiddenException
import com.github.abri02.link.messaging.access.NotFoundException
import com.github.abri02.link.messaging.access.PlanLimitException
import org.springframework.http.ResponseEntity

private val handler = AccessExceptionHandler()

/**
 * Calls a controller method the way Spring MVC would: access exceptions thrown by
 * `WorkspaceAccess` are mapped to a response by [AccessExceptionHandler].
 */
fun respond(call: () -> ResponseEntity<*>): ResponseEntity<*> =
    try {
        call()
    } catch (e: ForbiddenException) {
        handler.forbidden(e)
    } catch (e: NotFoundException) {
        handler.notFound(e)
    } catch (e: PlanLimitException) {
        handler.planLimit(e)
    }
