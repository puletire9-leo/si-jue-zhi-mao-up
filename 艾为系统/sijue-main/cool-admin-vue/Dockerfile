# syntax=docker/dockerfile:1

FROM node:lts-alpine AS build
WORKDIR /workspace
ARG VITE_NAME=艾为
ENV VITE_NAME=${VITE_NAME}

# 方案一：复制整个仓库上下文，保证容器内构建条件与本地一致
COPY . .

WORKDIR /workspace/cool-admin-vue
RUN npm install --no-audit --no-fund

ENV NODE_OPTIONS=--max-old-space-size=8192
RUN npm run build

FROM nginx:alpine AS runtime
WORKDIR /usr/share/nginx/html

RUN rm -rf ./*
COPY --from=build /workspace/cool-admin-vue/dist /app
COPY --from=build /workspace/cool-admin-vue/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
