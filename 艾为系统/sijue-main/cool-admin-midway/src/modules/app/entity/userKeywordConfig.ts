import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 用户关键词配置表
 * 每个用户在每个产品（product_code + marketplaces）下
 * 可以设置最多 3 个默认关键词
 */
@Entity('app_user_keyword_config')
@Index('uk_user_product', ['user_id', 'product_code', 'marketplaces'], { unique: true })
export class AppUserKeywordConfigEntity extends BaseEntity {

    @Index()
    @Column({ comment: '用户ID', type: 'int' })
    user_id: number;

    @Column({ comment: 'ASIN（历史兼容字段，不再作为关联键）', length: 255, nullable: true })
    asin: string;

    @Column({ comment: '产品编码', length: 255 })
    product_code: string;

    @Column({ comment: '国家（中文，如"英国"）', length: 255 })
    marketplaces: string;

    @Column({
        comment: '默认关键词ID数组，最多3个，存 app_amz_listing_keyword 的 id',
        type: 'json',
        nullable: true,
    })
    default_keyword_ids: number[];
}
