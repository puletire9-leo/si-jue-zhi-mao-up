import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 采购单主表 - 存储从领星同步的采购单数据
 */
@Entity('app_amz_bsr_purchase_order_sync_lingxing')
export class AppAmzBsrPurchaseOrderSyncLingxingEntity extends BaseEntity {
    // ============================================================
    // ==================== 领星API返回字段 =======================
    // ============================================================

    // ========== 唯一标识 ==========
    @Index({ unique: true })
    @Column({ comment: '采购单号(唯一)', length: 50 })
    order_sn: string;

    @Column({ comment: '自定义单号', length: 50, nullable: true })
    custom_order_sn: string;

    // ========== 供应商信息 ==========
    @Column({ comment: '供应商ID', type: 'bigint', nullable: true })
    supplier_id: string;

    @Column({ comment: '供应商名', length: 200, nullable: true })
    supplier_name: string;

    // ========== 仓库信息 ==========
    @Column({ comment: '仓库ID', type: 'int', nullable: true })
    wid: number;

    @Column({ comment: '仓库名', length: 200, nullable: true })
    ware_house_name: string;

    @Column({ comment: '仓库名(备份)', length: 200, nullable: true })
    ware_house_bak_name: string;

    // ========== 状态信息 ==========
    @Column({ comment: '采购单状态: -1作废,1待下单,2待签收,3待提交,9完成,121待审核,122驳回,124作废', type: 'int', nullable: true })
    status: number;

    @Column({ comment: '状态文本', length: 50, nullable: true })
    status_text: string;

    @Column({ comment: '到货状态: 1未到货,2部分到货,3全部到货', type: 'tinyint', nullable: true })
    status_shipped: number;

    @Column({ comment: '到货状态文本', length: 50, nullable: true })
    status_shipped_text: string;

    @Column({ comment: '付款状态: 0未申请,1已申请,2部分付款,3已付款', type: 'tinyint', nullable: true })
    pay_status: number;

    @Column({ comment: '付款状态文本', length: 50, nullable: true })
    pay_status_text: string;

    // ========== 数量信息 ==========
    @Column({ comment: '采购总量', type: 'int', nullable: true })
    quantity_total: number;

    @Column({ comment: '入库量', type: 'int', nullable: true })
    quantity_entry: number;

    @Column({ comment: '实际采购量', type: 'int', nullable: true })
    quantity_real: number;

    @Column({ comment: '待到货量', type: 'int', nullable: true })
    quantity_receive: number;

    // ========== 金额信息 ==========
    @Column({ comment: '货物总价', type: 'decimal', precision: 12, scale: 2, nullable: true })
    amount_total: number;

    @Column({ comment: '总金额', type: 'decimal', precision: 12, scale: 2, nullable: true })
    total_price: number;

    @Column({ comment: '运费', type: 'decimal', precision: 12, scale: 2, nullable: true })
    shipping_price: number;

    @Column({ comment: '其他费用', type: 'decimal', precision: 12, scale: 2, nullable: true })
    other_fee: number;

    @Column({ comment: '应付货款(手工)', type: 'decimal', precision: 12, scale: 2, nullable: true })
    payment: number;

    // ========== 币种信息 ==========
    @Column({ comment: '采购币种', length: 10, nullable: true })
    purchase_currency: string;

    @Column({ comment: '采购汇率', type: 'decimal', precision: 10, scale: 4, nullable: true })
    purchase_rate: number;

    @Column({ comment: '运费币种', length: 10, nullable: true })
    shipping_currency: string;

    @Column({ comment: '其他费用币种', length: 10, nullable: true })
    other_currency: string;

    @Column({ comment: '币种符号', length: 10, nullable: true })
    icon: string;

    // ========== 人员信息 ==========
    @Column({ comment: '采购员ID', type: 'bigint', nullable: true })
    opt_uid: string;

    @Column({ comment: '操作人姓名', length: 100, nullable: true })
    opt_realname: string;

    @Column({ comment: '审核人ID', type: 'bigint', nullable: true })
    auditor_uid: string;

    @Column({ comment: '审核人姓名', length: 100, nullable: true })
    auditor_realname: string;

    @Column({ comment: '最后操作人ID', type: 'bigint', nullable: true })
    last_uid: number;

    // 非数据库字段，仅用于前端显示
    related_plans?: string[];

    @Column({ comment: '最后操作人姓名', length: 100, nullable: true })
    last_realname: string;

    @Column({ comment: '单据负责人(JSON)', type: 'json', nullable: true })
    principal_uids: any[];

    // ========== 时间信息 ==========
    @Column({ comment: '领星创建时间', type: 'datetime', nullable: true })
    create_time_remote: Date;

    @Column({ comment: '下单时间', type: 'datetime', nullable: true })
    order_time: Date;

    @Column({ comment: '审核时间', type: 'datetime', nullable: true })
    auditor_time: Date;

    @Column({ comment: '最后操作时间', type: 'datetime', nullable: true })
    last_time: Date;

    @Column({ comment: '领星更新时间', type: 'datetime', nullable: true })
    update_time_remote: Date;

    // ========== 其他信息 ==========
    @Column({ comment: '采购方ID', type: 'int', nullable: true })
    purchaser_id: number;

    @Column({ comment: '联系人', length: 100, nullable: true })
    contact_person: string;

    @Column({ comment: '联系方式', length: 50, nullable: true })
    contact_number: string;

    @Column({ comment: '结算方式: 7现结,8月结', type: 'tinyint', nullable: true })
    settlement_method: number;

    @Column({ comment: '结算描述', length: 200, nullable: true })
    settlement_description: string;

    @Column({ comment: '支付方式', type: 'bigint', nullable: true })
    payment_method: string;

    @Column({ comment: '是否含税: 0否,1是', type: 'tinyint', nullable: true })
    is_tax: number;

    @Column({ comment: '费用分摊方式: 0不分摊,1按金额,2按数量', type: 'tinyint', nullable: true })
    fee_part_type: number;

    @Column({ comment: '作废原因', type: 'text', nullable: true })
    reason: string;

    @Column({ comment: '备注', type: 'text', nullable: true })
    remark: string;

    @Column({ comment: '采购类型: 1普通采购,2 1688采购', type: 'tinyint', nullable: true })
    purchase_type: number;

    @Column({ comment: '采购类型文本', length: 50, nullable: true })
    purchase_type_text: string;

    @Column({ comment: '1688订单号', length: 100, nullable: true })
    alibaba_order_sn: string;

    @Column({ comment: '1688订单状态', length: 50, nullable: true })
    sub_status: string;

    @Column({ comment: '1688订单状态文本', length: 100, nullable: true })
    sub_status_text: string;

    @Column({ comment: '自定义字段(JSON)', type: 'json', nullable: true })
    custom_fields: any[];

    @Column({ comment: '物流信息(JSON)', type: 'json', nullable: true })
    logistics_info: any[];

    // ============================================================
    // ==================== 本地管理字段 ==========================
    // ============================================================

    @Column({ comment: '领星端是否已删除: 0否,1是', type: 'tinyint', default: 0 })
    is_deleted_remote: number;

    @Column({ comment: '最后同步时间', type: 'datetime', nullable: true })
    sync_time: Date;

    @Column({ comment: '原始JSON数据(备用)', type: 'json', nullable: true })
    raw_data: any;

    @Column({ comment: '人工确认收货: 0未确认,1已确认', type: 'tinyint', default: 0 })
    logistics_confirmed: number;

    @Column({ comment: '人工确认收货时间', type: 'datetime', nullable: true })
    logistics_confirmed_time: Date;
}
