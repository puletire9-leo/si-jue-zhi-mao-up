# 垃圾 ASIN 标题分析

> 目的：基于标题分析“为什么不要”，并和我们自己表现好的产品做对比。
> 关键修正：不能粗暴按 `带电`、`卡通`、`玩具`、`汽车` 一刀切。我们要的是轻小、可定制、主题化、低责任风险的商品；不要的是侵权、插头电源、化学药剂、安全责任、大件重货、强功效承诺类商品。

---

## 我们真正要什么

参考 `产品数据/产品表现ASIN_转换版2.md`，我们表现好的产品有清晰共性：

| 好品方向 | 标题信号 | 为什么适合 |
|----------|----------|------------|
| 轻小主题品 | keyring, card, sticker, coin, charm, badge, bookmark | 小体积、低运费、低售后、可做主题差异化 |
| 派对/礼品/节日 | birthday, party, banner, cake topper, gift, favour | 需求明确，标题吃细分人群，供应链轻 |
| 泛动物/情绪主题 | capybara, highland cow, cat, fox, turtle, robin, dragon | 可做原创风格，不天然侵权，适合轻定制 |
| DIY/手工材料 | craft, resin, acrylic, diamond art, mould, template | 功能简单，责任低，适合组合和包装优化 |
| 小型工具/配件 | bike tool, fishing lure, golf score card, sewing ruler | 低结构复杂度，非核心安全件，可按细分需求切入 |
| 轻定制载体 | mug, tote bag, cosmetic bag, drawstring bag, suncatcher | 可用设计和主题放大价值，供应链成熟 |
| 小电池消费品 | counter ring, LED toy, wheel light, pet toy, electronic card | 不是接市电/供电设备，风险可复核，不是天然垃圾 |
| 泛卡通玩具 | animal figure, 3D printed toy, squishy, fidget toy | 如果无明确 IP，可以做；玩具本身不是垃圾 |

一句话：**我们要轻小、主题化、可包装、可定制、低合规和低责任风险的细分商品。**

---

## 不要误杀的规则

### 1. 有电池不等于垃圾

不能看到 `battery`、`rechargeable`、`LED`、`electric` 就直接拒绝。

我们自己表现好的产品里有：

- 电子计数戒指
- 摩托车小钟表
- 轮胎气门嘴灯
- 发光发声小玩具
- 宠物互动球
- 音乐灯光贺卡
- 电子计时器

这些属于 **自带小电池工作的消费品**，可以复核，不是直接淘汰。

真正要拒绝的是 **电源/插头/给别的设备供电的商品**：

```text
charger, adapter, power supply, plug, socket, outlet,
wall charger, AC adapter, mains powered, extension cord, power strip
```

判断原则：

> 不拒绝“用电池工作的商品”；拒绝“接市电、带插头、给设备充电/供电的商品”。

### 2. 卡通不等于侵权

不能看到 `cartoon`、`cute`、`animal` 就拒绝。我们卖玩具、派对、儿童用品、动物主题产品，本来就会大量出现卡通风格。

可接受或可复核：

```text
cartoon animal, cute animal, capybara, highland cow, fox, cat,
dragon, turtle, robin, dinosaur, fairy, fantasy creature
```

真正要拒绝的是明确 IP / 明星 / 粉丝商品：

```text
K-pop, BTS, BLACKPINK, idol, photocard, fan merch,
Disney, Marvel, Pokemon, Pikachu, Mario, Sonic, Hello Kitty,
Barbie, Bluey, Paw Patrol, Peppa Pig, Stitch, Harry Potter,
Star Wars, Minecraft, Roblox, One Piece, Naruto, Demon Slayer
```

判断原则：

> 不拒绝“泛卡通风格”；拒绝“明确 IP、明星、角色、影视游戏动漫依赖”。

---

## 标题拒绝框架

### A 类：标题命中基本直接拒绝

| 拒绝类型 | 标题信号 | 为什么拒绝 |
|----------|----------|------------|
| 明确 IP / 明星 / 粉丝商品 | K-pop, idol, photocard, fan merch, 具体角色/品牌/影视游戏名 | 侵权、授权、平台投诉风险高，不可长期做 |
| 插头/充电器/电源类 | charger, adapter, plug, power supply, socket, mains powered | 安规、过热、插头制式、认证和责任风险高 |
| 化学/药剂/杀虫 | chlorine, herbicide, pesticide, killer, spray, cleaner, remover | 合规、运输、泄漏、功效争议和差评风险高 |
| 安全责任件 | swim vest, seat belt extender, gas cooker, life jacket | 一旦出事故，责任远高于利润 |
| 强功效修复类 | scratch remover, rust remover, headlight restoration, deep repair | 效果主观，退货差评难控，标题承诺过强 |
| 大件重货 | 2M pool, 10kg, car cover, tent, large shelter | 物流、仓储、退货成本不适合我们模式 |

