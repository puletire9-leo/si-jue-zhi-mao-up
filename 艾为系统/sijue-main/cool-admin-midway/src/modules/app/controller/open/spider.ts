import { App, Body, Controller, Get, Inject, Post, Query,sleep } from "@midwayjs/decorator";
import { Application, Context } from "@midwayjs/koa";
import { CacheManager } from "@midwayjs/cache";
import { SpiderService } from "../../service/spider";
import { AmazonProductListingLingxingEntity } from "../../entity/amazon_product_Listing_Lingxing"
import { AmazonProductCompetitorStatisticsEntity } from "../../entity/amazon_product_competitor_statistics"
import { appConfig } from "../../../../appConfig";
import { InjectEntityModel } from "@midwayjs/typeorm";
import { Repository ,In, Not, IsNull} from "typeorm";
import { AppAmzListingEntity } from "../../entity/listing";
import { AppAmzListingKeywordEntity } from "../../entity/keyword";
import { AppAmzListingCompetitorEntity } from "../../entity/competitor";
import { AppAmzCookieService } from "../../service/cookie";
import { AppAmzCookieEntity } from "../../entity/cookie";
import { CompetitorSpiderResult } from "../../interface/competitor-spider-result";
import { AppUtils } from "../../utils/appUtils";
import { AppAmzBsrTaskEntity } from "../../entity/bsr_task";
import { AppAmzBsrCandidateEntity } from "../../entity/bsr_candidate";
import { AppAmzDepartmentRankFilterEntity } from "../../entity/bsr_department_rank_filter";
import { AppAmzBsrCandidateCompetitorEntity } from "../../entity/bsr_candidate_competitor"
import { post } from "../../utils/lingxing/openapi-node-sdk/request";
import { HttpCode } from '@midwayjs/core';
import { AppAmzBsrCandidateCompetitorService } from "../../service/bsr_candidate_competitor";
import { ImageSimilarityTool } from '../../service/ImageSearchUtil';
import { BaseSysParamEntity } from "../../../base/entity/sys/param";
import { AppAmzBsrProductListingLingxingEntity } from "../../entity/bsr_product_Listing_Lingxing";

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

@Controller('/api/spider')
export class SpiderController {
  @App()
  app: Application;

  @Inject()
  ctx: Context;

  @Inject()
  appUtils: AppUtils;

  @Inject()
  cacheManager: CacheManager;

  @Inject()
  spiderService: SpiderService;

  @Inject()
  cookieService: AppAmzCookieService;

  @Inject()
  bsrCandidateCompetitorService: AppAmzBsrCandidateCompetitorService;
  
  @Inject()
  imageSimilarityTool: ImageSimilarityTool; // 注入阿里云图片上传工具
  
