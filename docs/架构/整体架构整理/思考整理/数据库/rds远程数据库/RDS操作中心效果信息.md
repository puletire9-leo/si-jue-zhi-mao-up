# RDS 操作中心 效果信息

> 2026-08-13 建。sjzm-user 是全系统唯一直连阿里云 RDS `ai_platform` 库的服务，
> RDS 相关操作代码集中在此。本文记录建成效果、接口、验证结果，供后续复用。
> 代码级说明另见：`java-backend/sjzm-user/src/main/java/com/sjzm/user/RDS操作中心.md`

## 一、连接隔离（铁律）

| 服务 | 连什么库 | 是否加载 user-prod.env |
|------|---------|----------------------|
| **sjzm-user** | **RDS ai_platform** | ✅ 唯一，走 `USER_MYSQL_*` |
| sjzm-product / gateway / Python / Celery | Docker 本地 `prod-mysql` | ❌ 都不加载 |

只有 `prod-java-user` 容器在 `docker-compose.prod.yml` 多加载 `config/public/user-prod.env` + `config/secrets/user-prod.env`。**改 RDS 连接只重启 java-user，别动别的。**

## 二、RDS 连接信息

| 项 | 值 |
|----|-----|
| 域名 | `rm-bp1ft07y37887765cqo.mysql.rds.aliyuncs.com` |
| 公网 IP | `101.37.51.239` |
| 端口 | `3306` |
| 库 | `ai_platform` |

**账号（凭证总账见 system_config 表）：**
- 读写 `ai_platform_app` / `Zl@13873979376` —— `@%` 超权（含 GRANT/DROP/CREATE USER），仅本服务用，**勿外发**
- 只读 `feishu_ro` / `Feishu2026ro` —— 仅 `SELECT ai_platform.*`，给飞书等外部只读方（已验证可读不可写）

**RDS 现有业务库（2026-08-14）：**

| 库 | 内容 | 谁在连 |
|----|------|-------|
| `ai_platform` | users 39 行 + system_config 17 行 | sjzm-user（唯一） |
| `sijuelishi` | 107 张业务表结构（**空壳，只迁结构未搬数据**） | 暂无（后续业务后端逐步改连） |

> `sijuelishi` 专用库 2026-08-14 建：从本地 Docker `prod-mysql` 的 sijuelishi 库导出 107 张干净表结构（`mysqldump --no-data --no-tablespaces`，清洗 AUTO_INCREMENT，SHA 双向校验），DROP 掉 RDS 上残留的旧版 130 表快照后重灌。逐表比对零差异。**连库切换（sjzm-product / Python / Celery 改连此库）是独立后续步骤，今天只备空壳。** 详见 `docs/日志/2026-08/8.14.md`。DDL 源：`backend/database/backup/sijuelishi_schema_20260814_clean.sql`。

## 三、system_config 凭证总账表

集中存 RDS/飞书/代理/CLI 配置（经业主授权含明文密码，当前 17 行）。

**表结构**（RDS `ai_platform.system_config`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGINT AUTO_INCREMENT | 主键 |
| config_key | VARCHAR(128) UNIQUE | 配置键，如 rds.host / feishu.app_id |
| config_value | TEXT | 配置值（含明文密码） |
| category | VARCHAR(64) | rds / feishu / proxy / system |
| description | VARCHAR(512) | 说明 |
| created_at / updated_at | DATETIME | 时间戳 |

**已存内容分类：**
- `rds.*`：host / public_ip / port / database / rw_user / rw_password / ro_user / ro_password
- `feishu.*`：app_id / app_secret / brand / user_name / open_id / base_url / whitelist_ip
- `proxy.local`：本机代理 `127.0.0.1:7890`
- `cli.config_path`：飞书 CLI 配置文件路径

## 四、代码结构（sjzm-user）

| 层 | 类 | 职责 |
|----|-----|------|
| entity | `entity/SystemConfig` | `@TableName("system_config")` + `@TableId(AUTO)` |
| mapper | `mapper/SystemConfigMapper` | `extends BaseMapper`（老约定包，无需改 @MapperScan） |
| service | `service/SystemConfigService(Impl)` | listAll / listByCategory / getValue / getByKey / upsert |
| controller | `controller/SystemConfigController` | `/api/v1/system-config`，**全部 @PreAuthorize("hasRole('ADMIN')")** |

## 五、接口（仅 admin，凭证表含明文密码）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/system-config` | 全部配置 |
| GET | `/api/v1/system-config/by-category?category=rds` | 按分类 |
| GET | `/api/v1/system-config/by-key?key=rds.host` | 按键单条 |

鉴权链路：SecurityConfig 开 `@EnableMethodSecurity`，JwtAuthenticationFilter 把 role 映射为 `ROLE_ + role.toUpperCase()`，故 admin → `ROLE_ADMIN`。

## 六、编译与发布状态

- **已编译验证通过**：`docker compose -f docker-compose.prod.yml build java-user` 一次全量编译整个 reactor（BUILD SUCCESS，含 user+product）。
- **未重启、未发布**：接口尚未在运行服务生效。要生效需构建并重启（走统一部署脚本 `scripts/deploy/deploy_prod.ps1`）。

## 七、执行 SQL 的稳妥姿势（避坑）

遵守内存铁律：禁止高频 docker exec（打爆 WSL2 内存）、禁止全新容器 mvn -am。SQL 写文件 → docker cp → 一次执行（避开 PowerShell 引号地狱）：

```powershell
$sql | Out-File -FilePath ".\_x.sql" -Encoding utf8 -NoNewline
docker cp ".\_x.sql" prod-mysql:/tmp/_x.sql
docker exec prod-mysql sh -c "mysql -h rm-bp1ft07y37887765cqo.mysql.rds.aliyuncs.com -P 3306 -u ai_platform_app -p'Zl@13873979376' ai_platform < /tmp/_x.sql 2>&1"
# 用完清理宿主机 + 容器临时文件
```

## 八、验证记录（2026-08-13）

- system_config 建表 + 写入 17 行成功。
- `feishu_ro` 只读账号查 `SELECT COUNT(*) FROM system_config` → 17，读成功。
- `feishu_ro` 执行 `CREATE TABLE` → ERROR 1142 拒绝，确认纯只读。
- 登录验收（走 gateway 真实链路）：`admin/admin` → 200；`刘淼/123456`（明文）→ 200。
