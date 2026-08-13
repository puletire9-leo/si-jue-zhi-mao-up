import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * Listing调价/补货策略数据
 */
@Entity('app_amz_bsr_product_price_strategy')
@Index(['asin', 'marketplace', 'msku', 'seller_name', 'product_code'], { unique: true })
export class AppAmzBsrProductPriceStrategyEntity extends BaseEntity {
  @Column({ comment: 'ASIN', length: 50, nullable: false })
  asin: string;

  @Column({ comment: '国家/站点', length: 50, nullable: false })
  marketplace: string;

  @Column({ comment: 'MSKU', length: 100, nullable: false })
  msku: string;

  @Column({ comment: '店铺名称', length: 200, nullable: false })
  seller_name: string;

  @Column({ comment: '产品编码', nullable: true, type: 'varchar', length: 50 })
  product_code: string;

  // ==========================================
  // 迁移自 AppAmzListingEntity 的调价/补货策略字段
  // ==========================================

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
}
