package com.github.abri02.link.files

import io.minio.MinioClient
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.mockito.Mock
import org.mockito.junit.jupiter.MockitoExtension
import org.mockito.kotlin.any
import org.mockito.kotlin.argumentCaptor
import org.mockito.kotlin.given
import org.mockito.kotlin.verify
import org.springframework.http.HttpStatus
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.oauth2.jwt.Jwt
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class AttachmentControllerTest {

    @Mock private lateinit var minio: MinioClient
    @Mock private lateinit var repo: AttachmentRepository

    private lateinit var controller: AttachmentController

    @BeforeEach
    fun setup() {
        controller = AttachmentController(minio, repo, "link-files")
    }

    // ── upload ────────────────────────────────────────────────────────

    @Test
    fun `upload saves attachment and returns 201`() {
        val file = MockMultipartFile("file", "photo.png", "image/png", ByteArray(100))
        val saved = buildAttachment(id = 1L, filename = "photo.png", mimeType = "image/png", sizeBytes = 100L)
        given(repo.save(any<Attachment>())).willReturn(saved)

        val res = controller.upload(buildJwt(42L), file)

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val body = res.body!!
        assertThat(body.filename).isEqualTo("photo.png")
        assertThat(body.mimeType).isEqualTo("image/png")
        assertThat(body.sizeBytes).isEqualTo(100L)
        assertThat(body.url).isEqualTo("/attachments/1/content")
    }

    @Test
    fun `upload stores uploader id from jwt`() {
        val file = MockMultipartFile("file", "doc.txt", "text/plain", ByteArray(10))
        val saved = buildAttachment(id = 2L, filename = "doc.txt", mimeType = "text/plain", sizeBytes = 10L)
        given(repo.save(any<Attachment>())).willReturn(saved)

        controller.upload(buildJwt(99L), file)

        val captor = argumentCaptor<Attachment>()
        verify(repo).save(captor.capture())
        assertThat(captor.firstValue.uploaderId).isEqualTo(99L)
    }

    @Test
    fun `upload uses octet-stream when content type is null`() {
        val file = MockMultipartFile("file", "data.bin", null, ByteArray(50))
        val saved = buildAttachment(id = 3L, filename = "data.bin", mimeType = "application/octet-stream", sizeBytes = 50L)
        given(repo.save(any<Attachment>())).willReturn(saved)

        val res = controller.upload(buildJwt(1L), file)
        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        assertThat(res.body!!.mimeType).isEqualTo("application/octet-stream")
    }

    @Test
    fun `upload generates object key containing file extension`() {
        val file = MockMultipartFile("file", "image.jpg", "image/jpeg", ByteArray(200))
        val saved = buildAttachment(id = 4L, filename = "image.jpg", mimeType = "image/jpeg", sizeBytes = 200L)
        given(repo.save(any<Attachment>())).willReturn(saved)

        controller.upload(buildJwt(1L), file)

        val captor = argumentCaptor<Attachment>()
        verify(repo).save(captor.capture())
        assertThat(captor.firstValue.objectKey).endsWith(".jpg")
        assertThat(captor.firstValue.objectKey).startsWith("uploads/")
    }

    // ── download ──────────────────────────────────────────────────────

    @Test
    fun `download returns 404 when attachment does not exist`() {
        given(repo.findById(99L)).willReturn(Optional.empty())

        val res = controller.download(buildJwt(1L), 99L)
        assertThat(res.statusCode).isEqualTo(HttpStatus.NOT_FOUND)
    }

    // ── helpers ───────────────────────────────────────────────────────

    private fun buildJwt(userId: Long) = Jwt.withTokenValue("tok")
        .header("alg", "RS256")
        .subject(userId.toString())
        .build()

    private fun buildAttachment(id: Long, filename: String, mimeType: String, sizeBytes: Long): Attachment {
        val a = Attachment(
            uploaderId = 1L,
            filename = filename,
            mimeType = mimeType,
            sizeBytes = sizeBytes,
            objectKey = "uploads/test"
        )
        Attachment::class.java.getDeclaredField("id").apply { isAccessible = true }.set(a, id)
        return a
    }
}
