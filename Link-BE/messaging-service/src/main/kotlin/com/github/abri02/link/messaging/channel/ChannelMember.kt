package com.github.abri02.link.messaging.channel

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "channel_member", schema = "messaging")
class ChannelMember(

    @Column(nullable = false)
    val channelId: Long,

    @Column(nullable = false)
    val userId: Long

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
