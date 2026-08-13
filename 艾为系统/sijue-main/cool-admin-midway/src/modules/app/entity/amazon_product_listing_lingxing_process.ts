import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

@Entity('amazon_product_listing_lingxing_process')
export class AmazonProductListingLingxingProcessEntity extends BaseEntity {

  @Index()
  @Column({ comment: '编号', primary: true, type: 'int', unsigned: true, generated: 'increment' })
  id: number;
  
  @Column({ comment: '', type: 'int',  nullable: true})
  product_id: number;

  @Column({ comment: '产品编码', nullable: true, type: 'varchar', length: 50 })
  product_code: string;
 
  @Column({ comment: '可售量', nullable: true, type: 'int', unsigned: true, default: 0 })
  afn_fulfillable_quantity: number;

  @Column({ comment: '入库中', nullable: true, type: 'int', unsigned: true, default: 0 })
  afn_inbound_receiving_quantity: number;  

  @Column({ comment: '在途', nullable: true, type: 'int', unsigned: true, default: 0 })
  afn_inbound_shipped_quantity: number;

  @Column({ comment: '计划入库', nullable: true, type: 'int', unsigned: true, default: 0 })
  afn_inbound_working_quantity: number;

  @Column({ comment: '不可售', nullable: true, type: 'int', unsigned: true, default: 0 })
  afn_unsellable_quantity: number;

  @Column({ comment: '待发货', nullable: true, type: 'int', unsigned: true, default: 0 })
  reserved_customerorders: number;

  @Column({ comment: '调仓中', nullable: true, type: 'int', unsigned: true, default: 0 })
  reserved_fc_processing: number;

  @Column({ comment: '待调仓', nullable: true, type: 'int', unsigned: true, default: 0 })
  reserved_fc_transfers: number;

  @Column({ comment: 'asin', nullable: true, type: 'varchar', length: 15 })
  asin: string;

  @Column({ comment: 'asin链接', nullable: true, type: 'varchar', length: 255 })
  asin_url: string;

  @Column({ comment: '品牌id', nullable: true, type: 'int', unsigned: true })
  brand_id: number;

  @Column({ comment: '分类', nullable: true, type: 'varchar', length: 10 })
  category_text: string;

  @Column({ comment: '货币符号', nullable: true, type: 'varchar', length: 10 })
  currency_symbol: string;

