package com.github.abri02.link.files

import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "attachment", schema = "files")
class Attachment(
    val uploaderId: Long,
    val filename: String,
    val mimeType: String,
    val sizeBytes: Long,
    val objectKey: String,
    val createdAt: Instant = Instant.now(),
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
)
