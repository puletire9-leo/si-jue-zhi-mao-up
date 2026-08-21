# 登录与权限修复记录

**日期**: 2026-08-18  
**修复人员**: Claude AI Assistant  
**影响范围**: 用户认证系统、权限控制、前后端编码

---

## 问题描述

### 1. Admin 用户无法登录
- **现象**: admin/123456 登录失败，提示"用户名或密码错误"
- **根因**: 数据库中 admin 用户密码为 `admin`，不是 `123456`
- **影响**: 管理员账号无法访问系统

### 2. 密码长度限制过于严格
- **现象**: 前端和后端都强制密码最小长度 6 位
- **问题**: admin 密码为 5 位（`admin`），无法通过验证
- **影响**: 短密码用户（如 admin、kf 等）无法登录

### 3. Developer 角色权限失效
- **现象**: 开发者角色（DEVELOPER）登录后只能看到运营/美术的受限菜单
  - 实际看到：非标品、设计稿、素材库、载体库、下载管理
  - 应该看到：除用户管理/系统设置外的所有模块（竞品分析、领星、选品等）
- **根因**: 前端权限判断只识别中文"开发"，不识别后端返回的英文"developer"
- **影响**: 开发者无法访问核心业务功能模块

### 4. 中文用户名登录失败（字符编码）
- **现象**: 宋凤莉等中文用户名登录时返回 401 错误
- **根因**: Java 后端未配置 HTTP 请求字符编码，中文被解析为乱码（???）
- **影响**: 所有中文用户名无法登录

---

## 修复内容

### 1. 移除密码长度限制

#### 后端 (Java)
**文件**: `java-backend/sjzm-user/src/main/java/com/sjzm/user/dto/RegisterRequest.java`
```java
// 修改前
@Size(min = 6, max = 100, message = "密码长度 6-100 位")

// 修改后
@Size(max = 100, message = "密码长度不能超过 100 位")
```

**文件**: `java-backend/sjzm-user/src/main/java/com/sjzm/user/controller/AuthController.java`
```java
// 修改前
if (newPassword == null || newPassword.length() < 6) {
    return Result.error(400, "新密码长度不能少于6位");
}

// 修改后
if (newPassword == null || newPassword.isBlank()) {
    return Result.error(400, "新密码不能为空");
}
```

#### 前端 (Vue)
**文件**: `frontend/src/views/Login/index.vue`
```typescript
// 移除密码验证规则中的 min: 6
password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
    // 删除: { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
]

// 移除注册时的长度检查
// 删除以下代码：
if (loginForm.password.length < 6) {
    ElMessage.error('密码至少6个字符')
    return
}
```

**文件**: `frontend/src/views/AccountSettings/components/ChangePassword.vue`
```typescript
// 移除密码长度验证
newPassword: [
    { required: true, message: "请输入新密码", trigger: "blur" }
    // 删除: { min: 6, message: "密码长度不能少于 6 位", trigger: "blur" }
]
```

**文件**: `frontend/src/views/UserManagement/index.vue`
```typescript
// 修改前
if (!resetForm.newPassword || resetForm.newPassword.length < 6) {
    ElMessage.warning("新密码长度不能少于 6 位");
    return;
}

// 修改后
if (!resetForm.newPassword) {
    ElMessage.warning("请输入新密码");
    return;
}
```

### 2. 修复 Developer 权限识别

**文件**: `frontend/src/utils/permission.ts`
```typescript
// 修改前（只识别中文）
if (role.includes("开发")) return !DEVELOPER_HIDDEN.has(moduleId);

// 修改后（支持中英文）
if (role.includes("开发") || role.includes("developer")) {
    return !DEVELOPER_HIDDEN.has(moduleId);
}

// canWrite 函数同样修复
export function canWrite(role: string | undefined | null): boolean {
    if (!role) return false;
    return (
        role.includes("管理员") ||
        role.includes("admin") ||
        role.includes("开发") ||
        role.includes("developer")  // 新增
    );
}
```

**说明**: 后端 `AuthServiceImpl.normalizeRole()` 将数据库的 `DEVELOPER` 转换为 `developer`（英文小写），前端必须同时支持中英文角色名。

### 3. 修复中文用户名编码问题

**文件**: `java-backend/sjzm-user/src/main/resources/application.yml`
```yaml
server:
  port: 8001
  servlet:
    encoding:
      charset: UTF-8
      enabled: true
      force: true  # 强制所有请求和响应使用 UTF-8
```

**说明**: Spring Boot 4.x 需要显式配置 HTTP 字符编码，否则中文请求体会被解析为乱码。

---

## 部署流程

### 1. 后端 Java 服务
```powershell
cd E:\项目\si-jue-zhi-mao-up
# 重新构建 Java 镜像（包含字符编码配置）
docker compose -f docker-compose.prod.yml build java-user
# 重启用户服务
docker compose -f docker-compose.prod.yml up -d java-user
```

### 2. 前端
```powershell
# 在宿主机构建（避免 Docker 内存不足）
cd E:\项目\si-jue-zhi-mao-up\frontend
npm run build

# 构建前端镜像
cd ..
docker compose -f docker-compose.prod.yml build frontend
# 重启前端容器
docker compose -f docker-compose.prod.yml up -d frontend
```

---

## 测试验证

### 1. 短密码登录测试
```powershell
# 测试 admin/admin（5位密码）
$body = @{username='admin';password='admin'} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://192.168.10.148:5173/api/v1/auth/login' `
    -Method POST -Body $body -ContentType 'application/json'
