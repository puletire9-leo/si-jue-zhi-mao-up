import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzBsrCandidateEntity } from "../../entity/bsr_candidate";
import { AppAmzBsrTaskEntity } from "../../entity/bsr_task";
import { InjectEntityModel } from "@midwayjs/typeorm";
import { In, Repository } from "typeorm";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import { Context } from "@midwayjs/koa";
import { truncate } from 'fs';
import { Configuration, App, Inject, Get, ALL } from '@midwayjs/decorator';
import { AppAmzBsrCandidatePurchaserEntity } from "../../entity/bsr_candidate_purchaser";
import { AppAmzBsrCandidateService } from "../../service/bsr_candidate";
import { Body, Post } from "@midwayjs/decorator";
import { get } from 'http';
import { Console } from 'console';
import * as dayjs from 'dayjs';
import {AmazonProductListingLingxingEntity} from "../../entity/amazon_product_Listing_Lingxing";
import { AppAmzSellerEntity } from "../../entity/seller";
import { BaseSysUserEntity } from "../../../base/entity/sys/user";
type AllowedUpdateField = 'competitor_import_status' | 'competitor_full_ownership_status' | 'keyword_import_status';

function res_ok(data: any = null) {
  return {
    code: 200,
    message: 'success',
    data
  }
}

function res_fail(data: any = null) {
  return {
    code: 400,
    message: 'fail',
    data
  }
}

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrCandidateEntity,
  service: AppAmzBsrCandidateService,
  pageQueryOp: {
    fieldEq: [
      'a.status', 'a.remark', 'p.is_generate', 'competitor_import_status',
      'profit_calculation_status', 'competitor_full_ownership_status', 'keyword_import_status',
      'UKDEStatus', 'a.is_generate_status', 'a.bsr_category', 'a.bsr_node', 'competitor_status'
    ],
    keyWordLikeFields: [
      'a.bsr_link', 'a.asin', 'a.item_name', 'a.bsr_html', 'a.patent_memo',
      'a.opinion_dev', 'a.opinion_operator', 'a.opinion_procurement', 'a.remark',
      'produce_name', 'a.sku', 'distinguish', 'a.is_generate_status','competitor_status'
    ],
    select: [
      'a.id', 'a.bsr_task_id', 'a.bsr_link', 'a.marketplace', 'a.asin', 'a.sku',
      'a.seller_id', 'a.item_name', 'a.produce_name', 'a.image_url', 'a.price',
      'a.review_num', 'a.variants', 'a.last_star', 'a.bsr_html', 'a.bsr_category', 'a.bsr_rank',
      'a.bsr_node', 'a.bsr_node_rank',
      'a.dispatches_from', 'a.sold_by', 'a.bullet_points', 'a.dimensions', 'a.weight',
      'a.date_first_available', 'a.seller_country', 'a.cost_price', 'a.selling_price', 'a.length',
      'a.width', 'a.height', 'a.dimensional_weight', 'a.actual_weight', 'a.first_leg_freight',
      'a.fba_freight', 'a.exchange_rate', 'a.tax_rate', 'a.gross_profit_rate', 'a.gross_profit',
      'a.describe', 'a.patent_memo', 'a.opinion_dev', 'a.opinion_operator', 'a.opinion_procurement',
      'a.factory_links', 'a.keyword_screenshots', 'a.status', 'a.competitor_spider_status',
      'a.competitor_spider_res', 'a.competitor_spider_time', 'a.remark', 'a.max_purchase', 'a.createTime',
      'a.updateTime', 'a.competitor_import_status', 'a.profit_calculation_status',
      'a.competitor_full_ownership_status', 'a.keyword_import_status', 'a.image_url2', 'a.image_url3',
      'a.image_url4', 'a.image_url5', 'a.image_url6', 'UKDEStatus', 'a.source', 'a.aliyun_img',
      'a.total', 'a.distinguish', 'a.is_generate_status', 'HS_code','isUpload','competitor_status',
      'a.reserved_at', 'a.reserved_by_user_id', 'a.reserved_by_user_name',
      'a.reserve_rejected_at', 'a.reserve_rejected_by_user_id',
      'a.reserve_rejected_by_user_name', 'a.reserve_reject_reason'
    ],
    where: async (ctx: Context) => {
      const { admin } = ctx;
      if (admin && admin.name === 'distinguish') {
        return [['a.distinguish = :distinguish', { distinguish: 'distinguish' }]];
      }
      return [];
    }
  }
})





