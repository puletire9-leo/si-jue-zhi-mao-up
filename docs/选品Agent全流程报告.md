# 思觉智贸 — 选品Agent全流程技术报告

> 演讲用 · 2026-06-11
> 涵盖: 基准数据 → AI分析 → 品线模型 → MySQL匹配落库 → 前端展示
> **全部使用实际测试数据**

---

## 一、为什么要做选品Agent？

**问题**: 郑总28家英国亚马逊店铺，5,582个在售商品，89个小类。哪些品线值得深耕？哪些元素/载体/关键词组合能做出爆款？靠人工看Listing，看不完也看不准。

**方案**: 全自动选品分析系统 — 脚本算数值，AI做判断。从小类维度出发，AI提取每个品线的**元素(elements)、载体(carriers)、场景(scenes)、搜索关键词(keywords)**，形成结构化品线模型，最终匹配出**可操作的选品清单**。

**实际产出**: UK 202605 批次，89个小类中完成2个小类的端到端分析，产出了320条匹配商品记录，存入MySQL `product_line_elements` 表。

---

## 二、数据管道全景

```
郑总28家英国店 (deng_zong_shop)
    │  MySQL: 5,582 商品 / 89 小类
    │  字段: asin, title, price, units, bsr, rating, brand, fba, weight...
    ↓
┌────────────────────────────────────────────────────┐
│  Java聚合层 (sjzm-product)                          │
│  GET /api/v1/product-line/aggregated-data           │
│  → L1大类/L2小类 树结构 + node_id + bsr_id + 商品数  │
└──────────────────────┬─────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────┐
│  预处理管线 (Python preprocess.py, 526行)           │
│  5步: 拉取 → 变体归组去重 → 智能取样 → 信号打标 → 统计 │
│  例: Posters & Prints: 202品 → 155品 → 40品采样     │
│  例: Signs & Plaques: 260品 → 217品 → 40品采样       │
└──────────────────────┬─────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────┐
│  AI分析引擎 (DeepSeek V4 Flash)                     │
│  输入: 40品结构化数据（含BSR/价格/信号/卖家统计）     │
│  输出: 10维度JSON — 健康度/好品/元素/载体/组合/关键词  │
│  设计原则: "脚本算数值, AI做判断"                    │
└──────────────────────┬─────────────────────────────┘
                       ↓
┌────────────────────────────────────────────────────┐
│  结果落地 (save_results.py, 863行)                   │
│  ✅ MD报告 (12章节, 人类阅读)                        │
│  ✅ model.json (API消费)                            │
│  ✅ MySQL product_line_elements (逐ASIN行写入)       │
│  ✅ batch_summary.md (批次总结)                     │
└────────────────────────────────────────────────────┘
```

---

## 三、案例一: Posters & Prints（海报与印刷品）

### 3.1 原始数据

| 指标 | 数值 |
|------|------|
| 原始商品数 | 202 |
| 变体去重后 | 155 |
| AI分析采样 | 40品 |
| 信号分布 | BURST(9) + RISING(41) + STABLE(31) + SWEET_SPOT(44) + DECLINING(29) + DEAD(45) |
| 价格范围 | £3.99 - £13.99, 均价 £7.17 |
| 甜点区 | £5.99-£8.99（55%产品集中） |
| 轻小件 | 平均92g, FBA £1.87 |

### 3.2 AI识别出的9种载体

| 载体 | 数量 | 均价 | 重量 | FBA | 轻小件 |
|------|------|------|------|-----|--------|
| **Poster** | 18 | £7.12 | 70g | £1.82 | ✅ |
| **Canvas Wall Art** | 12 | £7.49 | 95g | £1.85 | ✅ |
| Canvas Print | 5 | £5.72 | 50g | £2.12 | ✅ |
| Wall Art Print | 3 | £7.26 | 73g | £1.66 | ✅ |
| Wooden Sign | 1 | £7.99 | 80g | £2.98 | ✅ |
| Canvas Poster | 2 | £5.49 | 40g | £2.21 | ✅ |
| Wooden Wall Art | 1 | £6.99 | 100g | £0.00 | ❌ |
| Framed Artwork | 1 | £8.35 | 195g | £1.76 | ❌ |
| Wall Decor | 1 | £12.99 | 150g | £3.01 | ❌ |

