FROM maven:3.9.11-eclipse-temurin-17 AS builder
WORKDIR /workspace
COPY pom.xml ./
RUN mvn -B -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -B clean package

FROM eclipse-temurin:17-jre-jammy
ENV STORAGE_ROOT=/data
ENV LIBREOFFICE_EXECUTABLE=soffice
WORKDIR /app
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install --yes --no-install-recommends \
        curl \
        fonts-noto-cjk \
        libreoffice \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 report \
    && useradd --system --uid 1001 --gid report --create-home report \
    && mkdir -p /data/templates /data/previews /data/generated /data/temp \
    && chown -R report:report /data
COPY --from=builder --chown=report:report /workspace/target/ppt-service-0.1.0.jar /app/ppt-service.jar
USER report
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/ppt-service.jar"]

