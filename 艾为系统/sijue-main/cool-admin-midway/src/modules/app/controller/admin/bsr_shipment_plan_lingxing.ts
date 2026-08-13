import { Provide, Inject, Post, Body } from '@midwayjs/decorator';
import { BaseController, CoolController } from '@cool-midway/core';
import { AppAmzBsrShipmentPlanLingxingEntity } from '../../entity/bsr_shipment_plan_lingxing';
import { AppAmzBsrShipmentPlanLingxingService } from '../../service/bsr_shipment_plan_lingxing';

/**
 * FBA发货计划控制器
 */
@Provide()
@CoolController({
    api: ['info', 'list', 'page'],
    entity: AppAmzBsrShipmentPlanLingxingEntity,
    service: AppAmzBsrShipmentPlanLingxingService,
    pageQueryOp: {
        fieldEq: ['status', 'shipping_method', 'seq'],
        keyWordLikeFields: ['order_sn', 'msku', 'product_name', 'seq', 'purchase_plan_sn'],
        addOrderBy: { id: 'DESC' }
    }
})
export class AppAmzBsrShipmentPlanLingxingController extends BaseController {
    @Inject()
    shipmentPlanService: AppAmzBsrShipmentPlanLingxingService;

    /**
     * 自定义分页查询 - 支持多条件筛选
     */
    @Post('/customPage', { summary: '自定义分页查询' })
    async customPage(@Body() body: any) {
        const result = await this.shipmentPlanService.customPage(body);
        return this.ok(result);
    }

    /**
     * 批量查询发货计划指标
     * 入参: { orderSns: string[] }  传入采购单号数组
     * 出参: { byOrder: { [orderSn]: { totalQty, items[] } }, byPlan: { [planSn]: { totalQty, items[] } } }
     */
    @Post('/getBatchShipmentMetrics', { summary: '批量查询发货计划指标' })
    async getBatchShipmentMetrics(@Body() body: any) {
        const result = await this.shipmentPlanService.getBatchShipmentMetrics(body);
        return this.ok(result);
    }
}
