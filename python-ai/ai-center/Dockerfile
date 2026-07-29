# ── AI 请求中心（集中式 LLM 网关）──
# 构建: docker compose -f docker-compose.dev.yml build ai-center
# 内部访问: http://ai-center:8012（不发布宿主端口）

FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml .
RUN pip install --no-cache-dir -e . -i https://pypi.tuna.tsinghua.edu.cn/simple

COPY app/ ./app/

# 非 root 运行
RUN addgroup --system aiuser && adduser --system --ingroup aiuser aiuser
USER aiuser

EXPOSE 8012

HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=5 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:8012/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8012", "--workers", "1"]
