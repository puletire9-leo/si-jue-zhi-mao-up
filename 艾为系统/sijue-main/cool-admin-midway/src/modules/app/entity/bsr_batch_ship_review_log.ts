import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 批量发货审核单操作日志。
 */
@Entity('app_amz_bsr_batch_ship_review_log')
@Index('idx_bsr_batch_ship_review_log_no', ['review_no'])
@Index('idx_bsr_batch_ship_review_log_version', ['version_id'])
@Index('idx_bsr_batch_ship_review_log_action', ['action'])
export class AppAmzBsrBatchShipReviewLogEntity extends BaseEntity {
  @Column({ comment: '批量发货审核单号', length: 50 })
  review_no: string;

  @Column({ comment: '版本ID', type: 'int', nullable: true })
  version_id: number;

  @Column({ comment: '动作', length: 40 })
  action: string;

  @Column({ comment: '原状态', length: 40, nullable: true })
  from_status: string;

  @Column({ comment: '新状态', length: 40, nullable: true })
  to_status: string;

  @Column({ comment: '操作人ID', type: 'int', nullable: true })
  operator_user_id: number;

  @Column({ comment: '操作人用户名', length: 100, nullable: true })
  operator_username: string;

  @Column({ comment: '操作人昵称', length: 100, nullable: true })
  operator_nickname: string;

  @Column({ comment: '操作备注', type: 'text', nullable: true })
  remark: string;

  @Column({ comment: '操作快照JSON', type: 'json', nullable: true })
  snapshot_json: any;
}
