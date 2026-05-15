@echo off
chcp 65001 >nul
set "JAVA_HOME=E:\软件\PyCharm 2025.2.1.1\jbr"
set "PATH=E:\tool\apache-maven-3.9.9\bin;%JAVA_HOME%\bin;%PATH%"
set "MYSQL_DATABASE=sijuelishi_dev"
cd /d "E:\项目\si-jue-zhi-mao-up\java-backend"
call mvn spring-boot:run "-Dspring-boot.run.arguments=--server.port=8090"