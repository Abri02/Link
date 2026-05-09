package com.github.abri02.link.messaging.workspace

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "workspace", schema = "messaging")
class Workspace(

    @Column(nullable = false, length = 100)
    val name: String,

    @Column(nullable = false, length = 100, unique = true)
    val slug: String,

    @Column(nullable = false)
    val ownerId: Long,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now()

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
