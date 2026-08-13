import {BaseEntity} from '@cool-midway/core';
import {Column, Entity, Index} from 'typeorm';

import {KeywordSearchVolumeData} from "../interface/keyword-search-volume-data";
@Entity('app_amz_bsr_candidate_competitor_customize')
export class AppAmzBsrCandidateCompetitorCustomizeEntity extends BaseEntity {
  @Index()
  @Column({comment: 'BSR 选品的 ID', type: 'int', nullable: true})
  candidate_id: number;

  @Index()
  @Column({comment: 'BSR 选品的 ASIN', nullable: true})
  asin_candidate: string;

  @Column({comment: '竞品 ASIN', nullable: true})
  asin_competitor: string;

  @Column({comment: '竞品标题', nullable: true})
  item_name: string;

  @Column({comment: '竞品主图地址', nullable: true})
  image_url: string;
  
  @Column({comment: '国家', length: 20, nullable: true})
  marketplace: string;

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
  

  @Column({comment: 'BSR 节点编号', nullable: true})
  bsr_node_id: string;

  @Column({comment: 'BSR 节点', nullable: true})
  bsr_node: string;

  @Column({comment: 'BSR 节点排名', default: 0, nullable: true})
  bsr_node_rank: number;

  @Column({comment: '配送方', nullable: true})
  dispatches_from: string;

  @Column({comment: '售卖方', nullable: true})
  sold_by: string;

  @Column({comment: '卖家ID', nullable: true})
  sold_byID: string;

  @Column({comment: '配送方式', nullable: true})
  dispatches_type: string;
  
  @Column({comment: '描述', nullable: true})
  description: string;


  @Column({comment: '五点描述', type: 'text', nullable: true})
  bullet_points: string;

  @Column({comment: '状态 2-待入库 3-已入库 4-已归档', default: 1, type: 'tinyint'})
  status: number;

  @Column({comment: '产品信息爬虫的最近一次执行时间', type: 'datetime', nullable: true})
  spider_time: Date;

  @Column({comment: '日均单量', type: 'int', nullable: true})
  daily_order_items: number;

  @Column({comment: '预估销量', type: 'double', nullable: true})
  expected_volume: number;
  
  @Column({comment: '上架时间', nullable: true})
  date_first_available: Date; 

  

  @Column({comment: '父体月销',  length: 10, nullable: true})
  Main_monthly_sales: string;
  @Column({comment: '子体月销',  length: 10, nullable: true})
  Main_monthly_sales_sub: string;

  @Column({comment: '库存数量', type: 'int', nullable: true})
  stock_quantity: number;

  @Column({comment: 'FBA配送费', type: 'double', nullable: true})
  FBA_price: number;

  @Column({comment: '尺寸', nullable: true})
  dimensions: string;

  @Column({comment: '重量', nullable: true})
  weight: string;


  @Column({comment: '变体数量', nullable: true})
  variants: number;


  @Column({comment: '月销量', type: 'json', nullable: true})
  sales_volume_data: Array<KeywordSearchVolumeData>;

  

  @Column({comment: '竞品图地址1', nullable: true})
  img1: string;

  @Column({comment: '竞品图地址2', nullable: true})
  img2: string;

  @Column({comment: '竞品图地址3', nullable: true})
  img3: string;

  @Column({comment: '竞品图地址4', nullable: true})
  img4: string;

  @Column({comment: '竞品图地址5', nullable: true})
  img5: string;

  @Column({comment: '竞品图地址6', nullable: true})
  img6: string;
}
