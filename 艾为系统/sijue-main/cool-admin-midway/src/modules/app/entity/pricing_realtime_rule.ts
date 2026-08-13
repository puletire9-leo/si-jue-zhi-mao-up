import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 实时监控规则表
 * 始终运行的规则：定时检查实时销量，触发后调价
 */
@Entity('app_amz_pricing_realtime_rule')
@Index(['rule_name'], { unique: true })
export class AppAmzPricingRealtimeRuleEntity extends BaseEntity {
  @Column({ comment: '规则名称', length: 100, nullable: false })
  rule_name: string;

  @Column({ comment: '触发时间', length: 10, nullable: false })
  trigger_time: string; // '12:00' | '18:00' 等, 按服务器时区由 cron 定时调用

  @Column({ comment: '国家/站点', length: 50, nullable: true })
  marketplace: string; // '英国' | '德国'

  @Column({ comment: '条件类型', length: 50, nullable: false, default: 'TIME_BASED_CHECK' })
  condition_type: string; // 'TIME_BASED_CHECK' | 'SURGE_DETECTION'

  @Column({ comment: '阈值倍数', type: 'decimal', precision: 5, scale: 1, nullable: false, default: 2.0 })
  threshold_value: number; // 实时销量/日均 > 此值则触发, 默认2倍

  @Column({ comment: '调价方向', length: 10, nullable: false, default: 'PRICE_UP' })
  price_action: string; // 'PRICE_UP' | 'PRICE_DOWN'

  @Column({ comment: '调价数值(当地币)', type: 'decimal', precision: 10, scale: 2, nullable: false, default: 1.0 })
  price_value: number;

  @Column({ comment: '是否启用', type: 'int', nullable: false, default: 1 })
  is_active: number;

  @Column({ comment: '优先级', type: 'int', nullable: false, default: 0 })
  priority: number;

  @Column({ comment: '高级条件配置', type: 'json', nullable: true })
  condition_config?: {
    daily_avg_threshold?: number;
    no_sales_days?: number;
    compare_field?: string;
  };

  @Column({ comment: '高级动作配置', type: 'json', nullable: true })
  action_config?: {
    record_current_sales?: boolean;
  };

  @Column({ comment: '规则描述', type: 'text', nullable: true })
  description: string;

  @Column({ comment: '备注', type: 'text', nullable: true })
  remark: string;
}
