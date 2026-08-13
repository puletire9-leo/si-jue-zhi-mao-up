import {CoolController, BaseController} from '@cool-midway/core';
import {AppAmzAiListingWriteEntity} from "../../entity/ai_listing_write";
import {AppAmzBsrTaskEntity} from "../../entity/bsr_task";
import {InjectEntityModel} from "@midwayjs/typeorm";
import {Repository} from "typeorm";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import {Context} from "@midwayjs/koa";
import { truncate } from 'fs';
import {Configuration, App, Inject, Get,ALL} from '@midwayjs/decorator';
import {AppAmzBsrCandidatePurchaserEntity} from "../../entity/bsr_candidate_purchaser";
import {BaseSysUserEntity} from "../../../base/entity/sys/user";
import {AppAmzAiListingWriteService} from "../../service/ai_listing_write";
import {Body, Post} from "@midwayjs/decorator";
import { get } from 'http';
import { Console } from 'console';
import * as dayjs from 'dayjs';


@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzAiListingWriteEntity,
  service: AppAmzAiListingWriteService,
  pageQueryOp: {
    keyWordLikeFields: [
      'a.bsr_link',
      'a.asin',
      'a.item_name',
      'a.bsr_html',
      'a.patent_memo',
      'a.opinion_dev',
      'a.opinion_operator',
      'a.opinion_procurement',
      'a.remark', 
      'produce_name',
      'a.userid'
    ],
    fieldEq: [
      'a.status', 'a.remark',  
      'competitor_import_status',
      'profit_calculation_status',
      'competitor_full_ownership_status',
      'keyword_import_status',
      'UKDEStatus','a.asinid','a.asin','a.userid'
    ],
    select: [
      'a.id', 'a.bsr_task_id', 'a.bsr_link', 'a.marketplace', 'a.asin', 'a.sku',
      'a.seller_id', 'a.item_name', 'a.produce_name', 'a.image_url', 'a.price',
      'a.review_num', 'a.variants', 'a.last_star', 'a.bsr_html', 'a.bsr_category', 'a.bsr_rank',
      'a.dispatches_from', 'a.sold_by', 'a.bullet_points', 'a.dimensions', 'a.weight',
      'a.date_first_available', 'a.seller_country', 'a.cost_price', 'a.selling_price', 'a.length',
      'a.width', 'a.height', 'a.dimensional_weight', 'a.actual_weight', 'a.first_leg_freight',
      'a.fba_freight', 'a.exchange_rate', 'a.tax_rate', 'a.gross_profit_rate', 'a.gross_profit',
      'a.describe', 'a.patent_memo', 'a.opinion_dev', 'a.opinion_operator', 'a.opinion_procurement',
      'a.factory_links', 'a.keyword_screenshots', 'a.status', 'a.competitor_spider_status',
      'a.competitor_spider_res', 'a.competitor_spider_time', 'a.remark', 'a.max_purchase', 'a.createTime', 'a.updateTime'
      , 'a.image_url2', 'a.image_url3', 'a.image_url4', 'a.image_url5', 'a.image_url6','a.source','a.aliyun_img','a.asinid'
      ,'a.userid','a.msku','a.marketplaceNeeds','u.accountName AS accountName','a.variant_Combination','a.candidate_id'
      // `(SELECT GROUP_CONCAT(DISTINCT p.selectedVariant) 
      // FROM app_amz_bsr_candidate_purchaser p 
      // WHERE p.candidate_id = a.asinid 
      // AND p.purchaser = u.name
      // ) AS variantName`
      // ,'a.bsr_node','a.bsr_node_rank'
    ],
    join: [
      {
        entity: BaseSysUserEntity, // 实体名需根据实际项目中的类名调整
        alias: 'u',
        condition: 'a.userid = u.id', // 关联店铺用户
        type: 'leftJoin',
      }
    ]
  }
})




@updateWithoutAmendingCreateTime
export class AdminAppAmzAiListingWriteontroller extends BaseController {
  @InjectEntityModel(AppAmzAiListingWriteEntity)
  bsrCandidateRepo: Repository<AppAmzAiListingWriteEntity>;

  @InjectEntityModel(AppAmzBsrCandidatePurchaserEntity)
  bsrCandidatePurchaserEntity: Repository<AppAmzBsrCandidatePurchaserEntity>;
  @Inject()
  
  ctx: Context;

  
  @Inject()
  appAmzBsrCandidateService:AppAmzAiListingWriteService
  
  async info(): Promise<{ code: number; message: string; }> {
    let id = this.ctx.query?.id;
    let actualId: string;

    if (typeof id === 'string') {
      actualId = id;
    } else if (Array.isArray(id) && id.length > 0) {
      actualId = id[0];
    } else {
      return this.ok();
    }
    try {

      const info = await this.bsrCandidateRepo.findOneBy({ id: parseInt(actualId) });
      if (!info) {
        const combinedData = {
          ...info,
        }
        return this.ok(combinedData);
      }
      const purchasers = await this.bsrCandidatePurchaserEntity.findBy({ candidate_id: info.asinid.toString() });
      if (purchasers.length === 0) {
        const combinedData = {
          ...info,
        }
        return this.ok(combinedData);
      }
      const combinedData = {
        ...info,
        purchasers: purchasers.map(purchaser => ({
          purchaser: purchaser.purchaser,
          userId: purchaser.userId,
          purchaserNum: purchaser.purchaserNum || {},
          id: purchaser.id,
          is_generate: Number(purchaser.is_generate) || 0,
          procurement:purchaser.procurement
        }))
      };
      return this.ok(combinedData);
    } catch (error) {
      this.ctx.logger.error('获取信息出错', error);
      return this.ok();
    }
  }

  @Post('/variantName')
  async getVariantNames(
    @Body('asinids') asinids: string[],
    @Body('purchaser') purchaser: string,
  ) {
    if (!Array.isArray(asinids) || asinids.length === 0 || !purchaser) {
      return this.ok([]);
    }

    const rows = await this.bsrCandidatePurchaserEntity
      .createQueryBuilder('p')
      .select('p.candidate_id', 'candidate_id')
      .addSelect('GROUP_CONCAT(DISTINCT p.selectedVariant)', 'variantName')
      .where('p.candidate_id IN (:...ids)', { ids: asinids })
      .andWhere('p.purchaser = :purchaser', { purchaser })
      .groupBy('p.candidate_id')
      .getRawMany();

    return this.ok(rows);
  }


}
