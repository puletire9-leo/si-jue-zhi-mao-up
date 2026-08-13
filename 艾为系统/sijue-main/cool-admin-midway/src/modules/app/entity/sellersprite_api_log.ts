import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 卖家精灵 API 调用日志表
 * 记录每次卖家精灵接口调用的详细信息，用于监控消耗和排查问题
 */
@Entity('app_sellersprite_api_log')
export class AppSellerspriteApiLogEntity extends BaseEntity {

    @Index()
    @Column({ comment: '调用日期 YYYY-MM-DD', length: 10 })
    call_date: string;

    @Index()
    @Column({ comment: 'API 接口路径', length: 200 })
    api_path: string;

    @Column({ comment: 'HTTP 方法 GET/POST', length: 10 })
    http_method: string;

    @Column({ comment: 'ASIN数量（如有）', type: 'int', default: 0 })
    asin_count: number;

    @Column({ comment: 'ASIN内容（如有，最多存前5个）', length: 500, nullable: true })
    asins_sample: string;

    @Column({ comment: '国家/站点', length: 20, nullable: true })
    country: string;

    @Column({ comment: '月份参数（如有）', length: 10, nullable: true })
    month: string;

    @Column({ comment: '计费次数（=ASIN数或1）', type: 'int', default: 1 })
    credit_count: number;

    @Column({ comment: '响应状态码', type: 'int', nullable: true })
    response_code: number;

    @Column({ comment: '耗时(ms)', type: 'int', nullable: true })
    duration_ms: number;

    @Column({ comment: '是否成功', type: 'tinyint', default: 1 })
    is_success: number;

    @Column({ comment: '错误信息', type: 'text', nullable: true })
    error_message: string;

    @Column({ comment: '调用来源（哪个service/方法）', length: 200, nullable: true, default: null })
    caller: string;

    @Column({ comment: '调用位置描述（如：选品获取竞品详情、领星获取竞品详情等）', length: 200, nullable: true })
    call_location: string;
}