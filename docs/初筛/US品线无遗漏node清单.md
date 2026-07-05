# US 品线无遗漏采集 · node_id 双清单

> 与 `UK品线无遗漏node清单.md` 同结构、同标准（验证好品线采集）。
> 数据来源：`competitor_products`（marketplace=US）按标题反查实际落点小类及 node_id（竞品库实测）。
> ① 自有好品主力 = 命中量大的核心落点；② 分散落点 = 同类商品散到的其他小类，补采防漏。
> 采集地址：`amazon.com/gp/bestsellers/{node_id}`。分散型品类采集后必须再用标题关键词全站兜底。

---

## 1. 太阳捕手 suncatcher — 极度分散（US 比 UK 更散，务必多采）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 14008381 | Patio, Lawn & Garden:Outdoor Décor:Garden Sculptures & Statues:**Suncatchers** | 173 |
| 262609011 | Arts, Crafts & Sewing:Crafting:**Suncatcher Supplies** | 96 |
| 3735081 | Home & Kitchen:Home Décor Accents:**Hanging Ornaments** | 189 |

**② 分散落点**
| node_id | 小类 | 命中 | 备注 |
|---------|------|------|------|
| 166404011 | Toys:Puzzles:Puzzle Accessories | 299 | 标题噪音多，需过滤 |
| 12897111 | Arts-Crafts:Crafting:Leathercraft | 109 | 皮艺挂饰交叉 |
| 23542712011 | Arts-Crafts:Diamond Painting Kits | 72 | 钻石画交叉 |
| 166363011 / 166360011 | Toys:Jigsaw Puzzles / Brain Teasers | 77+38 | 拼图款 |

> 标题兜底：`suncatcher / sun catcher / window hanging / hanging ornament`

## 2. 钥匙扣 keyring — 极度分散（US 更偏汽车）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 318298011 | Automotive:Interior Accessories:**Keychains** | 531 |
| 21551229011 | Automotive:Interior Accessories:**Key Shells** | 227 |
| 2475896011 | Clothing/Jewelry:Women:Accessories:**Keyrings, Keychains & Charms** | 90 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 374793011 | Sports:Fan Shop:Sports Souvenirs:Key Chains | 76 |
| 23564877011 | Toys:Novelty & Gag:Fidget:Pop Fidget Toys | 67 |
| 12896171 | Arts-Crafts:Beading & Jewelry:Jewelry Making Kits | 56 |
| 23571482011 | Home:Event & Party:Favors:Keyring Packs | 31 |
| 23538328011 | Toys:Novelty & Gag:Squeeze Toys | 31 |

> 标题兜底：`keyring / keychain / key ring / bag charm`

## 3. 手链 bracelet — 分散型

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 3888111 | Clothing/Jewelry:Men:Jewelry:**Bracelets:Link** | 38 |
| 3298701011 | Arts-Crafts:Beading & Jewelry:Jewelry Findings:**Clasps** | 56 |
| 12896121 | Arts-Crafts:Beading & Jewelry:**Beads & Bead Assortments** | 36 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 374917011 | Sports:Fan Shop:Jewelry & Watches:Bracelets | 133 |
| 2522081011 | Toys:Dress-Up Accessories:Jewelry:Bracelets | 45 |
| 23571490011 | Home:Event & Party:Favors:Bracelet Packs | 38 |
| 8090796011 | Arts-Crafts:Jewelry Making Display & Packaging | 37 |
| 166044011 | Toys:Party Supplies:Party Favors | 24 |

> 标题兜底：`bracelet / bangle / charm bracelet`。过滤 watchband 表带。

## 4. 人偶 / 公仔 action & 3D figure — 分散型

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 19431262011 | Toys:Toy Figures & Playsets:**Fantastic Creatures** | 55 |
| 2514571011 | Toys:Toy Figures & Playsets:**Action Figures** | 31 |
| 1095304 | Home:Home Décor Accents:**Collectible Figurines** | 41 |
| 5483953011 | Toys:Novelty & Gag:Executive Desk Toys | 63 |

