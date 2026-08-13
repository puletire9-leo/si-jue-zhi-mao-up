import {BaseEntity} from '@cool-midway/core';
import {Column, Entity, Index} from 'typeorm';
import {ProductInfoSpiderResult} from "../interface/product-info-spider-result";

@Entity('app_amz_bsr_profit_common')
export class AppAmzBsrProfitCommon extends BaseEntity {

  @Column({comment: 'id', type: 'int', nullable: true})
  id: number;

  @Column({ type: 'int' , nullable: true})
  candidate_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  length: number;

  @Column({ type: 'decimal', precision: 6, scale: 2 , nullable: true})
  width: number;

  @Column({ type: 'decimal', precision: 6, scale: 2 , nullable: true})
  height: number;

  @Column({ type: 'decimal', precision: 6, scale: 2 , nullable: true})
  actual_weight: number;


}