### B 类：高风险人工复核

| 复核类型 | 标题信号 | 复核重点 |
|----------|----------|----------|
| 小电池消费品 | battery, rechargeable, LED, electronic, electric | 是否接市电？是否带充电器？是否低压小件？是否有认证资料？ |
| 泛卡通/动物主题 | cartoon, cute, animal, fantasy, dragon, capybara | 是否明显仿 IP？图片/包装是否侵权？是否原创/通用造型？ |
| 儿童玩具 | kids, boys, girls, toddler | 是否小零件、磁铁、入口、弹射、水上安全？ |
| 汽车小配件 | car, bike, motorbike, automotive | 是装饰/小配件，还是安全核心件/电源件/液体修复件？ |
| 宠物用品 | dog, cat, bird, hamster, reptile | 是玩具/装饰/用品，还是药剂、驱赶、电击、训练伤害类？ |

### C 类：不应单独作为拒绝原因

这些词本身不能判垃圾：

```text
toy, kids, cartoon, cute, animal, battery, LED, rechargeable,
fishing, pet, bike, car, party, gift, mug, bag, charm, acrylic,
magnetic, fidget, squishy, decoration
```

它们只提供背景，不能定生死。

---

## 这批垃圾 ASIN 的标题分析

| ASIN | 标题核心 | 为什么不要 | 精准标签 |
|------|----------|------------|----------|
| B0H26QW523 | RED DRAGON Darts / Gerwyn Price 'Iceman' | 不是普通飞镖配件，而是 RED DRAGON 品牌 + Gerwyn Price 运动员名绑定，销量来自品牌/名人资产，不可复制。 | 明确品牌/名人依赖 |
| B0H451CL7P | NanoPolix Scratch Remover | 车漆划痕修复，标题靠 `scratch remover`、`deep scratches`、`long-lasting protection` 这类强效果承诺卖货，售后和差评风险高。 | 强功效修复、车品效果争议 |
| B0H6BHHQRG | Nanopolix Scratch Remover Cloth | 划痕修复布，和上一类一样是车漆修复功效品，还疑似蹭 Nanopolix/Nano Polix 关键词。 | 强功效修复、品牌词风险 |
| B0H1FYY6NN | Universal Seat Belt Extender | 安全带延长器是汽车安全责任件，`universal` 和 `compatible with most vehicles` 承诺过宽，事故责任不可控。 | 安全责任件、适配风险 |
| B0GYSC4B8M | Pool Skimmer Net | 泳池季节品，功能单一，偏体积件，不是轻主题/轻定制优势品。 | 季节品、低差异化 |
| B0H3KKG4H7 | Windscreen Chip Repair Kit | 挡风玻璃修复涉及车辆安全和修复效果，标题强调 `5 Min Quick`、`Long-Lasting`，效果预期难控。 | 安全责任、强功效修复 |
| B0H1CJ5TTK | Peppermint Oil Rat Repellent | 驱鼠类，标题有 `repellent`、`long lasting protection`、`family & pet safe`，属于功效和安全承诺双风险。 | 驱虫驱鼠、功效争议 |
| B0H2DDNR91 | Swim Vest / Swim Jackets | 游泳背心是水上安全件，标题出现 `safety strap`、`whistle`、`reflective`，责任太重。 | 水上安全责任 |
| B0GZYMZXSL | Car Cover Outdoor All Weather | 车罩是大件/适配件，标题有 `universal`、`all weather`、`waterproof`、`scratch proof`，退货和差评风险高。 | 大件、适配风险、过度承诺 |
| B0GYG2HBBL | Camping Stove Gas Cooker + Butane Gas | 燃气炉和丁烷气相关，明火/燃气/运输/合规风险过高。 | 燃气安全、危险品 |
| B0GX2F5MY2 | Electric Fly Zapper Racket | 不是普通小电池玩具，而是电击灭虫工具；低客单、同质化，并涉及电击安全。 | 电击灭虫、低客单同质化 |
| B0H1VBTDFY | Iron Eraser Rust Remover Spray | 铁粉/锈迹去除喷雾，化学液体 + 快速功效承诺，材料腐蚀和效果争议大。 | 化学液体、强功效 |
| B0GZV94HMC | Multi-enzyme Foam Cleaner | 多酶泡沫清洁剂，覆盖 car/kitchen/bathroom/sofa 过多场景，化学清洁和材质损伤风险高。 | 化学清洁、泛场景过度承诺 |
| B0GSZMXFB1 | Pop Up Sun Shelter Pet Tent | 遮阳帐篷，季节性强，结构件/体积件，和我们轻小主题品不匹配。 | 季节品、结构件、大体积 |
| B0H3NNKJB4 | Nano Scratch Remover Kit | 车漆划痕修复套装，标题强调 `deep scratches`、`restore shine`，效果难兑现。 | 强功效修复、售后风险 |
| B0H2CP942G | Ant Bait Stations | 蚂蚁诱饵站，属于杀虫/药剂方向，功效、成分、家庭安全都有风险。 | 杀虫合规、功效争议 |
| B0H4MKLMM5 | Ant Killer Bait Stations | 标题直接写 `Ant Killer`、`kills ants & nests`，杀灭功效强承诺。 | 杀虫合规、强功效 |
| B0GSP25JRB | Bike Chain + Tool Kit | 自行车链条是骑行传动件，有规格适配和安全责任；不同于我们可做的自行车小工具/铃铛/装饰。 | 适配风险、骑行安全件 |
| B0H3LDLZLZ | Ant Killer Plus Spray Bundle | 杀虫喷雾，液体 + 杀虫 + `kills on contact`，直接高风险。 | 杀虫喷雾、液体化学品 |
| B0H4MNXLDY | Freezer Block / Ice Packs | 冰袋低客单、季节性、体积占比高，差异化弱。 | 低客单、季节品、体积成本 |
| B0H1X4QGZR | JOYIN Bubble Solution | JOYIN 明确品牌，泡泡液是液体；标题带 Easter、summer、kids outdoor play，季节和液体双风险。 | 品牌依赖、液体、季节品 |
| B0GYZ3HZ5H | Fly & Wasp Spray + Fly Swatter | 黄蜂/苍蝇喷雾，属于杀虫液体；不是普通派对/户外小件。 | 杀虫液体、功效合规 |
| B0H4R67K5N | Max Power Herbicide | 除草剂是农药/化学品，`Max Power`、`Fast-Acting`、`Reaching the Roots` 都是强功效词。 | 农药化学品、高合规风险 |
| B0GTQPCFS4 | Hot Tub Chlorine Tablets | 氯片，泳池/热水浴缸化学品，危险品/储运/合规风险。 | 化学品、危险品、季节品 |
| B0GVRQ88RV | Car Headlight Restoration Kit | 大灯修复涉及车辆安全可视性，标题承诺 `restores clarity`、`removes yellowing`，效果风险高。 | 车品修复、安全责任 |
| B0H4FMHWN4 | Chlorine Tablets | 氯片，包含 algaecide、stabiliser、clarifier 等化学功效词。 | 化学品、危险品、季节品 |
| B0GH7YS1FM | 2M Paddling Pool | 2 米充气泳池，明显大件、季节品、儿童水上场景，漏气退货和安全风险高。 | 大件、季节品、儿童水上风险 |
| B0GGH7C862 | 5000V Fly Zapper | 高压灭虫灯，标题突出 5000V，属于电击灭虫设备，不是普通低压小电池玩具。 | 高压带电、灭虫设备 |
| B0GY3LM11X | Electric Scooter Charger | 标题明确 `Charger`，是给电动滑板车锂电池充电的设备；充电器/适配器类直接拒绝。 | 充电器、电源安全 |
| B0GR639XLH | Back to Black Trim Restorer | 汽车塑料还原剂，化学涂层/修复效果类，标题承诺 `quick effect`、`long-lasting`、`prevents aging`。 | 化学修复、功效承诺 |
| B0GZLM85CK | Wild Bird Food 10kg | 10kg 鸟食，重货；饲料类还有保存、破损、仓储和物流成本问题。 | 重货、饲料、低差异化 |
| B0GX95YKKD | Tyre Inflator Air Compressor | 充气泵是带电/电池/压力设备，150 PSI，质控和安全责任高。 | 压力设备、带电工具 |
| B0H21YS2BQ | Kids Water Bottle with K-pop Cartoon Pattern | 关键不是 water bottle 或 cartoon，而是 `K-pop`。儿童水壶叠加 K-pop 图案，版权/肖像/IP 风险直接拒绝。 | K-pop 侵权、儿童用品 |
| B0GWNH3J6R | Wasp & Nest Killer Powder | 黄蜂巢杀虫粉，粉末 + 杀虫 + `fast acting`，使用安全和合规风险高。 | 杀虫粉末、强功效 |
| B0GX5VDSH8 | Bug Zapper 3000V | 3000V 灭虫灯，高压电击类；户外/露营又增加耐候质量风险。 | 高压带电、灭虫设备 |
| B0GQZ4SZJC | Chlorine Tablets + Dispenser | 泳池氯片 + 漂浮器，化学品和季节品叠加。 | 化学品、危险品、季节品 |
| B0GX594FQC | Car Scratch Remover Wax | 车漆划痕修复蜡，标题写 `deep scratches`、`all paint types`，承诺过强。 | 强功效修复、同质化 |

