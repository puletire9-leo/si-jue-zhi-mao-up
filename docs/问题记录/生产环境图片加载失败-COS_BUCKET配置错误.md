# 生产环境图片加载失败：COS_BUCKET 配置错误

**日期**: 2026-06-04
**严重程度**: 高（定稿页面所有图片无法加载）
**影响范围**: 生产环境定稿、素材库等所有使用 COS 图片的功能

---

## 现象

生产环境定稿页面所有图片显示"图片加载失败"占位图：

1. 前端 `el-image` 组件显示 SVG 占位图（420字节）
2. 控制台无明显报错（代理接口返回 200）
3. 开发环境图片正常

## 根因

`docker-compose.prod.yml` 中 `backend` 服务的 `COS_BUCKET` 从宿主机环境变量 `${COS_BUCKET}` 读取，宿主机 `.env` 中值为 `sijuelishi-dev-1328246743`（带 `-dev` 后缀）。

但图片实际存储在 `sijuelishi-1328246743`（无 `-dev`），两个是不同的 COS 存储桶：

| 配置来源 | COS_BUCKET | 结果 |
|---------|-----------|------|
| 宿主机 `.env` | `sijuelishi-dev-1328246743` | NoSuchKey |
| celery-download 硬编码 | `sijuelishi-1328246743` | 正确 |
| 数据库中图片 URL | `sijuelishi-1328246743` | 正确 |

## 问题链路

```
前端 <el-image src="/api/v1/image-proxy/proxy?object_key=final_drafts/xxx.webp">
  → Nginx → prod-backend:7090 (Python)
  → proxy_image() 
  → cos_service.get_full_url("final_drafts/xxx.webp")
  → 构建 URL: https://sijuelishi-dev-1328246743.cos.ap-guangzhou.myqcloud.com/final_drafts/xxx.webp
  → 公有读下载失败（bucket 不对）
  → COS SDK 回退: get_object(Bucket="sijuelishi-dev-1328246743", Key="final_drafts/xxx.webp")
  → 错误: {'code': 'NoSuchKey', 'message': 'The specified key does not exist.'}
  → 返回占位 SVG（image/svg+xml, 420字节）
```

## 修复方法

### 立即修复（已执行）

修改 `docker-compose.prod.yml`，将 `backend` 服务的 `COS_BUCKET` 从 `${COS_BUCKET}` 改为硬编码正确值：

```yaml
# 修改前
- COS_BUCKET=${COS_BUCKET}          # 读取宿主机 .env → sijuelishi-dev-1328246743 ❌

# 修改后
- COS_BUCKET=sijuelishi-1328246743  # 硬编码生产 bucket ✅
```

重启后端容器：

```powershell
docker compose -f docker-compose.prod.yml -p sijuelishi-prod up -d backend
```

### 验证

```powershell
# 确认容器内环境变量
docker exec prod-backend printenv COS_BUCKET
# 输出: sijuelishi-1328246743 ✅

# 测试图片代理
Invoke-WebRequest -Uri "http://localhost:5173/api/v1/image-proxy/proxy?object_key=final_drafts/20260603_014900_9734fe6b.webp"
# 返回: 200, ContentLength=173672, ContentType=image/webp ✅
```

## 排查过程

1. 前端图片显示占位图，检查 `DraftCard.vue` → 使用 `ImageUrlUtil.getThumbnailUrlSync()` → 生成代理 URL
2. 测试代理接口 `/api/v1/image-proxy/proxy` → 返回 200 但只有 420 字节（SVG 占位图）
3. 查看 Python 后端日志 → `COS SDK 获取失败: NoSuchKey`
4. 关键线索：日志中 COS URL 为 `sijuelishi-dev-1328246743`，但数据库中图片 URL 为 `sijuelishi-1328246743`
5. 对比 `docker-compose.prod.yml` 中各服务的 COS 配置：
   - `backend`: `${COS_BUCKET}` → 宿主机 .env → `sijuelishi-dev-1328246743` ❌
   - `celery-download`: 硬编码 `sijuelishi-1328246743` ✅
6. 修正 `COS_BUCKET` 为硬编码值，重启容器，图片正常

## 教训

1. **生产环境配置不应引用宿主机环境变量**：宿主机 `.env` 通常是开发配置，带 `-dev` 后缀的值会污染生产环境
2. **同一项目的不同服务配置应保持一致**：`celery-download` 正确硬编码了，但 `backend` 没有
3. **代理接口返回 200 + 占位图容易误导排查**：接口没报错，只是返回了降级内容，需要看后端日志才能定位

## 涉及文件

| 文件 | 角色 |
|------|------|
| `docker-compose.prod.yml:94` | `backend` 服务 COS_BUCKET 配置（问题根源） |
| `backend/app/api/v1/image_proxy.py` | 图片代理接口，返回占位图 |
| `backend/app/services/cos_service.py` | COS 服务，`get_full_url()` 使用错误 bucket |
| `backend/app/config.py:124` | `COS_BUCKET` 配置定义 |
| `frontend/src/utils/imageUrlUtil.ts` | 前端图片 URL 工具，生成代理 URL |
| `frontend/src/views/FinalDraft/components/DraftCard.vue` | 定稿卡片组件，显示图片 |
