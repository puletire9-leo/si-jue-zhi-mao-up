import { BaseEntity } from '@cool-midway/core';
import { Column, Entity } from 'typeorm';

@Entity('app_amz_bsr_price_rule')
export class AppAmzBsrPriceRuleEntity extends BaseEntity {
  @Column({ comment: '是否为新品', length: 50, nullable: true })
  is_new_product: string;

  @Column({ comment: '库存状态', length: 50, nullable: true })
  inventory_status: string;

  @Column({ comment: '销量标签', length: 50, nullable: true })
  sales_label: string;

  @Column({ comment: '关键词得分', length: 50, nullable: true })
  keyword_score: string;

  @Column({ comment: '竞品价格', length: 50, nullable: true })
  competitor_price: string;

  @Column({ comment: '我与竞品差值', length: 50, nullable: true })
  competitor_price_diff: string;

  @Column({ comment: 'ACoS', length: 50, nullable: true })
  acos: string;

  @Column({ comment: 'BD推荐', length: 50, nullable: true })
  bd_recommendation: string;

  @Column({ comment: '触发策略', length: 100, nullable: true })
  trigger_strategy: string;

  @Column({ comment: '系统动作', length: 100, nullable: true })
  system_action: string;
}
