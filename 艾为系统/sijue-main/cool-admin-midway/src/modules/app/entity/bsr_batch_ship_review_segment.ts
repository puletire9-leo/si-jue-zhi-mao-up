import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 批量发货审核单运输段快照。
 */
@Entity('app_amz_bsr_batch_ship_review_segment')
@Index('idx_bsr_batch_ship_review_segment_no', ['review_no'])
@Index('idx_bsr_batch_ship_review_segment_version', ['version_id'])
@Index('idx_bsr_batch_ship_review_segment_method', ['method_key'])
@Index('idx_bsr_batch_ship_review_segment_warehouse', ['warehouse_id'])
export class AppAmzBsrBatchShipReviewSegmentEntity extends BaseEntity {
  @Column({ comment: '批量发货审核单号', length: 50 })
  review_no: string;

  @Column({ comment: '版本ID', type: 'int' })
  version_id: number;

  @Column({ comment: '产品行号', type: 'int' })
  product_line_no: number;

  @Column({ comment: '运输段行号', type: 'int' })
  segment_line_no: number;

  @Column({ comment: '产品临时key', length: 300, nullable: true })
  item_key: string;

  @Column({ comment: '运输方式key', length: 30, nullable: true })
  method_key: string;

  @Column({ comment: '运输方式名称', length: 50, nullable: true })
  method_label: string;

  @Column({ comment: '运输方式图标', length: 20, nullable: true })
  method_icon: string;

  @Column({ comment: '运输方式颜色', length: 30, nullable: true })
  method_color: string;

  @Column({ comment: '日期范围JSON', type: 'json', nullable: true })
  date_range_json: any;

  @Column({ comment: '到货范围文案', length: 100, nullable: true })
  arrival_range_text: string;

  @Column({ comment: '本次发货量', type: 'int', default: 0 })
  ship_qty: number;

  @Column({ comment: '系统建议量', type: 'int', default: 0 })
  system_suggest_qty: number;

  @Column({ comment: '是否人工调整', type: 'tinyint', default: 0 })
  manual_adjusted: number;

  @Column({ comment: '人工输入数量', type: 'int', nullable: true })
  manual_input_qty: number;

  @Column({ comment: '缺口量', type: 'int', nullable: true })
  gap_qty: number;

  @Column({ comment: '剩余缺口量', type: 'int', nullable: true })
  remaining_gap_qty: number;

  @Column({ comment: '发货仓库ID', type: 'int', nullable: true })
  warehouse_id: number;

  @Column({ comment: '发货仓库名称', length: 200, nullable: true })
  warehouse_name: string;

  @Column({ comment: '仓库原始快照JSON', type: 'json', nullable: true })
  warehouse_snapshot_json: any;

  @Column({ comment: '包装类型', type: 'tinyint', nullable: true })
  packing_type: number;

  @Column({ comment: '包装类型名称', length: 50, nullable: true })
  packing_type_label: string;

  @Column({ comment: '计划发货日期', type: 'date', nullable: true })
  plan_ship_date: string;

  @Column({ comment: '商品备注', type: 'text', nullable: true })
  detail_remark: string;

  @Column({ comment: '批次备注', type: 'text', nullable: true })
  batch_remark: string;

  @Column({ comment: '算法名称', length: 80, nullable: true })
  algo_label: string;

  @Column({ comment: '计算依据JSON', type: 'json', nullable: true })
  calculation_json: any;

  @Column({ comment: '运输段完整快照JSON', type: 'json', nullable: true })
  segment_snapshot_json: any;
}
