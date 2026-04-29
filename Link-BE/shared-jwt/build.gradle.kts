plugins {
    kotlin("jvm")
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(24)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    // Nimbus version is managed/upgraded by Spring Boot BOM in consuming services;
    // specified here so the library compiles standalone.
    implementation("com.nimbusds:nimbus-jose-jwt:9.40")
}

kotlin {
    compilerOptions {
        freeCompilerArgs.addAll("-Xjsr305=strict", "-Xannotation-default-target=param-property")
    }
}
