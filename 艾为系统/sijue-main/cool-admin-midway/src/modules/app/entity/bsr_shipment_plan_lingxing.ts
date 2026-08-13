import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * FBA发货计划表 - 存储从领星同步的发货计划数据
 * 每条记录对应一条具体的发货明细（某个产品发了多少件）
 * 通过 isp_id 唯一标识一条领星发货计划记录
 */
@Entity('app_amz_bsr_shipment_plan_lingxing')
export class AppAmzBsrShipmentPlanLingxingEntity extends BaseEntity {
    // ============================================================
    // ==================== 领星API返回字段 =======================
    // ============================================================

    // ========== 唯一标识 & 批次信息 ==========
    @Index({ unique: true })
    @Column({ comment: '领星发货计划ID(唯一)', type: 'int' })
    isp_id: number;

    @Index()
    @Column({ comment: '领星发货计划组ID', type: 'int', nullable: true })
    ispg_id: number;

    @Index()
    @Column({ comment: '发货计划单号(如R260309068)', length: 50 })
    order_sn: string;

    @Index()
    @Column({ comment: '批次号(如RP260309013)', length: 50 })
    seq: string;

    // ========== 产品信息 ==========
    @Column({ comment: '领星产品ID', type: 'int', nullable: true })
    product_id: number;

    @Column({ comment: '产品名称', length: 500, nullable: true })
    product_name: string;

    @Column({ comment: 'SKU', length: 100, nullable: true })
    sku: string;

    @Index()
    @Column({ comment: 'MSKU', length: 200, nullable: true })
    msku: string;

    @Column({ comment: 'FNSKU', length: 100, nullable: true })
    fnsku: string;

    @Column({ comment: '产品图片', length: 500, nullable: true })
    pic_url: string;

    @Column({ comment: '产品小图', length: 500, nullable: true })
    small_image_url: string;

    // ========== 店铺 & 仓库信息 ==========
    @Column({ comment: '店铺ID', type: 'int', nullable: true })
    sid: number;

    @Column({ comment: '店铺名称', length: 200, nullable: true })
    sname: string;

    @Column({ comment: '国家', length: 50, nullable: true })
    nation: string;

    @Column({ comment: '发货仓库ID', type: 'int', nullable: true })
    wid: number;

    @Column({ comment: '发货仓库名称', length: 200, nullable: true })
    wname: string;

    // ========== 业务属性 ==========
    @Column({ comment: '包装类型(1混装 2原厂)', type: 'tinyint', nullable: true })
    packing_type: number;

    @Column({ comment: '包装类型名称', length: 50, nullable: true })
    packing_type_name: string;

    @Column({ comment: '计划发货时间', length: 20, nullable: true })
    shipment_time: string;

    @Column({ comment: '计划发货量', type: 'int', nullable: true })
    shipment_plan_quantity: number;

    // ========== 状态 ==========
    @Column({ comment: '状态(-5驳回,0待审,5待处理,10已处理)', type: 'int', default: 5 })
    status: number;

    @Column({ comment: '状态名称', length: 50, nullable: true })
    status_name: string;

    // ========== 货件关联 ==========
    @Column({ comment: '是否已关联FBA货件(0否1是)', type: 'tinyint', default: 0 })
    is_relate_mws: number;

    @Column({ comment: '关联的FBA货件单号', length: 100, nullable: true })
    shipment_mws_sn: string;

    @Column({ comment: '关联的发货单单号', length: 100, nullable: true })
    shipment_list_sn: string;

    // ========== 其他领星字段 ==========
    @Column({ comment: '单据级别备注(领星发货计划单总备注)', type: 'text', nullable: true })
    batch_remark: string;

    @Column({ comment: '明细级别备注(具体产品的备注)', type: 'text', nullable: true })
    remark: string;

    @Column({ comment: '领星创建人', length: 100, nullable: true })
    create_user: string;

    @Column({ comment: '领星创建时间', type: 'datetime', nullable: true })
    create_time_remote: Date;

    // ============================================================
    // ==================== 本地管理字段 ==========================
    // ============================================================

    @Index()
    @Column({ comment: '采购单号(来自哪个采购单)', length: 50, nullable: true })
    purchase_order_sn: string;

    @Index()
    @Column({ comment: '采购计划号(关联采购单子项)', length: 50, nullable: true })
    purchase_plan_sn: string;

    @Column({ comment: '运输方式(air/sea/express/rail)', length: 20, nullable: true })
    shipping_method: string;

    @Column({ comment: '本系统发货计划创建人ID', type: 'int', nullable: true })
    local_created_by_user_id: number;

    @Column({ comment: '本系统发货计划创建人用户名', length: 100, nullable: true })
    local_created_by_username: string;

    @Column({ comment: '本系统发货计划创建人昵称', length: 100, nullable: true })
    local_created_by_nickname: string;

    @Column({ comment: '本系统发货计划创建时间', type: 'datetime', nullable: true })
    local_created_time: Date;

    @Column({ comment: '上次从领星同步的时间(懒刷新用)', type: 'datetime', nullable: true })
    last_sync_time: Date;
}
