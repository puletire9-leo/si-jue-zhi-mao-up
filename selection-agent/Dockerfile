FROM python:3.11-slim

WORKDIR /app

# 安装依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple

# 复制代码
COPY . .

# 端口
EXPOSE 8001

# 启动
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8001"]
