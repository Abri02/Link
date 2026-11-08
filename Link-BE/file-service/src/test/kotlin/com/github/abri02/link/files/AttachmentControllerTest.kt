package com.github.abri02.link.files

import io.minio.GetObjectArgs
import io.minio.GetObjectResponse
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
import org.mockito.kotlin.verifyNoInteractions
import org.springframework.http.HttpStatus
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.oauth2.jwt.Jwt
import okhttp3.Headers
import java.io.ByteArrayInputStream
import java.util.Optional

@ExtendWith(MockitoExtension::class)
class AttachmentControllerTest {

    @Mock private lateinit var minio: MinioClient
    @Mock private lateinit var repo: AttachmentRepository
    @Mock private lateinit var channelAccess: ChannelAccessClient

    private lateinit var controller: AttachmentController

    @BeforeEach
    fun setup() {
        controller = AttachmentController(minio, repo, channelAccess, "link-files")
    }

    // ── upload ────────────────────────────────────────────────────────

    @Test
    fun `upload saves attachment and returns 201`() {
        val file = MockMultipartFile("file", "photo.png", "image/png", ByteArray(100))
        val saved = buildAttachment(id = 1L, filename = "photo.png", mimeType = "image/png", sizeBytes = 100L)
        given(channelAccess.planIfMember(5L, "tok")).willReturn("FREE")
        given(repo.save(any<Attachment>())).willReturn(saved)

        val res = controller.upload(buildJwt(42L), file, 5L)

        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        val body = res.body as AttachmentResponse
        assertThat(body.filename).isEqualTo("photo.png")
        assertThat(body.mimeType).isEqualTo("image/png")
        assertThat(body.sizeBytes).isEqualTo(100L)
        assertThat(body.url).isEqualTo("/attachments/1/content")
    }

    @Test
    fun `upload stores uploader id from jwt`() {
        val file = MockMultipartFile("file", "doc.txt", "text/plain", ByteArray(10))
        val saved = buildAttachment(id = 2L, filename = "doc.txt", mimeType = "text/plain", sizeBytes = 10L)
        given(channelAccess.planIfMember(5L, "tok")).willReturn("FREE")
        given(repo.save(any<Attachment>())).willReturn(saved)

        controller.upload(buildJwt(99L), file, 5L)

        val captor = argumentCaptor<Attachment>()
        verify(repo).save(captor.capture())
        assertThat(captor.firstValue.uploaderId).isEqualTo(99L)
    }

    @Test
    fun `upload uses octet-stream when content type is null`() {
        val file = MockMultipartFile("file", "data.bin", null, ByteArray(50))
        val saved = buildAttachment(id = 3L, filename = "data.bin", mimeType = "application/octet-stream", sizeBytes = 50L)
        given(channelAccess.planIfMember(5L, "tok")).willReturn("FREE")
        given(repo.save(any<Attachment>())).willReturn(saved)

        val res = controller.upload(buildJwt(1L), file, 5L)
        assertThat(res.statusCode).isEqualTo(HttpStatus.CREATED)
        assertThat((res.body as AttachmentResponse).mimeType).isEqualTo("application/octet-stream")
    }

    @Test
    fun `upload generates object key containing file extension`() {
        val file = MockMultipartFile("file", "image.jpg", "image/jpeg", ByteArray(200))
        val saved = buildAttachment(id = 4L, filename = "image.jpg", mimeType = "image/jpeg", sizeBytes = 200L)
        given(channelAccess.planIfMember(5L, "tok")).willReturn("FREE")
        given(repo.save(any<Attachment>())).willReturn(saved)

        controller.upload(buildJwt(1L), file, 5L)

        val captor = argumentCaptor<Attachment>()
        verify(repo).save(captor.capture())
        assertThat(captor.firstValue.objectKey).endsWith(".jpg")
        assertThat(captor.firstValue.objectKey).startsWith("uploads/")
    }

    @Test
    fun `upload stores channel id`() {
        val file = MockMultipartFile("file", "doc.txt", "text/plain", ByteArray(10))
        given(channelAccess.planIfMember(5L, "tok")).willReturn("FREE")
        given(repo.save(any<Attachment>())).willReturn(buildAttachment(id = 5L, filename = "doc.txt", mimeType = "text/plain", sizeBytes = 10L))

        controller.upload(buildJwt(1L), file, 5L)

        val captor = argumentCaptor<Attachment>()
        verify(repo).save(captor.capture())
        assertThat(captor.firstValue.channelId).isEqualTo(5L)
    }

    @Test
    fun `upload returns 403 when caller is not a channel member`() {
        val file = MockMultipartFile("file", "doc.txt", "text/plain", ByteArray(10))
        given(channelAccess.planIfMember(5L, "tok")).willReturn(null)

        val res = controller.upload(buildJwt(1L), file, 5L)

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verifyNoInteractions(minio, repo)
    }

