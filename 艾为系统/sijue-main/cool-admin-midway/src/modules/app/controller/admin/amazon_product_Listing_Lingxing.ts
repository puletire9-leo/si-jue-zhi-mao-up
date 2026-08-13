import { CoolController, BaseController } from '@cool-midway/core';
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import { InjectEntityModel } from "@midwayjs/typeorm";
import { Repository } from "typeorm";
import { Body, Post, Query ,Get} from "@midwayjs/decorator";
import { Inject } from '@midwayjs/decorator';
import { Context } from "@midwayjs/koa";
import { AppAmzProductListingLingxingService } from "../../service/amazon_product_Listing_Lingxing";
import { AppAmzBsrProductListingLingxingEntity } from "../../entity/bsr_product_Listing_Lingxing";
import { LingXingUtils } from "../../utils/lingxing/lingxingUtils";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrProductListingLingxingEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'a.asin',
      'a.local_name',
      'a.remark',
      'a.msku',
    ],
    fieldEq: [
      'a.status',
      'a.sale_analyze_result',
      'a.marketplace',
      'a.volume_analyze_result',
      'a.price_analyze_result',
      'a.arrival_analyze_result',
      'a.marketplace_id',
      'a.product_code',
      'a.product_id',
      'a.mergeId',
    ],
  },
})
@updateWithoutAmendingCreateTime
export class AdminAmazonProductListingLingxingController extends BaseController {
  
  @Inject()
  appAmzProductListingLingxingService: AppAmzProductListingLingxingService;

  
  @Inject()
  lingXingUtils: LingXingUtils;

  @Inject()
  ctx: Context;

  @Post('/bzyShiTu_UK')
  async startTask() {
    try {
      const result = await this.appAmzProductListingLingxingService.processAllCountriesInOrder();
      return result;
    } catch (error) {
      return this.fail(error.message);
    }
  }

  /**
   * 停止八爪鱼任务采集
   * @param taskId 任务ID
   */
  @Post('/bzyStopTask')
  async stopTask(@Body('taskId') taskId: string) {
    if (!taskId) {
      return this.fail('任务ID不能为空');
    }
    const result = await this.appAmzProductListingLingxingService.stopBzyTask(taskId);
    return result;
  }

  /**
   * 获取多个任务状态
   * @param taskIds 任务ID列表
   */
  @Post('/bzyGetTaskStatuses')
  async getTaskStatuses(@Body('taskIds') taskIds: string[]) {
    if (!taskIds || taskIds.length === 0) {
      return this.fail('任务ID列表不能为空');
    }
    const result = await this.appAmzProductListingLingxingService.getBzyTaskStatuses(taskIds);
    return result;
  }

  /**
   * 轮询获取单个任务状态
   * @param taskId 任务ID
   */
  @Post('/bzyPollTaskStatus')
  async pollTaskStatus(@Query('taskId') taskId: string) {
    if (!taskId) {
      return this.fail('任务ID不能为空');
    }
    const result = await this.appAmzProductListingLingxingService.pollTaskStatus(taskId);
    return result;
  }

  
  @Post('/searchByItemName')
  async searchByItemName() {
    try {
      // 直接调用服务中的processSearchByItemName方法
      const result = await this.appAmzProductListingLingxingService.processSearchByItemName();
      return this.fail('获取搜索页数据流程执行完成');
    } catch (error) {
      return this.fail(`执行失败: ${error.message}`);
    }
  }

   /**
   * 阿里云以图识图处理（根据相似度分数更新状态或删除）
   * @param params 可选参数（如筛选条件）
   */
   @Post('/aliyunImageSearch')
   async aliyunImageSearch() {
     try {
       // 可通过ids参数指定处理特定ID的数据，为空则处理全部符合条件的数据
       const result = await this.appAmzProductListingLingxingService.processAliyunImageSimilarity();
       return this.fail('以图识图处理完成');
     } catch (error) {
       return this.fail(`处理失败: ${error.message}`);
     }
   }

   @Post('/getLatestTaskStatus')
async getLatestTaskStatus() {
  try {
    const result = await this.appAmzProductListingLingxingService.getLatestTaskStatus();
    return result;
  } catch (error) {
    return this.fail(error.message);
  }
}


@Post('/aliyunImageUpload')
async aliyunImageUpload() {
  try {
    // 可通过ids参数指定处理特定ID的数据，为空则处理全部符合条件的数据
    const result = await this.appAmzProductListingLingxingService.processAliyunImageUpload();
    return this.fail('以图识图处理完成');
  } catch (error) {
    return this.fail(`处理失败: ${error.message}`);
  }
}


  @Get('/exportData2')
  async exportData2() {
    // 获取双 CSV 数据
    const { csvData, departmentCsv } = await this.appAmzProductListingLingxingService.exportData2();

    // 返回 JSON 结构（与 exportData 一致）
    this.ctx.set('Content-Type', 'application/json');
    this.ctx.body = { csvData, departmentCsv };
  }


/**
 * 批量更新mergeId
 * @param ids 实体ID数组
 * @param mergeId 目标mergeId值
 */
  @Post('/updateMergeId')
  async updateMergeId(@Body('ids') ids: number[], @Body('mergeId') mergeId: string) {
    if (!ids || ids.length === 0 || !mergeId) {
      return this.fail('实体ID数组和目标mergeId不能为空');
    }
    const result = await this.appAmzProductListingLingxingService.updateMergeId(ids, mergeId);
    return result;
    
  }

  
  @Post('/getCompetitor')
  async getCompetitor() {
    const result = await this.appAmzProductListingLingxingService.fetchDataFromSellersSpriteAndSave();
    return result;
  }

  @Post('/sellerspriteCompetitorLookup')
  async sellerspriteCompetitorLookup(@Body() params: { marketplace: string; asins: string[] }) {
    try {
      const result = await this.appAmzProductListingLingxingService.sellerspriteCompetitorLookup(params);
      return result;
    } catch (error) {
      return this.fail(error.message);
    }
  }

  
  @Post('/manualDeduplicate')
  async manualDeduplicate() {
    try {
      const result = await this.appAmzProductListingLingxingService.deduplicateCompetitorData();
      return this.ok(result);
    } catch (error) {
      return this.fail(`去重失败: ${error.message}`);
    }
  }

  @Post('/manualProcessSingleItem')
  async manualProcessSingleItem(@Body('id') id: number) {
    if (!id) {
      return this.fail('ID不能为空');
    }
    try {
      const result = await this.appAmzProductListingLingxingService.manualProcessSingleItem(id);
      return this.ok(result);
    } catch (error) {
      return this.fail(error.message);
    }
  }

  @Post('/runIntegratedTask')
  async runIntegratedTask() {
    try {
      const result = await this.appAmzProductListingLingxingService.runIntegratedTask();
      return this.ok(result);
    } catch (error) {
      return this.fail(`综合任务执行失败: ${error.message}`);
    }
  }

  // @Post('/requestLingXingListing')
  // async requestLingXingListing() { 
  //   const result = await this.lingXingUtils.syncLingXingListingToDB();
  //   return result;
  // }
}
