import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzBsrProductListingLingxingEntity } from "../../entity/bsr_product_Listing_Lingxing";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import { Body, Post, Query, Get, Inject } from "@midwayjs/decorator";
import { LingXingUtils } from "../../utils/lingxing/lingxingUtils";
import { AppAmzBsrProductListingLingxingService } from "../../service/bsr_product_Listing_Lingxing";
import { AppAmzBsrCandidateCompetitorService } from "../../service/bsr_candidate_competitor";
import { InjectEntityModel } from "@midwayjs/typeorm";
import { Repository, In } from "typeorm";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrProductListingLingxingEntity,
  service: AppAmzBsrProductListingLingxingService,
  pageQueryOp: {
    keyWordLikeFields: [
      'mergeId','msku','asin','shop','item_name','product_code','local_name'
    ],
    fieldEq: [
      'mergeId','msku','asin','shop','item_name','local_name','status','marketplace','product_code',
      'outOfStockStatus',
      'abnormalOfflineStatus',
      'newProductStatus',
      'needUpdateOperationPlan',
      'categoryTrafficStatus',
      'productTrafficStatus',
      'stockOver90Days',
      'seller_name','inventoryStatusText','in_transit_type'
    ],
  },
})
@updateWithoutAmendingCreateTime
export class AdminBsrProductListingLingxingController extends BaseController {
    @Inject()
    lingXingUtils: LingXingUtils;

    @Inject()
    bsrProductListingLingxingService: AppAmzBsrProductListingLingxingService;

    @Inject()
    bsrCandidateCompetitorService: AppAmzBsrCandidateCompetitorService;

    @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
    listingRepo: Repository<AppAmzBsrProductListingLingxingEntity>;

    @Get('/getStores')
    async getStores() {
        const result = await this.bsrProductListingLingxingService.getStores();
        return this.ok(result);
    }

    @Get('/getShops')
    async getShops() {
        const result = await this.bsrProductListingLingxingService.getShops();
        return this.ok(result);
    }

    @Get('/getProductCodes')
    async getProductCodes() {
        const result = await this.bsrProductListingLingxingService.getProductCodes();
        return this.ok(result);
    }

    @Post('/requestLingXingListing')
    async requestLingXingListing() { 
      const result = await this.lingXingUtils.syncLingXingListingToDB();
      return this.ok(result);
    }

    @Post('/requestLingXingListingByAsin')
    async requestLingXingListingByAsin(@Body('asin') asin: string) {
        if (!asin || !String(asin).trim()) {
            return this.fail('缺少必要参数 asin');
        }
        const result = await this.bsrProductListingLingxingService.syncListingDataByAsin(asin);
        return this.ok(result);
    }

    @Post('/batchUpdateCompetitorDetails')
    async batchUpdateCompetitorDetails() {
        const result = await this.bsrProductListingLingxingService.batchUpdateCompetitorDetails();
        return this.ok(result);
    }

    @Post('/adPerformancePage')
    async adPerformancePage(@Body() body: any) {
        const result = await this.bsrProductListingLingxingService.adPerformancePage(body || {});
        return this.ok(result);
    }

    @Post('/recoverCompetitorsFromApiError')
    async recoverCompetitorsFromApiError(@Body() body: { startTime?: string; endTime?: string }) {
        const result = await this.bsrCandidateCompetitorService.recoverCompetitorsAffectedByApiError(
            body?.startTime,
            body?.endTime
        );
        return this.ok(result);
    }

    @Post('/updateInventoryStatus')
    async updateInventoryStatus(@Body('ids') ids: number[]) {
        const result = await this.bsrProductListingLingxingService.batchUpdateInventoryStatus(ids);
        return this.ok(result);
    }

    @Post('/saveHistoryRule')
    async saveHistoryRule(@Body() body: any) {
        const result = await this.bsrProductListingLingxingService.saveHistoryRule(body);
        return this.ok(result);
    }

    @Post('/executeHistoryRule')
    async executeHistoryRule(@Body() body: any) {
        const result = await this.bsrProductListingLingxingService.executeHistoryRule(body);
        return this.ok(result);
    }

    @Post('/fetchSinglePricingAndDimensions')
    async fetchSinglePricingAndDimensions(@Body() body: { id: number; sid: number; msku: string; marketplace: string }) {
        const { id, sid, msku, marketplace } = body;
        if (!id || !msku) {
            return this.fail('缺少必要参数');
        }
        
        // 调用 LingxingUtils 获取最新数据
        const newData = await this.lingXingUtils.fetchSingleListingPricingAndDimensions(sid, msku, marketplace);
        
        // 更新数据库
        if (Object.keys(newData).length > 0) {
            await this.bsrProductListingLingxingService.update({
                id,
                ...newData
            });
        }
        
        return this.ok(newData);
    }

    @Post('/assignProductCode')
    async assignProductCode(@Body() body: { id: number; product_code: string }) {
        const { id, product_code } = body;
        if (!id || !product_code) {
            return this.fail('缺少必要参数');
        }
        try {
            const result = await this.bsrProductListingLingxingService.assignProductCode(id, product_code);
            return this.ok(result);
        } catch (error: any) {
            return this.fail(error?.message || '操作失败');
        }
    }

    @Post('/repairHyphenProductCodeLocalNames')
    async repairHyphenProductCodeLocalNames(@Body() body: { dryRun?: boolean; ids?: number[]; product_code?: string; limit?: number }) {
        try {
            const result = await this.bsrProductListingLingxingService.repairHyphenProductCodeLocalNames(body || {});
            return this.ok(result);
        } catch (error: any) {
            return this.fail(error?.message || '鎿嶄綔澶辫触');
        }
    }

    @Post('/batchSetRestockSetting')
    async batchSetRestockSetting(@Body() body: { ids: number[]; settingType: number; futureRestockDate?: string; futureRestockQuantity?: number }) {
        try {
            const result = await this.bsrProductListingLingxingService.batchSetRestockSetting(body);
            return this.ok(result);
        } catch (error: any) {
            return this.fail(error?.message || '操作失败');
        }
    }
}
