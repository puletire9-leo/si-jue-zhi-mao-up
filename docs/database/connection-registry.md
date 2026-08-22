# 数据库连接登记

> 更完整的新旧文件与缺口说明见 [docs/rds中心/README.md](../rds中心/README.md)。

连接参数只放在 `config/`，页面不存密码。运行中的绑定见 **RDS 管理中心**（`/rds-management-center`）。

| 变量组 | 文件 | 库 | 谁用 |
|--------|------|----|------|
| `USER_MYSQL_*` | `config/public/user-prod.env` + `config/secrets/user-prod.env` | `ai_platform` | sjzm-user；Python/Celery 同步加载 |
| `RDS_*` | `config/public/prod.env` + `config/secrets/prod.env` | 远程 `sijuelishi` | sjzm-product 主库 + 领星/财务池；Python/Celery 业务库（有 `RDS_HOST` 时覆盖 `MYSQL_*`） |
| `MYSQL_*` | 同上 prod.env | Docker `prod-mysql` | **只给 MySQL 容器初始化**和宿主机脚本。不要改成公网 IP。 |

同一阿里云实例：`USER_MYSQL_HOST` 用内网/RDS 域名，`RDS_HOST` 当前为公网 IP `101.37.51.239`。

接口清单源码：`java-backend/sjzm-product/.../rds/center/RdsCenterCatalog.java`。