@updateWithoutAmendingCreateTime
export class AdminAppAmzBsrCandidateController extends BaseController {
  @InjectEntityModel(AppAmzBsrCandidateEntity)
  bsrCandidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @InjectEntityModel(AppAmzBsrCandidatePurchaserEntity)
  bsrCandidatePurchaserEntity: Repository<AppAmzBsrCandidatePurchaserEntity>;

  @InjectEntityModel(AppAmzSellerEntity)
  sellerRepo: Repository<AppAmzSellerEntity>;

  @InjectEntityModel(BaseSysUserEntity)
  baseSysUserRepo: Repository<BaseSysUserEntity>;

  @Inject()

  ctx: Context;

  @InjectEntityModel(AmazonProductListingLingxingEntity)
  listingLingxingRepo: Repository<AmazonProductListingLingxingEntity>;
  

  @Inject()
  appAmzBsrCandidateService: AppAmzBsrCandidateService

  @Post('/backlogCategories')
  async backlogCategories(@Body() params: { status?: number; archiveFilter?: Date | string; distinguish?: string }) {
    const data = await this.appAmzBsrCandidateService.getVisibleBacklogCategories(params || {});
    return this.ok(data);
  }

  @Post('/reserve')
  async reserve(@Body() body: { id: number; max_purchase: number; purchasers: any[] }) {
    const data = await this.appAmzBsrCandidateService.reserveCandidate(body);
    return this.ok(data);
  }

  @Post('/rejectReserve')
  async rejectReserve(@Body() body: { id: number; reason?: string }) {
    const data = await this.appAmzBsrCandidateService.rejectReservedCandidate(body);
    return this.ok(data);
  }

  @Post('/autoReleaseReserved')
  async autoReleaseReserved() {
    const data = await this.appAmzBsrCandidateService.autoReleaseReservedCandidates();
    return this.ok(data);
  }

