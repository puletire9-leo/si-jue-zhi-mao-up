# Java后端 API 测试清单

> 项目：思觉智贸
> 测试日期：2026-05-08
> 后端地址：http://localhost:8080

---

## 一、API接口清单

### 1.1 认证模块

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 登录 | POST | `/api/v1/auth/login` | ⏳ |
| 刷新Token | POST | `/api/v1/auth/refresh` | ⏳ |
| 获取用户信息 | GET | `/api/v1/auth/userinfo` | ⏳ |
| 登出 | POST | `/api/v1/auth/logout` | ⏳ |

### 1.2 用户管理

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 用户列表 | GET | `/api/v1/users` | ⏳ |
| 用户详情 | GET | `/api/v1/users/{id}` | ⏳ |
| 创建用户 | POST | `/api/v1/users` | ⏳ |
| 更新用户 | PUT | `/api/v1/users/{id}` | ⏳ |
| 删除用户 | DELETE | `/api/v1/users/{id}` | ⏳ |
| 修改密码 | PUT | `/api/v1/users/{id}/password` | ⏳ |

### 1.3 产品管理

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 产品列表 | GET | `/api/v1/products` | ⏳ |
| 产品详情 | GET | `/api/v1/products/{id}` | ⏳ |
| 创建产品 | POST | `/api/v1/products` | ⏳ |
| 更新产品 | PUT | `/api/v1/products/{id}` | ⏳ |
| 删除产品 | DELETE | `/api/v1/products/{id}` | ⏳ |
| 批量导入 | POST | `/api/v1/products/import` | ⏳ |
| 导出产品 | GET | `/api/v1/products/export` | ⏳ |

### 1.4 选品管理

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 选品列表 | GET | `/api/v1/selection` | ⏳ |
| 选品详情 | GET | `/api/v1/selection/{id}` | ⏳ |
| 创建选品 | POST | `/api/v1/selection` | ⏳ |
| 更新选品 | PUT | `/api/v1/selection/{id}` | ⏳ |
| 删除选品 | DELETE | `/api/v1/selection/{id}` | ⏳ |
| 批量导入 | POST | `/api/v1/selection/import` | ⏳ |

### 1.5 分类管理

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 分类列表 | GET | `/api/v1/categories` | ⏳ |
| 创建分类 | POST | `/api/v1/categories` | ⏳ |
| 更新分类 | PUT | `/api/v1/categories/{id}` | ⏳ |
| 删除分类 | DELETE | `/api/v1/categories/{id}` | ⏳ |

### 1.6 标签管理

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 标签列表 | GET | `/api/v1/tags` | ⏳ |
| 创建标签 | POST | `/api/v1/tags` | ⏳ |
| 更新标签 | PUT | `/api/v1/tags/{id}` | ⏳ |
| 删除标签 | DELETE | `/api/v1/tags/{id}` | ⏳ |

### 1.7 素材库

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 素材列表 | GET | `/api/v1/material-library` | ⏳ |
| 素材详情 | GET | `/api/v1/material-library/{id}` | ⏳ |
| 上传素材 | POST | `/api/v1/material-library` | ⏳ |
| 更新素材 | PUT | `/api/v1/material-library/{id}` | ⏳ |
| 删除素材 | DELETE | `/api/v1/material-library/{id}` | ⏳ |
| 回收站列表 | GET | `/api/v1/material-library/recycle-bin` | ⏳ |
| 恢复素材 | POST | `/api/v1/material-library/{id}/restore` | ⏳ |
| 清空回收站 | DELETE | `/api/v1/material-library/recycle-bin` | ⏳ |

### 1.8 运营商库

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 运营商列表 | GET | `/api/v1/carrier-library` | ⏳ |
| 运营商详情 | GET | `/api/v1/carrier-library/{id}` | ⏳ |
| 创建运营商 | POST | `/api/v1/carrier-library` | ⏳ |
| 更新运营商 | PUT | `/api/v1/carrier-library/{id}` | ⏳ |
| 删除运营商 | DELETE | `/api/v1/carrier-library/{id}` | ⏳ |
| 回收站列表 | GET | `/api/v1/carrier-library/recycle-bin` | ⏳ |
| 恢复运营商 | POST | `/api/v1/carrier-library/{id}/restore` | ⏳ |
| 清空回收站 | DELETE | `/api/v1/carrier-library/recycle-bin` | ⏳ |

