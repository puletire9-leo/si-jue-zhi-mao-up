import { BaseController, CoolController } from '@cool-midway/core';
import { Body, Inject, Post, Provide } from '@midwayjs/decorator';
import { AppAmzBsrPurchaseOrderItemSyncLingxingEntity } from '../../entity/bsr_purchase_order_item_sync_lingxing';
import { AppBsrPurchaseOrderManualLinkService } from '../../service/bsr_purchase_order_manual_link';

/**
 * 未关联采购单历史补全
 * 独立服务新页面，不影响现有采购单、采购计划产品视图和批量补货流程。
 */
@Provide()
@CoolController({
  api: [],
  entity: AppAmzBsrPurchaseOrderItemSyncLingxingEntity,
  service: AppBsrPurchaseOrderManualLinkService,
})
export class AdminBsrPurchaseOrderManualLinkController extends BaseController {
  @Inject()
  manualLinkService: AppBsrPurchaseOrderManualLinkService;

  @Post('/page', { summary: '未关联采购单历史补全分页' })
  async manualLinkPage(@Body() body: any) {
    try {
      const result = await this.manualLinkService.page(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '加载未关联采购单失败');
    }
  }

  @Post('/stats', { summary: '未关联采购单历史补全统计' })
  async stats(@Body() body: any) {
    try {
      const result = await this.manualLinkService.stats(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '加载补全统计失败');
    }
  }

  @Post('/shelfPreview', { summary: '采购单历史补全搁置预览' })
  async shelfPreview(@Body() body: any) {
    try {
      const result = await this.manualLinkService.shelfPreview(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '加载搁置预览失败');
    }
  }

  @Post('/shelveItems', { summary: '搁置采购单产品明细' })
  async shelveItems(@Body() body: any) {
    try {
      const result = await this.manualLinkService.shelveItems(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '搁置采购单产品明细失败');
    }
  }

  @Post('/unshelveItems', { summary: '恢复采购单产品明细' })
  async unshelveItems(@Body() body: any) {
    try {
      const result = await this.manualLinkService.unshelveItems(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '恢复采购单产品明细失败');
    }
  }

  @Post('/shelveByFilter', { summary: '按当前筛选搁置采购单产品明细' })
  async shelveByFilter(@Body() body: any) {
    try {
      const result = await this.manualLinkService.shelveByFilter(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '按筛选搁置失败');
    }
  }

  @Post('/unshelveByFilter', { summary: '按当前筛选恢复采购单产品明细' })
  async unshelveByFilter(@Body() body: any) {
    try {
      const result = await this.manualLinkService.unshelveByFilter(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '按筛选恢复失败');
    }
  }

  @Post('/completedPage', { summary: '已补全采购单历史记录分页' })
  async completedPage(@Body() body: any) {
    try {
      const result = await this.manualLinkService.completedPage(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '加载已补全记录失败');
    }
  }

  @Post('/completedStats', { summary: '已补全采购单历史记录统计' })
  async completedStats(@Body() body: any) {
    try {
      const result = await this.manualLinkService.completedStats(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '加载已补全统计失败');
    }
  }

  @Post('/searchListings', { summary: '搜索店铺商品用于人工选品' })
  async searchListings(@Body() body: any) {
    try {
      const result = await this.manualLinkService.searchListings(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '搜索店铺商品失败');
    }
  }

  @Post('/prepare', { summary: '准备采购单历史补全快照草稿' })
  async prepare(@Body() body: any) {
    try {
      const result = await this.manualLinkService.prepare(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '加载补全草稿失败');
    }
  }

  @Post('/complete', { summary: '补全采购单本地分析关联' })
  async complete(@Body() body: any) {
    try {
      const result = await this.manualLinkService.complete(body || {});
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message || '补全采购单关联失败');
    }
  }
}
