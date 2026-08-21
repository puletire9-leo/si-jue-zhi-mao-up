# RDS 操作中心（sjzm-user）

> 2026-08-13 建。sjzm-user 是全系统唯一直连阿里云 RDS `ai_platform` 库的服务，
> RDS 相关操作代码沉淀在此，长期复用。

## 一、连接隔离（铁律）

| 服务 | 连什么库 | 说明 |
|------|---------|------|
| **sjzm-user** | **RDS ai_platform** | 唯一连 RDS。走 `USER_MYSQL_*`（见 application.yml + config/*/user-prod.env）|
| sjzm-product / gateway / Python / Celery | Docker 本地 MySQL | 都**不**加载 user-prod.env |

> 只有 `prod-java-user` 容器在 docker-compose.prod.yml 里多加载 `config/public/user-prod.env` + `config/secrets/user-prod.env`。改 RDS 连接只重启 java-user，别动别的。登录兼容明文 + 历史 BCrypt。

## 二、RDS 连接信息

| 项 | 值 |
|----|-----|
| 域名 | `rm-bp1ft07y37887765cqo.mysql.rds.aliyuncs.com` |
| 公网 IP | `101.37.51.239` |
| 端口 | `3306` |
| 库 | `ai_platform` |

**账号（凭证总账见 system_config 表）：**
- 读写 `ai_platform_app` / `Zl@13873979376` —— `@%` 超权（含 GRANT/DROP/CREATE USER），仅本服务用，**勿外发**
- 只读 `feishu_ro` / `Feishu2026ro` —— 仅 `SELECT ai_platform.*`，给飞书等外部只读方

## 三、system_config 凭证总账表

集中存 RDS/飞书/代理/CLI 配置（经业主授权含明文密码）。

- **代码**：`entity/SystemConfig` + `mapper/SystemConfigMapper` + `service/SystemConfigService(Impl)` + `controller/SystemConfigController`
- **接口**：`GET /api/v1/system-config`（全部）、`/by-category?category=rds`、`/by-key?key=...`
- **鉴权**：全部方法 `@PreAuthorize("hasRole('ADMIN')")` —— **仅 admin 可查**（表含明文密码）
- **分类**：rds / feishu / proxy / system

## 四、执行 SQL 的稳妥姿势（避坑）

RDS 在阿里云，从 prod-mysql 容器内的 mysql 客户端发起。**遵守内存铁律**：禁止高频 docker exec（打爆 WSL2 内存）、禁止全新容器 mvn -am。

SQL 写文件 → docker cp → 一次执行（避开 PowerShell 引号地狱）：
```powershell
$sql | Out-File -FilePath ".\_x.sql" -Encoding utf8 -NoNewline
docker cp ".\_x.sql" prod-mysql:/tmp/_x.sql
docker exec prod-mysql sh -c "mysql -h rm-bp1ft07y37887765cqo.mysql.rds.aliyuncs.com -P 3306 -u ai_platform_app -p'Zl@13873979376' ai_platform < /tmp/_x.sql 2>&1"
# 用完清理宿主机 + 容器临时文件
```

## 五、验证登录（RDS 账号可用性）

走 gateway 真实链路。**中文用户名必须 UTF-8 字节发送**，否则 PowerShell GBK 编码误报 401：
```powershell
$json = @{ username="刘淼"; password="123456" } | ConvertTo-Json -Compress
$bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
Invoke-RestMethod -Uri "http://127.0.0.1:9003/api/v1/auth/login" -Method Post -Body $bytes -ContentType "application/json; charset=utf-8"
```

## 六、编译约定

Dockerfile.prod 一次全量编译整个 reactor（common/gateway/user/product 共用一份 jar），
所以 `docker compose -f docker-compose.prod.yml build java-user` **一次**就验证了 user+product 全部代码，无需重复 build java-product。
