import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购单历史补全：采购单明细搁置状态
 *
 * 一条记录对应一个采购单产品明细，不是整张采购单，也不是产品规则。
 */
@Entity('app_amz_bsr_purchase_order_manual_link_shelf')
@Index('uniq_bsr_manual_link_shelf_order_item', ['order_item_id'], {
  unique: true,
})
@Index('idx_bsr_manual_link_shelf_order_item_remote', ['order_sn', 'item_id'])
@Index('idx_bsr_manual_link_shelf_status_update', ['shelved', 'updateTime'])
export class AppAmzBsrPurchaseOrderManualLinkShelfEntity extends BaseEntity {
  @Column({ comment: '采购单明细ID', type: 'int' })
  order_item_id: number;

  @Column({ comment: '采购单号', length: 50 })
  order_sn: string;

  @Column({ comment: '领星子项ID', length: 80, nullable: true })
  item_id: string;

  @Column({ comment: '主采购计划号', length: 50, nullable: true })
  plan_sn: string;

  @Column({ comment: '关联采购计划号列表', type: 'json', nullable: true })
  linked_plan_sns: string[];

  @Column({ comment: '采购单明细产品名', length: 200, nullable: true })
  product_name: string;

  @Column({ comment: '采购单明细SKU', length: 100, nullable: true })
  sku: string;

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
}
