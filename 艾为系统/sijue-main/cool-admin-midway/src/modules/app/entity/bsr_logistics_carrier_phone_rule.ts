import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 快递公司手机号规则。替代代码里的顺丰/中通硬编码。
 */
@Index('idx_bsr_logistics_phone_rule_code', ['company_code'], { unique: true })
@Entity('app_amz_bsr_logistics_carrier_phone_rule')
export class AppAmzBsrLogisticsCarrierPhoneRuleEntity extends BaseEntity {
  @Column({ comment: '快递100公司编码', length: 80 })
  company_code: string;

  @Column({ comment: '快递公司名称', length: 120, nullable: true })
  company_name: string;

  @Index()
  @Column({ comment: '是否需要手机号: 0否,1是', type: 'tinyint', default: 0 })
  need_phone: number;

  @Index()
  @Column({ comment: '是否启用: 0否,1是', type: 'tinyint', default: 1 })
  enabled: number;

  @Column({ comment: '备注', type: 'text', nullable: true })
  remark: string;
}