    @Test
    fun `upload over 5 MB returns 402 on the FREE plan and stores nothing`() {
        val file = MockMultipartFile("file", "big.bin", "application/octet-stream", ByteArray(5 * 1024 * 1024 + 1))
        given(channelAccess.planIfMember(5L, "tok")).willReturn("FREE")

        val res = controller.upload(buildJwt(1L), file, 5L)

        assertThat(res.statusCode).isEqualTo(HttpStatus.PAYMENT_REQUIRED)
        assertThat((res.body as PlanLimitResponse).code).isEqualTo("FILE_TOO_LARGE_FOR_PLAN")
        verifyNoInteractions(minio, repo)
    }

    @Test
    fun `upload of exactly 5 MB is allowed on the FREE plan`() {
        val file = MockMultipartFile("file", "ok.bin", "application/octet-stream", ByteArray(5 * 1024 * 1024))
        given(channelAccess.planIfMember(5L, "tok")).willReturn("FREE")
        given(repo.save(any<Attachment>())).willReturn(buildAttachment(6L, "ok.bin", "application/octet-stream", 5L * 1024 * 1024))

        assertThat(controller.upload(buildJwt(1L), file, 5L).statusCode).isEqualTo(HttpStatus.CREATED)
    }

    @Test
    fun `upload over 5 MB is allowed on the PREMIUM plan`() {
        val file = MockMultipartFile("file", "big.bin", "application/octet-stream", ByteArray(5 * 1024 * 1024 + 1))
        given(channelAccess.planIfMember(5L, "tok")).willReturn("PREMIUM")
        given(repo.save(any<Attachment>())).willReturn(buildAttachment(7L, "big.bin", "application/octet-stream", 5L * 1024 * 1024 + 1))

        assertThat(controller.upload(buildJwt(1L), file, 5L).statusCode).isEqualTo(HttpStatus.CREATED)
    }

    @Test
    fun `an unknown plan gets the FREE limit`() {
        val file = MockMultipartFile("file", "big.bin", "application/octet-stream", ByteArray(5 * 1024 * 1024 + 1))
        given(channelAccess.planIfMember(5L, "tok")).willReturn("SOMETHING")

        assertThat(controller.upload(buildJwt(1L), file, 5L).statusCode).isEqualTo(HttpStatus.PAYMENT_REQUIRED)
    }

    // ── download ──────────────────────────────────────────────────────

    @Test
    fun `download returns 403 when caller is not a member of the attachment channel`() {
        given(repo.findById(1L)).willReturn(Optional.of(buildAttachment(1L, "a.png", "image/png", 10L, channelId = 5L)))
        given(channelAccess.isMember(5L, "tok")).willReturn(false)

        val res = controller.download(buildJwt(1L), 1L)

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verifyNoInteractions(minio)
    }

    @Test
    fun `download returns 403 for a legacy attachment without channel`() {
        given(repo.findById(1L)).willReturn(Optional.of(buildAttachment(1L, "a.png", "image/png", 10L, channelId = null)))

        val res = controller.download(buildJwt(1L), 1L)

        assertThat(res.statusCode).isEqualTo(HttpStatus.FORBIDDEN)
        verifyNoInteractions(minio, channelAccess)
    }

    @Test
    fun `download returns content when caller is a channel member`() {
        given(repo.findById(1L)).willReturn(Optional.of(buildAttachment(1L, "a.png", "image/png", 3L, channelId = 5L)))
        given(channelAccess.isMember(5L, "tok")).willReturn(true)
        val response = GetObjectResponse(
            Headers.headersOf(), "link-files", null, "uploads/test", ByteArrayInputStream(byteArrayOf(1, 2, 3))
        )
        given(minio.getObject(any<GetObjectArgs>())).willReturn(response)

        val res = controller.download(buildJwt(1L), 1L)

        assertThat(res.statusCode).isEqualTo(HttpStatus.OK)
        assertThat(res.body).containsExactly(1, 2, 3)
        assertThat(res.headers.contentType.toString()).isEqualTo("image/png")
    }

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

    private fun buildAttachment(
        id: Long, filename: String, mimeType: String, sizeBytes: Long, channelId: Long? = 5L
    ): Attachment {
        val a = Attachment(
            uploaderId = 1L,
            channelId = channelId,
            filename = filename,
            mimeType = mimeType,
            sizeBytes = sizeBytes,
            objectKey = "uploads/test"
        )
        Attachment::class.java.getDeclaredField("id").apply { isAccessible = true }.set(a, id)
        return a
    }
}
