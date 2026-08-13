import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 自动调价任务
 */
@Entity('app_amz_pricing_task')
@Index(['asin', 'marketplace', 'msku', 'seller_name'])
@Index(['status'])
@Index(['trigger_rule_id'])
export class AppAmzPricingTaskEntity extends BaseEntity {
  @Column({ comment: 'ASIN', length: 50, nullable: false })
  asin: string;

  @Column({ comment: '国家/站点', length: 50, nullable: false })
  marketplace: string;

  @Column({ comment: 'MSKU', length: 100, nullable: false })
  msku: string;

  @Column({ comment: '店铺名称', length: 200, nullable: false })
  seller_name: string;

  @Column({ comment: '任务名称', length: 200, nullable: false })
  task_name: string;

  @Column({ comment: '关联触发规则ID', type: 'int', nullable: true })
  trigger_rule_id: number;

  @Column({ comment: '触发规则名称', length: 100, nullable: true })
  trigger_rule_name: string;

  @Column({ comment: '产品类型', length: 50, nullable: true })
  product_type: string; // 'SEASONAL' | 'HOLIDAY' | 'REGULAR' | 'NEWMARKET'

  @Column({ comment: '策略类型', length: 100, nullable: false })
  strategy_type: string; // 'AUTO_10_DAY_PRICE_UP' | 'AUTO_5_DAY_PRICE_UP' | 'AUTO_5_DAY_PRICE_DOWN' | 'AUTO_CLEARANCE_TARGET' | 'AUTO_INVENTORY_CONTROL'

  @Column({ comment: '任务状态', length: 20, nullable: false, default: 'PENDING' })
  status: string; // 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'PENDING_APPROVAL'

  @Column({ comment: '开始日期', type: 'datetime', nullable: true })
  start_date: Date;

  @Column({ comment: '结束日期', type: 'datetime', nullable: true })
  end_date: Date;

  @Column({ comment: '当前执行天数', type: 'int', nullable: false, default: 0 })
  current_day: number;

  @Column({ comment: '总执行天数', type: 'int', nullable: false, default: 0 })
  total_days: number;

  @Column({ comment: '初始价格', type: 'decimal', precision: 10, scale: 2, nullable: true })
  initial_price: number;

  @Column({ comment: '当前价格', type: 'decimal', precision: 10, scale: 2, nullable: true })
  current_price: number;

  @Column({ comment: 'BD价', type: 'decimal', precision: 10, scale: 2, nullable: true })
  bd_price: number;

  @Column({ comment: '平本价', type: 'decimal', precision: 10, scale: 2, nullable: true })
  break_even_price: number;

  @Column({ comment: '清仓价', type: 'decimal', precision: 10, scale: 2, nullable: true })
  clearance_price: number;

  @Column({ comment: '策略配置', type: 'json', nullable: true })
  strategy_config: {
    base_daily_order?: number;
    target_order?: number;
    base_conversion_rate?: number;
    price_up_value?: number;
    price_down_value?: number;
    price_modify_range?: number;
    target_inventory_days?: number;
    clearance_target_date?: Date;
    conversion_rate_decline_threshold?: number;
    conversion_rate_increase_threshold?: number;
    order_quantity_threshold_high?: number;
    order_quantity_threshold_low?: number;
    enable_safety_check?: boolean;
    notify_operator?: boolean;
    max_loop_count?: number;
  };

  @Column({ comment: '执行统计', type: 'json', nullable: true })
  execution_stats: {
    total_price_up_count: number;
    total_price_down_count: number;
    total_no_action_count: number;
    total_notification_count: number;
    total_approval_count: number;
  };

  @Column({ comment: '最后执行时间', type: 'datetime', nullable: true })
  last_execution_time: Date;

  @Column({ comment: '下次执行时间', type: 'datetime', nullable: true })
  next_execution_time: Date;

  @Column({ comment: '任务备注', type: 'text', nullable: true })
  remark: string;

  @Column({ comment: '创建人', length: 100, nullable: true })
  created_by: string;

  @Column({ comment: '更新人', length: 100, nullable: true })
  updated_by: string;
}
