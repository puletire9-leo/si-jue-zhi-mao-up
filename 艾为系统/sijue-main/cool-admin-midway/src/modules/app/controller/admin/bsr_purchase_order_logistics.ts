import { BaseController, CoolController } from '@cool-midway/core';
import { Body, Inject, Post } from '@midwayjs/decorator';
import { AppAmzBsrPurchaseOrderLogisticsPackageEntity } from '../../entity/bsr_purchase_order_logistics_package';
import { AppAmzBsrPurchaseOrderLogisticsService } from '../../service/bsr_purchase_order_logistics';

/**
 * 采购物流统一入口
 */
@CoolController({
  api: [],
  entity: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
})
export class AdminAppBsrPurchaseOrderLogisticsController extends BaseController {
  @Inject()
  purchaseOrderLogisticsService: AppAmzBsrPurchaseOrderLogisticsService;

  @Post('/orderOverview', { summary: '采购单物流聚合信息' })
  async orderOverview(@Body() body: any) {
    return this.ok(await this.purchaseOrderLogisticsService.getOrderLogisticsOverview(body));
  }
}
