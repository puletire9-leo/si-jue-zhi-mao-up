-- 非标载体第一次收拢 R1  2026-08-03
-- 依据：17 载体首版全市场捞取后抽查标题发现的污染。
-- 两类动作：
--   1) 收窄过宽的 category_paths（类目召回通道是最大漏点：如 Cosmetic Bags 把所有化妆包全捞进来）
--   2) 补 exclude / conditional_exclude 精确打掉抽查里占主导的噪声
-- guapai 已三轮打磨，不动。收拢后需重跑（全量新批次），旧脏批次可删。
SET NAMES utf8mb4;

-- ── 铁皮画：排 安全/警示牌、拉牌、亚克力块、季节门挂 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',fire extinguisher,feuerloscher,feuerlöscher,no smoking,rauchen verboten,pull sign,piktogramm,reservation sign,reserviert,acrylic block,acrylic photo block,door hanger,wreath,warning safety,hinweisschild,fluchtweg')
 WHERE carrier_key='tiepihua';

-- ── 午餐包：排 大冰箱/电子加热/保鲜盒/名字贴/香蕉盒/品牌冰箱 ──
UPDATE nonstandard_carrier SET
 conditional_exclude_keywords = CONCAT(conditional_exclude_keywords, ',cooler box,cool box,kuhlbox,kühlbox,camping cooler,meal prep,frischhaltedose,heated lunch box,electric lunch,coleman,curver,kompressor,banana,name sticker,name label')
 WHERE carrier_key='lunchbag';

-- ── 束口袋：排 organza礼袋/塑料goodie/网格沙滩/PVC体育馆/首饰袋 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',plastic bag bulk,goodie bag plastic,mesh beach,net beach,clear stadium,pvc stadium,storage bag foldable,dry bag,sandbag,stuff sack')
 WHERE carrier_key='drawstringbag';

-- ── 帆布袋：排 酒瓶袋/购物车/网格DIY/头枕挂钩/篮/保温 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',wine carrier,wine bottle bag,trolley,shopping cart,mesh kit diy,plastic canvas kit,headrest hook,haken kopfstutze,basket,korb,mesh net string,netztasche')
 WHERE carrier_key='totebag';

-- ── 印花水杯：排 吸管配件/贴纸/瓶架/奶瓶/宠物饮水/喷雾/杯盖配件 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',replacement straw,straw only,ersatzstrohhalm,sticker,aufkleber,bottle holder,bottle cage,flaschenhalter,bottle topper,topper spout,dog bottle,hundetrinkflasche,pet water,misting,spray mist')
 WHERE carrier_key='bottle';

-- ── 木质挂牌：排 季节装饰/黑板/钩织/鱼缸/砧板已排 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',christmas,weihnachten,halloween,easter,ostern,advent,thanksgiving,chinese new year,chalkboard,blackboard,tafel,crochet,hakel,aquarium,betta,fish tank,fish hammock,table decorations,tischdeko,scavenger,mood chart')
 WHERE carrier_key='woodsign';

-- ── 亚克力立牌：类目收窄 + 排 车挂/鱼缸/树脂动物/耶稣诞生/寄居蟹 ──
UPDATE nonstandard_carrier SET
 category_paths = 'Ornaments,Figurines',
 exclude_keywords = CONCAT(exclude_keywords, ',car pendant,rearview mirror,mirror charm,dashboard,aquarium,fish tank,betta,hermit crab,resin animal,nativity,krippe,worry bear,plush doll,shell,muschel')
 WHERE carrier_key='acrylstandee';

-- ── 透明收纳包：类目去掉宽 Cosmetic Bags（最大漏点），靠标题 clear/pvc；排 绒/丝绒/棉绗缝/刷袋 ──
UPDATE nonstandard_carrier SET
 category_paths = '',
 exclude_keywords = CONCAT(exclude_keywords, ',velvet,samt,quilted,fluffy,fur,plush,plusch,brush bag,brush holder,pinsel,jewelry display,canvas,cotton,corduroy,teacher gift,thank you gift')
 WHERE carrier_key='clearbag';

-- ── 护腕鼠标垫：排 大桌垫/键盘手托/超大尺寸/无充电垫/世界地图/加热 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',desk mat,desk pad,schreibtischunterlage,keyboard wrist,extended,xxl,900,800,700x,world map,weltkarte,heated,wireless charging,charging pad,trading,stock market,shortcut key,excel')
 WHERE carrier_key='mousemat';

-- ── 马克杯：排 搅拌棒/勺/杯垫/窗帘扣/沙发套/墙贴/钥匙扣/吸嘴杯/玻璃茶杯/礼品套装 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',stirrer,ruhrer,spoon,loffel,coaster,untersetzer,curtain,vorhang,couch cover,sofa,wall decal,wandtattoo,wandsticker,keychain,charm,anhanger,sippy,schnabeltasse,glass tea,teetasse glas,gift set women,geschenke fur frauen')
 WHERE carrier_key='mug';

-- ── 海报画芯：排 金属牌/铁皮牌/床品/颜料/墙贴/坟墓装饰/推灯/滤芯 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',metal sign,tin sign,blechschild,bedding,bettwasche,duvet,paint set,malfarbe,wall decal,wandtattoo,grave,cemetery,grab,push light,filter,water coloring set,adhesive clips,clip hanger')
 WHERE carrier_key='poster';

-- ── 花园地插：排 支撑杆/拱/喷泉嘴/太阳能灯/牧羊钩/旗/伞座/墙夹/雨链/植物夹 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',plant support,hoop,tunnel,fountain nozzle,springbrunnen,solar light,solarleuchte,shepherd hook,schaferhaken,flag,fahne,umbrella weight,schirmstander,wall clip,pflanzenclip,rain chain,regenkette,windmill,windspiel,fish tank')
 WHERE carrier_key='gardenstake';

-- ── 背包：排 宠物背带/炉具/保温/摩托/乐器箱/锁/补丁/箱带/天幕/模具 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',bird carrier,pet carrier,camping stove,gas stove,cooler,motorcycle,tail bag,motorrad,banjo,ukulele,guitar,instrument case,padlock,combination lock,patch,applique,suitcase strap,luggage strap,tarp,hammock,cookie mold,mold maker')
 WHERE carrier_key='backpack';

-- ── 出风口夹：排 手机架/仪表盘钟/派对牌/气球/横幅/椅套/球衣旗 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',phone holder,phone mount,handyhalter,dashboard clock,party sign,cutout,balloon,ballon,banner,chair cover,stuhlhusse,jersey,flag bunting')
 WHERE carrier_key='ventclip';

-- ── 口袋拥抱卡片：排 相册/手足印/牙齿盒/里程碑卡/礼篮/相框泰迪 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',photo album,fotoalbum,footprint,handprint,fußabdruck,tooth,teeth,zahn,milestone,meilenstein,gift basket,hamper,geschenkkorb,photo frame,bilderrahmen,photo teddy,paw print')
 WHERE carrier_key='pockethug';

-- ── 化妆包：排 姨妈袋/卫生巾/笔袋/零食袋/棉签盒/图纸/餐包 ──
UPDATE nonstandard_carrier SET
 exclude_keywords = CONCAT(exclude_keywords, ',period pouch,sanitary,tampon,menstrual,binde,pencil case,pencil bag,federmappchen,federmäppchen,snack bag,cotton bud,wattestabchen,wattestäbchen,pattern only,ditty bag,lunch bag')
 WHERE carrier_key='makeupbag';