  @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
  listingLingxingRepo: Repository<AppAmzBsrProductListingLingxingEntity>;

  
  @InjectEntityModel(AmazonProductCompetitorStatisticsEntity)
  competitorStatisticsRepo: Repository<AmazonProductCompetitorStatisticsEntity>;




  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;
  /**
   * 工具函数：将数组分块
   * @param array 原始数组
   * @param size 每块大小
   * @returns 分块后的数组
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }




  @Get('/getTask')
  async getTask(@Query('type') type: string = appConfig.SPIDER_TASK.TYPE.KEYWORD) {
    switch (type) {
      case appConfig.SPIDER_TASK.TYPE.KEYWORD:
        let keyword = await this.spiderService.getOneKeywordEntity(appConfig.KEYWORD_STATUS.CREATED.value);
        return res_ok(keyword);

      case appConfig.SPIDER_TASK.TYPE.COMPETITOR:
        let listing = await this.spiderService.getOneListingToCrawlCompetitors();
        return res_ok(listing);

      case appConfig.SPIDER_TASK.TYPE.PRODUCT:
        let product_info = await this.spiderService.getOneCompetitorToBeUpdated();
        return res_ok(product_info);

      case appConfig.SPIDER_TASK.TYPE.BSR_TASK:
        let bsrTask = await this.spiderService.getOneBsrTaskEntity(appConfig.KEYWORD_STATUS.CREATED.value);
        return res_ok(bsrTask);

      case appConfig.SPIDER_TASK.TYPE.BSR_COMPETITOR:
        let bsrCandidate = await this.spiderService.getOneBsrCandidateToCrawlCompetitors();
        return res_ok(bsrCandidate);

      case appConfig.SPIDER_TASK.TYPE.BSR_COMPETITOR_INFO:
        let bsr_competitor_info = await this.spiderService.getOneBsrCompetitorToBeUpdated();
        return res_ok(bsr_competitor_info);

      case appConfig.SPIDER_TASK.TYPE.BSR_HTML:
        let null_Bsr = await this.spiderService.getNullBsrCandidate();
        return res_ok(null_Bsr);

      case appConfig.SPIDER_TASK.TYPE.BSR_COMPETITOR2:
        let bsrCompetitor = await this.spiderService.getCompetitorDdetails();
        return res_ok(bsrCompetitor);

      case appConfig.SPIDER_TASK.TYPE.BSR_INFO:
        let bsrInfo = await this.spiderService.getBsrInfo();
        return res_ok(bsrInfo);

      default:
        return {
          message: 'fail',
          data: 'invalid task type'
        }
    }
  }

  @Post('/saveKeywordTaskResult')
  async saveKeywordTaskResult(@Body() keyword: AppAmzListingKeywordEntity) {
    try {
      await this.spiderService.saveKeywordSpiderResult(keyword);
      return res_ok();
    } catch (err) {
      return res_fail(err);
    }
  }

  @Post('/saveCompetitorTaskResult')
  async saveCompetitorTaskResult(@Body() listing: AppAmzListingEntity) {
    try {
      await this.spiderService.saveCompetitorSpiderResult(listing);
      return res_ok();
    } catch (err) {
      return res_fail(err);
    }
  }

  // @Post('/saveCompetitorInfoResult')
  // async saveCompetitorInfoResult(
  //   @Body('competitor_id') competitor_id: number,
  //   @Body('product_info') product_info: CompetitorSpiderResult,
  // ) {
  //   try {
  //     let stars = this.appUtils.normalizeNumber(product_info.stars);
  //     if (stars > 5) stars = -1;

  //     let competitor_updated_info = {
  //       id: competitor_id,
  //       item_name: product_info.title,
  //       image_url: product_info.image_url,
  //       price: this.appUtils.normalizeNumber(product_info.price),
  //       review_num: this.appUtils.normalizeNumber(product_info.reviews),
  //       last_star: stars,
  //       bsr_html: this.appUtils.normalizeBsrInfo(product_info.bsr_html),
  //       bsr_rank: appConfig.extract_ranking_from_bsr_info(product_info.bsr_html),
  //       dispatches_from: product_info.dispatches_from,
  //       sold_by: product_info.sold_by,
  //       bullet_points: product_info.bullet_points,
  //       spider_time: new Date(),
  //     };

  //     await this.competitorRepo.save(competitor_updated_info);
  //     return res_ok();
  //   } catch (err) {
  //     return res_fail(String(err));
  //   } finally {
  //     try {
  //       await this.competitorRepo.save({
  //         id: competitor_id,
  //         spider_time: new Date(),
  //       });
  //     } catch (err) {
  //       console.log(err);
  //     }
  //   }
  // }

  @Get('/getCookie')
  async getCookie(@Query('site') site: string = 'UK') {
    let cookie = await this.cookieService.getCookie({ site });
    return res_ok(cookie);
  }

  // @Post('/saveCookieUsageResult')
  // async saveCookieUsageResult(
  //   @Body('cookie') cookie: AppAmzCookieEntity,
  //   @Body('is_success') isSuccess: boolean
  // ) {
  //   try {
  //     let cookieEntity = await this.cookieRepo.findOne({ where: { id: cookie?.id } });
  //     if (cookieEntity) {
  //       if (isSuccess) cookieEntity.successCount += 1;
  //       else cookieEntity.failCount += 1;
  //       await this.cookieRepo.save(cookieEntity);
  //       return res_ok('cookie usage result updated.');
  //     } else {
  //       return res_fail('cookie not exist.');
  //     }
  //   } catch (err) {
  //     return res_fail(err);
  //   }
  // }

  @Post('/saveBsrTaskResult')
  async saveBsrTaskResult(@Body() bsrTask: AppAmzBsrTaskEntity) {
    try {
      await this.spiderService.saveBsrTaskSpiderResult(bsrTask);
      return res_ok();
    } catch (err) {
      return res_fail(err);
    }
  }

  @Post('/saveBsrCandidateCompetitorTaskResult')
  async saveBsrCandidateCompetitorTaskResult(@Body() bsrCandidate: AppAmzBsrCandidateEntity) {
    try {
      await this.spiderService.saveBsrCompetitorSpiderResult(bsrCandidate);
      return res_ok();
    } catch (err) {
      return res_fail(err);
    }
  }

  // @Post('/saveBsrCandidateCompetitorInfoResult')
  // async saveBsrCandidateCompetitorInfoResult(
  //   @Body('competitor_id') competitor_id: number,
  //   @Body('product_info') product_info: CompetitorSpiderResult,
  // ) {
  //   try {
  //     let stars = this.appUtils.normalizeNumber(product_info.stars);
  //     if (stars > 5) stars = -1;

  //     // @ts-ignore
  //     let competitor_updated_info: AppAmzBsrCandidateCompetitorEntity = {
  //       id: competitor_id,
  //       item_name: product_info.title,
  //       image_url: product_info.image_url,
  //       price: product_info.price,
  //       review_num: this.appUtils.normalizeNumber(product_info.reviews),
  //       last_star: stars,
  //       bsr_html: this.appUtils.normalizeBsrInfo(product_info.bsr_html),
  //       bsr_rank: appConfig.extract_ranking_from_bsr_info(product_info.bsr_html),
  //       dispatches_from: product_info.dispatches_from,
  //       sold_by: product_info.sold_by,
  //       bullet_points: product_info.bullet_points,
  //       spider_time: new Date(),
  //     };

  //     await this.bsrCandidateCompetitorRepo.save(competitor_updated_info);
  //     return res_ok();
  //   } catch (err) {
  //     return res_fail(String(err));
  //   } finally {
  //     try {
  //       await this.bsrCandidateCompetitorRepo.save({
  //         id: competitor_id,
  //         spider_time: new Date(),
  //       });
  //     } catch (err) {
  //       console.log(err);
  //     }
  //   }
  // }

  // @Get('/getDepartmentRankFilters')
  // async getDepartmentRankFilters(@Query('marketplace') marketplace: string) {
  //   marketplace = appConfig.normalize_marketplace_code(marketplace);
  //   return this.deptRankFilterRepo.find({ where: { marketplace } });
  // }

  @Get('/normalizeNumber')
  async normalizeNumber(@Query('numberStr') numberStr: string) {
    console.log(numberStr);
    return {
      number: this.appUtils.normalizeNumber(numberStr),
    };
  }

  @Post('/saveNullBsrResult')
  async saveNullBsrResult(@Body() candidate: AppAmzBsrCandidateEntity) {
    try {
      await this.spiderService.saveNullBsrResult(candidate);
      return res_ok();
    } catch (err) {
      return res_fail(err);
    }
  }


  @Post('/saveCompetitorResult2')
  async saveCompetitorResult2(@Body() competitor: AppAmzBsrCandidateCompetitorEntity) {
    try {
      await this.spiderService.saveCompetitorDdetails(competitor);
      return res_ok();
    } catch (err) {
      return res_fail(err);
    }
  }

  @Post('/saveBsrInfo')
  async saveBsrInfo(@Body() candidate: AppAmzBsrCandidateEntity) {
    try {
      await this.spiderService.saveBsrInfo(candidate);
      return res_ok();
    } catch (err) {
      return res_fail(err);
    }
  }

  // Python专用接口
  @Get('/python/tasks')
  @HttpCode(200)
  async getPythonCrawlTasks(
    @Query('limit') limit: number,
    @Query('marketplace') marketplace?: string
  ) {
    try {
      let tasks = await this.bsrCandidateCompetitorService.getTaskList(limit);
      if (marketplace) {
        const targetSites = marketplace.split(',')
          .map(site => site.trim())
          .filter(site => site);
        tasks = tasks.filter(task => targetSites.includes(task.marketplace));
      }
      return {
        code: 200,
        success: true,
        message: `成功获取${tasks.length}条任务`,
        data: tasks,
        total: tasks.length
      };
    } catch (error) {
      console.error("Python任务列表接口异常：", error);
      return {
        code: 500,
        success: false,
        message: `任务获取失败：${error.message}`,
        data: null,
        total: 0
      };
    }
  }

  @Post('/python/inventory')
  @HttpCode(200)
  async updatePythonInventory(@Body() inventoryData: any | any[]) {
    try {
      const updateResult = await this.bsrCandidateCompetitorService.updateInventory(inventoryData);
      return {
        code: 200,
        success: true,
        message: `库存更新完成，共处理${updateResult}条数据`,
      };
    } catch (error) {
      console.error("Python库存更新接口异常：", error);
      return {
        code: 500,
        success: false,
        message: `库存更新失败：${error.message}`,
        data: null
      };
    }
  }

  @Post('/python/invalid')
  @HttpCode(200)
  async markPythonProductInvalid(@Body() params: {
    asin_competitor: string;
    marketplace: string;
    str1: string;
  }) {
    try {
      if (!params.asin_competitor || !params.marketplace) {
        return {
          code: 400,
          success: false,
          message: '缺少必填参数：asin_competitor或marketplace',
          data: null
        };
      }
      const markResult = await this.bsrCandidateCompetitorService.markAsInvalid(params);
      return {
        code: 200,
        success: true,
        data: {
          asin_competitor: params.asin_competitor,
          marketplace: params.marketplace,
          status: '已标记为失效'
        }
      };
    } catch (error) {
      console.error("Python标记失效接口异常：", error);
      return {
        code: 500,
        success: false,
        message: `标记失效失败：${error.message}`,
        data: null
      };
    }
  }


  /**
   * 保存领星产品数据，并对status=1的实体上传阿里云
   */
  // @Post('/saveLingXingProductData')
  // async saveLingXingProductData(@Body() items) {
  //   try {
  //     if (!Array.isArray(items) || items.length === 0) {
  //       return res_fail('输入数据必须为非空数组');
  //     }
  
