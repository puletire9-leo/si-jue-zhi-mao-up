import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AppAmzBsrRestockingCenterLingxingEntity } from './bsr_restocking_center_lingxing';
import { KeywordSearchVolumeData } from "../interface/keyword-search-volume-data";

export enum NewProductStatus {
  NONE = 0, // 无新品相关状态
  IN_TRANSIT = 1, // 新品在途
  ARRIVED_NO_SALES = 2, // 新品到货无销量
  ARRIVED_OVER_7_DAYS_NO_SALES = 3, // 到货超过7天无销量
  ARRIVED_OVER_14_DAYS_NO_SALES = 4, // 到货超过14天无销量
  ARRIVED_OVER_30_DAYS_NO_SALES = 5, // 到货超过30天无销量
}

/**
 * 类目流量状态枚举
 */
export enum CategoryTrafficStatus {
  NONE = 0, // 无变化
  DOWN = 1, // 类目流量降低
  UP = 2, // 类目流量增长
}

/**
 * 产品流量状态枚举
 */
export enum ProductTrafficStatus {
  NONE = 0, // 无变化
  DOWN = 1, // 产品流量降低
  UP = 2, // 产品流量增长
}
/**
 * 领星Listing产品数据
 */
@Entity('app_amz_bsr_product_listing_lingxing')
export class AppAmzBsrProductListingLingxingEntity extends BaseEntity {
  /**
   * FBA可售数量
   */
  @Column({ comment: 'FBA可售数量', default: 0 })
  afn_fulfillable_quantity: number;

  /**
   * FBA入库接收中数量
   */
  @Column({ comment: 'FBA入库接收中数量', default: 0 })
  afn_inbound_receiving_quantity: number;

  /**
   * FBA入库已发货数量
   */
  @Column({ comment: 'FBA入库已发货数量', default: 0 })
  afn_inbound_shipped_quantity: number;

  /**
   * FBA入库处理中数量
   */
  @Column({ comment: 'FBA入库处理中数量', default: 0 })
  afn_inbound_working_quantity: number;

  /**
   * FBA不可售数量
   */
  @Column({ comment: 'FBA不可售数量', default: 0 })
  afn_unsellable_quantity: number;

  /**
   * 亚马逊产品ID
   */
  @Column({ comment: '亚马逊产品ID', length: 50, nullable: true })
  amz_product_id: string;

  /**
   * 亚马逊产品ID类型
   */
  @Column({ comment: '亚马逊产品ID类型', length: 20, nullable: true })
  amz_product_id_type: string;

  /**
   * 亚马逊产品ID类型文本
   */
  @Column({ comment: '亚马逊产品ID类型文本', length: 50, nullable: true })
  amz_product_id_type_text: string;

  /**
   * 亚马逊产品类型
   */
  @Column({ comment: '亚马逊产品类型', length: 100, nullable: true })
  amz_product_type: string;

  /**
   * ASIN
   */
  @Column({ comment: 'ASIN', length: 50, nullable: true })
  asin: string;

  /**
   * ASIN链接
   */
  @Column({ comment: 'ASIN链接', nullable: true })
  asin_url: string;

  /**
   * 14天平均销量
   */
  @Column({ comment: '14天平均销量', type: 'double', nullable: true })
  average_fourteen_volume: number;

  /**
   * 7天平均销量
   */
  @Column({ comment: '7天平均销量', type: 'double', nullable: true })
  average_seven_volume: number;

  /**
   * 30天平均销量
   */
  @Column({ comment: '30天平均销量', type: 'double', nullable: true })
  average_thirty_volume: number;

  /**
   * B2B价格
   */
  @Column({ comment: 'B2B价格', length: 50, nullable: true })
  b2b_price: string;

  /**
   * 品牌ID
   */
  @Column({ comment: '品牌ID', default: 0 })
  brand_id: number;

  /**
   * 类目ID
   */
  @Column({ comment: '类目ID', default: 0 })
  category_id: number;

  /**
   * 类目文本
   */
  @Column({ comment: '类目文本', length: 200, nullable: true })
  category_text: string;

  /**
   * 货币符号
   */
  @Column({ comment: '货币符号', length: 10, nullable: true })
  currency_symbol: string;

  /**
   * FBA费用
   */
  @Column({ comment: 'FBA费用', type: 'double',  nullable: true })
  fba_fee: number;

