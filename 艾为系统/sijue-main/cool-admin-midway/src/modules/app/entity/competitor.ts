import {BaseEntity} from '@cool-midway/core';
import {Column, Entity, Index} from 'typeorm';

@Entity('app_amz_listing_competitor')
export class AppAmzListingCompetitorEntity extends BaseEntity {
  @Index()
  @Column({comment: '店铺 sid', type: 'int'})
  sid: number;

  @Index()
  @Column({comment: '自己的 ASIN'})
  asin_mine: string;

  @Index()
  @Column({comment: 'MSKU', nullable: true})
  seller_sku: string;

  @Column({comment: '竞品 ASIN'})
  asin_competitor: string;

  @Column({comment: '竞品标题', nullable: true})
  item_name: string;

  @Column({comment: '竞品主图地址', nullable: true})
  image_url: string;

  @Column({comment: '价格', type: 'double', nullable: true})
  price: number;

  @Column({comment: '评论数量', nullable: true})
  review_num: number;

  @Column({comment: '星级评分', type: 'float', precision: 2, scale: 1, nullable: true})
  last_star: number;

  @Column({comment: 'BSR 信息（直接从商品详情页面摘取的文字）', length: 10000, nullable: true})
  bsr_html: string;

  @Column({comment: 'BSR 类目', nullable: true})
  bsr_category: string;

  @Column({comment: 'BSR 排名', default: 0, nullable: true})
  bsr_rank: number;

  @Column({comment: '配送方', nullable: true})
  dispatches_from: string;

  @Column({comment: '售卖方', nullable: true})
  sold_by: string;

  @Column({comment: '五点描述', type: 'text', nullable: true})
  bullet_points: string;

  @Column({comment: '状态 2-待入库 3-已入库 4-已归档', default: 2, type: 'tinyint'})
  status: number;

  @Column({comment: '是否为核心 0-否 1-是', default: 0, type: 'tinyint'})
  is_core: boolean;

  @Column({comment: '标签', type: 'json', nullable: true})
  tags: string[];

  @Column({comment: '产品信息爬虫的最近一次执行时间', type: 'datetime', nullable: true})
  spider_time: Date;
}
