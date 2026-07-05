# 验证好品线 · 采集白名单（US / DE / UK 三站通用）

> **什么是"验证好品线采集"**：采集范围只锁定我们已经卖得好、验证过赚钱的小类目。不在白名单里的类目（化学品、汽车核心件、大件家具、带电设备、服装、器械等）根本不采集、不进初筛。
>
> **依据**：`产品数据/产品表现ASIN_转换版2.md` 593 个优秀产品的小类落点统计（281 个不同小类，下表带出现次数）。
>
> **跨站统一**：下面的小类标准 US / DE / UK 三站完全一致。差异只是各站 node_id 不同——每站在自己的树（`tree_US/DE/UK.json`）里按同一套英文小类名找对应 node_id 配任务。某站爬取数据薄不代表不要这个类目。
>
> **采集地址格式**：`https://www.amazon.{域}/gp/bestsellers|new-releases/{bsr_slug}/{node_id}`

---

## 白名单：按品类归组（数字=优秀产品出现次数）

### A. 装饰摆件 / 挂饰（家居 + 花园）— 最强项

| 验证小类（英文，各站通用搜索键） | 次数 | US 采集入口（node_id） |
|----------------------------------|------|------------------------|
| Garden Sun Catchers / Glass Art & Suncatchers | 35+4 | US Arts-Crafts → Suncatcher Supplies 262609011 |
| Signs & Plaques（铁皮画/门牌） | 12 | US Garden → Plaques & Wall Art 3742281 |
| Collectible Figurines（摆件） | 7 | US Home → Home Décor Accents 3735061 |
| Miniature Garden Figurines（微缩摆件） | 6 | US Garden → Garden Sculptures & Statues 553802 |
| Posters & Prints（无框画芯） | 4 | US Home → Wall Art / Posters & Prints 381142011 |
| Ornaments | 4 | US Home → Home Décor Accents 3735061 |
| Outdoor Statues / Garden Sculptures | 4 | US Garden → Garden Sculptures & Statues 553802 |
| Dollhouse Décor（微缩装饰） | 4 | US Home Décor / Toys Dollhouse |
| Wall Crosses / Wall Sculptures | 3+1 | US Home → Home Décor Accents 3735061 |
| Dream Catchers | 2 | US Home Décor |
| Decorative Garden Stakes（花园地插） | 2 | US Garden → Decorative Garden Stakes 16164098011 |

### B. 派对 / 节日 / 礼品用品 — 最强项

| 验证小类 | 次数 | US 采集入口 |
|----------|------|-------------|
| Party Packs | 17 | US Home → Event & Party Supplies 901590 |
| Kids' Party Banners（拉旗） | 10 | US Toys → Party Supplies / Decorations 274320011 |
| Non-Edible Cake Toppers（蛋糕插牌） | 9 | US Home → Cake Decorating Supplies 723468011 |
| Party Balloons / Kids' Party Balloons | 4+4 | US Toys → Party Supplies |
| Non-Edible Cupcake Toppers | 3 | US Home → Cake Decorating Supplies 723468011 |
| Party Headwear | 3 | US Toys → Party Supplies / Headwear 274325011 |
| Gift Bags / Party Favours | 2 | US Home → Party Favors 723476011 |
| Bingo / Party Games | 2 | US Home → Party Games & Activities 14530985011 |
| 长尾：Streamers / Garlands / Party Eyewear / Invitations / Photobooth Props | 1 | 同 Party 父节点 |

### C. 玩具 / 解压 / 收藏公仔 — 最强项

| 验证小类 | 次数 | US 采集入口 |
|----------|------|-------------|
| Squeeze Toys（捏捏乐） | 24 | US Toys → Novelty & Gag / Squeeze Toys 23538328011 |
| Kids' Play Action Figures（3D打印人偶） | 12 | US Toys → Toy Figures & Playsets 165993011 |
| Kids' Play Animal Figures | 9 | US Toys → Figures / Animals 19431260011 |
| Toy Building Sets（积木套装） | 5 | US Toys → Building Toys 166092011 |
| Play Figure Playsets | 4 | US Toys → Toy Figures & Playsets 165993011 |
| Miniature Novelty Toys | 3 | US Toys → Novelty & Gag / Miniatures 166040011 |
| Pop Fidget Toys | 2 | US Toys → Fidget Toys 17238448011 |
| Gags & Practical Jokes | 2 | US Toys → Gag Toys 166034011 |
| Card Games（Dedicated Deck / Matching） | 2+2 | US Toys → Games / Card Games 166239011 |
| Puzzles（Assembly & Disentanglement） | 2 | US Toys → Puzzles / Brain Teasers 166360011 |
| Stuffed Animals / Fantasy Creature Figures | 2+2 | US Toys → Plush 166461011 / Fantastic Creatures 19431262011 |
| Magnetic Toys / View Finders | 1+2 | US Toys → Magnets 166039011 |

