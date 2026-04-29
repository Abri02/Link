plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "Link"

include("shared-jwt", "auth-service", "user-service", "messaging-service", "gateway")
