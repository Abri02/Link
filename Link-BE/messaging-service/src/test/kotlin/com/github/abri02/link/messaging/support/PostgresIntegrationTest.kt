package com.github.abri02.link.messaging.support

import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.postgresql.PostgreSQLContainer

/**
 * Base class for tests that need a real PostgreSQL database (repository queries, JPQL, native SQL).
 *
 * One container is started per test JVM and shared by every subclass, so the Spring context
 * cache keeps working. Hibernate builds the schema with `create` (Flyway is off, see A7); the container is thrown away afterwards, so nothing needs dropping.
 * Docker must be running.
 */
@SpringBootTest
abstract class PostgresIntegrationTest {

    companion object {
        private val postgres = PostgreSQLContainer("postgres:16-alpine").apply { start() }

        @JvmStatic
        @DynamicPropertySource
        fun datasourceProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
            registry.add("spring.jpa.hibernate.ddl-auto") { "create" }
            registry.add("spring.jpa.properties.hibernate.hbm2ddl.create_namespaces") { "true" }
        }
    }
}
