# nginx 路由规则问题记录

**日期**: 2026-06-04
**严重程度**: 高（定稿页面 500、图片加载失败）
**影响范围**: `/api/v1/final-drafts`、`/api/v1/image-proxy`

---

## 问题

生产环境 nginx 将 Python 后端接口错误地路由到了 Java gateway，导致：

1. **`/api/v1/final-drafts`** → 500（Java 返回 `NoResourceFoundException: No static resource api/v1/final-drafts`）
2. **`/api/v1/image-proxy`** → 401（gateway JWT 验证失败，浏览器加载图片不带 token）

---

## 根因

`nginx.prod.conf` 中的正则 location 把所有 Java API 路径合并为一个正则，但误将 Python 后端的接口也加入了：

```nginx
# 错误：包含了 final-drafts 和 image-proxy
location ~ ^/api/v1/(auth|users|...|final-drafts|...|image-proxy)(/.*)?$ {
    proxy_pass http://prod-gateway:9000;
}
```

- `final-drafts` 是 Python FastAPI 接口（`backend/app/api/v1/final_drafts.py`）
- `image-proxy` 是 Python 接口（`backend/app/api/v1/image_proxy.py`），且 `/proxy` 端点不需要认证

---

## 修复

从 nginx 正则中移除 `final-drafts` 和 `image-proxy`，让它们走 `/api/v1/` catch-all → `prod-backend:7090`：

```nginx
# 修正后：只包含 Java 微服务路径
location ~ ^/api/v1/(auth|users|filter-config|filter-presets|scoring|asin-import|competitor|click-logs|sellersprite-config|deng-zong-shop|modules|products|selections|product-sales|materials|carriers|images)(/.*)?$ {
    proxy_pass http://prod-gateway:9000;
}
```

---

## 路由分类速查

| 接口路径 | 后端 | 路由 |
|---------|------|------|
| `/api/v1/auth/**` | Java (user) | → gateway |
| `/api/v1/users/**` | Java (user) | → gateway |
| `/api/v1/competitor/**` | Java (product) | → gateway |
| `/api/v1/modules/**` | Java (product) | → gateway |
| `/api/v1/products/**` | Java (product) | → gateway |
| `/api/v1/selections/**` | Java (product) | → gateway |
| `/api/v1/final-drafts/**` | Python | → backend |
| `/api/v1/image-proxy/**` | Python | → backend |
| `/api/v1/selection/**` | Python | → backend |
| `/api/v1/material-library/**` | Python | → backend |
| `/api/v1/logs/**` | Python | → backend |
| `/api/v1/system-config/**` | Python | → backend |

---

## 教训

1. **新增 API 路径时，必须确认属于 Java 还是 Python**，再决定放入 gateway 正则还是走 catch-all
2. **不需要认证的接口（如 image-proxy）不能走 gateway**，gateway 会强制验证 JWT
3. **修改 nginx 后用 `docker exec prod-frontend nginx -s reload` 热重载**，不需要重启容器

---

## 涉及文件

| 文件 | 修改内容 |
|------|----------|
| `frontend/nginx.prod.conf` | 从正则中移除 `final-drafts` 和 `image-proxy` |
