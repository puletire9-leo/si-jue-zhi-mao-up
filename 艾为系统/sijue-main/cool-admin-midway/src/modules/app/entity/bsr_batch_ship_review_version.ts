import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 批量发货审核单版本快照。
 *
 * 每次保存/送审都新增版本，完整工作台还原以 workbench_snapshot_json 为准。
 */
@Entity('app_amz_bsr_batch_ship_review_version')
@Index('idx_bsr_batch_ship_review_version_no', ['review_no'])
@Index('idx_bsr_batch_ship_review_version_pair', ['review_no', 'version_no'])
export class AppAmzBsrBatchShipReviewVersionEntity extends BaseEntity {
  @Column({ comment: '批量发货审核单号', length: 50 })
  review_no: string;

  @Column({ comment: '版本号', type: 'int', default: 1 })
  version_no: number;

  @Column({
    comment: '保存类型 draft/submit_review/modify_after_reject',
    length: 40,
  })
  save_type: string;

  @Column({ comment: '打开弹窗时输入快照JSON', type: 'json', nullable: true })
  input_snapshot_json: any;

  @Column({
    comment: '批量发货工作台完整快照JSON',
    type: 'json',
    nullable: true,
  })
  workbench_snapshot_json: any;

  @Column({
    comment: '旧批量发货提交payload JSON',
    type: 'json',
    nullable: true,
  })
  submit_payload_json: any;

  @Column({ comment: 'UI状态JSON', type: 'json', nullable: true })
  ui_state_json: any;

  @Column({ comment: '版本摘要JSON', type: 'json', nullable: true })
  summary_json: any;

  @Column({ comment: '创建人ID', type: 'int', nullable: true })
  created_by_user_id: number;

  @Column({ comment: '创建人用户名', length: 100, nullable: true })
  created_by_username: string;

  @Column({ comment: '创建人昵称', length: 100, nullable: true })
  created_by_nickname: string;
}
