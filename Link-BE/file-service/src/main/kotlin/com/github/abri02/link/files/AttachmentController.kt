package com.github.abri02.link.files

import io.minio.GetObjectArgs
import io.minio.MinioClient
import io.minio.PutObjectArgs
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

data class AttachmentResponse(
    val id: Long,
    val filename: String,
    val mimeType: String,
    val sizeBytes: Long,
    val url: String
)

data class PlanLimitResponse(val message: String, val code: String)

private const val MB = 1024L * 1024L
private const val FREE_MAX_FILE_BYTES = 5 * MB
// Matches spring.servlet.multipart.max-file-size, which rejects anything larger before this code runs.
private const val PREMIUM_MAX_FILE_BYTES = 20 * MB

@RestController
@RequestMapping("/attachments")
class AttachmentController(
    private val minio: MinioClient,
    private val repo: AttachmentRepository,
    private val channelAccess: ChannelAccessClient,
    @Value("\${minio.bucket}") private val bucket: String
) {

    @PostMapping(consumes = ["multipart/form-data"])
    fun upload(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestParam("file") file: MultipartFile,
        @RequestParam("channelId") channelId: Long
    ): ResponseEntity<*> {
        val userId = jwt.subject.toLong()

        val plan = channelAccess.planIfMember(channelId, jwt.tokenValue)
            ?: return ResponseEntity.status(HttpStatus.FORBIDDEN).build<Unit>()

        val maxBytes = if (plan == "PREMIUM") PREMIUM_MAX_FILE_BYTES else FREE_MAX_FILE_BYTES
        if (file.size > maxBytes)
            return ResponseEntity.status(HttpStatus.PAYMENT_REQUIRED).body(
                PlanLimitResponse("This workspace's plan allows files up to ${maxBytes / MB} MB", "FILE_TOO_LARGE_FOR_PLAN")
            )

        val ext = file.originalFilename?.substringAfterLast('.', "")?.let { if (it.isNotBlank()) ".$it" else "" } ?: ""
        val objectKey = "uploads/${UUID.randomUUID()}$ext"

        file.inputStream.use { stream ->
            minio.putObject(
                PutObjectArgs.builder()
                    .bucket(bucket)
                    .`object`(objectKey)
                    .stream(stream, file.size, -1)
                    .contentType(file.contentType ?: "application/octet-stream")
                    .build()
            )
        }

        val attachment = repo.save(
            Attachment(
                uploaderId = userId,
                channelId = channelId,
                filename = file.originalFilename ?: "file",
                mimeType = file.contentType ?: "application/octet-stream",
                sizeBytes = file.size,
                objectKey = objectKey
            )
        )

        return ResponseEntity.status(HttpStatus.CREATED).body(attachment.toResponse())
    }

    @GetMapping("/{id}/content")
    fun download(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: Long
    ): ResponseEntity<ByteArray> {
        val attachment = repo.findById(id).orElse(null)
            ?: return ResponseEntity.notFound().build()

        val channelId = attachment.channelId
        if (channelId == null || !channelAccess.isMember(channelId, jwt.tokenValue))
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build()

        val bytes = minio.getObject(
            GetObjectArgs.builder().bucket(bucket).`object`(attachment.objectKey).build()
        ).use { it.readBytes() }

        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"${attachment.filename}\"")
            .contentType(MediaType.parseMediaType(attachment.mimeType))
            .body(bytes)
    }

    private fun Attachment.toResponse() = AttachmentResponse(
        id = id!!,
        filename = filename,
        mimeType = mimeType,
        sizeBytes = sizeBytes,
        url = "/attachments/$id/content"
    )
}
