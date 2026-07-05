# 验证好品线 · 三站采集 node_id 对照表（US / UK / DE）

> 配套 `US采集子类清单.md` 的白名单。同一套好类目，三站各自的 node_id 不同——本表给出每个白名单小类在 US / UK / DE 三棵树里的采集节点。
> node_id 来源：`docs/大类榜单/tree_US.json` / `tree_UK.json` / `tree_DE.json`。
> UK 节点最全（优秀产品同源）；DE 为德文标签；空格 = 该站这批数据未爬到该小类，按父节点入口采或后续补。
> 采集地址：`amazon.com|co.uk|de /gp/bestsellers|new-releases/{bsr}/{node_id}`

---

## ⚠️ 关键：同类商品跨多个小类，node_id 采集会系统性漏货

UK 竞品库实测（`competitor_products` marketplace=UK 按标题反查落点小类）：**同一种商品并不集中在一个小类，而是散落在几十个小类、横跨多个大类**。

| 品类 | 落点小类数 | 命中行数 | 分布特征 |
|------|-----------|---------|---------|
| 手链 bracelet | **70** | 527 | 极度分散 |
| 人偶 action/3D figure | **65** | 512 | 极度分散 |
| 帆布袋 tote/canvas | 34 | 465 | 分散 |
| 马克杯 mug | 32 | 233 | 分散 |
| 蛋糕插 cake topper | 31 | 309 | 分散 |
| 钥匙扣 keyring | ~20 | 700+ | 分散，**无主导小类**（Fashion 201 / Auto 154 / Toys Pop Fidget 133 / Sports 55…） |
| 太阳捕手 suncatcher | 18 | 890 | **双主力**：Garden 442 + Toys Glass Art 360，单采一个漏 45% |
| 书签 bookmark | 12 | 74 | 中等 |
| 捏捏/fidget squishy | ~13 | 1600+ | **集中**：Toys→Squeeze 1118 占七成，按父节点 Novelty & Gag 基本收全 |
| 零钱包 coin purse | 6 | 18 | 集中 |

**结论**：node_id 只是采集入口，不能假设"一个好类目 = 一个小类"。据此采集分两种模式：

- **集中型（捏捏/fidget/零钱包）**：按主力小类或其父节点采即可收全。
- **分散型（钥匙扣/手链/人偶/帆布袋/太阳捕手/蛋糕插/马克杯）**：单靠 node_id 必漏货。必须**多小类并采（下表列出每站的多个 node_id）+ 采集后用标题关键词跨类兜底**。太阳捕手务必同时采 Garden 和 Toys 两条线。

> 实操：下表 node_id 尽量给全同一好类目的多个落点；真正保证不漏还要在采集后阶段对全站商品跑标题关键词（suncatcher/keyring/bracelet…）做跨类兜底捞取，而不是只信小类。

---

## A. 装饰摆件 / 挂饰

| 好类目 | US node_id | UK node_id | DE node_id |
|--------|-----------|-----------|-----------|
| Sun Catchers 太阳捕手 | 262609011（Arts-Crafts Suncatcher Supplies） | 4262967031（Sun Catchers）/ 14520147031（Glass Art & Suncatchers） | 4339618031（Sonnenfänger）/ 359302031（Fensterdekoration 4368）/ 2970799031（Fensterbilder） |
| Garden Sculptures & Statues 花园雕塑 | 553802 | 4262907031 | 4339563031（Figuren & Statuen 590）/ 4339566031（Gartenzwerge）/ 4339568031（Gartenkugeln） |
| Statues / Sculptures 摆件雕塑 | — | 4262911031 / 3028636031 | 4339567031 / 4339565031 / 2970780031（Skulpturen） |
| Signs & Plaques 铁皮画门牌 | 3742281（Garden Plaques & Wall Art） | 3028635031 / 26165472031 | 83131031（Schilder 410）/ 340709011（Wand- & Türschilder）/ 4339623031（Gartenschilder） |
| Collectible Figurines 摆件 | 3735061（Home Décor Accents） | 3028624031 | 4339565031（Figuren）/ 309983031 / 5228886031（Sammelfiguren） |
| Miniature Garden Figurines 微缩摆件 | 553802 | 3028624031 | 4339563031 / 4339566031（Gartenzwerge） |
| Ornaments | 3735061 | 26165470031 | 470582031（Ornamente）/ 2970825031（Zierschmuck） |
| Posters & Prints 无框画芯 | 381142011 | 26165479031（Prints & Posters） | 3490861（Bilder/Poster/Kunstdrucke 529）/ 372854011 / 16233740031（Rahmen） |
| Decorative Garden Stakes 花园地插 | 16164098011 | 49989641031 / 4224772031 | 52171342031（Dekorative Gartenpfosten）/ 4288435031（Pflanzenschilder） |
| Wind Sculptures & Spinners 风车挂饰 | — | 4262969031 / 4262970031 | 4339620031（Windspiele & -säcke 83）/ 4339621031 / 27019302031 |
| Wall Stickers / Decals 墙贴 | — | 60185031 / 2491760031 | 3969027031 / 2076935031 / 22172857031 / 14353728031（Türaufkleber） |
| Dream Catchers / 装饰石 | Home Décor 父 | （归 Sun Catcher 类） | 27917228031（Dekosteine）/ 4339558031（Dekorative Steine）/ 27917219031（Gedenkgarten Steine） |

