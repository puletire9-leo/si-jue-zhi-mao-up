import { Provide, Inject, Post, Body } from '@midwayjs/decorator';
import { BaseController, CoolController } from '@cool-midway/core';
import { AppAmzBsrShipmentActualLingxingEntity } from '../../entity/bsr_shipment_actual_lingxing';
import { AppAmzBsrShipmentActualLingxingService } from '../../service/bsr_shipment_actual_lingxing';

/**
 * FBA发货单实际数据控制器
 */
@Provide()
@CoolController({
    api: ['info', 'list', 'page'],
    entity: AppAmzBsrShipmentActualLingxingEntity,
    service: AppAmzBsrShipmentActualLingxingService,
    pageQueryOp: {
        fieldEq: ['shipment_status', 'seq', 'shipment_sn', 'is_final'],
        keyWordLikeFields: ['shipment_sn', 'msku', 'product_name', 'seq', 'sku', 'shipment_id'],
        addOrderBy: { id: 'DESC' }
    }
})
export class AppAmzBsrShipmentActualLingxingController extends BaseController {
    @Inject()
    shipmentActualService: AppAmzBsrShipmentActualLingxingService;

    /**
     * 全量同步 - 按时间范围拉取所有发货单数据
     * 入参: { startDate?: string, endDate?: string }
     * 不传 startDate 则自动从表里最大同步时间开始，空表默认从 2020-01-01 开始
     */
    @Post('/fullSync', { summary: '全量同步发货单数据' })
    async fullSync(@Body() body: any) {
        const result = await this.shipmentActualService.syncByTimeRange(
            body.startDate,
            body.endDate
        );
        return this.ok(result);
    }

    /**
     * 精准同步 - 按 SKU 列表拉取发货单数据
     * 入参: { skus?: string[] }
     * 不传 skus 则自动从发货计划表获取所有 SKU
     */
    @Post('/syncBySkuList', { summary: '按SKU精准同步发货单数据' })
    async syncBySkuList(@Body() body: any) {
        const result = await this.shipmentActualService.syncBySkuList(body.skus);
        return this.ok(result);
    }

    /**
     * 查询实际发货数据 - 按 isp_id 数组
     * 入参: { ispIds: number[] }
     * 返回: { [isp_id]: { shipment_list_quantity, shipment_sn, ... } }
     */
    @Post('/getActualMetrics', { summary: '按isp_id查询实际发货数据' })
    async getActualMetrics(@Body() body: any) {
        const result = await this.shipmentActualService.getActualMetricsByIspIds(body.ispIds);
        return this.ok(result);
    }

    /**
     * 查询实际发货数据 - 按 seq 数组
     * 入参: { seqs: string[] }
     * 返回: { [seq]: { totalQty, items[] } }
     */
    @Post('/getActualMetricsBySeqs', { summary: '按seq查询实际发货数据' })
    async getActualMetricsBySeqs(@Body() body: any) {
        const result = await this.shipmentActualService.getActualMetricsBySeqs(body.seqs);
        return this.ok(result);
    }

    /**
     * 自定义分页查询 - 发货单列表页面
     */
    @Post('/customPage', { summary: '自定义分页查询' })
    async customPage(@Body() body: any) {
        const result = await this.shipmentActualService.customPage(body);
        return this.ok(result);
    }
}
