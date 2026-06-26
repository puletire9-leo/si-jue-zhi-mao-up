# Step 1 实现计划：③线 自有战绩（大脑先行）

> 执行顺序：读此计划 → 建表 → 写 entity/mapper/service → 导入 591 行 → 验证
> 输出物：1 entity + 1 mapper + 1 service + 1 controller

---

## 一、数据源（已确认）

**源文件**：`docs/选品方法库/产品表现ASIN_转换版2.md`

**开发环境注意**：`java-product` 导入接口默认读取这个相对路径。dev compose 已把仓库 `docs/` 挂进容器 `/docs`，因此默认 `POST /api/v1/product-performance/import` 可以直接导入，无需手工拷文件。

md 表格，591 行，18 列，`|` 分隔。

| # | 列名 | 示例 | 说明 |
|---|------|------|------|
| 1 | ASIN | B0FZRDL6XC | |
| 2 | 父ASIN | B0FZRNCVWW | |
| 3 | 售价(总价) | ￡8.98 / €11.98 | 含货币符号 |
| 4 | SKU | 2560406 | |
| 5 | 销量 | 54 | 数值 |
| 6 | 大类排名 | Toys & Games：83662 | 全角冒号分隔 |
| 7 | ACoAS | 0.0005 | 可为空 |
| 8 | 自然点击量 | 177 | |
| 9 | CTR | 0.38% | |
| 10 | 广告CVR | 14.29% | |
| 11 | 自然订单量 | 49 | |
| 12 | FBA-可售 | 98 | 可为空 |
| 13 | 小类排名 | Assembly & Disentanglement Puzzles：82 | 全角冒号分隔 |
| 14 | 退款率 | 0.00% | |
| 15 | 国家 | 英国 / 德国 / 意大利 | 中文 |
| 16 | listing标签 | 欧洲精铺2025,欧洲精铺2025非标品,绿标 | 逗号分隔多标签 |
| 17 | 品名 | 智力解扣32件套-【袋装ABCD】... | 中文 |
| 18 | 标题 | 32Pcs Metal Brain Teaser Puzzles Toy... | **英文标题，关键！** |

**分布**：英国 574 + 德国 17 = **591 行**
**标签**：欧洲精铺2025(414)、欧洲精铺2025+非标品(98)、欧洲精铺2025淘汰(50)、非标品+绿标(11)、其他组合(18)

---

## 二、建表 DDL

在 `sijuelishi_dev` 库（dev-mysql:3307）执行：

```sql
CREATE TABLE product_performance_actual (
  id BIGINT NOT NULL AUTO_INCREMENT,
  asin VARCHAR(20) NOT NULL,
  parent_asin VARCHAR(20) DEFAULT NULL,
  sku VARCHAR(100) DEFAULT NULL,
  marketplace VARCHAR(10) NOT NULL COMMENT 'UK/DE/IT',
  price DECIMAL(10,2) DEFAULT NULL COMMENT '售价(清洗货币符号)',
  sales_volume INT DEFAULT NULL COMMENT '销量',
  category_rank_main VARCHAR(200) DEFAULT NULL COMMENT '大类排名原文: "Toys & Games：83662"',
  category_main VARCHAR(100) DEFAULT NULL COMMENT '大类名(拆出): "Toys & Games"',
  category_rank_sub VARCHAR(200) DEFAULT NULL COMMENT '小类排名原文',
  category_sub VARCHAR(150) DEFAULT NULL COMMENT '小类名(拆出,方向参考)',
  acoas DECIMAL(8,4) DEFAULT NULL,
  natural_clicks INT DEFAULT NULL,
  ctr DECIMAL(6,4) DEFAULT NULL COMMENT '%→小数',
  ad_cvr DECIMAL(6,4) DEFAULT NULL,
  natural_orders INT DEFAULT NULL,
  fba_available INT DEFAULT NULL,
  refund_rate DECIMAL(6,4) DEFAULT NULL COMMENT '%→小数',
  product_name VARCHAR(500) DEFAULT NULL COMMENT '中文品名',
  title VARCHAR(1000) DEFAULT NULL COMMENT '英文标题(元素提取源)',
  archetype VARCHAR(8) DEFAULT NULL COMMENT 'STD/CUSTOM(半自动打标)',
  element VARCHAR(100) DEFAULT NULL COMMENT '元素(从英文标题自动拆)',
  carrier VARCHAR(100) DEFAULT NULL COMMENT '载体(从英文标题自动拆)',
  listing_tags VARCHAR(200) DEFAULT NULL COMMENT '原始标签',
  is_eliminated TINYINT DEFAULT 0 COMMENT '标签含"淘汰"→1',
  is_green TINYINT DEFAULT 0 COMMENT '标签含"绿标"→1',
  bsr_id VARCHAR(100) DEFAULT NULL COMMENT '大类slug(大类名映射)',
  source_batch VARCHAR(50) DEFAULT NULL COMMENT '导入批次',
  imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_asin (asin, marketplace),
  KEY idx_archetype (archetype),
  KEY idx_category_sub (category_sub(64)),
  KEY idx_eliminated (is_eliminated),
  KEY idx_green (is_green)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='自有真实战绩(tier1真值,591赢家)';
```

