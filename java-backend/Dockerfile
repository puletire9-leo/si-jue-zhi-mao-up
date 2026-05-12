# Docker 多阶段构建优化配置 - 更新: 2026-05-11

# 第一阶段：构建
FROM maven:3.9-eclipse-temurin-17 AS builder

# 安装 unzip 用于处理 JAR 文件
RUN apt-get update && apt-get install -y unzip && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 清理 Maven 缓存
RUN rm -rf ~/.m2/repository/org/projectlombok

# 复制 pom.xml 先下载依赖（利用缓存）
COPY pom.xml .
RUN mvn dependency:go-offline -B -U || true

# 复制源码并构建
COPY src ./src
COPY jvm-config ./jvm-config
RUN mvn clean package -DskipTests -B -U \
    && mv target/app.jar /app/app.jar

# 第二阶段：运行
FROM eclipse-temurin:17-jre-alpine

# 使用阿里云镜像源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 安装必要的工具
RUN apk add --no-cache curl tzdata

# 设置时区
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# 创建应用目录
RUN mkdir -p /app/logs /app/config /app/ext-lib

WORKDIR /app

# 从构建阶段复制 JAR
COPY --from=builder /app/app.jar ./app.jar
COPY --from=builder /app/jvm-config ./jvm-config

# 设置 JVM 参数
ENV JAVA_OPTS="-Xms2g -Xmx2g -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/app/logs/heapdump.hprof -Xlog:gc*:file=/app/logs/gc-%t.log:time,uptime,level -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8080/actuator/health || exit 1

# 暴露端口
EXPOSE 8080

# 使用 exec form 确保信号正确传递
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar"]