# 预期: 返回 code=200，包含 accessToken
```

### 2. Developer 权限测试
```powershell
# 测试 kf/kf（DEVELOPER 角色）
$body = @{username='kf';password='kf'} | ConvertTo-Json
$response = Invoke-RestMethod -Uri 'http://192.168.10.148:5173/api/v1/auth/login' `
    -Method POST -Body $body -ContentType 'application/json'
Write-Output "角色: $($response.data.userInfo.role)"
# 预期: 角色=developer
```

登录后侧边栏应显示：
- ✅ 首页 (dashboard)
- ✅ 竞品分析 (competitor)
- ✅ 领星 (lingxing)
- ✅ 选品 (selection)
- ✅ 非标品 (final-draft)
- ✅ 设计稿、素材库、载体库、下载管理
- ❌ 用户管理 (users)
- ❌ 系统设置 (settings)

### 3. 中文用户名测试
```powershell
# 测试宋凤莉/123456
$body = @{username='宋凤莉';password='123456'} | ConvertTo-Json
Invoke-RestMethod -Uri 'http://192.168.10.148:5173/api/v1/auth/login' `
    -Method POST -Body $body -ContentType 'application/json'
# 预期: 返回 code=200
```

---

## 数据库用户信息

### 测试账号（RDS: ai_platform.users）
| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | admin | MANAGER | 管理员（5位密码） |
| kf | kf | DEVELOPER | 开发者（2位密码） |
| 宋凤莉 | 123456 | DEVELOPER | 中文用户名 |
| 张子轩 | 123456 | DEVELOPER | 中文用户名 |

### 角色映射（后端 normalizeRole）
| 数据库 | 前端显示 | 权限 |
|--------|----------|------|
| MANAGER | admin | 全部模块 + 写权限 |
| DEVELOPER | developer | 除 users/settings 外全部模块 + 写权限 |
| OPERATOR/PURCHASER | user | 受限模块（非标品/素材/载体/下载） |
| ART_MANAGER/ARTIST | editor | 受限模块 |

---

## 关键问题复盘

### 1. 为什么没有提前发现 admin 密码是 5 位？
- **原因**: 直接假设数据库密码是常见的 `123456`，未先查询确认
- **教训**: 任何数据相关的修复，必须先查询数据库实际值

### 2. 为什么 Developer 权限修复后仍不生效？
- **原因**: 
  - 第一次修改后未重新构建前端
  - 第二次构建后容器未重启
  - 浏览器缓存未强制刷新
- **教训**: 前端修改必须完整走完流程：
  1. 修改源码
  2. `npm run build`（宿主机）
  3. `docker compose build frontend`
  4. `docker compose up -d frontend`
  5. 浏览器强制刷新（Ctrl+Shift+R）

### 3. 为什么中文用户名会乱码？
- **原因**: Spring Boot 4.x 不再默认配置 HTTP 字符编码，需要显式声明
- **教训**: 升级到新版本框架时，字符编码等基础配置必须重新检查

---

## 后续建议

### 1. 安全性改进
- [ ] 所有用户密码应使用 BCrypt 加密存储
- [ ] 建议最小密码长度改为 8 位（当前已移除限制）
- [ ] 添加登录失败次数限制（防暴力破解）

### 2. 开发流程改进
- [ ] 修复后必须实际登录测试，不能仅依赖 API 测试
- [ ] 建立完整的测试账号列表（各角色至少 1 个）
- [ ] 前端部署清单：改代码 → 构建 → 镜像 → 重启 → 验证

### 3. 文档完善
- [ ] 在 `java-backend/CLAUDE.md` 记录字符编码配置要求
- [ ] 在 `frontend/CLAUDE.md` 记录权限判断逻辑
- [ ] 更新用户手册，说明各角色权限范围

---

## 影响分析

### 受影响服务
- ✅ sjzm-user (Java 用户服务) - 重启完成
- ✅ frontend (前端) - 重启完成
- ⚠️ gateway (网关) - 继承旧镜像，未受影响

### 数据变更
- 无数据库表结构变更
- 无数据迁移
- 无配置文件变更（除 application.yml）

### 回滚方案
如需回滚到修复前版本：
```powershell
# 回滚到 previous 镜像
docker tag prod-java:previous prod-java:current
docker tag prod-frontend:previous prod-frontend:current
docker compose -f docker-compose.prod.yml up -d java-user frontend
```

---

## 附录

### 构建日志时间戳
- Java 重构建: 2026-08-18 16:30
- 前端重构建: 2026-08-18 16:42（第一次，权限未修复）
- 前端重构建: 2026-08-18 16:50（第二次，权限已修复）

### 验证完成时间
- 2026-08-18 16:50:39

### 相关文件清单
```
java-backend/sjzm-user/
├── src/main/java/com/sjzm/user/
│   ├── controller/AuthController.java          [密码长度验证移除]
│   ├── dto/RegisterRequest.java                [密码长度验证移除]
│   └── service/impl/AuthServiceImpl.java       [normalizeRole 角色转换]
└── src/main/resources/application.yml           [新增 UTF-8 编码配置]

frontend/src/
├── views/Login/index.vue                        [移除密码长度验证]
├── views/AccountSettings/components/
│   └── ChangePassword.vue                       [移除密码长度验证]
├── views/UserManagement/index.vue               [移除密码长度验证]
└── utils/permission.ts                          [新增 developer 英文支持]
```
