import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index, Unique } from 'typeorm';

/**
 * 关键词跟踪汇总表
 * 预计算每个 Listing 的综合得分和落后率，供列表页快速读取
 * 每次快照采集完成后自动更新
 *
 * 唯一标识一条记录: user_id + asin_self + marketplace + product_code + msku + store_id + summary_date
 */
@Entity('app_amz_bsr_keyword_tracking_summary')
@Unique('uk_biz_date', ['user_id', 'asin_self', 'marketplace', 'product_code', 'msku', 'store_id', 'summary_date'])
export class AppAmzBsrKeywordTrackingSummaryEntity extends BaseEntity {

    @Index()
    @Column({ comment: '用户ID', type: 'int' })
    user_id: number;

    @Index()
    @Column({ comment: '关联Listing表ID（app_amz_bsr_product_listing_lingxing.id）', type: 'int', nullable: true })
    listing_id: number;

    @Index()
    @Column({ comment: '主ASIN', length: 20 })
    asin_self: string;

    @Index()
    @Column({ comment: '国家/站点', length: 20 })
    marketplace: string;

    @Index()
    @Column({ comment: '产品代码', length: 50 })
    product_code: string;

    @Column({ comment: 'MSKU', length: 200, nullable: true })
    msku: string;

    @Column({ comment: '店铺ID', type: 'int', nullable: true })
    store_id: number;

    @Column({ comment: '汇总日期', type: 'date' })
    summary_date: string;

    @Column({ comment: '自然位综合分（自己的均分）', type: 'decimal', precision: 10, scale: 2, nullable: true })
    score_nf: number;

    @Column({ comment: '广告位综合分（自己的均分）', type: 'decimal', precision: 10, scale: 2, nullable: true })
    score_sp: number;

    @Column({ comment: '总竞品数量', type: 'int', default: 0 })
    competitor_count: number;

    @Column({ comment: '自然分比自己高的竞品数', type: 'int', default: 0 })
    behind_count_nf: number;

    @Column({ comment: 'SP分比自己高的竞品数', type: 'int', default: 0 })
    behind_count_sp: number;

    @Column({ comment: '自然位落后率 (0~1)', type: 'decimal', precision: 5, scale: 4, nullable: true })
    behind_rate_nf: number;

    @Column({ comment: 'SP落后率 (0~1)', type: 'decimal', precision: 5, scale: 4, nullable: true })
    behind_rate_sp: number;

    @Column({ comment: '计算明细（JSON），保存原始数据供验证', type: 'longtext', nullable: true })
    calc_detail: string;

    @Column({ comment: '最后计算时间', type: 'datetime', nullable: true })
    last_calc_time: Date;
}
