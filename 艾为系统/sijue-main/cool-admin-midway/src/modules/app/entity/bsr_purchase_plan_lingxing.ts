import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购计划表 - 存储从领星同步的采购计划数据
 */
@Entity('app_amz_bsr_purchase_plan_lingxing')
export class AppAmzBsrPurchasePlanLingxingEntity extends BaseEntity {
    // ========== 唯一标识 ==========
    @Index({ unique: true })
    @Column({ comment: '采购计划编号(唯一)', length: 50 })
    plan_sn: string;

    @Column({ comment: '采购计划批次号', length: 50, nullable: true })
    ppg_sn: string;

    // ========== 产品信息 ==========
    @Column({ comment: 'SKU', length: 100, nullable: true })
    sku: string;

    @Column({ comment: '品名', length: 500, nullable: true })
    product_name: string;

    @Column({ comment: '产品图片', length: 500, nullable: true })
    pic_url: string;

    @Column({ comment: '商品ID', type: 'int', nullable: true })
    product_id: number;

    @Column({ comment: 'FNSKU', length: 50, nullable: true })
    fnsku: string;

    @Column({ comment: 'MSKU', type: 'json', nullable: true })
    msku: string[];

    @Column({ comment: 'SPU', length: 100, nullable: true })
    spu: string;

    @Column({ comment: '款名', length: 200, nullable: true })
    spu_name: string;

    @Column({ comment: '属性', type: 'json', nullable: true })
    attribute: any[];

    // ========== 店铺信息 ==========
    @Column({ comment: '店铺ID(领星)', type: 'bigint', nullable: true })
    sid: string;

    @Column({ comment: '店铺名称', length: 200, nullable: true })
    seller_name: string;

    @Column({ comment: '国家/站点', length: 50, nullable: true })
    marketplace: string;

    // ========== 采购信息 ==========
    @Column({ comment: '计划采购量', type: 'int', nullable: true })
    quantity_plan: number;

    @Column({ comment: '单箱数量', type: 'int', nullable: true })
    cg_box_pcs: number;

    @Column({ comment: '期望到货时间', type: 'date', nullable: true })
    expect_arrive_time: Date;

    // ========== 状态信息 ==========
    @Column({ comment: '状态值: 2待采购, -2已完成, 121待审批, 122已驳回, -3/124已作废', type: 'int', nullable: true })
    status: number;

    @Column({ comment: '状态文本', length: 50, nullable: true })
    status_text: string;

    // ========== 供应商/仓库信息 ==========
    @Column({ comment: '供应商ID', type: 'int', nullable: true })
    supplier_id: number;

    @Column({ comment: '供应商名称', length: 200, nullable: true })
    supplier_name: string;

    @Column({ comment: '仓库ID', type: 'int', nullable: true })
    wid: number;

    @Column({ comment: '仓库名称', length: 200, nullable: true })
    warehouse_name: string;

    @Column({ comment: '采购方ID', type: 'int', nullable: true })
    purchaser_id: number;

    @Column({ comment: '采购方名称', length: 200, nullable: true })
    purchaser_name: string;

    // ========== 采购员信息 ==========
    @Column({ comment: '采购员ID', type: 'int', nullable: true })
    cg_uid: number;

    @Column({ comment: '采购员名称', length: 100, nullable: true })
    cg_opt_username: string;

    // ========== 创建人信息 ==========
    @Column({ comment: '创建人ID', type: 'int', nullable: true })
    creator_uid: number;

    @Column({ comment: '创建人名称', length: 100, nullable: true })
    creator_real_name: string;

    @Column({ comment: '领星创建时间', type: 'datetime', nullable: true })
    create_time_remote: Date;

    @Column({ comment: '领星更新时间', type: 'datetime', nullable: true })
    update_time_remote: Date;

    @Column({ comment: '领星修改时间', type: 'datetime', nullable: true })
    gmt_modified: Date;

    // ========== 分组/权限/审核 ==========
    @Column({ comment: '产品分组ID', type: 'int', nullable: true })
    group_id: number;

    @Column({ comment: '权限用户名列表(JSON)', type: 'json', nullable: true })
    perm_username: string[];

    @Column({ comment: '审核人ID列表(JSON)', type: 'json', nullable: true })
    audit_uids: number[];

    // ========== 备注/附件 ==========
    @Column({ comment: '产品备注', type: 'text', nullable: true })
    remark: string;

    @Column({ comment: '计划备注', type: 'text', nullable: true })
    plan_remark: string;

    @Column({ comment: '附件列表(JSON)', type: 'json', nullable: true })
    file: any[];

    // ========== 标记字段 ==========
    @Column({ comment: '是否为组合商品: 0否,1是', type: 'tinyint', default: 0 })
    is_combo: number;

    @Column({ comment: '是否为辅料: 0否,1是', type: 'tinyint', default: 0 })
    is_aux: number;

    @Column({ comment: '是否关联加工计划: 0否,1是', type: 'tinyint', default: 0 })
    is_related_process_plan: number;

    // ========== 本地管理字段 ==========
    @Column({ comment: '领星端是否已删除: 0否,1是', type: 'tinyint', default: 0 })
    is_deleted_remote: number;

    @Column({ comment: '最后同步时间', type: 'datetime', nullable: true })
    sync_time: Date;

    @Column({ comment: '关联的分析记录ID', type: 'int', nullable: true })
    analysis_record_id: number;
}
