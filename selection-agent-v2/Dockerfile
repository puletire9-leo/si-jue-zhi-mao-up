# ── 选品 Agent v2 (基于 Hermes 框架) ──
# 构建: docker compose -f docker-compose.dev.yml build selection-agent-v2
# 启动: docker compose -f docker-compose.dev.yml up -d selection-agent-v2
# 交互: docker exec -it selection-agent-v2 python cli.py

FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# 安装全部依赖（源码通过 volume 挂载）
RUN pip install --no-cache-dir \
    openai==2.24.0 \
    python-dotenv==1.2.2 \
    "httpx[socks]==0.28.1" \
    tenacity==9.1.4 \
    pyyaml==6.0.3 \
    "ruamel.yaml==0.18.17" \
    pydantic==2.13.4 \
    requests==2.33.0 \
    rich==14.3.3 \
    "prompt-toolkit==3.0.52" \
    fastapi \
    "uvicorn[standard]" \
    "PyJWT[crypto]==2.12.1" \
    python-multipart \
    pymysql \
    -i https://pypi.tuna.tsinghua.edu.cn/simple

ENV PYTHONPATH=/app
ENV HERMES_HOME=/root/.hermes

RUN mkdir -p /root/.hermes/memory /root/.hermes/sessions /root/.hermes/skills

EXPOSE 8011

# 默认启动 API 服务（品线模型数据 + 健康检查）
# 批量分析通过 docker exec 触发: docker exec selection-agent-v2 python batch_runner.py
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "8011", "--log-level", "info"]
