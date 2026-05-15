## Why

Java 后端已编译启动成功、全 API 测试通过，但实际前端页面仍有报错——MaterialLibrary SQL 错误、过期 mock token、图片加载失败、Vite 代理未重启。需要端到端验证：前端 → Vite → Java 全链路通畅，Python 仅保留 AI 服务。

## What Changes

- 重启 Vite 确保代理配置生效（/api/* → Java :8090）
- 清理浏览器 localStorage 中过期 mock token
- 重新登录获取真实 JWT token
- 逐一打开所有页面验证无 500 错误
- 修复发现的遗漏端点或字段不匹配
- 确认图片显示正常
- 确认数据看板正常

## Capabilities

### New Capabilities

- `e2e-connectivity`: 前端经 Vite 代理到 Java 后端的端到端连通性验证

## Impact

- 无需改代码，验证性任务
- 涉及文件：仅修复运行时发现的实体字段或缺失端点
