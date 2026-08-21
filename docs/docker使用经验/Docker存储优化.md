# Docker 存储优化与磁盘回收

> 本文件是生产 Docker 存储治理的专项操作手册。生产发布仍以
> [部署流程.md](部署流程.md) 为唯一权威流程。任何清理必须先确认对象归属，禁止用全局清理代替分析。

## 1. 当前基线（2026-08-13）

| 项目 | 当前值 | 说明 |
|---|---:|---|
| D 盘可用空间 | 36.44 GiB | 高于生产构建门禁 15 GiB，但需要持续观察 |
| `docker_data.vhdx` | 57.51 GiB | VHDX 只会自动扩张，内部删除后通常不会自动缩小 |
| Java 编译缓存 | 常态 1 条，约 460 MB | 只保留最新生产构建链 |
| Backend 当前镜像 | 1.23 GB | 已排除本地 SQL 备份，属于优化后的镜像 |
| Backend 上一版镜像 | 3.26 GB | 唯一回滚版本，下一次 backend 发布时轮换删除 |
| 受保护业务卷 | 15 个 | 部署和缓存清理都不得删除 |

本轮构建前 D 盘可用约 41.87 GiB，完成 Java、frontend、backend、AI Center 的实际发布测试后
为 36.44 GiB，下降约 5.43 GiB。主要来源是新镜像、唯一上一版镜像和刚生成的热构建缓存，
不是容器可写层：当前各应用容器可写层都小于 100 KB，Nacos 约 13.7 MB。

普通源码 COPY、旧 JAR 和历史编译构建层只保留最近 3 小时；超过 3 小时未使用后，由下一次
单组件发布自动回收。Maven/pip/npm 的 `exec.cachemount` 热依赖仓库不受该时间规则影响。

## 2. 不可违反的边界

1. 禁止删除、清空、迁移或修改任何 `si-jue-zhi-mao-up_*` 数据卷。
2. 禁止执行 `docker system prune --volumes`、`docker volume prune`。
3. 禁止执行无过滤条件的 `docker buildx prune --all` 或 `docker builder prune --all`。
4. 禁止删除正在运行容器引用的镜像。
5. `prod-java`、`prod-frontend`、`prod-backend`、`prod-ai-center` 常态只保留
   `current`；发布期间临时生成的 `previous` 仅用于失败回退，成功验证后立即删除。
6. 不要把 Docker 数据盘硬限制为 50 GB。达到硬上限时 MySQL、Redis 和日志可能停止写入。
7. VHDX 压缩前必须完成数据库备份、确认备份可读，并完全退出 Docker Desktop。

当前受保护卷包括：

```text
si-jue-zhi-mao-up_dev-models
si-jue-zhi-mao-up_dev-node-modules
si-jue-zhi-mao-up_dev-thumbnails
si-jue-zhi-mao-up_java-m2
si-jue-zhi-mao-up_mysql-data
si-jue-zhi-mao-up_nacos-data
si-jue-zhi-mao-up_nacos-logs
si-jue-zhi-mao-up_prod-download-cache
si-jue-zhi-mao-up_prod-logs
si-jue-zhi-mao-up_prod-models
si-jue-zhi-mao-up_prod-mysql-data
si-jue-zhi-mao-up_prod-nacos-data
si-jue-zhi-mao-up_prod-nacos-logs
si-jue-zhi-mao-up_prod-redis-data
si-jue-zhi-mao-up_redis-data
```

## 3. 只读巡检

先执行以下命令，不要看到 `Reclaimable` 就直接删除：

```powershell
$dockerDrive = Get-PSDrive D
[math]::Round($dockerDrive.Free / 1GB, 2)

$vhdx = Get-Item -LiteralPath "D:\Docker数据\DockerDesktopWSL\disk\docker_data.vhdx"
[math]::Round($vhdx.Length / 1GB, 2)

docker compose -f docker-compose.prod.yml ps
docker image ls --format '{{.Repository}}|{{.Tag}}|{{.ID}}|{{.Size}}'
docker ps -a --size --format '{{.Names}}|{{.Status}}|{{.Size}}'
docker buildx du
docker volume ls --format '{{.Name}}'
```

判断顺序：

1. 先看 D 盘可用空间和 VHDX 文件大小。
2. 再看应用仓库是否除 `current` 外还残留其他标签。
3. 再看 Java `mvn clean package` 是否超过一条。
4. 再看 BuildKit 中超过 3 小时未使用的普通 `regular` 构建层。
5. 最后检查容器可写层和日志；业务数据卷只统计和备份，不自动删除。

`docker system df` 若报 containerd snapshot `no such file or directory`，不要因此执行全局 prune。
使用 `docker image ls`、`docker buildx du` 和 `docker ps -a --size` 分项核对。

## 4. 日常控制：随单组件发布自动执行

