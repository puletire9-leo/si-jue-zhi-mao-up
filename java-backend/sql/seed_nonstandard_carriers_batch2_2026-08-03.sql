-- 高价值非标载体种子数据 第二批 2026-08-03
-- 来源：非标品标题分析剩余载体（第一批已建 guapai/tiepihua/lunchbag/drawstringbag/totebag/bottle）
-- 本批补齐分析里出现过但尚未捞取的 11 个载体，实现非标品载体 100% 覆盖，之后统一收拢。
-- EN + DE 双语关键词，初版宽召回；幂等 ON DUPLICATE KEY UPDATE。
SET NAMES utf8mb4;

INSERT INTO nonstandard_carrier
  (carrier_key, name, title_keywords, category_paths,
   exclude_keywords, conditional_exclude_keywords, include_keywords, note, enabled)
VALUES
-- ── 木质挂牌 / 木质立牌 ────────────────────────────
('woodsign', '木质挂牌',
 'wooden ornament,wooden sign,wooden plaque,wood hanging ornament,wooden hanging decoration,holzschild,holzdeko,holzornament,holz wanddeko,holzfigur deko',
 'Ornaments,Hanging Ornaments,Wall Plaques,Holzdeko,Dekofiguren',
 'cutting board,chopping board,schneidebrett,coaster,untersetzer,shelf,regal,photo frame,bilderrahmen,puzzle wooden toy,building blocks',
 'engraved plaque,personalised wooden',
 '',
 '2026-08-03 建：木质挂牌/立牌（动物/自然/疗愈主题）；排砧板、杯垫、相框、木玩具积木。首版宽召回待收敛。', 1),

-- ── 亚克力立牌 / 亚克力摆件 ────────────────────────
('acrylstandee', '亚克力立牌',
 'acrylic standee,acrylic figure,acrylic ornament,acrylic plaque standing,acrylic statue,acryl aufsteller,acryl figur,acryl deko stehend,acryl statue',
 'Ornaments,Figurines,Decorative Standing,Dekofiguren,Aufsteller',
 'phone stand,handyhalter,sign holder,display stand rack,menu holder,photo frame,bilderrahmen,keychain,schlusselanhanger,brochure holder',
 'acrylic keychain,acrylic charm',
 'angel acrylic,acrylic angel,guardian angel ornament',
 '2026-08-03 建：亚克力立牌/摆件（天使/纪念/人偶主题）；排手机架、标牌展示架、相框、钥匙扣。', 1),

-- ── 透明收纳包 / PVC 洗漱袋 ────────────────────────
('clearbag', '透明收纳包',
 'clear bag,clear pouch,transparent bag,pvc bag,clear makeup bag,clear cosmetic bag,transparent pouch,klarsichttasche,transparente tasche,pvc kulturbeutel',
 'Cosmetic Bags,Wash Bags,Toiletry Bags,Kosmetiktaschen,Kulturbeutel',
 'stadium bag,football clear,concert clear,gun bag,shoe bag,laptop sleeve,ziplock food,freezer bag,document holder,file folder',
 'clear tote large,mesh bag',
 'capybara clear bag,character clear bag,printed clear pouch',
 '2026-08-03 建：印花/主题透明收纳包（洗漱/化妆/分装）；排体育馆透明包、食品自封袋、文件袋。', 1),

-- ── 护腕鼠标垫 ─────────────────────────────────────
('mousemat', '护腕鼠标垫',
 'mouse mat,mouse pad,mousepad,wrist rest mouse,ergonomic mouse pad,mauspad,mauspad handgelenk,gaming mauspad,handgelenkauflage maus',
 'Mouse Pads,Mouse Mats,Mauspads',
 'keyboard wrist rest,desk mat large,gaming desk pad xxl,extended mousepad 90,wireless charging pad,mouse only,gaming mouse wireless',
 '',
 'cat mouse mat,highland cow mouse mat,character mouse pad,printed mouse mat',
 '2026-08-03 建：印花/动物护腕鼠标垫；排键盘手托、超大桌垫、无线充电垫、鼠标本体。', 1),

-- ── 马克杯 / 陶瓷杯 ────────────────────────────────
('mug', '马克杯',
 'mug,coffee mug,ceramic mug,novelty mug,printed mug,tasse,kaffeetasse,keramiktasse,kaffeebecher',
 'Mugs,Coffee Mugs,Tassen,Kaffeetassen',
 'travel mug,tumbler,glass cup,measuring cup,mug tree,mug rack,mug warmer,espresso cup set,cup and saucer set,mug press machine',
 'stainless steel mug',
 'character mug,dragon mug,unicorn mug,fourth wing mug,funny mug gift',
 '2026-08-03 建：印花/IP/幽默马克杯；排旅行杯、玻璃杯、量杯、杯架、暖杯垫、成套杯碟。', 1),

