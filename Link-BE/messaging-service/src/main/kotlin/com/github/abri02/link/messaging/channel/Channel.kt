package com.github.abri02.link.messaging.channel

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.UniqueConstraint
import java.time.Instant

enum class ChannelKind { PUBLIC, PRIVATE, DM, GROUP_DM }

@Entity
@Table(
    name = "channel",
    schema = "messaging",
    uniqueConstraints = [UniqueConstraint(columnNames = ["workspace_id", "member_key"])]
)
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
    val createdAt: Instant = Instant.now(),

    /** Display name of a group DM. Null means the FE shows the member names. */
    @Column(length = 80)
    var title: String? = null,

    /**
     * Sorted, comma-separated member ids of a DM or group DM, used to find an existing conversation
     * for the same people. Null for channels, and for a conversation whose member set clashed with
     * another conversation after someone joined or left.
     */
    @Column(length = 400)
    var memberKey: String? = null

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
