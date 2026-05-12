# 系统架构

## 双后端并行架构

```
                        ┌─────────────────────────────────────┐
                        │         Nginx (前端容器内)           │
                        │   路由分流 / 静态托管 / Gzip        │
                        └──────────┬──────────┬───────────────┘
                                   │          │
                    ┌──────────────▼──┐  ┌─────▼──────────────┐
                    │  Java 后端       │  │  Python 后端       │
                    │  Spring Boot     │  │  FastAPI           │
                    │  :8080           │  │  :8000             │
                    │                  │  │                    │
                    │  核心业务:        │  │  AI 功能:          │
                    │  · 产品 CRUD     │  │  · 向量检索(Qdrant) │
                    │  · 选品管理      │  │  · 以图搜图        │
                    │  · 定稿管理      │  │  · 图像识别        │
                    │  · 素材库        │  │  · LLM 视觉        │
                    │  · 运营商库      │  │  · 评分引擎        │
                    │  · 分类/标签     │  │  · 导入导出        │
                    │  · 用户/认证     │  │  · 报表统计        │
                    │  · 图片代理      │  │  · 系统配置        │
                    │  · 高并发控制    │  │  · Celery 任务     │
                    └──────┬───────────┘  └──────┬─────────────┘
                           │                     │
              ┌────────────┼──────────┐  ┌───────┼──────────┐
              │            │          │  │       │          │
         ┌────▼───┐  ┌────▼───┐ ┌───▼──┐ │  ┌───▼───┐ ┌───▼────┐
         │ MySQL  │  │ Redis  │ │Redis │ │  │Qdrant │ │ Celery │
         │ :3306  │  │ :6379  │ │(缓存)│ │  │ :6333 │ │(任务队)│
         └────────┘  └────────┘ └──────┘ │  └───────┘ └────────┘
                                         │
                                    ┌────▼────┐
                                    │ Tencent │
                                    │   COS   │
                                    │ (图片)  │
                                    └─────────┘
```

## 服务清单

| 服务 | 容器名 | 端口 | 说明 |
|------|--------|------|------|
| mysql | sijue-mysql | 3306 | MySQL 8.0 数据库 |
| redis | sijue-redis | 6379 | Redis 7 缓存 + 消息队列 |
| qdrant | sijue-qdrant | 6333 | Qdrant 向量数据库 |
| java-backend | sijue-java-backend | 8080 | Spring Boot 核心业务 |
| backend | sijue-python-backend | 8000 | FastAPI AI 功能 |
| celery-worker | sijue-celery | - | Celery 异步任务 |
| frontend | sijue-frontend | 80 | Vue 3 + Nginx |

## Java 后端高并发能力

| 层级 | 技术 | 说明 |
|------|------|------|
| 容器 | Undertow | IO=4, Worker=200, MaxConn=10000 |
| 缓存 | Caffeine + Redis | 多级缓存（L1 本地 + L2 分布式） |
| 锁 | Redisson | 分布式锁（秒杀、防超卖） |
| 熔断 | Resilience4j | 滑动窗口 100，失败率 50% 触发 |
| 限流 | Guava RateLimiter | 三级：全局 100/s → API 10/s → IP 5/s |
| 异步 | ThreadPool | 三个线程池（业务/图片/导入导出） |
| ID | Snowflake | 分布式雪花 ID 生成 |
| 监控 | Actuator + Prometheus | /actuator/prometheus |

## 数据流

### 核心业务流（Java）
```
前端请求 → Nginx → Java Controller → Service → MyBatis-Plus → MySQL
                                ↓
                          Redis 缓存（命中则直接返回）
```

### AI 功能流（Python）
```
前端请求 → Nginx → FastAPI Router → Service → LLM/COS/Qdrant
                                ↓
                          Celery 异步任务（耗时操作）
```

### 图片代理流
```
前端 <img> → Nginx → Java ImageProxy → COS 公有读（直接URL）
                                ↓
                          本地缩略图缓存（Caffeine）
```

## 环境差异

| 维度 | 开发环境 | 生产环境 |
|------|---------|---------|
| 数据库 | sijuelishi_dev | sijuelishi |
| Java 端口 | 8080（对外） | 8080（对外） |
| Python 端口 | 8001→8000（对外） | 8000（对外） |
| 前端端口 | 5173（Vite HMR） | 80（Nginx） |
| 源码挂载 | ✅ 热重载 | ❌ 构建镜像 |
| 限流 | 关闭 | 开启 |
| 日志级别 | DEBUG | INFO |
| 资源限制 | 无 | Java 4C/4G, Python 2C/4G |