-- ── 海报 / 装饰画芯（无框） ────────────────────────
('poster', '海报画芯',
 'poster,posters for bedroom,wall art print,canvas print,frameless wall art,unframed print,poster set,wandbild,leinwandbild,poster set,kunstdruck',
 'Posters & Prints,Wall Art,Poster,Wandbilder,Kunstdrucke',
 'poster frame,picture frame,bilderrahmen,poster hanger,magnetic frame,easel,poster putty,adhesive strips,light box cinema',
 'canvas with frame,framed print',
 'aesthetic poster,preppy poster,leopard poster,watercolour poster,pack posters',
 '2026-08-03 建：审美/主题墙贴海报画芯（无框）；排海报框、相框、挂杆、影院灯箱。', 1),

-- ── 亚克力地插 / 花盆装饰 ──────────────────────────
('gardenstake', '花园地插',
 'garden stake,garden stakes,plant pot decoration,pot ornament,garden ornament stake,acrylic garden stake,gartenstecker,pflanzenstecker,blumentopf deko,gartendeko stecker',
 'Garden Ornaments,Plant Pot Decorations,Gartenstecker,Gartendeko',
 'plant support,tomato stake,climbing support,plant label,plant marker,pflanzstab,rankhilfe,garden fence,edging,solar light path,irrigation spike',
 'metal stake plain',
 'bird garden stake,robin stake,acrylic pot decoration,angel garden stake',
 '2026-08-03 建：亚克力/主题花园地插花盆装饰（鸟/天使/昆虫）；排支撑杆、植物标签、栅栏、太阳能灯、浇水插。', 1),

-- ── 背包（印花/主题） ──────────────────────────────
('backpack', '背包',
 'backpack,school backpack,kids backpack,rucksack,schulrucksack,kinderrucksack,printed backpack,character backpack',
 'Backpacks,Kids Backpacks,Rucksäcke,Schulrucksäcke',
 'laptop backpack,hiking backpack,travel backpack 40l,cabin bag,drawstring bag,anti theft backpack,tactical backpack,baby changing backpack,wheeled backpack',
 'sports backpack plain',
 'gamer backpack,character backpack,neon backpack print',
 '2026-08-03 建：印花/主题背包（游戏/男孩线）；排笔电包、登山大包、抽绳包、防盗/战术包、拉杆包。', 1),

-- ── 出风口夹 / 车载香薰夹 ──────────────────────────
('ventclip', '出风口夹',
 'car vent clip,air vent clip,car air freshener clip,vent decoration,car vent decor,lufterfrischer clip,auto luftauslass clip,autoduft clip,lüftungsclip auto',
 'Car Air Fresheners,Air Vent Accessories,Autoduft,Auto Lufterfrischer',
 'phone holder vent,handyhalter lüftung,cup holder vent,vent visor,drink holder,tablet mount,gps mount,vent cover louver,ac vent deflector',
 'air freshener refill',
 'dachshund vent clip,animal vent clip,acrylic vent clip,character car vent',
 '2026-08-03 建：宠物/主题车载出风口夹（香薰/亚克力）；排手机架、杯架、导航支架、出风口罩/导流板。', 1),

-- ── 口袋拥抱 / 亚克力祝福卡片 ──────────────────────
('pockethug', '口袋拥抱卡片',
 'pocket hug,pocket hug token,acrylic pocket hug,pocket hug card,keepsake token,taschenumarmung,pocket hug keychain,trostspender karte',
 'Keepsakes, Memorial Gifts, Novelty Keepsakes',
 'photo frame,bilderrahmen,greeting card blank,plain card pack,envelope only,gift box empty,fridge magnet only',
 'wooden token,card only',
 'angel pocket hug,jesus pocket hug,nurse pocket hug,heart acrylic keepsake,inspirational token card',
 '2026-08-03 建：亚克力口袋拥抱/祝福卡片（情感/职业/宗教礼物）；排相框、空白贺卡、礼盒、冰箱贴。', 1),

-- ── 化妆包 / 洗漱包（印花主题） ────────────────────
('makeupbag', '化妆包',
 'makeup bag,cosmetic bag,toiletry bag,wash bag,make up pouch,schminktasche,kosmetiktasche,kulturbeutel,make-up tasche',
 'Cosmetic Bags,Makeup Bags,Toiletry Bags,Kosmetiktaschen,Kulturbeutel',
 'brush set,brush holder,makeup organizer box,acrylic organizer,vanity case hard,train case,mirror case,jewelry box,pill organizer,hanging toiletry large',
 'clear pvc bag,transparent pouch',
 'london makeup bag,printed cosmetic bag,character wash bag,themed toiletry bag',
 '2026-08-03 建：印花/城市/主题化妆洗漱包（软袋）；排刷具套装、硬壳化妆箱、亚克力收纳盒、首饰盒。透明PVC归 clearbag。', 1)

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
