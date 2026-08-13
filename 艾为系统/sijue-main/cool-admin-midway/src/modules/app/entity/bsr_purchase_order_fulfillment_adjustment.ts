import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购单产品履约调整当前值
 *
 * 一张采购单里的一个产品只保留一条当前调整记录。
 * 历史变化写入 app_amz_bsr_purchase_order_fulfillment_adjustment_log。
 */
@Entity('app_amz_bsr_purchase_order_fulfillment_adjustment')
@Index(
  'uniq_bsr_po_fulfillment_product',
  [
    'store_id',
    'marketplace',
    'asin',
    'msku',
    'product_code',
    'purchase_order_sn',
  ],
  { unique: true }
)
export class AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity extends BaseEntity {
  @Index()
  @Column({ comment: '店铺ID', type: 'bigint' })
  store_id: number;

  @Index()
  @Column({ comment: '国家/站点', length: 50 })
  marketplace: string;

  @Index()
  @Column({ comment: 'ASIN', length: 50 })
  asin: string;

  @Index()
  @Column({ comment: 'MSKU', length: 200 })
  msku: string;

  @Index()
  @Column({ comment: '产品编码', length: 50 })
  product_code: string;

  @Index()
  @Column({ comment: '采购单号', length: 50 })
  purchase_order_sn: string;

  @Column({ comment: '主要关联采购计划号', length: 50, nullable: true })
  primary_plan_sn: string;

  @Column({ comment: '关联采购计划号列表', type: 'json', nullable: true })
  linked_plan_sns: string[];

  @Column({ comment: '残次品数量', type: 'int', default: 0 })
  defective_qty: number;

  @Column({
    comment: '残次品状态: 0无异常,1待处理,2已处理',
    type: 'tinyint',
    default: 0,
  })
  defective_status: number;

  @Column({ comment: '残次品处理备注', type: 'text', nullable: true })
  defective_remark: string;

  @Column({ comment: '残次品处理人ID', type: 'int', nullable: true })
  defective_processed_by_user_id: number;

  @Column({ comment: '残次品处理人用户名', length: 100, nullable: true })
  defective_processed_by_username: string;

  @Column({ comment: '残次品处理人昵称', length: 100, nullable: true })
  defective_processed_by_nickname: string;

  @Column({ comment: '残次品处理时间', type: 'datetime', nullable: true })
  defective_processed_time: Date;

  @Column({ comment: '商家少发数量', type: 'int', default: 0 })
  short_shipped_qty: number;

  @Column({
    comment: '商家少发状态: 0无异常,1待处理,2已处理',
    type: 'tinyint',
    default: 0,
  })
  short_shipped_status: number;

  @Column({ comment: '商家少发处理备注', type: 'text', nullable: true })
  short_shipped_remark: string;

  @Column({ comment: '商家少发处理人ID', type: 'int', nullable: true })
  short_shipped_processed_by_user_id: number;

  @Column({ comment: '商家少发处理人用户名', length: 100, nullable: true })
  short_shipped_processed_by_username: string;

  @Column({ comment: '商家少发处理人昵称', length: 100, nullable: true })
  short_shipped_processed_by_nickname: string;

  @Column({ comment: '商家少发处理时间', type: 'datetime', nullable: true })
  short_shipped_processed_time: Date;

  @Column({ comment: '残次品处理备注', type: 'text', nullable: true })
  defective_process_remark: string;

  @Column({ comment: '商家少发处理备注', type: 'text', nullable: true })
  short_shipped_process_remark: string;

  @Column({
    comment: '单据状态: 0待处理,1处理中,2待确认,3已确认锁定',
    type: 'tinyint',
    default: 0,
  })
  document_status: number;

  @Column({ comment: '指派处理人ID', type: 'int', nullable: true })
  assigned_to_user_id: number;

  @Column({ comment: '指派处理人用户名', length: 100, nullable: true })
  assigned_to_username: string;

  @Column({ comment: '指派处理人昵称', length: 100, nullable: true })
  assigned_to_nickname: string;

  @Column({ comment: '指派时间', type: 'datetime', nullable: true })
  assigned_time: Date;

  @Column({ comment: '确认人ID', type: 'int', nullable: true })
  confirmed_by_user_id: number;

  @Column({ comment: '确认人用户名', length: 100, nullable: true })
  confirmed_by_username: string;

  @Column({ comment: '确认人昵称', length: 100, nullable: true })
  confirmed_by_nickname: string;

  @Column({ comment: '确认时间', type: 'datetime', nullable: true })
  confirmed_time: Date;

  @Column({ comment: '确认备注', type: 'text', nullable: true })
  confirm_remark: string;

  @Column({ comment: '人工完成: 0否,1是', type: 'tinyint', default: 0 })
  manual_completed: number;

  @Column({ comment: '人工完成原因', type: 'text', nullable: true })
  manual_completed_remark: string;

  @Column({ comment: '人工完成人ID', type: 'int', nullable: true })
  manual_completed_by_user_id: number;

  @Column({ comment: '人工完成人用户名', length: 100, nullable: true })
  manual_completed_by_username: string;

  @Column({ comment: '人工完成时间', type: 'datetime', nullable: true })
  manual_completed_time: Date;

  @Column({ comment: '搁置: 0否,1是', type: 'tinyint', default: 0 })
  shelved: number;

  @Column({ comment: '搁置原因', type: 'text', nullable: true })
  shelved_remark: string;

  @Column({ comment: '搁置人ID', type: 'int', nullable: true })
  shelved_by_user_id: number;

  @Column({ comment: '搁置人用户名', length: 100, nullable: true })
  shelved_by_username: string;

  @Column({ comment: '搁置人昵称', length: 100, nullable: true })
  shelved_by_nickname: string;

  @Column({ comment: '搁置时间', type: 'datetime', nullable: true })
  shelved_time: Date;

  @Column({ comment: '创建人ID', type: 'int', nullable: true })
  created_by_user_id: number;

  @Column({ comment: '创建人用户名', length: 100, nullable: true })
  created_by_username: string;

  @Column({ comment: '最后修改人ID', type: 'int', nullable: true })
  updated_by_user_id: number;

  @Column({ comment: '最后修改人用户名', length: 100, nullable: true })
  updated_by_username: string;
}