  /**
   * FBA费用货币编码
   */
  @Column({ comment: 'FBA费用货币编码', length: 20, nullable: true })
  fba_fee_currency_code: string;

  /**
   * FBA费用货币图标
   */
  @Column({ comment: 'FBA费用货币图标', length: 10, nullable: true })
  fba_fee_currency_icon: string;

  /**
   * 首单时间
   */
  @Column({ comment: '首单时间', type: 'date', nullable: true })
  first_order_time: Date;

  /**
   * FNSKU
   */
  @Column({ comment: 'FNSKU', length: 50, nullable: true })
  fnsku: string;

  /**
   * 14天销售额
   */
  @Column({ comment: '14天销售额', type: 'double',  nullable: true })
  fourteen_amount: number;

  /**
   * 14天广告费
   */
  @Column({ comment: '14天广告费', type: 'double',  nullable: true })
  fourteen_spend: number;

  /**
   * 14天销量
   */
  @Column({ comment: '14天销量', default: 0 })
  fourteen_volume: number;

  /**
   * 配送渠道类型
   */
  @Column({ comment: '配送渠道类型', length: 20, nullable: true })
  fulfillment_channel_type: string;

  /**
   * 货币图标
   */
  @Column({ comment: '货币图标', length: 10, nullable: true })
  icon: string;

  /**
   * 领星产品ID
   */
  @Column({ comment: '领星产品ID', type: 'bigint', nullable: true })
  lingxing_id: number;

  /**
   * ID哈希值
   */
  @Column({ comment: 'ID哈希值', length: 100, nullable: true })
  id_hash: string;

  /**
   * 是否删除
   */
  @Column({ comment: '是否删除', length: 10, nullable: true })
  is_delete: string;

  /**
   * 是否西班牙站点
   */
  @Column({ comment: '是否西班牙站点', type: 'tinyint', default: 0 })
  is_es: number;

  /**
   * 是否配对
   */
  @Column({ comment: '是否配对', type: 'tinyint', default: 0 })
  is_pair: number;

  /**
   * 商品状态
   */
  @Column({ comment: '商品状态', default: 0 })
  item_condition: number;

  /**
   * 商品名称
   */
  @Column({ comment: '商品名称', nullable: true })
  item_name: string;

  /**
   * 落地价
   */
  @Column({ comment: '落地价', type: 'double',  nullable: true })
  landed_price: number;

  /**
   * 落地价货币编码
   */
  @Column({ comment: '落地价货币编码', length: 20, nullable: true })
  landed_price_currency_code: string;

  /**
   * 落地价货币图标
   */
  @Column({ comment: '落地价货币图标', length: 10, nullable: true })
  landed_price_currency_icon: string;

  /**
   * 标价
   */
  @Column({ comment: '标价', type: 'double',  default: 0 })
  list_price: number;

  /**
   * 售价
   */
  @Column({ comment: '售价', type: 'double',  nullable: true })
  listing_price: number;

  // 2026-03-30: 售价保存15天历史
  @Column({ comment: '售价数组（15天）', type: 'json', nullable: true })
  listing_price_history: Array<number | null>;

  /**
   * 售价货币编码
   */
  @Column({ comment: '售价货币编码', length: 20, nullable: true })
  listing_price_currency_code: string;

  /**
   * 售价货币图标
   */
  @Column({ comment: '售价货币图标', length: 10, nullable: true })
  listing_price_currency_icon: string;

  /**
   * 本地名称
   */
  @Column({ comment: '本地名称', length: 200, nullable: true })
  local_name: string;

  /**
   * 本地SKU
   */
  @Index()
  @Column({ comment: '本地SKU', length: 100, nullable: true })
  local_sku: string;

  /**
   * 站点/市场
   */
  @Column({ comment: '站点/市场', length: 50, nullable: true })
  marketplace: string;

  /**
   * 市场ID
   */
  @Column({ comment: '市场ID', length: 50, nullable: true })
  marketplace_id: string;

  /**
   * 店铺mid
   */
  @Column({ comment: '店铺mid', default: 0 })
  mid: number;

  /**
   * MSKU
   */
  @Column({ comment: 'MSKU', length: 100, nullable: true })
  msku: string;

  /**
   * 上架时间
   */
  @Column({ comment: '上架时间', length: 50, nullable: true })
  on_sale_time: string;

