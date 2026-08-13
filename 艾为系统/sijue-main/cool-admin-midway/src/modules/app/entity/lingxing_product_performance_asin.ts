import { BaseEntity } from "@cool-midway/core";
import { Column, Entity, Index } from "typeorm";

@Entity("app_amz_lingxing_product_performance_asin")
@Index("uk_perf_asin_query", ["summary_field", "primary_value", "sid", "start_date", "end_date", "currency_code"], { unique: true })
export class AppAmzLingxingProductPerformanceAsinEntity extends BaseEntity {
  @Column({ comment: "汇总维度", length: 50 })
  summary_field: string;

  @Column({ comment: "汇总维度主键值", length: 255 })
  primary_value: string;

  @Column({ comment: "??ID", type: "int" })
  sid: number;

  @Column({ comment: "查询开始日期", length: 20 })
  start_date: string;

  @Column({ comment: "查询结束日期", length: 20 })
  end_date: string;

  @Column({ comment: "父asins信息", type: "json", nullable: true })
  parent_asins: any;

  @Column({ comment: "asin列表", type: "json", nullable: true })
  asins: any;

  @Column({ comment: "价格列表", type: "json", nullable: true })
  price_list: any;

  @Column({ comment: "上一次大类排名", type: "int", nullable: true })
  prev_cate_rank: number;

  @Column({ comment: "标题", length: 1000, nullable: true })
  item_name: string;

  @Column({ comment: "大类排名", type: "int", nullable: true })
  cate_rank: number;

  @Column({ comment: "小类排名", type: "json", nullable: true })
  small_cate_rank: any;

  @Column({ comment: "币种符号", length: 255, nullable: true })
  currency_icon: string;

  @Column({ comment: "店铺/国家", type: "json", nullable: true })
  seller_store_countries: any;

  @Column({ comment: "分类，字符串数组", type: "json", nullable: true })
  categories: any;

  @Column({ comment: "品牌，字符串数组", type: "json", nullable: true })
  brands: any;

  @Column({ comment: "负责人", type: "json", nullable: true })
  principal_names: any;

  @Column({ comment: "开发人", type: "json", nullable: true })
  developer_names: any;

  @Column({ comment: "月库销比", type: "double", nullable: true })
  month_stock_sales_ratio: number;

  @Column({ comment: "销量", type: "int", nullable: true })
  volume: number;

  @Column({ comment: "订单量", type: "int", nullable: true })
  order_items: number;

  @Column({ comment: "环比订单量", type: "int", nullable: true })
  order_items_chain: number;

  @Column({ comment: "销售额", type: "double", nullable: true })
  amount: number;

  @Column({ comment: "销量环比", type: "double", nullable: true })
  volume_chain_ratio: number;

  @Column({ comment: "环比销量", type: "int", nullable: true })
  volume_chain: number;

  @Column({ comment: "销量额环比", type: "double", nullable: true })
  amount_chain_ratio: number;

  @Column({ comment: "环比销量额", type: "double", nullable: true })
  amount_chain: number;

  @Column({ comment: "订单量环比", type: "double", nullable: true })
  order_chain_ratio: number;

  @Column({ comment: "B2B 销量", type: "int", nullable: true })
  b2b_volume: number;

  @Column({ comment: "B2B 销售额", type: "double", nullable: true })
  b2b_amount: number;

  @Column({ comment: "B2B 订单量", type: "int", nullable: true })
  b2b_order_items: number;

  @Column({ comment: "结算毛利润", type: "double", nullable: true })
  gross_profit: number;

  @Column({ comment: "订单毛利润", type: "double", nullable: true })
  predict_gross_profit: number;

  @Column({ comment: "结算毛利率", type: "double", nullable: true })
  gross_margin: number;

  @Column({ comment: "订单毛利率", type: "double", nullable: true })
  predict_gross_margin: number;

  @Column({ comment: "ROI", type: "double", nullable: true })
  roi: number;

  @Column({ comment: "促销销量", type: "int", nullable: true })
  promotion_volume: number;

  @Column({ comment: "促销销售额", type: "double", nullable: true })
  promotion_amount: number;

  @Column({ comment: "促销订单量", type: "int", nullable: true })
  promotion_order_items: number;

  @Column({ comment: "促销折扣", type: "double", nullable: true })
  promotion_discount: number;

  @Column({ comment: "评论数", type: "int", nullable: true })
  reviews_count: number;

  @Column({ comment: "退款量", type: "int", nullable: true })
  return_count: number;

  @Column({ comment: "退款率", type: "double", nullable: true })
  return_rate: number;

  @Column({ comment: "FBA可售", type: "int", nullable: true })
  afn_fulfillable_quantity: number;

  @Column({ comment: "FBA入库中", type: "int", nullable: true })
  afn_inbound_receiving_quantity: number;

