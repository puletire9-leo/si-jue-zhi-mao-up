import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 批量补货目标库存天数配置。
 *
 * 定位方式：
 * 1. 优先使用 listing_id 快速命中；
 * 2. listing_id 失效时，用 product_code + marketplace + asin + msku + store_id 兜底找回。
 */
@Entity('app_amz_bsr_replenish_target_stock_days')
@Index('idx_replenish_target_listing', ['listing_id'])
@Index('uk_replenish_target_product', ['product_code', 'marketplace', 'asin', 'msku', 'store_id'], { unique: true })
export class AppAmzBsrReplenishTargetStockDaysEntity extends BaseEntity {
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

    @Column({ comment: '目标库存天数', type: 'int', nullable: true })
    target_days: number;

    @Column({ comment: '最后修改人ID', type: 'int', nullable: true })
    updated_by: number;

    @Column({ comment: '最后修改人名称', length: 100, nullable: true })
    updated_by_name: string;
}