### D. 轻定制载体（袋 / 杯 / 布巾）— 最强项

| 验证小类 | 次数 | US 采集入口 |
|----------|------|-------------|
| Reusable Shopping Bags（帆布袋） | 17 | US Home Décor / Fashion（各站定位） |
| Drawstring Gym Bags（束口袋） | 9 | US Fashion / Sports |
| Cosmetic Bags（化妆包） | 8 | US Fashion → Jewelry/Accessories 7586146011 |
| Coffee Cups / Insulated Mugs / Sports Fan Mugs | 7+2+2 | US Home → Kitchen & Dining |
| Canteens & Water Bottles | 3 | US Home / Sports（水壶） |
| Women's Totes / Cross-Body Bags / Clutches | 2+2+1 | US Fashion → Accessories |
| Reusable Cleaning Cloths / Place Mats（毛巾/餐垫） | 2+1 | US Home → Kitchen Linens 1063916 |
| 长尾：Lunch Bags / Beach Towels / Insulated Bottles | 1 | 同载体归组 |

### E. 饰品 / 配饰

| 验证小类 | 次数 | US 采集入口 |
|----------|------|-------------|
| Women's Coin Purses & Pouches（零钱包） | 7 | US Fashion → Jewelry/Accessories 7586146011 |
| Keyrings & Keychains（钥匙扣） | 6+1 | US Fashion → Accessories / Automotive Keychains 318298011 |
| Jewellery Clasps / Findings | 3 | US Arts-Crafts → Jewelry Findings 12896161 |
| Novelty Coins & Paper Money（纪念币） | 3 | US Toys → Novelty Coins 23900370011 |
| Bracelets（Men's / Novelty / Italian Charms） | 2+2+1 | US Arts-Crafts → Beading & Jewelry 12896081 |
| Baseball Caps / Hats（Men's / Novelty） | 2+2+1 | US Fashion → Accessories |
| Fascinators / Fashion Headbands（发饰） | 2+2 | US Fashion / Beauty Tools 11062741 |
| Glasses Cases / Brooches / Earrings | 2+1+1 | US Fashion → Accessories |
| Healing Crystals（疗愈石） | 2 | US Home Décor / Fashion |

### F. 手工 DIY / 文具 / 美甲

| 验证小类 | 次数 | US 采集入口 |
|----------|------|-------------|
| Birthday Greeting Cards / Blank Cards（贺卡） | 10+1 | US Office → Office & School Supplies 1069242 |
| Bookmarks（书签） | 4 | US Office → School Supplies 1069242 |
| Appointment Books & Planners / Diaries | 3+1 | US Office → School Supplies 1069242 |
| Diamond Painting Kits（钻石画） | 2 | US Arts-Crafts → Crafting 378733011 |
| Kids' Papeterie & Stickers / Scrapbooking | 2+2 | US Arts-Crafts → Scrapbooking / Stickers 12898951 |
| Quilting Templates / Rotary Cutters / Doll Making | 2+2+2 | US Arts-Crafts → Sewing 12899091 / Doll Making 262606011 |
| Nail Art Sets / Pens（美甲） | 2+1 | US Beauty → Tools & Accessories 11062741 |
| 长尾：Knitting Needles / Glue Pens / Cookie Stamps / Painting by Numbers | 1 | 同 Arts-Crafts |

### G. 钓鱼 / 露营小件

| 验证小类 | 次数 | US 采集入口 |
|----------|------|-------------|
| Rods Cases & Tubes（竿袋） | 5 | US Sports → Hunting & Fishing 706813011 |
| Fishing Feathers / Soft Plastic Lures / Fly Lines（串钩/假饵） | 2+1+1 | US Sports → Hunting & Fishing 706813011 |
| Rod Racks / Bait Storage | 1 | US Sports → Fishing |
| Foam Sleeping Mats / Survival Kits（露营小件） | 1 | US Sports → Outdoor Recreation 706814011 |

### H. 高尔夫 / 自行车 / 运动小配件

