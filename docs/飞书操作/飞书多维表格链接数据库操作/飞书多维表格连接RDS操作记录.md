# 飞书多维表格连接 RDS 操作记录

> 2026-08-13。目的：飞书多维表格「数据库同步表」直连阿里云 RDS，读业务数据。

## 一、连接信息（填多维表格数据库连接界面）

| 字段 | 值 | 注意 |
|------|-----|------|
| 数据库地址 | `rm-bp1ft07y37887765cqo.mysql.rds.aliyuncs.com` | 或公网 IP `101.37.51.239` |
| 端口 | `3306` | |
| 数据库名 | `ai_platform` | |
| 用户名 | `feishu_ro` | ⚠️ **开头结尾不能有空格**（见坑 2） |
| 密码 | `Feishu2026ro` | 纯字母数字，避免特殊符号填写出错 |

> 账号只读（仅 `SELECT ai_platform.*`），已服务端验证可读不可写。凭证总账见 RDS `system_config` 表（category=rds）。

## 二、前置：RDS 外网 + 白名单（缺一不可）

1. **申请外网地址**：阿里云 RDS 控制台 → 数据库连接 → 申请外网地址。
   内网域名飞书 DNS 解析不了（报 `no such host`），必须开外网。本实例外网公网 IP `101.37.51.239`。
2. **白名单加飞书数据库连接器出口 IP**（不使用代理）：
   ```
   123.58.10.238,123.58.10.239,101.126.59.4,101.126.59.5,101.126.59.6
   ```
   > 注意区分：飞书「自动化」出口 IP 与「数据库连接器」出口 IP 不同，这里用的是**数据库连接器**的 IP。

## 三、踩过的坑

### 坑 1：`no such host`
飞书填内网域名连不上，报 no such host。原因：`rm-...mysql.rds.aliyuncs.com` 内网域名只在阿里云 VPC 内解析，公网服务解析不到。
**解法**：申请 RDS 外网地址（见上）。

### 坑 2（最坑）：用户名带空格 → 1045 Access denied
报错 `Access denied for user ' ai_platform_app'@'101.126.71.114'` —— 用户名 `' ai_platform_app'` **前面多一个空格**。MySQL 用户名区分空格，`␣ai_platform_app` 是不存在的用户。
关键判断：报错是 **1045 Access denied 而非超时**，说明**白名单已放通**（能握手到 MySQL），纯粹是账号认证问题。
**解法**：填用户名时手动检查开头无空格，最好复制粘贴不手打。

## 四、feishu_ro 只读账号创建（推荐给飞书用，别用生产读写账号）

生产读写账号 `ai_platform_app` 是 `@%` + 含 GRANT/DROP/CREATE USER 的超权账号，给飞书太危险。单独建只读账号：

```sql
CREATE USER IF NOT EXISTS 'feishu_ro'@'%' IDENTIFIED BY 'Feishu2026ro';
GRANT SELECT ON ai_platform.* TO 'feishu_ro'@'%';
FLUSH PRIVILEGES;
```

**执行姿势**（避开 PowerShell 引号地狱，遵守"禁止高频 docker exec"，SQL 写文件一次执行）：
```powershell
$sql | Out-File -FilePath ".\_x.sql" -Encoding utf8 -NoNewline
docker cp ".\_x.sql" prod-mysql:/tmp/_x.sql
docker exec prod-mysql sh -c "mysql -h rm-bp1ft07y37887765cqo.mysql.rds.aliyuncs.com -P 3306 -u ai_platform_app -p'Zl@13873979376' ai_platform < /tmp/_x.sql 2>&1"
```

**验证只读**（读成功 + 写被拒 1142）：
```sql
SELECT COUNT(*) FROM users;              -- ✅ 39
CREATE TABLE _should_fail(id int);       -- ❌ ERROR 1142 CREATE command denied
```

## 五、免费版限制

多维表格免费版：**3 张同步表 / 单表 1000 行**。小表（如 users 39 行）没问题；大表（竞品/店铺几十万行）会被截断到 1000 行，需升企业版或改增量/筛选同步。

## 六、连接顺序回顾

```
申请 RDS 外网地址 → 白名单加飞书 IP → 建 feishu_ro 只读账号 → 多维表格填外网地址+feishu_ro（检查无空格）
```
