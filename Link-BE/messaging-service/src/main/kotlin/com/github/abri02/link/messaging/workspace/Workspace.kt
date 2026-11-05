package com.github.abri02.link.messaging.workspace

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import org.hibernate.annotations.ColumnDefault
import java.time.Instant

/** Subscription plan of a workspace. The owner pays, every member gets the plan (see README §3.7). */
enum class WorkspacePlan { FREE, PREMIUM }

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
    val createdAt: Instant = Instant.now(),

    // DB default so ddl-auto=update can add the NOT NULL column to existing rows.
    @Enumerated(EnumType.STRING)
    @ColumnDefault("'FREE'")
    @Column(nullable = false, length = 20)
    var plan: WorkspacePlan = WorkspacePlan.FREE

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
