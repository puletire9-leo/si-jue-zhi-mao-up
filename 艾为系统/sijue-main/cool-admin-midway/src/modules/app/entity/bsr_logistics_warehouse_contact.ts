import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 仓库联系人绑定。顺丰/中通等需要手机号时按仓库优先级尝试。
 */
@Index('idx_bsr_logistics_wh_contact_warehouse', ['warehouse_wid'])
@Index('idx_bsr_logistics_wh_contact_unique', ['warehouse_wid', 'contact_id'], { unique: true })
@Entity('app_amz_bsr_logistics_warehouse_contact')
export class AppAmzBsrLogisticsWarehouseContactEntity extends BaseEntity {
  @Column({ comment: '领星仓库ID', type: 'int' })
  warehouse_wid: number;

  @Index()
  @Column({ comment: '联系人主表ID', type: 'int' })
  contact_id: number;

  @Index()
  @Column({ comment: '尝试优先级，数字越小越优先', type: 'int', default: 100 })
  priority: number;

  @Index()
  @Column({ comment: '是否启用: 0否,1是', type: 'tinyint', default: 1 })
  enabled: number;

  @Column({ comment: '备注', type: 'text', nullable: true })
  remark: string;
}
