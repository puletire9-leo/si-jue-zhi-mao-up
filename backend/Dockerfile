# 思觉智贸 - 生产环境
# 继承基础镜像 (Python + 所有依赖)，只加源码和启动命令
FROM sjzm-python-base

COPY . .

EXPOSE 7090

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:7090/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7090"]
