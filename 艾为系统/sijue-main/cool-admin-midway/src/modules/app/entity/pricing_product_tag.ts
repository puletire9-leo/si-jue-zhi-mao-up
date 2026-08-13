import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 产品标签/分类表
 * 每个 ASIN+Marketplace 一条记录，由定时任务每日更新
 */
@Entity('app_amz_pricing_product_tag')
@Index(['asin', 'marketplace'], { unique: true })
@Index(['product_type'])
@Index(['marketplace', 'product_type'])
export class AppAmzPricingProductTagEntity extends BaseEntity {
  @Column({ comment: 'ASIN', length: 50, nullable: false })
  asin: string;

  @Column({ comment: '国家/站点', length: 50, nullable: false })
  marketplace: string;

  @Column({ comment: 'MSKU', length: 100, nullable: false })
  msku: string;

  @Column({ comment: '店铺名称', length: 200, nullable: true })
  seller_name: string;

  @Column({ comment: '产品类型', length: 50, nullable: false })
  product_type: string; // 'SEASONAL' | 'HOLIDAY' | 'REGULAR' | 'NEWMARKET'

  @Column({ comment: '首单日期', type: 'datetime', nullable: true })
  first_order_date: Date;

  @Column({ comment: '距首单天数', type: 'int', nullable: true })
  days_since_first_order: number;

  @Column({ comment: '季节拐点日期', type: 'datetime', nullable: true })
  seasonal_inflection_date: Date;

  @Column({ comment: '距拐点天数', type: 'int', nullable: true })
  days_to_inflection: number;

  @Column({ comment: '当前BSR排名', type: 'int', nullable: true })
  bsr_rank: number;

  @Column({ comment: '7天前BSR排名', type: 'int', nullable: true })
  bsr_rank_7days_ago: number;

  @Column({ comment: 'BSR排名变化百分比', type: 'decimal', precision: 10, scale: 2, nullable: true })
  bsr_rank_change_pct: number;

  @Column({ comment: '3日日均单量', type: 'int', nullable: true })
  daily_avg_3day: number;

  @Column({ comment: '7日日均单量', type: 'int', nullable: true })
  daily_avg_7day: number;

  @Column({ comment: '14日日均单量', type: 'int', nullable: true })
  daily_avg_14day: number;

  @Column({ comment: '总库存', type: 'int', nullable: true })
  total_inventory: number;

  @Column({ comment: '可售库存天数', type: 'int', nullable: true })
  total_inventory_days: number;

  @Column({ comment: '实时销量', type: 'int', nullable: true })
  real_time_sales: number;

  @Column({ comment: '上次记录的实时销量', type: 'int', nullable: true })
  last_real_time_sales: number;

  @Column({ comment: '标签更新时间', type: 'datetime', nullable: true })
  last_update_time: Date;

  @Column({ comment: '备注', type: 'text', nullable: true })
  remark: string;
}
