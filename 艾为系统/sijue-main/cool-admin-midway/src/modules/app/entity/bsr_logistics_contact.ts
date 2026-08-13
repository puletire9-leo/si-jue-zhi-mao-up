import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 物流联系人主数据。一个联系人可以绑定多个仓库。
 */
@Index('idx_bsr_logistics_contact_phone', ['contact_phone'], { unique: true })
@Entity('app_amz_bsr_logistics_contact')
export class AppAmzBsrLogisticsContactEntity extends BaseEntity {
  @Column({ comment: '联系人名称', length: 100, nullable: true })
  contact_name: string;

  @Column({ comment: '联系人手机号/校验号码', length: 50 })
  contact_phone: string;

  @Index()
  @Column({ comment: '是否启用: 0否,1是', type: 'tinyint', default: 1 })
  enabled: number;

  @Column({ comment: '备注', type: 'text', nullable: true })
  remark: string;
}
