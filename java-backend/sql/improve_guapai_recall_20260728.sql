-- 挂牌召回率修复：硬排除 + 条件排除 + 成品保护三层规则。
-- 执行前备份 nonstandard_carrier；本脚本为单次生产迁移。
DROP PROCEDURE IF EXISTS migrate_guapai_recall_20260728;
DELIMITER $$
CREATE PROCEDURE migrate_guapai_recall_20260728()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'nonstandard_carrier'
      AND column_name = 'conditional_exclude_keywords'
  ) THEN
    ALTER TABLE nonstandard_carrier
      ADD COLUMN conditional_exclude_keywords TEXT
      COMMENT '条件排除词；命中成品保护词时可救回' AFTER exclude_keywords;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'nonstandard_carrier'
      AND column_name = 'include_keywords'
  ) THEN
    ALTER TABLE nonstandard_carrier
      ADD COLUMN include_keywords TEXT
      COMMENT '成品保护词；仅覆盖条件排除词' AFTER conditional_exclude_keywords;
  END IF;
END$$
DELIMITER ;
CALL migrate_guapai_recall_20260728();
DROP PROCEDURE migrate_guapai_recall_20260728;

UPDATE nonstandard_carrier
SET title_keywords = 'suncatcher,sun catcher,sun-catcher,sun acrylic catcher,sun glass catcher,sonnenfänger,sonnenfanger,stained glass window hanging,stained glass%window hanging,stained acrylic window hanging,acrylic window hanging,acrylic%puzzle%hanging,acryl fensterbild,buntglas fensterdekoration',
    category_paths = 'Sun Catchers,Suncatchers,Sonnenfänger,Sonnenfanger,Glass Art & Suncatchers,Stained Glass Panels',
    exclude_keywords = 'gardinenstang,gardinenschiene,vorhangziehstäbe,gardinenstab,perlen zum auffädeln,facettierte glasperlen,glasperlen zum,beads for jewelry,beads for bracelet,curtain rod,octagon bead,perlen set,ersatzperlen,sticker,aufkleber,anti collision,kristall-suncatcher-perlen,kristallglasperlen,chicken wire,glass paint,lamp repair,chandelier connector,icicle,teardrop bead,glass teardrop,wind chime bead,window hanging chain,hanging chains,glass sheets,glass mosaic tiles,glass corner bevel,propagation station',
    conditional_exclude_keywords = 'bastelset,diy set,glass prism,crystal pendant,crystals sun,prism sun,kristall prism,chandelier prism',
    include_keywords = 'acryl puzzle,acryl-puzzle,acrylic puzzle,acrylic round puzzle,acrylic%puzzle%hanging,acrylic stained glass sun catcher,stained glass window hanging,stained glass%window hanging,stained acrylic window hanging,acrylic window hanging,acryl fensterbild,buntglas fensterdekoration,stained glass window panel,diamond art hanging ornament,diamond painting anhänger,diamond painting acryl fensterbild',
    note = '亚克力及玻璃 Suncatcher/Window Hanging 成品；硬污染排除，DIY/水晶词仅在缺少成品形态时排除'
WHERE carrier_key = 'guapai';
