import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购单历史补全：采购单明细搁置操作日志
 */
@Entity('app_amz_bsr_purchase_order_manual_link_shelf_log')
@Index('idx_bsr_manual_link_shelf_log_shelf', ['shelf_id'])
@Index('idx_bsr_manual_link_shelf_log_batch', ['batch_id'])
@Index('idx_bsr_manual_link_shelf_log_order_item', ['order_item_id'])
export class AppAmzBsrPurchaseOrderManualLinkShelfLogEntity extends BaseEntity {
  @Column({ comment: '搁置状态记录ID', type: 'int', nullable: true })
  shelf_id: number;

  @Column({ comment: '批量操作ID', length: 80, nullable: true })
  batch_id: string;

  @Column({ comment: '采购单明细ID', type: 'int' })
  order_item_id: number;

  @Column({ comment: '采购单号', length: 50 })
  order_sn: string;

  @Column({ comment: '领星子项ID', length: 80, nullable: true })
  item_id: string;

  @Column({ comment: '主采购计划号', length: 50, nullable: true })
  plan_sn: string;

  @Column({ comment: '操作类型: shelf/unshelf', length: 50 })
  action_type: string;

  @Column({ comment: '变更前搁置状态', type: 'tinyint', default: 0 })
  before_shelved: number;

  @Column({ comment: '变更后搁置状态', type: 'tinyint', default: 0 })
  after_shelved: number;

  @Column({ comment: '操作人ID', type: 'int', nullable: true })
  operator_user_id: number;

  @Column({ comment: '操作人用户名', length: 100, nullable: true })
  operator_username: string;

  @Column({ comment: '操作人昵称', length: 100, nullable: true })
  operator_nickname: string;

  @Column({ comment: '操作备注', type: 'text', nullable: true })
  remark: string;
}
