import { CoolController, BaseController } from '@cool-midway/core';
import { AmazonProductCompetitorStatisticsEntity } from "../../entity/amazon_product_competitor_statistics";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import { Inject, Get, Post, Body } from '@midwayjs/decorator';
import { AmazonProductCompetitorStatisticsService } from "../../service/amazon_product_competitor_statistics";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AmazonProductCompetitorStatisticsEntity,
  pageQueryOp: {
    keyWordLikeFields: [
    ],
    fieldEq: [
      "a.asin_candidate",
      "a.marketplace",
      "a.product_code"
    ],
  },
})
@updateWithoutAmendingCreateTime
export class AdminAmazonProductCompetitorStatisticsController extends BaseController {

  @Inject()
  amazonProductCompetitorStatisticsService: AmazonProductCompetitorStatisticsService;

  @Post('/updateCompetitorStatisticsData')
  async updateCompetitorStatisticsData(@Body() params: { 
    items: Array<{ asin_candidate: string, marketplace: string }> 
  }) {
    const result = await this.amazonProductCompetitorStatisticsService.statisticsProductCompetitor(params);
    return result;
  }

  @Post('/updateCompetitorStatisticsDataFromProcess')
  async updateCompetitorStatisticsDataFromProcess(@Body() params: { 
    product_codes?: string[];
    marketplace?: string;
    limit?: number;
    task_id?: number;
    crawler_time?: string;
  }) {
    const result = await this.amazonProductCompetitorStatisticsService.statisticsProductCompetitorFromProcess(params);
    return result;
  }
}
