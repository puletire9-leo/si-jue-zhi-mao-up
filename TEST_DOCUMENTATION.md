# 思觉智贸 - 功能测试文档

## 📅 测试时间
2026-05-08

## 🎯 测试目标
1. 验证登录系统（Mock模式）
2. 测试定稿管理功能
3. 验证腾讯云COS上传功能
4. 测试批量操作

## 🔐 登录测试

### 测试账号
- 用户名: `admin`
- 密码: `123456`

### 测试步骤
1. 打开前端页面 http://localhost:3000/
2. 输入用户名: admin
3. 输入密码: 123456
4. 点击登录按钮
5. 验证跳转到仪表板页面

### 预期结果
✅ 登录成功，显示"登录成功"提示
✅ 自动跳转到 /dashboard
✅ 用户信息保存到 localStorage

## 📦 定稿管理功能测试

### 入口
菜单路径: 定稿 → 定稿管理

### 功能测试项

#### 1. 查询列表
- 测试不同搜索类型（SKU/开发人/批次）
- 测试分页功能
- 测试排序功能（开发人/SKU/批次/创建时间）

#### 2. 新增定稿
- 点击"新增定稿"按钮
- 填写表单：SKU、批次、开发人、载体等
- 上传图片（测试COS上传）
- 提交保存

#### 3. 批量操作
- 勾选多个定稿
- 测试批量下载
- 测试批量修改
- 测试批量删除

#### 4. 回收站功能
- 点击"回收站"按钮
- 查看已删除的定稿
- 测试恢复功能
- 测试永久删除

## ☁️ 腾讯云COS上传测试

### 配置信息（来自 .env）
```
COS_SECRET_ID=your-cos-secret-id
COS_SECRET_KEY=your-cos-secret-key
COS_BUCKET=your-bucket-name
COS_REGION=ap-guangzhou
```

### ✅ COS连接测试已通过
```
测试结果:
✅ 配置检查通过
✅ qcloud_cos 模块可用
✅ 上传成功!
✅ 清理完成
```

### 访问域名
```
https://sijuelishi-dev-1328246743.cos.ap-guangzhou.myqcloud.com
```

### 测试用例

#### TC-01: 上传产品图片
**前置条件**: 已登录系统，进入定稿管理页面
**操作步骤**:
1. 点击"新增定稿"
2. 选择一张产品图片
3. 填写基本信息
4. 点击保存

**预期结果**:
- 图片成功上传到 COS
- 返回 COS URL
- 图片可在列表中显示

#### TC-02: 上传缩略图
**前置条件**: 已上传产品图片
**操作步骤**:
1. 选择已上传的图片
2. 系统自动生成缩略图
3. 缩略图上传到 COS

**预期结果**:
- 缩略图成功上传到 thumbnails/ 前缀路径
- 可通过缩略图 URL 访问

#### TC-03: 删除图片
**前置条件**: 存在已上传的图片
**操作步骤**:
1. 删除定稿记录
2. 系统自动清理 COS 中的图片

**预期结果**:
- 图片从 COS 删除
- 不残留无用文件

## 🔧 后端服务测试

### 启动服务
```bash
# 方式1: 使用 Docker Compose（需要完整环境）
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 方式2: 单独启动 Python 后端
cd backend
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### API 测试

#### 健康检查
```bash
curl http://localhost:8000/api/v1/health
```

#### 获取定稿列表
```bash
curl http://localhost:8000/api/v1/final-drafts
```

#### 创建定稿
```bash
curl -X POST http://localhost:8000/api/v1/final-drafts \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "TEST-SKU-001",
    "batch": "BATCH-001",
    "developer": "张三",
    "carrier": "载体A",
    "images": []
  }'
```

## 📊 数据库操作测试

### 连接信息
```
Host: localhost (Docker内部: mysql)
Port: 3306
Database: sijuelishi
User: sijue
Password: sijue123456
```

### 测试 SQL

#### 查看定稿表结构
```sql
DESCRIBE final_drafts;
```

#### 查询所有定稿
```sql
SELECT id, sku, batch, developer, status, create_time 
FROM final_drafts 
WHERE delete_time IS NULL;
```

#### 插入测试数据
```sql
INSERT INTO final_drafts (sku, batch, developer, carrier, images, status)
VALUES ('TEST-001', 'BATCH-TEST', '测试人员', '测试载体', '[]', 'concept');
```

## 🎨 前端界面测试

### 主题切换
1. 点击右上角设置图标
2. 打开系统配置面板
3. 测试"主题模式"切换（浅色/深色/自动）
4. 验证页面样式变化

### 侧边栏
1. 测试菜单收放
2. 测试不同布局（垂直/水平/混合）
3. 验证响应式设计

## ⚠️ 注意事项

1. **COS权限**: .env 中的 COS 密钥标注为"测试权限"，实际使用需申请正式权限
2. **生产环境**: 不要将真实密钥提交到代码仓库
3. **数据安全**: 测试时使用测试账号和测试数据
4. **备份**: 重要操作前建议备份数据库

## 📝 测试报告模板

### 发现的问题
| 编号 | 模块 | 问题描述 | 严重程度 | 状态 |
|------|------|----------|----------|------|
| 1 |    |    |    | 待修复 |

### 测试结果汇总
| 功能模块 | 测试用例数 | 通过数 | 失败数 | 通过率 |
|----------|-----------|--------|--------|--------|
| 登录系统 |    |    |    |    |
| 定稿管理 |    |    |    |    |
| COS上传 |    |    |    |    |
| 批量操作 |    |    |    |    |
| 回收站 |    |    |    |    |

## 🚀 下一步

1. 启动后端服务进行真实功能测试
2. 配置腾讯云COS正式权限
3. 测试完整的上传-下载流程
4. 验证数据库持久化

---

*文档生成时间: 2026-05-08*
*测试人员: AI Assistant*