## B. 派对 / 节日 / 礼品

| 好类目 | US node_id | UK node_id | DE node_id |
|--------|-----------|-----------|-----------|
| Party Supplies 派对总入口 | 1266203011（Toys）/ 901590（Home Event） | 364234031 / 27345384031 | 15346831031 / 359480031 / 360487031 |
| Decorations 派对装饰 | 274320011 / 723469011 | （Party Supplies 下） | 15346831031 |
| Cake Toppers 蛋糕插牌 | 723468011（Cake Decorating） | 22936583031（Non-Edible Cake Toppers）/ 22936582031（Cupcake） | 5211937031（Kuchendekoration）/ 22936601031（Nicht essbare）/ 15346840031 |
| Party Banners 拉旗 | 274320011 | 26165412031 / 5230720031 | 5211932031（Banner）/ 26279664031 / 26174465031（Fahnen & Banner） |
| Balloons 气球 | Party 父 | 364235031 / 14520212031（Water Balloons） | 15346845031（Luftballons 250）/ 359481031 / 14494946031（Wasserballons） |
| Party Packs | 901590 | 15345968031 / 26958012031（Multi-Item Favour） | 15346836031（Sets 126）/ 26930473031 / 26969997031 |
| Party Headwear 派对头饰 | 274325011 | 5230728031 | 5211939031（Fotoautomat Zubehör） |
| Party Favours / Games | 723476011 / 14530985011 | 602169031 / 15345967031 | 15346841031（Spiele）/ 26969995031（Schlüsselanhänger-Packs） |
| Bingo | 723469011 父 | 5230669031 | 5211953031 |
| Garlands / Streamers 拉花 | 13679411（Home Seasonal） | 5230722031 | 359482031（Girlanden/Konfetti）/ 5211934031 / 26279663031 |
| Tableware 派对餐具 | 723481011 | 364238031 | 15346838031 / 359485031 |
| Wedding / Table Deco 婚礼桌饰 | Party 父 | — | 2992910031（Hochzeitsdekoration）/ 15346847031 / 5579576031（Tischkarten） |

## C. 玩具 / 解压 / 公仔

| 好类目 | US node_id | UK node_id | DE node_id |
|--------|-----------|-----------|-----------|
| Novelty & Gag Toys 总入口 | 166027011 | 14520066031 | 360487031 |
| Squeeze Toys 捏捏乐 | 23538328011 | 14520114031 | 14494840031 |
| Fidget Toys 解压 | 17238448011 | 14520117031 / 26894542031（Pop） | 14494843031 / 26899371031 |
| Action Figures 3D人偶 | 165993011（Toy Figures） | 14520141031 | 27087992031（Spielzeugfiguren 174）/ 14494867031 / 5228889031 |
| Animal / Creature Figures | 19431260011 / 19431262011 | （Figures 下） | 14494973031（Chibi Figuren）/ 4234932031 |
| Building Toys 积木 | 166092011 | 364074031 / 26163127031 / 26163132031（Magnetic） | 360397031（Bauklötze & Bausteine） |
| Puzzles 拼图益智 | 166359011 / 166360011（Brain Teasers） | 364248031 / 364250031 / 366066031 | 360541031 / 360543031 / 360542031（3D） |
| Card Games 卡牌 | 166239011 | 364147031 / 14520178031 | 26174514031（Sammelkarten）/ 4771932031 / 4771935031（Alben） |
| Plush / Stuffed 毛绒 | 166461011 | 26275717031 / 26275716031 | 360533031（Plüsch 586）/ 26275743031 / 26275742031（Interaktive） |
| Novelty Coins 纪念币 | 23900370011 | 28166941031 | 28167155031（Scherzmünzen） |
| Magnetic Toys 磁吸 | 166039011 | 14520099031 | 340675011（Magnete） |
| Gag Toys 整蛊 | 166034011 | 14520097031 | 14494824031（Scherzartikel）/ 360487031 |

