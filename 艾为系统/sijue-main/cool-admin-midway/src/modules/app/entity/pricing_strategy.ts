import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 自动调价策略配置
 */
@Entity('app_amz_pricing_strategy')
@Index(['strategy_name'], { unique: true })
export class AppAmzPricingStrategyEntity extends BaseEntity {
  @Column({ comment: '策略名称', length: 200, nullable: false })
  strategy_name: string;

  @Column({ comment: '策略类型', length: 100, nullable: false })
  strategy_type: string; // 'AUTO_10_DAY_PRICE_UP' | 'AUTO_5_DAY_PRICE_UP' | 'AUTO_5_DAY_PRICE_DOWN' | 'AUTO_CLEARANCE_TARGET' | 'AUTO_INVENTORY_CONTROL'

  @Column({ comment: '执行天数', type: 'int', nullable: false, default: 5 })
  total_days: number;

  @Column({ comment: '是否启用', type: 'int', nullable: false, default: 1 })
  is_active: number;

  @Column({ comment: '基础配置', type: 'json', nullable: true })
  base_config: {
    base_daily_order?: number;
    target_order?: number;
    base_conversion_rate?: number;
    target_inventory_days?: number;
    clearance_target_date?: Date;
  };

  @Column({ comment: '每日执行动作', type: 'json', nullable: true })
  daily_actions: Array<{
    day: number;
    action: 'PRICE_UP' | 'PRICE_DOWN' | 'NO_ACTION' | 'REVIEW' | 'LOOP_CHECK';
    value: number;
    condition_check?: {
      check_type: 'CONVERSION_RATE' | 'DAILY_AVG_VS_TARGET' | 'INVENTORY_DAYS' | 'HAS_SALES';
      compare_days: number[];            // 汇总哪些天 [1, 2]
      base: string;                      // 'FIRST_15_DAYS' | 'TARGET_ORDER' | 'TARGET_INVENTORY_DAYS'
      threshold_pct_up: number;
      threshold_pct_down: number;
      action_if_above: 'PRICE_UP' | 'PRICE_DOWN' | 'NO_ACTION';
      action_if_below: 'PRICE_UP' | 'PRICE_DOWN' | 'NO_ACTION';
    };
  }>;

  @Column({ comment: '安全检查配置', type: 'json', nullable: true })
  safety_config: {
    enable_safety_check?: boolean;
    notify_operator?: boolean;
    max_loop_count?: number;
    not_below_initial_price?: boolean;
  };

  @Column({ comment: '策略描述', type: 'text', nullable: true })
  description: string;

  @Column({ comment: '备注', type: 'text', nullable: true })
  remark: string;
}
