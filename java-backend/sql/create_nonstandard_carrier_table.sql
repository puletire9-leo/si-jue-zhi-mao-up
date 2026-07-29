-- ============================================================
-- 非标载体配置表（nonstandard_carrier）
-- 说明：承载「一类非标品用哪套市场检索词」。AI 选品页按载体做全量捞取，
--       从 shop_products / competitor_products_clean 双通道（标题主词 ∪ 类目路径）
--       捞出该载体的所有 ASIN 写入 ai_selection。
--       检索词依据场外方法卡（如 找非标品/挂牌.md 第四节双通道）。
-- ============================================================

CREATE TABLE IF NOT EXISTS nonstandard_carrier (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  carrier_key    VARCHAR(64)  NOT NULL COMMENT '载体英文键，如 guapai',
  name           VARCHAR(128) NOT NULL COMMENT '载体中文名，如 挂牌',
  title_keywords TEXT COMMENT '标题主词，逗号分隔（suncatcher,sun catcher,...）',
  category_paths TEXT COMMENT '类目路径关键词，逗号分隔（Sun Catchers,Sonnenfänger）',
  exclude_keywords TEXT COMMENT '硬排除词；两个召回通道均生效',
  conditional_exclude_keywords TEXT COMMENT '条件排除词；命中成品保护词时可救回',
  include_keywords TEXT COMMENT '成品保护词；仅覆盖条件排除词',
  note           VARCHAR(512) DEFAULT '' COMMENT '定锚说明',
  enabled        TINYINT DEFAULT 1 COMMENT '是否启用：1 启用 / 0 停用',
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_carrier_key (carrier_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='非标载体检索词配置';

-- 种子：挂牌（检索词取自 找非标品/挂牌.md 第四节双通道）
INSERT IGNORE INTO nonstandard_carrier (
  carrier_key, name, title_keywords, category_paths,
  exclude_keywords, conditional_exclude_keywords, include_keywords, note
)
VALUES ('guapai', '挂牌',
  'suncatcher,sun catcher,sun-catcher,sun acrylic catcher,sun glass catcher,sonnenfänger,sonnenfanger,stained glass window hanging,stained glass%window hanging,stained acrylic window hanging,acrylic window hanging,acrylic%puzzle%hanging,acryl fensterbild,buntglas fensterdekoration',
  'Sun Catchers,Suncatchers,Sonnenfänger,Sonnenfanger,Glass Art & Suncatchers,Stained Glass Panels',
  'gardinenstang,gardinenschiene,vorhangziehstäbe,gardinenstab,perlen zum auffädeln,facettierte glasperlen,glasperlen zum,beads for jewelry,beads for bracelet,curtain rod,octagon bead,perlen set,ersatzperlen,sticker,aufkleber,anti collision,kristall-suncatcher-perlen,kristallglasperlen,chicken wire,glass paint,lamp repair,chandelier connector,icicle,teardrop bead,glass teardrop,wind chime bead,window hanging chain,hanging chains,glass sheets,glass mosaic tiles,glass corner bevel,propagation station',
  'bastelset,diy set,glass prism,crystal pendant,crystals sun,prism sun,kristall prism,chandelier prism',
  'acryl puzzle,acryl-puzzle,acrylic puzzle,acrylic round puzzle,acrylic%puzzle%hanging,acrylic stained glass sun catcher,stained glass window hanging,stained glass%window hanging,stained acrylic window hanging,acrylic window hanging,acryl fensterbild,buntglas fensterdekoration,stained glass window panel,diamond art hanging ornament,diamond painting anhänger,diamond painting acryl fensterbild',
  '亚克力及玻璃 Suncatcher/Window Hanging 成品；硬污染排除，DIY/水晶词仅在缺少成品形态时排除');
