import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 批量发货审核单主表。
 *
 * 只承载审核前单据生命周期和执行批次关联；真实领星执行结果仍写入
 * app_amz_bsr_batch_ship / app_amz_bsr_batch_ship_detail。
 */
@Entity('app_amz_bsr_batch_ship_review')
@Index('uk_bsr_batch_ship_review_no', ['review_no'], { unique: true })
@Index('idx_bsr_batch_ship_review_status', ['status'])
@Index('idx_bsr_batch_ship_review_created_by', ['created_by_user_id'])
@Index('idx_bsr_batch_ship_review_client_token', ['client_submit_token'])
@Index('idx_bsr_batch_ship_review_executed_batch', ['executed_batch_no'])
export class AppAmzBsrBatchShipReviewEntity extends BaseEntity {
  @Column({ comment: '批量发货审核单号', length: 50 })
  review_no: string;

  @Column({
    comment:
      '审核单状态 draft/pending_review/rejected/approved/executing/execute_success/execute_partial_failed/execute_failed',
    length: 40,
    default: 'draft',
  })
  status: string;

  @Column({ comment: '当前版本快照ID', type: 'int', nullable: true })
  current_version_id: number;

  @Column({ comment: '旧批量发货提交幂等Token', length: 120, nullable: true })
  client_submit_token: string;

  @Column({
    comment: '审核后执行产生的旧批量发货批次号',
    length: 50,
    nullable: true,
  })
  executed_batch_no: string;

  @Column({ comment: '总发货数量', type: 'int', default: 0 })
  total_ship_qty: number;

  @Column({ comment: '产品数', type: 'int', default: 0 })
  product_count: number;

  @Column({ comment: '运输段数', type: 'int', default: 0 })
  segment_count: number;

  @Column({ comment: '采购单分配数', type: 'int', default: 0 })
  order_count: number;

  @Column({ comment: '运输方式数', type: 'int', default: 0 })
  method_count: number;

  @Column({ comment: '仓库数', type: 'int', default: 0 })
  warehouse_count: number;

  @Column({ comment: '搜索文本', type: 'text', nullable: true })
  keyword_text: string;

  @Column({ comment: '列表摘要JSON', type: 'json', nullable: true })
  summary_json: any;

  @Column({ comment: '来源页面快照JSON', type: 'json', nullable: true })
  source_page_json: any;

  @Column({ comment: '创建人ID', type: 'int', nullable: true })
  created_by_user_id: number;

  @Column({ comment: '创建人用户名', length: 100, nullable: true })
  created_by_username: string;

  @Column({ comment: '创建人昵称', length: 100, nullable: true })
  created_by_nickname: string;

  @Column({ comment: '送审人ID', type: 'int', nullable: true })
  submitted_by_user_id: number;

  @Column({ comment: '送审人用户名', length: 100, nullable: true })
  submitted_by_username: string;

  @Column({ comment: '送审人昵称', length: 100, nullable: true })
  submitted_by_nickname: string;

  @Column({ comment: '送审时间', type: 'datetime', nullable: true })
  submitted_time: Date;

  @Column({ comment: '审核人ID', type: 'int', nullable: true })
  reviewed_by_user_id: number;

  @Column({ comment: '审核人用户名', length: 100, nullable: true })
  reviewed_by_username: string;

  @Column({ comment: '审核人昵称', length: 100, nullable: true })
  reviewed_by_nickname: string;

  @Column({ comment: '审核时间', type: 'datetime', nullable: true })
  reviewed_time: Date;

  @Column({ comment: '审核备注/驳回原因', type: 'text', nullable: true })
  review_remark: string;

  @Column({ comment: '执行人ID', type: 'int', nullable: true })
  executed_by_user_id: number;

  @Column({ comment: '执行人用户名', length: 100, nullable: true })
  executed_by_username: string;

  @Column({ comment: '执行人昵称', length: 100, nullable: true })
  executed_by_nickname: string;

  @Column({ comment: '执行时间', type: 'datetime', nullable: true })
  executed_time: Date;

  @Column({ comment: '执行结果JSON', type: 'json', nullable: true })
  execute_result_json: any;

  @Column({ comment: '执行失败原因', type: 'text', nullable: true })
  execute_error: string;
}
