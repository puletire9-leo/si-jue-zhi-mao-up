# analysis-baseline · 数据分析基线层

> 定位：L1 干净数据之后，所有“商品数据处理 / 市场基线 / 店铺画像 / 商品族证据”统一进入 `analysis-baseline`。L3 方法卡、店铺定位、前端页面只消费这里产出的证据，不直接重做底层统计。

---

## 一、为什么要有这一层

现在系统里已经出现几类会被反复复用的数据处理能力：

- 商品基础特征：`listing_days`、`weight_g`、`sales_tier`、链接、类目拆解。
- 市场销量基线：大类 BSR 基线、小类销量基线、M04 新品账龄分级。
- 店铺画像证据：A/B/C/D 分布、ABC 稳定盘、D 测品池、店铺基线相似。
- 商品族证据：同 ASIN、同父体、标题相似、多店出现、爆款种子验证。

这些能力都不是方法卡本身，但会被方法卡、店铺分析、前端展示反复消费。  
如果继续散落在不同 service 和 SQL 里，后续 M06、店铺画像、单店详情、方法卡排名都会重复造轮子。

因此统一定义：

```text
L1 数据底座层
  ↓
analysis-baseline 数据分析基线层
  ↓
L3 消费层：方法卡 / 店铺定位 / 产品卡片 / 前端展示
```

## 二、分层职责

### 1. L1 数据底座层

负责原始数据和干净数据：

- `competitor_products`
- `competitor_products_clean`
- `deng_zong_shop`
- 自有战绩原始表
- 字典、别名、清洗结果

L1 只保证数据干净、口径明确，不做业务判断。

### 2. analysis-baseline 数据分析基线层

负责把 L1 数据加工成可复用证据：

| 子模块 | 职责 | 当前代码/表 |
|---|---|---|
| product-feature | 商品基础特征 | `ProductFeatureProcessor`、`sales_tier`、`listing_days`、`weight_g` |
| market-baseline | 市场销量基线 | `category_bsr_baseline`、`subcategory_baseline`、`category_age_tier_baseline` |
| shop-profile-evidence | 店铺画像证据 | `shop_profile_snapshot`、`shop_profile_category`，实时聚合/物化接口已准备 |
| shop-baseline | 店铺基线库 | `shop_profile_baseline`、`shop_profile_baseline_member`、`shop_profile_positioning_result`，基线定位接口已准备 |
| product-family-evidence | 商品族证据 | `product_family_group`、`product_family_member`，CRUD 骨架已准备，自动聚类后续实现 |
| method-evidence-cache | 方法卡证据缓存 | `m01_active` 已有，`method_product_hit` 统一缓存表已预留 |

### 3. L3 消费层

负责组合证据并对用户输出：

- M01 / M02 / M03 / M06 方法卡
- 店铺画像列表页
- 单店详情页
- 店铺基线对标
- 产品卡片 / 机会卡
- 人工复盘视图

L3 可以定义“如何消费证据”，但不应重新计算底层统计。

## 三、核心原则

### 原则 1：基础特征可以共用，方法卡必须独立

`sales_tier`、`listing_days`、`weight_g` 可以被所有方法卡消费。  
但 M01/M03/M06 的命中逻辑必须各自定义，不能把某个基础字段直接等同于方法卡命中。

### 原则 2：市场基线和店铺基线都属于 analysis-baseline

市场基线回答：

```text
这个商品放在所属市场 / 类目 / 账龄里，表现处在什么位置？
```

店铺基线回答：

```text
这家店和郑总基线 / 自有优质店基线 / 方法卡高命中店基线相比，结构像不像？
```

两者对象不同，但都属于“可复用证据”，因此统一放在 `analysis-baseline` 下。

### 原则 3：店铺画像可以反哺单品选品

店铺画像不只用于选店铺，也可以给 M06 这类方法卡提供证据：

```text
一个新品当前没销量
但它所属商品族已经被多家优质画像店铺验证
所以可以提前进入候选
```

这时判断重点不是当前 ASIN 的即时销量，而是商品族的确定性。

### 原则 4：方法卡缓存不能泛化成基础字段

`m01_active` 是 M01 店铺排名的性能优化。  
它可以放在 `method-evidence-cache` 子模块，但不能要求未来每张方法卡都新增一个 `mxx_active` 字段。

未来是否缓存，取决于：