---

## 和我们好品的关键区别

| 维度 | 我们要的好品 | 这批垃圾品 |
|------|--------------|------------|
| 体积重量 | 轻小、可 OPP 袋、可压缩、可平铺 | 2M 泳池、10kg 鸟食、车罩、帐篷、喷雾套装 |
| 风险类型 | 设计/主题/包装竞争 | 化学、杀虫、充电器、燃气、水上安全、车漆修复 |
| IP 关系 | 泛动物、原创风格、通用主题 | K-pop、明确品牌/名人、疑似品牌词 |
| 电类边界 | 小电池消费品可复核 | 充电器、高压灭虫、压力设备直接高风险 |
| 标题卖点 | 礼品、主题、装饰、DIY、小配件 | fast acting、kills、restores、deep repair、all weather |
| 售后预期 | 低功能承诺，坏了影响小 | 效果不达标、适配失败、使用安全事故 |

---

---

## 大类 × 标题联合初筛（核心方法）

> 初筛阶段只有：类目名称、ASIN、标题、价格、review 数量、排行、任务源网址。
> 任务源网址里的大类 slug（如 `.../new-releases/arts-crafts/...`）是每个 ASIN 天然自带的赛道标签，不用从标题猜品类。这是初筛最有价值的维度之一。

### 三个作用机制

