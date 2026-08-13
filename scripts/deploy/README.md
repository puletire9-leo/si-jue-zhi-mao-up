# 生产部署脚本

生产部署唯一权威文档是 [`docs/docker使用经验/部署流程.md`](../../docs/docker使用经验/部署流程.md)。不得从 README、日志、问题记录或历史架构文档复制命令绕过该流程。

正式发布只运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component <java|frontend|backend|ai-center>
```

每次只发布一个组件。根据本次代码变更选择对应命令，不要把四条命令串联执行：

| 变更范围 | 只运行 |
|---|---|
| Java（user/product/gateway 共用镜像） | `-Component java` |
| Vue/Nginx 前端 | `-Component frontend` |
| Python API 或 Celery | `-Component backend` |
| AI Center | `-Component ai-center` |

脚本不会自动构建或重启其他组件；`--no-deps` 会阻止 Compose 联动重建 MySQL、Redis、Nacos 等基础设施。

`deploy_prod.ps1` 强制执行预检、构建前双版本轮换、一次缓存构建、`--no-deps --no-build` 重建、健康验证和旧缓存收尾。首次发布且没有 `current` 的组件会在健康验证后建立回退基线。`prod_preflight_check.ps1` 与 `prune_java_build_cache.ps1` 是该流程内部步骤，不替代完整发布入口。

禁止事项：

- 禁止添加 `-p sijuelishi-prod`。
- 禁止生产 `up -d --build` 或默认 `--no-cache`。
- 禁止同一组件连续重复构建。
- 禁止无条件 `docker builder/buildx/system prune`。
- 禁止任何部署脚本删除 volume。
