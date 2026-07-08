# 领星产品表现月更操作手册

## 目标

同步领星 UK + DE 产品表现数据到 dev 库 `lingxing_product_performance`，只保留我们需要的 6 个打标商品。

## 前置条件

- Java 后端 `java-product` 容器运行中
- 领星店铺数据已同步（`lingxing_seller` 表已有数据）
- 领星凭证已配置（`LINGXING_APP_ID`、`LINGXING_APP_SECRET`）

## 操作步骤

### 1. 验证领星链路

```bash
curl -s -X POST http://localhost:8002/api/v1/modules/lingxing/ping
```

预期返回：`{"code":200, "data": {"token":"OK"}}`

如果失败，检查：
- 领星后台 IP 白名单是否包含当前服务器公网 IP
- 凭证是否过期（`POST /credentials` 更新）
- token 接口返回了什么错误

### 2. 同步指定国家的产品表现

> **重要：UK 和 DE 必须串行执行**，不要同时跑。两个请求会抢领星令牌桶，触发限流 3001008。

#### 同步 UK（mid=4，115 家店铺）

```bash
UK=$(docker exec dev-mysql mysql -uroot -proot -N -B -e "SELECT GROUP_CONCAT(sid ORDER BY sid SEPARATOR ',') FROM sijuelishi_dev.lingxing_seller WHERE status=1 AND mid=4")

curl -s -X POST http://localhost:8002/api/v1/modules/lingxing/product-performance/sync \
  -H "Content-Type: application/json" \
  -d "{\"sids\":[$UK],\"startDate\":\"$(date +'%Y-%m-%d' -d '7 days ago')\",\"endDate\":\"$(date +'%Y-%m-%d')\",\"summaryField\":\"asin\"}"
```

#### 等待完成后，再同步 DE（mid=5，115 家店铺）

```bash
DE=$(docker exec dev-mysql mysql -uroot -proot -N -B -e "SELECT GROUP_CONCAT(sid ORDER BY sid SEPARATOR ',') FROM sijuelishi_dev.lingxing_seller WHERE status=1 AND mid=5")

curl -s -X POST http://localhost:8002/api/v1/modules/lingxing/product-performance/sync \
  -H "Content-Type: application/json" \
  -d "{\"sids\":[$DE],\"startDate\":\"$(date +'%Y-%m-%d' -d '7 days ago')\",\"endDate\":\"$(date +'%Y-%m-%d')\",\"summaryField\":\"asin\"}"
```

> 时间窗每次取最近 7 天（上述脚本自动计算），跨度不要超过 92 天。
> 建议每月 1 号跑一次，拉上个月最后 7 天的数据。

### 3. 查询目标标签商品数（验证）

同步后通过以下 6 个标签筛选：

| 标签 | HEX 编码 |
|------|---------|
| 绿标 | E7BBBFE6A087 |
| 欧洲精铺2025 | E6ACA7E6B4B2E7B2BEE993BA32303235 |
| 欧洲精铺2025非标品 | E6ACA7E6B4B2E7B2BEE993BA32303235E99D9EE6A087E59381 |
| 欧洲精铺2025季节性断货 | E6ACA7E6B4B2E7B2BEE993BA32303235E5ADA3E88A82E680A7E696ADE8B4A7 |
| 欧洲精铺2025待淘汰 | E6ACA7E6B4B2E7B2BEE993BA32303235E5BE85E6B798E6B1B0 |
| 欧洲精铺2025淘汰 | E6ACA7E6B4B2E7B2BEE993BA32303235E6B798E6B1B0 |

```sql
SELECT COUNT(DISTINCT asin)
FROM lingxing_product_performance
WHERE raw_json LIKE CONCAT('%', UNHEX('E6ACA7E6B4B2E7B2BEE993BA32303235'), '%')
   OR raw_json LIKE CONCAT('%', UNHEX('E7BBBFE6A087'), '%')
   OR raw_json LIKE CONCAT('%', UNHEX('E6ACA7E6B4B2E7B2BEE993BA32303235E6B798E6B1B0'), '%')
   OR raw_json LIKE CONCAT('%', UNHEX('E6ACA7E6B4B2E7B2BEE993BA32303235E99D9EE6A087E59381'), '%')
   OR raw_json LIKE CONCAT('%', UNHEX('E6ACA7E6B4B2E7B2BEE993BA32303235E5ADA3E88A82E680A7E696ADE8B4A7'), '%')
   OR raw_json LIKE CONCAT('%', UNHEX('E6ACA7E6B4B2E7B2BEE993BA32303235E5BE85E6B798E6B1B0'), '%');
```

正常结果：UK+DE 合计约 **6,000+** 个独立 ASIN。

## 时间预估

| 步骤 | 耗时 |
|------|------|
| 验证链路 + 获取 sid | <1 分 |
| 同步 UK（~19 页 × 10s/页限流） | ~3 分 |
| 同步 DE（~13 页 × 10s/页限流） | ~2 分 |
| 容错缓冲（可能的限流重试） | ~3 分 |
| **合计** | **~10 分钟** |

> 如果触发限流 3001008，代码会自动重试（最多 5 次，每次等 15s），耗时可能延长到 15~20 分钟。
> 如果触发 103（请勿频繁请求），需要人工等 30 秒后重新跑该国家的同步。

## 常见问题

### 限流 3001008
已自动处理，无需人工介入。如果连续重试 5 次仍失败，等 30 秒后重新跑该国家。

### 限流 103（请勿频繁请求）
人工处理：**不要并行跑 UK 和 DE**。等 30 秒后重试。

### 同步成功但数据量明显偏少
检查：
1. 时间窗是否太短（建议 ≥7 天）
2. 店铺列表是否完整（`SELECT COUNT(*) FROM lingxing_seller WHERE status=1 AND mid=4` 应为 115 家）
3. 领星凭证是否有对应权限

### 标签名称变了
如果领星后台改了标签名称（如 "欧洲精铺2025" → "欧洲精铺2026"），需要更新：
1. 本手册的 HEX 编码对照表
2. 查询 SQL 里的 HEX 条件

## 参考

- `LingxingClient.java` — 限流自动重试逻辑（`sendWithRetry` 方法）
- `LingxingProductPerformanceSyncService.java` — 同步服务
- `lingxing_product_performance` 表 — 唯一键 `uk_biz_key`（SHA-256 幂等键）
- `lingxing_local_product` 表 — 36,848 条本地产品（产品标签 `global_tags`）
