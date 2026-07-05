# UK 品线无遗漏采集 · node_id 双清单

> 目的：确保好品线采集不漏货。每个核心品类分两部分给出 node_id：
> **① 自有好品主力小类**——命中量大、就是我们在做的核心落点，优先采。
> **② 分散落点小类**——同类商品散落到的其他小类，补采+标题兜底，确保无遗漏。
>
> 数据来源：`competitor_products`（marketplace=UK）按标题反查实际落点小类及其 node_id（竞品库实测，非推测）。node_id 为 amazon UK 叶子级真实节点，可直接配采集。
> 采集地址：`amazon.co.uk/gp/bestsellers/{node_id}` 或榜单页。
> ⚠️ 分散型品类：仅靠 node_id 仍会漏，采集后必须再用标题关键词全站兜底捞取。

---

## 1. 太阳捕手 / 挂饰 suncatcher — 分散型（务必双主力并采）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 4262967031 | Garden:Garden Décor:Garden Sculptures & Statues:**Sun Catchers** | 442 |
| 14520147031 | Toys & Games:Arts & Crafts:Craft Kits:**Glass Art & Suncatchers** | 360 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 2481713031 | Automotive:Car Accessories:Rearview Mirror Ornaments | 31 |
| 9641575031 | Baby Products:Nursery:Decoration:Window Decorations | 19 |
| 3028634031 | Home & Kitchen:Home Accessories:Hanging Ornaments | 8 |
| 11714601 | Garden:Garden Décor:Chimes | 8 |
| 21827817031 | Health:Alternative Medicine:Healing Crystals | 3 |
| 364250031 / 4539625031 | Toys:Jigsaws & Puzzles / 3-D Puzzles | 3+3 |

> 标题兜底关键词：`suncatcher / sun catcher / window hanging / stained glass`

## 2. 钥匙扣 keyring — 极度分散（无主导，必多采）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 11968017031 | Fashion:Accessories:Keyrings & Keychains:**Women** | 201 |
| 303802031 | Automotive:Gifts & Merchandise:**Key Rings** | 154 |
| 26894542031 | Toys:Novelty & Gag:Fidget:**Pop Fidget Toys** | 133 |
| 11968016031 | Fashion:Keyrings & Keychains:Men | 56 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 26230720031 | Sports:Supporters' Gear:Key Chains | 55 |
| 22649619031 | Automotive:Car Accessories:Key Shells | 43 |
| 200893031 | Stationery:Identification Badges:Badge Holders | 31 |
| 671729011 | Sports:Recreation Accessories:Reflective Gear | 30 |
| 1731112031 | Fashion:Novelty:Accessories:Key Chains | 22 |
| 26275718031 | Toys:Soft Toys:Plush Pillows | 19 |
| 14520148031 | Toys:Craft Kits:Jewellery-Making & Beadwork | 18 |
| 26958028031 | Home:Arts & Crafts:Party Favours:Keyring Packs | 18 |

> 标题兜底：`keyring / keychain / key ring / bag charm`

## 3. 手链 bracelet — 极度分散（70 小类）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 10382861031 | Fashion:Women:Jewellery:**Bracelets** | 91 |
| 5831996031 | Fashion:**Novelty Jewellery:Bracelets** | 40 |
| 10382853031 | Fashion:Men:Jewellery:Bracelets | 24 |
| 26165358031 | Sports:Supporters' Gear:Jewelry:Bracelets | 22 |
| 10382844031 | Fashion:Girls:Jewellery:Bracelets | 17 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 580160011 | Sports:Golf:Accessories:Scorers（计分手环，噪音需过滤） | 56 |
| 3785094031 | Sports:Sports Technology:Watchbands | 49 |
| 28968763031 | Sports:Fitness:Wristbands | 27 |
| 10382900031 | Fashion:Jewellery:Charms:Italian Style Charms | 13 |
| 3084952031 | Home:Arts & Crafts:Beading:Beads & Assortments | 11 |
| 10382896031 | Fashion:Jewellery:Charms:Bead Charms | 7 |

> 标题兜底：`bracelet / bangle / wristband / charm bracelet`。注意过滤 watchband/表带、grip 计分环噪音。

## 4. 人偶 / 公仔 action & 3D figure — 极度分散（65 小类）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 14520239031 | Toys:**Play Figures:Animals** | 74 |
| 14520141031 | Toys:**Play Figures:Action Figures** | 48 |
| 3028624031 | Home:Decorative Accessories:Collectibles:**Figurines** | 40 |
| 14520288031 | Toys:Hobbies:Collectible Figures:Statues | 33 |

**② 分散落点**（含 fidget/squeeze 交叉）
| node_id | 小类 | 命中 |
|---------|------|------|
| 26894538031 | Toys:Fidget:Simple Dimple | 52 |
| 26894542031 | Toys:Fidget:Pop Fidget Toys | 35 |
| 27950689031 | Toys:Dress-Up Accessories:Wands | 19 |
| 364237031 | Toys:Magic Kits & Accessories | 18 |
| 14520114031 | Toys:Novelty & Gag:Squeeze Toys | 17 |

> 标题兜底：`action figure / 3d printed / figurine / articulated / desktop toy`

## 5. 帆布袋 tote / canvas bag — 分散型

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 1769594031 | Home:Kitchen:Shopping Bags:**Reusable Shopper Bags** | 155 |
| 1769569031 | Fashion:Women:Handbags:**Totes** | 29 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 1769583031 | Sports:Gym Bags:Sports Duffels（束口/健身袋交叉） | 201 |
| 3099640031 | Beauty:Bags & Cases:Cosmetic Bags | 5 |
| 2722846031 | Sports:Cycling:Bike Backpacks | 3 |

