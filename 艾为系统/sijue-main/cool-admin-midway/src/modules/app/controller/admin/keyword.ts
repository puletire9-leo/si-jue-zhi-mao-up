import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzListingKeywordEntity } from '../../entity/keyword';
import { Inject, Get, Post, Body } from '@midwayjs/decorator';
import { AppAmzListingKeywordService } from "../../service/keyword";
import { Context } from "@midwayjs/koa";
import { AppAmzSellerEntity } from "../../entity/seller";
import { AppAmzListingEntity } from "../../entity/listing";
import { InjectEntityModel } from "@midwayjs/typeorm";
import { Repository } from "typeorm";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import { SellerspriteTool } from "../../utils/maijiajingling/SellerspriteUtil";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzListingKeywordEntity,
  pageQueryOp: {
    fieldEq: [
      'a.sid',
      'a.asin',
      'a.seller_sku',
      'a.status',
      'c.is_custom_listing', 'a.marketplaces', 'a.is_core'],
    keyWordLikeFields: [
      'a.value',
      'a.asin',
      'a.seller_sku', 'c.item_name', 'c.local_name', 'a.marketplaces', 'a.is_core'
    ],
    select: [
      'a.*',
      'b.name as sellerName',
      'c.small_image_url', 'c.is_custom_listing', 'c.item_name', 'c.local_name', 'c.marketplace', 'c.status as listing_status',
      'c.is_delete as listing_is_delete',
    ],
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
          'a.asin = c.asin AND ' +
          'a.seller_sku = c.seller_sku',
        type: 'leftJoin',
      }
    ],
    // where: async (ctx: Context) => {
    //   const {username, sids} = ctx.admin;
    //   return username !== 'admin' ? [
    //     [`a.sid in (${sids.length > 0 ? sids : null})`, {}],
    //   ] : [];
    // },
  },
})
@updateWithoutAmendingCreateTime
export class AdminAmzListingKeywordsController extends BaseController {
  @Inject()
  ctx: Context;
  @Inject()
  appAmzListingKeywordService: AppAmzListingKeywordService;


  @Inject()
  sellerspriteTool: SellerspriteTool;
  @InjectEntityModel(AppAmzListingKeywordEntity)
  amzListingKeywordRepo: Repository<AppAmzListingKeywordEntity>;

  @Post('/batch_import')
  async batchImport(
    @Body('sid') sid: number,
    @Body('asin') asin: string,
    @Body('seller_sku') seller_sku: string,
    @Body('keywords') keywords: string[],
    @Body('is_core') is_core: boolean,
    @Body('marketplaces') marketplaces: string,
    @Body('weight') weight: number,
  ) {
    await this.appAmzListingKeywordService.batchImport(sid, asin, seller_sku, keywords, is_core, marketplaces, weight);
    return this.ok('ok');
  }


  @Post('/batch_duplicate_to_listings')
  async batch_duplicate_to_listings(
    @Body('keywords') keywords: AppAmzListingKeywordEntity[],
    @Body('listings') listings: AppAmzListingEntity[],
  ) {
    await this.appAmzListingKeywordService.batchDuplicateToListings(keywords, listings);
    return this.ok('ok');
  }

  @Post('/batch_update_status_library')
  async batch_update_status_library(
    @Body('keywords') keywords: AppAmzListingKeywordEntity[],
  ) {
    await this.appAmzListingKeywordService.batchUpdateStatusLibrary(keywords);
    return this.ok('ok');
  }




  @Post('/countByCountry')
  async countByCountry(@Body('asin') asin: string) {
    return this.appAmzListingKeywordService.countByCountry(asin);

  }


  @Post('/add2')
  async add2(@Body() param: any) {
    try {
      const result = await this.appAmzListingKeywordService.add2(param);
    } catch (err) {
    }
  }


  @Post('/setKeywordTypesByAsin')
  async setKeywordTypesByAsin(@Body('asin') asin: string) {
    this.appAmzListingKeywordService.setKeywordTypesByAsin(asin);
    return this.ok('ok');
  }


  @Post('/exportKeyword')
  async exportKeyword(@Body('asin') asin: string) {
    console.log('exportKeyword', asin);
    const { csv } = await this.appAmzListingKeywordService.exportKeyword(asin);
    this.ctx.set('Content-Type', 'application/json'); // 改为JSON响应
    this.ctx.body = csv;
  }

  @Post('/fetchKeywords')
  async fetchCandidateKeywords(@Body() body: { ids: number[], statusList?: number[] }) {
    try {
      // 1. 参数校验
      const { ids, statusList } = body;
      if (!ids || ids.length === 0) {
        return this.fail('请先选择需要获取关键词的候选产品');
      }

      // 2. 调用卖家精灵工具类，获取并保存关键词
      const result = await this.sellerspriteTool.fetchAndSaveAsinKeywords(
        ids,
        undefined,
        statusList
      );

      // 3. 根据结果返回对应信息
      if (result.success) {
        return this.ok(result.message);
      } else {
        return this.fail(result.message);
      }
    } catch (error) {
      const errMsg = (error as Error).message || '获取关键词异常';
      console.error('获取关键词接口异常:', error);
      return this.fail(errMsg);
    }
  }

  @Post('/fetchKeywordsByProductCode')
  async fetchKeywordsByProductCode(@Body() body: { product_code: string, marketplace: string, statusList?: number[] }) {
    try {
      const { product_code, marketplace, statusList } = body;
      if (!product_code || !marketplace) {
        return this.fail('请提供 product_code 和 marketplace');
      }

      const result = await this.sellerspriteTool.fetchAndSaveAsinKeywordsByProductCode(
        product_code,
        marketplace,
        undefined,
        statusList || [6]
      );

      if (result.success) {
        return this.ok(result.message);
      } else {
        return this.fail(result.message);
      }
    } catch (error) {
      const errMsg = (error as Error).message || '获取关键词异常';
      console.error('获取关键词接口异常:', error);
      return this.fail(errMsg);
    }
  }
}

