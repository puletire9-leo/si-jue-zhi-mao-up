# 生产环境登录失败：数据库密码 hash 不一致

**日期**: 2026-05-25
**严重程度**: 高（生产环境完全无法登录）
**影响范围**: 生产环境所有用户登录

---

## 现象

在生产环境（Docker）使用 `admin / 123456` 登录时：

1. 前端显示 "登录成功"
2. 紧接着跳转回登录页，显示 "请先登录"

开发环境使用相同凭证登录正常。

## 根因

Dev 和 Prod 使用**两个独立的 MySQL 数据库**：

| 环境 | 数据库名 | 端口 | 容器 |
|------|----------|------|------|
| Dev | `sijuelishi_dev` | 3307 | `dev-mysql` |
| Prod | `sijuelishi` | 3310 | `prod-mysql` |

admin 用户在两个库中的 BCrypt 密码 hash 不同：

```
Dev:  $2a$12$X0HRU.asOSON2nu2l9JIuea/epBfbBS1a/wzESFzabs.j9VSVRV62  → 123456 ✅
Prod: $2a$12$9lGSTCN4fYTpIeUmsxuhIOTxsjRU9F7D9Opf0ysJ5pl6oAwcDkZf2  → 未知   ❌
```

Prod 数据库的 admin 密码不是 `123456`，导致登录接口返回 `{"code": 401, "message": "用户名或密码错误"}`。

## 问题链路

```
前端 POST /api/v1/auth/login {username: "admin", password: "123456"}
  → Nginx → prod-java-user:8001
  → AuthServiceImpl.login()
  → passwordEncoder.matches("123456", prodHash) → false
  → BusinessException(401, "用户名或密码错误")
  → 后端返回 HTTP 200, body: {"code": 401, "message": "用户名或密码错误", "data": null}
  → axios 拦截器: code !== 200, 但仍 return res（不抛错）
  → Store: loginData = response.data → null
  → setToken(undefined) → localStorage 不存 token
  → router.push('/dashboard') → 守卫检查 localStorage 无 token
  → "请先登录" → 跳回登录页
```

## 修复方法

### 1. 立即修复（已执行）

更新 Prod 数据库的 admin 密码 hash 为 Dev 的正确值：

```powershell
$hash = '$2a$12$X0HRU.asOSON2nu2l9JIuea/epBfbBS1a/wzESFzabs.j9VSVRV62'
$sql = "UPDATE users SET password='$hash' WHERE username='admin';"
docker exec prod-mysql mysql -u sijue -psijue123456 sijuelishi -e $sql
```

### 2. 持久修复（已执行）

修正 `backend/backup/prod-init.sql` 中 admin 的密码 hash，确保重建数据库时使用正确的密码。

## 排查过程

1. 确认 "请先登录" 唯一来源：`router/index.ts:211`（守卫检查 token 不存在）
2. 确认前端代码 dev/prod 一致，排除代码问题
3. 对比 dev/prod 基础设施差异：Nginx 路由、数据库、环境变量
4. 发现关键差异：**数据库名不同**（`sijuelishi_dev` vs `sijuelishi`）
5. 对比两个库的 admin 密码 hash → **不一致**
6. 同步 hash 后登录正常

## 预防措施

- 新用户初始化脚本应统一使用相同的密码 hash
- 可考虑在应用启动时检查默认管理员是否存在且密码有效
- 生产环境部署文档应包含数据库初始化验证步骤

## 涉及文件

| 文件 | 角色 |
|------|------|
| `frontend/src/stores/user.ts` | 登录状态管理，token 存储 |
| `frontend/src/router/index.ts` | 路由守卫，token 检查 |
| `frontend/src/utils/request.ts` | axios 响应拦截器 |
| `java-backend/sjzm-user/.../AuthServiceImpl.java` | 登录业务逻辑 |
| `java-backend/sjzm-common/.../JwtUtil.java` | JWT 生成 |
| `frontend/nginx.prod.conf` | 生产 Nginx 路由 |
| `docker-compose.prod.yml` | 生产 Docker 编排 |
| `backend/backup/prod-init.sql` | 生产数据库初始化脚本 |