**1. 大类锁定赛道，标题判断"是不是这个赛道里我们能吃的形态"**

每个赛道都有我们能做的子品类和碰不了的子品类。大类先定位赛道，标题 + 小类名称再判断形态。

判断公式：

```
赛道(大类)对 × 子品类(小类词)对 × 形态(耗材/套装/小件/低价) × 无品牌 × 无大件材质 = 通过
任何一项严重偏离 → 降权或拒绝
```

**2. 大类给标题词消歧**——同一个词在不同大类含义不同：

| 标题词 | 好的大类语境 | 坏的大类语境 |
|--------|--------------|--------------|
| spray | beauty（定型/护理喷雾） | garden/pest（杀虫喷雾） |
| kit | arts-crafts（DIY 套装） | automotive（划痕/大灯修复套装） |
| charger | 基本都拒绝 | electronics/automotive（充电器） |
| powder | beauty（散粉） | garden（杀虫粉） |
| box | toys（盲盒/套装） | arts-crafts（实木收纳箱） |
| cleaner | —（多数拒绝） | automotive/home（化学清洁剂） |

**3. 大类 + 标题错配 = 蹭类目信号**——标题品类和大类对不上（automotive 里冒出厨房用品），多半是蹭冷门类目冲新品榜，进复核。

### 案例演示：B0GTYZVLZ5

| 字段 | 值 | 判断 |
|------|-----|------|
| 大类 slug | arts-crafts | ✅ 手工艺赛道，我们做钻石画/DIY/缝纫模板，赛道对 |
| 小类名称 | Art Tool & Sketch **Storage Boxes** | ⚠️ 收纳盒子类，耐用大件，不是耗材 |
| 标题 | MEEDEN / **Solid Beech Wood** / Organizer / **Drawer Box** | ❌ 品牌品 + 实木大件 + 收纳箱 |
| 价格 | $37.95 | ❌ 远超客单带（£4-15 ≈ $5-20） |
| review/排行 | 10 / 新品榜第 1 | 新品榜 review 少属正常，不作淘汰依据 |

结论：**好赛道里的坏形态**——赛道对，但子品类、材质、品牌、价格四项全偏离，拒绝。同样 arts-crafts 大类若是 `50Pcs Diamond Painting Kit` / `DIY Suncatcher Kit £6.98` 则通过。

### 榜单结构洞察：商品量最大的子类恰恰是要避开的

> 依据：`docs/大类榜单/tree_UK.json`（UK 新品榜去重 66849 个 ASIN 的类目树）。

把新品榜按类目树展开后有个反直觉但很重要的规律：**每个大类里商品堆积最多的头部子类，往往正是我们碰不了的红海/大件/重货；我们的好品藏在中后段的小件子类里。** 所以大类的商品分布本身就是一张"垃圾在哪、机会在哪"的地图。

UK 三个最大垃圾聚集大类：

| 大类 | 占比最大的头部子类（要避开） | 我们要的缝隙子类（靠后但存在） |
|------|------------------------------|--------------------------------|
| Garden（24334，最大） | Garden Furniture & Accessories 11504（户外家具/坐垫/遮阳/家具罩，全是大件重货）、Mowers & Power Tools 1238、Pools & Hot Tubs 628 | Garden Décor 3194 里的太阳捕手/地插摆件、Bird & Wildlife Care 里的小喂食器 |
| Sports & Outdoors（20636） | Sports 8765、Supporters' Gear 4015（球队正版周边，IP 风险）、Fitness 2092（器械大件） | Hunting & Fishing 2029 里的钓鱼小件、Accessories 767 里的小配件 |
| Automotive（10308） | Car Parts 2871、Motorbike Parts 2807（功能核心件/适配件）、Car & Motorbike Care 1167（化学修复/清洁剂） | Car Accessories 1777 里的装饰小件、Gifts & Merchandise 212（汽车主题礼品） |

