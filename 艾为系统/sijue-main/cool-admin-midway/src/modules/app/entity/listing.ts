import {BaseEntity} from '@cool-midway/core';
import {Entity, Column, Index} from 'typeorm';
import {CompetitorSpiderResult} from "../interface/competitor-spider-result";
import {KeywordSearchVolumeData} from "../interface/keyword-search-volume-data";
import {CompetitorHistory} from "../interface/competitor-history";
import {DailyOrderQuantityHistory} from "../interface/daily-order-quantity-history";

@Entity('app_amz_listing')
export class AppAmzListingEntity extends BaseEntity {
  @Column({comment: '亚马逊定义的 listing 的 id【可能为空】', nullable: true})
  listing_id: string;

  @Index()
  @Column({comment: '领星 ERP 店铺 id', nullable: true})
  sid: number;

  @Column({comment: '国家', nullable: true})
  marketplace: string;

  @Index()
  @Column({comment: 'MSKU', nullable: true})
  seller_sku: string;

  @Column({comment: 'FNSKU', nullable: true})
  fnsku: string;

  @Index()
  @Column({comment: 'ASIN', nullable: true})
  asin: string;

  @Column({comment: '父 ASIN', nullable: true})
  parent_asin: string;

  @Column({comment: '商品缩略图地址', nullable: true})
  small_image_url: string;

  @Column({comment: '状态 0-停售 1-在售', nullable: true})
  status: number;

  @Column({comment: '是否删除 0-否 1-是', nullable: true})
  is_delete: number;

  @Column({comment: '标题', nullable: true})
  item_name: string;

  @Column({comment: '本地产品 SKU', nullable: true})
  local_sku: string;

  @Column({comment: '品名', nullable: true})
  local_name: string;

  @Column({comment: '币种', nullable: true})
  currency_code: string;


  @Column({comment: '价格【不含促销，运费，积分】', nullable: true})
  price: string;

  @Column({comment: '总价【含促销、运费、积分】', nullable: true})
  landed_price: string;

  @Column({comment: '优惠价', nullable: true})
  listing_price: string;

  @Column({comment: '运费', nullable: true})
  shipping: string;

  @Column({comment: '积分（日本站才有）', nullable: true})
  ponumbers: string;

  @Column({comment: 'FBM 库存', nullable: true})
  quantity: number;

  @Column({comment: 'FBA 可售', nullable: true})
  afn_fulfillable_quantity: number;

  @Column({comment: 'FBA 不可售', nullable: true})
  afn_unsellable_quantity: number;

  @Column({comment: '待调仓', nullable: true})
  reserved_fc_transfers: number;

  @Column({comment: '调仓中', nullable: true})
  reserved_fc_processing: number;

  @Column({comment: '待发货', nullable: true})
  reserved_customerorders: number;

  @Column({comment: '在途', nullable: true})
  afn_inbound_shipped_quantity: number;

  @Column({comment: '计划入库', nullable: true})
  afn_inbound_working_quantity: number;

  @Column({comment: '入库中', nullable: true})
  afn_inbound_receiving_quantity: number;

  @Column({comment: '商品创建时间', nullable: true})
  open_date: string;

  @Column({comment: '商品创建时间，格式：Y-m-d H:i:s + 时区', nullable: true})
  open_date_display: string;

  @Column({comment: '排名', nullable: true})
  seller_rank: number;

  @Column({comment: '排名所属的类别', nullable: true})
  seller_category: string;

  @Column({comment: '评论条数', nullable: true})
  review_num: number;

  @Column({comment: '星级评分', nullable: true})
  last_star: string;

  @Column({comment: '配送方式', nullable: true})
  fulfillment_channel_type: string;


  @Column({comment: '历史日单量数据', type: 'json', nullable: true})
  daily_order_quantity_history: Array<DailyOrderQuantityHistory>;

