@echo off
cd /d "%~dp0"
call "D:\tools\apache-maven-3.9.9\bin\mvn.cmd" clean compile "-Dmaven.javadoc.skip=true"
