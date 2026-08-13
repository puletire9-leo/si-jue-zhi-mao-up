import {BaseController, CoolController} from '@cool-midway/core';
import {Get, Inject} from "@midwayjs/decorator";
import {AppAmzSellerService} from "../../service/seller";
import {AppAmzListingService} from "../../service/listing";
import {AppAmzListingKeywordService} from "../../service/keyword";
import {AppAmzListingCompetitorService} from "../../service/competitor";
import {In, Not} from "typeorm";
import {Context} from "@midwayjs/koa";
import {SellerSpriteUtils} from "../../utils/sellerSpriteUtils";

@CoolController({})
export class OverviewController extends BaseController {
  @Inject()
  sellerService: AppAmzSellerService;

  @Inject()
  listingService: AppAmzListingService;

  @Inject()
  keywordService: AppAmzListingKeywordService;

  @Inject()
  competitorService: AppAmzListingCompetitorService;

  @Inject()
  sellerSpriteUtils: SellerSpriteUtils;

  @Inject()
  ctx: Context;

  @Get('/get_statistics')
  async getSysParams() {
    let statistics = {
      sellers: null,
      listings: null,
      custom_listings: null,
      todo_keywords: null,
      todo_competitors: null,
      todo_tactic_price: null,
      todo_tactic_inventory: null,
      seller_sprite_api_visits: [],
    };

    const {username, sids} = this.ctx.admin;
    const is_super_admin = 'admin' === username;

    try {
      statistics.sellers = is_super_admin ? await this.sellerService.getSellerTotalCount() : sids?.length;
      statistics.listings = await this.listingService.getListingTotalCount(true, is_super_admin ? {} : {sid: In(sids)});
      statistics.custom_listings = await this.listingService.getListingTotalCount(false, {is_custom_listing: 1});
      statistics.todo_keywords = await this.keywordService.getKeywordTodoTotalCount(is_super_admin ? {} : {sid: In(sids)});
      statistics.todo_competitors = await this.competitorService.getCompetitorTodoTotalCount(is_super_admin ? {} : {sid: In(sids)});
      statistics.todo_tactic_price = await this.listingService.getListingTotalCount(true, Object.assign({tactic_hint_price: Not('')}, is_super_admin ? {} : {sid: In(sids)}));
      statistics.todo_tactic_inventory = await this.listingService.getListingTotalCount(true, Object.assign({tactic_hint_inventory: Not('')}, is_super_admin ? {} : {sid: In(sids)}));

      statistics.seller_sprite_api_visits = (await this.sellerSpriteUtils.httpGet('/v1/visits', {}))?.data || [];

      return this.ok(statistics);
    } catch (err) {
      console.log(err);
    }
  }
}
