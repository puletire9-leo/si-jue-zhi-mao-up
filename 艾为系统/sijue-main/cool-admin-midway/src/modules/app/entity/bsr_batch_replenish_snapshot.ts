import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 批量补货测算快照。
 *
 * 一条记录对应一次批量补货生成采购计划时的单品现场，用于后续流程图和审计追溯。
 * 旧的 analysis_record 继续保存摘要和兼容字段，这里保存完整测算上下文。
 */
@Entity('app_amz_bsr_batch_replenish_snapshot')
@Index('uk_bsr_batch_replenish_snapshot_analysis', ['analysis_record_id'], {
  unique: true,
})
@Index('idx_bsr_batch_replenish_snapshot_plan', ['plan_sn'])
@Index('idx_bsr_batch_replenish_snapshot_product', [
  'store_id',
  'asin',
  'marketplace',
  'msku',
])
export class AppAmzBsrBatchReplenishSnapshotEntity extends BaseEntity {
  @Column({ comment: '分析记录ID', type: 'int' })
  analysis_record_id: number;

  @Column({ comment: '采购计划编号', length: 50, nullable: true })
  plan_sn: string;

  @Column({ comment: '采购计划批次号', length: 50, nullable: true })
  ppg_sn: string;

  @Column({ comment: '店铺ID', type: 'bigint', nullable: true })
  store_id: number;

  @Column({ comment: 'ASIN', length: 50, nullable: true })
  asin: string;

  @Column({ comment: 'MSKU', length: 100, nullable: true })
  msku: string;

  @Column({ comment: '国家/站点', length: 50, nullable: true })
  marketplace: string;

  @Column({ comment: '产品编码', length: 50, nullable: true })
  product_code: string;

  @Column({ comment: '本地SKU', length: 100, nullable: true })
  local_sku: string;

  @Column({ comment: '快照版本', type: 'int', default: 1 })
  snapshot_version: number;

  @Column({ comment: '快照来源', length: 50, default: 'batch_replenish' })
  snapshot_source: string;

  @Column({ comment: '算法key', length: 50, nullable: true })
  algorithm_key: string;

  @Column({ comment: '算法名称', length: 50, nullable: true })
  algorithm_name: string;

  @Column({ comment: '周期开始日期', type: 'date', nullable: true })
  cycle_start_date: string;

  @Column({ comment: '周期结束日期', type: 'date', nullable: true })
  cycle_end_date: string;

  @Column({ comment: '日均销量', type: 'decimal', precision: 12, scale: 4, nullable: true })
  daily_avg_sales: number;

  @Column({ comment: '目标库存天数', type: 'int', nullable: true })
  target_stock_days: number;

  @Column({ comment: '波动系数', type: 'decimal', precision: 10, scale: 2, nullable: true })
  volatility_coefficient: number;

  @Column({ comment: '系统建议量', type: 'int', nullable: true })
  system_suggested_qty: number;

  @Column({ comment: '原实际采购量（装箱前）', type: 'int', nullable: true })
  actual_purchase_qty: number;

  @Column({ comment: '最终采购量（装箱后）', type: 'int', nullable: true })
  final_purchase_qty: number;

  @Column({ comment: '采购仓库ID', type: 'int', nullable: true })
  warehouse_wid: number;

  @Column({ comment: '采购仓库名称', length: 100, nullable: true })
  warehouse_name: string;

  @Column({ comment: '运输段调整模式', length: 50, nullable: true })
  adjust_mode: string;

  @Column({ comment: '装箱数', type: 'int', nullable: true })
  box_pcs: number;

  @Column({ comment: '摘要JSON', type: 'json', nullable: true })
  summary_json: any;

  @Column({ comment: '输入快照JSON', type: 'json', nullable: true })
  input_json: any;

  @Column({ comment: '计算公式JSON', type: 'json', nullable: true })
  calculation_json: any;

  @Column({ comment: '运输分段JSON', type: 'json', nullable: true })
  shipping_json: any;

  @Column({ comment: '手动调整JSON', type: 'json', nullable: true })
  adjustment_json: any;

  @Column({ comment: '系数JSON', type: 'json', nullable: true })
  coefficient_json: any;

  @Column({ comment: '库存推演JSON', type: 'json', nullable: true })
  inventory_json: any;

  @Column({ comment: '备注JSON', type: 'json', nullable: true })
  remark_json: any;

  @Column({ comment: 'UI展示快照JSON', type: 'json', nullable: true })
  ui_snapshot_json: any;

  @Column({ comment: '完整快照JSON', type: 'json', nullable: true })
  full_snapshot_json: any;

  @Column({ comment: '创建人ID', type: 'int', nullable: true })
  created_by: number;

  @Column({ comment: '创建人名称', length: 100, nullable: true })
  created_by_name: string;
}
