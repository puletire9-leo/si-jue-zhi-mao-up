import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * Oxylabs API 调用日志表
 * 记录每次 Oxylabs 接口调用的详细信息，用于监控消耗和排查问题
 */
@Entity('app_oxylabs_api_log')
export class AppOxylabsApiLogEntity extends BaseEntity {

    @Index()
    @Column({ comment: '调用日期 YYYY-MM-DD', length: 10 })
    call_date: string;

    @Index()
    @Column({ comment: 'API 接口路径', length: 200 })
    api_path: string;

    @Column({ comment: 'HTTP 方法 GET/POST', length: 10 })
    http_method: string;

    @Column({ comment: '请求类型（search/product/ads/images）', length: 50, nullable: true })
    request_type: string;

    @Column({ comment: '关键词/ASIN内容（如有）', length: 500, nullable: true })
    query_content: string;

    @Column({ comment: '国家/站点', length: 20, nullable: true })
    country: string;

    @Column({ comment: '页数', type: 'int', default: 1, nullable: true })
    pages: number;

    @Column({ comment: '计费次数（=1）', type: 'int', default: 1 })
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

    @Column({ comment: '调用位置描述', length: 200, nullable: true })
    call_location: string;
}