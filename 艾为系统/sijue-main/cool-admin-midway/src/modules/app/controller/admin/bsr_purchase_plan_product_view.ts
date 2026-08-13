import { Body, Inject, Post } from '@midwayjs/decorator';
import { BaseController, CoolController } from '@cool-midway/core';
import { AppAmzBsrAnalysisRecordLingxingEntity } from '../../entity/bsr_analysis_record_lingxing';
import { AppBsrPurchasePlanProductViewService } from '../../service/bsr_purchase_plan_product_view';
import { AppAmzBsrPurchaseOrderFulfillmentAdjustmentService } from '../../service/bsr_purchase_order_fulfillment_adjustment';

/**
 * 采购计划产品视图
 * 专门服务“已生成采购计划的产品列表”页面。
 */
@CoolController({
    api: [],
    entity: AppAmzBsrAnalysisRecordLingxingEntity,
    service: AppBsrPurchasePlanProductViewService,
})
export class AdminBsrPurchasePlanProductViewController extends BaseController {
    @Inject()
    purchasePlanProductViewService: AppBsrPurchasePlanProductViewService;

    @Inject()
    fulfillmentAdjustmentService: AppAmzBsrPurchaseOrderFulfillmentAdjustmentService;

    /**
     * 产品视图分页
     * 一行产品包含多条已生成采购计划，前端可在行内切换计划。
     */
    @Post('/page', { summary: '采购计划产品视图分页' })
    async productPage(@Body() param: any) {
        const result = await this.purchasePlanProductViewService.page(param || {});
        return this.ok(result);
    }

    @Post('/statusCounts', { summary: '采购计划产品视图状态筛选数量' })
    async statusCounts(@Body() param: any) {
        const result = await this.purchasePlanProductViewService.statusCounts(param || {});
        return this.ok(result);
    }

    @Post('/syncLatestRelatedData', { summary: '同步当前产品视图关联最新数据' })
    async syncLatestRelatedData(@Body() param: any) {
        try {
            const result = await this.purchasePlanProductViewService.syncLatestRelatedData(param || {});
            return this.ok(result);
        } catch (error) {
            return this.fail(error.message || '同步最新数据失败');
        }
    }

    @Post('/preflightBatchShip', { summary: '批量发货前置检查' })
    async preflightBatchShip(@Body() param: any) {
        try {
            const result = await this.purchasePlanProductViewService.preflightBatchShip(param || {});
            return this.ok(result);
        } catch (error) {
            return this.fail(error.message || '批量发货前置检查失败');
        }
    }

    @Post('/saveFulfillmentAdjustment', { summary: '保存采购单产品履约调整' })
    async saveFulfillmentAdjustment(@Body() param: any) {
        try {
            const result = await this.fulfillmentAdjustmentService.saveAdjustment(param || {});
            return this.ok(result);
        } catch (error) {
            return this.fail(error.message || '保存履约调整失败');
        }
    }

    @Post('/processFulfillmentAdjustment', { summary: '处理采购单产品履约异常' })
    async processFulfillmentAdjustment(@Body() param: any) {
        try {
            const result = await this.fulfillmentAdjustmentService.processAdjustment(param || {});
            return this.ok(result);
        } catch (error) {
            return this.fail(error.message || '处理履约异常失败');
        }
    }

    @Post('/manualCompleteFulfillment', { summary: '标记采购单产品人工完成' })
    async manualCompleteFulfillment(@Body() param: any) {
        try {
            const result = await this.fulfillmentAdjustmentService.manualComplete(param || {});
            return this.ok(result);
        } catch (error) {
            return this.fail(error.message || '标记人工完成失败');
        }
    }

    @Post('/manualReopenFulfillment', { summary: '恢复采购单产品可发' })
    async manualReopenFulfillment(@Body() param: any) {
        try {
            const result = await this.fulfillmentAdjustmentService.manualReopen(param || {});
            return this.ok(result);
        } catch (error) {
            return this.fail(error.message || '恢复可发失败');
        }
    }

    @Post('/shelveFulfillment', { summary: '搁置采购单产品履约' })
    async shelveFulfillment(@Body() param: any) {
        try {
            const result = await this.fulfillmentAdjustmentService.shelveFulfillment(param || {});
            return this.ok(result);
        } catch (error) {
            return this.fail(error.message || '搁置失败');
        }
    }

    @Post('/unshelveFulfillment', { summary: '恢复已搁置采购单产品履约' })
    async unshelveFulfillment(@Body() param: any) {
        try {
            const result = await this.fulfillmentAdjustmentService.unshelveFulfillment(param || {});
            return this.ok(result);
        } catch (error) {
            return this.fail(error.message || '恢复搁置失败');
        }
    }

    @Post('/fulfillmentAdjustmentLogs', { summary: '采购单产品履约调整日志' })
    async fulfillmentAdjustmentLogs(@Body() param: any) {
        const result = await this.fulfillmentAdjustmentService.getLogs(param || {});
        return this.ok(result);
    }

    @Post('/purchaseOrderFlow', { summary: '采购单履约流程图' })
    async purchaseOrderFlow(@Body() param: any) {
        try {
            const result = await this.purchasePlanProductViewService.purchaseOrderFlow(param || {});
            return this.ok(result);
        } catch (error) {
            return this.fail(error.message || '加载采购单流程失败');
        }
    }

    @Post('/purchaseOrderFlowBatch', { summary: '批量采购单补货依据' })
    async purchaseOrderFlowBatch(@Body() param: any) {
        try {
            const result = await this.purchasePlanProductViewService.purchaseOrderFlowBatch(param || {});
            return this.ok(result);
        } catch (error) {
            return this.fail(error.message || '批量加载补货依据失败');
        }
    }
}
