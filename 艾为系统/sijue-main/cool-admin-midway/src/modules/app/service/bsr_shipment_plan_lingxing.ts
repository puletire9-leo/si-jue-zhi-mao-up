import { Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppAmzBsrShipmentPlanLingxingEntity } from '../entity/bsr_shipment_plan_lingxing';
import { AppAmzBsrShipmentActualLingxingEntity } from '../entity/bsr_shipment_actual_lingxing';

/**
 * FBA发货计划服务
 */
@Provide()
export class AppAmzBsrShipmentPlanLingxingService extends BaseService {
    @InjectEntityModel(AppAmzBsrShipmentPlanLingxingEntity)
    shipmentPlanRepo: Repository<AppAmzBsrShipmentPlanLingxingEntity>;

    @InjectEntityModel(AppAmzBsrShipmentActualLingxingEntity)
    shipmentActualRepo: Repository<AppAmzBsrShipmentActualLingxingEntity>;

    /**
     * 批量查询发货计划指标
     * 按 purchase_order_sn 查询，返回按 order 和 plan 两个维度分组的结果
     * - byOrder: 单据视图使用（一个采购单下所有产品的发货计划汇总）
     * - byPlan:  产品视图使用（单个子项的发货计划汇总）
     */
    async getBatchShipmentMetrics(params: { orderSns: string[] }) {
        const { orderSns } = params;

        if (!orderSns || orderSns.length === 0) {
            return { byOrder: {}, byPlan: {} };
        }

        // 一次性查出所有关联的发货计划记录
        const records = await this.shipmentPlanRepo.find({
            where: { purchase_order_sn: In(orderSns) },
            select: [
                'id', 'isp_id', 'seq', 'order_sn', 'msku', 'sku', 'product_name',
                'small_image_url', 'shipment_plan_quantity',
                'shipping_method', 'sname', 'wname', 'remark',
                'purchase_plan_sn', 'purchase_order_sn',
                'shipment_mws_sn', 'is_relate_mws', 'status', 'status_name',
                'createTime', 'batch_remark',
                'local_created_by_user_id', 'local_created_by_username',
                'local_created_by_nickname', 'local_created_time'
            ]
        });

        // 状态映射字典（领星API定义: -5已驳回, 0待审核, 5待处理, 10已处理）
        const statusMap: Record<number, string> = {
            [-5]: '已驳回',
            0: '待审核',
            5: '待处理',
            10: '已处理'
        };

        // 按 purchase_order_sn 分组（单据视图用）
        // 结构: byOrder[order_sn] = { totalQty: 100, batches: { 'seq1': { totalQty: 50, info: {...}, items: [...] } } }
        const byOrder: Record<string, { totalQty: number; batches: Record<string, { totalQty: number; info: any; items: any[] }> }> = {};
        // 按 purchase_plan_sn 分组（产品视图用）
        const byPlan: Record<string, { totalQty: number; items: any[] }> = {};

        for (const record of records) {
            const orderKey = record.purchase_order_sn;
            const planKey = record.purchase_plan_sn;
            const seqKey = record.seq || 'unknown_seq';
            const qty = record.shipment_plan_quantity || 0;

            const item = {
                id: record.id,
                isp_id: record.isp_id,
                seq: record.seq,
                order_sn: record.order_sn, // 领星发货计划单号
                shipment_mws_sn: record.shipment_mws_sn, // 发货单号
                msku: record.msku,
                sku: record.sku,
                product_name: record.product_name,
                small_image_url: record.small_image_url,
                shipment_plan_quantity: qty,
                shipping_method: record.shipping_method,
                sname: record.sname,
                wname: record.wname,
                purchase_plan_sn: planKey,
                purchase_order_sn: orderKey,
                is_relate_mws: record.is_relate_mws,
                status: record.status,
                status_text: record.status_name || statusMap[record.status] || '未知状态',
                batch_remark: record.batch_remark,
                remark: record.remark,
                createTime: record.createTime,
                local_created_by_user_id: record.local_created_by_user_id,
                local_created_by_username: record.local_created_by_username,
                local_created_by_nickname: record.local_created_by_nickname,
                local_created_time: record.local_created_time,
                actual: null as any  // 实际发货数据，后面合并
            };

            // 按采购单号分组 -> 按批次分组
            if (orderKey) {
                if (!byOrder[orderKey]) {
                    byOrder[orderKey] = { totalQty: 0, batches: {} };
                }
                byOrder[orderKey].totalQty += qty;

                if (!byOrder[orderKey].batches[seqKey]) {
                    byOrder[orderKey].batches[seqKey] = {
                        totalQty: 0,
                        info: {
                            seq: record.seq,
                            status: record.status,
                            status_text: record.status_name || statusMap[record.status] || '未知状态',
                            shipping_method: record.shipping_method,
                            sname: record.sname,
                            wname: record.wname,
                            batch_remark: record.batch_remark,
                            createTime: record.createTime,
                            local_created_by_user_id: record.local_created_by_user_id,
                            local_created_by_username: record.local_created_by_username,
                            local_created_by_nickname: record.local_created_by_nickname,
                            local_created_time: record.local_created_time
                        },
                        items: []
                    };
                }
                byOrder[orderKey].batches[seqKey].totalQty += qty;
                byOrder[orderKey].batches[seqKey].items.push(item);
            }

            // 按子项号分组 (产品视图保持扁平)
            if (planKey) {
                if (!byPlan[planKey]) {
                    byPlan[planKey] = { totalQty: 0, items: [] };
                }
                byPlan[planKey].totalQty += qty;
                byPlan[planKey].items.push(item);
            }
        }

        // ========== 合并实际发货数据 ==========
        // 收集所有 isp_id
        const allIspIds = records
            .map(r => r.isp_id)
            .filter(id => id != null);

        // actualMap: 一个 isp_id 可能对应多条发货单（拆分发货的情况）
        // 结构: { [isp_id]: { totalActualQty: 汇总, details: [每条发货单明细] } }
        let actualMap: Record<number, { totalActualQty: number; details: any[] }> = {};
        if (allIspIds.length > 0) {
            const actualRecords = await this.shipmentActualRepo.find({
                where: { isp_id: In(allIspIds) }
            });
            for (const ar of actualRecords) {
                if (!actualMap[ar.isp_id]) {
                    actualMap[ar.isp_id] = { totalActualQty: 0, details: [] };
                }
                actualMap[ar.isp_id].totalActualQty += ar.shipment_list_quantity || 0;
                actualMap[ar.isp_id].details.push({
                    shipment_list_quantity: ar.shipment_list_quantity,
                    shipment_sn: ar.shipment_sn,
                    shipment_id: ar.shipment_id,
                    shipment_status_name: ar.shipment_status_name,
                    shipment_status_mws: ar.shipment_status_mws,
                    shipment_time: ar.shipment_time,
                    method_name: ar.method_name,
                    logistics_channel_name: ar.logistics_channel_name,
                    wname: ar.wname,
                    expected_arrival_date: ar.expected_arrival_date,
                    is_final: ar.is_final
                });
            }
        }

        // 把实际发货数据挂到 byPlan 和 byOrder 的 items 上
        const enrichItem = (item: any) => {
            if (item.isp_id && actualMap[item.isp_id]) {
                item.actual = actualMap[item.isp_id];
            }
        };

        for (const key of Object.keys(byPlan)) {
            byPlan[key].items.forEach(enrichItem);
        }
        for (const key of Object.keys(byOrder)) {
            for (const seqKey of Object.keys(byOrder[key].batches)) {
                byOrder[key].batches[seqKey].items.forEach(enrichItem);
            }
        }

        return { byOrder, byPlan };
    }