**结论**: Poster和Canvas Wall Art是主力载体，Poster最轻便(70g)成本最低，优先以此入门。

### 3.3 AI识别出的10个已验证元素

| 元素 | 跨载体数 | 信号 | 含义 |
|------|----------|------|------|
| **Car** | ×7 | BURST+SWEET_SPOT | 汽车/赛车主题已验证爆款，覆盖跑车/超跑/经典赛车 |
| **Gaming** | ×3 | BURST+RISING | 游戏主题持续热销，水彩/霓虹风格差异化 |
| **Pink** | ×4 | RISING+SWEET_SPOT | 粉色+时尚/美妆，目标少女和年轻女性 |
| **Motivational** | ×5 | BURST+STABLE | 励志语录常青，需差异化（报纸风格、木质载体） |
| **Retro** | ×5 | BURST+SWEET_SPOT | 复古风格强趋势，可结合多种主题 |
| **Funny** | ×3 | DECLINING+SWEET_SPOT | 幽默元素（动物/名画恶搞），浴室场景好 |
| **Boho** | ×3 | STABLE+VARIANT | 波西米亚风格稳定需求 |
| **Leopard** | ×2 | BURST+VARIANT | 豹纹低竞争高爆发，可拓展其他动物纹 |
| **Football** | ×2 | RISING+SWEET_SPOT | 足球主题稳定，需差异化 |
| **Black and White** | ×5 | BURST+SWEET_SPOT | 黑白风格通用设计语言，降低印刷成本 |

### 3.4 AI推荐的20个选品组合（部分展示）

| # | 组合 | 热度 | 搜索词示例 |
|---|------|------|-----------|
| 1 | Car + Racing + Black/White × Poster + Canvas | 🔥已验证 | `black and white racing posters`, `car wall art set` |
| 2 | Gaming + Neon + Retro × Canvas Poster | 🔥已验证 | `neon gaming posters`, `retro video game art` |
| 3 | Pink + Preppy + High Heels × Canvas Wall Art | 🔥已验证 | `preppy pink wall art`, `teen girl room decor` |
| 4 | Motivational + Newspaper × Canvas Print | 🔥已验证 | `newspaper motivational poster`, `office decor` |
| 5 | Funny Animal + Bathroom × Canvas Print | 🔥已验证 | `funny highland cow bathroom art` |
| 8 | F1 + Signed × Poster | ⭐新兴 | `F1 signed poster`, `formula 1 wall art` |
| 9 | Mental Health + Affirmation × Canvas Print | ⭐新兴 | `mental health poster`, `self care wall art` |
| 12 | Stockholm Style + Leopard + Fashion × Canvas | ⭐新兴 | `stockholm style leopard art`, `vogue poster` |

### 3.5 价格空白（选品机会）

| 价格带 | 现状 | 策略 |
|--------|------|------|
| **£3.99-£4.99** | 仅5个品 | 低价冲动消费，低成本测款 |
| **£8.00-£9.99** | 品较少 | 6-9件套高价值套装 |
| **£10.00-£12.99** | 空白 | 精品大套装/木质/带框 |

---

## 四、案例二: Signs & Plaques（标志与挂牌）

### 4.1 原始数据

| 指标 | 数值 |
|------|------|
| 原始商品数 | 260 |
| 变体去重后 | 217 |
| AI分析采样 | 40品 |
| 卖家活跃度 | 27个品牌 |
| 价格范围 | £2.99 - £16.99, 均价 £6.83 |
| 甜点区 | £5.99-£8.99（65%产品集中） |
| 轻小件 | 平均134g, FBA £1.76 |

### 4.2 AI识别出的6种载体

