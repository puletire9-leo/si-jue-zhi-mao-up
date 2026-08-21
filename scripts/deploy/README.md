# 生产部署脚本

生产部署唯一权威文档是 [`docs/docker使用经验/部署流程.md`](../../docs/docker使用经验/部署流程.md)。线下/线上两套命令不能混用。不得从 README、日志、问题记录或历史架构文档复制命令绕过该流程。

**线下**正式发布只运行：

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

`deploy_prod.ps1` 强制执行预检（包括 BuildKit 底层 snapshot 完整性）、构建前创建临时回退标签、一次缓存构建、`--no-deps --no-build` 重建、健康验证、删除临时回退镜像和旧缓存收尾。成功后成品只保留 `current`，Java 编译缓存只保留最新一条。缓存完整性预检失败时会在构建前停止，禁止进入 Maven 下载。`prod_preflight_check.ps1` 与 `prune_java_build_cache.ps1` 是该流程内部步骤，不替代完整发布入口。

禁止事项：

- 禁止添加 `-p sijuelishi-prod`。
- 禁止生产 `up -d --build` 或默认 `--no-cache`。
- 禁止同一组件连续重复构建。
- 禁止无条件 `docker builder/buildx/system prune`。
- 禁止任何部署脚本删除 volume。

Java 正式发布固定使用 Maven offline 模式，统一发布脚本不会联网补依赖。只有 POM 确实增加依赖、且负责人明确批准下载后，才单独运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/prepare_java_maven_cache.ps1 -AllowNetworkDownload
```

该脚本只预热固定缓存 `sjzm-maven-repository`，不发布、不轮换、不重启生产服务。没有显式 `-AllowNetworkDownload` 时脚本直接拒绝执行。

**线上**（`/root/woeau_web/ai-selection-deploy`）：本机推新 tag 到阿里云后，改服务器 `.env` 里的 `FRONTEND_IMAGE` / `JAVA_IMAGE` / `BACKEND_IMAGE` / `AI_CENTER_IMAGE`，然后 `docker compose up -d`。容器名不用改，Web 就是 `prod-frontend`。

本地 Docker MySQL（`prod-mysql` / `sijuelishi`）迁到另一台机器，只用：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/migrate_local_mysql.ps1 -Action Export
powershell -ExecutionPolicy Bypass -File scripts/deploy/migrate_local_mysql.ps1 -Action Import -DumpFile <path.sql>
```

默认 `-Action Export` 是瘦身包：117 张表结构全要，配置小表整表带走，产品相关表每个站点最多 100 行。不导 9.8GB 全量。需要全量时才加 `-Mode Full`。脚本只连本地容器，不连 RDS。