    /**
     * 自定义分页查询 - 支持多条件筛选
     */
    async customPage(params: {
        page?: number;
        size?: number;
        seq?: string;
        order_sn?: string;
        msku?: string;
        purchase_plan_sn?: string;
        purchase_order_sn?: string;
        status?: number;
        shipping_method?: string;
        keyWord?: string;
        startDate?: string;
        endDate?: string;
    }) {
        const { page = 1, size = 20 } = params;

        const qb = this.shipmentPlanRepo.createQueryBuilder('t');

        // 精确匹配
        if (params.seq) qb.andWhere('t.seq = :seq', { seq: params.seq });
        if (params.order_sn) qb.andWhere('t.order_sn = :order_sn', { order_sn: params.order_sn });
        if (params.msku) qb.andWhere('t.msku = :msku', { msku: params.msku });
        if (params.purchase_plan_sn) qb.andWhere('t.purchase_plan_sn = :purchase_plan_sn', { purchase_plan_sn: params.purchase_plan_sn });
        if (params.purchase_order_sn) qb.andWhere('t.purchase_order_sn = :purchase_order_sn', { purchase_order_sn: params.purchase_order_sn });
        if (params.status !== undefined && params.status !== null) qb.andWhere('t.status = :status', { status: params.status });
        if (params.shipping_method) qb.andWhere('t.shipping_method = :shipping_method', { shipping_method: params.shipping_method });

        // 模糊搜索
        if (params.keyWord) {
            qb.andWhere('(t.order_sn LIKE :kw OR t.seq LIKE :kw OR t.msku LIKE :kw OR t.product_name LIKE :kw OR t.sku LIKE :kw)', {
                kw: `%${params.keyWord}%`
            });
        }

        // 日期范围 (按领星创建时间)
        if (params.startDate) qb.andWhere('t.create_time_remote >= :startDate', { startDate: params.startDate });
        if (params.endDate) qb.andWhere('t.create_time_remote <= :endDate', { endDate: params.endDate + ' 23:59:59' });

        // 排序 & 分页
        qb.orderBy('t.id', 'DESC');
        const total = await qb.getCount();
        const list = await qb.skip((page - 1) * size).take(size).getMany();

        return {
            list,
            pagination: { page, size, total }
        };
    }
}