| 载体 | 数量 | 均价 | 重量 | 策略 |
|------|------|------|------|------|
| **Metal Signs** | 18 | £6.59 | 121g | 主力，低变体 |
| **Metal Tin Sign** | 8 | £6.99 | 130g | 经典载体 |
| Ceramic Plaque/Keepsake | 4 | £5.24 | 45g | 极轻，礼品属性强 |
| Wooden Sign/Plaque | 4 | £10.89 | 240g | 高端，接近轻小上限 |
| Acrylic Heart Plaque | 1 | £4.99 | 60g | 情感礼品 |
| Garden Yard Signs | 1 | £8.29 | 230g | 户外场景 |

### 4.3 AI识别出的10个已验证元素

| 元素 | 频率 | 核心信号 | 洞察 |
|------|------|----------|------|
| **Funny** | ×8 | BURST+RISING+SWEET_SPOT | 核心驱动力，覆盖酒吧/浴室/花园/游戏室 |
| **Vintage** | ×7 | BURST+RISING+SWEET_SPOT | 金属牌品类基础元素，跨场景通用 |
| **Bar/Beer** | ×4 | BURST+RISING+SWEET_SPOT | 经典爆款元素，适合变体裂变 |
| **Highland Cow** | ×3 | RISING+SWEET_SPOT | 新高地牛元素，跨载体验证成功 |
| **Football Club** | ×3 | RISING+SWEET_SPOT | 利兹联/阿森纳/曼城，注意版权 |
| **Garden/Plants** | ×3 | BURST+SWEET_SPOT | 花园主题BURST信号强 |
| **Cat** | ×3 | RISING | 猫元素浴室/家居需求 |
| **Sympathy/Bereavement** | ×2 | BURST+SWEET_SPOT | 情感类爆款，高利润 |
| **Thank You** | ×2 | RISING+VARIANT | 感谢主题稳定出单 |
| **Music** | ×2 | RISING+SWEET_SPOT | 吉他/乐队主题 |

### 4.4 选品组合示例

| 组合 | 热度 | 参考ASIN | 数据 |
|------|------|----------|------|
| Funny + Highland Cow + Bathroom × Metal Tin Sign | 🔥已验证 | B0GL7SZN3R | RISING |
| Sympathy + Memorial Heart × Ceramic Keepsake | 🔥已验证 | B0FX9H8LGT | BURST, 月销1,072 |
| Funny + Bar/Beer × Metal Tin Sign | 🔥已验证 | B0G25K69FG | BURST+SWEET_SPOT |
| Books Read Tracker × Wooden | ⭐新兴 | B0GT84NW4Y | BURST, 上架48天 |
| Motorbike + Vintage × Metal Signs | ⭐新兴 | B0G8TKH5ZC | BURST, 上架99天 |

### 4.5 价格空白

| 价格带 | 机会 |
|--------|------|
| £2.49-£3.59 | 低价引流，可增加变体 |
| £10.00-£12.99 | 空白区，适合高端木质或套装 |

---

## 五、匹配结果: product_line_elements 表

这是整个系统的**最终产出** — 每个被AI判定为"好品"的ASIN，拆解为元素/载体/场景/关键词后写入MySQL。

### 5.1 数据规模

| 指标 | Posters & Prints | Signs & Plaques | 合计 |
|------|-----------------|-----------------|------|
| 唯一ASIN数 | 40 | 40 | 80 |
| 数据库记录数 | 80 | 240 | **320** |
| 记录数 > ASIN数的原因 | 同一ASIN多轮AI分析产生不同元素表达 | | |
| is_winner=1 | 80 (100%) | 240 (100%) | 320 |
| 均价 | £7.17 | £6.83 | £6.93 |
| 均月销 | 122 | 188 | 155 |
| 均BSR | 141,945 | 100,470 | 115,386 |

### 5.2 匹配商品清单（按销量排序 Top 20）

