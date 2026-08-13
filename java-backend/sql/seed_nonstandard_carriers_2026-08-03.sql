-- 高价值非标载体种子数据 2026-08-03
-- 来源：非标品标题分析（产品数据/值得拓的产品，1688店雷达方向/值得拓的产品_2026-08-03/非标品标题分析）
-- 主力载体：铁皮画 / 午餐包 / 束口袋 / 帆布袋 / 印花水杯（太阳捕手 guapai 已存在，不动）
-- EN + DE 双语关键词，初版先宽召回，harvest 抽查后再补 exclude/conditional_exclude 收敛。
-- 幂等：ON DUPLICATE KEY UPDATE（carrier_key 唯一）。
SET NAMES utf8mb4;

INSERT INTO nonstandard_carrier
  (carrier_key, name, title_keywords, category_paths,
   exclude_keywords, conditional_exclude_keywords, include_keywords, note, enabled)
VALUES
-- ── 铁皮画 / 铁皮挂牌 ──────────────────────────────
('tiepihua', '铁皮画',
 'tin sign,metal sign,metal wall sign,vintage tin sign,metal plaque,blechschild,metallschild,vintage blechschild,metall wandschild',
 'Signs & Plaques,Decorative Signs,Wall Signs,Schilder,Dekoschilder',
 'number plate,license plate,licence plate,nummernschild,kennzeichen,street sign traffic,road sign,tin can,storage tin,lunch tin,warning sign safety,parking sign',
 'led sign,neon sign',
 '',
 '2026-08-03 建：铁皮画/挂牌，靠幽默文案/图案主题成交；排交通牌、罐、安全警示牌。首版宽召回待收敛。', 1),

-- ── 午餐包 / 保温午餐袋 ────────────────────────────
('lunchbag', '午餐包',
 'lunch bag,lunch box,insulated lunch bag,lunch cooler bag,lunch tote,kuhltasche,kühltasche,lunchtasche,brotdose tasche,isoliertasche lunch',
 'Lunch Bags,Cool Bags,Lunch Boxes,Kühltaschen,Lunchtaschen',
 'backpack,rucksack,laptop bag,wine cooler bag,picnic basket,car fridge,electric cooler,camping cooler box',
 'bento,tupperware,brotdose kunststoff,plastic lunch box',
 'printed lunch bag,character lunch bag',
 '2026-08-03 建：印花/主题午餐包（儿童/少女/男孩线）；条件排纯塑料饭盒 bento，排背包与大冰箱。', 1),

-- ── 束口袋 / 抽绳运动包 ────────────────────────────
('drawstringbag', '束口袋',
 'drawstring bag,drawstring backpack,gym sack,swimming bag,swim bag,sports drawstring,turnbeutel,sportbeutel,gymsack,schwimmbeutel',
 'Drawstring Bags,Gym Sacks,Turnbeutel,Sportbeutel',
 'organza bag,organza pouch,jewelry pouch,jewellery pouch,gift bag small,wedding favor bag,schmuckbeutel,mesh laundry bag,shoe bag travel',
 'muslin bag,cotton pouch',
 'printed drawstring bag,character drawstring bag',
 '2026-08-03 建：印花/主题束口运动包；排小号 organza 礼袋、首饰袋、洗衣袋。', 1),

-- ── 帆布袋 / 托特包 ────────────────────────────────
('totebag', '帆布袋',
 'tote bag,canvas bag,canvas tote,shopping tote,cotton tote,shoulder tote,jutebeutel,stofftasche,baumwolltasche,einkaufstasche,leinentasche',
 'Tote Bags,Canvas Bags,Shopping Bags,Stofftaschen,Einkaufstaschen',
 'laptop bag,laptop sleeve,diaper bag,nappy bag,cooler tote,insulated tote,leather handbag,trolley bag,wheeled shopping',
 'jute bag plain,plain canvas blank',
 'printed tote bag,double sided print tote,graphic canvas bag',
 '2026-08-03 建：印花/IP/城市主题帆布托特袋；排笔电包、尿布包、保温包、皮质手袋。', 1),

-- ── 印花水杯 / 保温杯 ──────────────────────────────
('bottle', '印花水杯',
 'water bottle,drinks bottle,drinking bottle,sports bottle,tumbler,insulated tumbler,travel mug,trinkflasche,wasserflasche,sportflasche,thermobecher',
 'Water Bottles,Tumblers,Sports Water Bottles,Trinkflaschen,Thermobecher',
 'baby bottle,feeding bottle,babyflasche,pet water bottle,dog water bottle,food storage jar,food flask jar,hot water bottle,perfume bottle,spray bottle,hip flask',
 'glass bottle plain,stainless steel blank',
 'printed water bottle,character bottle,coquette bottle,gamer bottle',
 '2026-08-03 建：印花/主题水杯保温杯（coquette/gamer 线）；排奶瓶、宠物饮水器、食物罐、香水/喷雾瓶、热水袋。', 1)

ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  title_keywords = VALUES(title_keywords),
  category_paths = VALUES(category_paths),
  exclude_keywords = VALUES(exclude_keywords),
  conditional_exclude_keywords = VALUES(conditional_exclude_keywords),
  include_keywords = VALUES(include_keywords),
  note = VALUES(note),
  enabled = VALUES(enabled),
  updated_at = NOW();
