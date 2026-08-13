import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';
import { KeywordSearchVolumeData } from "../interface/keyword-search-volume-data";
import { KeywordSpiderResult } from "../interface/keyword-spider-result";

@Entity('app_amz_listing_keyword')
export class AppAmzListingKeywordEntity extends BaseEntity {
  @Index()
  @Column({ comment: '店铺 sid', type: 'int', nullable: true })
  sid: number;

  @Index()
  @Column({ comment: 'ASIN', nullable: true })
  asin: string;

  @Index()
  @Column({ comment: 'MSKU', nullable: true })
  seller_sku: string;

  @Column({ comment: '关键词内容' })
  value: string;

  @Column({ comment: '关键词对应标题', nullable: true })
  title: string;


  @Column({ comment: '关键词类型', nullable: true })
  keyword_type: string;

  @Column({ comment: '评分1 图片相似度度评分', type: 'decimal', precision: 5, scale: 2, nullable: true })
  score1: number;

  @Column({ comment: '评分2 关键词匹配度评分', type: 'decimal', precision: 5, scale: 2, nullable: true })
  score2: number;

  @Column({ comment: '评分时间', type: 'datetime', nullable: true })
  score_time: Date;

  @Column({ comment: '状态 0-待调研 1-调研中 2-待入库 3-已入库 4-已归档', default: 0, type: 'tinyint', nullable: true })
  status: number;

  @Column({ comment: '是否为核心关键词 0-否 1-是', default: 0, type: 'tinyint', nullable: true })
  is_core: boolean;

  @Column({ comment: '权重', type: 'double', default: 1, nullable: true })
  weight: number;


  @Column({ comment: '标签', type: 'json', nullable: true })
  tags: string[];

  @Column({ comment: '爬虫结果', type: 'json', nullable: true })
  spider_res: Array<KeywordSpiderResult>;

  @Column({ comment: '搜索量数据', type: 'json', nullable: true })
  search_volume_data: Array<KeywordSearchVolumeData>;

  @Column({ comment: '月搜索量数据', type: 'int', nullable: true })
  search_volume_monthly: number;
  @Column({ comment: '月搜索量数据查询日期', type: 'datetime', nullable: true, default: null })
  search_volume_monthly_update_time: Date;

  @Column({ comment: '国家', length: 20, nullable: true })
  marketplaces: string;



  @Column({ comment: '关键词中文意思', nullable: true })
  value_cn: string;

  @Column({ comment: '广告竞品数', type: 'decimal', precision: 5, scale: 2, nullable: true })
  ad_competitor_count: number;

  @Column({ comment: 'PPC竞价', type: 'decimal', precision: 5, scale: 2, nullable: true })
  ppc_bid: number;

  @Column({ comment: 'PPC竞价最大值', type: 'decimal', precision: 5, scale: 2, nullable: true })
  ppc_bid_max: number;

  @Column({ comment: 'PPC竞价最小值', type: 'decimal', precision: 5, scale: 2, nullable: true })
  ppc_bid_min: number;

  @Column({ comment: '任务源 ASIN', nullable: true })
  task_asin: string;

  @Column({ comment: '流量占比', type: 'decimal', precision: 5, scale: 4, nullable: true })
  trafficPercentage: number;

  @Column({
    comment: '搜索结果详情(ASIN和URL键值对)',
    type: 'json',
    nullable: true
  })
  result_details: Array<{ asin: string; url_image: string }>;

  // ========== 我们自己设计的字段（SIF接口不返回，我们用于业务管理） ==========

  @Column({ comment: '产品编码', nullable: true })
  product_code: string;

  @Column({ comment: 'SIF-来源竞品ASIN列表(JSON数组)，记录通过哪些竞品ASIN查出此关键词', type: 'json', nullable: true })
  sif_source_asins: string[];

  @Column({ comment: 'SIF-按月完整数据(我们自己组装的JSON数组，将接口多条记录打包保存)', type: 'json', nullable: true })
  sif_monthly_data: Array<{ startDate: string; searchVolume: number; searchRank: number; naturalRank: number; spRank: number; updateTime: string }>;

  @Column({ comment: 'SIF-我们获取数据的时间（我们什么时候调的接口）', type: 'datetime', nullable: true })
  sif_update_time: Date;

  // ========== SIF 接口原始返回字段（取最新一期的值，方便SQL直接查询排序） ==========

  @Column({ comment: 'SIF接口-日搜索量 searchVolume（最新一期）', type: 'int', nullable: true })
  sif_search_volume: number;

  @Column({ comment: 'SIF接口-ABA排名 searchRank（最新一期）', type: 'int', nullable: true })
  sif_search_rank: number;

  @Column({ comment: 'SIF接口-自然排名 naturalPositionSeq[0].allPageRank（最新一期）', type: 'int', nullable: true })
  sif_natural_rank: number;

  @Column({ comment: 'SIF接口-SP广告排名 spPositionSeq[0].allPageRank（最新一期）', type: 'int', nullable: true })
  sif_sp_rank: number;

  @Column({ comment: 'SIF接口-数据更新时间 updateTime（接口原始返回的，最新一期）', type: 'datetime', nullable: true })
  sif_update_time_origin: Date;

  @Column({ comment: 'SIF接口-覆盖率加权流量得分 (累加score × 出现ASIN数/总ASIN数)', type: 'decimal', precision: 10, scale: 2, nullable: true })
  sif_score: number;

  @Column({ comment: '查询时总竞品ASIN数量（用于追溯加权得分计算）', type: 'int', nullable: true })
  sif_total_competitor_count: number;

  // ========== SIF 搜索趋势历史（estSearchesHistory 接口） ==========

  @Column({ comment: 'SIF-搜索趋势历史(JSON数组，格式[{date,searches,searchRank}]，按月维度)', type: 'json', nullable: true })
  sif_search_history: Array<{ date: string; searches: number; searchRank: number }>;

  @Column({ comment: 'SIF-最新月搜索量（取sif_search_history最新一期的searches值）', type: 'int', nullable: true })
  sif_search_volume_monthly: number;

  @Column({ comment: 'SIF搜索趋势同步时间', type: 'datetime', nullable: true })
  sif_search_history_update_time: Date;

  // ===== 用户绑定 =====
  @Column({ comment: '入库该关键词的用户ID列表(JSON数组)', type: 'simple-json', nullable: true })
  bound_user_ids: number[];
}