  /**
   * 开通日期
   */
  @Column({ comment: '开通日期', length: 50, nullable: true })
  open_date: string;

  /**
   * 开通日期时间
   */
  @Column({ comment: '开通日期时间', type: 'datetime', nullable: true })
  open_date_time: Date;

  @Column({ comment: '开售时间2', nullable: true })
  open_date_time2: Date;

  /**
   * 配对类型
   */
  @Column({ comment: '配对类型', length: 50, nullable: true })
  pair_type: string;

  /**
   * 父ASIN
   */
  @Column({ comment: '父ASIN', length: 50, nullable: true })
  parent_asin: string;

  /**
   * 积分
   */
  @Column({ comment: '积分', length: 20, nullable: true })
  points: string;

  /**
   * 价格
   */
  @Column({ comment: '价格', type: 'double',  nullable: true })
  price: number;

  /**
   * 负责人列表
   */
  @Column({ comment: '负责人列表', type: 'json', nullable: true })
  principal_list: any[];

  /**
   * 负责人真实姓名
   */
  @Column({ comment: '负责人真实姓名', length: 100, nullable: true })
  principal_realname: string;

  /**
   * 负责人UID列表
   */
  @Column({ comment: '负责人UID列表', type: 'json', nullable: true })
  principal_uids: number[];

  /**
   * 产品品牌文本
   */
  @Column({ comment: '产品品牌文本', length: 200, nullable: true })
  product_brand_text: string;

  /**
   * 产品ID
   */
  @Column({ comment: '产品ID', default: 0 })
  product_id: number;

  /**
   * 产品关联ID
   */
  @Column({ comment: '产品关联ID', length: 50, nullable: true })
  product_relation_id: string;

  /**
   * 产品类型
   */
  @Column({ comment: '产品类型', type: 'tinyint', default: 0 })
  product_type: number;

  /**
   * 库存数量
   */
  @Column({ comment: '库存数量', type: 'double',  nullable: true })
  quantity: number;

  /**
   * 排名
   */
  @Column({ comment: '大类排名数组（15天）', type: 'json' })
  rank: number[];

  /**
   * 推荐费
   */
  @Column({ comment: '推荐费', type: 'double',  nullable: true })
  referral_fee: number;

  /**
   * 推荐费货币编码
   */
  @Column({ comment: '推荐费货币编码', length: 20, nullable: true })
  referral_fee_currency_code: string;

  /**
   * 推荐费货币图标
   */
  @Column({ comment: '推荐费货币图标', length: 10, nullable: true })
  referral_fee_currency_icon: string;

  /**
   * 常规价格
   */
  @Column({ comment: '常规价格', type: 'double',  nullable: true })
  regular_price: number;

  /**
   * 常规价格货币编码
   */
  @Column({ comment: '常规价格货币编码', length: 20, nullable: true })
  regular_price_currency_code: string;

  /**
   * 常规价格货币图标
   */
  @Column({ comment: '常规价格货币图标', length: 10, nullable: true })
  regular_price_currency_icon: string;

  /**
   * 备注
   */
  @Column({ comment: '备注', nullable: true })
  remark: string;

  /**
   * 预留-客户订单
   */
  @Column({ comment: '预留-客户订单', default: 0 })
  reserved_customerorders: number;

  /**
   * 预留-FC处理中
   */
  @Column({ comment: '预留-FC处理中', default: 0 })
  reserved_fc_processing: number;

  /**
   * 预留-FC转移中
   */
  @Column({ comment: '预留-FC转移中', default: 0 })
  reserved_fc_transfers: number;

  /**
   * 评论数
   */
  // 2026-03-17 评分和Rating总数保存15天的数据
  @Column({ comment: '评论数数组（15天）', type: 'json', nullable: true })
  reviews_num: number[];

  /**
   * 规则唯一ID
   */
  @Column({ comment: '规则唯一ID', length: 50, nullable: true })
  rule_unique_id: string;

  /**
   * 卖家品牌
   */
  @Column({ comment: '卖家品牌', length: 100, nullable: true })
  seller_brand: string;

  /**
   * 卖家类目
   */
  @Column({ comment: '卖家类目', type: 'json', nullable: true })
  seller_category: string[];

  /**
   * 卖家名称
   */
  @Column({ comment: '卖家名称', length: 100, nullable: true })
  seller_name: string;

  /**
   * 卖家排名
   */
  @Column({ comment: '卖家排名', default: 0 })
  seller_rank: number;

