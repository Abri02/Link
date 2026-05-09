package com.github.abri02.link.messaging.channel

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

enum class ChannelKind { PUBLIC, PRIVATE, DM }

@Entity
@Table(name = "channel", schema = "messaging")
class Channel(

    @Column(nullable = false)
    val workspaceId: Long,

    @Column(nullable = false, length = 80)
    val name: String,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    val kind: ChannelKind = ChannelKind.PUBLIC,

    @Column(nullable = false)
    val createdBy: Long,

    @Column(nullable = false)
    val createdAt: Instant = Instant.now()

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
