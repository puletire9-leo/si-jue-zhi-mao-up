import {BaseEntity} from '@cool-midway/core';
import {Column, Entity, Index} from 'typeorm';

import {KeywordSearchVolumeData} from "../interface/keyword-search-volume-data";
@Entity('app_amz_bsr_candidate_competitor')
// 2026-02-26: Modified multiple columns (item_name, image_url, bsr_html, dimensions, etc.) from VARCHAR to TEXT to resolve ER_TOO_BIG_ROWSIZE error.
export class AppAmzBsrCandidateCompetitorEntity extends BaseEntity {
  @Index()
  @Column({comment: 'BSR 选品的 ID', type: 'int', nullable: true})
  candidate_id: number;

  @Index()
  @Column({comment: 'BSR 选品的 ASIN', nullable: true})
  asin_candidate: string;

  @Column({comment: '竞品 ASIN', nullable: true})
  asin_competitor: string;

  @Column({comment: '竞品标题', type: 'text', nullable: true})
  item_name: string;

  @Column({comment: '竞品主图地址', type: 'text', nullable: true})
  image_url: string;
  
  @Column({comment: '国家', length: 20, nullable: true})
  marketplace: string;

  @Column({comment: '价格',  nullable: true})
  price: string;

  @Column({comment: '评论数量', nullable: true})
  review_num: number;

  @Column({comment: '星级评分', type: 'float', precision: 3, scale: 2, nullable: true})
  last_star: number;

  @Column({comment: 'BSR 信息（直接从商品详情页面摘取的文字）', type: 'text', nullable: true})
  bsr_html: string;

  @Column({comment: 'BSR 类目', nullable: true})
  bsr_category: string;

  @Column({comment: 'BSR 排名', default: 0, nullable: true})
  bsr_rank: number;
  

  @Column({comment: 'BSR 节点', nullable: true})
  bsr_node: string;

  @Column({comment: 'BSR 节点排名', default: 0, nullable: true})
  bsr_node_rank: number;

  @Column({comment: 'BSR 节点编号', nullable: true})
  bsr_node_id: string;
  

  @Column({comment: '配送方', nullable: true})
  dispatches_from: string;

  @Column({comment: '售卖方', nullable: true})
  sold_by: string;

  @Column({comment: '卖家ID', nullable: true})
  sold_byID: string;

  @Column({comment: '配送方式', nullable: true})
  dispatches_type: string;

  @Column({comment: '五点描述', type: 'text', nullable: true})
  bullet_points: string;

  @Column({comment: '状态 1-关键词 2-待入库 3-已入库 4-已归档 9-非同款竞品', default: 1, type: 'tinyint'})
  status: number;

  @Column({comment: '产品信息爬虫的最近一次执行时间', type: 'datetime', nullable: true})
  spider_time: Date;

  @Column({comment: '日均单量', type: 'int', nullable: true})
  daily_order_items: number;

  @Column({comment: '预估销量', type: 'double', nullable: true})
  expected_volume: number;
  
  @Column({comment: '上架时间', nullable: true})
  date_first_available: Date; 

  @Column({comment: '日均单量', type: 'int', nullable: true})
  Main_monthly_sales: number;
  
  @Column({comment: '子体月销',  length: 10, nullable: true})
  Main_monthly_sales_sub: string;

  @Column({comment: '库存数量', length: 10, nullable: true})
  stock_quantity: string;
  
  @Column({comment: '库存更新时间', nullable: true})
  stock_date: Date; 


  @Column({comment: 'FBA配送费', type: 'double', nullable: true})
  FBA_price: number;

  @Column({comment: '尺寸', type: 'text', nullable: true})
  dimensions: string;

  @Column({comment: '重量', type: 'text', nullable: true})
  weight: string;


  @Column({comment: '变体数量', nullable: true})
  variants: number;


  @Column({comment: '月销量', type: 'json', nullable: true })
  sales_volume_data: Array<KeywordSearchVolumeData>;

  

  @Column({comment: '竞品图地址1', type: 'text', nullable: true})
  img1: string;

  @Column({comment: '竞品图地址2', type: 'text', nullable: true})
  img2: string;

  @Column({comment: '竞品图地址3', type: 'text', nullable: true})
  img3: string;

  @Column({comment: '竞品图地址4', type: 'text', nullable: true})
  img4: string;

  @Column({comment: '竞品图地址5', type: 'text', nullable: true})
  img5: string;

  @Column({comment: '竞品图地址6', type: 'text', nullable: true})
  img6: string;

  
  @Column({comment: '相关性得分', type: 'float', precision: 3, scale: 2, nullable: true})
  similarity_score: number;