| ASIN | 品线 | 月销 | BSR | 价格 | 核心元素 | 载体 |
|------|------|------|-----|------|----------|------|
| B0FXLD28S6 | Signs & Plaques | 1,091 | 37,603 | £3.59 | Happy Place, Retro, Funny | Metal Signs |
| B0FX9H8LGT | Signs & Plaques | 1,072 | 25,497 | £5.99 | Sympathy, Memorial Heart, Bereavement | Ceramic Keepsake |
| B0FWJKLYBM | Signs & Plaques | 707 | 66,813 | £7.99 | Vintage Chicken Coop, Farmhouse | Tin Sign |
| B0G1YG2K3C | Posters & Prints | 690 | 64,574 | £7.84 | Leopard, Skateboard, Animal | Poster, Canvas |
| B0FCFCHM9G | Signs & Plaques | 538 | 31,652 | £4.99 | Thank You, Appreciation | Ceramic Plaque |
| B0F3C9MSSM | Signs & Plaques | 394 | 41,831 | £6.49 | Darts Scoreboard, Checkout Chart | Metal Wall Art |
| B0G1M2V7LZ | Posters & Prints | 372 | 60,276 | £7.99 | Love You Bye, Boho, Farmhouse | Wooden Sign |
| B0FD3F5SBL | Signs & Plaques | 347 | 138,736 | £9.99 | Inspirational, Rainbow, Motivational | Plaque Sign |
| B0FSSB8LFB | Signs & Plaques | — | — | £2.99 | Funny Cat, Bathroom, Vintage | Metal Signs |
| B0G25K69FG | Signs & Plaques | — | — | £6.49 | Bar Open, Proudly Serving, Funny | Metal Tin Sign |
| B0GSHQXPWC | Signs & Plaques | — | — | £6.49 | Plants, Happiness, Funny, Vintage | Metal Signs |
| B0GT84NW4Y | Signs & Plaques | — | — | £5.99 | Books Read Tracker, Reading Counter | Wooden Tracker |
| B0GCHX62MZ | Signs & Plaques | — | — | £5.99 | Racing Car, F1, 2026 Calendar | Metal Signs |
| B0GFWDY3PL | Posters & Prints | — | — | £7.99 | Car, Racing, Black and White | Poster, Wall Art |
| B0FHPDV6DZ | Posters & Prints | — | — | £6.99 | Car, Super Car, Sports Cars | Canvas Wall Art |
| B0FQ4YBBNP | Posters & Prints | — | — | £7.99 | Cocktails, Retro | Canvas Wall Art |
| B0FVRCSQFN | Posters & Prints | — | — | £6.99 | Sports Car, Racing Cars | Poster, Wall Art |
| B0F1NBKQ6W | Posters & Prints | — | — | £6.49 | Gaming, Watercolor Video Game | Wall Art, Poster |
| B0GL7H3JXT | Posters & Prints | — | — | £6.49 | Superhero, Hulk, Spiderman | Canvas, Wall Art |
| B0FYCZDFG9 | Posters & Prints | — | — | £4.99 | 1% Better, Inspirational Quote | Canvas Print |

### 5.3 数据库表结构

```sql
product_line_elements (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    marketplace     VARCHAR(8)     -- 'UK'
    month           VARCHAR(8)     -- '202605'
    bsr_id          VARCHAR(64)    -- 'kitchen'
    node_id         BIGINT         -- Amazon browse node ID
    node_name       VARCHAR(128)   -- 'Posters & Prints' / 'Signs & Plaques'
    asin            VARCHAR(20)    -- Amazon ASIN
    title           VARCHAR(512)   -- 商品标题
    listing_days    INT            -- 上架天数
    units           INT            -- 月销量
    bsr             INT            -- Best Seller Rank
    price           DECIMAL(8,2)   -- 售价
    variations      INT            -- 变体数
    signal_tags     JSON           -- ["BURST","VARIANT","SWEET_SPOT"]
    elements        JSON           -- ["Car","Racing","Black and White"]
    carriers        JSON           -- ["Poster","Canvas Wall Art"]
    scenes          JSON           -- ["Bedroom","Man Cave"]
    is_winner       TINYINT        -- 1=好品, 0=普通
    ai_keywords     JSON           -- {"en":[...], "cn":[...]}
    analysis_batch_id VARCHAR(64)  -- 批次ID
)
```

---

## 六、前端品线选品模块

### 6.1 用户操作流程

