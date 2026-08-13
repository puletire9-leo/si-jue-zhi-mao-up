import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购单子项表 - 存储采购单中的商品明细
 */
@Entity('app_amz_bsr_purchase_order_item_sync_lingxing')
export class AppAmzBsrPurchaseOrderItemSyncLingxingEntity extends BaseEntity {
    // ============================================================
    // ==================== 领星API返回字段 =======================
    // ============================================================

    // ========== 关联字段 ==========
    @Index()
    @Column({ comment: '采购单号(关联主表)', length: 50 })
    order_sn: string;

    @Column({ comment: '领星子项ID', type: 'bigint', nullable: true })
    item_id: string;

    @Index()
    @Column({ comment: '采购计划号(关联analysis_record)', length: 50, nullable: true })
    plan_sn: string;

    @Column({ comment: '更多采购计划号(JSON)', type: 'json', nullable: true })
    relation_purchase_plan: string[];

    // ========== 产品信息 ==========
    @Column({ comment: '本地产品ID', type: 'bigint', nullable: true })
    product_id: string;

    @Column({ comment: '品名', length: 200, nullable: true })
    product_name: string;

    @Column({ comment: 'SKU', length: 100, nullable: true })
    sku: string;

    @Column({ comment: 'FNSKU', length: 50, nullable: true })
    fnsku: string;

    @Column({ comment: 'MSKU(JSON)', type: 'json', nullable: true })
    msku: string[];

    @Column({ comment: '型号', length: 100, nullable: true })
    model: string;

    @Column({ comment: 'SPU', length: 100, nullable: true })
    spu: string;

    @Column({ comment: '款名', length: 200, nullable: true })
    spu_name: string;

    @Column({ comment: '属性(JSON)', type: 'json', nullable: true })
    attribute: any[];

    // ========== 仓库/店铺信息 ==========
    @Column({ comment: '仓库ID', type: 'int', nullable: true })
    wid: number;

    @Column({ comment: '仓库名称', length: 200, nullable: true })
    ware_house_name: string;

    @Column({ comment: '店铺ID', type: 'bigint', nullable: true })
    sid: string;

    // ========== 价格信息 ==========
    @Column({ comment: '含税单价', type: 'decimal', precision: 12, scale: 4, nullable: true })
    price: number;

    @Column({ comment: '价税合计', type: 'decimal', precision: 12, scale: 2, nullable: true })
    amount: number;

    @Column({ comment: '税率', length: 20, nullable: true })
    tax_rate: string;

    // ========== 数量信息 ==========
    @Column({ comment: '计划采购量', type: 'int', nullable: true })
    quantity_plan: number;

    @Column({ comment: '实际采购量', type: 'int', nullable: true })
    quantity_real: number;

    @Column({ comment: '入库量', type: 'int', nullable: true })
    quantity_entry: number;

    @Column({ comment: '待到货量', type: 'int', nullable: true })
    quantity_receive: number;

    @Column({ comment: '退货数', type: 'int', nullable: true })
    quantity_return: number;

    @Column({ comment: '换货量', type: 'int', nullable: true })
    quantity_exchange: number;

    @Column({ comment: '质检量', type: 'int', nullable: true })
    quantity_qc: number;

    @Column({ comment: '待质检量', type: 'int', nullable: true })
    quantity_qc_prepare: number;

    @Column({ comment: '箱数', type: 'int', nullable: true })
    cases_num: number;

    @Column({ comment: '单箱数量', type: 'int', nullable: true })
    quantity_per_case: number;

    // ========== 其他信息 ==========
    @Column({ comment: '期待到货时间', type: 'date', nullable: true })
    expect_arrive_time: Date;

    @Column({ comment: '备注', type: 'text', nullable: true })
    remark: string;

    @Column({ comment: '领星删除标记: 0否,1是', type: 'tinyint', default: 0 })
    is_delete: number;

    @Column({ comment: '自定义字段(JSON)', type: 'json', nullable: true })
    custom_fields: any[];

    // ============================================================
    // ==================== 本地管理字段 ==========================
    // ============================================================

    @Index()
    @Column({ comment: '关联的分析记录ID', type: 'int', nullable: true })
    analysis_record_id: number;

    @Column({ comment: '分析记录是否缺失: 0正常,1缺失(plan_sn存在但analysis_record已删除)', type: 'tinyint', default: 0 })
    is_analysis_missing: number;

    // ========== 采购计划关联信息 (从 plan_sn 关联采购计划表获取) ==========
    @Column({ comment: '采购计划-产品图片', length: 500, nullable: true })
    plan_pic_url: string;

    @Column({ comment: '采购计划-创建人', length: 100, nullable: true })
    plan_creator_name: string;

    @Column({ comment: '采购计划-领星创建时间', type: 'datetime', nullable: true })
    plan_create_time: Date;

    @Column({ comment: '采购计划-供应商名称', length: 200, nullable: true })
    plan_supplier_name: string;

    @Column({ comment: '采购计划-仓库名称', length: 200, nullable: true })
    plan_warehouse_name: string;

    @Column({ comment: '采购计划-店铺名称', length: 200, nullable: true })
    plan_seller_name: string;

    @Column({ comment: '采购计划-国家/站点', length: 50, nullable: true })
    plan_marketplace: string;

    @Index()
    @Column({ comment: '首个MSKU（从JSON msku数组提取，用于快速连表Listing）', length: 255, nullable: true })
    first_msku: string;
}