  /**
   * 7天销售额
   */
  @Column({ comment: '7天销售额', type: 'double',  nullable: true })
  seven_amount: number;

  /**
   * 7天广告费
   */
  @Column({ comment: '7天广告费', type: 'double',  nullable: true })
  seven_spend: number;

  /**
   * 运费
   */
  @Column({ comment: '运费', type: 'double',  nullable: true })
  shipping: number;

  /**
   * 运费货币编码
   */
  @Column({ comment: '运费货币编码', length: 20, nullable: true })
  shipping_currency_code: string;

  /**
   * 运费货币图标
   */
  @Column({ comment: '运费货币图标', length: 10, nullable: true })
  shipping_currency_icon: string;

  /**
   * 店铺名称
   */
  @Column({ comment: '店铺名称', length: 200, nullable: true })
  shop: string;

  /**
   * 主图链接
   */
  @Column({ comment: '主图链接', nullable: true })
  image_url: string;

  /**
   * 小排名
   */
  @Column({ comment: '小排名数组（15天）', type: 'json' })
  small_rank: number[];

  /**
   * 评分星级
   */
  // 2026-03-17 评分和Rating总数保存15天的数据
  @Column({ comment: '评分星级数组（15天）', type: 'json', nullable: true })
  stars: number[];

  /**
   * 状态码
   */
  @Column({ comment: '状态码', type: 'tinyint', default: 0 })
  status: number;

  /**
   * 状态文本
   */
  @Column({ comment: '状态文本', length: 50, nullable: true })
  status_text: string;

  /**
   * 店铺ID
   */
  @Column({ comment: '店铺ID', default: 0 })
  store_id: number;

  /**
   * 店铺类型
   */
  @Column({ comment: '店铺类型', length: 20, nullable: true })
  store_type: string;

  /**
   * 30天销售额
   */
  @Column({ comment: '30天销售额', type: 'double',  nullable: true })
  thirty_amount: number;

  /**
   * 30天广告费
   */
  @Column({ comment: '30天广告费', type: 'double',  nullable: true })
  thirty_spend: number;

  /**
   * 30天销量
   */
  @Column({ comment: '30天销量', default: 0 })
  thirty_volume: number;

  /**
   * 总销量
   */
  @Column({ comment: '总销量', default: 0 })
  total_volume: number;

  /**
   * 变体
   */
  @Column({ comment: '变体', length: 200, nullable: true })
  variant: string;

  /**
   * 变体文本
   */
  @Column({ comment: '变体文本', type: 'json', nullable: true })
  variant_text: any[];

  /**
   * 昨日销售额
   */
  @Column({ comment: '昨日销售额', type: 'double',  nullable: true })
  yesterday_amount: number;

  /**
   * 昨日广告费
   */
  @Column({ comment: '昨日广告费', type: 'double',  nullable: true })
  yesterday_spend: number;

  /**
   * 昨日销量
   */
  @Column({ comment: '昨日销量', default: 0 })
  yesterday_volume: number;

  

  @Column({comment: '合并编号',length: 5, nullable: true})
  mergeId: string;
  @Column({ comment: '产品编码', nullable: true, type: 'varchar', length: 50 })
  product_code: string;
  @Column({ comment: '产品状态', nullable: true, default: 0 })
  product_state: number;
  @Column({ comment: '过滤类型', nullable: true, default: 0 })
  filter_type: number;
  @Column({ comment: '价格(取优惠价和价格两者最低价)', nullable: true, type: 'decimal',  default: 0 })
  price_target: number;
  /**
   * 断货状态 0-正常 1-断货
   */
  @Column({ comment: '断货状态', default: 0 })
  outOfStockStatus: number;
  /**
   * 断货开始时间
   */
  @Column({ comment: '断货开始时间', type: 'datetime', nullable: true })
  outOfStockStartTime: Date;
  /**
   * 上一次总库存
   */
  @Column({ comment: '上一次总库存', default: 0 })
  lastQuantitySum: number;
  /**
   * 异常下架状态 0-正常 1-异常下架
   */
  @Column({ comment: '异常下架状态', default: 0 })
  abnormalOfflineStatus: number;

  /**
   * 异常下架开始时间
   */
  @Column({ comment: '异常下架开始时间', type: 'datetime', nullable: true })
  abnormalOfflineStartTime: Date;

