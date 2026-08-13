import {BaseEntity} from '@cool-midway/core';
import {Column, Entity, Index} from 'typeorm';
import {BsrTaskSpiderResult} from "../interface/bsr-task-spider-result";

@Entity('app_amz_bsr_task')
export class AppAmzBsrTaskEntity extends BaseEntity {
  @Column({comment: 'BSR 的 URL 链接'})
  bsr_link: string;

  @Column({comment: '国家', length: 20})
  marketplace: string;

  @Column({comment: '榜单所属类目', nullable: true, type: 'text'})
  category: string;

  @Column({comment: '备注', nullable: true, type: 'text'})
  remark: string;

  @Column({comment: '价格最小值', type: 'double', precision: 10, scale: 2, nullable: true})
  price_min: number;

  @Column({comment: '价格最大值', type: 'double', precision: 10, scale: 2, nullable: true})
  price_max: number;

  @Column({comment: '评论数最小值', type: 'int', nullable: true})
  review_min: number;

  @Column({comment: '评论数最大值', type: 'int', nullable: true})
  review_max: number;

  @Column({comment: '评价星级最小值', type: 'double', precision: 10, scale: 2, nullable: true})
  last_star_min: number;

  @Column({comment: '重量最小值', type: 'double', precision: 10, scale: 2, nullable: true})
  weight_min: number;

  @Column({comment: '重量最大值', type: 'double', precision: 10, scale: 2, nullable: true})
  weight_max: number;

  @Column({comment: '类目排名（不低于）', type: 'int', nullable: true})
  bsr_rank_max: number;

  @Column({comment: '配送方式 0-⾃营 1-FBA 2-FBM', type: 'json', nullable: true})
  delivery_type: number[];

  @Column({comment: '上架时间', type: 'datetime', nullable: true})
  date_first_available: Date;

  @Column({comment: '卖家所属国家', type: 'json', nullable: true})
  seller_countries: string[];


  @Column({comment: '任务状态 0-待执⾏ 1-调研中 2-已完成 102-爬虫中', default: 0, type: 'tinyint'})
  status: number;

  @Column({comment: '爬虫结果', type: 'json', nullable: true})
  spider_res: BsrTaskSpiderResult;
  

  @Column({comment: '变体数最小值', type: 'int', nullable: true})
  variants_min: number;
  

  @Column({comment: '变体数最大值', type: 'int', nullable: true}) 
  variants_max: number;
  
  @Column({comment: '排除关键词', nullable: true})
  exclude_key: string;
  
  @Column({comment: '排除包裹类型', nullable: true})
  exclude_package: string;
}