  //     // 工具函数：生成item_name_key（用于标题对比）
  //     const generateItemNameKey = (itemName: string): string => {
  //       if (!itemName || typeof itemName !== 'string') {
  //         return '';
  //       }
  //       let cleanedName = itemName
  //         .replace(/,/g, '')
  //         .replace(/&/g, '')
  //         .replace(/\./g, '')
  //         .replace(/"/g, '')
  //         .replace(/\|/g, '');
  //       cleanedName = cleanedName.trim();
  //       while (cleanedName.includes('  ')) {
  //         cleanedName = cleanedName.replace(/  /g, ' ');
  //       }
  //       const words = cleanedName.split(' ');
  //       const first6Words = words.slice(0, 6);
  //       return first6Words.join(' ');
  //     };
  
  //     // ========== 第一步：写入原表（全量保存，逻辑不变） ==========
  //     const originalProductEntities: AmazonProductListingLingxingEntity[] = [];
  //     // 临时存储有效item（后续分组用，避免重复过滤）
  //     const validItems = [];
  //     for (const item of items) {
  //       if (!item.productCode || !item.marketplace || !item.asin) {
  //         console.warn(`跳过无效记录（缺少核心字段）：productCode=${item.productCode}, marketplace=${item.marketplace}, asin=${item.asin}`);
  //         continue;
  //       }
  //       // 收集有效item
  //       validItems.push(item);
  
