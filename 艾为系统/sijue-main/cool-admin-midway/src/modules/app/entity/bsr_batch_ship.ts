import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 批量发货批次。
 *
 * 保存一次批量发货提交的总览、最终仓库建议和执行结果汇总。
 * 领星真实发货计划仍保存到 app_amz_bsr_shipment_plan_lingxing。
 */
@Entity('app_amz_bsr_batch_ship')
@Index('uk_bsr_batch_ship_batch_no', ['batch_no'], { unique: true })
@Index('uk_bsr_batch_ship_client_token', ['client_submit_token'], { unique: true })
@Index('idx_bsr_batch_ship_status', ['status'])
export class AppAmzBsrBatchShipEntity extends BaseEntity {
  @Column({ comment: '本地批量发货批次号', length: 50 })
  batch_no: string;

  @Column({ comment: '批次状态 submitting/success/partial_failed/failed', length: 30, default: 'submitting' })
  status: string;

  @Column({ comment: '客户端提交幂等Token', length: 120, nullable: true })
  client_submit_token: string;

  @Column({ comment: '计划发货总量', type: 'int', default: 0 })
  planned_total_qty: number;

  @Column({ comment: '成功创建总量', type: 'int', default: 0 })
  success_total_qty: number;

  @Column({ comment: '失败总量', type: 'int', default: 0 })
  failed_total_qty: number;

  @Column({ comment: '产品数', type: 'int', default: 0 })
  product_count: number;

  @Column({ comment: '运输方式数', type: 'int', default: 0 })
  method_count: number;

  @Column({ comment: '按运输方式汇总JSON', type: 'json', nullable: true })
  method_summary_json: any;

  @Column({ comment: '提交后最终仓库建议JSON', type: 'json', nullable: true })
  final_advice_json: any;

  @Column({ comment: '提交前计划快照JSON', type: 'json', nullable: true })
  planned_snapshot_json: any;

  @Column({ comment: '创建人ID', type: 'int', nullable: true })
  created_by_user_id: number;

  @Column({ comment: '创建人用户名', length: 100, nullable: true })
  created_by_username: string;

  @Column({ comment: '创建人昵称', length: 100, nullable: true })
  created_by_nickname: string;

  @Column({ comment: '完成时间', type: 'datetime', nullable: true })
  finished_time: Date;
}
