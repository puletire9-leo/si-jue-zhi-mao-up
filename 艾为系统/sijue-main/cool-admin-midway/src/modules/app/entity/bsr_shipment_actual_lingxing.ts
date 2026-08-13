import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * FBA发货单实际数据表 - 存储从领星同步的发货单数据
 * 每条记录对应一条"发货单 × 产品 × 发货计划"的最细颗粒度关联
 * 通过 ispr_id 唯一标识，通过 isp_id 与发货计划表一对一关联
 */
@Entity('app_amz_bsr_shipment_actual_lingxing')
export class AppAmzBsrShipmentActualLingxingEntity extends BaseEntity {
    // ============================================================
    // ========== 第3层：shipment_order_list（最细颗粒度） ==========
    // ============================================================

    @Index({ unique: true })
    @Column({ comment: '领星发货关联唯一ID(shipment_order_list.ispr_id)', type: 'int' })
    ispr_id: number;

    @Index()
    @Column({ comment: '关联发货计划ID(与plan表的isp_id一对一)', type: 'int' })
    isp_id: number;

    @Index()
    @Column({ comment: '批次号(如RP260302004)', length: 50 })
    seq: string;

    @Column({ comment: '发货计划单号(如R260302018)', length: 50, nullable: true })
    shipment_plan_sn: string;

    @Column({ comment: '计划发货数量', type: 'int', nullable: true })
    shipment_plan_quantity: number;

    @Column({ comment: '亚马逊货件数量', type: 'int', nullable: true })
    shipment_mws_quantity: number;

    @Column({ comment: '实际发货数量(发货单级别,前端展示用)', type: 'int', nullable: true })
    shipment_list_quantity: number;

    // ============================================================
    // ========== 第1层：发货单主信息 ==============================
    // ============================================================

    @Index()
    @Column({ comment: '发货单号(如SP260306007)', length: 50 })
    shipment_sn: string;

    @Column({ comment: '发货单状态(-1待配货,0待发货,1已发货,2已完成,3已作废)', type: 'int', nullable: true })
    shipment_status: number;

    @Column({ comment: '发货单状态名称', length: 50, nullable: true })
    shipment_status_name: string;

    @Column({ comment: '发货时间', length: 30, nullable: true })
    shipment_time: string;

    @Column({ comment: '运输方式(空派/卡航/海派/铁运)', length: 50, nullable: true })
    method_name: string;

    @Column({ comment: '物流渠道名称', length: 200, nullable: true })
    logistics_channel_name: string;

    @Column({ comment: '发货仓库名称', length: 200, nullable: true })
    wname: string;

    @Column({ comment: '发货仓库ID', type: 'int', nullable: true })
    wid: number;

    @Column({ comment: '预计到货日期', length: 30, nullable: true })
    expected_arrival_date: string;

    @Column({ comment: '创建人', length: 100, nullable: true })
    create_user: string;

    @Column({ comment: '领星创建时间', length: 30, nullable: true })
    create_time_remote: string;

    @Column({ comment: '领星更新时间', length: 30, nullable: true })
    update_time_remote: string;

    // ============================================================
    // ========== 第2层：产品明细（relate_list） ===================
    // ============================================================

    @Column({ comment: 'relate_list的id', type: 'int', nullable: true })
    relate_id: number;

    @Column({ comment: '亚马逊货件编号(如FBA15LHL6ZKQ)', length: 100, nullable: true })
    shipment_id: string;

    @Index()
    @Column({ comment: 'SKU', length: 100, nullable: true })
    sku: string;

    @Index()
    @Column({ comment: 'MSKU', length: 200, nullable: true })
    msku: string;

    @Column({ comment: 'FNSKU', length: 100, nullable: true })
    fnsku: string;

    @Column({ comment: '产品名称', length: 500, nullable: true })
    product_name: string;

    @Column({ comment: '产品级实际发货数量(relate_list.num)', type: 'int', nullable: true })
    num: number;

    @Column({ comment: '申请发货数量(relate_list.apply_num)', type: 'int', nullable: true })
    apply_num: number;

    @Column({ comment: '店铺名称', length: 200, nullable: true })
    sname: string;

    @Column({ comment: '店铺ID', type: 'int', nullable: true })
    sid: number;

    @Column({ comment: '国家', length: 50, nullable: true })
    nation: string;

    @Column({ comment: '亚马逊货件状态(SHIPPED/IN_TRANSIT/RECEIVING/CLOSED等)', length: 50, nullable: true })
    shipment_status_mws: string;

    @Column({ comment: '产品图片URL', length: 500, nullable: true })
    pic_url: string;

    @Column({ comment: 'ASIN', length: 50, nullable: true })
    asin: string;

    @Column({ comment: '产品ID(领星)', type: 'int', nullable: true })
    product_id: number;

    // ============================================================
    // ========== 本地管理字段 ====================================
    // ============================================================

    @Column({ comment: '是否终态(status=2已完成/3已作废则不再更新)', type: 'tinyint', default: 0 })
    is_final: number;

    @Column({ comment: '上次同步时间', type: 'datetime', nullable: true })
    last_sync_time: Date;
}