反过来看，我们真正的主场大类在榜单里体量并不大，但几乎全是好品形态：

| 大类 | 体量 | 里面几乎全是我们能做的 |
|------|------|------------------------|
| Toys & Games | 6213 | Novelty & Gag（Squeeze 586 / Fidget 267）、Arts & Crafts（Craft Kits 640）、Party Supplies（Decorations 324）、Soft Toys、Collectible Figures |
| Fashion | 1793 | 但要避开 Sport Specific Clothing 688（球队服饰 IP）和 Clothing（服装非我们强项），要的是 Accessories/Jewellery 里的钥匙扣手链发饰 |
| Home & Kitchen | 915 | Home Accessories（装饰件）、Arts & Crafts（串珠/手工）、避开 Furniture 75 |
| Stationery & Office | 59 | 贺卡、书签、planner、贴纸 |

**这给初筛加了一层判断**：拿到 ASIN 的大类+小类后，先看它落在该大类的"头部红海子类"还是"缝隙好品子类"。

- 落在头部大件/核心件/正版周边子类（Garden Furniture、Car Parts、Supporters' Gear、Fitness、Pools）→ 强降权，标题再好也多半是大件/标品/IP。
- 落在缝隙小件子类（Garden Décor、Fishing 小件、Car Accessories 装饰、Toys 的 Novelty/Craft/Party）→ 正常进标题+价格判断。

> 注意：新品榜里 Garden/Sports/Automotive 商品量巨大，说明这三条赛道竞争最激烈、大件垃圾最多。采集时若不按子类过滤，会被这三个大类的红海大件淹没。反而 Toys & Games、Fashion 饰品、Stationery 这些"小而美"赛道命中好品的密度更高。

### 三站对比：UK / DE / US 分市场采集指导

> 依据：`tree_UK.json`（66849）、`tree_DE.json`（133424）、`tree_US.json`（64673）。

三个站点新品榜的大类分布差异很大，直接影响分市场采集策略：

| 站点 | 去重ASIN | 头部大类（体量/性质） | 我们主场大类的位置 |
|------|----------|----------------------|--------------------|
| UK | 66849 | Garden 24334、Sports 20636、Automotive 10308——**全是大件/核心件红海** | Toys 6213 排第 4，好品密度高但要往里挖 |
| DE | 133424（最大） | Fashion 39621、Küche/家居 25890、Garten 17895——服装+家居+园艺 | Spielzeug（玩具）6975 排第 6，Kosmetik 2704，Bürobedarf 1573 |
| US | 64673 | Home&Kitchen 14143、**Toys 12351（排第2！）**、Automotive 9751、Garden 9126、**Arts-Crafts 8828** | 玩具和手工艺是 top，好品赛道天然靠前 |

**关键差异与打法：**

1. **US 最适合我们的模型**——Toys（12351，排第2）和 Arts-Crafts（8828，排第5）都在头部，我们的核心品类（手工/DIY/玩具小件）在 US 榜单密度最高。US 的 Arts-Crafts 子类全是耗材/材料：Crafting 2267、Sewing 1284、Scrapbooking 1244、Beading 1172、Knitting 996——**几乎整条赛道都是好品形态**，你举例的 arts-crafts 就是 US 的强势赛道。

2. **DE 体量最大但陷阱最多**——Fashion 39621 里 76% 是服装（Damen 14063 + Herren 9321 + 童装），不是我们做的；真正能吃的是 Küche/家居 25890 里的 Wohnaccessoires & Deko 11611（家居装饰）和 **Basteln/手工 5708**。DE 采集要死盯"家居装饰 + 手工"两个子类，别碰服装。

3. **UK 红海最挤**——头部三个大类（Garden/Sports/Automotive）全是大件/核心件，我们的好品要往 Toys、Fashion 饰品里挖，采集必须按子类过滤。

4. **跨站共性**：无论哪个站，**Home/家居装饰 + Toys 的 Novelty&Gag + Arts&Crafts + Party Supplies** 这几个子类稳定是好品聚集地；**服装、家具、汽车核心件、园艺大件、健身器械**稳定是要避开的大件红海。

**采集优先级建议**：US（Toys + Arts-Crafts 直接采）> DE（只采家居装饰 + 手工）> UK（Toys + 饰品，重过滤）。

### 各大类子品类白/黑名单

