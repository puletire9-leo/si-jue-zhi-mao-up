@echo off
cd /d "%~dp0"
docker run --rm -v "%cd%:/app" -v "%TEMP%\m2:/root/.m2" -w /app maven:3.9-eclipse-temurin-21 mvn clean package -DskipTests -T 4
