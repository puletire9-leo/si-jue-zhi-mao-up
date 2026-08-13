import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 百度翻译 API 调用日志表
 * 记录每次百度翻译接口调用的详细信息，用于监控消耗和排查问题
 */
@Entity('app_baidu_translate_api_log')
export class AppBaiduTranslateApiLogEntity extends BaseEntity {

    @Index()
    @Column({ comment: '调用日期 YYYY-MM-DD', length: 10 })
    call_date: string;

    @Index()
    @Column({ comment: 'API 接口路径', length: 200 })
    api_path: string;

    @Column({ comment: 'HTTP 方法 GET/POST', length: 10 })
    http_method: string;

    @Column({ comment: '翻译关键词数量', type: 'int', default: 0 })
    keyword_count: number;

    @Column({ comment: '关键词内容（最多存前5个）', length: 500, nullable: true })
    keywords_sample: string;

    @Column({ comment: '源语言', length: 10, nullable: true })
    from_lang: string;

    @Column({ comment: '目标语言', length: 10, nullable: true })
    to_lang: string;

    @Column({ comment: '文本长度（字符数）', type: 'int', default: 0 })
    text_length: number;

    @Column({ comment: '计费次数（按字符数计算）', type: 'int', default: 1 })
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