| 验证小类 | 次数 | US 采集入口 |
|----------|------|-------------|
| Golf Scorers / Ball Markers / Putter Covers / Swing Trainers | 2+1+1+1 | US Sports → 各高尔夫小类 |
| Bike Bells / Wheel Lights / Workstands / Valve Caps | 2+2+1+1 | US Sports → Cycling 小配件 |
| Scooter Grips / Kids' Bikes Accessories | 1 | US Sports |

### I. 汽车装饰小件（只装饰，不碰核心件/化学/大件）

| 验证小类 | 次数 | US 采集入口 |
|----------|------|-------------|
| Automotive Air Fresheners（香薰夹） | 3 | US Automotive → Air Fresheners 15735121 |
| Car Seat Accessories（头枕套等装饰） | 3 | US Automotive → Interior Accessories 15857501 |
| Car Interior Lighting（氛围灯贴） | 2 | US Automotive → Interior / Electrical Appliances 15735661 |
| Motorbike Handlebar Accessories（摩托车小钟表） | 3 | US Automotive → Motorcycle 346333011 |
| Automobile Decals / Bumper Stickers | 1 | US Automotive → Bumper Stickers & Decals 15710001 |
| 长尾：Drink Holders / Boot Mats / Non-Slip Mats | 1 | US Automotive Interior 装饰件 |

> ⚠️ 汽车类只要"装饰/主题小件"。优秀产品里出现的 Car Battery Switches、Nuts & Bolts、Spark Plugs、Radiator Caps 等功能件属**边界**，可采但需人工确认适配风险，不作为主力采集。

### J. 宠物小件（玩具/装饰/用品，不碰药剂/电击/大件）

| 验证小类 | 次数 | US 采集入口 |
|----------|------|-------------|
| Aquarium Décor Backgrounds（鱼缸背景贴） | 3 | US Pet → Reptiles & Amphibians 2975504011 |
| Interactive Toys for Cats / Toys for Small Animals / Birds | 2+2+1 | US Pet → Dogs 2975312011 / 各宠物玩具 |
| Feeding Supplies for Reptiles / Fish Feeders / Terrarium Wood | 1 | US Pet → Reptiles 2975504011 |
| 长尾：Dog Leashes / Cat Collars / Small Animal Cages | 1 | US Pet（避开电击项圈/GPS/超声波驱赶） |

### K. 厨房小物 / 模具

| 验证小类 | 次数 | US 采集入口 |
|----------|------|-------------|
| Ice Cube Moulds & Trays（硅胶冰格） | 3 | US Home → Kitchen & Dining / Bakeware 289668 |
| Cake Pop / Candy / Ice Lolly Moulds、Cookie Stamps | 1 | US Home → Bakeware 289668 |
| Trivets / Measuring Spoons / Serving Platters / Beer Glasses | 1 | US Home → Kitchen & Dining 284507 |

---

## 采集执行

1. **只采白名单**：采集任务只按上表 node_id 配置，白名单外的类目一律不采（这就是"验证好品线"——用赚过钱的类目反向框定采集范围）。
2. **三站同标准**：US 用本表 node_id；UK 在 `tree_UK.json`、DE 在 `tree_DE.json` 里按同一套英文小类名找对应 node_id。这些类目在 UK 数据里通常最密（优秀产品多为 UK 站），DE 家居装饰/手工/玩具落点多。
3. **采集后仍要过 ASIN 级**：白名单只缩小到"好类目"，落到单个 ASIN 还要按 `垃圾asin分析.md` 过标题形态、价格带（>£15/$20 复核）、IP（真人/正版拒绝）、大件/带电/化学（拒绝）。同一好类目里也有坏形态（如 arts-crafts 里的实木收纳箱 B0GTYZVLZ5）。
4. **白名单可迭代**：新卖爆的 ASIN 落到新小类时，把该小类加进白名单；某小类持续不出单则移除。保持白名单 = 最新的"验证好品线"。

---

## 明确不采（白名单外，采集直接跳过）

化学品/杀虫/药剂、汽车核心件（Car Parts/工具/油液/化学养护）、园艺大件（家具/花盆土壤/割草机/泳池氯片）、带电设备（充电器/缝纫机/刺绣机/热压机/风扇/吸尘器/发电机/遥控车/儿童电子）、服装鞋、大件家具、床垫被芯、球队正版周边（Fan Shop）、婴幼儿入口件/安全件、化妆品护肤品、安全责任件（救生衣/安全带延长/燃气炉）。
