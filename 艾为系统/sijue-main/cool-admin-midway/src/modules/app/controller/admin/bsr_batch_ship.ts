import { Body, Inject, Post, Provide } from '@midwayjs/decorator';
import { BaseController, CoolController } from '@cool-midway/core';
import { AppAmzBsrBatchShipEntity } from '../../entity/bsr_batch_ship';
import { AppAmzBsrBatchShipService } from '../../service/bsr_batch_ship';

/**
 * 批量发货批次控制器。
 *
 * 这里保存本地批量发货建议和领星提交结果；领星真实发货计划仍由旧链路同步到
 * app_amz_bsr_shipment_plan_lingxing。
 */
@Provide()
@CoolController({
    api: ['info', 'list', 'page'],
    entity: AppAmzBsrBatchShipEntity,
    service: AppAmzBsrBatchShipService,
    pageQueryOp: {
        fieldEq: ['status', 'batch_no'],
        keyWordLikeFields: ['batch_no', 'created_by_username', 'created_by_nickname'],
        addOrderBy: { id: 'DESC' }
    }
})
export class AdminAppBsrBatchShipController extends BaseController {
    @Inject()
    batchShipService: AppAmzBsrBatchShipService;

    /**
     * 提交批量发货计划。
     */
    @Post('/submit', { summary: '提交批量发货计划' })
    async submit(@Body() body: any) {
        const records = Array.isArray(body?.records) ? body.records : [];
        if (!records.length) {
            return this.fail('请提供批量发货记录');
        }
        const result = await this.batchShipService.submit(body);
        return this.ok(result);
    }

    /**
     * 重试批量发货失败项。
     */
    @Post('/retryFailed', { summary: '重试批量发货失败项' })
    async retryFailed(@Body() body: any) {
        if (!body?.batch_no) {
            return this.fail('缺少批量发货批次号');
        }
        const result = await this.batchShipService.retryFailed(body);
        return this.ok(result);
    }

    /**
     * 查询产品批量发货历史。
     */
    @Post('/productHistory', { summary: '查询产品批量发货历史' })
    async productHistory(@Body() body: any) {
        const result = await this.batchShipService.productHistory(body || {});
        return this.ok(result);
    }

    /**
     * 查询批量发货批次历史分页。
     */
    @Post('/batchHistoryPage', { summary: '查询批量发货批次历史分页' })
    async batchHistoryPage(@Body() body: any) {
        const result = await this.batchShipService.batchHistoryPage(body || {});
        return this.ok(result);
    }

    /**
     * 查询批量发货批次详情。
     */
    @Post('/batchHistoryDetail', { summary: '查询批量发货批次详情' })
    async batchHistoryDetail(@Body() body: any) {
        const batchNo = String(body?.batch_no || body?.batchNo || '').trim();
        if (!batchNo && !body?.id) {
            return this.fail('缺少批量发货批次号');
        }
        const result = await this.batchShipService.batchHistoryDetail(body || {});
        return this.ok(result);
    }
}
