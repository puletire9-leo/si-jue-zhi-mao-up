/**
 * 选品方法卡详情内容
 *
 * 用于 AllSelection 页面的方法卡「了解详情」抽屉;
 * 业务描述提炼自 docs/选品方法库/3_消费层/方法卡片/,
 * 强制/不支持字段列表与 queryPlan.ts 的 METHOD_LENS_DEFINITIONS 保持同步.
 */

export interface MethodCardCriterion {
  /** 判定项 (如「重量」) */
  label: string;
  /** 判定值 (如「< 300g」) */
  value: string;
  /** 补充说明 */
  note?: string;
}

export interface MethodCardInfo {
  id: "M01" | "M02";
  /** 卡片标题 */
  title: string;
  /** 一句话概述 */
  tagline: string;
  /** 何时用 - 适用场景列表 */
  whenToUse: string[];
  /** 何时不用 - 反面场景列表 */
  whenNotToUse: string[];
  /** 硬门槛 - 一票否决条件 */
  hardCriteria: MethodCardCriterion[];
  /** 达标逻辑 - OR/AND 判定规则的展示 */
  passLogic: string[];
  /** 强制固定的字段 (用户改不动) */
  forcedFilters: string[];
  /** 该方法不支持的字段 (即使 UI 选了也会被丢弃) */
  unsupportedFilters: string[];
  /** 输出 / 产出 */
  output: string;
  /** 数据源 */
  dataSource: string;
  /** 依据 / 为什么这样筛 */
  rationale: string[];
  /** 关联的完整方法卡文档路径 */
  fullDocPath?: string;
}

export const METHOD_CARD_INFO: Record<"M01" | "M02", MethodCardInfo> = {
  M01: {
    id: "M01",
    title: "M01 · 新品榜加速法",
    tagline:
      "从八爪鱼抓的亚马逊新品榜里,用「国家 × 账龄」的销量/BSR 门槛快速筛出有机会的新品",
    whenToUse: [
      "拿到一批新品榜原始数据,要快速过一遍找候选",
      "想铺量、走主流 FBA 打法",
      "关注英国 / 德国 / 美国站点的新品机会",
    ],
    whenNotToUse: [
      "自发货品 → 走 M03 FBM 自发货简单道 (不分段)",
      "找「小而无人抢 + 有价差」的冷门 → 走 M02 价格洼地法",
      "老品跟卖或成熟盘子的机会评估",
    ],
    hardCriteria: [
      { label: "重量", value: "< 300 g", note: "适合空运走 FBA 的重量段" },
      { label: "上架天数", value: "< 90 天", note: "限定「新品」的时间口径" },
    ],
    passLogic: [
      "🇬🇧 UK:价格 £4.99-£17.99,30天≥2 / 60天≥10 / 90天≥30 单,或 BSR<20000",
      "🇩🇪 DE:价格 €5.99-€18.99,30天≥4 / 60天≥20 / 90天≥50 单,或 BSR<25000",
      "🇺🇸 US:价格 $6.99-$25.99,30天≥50 / 60天≥120 / 90天≥200 单",
      "销量与 BSR 达标是「或」的关系,过一个即算",
      "三个国家都产出候选清单 — 本质都是决策参考,是否真上架由人决定",
    ],
    forcedFilters: [
      "scene = new (新品视角)",
      "dataView = clean (去变体污染表)",
      "method = M01",
    ],
    unsupportedFilters: [
      "asin / 商品标题 / 卖家名 精确搜索",
      "大类榜单 category 多选",
      "filterMode / weekTag / 上架日期区间",
      "价格/销量/上架天数/BSR/重量/变体数 手动区间",
      "配送方式 fulfillment / 商品评级 grade",
      "自定义 qualifyRules (方法卡自带内置规则)",
    ],
    output: "候选清单 + 每个候选的达标路径标注 + 可一键回灌的 filterRules",
    dataSource: "competitor_products_clean 表 (去变体污染的干净竞品数据)",
    rationale: [
      "销量是卖家精灵拿大类 BSR 预测的,不是真值;BSR 才硬 — 所以「或」的关系,BSR 达标更可信",
      "账龄分段承认「新品需要时间爬量」,一个死阈值会错杀刚上架的好品",
      "三个国家都跑筛选并产出候选,本质都是决策参考;美国当前只当参考样本,阈值比英德高是承认它的市场量级",
      "地板标准永远保留,是兜底;某小类一旦在榜单模型里建出曲线就「毕业」用更准的",
    ],
    fullDocPath: "docs/选品方法库/3_消费层/方法卡片/M01_新品榜加速法.md",
  },

  M02: {
    id: "M02",
    title: "M02 · 郑总同行品线跟随法",
    tagline:
      "用 deng_zong_shop 最新批次里的郑总同行店铺盘子,筛出一批「同行已经验证过」的候选商品",
    whenToUse: [
      "想快速看郑总同行当前重点铺在哪些商品 / 大类 / 小类",
      "想在品线页里拉出同行盘子的候选,优先看已经有人验证过的方向",
      "想判断「这是没人做的机会,还是同行已经扎堆的红海」",
    ],
    whenNotToUse: [
      "找八爪鱼新品榜里的新品机会 → 走 M01 新品榜加速法",
      "看非郑总同行盘子的通用竞品全量 → 直接用普通竞品查询",
      "把郑总盘子当默认模型 — 它只是可开关的证据源,不是所有品线分析的默认",
    ],
    hardCriteria: [
      {
        label: "批次口径",
        value: "最新批次",
        note: "同 ASIN 取最新记录,避免重复污染",
      },
      { label: "范围", value: "按 marketplace / bsrId / nodeId 收窄" },
    ],
    passLogic: [
      "数据源 = deng_zong_shop 最新 batch_date",
      "支持按 marketplace / bsrId / nodeId / batchDate 收窄",
      "同一 ASIN 只取最新记录去重",
      "排序:优先月销量高、BSR 更靠前的商品",
    ],
    forcedFilters: [
      "targetSource = deng_zong (郑总同行盘子)",
      "dataView = deng_zong",
      "method = M02",
    ],
    unsupportedFilters: [
      "asin / 商品标题 / 卖家名 精确搜索",
      "大类榜单 category 多选",
      "filterMode / weekTag / 上架日期区间",
      "价格/销量/上架天数/BSR/重量/变体数 手动区间",
      "配送方式 fulfillment / 商品评级 grade",
      "自定义 qualifyRules (方法卡自带内置规则)",
    ],
    output:
      "候选商品列表 + methodId=M02 + hitReasons + ruleSnapshot.batchDate 标明所用郑总证据批次",
    dataSource: "deng_zong_shop 表 (郑总同行店铺按批次抓取的商品盘子)",
    rationale: [
      "同行已经验证过的商品有真实数据背书,比纯凭直觉找机会更稳",
      "品线选品页是通用容器,不应默认带「郑总」标签 — M02 是可开关的方法卡",
      "同一 ASIN 取最新记录,避免历史批次数据重复污染",
      "deng_zong_shop 是 M02 的证据源,不是所有品线分析的默认模型",
    ],
    fullDocPath: "docs/选品方法库/3_消费层/方法卡片/M02_郑总同行品线跟随法.md",
  },
};
