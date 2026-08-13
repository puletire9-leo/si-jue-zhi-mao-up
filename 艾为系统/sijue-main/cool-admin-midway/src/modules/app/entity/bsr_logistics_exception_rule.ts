import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购物流例外规则：不适合快递100自动识别/查询的物流来源
 */
@Entity('app_amz_bsr_logistics_exception_rule')
export class AppAmzBsrLogisticsExceptionRuleEntity extends BaseEntity {
  @Index({ unique: true })
  @Column({ comment: '采购单原始物流公司名', length: 120 })
  raw_company_name: string;

  @Index()
  @Column({ comment: '归一化公司名', length: 120 })
  normalized_name: string;

  @Index()
  @Column({ comment: '处理方式: manual_required/ignored/disabled', length: 40 })
  query_mode: string;

  @Index()
  @Column({ comment: '是否启用: 0否,1是', type: 'tinyint', default: 1 })
  enabled: number;

  @Column({ comment: '备注', type: 'text', nullable: true })
  remark: string;
}