### 1.9 定稿管理

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 定稿列表 | GET | `/api/v1/final-drafts` | ⏳ |
| 定稿详情 | GET | `/api/v1/final-drafts/{id}` | ⏳ |
| 创建定稿 | POST | `/api/v1/final-drafts` | ⏳ |
| 更新定稿 | PUT | `/api/v1/final-drafts/{id}` | ⏳ |
| 删除定稿 | DELETE | `/api/v1/final-drafts/{id}` | ⏳ |
| 回收站列表 | GET | `/api/v1/final-drafts/recycle-bin` | ⏳ |
| 恢复定稿 | POST | `/api/v1/final-drafts/{id}/restore` | ⏳ |
| 清空回收站 | DELETE | `/api/v1/final-drafts/recycle-bin` | ⏳ |

### 1.10 图片管理

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 图片列表 | GET | `/api/v1/images` | ⏳ |
| 图片详情 | GET | `/api/v1/images/{id}` | ⏳ |
| 上传图片 | POST | `/api/v1/images` | ⏳ |
| 更新图片 | PUT | `/api/v1/images/{id}` | ⏳ |
| 删除图片 | DELETE | `/api/v1/images/{id}` | ⏳ |
| 批量删除 | POST | `/api/v1/images/batch-delete` | ⏳ |

### 1.11 图片代理

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 图片代理 | GET | `/api/v1/image-proxy` | ⏳ |
| 批量代理 | POST | `/api/v1/image-proxy/batch` | ⏳ |

### 1.12 导入功能

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 导入列表 | GET | `/api/v1/import/records` | ⏳ |
| 创建导入 | POST | `/api/v1/import` | ⏳ |
| 导入详情 | GET | `/api/v1/import/{id}` | ⏳ |
| 取消导入 | POST | `/api/v1/import/{id}/cancel` | ⏳ |

### 1.13 导出功能

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 导出列表 | GET | `/api/v1/export/records` | ⏳ |
| 创建导出 | POST | `/api/v1/export` | ⏳ |
| 导出详情 | GET | `/api/v1/export/{id}` | ⏳ |
| 下载导出 | GET | `/api/v1/export/{id}/download` | ⏳ |

### 1.14 报表管理

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 报表列表 | GET | `/api/v1/reports` | ⏳ |
| 生成报表 | POST | `/api/v1/reports/generate` | ⏳ |
| 报表详情 | GET | `/api/v1/reports/{id}` | ⏳ |
| 下载报表 | GET | `/api/v1/reports/{id}/download` | ⏳ |
| 删除报表 | DELETE | `/api/v1/reports/{id}` | ⏳ |

### 1.15 统计分析

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 统计概览 | GET | `/api/v1/statistics/overview` | ⏳ |
| 产品统计 | GET | `/api/v1/statistics/products` | ⏳ |
| 销售统计 | GET | `/api/v1/statistics/sales` | ⏳ |

### 1.16 系统配置

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 配置列表 | GET | `/api/v1/system-config` | ⏳ |
| 获取配置 | GET | `/api/v1/system-config/{key}` | ⏳ |
| 更新配置 | PUT | `/api/v1/system-config/{key}` | ⏳ |
| 重置配置 | POST | `/api/v1/system-config/{key}/reset` | ⏳ |

### 1.17 日志管理

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 日志列表 | GET | `/api/v1/logs` | ⏳ |
| 日志详情 | GET | `/api/v1/logs/{id}` | ⏳ |
| 清理日志 | DELETE | `/api/v1/logs` | ⏳ |

### 1.18 下载任务

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 任务列表 | GET | `/api/v1/download-tasks` | ⏳ |
| 创建任务 | POST | `/api/v1/download-tasks` | ⏳ |
| 任务详情 | GET | `/api/v1/download-tasks/{id}` | ⏳ |
| 取消任务 | POST | `/api/v1/download-tasks/{id}/cancel` | ⏳ |
| 重试任务 | POST | `/api/v1/download-tasks/{id}/retry` | ⏳ |

### 1.19 文件链接

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 链接列表 | GET | `/api/v1/file-links` | ⏳ |
| 创建链接 | POST | `/api/v1/file-links` | ⏳ |
| 链接详情 | GET | `/api/v1/file-links/{id}` | ⏳ |
| 删除链接 | DELETE | `/api/v1/file-links/{id}` | ⏳ |

### 1.20 领星导入

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 导入数据 | POST | `/api/v1/lingxing/import` | ⏳ |
| 导入状态 | GET | `/api/v1/lingxing/status/{id}` | ⏳ |

### 1.21 产品数据

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 数据列表 | GET | `/api/v1/product-data` | ⏳ |
| 数据详情 | GET | `/api/v1/product-data/{id}` | ⏳ |
| 同步数据 | POST | `/api/v1/product-data/sync` | ⏳ |