- 查询频率是否高
- SQL 是否重
- 是否需要跨店铺聚合
- 命中口径是否稳定

### 原则 5：所有基线必须带时间批次

后续所有 analysis-baseline 结果都应保留批次：

- `baseline_month`
- `batch_date`
- `source_batch`
- `run_id`
- `computed_at`

没有批次，就无法判断趋势，也无法复盘“当时为什么选中”。

## 四、建议 Java 模块结构

后续代码可以逐步向下面结构收敛，不必一次性大搬家：

```text
com.sjzm.product.modules.analysisbaseline
├─ productfeature
│  └─ ProductFeatureProcessor
├─ marketbaseline
│  ├─ SalesBaselineService
│  └─ CategoryAgeTierBaselineService
├─ shopprofile
│  ├─ ShopProfileService
│  └─ ShopProfileSnapshotService
├─ shopbaseline
│  └─ ShopBaselineService
├─ productfamily
│  └─ ProductFamilyEvidenceService
└─ methodevidence
   └─ MethodEvidenceCacheService
```

第一阶段可以只新增新模块，不急着移动旧类：

- 旧 `ProductFeatureProcessor` 继续可用。
- 旧 `SalesBaselineService` 继续可用。
- 新增店铺画像和商品族证据时，直接放进 `modules.analysisbaseline`。
- 等功能稳定后，再评估是否移动旧类。

## 五、当前代码映射

| 能力 | 当前代码 | 建议归属 |
|---|---|---|
| 商品基础特征 | `ProductFeatureProcessor` | `analysisbaseline.productfeature` |
| M01 导入时打标 | `CompetitorFilterService` + `M01Rule` | `analysisbaseline.methodevidence` + L3 M01 消费 |
| M01/M02/M03 方法卡 | `MethodCardServiceImpl` | L3 消费层 |
| ①大类/小类销量基线 | `SalesBaselineServiceImpl` | `analysisbaseline.marketbaseline` |
| M04 新品账龄分级 | `CategoryAgeTierBaselineService` | `analysisbaseline.marketbaseline` |
| 店铺方法卡排名 | `ShopMethodRankService` | L3 店铺消费层，消费 method evidence |
| 旧郑总相似度评级 | `ShopRatingServiceImpl` | L3 可选视图，后续被 shop-baseline 对标替代 |
| 店铺画像证据 | 未实现 | `analysisbaseline.shopprofile` |
| 商品族证据 / M06 支撑 | 未实现 | `analysisbaseline.productfamily` |

## 六、落地顺序

```text
1. 文档上固定 analysis-baseline 分层边界
2. 新增 shopprofile 画像聚合，只读输出 A/B/C/D、ABC、D、类目结构
3. 新增 shopbaseline 基线库，先沉淀郑总 UK/DE 和自有优质店
4. 新增 productfamily 证据雏形，支持同 ASIN / 同父体 / 标题相似 / 多店出现
5. M06 消费 productfamily + shopprofile + shopbaseline，输出爆款多店验证候选
6. 视情况把旧 ProductFeatureProcessor / SalesBaselineService 迁入 analysisbaseline 包
```

## 七、不要做什么

- 不要把 `analysis-baseline` 做成一个巨大的万能 Service。
- 不要让方法卡直接写底层字段，除非明确是性能缓存。
- 不要把店铺相似度、商品销量、方法卡命中合成一个黑盒大分。
- 不要在前端页面里临时拼复杂统计，统计应沉淀到基线层。
- 不要把 `variation=N` 含变体口径混入店铺画像默认统计。

## 八、最终定位

`analysis-baseline` 是系统的大脑底座，但不是最终决策者。

```text
干净数据 → analysis-baseline 证据 → 方法卡 / 店铺定位 / 前端视图 / 人工决策
```

它让后续系统可以同时支持：

- 按商品基础特征筛选
- 按市场基线解释表现
- 按店铺画像理解卖家
- 按店铺基线定位相似店
- 按商品族证据提前发现新爆款跟进款

## 九、当前逻辑优化点

结合当前 Java 后端代码，后续实现时需要重点收口这些点：

### 1. 先新增新模块，不急着大搬家

当前 `ProductFeatureProcessor`、`SalesBaselineServiceImpl`、`CategoryAgeTierBaselineService` 已经能跑。  
第一阶段不要为了“架构好看”强行移动旧类，容易引入风险。

建议：

