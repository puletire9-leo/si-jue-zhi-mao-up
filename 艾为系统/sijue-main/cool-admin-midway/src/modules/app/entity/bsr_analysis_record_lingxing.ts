import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

@Entity('app_amz_bsr_analysis_record_lingxing')
export class AppAmzBsrAnalysisRecordLingxingEntity extends BaseEntity {
    @Column({ comment: '店铺ID', type: 'bigint' })
    store_id: number;

    @Column({ comment: 'ASIN', length: 50 })
    asin: string;

    @Column({ comment: '国家/站点', length: 50 })
    marketplace: string;

    @Column({ comment: 'MSKU', length: 100, nullable: true })
    msku: string;

    @Column({ comment: '预计销量数据(JSON)', type: 'json', nullable: true })
    expected_sales: any;

    @Column({ comment: '系统备注', type: 'text', nullable: true })
    remark: string;

    @Column({ comment: '人工备注', type: 'text', nullable: true })
    manual_remark: string;

    @Column({ comment: '暂存人ID', type: 'int', nullable: true })
    staged_by_user_id: number;

    @Column({ comment: '暂存人用户名', length: 100, nullable: true })
    staged_by_username: string;

    @Column({ comment: '暂存人昵称', length: 100, nullable: true })
    staged_by_nickname: string;

    @Column({ comment: '暂存时间', type: 'datetime', nullable: true })
    staged_time: Date;

    @Column({ comment: '采购计划创建人ID', type: 'int', nullable: true })
    purchase_plan_created_by_user_id: number;

    @Column({ comment: '采购计划创建人用户名', length: 100, nullable: true })
    purchase_plan_created_by_username: string;

    @Column({ comment: '采购计划创建人昵称', length: 100, nullable: true })
    purchase_plan_created_by_nickname: string;

    @Column({ comment: '采购计划创建时间', type: 'datetime', nullable: true })
    purchase_plan_created_time: Date;

    @Column({
        comment: '状态: 0-暂存(最新), 1-完结(已生成补货单), 2-历史覆盖(过往暂存), 3-已过期作废',
        type: 'tinyint',
        default: 0,
    })
    status: number;

    // ========== 采购计划关联字段 ==========
    @Column({ comment: '本地SKU', length: 100, nullable: true })
    local_sku: string;

    @Column({ comment: '采购计划批次号', length: 50, nullable: true })
    ppg_sn: string;

    @Column({ comment: '采购计划编号', length: 50, nullable: true })
    plan_sn: string;

    @Column({ comment: '计划采购量', type: 'int', nullable: true })
    quantity_plan: number;
}
