# ── 选品分析 Agent Docker 镜像 ──
# 构建: docker build -t selection-agent .
# 运行: docker run -p 8011:8011 --env-file .env selection-agent

FROM python:3.11-slim

WORKDIR /app

# ── 系统依赖（curl 用于健康检查） ──
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# ── Python 依赖（利用 Docker 层缓存） ──
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# ── 应用代码 ──
COPY . .

# ── 非 root 用户（可选，开发环境注释掉避免权限问题） ──
# RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
# USER appuser

EXPOSE 8011

# ── 健康检查 ──
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8011/health || exit 1

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8011"]
