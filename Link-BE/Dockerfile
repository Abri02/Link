ARG SERVICE=auth-service

FROM eclipse-temurin:24-jdk-noble AS build
ARG SERVICE
WORKDIR /workspace
COPY . .
RUN chmod +x gradlew && \
    ./gradlew :${SERVICE}:bootJar -x test --no-daemon

FROM eclipse-temurin:24-jre-noble
ARG SERVICE
WORKDIR /app
COPY --from=build /workspace/${SERVICE}/build/libs/ /tmp/libs/
RUN find /tmp/libs -name "*.jar" ! -name "*-plain.jar" -exec cp {} app.jar \; \
    && rm -rf /tmp/libs
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