| 大类 slug | 要的子品类（形态：耗材/套装/小件/低价/可定制） | 不要的子品类 |
|-----------|------------------------------------------------|--------------|
| arts-crafts | 钻石画、DIY 材料包、亚克力配件、缝纫模板、钩针、串珠、树脂配件、贴纸、印章、点胶笔、切割套装 | 收纳箱/organizer、画架 easel、实木竹制家具类、颜料桶(液体)、大幅画布、品牌画材(MEEDEN 等) |
| toys-games | 3D打印动物/人偶、捏捏乐/squishy、fidget、积木套装、派对气球/蛋糕装饰、益智小玩具、扑克卡牌 | 带插头电子玩具、大型玩具、正版 IP 玩具(乐高/宝可梦卡)、婴幼儿入口件(严查)、大型骑行玩具 |
| home-kitchen / kitchen | 马克杯、亚克力挂牌/太阳捕手、铁皮画、硅胶冰格模具、餐垫、装饰摆件、帆布袋、门牌标志、小收纳件 | 大型家电、刀具(安全)、玻璃大件、化学清洁剂、大型收纳家具 |
| garden | 太阳捕手、花园地插/摆件、装饰件、小型园艺工具、攀爬架、小号鸟食器 | 化学品(除草剂/杀虫)、氯片、大型户外家具、泳池、10kg 鸟食(重货) |
| automotive | 装饰件(头枕套、氛围灯贴、排风夹)、小配件(卡扣/盖子/垫片/螺丝)、小工具 | 化学修复剂(划痕/大灯/铁粉/清洁)、充电器、安全核心件(安全带延长)、大件(车罩)、液体 |
| pets | 宠物玩具、装饰、小用品(喂食夹/清洁刷/牵引钩)、鱼缸背景贴、爬宠配件 | 药剂、电击/超声波驱赶器、GPS 定位器(带电+隐私)、电击项圈、大型笼具 |
| sports-outdoors | 钓鱼小件(竿袋/假饵/串钩/配件)、高尔夫小配件(记分器/marker)、自行车小件(铃铛/灯/工具)、束口袋、水壶 | 化学品(泳池氯片)、大型器械、救生衣(安全)、燃气炉、充电器 |
| fashion | 钥匙扣、零钱包、手链、发饰、化妆包、帽子、袜子、小饰品 | 明星/球队正版联名、真人肖像商品 |
| stationery-office | 贺卡、书签、贴纸、便签、笔、宗教本、planner、书挡 | 大型办公设备、碎纸机等 |
| beauty | 美甲工具/磁铁/贴纸、发饰、化妆包、按摩小工具 | 化妆品/护肤品(入口/皮肤+功效+认证)、美容仪(带电+皮肤) |

### 初筛判断流程（可执行）

对每个 ASIN 依次判断，命中任一"直接拒绝"即淘汰：

1. **价格带**：换算后 > £20/$25 且非明显礼盒套装 → 降权；> £30 → 拒绝。
2. **大类 → 子品类**：查该大类黑名单，标题/小类命中黑名单子品类 → 拒绝。
3. **通用死因**（跨大类，见强拒绝标签）：真人明星/K-pop、charger/电源、化学杀虫、安全责任件、单功能大件重货 → 拒绝。
4. **品牌/材质**：标题出现知名品牌词，或实木/金属/玻璃等大件材质 → 拒绝或降权。
5. **形态加分**：标题含 Pcs/Set/Pack/Kit + 大类白名单子品类 + 低客单 → 通过并标 `GOOD_*`。
6. **错配/擦边**：标题品类与大类不符，或含可改写 IP → 进复核。

> review 数量和排行在"新品榜(New Releases)"场景下不作淘汰依据——新品本来 review 就少；它们更适合做"是否有需求"的正向参考，而非负向筛除。

---

## 可转成初筛系统的标签

### 强拒绝标签

| 标签 | 命中逻辑 | 处理 |
|------|----------|------|
| `BAD_IP_REAL_PERSON` | K-pop、真人明星/偶像、正版角色形象照、强肖像/强粉丝且无法改写 | 直接淘汰 |
| `BAD_POWER_SUPPLY` | charger、adapter、plug、power supply、socket、mains powered | 直接淘汰 |
| `BAD_CHEMICAL_EFFECT` | chlorine、herbicide、pesticide、spray cleaner、rust remover、scratch remover | 直接淘汰或强复核 |
| `BAD_PEST_CONTROL` | ant/wasp/rat/fly + killer/repellent/spray/powder/bait | 直接淘汰 |
| `BAD_SAFETY_LIABILITY` | swim vest、seat belt extender、gas cooker、life jacket | 直接淘汰 |
| `BAD_SINGLE_FUNCTION_BULKY` | 单功能 + 大件/重货 + 无组合空间（pool、car cover、tent、10kg） | 降权或淘汰 |
| `BAD_HIGH_TICKET_COMMODITY` | 高客单（>£20）+ 红海标品 + 无主题差异 | 降权或淘汰 |
| `BAD_OVERCLAIM_REPAIR` | deep scratches、restore shine、removes yellowing、long-lasting protection | 强复核/多半淘汰 |