> 标题兜底：`tote bag / canvas bag / shopping bag / shoulder bag`

## 6. 马克杯 mug — 分散型

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 3149386031 | Home:Tableware:Glassware:**Coffee Cups** | 50 |
| 26165514031 | Sports:Supporters' Gear:**Mugs & Glasses:Beer Glasses** | 46 |
| 22959828031 | Home:Vacuum Flasks:Insulated:Cups & Mugs | 36 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 22959829031 | Home:Insulated:Tumblers | 17 |
| 3076447031 | Sports:Camping:Outdoor Tableware:Cups & Mugs | 14 |
| 26165512031 | Sports:Supporters' Gear:Coffee Mugs | 13 |
| 3313572031 | Home:Racks & Holders:Mug Holders | 5 |

> 标题兜底：`mug / cup / tumbler / travel cup`

## 7. 蛋糕装饰 cake topper — 分散型

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 22936583031 | Toys:Party Supplies:Cake Decorations:**Non-Edible Cake Toppers** | 96 |
| 22936582031 | Toys:Party Supplies:**Non-Edible Cupcake Toppers** | 49 |
| 5230725031 | Toys:Party Supplies:Decorations:Birthday Candles | 59 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 15345968031 | Home:Arts & Crafts:Party Supplies:Party Packs | 25 |
| 14520239031 | Toys:Play Figures:Animals（动物插件交叉） | 13 |
| 364235031 | Toys:Party Supplies:Balloons | 11 |
| 5230720031 | Toys:Party Supplies:Banners | 10 |
| 26900717031 | Toys:Dollhouse Accessories:Décor | 4 |

> 标题兜底：`cake topper / cupcake topper / cake decoration / party pick`

## 8. 贺卡 greeting card — 集中（主力清晰）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 332146031 | Stationery:Greeting Cards:**Birthday** | 83 |
| 332149031 | Stationery:Greeting Cards:Seasonal | 12 |
| 332152031 | Stationery:Greeting Cards:Good Luck & Congratulations | 8 |
| 332156031 / 332144031 | Thank you / Anniversary | 7+5 |

**② 噪音提示**：搜 "card" 会混入 Sun Catchers(16)、Diamond Painting(11)、Hanging Ornaments(6)——这些是标题带 "card" 的其他品，非贺卡，按小类过滤即可。

> 标题兜底：`greeting card / birthday card / pop up card`

## 9. 书签 bookmark — 集中

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 200897031 | Stationery:Labels, Index Dividers & Stamps:**Bookmarks** | 58 |

**② 分散落点**（零星，靠标题兜底）：Arts & Crafts Drawing Aids 3、Reusable Shopper Bags 2。
> 标题兜底：`bookmark`

## 10. 零钱包 coin purse — 集中

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 11968015031 | Fashion:Wallets:Women's:**Coin Purses & Pouches** | 7 |
| 2732121031 | Fashion:Wallets:Kids':Wallets | 6 |
| 11968006031 | Fashion:Wallets:Men's:Coin Purses & Pouches | 2 |

> 标题兜底：`coin purse / coin pouch / mini wallet`

## 11. 美甲 nail — 集中（Beauty:Nail Design 下多小类）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 2909199031 | Beauty:Nail Design:Tools:**Nail Art Pens** | 11 |
| 2909189031 | Beauty:Nail Design:**Nail Art Sets** | 9 |
| 2909187031 | Beauty:Nail Design:False Nails:Nail Tips | 7 |
| 2909192031 | Beauty:Nail Design:Rhinestones | 6 |
| 2909200031 / 2909203031 | Nail Brushes / Practice Hands | 5+3 |

> 标题兜底：`nail art / nail magnet / cat eye nail / nail tips`

## 12. 鱼缸装饰 aquarium — 分散型（主力在 Garden 而非 Pet！）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 27917241031 | Garden:Hardscaping:**Resin Glow in Dark Pebbles** | 303 |
| 4262909031 | Garden:Garden Sculptures:Garden Miniatures | 56 |
| 471492031 | Pet:Fish & Aquatic:Aquarium Décor:**Ornaments** | 38 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 26900717031 | Toys:Dollhouse Accessories:Décor | 20 |
| 364063031 | Toys:Baby & Toddler:Bath Toys | 11 |

> 标题兜底：`aquarium / fish tank / vivarium / terrarium background`

---

## 采集策略总纲

1. **两部分都要采**：① 主力小类是好品线核心，必采；② 分散小类补采，尤其分散型品类（太阳捕手/钥匙扣/手链/人偶/帆布袋/马克杯/蛋糕/鱼缸）不补采就漏货。
2. **分散型 = node_id 多采 + 标题兜底**：每个品类末尾给了兜底关键词，采集后对全站商品跑一遍关键词，捞回散落在未知小类的同类品。
3. **集中型（贺卡/书签/零钱包/美甲）**：按主力小类采基本收全，注意过滤同名噪音（如 "card" 混入非贺卡）。
4. **node_id 说明**：本表 node_id 取自 UK 竞品库实测落点（叶子级），比榜单树 `tree_UK.json` 更细。配采集时二者皆可用，叶子级更精准。
5. **DE/US 同法**：这套"主力+分散"结构对 DE/US 同样适用，各站在自己竞品数据/榜单树里按同一批标题关键词反查落点 node_id。
6. **采集后仍走 ASIN 级过滤**：`垃圾asin分析.md` 的标题形态 + 价格带 + IP + 大件/带电/化学。
