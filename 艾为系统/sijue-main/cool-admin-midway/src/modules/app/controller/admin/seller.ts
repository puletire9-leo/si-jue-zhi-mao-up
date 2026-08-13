import {Body, Get, Inject, Post} from "@midwayjs/decorator";
import {BaseController, CoolController} from '@cool-midway/core';
import {AppAmzSellerEntity} from '../../entity/seller';
import {AppAmzSellerService} from "../../service/seller";
import {AppAmzListingService} from "../../service/listing";
import {Context} from '@midwayjs/koa';
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzSellerEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'sid',
      'name',
      'account_name',
      'region',
      'country',
    ],
    where: async (ctx: Context) => {
      const {username, sids} = ctx.admin;
      return username !== 'admin' ? [
        [`a.sid in (${sids.length > 0 ? sids : null})`, {}],
      ] : [];
    },
  },
})
@updateWithoutAmendingCreateTime
export class AdminAppAmzSellersController extends BaseController {
  @Inject()
  appAmzSellerService: AppAmzSellerService;

  @Inject()
  appAmzListingService: AppAmzListingService;
  

  @Get('/listAccounts')
  async listAccounts() {
    const list = await this.appAmzSellerService.listAccounts();
    return this.ok(list);
  }

  @Post('/sync_from_lx')
  async syncSellersFromLingXing() {
    return await this.appAmzSellerService.fetchSellers();
  }


  @Post('/sync_listings_from_lx')
  async syncListingsFromLingXing(@Body('sid') sid: number) {
    this.appAmzListingService.fetchListingsBySid(sid).then(res => void (0));
    return 'ok';
  }

  @Post('/sync_listings_yesterday_volume_from_lx')
  async syncListingsYesterdayVolumeFromLingXing(
    @Body('sid') sid: number,
  ) {
    return await this.appAmzListingService.fetchListingsVolumeBySid_v2(sid);
  }

  @Post('/sync_listings_volume_from_lx')
  async syncListingsVolumeFromLingXing(
    @Body('sid') sid: number,
    @Body('days') days: number = 15
  ) {
    return await this.appAmzListingService.fetchListingsVolumeBySid(sid, days);
  }

  @Post('/sync_listings_fba_inventory_from_lx')
  async syncListingsFbaInventoryFromLingXing(@Body('sid') sid: number) {
    return await this.appAmzListingService.fetchListingAgingInventoryBySid(sid);
  }
}