  @Column({ comment: "FBA在途", type: "int", nullable: true })
  afn_inbound_shipped_quantity: number;

  @Column({ comment: "FBA计划入库", type: "int", nullable: true })
  afn_inbound_working_quantity: number;

  @Column({ comment: "FBA不可售", type: "int", nullable: true })
  afn_unsellable_quantity: number;

  @Column({ comment: "FBA库存", type: "int", nullable: true })
  afn_total_inbound: number;

  @Column({ comment: "调仓中", type: "int", nullable: true })
  reserved_fc_processing: number;

  @Column({ comment: "待调仓", type: "int", nullable: true })
  reserved_fc_transfers: number;

  @Column({ comment: "FBM可售", type: "int", nullable: true })
  fbm_quantity: number;

  @Column({ comment: "待发货", type: "int", nullable: true })
  reserved_customerorders: number;

  @Column({ comment: "实际在途", type: "int", nullable: true })
  stock_up_num: number;

  @Column({ comment: "点击量", type: "int", nullable: true })
  clicks: number;

  @Column({ comment: "可售预估天数", type: "int", nullable: true })
  available_days: number;

  @Column({ comment: "fbm可售天数", type: "int", nullable: true })
  fbm_available_days: number;

  @Column({ comment: "评分", type: "double", nullable: true })
  avg_star: number;

  @Column({ comment: "前一个评分", type: "double", nullable: true })
  prev_star: number;

  @Column({ comment: "留评率", type: "double", nullable: true })
  comment_rate: number;

  @Column({ comment: "Sessions-Browser", type: "int", nullable: true })
  sessions: number;

  @Column({ comment: "Sessions-Mobile", type: "int", nullable: true })
  sessions_mobile: number;

  @Column({ comment: "Sessions-Total", type: "int", nullable: true })
  sessions_total: number;

  @Column({ comment: "Buybox", type: "double", nullable: true })
  buy_box_percentage: number;

  @Column({ comment: "PV-Browser", type: "int", nullable: true })
  page_views: number;

  @Column({ comment: "PV-Mobile", type: "int", nullable: true })
  page_views_mobile: number;

  @Column({ comment: "PV-Total", type: "int", nullable: true })
  page_views_total: number;

  @Column({ comment: "广告订单量占比", type: "double", nullable: true })
  adv_rate: number;

  @Column({ comment: "广告 CVR", type: "double", nullable: true })
  ad_cvr: number;

  @Column({ comment: "销量 CVR", type: "double", nullable: true })
  volume_cvr: number;

  @Column({ comment: "CVR", type: "double", nullable: true })
  cvr: number;

  @Column({ comment: "CTR,点击量/展示量", type: "double", nullable: true })
  ctr: number;

  @Column({ comment: "广告花费/净销售额", type: "double", nullable: true })
  acoas: number;

  @Column({ comment: "广告花费/广告销售额", type: "double", nullable: true })
  acos: number;

  @Column({ comment: "TACOS，广告花费/销售额", type: "double", nullable: true })
  tacos: number;

  @Column({ comment: "是否有操作日志", type: "tinyint", nullable: true })
  has_oprator_log: boolean;

  @Column({ comment: "退货量", type: "int", nullable: true })
  return_goods_count: number;

  @Column({ comment: "FBA退货量", type: "int", nullable: true })
  fba_return_goods_count: number;

  @Column({ comment: "FBM退货量", type: "int", nullable: true })
  fbm_return_goods_count: number;

  @Column({ comment: "退货率", type: "double", nullable: true })
  return_goods_rate: number;

  @Column({ comment: "FBA退货率", type: "double", nullable: true })
  fba_return_goods_rate: number;

  @Column({ comment: "FBM退货率", type: "double", nullable: true })
  fbm_return_goods_rate: number;

  @Column({ comment: "cpc,花费/点击量", type: "double", nullable: true })
  cpc: number;

  @Column({ comment: "广告花费【组成广告花费项目的总计】", type: "double", nullable: true })
  spend: number;

  @Column({ comment: "差异分摊", type: "double", nullable: true })
  shared_cost_of_advertising: number;

  @Column({ comment: "SB广告费", type: "double", nullable: true })
  shared_ads_sb_cost: number;

  @Column({ comment: "SBV广告费", type: "double", nullable: true })
  shared_ads_sbv_cost: number;

  @Column({ comment: "SD广告费", type: "double", nullable: true })
  ads_sd_cost: number;

  @Column({ comment: "SP广告费", type: "double", nullable: true })
  ads_sp_cost: number;

  @Column({ comment: "Live广告费", type: "double", nullable: true })
  shared_ads_al_cost: number;

  @Column({ comment: "创作者计划广告费", type: "double", nullable: true })
  shared_ads_cc_cost: number;