  @Column({comment: '标题关键词', type: 'text', nullable: true})
  title_keywords: string;

  @Column({comment: '标题命中得分', type: 'float', precision: 4, scale: 2, nullable: true})
  title_hit_score: number;

  
  @Column({comment: '关联位置', length: 20, nullable: true})
  associated: string;

  
  @Column({comment: '来源 1-以图识图,2-推荐位,3-搜索页,4-获取详情', type: 'int', nullable: true})
  source: number;

  
  @Column({comment: '爬取库存状态', length: 5, nullable: true})
  inventory_status: string;

  @Column({comment: '库存类型', length: 20, nullable: true})
  inventory_type: string;

  @Column({comment: '父asin', length: 20, nullable: true})
  parent_asin: string;

  @Column({comment: '月销售额(父体)', type: 'double', nullable: true})
  revenue: number;

  @Column({comment: '销售额(子体)', type: 'double', nullable: true})
  amz_sales: number;

  @Column({comment: '月销量增长率(父体)', type: 'float', nullable: true})
  units_gr: number;

  @Column({comment: 'Prime价格', type: 'double', nullable: true})
  prime_price: number;

  @Column({comment: '卖家运费', type: 'double', nullable: true})
  delivery_price: number;

  @Column({comment: '利润率', type: 'float', nullable: true})
  profit_rate: number;

  @Column({comment: 'BSR增长率', type: 'float', nullable: true})
  bsr_cr: number;

  @Column({comment: 'BSR增长数', type: 'int', nullable: true})
  bsr_cv: number;

  @Column({comment: '留评率', type: 'float', nullable: true})
  ratings_rate: number;

  @Column({comment: '评分月度增长数', type: 'int', nullable: true})
  ratings_cv: number;

  @Column({comment: '近30天新增评论数', type: 'int', nullable: true})
  rating_delta: number;

  @Column({
    comment: '标识信息', 
    type: 'text', 
    nullable: true,
    transformer: {
      to: (value) => {
        if (value === null || value === undefined) return value;
        // 如果已经是字符串，尝试解析再序列化以验证JSON格式，或者直接返回
        // 简单策略：如果是对象则序列化，如果是字符串则保持原样
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      },
      from: (value) => {
        if (typeof value === 'string') {
          // 尝试解析，如果失败则作为普通字符串返回，不抛错
          try {
            return JSON.parse(value);
          } catch (e) {
            return value;
          }
        }
        return value;
      }
    }
  })
  badge_info: any;

  @Column({comment: '是否畅销', length: 10, nullable: true})
  symbol: string;

  @Column({comment: 'Listing质量得分', type: 'float', nullable: true})
  lqs: number;

  @Column({comment: '关键词自然得分', type: 'int', nullable: true, default: 0})
  keyword_organic_score: number;

  @Column({comment: '关键词广告得分', type: 'int', nullable: true, default: 0})
  keyword_ad_score: number;

  @Column({comment: '包装尺寸', type: 'text', nullable: true})
  pkg_dimensions: string;

  @Column({comment: '包装重量', type: 'text', nullable: true})
  pkg_weight: string;

  @Column({comment: '尺寸类型', type: 'text', nullable: true})
  dimensions_type: string;

  @Column({comment: '包装尺寸类型', type: 'text', nullable: true})
  pkg_dimension_type: string;

  @Column({comment: '品牌', type: 'text', nullable: true})
  brand: string;

  @Column({comment: '品牌URL', type: 'text', nullable: true})
  brand_url: string;

  @Column({comment: '卖家数', type: 'int', nullable: true})
  sellers: number;

  @Column({comment: '卖家国籍', type: 'text', nullable: true})
  seller_nation: string;

  @Column({comment: '节点ID路径', type: 'text', nullable: true})
  node_id_path: string;

  @Column({comment: '子体销量更新日期', type: 'datetime', nullable: true})
  amz_unit_date: Date;

  @Column({
    comment: 'SKU属性', 
    type: 'text', 
    nullable: true,
    transformer: {
      to: (value) => {
        if (value === null || value === undefined) return value;
        // 简单策略：如果是对象则序列化，如果是字符串则保持原样
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
      },
      from: (value) => {
        if (typeof value === 'string') {
          // 尝试解析，如果失败则作为普通字符串返回，不抛错
          try {
            return JSON.parse(value);
          } catch (e) {
            return value;
          }
        }
        return value;
      }
    }
  })
  sku_info: any;
  
}
