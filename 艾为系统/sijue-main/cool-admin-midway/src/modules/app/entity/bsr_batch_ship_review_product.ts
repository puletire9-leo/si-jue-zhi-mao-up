import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 批量发货审核单产品快照。
 */
@Entity('app_amz_bsr_batch_ship_review_product')
@Index('idx_bsr_batch_ship_review_product_no', ['review_no'])
@Index('idx_bsr_batch_ship_review_product_version', ['version_id'])
@Index('idx_bsr_batch_ship_review_product_identity', [
  'store_id',
  'asin',
  'msku',
])
export class AppAmzBsrBatchShipReviewProductEntity extends BaseEntity {
  @Column({ comment: '批量发货审核单号', length: 50 })
  review_no: string;

  @Column({ comment: '版本ID', type: 'int' })
  version_id: number;

  @Column({ comment: '产品行号', type: 'int' })
  product_line_no: number;

  @Column({ comment: '产品临时key', length: 300, nullable: true })
  item_key: string;

  @Column({ comment: '来源行key', length: 300, nullable: true })
  row_key: string;

  @Column({ comment: '店铺ID', type: 'int', nullable: true })
  store_id: number;

  @Column({ comment: 'Listing ID', type: 'int', nullable: true })
  listing_id: number;

  @Column({ comment: 'ASIN', length: 50, nullable: true })
  asin: string;

  @Column({ comment: '市场', length: 50, nullable: true })
  marketplace: string;

  @Column({ comment: 'MSKU', length: 200, nullable: true })
  msku: string;

  @Column({ comment: 'FNSKU', length: 100, nullable: true })
  fnsku: string;

  @Column({ comment: '产品编码', length: 80, nullable: true })
  product_code: string;

  @Column({ comment: '产品名称', length: 500, nullable: true })
  product_name: string;

  @Column({ comment: '产品图片', length: 500, nullable: true })
  product_img: string;

  @Column({ comment: '店铺/卖家名称', length: 200, nullable: true })
  seller_name: string;

  @Column({
    comment: '日均销量',
    type: 'decimal',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  daily_avg_sales: number;

  @Column({ comment: '目标库存天数', type: 'int', nullable: true })
  target_stock_days: number;

  @Column({
    comment: '波动系数',
    type: 'decimal',
    precision: 12,
    scale: 4,
    nullable: true,
  })
  volatility_coefficient: number;

  @Column({ comment: 'FBA库存', type: 'int', nullable: true })
  fba_qty: number;

  @Column({ comment: '预留库存', type: 'int', nullable: true })
  reserved_qty: number;

  @Column({ comment: '在途数量', type: 'int', nullable: true })
  in_transit_qty: number;

  @Column({ comment: '本地库存', type: 'int', nullable: true })
  local_qty: number;

  @Column({ comment: '实际可发量', type: 'int', nullable: true })
  actual_shippable_qty: number;

  @Column({ comment: '采购计划量', type: 'int', nullable: true })
  purchase_plan_qty: number;

  @Column({ comment: '待交付量', type: 'int', nullable: true })
  pending_delivery_qty: number;

  @Column({ comment: '本次发货量', type: 'int', default: 0 })
  ship_qty: number;

  @Column({ comment: '产品完整快照JSON', type: 'json', nullable: true })
  product_snapshot_json: any;
}