## D. 轻定制载体（袋 / 杯 / 布巾）

| 好类目 | US node_id | UK node_id | DE node_id |
|--------|-----------|-----------|-----------|
| Reusable Shopping Bags 帆布袋 | Home Décor / Fashion | 2722825031（Shopping Bags & Baskets） | 2699174031（Einkaufskörbe & -taschen 283）/ 2699175031 / 22830144031（Wiederverwendbare） |
| Tote Bags | Fashion Accessories | 26165421031 / 1769569031 | 4816497031 / 3024211031（Taschen） |
| Drawstring Bags 束口袋 | Fashion / Sports | 1769579031 / 26165418031 | 2707061031（Turnbeutel）/ 2707060031（Sporttaschen） |
| Cosmetic Bags 化妆包 | 7586146011（Jewelry/Accessories） | （Accessories 下，按标题过滤） | 3537793031（Kulturbeutel & Schminkkoffer）/ 3055657031 / 190773011 |
| Coffee Cups / Mugs 马克杯 | 284507（Kitchen & Dining） | 26165454031 / 26165512031 / 3076447031 | 3098740031（Kaffeetassen & Becher）/ 3098733031 / 22959872031 |
| Water Bottles / Canteens 水壶 | Home / Sports | 3076577031 | 3024181031（Trinkflaschen）/ 470704031 / 16374713031 / 360556031 |
| Beer Glasses 啤酒杯 | Kitchen & Dining | 26165514031 | 524458031（Flaschenkörbe & -träger） |
| Beach Towels / Cleaning Cloths 巾 | 1063916（Linens） | 26165477031 | 64748031（Taschentücher）/ 2076506031（Handtuchhalter） |
| Cross-Body / Clutches / Waist 小包腰包 | Fashion Accessories | 4370187031 | 3024034031（Hüfttaschen）/ 3950248031 / 2707064031（Schultertaschen） |
| Lunch / Cooler Bags 午餐保温袋 | — | — | 3024044031（Kühltaschen & -boxen）/ 3968845031 |

## E. 饰品 / 配饰

| 好类目 | US node_id | UK node_id | DE node_id |
|--------|-----------|-----------|-----------|
| Coin Purses 零钱包 | 7586146011 | （Women's Accessories 下） | 12419322031（Schuh-/Schmuck-/Uhren-Accessoires 211）/ 3024032031 |
| Keyrings & Keychains 钥匙扣 | 7586146011 / 318298011（Auto） | 2732118031 | 83138031（Schlüsselanhänger 87）/ 2699200031 / 26969995031 |
| Jewellery Clasps / Findings | 12896161（Arts-Crafts） | （Beading 下） | 2992933031（Schmuckperlen & Zubehör 348）/ 2992939031 / 2992947031 |
| Bracelets 手链 | 12896081（Beading & Jewelry） | 26165358031 / 5231666031 | 5846356031（Armschmuck）/ 2992927031（Perlenweben & Schmuck 1084）/ 2992946031（Sets） |
| Caps / Baseball Caps 帽子 | Fashion Accessories | 324234011 / 26165508031 / 26165445031 | 1981316031 / 1981313031 / 1981679031 / 1981325031（Strick） |
| Fascinators / Headbands 发饰 | 11062741（Beauty Tools） | 26165442031 / 64664007031 | 64497031（Haarschmuck）/ 2867661031（Haarreife & Stirnbänder） |
| Glasses Cases 眼镜盒 | Fashion Accessories | 303756031 | 3769035031（Schmuckkästen）/ 11971727031（Handtaschen-Zubehör） |
| Brooches / Earrings / Pendants | Fashion Accessories | 5832018031 / 5231667031 | 2992936031（Schmuckanhänger）/ 27950687031（Schmuck） |
| Healing Crystals 疗愈石 | Home Décor / Fashion | （按标题） | 21827824031（Heilende Kristalle） |

## F. 手工 DIY / 文具 / 美甲