---

## 三、文件清单（4 个新建）

### 3.1 Entity

**`java-backend/sjzm-product/src/main/java/com/sjzm/product/entity/ProductPerformanceActual.java`**

- `@Data` + `@TableName("product_performance_actual")`
- `@TableId(type = IdType.ASSIGN_ID)`（Snowflake 雪花 ID）
- 不加 `@TableLogic`（战绩表不会软删除）
- 价格/金额/比率用 `BigDecimal`，数量用 `Integer`

### 3.2 Mapper

**`java-backend/sjzm-product/src/main/java/com/sjzm/product/mapper/ProductPerformanceActualMapper.java`**

```java
public interface ProductPerformanceActualMapper extends BaseMapper<ProductPerformanceActual> {
}
```

放 `mapper` 包（`@MapperScan` 只扫 `com.sjzm.product.mapper`）。

### 3.3 Service

**`java-backend/sjzm-product/src/main/java/com/sjzm/product/service/ProductPerformanceService.java`**

接口 + impl。方法清单：

| 方法 | 说明 |
|------|------|
| `int importFromMarkdown(String filePath)` | 读 md → 解析 → 打标 → upsert → 返回行数 |
| `List<ProductPerformanceActual> listWinners(String mp)` | 按国家查 |
| `List<ProductPerformanceActual> listByArchetype(String at)` | 按原型查 |
| `long count()` | 总行数 |

**`importFromMarkdown` 核心逻辑**：

```
1. 读 md 文件，跳过 header 行和分隔行（---）
2. 每行按 | 分割，trim()，取 columns[1..18]
3. 字段映射：
   asin            = columns[1]
   parent_asin     = columns[2]
   price           = columns[3].replaceAll("[￡€$¥]", "").toBigDecimal
                        -- ⚠️ 全角 ￡ (U+FFE1) 不是半角 £ (U+00A3)
   sku             = columns[4]
   sales_volume    = columns[5].toInt
   category_rank_main = columns[6]   -- "大类：排名"
   category_main   = columns[6].split("：")[0]  -- 全角冒号(U+FF1A), 不是半角(U+003A)
   acoas           = columns[7].toBigDecimalOrNull
                        -- ⚠️ ACoAS 是纯数字 "0.0005", 不是百分比! 直接存, 不要 /100
   natural_clicks  = columns[8].toInt
   ctr             = columns[9].replace("%","").toBigDecimalOrNull / 100    -- % → 小数
   ad_cvr          = columns[10].replace("%","").toBigDecimalOrNull / 100  -- % → 小数
   natural_orders  = columns[11].toInt
   fba_available   = columns[12].toIntOrNull
   category_rank_sub = columns[13]
   category_sub    = columns[13].split("：")[0]
   refund_rate     = columns[14].replace("%","").toBigDecimalOrNull / 100 -- % → 小数
   marketplace     = countryMap(columns[15])  -- 英国→UK, 德国→DE, 意大利→IT
   listing_tags    = columns[16]
   product_name    = columns[17]
   title           = columns[18]
4. 打标规则：
   a. listing_tags 含"淘汰" → is_eliminated=1, 含"绿标" → is_green=1
   b. archetype: listing_tags含"非标品" OR title命中文档载体词库 → CUSTOM, 否则 STD
   c. element/carrier: 对 CUSTOM 品，用三步算法从英文 title 自动拆(见 §六)
   d. bsr_id: category_main → slug 映射(见 §四)
5. upsert: INSERT ... ON DUPLICATE KEY UPDATE（uk=asin+marketplace）
```

### 3.4 Controller

