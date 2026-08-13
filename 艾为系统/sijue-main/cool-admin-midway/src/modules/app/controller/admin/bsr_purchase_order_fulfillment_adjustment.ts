import { Body, Inject, Post } from '@midwayjs/decorator';
import { BaseController, CoolController } from '@cool-midway/core';
import { AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity } from '../../entity/bsr_purchase_order_fulfillment_adjustment';
import { AppAmzBsrPurchaseOrderFulfillmentAdjustmentService } from '../../service/bsr_purchase_order_fulfillment_adjustment';

/**
 * 采购单履约异常单据工作台
 */
@CoolController({
  api: [],
  entity: AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity,
  service: AppAmzBsrPurchaseOrderFulfillmentAdjustmentService,
})
export class AdminBsrPurchaseOrderFulfillmentAdjustmentController extends BaseController {
  @Inject()
  fulfillmentAdjustmentService: AppAmzBsrPurchaseOrderFulfillmentAdjustmentService;

  @Post('/page', { summary: '履约异常单据分页' })
  async pageDocuments(@Body() param: any) {
    const result = await this.fulfillmentAdjustmentService.pageDocuments(
      param || {}
    );
    return this.ok(result);
  }

  @Post('/summary', { summary: '履约异常单据统计' })
  async summary(@Body() param: any) {
    const result = await this.fulfillmentAdjustmentService.documentSummary(
      param || {}
    );
    return this.ok(result);
  }

  @Post('/assign', { summary: '指派履约异常处理人' })
  async assign(@Body() param: any) {
    try {
      const result = await this.fulfillmentAdjustmentService.assignDocument(
        param || {}
      );
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '指派处理人失败');
    }
  }

  @Post('/process', { summary: '处理履约异常单据' })
  async process(@Body() param: any) {
    try {
      const result = await this.fulfillmentAdjustmentService.processAdjustment(
        param || {}
      );
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '处理履约异常失败');
    }
  }

  @Post('/confirm', { summary: '确认锁定履约异常单据' })
  async confirm(@Body() param: any) {
    try {
      const result = await this.fulfillmentAdjustmentService.confirmDocument(
        param || {}
      );
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '确认履约异常失败');
    }
  }

  @Post('/logs', { summary: '履约异常单据日志' })
  async logs(@Body() param: any) {
    const result = await this.fulfillmentAdjustmentService.getLogs(param || {});
    return this.ok(result);
  }
}
