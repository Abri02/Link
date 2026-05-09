package com.github.abri02.link.user.profile

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "user_profile", schema = "users")
class UserProfile(

    @Id
    val id: Long,

    @Column(nullable = false, length = 100)
    var displayName: String,

    @Column
    var avatarUrl: String? = null,

    @Column(length = 50)
    var status: String? = null
)