  @Post('/runPurchaserDecisionTimeoutWorkflow')
  async runPurchaserDecisionTimeoutWorkflow() {
    const data = await this.appAmzBsrCandidateService.runPurchaserDecisionTimeoutWorkflow();
    return this.ok(data);
  }

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
        return this.ok({});
      }
      const { factory_links: fl, variant_Combination: vc } = await this.appAmzBsrCandidateService.loadFactoryLinksAndVariants(info.id);
      
      let finalVc = vc;
      if (fl?.length > 0 || vc?.length > 0) {
        const origVc = (info as any).variant_Combination || [];
        const origVcArr = typeof origVc === 'string' ? JSON.parse(origVc) : origVc;
        if (Array.isArray(origVcArr)) {
          finalVc = vc.map((vItem: any) => {
            const matched = origVcArr.find((o: any) => o.id === vItem.id || o.name === vItem.name);
            if (matched) {
              return { 
                ...vItem, 
                image_url: matched.image_url,
                uk_title: matched.uk_title,
                de_title: matched.de_title 
              };
            }
            return vItem;
          });
        }
      }

      const combinedData: any = {
        ...info,
        factory_links: (fl?.length > 0 || vc?.length > 0) ? fl : (info as any).factory_links,
        variant_Combination: (fl?.length > 0 || vc?.length > 0) ? finalVc : (info as any).variant_Combination,
      };
      const { username, sids } = (this.ctx.admin || {}) as { username?: string; sids?: Array<number | string> };
      const sellerQb = this.sellerRepo
        .createQueryBuilder('s')
        .select('s.seller_account_id', 'seller_account_id')
        .addSelect('s.account_name', 'account_name')
        .where('s.seller_account_id IS NOT NULL AND s.seller_account_id != :empty', { empty: '' });

      if (username !== 'admin') {
        const visibleSids = Array.isArray(sids) ? sids.filter(Boolean) : [];
        if (visibleSids.length === 0) {
          combinedData.sellerAccountOptions = [];
        } else {
          sellerQb.andWhere('s.sid IN (:...sids)', { sids: visibleSids });
        }
      }

      if (combinedData.sellerAccountOptions === undefined) {
        const sellerRows = await sellerQb
          .groupBy('s.seller_account_id')
          .addGroupBy('s.account_name')
          .orderBy('s.account_name', 'ASC')
          .getRawMany();
        combinedData.sellerAccountOptions = sellerRows.map((row: { seller_account_id: string; account_name: string }) => ({
          seller_account_id: String(row.seller_account_id ?? ''),
          account_name: String(row.account_name ?? ''),
        }));
      }
      const purchasers = await this.bsrCandidatePurchaserEntity.find({
        where: { candidate_id: info.id.toString() },
        select: ['id', 'purchaser', 'userId', 'purchaserNum', 'country_enabled', 'is_generate', 'procurement', 'reject_reason', 'decision_assigned_at', 'decision_reminded_at', 'selectedVariant', 'selected_variant_id', 'seller_account_id', 'account_name', 'msku'],
      });
      if (purchasers.length === 0) {
        return this.ok(combinedData);
      }
      const purchaserUserIds = Array.from(
        new Set(
          purchasers
            .map(purchaser => Number(String(purchaser.userId || '').trim()))
            .filter(userId => Number.isFinite(userId) && userId > 0)
        )
      );
      const purchaserNames = Array.from(
        new Set(
          purchasers
            .map(purchaser => String(purchaser.purchaser || '').trim())
            .filter(Boolean)
        )
      );
      const usersById = new Map<number, Pick<BaseSysUserEntity, 'id' | 'name' | 'username' | 'nickName' | 'operation_country_scope'>>();
      const usersByName = new Map<string, Pick<BaseSysUserEntity, 'id' | 'name' | 'username' | 'nickName' | 'operation_country_scope'>>();
      if (purchaserUserIds.length > 0) {
        const users = await this.baseSysUserRepo.find({
          where: { id: In(purchaserUserIds) } as any,
          select: ['id', 'name', 'username', 'nickName', 'operation_country_scope'] as any,
        });
        users.forEach(user => usersById.set(Number(user.id), user));
      }
      if (purchaserNames.length > 0) {
        const users = await this.baseSysUserRepo.find({
          where: [
            { name: In(purchaserNames) },
            { username: In(purchaserNames) },
            { nickName: In(purchaserNames) },
          ] as any,
          select: ['id', 'name', 'username', 'nickName', 'operation_country_scope'] as any,
        });
        users.forEach(user => {
          [user.name, user.username, user.nickName]
            .map(value => String(value || '').trim())
            .filter(Boolean)
            .forEach(value => usersByName.set(value, user));
        });
      }
      combinedData.purchasers = purchasers.map(purchaser => ({
          purchaser: purchaser.purchaser,
          userId:purchaser.userId,
          purchaserNum: purchaser.purchaserNum || {},
          country_enabled: purchaser.country_enabled,
          id: purchaser.id,
          is_generate: Number(purchaser.is_generate) || 0,
          procurement: purchaser.procurement,
          reject_reason: purchaser.reject_reason,
          decision_assigned_at: purchaser.decision_assigned_at,
          decision_reminded_at: purchaser.decision_reminded_at,
          selectedVariant: purchaser.selectedVariant,
          selectedVariantId: purchaser.selected_variant_id ?? undefined,
          seller_account_id: purchaser.seller_account_id,
          account_name: purchaser.account_name,
          msku: purchaser.msku,
          operation_country_scope:
            usersById.get(Number(String(purchaser.userId || '').trim()))?.operation_country_scope ??
            usersByName.get(String(purchaser.purchaser || '').trim())?.operation_country_scope ??
            null
        }));
      return this.ok(combinedData);
    } catch (error) {
      this.ctx.logger.error('获取信息出错', error);
      return this.ok();
    }
  }


  @Post('/sync_from_FX')
  async syncFXFromLingXing() {
    await this.appAmzBsrCandidateService.getforeign_exchange();
    await this.appAmzBsrCandidateService.set_foreign_exchange();
    return "ok";
  }

  // 生成采购单本地sku
  @Post('/sync_add_product_from_lx')
  async syncAddProductLingXing(@Body('id') id: number) {
    await this.appAmzBsrCandidateService.addproduct(id);
    return "ok";
  }

  // 生成本地sku
  @Post('/createLocalSKU')
  async createLocalSKU(
    @Body() body: { id: number; selectedVariantIndexes?: number[] ;lingxingID: string;} // 整体接收对象
  ) {
    const result = await this.appAmzBsrCandidateService.createLocalSKU({
      id: body.id,
      selectedVariantIndexes: body.selectedVariantIndexes || [], // 提供默认值
      lingxingID:body.lingxingID
    });
    return this.ok(result);
  }

  @Post('/createPurchasePlansForCandidate')
  async createPurchasePlansForCandidate(@Body('candidateId') candidateId: number) {
    return this.appAmzBsrCandidateService.createPurchasePlansForCandidate(candidateId);
  }

  @Post('/getOrderStatusByPlanSns')
  async getOrderStatusByPlanSns(@Body('planSns') planSns: string[]) {
    const data = await this.appAmzBsrCandidateService.getOrderStatusByPlanSns(planSns);
    return this.ok(data);
  }

  @Post('/saveProfit')
  async saveProfit(@Body() payload) {
    return this.appAmzBsrCandidateService.saveProfit({ payload });
  }
  @Post('/getProfitData')
  async getProfitData(@Body('candidateId') candidateId: number) {
    return this.appAmzBsrCandidateService.getProfitData(candidateId);
  }


  @Get('/exportData')
  async exportData() {
    const { candidateCsv, departmentCsv } = await this.appAmzBsrCandidateService.exportData();
    this.ctx.set('Content-Type', 'application/json'); // 改为JSON响应
    this.ctx.body = { candidateCsv, departmentCsv };
  }

  @Get('/startBzyShiTu')
  async startBzyShiTu() {
    const result = await this.appAmzBsrCandidateService.startBzyShiTu();
    return result;
  }
  // @Get('/exportData2')
  // async exportData2() {
  //   // 获取双 CSV 数据
  //   const { csvData, departmentCsv } = await this.appAmzBsrCandidateService.exportData2();

  //   // 返回 JSON 结构（与 exportData 一致）
  //   this.ctx.set('Content-Type', 'application/json');
  //   this.ctx.body = { csvData, departmentCsv };
  // }

  
  @Post('/getCompetitor')
  async getCompetitor() {
    const result = await this.appAmzBsrCandidateService.fetchExportDataFromSellersSprite();
    return result;
  }

  @Get('/exportCompetitors')
  async exportCompetitors() {
    try {
      // 调用Service
      const { csvData } = await this.appAmzBsrCandidateService.exportCompetitorData();
      // 设置响应头
      this.ctx.set('Content-Type', 'text/csv; charset=UTF-8');
      this.ctx.set('Content-Disposition',
        `attachment; filename="competitors_${dayjs().format('YYYY-MM')}.csv"`
      );
      this.ctx.body = csvData;
    } catch (error) {
      this.ctx.logger.error('导出失败', error);
      this.ctx.status = 500;
      return {
        code: 500,
        message: '导出失败：' + error.message
      };
    }
  }

  @Post('/exportSelectedCompetitors')
  async exportSelectedCompetitors(@Body() body: { ids: number[] }) {
    try {
      const csvData = await this.appAmzBsrCandidateService.exportSelectedCompetitors(body.ids);

      // 设置响应头
      this.ctx.set('Content-Type', 'text/csv; charset=UTF-8');
      this.ctx.set('Content-Disposition',
        `attachment; filename="selected_competitors_${dayjs().format('YYYY-MM-DD')}.csv"`
      );

      return csvData;
    } catch (error) {
      this.ctx.logger.error('导出关键词信息失败', error);
      return {
        code: 500,
        message: '导出失败：' + error.message
      };
    }
  }

  @Post('/exportSelectedPurchases')
