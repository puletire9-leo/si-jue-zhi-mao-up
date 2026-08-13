import { Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { SelectQueryBuilder } from 'typeorm';
import * as dayjs from 'dayjs';
import { Repository, In, Like } from 'typeorm';

import { AmazonProductCompetitorStatisticsEntity } from "../entity/amazon_product_competitor_statistics";
import { AppAmzBsrProductListingLingxingEntity } from "../entity/bsr_product_Listing_Lingxing";
import { AppAmzBsrProductListingLingxingProcessEntity } from "../entity/bsr_product_Listing_Lingxing_process";
import { AppAmzBsrRestockingCenterLingxingEntity } from "../entity/bsr_restocking_center_lingxing";
import { AppAmzBsrCandidateCompetitorEntity } from "../entity/bsr_candidate_competitor";

type AggregatedCompetitorItem = AppAmzBsrCandidateCompetitorEntity & {
  __groupItems?: AppAmzBsrCandidateCompetitorEntity[];
  __priceValues?: number[];
  __stockQuantityValue?: number;
};

/**
 * 价格分析状态枚举（与Java枚举值对应）
 */
enum PriceAnalyzeStatus {
  UNDEFINED = -1, // 未定义
  LOWEST_PRICE = 0, // 市场最低
  LOW_PRICE_RANK1 = 1, // 价格第一低（前十最低）
  LOW_PRICE_RANK2 = 2, // 价格第二低
  LOW_PRICE_RANK3 = 3, // 价格第三低
  LOW_PRICE_RANK4 = 4, // 价格第四低
  LOW_PRICE_RANK5 = 5, // 价格第五低
  LOW_PRICE_RANK6 = 6, // 价格第六低
  LOW_PRICE_RANK7 = 7, // 价格第七低
  LOW_PRICE_RANK8 = 8, // 价格第八低
  LOW_PRICE_RANK9 = 9, // 价格第九低
  LOW_PRICE_RANK10 = 10, // 价格第十低
  HIGHER_PRICE = 11, // 价格第十一低（价格高于前十）
}


enum NewProductStatus {
  NONE = 0, // 无新品相关状态
  IN_TRANSIT = 1, // 新品在途
  ARRIVED_NO_SALES = 2, // 新品到货无销量
  ARRIVED_OVER_7_DAYS_NO_SALES = 3, // 到货超过7天无销量
  ARRIVED_OVER_14_DAYS_NO_SALES = 4, // 到货超过14天无销量
  ARRIVED_OVER_30_DAYS_NO_SALES = 5, // 到货超过30天无销量
}

/**
 * 到货分析状态枚举（与Java枚举值对应）
 */
enum ArrivalAnalyzeStatus {
  // 分组标识（非存储值）
  NEW_PRODUCT_ARRIVAL_DAY_IN_WEEK = -1, // 新品到货1周内
  OLD_PRODUCT_ARRIVAL_DAY_IN_WEEK = -2, // 老品到货1周内
  NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY_IN_WEEK = -3, // 新品断货后到货1周内
  OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY_IN_WEEK = -4, // 老品断货后到货1周内

  // 具体状态（存储值）
  IN_TRANSIT_NEW_ASIN = 0, // 新品在途

  NEW_PRODUCT_ARRIVAL_DAY1 = 1, // 新品到货1天
  NEW_PRODUCT_ARRIVAL_DAY2 = 2, // 新品到货2天
  NEW_PRODUCT_ARRIVAL_DAY3 = 3, // 新品到货3天
  NEW_PRODUCT_ARRIVAL_DAY4 = 4, // 新品到货4天
  NEW_PRODUCT_ARRIVAL_DAY5 = 5, // 新品到货5天
  NEW_PRODUCT_ARRIVAL_DAY6 = 6, // 新品到货6天
  NEW_PRODUCT_ARRIVAL_DAY7 = 7, // 新品到货7天
  NEW_PRODUCT_ARRIVAL_OVER_DAY7 = 8, // 新品到货超过一周

  OLD_PRODUCT_ARRIVAL_DAY1 = 11, // 老品到货1天
  OLD_PRODUCT_ARRIVAL_DAY2 = 12, // 老品到货2天
  OLD_PRODUCT_ARRIVAL_DAY3 = 13, // 老品到货3天
  OLD_PRODUCT_ARRIVAL_DAY4 = 14, // 老品到货4天
  OLD_PRODUCT_ARRIVAL_DAY5 = 15, // 老品到货5天
  OLD_PRODUCT_ARRIVAL_DAY6 = 16, // 老品到货6天
  OLD_PRODUCT_ARRIVAL_DAY7 = 17, // 老品到货7天
  OLD_PRODUCT_ARRIVAL_OVER_DAY7 = 18, // 老品到货超过一周

  NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY1 = 21, // 新品断货后到货1天
  NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY2 = 22, // 新品断货后到货2天
  NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY3 = 23, // 新品断货后到货3天
  NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY4 = 24, // 新品断货后到货4天
  NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY5 = 25, // 新品断货后到货5天
  NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY6 = 26, // 新品断货后到货6天
  NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY7 = 27, // 新品断货后到货7天
  NEW_PRODUCT_OFF_SALE_ARRIVAL_OVER_DAY7 = 28, // 新品断货后到货超过一周

  OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY1 = 31, // 老品断货后到货1天
  OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY2 = 32, // 老品断货后到货2天
  OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY3 = 33, // 老品断货后到货3天
  OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY4 = 34, // 老品断货后到货4天
  OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY5 = 35, // 老品断货后到货5天
  OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY6 = 36, // 老品断货后到货6天
  OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY7 = 37, // 老品断货后到货7天
  OLD_PRODUCT_OFF_SALE_ARRIVAL_OVER_DAY7 = 38, // 老品断货后到货超过一周
}

/**
 * 销量分析状态枚举（核心业务状态）
 */
enum VolumeAnalyzeStatus {
  NO_DATA = 0, // 无数据
  IN_TRANSIT_NEW_ASIN = 1, // 新品在途
  ABNORMAL_VOLUME_NEW_ASIN = 2, // 新品到货无销量
  ABNORMAL_VOLUME_OLD_ASIN = 3, // 老品到货无销量
  ABNORMAL_VOLUME_OVER_7_DAY = 4, // 到货超过7天无销量
  ABNORMAL_VOLUME_OVER_14_DAY = 5, // 到货超过14天无销量
  ABNORMAL_VOLUME_OVER_30_DAY = 6, // 到货超过30天无销量
  ABNORMAL_PRICE_BSR_LESS_THAN_500_BEHIND_RANK5 = 7, // 流量货价格有问题
  OVER_STOCK_BSR_LESS_THAN_500_BEFORE_RANK5 = 8, // 库存过多(BSR<500)
  REPLENISH = 9, // 正常补货
  OVER_STOCK = 10, // 库存过多
  ABNORMAL_TRAFFIC_AND_OVER_STOCK = 11, // 流量有问题且库存过多
  ABNORMAL_TRAFFIC_BSR_GREATER_THAN_500 = 12, // 流量有问题(BSR>500)
  ABNORMAL_TRAFFIC_BSR_GREATER_THAN_3000 = 13, // 流量有问题(BSR>3000)
  UNDEFINED = 99, // 未定义
}

/**
 * 欧洲五国市场枚举
 */
enum EuMarketplace {
  UK = '英国', 
  DE = '德国',
  FR = '法国',
  ES = '西班牙',
  IT = '意大利'
}

@Provide()
export class AmazonProductCompetitorStatisticsService extends BaseService {
  @InjectEntityModel(AmazonProductCompetitorStatisticsEntity)
  amazonProductCompetitorStatisticsRepo: Repository<AmazonProductCompetitorStatisticsEntity>;

  @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;

  @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
  bsrProductListingLingxingEntity: Repository<AppAmzBsrProductListingLingxingEntity>;

  @InjectEntityModel(AppAmzBsrRestockingCenterLingxingEntity)
  bsrRestockingCenterLingxingRepo: Repository<AppAmzBsrRestockingCenterLingxingEntity>;

  @InjectEntityModel(AppAmzBsrProductListingLingxingProcessEntity)
  bsrProductListingLingxingProcessRepo: Repository<AppAmzBsrProductListingLingxingProcessEntity>;

  /**
   * 批量统计竞品数据核心方法
   * @param params 包含asin_candidate和marketplace的数组
   * @returns 执行结果
   */
  async statisticsProductCompetitor(
    params: { 
      items: Array<{ asin_candidate: string; marketplace: string }>,
      task_id?: number, 
      crawler_time?: string 
    }
  ): Promise<{ success: boolean; message: string }> {
    try {

      // 1. 校验入参（必传字段检查）
      if (!params.items || params.items.length === 0) {
        return { success: false, message: 'items数组不能为空' };
      }

      // 过滤无效数据（asin和marketplace不能为空）
      const validItems = params.items.filter(
        item => item.asin_candidate && item.marketplace
      );

      if (validItems.length === 0) {
        return { success: false, message: '有效数据为空，至少需要一个有效的asin_candidate和marketplace' };
      }

      // 补充采集时间（默认当前日期yyyyMMdd）
      const crawlerTime = params.crawler_time || dayjs().format('YYYYMMDD');

      // 按站点分组处理
      const itemsByMarketplace = new Map<string, Set<string>>();
      validItems.forEach(item => {
        if (!itemsByMarketplace.has(item.marketplace)) {
          itemsByMarketplace.set(item.marketplace, new Set());
        }
        itemsByMarketplace.get(item.marketplace)!.add(item.asin_candidate);
      });

      console.log(`开始批量处理竞品统计，涉及 ${itemsByMarketplace.size} 个站点`);

      for (const [marketplace, inputAsinsSet] of itemsByMarketplace) {
        const inputAsins = Array.from(inputAsinsSet);
        
        // 查找这些ASIN对应的product_code
        const listings = await this.bsrProductListingLingxingEntity.find({
            where: {
                asin: In(inputAsins),
                marketplace: marketplace
            },
            select: ['asin', 'product_code']
        });

        // 按product_code分组ASIN
        const productCodeMap = new Map<string, Set<string>>(); // product_code -> Set<asin> (ALL asins in group)
        const processedAsins = new Set<string>(); // ASINs that have been handled via product_code

        for (const listing of listings) {
            if (listing.product_code) {
                if (!productCodeMap.has(listing.product_code)) {
                    // 如果是新的product_code，查找该code下所有ASIN
                    const allListings = await this.bsrProductListingLingxingEntity.find({
                        where: {
                            product_code: listing.product_code,
                            marketplace: marketplace
                        },
                        select: ['asin']
                    });
                    productCodeMap.set(listing.product_code, new Set(allListings.map(l => l.asin)));
                }
                processedAsins.add(listing.asin);
            }
        }

        // 处理有product_code的组
        for (const [productCode, groupAsinsSet] of productCodeMap) {
            const groupAsins = Array.from(groupAsinsSet);
            await this.calculateAndSaveStats(groupAsins, marketplace, crawlerTime, params.task_id, productCode);
        }

        // 处理没有product_code的单独ASIN
        for (const asin of inputAsins) {
            if (!processedAsins.has(asin)) {
                await this.calculateAndSaveStats([asin], marketplace, crawlerTime, params.task_id);
            }
        }
      }

      console.log('statisticsProductCompetitor end - 批量竞品统计完成');
      return { success: true, message: `成功更新数据的市场分析信息` };
    } catch (error) {
      console.error('statisticsProductCompetitor error - 批量竞品统计失败', error);
      return { success: false, message: '批量竞品统计失败：' + (error as Error).message };
    }
  };

  async statisticsProductCompetitorFromProcess(
    params?: { 
      product_codes?: string[];
      marketplace?: string;
      limit?: number;
      task_id?: number;
      crawler_time?: string;
    }
  ): Promise<{ success: boolean; message: string; total?: number; processed?: number }> {
    try {
      const crawlerTime = params?.crawler_time || dayjs().format('YYYYMMDD');
      const productCodes = Array.isArray(params?.product_codes)
        ? params!.product_codes.map(code => String(code || '').trim()).filter(Boolean)
        : [];
      const marketplace = params?.marketplace ? String(params.marketplace).trim() : '';
      const limit = params?.limit ? Math.max(1, Number(params.limit)) : 0;

      const qb = this.bsrProductListingLingxingProcessRepo
        .createQueryBuilder('p')
        .select('p.product_code', 'product_code')
        .where('p.product_code is not null')
        .andWhere('p.product_code != ""');

      if (productCodes.length > 0) {
        qb.andWhere('p.product_code in (:...productCodes)', { productCodes });
      }

      qb.groupBy('p.product_code');

      if (limit) {
        qb.limit(limit);
      }

      const rows = await qb.getRawMany<{ product_code: string }>();

      if (!rows.length) {
        return { success: false, message: '未找到可处理的product_code', total: 0, processed: 0 };
      }

      let processed = 0;
      let failed = 0;

      for (const row of rows) {
        const productCode = String(row?.product_code || '').trim();
        if (!productCode) continue;

        try {
          // 构建查询条件
          const listingWhere: any = { product_code: productCode };
          if (marketplace) {
            listingWhere.marketplace = marketplace;
          }

          const listings = await this.bsrProductListingLingxingEntity.find({
            where: listingWhere,
            select: ['asin', 'marketplace'],
          });

          // 按 marketplace 分组处理 ASINs
          const marketplaceAsinsMap = new Map<string, Set<string>>();
          for (const listing of listings) {
            if (listing.asin && listing.marketplace) {
              if (!marketplaceAsinsMap.has(listing.marketplace)) {
                marketplaceAsinsMap.set(listing.marketplace, new Set());
              }
              marketplaceAsinsMap.get(listing.marketplace)!.add(listing.asin);
            }
          }

          if (marketplaceAsinsMap.size === 0) continue;

          for (const [mp, asinsSet] of marketplaceAsinsMap.entries()) {
            const asins = Array.from(asinsSet);
            await this.calculateAndSaveStats(asins, mp, crawlerTime, params?.task_id, productCode);
          }

          processed += 1;
        } catch (innerError) {
          console.error(`处理 product_code [${productCode}] 时发生异常:`, innerError);
          failed += 1;
          // 继续处理下一个 product_code，不中断整个任务
        }
      }

      return { success: true, message: `成功处理${processed}个, 失败${failed}个 / 共${rows.length}个product_code`, total: rows.length, processed };
    } catch (error) {
      console.error('statisticsProductCompetitorFromProcess error - 批量竞品统计失败', error);
      return { success: false, message: '批量竞品统计失败：' + (error as Error).message };
    }
  }

  /**
   * 计算并保存统计结果
   * @param asins ASIN列表（同一product_code的一组，或单个）
   * @param marketplace 站点
   * @param crawlerTime 采集时间
   * @param taskId 任务ID
   * @param productCode 产品编码（可选）
   */
  private async calculateAndSaveStats(
    asins: string[], 
    marketplace: string, 
    crawlerTime: string, 
    taskId?: number,
    productCode?: string
  ) {
    // 构建查询条件（包含所有ASIN的竞品）
    const baseQuery = this.bsrCandidateCompetitorRepo.createQueryBuilder('competitor')
      .where('competitor.asin_candidate IN (:...asins)', { asins })
      .andWhere('competitor.marketplace = :marketplace', { marketplace })
      .andWhere('competitor.status = 6') // 仅统计在售数据
      .andWhere('competitor.Main_monthly_sales > 0'); // 仅统计有销量的竞品

    // 4.1 统计销量前15（返回完整数据，包含价格、评分等）- 已去重
    const unitsTop15List = await this.getUnitsTop15WithDetail(baseQuery.clone());
    const units_top_15 = unitsTop15List
      .filter(item => item.Main_monthly_sales !== null && item.Main_monthly_sales !== undefined)
      .map(item => item.Main_monthly_sales)
      .join('|');

    // 4.2 从销量前15中取前10的价格
    const priceTop10 = this.getPriceFromUnitsTop15(unitsTop15List);

    // 4.3 统计市场最低价格（限定FBA有销量）
    const priceLowest = await this.getPriceLowest(baseQuery.clone());

    // 4.4 从销量前15中取前10的评分及平均值
    const { stars_top_10, stars_top_10_avg } = this.getStarsFromUnitsTop15(unitsTop15List);

    // 4.5 统计最早上架时间
    const available_date_earliest = await this.getavailable_date_earliest(baseQuery.clone());

    // 4.6 统计各类型卖家数量（FBA/FBM/AMZ/其他）
    const sellerCountMap = await this.getSellerCountByType(baseQuery.clone());

    // 4.7 统计库存类型（限制/非限制）及M1000标记
    const inventoryStats = await this.getInventoryStats(baseQuery.clone());

    // 4.8 统计各渠道30天销量（FBA/FBM/AMZ/其他）
    const channelSales = await this.get30DaysSalesByChannel(baseQuery.clone());

    // 4.9 统计欧洲五国FBA近30天销量+库存 (针对当前ASIN组)
    const euMarketplaces = Object.values(EuMarketplace);
    const baseQuery2 = this.bsrCandidateCompetitorRepo.createQueryBuilder('competitor')
      .where('competitor.asin_candidate IN (:...asins)', { asins }) // 使用ASIN组
      .andWhere('competitor.marketplace IN (:...marketplaces)', { marketplaces: euMarketplaces })
      .andWhere('competitor.status = 6')
      .andWhere('competitor.Main_monthly_sales > 0');
      
    const euFbaSalesAndStock = await this.getEuFba30DaysSalesAndStock(baseQuery2.clone());

    // 4.10 统计竞品总数（去重后）
    const allCompetitors = await baseQuery.clone().getMany();
    const uniqueCompetitors = this.aggregateCompetitorItemsByParentAsin(allCompetitors);
    const competitorCount = uniqueCompetitors.length;

    // 2026-03-02
    const companyStats = await this.getCompany30DaysSalesAndStock(asins, marketplace, productCode);

    // 为组内的每个ASIN保存相同的统计结果
    for (const asin_candidate of asins) {
        // 查询该ASIN对应的统计记录（不存在则创建）
        let statsItem = await this.amazonProductCompetitorStatisticsRepo.findOne({
          where: { 
            asin_candidate, 
            marketplace,
            crawler_time: crawlerTime 
          }
        });

        if (!statsItem) {
          statsItem = new AmazonProductCompetitorStatisticsEntity();
          statsItem.asin_candidate = asin_candidate;
          statsItem.marketplace = marketplace;
          statsItem.crawler_time = crawlerTime;
          statsItem.task_id = taskId || null;
          statsItem.search_month = dayjs().format('YYYY-MM'); // 默认当月
        }

        // 保存product_code（如果有）
        if (productCode) {
            statsItem.product_code = productCode;
        }

        // 赋值通用统计结果
        statsItem.units_top_15 = units_top_15;
        statsItem.price_top_10 = priceTop10;
        statsItem.price_lowest = priceLowest;
        statsItem.stars_top_10 = stars_top_10;
        statsItem.stars_top_10_avg = stars_top_10_avg;
        statsItem.available_date_earliest = available_date_earliest;
        statsItem.seller_count_fba = sellerCountMap.FBA;
        statsItem.seller_count_not_fba = sellerCountMap.NOT_FBA;
        statsItem.seller_count_fbm = sellerCountMap.FBM;
        statsItem.seller_count_amz = sellerCountMap.AMZ;
        statsItem.seller_count_other = sellerCountMap.OTHER;
        statsItem.inventory_sum_limit = inventoryStats.sumLimit;
        statsItem.inventory_sum_not_limit = inventoryStats.sumNotLimit;
        statsItem.has_m1000 = inventoryStats.hasM1000;
        statsItem.units_30_sum_fba = channelSales.FBA;
        statsItem.units_30_sum_fbm = channelSales.FBM;
        statsItem.units_30_sum_amz = channelSales.AMZ;
        statsItem.units_30_sum_other = channelSales.OTHER;
        statsItem.units_30_sum = channelSales.FBA + channelSales.FBM + channelSales.AMZ + channelSales.OTHER;
        statsItem.competitor_count = competitorCount;
        statsItem.inventory_sum = inventoryStats.sumLimit + inventoryStats.sumNotLimit;
        statsItem.company_units_30_sum = companyStats.sales;
        statsItem.company_inventory_sum = companyStats.stock;

        // 赋值欧洲五国FBA销量+库存
        statsItem.units_30_sum_fba_uk = euFbaSalesAndStock.英国;
        statsItem.units_30_sum_fba_de = euFbaSalesAndStock.德国;
        statsItem.units_30_sum_fba_fr = euFbaSalesAndStock.法国;
        statsItem.units_30_sum_fba_es = euFbaSalesAndStock.西班牙;
        statsItem.units_30_sum_fba_it = euFbaSalesAndStock.意大利;

        // 7. 保存/更新统计结果
        await this.amazonProductCompetitorStatisticsRepo.upsert(
          statsItem,
          ['asin_candidate', 'marketplace', 'crawler_time'] // 唯一键
        );
    }
  }

//   /**
//    * 统计竞品总销量和总数量（原Java的statisticsUnitsAndCompetitorCountByTemp）
//    * @param statsParam ASIN和市场参数
//    */
//   private async statisticsUnitsAndCompetitorCountByAsinAndMarketplace(
//     statsParam: { asin_candidate: string; marketplace: string; crawler_time: string }
//   ): Promise<void> {
//     const { asin_candidate, marketplace, crawler_time } = statsParam;

//     // 构建聚合查询（添加有销量+FBA过滤）
//     const queryBuilder = this.bsrCandidateCompetitorRepo.createQueryBuilder('competitor')
//       .select('competitor.asin_candidate', 'asin_candidate')
//       .addSelect('competitor.marketplace', 'marketplace')
//       .addSelect('SUM(competitor.Main_monthly_sales)', 'totalUnits') // 30天销量（父体销量）
//       .addSelect('COUNT(DISTINCT competitor.id)', 'totalCount') // 总竞品数量
//       .where('competitor.status in (6,7)')
//       .andWhere('competitor.Main_monthly_sales > 0') // 有销量
//       .andWhere('competitor.asin_candidate = :asin_candidate', { asin_candidate })
//       .andWhere('competitor.marketplace = :marketplace', { marketplace })
//       .groupBy('competitor.asin_candidate, competitor.marketplace');

//     const statsResult = await queryBuilder.getRawMany();

//     // 写入统计结果表
//     for (const item of statsResult) {
//       // 去重后统计总数
//       const allCompetitors = await this.bsrCandidateCompetitorRepo.find({
//         where: {
//           asin_candidate,
//           marketplace,
//           status: In([6,7]),
//         }
//       });
//       const uniqueCompetitors = this.uniqueCompetitorItems(allCompetitors);
//       const uniqueCount = uniqueCompetitors.length;

//       const existStats = await this.amazonProductCompetitorStatisticsRepo.findOne({
//         where: {
//           asin_candidate: item.asin_candidate,
//           marketplace: item.marketplace,
//           crawler_time
//         }
//       });

//       if (existStats) {
//         existStats.units_30_sum = Number(item.totalUnits) || 0;
//         existStats.competitor_count = uniqueCount; // 改用去重后的数量
//         await this.amazonProductCompetitorStatisticsRepo.save(existStats);
//       } else {
//         const newStats = new AmazonProductCompetitorStatisticsEntity();
//         newStats.asin_candidate = item.asin_candidate;
//         newStats.marketplace = item.marketplace;
//         newStats.crawler_time = crawler_time;
//         newStats.units_30_sum = Number(item.totalUnits) || 0;
//         newStats.competitor_count = uniqueCount; // 改用去重后的数量
//         await this.amazonProductCompetitorStatisticsRepo.save(newStats);
//       }
//     }
//   }

  /**
   * 竞品数据去重：售卖方+价格（去£）+标题+变体数量相同视为同一产品，保留销量最高的
   * @param items 原始竞品列表
   * @returns 去重后的竞品列表
   */
  private uniqueCompetitorItems(items: AppAmzBsrCandidateCompetitorEntity[]): AppAmzBsrCandidateCompetitorEntity[] {
    // 构建去重映射：key为售卖方+价格+标题+变体数量，value为销量最高的item
    const uniqueMap = new Map<string, AppAmzBsrCandidateCompetitorEntity>();

    for (const item of items) {
      // 处理价格（去£符号，统一格式）
      const cleanPrice = item.price ? item.price.replace('£', '').trim() : '';
      // 获取售卖方、标题、变体数量（处理空值，字段名需与实体一致）
      const sellerName = item.sold_by ? item.sold_by.trim() : ''; // 售卖方
      const title = item.item_name ? item.item_name.trim() : ''; // 产品标题
      const variantCount = item.variants ? item.variants.toString() : '0'; // 变体数量

      // 构建去重key（核心：四个维度一致则视为同一产品）
      const uniqueKey = `${sellerName}|${cleanPrice}|${title}|${variantCount}`;

      // 如果key已存在，比较销量，保留更高的；不存在则直接存入
      const existingItem = uniqueMap.get(uniqueKey);
      if (!existingItem) {
        uniqueMap.set(uniqueKey, item);
      } else {
        const currentSales = item.Main_monthly_sales || 0;
        const existingSales = existingItem.Main_monthly_sales || 0;
        if (currentSales > existingSales) {
          uniqueMap.set(uniqueKey, item);
        }
      }
    }

    // 转换为数组并按销量降序排序
    return Array.from(uniqueMap.values()).sort((a, b) => (b.Main_monthly_sales || 0) - (a.Main_monthly_sales || 0));
  }

  /**
   * 竞品数据二次去重：父体销量+变体数量+配送方+售卖方一致，视为同一数据
   * @param items 第一次去重后的竞品列表
   * @returns 二次去重后的竞品列表
   */
  private uniqueCompetitorItemsBySalesRule(items: AppAmzBsrCandidateCompetitorEntity[]): AppAmzBsrCandidateCompetitorEntity[] {
    const uniqueMap = new Map<string, AppAmzBsrCandidateCompetitorEntity>();

    for (const item of items) {
      const sales = item.Main_monthly_sales || 0;
      const variantCount = item.variants ? item.variants.toString() : '0';
      const sellerName = item.sold_by ? item.sold_by.trim() : '';
      const dispatchType = item.dispatches_type || '';

      // 构建去重key
      const uniqueKey = `${sales}|${variantCount}|${sellerName}|${dispatchType}`;

      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, item);
      }
    }

    // 转换为数组并按销量降序排序
    return Array.from(uniqueMap.values()).sort((a, b) => (b.Main_monthly_sales || 0) - (a.Main_monthly_sales || 0));
  }

  /**
   * 竞品数据去重：parent_asin一致视为同一数据，保留销量最高的
   * @param items 原始竞品列表
   * @returns 去重后的竞品列表
   */
  private uniqueCompetitorItemsByParentAsin(items: AppAmzBsrCandidateCompetitorEntity[]): AppAmzBsrCandidateCompetitorEntity[] {
    const uniqueMap = new Map<string, AppAmzBsrCandidateCompetitorEntity>();

    for (const item of items) {
      const parentAsin = item.parent_asin ? item.parent_asin.trim() : '';
      const uniqueKey = parentAsin || item.asin_competitor || '';

      const existingItem = uniqueMap.get(uniqueKey);
      if (!existingItem) {
        uniqueMap.set(uniqueKey, item);
      } else {
        const currentSales = item.Main_monthly_sales || 0;
        const existingSales = existingItem.Main_monthly_sales || 0;
        if (currentSales > existingSales) {
          uniqueMap.set(uniqueKey, item);
        }
      }
    }

    return Array.from(uniqueMap.values()).sort((a, b) => (b.Main_monthly_sales || 0) - (a.Main_monthly_sales || 0));
  }

  private normalizePriceNumber(price: string | number | null | undefined): number | null {
    if (price === null || price === undefined) {
      return null;
    }

    let value = typeof price === 'number' ? String(price) : String(price).trim();
    if (!value) {
      return null;
    }

    value = value.replace(/[^\d.,-]/g, '');
    if (!value) {
      return null;
    }

    if (value.includes(',') && value.includes('.')) {
      if (value.indexOf(',') < value.indexOf('.')) {
        value = value.replace(/,/g, '');
      } else {
        value = value.replace(/\./g, '').replace(/,/g, '.');
      }
    } else if (value.includes(',')) {
      value = value.replace(/,/g, '.');
    }

    const result = Number(value);
    if (!Number.isFinite(result) || result <= 0) {
      return null;
    }

    return Number(result.toFixed(2));
  }

  private formatPriceNumber(price: number): string {
    return price.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
  }

  private getChildSalesValue(item: AppAmzBsrCandidateCompetitorEntity): number {
    const parentAsin = item.parent_asin ? item.parent_asin.trim() : '';
    const asinCompetitor = item.asin_competitor ? item.asin_competitor.trim() : '';
    const hasChildParent = parentAsin && parentAsin !== asinCompetitor;

    if (hasChildParent) {
      return Number(item.Main_monthly_sales_sub) || 0;
    }

    return Number(item.Main_monthly_sales) || Number(item.Main_monthly_sales_sub) || 0;
  }

  private getAdjustedInventoryValue(item: AppAmzBsrCandidateCompetitorEntity): number {
    const type = String(item.inventory_type || '').trim().toUpperCase();
    const originalStock = Number(item.stock_quantity) || 0;
    const childSales = this.getChildSalesValue(item);

    if (type === 'XIAN' || type === 'LIMIT') {
      return Number(Math.max(childSales, originalStock * 1.5).toFixed(2));
    }

    if (type === '999+') {
      return Number(Math.max(childSales, 999 * 1.5).toFixed(2));
    }

    return originalStock;
  }

  private aggregateCompetitorItemsByParentAsin(
    items: AppAmzBsrCandidateCompetitorEntity[]
  ): AggregatedCompetitorItem[] {
    const grouped = new Map<string, AppAmzBsrCandidateCompetitorEntity[]>();

    for (const item of items) {
      const parentAsin = item.parent_asin ? item.parent_asin.trim() : '';
      const asinCompetitor = item.asin_competitor ? item.asin_competitor.trim() : '';
      const uniqueKey = parentAsin || asinCompetitor;

      if (!uniqueKey) {
        continue;
      }

      if (!grouped.has(uniqueKey)) {
        grouped.set(uniqueKey, []);
      }

      grouped.get(uniqueKey)!.push(item);
    }

    const result: AggregatedCompetitorItem[] = [];

    for (const groupItems of grouped.values()) {
      const sortedItems = [...groupItems].sort(
        (a, b) => (Number(b.Main_monthly_sales) || 0) - (Number(a.Main_monthly_sales) || 0)
      );
      const baseItem = sortedItems[0];
      const priceValues = Array.from(
        new Set(
          sortedItems
            .map(item => this.normalizePriceNumber(item.price))
            .filter((price): price is number => price !== null)
        )
      ).sort((a, b) => a - b);
      const minPrice = priceValues[0];
      const maxPrice = priceValues[priceValues.length - 1];
      const priceDisplay =
        priceValues.length <= 1
          ? (minPrice ? this.formatPriceNumber(minPrice) : String(baseItem.price || ''))
          : `${this.formatPriceNumber(minPrice)}-${this.formatPriceNumber(maxPrice)}`;
      const priceEncoded =
        priceValues.length > 1
          ? `${priceDisplay}{${priceValues.map(price => this.formatPriceNumber(price)).join(',')}}`
          : priceDisplay;
      const totalStock = Number(
        sortedItems
          .reduce((sum, item) => sum + this.getAdjustedInventoryValue(item), 0)
          .toFixed(2)
      );

      result.push(
        Object.assign(new AppAmzBsrCandidateCompetitorEntity(), baseItem, {
          price: priceEncoded,
          stock_quantity: String(totalStock),
          __groupItems: sortedItems,
          __priceValues: priceValues,
          __stockQuantityValue: totalStock
        })
      );
    }

    return result.sort(
      (a, b) => (Number(b.Main_monthly_sales) || 0) - (Number(a.Main_monthly_sales) || 0)
    );
  }

  /**
   * 获取销量前15的完整数据（包含价格、评分、库存等）- 去重版
   * @param queryBuilder 基础查询构建器
   * @returns 销量前15的竞品数据（去重后）
   */
  private async getUnitsTop15WithDetail(
    queryBuilder: SelectQueryBuilder<AppAmzBsrCandidateCompetitorEntity>
  ): Promise<AppAmzBsrCandidateCompetitorEntity[]> {
    // 先查询所有符合条件的竞品（取消limit，先获取全部）
    const allCompetitors = await queryBuilder
      .select([
        'competitor.Main_monthly_sales',
        'competitor.price',
        'competitor.last_star',
        'competitor.marketplace',
        'competitor.stock_quantity',
        'competitor.date_first_available',
        'competitor.dispatches_type',
        'competitor.inventory_type',
        'competitor.sold_by', // 售卖方
        'competitor.item_name', // 产品标题
        'competitor.variants', // 变体数量
        'competitor.Main_monthly_sales_sub',
        'competitor.parent_asin',
        'competitor.asin_competitor'
      ])
      .orderBy('competitor.Main_monthly_sales', 'DESC') // 销量降序
      .getMany();

    const finalUniqueCompetitors = this.aggregateCompetitorItemsByParentAsin(allCompetitors);
    return finalUniqueCompetitors.slice(0, 15);
  }

  /**
   * 从销量前15数据中提取前10的价格（按实体要求只取前6个）
   * @param unitsTop15List 销量前15的完整数据
   * @returns 价格拼接字符串（例：29.99|28.99|27.99...）
   */
  private getPriceFromUnitsTop15(unitsTop15List: AppAmzBsrCandidateCompetitorEntity[]): string {
    const priceStr = unitsTop15List
      .slice(0, 15)
      .map(item => String(item.price || '').trim())
      .filter(Boolean)
      .join('|');

    return priceStr;
  }

  /**
   * 获取市场最低价格（限定FBA有销量）
   * @param queryBuilder 基础查询构建器
   * @returns 最低价格（数值型）
   */
  private async getPriceLowest(
    queryBuilder: SelectQueryBuilder<AppAmzBsrCandidateCompetitorEntity>
  ): Promise<number | null> {
    const lowestPrice = await queryBuilder
      .select('MIN(CAST(REPLACE(competitor.price, "£", "") AS DECIMAL(10,2))) AS lowest_price')
      .andWhere('competitor.price > 0') // 过滤0价格
      .andWhere('competitor.dispatches_type = :fulfillment', { fulfillment: '1' }) // 限定FBA渠道
      .andWhere('competitor.Main_monthly_sales > 0') // 2026-03-02: 父体销量必须>0
      .getRawOne();

    return lowestPrice?.lowest_price || null;
  }

  /**
   * 从销量前15数据中提取前10的评分及平均值
   * @param unitsTop15List 销量前15的完整数据
   * @returns 评分拼接字符串 + 平均值
   */
  private getStarsFromUnitsTop15(unitsTop15List: AppAmzBsrCandidateCompetitorEntity[]): {
    stars_top_10: string;
    stars_top_10_avg: number | null;
  } {
    const top15Items = unitsTop15List.slice(0, 15);

    const stars_top_10 = top15Items
      .filter(item => item.last_star !== null && item.last_star !== undefined)
      .map(item => item.last_star)
      .join('|');

    const validStars = top15Items
      .filter(item => item.last_star !== null && item.last_star !== undefined)
      .map(item => item.last_star);
    const stars_top_10_avg = validStars.length > 0
      ? Number((validStars.reduce((sum, val) => sum + val, 0) / validStars.length).toFixed(2))
      : null;

    return { stars_top_10, stars_top_10_avg };
  }

  /**
   * 获取最早上架时间
   * @param queryBuilder 基础查询构建器
   * @returns 最早的上架时间
   */
  private async getavailable_date_earliest(
    queryBuilder: SelectQueryBuilder<AppAmzBsrCandidateCompetitorEntity>
  ): Promise<Date | null> {
    const earliestDate = await queryBuilder
      .select('competitor.date_first_available', 'availableDate')
      .andWhere('competitor.date_first_available IS NOT NULL')
      .orderBy('competitor.date_first_available', 'ASC')
      .limit(1)
      .getRawOne();

    return earliestDate?.availableDate || null;
  }

  /**
   * 统计各类型卖家数量（FBA/NOT_FBA/FBM/AMZ/OTHER）
   * @param queryBuilder 基础查询构建器
   * @returns 各类型卖家数量映射
   */
  private async getSellerCountByType(
    queryBuilder: SelectQueryBuilder<AppAmzBsrCandidateCompetitorEntity>
  ): Promise<{ FBA: number; NOT_FBA: number; FBM: number; AMZ: number; OTHER: number }> {
    const allCompetitors = await queryBuilder.clone().getMany();
    const uniqueCompetitors = this.aggregateCompetitorItemsByParentAsin(allCompetitors);

    const fbaCount = uniqueCompetitors.filter(item => item.dispatches_type === '1').length;
    const notFbaCount = uniqueCompetitors.filter(item => item.dispatches_type !== '1').length;
    const fbmCount = uniqueCompetitors.filter(item => item.dispatches_type === '2').length;
    const amzCount = uniqueCompetitors.filter(item => item.dispatches_type === '0').length;
    const otherCount = Math.max(notFbaCount - fbmCount - amzCount, 0);

    return {
      FBA: fbaCount,
      NOT_FBA: notFbaCount,
      FBM: fbmCount,
      AMZ: amzCount,
      OTHER: otherCount
    };
  }

  /**
   * 统计库存类型（限制/非限制）及M1000标记
   * @param queryBuilder 基础查询构建器
   * @returns 库存统计结果
   */
  private async getInventoryStats(
    queryBuilder: SelectQueryBuilder<AppAmzBsrCandidateCompetitorEntity>
  ): Promise<{ sumLimit: number; sumNotLimit: number; hasM1000: boolean }> {
    const inventoryList = await queryBuilder
      .andWhere('competitor.dispatches_type = :fulfillment', { fulfillment: '1' }) // 仅统计FBA库存
      .getMany();

    const uniqueInventoryList = this.aggregateCompetitorItemsByParentAsin(inventoryList);

    let sumLimit = 0; // 限制型库存
    let sumNotLimit = 0; // 非限制型库存
    let hasM1000 = false; // 是否包含M1000/2类型库存

    for (const item of uniqueInventoryList) {
      const groupItems = item.__groupItems || [item];
      const inventory = Number(item.__stockQuantityValue || 0);
      const hasLimitFlag = groupItems.some(groupItem => {
        const type = String(groupItem.inventory_type || '').trim().toUpperCase();
        return type === 'XIAN' || type === 'LIMIT';
      });

      if (hasLimitFlag) {
        sumLimit += inventory;
      } else {
        sumNotLimit += inventory;
      }

      if (
        groupItems.some(groupItem => {
          const type = String(groupItem.inventory_type || '').trim().toUpperCase();
          return type === 'M1000' || type === '2';
        })
      ) {
        hasM1000 = true;
      }
    }

    return { sumLimit, sumNotLimit, hasM1000 };
  }

  /**
   * 统计各渠道30天销量（FBA/FBM/AMZ/其他）
   */
  private async get30DaysSalesByChannel(
    queryBuilder: SelectQueryBuilder<AppAmzBsrCandidateCompetitorEntity>
  ): Promise<{ FBA: number; FBM: number; AMZ: number; OTHER: number }> {
    const allCompetitors = await queryBuilder.clone().getMany();
    const uniqueCompetitors = this.aggregateCompetitorItemsByParentAsin(allCompetitors);

    const channelSales = { FBA: 0, FBM: 0, AMZ: 0, OTHER: 0 };

    for (const item of uniqueCompetitors) {
      const sales = Number(item.Main_monthly_sales) || this.getChildSalesValue(item);

      switch (item.dispatches_type) {
        case '1':
          channelSales.FBA += sales;
          break;
        case '2':
          channelSales.FBM += sales;
          break;
        case '0':
          channelSales.AMZ += sales;
          break;
        default:
          channelSales.OTHER += sales;
          break;
      }
    }

    return channelSales;
  }

  private async getCompany30DaysSalesAndStock(
    asins: string[],
    marketplace: string,
    productCode?: string
  ): Promise<{ sales: number; stock: number }> {
    if (!asins || asins.length === 0) {
      return { sales: 0, stock: 0 };
    }

    const listingItems = await this.bsrProductListingLingxingEntity.find({
      where: productCode
        ? {
            product_code: productCode,
            marketplace
          }
        : {
            asin: In(asins),
            marketplace
          },
      select: ['asin', 'thirty_volume']
    });

    const sales = listingItems.reduce((sum, item) => {
      return sum + (Number(item.thirty_volume) || 0);
    }, 0);

    const restockingItems = await this.bsrRestockingCenterLingxingRepo.find({
      where: {
        asin: In(asins),
        marketplaceList: Like(`%${marketplace}%`)
      },
      select: ['asin', 'fbaValidList']
    });

    const stock = restockingItems.reduce((sum, item: any) => {
      const list = Array.isArray(item.fbaValidList) ? item.fbaValidList : [];
      const itemSum = list.reduce((innerSum: number, fbaItem: any) => {
        return innerSum + (Number(fbaItem?.quantity) || 0);
      }, 0);
      return sum + itemSum;
    }, 0);

    return { sales, stock };
  }

  
