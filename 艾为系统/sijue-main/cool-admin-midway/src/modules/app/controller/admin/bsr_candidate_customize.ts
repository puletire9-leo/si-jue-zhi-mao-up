import {CoolController, BaseController} from '@cool-midway/core';
import {AppAmzBsrCandidateCustomizeeEntity} from "../../entity/bsr_candidate_customize";
import {AppAmzBsrTaskEntity} from "../../entity/bsr_task";
import {InjectEntityModel} from "@midwayjs/typeorm";
import {Repository} from "typeorm";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import {Context} from "@midwayjs/koa";
import { truncate } from 'fs';
import {Configuration, App, Inject, Get,ALL} from '@midwayjs/decorator';
import {AppAmzBsrCandidatePurchaserEntity} from "../../entity/bsr_candidate_purchaser";
import {AppAmzBsrCandidateCustomizeService} from "../../service/bsr_candidate_customize";
import {Body, Post} from "@midwayjs/decorator";
import { get } from 'http';
import { Console } from 'console';
import * as dayjs from 'dayjs';


@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrCandidateCustomizeeEntity,
  service: AppAmzBsrCandidateCustomizeService,
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
      'remark',
      'is_generate',
      'produce_name'
    ],
    fieldEq: [
      'a.status', 'remark', 'is_generate',
      'competitor_import_status',
      'profit_calculation_status',
      'competitor_full_ownership_status',
      'keyword_import_status',
      'UKDEStatus','a.asinid','a.asin'
    ],
    select: [
      'DISTINCT a.id', 'a.bsr_task_id', 'a.bsr_link', 'a.marketplace', 'a.asin', 'a.sku',
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
      // ,'a.bsr_node','a.bsr_node_rank'
    ],

    
    join: [
      {
        entity: AppAmzBsrCandidatePurchaserEntity,
        alias: 'p',
        condition: 'a.asinid = p.candidate_id',
        type: 'leftJoin',
      },
    ],
    where: async (ctx: Context) => {
      let { name, roleIds,userId } = ctx.admin;
      let whereOptions = [];

      // 权限控制：根据角色判断市场
      if (userId !== '超级管理员') {
        const roleMarketplaceMap = {
          12: ['美国'],
          13: ['英国'],
          14: ['德国']
        };
        let allMarketplaces = [];
        roleIds.forEach(roleId => {
          if (roleMarketplaceMap[roleId]) {
            allMarketplaces = allMarketplaces.concat(roleMarketplaceMap[roleId]);
          }
        });
        if (allMarketplaces.length > 0) {
          let placeholders = allMarketplaces.map(() => '?').join(',');
          if (roleIds.length === 2 && roleIds.includes(12) && roleIds.includes(13)) {
            let orPlaceholders = allMarketplaces.map(() => `marketplace =?`).join(' OR ');
            whereOptions.push([`(${orPlaceholders})`, allMarketplaces]);
          } else {
            whereOptions.push([`marketplace IN (${placeholders})`, allMarketplaces]);
          }
        }
      }

      // 基于is_generate过滤：如果is_generate=0且用户有相关记录，则该产品不显示
      whereOptions.push([
        '(p.id IS NULL OR (p.userId != :userId OR p.is_generate != 0))',
        { userId }
      ]);

      return whereOptions;
    }
  }
})




@updateWithoutAmendingCreateTime
export class AdminAppAmzBsrCandidateCustomizeController extends BaseController {
  @InjectEntityModel(AppAmzBsrCandidateCustomizeeEntity)
  bsrCandidateRepo: Repository<AppAmzBsrCandidateCustomizeeEntity>;

  @InjectEntityModel(AppAmzBsrCandidatePurchaserEntity)
  bsrCandidatePurchaserEntity: Repository<AppAmzBsrCandidatePurchaserEntity>;
  @Inject()
  
  ctx: Context;

  
  @Inject()
  appAmzBsrCandidateService:AppAmzBsrCandidateCustomizeService
  
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


}
