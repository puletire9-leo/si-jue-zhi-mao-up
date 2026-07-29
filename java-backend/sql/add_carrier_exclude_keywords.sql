-- ============================================================
-- nonstandard_carrier 增加「排除词」字段 + 修正 guapai 检索词
--
-- 背景：LIKE 子串正向检索太宽导致误捞。实测德国站 752 条里 516 条(69%)是
--   fensterdeko(窗户装饰大类词) 子串带进来的窗帘杆/窗帘轨道；另有珠子/水晶串
--   原料(类目为珠饰制作而非 suncatcher)混入 DE51/US39/UK7。
--
-- 排除词语义（后端 AiSelectionMapper.xml dualChannelWhere 实现）：
--   类目通道命中的行「无条件保留」（真品，即便标题堆 Perlen）；
--   仅靠标题通道命中的行才过 NOT LIKE 排除词。故不含单独的 perlen/beads，避免误伤成品。
--
-- ⚠️ ALTER ADD COLUMN 不幂等，执行前确认 exclude_keywords 列不存在：
--   SELECT COLUMN_NAME FROM information_schema.columns
--   WHERE table_schema=DATABASE() AND table_name='nonstandard_carrier' AND COLUMN_NAME='exclude_keywords';
-- ============================================================

ALTER TABLE nonstandard_carrier
  ADD COLUMN exclude_keywords TEXT COMMENT '标题排除词,逗号分隔;仅作用标题通道,类目命中豁免' AFTER category_paths;

-- guapai：删掉 fensterdeko（太宽），标题主词只留真 suncatcher 系
UPDATE nonstandard_carrier
   SET title_keywords = 'suncatcher,sun catcher,sun-catcher,sonnenfänger,sonnenfanger'
 WHERE carrier_key = 'guapai';

-- guapai：初始排除词（按实测污染词挑选，不含单独 perlen/beads 以免误伤成品）
UPDATE nonstandard_carrier
   SET exclude_keywords = 'gardinenstang,gardinenschiene,vorhangziehstäbe,gardinenstab,perlen zum auffädeln,facettierte glasperlen,glasperlen zum,beads for jewelry,beads for bracelet,curtain rod,octagon bead'
 WHERE carrier_key = 'guapai';
