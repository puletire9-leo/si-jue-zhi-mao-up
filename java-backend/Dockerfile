# ============================================
# Java 微服务多阶段构建（dev / prod 共用）
# 构建: docker build -t sjzm-java-base -f java-backend/Dockerfile .
# ============================================

# ── Stage 1: Maven 编译 ──
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY java-backend/pom.xml ./
COPY java-backend/sjzm-common/pom.xml ./sjzm-common/
COPY java-backend/sjzm-gateway/pom.xml ./sjzm-gateway/
COPY java-backend/sjzm-user/pom.xml ./sjzm-user/
COPY java-backend/sjzm-product/pom.xml ./sjzm-product/

# 先下载依赖（利用 Docker 缓存层）
RUN mvn dependency:go-offline -pl sjzm-common,sjzm-gateway,sjzm-user,sjzm-product -B -q || true

COPY java-backend/ ./
RUN mvn package -DskipTests -B -q

# ── Stage 2: 运行时 ──
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

RUN apk add --no-cache curl tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 从构建阶段复制所有模块的 jar
COPY --from=build /build/sjzm-common/target/*.jar ./lib/
COPY --from=build /build/sjzm-gateway/target/app.jar ./gateway.jar
COPY --from=build /build/sjzm-user/target/app.jar ./user.jar
COPY --from=build /build/sjzm-product/target/app.jar ./product.jar

# 默认启动 Gateway，各服务通过 SERVICE_MODULE 环境变量切换
# 示例: SERVICE_MODULE=gateway | user | product
ENV SERVICE_MODULE=gateway

CMD java -jar /app/${SERVICE_MODULE}.jar
