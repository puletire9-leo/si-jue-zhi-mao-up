import { BaseEntity } from '@cool-midway/core';
import { Column, Entity } from 'typeorm';

/**
 * 采购入库单 - 物流明细轨迹表
 */
@Entity('app_amz_bsr_purchase_order_logistics_lingxing')
export class AppAmzBsrPurchaseOrderLogisticsLingxingEntity extends BaseEntity {

    @Column({ comment: '采购单号', length: 100 })
    order_sn: string;

    @Column({ comment: '领星物流包裹ID', length: 50, nullable: true })
    pol_id: string;

    @Column({ comment: '快递单号(运单号)', length: 100, nullable: true })
    logistics_order_no: string;

    @Column({ comment: '物流公司名称', length: 100, nullable: true })
    logistics_company: string;

    @Column({ comment: '物流状态代码(如SIGN)', length: 50, nullable: true })
    status: string;

    @Column({ comment: '物流状态中文(如已签收)', length: 50, nullable: true })
    status_text: string;

    @Column({ comment: '追踪节点数据', type: 'json', nullable: true })
    trace_info_json: any;

    @Column({ comment: '领星原始单包裹响应', type: 'json', nullable: true })
    raw_response_json: any;

    @Column({ comment: '签收时间(从轨迹提取)', type: 'datetime', nullable: true })
    sign_time: Date;

    @Column({ comment: '最后同步时间', type: 'datetime' })
    last_sync_time: Date;
}
