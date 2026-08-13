import {BaseEntity} from '@cool-midway/core';
import {Column, Entity, Index} from 'typeorm';
import {ProductInfoSpiderResult} from "../interface/product-info-spider-result";

@Entity('app_amz_bsr_candidate_purchaser')
export class AppAmzBsrCandidatePurchaserEntity extends BaseEntity {
    @Index()

  @Column({comment: 'candidate_id', nullable: true})
  candidate_id: string;

  @Column({comment: '提交采购人', nullable: true})
  purchaser: string;

  @Column({comment: '提交采购人ID', nullable: true})
  userId: string;

  @Column({comment: '采购数',  type: 'json', nullable: true})
  purchaserNum: string;

  @Column({comment: '国家启用标志', type: 'json', nullable: true})
  country_enabled: string;

  @Column({comment: '做/不做', nullable: true})
  is_generate: number;

  @Column({comment: '采购意见', nullable: true})
  procurement: string;

  @Column({comment: '不做理由', type: 'text', nullable: true})
  reject_reason: string;

  @Column({comment: '进入待决策时间', type: 'datetime', nullable: true})
  decision_assigned_at: Date;

  @Column({comment: '待决策钉钉提醒时间', type: 'datetime', nullable: true})
  decision_reminded_at: Date;

  @Column({comment: '组合变体', nullable: true})
  selectedVariant: string;

  @Column({comment: '选中的变体 id（app_amz_bsr_candidate_variant.id）', length: 36, nullable: true})
  selected_variant_id: string | null;

  @Column({ comment: '店铺账号 id', length: 64, nullable: true })
  seller_account_id: string;

  @Column({ comment: '店铺账户名称', length: 255, nullable: true })
  account_name: string;

  @Column({comment: 'MSKU 业务编号', length: 128, nullable: true})
  msku: string;

}
