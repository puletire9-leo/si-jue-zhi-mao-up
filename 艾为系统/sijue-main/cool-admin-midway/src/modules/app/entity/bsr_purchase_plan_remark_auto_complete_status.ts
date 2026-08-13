import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购计划备注自动补全最新状态。
 *
 * 只记录每个 plan_sn 最近一次自动补全结果，不保存完整业务快照；
 * 完整快照仍写 app_amz_bsr_batch_replenish_snapshot。
 */
@Index('idx_bsr_plan_remark_auto_status_plan_sn', ['plan_sn'], { unique: true })
@Entity('app_amz_bsr_purchase_plan_remark_auto_complete_status')
export class AppAmzBsrPurchasePlanRemarkAutoCompleteStatusEntity extends BaseEntity {
  @Column({ comment: '采购计划编号', length: 50 })
  plan_sn: string;

  @Index()
  @Column({ comment: '最新状态: success/success_with_warnings/failed/needs_attention/skipped', length: 40 })
  status: string;

  @Column({ comment: '状态中文', length: 60, nullable: true })
  status_label: string;

  @Column({ comment: '采购单号聚合', length: 500, nullable: true })
  order_sn: string;

  @Column({ comment: '备注内容指纹', length: 80, nullable: true })
  remark_hash: string;

  @Column({ comment: '业务上下文指纹', length: 80, nullable: true })
  context_hash: string;

  @Column({ comment: '采购事实数量', type: 'int', nullable: true })
  purchase_qty: number;

  @Column({ comment: '备注发货分配合计', type: 'int', nullable: true })
  allocation_total: number;

  @Column({ comment: '关联分析记录ID', type: 'int', nullable: true })
  analysis_record_id: number;

  @Column({ comment: '关联补货快照ID', type: 'int', nullable: true })
  snapshot_id: number;

  @Column({ comment: '匹配店铺商品ID', type: 'int', nullable: true })
  listing_id: number;

  @Column({ comment: 'ASIN', length: 50, nullable: true })
  asin: string;

  @Column({ comment: 'MSKU', length: 120, nullable: true })
  msku: string;

  @Column({ comment: '本地SKU', length: 120, nullable: true })
  local_sku: string;

  @Column({ comment: '店铺名称', length: 200, nullable: true })
  seller_name: string;

  @Column({ comment: '国家/站点', length: 50, nullable: true })
  marketplace: string;

  @Column({ comment: '仓库ID', type: 'int', nullable: true })
  warehouse_wid: number;

  @Column({ comment: '仓库名称', length: 120, nullable: true })
  warehouse_name: string;

  @Column({ comment: '仓库是否需要人工确认', type: 'tinyint', default: 0 })
  warehouse_confirmation_required: number;

  @Column({ comment: '阻断错误JSON', type: 'json', nullable: true })
  errors_json: any;

  @Column({ comment: '非阻断警告JSON', type: 'json', nullable: true })
  warnings_json: any;

  @Column({ comment: '状态上下文JSON', type: 'json', nullable: true })
  context_json: any;

  @Column({ comment: '最近运行来源', length: 80, nullable: true })
  last_run_source: string;

  @Column({ comment: '最近运行时间', type: 'datetime', nullable: true })
  last_run_time: Date;
}
