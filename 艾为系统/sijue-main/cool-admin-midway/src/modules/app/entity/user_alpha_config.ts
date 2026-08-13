import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 用户自定义 α 权重配置表
 *
 * 用于综合走势算法4：用户可以针对每条 listing 记录保存逐月自定义 α 权重。
 * 一条 listing + 一个用户 = 一条配置。
 *
 * 定位方式：
 *   1. 优先用 listing_id（精确）
 *   2. 备选用 product_code + marketplace + asin + msku（组合定位）
 *
 * α 决定了「销量系数」和「搜索系数」的混合比例：
 *   综合系数 = α × 销量系数 + (1-α) × 搜索系数
 *
 * 优先级链：前端传参 > 本表配置 > 系统自动计算
 */
@Entity('app_amz_user_alpha_config')
@Index('idx_user_listing', ['user_id', 'listing_id'], { unique: true })
@Index('idx_user_product_full', ['user_id', 'product_code', 'marketplace', 'asin', 'msku', 'store_id'])
export class AppAmzUserAlphaConfigEntity extends BaseEntity {

    @Column({ comment: '用户ID', type: 'int' })
    user_id: number;

    @Column({ comment: '关联Listing表ID（主定位方式）', type: 'int', nullable: true })
    listing_id: number;

    @Column({ comment: '产品代码，如1461', length: 50 })
    product_code: string;

    @Column({ comment: '国家/站点，如英国', length: 50 })
    marketplace: string;

    @Column({ comment: 'ASIN', length: 20, nullable: true })
    asin: string;

    @Column({ comment: 'MSKU', length: 200, nullable: true })
    msku: string;

    @Column({ comment: '店铺ID', type: 'int', nullable: true })
    store_id: number;

    @Column({
        comment: '全局默认α（null=走系统计算）',
        type: 'decimal', precision: 4, scale: 3, nullable: true
    })
    default_alpha: number;

    @Column({
        comment: '逐月自定义α，格式: {"2026-04": 0.5, "2026-05": 0.8}',
        type: 'json', nullable: true
    })
    monthly_alphas: Record<string, number>;

    @Column({
        comment: '逐月备注，格式: {"2026-04": "大促月调低权重"}',
        type: 'json', nullable: true
    })
    monthly_remarks: Record<string, string>;
}
