import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 调价执行历史
 */
@Entity('app_amz_pricing_execution_history')
@Index(['task_id'])
@Index(['asin', 'marketplace'])
@Index(['execution_date'])
export class AppAmzPricingExecutionHistoryEntity extends BaseEntity {
  @Column({ comment: '任务ID', length: 50, nullable: false })
  task_id: string;

  @Column({ comment: 'ASIN', length: 50, nullable: false })
  asin: string;

  @Column({ comment: '国家/站点', length: 50, nullable: false })
  marketplace: string;

  @Column({ comment: 'MSKU', length: 100, nullable: false })
  msku: string;

  @Column({ comment: '店铺名称', length: 200, nullable: false })
  seller_name: string;

  @Column({ comment: '策略类型', length: 100, nullable: true })
  strategy_type: string;

  @Column({ comment: '执行日期', type: 'datetime', nullable: false })
  execution_date: Date;

  @Column({ comment: '执行天数', type: 'int', nullable: false })
  execution_day: number;

  @Column({ comment: '动作类型', length: 20, nullable: false })
  action_type: string; // 'PRICE_UP' | 'PRICE_DOWN' | 'NO_ACTION' | 'PAUSE' | 'COMPLETE'

  @Column({ comment: '原价格', type: 'decimal', precision: 10, scale: 2, nullable: true })
  old_price: number;

  @Column({ comment: '新价格', type: 'decimal', precision: 10, scale: 2, nullable: true })
  new_price: number;

  @Column({ comment: '价格变化幅度', type: 'decimal', precision: 10, scale: 2, nullable: true })
  price_change_amount: number;

  @Column({ comment: '价格变化百分比', type: 'decimal', precision: 5, scale: 2, nullable: true })
  price_change_percentage: number;

  @Column({ comment: '触发原因', type: 'text', nullable: true })
  trigger_reason: string;

  @Column({ comment: '触发条件快照', type: 'json', nullable: true })
  trigger_conditions: {
    daily_order_quantity?: number;
    three_day_avg_order?: number;
    fourteen_day_avg_order?: number;
    order_quantity_vs_target?: string;
    conversion_rate?: number;
    conversion_rate_change?: number;
    conversion_rate_vs_base?: string;
    inventory_days?: number;
    total_inventory?: number;
    inventory_days_vs_target?: string;
    bsr_rank?: number;
    bsr_rank_change?: number;
    bsr_rank_vs_threshold?: string;
    real_time_sales?: number;
    real_time_sales_change?: number;
    real_time_sales_vs_threshold?: string;
  };

  @Column({ comment: '当日单量', type: 'int', nullable: true })
  order_quantity: number;

  @Column({ comment: '当日转化率', type: 'decimal', precision: 5, scale: 4, nullable: true })
  conversion_rate: number;

  @Column({ comment: '当日库存', type: 'int', nullable: true })
  inventory_quantity: number;

  @Column({ comment: '当日库存天数', type: 'int', nullable: true })
  inventory_days: number;

  @Column({ comment: '安全检查结果', type: 'json', nullable: true })
  safety_check_result: {
    is_safe: boolean;
    violation_type?: string;
    requires_operator_approval: boolean;
    suggested_price: number;
    bd_price_check: 'PASS' | 'FAIL';
    break_even_price_check: 'PASS' | 'FAIL';
    clearance_price_check: 'PASS' | 'FAIL';
    initial_price_check: 'PASS' | 'FAIL';
  };

  @Column({ comment: '是否需要人工审批', type: 'int', nullable: false, default: 0 })
  requires_approval: number;

  @Column({ comment: '审批状态', length: 20, nullable: true })
  approval_status: string; // 'PENDING' | 'APPROVED' | 'REJECTED'

  @Column({ comment: '审批人', length: 100, nullable: true })
  approved_by: string;

  @Column({ comment: '审批时间', type: 'datetime', nullable: true })
  approval_time: Date;

  @Column({ comment: '审批意见', type: 'text', nullable: true })
  approval_comment: string;

  @Column({ comment: '执行状态', length: 20, nullable: false, default: 'SUCCESS' })
  execution_status: string; // 'SUCCESS' | 'FAILED' | 'PENDING' | 'CANCELLED'

  @Column({ comment: '执行错误信息', type: 'text', nullable: true })
  error_message: string;

  @Column({ comment: '备注', type: 'text', nullable: true })
  remark: string;
}