private async getEuFba30DaysSalesAndStock(
  queryBuilder: SelectQueryBuilder<AppAmzBsrCandidateCompetitorEntity>
): Promise<Record<EuMarketplace, string>> {
  const result: Record<EuMarketplace, string> = {
    [EuMarketplace.UK]: '0|0',
    [EuMarketplace.DE]: '0|0',
    [EuMarketplace.FR]: '0|0',
    [EuMarketplace.ES]: '0|0',
    [EuMarketplace.IT]: '0|0'
  };

  const allCompetitors = await queryBuilder
    .andWhere('competitor.dispatches_type = :fulfillment', { fulfillment: '1' })
    .getMany();

  // Group by marketplace
  const marketGroups = new Map<string, AppAmzBsrCandidateCompetitorEntity[]>();
  for (const item of allCompetitors) {
    if (!marketGroups.has(item.marketplace)) {
      marketGroups.set(item.marketplace, []);
    }
    marketGroups.get(item.marketplace)!.push(item);
  }

  // Process each marketplace
  for (const [market, items] of marketGroups.entries()) {
    if (Object.values(EuMarketplace).includes(market as EuMarketplace)) {
      const uniqueItems = this.aggregateCompetitorItemsByParentAsin(items);
      
      let totalSales = 0;
      let totalStock = 0;
      
      for (const uItem of uniqueItems) {
          const sales = Number(uItem.Main_monthly_sales) || this.getChildSalesValue(uItem);
          const inventory = Number(uItem.__stockQuantityValue || 0);
          totalSales += sales;
          totalStock += inventory;
      }
      
      result[market as EuMarketplace] = `${totalSales}|${totalStock}`;
    }
  }

  return result;
}

  /**
   * 价格分析：计算当前商品的价格排名状态
   * @param listing 商品Listing数据
   * @param competitorStats 竞品统计数据
   * @returns 价格分析状态码
  //  */
  // private analyzePriceStatus(
  //   listing: AppAmzBsrProductListingLingxingEntity,
  //   competitorStats: AmazonProductCompetitorStatisticsEntity
  // ): number {
  //   const { price_target: currentPrice } = listing;
  //   const { price_top_10, price_lowest } = competitorStats;

  //   // 处理当前价格（去£符号）
  //   const cleanCurrentPrice = currentPrice
  //     ? Number(currentPrice.toString().replace('£', ''))
  //     : null;

  //   // 无效价格数据
  //   if (cleanCurrentPrice === null || isNaN(cleanCurrentPrice) || !price_top_10) {
  //     return PriceAnalyzeStatus.UNDEFINED;
  //   }

  //   // 解析竞品前10价格并排序（已去重）
  //   const priceList = price_top_10.split('|')
  //     .map(Number)
  //     .filter(price => !isNaN(price) && price > 0)
  //     .sort((a, b) => a - b);

  //   if (priceList.length === 0) {
  //     return PriceAnalyzeStatus.UNDEFINED;
  //   }

  //   // 判断是否为市场最低价（FBA有销量）
  //   if (cleanCurrentPrice < (price_lowest || Infinity)) {
  //     return PriceAnalyzeStatus.LOWEST_PRICE;
  //   }

  //   // 计算价格排名
  //   const lowerCount = priceList.filter(price => price < cleanCurrentPrice).length;
  //   const rank = lowerCount + 1;

  //   // 返回对应排名状态
  //   if (rank <= 10) {
  //     return PriceAnalyzeStatus[`LOW_PRICE_RANK${rank}` as keyof typeof PriceAnalyzeStatus] || PriceAnalyzeStatus.UNDEFINED;
  //   } else {
  //     return PriceAnalyzeStatus.HIGHER_PRICE;
  //   }
  // }

  // /**
  //  * 销量分析：计算当前商品的销量健康状态
  //  * @param listing 商品Listing数据
  //  * @param competitorStats 竞品统计数据
  //  * @returns 销量分析状态码
  //  */
  // private analyzeVolumeStatus(
  //   listing: AppAmzBsrProductListingLingxingEntity,
  //   competitorStats: AmazonProductCompetitorStatisticsEntity
  // ): number {
  //   const {
  //     afn_fulfillable_quantity: inventory,
  //     total_volume: sevenVolume,
  //     fourteen_volume: fourteenVolume,
  //     thirty_volume: thirtyVolume,
  //     newProductStatus: arrivalStatus,
  //     createTime
  //   } = listing;
  //   const { units_top_15: unitsTop15Str } = competitorStats;

  //   // 1. 新品在途
  //   if (arrivalStatus === NewProductStatus.IN_TRANSIT) {
  //     return VolumeAnalyzeStatus.IN_TRANSIT_NEW_ASIN;
  //   }

  //   // 2. 判断是否为新品（创建≤30天）
  //   const isNewProduct = dayjs().diff(dayjs(createTime), 'day') <= 30;

  //   // 3. 到货超7/14/30天无销量
  //   if ([
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_ARRIVAL_OVER_DAY7,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_ARRIVAL_OVER_DAY7,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_OFF_SALE_ARRIVAL_OVER_DAY7,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_OFF_SALE_ARRIVAL_OVER_DAY7
  //   ].includes(arrivalStatus)) {
  //     if ((sevenVolume || 0) === 0 && inventory > 0) {
  //       return VolumeAnalyzeStatus.ABNORMAL_VOLUME_OVER_7_DAY;
  //     }
  //   }
  //   if (dayjs().diff(dayjs(createTime), 'day') > 14 && (fourteenVolume || 0) === 0 && inventory > 0) {
  //     return VolumeAnalyzeStatus.ABNORMAL_VOLUME_OVER_14_DAY;
  //   }
  //   if (dayjs().diff(dayjs(createTime), 'day') > 30 && (thirtyVolume || 0) === 0 && inventory > 0) {
  //     return VolumeAnalyzeStatus.ABNORMAL_VOLUME_OVER_30_DAY;
  //   }

  //   // 4. 到货1周内无销量
  //   const isWithinWeek = [
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_ARRIVAL_DAY1,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_ARRIVAL_DAY2,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_ARRIVAL_DAY3,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_ARRIVAL_DAY4,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_ARRIVAL_DAY5,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_ARRIVAL_DAY6,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_ARRIVAL_DAY7,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY1,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY2,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY3,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY4,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY5,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY6,
  //     ArrivalAnalyzeStatus.NEW_PRODUCT_OFF_SALE_ARRIVAL_DAY7,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_ARRIVAL_DAY1,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_ARRIVAL_DAY2,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_ARRIVAL_DAY3,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_ARRIVAL_DAY4,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_ARRIVAL_DAY5,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_ARRIVAL_DAY6,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_ARRIVAL_DAY7,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY1,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY2,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY3,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY4,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY5,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY6,
  //     ArrivalAnalyzeStatus.OLD_PRODUCT_OFF_SALE_ARRIVAL_DAY7,
  //   ].includes(arrivalStatus);

  //   if (isWithinWeek && (sevenVolume || 0) === 0) {
  //     return isNewProduct
  //       ? VolumeAnalyzeStatus.ABNORMAL_VOLUME_NEW_ASIN
  //       : VolumeAnalyzeStatus.ABNORMAL_VOLUME_OLD_ASIN;
  //   }

  //   // 5. 与竞品前15销量对比（已去重）
  //   if (unitsTop15Str && thirtyVolume) {
  //     const unitsTop15 = unitsTop15Str.split('|')
  //       .map(Number)
  //       .filter(unit => !isNaN(unit) && unit > 0);
  //     if (unitsTop15.length > 0) {
  //       const unitsTop1 = unitsTop15[0]; // 竞品销量第1名
  //       const count = unitsTop15.filter(unit => thirtyVolume > unit).length;

  //       if (unitsTop1 < 500) {
  //         if (count <= 10) {
  //           return VolumeAnalyzeStatus.ABNORMAL_PRICE_BSR_LESS_THAN_500_BEHIND_RANK5;
  //         } else {
  //           return inventory / thirtyVolume >= 3
  //             ? VolumeAnalyzeStatus.OVER_STOCK_BSR_LESS_THAN_500_BEFORE_RANK5
  //             : VolumeAnalyzeStatus.REPLENISH;
  //         }
  //       } else if (unitsTop1 >= 3000 && thirtyVolume >= 500) {
  //         return VolumeAnalyzeStatus.REPLENISH;
  //       } else if (unitsTop1 >= 3000 && thirtyVolume < 100) {
  //         return VolumeAnalyzeStatus.ABNORMAL_TRAFFIC_BSR_GREATER_THAN_3000;
  //       }
  //     }
  //   }

  //   // 未匹配任何规则
  //   return VolumeAnalyzeStatus.UNDEFINED;
  // }
}