### 复核标签

| 标签 | 命中逻辑 | 处理 |
|------|----------|------|
| `REVIEW_IP_REWRITABLE` | meme、游戏名、作品名、通用超级英雄元素（spider/bat/brainrot/67/Hamilton/Fourth Wing）| 复核能否改写规避，不直接杀 |
| `REVIEW_PRICE_BAND` | 售价 > £20 | 复核，>£25 且非礼盒降权 |
| `REVIEW_BATTERY_CONSUMER` | battery、rechargeable、LED、electronic，但不是 charger/adapter | 复核，不直接拒绝 |
| `REVIEW_CARTOON_GENERIC` | cartoon、cute、animal、fantasy、dragon、capybara | 复核图片和 IP，不直接拒绝 |
| `REVIEW_CHILD_TOY` | kids、toy、toddler、baby | 看小零件/磁铁/入口/水上安全 |
| `REVIEW_AUTO_ACCESSORY` | car、bike、motorbike | 区分小配件 vs 安全核心件/液体修复件 |
| `REVIEW_PET_PRODUCT` | pet、dog、cat、bird、hamster | 区分玩具用品 vs 药剂/驱赶/伤害类 |

> 履约标记（`带电/带磁/带液体/走敏感渠道`）不参与选品淘汰，仅用于物流渠道判断。

### 好品倾向标签

| 标签 | 命中逻辑 | 说明 |
|------|----------|------|
| `GOOD_LIGHT_THEME_PRODUCT` | keyring、card、sticker、coin、charm、badge、bookmark | 轻小主题品 |
| `GOOD_BUNDLE_KIT` | Pcs / Set / Pack / Kit + 小件品类 | 可改价、可差异化、可提客单 |
| `GOOD_PARTY_GIFT` | birthday、party、banner、cake topper、gift、favour | 派对礼品方向 |
| `GOOD_CUSTOM_SURFACE` | mug、tote bag、cosmetic bag、drawstring bag、suncatcher | 适合轻定制载体 |
| `GOOD_CRAFT_DIY` | craft、resin、acrylic、diamond art、mould、template | DIY/手工材料方向 |
| `GOOD_SMALL_ACCESSORY` | small tool、fishing accessory、bike bell、score card、sewing ruler | 小工具小配件 |
| `GOOD_GENERIC_ANIMAL_THEME` | capybara、highland cow、cat、fox、turtle、robin、dragon | 泛动物/情绪主题 |

---

## 复查优秀产品后的补充（重要修正）

把 593 个优秀产品全部看完后，发现几条之前没写、但非常关键的规律。这些直接影响初筛规则的准确性。

### 补充 1：我们其实靠“擦边 IP + 改词”在赚钱，不是完全避开 IP

优秀产品里大量出现 IP 或类 IP，但都做了规避处理，说明我们的策略不是“见 IP 就杀”，而是“擦边但改写、不直接侵权”：

| 优秀产品标题信号 | 处理手法 |
|------------------|----------|
| `Batman Inspirational Keyring`（蝙蝠钥匙扣） | 用 Bat 元素但包装成励志钥匙扣 |
| `Spider / Spiderman Party`（蜘蛛主题） | 用 spider/spider web，不直接写正版角色 |
| `Gorilla Tag Fidget Toy` | 蹭游戏名做玩具 |
| `Hamilton / Fourth Wing / Wicked` 音乐剧/小说周边 | 蹭作品名做马克杯、袋子、书挡 |
| `Italian Brainrot / Tralalero / Tung Tung / 67 meme` | 蹭 meme 做积木、蛋糕装饰、袜子 |
| `Roblx / Roblox 印花餐包`、`K*ll / F*ck` 等 | 故意改写字母规避审核 |
| `Top Model Sticker Books` | 蹭品牌词做贴纸本 |

**结论**：`BAD_IP_EXPLICIT` 不能做成“出现任何 IP 词就直接淘汰”。真正要杀的是**无法改写、强肖像、强粉丝、真人明星、正版角色照片**（K-pop 明星、真人偶像、迪士尼/宝可梦角色形象）。而 meme、游戏名、作品名、通用超级英雄元素这类**可以改写规避的擦边词，应该进复核而不是直接杀**。

所以 B0H21YS2BQ 的问题不是"有卡通/IP"，而是 **K-pop 绑定真人偶像 + 儿童用品**，改写空间小、肖像风险高。而如果是"cartoon girl water bottle"就不该杀。

