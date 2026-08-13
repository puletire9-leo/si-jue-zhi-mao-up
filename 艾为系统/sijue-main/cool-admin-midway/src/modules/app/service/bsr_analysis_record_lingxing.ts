import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { AppAmzBsrAnalysisRecordLingxingEntity } from '../entity/bsr_analysis_record_lingxing';

@Provide()
export class AppAmzBsrAnalysisRecordLingxingService extends BaseService {
    @InjectEntityModel(AppAmzBsrAnalysisRecordLingxingEntity)
    analysisRecordEntity: Repository<AppAmzBsrAnalysisRecordLingxingEntity>;

    @Inject()
    ctx: Context;

    /**
     * 保存暂存记录
     * 逻辑：
     * 1. 查询该维度(store+asin+market)下是否有 status=0 的旧暂存
     * 2. 如果有，标记为 2 (历史覆盖)
     * 3. 插入新记录 status=0
     */
    async saveTemp(param: any) {
        const { store_id, asin, marketplace, msku, local_sku, expected_sales, remark, manual_remark } = param;
        const currentUser = this.getCurrentAdminUser();
        const now = new Date();

        // 1. 查找已存在的暂存记录
        const exist = await this.analysisRecordEntity.findOne({
            where: {
                store_id,
                asin,
                marketplace,
                msku,
                status: 0,
            },
        });

        // 2. 如果存在，将其状态更新为 2 (历史覆盖)
        if (exist) {
            await this.analysisRecordEntity.update(exist.id, {
                status: 2,
            });
        }

        // 3. 保存新的暂存记录
        const newRecord = new AppAmzBsrAnalysisRecordLingxingEntity();
        newRecord.store_id = store_id;
        newRecord.asin = asin;
        newRecord.marketplace = marketplace;
        newRecord.msku = msku;
        newRecord.local_sku = local_sku || ''; // 本地SKU（批量创建采购计划时需要）
        newRecord.expected_sales = expected_sales;
        newRecord.remark = remark;
        newRecord.manual_remark = manual_remark; // 人工备注
        newRecord.staged_by_user_id = currentUser.userId;
        newRecord.staged_by_username = currentUser.username;
        newRecord.staged_by_nickname = currentUser.nickname;
        newRecord.staged_time = now;
        newRecord.status = 0; // 0-暂存(最新)

        await this.analysisRecordEntity.save(newRecord);

        return newRecord.id;
    }

    /**
     * 获取最新暂存记录 (用于回显)
     */
    async getLatest(param: any) {
        const { store_id, asin, marketplace, msku } = param;

        const record = await this.analysisRecordEntity.findOne({
            where: {
                store_id,
                asin,
                marketplace,
                msku,
                status: 0,
            },
            order: {
                createTime: 'DESC',
            },
        });

        return record;
    }

    /**
     * 完结记录 (生成补货单成功后调用)
     * @param id 记录ID
     */
    async finish(id: number) {
        if (!id) return;
        await this.analysisRecordEntity.update(id, {
            status: 1, // 1-完结
        });
    }

    /**
     * 过期暂存记录 (定时任务调用)
     * 将 status=0 且创建时间在今天0点之前的记录，状态改为 3 (已过期作废)
     * 
     * 调用方式 (任务管理):
     * - service: appAmzBsrAnalysisRecordLingxingService.expireStagedRecords()
     * - cron: 0 0 8 * * * (每天早上8点执行)
     */
    async expireStagedRecords() {
        // 获取今天0点的时间
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // 将今天之前的暂存记录(status=0)更新为已过期(status=3)
        const result = await this.analysisRecordEntity
            .createQueryBuilder()
            .update(AppAmzBsrAnalysisRecordLingxingEntity)
            .set({ status: 3 }) // 3-已过期作废
            .where('status = :status', { status: 0 })
            .andWhere('createTime < :today', { today })
            .execute();

        const affectedRows = result.affected || 0;
        console.log(`[expireStagedRecords] 已过期 ${affectedRows} 条暂存记录`);

        return {
            success: true,
            message: `已过期 ${affectedRows} 条暂存记录`,
            affectedRows
        };
    }

    /**
     * 获取所有有 plan_sn 的已完结记录
     * 用于同步时补全 purchase_plan 表
     */
    async getWithPlanSn() {
        const records = await this.analysisRecordEntity.find({
            where: {
                status: 1, // 只找已完结的（有 plan_sn 的记录状态一定是1）
            },
            select: ['id', 'plan_sn', 'store_id', 'asin', 'marketplace'],
            order: {
                createTime: 'DESC'
            }
        });

        // 过滤掉 plan_sn 为空的记录
        return records.filter(r => r.plan_sn && r.plan_sn.trim() !== '');
    }