| 好类目 | US node_id | UK node_id | DE node_id |
|--------|-----------|-----------|-----------|
| Greeting Cards 贺卡 | 1069242（Office School Supplies） | （Office 下 Cards） | 5248501031（Grußkarten 76）/ 9518055031 / 202900031（Karten） |
| Bookmarks 书签 | 1069242 | （Office） | 202798031（Lesezeichen 71） |
| Planners / Diaries | 1069242 | 201093031 / 201004031 / 14526611031 | 197758031（Kalender/Planer 141）/ 202992031 / 202996031 / 118310011 |
| Diamond Painting 钻石画 | 378733011（Crafting） | （Arts-Crafts） | 26410524031（Diamantmalerei 393）/ 26410526031 |
| Scrapbooking / Stickers | 12898951 / 8090717011 | 213888031 / 5248793031 | 2993205031（Scrapbooking 321）/ 2993221031 / 5228893031 |
| Papeterie & Stickers 儿童贴纸 | 676735011（Toys Stickers） | 364056031 | 360384031（Papeterie & Sticker）/ 591305031 / 9518106031 |
| Quilting / Rotary Cutter / Doll Making 缝纫 | 12899091 / 262606011 | 3063614031（Doll Making） | 2993231031（Nähen & Stoffe 898）/ 2993236031 / 52173449031（Nähsets） |
| Embroidery 刺绣 | 12897251 | （Needlework） | 2993079031（Stickerei）/ 2992905031（Stick- & Nähgarn） |
| Trim & Embellishments 花边辅料 | 12899361 | （Sewing） | 2993281031（Borten & Ornamente）/ 2993020031（Blumendeko） |
| Nail Art 美甲 | 11062741（Beauty Tools） | （Beauty） | 591298031（Nageldesign 272）/ 2975649031 / 2975647031（Spitzen）/ 2975657031（Stifte） |
| Painting By Numbers 数字油画 | 378733011 | 364054031 | 2993139031（Dekorpapier）/ 2993199031（Taschenherstellung） |

## G. 钓鱼 / 露营小件

| 好类目 | US node_id | UK node_id | DE node_id |
|--------|-----------|-----------|-----------|
| Hunting & Fishing 总入口 | 706813011 | 25953819031 / 324129011 | 26047886031（Jagen & Angeln 2816）/ 16435131（Angeln 1355）/ 458766031 |
| Lures / Soft Plastic Lures 假饵 | Fishing 下 | 454717031 / 454726031 | 458733031（Kunst- & Naturköder）/ 248080011（Naturköder）/ 170478031 |
| Fishing Line / Fly Fishing | Fishing 下 | 454696031 / 454702031 | 247953011（Angelschnüre）/ 247999011（Angelhaken） |
| Baits & Accessories 饵料配件 | Fishing 下 | 29839735031 / 454691031 | 18199595031（Köder & -zubehör）/ 64664... |
| Rod Racks / Bait Storage 竿架收纳 | Fishing 下 | 454685031 / 454672031 | 248192011（Rutentaschen）/ 84607031（Angelsets） |
| Feeder / Feeder Accessories | Fishing 下 | 4363369031 / 4363368031 | 5137869031（Feederuten） |
| Foam Sleeping Mats / Survival 露营 | 706814011（Outdoor Rec） | 3076638031 / 3076620031 | 3024222031（Survival-Kits） |

## H. 高尔夫 / 自行车 / 运动小配件

| 好类目 | US node_id | UK node_id | DE node_id |
|--------|-----------|-----------|-----------|
| Golf 总入口 | Sports 下 | 324115011 / 324117011（Balls）/ 324120011（Clubs） | 16435191（Golf 260）/ 190506011（Bälle）/ 456959031（Platzgeräte） |
| Golf Accessories（Towels/Bag/Cart/Markers） | Sports 下 | 580172011 / 548073031 / 458455031 / 49980258031 | 3969314031（Bag-Zubehör）/ 456946031（Mobil）/ 244626011 / 235480011（Übungsgeräte） |
| Bike Bells / Wheel Lights / Valve Caps | Sports Cycling | 49980263031（Wheel Lights）/ 2485559031（Valve Caps） | 345230011（Fahrradzubehör）/ 2501423031（Ventilkappen）/ 460978031 |
| Bike Workstands / Handlebar / Parts | Sports Cycling | 548208031 / 28967566031 | 345241011（Fahrradteile）/ 235160011（Kinderfahrradzubehör） |
| Scooter Parts & Grips | Sports | 455717031 / 455719031 | 452171031（Scooter & Zubehör）/ 190607011 / 14647308031 |

## I. 汽车装饰小件（只装饰，不碰核心件/化学/大件）

