import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 批量补货单品运输方式偏好。
 *
 * 一条配置只属于一个用户和一个 Listing；listing_id 失效时用自然键兜底找回。
 */
@Entity('app_amz_bsr_replenish_shipping_method_pref')
@Index('uk_replenish_ship_pref_user_listing', ['user_id', 'listing_id'], {
  unique: true,
})
@Index(
  'uk_replenish_ship_pref_user_product',
  ['user_id', 'product_code', 'marketplace', 'asin', 'msku', 'store_id'],
  { unique: true }
)
export class AppAmzBsrReplenishShippingMethodPrefEntity extends BaseEntity {
  @Column({ comment: '用户ID', type: 'int' })
  user_id: number;

  @Column({ comment: '关联 Listing 表 ID（优先定位）', type: 'int', nullable: true })
  listing_id: number;

  @Column({ comment: '产品代码，如2521', length: 50 })
  product_code: string;

  @Column({ comment: '国家/站点，如英国', length: 50 })
  marketplace: string;

  @Column({ comment: 'ASIN', length: 50 })
  asin: string;

  @Column({ comment: 'MSKU', length: 100 })
  msku: string;

  @Column({ comment: '店铺ID', type: 'int' })
  store_id: number;

  @Column({
    comment: '关闭的运输方式 key 列表，如 ["truck", "rail"]',
    type: 'json',
    nullable: true,
  })
  inactive_methods: string[];

  @Column({ comment: '最后修改人名称', length: 100, nullable: true })
  updated_by_name: string;
}