  @Column({ comment: 'fba费用', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  fba_fee: number;

  @Column({ comment: '首单时间', nullable: true, type: 'datetime' })
  first_order_time: Date;

  @Column({ comment: 'fnsku', nullable: true, type: 'varchar', length: 15 })
  fnsku: string;

  @Column({ comment: '14日销售额', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  fourteen_amount: number;

  @Column({ comment: '14日广告费', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  fourteen_spend: number;

  @Column({ comment: '14日销量', nullable: true, type: 'int', unsigned: true })
  fourteen_volume: number;

  @Column({ comment: '配送方式', nullable: true, type: 'varchar', length: 5 })
  fulfillment_channel_type: string;

  @Column({ comment: '货币图标', nullable: true, type: 'varchar', length: 10 })
  icon: string;

  @Column({ comment: '领星主键', nullable: true, type: 'bigint', unsigned: true })
  lx_id: number;

  @Column({ comment: '图片链接', nullable: true, type: 'varchar', length: 255 })
  image_url: string;

  @Column({ comment: '是否配对', nullable: true, type: 'int', unsigned: true })
  is_pair: number;

  @Column({ comment: '是否父体', nullable: true, type: 'int', unsigned: true })
  is_parent: number;

  @Column({ comment: '商品名', nullable: true, type: 'varchar', length: 1024 })
  item_name: string;

  @Column({ comment: 'listingid', nullable: true, type: 'varchar', length: 15 })
  listing_id: string;

  @Column({ comment: '总价', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  landed_price: number;

  @Column({ comment: '售价', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  listing_price: number;

  @Column({ comment: '售价货币', nullable: true, type: 'varchar', length: 5 })
  listing_price_currency_code: string;

  @Column({ comment: '品名', nullable: true, type: 'varchar', length: 255 })
  local_name: string;

  @Column({ comment: '本地sku', nullable: true, type: 'varchar', length: 100 })
  local_sku: string;

  @Column({ comment: '站点', nullable: true, type: 'varchar', length: 10 })
  marketplace: string;

  @Column({ comment: '站点id', nullable: true, type: 'varchar', length: 15 })
  marketplace_id: string;

  @Column({ comment: 'msku', nullable: true, type: 'varchar', length: 50 })
  msku: string;

  @Column({ comment: '创建时间', nullable: true, type: 'datetime' })
  open_date_time: Date;

  @Column({ comment: '创建时间', nullable: true, type: 'varchar', length: 225 })
  open_date_time_str: string;

  @Column({ comment: '配对方式', nullable: true, type: 'varchar', length: 50 })
  pair_type: string;

  @Column({ comment: '父体asin', nullable: true, type: 'varchar', length: 15 })
  parent_asin: string;

  @Column({ comment: '品牌名', nullable: true, type: 'varchar', length: 50 })
  product_brand_text: string;

  @Column({ comment: '原产品productId', nullable: true, type: 'bigint' })
  org_product_id: number;

  @Column({ comment: '销量', nullable: true, type: 'int' })
  quantity: number;

  @Column({ comment: '排名', nullable: true, type: 'int' })
  bs_rank: number;

  @Column({ comment: '备注', nullable: true, type: 'varchar', length: 255 })
  remark: string;

  @Column({ comment: '评论数', nullable: true, type: 'int' })
  reviews_num: number;

  @Column({ comment: '店铺id', nullable: true, type: 'bigint', unsigned: true })
  sid: number;

  @Column({ comment: '卖家名', nullable: true, type: 'varchar', length: 255 })
  seller_name: string;

  @Column({ comment: '7日销售额', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  seven_amount: number;

  @Column({ comment: '7日广告费', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  seven_spend: number;

  @Column({ comment: '运费', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  shipping: number;

  @Column({ comment: '小类排名', nullable: true, type: 'varchar', length: 512 })
  small_rank: string;

  @Column({ comment: '评分', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  stars: number;

  @Column({ comment: '销售状态(0:停售,1:在售,2:已删除)', nullable: true, type: 'tinyint', default: 1 })
  status: number;

  @Column({ comment: '30天销售额', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  thirty_amount: number;

  @Column({ comment: '30天广告费', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  thirty_spend: number;

  @Column({ comment: '30天销量', nullable: true, type: 'int', unsigned: true })
  thirty_volume: number;

  @Column({ comment: '7日销量', nullable: true, type: 'int', unsigned: true })
  total_volume: number;

  @Column({ comment: '昨日销售额', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  yesterday_amount: number;

  @Column({ comment: '昨日广告费', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  yesterday_spend: number;

  @Column({ comment: '昨日销量', nullable: true, type: 'int', unsigned: true })
  yesterday_volume: number;

  @Column({ comment: '创建时间', nullable: true, type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  create_time: Date;

  @Column({ comment: '更新时间', nullable: true, type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  update_time: Date;

  @Column({ comment: '销量分析结果', nullable: true, type: 'int' })
  volume_analyze_result: number;

  @Column({ comment: '价格分析结果', nullable: true, type: 'int' })
  price_analyze_result: number;

  @Column({ comment: '在售时间', nullable: true, type: 'datetime' })
  on_sale_time: Date;

  @Column({ comment: '记录异常销售的状态：1：异常销售', nullable: true, type: 'int' })
  sale_analyze_result: number;

  @Column({ comment: '到货分析', nullable: true, type: 'int' })
  arrival_analyze_result: number;

  @Column({ comment: '是否需要更新销量预测', nullable: true, type: 'tinyint', default: 0 })
  is_update_quantity_estimate: number;

  @Column({ comment: '7天销量均值增长率', nullable: true, type: 'decimal', precision: 10, scale: 2 })
  growth_rate_quantity_7_days_avg: number;

  @Column({ comment: '7日销量(欧洲国家与英国分别汇总)', nullable: true, type: 'int', unsigned: true })
  total_volume_sum: number;

  @Column({ comment: '14日销量(欧洲国家与英国分别汇总)', nullable: true, type: 'int', unsigned: true })
  fourteen_volume_sum: number;

  @Column({ comment: '30天销量(欧洲国家与英国分别汇总)', nullable: true, type: 'int', unsigned: true })
  thirty_volume_sum: number;

  @Column({ comment: '产品状态', nullable: true, type: 'int', default: 0 })
  product_state: number;

  @Column({ comment: '过滤类型', nullable: true, type: 'int', default: 0 })
  filter_type: number;

  @Column({ comment: '是否销量预测参考目标', nullable: true, type: 'tinyint', default: 0 })
  is_quantity_estimate_target: number;

  @Column({ comment: '标签', nullable: true, type: 'int' })
  label: number;

  @Column({ comment: '价格', nullable: true, default: 0 })
  price: string;

  @Column({ comment: '价格(取优惠价和价格两者最低价)', nullable: true, type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_target: number;

  
  @Column({ comment: '识图状态', nullable: true, type: 'int', default: 0 })
  image_state: number;

  @Column({ comment: '商品名关键词', nullable: true, type: 'varchar', length: 1024 })
  item_name_key: string;

  @Column({ comment: '任务id', nullable: true, type: 'varchar', length: 100 })
  requestId: string;
  
  @Column({ comment: '百度云图片签名', default: 0 , nullable: true})
  cont_sign: string;

  @Column({comment: '是否上传阿里云',length: 2, nullable: true})
  isUpload: string;

  @Column({comment: '合并编号',length: 5, nullable: true})
  mergeId: string;
  
}