  @Column({comment: '检测到价格变动的时间', type: 'datetime', nullable: true})
  landed_price_updateTime: Date;

  @Column({comment: '日均单量状态 0-待计算 1-有效', default: 1, type: 'tinyint'})
  daily_order_quantity_status: number;

  @Column({comment: '实际日均单量', type: 'double', nullable: true})
  daily_order_quantity: number;

  @Column({comment: 'FBA 3-6 个月库龄数量', type: 'int', nullable: true, default: null})
  inv_age_91_to_180_days: number;


  @Column({comment: '竞品调研状态 0-待调研 1-调研中 2-已调研', default: 0, type: 'tinyint'})
  competitor_spider_status: number;

  @Column({comment: '竞品爬虫结果', type: 'json', nullable: true})
  competitor_spider_res: Array<CompetitorSpiderResult>;

  @Column({comment: '竞品爬虫的最近一次执行时间', type: 'datetime', nullable: true})
  competitor_spider_time: Date;

  @Column({comment: '竞品数量历史', type: 'json', nullable: true})
  competitor_amount_history: Array<CompetitorHistory>;

  @Column({comment: '竞品数量历史统计时间', type: 'datetime', nullable: true})
  competitor_amount_history_updateTime: Date;


  @Column({comment: '关键词搜索量数据的查询时间', type: 'datetime', nullable: true})
  kw_search_volume_update_time: Date;

  @Column({comment: '关键词搜索量分析状态 0-未查询 1-待分析 2-已分析', default: 0, type: 'tinyint'})
  kw_search_volume_status: number;

  @Column({comment: '关键词搜索量分析结果', type: 'json', nullable: true})
  kw_search_volume_anal_res: Array<KeywordSearchVolumeData>;


  @Column({comment: '调价策略标签', type: 'json', nullable: true, default: null})
  tags: string[];

  @Column({comment: '是否开启补货策略 0-否 1-是', nullable: false, default: 0})
  tactic_inventory_active: number;


  @Column({comment: '补货策略-最小可售天数（触发阈值）', type: 'int', nullable: true, default: 60})
  tactic_inventory_min_salable_days: number;


  @Column({comment: '新品调价策略-新品上架日期', type: 'datetime', nullable: true, default: null})
  tactic_new_product_date: Date;

  @Column({comment: '新品调价策略-新品预期日单量', type: 'double', nullable: true, default: null})
  tactic_new_product_expected_daily_order_quantity: number;

  @Column({comment: '新品调价策略-单量预警阈值', type: 'double', nullable: true, default: 20})
  tactic_new_product_price_alert_threshold: number;

  @Column({comment: '新品调价策略-调价幅度', type: 'double', nullable: true, default: 5})
  tactic_new_price_modify_range: number;

  @Column({comment: '新品调价策略-调价数值', type: 'double', nullable: true})
  tactic_new_price_modify_value: number;


  @Column({comment: '竞品调价策略-涨价触发幅度', type: 'double', nullable: true, default: 15})
  tactic_competitor_price_up_threshold: number;

  @Column({comment: '竞品调价策略-降价触发幅度', type: 'double', nullable: true, default: 15})
  tactic_competitor_price_down_threshold: number;


  @Column({comment: '清仓调价策略-清仓预期日单量（已弃用）', type: 'double', nullable: true, default: null})
  tactic_clearance_expected_daily_order_quantity: number;

  @Column({comment: '清仓调价策略-成本价（已弃用）', type: 'double', nullable: true, default: null})
  tactic_clearance_cost_price: number;

  @Column({comment: '清仓调价策略-调价幅度', type: 'double', nullable: true, default: 5})
  tactic_clearance_price_modify_range: number;

  @Column({comment: '清仓调价策略-调价数值', type: 'double', nullable: true})
  tactic_clearance_price_modify_value: number;

  @Column({comment: '清仓调价策略-调价上限', type: 'double', nullable: true})
  tactic_clearance_price_modify_upper_limit: number;