### 补充 2：`带电/带磁/带液体` 是内部履约标记，不是淘汰理由

优秀产品标题的中文备注里反复出现 `带电产品！`、`带磁！`、`带液体`、`走敏感渠道`：

- 电子计数戒指、摩托车钟表、轮胎灯、电子鱼、发光鸭钥匙扣（带电，卖得好）
- 美甲磁铁、磁吸玩具、高尔夫磁吸校准器、十字绣磁性定位器（带磁，卖得好）
- 饮水鸟、高尔夫水平仪（带液体，走敏感渠道，照样上）

**结论**：这些标签是给物流/合规履约用的（空运敏感货渠道），不是选品淘汰信号。初筛不能把“带电/带磁/带液体”当垃圾特征。真正的电类死因还是 `charger/adapter/plug/电源`（B0GY3LM11X 滑板车充电器就是死在这）。

### 补充 3：客单价带（重要且之前完全没写）

优秀产品几乎全部集中在 **£3.98 ~ £15.99**，绝大多数 £5-£10。而这批垃圾 ASIN 里 £22.99、£25.99、£29.99 的（灭虫灯、氯片+器、充气泳池）明显偏离价格带。

| 维度 | 优秀产品 | 垃圾产品 |
|------|----------|----------|
| 主力客单价 | £4 ~ £13 | 多个 £17 ~ £30 |
| 隐含逻辑 | 低决策成本、冲动购买、礼品单价 | 单价高、决策重、退货损失大 |

**建议加标签** `REVIEW_PRICE_BAND`：售价 > £20 的进复核；> £25 且非明显礼品礼盒的降权。这不是硬淘汰，但要作为偏离信号。

### 补充 4：优秀产品高度依赖“组合/套装/多件”，垃圾品多是单功能件

优秀产品标题充满 `Pcs / Set / Pack / Kit / 套装`（2pcs 钥匙扣、38pcs 蛋糕装饰、120pcs 恐龙、60pcs 宾果卡）。这让我们能改价、能做差异化、能提客单。

而垃圾 ASIN 大多是**单一功能大件或单一化学品**（一个泳池、一桶鸟食、一瓶除草剂），组合和差异化空间小。

**建议加好品标签** `GOOD_BUNDLE_KIT`：标题含 Pcs/Set/Pack/Kit + 小件品类，是我们典型可操作品。

### 补充 5：季节品要看“能否常青化”，不是一律拒绝

优秀产品里也有季节/户外元素（足球气球、夏威夷蛋糕装饰、沙滩巾、露营打结板、花园装饰），但它们**依附于常青需求**（生日派对、送礼、家居装饰、兴趣爱好），不是纯季节功能品。

而垃圾 ASIN 的季节品是**功能强绑定单一季节**（泳池、氯片、除草剂、黄蜂喷雾），过季即死。

**修正** `BAD_BULKY_HEAVY` 和季节判断：季节主题若挂靠在派对/礼品/装饰/兴趣人群上可做；季节功能件（尤其化学+户外+大件）才拒绝。

### 补充 6：新增两个之前漏掉的强拒绝方向

从对比中还能提炼出两类垃圾特征，之前没单独列：

| 新增标签 | 命中逻辑 | 依据 |
|----------|----------|------|
| `BAD_SINGLE_FUNCTION_BULKY` | 单功能 + 大件/重货 + 无组合空间 | 泳池、车罩、帐篷、鸟食，无法靠套装差异化 |
| `BAD_HIGH_TICKET_COMMODITY` | 高客单 + 红海标品 + 无主题差异 | 灭虫灯、充气泵、氯片器，单价高又同质，打价格战 |

---

## 结论

这批垃圾 ASIN 不是因为“销量差”或“标题里有电/卡通/玩具/汽车”而垃圾。真正原因是它们偏离了我们的好品模型：

**我们要：轻小、低客单（£4-£15）、可组合套装、可轻定制、泛动物/兴趣人群、擦边可改写 IP、DIY小件、小工具小配件。**

**我们不要：真人明星/K-pop/正版角色照片这类不可改写的强 IP、插头充电器/电源适配器、化学杀虫药剂、强功效修复、安全责任件、单功能大件重货、高客单红海标品。**

后续标题初筛应先识别“好品画像”，再用强拒绝标签拦风险。特别注意三条防误杀：
1. `带电/带磁/带液体` 是履约标记，不是淘汰理由，真正杀的是 `charger/adapter/plug/电源`。
2. IP 不是一律杀，meme/游戏名/作品名/通用元素可改写规避的进复核，只杀真人明星/正版角色/强肖像。
3. 卡通、玩具、汽车、宠物、季节都不能单独定生死，要结合客单价、体积、组合空间、责任风险综合判断。
