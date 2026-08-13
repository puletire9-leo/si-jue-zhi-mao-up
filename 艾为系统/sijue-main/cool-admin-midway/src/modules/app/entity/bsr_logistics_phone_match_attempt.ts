import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 仓库联系人手机号匹配尝试日志。
 */
@Index('idx_bsr_logistics_phone_attempt_pkg_binding', ['package_id', 'warehouse_contact_binding_id'])
@Entity('app_amz_bsr_logistics_phone_match_attempt')
export class AppAmzBsrLogisticsPhoneMatchAttemptEntity extends BaseEntity {
  @Index()
  @Column({ comment: '包裹ID', type: 'int' })
  package_id: number;

  @Index()
  @Column({ comment: '采购单号', length: 80 })
  order_sn: string;

  @Column({ comment: '运单号', length: 100, nullable: true })
  tracking_no: string;

  @Index()
  @Column({ comment: '领星仓库ID', type: 'int', nullable: true })
  warehouse_wid: number;

  @Index()
  @Column({ comment: '仓库联系人绑定ID', type: 'int', nullable: true })
  warehouse_contact_binding_id: number;

  @Index()
  @Column({ comment: '联系人主表ID', type: 'int', nullable: true })
  contact_id: number;

  @Column({ comment: '本次尝试的手机号快照', length: 50, nullable: true })
  contact_phone: string;

  @Index()
  @Column({ comment: '快递100公司编码', length: 80, nullable: true })
  company_code: string;

  @Index()
  @Column({ comment: '是否匹配成功: 0否,1是', type: 'tinyint', default: 0 })
  success: number;

  @Column({ comment: '快递100返回码', length: 80, nullable: true })
  return_code: string;

  @Column({ comment: '返回/失败消息', length: 500, nullable: true })
  message: string;

  @Column({ comment: '关联快递100实时查询日志ID', type: 'int', nullable: true })
  query_log_id: number;
}
