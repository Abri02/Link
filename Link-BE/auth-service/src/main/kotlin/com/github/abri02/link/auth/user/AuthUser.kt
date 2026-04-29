package com.github.abri02.link.auth.user

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "auth_user", schema = "auth")
class AuthUser(

    @Column(nullable = false, unique = true, length = 50)
    var username: String,

    @Column(nullable = false, length = 100)
    var displayName: String,

    @Column(nullable = false, unique = true)
    var email: String,

    @Column(nullable = false)
    var passwordHash: String

) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    val id: Long? = null
}