### 1.22 产品销量

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 销量列表 | GET | `/api/v1/product-sales` | ⏳ |
| 销量详情 | GET | `/api/v1/product-sales/{id}` | ⏳ |
| 同步销量 | POST | `/api/v1/product-sales/sync` | ⏳ |

### 1.23 评分引擎

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 产品评分 | POST | `/api/v1/scoring/product` | ⏳ |
| 批量评分 | POST | `/api/v1/scoring/batch` | ⏳ |
| 评分配置 | GET | `/api/v1/scoring/config` | ⏳ |
| 更新配置 | PUT | `/api/v1/scoring/config` | ⏳ |

### 1.24 向量搜索

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 相似图片搜索 | POST | `/api/v1/vector/search` | ⏳ |
| 以图搜图 | POST | `/api/v1/vector/search-by-image` | ⏳ |
| 索引图片 | POST | `/api/v1/vector/index` | ⏳ |
| 批量索引 | POST | `/api/v1/vector/batch-index` | ⏳ |
| 删除索引 | DELETE | `/api/v1/vector/{id}` | ⏳ |
| 服务状态 | GET | `/api/v1/vector/status` | ⏳ |
| 重建索引 | POST | `/api/v1/vector/rebuild` | ⏳ |

### 1.25 回收站

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 回收站统计 | GET | `/api/v1/recycle-bin/stats` | ⏳ |
| 回收站列表 | GET | `/api/v1/recycle-bin/products` | ⏳ |
| 恢复产品 | POST | `/api/v1/recycle-bin/restore/{sku}` | ⏳ |
| 批量恢复 | POST | `/api/v1/recycle-bin/batch-restore` | ⏳ |
| 永久删除 | DELETE | `/api/v1/recycle-bin/{sku}` | ⏳ |
| 批量永久删除 | DELETE | `/api/v1/recycle-bin/batch` | ⏳ |
| 清理过期 | DELETE | `/api/v1/recycle-bin/expired` | ⏳ |

### 1.26 产品回收站

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 回收站列表 | GET | `/api/v1/product-recycle` | ⏳ |
| 恢复产品 | POST | `/api/v1/product-recycle/{id}/restore` | ⏳ |
| 清空回收站 | DELETE | `/api/v1/product-recycle` | ⏳ |

### 1.27 选品回收站

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 回收站列表 | GET | `/api/v1/selection-recycle` | ⏳ |
| 恢复选品 | POST | `/api/v1/selection-recycle/{id}/restore` | ⏳ |
| 清空回收站 | DELETE | `/api/v1/selection-recycle` | ⏳ |

### 1.28 备份管理

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 备份列表 | GET | `/api/v1/backup` | ⏳ |
| 创建备份 | POST | `/api/v1/backup` | ⏳ |
| 下载备份 | GET | `/api/v1/backup/{id}/download` | ⏳ |
| 删除备份 | DELETE | `/api/v1/backup/{id}` | ⏳ |

### 1.29 健康检查

| 接口 | 方法 | 路径 | 测试状态 |
|------|------|------|----------|
| 健康检查 | GET | `/health` | ⏳ |
| 详细信息 | GET | `/health/detailed` | ⏳ |

---

## 二、测试用例模板

### 2.1 登录测试

```bash
# 登录
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# 预期响应
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "accessToken": "xxx",
    "refreshToken": "xxx",
    "expiresIn": 86400
  }
}
```

### 2.2 产品列表测试

```bash
# 获取产品列表
curl -X GET "http://localhost:8080/api/v1/products?page=1&size=20" \
  -H "Authorization: Bearer {token}"

# 预期响应
{
  "code": 200,
  "message": "获取成功",
  "data": {
    "list": [...],
    "total": 100,
    "page": 1,
    "size": 20
  }
}
```

### 2.3 创建产品测试

```bash
# 创建产品
curl -X POST http://localhost:8080/api/v1/products \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TEST001",
    "name": "测试产品",
    "category": "电子产品",
    "price": 99.99
  }'

# 预期响应
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": 1,
    "sku": "TEST001"
  }
}
```

---

## 三、测试结果记录

| 接口 | 测试人 | 测试时间 | 结果 | 备注 |
|------|--------|----------|------|------|
| | | | | |
| | | | | |
| | | | | |

---

## 四、问题记录

| ID | 接口 | 问题描述 | 优先级 | 状态 |
|----|------|----------|--------|------|
| | | | | |
| | | | | |

---

*测试文档创建时间：2026-05-08*