  /**
   * 异常下架恢复时间
   */
  @Column({ comment: '异常下架恢复时间', type: 'datetime', nullable: true })
  abnormalOfflineRecoveryTime: Date;

  /**
   * 库存状态文本
   */
  @Column({ comment: '库存状态文本', length: 50, nullable: true })
  inventoryStatusText: string;

  /**
   * 日均销量
   */
  @Column({ comment: '日均销量', type: 'double', nullable: true })
  dailyAvgSales: number;

  /**
   * 可售天数
   */
  @Column({ comment: '可售天数', type: 'double', nullable: true })
  sellableDays: number;

  @ManyToOne(() => AppAmzBsrRestockingCenterLingxingEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'asin', referencedColumnName: 'asin' })
  restocking: AppAmzBsrRestockingCenterLingxingEntity;
  /**
   * 在售天数
   */
  @Column({ comment: '在售天数', default: 0 })
  onSaleDays: number;


  @Column({ comment: '新品状态', type: 'tinyint', default: 0 })
  newProductStatus: NewProductStatus;

  @Column({ comment: '新品在途类型(1:时间1, 2:时间2, 3:双符合)', type: 'tinyint', default: 0 })
  in_transit_type: number;

  /**
   * 是否需要更新运营计划
   * 0-否 1-是
   */
  @Column({ comment: '是否需要更新运营计划', type: 'tinyint', default: 0 })
  needUpdateOperationPlan: number;

  /**
   * 类目流量状态
   * 0-无变化 1-降低 2-增长
   */
  @Column({ comment: '类目流量状态', type: 'tinyint', default: 0 })
  categoryTrafficStatus: CategoryTrafficStatus;

  /**
   * 产品流量状态
   * 0-无变化 1-降低 2-增长
   */
  @Column({ comment: '产品流量状态', type: 'tinyint', default: 0 })
  productTrafficStatus: ProductTrafficStatus;

  /**
   * 销量变化状态
   */
  @Column({ comment: '销量变化状态', length: 50, nullable: true })
  salesChangeStatus: string;

  /**
   * 库存是否超90天
   * 0-否 1-是
   */
  @Column({ comment: '库存是否超90天', type: 'tinyint', default: 0 })
  stockOver90Days: number;
  
  @Column({ comment: '订单毛利率', type: 'double', nullable: true })
  profit_rate: number;

  @Column({ comment: '订单毛利润', type: 'double', nullable: true })
  profit: number;

  @Column({comment: '商品成本', type: 'double', nullable: true})
  tactic_cost_rmb: number;

  @Column({comment: '头程运费', type: 'double', nullable: true})
  tactic_first_leg_rmb: number;

  @Column({comment: '币种(外币)', type: 'varchar', length: 10, nullable: true})
  tactic_exchange_rate: string;

  @Column({comment: '长(cm)', type: 'double', nullable: true})
  tactic_length: number;

  @Column({comment: '宽(cm)', type: 'double', nullable: true})
  tactic_width: number;

  @Column({comment: '高(cm)', type: 'double', nullable: true})
  tactic_height: number;


  // ==========================================
  // 关键词搜索量分析字段 (用于 P4 调价策略)
  // ==========================================

  @Column({comment: '关键词搜索量数据的查询时间', type: 'datetime', nullable: true})
  kw_search_volume_update_time: Date;

  @Column({comment: '关键词搜索量分析状态 0-未查询 1-待分析 2-已分析', default: 0, type: 'tinyint'})
  kw_search_volume_status: number;

  @Column({comment: '关键词搜索量分析结果', type: 'json', nullable: true})
  kw_search_volume_anal_res: Array<KeywordSearchVolumeData>;

  // ==========================================
  // 往期进表规则 (Product Code 级别)
  // ==========================================

  @Column({comment: '往期规则-近30天销量判断', type: 'varchar', nullable: true, default: null})
  rule_nearly_30_days: string; // 'nearly' or null

  @Column({comment: '往期规则-历史月份判断', type: 'varchar', nullable: true, default: null})
  rule_history_month: string; // 'YYYY-MM' or null

  @Column({comment: '补货设置类型 0-正常 1-不再补货 2-未来补货', type: 'tinyint', default: 0})
  restock_setting_type: number;

  @Column({comment: '未来补货日期(在此日期前不显示)', type: 'date', nullable: true})
  future_restock_date: Date;

}

