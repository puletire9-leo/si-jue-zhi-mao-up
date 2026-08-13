import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 关键词跟踪每日快照表
 * 每天定时任务采集一次，保存原始数据和分析结果
 */
@Entity('app_amz_bsr_keyword_tracking_snapshot')
export class AppAmzBsrKeywordTrackingSnapshotEntity extends BaseEntity {

    @Index()
    @Column({ comment: '关联跟踪配置表ID', type: 'int' })
    tracking_id: number;

    @Index()
    @Column({ comment: '快照日期 YYYY-MM-DD', length: 10 })
    snapshot_date: string;

    @Column({ comment: '总商品数', type: 'int', nullable: true })
    total_result_count: number;

    @Column({ comment: '原始API返回数据（JSON）', type: 'longtext', nullable: true })
    raw_data: string;

    @Column({ comment: '分析结果（JSON）：我的排名/公司排名/竞品排名', type: 'longtext', nullable: true })
    analysis_data: string;
}