**② 分散落点**
| node_id | 小类 | 命中 | 备注 |
|---------|------|------|------|
| 13291541 | Toys:Games:Casino Equipment:Game Table Accessories | 92 | 噪音多，需过滤 |
| 166357011 | Toys:Dress Up:Money & Banking | 41 | 存钱罐款 |
| 23564877011 / 23564873011 | Toys:Fidget:Pop / Simple Dimple | 34+32 | fidget 交叉 |

> 标题兜底：`action figure / 3d printed / figurine / articulated`

## 5. 帆布袋 tote — 分散型（US 数据较薄）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 1252210011 | Home:Kitchen:Travel & To-Go:**Reusable Grocery Bags** | 11 |
| 5768583011 | Sports:Fan Shop:Bags:**Tote Bags** | 7 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 3097796011 | Arts-Crafts:Beading & Jewelry:Purse Making | 54 |
| 5768580011 | Sports:Fan Shop:Messenger Bags | 12 |
| 19431294011 | Toys:Dress Up:Purses | 4 |

> 标题兜底：`tote bag / canvas bag / shopping bag`

## 6. 马克杯 mug — 分散型

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 21613423011 | Home:Kitchen:Insulated Beverage:**Tumblers** | 57 |
| 21613422011 | Home:Kitchen:Insulated Beverage:**Cups & Mugs** | 39 |
| 367142011 | Home:Dining:Glassware:**Coffee Cups & Mugs** | 6 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 374881011 | Sports:Fan Shop:Kitchen:Coffee Mugs | 14 |
| 13218451 | Home:Dining:Glassware:Tumblers & Water Glasses | 11 |
| 274331011 | Toys:Party Supplies:Party Tableware:Cups | 10 |

> 标题兜底：`mug / cup / tumbler / travel cup`

## 7. 蛋糕装饰 cake topper — 分散型（US 主力在蜡烛/烘焙模）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 10844431011 | Toys:Party Supplies:Cake & Cupcake Toppers:**Non-Edible Cake Toppers** | 42 |
| 10844432011 | Toys:Party Supplies:**Non-Edible Cupcake Toppers** | 64 |
| 723468011 | Home:Event & Party:**Cake Decorating Supplies** | 41 |

**② 分散落点**
| node_id | 小类 | 命中 | 备注 |
|---------|------|------|------|
| 3734541 | Home:Candles:Specialty:Birthday Candles | 333 | 生日蜡烛，量最大 |
| 19241495011 | Home:Bakeware:Fondant & Gum Paste Molds | 78 | 翻糖模 |
| 723480011 | Home:Event & Party:Party Packs | 25 | |
| 274321011 / 723470011 | Toys/Home:Balloons | 9+9 | |

> 标题兜底：`cake topper / cupcake topper / cake decoration`

## 8. 贺卡 greeting card — 集中（注意 US 噪音）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 723463011 | Office Products:Paper:Cards & Card Stock:**Greeting Cards** | 54 |

**② 分散/噪音**
| node_id | 小类 | 命中 | 备注 |
|---------|------|------|------|
| 262677011 | Arts-Crafts:Die-Cutting & Embossing:Die-Cuts | 76 | "card" 噪音（切割卡纸） |
| 553806 | Patio Garden:Outdoor Décor:Chimes | 31 | 噪音 |
| 262679011 | Arts-Crafts:Scrapbooking:Kits | 17 | |

> 标题兜底：`greeting card / birthday card / pop up card`。US 尤其要按小类过滤 die-cut/scrapbook 噪音。

---

## 与 UK 的关键差异（分市场提示）

| 品类 | UK 主力 | US 主力 | 差异 |
|------|---------|---------|------|
| 钥匙扣 | Fashion Keyrings 女(201) | Automotive Keychains(531) | US 极度偏汽车 |
| 太阳捕手 | Garden(442)+Toys(360) | Home Ornaments(189)+Garden(173)+Puzzle噪音(299) | US 更散、噪音更多 |
| 蛋糕插 | Toys Cake Toppers(96) | Home 生日蜡烛(333)+翻糖模(78) | US 主力在蜡烛/烘焙 |
| 手链 | Fashion Bracelets(91) | Sports Fan Shop(133) | US 偏球迷周边 |

> 说明：同一好品线三站落点小类不同，**不能拿 UK 的 node_id 套 US**。各站按同批标题关键词反查，本表即 US 实测结果。
