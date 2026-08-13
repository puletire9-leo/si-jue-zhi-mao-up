import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购单产品履约调整操作日志
 */
@Entity('app_amz_bsr_purchase_order_fulfillment_adjustment_log')
export class AppAmzBsrPurchaseOrderFulfillmentAdjustmentLogEntity extends BaseEntity {
  @Index()
  @Column({ comment: '履约调整记录ID', type: 'int' })
  adjustment_id: number;

  @Column({
    comment: '操作类型: create/update/process/reopen/manual_complete/manual_reopen/shelf/unshelf',
    length: 50,
  })
  action_type: string;

  @Column({
    comment: '操作分组: defective/short_shipped/manual_completed/shelved/general',
    length: 50,
  })
  field_group: string;

  @Column({ comment: '变更前数据', type: 'json', nullable: true })
  before_json: any;

  @Column({ comment: '变更后数据', type: 'json', nullable: true })
  after_json: any;

  @Column({ comment: '操作人ID', type: 'int', nullable: true })
  operator_user_id: number;

  @Column({ comment: '操作人用户名', length: 100, nullable: true })
  operator_username: string;

  @Column({ comment: '操作人昵称', length: 100, nullable: true })
  operator_nickname: string;

  @Column({ comment: '操作备注', type: 'text', nullable: true })
  remark: string;
}
