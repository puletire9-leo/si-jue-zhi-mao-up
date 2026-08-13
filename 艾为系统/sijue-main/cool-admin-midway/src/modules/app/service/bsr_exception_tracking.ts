import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AppAmzBsrExceptionTrackingEntity } from '../entity/bsr_exception_tracking';
import { AppAmzBsrPurchaseOrderSyncLingxingEntity } from '../entity/bsr_purchase_order_sync_lingxing';
import { AppAmzBsrPurchaseOrderItemSyncLingxingEntity } from '../entity/bsr_purchase_order_item_sync_lingxing';
import { Context } from '@midwayjs/koa';

@Provide()
export class AppAmzBsrExceptionTrackingService extends BaseService {
    @InjectEntityModel(AppAmzBsrExceptionTrackingEntity)
    exceptionRepo: Repository<AppAmzBsrExceptionTrackingEntity>;

    @InjectEntityModel(AppAmzBsrPurchaseOrderSyncLingxingEntity)
    orderRepo: Repository<AppAmzBsrPurchaseOrderSyncLingxingEntity>;

    @InjectEntityModel(AppAmzBsrPurchaseOrderItemSyncLingxingEntity)
    orderItemRepo: Repository<AppAmzBsrPurchaseOrderItemSyncLingxingEntity>;

    @Inject()
    ctx: Context;

    /**
     * 提交异常记录（支持批量）
     */
    async submit(params: {
        items: Array<{
            exception_type: string;
            reason: string;
            sid?: number;
            store_name?: string;
            order_sn?: string;
            supplier_name?: string;
            ware_house_name?: string;
            order_status_text?: string;
            product_name?: string;
            sku?: string;
            msku?: string;
            asin?: string;
            plan_sn?: string;
            quantity_plan?: number;
            price?: number;
            plan_pic_url?: string;
        }>;
        submit_nickname?: string;
    }) {
        const { items, submit_nickname } = params;
        const username = (this.ctx as any).admin?.username || '';

        const records: AppAmzBsrExceptionTrackingEntity[] = [];

        for (const item of items) {
            const record = new AppAmzBsrExceptionTrackingEntity();
            record.exception_type = item.exception_type;
            record.reason = item.reason;
            record.status = 0; // 待处理
            record.submit_user = username;
            record.submit_nickname = submit_nickname || username;

            // 店铺信息
            record.sid = item.sid || null;
            record.store_name = item.store_name || null;

            // 关联单据信息
            record.order_sn = item.order_sn || null;
            record.supplier_name = item.supplier_name || null;
            record.ware_house_name = item.ware_house_name || null;
            record.order_status_text = item.order_status_text || null;

            // 关联产品信息
            record.product_name = item.product_name || null;
            record.sku = item.sku || null;
            record.msku = item.msku || null;
            record.asin = item.asin || null;
            record.plan_sn = item.plan_sn || null;
            record.quantity_plan = item.quantity_plan || null;
            record.price = item.price || null;
            record.plan_pic_url = item.plan_pic_url || null;

            records.push(record);
        }

        const saved = await this.exceptionRepo.save(records);
        console.log(`[异常追踪] ${username} 提交了 ${saved.length} 条异常记录`);

        return {
            count: saved.length,
            ids: saved.map(r => r.id)
        };
    }

    /**
     * 更新异常状态
     */
    async updateStatus(params: {
        id: number;
        status: number;
        resolve_remark?: string;
        resolve_nickname?: string;
    }) {
        const { id, status, resolve_remark, resolve_nickname } = params;
        const username = (this.ctx as any).admin?.username || '';

        const updateData: any = { status };

        if (resolve_remark) {
            updateData.resolve_remark = resolve_remark;
        }

        if (status === 2 || status === 3) {
            updateData.resolve_user = username;
            updateData.resolve_nickname = resolve_nickname || username;
            updateData.resolve_time = new Date();
        }

        await this.exceptionRepo.update(id, updateData);
        console.log(`[异常追踪] ${username} 将记录 #${id} 状态更新为 ${status}`);

        return { success: true };
    }

    /**
     * 获取异常统计数据
     */
    async getStats() {
        const result = await this.exceptionRepo
            .createQueryBuilder('e')
            .select('e.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .groupBy('e.status')
            .getRawMany();

        const stats = { pending: 0, processing: 0, resolved: 0, closed: 0, total: 0 };
        for (const row of result) {
            const count = Number(row.count);
            stats.total += count;
            switch (Number(row.status)) {
                case 0: stats.pending = count; break;
                case 1: stats.processing = count; break;
                case 2: stats.resolved = count; break;
                case 3: stats.closed = count; break;
            }
        }

        return stats;
    }

    /**
     * 获取异常详情（含关联采购单/子项数据）
     */
    async getDetail(id: number) {
        // 1. 获取异常记录本身
        const exception = await this.exceptionRepo.findOne({ where: { id } });
        if (!exception) {
            return null;
        }

        const detail: any = {
            ...exception,
            order: null,
            orderItems: []
        };

        // 2. 如果有采购单号，关联查询采购单主表
        if (exception.order_sn) {
            const order = await this.orderRepo.findOne({
                where: { order_sn: exception.order_sn }
            });
            detail.order = order || null;

            // 3. 查询该采购单下的所有子项（产品明细）
            const items = await this.orderItemRepo.find({
                where: { order_sn: exception.order_sn },
                order: { createTime: 'ASC' }
            });
            detail.orderItems = items;
        }

        return detail;
    }

    /**
     * 获取当前表中已有的店铺列表（去重）
     */
    async getStoreOptions() {
        const result = await this.exceptionRepo
            .createQueryBuilder('e')
            .select('e.sid', 'sid')
            .addSelect('e.store_name', 'store_name')
            .distinct(true)
            .where('e.sid IS NOT NULL')
            .getRawMany();

        return result;
    }
}