  //       const product = new AmazonProductListingLingxingEntity();
  //       product.product_code = item.productCode;
  //       product.marketplace = item.marketplace;
  //       product.asin = item.asin;
  //       product.image_state = 0; // 原表统一置0（仅process表存1的记录）
  //       product.item_name_key = generateItemNameKey(item.item_name);
        
  //       // 全量字段映射（和原有逻辑完全一致）
  //       product.product_id = item.productId;
  //       product.afn_fulfillable_quantity = item.afnFulfillableQuantity;
  //       product.afn_inbound_receiving_quantity = item.afnInboundReceivingQuantity;
  //       product.afn_inbound_shipped_quantity = item.afnInboundShippedQuantity;
  //       product.afn_inbound_working_quantity = item.afnInboundWorkingQuantity;
  //       product.afn_unsellable_quantity = item.afnUnsellableQuantity;
  //       product.reserved_customerorders = item.reservedCustomerorders;
  //       product.reserved_fc_processing = item.reservedFcProcessing;
  //       product.reserved_fc_transfers = item.reservedFcTransfers;
  //       product.asin_url = item.asinUrl;
  //       product.brand_id = item.brandId;
  //       product.category_text = item.categoryText;
  //       product.currency_symbol = item.currencySymbol;
  //       product.fba_fee = item.fbaFee;
  //       product.first_order_time = item.firstOrderTime;
  //       product.fnsku = item.fnsku;
  //       product.fourteen_amount = item.fourteenAmount;
  //       product.fourteen_spend = item.fourteenSpend;
  //       product.fourteen_volume = item.fourteenVolume;
  //       product.fulfillment_channel_type = item.fulfillmentChannelType;
  //       product.icon = item.icon;
  //       product.lx_id = item.lxId;
  //       product.image_url = item.imageUrl;
  //       product.is_pair = item.isPair;
  //       product.is_parent = item.isParent;
  //       product.item_name = item.itemName;
  //       product.listing_id = item.listingId;
  //       product.landed_price = item.landedPrice;
  //       product.listing_price = item.listingPrice;
  //       product.listing_price_currency_code = item.listingPriceCurrencyCode;
  //       product.local_name = item.localName;
  //       product.local_sku = item.localSku;
  //       product.marketplace_id = item.marketplaceId;
  //       product.msku = item.msku;
  //       product.open_date_time = item.openDateTime;
  //       product.open_date_time_str = item.openDateTimeStr;
  //       product.pair_type = item.pairType;
  //       product.parent_asin = item.parentAsin;
  //       product.product_brand_text = item.productBrandText;
  //       product.org_product_id = item.orgProductId;
  //       product.quantity = item.quantity;
  //       product.bs_rank = item.bsRank;
  //       product.reviews_num = item.reviewsNum;
  //       product.sid = item.sid;
  //       product.seller_name = item.sellerName;
  //       product.seven_amount = item.sevenAmount;
  //       product.seven_spend = item.sevenSpend;
  //       product.shipping = item.shipping;
  //       product.small_rank = item.smallRank;
  //       product.stars = item.stars;
  //       product.status = item.status;
  //       product.thirty_amount = item.thirtyAmount;
  //       product.thirty_spend = item.thirtySpend;
  //       product.thirty_volume = item.thirtyVolume;
  //       product.total_volume = item.totalVolume;
  //       product.yesterday_amount = item.yesterdayAmount;
  //       product.yesterday_spend = item.yesterdaySpend;
  //       product.yesterday_volume = item.yesterdayVolume;
  //       product.volume_analyze_result = item.volumeAnalyzeResult;
  //       product.price_analyze_result = item.priceAnalyzeResult;
  //       product.on_sale_time = item.onSaleTime;
  //       product.sale_analyze_result = item.saleAnalyzeResult;
  //       product.arrival_analyze_result = item.arrivalAnalyzeResult;
  //       product.is_update_quantity_estimate = item.isUpdateQuantityEstimate;
  //       product.growth_rate_quantity_7_days_avg = item.growthRateQuantity7DaysAvg;
  //       product.total_volume_sum = item.totalVolumeSum;
  //       product.fourteen_volume_sum = item.fourteenVolumeSum;
  //       product.thirty_volume_sum = item.thirtyVolumeSum;
  //       product.product_state = item.productState;
  //       product.filter_type = item.filterType;
  //       product.is_quantity_estimate_target = item.isQuantityEstimateTarget;
  //       product.label = item.label;
  //       product.price = item.price;
  //       product.price_target = item.priceTarget;
  //       product.mergeId = item.productCode;
  