```
1. 打开前端 → 选品中心菜单
2. 左侧品线树 → 展开 Home & Kitchen → Artwork → Posters & Prints
3. 点击已分析节点（绿色圆点）→ 加载品线模型
4. 中间面板展示:
   ├─ 健康度环形图 (conic-gradient 动画)
   ├─ ✅ 已验证元素标签云 (可多选)
   ├─ 📦 载体画像卡片 (hover显示竞品数)
   └─ 🔥 推荐组合卡片 (一键应用筛选)
5. 点击"应用全部筛选" → 竞品结果面板展开 (45vh)
6. 竞品表格 → 复选框批量选择 → 加入选品列表
```

### 6.2 技术架构

```
modules/product-line-selection/     (9文件, ~1,400行 Vue3)
├── manifest.ts          → 即插即用，不改 router/sidebar
├── store.ts             → Pinia Store
├── index.vue            → 三栏布局
└── components/
    ├── ProductLineTree.vue       → L1/L2 树 + 状态圆点
    ├── ProductLineModel.vue      → 模型面板
    ├── ModelCard.vue             → 可折叠卡片
    └── CompetitorResultTable.vue → 竞品表格
```

---

## 七、得到了什么？— 商业价值总结

### 7.1 可直接操作的选品清单

**320条结构化选品记录**，每条记录包含：
- **卖什么**: 元素组合（如 Car + Racing + Black/White）
- **用什么载体**: Poster / Canvas Wall Art / Metal Signs
- **在什么场景**: Bedroom, Man Cave, Bathroom
- **用什么关键词**: 中英文搜索词，可直接用于Amazon Listing
- **价格定多少**: 基于价格带分析的建议区间
- **是否是Winner**: is_winner=1 表示已验证的好品模式

### 7.2 可复用的品线模型

每个小类产出一个**12章节MD报告**，包含：
- 品类健康度判断
- 质量基准（BSR/评分/重量/FBA下限）
- 已验证元素 × 跨载体矩阵
- 推荐组合（元素×载体×场景×关键词）
- 新兴元素（低竞争高潜力）
- 价格空白（选品机会区间）
- 搜索关键词（英文15+中文10）

### 7.3 可扩展的系统能力

```
当前: UK 202605 → 2小类 → 320条记录
目标: UK + DE + US → 全量89小类 → 估计 10,000+ 条记录
      ↓
      郑总可以看到:
      - 每个品线的盈利模式（元素×载体×关键词）
      - 每个ASIN的具体数据（月销/BSR/价格/信号）
      - 前端一键筛选 → 选品决策时间从数天缩短到数分钟
```

---

## 八、技术栈总览

| 层 | 技术 | 规模 |
|----|------|------|
| 数据预处理 | Python `preprocess.py` | 526行 |
| AI分析 | DeepSeek V4 Flash + OpenAI SDK | 360行 |
| 结果持久化 | Python `save_results.py` | 863行 |
| 批次执行 | Python `batch_runner.py` (5线程并发) | 398行 |
| 数据聚合 | Java Spring Boot `sjzm-product` | — |
| 前端品线选品 | Vue3 + Pinia + Element Plus | ~1,400行 |
| 品线模型产出 | MD报告 + JSON + MySQL | 每小类12章节 |
| 匹配商品库 | MySQL `product_line_elements` | 320条记录 |

---

## 九、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| AI分工 | "脚本算数值, AI做判断" | AI擅长语义提取和模式发现，不擅长算数 |
| 取样策略 | Top畅销 + 新星并集, ≤40品/小类 | 平衡覆盖度与AI分析成本 |
| 变体归组 | parent_asin + 标题前10词 | 处理无parent_asin的独立品 |
| 信号体系 | 7种互斥+叠加标签 (BURST/RISING/STABLE/DECLINING/DEAD/VARIANT/SWEET_SPOT) | 比单一评分更立体 |
| 元素/载体/场景 | 三个独立维度 | 元素可跨载体复用，场景决定关键词方向 |
| 多轮AI分析 | 同一ASIN多次分析取并集 | 不同轮次提取不同维度的元素，丰富度更高 |
| 批次状态机 | pending→analyzing→done/partial/error | 支持增量恢复 |
| 前端模块化 | manifest.ts 即插即用 | 不改router/sidebar |
