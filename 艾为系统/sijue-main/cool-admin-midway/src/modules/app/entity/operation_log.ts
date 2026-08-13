import {BaseEntity} from '@cool-midway/core';
import {Entity, Column} from 'typeorm';

@Entity('app_operation_log')
export class AppOperationLogEntity extends BaseEntity {
  @Column({comment: '操作人', length: 255, nullable: true})
  via: string;

  @Column({comment: '类型 0-调价 1-补货', type: 'tinyint', nullable: true})
  type: number;

  @Column({comment: '描述', length: 2000, nullable: true})
  description: string;
}
