import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 我的销量与促销缓存表（领星数据）
 * 唯一键: store_id + asin + marketplace + msku
 */
@Entity('app_amz_bsr_sales_cache_lingxing')
@Index('uk_store_asin_market_msku', ['store_id', 'asin', 'marketplace', 'msku'], { unique: true })
export class AppAmzBsrSalesCacheLingxingEntity extends BaseEntity {

    @Column({ comment: '店铺ID' })
    store_id: number;

    @Column({ comment: 'ASIN', length: 50 })
    asin: string;

    @Column({ comment: '国家/站点', length: 50 })
    marketplace: string;

    @Column({ comment: 'MSKU，用于匹配领星API', length: 100, nullable: true })
    msku: string;

    /**
     * 我的月销量缓存
     * 格式: {"2026-01": {"value": 182, "updated_at": "2026-01-27"}, ...}
     */
    @Column({ comment: '我的月销量', type: 'json', nullable: true })
    my_sales_monthly: Record<string, { value: number; updated_at: string }>;

    /**
     * 我的周销量缓存
     * 格式: {"2026-01-20~2026-01-26": {"value": 45, "updated_at": "2026-01-27"}, ...}
     */
    @Column({ comment: '我的周销量', type: 'json', nullable: true })
    my_sales_weekly: Record<string, { value: number; updated_at: string }>;

    /**
     * 促销活动（秒杀）缓存
     * 格式: { 
     *   "promotion_id_1": { 
     *     "type": "Best Deal", 
     *     "start": "2026-01-23 00:00:00", 
     *     "end": "2026-01-28 23:59:59",
     *     "status": 1,
     *     "discount_price": "9.99",
     *     "discount_rate": "83.00",
     *     "name": "活动名称...",
     *     "updated_at": "2026-01-27"
     *   },
     *   ...
     * }
     */
    @Column({ comment: '促销活动(秒杀)', type: 'json', nullable: true })
    promotions_flash_sale: Record<string, {
        type: string;           // promotion_type_text (如 Best Deal)
        start: string;          // promotion_start_time
        end: string;            // promotion_end_time
        status: number;         // 1=进行中, 2=已结束, 3=未开始
        discount_price: string; // 折扣价
        discount_rate: string;  // 折扣率
        name: string;           // 活动名称
        updated_at: string;     // 更新时间
    }>;

    /**
     * 促销数据最后同步时间（用于判断是否需要更新，独立于 JSON 内容）
     */
    @Column({ comment: '促销最后同步时间', length: 20, nullable: true })
    promotion_last_sync: string;
}

