# DE 品线无遗漏采集 · node_id 双清单

> 与 UK/US 同结构、同标准（验证好品线采集）。DE 竞品库总量最大（199910 行）。
> 数据来源：`competitor_products`（marketplace=DE）用**德文关键词**按标题反查落点小类及 node_id（竞品库实测）。
> ① 自有好品主力 = 命中量大的核心落点；② 分散落点 = 同类商品散到的其他小类，补采防漏。
> 采集地址：`amazon.de/gp/bestsellers/{node_id}`。分散型品类采集后必须再用德文标题关键词全站兜底。

---

## 1. 太阳捕手 Sonnenfänger — 分散型

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 4339618031 | Garten:Gartendeko:Figuren & Statuen:**Sonnenfänger** | 170 |
| 2970799031 | Küche/Wohnen:Wohnaccessoires & Deko:Dekoartikel:Aufkleber:**Fensterbilder** | 9 |
| 30029834031 | Küche/Wohnen:Wohnaccessoires & Deko:**Traumfänger** | 9 |

**② 分散落点**
| node_id | 小类 | 命中 | 备注 |
|---------|------|------|------|
| 26410526031 | Basteln:Mosaik:Diamantmalerei:Bausätze | 60 | 钻石画交叉 |
| 2992933031 | Basteln:Perlenweben & Schmuck:Schmuckperlen | 12 | 串珠交叉 |
| 360545031 | Spielzeug:Puzzles:Puzzle-Zubehör | 6 | 拼图款 |

> 标题兜底：`sonnenfänger / suncatcher / fensterbild / fensterdeko / hängedeko`

## 2. 钥匙扣 Schlüsselanhänger — 极度分散

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 83138031 | Auto & Motorrad:Merchandiseprodukte:**Schlüsselanhänger** | 97 |
| 11971739031 | Fashion:Gepäck:Zubehör:**Schlüsselanhänger:Ringe & Bänder Damen** | 57 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 26899371031 | Spielzeug:Party & Scherz:Fidget:Einfaches Fidget-Spielzeug | 46 |
| 2992933031 | Basteln:Perlenweben & Schmuck:Schmuckperlen | 40 |
| 26969995031 | Basteln:Partyzubehör:Gastgeschenke:Schlüsselanhänger-Packs | 28 |
| 2992946031 | Basteln:Perlenweben & Schmuck:Schmuckherstellungs-Sets | 19 |

> 标题兜底：`schlüsselanhänger / schlüsselring / keychain`

## 3. 手链 Armband — 分散型（主力竟在手工串珠）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 2992933031 | Basteln:Perlenweben & Schmuck:**Schmuckperlen & Zubehör** | 282 |
| 5846356031 | Fashion:Bijouterie:**Armschmuck** | 77 |
| 10459507031 | Fashion:Damen:Schmuck:**Armbänder** | 50 |

**② 分散落点**
| node_id | 小类 | 命中 | 备注 |
|---------|------|------|------|
| 4237392031 | Sport:Sportelektronik:Uhrenarmbänder | 99 | 表带噪音，需过滤 |
| 2992940031 | Basteln:Schmuckzubehör:Verschlüsse | 24 | 首饰扣 |
| 52173621031 | Basteln:Schmuckwerkzeuge:Zangen | 24 | 工具 |

> 标题兜底：`armband / armschmuck / bracelet`。过滤 Uhrenarmband 表带。

## 4. 捏捏 / 解压 Squishy — 集中（主力清晰）

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 14494840031 | Spielzeug:Party & Scherzartikel:**Squeeze Toys** | 360 |
| 26899371031 | Spielzeug:Party & Scherz:Fidget:Einfaches Fidget-Spielzeug | 18 |
| 14494932031 | Spielzeug:Fidget:Fidgetwürfel | 3 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 340675011 | Küche/Wohnen:Wohnaccessoires:Magnete | 10 |
| 190814011 | Sport:Fitness:Krafttraining:Handgriff-Trainer | 5 |

> 标题兜底：`squishy / squeeze / quetsch / stressball / fidget`

## 5. 帆布袋 Einkaufstasche — 分散型

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 2699175031 | Küche:Aufbewahrung:Einkaufskörbe & -taschen:**Einkaufstaschen** | 148 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 2707061031 | Sport:Sporttaschen:Turnbeutel | 30 |
| 2707064031 | Sport:Sporttaschen:Schultertaschen | 4 |
| 3024044031 | Sport:Camping:Kühltaschen & -boxen | 3 |
| 9518062031 | Bürobedarf:Geschenkverpackungen:Geschenktaschen | 3 |

> 标题兜底：`einkaufstasche / jutebeutel / stofftasche / tragetasche / turnbeutel`

## 6. 马克杯 Tasse / Becher — 分散型

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 3098740031 | Küche:Gläser & Trinkgeschirr:Tassen:**Kaffeetassen & Becher** | 75 |
| 22959872031 | Küche:Thermosgefäße:Thermos-Trinkbehälter:**Tassen & Becher** | 33 |

**② 分散落点**
| node_id | 小类 | 命中 |
|---------|------|------|
| 10365211 | Küche:Barzubehör:Untersetzer | 25 |
| 3024049031 | Sport:Camping:Campingküche:Geschirr:Becher | 22 |
| 3312041 | Küche:Wohnaccessoires:Aschenbecher | 24 |

> 标题兜底：`tasse / becher / kaffeetasse / mug`

## 7. 蛋糕装饰 Kuchendeko / Tortendeko — 分散型

**① 自有好品主力**
| node_id | 小类 | 命中 |
|---------|------|------|
| 22936601031 | Spielzeug:Party:Kuchendekoration:**Nicht essbare Kuchendekorationen** | 62 |
| 22936600031 | Spielzeug:Party:Kuchendekoration:**Nicht essbare Cupcake-Dekorationen** | 52 |
| 5211938031 | Basteln:Partyzubehör:Kuchendekoration:Geburtstagskerzen | 62 |

**② 分散落点**
| node_id | 小类 | 命中 | 备注 |
|---------|------|------|------|
| 12429649031 | Lebensmittel:Backzutaten:Essbare Kuchendekorationen | 38 | 可食，边界 |
| 359481031 / 15346845031 | Party:Dekorationen:Luftballons | 30+17 | 气球交叉 |
| 15346836031 | Basteln:Partyzubehörsets | 24 | 派对套装 |

> 标题兜底：`kuchendeko / tortendeko / tortenaufleger / cake topper`

---

## 与 UK/US 的关键差异（分市场提示）

| 品类 | 三站主力对比 |
|------|-------------|
| 手链 | UK Fashion Bracelets / US Sports Fan Shop / **DE 手工串珠 Schmuckperlen(282)** |
| 钥匙扣 | UK Fashion 女 / US Automotive / DE Auto Merchandise(97)+Fashion(57) |
| 帆布袋 | UK Reusable Shopper(155) / US 数据薄 / DE Einkaufstaschen(148) |
| 蛋糕装饰 | 三站都散在 派对装饰+蜡烛+烘焙，需多采 |

> **DE 特点**：手工/串珠(Basteln、Perlenweben & Schmuck)和家居装饰(Wohnaccessoires & Deko)是好品富矿，很多品线主力落在这两个大类。DE 竞品库体量三站最大，反查数据最扎实。
>
> 核心原则重申：**三站同一套好品线标准，node_id 各站不同，必须分别用本地语言关键词反查——不能跨站套用 node_id。**
