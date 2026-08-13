import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 批量发货明细。
 *
 * 一条记录对应一个产品在某个运输方式下分配到某个采购计划/采购单的发货明细。
 */
@Entity('app_amz_bsr_batch_ship_detail')
@Index('idx_bsr_batch_ship_detail_batch', ['batch_no'])
@Index('idx_bsr_batch_ship_detail_product', ['store_id', 'asin', 'msku'])
@Index('idx_bsr_batch_ship_detail_purchase', ['purchase_plan_sn', 'purchase_order_sn'])
@Index('idx_bsr_batch_ship_detail_seq', ['lingxing_seq'])
export class AppAmzBsrBatchShipDetailEntity extends BaseEntity {
  @Column({ comment: '批量发货批次ID', type: 'int' })
  batch_id: number;

  @Column({ comment: '本地批量发货批次号', length: 50 })
  batch_no: string;

  @Column({ comment: '运输方式key', length: 30 })
  method_key: string;

  @Column({ comment: '运输方式名称', length: 50, nullable: true })
  method_label: string;

  @Column({ comment: '发货仓库ID', type: 'int', nullable: true })
  warehouse_id: number;

  @Column({ comment: '发货仓库名称', length: 200, nullable: true })
  warehouse_name: string;

  @Column({ comment: '包装类型(1混装 2原厂)', type: 'tinyint', nullable: true })
  packing_type: number;

  @Column({ comment: '计划发货日期', type: 'date', nullable: true })
  shipment_time: string;

  @Column({ comment: '店铺ID', type: 'int', nullable: true })
  store_id: number;

  @Column({ comment: 'ASIN', length: 50, nullable: true })
  asin: string;

  @Column({ comment: '市场', length: 50, nullable: true })
  marketplace: string;

  @Column({ comment: 'MSKU', length: 200, nullable: true })
  msku: string;

  @Column({ comment: 'FNSKU', length: 100, nullable: true })
  fnsku: string;

  @Column({ comment: '产品名称', length: 500, nullable: true })
  product_name: string;

  @Column({ comment: '产品图片', length: 500, nullable: true })
  product_img: string;

  @Column({ comment: '产品编码', length: 80, nullable: true })
  product_code: string;

  @Column({ comment: 'Listing ID', type: 'int', nullable: true })
  listing_id: number;

  @Column({ comment: '采购计划号', length: 80, nullable: true })
  purchase_plan_sn: string;

  @Column({ comment: '采购单号', length: 80, nullable: true })
  purchase_order_sn: string;

  @Column({ comment: '本次发货量', type: 'int', default: 0 })
  ship_qty: number;

  @Column({ comment: '运输段系统建议量', type: 'int', default: 0 })
  system_suggest_qty: number;

  @Column({ comment: '是否人工调整', type: 'tinyint', default: 0 })
  manual_adjusted: number;

  @Column({ comment: '提交状态 pending/success/failed', length: 30, default: 'pending' })
  status: string;

  @Column({ comment: '领星批次号seq', length: 80, nullable: true })
  lingxing_seq: string;

  @Column({ comment: '领星发货计划单号JSON', type: 'json', nullable: true })
  lingxing_order_sns_json: any;

  @Column({ comment: '本地发货计划同步状态 success/failed/skipped', length: 30, nullable: true })
  local_sync_status: string;

  @Column({ comment: '本地发货计划同步错误', type: 'text', nullable: true })
  local_sync_error: string;

  @Column({ comment: '重试次数', type: 'int', default: 0 })
  retry_count: number;

  @Column({ comment: '最后重试时间', type: 'datetime', nullable: true })
  last_retry_time: Date;

  @Column({ comment: '错误信息', type: 'text', nullable: true })
  error_message: string;

  @Column({ comment: '明细备注', type: 'text', nullable: true })
  detail_remark: string;

  @Column({ comment: '批次备注', type: 'text', nullable: true })
  batch_remark: string;

  @Column({ comment: '领星请求payload JSON', type: 'json', nullable: true })
  request_payload_json: any;

  @Column({ comment: '领星响应JSON', type: 'json', nullable: true })
  response_json: any;

  @Column({ comment: '计算/暂存快照JSON', type: 'json', nullable: true })
  snapshot_json: any;
}