  @Column({comment: '清仓调价策略-调价下限', type: 'double', nullable: true})
  tactic_clearance_price_modify_lower_limit: number;

  @Column({comment: '清仓调价策略-09 时之前的预期最大日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_max_before_9: number;

  @Column({comment: '清仓调价策略-09 时之前的预期最小日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_min_before_9: number;

  @Column({comment: '清仓调价策略-12 时之前的预期最大日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_max_before_12: number;

  @Column({comment: '清仓调价策略-12 时之前的预期最小日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_min_before_12: number;

  @Column({comment: '清仓调价策略-15 时之前的预期最大日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_max_before_15: number;

  @Column({comment: '清仓调价策略-15 时之前的预期最小日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_min_before_15: number;

  @Column({comment: '清仓调价策略-18 时之前的预期最大日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_max_before_18: number;

  @Column({comment: '清仓调价策略-18 时之前的预期最小日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_min_before_18: number;

  @Column({comment: '清仓调价策略-21 时之前的预期最大日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_max_before_21: number;

  @Column({comment: '清仓调价策略-21 时之前的预期最小日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_min_before_21: number;

  @Column({comment: '清仓调价策略-24 时之前的预期最大日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_max_before_24: number;

  @Column({comment: '清仓调价策略-24 时之前的预期最小日单量', type: 'int', nullable: true})
  tactic_clearance_expected_order_min_before_24: number;

  @Column({comment: '日常调价策略-目标库存天数（已废弃）', type: 'int', nullable: true, default: 90})
  tactic_normal_target_inventory_days: number;

  @Column({comment: '日常调价策略-目标库存最小天数', type: 'int', nullable: true, default: 30})
  tactic_normal_target_inventory_days_min: number;

  @Column({comment: '日常调价策略-目标库存最大天数', type: 'int', nullable: true, default: 90})
  tactic_normal_target_inventory_days_max: number;

  @Column({comment: '日常调价策略-目标日均出单', type: 'double', nullable: true, default: null})
  tactic_normal_target_daily_order_quantity: number;

  @Column({comment: '日常调价策略-日均出单触发阈值', type: 'double', nullable: true, default: 10})
  tactic_normal_target_daily_order_quantity_alert_threshold: number;

  @Column({comment: '日常调价策略-搜索量突变预警阈值', type: 'double', nullable: true, default: 50})
  tactic_normal_sharp_change_alert_threshold: number;

  @Column({comment: '日常调价策略-调价幅度', type: 'double', nullable: true, default: 5})
  tactic_normal_price_modify_range: number;

  @Column({comment: '日常调价策略-调价数值', type: 'double', nullable: true})
  tactic_normal_price_modify_value: number;


  @Column({comment: '调价策略：新的建议价格', type: 'double', nullable: true})
  tactic_price_suggested_new_price: number;

  @Column({comment: '补货策略：计划采购数量', type: 'int', nullable: true, default: 0})
  tactic_inventory_new_quantity_plan: number;

  @Column({comment: '不再提醒调价的日期', type: 'datetime', nullable: true, default: null})
  tactic_price_ignore_until: Date;

  @Column({comment: '不再提醒补货的日期', type: 'datetime', nullable: true, default: null})
  tactic_inventory_ignore_until: Date;

  @Column({comment: '策略执行提示语（调价）', type: 'varchar', nullable: false, default: ''})
  tactic_hint_price: string;

  @Column({comment: '策略执行提示语（补货）', type: 'varchar', nullable: false, default: ''})
  tactic_hint_inventory: string;


  @Column({comment: '是否自定义产品 0-否 1-是', nullable: true, default: 0})
  is_custom_listing: number;

  @Column({comment: '是否停用 0-否 1-是', nullable: true, default: 0})
  is_suspended: number;

  @Column({comment: 'ASIN', nullable: true})
  candidate_id: string;
}
