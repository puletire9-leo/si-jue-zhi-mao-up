import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 关键词跟踪配置表
 * 记录用户开启跟踪的关键词，定时任务每天采集数据
 */
@Entity('app_amz_bsr_keyword_tracking')
export class AppAmzBsrKeywordTrackingEntity extends BaseEntity {

    @Index()
    @Column({ comment: '用户ID', type: 'int', nullable: true })
    user_id: number;

    @Index()
    @Column({ comment: '关键词ID（关联sif_keyword表）', type: 'int', nullable: true })
    keyword_id: number;

    @Column({ comment: '关键词文本', length: 500, nullable: true })
    keyword_value: string;

    @Index()
    @Column({ comment: '国家/站点', length: 20, nullable: true })
    marketplace: string;

    @Index()
    @Column({ comment: '产品代码', length: 20, nullable: true })
    product_code: string;

    @Column({ comment: '主ASIN（开启跟踪时的ASIN）', length: 20, nullable: true })
    asin_self: string;

    @Index()
    @Column({ comment: '关联Listing表ID（app_amz_bsr_product_listing_lingxing.id）', type: 'int', nullable: true })
    listing_id: number;

    @Column({ comment: 'MSKU（开启跟踪时的Listing MSKU）', length: 200, nullable: true })
    msku: string;

    @Index()
    @Column({ comment: '店铺ID（开启跟踪时的Listing store_id）', type: 'int', nullable: true })
    store_id: number;

    @Column({ comment: '跟踪页数（默认3页）', type: 'int', default: 3 })
    pages_to_track: number;

    @Column({ comment: '状态 1-跟踪中 0-已关闭', type: 'tinyint', default: 1 })
    status: number;

    @Column({ comment: '最后采集时间', type: 'datetime', nullable: true })
    last_snapshot_time: Date;

    @Column({ comment: '是否精选 1-精选 0-普通', type: 'tinyint', default: 0 })
    is_featured: number;
}
