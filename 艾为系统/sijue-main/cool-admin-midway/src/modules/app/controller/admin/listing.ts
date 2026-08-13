import {CoolController, BaseController} from '@cool-midway/core';
import {AppAmzListingEntity} from '../../entity/listing';
import {AppAmzSellerEntity} from "../../entity/seller";
import {Context} from "@midwayjs/koa";
import {Body, Inject, Post} from "@midwayjs/decorator";
import {AppAmzListingService} from "../../service/listing";
import {Scope, ScopeEnum} from "@midwayjs/core";
import {AppOperationLogService} from "../../service/operation_log";
import {appConfig} from "../../../../appConfig";
import {InjectEntityModel} from "@midwayjs/typeorm";
import {Repository} from "typeorm";
import * as dayjs from "dayjs";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import {AppAmzBsrCandidateEntity} from "../../entity/bsr_candidate";
import {TacticRunner} from "../../biz_logic/TacticRunner";

@Scope(ScopeEnum.Request, {allowDowngrade: true})
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzListingEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'a.asin',
      'a.seller_sku',
      'a.local_sku',
      'a.item_name',
      'a.local_name',
      'b.name','candidate_id'],

    fieldEq: [
      'a.sid',
      'a.seller_sku',
      'a.asin',
      'a.status',
      'a.is_delete',
      'a.is_custom_listing',
      'a.is_suspended',
      'a.candidate_id',
    ],

    select: [
      'a.*',
      'b.name as sellerName'
    ],

    join: [
      {
        entity: AppAmzSellerEntity,
        alias: 'b',
        condition: 'a.sid = b.sid',
        type: 'leftJoin',
      },
      {
        entity: AppAmzBsrCandidateEntity,
        alias: 'c',
        condition: 'a.candidate_id = c.id',
        type: 'leftJoin',
      }
    ],

    where: async (ctx: Context) => {
      let whereOptions = [];

      const {username, sids} = ctx.admin;
      if (username !== 'admin') {
        whereOptions.push([`a.sid in (${sids.length > 0 ? sids : null})`, {}]);
      }

      // @ts-ignore
      let tactic_type = ctx.request?.body?.tactic_type;
      if (tactic_type) {
        let whereSql = '';
        if (tactic_type === 'price') whereSql = `a.tactic_hint_price <> ''`;
        if (tactic_type === 'inventory') whereSql = `a.tactic_hint_inventory <> ''`;
        if (tactic_type === 'both') whereSql = `(a.tactic_hint_price <> '' OR a.tactic_hint_inventory <> '')`;

        whereOptions.push([whereSql, {}]);
      }

      // @ts-ignore
      let asin_list = ctx.request?.body?.asin_list;
      if (asin_list) {
        whereOptions.push([`a.asin IN (:asin_list)`, {asin_list}]);
      }
      return whereOptions;
    },

  }
})
@updateWithoutAmendingCreateTime
export class AdminListingController extends BaseController {
  @InjectEntityModel(AppAmzListingEntity)
  amzListingRepo: Repository<AppAmzListingEntity>;

  @InjectEntityModel(AppAmzSellerEntity)
  sellerRepo: Repository<AppAmzSellerEntity>;

  @Inject()
  listingService: AppAmzListingService;

  @Inject()
  operationLogService: AppOperationLogService;

  @Inject()
  tacticRunner: TacticRunner;

  @Post('/testStrategy')
  async testStrategy(@Body('id') id: number, @Body('type') type: string) {
    if (!id || !type) {
      return this.fail('id and type are required');
    }

    const listing = await this.amzListingRepo.findOne({where: {id}});
    if (!listing) {
      return this.fail('Listing not found');
    }

    try {
      if (type === 'p1') {
        await this.tacticRunner.executeTacticPriceP1(listing);
      } else if (type === 'p2') {
        await this.tacticRunner.executeTacticPriceP2(listing);
      } else if (type === 'p3') {
        await this.tacticRunner.executeTacticPriceP3(listing);
      } else if (type === 'p4') {
        await this.tacticRunner.executeTacticPriceP4(listing);
      } else {
        return this.fail('Unknown strategy type');
      }

      // Fetch the updated listing to get the hints
      const updatedListing = await this.amzListingRepo.findOne({where: {id}});
      return this.ok({
        tactic_hint_price: updatedListing.tactic_hint_price,
        tactic_price_suggested_new_price: updatedListing.tactic_price_suggested_new_price
      });
    } catch (err) {
      console.error(err);
      return this.fail('Strategy execution failed: ' + err.message);
    }
  }

  @Inject()
  ctx: Context;


  @Post('/modify_price')
  async modifyPrice(
    @Body('listingList') listingList: Array<AppAmzListingEntity>
  ) {

    let result = await this.listingService.modifyPrice(listingList);

    if (typeof result?.success_num === 'number' && result.success_num > 0) {
      let sellers = await this.sellerRepo.find();
      listingList.forEach(listing => {
        for (let i = 0; i < sellers.length; i++) {
          if (listing.sid === sellers[i].sid) {
            // @ts-ignore
            listing.sellerName = sellers[i].name;
            break;
          }
        }
      });
      console.log(listingList);

      // @ts-ignore
      await this.operationLogService.insertLog({
        via: this.ctx?.admin?.username,
        description: listingList.map(listing => {
          // @ts-ignore
          return `${listing?.sellerName || ''}｜${listing.asin}：`
            + `原价格 ${listing.landed_price} -> 新价格 ${listing.tactic_price_suggested_new_price}【${listing.tactic_hint_price}】`
        }).join('\n'),
        type: appConfig.OPERATION_LOG_TYPE.PRICE.value,
      });

      return this.ok();
    } else {
      return this.fail(result?.failure_detail[0]?.msg);
    }
  }


  @Post('/create_purchase_plan')
  async createPurchasePlan(
    @Body('listingList') listingList: Array<AppAmzListingEntity>,
    @Body('remark') remark: string = '',
  ) {

    remark = `操作人：${this.ctx?.admin?.username} ${remark}`.trim();

    let result = await this.listingService.createPurchasePlan(listingList, remark);

    if (result.code === 0) {
      // @ts-ignore
      await this.operationLogService.insertLog({
        via: this.ctx?.admin?.username,
        description: listingList.map(listing => {
          // @ts-ignore
          return `${listing?.sellerName || ''}｜${listing.asin}：`
            + `原库存 ${appConfig.cal_listing_logical_inventory(listing)}｜新采购 ${listing.tactic_inventory_new_quantity_plan}【${listing.tactic_hint_inventory}】`
        }).join('\n'),
        type: appConfig.OPERATION_LOG_TYPE.INVENTORY.value,
      });

      await this.amzListingRepo.save(listingList.map(listing => {
        return {
          id: listing.id,
          tactic_inventory_ignore_until: dayjs().add(7, 'days').toDate(),
        }
      }));

      return this.ok();
    } else {
      return this.fail(result?.error_details || '创建待采购的采购计划失败。');
    }
  }

  @Post('/query_local_product_info')
  async query_local_product_info(
    @Body('sku_list') sku_list: string[] = [],
  ) {
    return await this.listingService.queryLocalProductInfo(sku_list);
  }
}
