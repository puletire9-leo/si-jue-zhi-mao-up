# analysis-baseline · 后端结构

> 目标：把商品数据处理、市场基线、店铺画像、店铺基线、商品族证据、方法卡命中缓存统一纳入清晰后端结构。本文记录代码位置、SQL 文件、接口和需要开发模式验证的点。

---

## 一、后端包结构

```text
java-backend/sjzm-product/src/main/java/com/sjzm/product/modules/analysisbaseline
├─ shopprofile
│  ├─ controller
│  │  ├─ ShopProfileController.java
│  │  └─ ShopProfileBaselineController.java
│  ├─ dto
│  │  ├─ ShopProfileSummary.java
│  │  ├─ ShopProfileDetail.java
│  │  ├─ ShopProfileProduct.java
│  │  ├─ ShopProfileCategory.java
│  │  ├─ ShopProfileComputeResult.java
│  │  ├─ ShopProfilePositioningResult.java
│  │  └─ ShopProfilePositioningComputeResult.java
│  ├─ entity
│  │  ├─ ShopProfileSnapshot.java
│  │  ├─ ShopProfileCategoryEntity.java
│  │  ├─ ShopProfileBaseline.java
│  │  ├─ ShopProfileBaselineMember.java
│  │  └─ ShopProfilePositioningResultEntity.java
│  ├─ mapper
│  │  ├─ ShopProfileMapper.java
│  │  ├─ ShopProfileSnapshotMapper.java
│  │  ├─ ShopProfileCategoryEntityMapper.java
│  │  ├─ ShopProfileBaselineMapper.java
│  │  ├─ ShopProfileBaselineMemberMapper.java
│  │  └─ ShopProfilePositioningResultMapper.java
│  └─ service
│     ├─ ShopProfileService.java
│     ├─ ShopProfileBaselineService.java
│     └─ impl
│        ├─ ShopProfileServiceImpl.java
│        └─ ShopProfileBaselineServiceImpl.java
├─ productfamily
│  ├─ controller
│  │  └─ ProductFamilyEvidenceController.java
│  ├─ entity
│  │  ├─ ProductFamilyGroup.java
│  │  └─ ProductFamilyMember.java
│  ├─ mapper
│  │  ├─ ProductFamilyGroupMapper.java
│  │  └─ ProductFamilyMemberMapper.java
│  └─ service
│     ├─ ProductFamilyEvidenceService.java
│     └─ impl/ProductFamilyEvidenceServiceImpl.java
└─ methodevidence
   ├─ entity/MethodProductHit.java
   └─ mapper/MethodProductHitMapper.java
```

## 二、SQL 文件

需要你在开发模式数据库手动执行：

```text
java-backend/sql/create_analysis_baseline_tables.sql
```

包含表：

| 表 | 用途 | 当前状态 |
|---|---|---|
| `shop_profile_snapshot` | 店铺画像快照 | compute 接口会写入 |
| `shop_profile_category` | 店铺画像类目结构 | compute 接口会写入 |
| `shop_profile_baseline` | 店铺基线 | CRUD 接口已准备 |
| `shop_profile_baseline_member` | 店铺基线成员 | CRUD 接口已准备 |
| `shop_profile_positioning_result` | 店铺画像基线定位结果 | compute-positioning 接口会写入 |
| `product_family_group` | 商品族证据组 | CRUD 骨架已准备 |
| `product_family_member` | 商品族证据成员 | CRUD 骨架已准备 |
| `method_product_hit` | 方法卡商品命中缓存 | 表和实体已准备，暂不接入写入 |

补充 SQL：

```text
java-backend/sql/add_marketplace_to_deng_zong_shop_unique_key.sql
```

用途：把 `deng_zong_shop` 唯一索引从 `(asin, month, batch_date)` 调整为 `(marketplace, asin, month, batch_date)`。店铺画像和郑总 UK/DE clean 数据导入必须允许同一 ASIN 同时存在于不同市场。

## 三、已实现接口

### 市场编码约束

`marketplace` 对齐卖家精灵 `marketplaceString` / `marketplace` 市场编码，是具体国家站点，不是聚合维度。

当前系统只支持：

```text
UK / DE / US
```

不存在 `ALL` 市场编码。店铺画像计算、定位计算、单店详情、商品族成员写入都必须传具体市场。