  @Column({ comment: "ST广告费", type: "double", nullable: true })
  shared_ads_sspaot_cost: number;

  @Column({ comment: "零售商赞助广告费", type: "double", nullable: true })
  shared_ads_sar_cost: number;

  @Column({ comment: "ROAS,广告销售额/广告花费", type: "double", nullable: true })
  roas: number;

  @Column({ comment: "ASoAS,广告销售额/总销售额", type: "double", nullable: true })
  asoas: number;

  @Column({ comment: "CPO,广告花费/广告订单量", type: "double", nullable: true })
  cpo: number;

  @Column({ comment: "CPM,广告花费/(1000*展示量)", type: "double", nullable: true })
  cpm: number;

  @Column({ comment: "广告销售额", type: "double", nullable: true })
  ad_sales_amount: number;

  @Column({ comment: "SP广告销售额", type: "double", nullable: true })
  ads_sp_sales: number;

  @Column({ comment: "SD广告销售额", type: "double", nullable: true })
  ads_sd_sales: number;

  @Column({ comment: "SB广告销售额", type: "double", nullable: true })
  shared_ads_sb_sales: number;

  @Column({ comment: "SBV广告销售额", type: "double", nullable: true })
  shared_ads_sbv_sales: number;

  @Column({ comment: "广告订单量", type: "int", nullable: true })
  ad_order_quantity: number;

  @Column({ comment: "展示", type: "int", nullable: true })
  impressions: number;

  @Column({ comment: "店铺id", type: "json", nullable: true })
  sids: any;

  @Column({ comment: "净销售额", type: "double", nullable: true })
  net_amount: number;

  @Column({ comment: "页面所对应的缩略图地址,取自销量最高的msku的缩略图", length: 1000, nullable: true })
  small_image_url: string;

  @Column({ comment: "币种编码", length: 255, nullable: true })
  currency_code: string;

  @Column({ comment: "排名更新时间【已废弃】", length: 255, nullable: true })
  ranking_update_time: string;

  @Column({ comment: "平均销量", type: "double", nullable: true })
  avg_volume: number;

  @Column({ comment: "销售均价", type: "double", nullable: true })
  avg_custom_price: number;

  @Column({ comment: "运营日志数量，用于前端判断是否存在运营日志数据", type: "int", nullable: true })
  icon_num: number;

  @Column({ comment: "sku【sku维度才有值】", length: 255, nullable: true })
  sku: string;

  @Column({ comment: "品名，【sku维度才有值】", length: 1000, nullable: true })
  local_name: string;

  @Column({ comment: "spu数据", type: "json", nullable: true })
  spu_spu_names: any;

  @Column({ comment: "属性，注意内部属性与属性值的分隔符是\"\\001：\\001\"，存在特殊隐藏字符", type: "json", nullable: true })
  attributes: any;

  @Column({ comment: "采购成本，sku维度特有", type: "double", nullable: true })
  cg_price: number;

  @Column({ comment: "可用货值，sku维度特有", type: "double", nullable: true })
  whs_value: number;

  @Column({ comment: "采购成本，可用货值的币种符号", length: 255, nullable: true })
  cg_price_currency_icon: string;

  @Column({ comment: "本地可用，sku维度特有", type: "int", nullable: true })
  local_quantity: number;

  @Column({ comment: "海外仓可用，sku维度特有", type: "int", nullable: true })
  oversea_quantity: number;

  @Column({ comment: "存销比，sku维度特有", type: "double", nullable: true })
  inventory_sales_ratio: number;

  @Column({ comment: "平均售价，sku维度特有", type: "double", nullable: true })
  avg_landed_price: number;

  @Column({ comment: "供应商，sku维度特有", type: "json", nullable: true })
  suppliers: any;

  @Column({ comment: "型号，sku维度特有", type: "json", nullable: true })
  model: any;

  @Column({ comment: "退款金额", type: "double", nullable: true })
  return_amount: number;

  @Column({ comment: "FBM买家运费", type: "double", nullable: true })
  fbm_buyer_expenses: number;

  @Column({ comment: "积分收入", type: "int", nullable: true })
  points_number: number;

  @Column({ comment: "product创建时间，sku维度特有", length: 255, nullable: true })
  product_create_time: string;

  @Column({ comment: "直接成交销售额", type: "double", nullable: true })
  ad_direct_sales_amount: number;

  @Column({ comment: "直接成交订单量", type: "int", nullable: true })
  ad_direct_order_quantity: number;

  @Column({ comment: "大类排名分类", length: 1000, nullable: true })
  rank_category: string;

  @Column({ comment: "可用库存数据", type: "json", nullable: true })
  available_inventory: any;

  @Column({ comment: "Listing标签信息", type: "json", nullable: true })
  tag_set: any;

  @Column({ comment: "??JSON??", type: "json", nullable: true })
  raw_data: any;
}
