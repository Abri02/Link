package com.github.abri02.link.auth.user

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.stereotype.Repository

@Repository
interface AuthUserRepository : JpaRepository<AuthUser, Long> {
    fun findByEmail(email: String): AuthUser?
    fun findByUsername(username: String): AuthUser?
}
