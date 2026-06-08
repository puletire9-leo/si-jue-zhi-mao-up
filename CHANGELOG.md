## [Unreleased]

### 修复

- 编辑定稿时无脑发送images字段导致图片加载失败
## [0.3.0] - 2026-06-05

### 修复

- Images路由移除gateway + Python代码卷挂载 + selection_products替换
- Categories查询%%转义 + Docker独立部署方案文档

### 新增

- Docker生产环境去除host mount，代码bake进镜像
- 恢复卖家名批量导入功能 + 竞品/选品增强
- Docker独立部署完善 + celery健康检查修复 + 部署文档更新
## [0.2.0] - 2026-06-04

### 修复

- 编辑定稿修改要求不再导致图片被删（URL格式不同导致误判）

### 新增

- Docker 容器化部署，dev/prod 环境完全隔离
- 销量下滑分析页面新增产品详情展示模块
- 恢复 batch_shop_lookup.py 批量店铺查询脚本
- 前端模块化架构 + 店铺评级模块
- 店铺评级持久化 + 分类多选 + nginx路由修复 + .gitignore大文件排除

### 杂项

- 更新 .gitignore（排除大文件、测试文件、临时脚本）
## [0.1.0] - 2026-05-12
