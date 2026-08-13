import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 选品-采购计划中间表
 * 点击"做"时创建，串联选品和领星采购计划
 */
@Entity('app_amz_bsr_candidate_purchase_plan')
export class AppAmzBsrCandidatePurchasePlanEntity extends BaseEntity {
  @Index('idx_candidate_purchase_plan_sample_status')
  @Column({ comment: '选品ID', type: 'int', nullable: true })
  candidate_id: number;

  @Column({ comment: 'ASIN', length: 20, nullable: true })
  asin: string;

  @Column({ comment: '国家', length: 20, nullable: true })
  marketplace: string;

  @Column({ comment: '选品SKU', length: 64, nullable: true })
  sku: string;

  @Column({ comment: '领星SKU（传给采购计划API的）', length: 64, nullable: true })
  lingxing_sku: string;

  @Column({ comment: '店铺ID (seller_account_id)', length: 64, nullable: true })
  store_id: string;

  @Index()
  @Column({ comment: '采购分配记录ID', type: 'int', nullable: true })
  purchaser_record_id: number;

  @Column({ comment: '店铺名称', length: 255, nullable: true })
  account_name: string;

  @Column({ comment: '采购计划批次号（领星返回）', length: 64, nullable: true })
  ppg_sn: string;

  @Index()
  @Column({ comment: '采购计划编号（领星返回）', length: 64, nullable: true })
  plan_sn: string;

  @Column({ comment: '类型 1=常规采购 2=样品采购', type: 'tinyint', nullable: true })
  type: number;

  @Index()
  @Column({ comment: '样品采购系统状态 1=已下单 2=已采购 3=已完成', type: 'tinyint', default: 1 })
  sample_status: number;

  @Column({ comment: '样品采购人工完成时间', type: 'datetime', nullable: true })
  sample_completed_time: Date;

  @Column({ comment: '样品采购人工完成人ID', type: 'int', nullable: true })
  sample_completed_by: number;

  @Column({ comment: '样品采购人工完成人', length: 64, nullable: true })
  sample_completed_by_name: string;

  @Column({ comment: '采购数量', type: 'int', nullable: true, default: 0 })
  quantity_plan: number;

  @Column({ comment: '备注', length: 500, nullable: true })
  remark: string;

  @Column({ comment: '操作人ID', type: 'int', nullable: true })
  operator_id: number;

  @Column({ comment: '操作人', length: 64, nullable: true })
  operator_name: string;

  @Column({ comment: '操作人领星ID', length: 32, nullable: true })
  operator_lingxing_id: string;
}
