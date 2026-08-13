import {BaseEntity} from '@cool-midway/core';
import {Entity, Column} from 'typeorm';

@Entity('app_amz_fx')
export class AppAmzFXEntity extends BaseEntity {

  @Column({comment: '汇率年月'})
  date: string;

  @Column({comment: '币种符号'})
  icon: string;

  @Column({comment: '币种名'})
  currencyName: string;
  
  @Column({comment: '官方汇率，数据来源中国银行官方汇率', type: 'double', precision: 5, scale: 2, nullable: true})
  rate_org: number;
 
  @Column({comment: '汇率更新时间', nullable: true})
  update_time: Date;

}