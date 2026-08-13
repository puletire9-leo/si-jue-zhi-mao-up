import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购单物流人工确认操作日志
 *
 * 当前确认状态仍保存在 app_amz_bsr_purchase_order_sync_lingxing。
 * 这里仅保存确认/撤销的审计轨迹，便于后续流程图追溯。
 */
@Entity('app_amz_bsr_purchase_order_logistics_confirm_log')
export class AppAmzBsrPurchaseOrderLogisticsConfirmLogEntity extends BaseEntity {
  @Index()
  @Column({ comment: '采购单号', length: 50 })
  order_sn: string;

  @Index()
  @Column({ comment: '操作类型: confirm/cancel', length: 20 })
  action: string;

  @Column({ comment: '操作前确认状态', type: 'tinyint', default: 0 })
  before_confirmed: number;

  @Column({ comment: '操作后确认状态', type: 'tinyint', default: 0 })
  after_confirmed: number;

  @Column({ comment: '操作前确认时间', type: 'datetime', nullable: true })
  before_confirmed_time: Date;

  @Column({ comment: '操作后确认时间', type: 'datetime', nullable: true })
  after_confirmed_time: Date;

  @Column({ comment: '操作人ID', type: 'int', nullable: true })
  operator_user_id: number;

  @Column({ comment: '操作人用户名', length: 100, nullable: true })
  operator_username: string;

  @Column({ comment: '操作人昵称', length: 100, nullable: true })
  operator_nickname: string;

  @Column({ comment: '人工确认/撤销原因', type: 'text', nullable: true })
  remark: string;

  @Index()
  @Column({ comment: '来源页面', length: 50, nullable: true })
  source: string;

  @Index()
  @Column({ comment: '批量操作批次号', length: 50, nullable: true })
  batch_id: string;

  @Column({ comment: '必要上下文快照', type: 'json', nullable: true })
  raw_snapshot: any;
}
