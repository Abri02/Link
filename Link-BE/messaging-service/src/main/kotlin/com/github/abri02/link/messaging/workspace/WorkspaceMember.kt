package com.github.abri02.link.messaging.workspace

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

enum class WorkspaceRole { OWNER, ADMIN, MEMBER, GUEST }

@Entity
@Table(name = "workspace_member", schema = "messaging")
class WorkspaceMember(

    @Column(nullable = false)
    val workspaceId: Long,

    @Column(nullable = false)
    val userId: Long,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var role: WorkspaceRole

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
