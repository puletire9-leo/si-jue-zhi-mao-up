import {BaseEntity} from '@cool-midway/core';
import {Column, Entity} from 'typeorm';

@Entity('app_amz_bsr_department_rank_filter')
export class AppAmzDepartmentRankFilterEntity extends BaseEntity {
  @Column({comment: '站点', length: 20})
  marketplace: string;

  @Column({comment: '类目名称'})
  department: string;

  @Column({comment: '排名（不低于）', nullable: true})
  rank_limit: number;
}
