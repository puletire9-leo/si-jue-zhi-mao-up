import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 批量发货审核单采购单分配快照。
 */
@Entity('app_amz_bsr_batch_ship_review_allocation')
@Index('idx_bsr_batch_ship_review_allocation_no', ['review_no'])
@Index('idx_bsr_batch_ship_review_allocation_version', ['version_id'])
@Index('idx_bsr_batch_ship_review_allocation_order', ['purchase_order_sn'])
@Index('idx_bsr_batch_ship_review_allocation_plan', ['purchase_plan_sn'])
export class AppAmzBsrBatchShipReviewAllocationEntity extends BaseEntity {
  @Column({ comment: '批量发货审核单号', length: 50 })
  review_no: string;

  @Column({ comment: '版本ID', type: 'int' })
  version_id: number;

  @Column({ comment: '产品行号', type: 'int' })
  product_line_no: number;

  @Column({ comment: '运输段行号', type: 'int' })
  segment_line_no: number;

  @Column({ comment: '采购单分配行号', type: 'int' })
  allocation_line_no: number;

  @Column({ comment: '采购计划号', length: 80, nullable: true })
  purchase_plan_sn: string;

  @Column({ comment: '采购单号', length: 80, nullable: true })
  purchase_order_sn: string;

  @Column({ comment: '分析记录ID', type: 'int', nullable: true })
  analysis_record_id: number;

  @Column({ comment: '关联采购计划JSON', type: 'json', nullable: true })
  linked_plan_sns_json: any;

  @Column({ comment: '关联分析记录JSON', type: 'json', nullable: true })
  linked_analysis_record_ids_json: any;

  @Column({ comment: '分配发货量', type: 'int', default: 0 })
  ship_qty: number;

  @Column({ comment: '实际可发量', type: 'int', nullable: true })
  actual_shippable_qty: number;

  @Column({ comment: '预估可发量', type: 'int', nullable: true })
  estimated_shippable_qty: number;

  @Column({ comment: '采购单状态文案', length: 100, nullable: true })
  order_status_text: string;

  @Column({ comment: '供应商名称', length: 200, nullable: true })
  supplier_name: string;

  @Column({ comment: '采购单时间', length: 50, nullable: true })
  order_time: string;

  @Column({ comment: '物流状态文案', length: 100, nullable: true })
  logistics_status_text: string;

  @Column({ comment: '物流状态原因', length: 500, nullable: true })
  logistics_status_reason: string;

  @Column({ comment: '采购单分配完整快照JSON', type: 'json', nullable: true })
  allocation_snapshot_json: any;

  @Column({
    comment: '执行状态 pending/success/failed/skipped',
    length: 30,
    nullable: true,
  })
  execute_status: string;

  @Column({ comment: '执行关联旧批次号', length: 50, nullable: true })
  executed_batch_no: string;

  @Column({ comment: '执行关联旧明细ID', type: 'int', nullable: true })
  executed_detail_id: number;

  @Column({ comment: '领星批次号', length: 80, nullable: true })
  lingxing_seq: string;

  @Column({ comment: '执行失败原因', type: 'text', nullable: true })
  execute_error: string;
}
