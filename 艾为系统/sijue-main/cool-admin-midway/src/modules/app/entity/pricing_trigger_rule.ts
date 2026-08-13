import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 调价触发规则配置
 * 产品满足条件后匹配到对应策略
 */
@Entity('app_amz_pricing_trigger_rule')
@Index(['rule_name'], { unique: true })
export class AppAmzPricingTriggerRuleEntity extends BaseEntity {
  @Column({ comment: '规则名称', length: 100, nullable: false })
  rule_name: string;

  @Column({ comment: '国家/站点', length: 50, nullable: true })
  marketplace: string; // '英国' | '德国' | null(全部)

  @Column({ comment: '优先级', type: 'int', nullable: false, default: 0 })
  priority: number;

  @Column({ comment: '是否启用', type: 'int', nullable: false, default: 1 })
  is_active: number;

  @Column({ comment: '触发条件配置', type: 'json', nullable: true })
  condition_config: {
    // 产品范围
    product_types?: string[];            // ['SEASONAL', 'HOLIDAY', 'REGULAR', 'NEWMARKET']
    days_since_first_order_min?: number; // 首单最小天数

    // BSR条件
    bsr?: {
      enabled: boolean;
      compare_days: number;              // 对比天数
      change_threshold_pct: number;      // 涨幅阈值(%)
      direction: 'UP' | 'DOWN';
    };

    // 销量条件
    sales?: {
      enabled: boolean;
      daily_avg_3day_min?: number;       // 3日日均最小值
      daily_avg_14day_not_zero?: boolean;
    };

    // 库存条件
    inventory?: {
      enabled: boolean;
      max_inventory_days?: number;        // 最大库存天数
      compare_with_inflection?: boolean;  // 季节品与拐点比较
    };

    // 特殊条件
    special?: {
      no_sales_14days?: boolean;         // 14天无销量
      seasonal_after_inflection?: boolean; // 季节品在拐点之后
      inventory_days_gt_90?: boolean;    // 库存天数>90
    };
  };

  @Column({ comment: '匹配的调价策略', length: 100, nullable: false })
  matched_strategy: string; // 'AUTO_10_DAY_PRICE_UP' | 'AUTO_5_DAY_PRICE_UP' | 'AUTO_5_DAY_PRICE_DOWN' | 'AUTO_CLEARANCE_TARGET' | 'AUTO_INVENTORY_CONTROL'

  @Column({ comment: '目标单量取值', length: 50, nullable: true })
  target_order_source: string; // 'TRIGGER_TIME_3DAY_AVG' | 'MANUAL' | '-'

  @Column({ comment: '规则描述', type: 'text', nullable: true })
  description: string;

  @Column({ comment: '备注', type: 'text', nullable: true })
  remark: string;
}