| 好类目 | US node_id | UK node_id | DE node_id |
|--------|-----------|-----------|-----------|
| Air Fresheners 香薰夹 | 15735121 | 303616031 | 82545031（Lufterfrischer）/ 3628723031 |
| Seat Accessories 头枕套等 | 15857501 | 303765031 | 2970873031（Sitzauflagen 96）/ 9645639031 |
| Interior Lighting 氛围灯 | 15735661 | 303678031 | 82723031（Nummernschildbeleuchtung） |
| Dashboard / Rearview Ornaments 车内摆件 | Interior 下 | 49989386031 / 2481713031 | 52171517031（Figuren & Idole fürs Armaturenbrett 125） |
| Handlebar Accessories 摩托车小件 | 346333011 | 28967566031 / 7448425031 | 1365701031（Motorrad-Halterungen）/ 5142214031 |
| Decals & Bumper Stickers 车贴 | 15710001 | 27019560031 / 303795031 | 27019307031（Autoaufkleber）/ 125860031 / 27019305031 / 202801031 |
| Drink Holders / Boot Mats / Non-Slip | Interior 下 | 303757031 / 303633031 / 2481726031 | 81380031（Getränkehalter）/ 81395031（Fußmatten）/ 359299031 |
| Valve / Hub / Nummernschild Caps 各种盖（边界） | Replacement Parts | 4919991031 / 11416168031 / 2485559031 | 2501423031（Ventilkappen）/ 5142196031（Radnabenkappen）/ 2502419031 |

## J. 宠物小件（玩具/装饰/用品，不碰药剂/电击/大件）

| 好类目 | US node_id | UK node_id | DE node_id |
|--------|-----------|-----------|-----------|
| Aquarium Décor / Accessories 鱼缸背景 | 2975504011（Reptiles） | 205727348031 / 471498031 | 205727363031（Aquariumszubehör 152） |
| Toys for Cats / Small Animals / Birds | 2975312011 | （Pet 各玩具） | 470804031（Katzenminze-Spielzeug 184）/ 445315031（Katzen 800）/ 27975424031（Vogelkäfige） |
| Reptile / Terrarium 爬宠 | 2975504011 | 49989645031 / 13154183031 | 4339587031（Fischfutter & Zubehör） |
| Feeders / Bird Baths 喂食器/鸟浴 | Pet 下 | 4363362031 / 471584031 | 470892031（Futterstationen）/ 4380816031（Vogeltränken）/ 4380815031 / 470886031 |
| Leashes / Collars 牵引（小件） | 2975312011 | 455783031 / 458427031 | 470655031（Geschirre/Halsbänder/Leinen 316）/ 470752031 / 452190031 |

## K. 厨房小物 / 模具

| 好类目 | US node_id | UK node_id | DE node_id |
|--------|-----------|-----------|-----------|
| Ice Cube Moulds / Bakeware 硅胶冰格烘焙 | 289668（Bakeware） | （Bakeware） | 3311291（Backformen 54）/ 3094743031（Motivbackformen）/ 8988125031 |
| Cake Pop / Candy / Ice Lolly Moulds | 289668 | （Bakeware） | 3094748031（Cake Pop Formen）/ 52173749031（Kuchenformen） |
| Trivets / Measuring Spoons / Platters | 284507（Kitchen & Dining） | （Kitchen） | 11048651 / 3312011（Topfuntersetzer）/ 10704451（Messbecher）/ 524458031 |

---

## 使用说明

1. **US 优先按已展开的 node_id 配任务**（US 树数据最完整，见本表 + `US采集子类清单.md`）。
2. **UK 节点最全且与优秀产品同源**——UK 是好品最密站点，本表 UK 列几乎每个好类目都有节点，直接配。
3. **DE 是三站总量最大的（133424）**，好类目同样丰富，用德文标签匹配。DE 高价值入口大类：
   - Wohnaccessoires & Deko（家居装饰）**11611** → 3510351
   - Fensterdekoration（窗饰/太阳捕手）**4368** → 359302031
   - Jagen & Angeln（钓鱼）**2816** → 26047886031
   - Perlenweben & Schmuckherstellung（串珠首饰）**1084** → 2992927031
   - Nähen & Stoffe（缝纫）**898** → 2993231031
   - Partyzubehör & Dekoration（派对）**870** → 15346831031
   - Figuren & Statuen（摆件）**590** → 4339563031
   - Diamantmalerei（钻石画）**393** → 26410524031
   - Scrapbooking **321** → 2993205031 ；Nageldesign（美甲）**272** → 591298031
4. **三站是同一套好类目标准**，差异只是各站 node_id 与各站爬取数据的体量分布。某小类在某站列 `Fishing 下`/`Bakeware`/`按标题` 是指该站这批数据未单独爬到细分节点，用父类入口采、再靠标题过滤即可，**不代表该站不要这个类目**。
5. **采集后仍走 ASIN 级过滤**：`垃圾asin分析.md` 的标题形态 + 价格带 + IP + 大件/带电/化学。
