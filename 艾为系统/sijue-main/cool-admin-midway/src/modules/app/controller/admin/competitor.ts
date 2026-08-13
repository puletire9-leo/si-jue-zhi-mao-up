import {CoolController, BaseController} from '@cool-midway/core';
import {AppAmzListingCompetitorEntity} from '../../entity/competitor';
import {AppAmzSellerEntity} from "../../entity/seller";
import {Context} from "@midwayjs/koa";
import {AppAmzListingCompetitorService} from "../../service/competitor";
import {Body, Inject, Post} from "@midwayjs/decorator";
import {AppAmzListingEntity} from "../../entity/listing";
import {InjectEntityModel} from "@midwayjs/typeorm";
import {Repository} from "typeorm";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzListingCompetitorEntity,
  pageQueryOp: {
    fieldEq: [
      'a.sid',
      'asin_mine',
      'a.seller_sku',
      'a.status',
      'c.is_custom_listing',],
    keyWordLikeFields: [
      'asin_mine',
      'asin_competitor',
      'a.item_name', 'a.seller_sku',],
    select: [
      'a.*',
      'b.name as sellerName',
      'c.is_custom_listing as is_custom_listing',
      'c.small_image_url as small_image_url_mine',
      'c.local_name as local_name_mine',
      'c.marketplace',],
    join: [
      {
        entity: AppAmzSellerEntity,
        alias: 'b',
        condition: 'a.sid = b.sid',
        type: 'leftJoin',
      },
      {
        entity: AppAmzListingEntity,
        alias: 'c',
        condition:
          'a.sid = c.sid AND ' +
          'a.asin_mine = c.asin AND ' +
          'a.seller_sku = c.seller_sku',
        type: 'leftJoin',
      }
    ],
    where: async (ctx: Context) => {
      const {username, sids} = ctx.admin;
      return username !== 'admin' ? [
        [`a.sid in (${sids.length > 0 ? sids : null})`, {}],
      ] : [];
    },
  }
})
@updateWithoutAmendingCreateTime
export class AdminAppAmzListingCompetitorController extends BaseController {
  @Inject()
  appAmzListingCompetitorService: AppAmzListingCompetitorService;

  @InjectEntityModel(AppAmzListingCompetitorEntity)
  competitorRepo: Repository<AppAmzListingCompetitorEntity>;

  @Post('/batch_duplicate_to_listings')
  async batch_duplicate_to_listings(
    @Body('competitors') competitors: AppAmzListingCompetitorEntity[],
    @Body('listings') listings: AppAmzListingEntity[],
  ) {
    await this.appAmzListingCompetitorService.batchDuplicateToListings(competitors, listings);
    return this.ok('ok');
  }

  @Post('/batch_update_status_library')
  async batch_update_status_library(
    @Body('competitors') competitors: AppAmzListingCompetitorEntity[],
  ) {
    await this.appAmzListingCompetitorService.batchUpdateStatusLibrary(competitors);
    return this.ok('ok');
  }

  @Post('/batch_analyse_competitor_bsr_ranking')
  async batch_analyse_competitor_bsr_ranking(
    @Body('amount') amount: number = 50,
  ) {
    let result = await this.appAmzListingCompetitorService.batchAnalyseCompetitorBsrRanking(amount);
    return this.ok(result);
  }
}
