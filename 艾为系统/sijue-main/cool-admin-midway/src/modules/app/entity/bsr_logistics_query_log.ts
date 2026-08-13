import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 物流接口调用日志，用于统计和审计真实外部调用
 */
@Entity('app_amz_bsr_logistics_query_log')
export class AppAmzBsrLogisticsQueryLogEntity extends BaseEntity {
  @Index()
  @Column({ comment: '物流服务商', length: 40 })
  provider: string;

  @Index()
  @Column({ comment: '采购单号', length: 80 })
  order_sn: string;

  @Index()
  @Column({ comment: '包裹ID', type: 'int', nullable: true })
  package_id: number;

  @Column({ comment: '运单号', length: 100, nullable: true })
  tracking_no: string;

  @Index()
  @Column({ comment: '快递公司编码', length: 80, nullable: true })
  company_code: string;

  @Index()
  @Column({ comment: '是否成功: 0否,1是', type: 'tinyint', default: 0 })
  success: number;

  @Column({ comment: '服务商通讯状态status', length: 40, nullable: true })
  provider_status: string;

  @Column({ comment: '服务商物流状态state', length: 40, nullable: true })
  provider_state: string;

  @Column({ comment: '返回码', length: 80, nullable: true })
  return_code: string;

  @Column({ comment: '返回消息', length: 500, nullable: true })
  message: string;

  @Column({ comment: '请求耗时毫秒', type: 'int', nullable: true })
  duration_ms: number;

  @Index()
  @Column({ comment: '查询日期', type: 'date' })
  query_date: string;

  @Index()
  @Column({ comment: '调用人ID', type: 'int', nullable: true })
  created_by_user_id: number;

  @Column({ comment: '调用人用户名', length: 100, nullable: true })
  created_by_username: string;
}