### 店铺画像

```text
GET  /api/v1/shop-profile/summary
POST /api/v1/shop-profile/compute
GET  /api/v1/shop-profile/snapshots
GET  /api/v1/shop-profile/{marketplace}/{sellerName}
GET  /api/v1/shop-profile/{marketplace}/{sellerName}/products
GET  /api/v1/shop-profile/{marketplace}/{sellerName}/categories
GET  /api/v1/shop-profile/positioning
POST /api/v1/shop-profile/positioning/compute
GET  /api/v1/shop-profile/{marketplace}/{sellerName}/positioning
```

说明：

- `summary/detail/products/categories` 第一版可直接从 `deng_zong_shop` 实时聚合，不依赖新表。
- `compute` 需要先执行 SQL，写入 `shop_profile_snapshot` 和 `shop_profile_category`。
- `snapshots` 从物化快照读，适合前端列表页和较大数据量页面。
- `positioning` 基于快照 + 基线成员实时计算店铺相似度。
- `positioning/compute` 把相似度结果写入 `shop_profile_positioning_result`，适合后续前端直接读缓存结果。
- 默认未传 `batchDate` 时，按具体 `marketplace` 自动使用最新批次。
- 默认口径为 `variationMode=Y`。

### 店铺基线

```text
GET    /api/v1/shop-profile/baselines
POST   /api/v1/shop-profile/baselines
PUT    /api/v1/shop-profile/baselines/{id}
GET    /api/v1/shop-profile/baselines/{baselineCode}/members
POST   /api/v1/shop-profile/baselines/{baselineCode}/members
DELETE /api/v1/shop-profile/baselines/members/{id}
```

用途：

- 录入郑总 UK/DE 基线。
- 录入自有优质店基线。
- 录入方法卡高命中店基线。
- 后续店铺对标定位会消费这些基线成员。
- 当前已补齐基线定位接口，可以用 `ZHENG_UK_DE`、自有优质店、方法卡高命中店作为不同对标对象。

### 商品族证据

```text
GET  /api/v1/analysis-baseline/product-families
POST /api/v1/analysis-baseline/product-families
GET  /api/v1/analysis-baseline/product-families/{familyCode}/members
POST /api/v1/analysis-baseline/product-families/{familyCode}/members
```

用途：

- 为 M06 爆款多店验证法准备数据结构。
- 当前是证据存储骨架，后续再接自动标题相似、同父体、多店出现计算。

## 四、开发模式验证清单

2026-07-07 已完成开发模式主流程验证。以下清单保留为复跑步骤。

### 1. 执行 SQL

```text
java-backend/sql/create_analysis_baseline_tables.sql
```

执行后先确认表存在：

```sql
SHOW TABLES LIKE 'shop_profile_%';
SHOW TABLES LIKE 'product_family_%';
SHOW TABLES LIKE 'method_product_hit';
```

预期至少能看到：

```text
shop_profile_snapshot
shop_profile_category
shop_profile_baseline
shop_profile_baseline_member
shop_profile_positioning_result
product_family_group
product_family_member
method_product_hit
```

### 2. 启动 Java product 服务

开发模式启动后，先确认接口能访问 Swagger 或健康日志正常。

### 3. 验证市场编码约束

`marketplace` 必须是具体站点，目前只支持 `UK / DE / US`。

正向样例：

```text
GET /api/v1/shop-profile/summary?marketplace=UK&limit=20
```

负向样例：

```text
GET /api/v1/shop-profile/summary?marketplace=ALL&limit=20
```

预期：应返回参数错误，不允许 `ALL`。

### 4. 请求实时画像接口并对照 Excel

```text
产品数据/邓总店铺/sellersprite_raw/zheng_clean_no_variants_20260707/sales_tier_model/郑总店铺_UK_DE_商品销量分级模型.xlsx
```

重点看：

- UK/DE 商品总数是否接近 clean Excel。
- 单店 A/B/C/D 数量是否一致。
- A / ABC / D top 类目是否合理。

### 5. 执行画像物化

```text
POST /api/v1/shop-profile/compute?marketplace=UK
POST /api/v1/shop-profile/compute?marketplace=DE
```

可选：US 暂时只有你后续有数据时再跑。

