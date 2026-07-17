---
name: 理实开品经验
description: 当用户询问某个候选商品(SKU/ASIN/标题+图)团队是否值得开发、需要判断新品榜候选与理实团队历史开品方向的匹配度、需要给出开发风险评估或推荐开发手法时,使用此技能。触发词包括"值不值得开""能不能做""像哪个手法""开品判断""筛新品""对标历史"。此技能基于三层证据链(开品/上架/经营)承载 8+ 位核心开发人的真实数据,分 8 个开发手法 + 6 类主题元素 + 9 条硬红线 + 1874 家供应商画像,以对接表、领星本地产品表和领星经营模型为事实底座。
---

# 理实开品经验

回答"这个候选品团队熟不熟、像哪种手法、有多大概率能做起来"。**基于三层证据链,不做销量预测,不替代人工看图定审美。**

## 三层证据链

```
L1 开品层  →  L2 上架层  →  L3 经营层
   ↓             ↓            ↓
团队开过   →   真上架了   →  真赚了钱
5,312 SKU  65.2% 进 L2    3,698 挂 L3
             51.5% 有 FBA   12% 留存盈利
```

三层必须**同时通过**才算好方向。任一层触红线即打红旗。

## 数据边界与更新节奏

- **L1 数据源**: 理实产品对接表(2026-01 至 2026-06 共 40 张) + 领星本地产品表 `lingxing_local_product`
- **L2 数据源**: 领星模型/基础统一表/ASIN_FBA可售优先*.csv (6,617 ASIN)
- **L3 数据源**: 领星模型/ASIN月度经营模型/{GBP,EUR}/*.xlsx (5,786 GBP + 607 EUR ASIN)
- **图片来源**: `lingxing_local_product.pic_url` (99.6% 有图)
- **每月增量入库**:
  1. `python scripts/ingest_month.py <目录> --month YYYY-MM` — L1 层
  2. `python scripts/link_layers.py` — 更新三层证据链
  3. `python scripts/enrich_amazon_data.py` — 补 Amazon item_name / tacos / 最新月销量 等 8 列
- **供应商分片策略**: ≥3 SKU 独立目录,< 3 归入 `_tail/`
- **深审档案**: 每条深审沉淀到 `data/审计档案/<SKU>.md`,可复用规则回写 [judgement-rules-L1.md](references/L1-开品层/judgement-rules-L1.md) / [developer-profiles-L1.md](references/L1-开品层/developer-profiles-L1.md)

## 三层结构

### L1 开品层 · 详见 [references/L1-开品层/](references/L1-开品层/)

回答"团队怎么开的"。8 个开发手法 + 6 类主题 + P1-P3 硬红线 + 8+ 位开发人 L1 画像 + 1874 家供应商画像。

**8 个开发手法(L1):**

| # | 名称 | L1 印象 | 详见 |
|---|---|---|---|
| 01 | 供应商新款首发 | 团队最高频,占 32% | [method-01](references/L1-开品层/method-01-供应商新款首发.md) |
| 02 | 热销跨站复制 | 美国站验证 → 英/德复制 | [method-02](references/L1-开品层/method-02-热销跨站复制.md) |
| 03 | 自有链接拓款 | 宋凤莉专属 79% | [method-03](references/L1-开品层/method-03-自有链接拓款.md) |
| 04 | 老品季节化改款 | L1 利润率印象最高 27% | [method-04](references/L1-开品层/method-04-老品季节化改款.md) |
| 05 | 元素×载体重组 | 产品线深度打法 | [method-05](references/L1-开品层/method-05-元素载体重组.md) |
| 06 | 套装/数量密度差异 | 靠"多"取胜 | [method-06](references/L1-开品层/method-06-套装数量密度.md) |
| 07 | 异形/审美精修 | 视觉溢价 | [method-07](references/L1-开品层/method-07-异形审美精修.md) |
| 08 | FBM 验证后 FBA 补发 | 团队降低试错成本 | [method-08](references/L1-开品层/method-08-FBM验证FBA补发.md) |

### L2 上架层 · 详见 [references/L2-上架层/](references/L2-上架层/)

回答"团队开的品有多少真上架了"。P4-P6 硬红线。**关键洞察: 只有 51.5% SKU 有 FBA 证据。**

- [conversion-analysis.md](references/L2-上架层/conversion-analysis.md) — 开发人×手法 FBA 转化率
- [delay-analysis.md](references/L2-上架层/delay-analysis.md) — 上架延迟分档
- [judgement-rules-L2.md](references/L2-上架层/judgement-rules-L2.md) — P4/P5/P6 硬红线

### L3 经营层 · 详见 [references/L3-经营层/](references/L3-经营层/)

回答"上架后真的赚钱了吗"。P7-P9 硬红线。**关键洞察:**
- **L1 印象牛的开发人在 L3 大量翻车**(周沁仪/龙梦临累计亏损)
- **T4 蝴蝶结主题累亏 -1,247 GBP**,是团队最大亏损来源
- **S06 套装是唯一负利润手法**(-431 GBP)
- **陈杨累计 +6,352 GBP** 团队第 1

- [judgement-rules-L3.md](references/L3-经营层/judgement-rules-L3.md) — P7/P8/P9 硬红线
- [retention-vs-profit.md](references/L3-经营层/retention-vs-profit.md) — 留存/利润率的三个反转案例
- [developer-profiles-L3.md](references/L3-经营层/developer-profiles-L3.md) — 开发人真实经营画像
- [theme-performance.md](references/L3-经营层/theme-performance.md) — 6 主题 L3 真实表现

## 三层证据链完整数据文件

`data/sku_full_lifecycle.csv` — 5,703 条完整 SKU-ASIN 三层贯通记录。字段包括:
- L1: SKU / 开发 / 供应商 / 开品理由 / 售价 / 采购价 / 匹配手法 / 匹配主题 / 图片 URL
- L2: ASIN / 基准店铺 / FBA 首现月 / Listing 标签 / 起算月
- L3: 币种 / 累计销量 / 结算利润 / 结算销售额 / 当前标签状态
- 交叉: L1→L2 状态 / L2→L3 状态 / 生命周期状态

## 使用步骤

### 步骤 1 · 输入候选

从用户消息或指定表拿到候选,至少要有:标题、图(可选但强烈建议)、类目、竞品售价、估算采购价。若命中供应商,记录供应商名。

### 步骤 2 · L1 三红线粗筛

读 [judgement-rules-L1.md](references/L1-开品层/judgement-rules-L1.md),对每个候选打三个布尔:
- P1 售价区间 (£5.99-£12.99)
- P2 采购价上限 (¥25)
- P3 利润率警戒 (≥ 20%)

任一 fail → 打红旗,不进入后续。

**非标定制候选追加两条**(见 [judgement-rules-L1.md](references/L1-开品层/judgement-rules-L1.md#p10--图案密度红线非标定制专用)):
- P10 图案密度(元素数 ≥ 3 且 top2 进亚马逊标题)
- P11 单单毛利(总结算利润 / 累计销量 ≥ 售价 × 20%)

### 步骤 3 · L1 手法匹配

对通过粗筛的候选,依次读 [references/L1-开品层/method-01~08-*.md](references/L1-开品层/),匹配主/次手法。允许多标签,允许无匹配(标"团队没做过的方向")。

### 步骤 4 · L1 主题匹配

读 [themes-pool.md](references/L1-开品层/themes-pool.md),识别候选包含的主题元素。

### 步骤 4.5 · 非标定制看图深审(触发式)

**触发条件**(满足任一即启用):
- `产品名称` 含 `【定制】` / `定制` 前缀
- L2 层 `最新Listing标签` 含 "非标品" / "NSP" / "定制"
- `采购价¥` ≤ ¥5 且 `产品名称` 含 "挂牌/贴牌/彩印/异形/无货源/半定制"

**若触发,必须**按 [audit-method-非标定制看图深审.md](references/L1-开品层/audit-method-非标定制看图深审.md) 跑 4 步:
1. **看图识别元素** — 列出所有可命名视觉元素 + 风格 + 颜色主调
2. **三层命名对齐** — 图片 ↔ 开发标题 ↔ **亚马逊 item_name**(from `lingxing_product_performance`,不是开发标题)
3. **卖点组合判断** — 填四栏:购买者 / 场景 / 情绪 / 替代品
4. **利润机制归类** — 结合 tacos / 单单毛利 / 累计销量 判断"盈利明星 / 低量长销 / 边缘留存 / 广告烧钱"

**产出**: 沉淀到 `data/审计档案/<SKU>.md`,并按情况回写 [judgement-rules-L1.md](references/L1-开品层/judgement-rules-L1.md) 的 P10/P11 或 [developer-profiles-L1.md](references/L1-开品层/developer-profiles-L1.md) 的 R-<开发>-XX 规则。

**参考样本**: [SKU 2255624 · 蒋舒 · 农场热气球 Sun Catcher](data/审计档案/2255624.md)

### 步骤 5 · L1 供应商匹配

若候选提到供应商,读 [supplier-profiles.md](references/L1-开品层/supplier-profiles.md),核对该供应商是否在头部/中部/尾部,查其"招牌手法"和采购价中位数。

### 步骤 6 · L2 转化检查

读 [judgement-rules-L2.md](references/L2-上架层/judgement-rules-L2.md),对候选打三个布尔:
- P4 开发人历史 L2 转化率 ≥ 60%
- P5 成熟批次未上架率 ≤ 45%
- P6 手法 L2 转化率 ≥ 65%

任一 fail → 打红旗。

### 步骤 7 · L3 经营检查

读 [judgement-rules-L3.md](references/L3-经营层/judgement-rules-L3.md),对候选打三个布尔:
- P7 开发人累计利润 > 0 且盈利率 ≥ 15%
- P8 手法累计利润 ≥ 0 且盈利率 ≥ 10%
- P9 主题累计利润 ≥ 0

任一 fail → **强红旗**。

### 步骤 8 · 检索代表样本

从 `data/sku_full_lifecycle.csv` 检索匹配手法+主题+开发人的 top 5 类似历史 SKU,展示三层完整字段。

### 步骤 9 · 输出三层候选卡

```
候选: <标题>
━━ L1 开品层 ━━
红线检查: P1=✓/✗  P2=✓/✗  P3=✓/✗
主匹配手法: <method>  信心=高/中/低
命中主题: <T?>
供应商: <名称>  历史 SKU: <n>  招牌手法: <method>
━━ L2 上架层 ━━
红线检查: P4=✓/✗  P5=✓/✗  P6=✓/✗
类似历史 SKU 的 FBA 转化率: <X%>
━━ L3 经营层 ━━
红线检查: P7=✓/✗  P8=✓/✗  P9=✓/✗
开发人累计利润: <X GBP>  留存池利润率: <X%>
手法累计利润: <X>  主题累计利润: <X>
━━ 综合判断 ━━
建议: 强开 / 开 / 谨慎开 / 拒绝
理由: <L1+L2+L3 三层证据总结,若有红线必须明说>
最相似历史 SKU (3-5):
  - <SKU>  <标题>  售价<X>  L3状态<留存盈利/亏损/淘汰>  图<URL>
下一步: <人工看图 / 找供应商询价 / 换开发人 / 直接放弃>
```

## 何时不应用此技能

- 用户问销量预测/库存/上架状态 → 不属于此技能
- 用户问某个已上架 SKU 的即时表现 → 走领星表现分析
- 用户询问其他团队(非理实 8 人)的开品逻辑 → 数据不适用

## 数据追溯

任何输出都必须能溯源到:
- `data/sku_full_lifecycle.csv` — 三层贯通主表
- `data/monthly-snapshot/<月>.csv` — L1 原始快照
- `data/by-method/<手法>/<月>.csv` — L1 手法分片
- `data/by-supplier/<供应商>/<月>.csv` — L1 供应商分片
- `领星模型/基础统一表/*.csv` — L2 原始事实
- `领星模型/ASIN月度经营模型/**.xlsx` — L3 原始事实

若溯源失败,输出须标"推测"。

## 附录 · 目录索引

```
理实开品经验/
├── SKILL.md                                     ← 本文件
├── references/
│   ├── L1-开品层/  (13 份)
│   │   ├── method-01~08-*.md
│   │   ├── themes-pool.md
│   │   ├── judgement-rules-L1.md            ← P1-P3 + P10/P11 + R-销量口径-01
│   │   ├── developer-profiles-L1.md         ← 含 R-蒋舒-05 等深审规则
│   │   ├── supplier-profiles.md
│   │   └── audit-method-非标定制看图深审.md ← 4 步深审方法论
│   ├── L2-上架层/  (3 份)
│   │   ├── conversion-analysis.md
│   │   ├── delay-analysis.md
│   │   └── judgement-rules-L2.md
│   └── L3-经营层/  (4 份)
│       ├── judgement-rules-L3.md
│       ├── retention-vs-profit.md
│       ├── developer-profiles-L3.md
│       └── theme-performance.md
├── data/
│   ├── sku_full_lifecycle.csv                   ← 三层贯通主表(5,703 行 × 40 列,含 Amazon item_name)
│   ├── link_diagnostics.md                      ← 贯通诊断报告
│   ├── enrich_diagnostics.md                    ← 补齐诊断(3,857 ASIN 补 Amazon 字段)
│   ├── monthly-snapshot/2026-01~06.csv          ← L1 原始快照
│   ├── by-method/**/2026-*.csv                  ← L1 手法分片
│   ├── by-supplier/**/2026-*.csv                ← L1 供应商分片
│   ├── skill-summary.csv                        ← 手法×月份统计
│   ├── supplier-summary.csv                     ← 供应商累计统计
│   ├── 审计图片/                                ← 深审用的原图本地缓存
│   └── 审计档案/                                ← 每 SKU 一份 md,首条 2255624
└── scripts/
    ├── ingest_month.py                          ← L1 每月增量
    ├── link_layers.py                           ← 三层证据链贯通
    └── enrich_amazon_data.py                    ← 补 8 列 Amazon 字段(item_name / tacos / 最新月...)
```