  //       originalProductEntities.push(product);
  //     }
  
  //     // 原表批量保存
  //     if (originalProductEntities.length > 0) {
  //       await this.listingLingxingRepo.upsert(originalProductEntities, {
  //         conflictPaths: ['product_code', 'marketplace', 'asin'],
  //         skipUpdateIfNoValuesChanged: true
  //       });
  //       console.log(`原表：成功保存/更新 ${originalProductEntities.length} 条领星产品数据`);
  //     }
  
  //     // ========== 第二步：统计数据（原逻辑保留） ==========
  //     const statsEntities = originalProductEntities.map(product => {
  //       const stats = new AmazonProductCompetitorStatisticsEntity();
  //       stats.asin_candidate = product.asin;
  //       stats.marketplace = product.marketplace;
  //       return stats;
  //     });
  //     if (statsEntities.length > 0) {
  //       await this.competitorStatisticsRepo.upsert(statsEntities, {
  //         conflictPaths: ['asin_candidate', 'marketplace']
  //       });
  //     }
  
  //     // 返回结果
  //     return res_ok({
  //       message: '领星数据处理完成',
  //       originalTable: { saved: originalProductEntities.length }
  //     });
  
  //   } catch (err) {
  //     console.error('保存领星产品数据失败：', err);
  //     return res_fail(`处理失败：${err.message}`);
  //   }
  // }
  
  @Post('/updateSellerspriteCookie')
  async updateSellerspriteCookie(@Query('cookie') cookie: string) {
    try {
      console.log('更新sellerspriteCookie：', cookie);
      let sellerspriteCookie = await this.baseSysParamRepo.findOne({ where: { keyName: 'sellersprite_cookie' } });
      sellerspriteCookie.data = cookie;
      await this.baseSysParamRepo.save(sellerspriteCookie);

      return res_ok();
    } catch (err) {
      return res_fail(err);
    }
  }

}