检查写入：

```sql
SELECT marketplace, batch_date, COUNT(*) FROM shop_profile_snapshot GROUP BY marketplace, batch_date;
SELECT marketplace, batch_date, COUNT(*) FROM shop_profile_category GROUP BY marketplace, batch_date;
```

### 6. 创建基线

```text
POST /api/v1/shop-profile/baselines
```

建议第一批：

```json
{
  "baselineCode": "ZHENG_UK_DE",
  "baselineName": "郑总 UK/DE 精铺基线",
  "baselineType": "ZHENG",
  "marketplaceScope": "UK,DE",
  "createdBy": "manual"
}
```

### 7. 添加基线成员

```text
POST /api/v1/shop-profile/baselines/ZHENG_UK_DE/members
```

成员 `marketplace` 也只能是 `UK / DE / US`。

### 8. 验证基线定位

```text
GET /api/v1/shop-profile/positioning?baselineCode=ZHENG_UK_DE&marketplace=UK&limit=50
GET /api/v1/shop-profile/UK/{sellerName}/positioning?baselineCode=ZHENG_UK_DE
```

### 9. 物化基线定位结果

```text
POST /api/v1/shop-profile/positioning/compute?baselineCode=ZHENG_UK_DE&marketplace=UK
POST /api/v1/shop-profile/positioning/compute?baselineCode=ZHENG_UK_DE&marketplace=DE
```

检查定位结果表：

```sql
SELECT baseline_code, marketplace, batch_date, COUNT(*)
FROM shop_profile_positioning_result
GROUP BY baseline_code, marketplace, batch_date;
```

### 10. 最小验收口径

- [x] SQL 建表和接口写入逻辑可运行。
- [x] `compute` 后快照表有对应 `marketplace + batch_date` 数据。
- [x] `positioning` 能返回 `similarityScore / positioningLabel / profileAdvice`。
- [x] `marketplace=ALL` 或其他非 `UK/DE/US` 值会报错。
- [x] SQL 执行和接口验证过程不修改 SellerSprite 抓取次数统计。
- [x] `UK / DE` summary 与郑总 clean Excel 总量、A/B/C/D 分布严格对照：完整 clean 数据环境已复跑，导入结果与 7.7 clean 抓取数据完全一致。

严格对照结果：

| 市场 | 店铺数 | 商品行数 | A | B | C | D | UNKNOWN |
|---|---:|---:|---:|---:|---:|---:|---:|
| UK | 45 | 5559 | 263 | 580 | 2448 | 2233 | 35 |
| DE | 20 | 1254 | 36 | 128 | 531 | 555 | 4 |
| 合计 | 65 | 6813 | 299 | 708 | 2979 | 2788 | 39 |

验证接口：

```text
POST /api/v1/shop-profile/compute?marketplace=UK
POST /api/v1/shop-profile/compute?marketplace=DE
POST /api/v1/shop-profile/positioning/compute?baselineCode=ZHENG_UK_DE&marketplace=UK
POST /api/v1/shop-profile/positioning/compute?baselineCode=ZHENG_UK_DE&marketplace=DE
```

### 11. 已修复问题

开发模式验证时发现 MyBatis-Plus 对连续大写字段的默认驼峰映射会把 `ABC` 拆成 `a_b_c`，导致运行时找错列，例如 `top_a_b_c_category`。

已在 `889b501` 修复：

```text
ShopProfileSnapshot
ShopProfilePositioningResultEntity
```

显式映射字段：

```text
abcCount -> abc_count
abcRatio -> abc_ratio
topABCCategory -> top_abc_category
dAbcOverlapRatio -> d_abc_overlap_ratio
baselineAvgAbcRatio -> baseline_avg_abc_ratio
```

## 五、当前不做但已预留

- product-family 自动聚类。
- M06 自动候选接口。
- method_product_hit 的统一方法卡命中缓存写入。
- M04 同步 clean 表。
- 类目字段 `category_l1/l2/leaf` 的物理沉淀。

## 六、编译验证

已通过：

Java 生产镜像内编译（`java-backend/Dockerfile.prod`），发布入口：

```text
powershell -ExecutionPolicy Bypass -File scripts/deploy/deploy_prod.ps1 -Component java
```

结果：

```text
BUILD SUCCESS
```