async exportSelectedPurchases(@Body() body: { ids: number[],name: string }) {
    try {
        // 调用服务层方法并传递当前用户名
        const csvData = await this.appAmzBsrCandidateService.exportSelectedPurchases(body.ids, body.name);

        // 设置响应头
        this.ctx.set('Content-Type', 'text/csv; charset=UTF-8');
        this.ctx.set('Content-Disposition',
            `attachment; filename="selected_purchases_${dayjs().format('YYYY-MM-DD')}.csv"`
        );

        return csvData;
    } catch (error) {
        this.ctx.logger.error('导出采购信息失败', error);
        return {
            code: 500,
            message: '导出失败：' + error.message
        };
    }
}


  @Post('/batch_update_status')
  async batchUpdateStatus(@Body() body: {
    field: string;  // 接收原始字符串
    status: number;
    items: Array<{ asin: string; marketplace: string }>;
  }) {
    try {
      // 类型安全校验
      const allowedFields: AllowedUpdateField[] = ['competitor_import_status', 'competitor_full_ownership_status', 'keyword_import_status'];
      if (!allowedFields.includes(body.field as AllowedUpdateField)) {
        throw new Error(`非法字段: ${body.field}`);
      }

      // 类型断言（此时已通过校验）
      const validatedField = body.field as AllowedUpdateField;

      // 调用服务层
      const result = await this.appAmzBsrCandidateService.batchUpdateCompetitorStatus({
        field: validatedField,
        value: body.status,
        updateList: body.items
      });
    } catch (err) {
      return {
        code: 500,
        message: err.message || '服务器内部错误'
      };
    }
  }

  @Post('/batch_update_profit_status')
  async batchUpdateProfitStatus(@Body('candidate_id') candidate_id: number, @Body('profit_calculation_status') profit_calculation_status: string) {
    try {
      const result = await this.appAmzBsrCandidateService.batchUpdateProfitStatus(candidate_id, profit_calculation_status);
    } catch (err) {
      return { code: 500, message: err.message };
    }
  }

  @Post('/add2')
  async add2(@Body() param: any) {
    try {
      const result = await this.appAmzBsrCandidateService.add2(param);
    } catch (err) {
    }
  }

  
  @Post('/add3')
  async add3(@Body() param: any) {
    try {
      const result = await this.appAmzBsrCandidateService.add3(param);
    } catch (err) {
    }
  }

  @Post('/findArchivedCandidates')
  async findArchivedCandidates(@Body() param: any) {
    return this.appAmzBsrCandidateService.findArchivedCandidates(param);
  }


  @Post('/recalculateCompetitorStatus')
  async recalculateCompetitorStatus() {
    return this.appAmzBsrCandidateService.recalculateCompetitorStatus();
  }

  @Post('/batch_update_all_status')
  async batchUpdateAllStatus() {
    await this.appAmzBsrCandidateService.batchUpdateAllStatus();
    return { success: true };
  }


  @Post('/triggerSimilarityProcessing')
  async triggerSimilarityProcessing() {
    return this.appAmzBsrCandidateService.triggerSimilarityProcessing();
  }



  @Post('/archiveWithImage')
  async archiveWithImage(@Body()params: { ids: number[] }) {
    try {
      for (const id of params.ids) {
        // 复用现有单条归档逻辑
        const candidate = await this.bsrCandidateRepo.findOne({ where: { id } });
        if (candidate) {
          await this.appAmzBsrCandidateService.archiveWithImage({
            id: candidate.id,
            aliyun_img: candidate.aliyun_img,
            asin: candidate.asin
          });
        }
      }
      return { success: true, message: "批量归档成功" };
    } catch (err) {
      this.ctx.logger.error('批量归档失败', err);
      return { code: 500, message: '批量归档失败: ' + err.message };
    }
  }

  @Post('/archiveWithImage2')
  async batchArchiveWithImage(@Body() params: { ids: number[] }) {
    try {
      if (!params.ids || params.ids.length === 0) {
        return { code: 400, message: '请提供有效的ID列表' };
      }
  
      // 1. 批量获取候选数据
      const candidates = await this.bsrCandidateRepo.find({
        where: params.ids.map(id => ({ id })),
        select: ['id', 'asin', 'aliyun_img']
      });
  
      console.log(`开始批量处理 ${candidates.length} 条数据`);
  
      // 2. 批量处理
      const results = await this.appAmzBsrCandidateService.batchArchiveWithImage2(candidates);
  
      return { 
        success: true, 
        total: params.ids.length,
        processed: candidates.length,
        results 
      };
    } catch (err) {
      this.ctx.logger.error('批量更新状态失败', err);
      return { code: 500, message: '批量更新状态失败: ' + err.message };
    }
  }
  
  
  @Post('/archiveWithImage3')
  async archiveWithImage3(@Body() params: { id: number }) {
    try {
      // 1. 获取候选数据
      const candidate = await this.bsrCandidateRepo.findOne({
        where: { id: params.id },
        select: ['id', 'asin', 'aliyun_img','image_url']
      });
      console.log("上传阿里云内容：", candidate);

      if (!candidate) {
        return { code: 500, message: '未找到对应记录' };
      }
      if(!candidate.aliyun_img){
        candidate.aliyun_img = candidate.image_url;
      }
      await this.appAmzBsrCandidateService.archiveWithImage3(candidate);

      return { success: true };
    } catch (err) {
      this.ctx.logger.error('更新状态失败', err);
      return { code: 500, message: '更新状态失败: ' + err.message };
    }
  }



  @Get('/exportRecommendationData')
  async exportRecommendationData() {
    try {
      // 调用Service
        await this.appAmzBsrCandidateService.exportRecommendationData();
        return 'ok'
    } catch (error) {
      this.ctx.logger.error('失败', error);
      this.ctx.status = 500;
      return {
        code: 500,
        message: '失败：' + error.message
      };
    }
  }




  @Get('/exportSearchResultData')
  async exportSearchResultData() {
    try {
      await this.appAmzBsrCandidateService.exportSearchResultData();
      return 'ok'
    } catch (error) {
      this.ctx.logger.error('失败', error);
      this.ctx.status = 500;
      return {
        code: 500,
        message: '失败：' + error.message
      };
    }
  }

  
  @Post('/fetchAndSaveProductInfo')
  async fetchAndSaveProductInfo(@Body() params: { id: number,marketplace:string,asin:string }) {
    try {
      await this.appAmzBsrCandidateService.fetchAndSaveProductInfo(params.marketplace,params.asin,params.id);
      return "ok";
    } catch (err) {
      this.ctx.logger.error('更新状态失败', err);
      return { code: 500, message: '更新状态失败: ' + err.message };
    }
  }
  
  @Post('/getProductInfo')
  async getProductInfo(@Body() params: { id: number }) {
    try {
      // 1. 获取候选数据
      const candidate = await this.bsrCandidateRepo.findOne({
        where: { id: params.id },
        select: ['id', 'asin', 'marketplace']
      });
      console.log("获取详情内容", candidate);

      if (!candidate) {
        return { code: 500, message: '未找到对应记录' };
      }
      await this.appAmzBsrCandidateService.getProductInfo(candidate.marketplace,candidate.asin,candidate.id);

      return { success: true };
    } catch (err) {
      this.ctx.logger.error('更新状态失败', err);
      return { code: 500, message: '更新状态失败: ' + err.message };
    }
  }


  @Post('/exportCandidate2')
  async exportCandidate2() {
    const { csv } = await this.appAmzBsrCandidateService.exportCandidate2();
    this.ctx.set('Content-Type', 'application/json'); // 改为JSON响应
    this.ctx.body = csv;
  }

  @Post('/addbrandNames')
  async addbrandNames(@Body() param: any) {
    try {
      await this.appAmzBsrCandidateService.addbrandNames(param);

      return { success: true };
    } catch (err) {
    }
  }

  