**`java-backend/sjzm-product/src/main/java/com/sjzm/product/controller/ProductPerformanceController.java`**

```java
@RestController
@RequestMapping("/api/v1/product-performance")
@RequiredArgsConstructor
public class ProductPerformanceController {
    private final ProductPerformanceService service;

    @GetMapping("/winners")
    public Result<List<ProductPerformanceActual>> winners(
        @RequestParam(required = false) String marketplace) { ... }

    @GetMapping("/count")
    public Result<Long> count() { ... }

    @GetMapping("/by-archetype")
    public Result<List<ProductPerformanceActual>> byArchetype(
        @RequestParam String archetype) { ... }
}
```

---

## 四、大类名 → bsr_id slug 映射表

md 里的大类名是英文原文（如 "Toys & Games"），需映射到 competitor_products 的 bsr_id。

| category_main（md 原文） | bsr_id slug | 出现次数 |
|--------------------------|-------------|----------|
| Toys & Games | toys | 136 |
| Home & Kitchen | kitchen | 136 |
| Garden | garden/outdoors | 63 |
| Sports & Outdoors | sports/outdoors | 52 |
| Fashion | fashion | 44 |
| Automotive | automotive | 33 |
| Pet Supplies | pet-supplies | 24 |
| Beauty | beauty | 18 |
| DIY & Tools | tools-improvement | 15 |
| Stationery & Office Supplies | office | 8 |
| Health & Personal Care | hpc | 26 |
| Business, Industry & Science | business-industry-science | 6 |
| Baby Products | baby | 4 |

和德语大类名→slug（德国 17 行，类目名是德语，不需要映射到英文，直接到 slug）：

| category_main（DE 原文） | bsr_id slug | 行数 |
|-------------------------|-------------|------|
| Spielzeug | toys | 6 |
| Haustier | pet-supplies | 4 |
| Küche, Haushalt & Wohnen | kitchen | 3 |
| Fashion | fashion | 1 |
| Auto & Motorrad | automotive | 1 |
| Kosmetik | beauty | 1 |
| Gewerbe, Industrie & Wissenschaft | business-industry-science | 1 |

⚠️ 实现时用 `Map.of()` 硬编码一张 `{大类名原文 → slug}` 映射表，覆盖中频（≥3次）就行。没覆盖到的低频类目 slug 暂时 NULL，等后续补齐。

---

## 五、原型打标规则

### 5.1 载体词库（命中 → CUSTOM 非标品）

从 `补充/载体元素三语映射表.md` 提取的英文载体锚点词（简化版，只看英文）：

```
Tote Bag, Canvas Tote, Cosmetic Bag, Makeup Bag, Make Up Bag, Suncatcher,
Sun Catcher, Acrylic Ornament, Metal Sign, Tin Sign, Drawstring Bag,
Poster, Art Print, Paint by Numbers, Acrylic Stand, Standee, Lunch Bag,
Canvas Wall Art, Book Sleeve, Garden Stake, Pillow Case, Pillow Cover,
Cushion Cover, Tumbler, Keychain, Keyring, Key Chain, Key Ring, Cap,
Baseball Cap, Hat, Snapback, Bracelet, Wristband, Coin Purse, Figure,
Action Figure, Figurine, Backpack, Rucksack, Apron, Diamond Painting,
Beach Towel, Pen Case, Pencil Case, Mouse Pad, Mouse Mat, Water Bottle,
Sticker, Decal, Plush, Stuffed Toy, Mug, Cup, Coaster, Towel,
Jewelry Box, Jewellery Box, Napkin Holder, Wallet, Purse, Garden Flag
```

**判定逻辑**：`title`（商品标题）包含任一载体锚点词 → CUSTOM。即使 listing_tags 不含"非标品"也能识别。

### 5.2 标签判定（listing_tags 含"非标品"）

listing_tags 含"非标品" → 直接 CUSTOM（与载体词判定取 OR）。

---

## 六、element/carrier 自动拆解（三步算法精简版）

从英文 `title` 提取，只对 `archetype = CUSTOM` 的品执行。Java 实现已抽成共享标题解析服务，后续 ④线直接复用这套规则。

**Step 1 — 载体锚点匹配**：用载体词库（需同时读 `补充/载体元素三语映射表.md`）在 title 中匹配，最长匹配优先，取**最左**出现位置。

**Step 2 — 元素提取**：载体词位置向左取 1-3 词 → **剥去品牌/材质/颜色词**。