只发布本次发生变化的一个组件：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component java
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component frontend
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component backend
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component ai-center
```

不要连续执行四条。统一脚本会对所选组件执行：

```text
预检 -> 轮换 current/previous -> 一次缓存构建 -> --no-deps --no-build 重建
-> 健康验证 -> 删除临时 previous -> Java 编译缓存保留一条 -> 回收超过 3 小时的普通构建层 -> 标签校验
```

所有容器日志已使用 `json-file` 轮转，每个容器最多 `3 x 20 MB`。Backend 的 `.dockerignore`
已经排除 `database/`、`backup/`、`uploads/`、`images/` 和下载缓存；这些本地数据不得再次进入镜像。

## 5. 人工缓存清理

### Java 历史编译结果

Java 发布后统一脚本会自动调用：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy/prune_java_build_cache.ps1
```

该脚本只匹配本项目含在线或 `--offline` 参数的 `mvn clean package` 编译记录，并保护最新一条。不得手工复制缓存 ID 后批量删除，
不得删除 Maven `dependency:go-offline` 热依赖层。

### 其他冷缓存

普通 `regular` 构建层只保留最近 3 小时，超过 3 小时未使用的记录必须清理：

```powershell
docker buildx prune --force --filter "until=3h" --filter "type=regular"
```

最近 3 小时内刚构建完成的普通层暂时保留，便于短时间修复和验证；超过窗口后不再长期保存。
该命令不会选择 `exec.cachemount`，不得去掉 `type=regular` 过滤条件。

### 成品镜像

先只读检查：

```powershell
$repos = @('prod-java', 'prod-frontend', 'prod-backend', 'prod-ai-center')
foreach ($repo in $repos) {
    docker image ls $repo --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}'
}
```

每个仓库常态只允许 `current`。发现残留 `previous` 或其他历史标签时，应先确认发布是否仍在进行、
镜像是否被容器引用，再按 [部署流程.md](部署流程.md) 的临时回退轮换处理；禁止用 `docker image prune -a` 代替判断。

## 6. MySQL 与业务数据

MySQL binlog 当前约 2.17 GB，保留 604800 秒（7 天），无复制通道，属于正常范围。预检强制要求：

- 保留期必须在 3 至 7 天；
- binlog 总量不得超过 5 GB；
- 存在复制通道时停止自动策略并人工评估副本需求。

禁止从数据卷或 VHDX 内直接删除 `binlog.*`。需要缩短保留期或清理时必须通过 MySQL 命令执行，
并先完成数据库备份。业务模型、图片、下载缓存和数据库增长不属于 BuildKit 缓存，不能使用镜像清理
命令处理。

## 7. VHDX 物理压缩

Docker 内部删除镜像或缓存后，`docker_data.vhdx` 中会产生空闲块，但 Windows 文件大小通常不会
自动下降。只有需要把空间真正还给 D 盘时，才在维护窗口执行物理压缩。

1. 确认数据库备份已完成并核对文件大小或 SHA-256。
2. 记录所有生产容器状态。
3. 完全退出 Docker Desktop，确认 Docker Desktop 和 WSL 已停止。
4. 使用管理员终端压缩 VHDX。
5. 启动 Docker Desktop，检查所有生产服务和数据卷挂载。

管理员 PowerShell：

```powershell
wsl --shutdown
diskpart
```

进入 DiskPart 后：

```text
select vdisk file="D:\Docker数据\DockerDesktopWSL\disk\docker_data.vhdx"
attach vdisk readonly
compact vdisk
detach vdisk
exit
```

退出 DiskPart 后必须回到 PowerShell，再查看文件大小：

```powershell
$vhdx = Get-Item -LiteralPath "D:\Docker数据\DockerDesktopWSL\disk\docker_data.vhdx"
[math]::Round($vhdx.Length / 1GB, 2)
```

若提示 `'$vhdx' 不是内部或外部命令`，说明当前是 `cmd.exe`，不是 PowerShell。先输入
`powershell` 或打开新的管理员 PowerShell 再执行 `$vhdx = ...`。

## 8. 告警和处置门槛

| D 盘可用空间 | 处置 |
|---:|---|
| 大于 30 GiB | 正常，只做单组件发布和 3 小时普通构建层维护 |
| 20–30 GiB | 暂停非必要全量测试，检查是否残留非 `current` 应用镜像和普通冷缓存 |
| 15–20 GiB | 禁止多组件连续构建，先完成备份并安排清理 |
| 小于 15 GiB | 生产预检阻止构建；停止发布，人工分析后再处理 |
| 小于 5 GiB | 高风险，不再写入大文件；优先保障 MySQL，安排维护窗口 |

日常目标不是让 VHDX 永远小于 50 GB，而是确保：数据卷安全、应用常态只留 current、Java 编译记录一条、
冷缓存按时间回收、日志轮转生效、D 盘始终保留足够构建和数据库写入空间。
