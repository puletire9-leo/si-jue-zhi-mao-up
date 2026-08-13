import {BaseEntity} from '@cool-midway/core';
import {Column, Entity, Index} from 'typeorm';
import {ProductInfoSpiderResult} from "../interface/product-info-spider-result";

@Entity('app_amz_bsr_candidate_customize')
export class AppAmzBsrCandidateCustomizeeEntity extends BaseEntity {
  
  @Column({comment: 'BSR 爬虫任务的 id', type: 'int', nullable: true})
  bsr_task_id: number;

  @Column({comment: 'BSR 的 URL 链接', nullable: true})
  bsr_link: string;

  @Column({comment: '国家', length: 20, nullable: true})
  marketplace: string;

  @Index()
  @Column({comment: 'ASIN', nullable: true})
  asin: string;
  @Column({comment: 'ASINID', nullable: true})
  asinid: string;

  @Column({comment: 'SKU', nullable: true})
  sku: string;

  @Column({comment: 'MSKU', nullable: true})
  msku: string;

  @Column({comment: '卖家id', nullable: true})
  seller_id: string;

  @Column({comment: '产品标题', nullable: true})
  item_name: string;

  @Column({comment: '产品名称', nullable: true})
  produce_name: string;

  @Column({comment: '主图链接', nullable: true})
  image_url: string;

  @Column({comment: '图片链接',length: 200, nullable: true})
  image_url2: string;

  @Column({comment: '图片链接',length: 200, nullable: true})
  image_url3: string;

  @Column({comment: '图片链接',length: 200, nullable: true})
  image_url4: string;

  @Column({comment: '图片链接',length: 200, nullable: true})
  image_url5: string;

  @Column({comment: '图片链接',length: 200, nullable: true})
  image_url6: string;
  
  @Column({comment: '图片链接',length: 200, nullable: true})
  aliyun_img: string;

  @Column({comment: '价格', type: 'double', nullable: true})
  price: number;

  @Column({comment: '评论数量', nullable: true})
  review_num: number;

  @Column({comment: '变体数量', nullable: true})
  variants: number;

  @Column({comment: '星级评分', type: 'float', precision: 2, scale: 1, nullable: true})
  last_star: number;

  @Column({comment: 'BSR 信息（直接从商品详情页面摘取的文字）', length: 10000, nullable: true})
  bsr_html: string;

  @Column({comment: 'BSR 类目', nullable: true})
  bsr_category: string;

  @Column({comment: 'BSR 排名', default: 0, nullable: true})
  bsr_rank: number;
  

  @Column({comment: 'BSR 节点', nullable: true})
  bsr_node: string;

  @Column({comment: 'BSR 节点排名', default: 0, nullable: true})
  bsr_node_rank: number;

  @Column({comment: '配送方', nullable: true})
  dispatches_from: string;

  @Column({comment: '售卖方', nullable: true})
  sold_by: string;

  @Column({comment: '五点描述', type: 'text', nullable: true})
  bullet_points: string;

  @Column({comment: '尺寸', nullable: true})
  dimensions: string;

  @Column({comment: '重量', nullable: true})
  weight: string;

  @Column({comment: '上架时间', nullable: true})
  date_first_available: Date;

  @Column({comment: '卖家所属国家', nullable: true})
  seller_country: string;


  @Column({comment: '成本价', type: 'double', precision: 10, scale: 2, nullable: true})
  cost_price: number;

  @Column({comment: '售价', type: 'double', precision: 10, scale: 2, nullable: true})
  selling_price: number;

  @Column({comment: '长度', type: 'double', precision: 5, scale: 2, nullable: true})
  length: number;

  @Column({comment: '宽度', type: 'double', precision: 5, scale: 2, nullable: true})
  width: number;

  @Column({comment: '高度', type: 'double', precision: 5, scale: 2, nullable: true})
  height: number;

  @Column({comment: '抛重', type: 'double', precision: 5, scale: 2, nullable: true})
  dimensional_weight: number;

  @Column({comment: '实重', type: 'double', precision: 5, scale: 2, nullable: true})
  actual_weight: number;

  @Column({comment: '头程运费', type: 'double', precision: 5, scale: 2, nullable: true})
  first_leg_freight: number;

  @Column({comment: 'FBA 配送费', type: 'double', precision: 5, scale: 2, nullable: true})
  fba_freight: number;

  @Column({comment: '汇率', type: 'double', precision: 5, scale: 2, nullable: true})
  exchange_rate: number;

  @Column({comment: '税率', type: 'double', precision: 5, scale: 2, nullable: true})
  tax_rate: number;

  @Column({comment: '毛利率', type: 'double', precision: 5, scale: 2, nullable: true})
  gross_profit_rate: number;

  @Column({comment: '毛利润', type: 'double', precision: 10, scale: 2, nullable: true})
  gross_profit: number;

  @Column({comment:'描述', type: 'json', nullable: true})
  describe: string[];

  @Column({comment: '专利情况', type: 'text', nullable: true})
  patent_memo: string;

  @Column({comment: '开发意见', type: 'text', nullable: true})
  opinion_dev: string;

  @Column({comment: '运营意见', type: 'text', nullable: true})
  opinion_operator: string;

  @Column({comment: '采购意见', type: 'text', nullable: true})
  opinion_procurement: string;

  @Column({comment: '工厂链接', type: 'json', nullable: true})
  factory_links: string[];

  @Column({comment: '关键词搜索量截图', type: 'json', nullable: true})
  keyword_screenshots: string[];

  @Column({comment: '状态 2-待入库 3-待精选 4-已入库 5-已归档', default: 2, type: 'tinyint'})
  status: number;


  @Column({comment: '竞品调研状态 0-待调研 1-调研中 2-已调研', default: 0, type: 'tinyint'})
  competitor_spider_status: number;

  @Column({comment: '竞品爬虫结果', type: 'json', nullable: true})
  competitor_spider_res: Array<ProductInfoSpiderResult>;

  @Column({comment: '竞品爬虫的最近一次执行时间', type: 'datetime', nullable: true})
  competitor_spider_time: Date;


  @Column({comment: '榜单备注', type: 'text', nullable: true})
  remark: string;


  @Column({ comment: '最大采购量', default: 0 , nullable: true})
  max_purchase: number; // 新增字段

  

  @Column({comment: '材料',length: 20, nullable: true})
  material: string;
  @Column({comment: '颜色',length: 20, nullable: true})
  color: string;
  @Column({comment: '尺码',length: 20, nullable: true})
  size: string;
  @Column({comment: '单位计数', default: 0, nullable: true})
  unit_count: number;
  @Column({comment: '产品数量', default: 0, nullable: true})
  product_quantity: number;

  @Column({comment: '来源 1-数据选品，2-1688选品，3-新增变体', type: 'int', nullable: true})
  source: number;
  
}
