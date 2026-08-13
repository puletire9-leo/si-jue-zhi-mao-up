import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzAiListingEntity } from "../../entity/ai_listing";
import { AppAmzAiListingWriteEntity } from "../../entity/ai_listing_write";
import { AppAmzBsrProfitCommon } from "../../entity/bsr_profit_common";
import { AppAmzBsrProfitMarket } from "../../entity/bsr_profit_market";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import { Context } from "@midwayjs/koa";
import { AppAiListingService } from "../../service/search_threads";
import { Inject, Get,Post ,Body} from '@midwayjs/decorator';
import { Repository } from "typeorm";

import { InjectEntityModel } from "@midwayjs/typeorm";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzAiListingEntity,
  pageQueryOp: {
    keyWordLikeFields: ['a.sku', 'thread_id', 'a.marketplace', 'a.shop_id','a.status','a.account_name'],
    fieldEq: ['a.sku', 'thread_id', 'a.marketplace', 'a.shop_id','a.status','a.account_name'],
    select: [
      'a.id',
      'a.status',
      'a.createTime',
      'a.updateTime',
      'a.sku',
      'a.shop_id',
      'a.account_name',
      'a.thread_id',
      'a.description',
      'a.long_tail_phrases',
      'a.bullet_titles',
      'a.bullet_points',
      'a.candidate_id',
      'a.bullet_points1',
      'a.bullet_points2',
      'a.bullet_points3',
      'a.bullet_points4',
      'a.bullet_points5',
      'a.marketplace',
      'a.bsr_node_id',
      'a.bsr_node',
      'a.bsr_category',
      'a.msku',
      'a.image_url',
      'a.brand_names',
      'a.final_title',
      'a.title',
      'a.title_more_freq',
      'a.variant_Combination',
      'a.factory_links',
      'a.selectedVariant',
      'a.procurement',
      'a.isPair',
      'write.material',
      'write.color',
      'write.size',
      'write.unit_count',
      'write.product_quantity',
      'write.asinid',
      'common.length',
      'common.width',
      'common.height',
      'common.cost',
      'common.actual_weight',
      'market.local_price'
    ],
    join: [
      {
        entity: AppAmzAiListingWriteEntity,
        alias: 'write',
        condition: 'write.id = a.candidate_id',
        type: 'leftJoin'
      },
      {
        entity: AppAmzBsrProfitCommon,
        alias: 'common',
        condition: 'common.candidate_id = write.asinid',
        type: 'leftJoin'
      },
      {
        entity: AppAmzBsrProfitMarket,
        alias: 'market',
        condition: `market.common_id = common.id AND 
          market.country_code = CASE 
            WHEN write.marketplace = '英国' THEN 'UK'
            WHEN write.marketplace = '德国' THEN 'DE'
            WHEN write.marketplace = '法国' THEN 'FR'
            WHEN write.marketplace = '西班牙' THEN 'ES'
            WHEN write.marketplace = '意大利' THEN 'IT'
            ELSE 'OTHER'
          END`,
        type: 'leftJoin'
      }
    ],
    extend: (find) => {
      find.addSelect(`COALESCE(
        NULLIF(
          SUBSTRING_INDEX(
            SUBSTRING_INDEX(write.bsr_html, '所属节点：', -1),
            '\n',
            1
          ),
          ''
        ),
        '未知节点'
      )`, 'node_name');
    },
    
  }
})
@updateWithoutAmendingCreateTime
export class AdminAiListingController extends BaseController {
  @Inject()
  ctx: Context;

  @Inject()
  appAiListingService: AppAiListingService;

  @InjectEntityModel(AppAmzAiListingEntity)
  aiListingEntity: Repository<AppAmzAiListingEntity>;
   // 重写info方法，加入关联查询
   async info() {
    const { id } = this.ctx.query;
    
    // 构建关联查询
    const query = this.aiListingEntity
      .createQueryBuilder('a')
      .leftJoin(AppAmzAiListingWriteEntity, 'write', 'write.id = a.candidate_id')
      .leftJoin(AppAmzBsrProfitCommon, 'common', 'common.candidate_id = write.asinid')
      .leftJoin(AppAmzBsrProfitMarket, 'market', 
        `market.common_id = common.id AND 
         market.country_code = CASE 
           WHEN a.marketplace = '英国' THEN 'UK'
           WHEN a.marketplace = '德国' THEN 'DE'
           WHEN a.marketplace = '法国' THEN 'FR'
           WHEN a.marketplace = '西班牙' THEN 'ES'
           WHEN a.marketplace = '意大利' THEN 'IT'
           ELSE 'OTHER'
         END`)
      .addSelect([
        'a.*',
        'write.material AS material',
        'write.color AS color',
        'write.size AS size',
        'write.unit_count AS unit_count',
        'write.product_quantity AS product_quantity',
        'write.patent_memo AS patent_memo',
        'write.opinion_dev AS opinion_dev',
        'write.opinion_operator AS opinion_operator',
        'write.opinion_procurement AS opinion_procurement',
        'write.max_purchase AS max_purchase',
        // 'write.factory_links AS factory_links',
        'write.asinid AS asinid',
        'common.length AS length',
        'common.width AS width',
        'common.height AS height',
        'common.actual_weight AS actual_weight',
        'common.cost AS cost',
        'market.local_price AS local_price',
        `COALESCE(
          NULLIF(
            SUBSTRING_INDEX(
              SUBSTRING_INDEX(write.bsr_html, '所属节点：', -1),
              '\n',
              1
            ),
            ''
          ),
          '未知节点'
        ) AS node_name`
      ])
      .where('a.id = :id', { id });

    const result = await query.getRawOne();

    
    return result ? this.ok(result) : this.fail('记录不存在');
  }
  @Post('/exportData')
  async exportData(@Body() body: { ids: number[] }) {
    const { csv } = await this.appAiListingService.exportData(body.ids);
    this.ctx.set('Content-Type', 'text/csv; charset=utf-8');
    this.ctx.set('Content-Disposition', 'attachment; filename="export.csv"');
    this.ctx.body = csv;
  }

  
    @Post('/checkReviewData')
    async syncFXFromLingXing(@Body('id') id: number){
      const result = await this.appAiListingService.checkReviewData(id);
      return result;
    }

    
    @Post('/duplicate')
    async duplicate(@Body() params: { id: number,variant:string,msku:string }){
      const result = await this.appAiListingService.duplicate(params.id,params.variant,params.msku);
      return result;
    }

    
    @Post('/lingxinPair')
    async lingxinPair(@Body() params: { msku:string,sku:string, id: number }){
      const result = await this.appAiListingService.lingxinPair(params.msku,params.sku, params.id);
      return result;
    }
    
    @Post('/lingxinPairAll')
    async lingxinPairAll(@Body() params: { ids: number[] }) {
      const result = await this.appAiListingService.lingxinPairAll(params.ids);
      return result;
    }
}