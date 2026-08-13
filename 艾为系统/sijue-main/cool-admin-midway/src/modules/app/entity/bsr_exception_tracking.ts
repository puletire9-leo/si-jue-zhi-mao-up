import { BaseEntity } from '@cool-midway/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * 异常追踪表 - 记录采购单/产品的异常标记
 */
@Entity('app_amz_bsr_exception_tracking')
export class AppAmzBsrExceptionTrackingEntity extends BaseEntity {
    // ===== 异常基本信息 =====

    // ===== 店铺信息 =====

    @Index()
    @Column({ comment: '店铺ID', type: 'bigint', nullable: true })
    sid: number;

    @Column({ comment: '店铺名称', length: 200, nullable: true })
    store_name: string;

    @Column({ comment: '异常类型: 数据错误/价格异常/库存异常/物流异常/其他', length: 50 })
    exception_type: string;

    @Column({ comment: '异常原因/备注', type: 'text', nullable: true })
    reason: string;

    @Column({ comment: '处理状态: 0-待处理, 1-处理中, 2-已解决, 3-已关闭', type: 'tinyint', default: 0 })
    status: number;

    @Column({ comment: '处理备注', type: 'text', nullable: true })
    resolve_remark: string;

    @Column({ comment: '解决时间', type: 'datetime', nullable: true })
    resolve_time: Date;

    // ===== 提交人信息 =====

    @Column({ comment: '提交人用户名', length: 100, nullable: true })
    submit_user: string;

    @Column({ comment: '提交人昵称', length: 100, nullable: true })
    submit_nickname: string;

    // ===== 处理人信息 =====

    @Column({ comment: '处理人用户名', length: 100, nullable: true })
    resolve_user: string;

    @Column({ comment: '处理人昵称', length: 100, nullable: true })
    resolve_nickname: string;

    // ===== 关联单据信息 (冗余存储，方便列表直接展示) =====

    @Index()
    @Column({ comment: '采购单号', length: 50, nullable: true })
    order_sn: string;

    @Column({ comment: '供应商名称', length: 200, nullable: true })
    supplier_name: string;

    @Column({ comment: '仓库名称', length: 200, nullable: true })
    ware_house_name: string;

    @Column({ comment: '采购单状态文本', length: 50, nullable: true })
    order_status_text: string;

    // ===== 关联产品信息 (产品级异常时填写) =====

    @Column({ comment: '产品名称', length: 200, nullable: true })
    product_name: string;

    @Column({ comment: 'SKU', length: 100, nullable: true })
    sku: string;

    @Index()
    @Column({ comment: 'MSKU', length: 100, nullable: true })
    msku: string;

    @Column({ comment: 'ASIN', length: 50, nullable: true })
    asin: string;

    @Column({ comment: '采购计划号', length: 50, nullable: true })
    plan_sn: string;

    @Column({ comment: '计划采购量', type: 'int', nullable: true })
    quantity_plan: number;

    @Column({ comment: '单价', type: 'decimal', precision: 12, scale: 4, nullable: true })
    price: number;

    @Column({ comment: '产品图片', length: 500, nullable: true })
    plan_pic_url: string;
}