**品牌黑名单**（出现在标题开头的自有品牌词，必须剥离，否则会被当成"元素"）：

| 品牌词 | 出现次数 |
|--------|----------|
| zhongko | 69 条 |
| shirylzee | 39 条 |
| Orsefeliy | ~15 条 |
| Dei tkeyts | ~10 条 |

**材质/工艺黑名单**（参考 `补充/标题匹配说明.md` 完整版）：Handmade, Crochet, Acrylic, Wooden, Vinyl, Polyester, Cotton, Stainless Steel, Ceramic, Silicon, Metal, Felt...

**颜色词**（同时剥离，非元素）：Black, White, Red, Blue, Gold, Pink, Silver, Brown...

**Step 3 — 候选归一**：提取词与 element_library（如果已建④线的表）匹配 → 有则归入已知元素，否则留英文原词。

**置信度标记**（暂存 entity 外，或打 log）：
- 载体锚点匹配到 → HIGH
- 未匹配到锚点但 listing_tags 含"非标品" → MID（标非标品但自动拆失败，留空）
- 单字母/数字 → LOW，跳过

具体算法细节见 [[补充/标题匹配说明]]。

---

## 七、验证清单

导入完成后逐条跑：

```sql
-- 1. 总行数 = 591
SELECT COUNT(*) FROM product_performance_actual;

-- 2. 国家分布: UK 574, DE 17, IT 1
SELECT marketplace, COUNT(*) FROM product_performance_actual GROUP BY marketplace ORDER BY COUNT(*) DESC;

-- 3. 原型分布（不应全是 NULL 或全是 STD）
SELECT archetype, COUNT(*) FROM product_performance_actual GROUP BY archetype;

-- 4. 淘汰标记: ≥50
SELECT COUNT(*) FROM product_performance_actual WHERE is_eliminated = 1;

-- 5. 绿标: ≥11
SELECT COUNT(*) FROM product_performance_actual WHERE is_green = 1;

-- 6. 标签不漏: 有"淘汰"文字但没有 is_eliminated=1 的 → 应为 0 行
SELECT COUNT(*) FROM product_performance_actual WHERE listing_tags LIKE '%淘汰%' AND is_eliminated = 0;

-- 7. 价格不为 NULL（至少大部分有值）
SELECT COUNT(*) FROM product_performance_actual WHERE price IS NOT NULL;

-- 8. 英文标题不为 NULL
SELECT COUNT(*) FROM product_performance_actual WHERE title IS NOT NULL;

-- 9. element/carrier 自动拆解覆盖率（CUSTOM 品中有多少拆出了 element）
SELECT COUNT(*) FROM product_performance_actual WHERE archetype = 'CUSTOM' AND element IS NOT NULL;
SELECT COUNT(*) FROM product_performance_actual WHERE archetype = 'CUSTOM';
```

---

## 八、执行步骤（严格按序）

```
1. Review 此计划 → 确认无误
2. 连 dev-mysql:3307 → 执行 DDL → SHOW CREATE TABLE 确认
3. 创建 entity → 编译通过
4. 创建 mapper → 编译通过
5. 创建 service(接口+impl) → importFromMarkdown 写好
6. 小规模测试：写个 main 方法或 test，先导 3 行验证解析正确
7. 全量导入 591 行
8. 跑验证 SQL → 所有数字对上
9. 报告结果
```

---

## 九、风险 & 边界

- **品牌黑名单** (`zhongko`, `shirylzee`, `Orsefeliy`, `Dei tkeyts` 等) 必须在 Step 2 剥离，否则 element 提取会产出 "zhongko" 这种伪元素
- **7 行缺大类名** → category_main/bsr_id 留 NULL，不影响导入总数
- **177 行缺 FBA-可售** → 正常（非 FBA 品就不填）
- **33 行缺 ACoAS** → null，不影响其他字段
- **⚡ 解析陷阱**：md 的价格符号是全角 `￡` (U+FFE1) 不是半角 `£` (U+00A3)；大类排名的冒号是全角 `：` (U+FF1A)；CTR/广告CVR/退款率是 `"0.38%"` 格式，ACoAS 是纯数字 `"0.0005"` 格式，两者不能同一套除法逻辑
- **德语大类名**（Spielzeug→toys, Haustier→pet-supplies）需额外映射
- **element/carrier 自动拆**准确率不是 100%，接受 ~70% 覆盖率，剩下的留空等人工
