import { Provide, Inject, Controller, Post, Body } from '@midwayjs/decorator';
import { BaseController, CoolController } from '@cool-midway/core';
import { AppAmzBsrPurchasePlanLingxingEntity } from '../../entity/bsr_purchase_plan_lingxing';
import { AppAmzBsrPurchasePlanLingxingService } from '../../service/bsr_purchase_plan_lingxing';

@Provide()
@CoolController({
    api: ['add', 'delete', 'update', 'info', 'list', 'page'],
    entity: AppAmzBsrPurchasePlanLingxingEntity,
    service: AppAmzBsrPurchasePlanLingxingService,
    pageQueryOp: {
        fieldEq: ['status', 'is_deleted_remote', 'remark', 'plan_sn'],
        keyWordLikeFields: ['plan_sn', 'sku', 'product_name'],
        addOrderBy: { createTime: 'DESC' }
    }
})
export class AppAmzBsrPurchasePlanLingxingController extends BaseController {
    @Inject()
    purchasePlanService: AppAmzBsrPurchasePlanLingxingService;

    /**
     * 自定义分页 - 支持日期范围筛选
     */
    @Post('/customPage', { summary: '自定义分页查询' })
    async customPage(@Body() param: any) {
        const result = await this.purchasePlanService.customPage(param);
        return this.ok(result);
    }

    /**
     * 创建采购计划 - 调用领星API创建，并保存到本地
     */
    @Post('/createPurchasePlan', { summary: '创建采购计划' })
    async createPurchasePlan(@Body() param: any) {
        const result = await this.purchasePlanService.createPurchasePlan(param);
        return this.ok(result);
    }

    /**
     * 检查是否已有待采购计划
     */
    @Post('/checkExisting', { summary: '检查是否已有待采购计划' })
    async checkExisting(@Body() param: any) {
        const result = await this.purchasePlanService.checkExistingPlan(param.sku);
        return this.ok(result);
    }

    /**
     * 同步采购计划 - 从领星API同步最新状态
     */
    @Post('/syncPlans', { summary: '同步采购计划' })
    async syncPlans(@Body() param: any) {
        const result = await this.purchasePlanService.syncPlansFromLingxing(param.plan_sns);
        return this.ok(result);
    }

    /**
     * 智能分页查询 - 自动检测并同步过期数据
     */
    @Post('/smartPage', { summary: '智能分页查询' })
    async smartPage(@Body() param: any) {
        const result = await this.purchasePlanService.smartPage(param);
        return this.ok(result);
    }

    /**
     * 获取关联的分析记录详情（算法明细）
     */
    @Post('/getAnalysisRecord', { summary: '获取关联分析记录' })
    async getAnalysisRecord(@Body() param: any) {
        const result = await this.purchasePlanService.getAnalysisRecordById(param.analysis_record_id);
        return this.ok(result);
    }

    /**
     * 悬浮查看计划明细（带缓存过期与降级机制）
     */
    @Post('/hoverDetails', { summary: '获取悬浮展示计划明细' })
    async hoverDetails(@Body() param: any) {
        const result = await this.purchasePlanService.getPlanDetailsForHover(param.plan_sns);
        return this.ok(result);
    }

    /**
     * 批量从暂存记录创建采购计划
     * 用户在Listing列表勾选多个产品，一键批量创建
     */
    @Post('/batchCreateFromStaging', { summary: '批量从暂存创建采购计划' })
    async batchCreateFromStaging(@Body() param: any) {
        const result = await this.purchasePlanService.batchCreateFromStaging(param);
        return this.ok(result);
    }
    /**
     * 根据产品维度批量查询近N天的采购计划
     *
     * @param param.days 近几天，默认3天
     * @param param.items 产品列表，每个包含 asin + marketplace + store_id
     * @returns 按产品分组的采购计划列表
     *
     * @example
     * 入参：
     * {
     *   "days": 3,
     *   "items": [
     *     { "asin": "B0C8H67516", "marketplace": "英国", "store_id": 4981 },
     *     { "asin": "B0YYYY", "marketplace": "德国", "store_id": 4982 }
     *   ]
     * }
     *
     * 返回：
     * {
     *   "total": 1,
     *   "list": [
     *     {
     *       "asin": "B0C8H67516",
     *       "marketplace": "英国",
     *       "store_id": 4981,
     *       "plan_count": 2,
     *       "total_quantity": 150,
     *       "plans": [
     *         { "plan_sn": "PP20250312001", "quantity_plan": 100, "status_text": "待采购", ... }
     *       ]
     *     },
     *     {
     *       "asin": "B0YYYY",
     *       "marketplace": "德国",
     *       "store_id": 4982,
     *       "plan_count": 0,
     *       "total_quantity": 0,
     *       "plans": []
     *     }
     *   ]
     * }
     */
    @Post('/getByProduct', { summary: '根据产品批量查询近N天采购计划' })
    async getByProduct(@Body() param: any) {
        const result = await this.purchasePlanService.getByProduct(param);
        return this.ok(result);
    }

    /**
     * 查询其他店铺的同品listing（跨店补货用）
     */
    @Post('/getOtherStoreListings', { summary: '查询其他店铺的同品listing' })
    async getOtherStoreListings(@Body() param: any) {
        const result = await this.purchasePlanService.getOtherStoreListings(param);
        return this.ok(result);
    }
}