    /**
     * 批量获取暂存历史记录
     * 一次 SQL 查询多个产品的暂存记录，用于列表页"暂存总数"列
     */
    async getHistoryBatch(param: { items: Array<{ asin: string; marketplace: string; store_id?: number; msku?: string }> }) {
        const { items } = param;
        if (!items || items.length === 0) return [];

        const qb = this.analysisRecordEntity
            .createQueryBuilder('r')
            .where('r.status IN (:...statuses)', { statuses: [0, 2] });

        // 动态拼接 OR 条件：(asin=? AND marketplace=? AND store_id=?) OR ...
        const orConditions: string[] = [];
        const orParams: Record<string, any> = {};

        items.forEach((item, i) => {
            let condition = "";
            if (item.store_id) {
                condition = `r.asin = :asin${i} AND r.marketplace = :mp${i} AND r.store_id = :sid${i}`;
                orParams[`sid${i}`] = item.store_id;
            } else {
                condition = `r.asin = :asin${i} AND r.marketplace = :mp${i}`;
            }
            if (item.msku) {
                condition += ` AND r.msku = :msku${i}`;
                orParams[`msku${i}`] = item.msku;
            }
            orConditions.push(`(${condition})`);

            orParams[`asin${i}`] = item.asin;
            orParams[`mp${i}`] = item.marketplace;
        });

        qb.andWhere(`(${orConditions.join(' OR ')})`, orParams);
        qb.orderBy('r.createTime', 'DESC');

        const records = await qb.getMany();

        return records.map(r => ({
            id: r.id,
            asin: r.asin,
            marketplace: r.marketplace,
            store_id: r.store_id,
            msku: r.msku,
            status: r.status,
            status_text: this.getStatusText(r.status),
            createTime: r.createTime,
            plan_sn: r.plan_sn || null,
            local_sku: r.local_sku || null,
            expected_sales: r.expected_sales,
            remark: r.remark,
            manual_remark: r.manual_remark,
            staged_by_user_id: r.staged_by_user_id || null,
            staged_by_username: r.staged_by_username || '',
            staged_by_nickname: r.staged_by_nickname || '',
            staged_time: r.staged_time || null,
            purchase_plan_created_by_user_id: r.purchase_plan_created_by_user_id || null,
            purchase_plan_created_by_username: r.purchase_plan_created_by_username || '',
            purchase_plan_created_by_nickname: r.purchase_plan_created_by_nickname || '',
            purchase_plan_created_time: r.purchase_plan_created_time || null
        }));
    }

    /**
     * 获取暂存历史记录列表
     * 按 ASIN + marketplace 查询暂存相关记录（status=0 当前暂存, status=2 历史覆盖）
     * 不显示已完结(1)和已过期(3)的记录
     */
    async getHistory(param: { asin: string; marketplace: string; store_id?: number; msku?: string }) {
        const { asin, marketplace, store_id, msku } = param;

        const whereConditions: any[] = [
            { asin, marketplace, status: 0, ...(store_id ? { store_id } : {}), ...(msku ? { msku } : {}) }, // 当前暂存
            { asin, marketplace, status: 2, ...(store_id ? { store_id } : {}), ...(msku ? { msku } : {}) }  // 历史覆盖
        ];

        const records = await this.analysisRecordEntity.find({
            where: whereConditions,
            order: {
                createTime: 'DESC'
            }
        });

        // 返回简化的数据结构
        return records.map(r => ({
            id: r.id,
            status: r.status,
            status_text: this.getStatusText(r.status),
            createTime: r.createTime,
            plan_sn: r.plan_sn || null,
            local_sku: r.local_sku || null,
            expected_sales: r.expected_sales,
            remark: r.remark,
            manual_remark: r.manual_remark,
            staged_by_user_id: r.staged_by_user_id || null,
            staged_by_username: r.staged_by_username || '',
            staged_by_nickname: r.staged_by_nickname || '',
            staged_time: r.staged_time || null,
            purchase_plan_created_by_user_id: r.purchase_plan_created_by_user_id || null,
            purchase_plan_created_by_username: r.purchase_plan_created_by_username || '',
            purchase_plan_created_by_nickname: r.purchase_plan_created_by_nickname || '',
            purchase_plan_created_time: r.purchase_plan_created_time || null
        }));
    }

    /**
     * 获取状态文本（用户友好）
     */
    private getStatusText(status: number): string {
        const statusMap: Record<number, string> = {
            0: '当前',
            1: '已完成',
            2: '历史',
            3: '已过期'
        };
        return statusMap[status] || '未知';
    }

    private getCurrentAdminUser() {
        const admin = (this.ctx as any)?.admin || (this.baseCtx as any)?.admin || {};
        const username = this.normalizeText(admin.username);
        return {
            userId: Number(admin.userId) || null,
            username,
            nickname: this.normalizeText(admin.nickName || admin.name || username),
        };
    }

    private normalizeText(value: any) {
        return String(value ?? '').trim();
    }
}
