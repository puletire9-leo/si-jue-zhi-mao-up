// src/controller/admin/bsr_restocking_center_lingxing.ts
import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzBsrRestockingCenterLingxingEntity } from "../../entity/bsr_restocking_center_lingxing";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import { Body, Post, Query, Get, Inject } from "@midwayjs/decorator";
import { AppAmzBsrRestockingCenterLingxingService } from "../../service/bsr_restocking_center_lingxing";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrRestockingCenterLingxingEntity,
  pageQueryOp: {
    keyWordLikeFields: ['hashId', 'asin', 'itemName'],
    fieldEq: ['hashId', 'asin'],
  },
})
@updateWithoutAmendingCreateTime
export class AdminBsrRestockingCenterLingxingController extends BaseController {
    @Inject()
    AppAmzBsrRestockingCenterLingxingService: AppAmzBsrRestockingCenterLingxingService;

    @Get('/getByAsinAndMarketplace')  
    async getByAsinAndMarketplace(@Query('asin') asin: string, @Query('marketplace') marketplace: string) {
      const result = await this.AppAmzBsrRestockingCenterLingxingService.getByAsinAndMarketplace(asin, marketplace);
      return this.ok(result);
    }

    @Post('/getByAsinAndMarketplaceBatch')
    async getByAsinAndMarketplaceBatch(@Body() body: { items: Array<{ asin: string; marketplace: string; sellerName?: string }> }) {
      const result = await this.AppAmzBsrRestockingCenterLingxingService.getByAsinAndMarketplaceBatch(body?.items || []);
      return this.ok(result);
    }
  
    @Post('/requestLingXingShipmentStatus')
    async requestLingXingShipmentStatus(@Body() body: { ids: number[] }) {
      const { ids } = body;
      if (!ids || ids.length === 0) {
        return this.fail('请先选择需要获取关键词的候选产品');
      }
      const result = await this.AppAmzBsrRestockingCenterLingxingService.requestLingXingShipmentStatus(ids);
      return this.ok(result);
    }
    
  /**
   * 同步实时销量
   */
  @Post('/syncRealtimeSales')
  async syncRealtimeSales() {
    return this.ok(await this.AppAmzBsrRestockingCenterLingxingService.syncRealtimeSales());
  }

  /**
   * 手动更新 FBA 货件（需传入 items）
   */
  @Post('/updateFbaShipmentList')
  async updateFbaShipmentList(@Body() body: { items: Array<{ shipment_id: string; sid: string }> }) {
    const { items } = body;
    if (!items || items.length === 0) {
      return this.fail('未提供需要更新的货件信息');
    }
    await this.AppAmzBsrRestockingCenterLingxingService.updateFbaShipmentList(items);
    return this.ok();
  }

  /**
   * 全量更新所有在途 FBA 货件（从数据库收集，供定时任务调用）
   */
  @Post('/updateAllFbaShipments')
  async updateAllFbaShipments() {
    const result = await this.AppAmzBsrRestockingCenterLingxingService.collectAndUpdateAllFbaShipments();
    return this.ok(result);
  }
}