```text
新能力先进入 com.sjzm.product.modules.analysisbaseline
旧能力先保持兼容
等 shop-profile / product-family 跑通后，再做包结构迁移
```

### 2. 市场基线计算口径要对齐 clean 表

当前 `CategoryBsrBaselineMapper.xml` 和 `SubcategoryBaselineMapper.xml` 的实际计算 SQL 走 `competitor_products_clean`，这是正确方向。  
但 `SalesBaselineServiceImpl` 里部分 eligibleRows 计数仍按 `competitor_products` 原表统计，可能导致“摘要数量”和“实际入库基线样本”不一致。

后续优化：

- 统计摘要也走 clean 表。
- 或由 mapper 返回实际 filtered count。
- 文档、日志、接口返回都明确“基线样本=clean 父体口径”。

### 3. M04 分级写入原表和 clean 表的口径要确认

当前 M04 注释里写明：`tagAsinsByWeek` / `tagAsinsByMonth` 先回写 `competitor_products`，clean 表列已预留但暂未同步。

如果后续方法卡或前端默认消费 `competitor_products_clean`，M04 证据可能不可见。

后续优化：

- 若 M04 要被方法卡消费，应同步 clean 表。
- 若 M04 只服务原表视图，应在 L3 明确不能从 clean 表读取 M04。
- 更推荐把 M04 作为 `analysis-baseline.market-baseline` 证据，clean 表和原表口径都能查到。

### 4. L3 当前仍有直接 SQL 读取 clean 表，复杂能力要逐步抽证据层

M01/M03 现在由 `MethodCardMapper.xml` 直接查 `competitor_products_clean`，短期可以接受，因为规则简单且已落地。  
但 M06、店铺画像、店铺基线对标不能继续在方法卡 SQL 里临时拼复杂统计。

后续优化：

```text
简单方法卡：可直接消费 clean 表 + 基础特征
复杂方法卡：先由 analysis-baseline 产出证据，再由 L3 组合
```

### 5. “基线”命名要分清对象

当前系统里已经有多种 baseline：

- `category_bsr_baseline`
- `subcategory_baseline`
- `category_age_tier_baseline`
- 未来 `shop_profile_baseline`
- 未来 product-family 爆款基线

后续命名要带对象前缀：

```text
market-baseline：市场/类目/销量基线
shop-baseline：店铺基线
product-family-baseline：商品族验证基线
```

避免只说“基线”导致不知道是在讲市场、店铺还是商品族。

### 6. 类目拆解应进入 product-feature

现在小类 SQL 里多处用 `SUBSTRING_INDEX(node_label_path, ':', -1)` 临时取末级类目。  
后续店铺画像、M06、商品族证据都会用到类目层级，建议把：

- `category_l1`
- `category_l2`
- `category_leaf`
- `category_path_normalized`

统一沉淀到 `analysis-baseline.product-feature`，减少 SQL 到处拆字符串。

### 7. 批次字段要统一成可复盘口径

当前存在：

- `month`
- `week_tag`
- `effective_week_tag`
- `batch_date`
- `run_id`
- `computed_at`

后续 analysis-baseline 结果必须保留来源批次，并在接口里明确返回。  
尤其是店铺画像和 M06，如果没有批次，就无法解释“当时为什么判断这个商品族已验证”。

### 8. 店铺默认口径必须记录 variation mode

店铺画像默认按 `variation=Y` 不含变体父体口径。  
后续表和接口建议显式带：

```text
variation_mode = Y
```

避免未来含变体策略分析混入默认画像。

### 9. 商品族证据不能靠方法卡临时 title LIKE

M06 的关键不是写一个标题模糊搜索，而是形成可复用的商品族证据：

- 同 ASIN
- 同父体
- 标题核心词相似
- 元素/载体相似
- 类目一致
- 价格带一致
- 多店出现

这些应先进入 `analysis-baseline.productfamily`，M06 只消费结果。

### 10. 避免 `mxx_active` 字段无限膨胀

`m01_active` 是当前 M01 店铺排名的性能缓存，不是所有方法卡的默认模式。  
未来如果 M06 或更多方法卡也需要缓存，应评估是否使用统一命中缓存表，例如：

```text
method_product_hit
```

核心字段：

- `method_id`
- `marketplace`
- `asin`
- `parent_asin`
- `source_table`
- `hit_reason_json`
- `batch_key`
- `computed_at`

是否落这张表，要等方法卡数量和查询压力上来后再决定。
