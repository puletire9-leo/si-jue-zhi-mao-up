# syntax=docker/dockerfile:1

FROM node:lts-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:lts-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache tzdata

ENV NODE_ENV=production
ENV TZ=Asia/Shanghai

# 为了避免 Midway 运行时路径差异导致缺文件，保留完整项目内容
COPY --from=build /app /app

EXPOSE 8001
CMD ["npm", "run", "start"]
