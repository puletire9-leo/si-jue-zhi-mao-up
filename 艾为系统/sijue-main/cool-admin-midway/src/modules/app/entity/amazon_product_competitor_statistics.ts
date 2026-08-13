import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('amazon_product_competitor_statistics')
@Index('task_crawler_time', ['task_id', 'crawler_time'], { unique: true })
export class AmazonProductCompetitorStatisticsEntity extends BaseEntity {
  @PrimaryGeneratedColumn({
    type: 'bigint', 
    unsigned: true,
    comment: '编号'
  })
  id: number;

  @Column({ comment: '近30天unit(根据产品去重Parent汇总)', nullable: true, type: 'int' })
  units_30_sum: number;

  @Column({ comment: '竞品数量', nullable: true, type: 'int' })
  competitor_count: number;

  @Column({ comment: '销量前15的销量，只填5个销量', nullable: true, type: 'varchar', length: 255 })
  units_top_15: string;

  @Column({ comment: '排名前十的价格，只填6个价格', nullable: true, type: 'varchar', length: 255 })
  price_top_10: string;

  @Column({ comment: '市场最低价', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  price_lowest: number;

  @Column({ comment: '采集时间（yyyyMMdd）', nullable: true, type: 'varchar', length: 10 })
  crawler_time: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  create_time: Date;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  update_time: Date;

  @Column({ comment: '评分前10', nullable: true, type: 'varchar', length: 255 })
  stars_top_10: string;

  @Column({ comment: '最早上架时间', nullable: true, type: 'datetime' })
  available_date_earliest: Date;

  @Column({ nullable: true, type: 'bigint', unsigned: true })
  task_id: number;

  @Column({ nullable: true, type: 'int' })
  inventory_sum: number;

  @Column({ comment: '前十卖家平均评分', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  stars_top_10_avg: number;

  @Column({ comment: 'FBA卖家数量', nullable: true, type: 'int' })
  seller_count_fba: number;

  @Column({ comment: '非FBA卖家数量', nullable: true, type: 'int' })
  seller_count_not_fba: number;

  @Column({ comment: '库存状态', nullable: true, type: 'int', width: 2 })
  inventory_state: number;

  @Column({ comment: '是否有999+', nullable: true, type: 'tinyint' })
  has_m1000: boolean;

  @Column({ comment: '库存汇总(限制类型)', nullable: true, type: 'int' })
  inventory_sum_limit: number;

  @Column({ comment: '库存汇总（除开限制类型，正常和M1000+）', nullable: true, type: 'int' })
  inventory_sum_not_limit: number;

  @Column({ comment: '近30天unit(根据产品去重Parent汇总)(FBA)', nullable: true, type: 'int' })
  units_30_sum_fba: number;

  @Column({ comment: '近30天unit(根据产品去重Parent汇总)（FBM）', nullable: true, type: 'int' })
  units_30_sum_fbm: number;

  @Column({ comment: '近30天unit(根据产品去重Parent汇总)（AMZ）', nullable: true, type: 'int' })
  units_30_sum_amz: number;

  @Column({ comment: '近30天unit(根据产品去重Parent汇总)（非FBA和FBM）', nullable: true, type: 'int' })
  units_30_sum_other: number;

  @Column({ comment: '记录采集设置的关键词', nullable: true, type: 'varchar', length: 255 })
  keywords: string;

  @Column({ comment: 'FBM卖家数量', nullable: true, type: 'int' })
  seller_count_fbm: number;

  @Column({ comment: 'AMZ卖家数量', nullable: true, type: 'int' })
  seller_count_amz: number;

  @Column({ comment: '其他卖家数量', nullable: true, type: 'int' })
  seller_count_other: number;

  @Column({ comment: '搜索月份', nullable: true, type: 'varchar', length: 45 })
  search_month: string;

  @Column({ comment: '产品编码', nullable: true, type: 'varchar', length: 50 })
  product_code: string;

  // 2026-03-02
  @Column({ comment: '公司近30天销量', nullable: true, type: 'int' })
  company_units_30_sum: number;

  @Column({ comment: '公司FBA库存', nullable: true, type: 'int' })
  company_inventory_sum: number;

  @Column({ comment: '可售量', nullable: true, type: 'int', unsigned: true, default: 0 })
  afn_fulfillable_quantity: number;

  @Column({ comment: '入库中', nullable: true, type: 'int', unsigned: true, default: 0 })
  afn_inbound_receiving_quantity: number;

  @Column({ comment: '在途', nullable: true, type: 'int', unsigned: true, default: 0 })
  afn_inbound_shipped_quantity: number;

  @Column({ comment: '计划入库', nullable: true, type: 'int', unsigned: true, default: 0 })
  afn_inbound_working_quantity: number;

  @Column({ comment: '选品asin', nullable: true, type: 'varchar', length: 50 })
  asin_candidate: string;

  @Column({ comment: '国家', nullable: true, type: 'varchar', length: 20 })
  marketplace: string;

  // ========== 新增欧洲五国FBA销量|库存字段 ==========
  @Column({ 
    comment: '英国FBA近30天销量|库存', 
    nullable: true, 
    type: 'varchar', 
    length: 50,
    default: '0|0' 
  })
  units_30_sum_fba_uk: string;

  @Column({ 
    comment: '德国FBA近30天销量|库存', 
    nullable: true, 
    type: 'varchar', 
    length: 50,
    default: '0|0' 
  })
  units_30_sum_fba_de: string;

  @Column({ 
    comment: '法国FBA近30天销量|库存', 
    nullable: true, 
    type: 'varchar', 
    length: 50,
    default: '0|0' 
  })
  units_30_sum_fba_fr: string;

  @Column({ 
    comment: '西班牙FBA近30天销量|库存', 
    nullable: true, 
    type: 'varchar', 
    length: 50,
    default: '0|0' 
  })
  units_30_sum_fba_es: string;

  @Column({ 
    comment: '意大利FBA近30天销量|库存', 
    nullable: true, 
    type: 'varchar', 
    length: 50,
    default: '0|0' 
  })
  units_30_sum_fba_it: string;
}
