# 数据库建立

> 一键从零搭建 dev / prod MySQL 数据库.

## 目录结构

```
数据库建立/
├── README.md                 # 你正在看的这份
├── dev/
│   ├── 01_schema.sql         # dev 库 schema (83 张表)
│   └── 02_baseline_data.sql  # dev 库基线数据 (类目基线/别名/错位/API 配置)
├── prod/
│   ├── 01_schema.sql         # prod 库 schema (84 张表)
│   └── 02_baseline_data.sql  # prod 库基线数据
└── scripts/
    ├── dump_schema.sh        # 从某个 mysql 容器抓 schema
    ├── dump_baseline.sh      # 从某个 mysql 容器抓基线数据
    ├── init_dev.sh           # 一键建 dev 库
    └── init_prod.sh          # 一键建 prod 库 (生产保护开关)
```

## 设计原则

- **dev / prod 完全独立**: 各自一份 schema + 各自一份基线数据, 互不交叉.
- **schema 自动排除废弃表**: 表名形如 `_xxx` / `xxx_old` / `xxx_backup` 不会进新建库.
- **baseline 文件只含 INSERT, 不含 CREATE**: 必须先跑 `01_schema.sql` 再跑 `02_baseline_data.sql`.
- **不含业务大数据**: `competitor_products` / `asin_import_results` / `deng_zong_shop` 等业务表只建结构, 数据走 6.23 备份单独导入.

## 一键建库

### DEV

```bash
# 1. 先确认 dev MySQL 容器在跑
docker compose -f docker-compose.dev.yml up -d mysql

# 2. 一键建库 (默认 sijuelishi_dev, 密码 root)
bash 产品数据/数据库建立/scripts/init_dev.sh
```

可覆盖的环境变量:
```bash
DEV_MYSQL_CONTAINER=dev-mysql       # 容器名
DEV_MYSQL_USER=root                 # 用户
DEV_MYSQL_PASSWORD=root             # 密码
DEV_MYSQL_DATABASE=sijuelishi_dev   # 库名
```

### PROD

```bash
# 1. 先确认 prod MySQL 容器在跑
docker compose -f docker-compose.prod.yml -p sijuelishi-prod up -d mysql

# 2. 必须显式传密码 (生产保护)
PROD_MYSQL_PASSWORD=root123456 bash 产品数据/数据库建立/scripts/init_prod.sh
```

⚠️ **生产保护机制**:
- 如果 `sijuelishi` 库已有表, 默认**拒绝执行**.
- 要重建必须 `FORCE=yes` + 手动输入 `DROP` 确认:
  ```bash
  FORCE=yes PROD_MYSQL_PASSWORD=xxx bash 产品数据/数据库建立/scripts/init_prod.sh
  ```

## 重新生成迁移文件 (schema 变更后)

如果 dev 或 prod 表结构有变 (新增列/新建表), 重新跑 dump:

```bash
# DEV 端 (dev-mysql 在跑)
bash 产品数据/数据库建立/scripts/dump_schema.sh   dev-mysql  root root             sijuelishi_dev 产品数据/数据库建立/dev/01_schema.sql
bash 产品数据/数据库建立/scripts/dump_baseline.sh dev-mysql  root root             sijuelishi_dev 产品数据/数据库建立/dev/02_baseline_data.sql

# PROD 端
bash 产品数据/数据库建立/scripts/dump_schema.sh   prod-mysql root root123456       sijuelishi     产品数据/数据库建立/prod/01_schema.sql
bash 产品数据/数据库建立/scripts/dump_baseline.sh prod-mysql root root123456       sijuelishi     产品数据/数据库建立/prod/02_baseline_data.sql
```

提交到 git:
```bash
git add 产品数据/数据库建立/
git commit -m "chore: 更新数据库迁移脚本 (schema 变更 xxx)"
```

## 基线表清单

`02_baseline_data.sql` 里包含这 10 张表的数据 (总 <500KB):

| 表 | 说明 | dev | prod |
|---|---|---|---|
| `category_bsr_baseline` | 大类 BSR 基线 | 147 | 147 |
| `subcategory_baseline` | 小类基线 | 174 | 174 |
| `category_age_tier_baseline` | 年龄段基线 | 51 | 51 |
| `subcategory_alias_map` | 小类别名映射 | 1459 | 1459 |
| `category_dislocation` | 错位规则 | 39 | 39 |
| `category_heat_matrix` | 类目热度矩阵 | 22 | (空) |
| `grade_thresholds` | 评分等级阈值 | (空) | (空) |
| `scoring_config` | 评分配置 | (空) | (空) |
| `system_config` | 系统配置 | (空) | (空) |
| `api_config` | 三方 API 配置 | 43 | (跟 dev 数量比可能略不同) |

> dev/prod 数量不同是正常的, dev 跑得快, 基线/字典通常先在 dev 沉淀.

## 业务数据导入

迁移脚本**不含**业务大数据. 完整生产数据需要单独从 6.23 备份导入:

```bash
# 把 1.1GB 备份导入 prod (产品数据/数据库备份/6.23/sijuelishi_20260623.sql)
docker cp "产品数据/数据库备份/6.23/sijuelishi_20260623.sql" prod-mysql:/tmp/prod.sql
docker exec prod-mysql sh -c "mysql -uroot -proot123456 sijuelishi < /tmp/prod.sql"
```

> 详细步骤见 `docs/docker使用经验/部署流程.md`.

## 踩坑提醒

1. **mysqldump 警告会污染 SQL**: 重定向时用 `2>/dev/null`, **不要** `2>&1`.
2. **baseline 文件只能在 schema 之后跑**: 否则 INSERT 找不到表.
3. **prod 跑 init 前一定看清楚**: 默认有保护, 但 `FORCE=yes` 会直接 DROP 整个 prod 库.
4. **Git Bash 中文路径 docker cp 会失败**: 改用 PowerShell 或 cmd, 或把文件先放到无中文路径再 cp.