//   @Post('/saveLingXingProductData')
// async saveLingXingProductData(@Body() item: AmazonProductListingLingxingEntity[]) {
//     console.log('被调用了saveLingXingProductData');
//   try {
//     for (const data of item) {
//       const product = new AmazonProductListingLingxingEntity();
//       // 逐一映射字段
//       product.id = data.id;
//       product.productId = data.productId;
//       product.productCode = data.productCode;
//       product.afnFulfillableQuantity = data.afnFulfillableQuantity;
//       product.afnInboundReceivingQuantity = data.afnInboundReceivingQuantity;
//       product.afnInboundShippedQuantity = data.afnInboundShippedQuantity;
//       product.afnInboundWorkingQuantity = data.afnInboundWorkingQuantity;
//       product.afnUnsellableQuantity = data.afnUnsellableQuantity;
//       product.reservedCustomerorders = data.reservedCustomerorders;
//       product.reservedFcProcessing = data.reservedFcProcessing;
//       product.reservedFcTransfers = data.reservedFcTransfers;
//       product.asin = data.asin;
//       product.asinUrl = data.asinUrl;
//       product.brandId = data.brandId;
//       product.categoryText = data.categoryText;
//       product.currencySymbol = data.currencySymbol;
//       product.fbaFee = data.fbaFee;
//       product.firstOrderTime = data.firstOrderTime;
//       product.fnsku = data.fnsku;
//       product.fourteenAmount = data.fourteenAmount;
//       product.fourteenSpend = data.fourteenSpend;
//       product.fourteenVolume = data.fourteenVolume;
//       product.fulfillmentChannelType = data.fulfillmentChannelType;
//       product.icon = data.icon;
//       product.lxId = data.lxId;
//       product.imageUrl = data.imageUrl;
//       product.isPair = data.isPair;
//       product.isParent = data.isParent;
//       product.itemName = data.itemName;
//       product.listingId = data.listingId;
//       product.landedPrice = data.landedPrice;
//       product.listingPrice = data.listingPrice;
//       product.listingPriceCurrencyCode = data.listingPriceCurrencyCode;
//       product.localName = data.localName;
//       product.localSku = data.localSku;
//       product.marketplace = data.marketplace;
//       product.marketplaceId = data.marketplaceId;
//       product.msku = data.msku;
//       product.openDateTimeStr = data.openDateTimeStr;
//       product.openDateTime = data.openDateTime;
//       product.pairType = data.pairType;
//       product.parentAsin = data.parentAsin;
//       product.productBrandText = data.productBrandText;
//       product.orgProductId = data.orgProductId;
//       product.quantity = data.quantity;
//       product.bsRank = data.bsRank;
//       product.reviewsNum = data.reviewsNum;
//       product.sid = data.sid;
//       product.sellerName = data.sellerName;
//       product.sevenAmount = data.sevenAmount;
//       product.sevenSpend = data.sevenSpend;
//       product.shipping = data.shipping;
//       product.smallRank = data.smallRank;
//       product.stars = data.stars;
//       product.status = data.status;
//       product.thirtyAmount = data.thirtyAmount;
//       product.thirtySpend = data.thirtySpend;
//       product.thirtyVolume = data.thirtyVolume;
//       product.totalVolume = data.totalVolume;
//       product.yesterdayAmount = data.yesterdayAmount;
//       product.yesterdaySpend = data.yesterdaySpend;
//       product.yesterdayVolume = data.yesterdayVolume;
//       product.volumeAnalyzeResult = data.volumeAnalyzeResult;
//       product.priceAnalyzeResult = data.priceAnalyzeResult;
//       product.onSaleTime = data.onSaleTime;
//       product.saleAnalyzeResult = data.saleAnalyzeResult;
//       product.arrivalAnalyzeResult = data.arrivalAnalyzeResult;
//       product.isUpdateQuantityEstimate = data.isUpdateQuantityEstimate;
//       product.growthRateQuantity7DaysAvg = data.growthRateQuantity7DaysAvg;
//       product.totalVolumeSum = data.totalVolumeSum;
//       product.fourteenVolumeSum = data.fourteenVolumeSum;
//       product.thirtyVolumeSum = data.thirtyVolumeSum;
//       product.productState = data.productState;
//       product.filterType = data.filterType;
//       product.isQuantityEstimateTarget = data.isQuantityEstimateTarget;
//       product.label = data.label;
//       product.price = data.price;
//       product.priceTarget = data.priceTarget;
//       await this.listingLingxingRepo.save(product);
//     }
//     return res_ok();
//   } catch (err) {
//     console.error(err);
//     return res_fail(err);
//   }
// }


@Post('/synLingxingID')
async synLingxingID(@Body() param: { users: { id: string, name: string }[] }) {
  // 调用服务层方法来同步零星ID
  await this.appAmzBsrCandidateService.synLingxingID(param.users);
  return "ok";
}



@Post('/setInventoryStatus')
async setInventoryStatus(@Body()params: { ids: number[] }) {
  try {
    for (const id of params.ids) {
      // 复用现有单条归档逻辑
      const candidate = await this.bsrCandidateRepo.findOne({ where: { id } });
      if (candidate) {
        await this.appAmzBsrCandidateService.archiveWithImage({
          id: candidate.id,
          aliyun_img: candidate.aliyun_img,
          asin: candidate.asin
        });
      }
    }
    return { success: true, message: "设置为待获取库存的数据成功" };
  } catch (err) {
    this.ctx.logger.error('设置为待获取库存的数据失败', err);
    return { code: 500, message: '设置为待获取库存的数据失败: ' + err.message };
  }
}

}
