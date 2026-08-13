import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, QueryRunner, In, FindOptionsWhere, Raw, Brackets } from 'typeorm';
import { AppAmzBsrRestockingCenterLingxingEntity } from "../entity/bsr_restocking_center_lingxing";
import { LingXingUtils, FbaValidItem, FbaShippingItem } from '../utils/lingxing/lingxingUtils';
import { normalizeLingxingRestockingOpenApiItem } from '../utils/lingxing/lingxingOpenApiMapper';
import { AppAmzSellerEntity } from "../entity/seller";
import axios from 'axios';
import * as dayjs from 'dayjs';
import { AppAmzBsrProductListingLingxingEntity } from "../entity/bsr_product_Listing_Lingxing";
import { AppAmzPricingProductTagEntity } from "../entity/pricing_product_tag";
import { log } from 'console';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
const SHIPMENT_STATUS_MAP = {
  // 示例映射（需根据接口实际返回的status/shipment_status值调整，若接口直接返回下面的枚举则无需映射）
  '待发货': 'working',
  '已发货': 'shipped',
  '运输中': 'In_transit',
  '已送达': 'delivered',
  '已登记': 'Check_in',
  '接收中': 'receiving',
  '已关闭': 'closed',
  '已取消(发货后)': 'cancelled',
  '已取消(发货前)': 'delete',
  '出错': 'error',
  // 补充接口可能返回的原始值映射（根据实际情况调整）
  '0': 'working',
  '1': 'shipped',
  '2': 'In_transit',
  '3': 'delivered',
  '4': 'Check_in',
  '5': 'receiving',
  '6': 'closed',
  '7': 'cancelled',
  '8': 'delete',
  '9': 'error'
};

@Provide()
export class AppAmzBsrRestockingCenterLingxingService extends BaseService {
  @InjectEntityModel(AppAmzBsrRestockingCenterLingxingEntity)
  restockingCenterRepo: Repository<AppAmzBsrRestockingCenterLingxingEntity>;

  @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
  listingLingxingRepo: Repository<AppAmzBsrProductListingLingxingEntity>;

  @InjectEntityModel(AppAmzSellerEntity)
  sellerRepo: Repository<AppAmzSellerEntity>;

  @InjectEntityModel(AppAmzPricingProductTagEntity)
  productTagRepo: Repository<AppAmzPricingProductTagEntity>;


  @Inject()
  private lingXingUtils: LingXingUtils;

  /**
   * 获取补货原始数据（拆分到Service，工具类只保留FBA请求）
   */
  // bsr_restocking_center_lingxing.ts 中 requestLingXingRestockingData 方法
  private async requestLingXingRestockingData(): Promise<Array<Record<string, any>>> {
    if (await this.lingXingUtils.getLingxingDataFetchMode() === 2) {
      return this.requestLingXingRestockingDataByOpenApi();
    }

    try {
      const headers = await this.lingXingUtils.getCrawlerHeaders();
      const PAGE_SIZE = 200; // 和Listing保持一致
      const CONCURRENT_LIMIT = 20; // 并发限制
      const REQUEST_INTERVAL = 500; // 请求间隔
  
      // 1. 首次请求获取总数和第一页数据
      const firstBody = {
        offset: 0,
        length: PAGE_SIZE,
        searchField: "asin",
        searchValue: "",
        star: "0",
        fulfillmentChannelType: "",
        searchDate: "sugDatePurchase",
        restockStatus: [0, 1],
        tagIdList: [],
        dataType: 1,
        analysisMode: 1,
        cidList: [],
        bidList: [],
        listingStatusList: [],
        storeIdList: [],
        countryCode: ["UK", "IT", "DE", "FR", "ES", "NL", "SE", "TR", "PL", "BE", "IE", "EG"],
        principalUidList: [],
        seniorSearchList: [],
        rangeSelectList: [],
        req_time_sequence: "/sc/restocking-center/amazon/analysis/list$$1"
      };
  
      const firstRes = await axios.post(
        `${this.lingXingUtils.lx_crawler_host}/sc/restocking-center/amazon/analysis/list`,
        firstBody,
        { headers, timeout: 30000 }
      );
  
      const rawData = firstRes.data || {};
      const dataObj = rawData.data || {};
      const total = dataObj.total || 0;
      const pageMax = Math.ceil(total / PAGE_SIZE);
  
      console.log(`补货数据总数：${total}，总页数：${pageMax}`);
  
      if (pageMax === 0) {
        return [];
      }
  
      // 2. 构建所有分页请求体
      const requestBodies = Array.from({ length: pageMax }, (_, i) => ({
        offset: i * PAGE_SIZE,
        length: PAGE_SIZE,
        searchField: "asin",
        searchValue: "",
        star: "0",
        fulfillmentChannelType: "",
        searchDate: "sugDatePurchase",
        restockStatus: [0, 1],
        tagIdList: [],
        dataType: 1,
        analysisMode: 1,
        cidList: [],
        bidList: [],
        listingStatusList: [],
        storeIdList: [],
        countryCode: ["UK", "IT", "DE", "FR", "ES", "NL", "SE", "TR", "PL", "BE", "IE", "EG"],
        principalUidList: [],
        seniorSearchList: [],
        rangeSelectList: [],
        req_time_sequence: "/sc/restocking-center/amazon/analysis/list$$1",
        pageIndex: i + 1 // 记录页码
      }));
  
      // 3. 分批并发请求（和Listing逻辑完全一致）
      const allResults: Array<Record<string, any>> = [];
      for (let i = 0; i < requestBodies.length; i += CONCURRENT_LIMIT) {
        const batch = requestBodies.slice(i, i + CONCURRENT_LIMIT);
        const batchPromises = batch.map(async (body) => {
          await new Promise(resolve => setTimeout(resolve, REQUEST_INTERVAL));
          console.log(`正在请求补货数据第${body.pageIndex}/${pageMax}页`);
          
          const res = await axios.post(
            `${this.lingXingUtils.lx_crawler_host}/sc/restocking-center/amazon/analysis/list`,
            body,
            { headers, timeout: 30000 }
          );
  
          const batchDataObj = res.data?.data || {};
          return Array.isArray(batchDataObj.list) ? batchDataObj.list : [];
        });
  
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(res => {
          allResults.push(...res);
        });
      }
  
      console.log(`补货数据抓取完成，共${allResults.length}条`);
      return allResults;
    } catch (error) {
      console.error('获取补货数据失败：', error);
      return [];
    }
  }

  /**
   * 解析补货数据（含FBA详情）
   */
  private async requestLingXingRestockingDataByOpenApi(): Promise<Array<Record<string, any>>> {
    try {
      const { sidList, sellerMap } = await this.lingXingUtils.getOpenApiSellerContext();
      if (sidList.length === 0) {
        console.warn("[LingXing OpenAPI Restocking] No seller sid found.");
        return [];
      }

      const PAGE_SIZE = 50;
      const API_PATH = "/erp/sc/routing/restocking/analysis/getSummaryList";
      const extractRows = (result: any): Array<Record<string, any>> => {
        if (Array.isArray(result)) return result;
        if (Array.isArray(result?.data)) return result.data;
        if (Array.isArray(result?.list)) return result.list;
        if (Array.isArray(result?.data?.list)) return result.data.list;
        return [];
      };
      const extractTotal = (result: any, fallback: number) => {
        const total = Number(result?.total ?? result?.data?.total ?? result?.count ?? result?.data?.count ?? fallback);
        return Number.isFinite(total) ? total : fallback;
      };
      const isSuccess = (result: any) =>
        !result || result.code === undefined || Number(result.code) === 0 || Number(result.code) === 200;

      const firstBody = {
        sid_list: sidList,
        data_type: 1,
        mode: 1,
        offset: 0,
        length: PAGE_SIZE,
      };
      const firstResult: any = await this.lingXingUtils.httpPost(API_PATH, firstBody, true);
      if (!isSuccess(firstResult)) {
        throw new Error(`[LingXing OpenAPI Restocking] First request failed: ${JSON.stringify(firstResult)}`);
      }

      const firstRows = extractRows(firstResult);
      const total = extractTotal(firstResult, firstRows.length);
      const pageMax = Math.ceil(total / PAGE_SIZE);
      const allResults: Array<Record<string, any>> = [...firstRows];

      console.log(`[LingXing OpenAPI Restocking] total=${total}, pages=${pageMax}`);
      for (let pageIndex = 2; pageIndex <= pageMax; pageIndex++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const body = {
          sid_list: sidList,
          data_type: 1,
          mode: 1,
          offset: (pageIndex - 1) * PAGE_SIZE,
          length: PAGE_SIZE,
        };
        console.log(`[LingXing OpenAPI Restocking] requesting page ${pageIndex}/${pageMax}`);
        const result: any = await this.lingXingUtils.httpPost(API_PATH, body, true);
        if (!isSuccess(result)) {
          throw new Error(`[LingXing OpenAPI Restocking] Page ${pageIndex} failed: ${JSON.stringify(result)}`);
        }
        allResults.push(...extractRows(result));
      }

      const normalized = allResults.map(item => normalizeLingxingRestockingOpenApiItem(item, sellerMap));
      console.log(`[LingXing OpenAPI Restocking] fetched=${normalized.length}`);
      return normalized;
    } catch (error) {
      console.error("[LingXing OpenAPI Restocking] Failed.", error);
      return [];
    }
  }

  private parseRestockingData(rawItem: Record<string, any>, traceId: string): AppAmzBsrRestockingCenterLingxingEntity {
    const entity = new AppAmzBsrRestockingCenterLingxingEntity();
    const now = dayjs().toDate();

    // 基础字段
    entity.uniKey = rawItem.basicInfo?.uniKey || '';
    entity.hashId = rawItem.basicInfo?.hashId || '';
    entity.versionId = rawItem.basicInfo?.versionId || 0;
    entity.dataType = rawItem.basicInfo?.dataType || 0;
    entity.nodeType = rawItem.basicInfo?.nodeType || 0;
    entity.relationListing = rawItem.basicInfo?.relationListing || [];
    entity.syncTime = rawItem.basicInfo?.syncTime || '';
    entity.syncStatus = rawItem.basicInfo?.syncStatus || 0;
    entity.hashVersionList = rawItem.basicInfo?.hashVersionList || [];

    // 展示字段
    entity.asin = rawItem.displayInfo?.asin || '';
    entity.asinUrl = rawItem.displayInfo?.asinUrl || '';
    entity.itemName = rawItem.displayInfo?.itemName || '';
    entity.smallImageUrl = rawItem.displayInfo?.smallImageUrl || '';
    entity.asinList = rawItem.displayInfo?.asinList || [];
    entity.parentAsinList = rawItem.displayInfo?.parentAsinList || [];
    entity.productList = rawItem.displayInfo?.productList || [];
    entity.brandList = rawItem.displayInfo?.brandList || [];
    entity.categoryList = rawItem.displayInfo?.categoryList || [];
    entity.storeList = rawItem.displayInfo?.storeList || [];
    entity.marketplaceList = rawItem.displayInfo?.marketplaceList || [];
    entity.listingOpenTimeList = rawItem.displayInfo?.listingOpenTimeList || [];
    entity.listingPrincipal = rawItem.displayInfo?.listingPrincipal || [];
    entity.tagList = rawItem.displayInfo?.tagList || [];
    entity.daysPurchase = rawItem.displayInfo?.daysPurchase || 0;
    entity.fbaAgedInfo = rawItem.displayInfo?.fbaAgedInfo || {};
    entity.listingPriceList = rawItem.displayInfo?.listingPriceList || [];
    entity.listingPriceDownload = rawItem.displayInfo?.listingPriceDownload || '';
    entity.localAgedInfo = rawItem.displayInfo?.localAgedInfo || {};
    entity.daysOfSupplyInfo = rawItem.displayInfo?.daysOfSupplyInfo || {};
    entity.returnsReport = rawItem.displayInfo?.returnsReport || {};

    // 库存字段
    entity.amazonQuantityInfo = rawItem.amazonQuantityInfo || {};
    entity.scmQuantityInfo = rawItem.scmQuantityInfo || {};
    entity.stockQuantityInfo = rawItem.stockQuantityInfo || {};

    // 业务字段
    entity.salesInfo = rawItem.salesInfo || {};
    entity.suggestInfo = rawItem.suggestInfo || {};
    entity.extInfo = rawItem.extInfo || {};
    entity.itemList = rawItem.itemList || [];
    entity.traceId = traceId;

    // FBA详情字段
    entity.fbaValidList = rawItem.fbaValidList || [];
    entity.fbaShippingList = rawItem.fbaShippingList || [];

    // 时间字段
    entity.createTime = now;
    entity.updateTime = now;

    return entity;
  }

  /**
   * 同步补货数据
   */
  async syncRestockingData(queryRunner: QueryRunner, traceId: string): Promise<number> {
    // 1. 获取全量原始补货数据
    let rawList = await this.requestLingXingRestockingData();
    if (rawList.length === 0) {
      console.warn("补货原始数据为空，跳过同步");
      return 0;
    }

    // 处理 itemList 数据展开（支持组合数据）
    const expandedList: Array<Record<string, any>> = [];
    for (const item of rawList) {
      if (item.itemList && Array.isArray(item.itemList) && item.itemList.length > 0) {
        // 如果itemList有数据，说明是组合数据，直接使用内部的itemList
        expandedList.push(...item.itemList);
      } else {
        // 否则是一条正常数据
        expandedList.push(item);
      }
    }
    // 使用展开后的数据列表
    rawList = expandedList;
    console.log(`展开后补货数据共${rawList.length}条`);
  
    // ========== 先处理FBA详情 ==========
    console.log("开始获取FBA详情...");
    // 2. 批量获取FBA详情
    const fbaList = await this.lingXingUtils.batchGetFbaDetails(rawList);
    if (fbaList.length === 0) {
      console.warn("FBA详情获取后无有效数据，跳过保存");
      return 0;
    }
  
    // 3. 清空旧数据（全量覆盖）
    await queryRunner.manager.clear(AppAmzBsrRestockingCenterLingxingEntity);
  
    // 4. 解析包含FBA详情的完整数据并一次性保存
    const fullEntityList = fbaList.map(item => {
      const entity = this.parseRestockingData(item, traceId);
      entity.uniKey = item.basicInfo?.uniKey || entity.uniKey;
      entity.fbaValidList = item.fbaValidList || [];
      entity.fbaShippingList = item.fbaShippingList || [];
      return entity;
    });
  
    // 5. 一次性保存所有数据
    const savedList = await queryRunner.manager.save(fullEntityList);
    console.log(`已一次性保存${savedList.length}条包含FBA详情的补货数据`);
  
    return savedList.length;
  }

  async syncRealtimeSales(): Promise<number> {
    // Modified at 2026-01-23: Refactored to aggregate sales from all countries correctly
    // 1. Get all sellers without country filter to support all shops
    const allSellers = await this.sellerRepo.find({
      select: ["sid", "country"],
    });

    console.log(`[DEBUG] 数据库查找到店铺总数: ${allSellers.length}`);

    if (allSellers.length === 0) return 0;

    // 2. Prepare SIDs grouped by country for granular querying (kept for structure)
    // AND prepare a global list of all SIDs to send in every request
    const sidsByCountry = new Map<string, number[]>();
    const targetCountries = new Set<string>();
    const allSidList: number[] = [];

    allSellers.forEach((s) => {
        if (s.country) {
            targetCountries.add(s.country);
            if (!sidsByCountry.has(s.country)) {
                sidsByCountry.set(s.country, []);
            }
            const sid = Number(s.sid);
            if (!Number.isNaN(sid) && sid > 0) {
                sidsByCountry.get(s.country)!.push(sid);
                // Collect unique SIDs
                if (!allSidList.includes(sid)) {
                    allSidList.push(sid);
                }
            }
        }
    });

    // 3. Global Map to store sales volume: ASIN -> Country -> Volume
    // This allows us to sum up volumes correctly for multi-country records later
    const globalSalesData = new Map<string, Map<string, number>>();

    // 4. Loop through each country to collect sales data
    for (const country of targetCountries) {
      try {
        // Even if we have country-specific SIDs, we want to query ALL stores
        // because sometimes the country mapping in DB is not perfect, or we want cross-country data.
        // But we still need to loop by country to get the ASIN list for that country.
        
        // 获取该国家的ASIN列表
        const asinRows = await this.listingLingxingRepo
          .createQueryBuilder("l")
          .select("DISTINCT l.asin", "asin")
          .where("l.marketplace = :country", { country })
          .andWhere("l.afn_fulfillable_quantity > 0")
          .andWhere("l.asin IS NOT NULL")
          .andWhere("l.asin <> ''")
          .getRawMany();

        const asinList: string[] = asinRows
          .map((r: any) => r.asin)
          .filter((v) => v && String(v).trim().length > 0);

        if (asinList.length === 0) continue;

          
        const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
          '英国': 'Europe/London',
          '德国': 'Europe/Berlin', '法国': 'Europe/Paris',
          '西班牙': 'Europe/Madrid', '意大利': 'Europe/Rome',
          '荷兰': 'Europe/Amsterdam', '瑞典': 'Europe/Stockholm',
          '土耳其': 'Europe/Istanbul', '波兰': 'Europe/Warsaw',
          '比利时': 'Europe/Brussels', '爱尔兰': 'Europe/Dublin',
          '埃及': 'Africa/Cairo', '美国': 'America/New_York',
          '加拿大': 'America/Toronto', '墨西哥': 'America/Mexico_City',
          '巴西': 'America/Sao_Paulo', '日本': 'Asia/Tokyo',
          '印度': 'Asia/Kolkata', '澳大利亚': 'Australia/Sydney',
          '新加坡': 'Asia/Singapore', '阿联酋': 'Asia/Dubai',
          '沙特阿拉伯': 'Asia/Riyadh',
        };

        const tz = COUNTRY_TIMEZONE_MAP[country];
        const today = tz ? dayjs().tz(tz).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");


        const chunkSize = 50;

        for (let i = 0; i < asinList.length; i += chunkSize) {
          const chunk = asinList.slice(i, i + chunkSize);
          
          // Initialise map entries for this chunk (to ensure we track them even if 0 sales)
          chunk.forEach(asin => {
              const key = String(asin).trim();
              if (key) {
                  if (!globalSalesData.has(key)) {
                      globalSalesData.set(key, new Map());
                  }
                  // Initialize this country with 0 if not present
                  if (!globalSalesData.get(key)!.has(country)) {
                      globalSalesData.get(key)!.set(country, 0);
                  }
              }
          });

          await new Promise((resolve) => setTimeout(resolve, 11000));

          const body: any = {
            offset: 0,
            length: chunk.length,
            sort_field: "volume",
            sort_type: "desc",
            search_field: "asin",
            search_value: chunk,
            sid: allSidList, // PASS ALL SIDS to ensure we get data from all shops
            start_date: today,
            end_date: today,
            extend_search: [
              {
                field: "volume",
                from_value: "0",
                to_value: "999999",
                exp: "range",
              },
            ],
            summary_field: "asin",
            currency_code: "CNY",
            is_recently_enum: true,
            purchase_status: 0,
          };

          try {
            const resp = await this.lingXingUtils.httpPost(
              "/bd/productPerformance/openApi/asinList",
              body,
            );
            const raw: any = resp as any;

            const list = Array.isArray(raw?.data?.list)
              ? raw.data.list
              : Array.isArray(raw?.list)
              ? raw.list
              : [];

            if (!list.length) continue;

            for (const item of list as any[]) {
              const volume = Number((item as any).volume ?? (item as any).avg_volume ?? 0) || 0;
              const storeCountries = Array.isArray(item.seller_store_countries) ? item.seller_store_countries : [];

              const asinsArr = Array.isArray(item.asins)
                ? item.asins
                : (item.asin ? [{ asin: item.asin }] : []);

              for (const a of asinsArr) {
                const asin = a?.asin;
                if (!asin) continue;
                const key = String(asin).trim();
                if (!key) continue;

                if (!globalSalesData.has(key)) globalSalesData.set(key, new Map());
                
                const currentVol = globalSalesData.get(key)!.get(country) || 0;
                globalSalesData.get(key)!.set(country, currentVol + volume);
              }
            }
          } catch (error) {
            console.error(`同步实时销量：[${country}] 请求异常`, error);
          }
        }
      } catch (err) {
        console.error(`同步实时销量：处理国家 ${country} 时发生错误`, err);
      }
    }

    // 5. Batch Update Database
    // Now we have granular sales data (ASIN -> Country -> Volume)
    // We can update each DB record by summing up the sales for its specific countries.
    
    let totalUpdatedCount = 0;
    const allAsins = Array.from(globalSalesData.keys());
    
    if (allAsins.length === 0) return 0;

    const BATCH_SIZE = 500;
    for (let i = 0; i < allAsins.length; i += BATCH_SIZE) {
        const batchAsins = allAsins.slice(i, i + BATCH_SIZE);

        try {
            const records = await this.restockingCenterRepo.find({
                where: { asin: In(batchAsins) },
                select: ['id', 'asin', 'marketplaceList', 'storeList', 'relationListing', 'realtimeSales']
            });

            // 构建 ASIN → record 的映射，供 product_tag 同步使用
            const recordMap = new Map<string, typeof records[0]>();
            for (const record of records) {
                if (record.asin && !recordMap.has(record.asin)) {
                    recordMap.set(record.asin, record);
                }
            }

            // 1. 更新 restockingCenter 的 realtimeSales
            for (const record of records) {
                if (!record.marketplaceList || !Array.isArray(record.marketplaceList)) continue;

                let totalVolume = 0;
                const salesMap = globalSalesData.get(record.asin);

                if (salesMap) {
                    for (const market of record.marketplaceList) {
                        const marketStr = String(market).trim();
                        if (salesMap.has(marketStr)) {
                            totalVolume += salesMap.get(marketStr)!;
                        }
                    }
                }

                if (record.realtimeSales !== totalVolume) {
                    await this.restockingCenterRepo.update(record.id, { realtimeSales: totalVolume });
                    totalUpdatedCount++;
                }
            }

            // 2. 同步 real_time_sales 到 pricing_product_tag
            const existingTags = await this.productTagRepo.find({
                where: { asin: In(batchAsins) }
            });
            const tagMap = new Map<string, AppAmzPricingProductTagEntity>();
            for (const tag of existingTags) {
                const key = `${tag.asin}_${tag.marketplace}`;
                tagMap.set(key, tag);
            }

            const tagsToSave: AppAmzPricingProductTagEntity[] = [];
            const now = new Date();

            for (const [asin, countryMap] of globalSalesData) {
                if (!batchAsins.includes(asin)) continue;

                const record = recordMap.get(asin);

                for (const [marketplace, volume] of countryMap) {
                    const key = `${asin}_${marketplace}`;
                    let tag = tagMap.get(key);

                    if (!tag) {
                        // 新建 product_tag 行，尽量从 restockingCenter 补全字段
                        tag = new AppAmzPricingProductTagEntity();
                        tag.asin = asin;
                        tag.marketplace = marketplace;

                        if (record) {
                            if (record.storeList && record.storeList.length > 0) {
                                tag.seller_name = record.storeList[0];
                            }
                            if (record.relationListing && record.relationListing.length > 0) {
                                tag.msku = record.relationListing[0].msku || '';
                            }
                        }
                        if (!tag.msku) tag.msku = '';
                        if (!tag.seller_name) tag.seller_name = '';
                        tag.product_type = '';
                    }

                    if (tag.real_time_sales !== volume) {
                        tag.real_time_sales = volume;
                        tag.last_update_time = now;
                        tagsToSave.push(tag);
                    }
                }
            }

            if (tagsToSave.length > 0) {
                await this.productTagRepo.save(tagsToSave);
            }
        } catch (dbErr) {
            console.error(`同步实时销量：批量更新数据库异常`, dbErr);
        }
    }

    return totalUpdatedCount;
  }

  
  
  /**
   * 手动更新 FBA 货件
   * @param items 包含 shipment_id 和 sid 的数组
   */
  async updateFbaShipmentList(items: Array<{ shipment_id: string; sid: string }>) {
    if (!items || items.length === 0) return;
    await this.lingXingUtils.syncFbaShipmentList(items);
  }

  /**
   * 从数据库收集所有在途货件并更新（供定时任务调用）
   */
  async collectAndUpdateAllFbaShipments() {
    const records = await this.restockingCenterRepo.find();
    const itemsMap = new Map<string, { shipment_id: string; sid: string }>();

    for (const record of records) {
      const fbaShippingList = record.fbaShippingList;
      if (!Array.isArray(fbaShippingList) || fbaShippingList.length === 0) continue;

      let sid: string = '';
      if (Array.isArray(record.relationListing) && record.relationListing.length > 0) {
        sid = String(record.relationListing[0].storeId || '');
      }

      for (const fbaItem of fbaShippingList) {
        if (fbaItem.orderSn && sid) {
          itemsMap.set(fbaItem.orderSn, { shipment_id: fbaItem.orderSn, sid });
        }
      }
    }

    const items = Array.from(itemsMap.values());
    if (items.length === 0) {
      return { success: true, count: 0, message: '未找到在途货件' };
    }

    await this.lingXingUtils.syncFbaShipmentList(items);
    return { success: true, count: items.length, message: `成功更新 ${items.length} 个货件` };
  }

  /**
   * 根据 asin 和 marketplace 获取补货建议数据
   */
  async getByAsinAndMarketplace(asin: string, marketplace: string): Promise<AppAmzBsrRestockingCenterLingxingEntity | null> {
    if (!asin || !marketplace) return null;

    // 使用 QueryBuilder 进行复杂的 JSON 查询
    // marketplaceList 是 ["英国"] 这种格式
    const query = this.restockingCenterRepo.createQueryBuilder('restocking')
      .where("restocking.asin = :asin", { asin })
      .andWhere("JSON_CONTAINS(restocking.marketplaceList, :marketplace)", { 
        marketplace: JSON.stringify(marketplace) 
      });

    return await query.getOne();
  }

  async getByAsinAndMarketplaceBatch(items: Array<{ asin: string; marketplace: string; sellerName?: string }>): Promise<AppAmzBsrRestockingCenterLingxingEntity[]> {
    if (!Array.isArray(items) || items.length === 0) return [];

    const uniqueMap = new Map<string, { asin: string; marketplace: string; sellerName?: string }>();
    for (const it of items) {
      if (!it?.asin || !it?.marketplace) continue;
      const sellerName = it.sellerName || undefined;
      const key = `${it.asin}__${it.marketplace}__${sellerName || ''}`;
      uniqueMap.set(key, { asin: it.asin, marketplace: it.marketplace, sellerName });
    }

    const uniqueItems = Array.from(uniqueMap.values());
    if (uniqueItems.length === 0) return [];

    const query = this.restockingCenterRepo
      .createQueryBuilder('restocking')
      .where(
        new Brackets((qb) => {
          uniqueItems.forEach((it, idx) => {
            const asinKey = `asin${idx}`;
            const mpKey = `marketplace${idx}`;
            const conditions: string[] = [
              `restocking.asin = :${asinKey}`,
              `JSON_CONTAINS(restocking.marketplaceList, :${mpKey})`,
            ];
            const params: any = {
              [asinKey]: it.asin,
              [mpKey]: JSON.stringify(it.marketplace),
            };
            if (it.sellerName) {
              const storeKey = `store${idx}`;
              conditions.push(`JSON_CONTAINS(restocking.storeList, :${storeKey})`);
              params[storeKey] = JSON.stringify(it.sellerName);
            }
            
            const where = conditions.join(' AND ');
            if (idx === 0) qb.where(where, params);
            else qb.orWhere(where, params);
          });
        })
      );

    return await query.getMany();
  }

  async requestLingXingShipmentStatus(lingXingIds: number[]): Promise<void> {
    try {
      if (!Array.isArray(lingXingIds) || lingXingIds.length === 0) {
        console.warn('传入的lingXingIds为空，无需处理');
        return;
      }
  
      // ========== 步骤1：根据lingXingIds查询product_listing_lingxing表 ==========
      console.log(`开始查询app_amz_bsr_product_listing_lingxing表，lingXingIds: ${lingXingIds.join(',')}`);
      
      const listingEntities = await this.listingLingxingRepo.find({
        where: { id: In(lingXingIds) }, 
        select: ['marketplace', 'asin', 'product_code'] 
      });
  
      if (listingEntities.length === 0) {
        console.warn(`未在product_listing_lingxing表中找到lingXingIds: ${lingXingIds.join(',')}对应的记录`);
        return;
      }
  
      const targetCombination = new Set<string>();
      const queryConditions: Array<FindOptionsWhere<AppAmzBsrRestockingCenterLingxingEntity>> = [];
      
      for (const entity of listingEntities) {
        if (!entity.marketplace || !entity.asin) {
          console.warn(`listing记录缺少marketplace/asin：${JSON.stringify(entity)}`);
          continue;
        }
        
        const key = `${entity.marketplace}_${entity.asin}`;
        if (!targetCombination.has(key)) {
          targetCombination.add(key);
          
          queryConditions.push({
            asin: entity.asin,
            marketplaceList: Raw(
              (alias) => {
                return `JSON_CONTAINS(${alias}, '${JSON.stringify(entity.marketplace)}')`;
              }
            )
          });
        }
      }
  
      if (queryConditions.length === 0) {
        console.warn('无有效的marketplace+asin组合，无需查询restocking表');
        return;
      }
      console.log(`去重后需要处理的marketplace+asin组合数：${queryConditions.length}`);
  
      // ========== 步骤2：查询restocking_center_lingxing表 ==========
      console.log('开始查询app_amz_bsr_restocking_center_lingxing表');
      const restockingEntities = await this.restockingCenterRepo.find({
        where: queryConditions,
        select: ['id', 'asin', 'marketplaceList', 'fbaShippingList'] 
      });
  
      if (restockingEntities.length === 0) {
        console.warn('未在restocking_center_lingxing表中找到对应marketplace+asin的记录');
        return;
      }
  
      const orderSnList: string[] = [];
      const restockingMap = new Map<number, { 
        entity: AppAmzBsrRestockingCenterLingxingEntity;
        fbaList: FbaShippingItem[];
      }>();
  
      for (const entity of restockingEntities) {
        const fbaList = entity.fbaShippingList || [];
        
        if (!Array.isArray(fbaList)) {
          console.warn(`id=${entity.id}的fbaShippingList不是数组，跳过`);
          continue;
        }
  
        fbaList.forEach((item: FbaShippingItem) => {
          if (item.orderSn && !orderSnList.includes(item.orderSn)) {
            orderSnList.push(item.orderSn);
          }
        });
  
        restockingMap.set(entity.id, {
          entity,
          fbaList
        });
      }
  
      if (orderSnList.length === 0) {
        console.warn('fbaShippingList中无有效orderSn，无需调用接口');
        return;
      }
  
      // ========== 步骤3：调用领星接口，批量获取shipment_status ==========
      console.log(`开始调用领星接口，查询orderSn：${orderSnList.join(',')}`);
      const shipmentStatusMap = new Map<string, string>();
  
      for (const orderSn of orderSnList) {
        try {
          const response = await this.lingXingUtils.httpPost(
            '/erp/sc/routing/storage/shipment/getInboundShipmentList',
            {
              "search_field":"shipment_id",
              "search_value": orderSn,
              "offset": 0,
              "length": 20
            }
          );
  
          if (response.code !== 0 || !response.data || !Array.isArray(response.data.list)) {
            console.warn(`orderSn=${orderSn}接口返回异常：${JSON.stringify(response)}`);
            continue;
          }
  
          // 解析接口中的shipment_status
          const firstItem = response.data.list[0];
          if (!firstItem || !Array.isArray(firstItem.relate_list)) {
            console.warn(`orderSn=${orderSn}接口返回无relate_list数据`);
            continue;
          }
  
          // 取第一个relate_list的shipment_status
          const firstRelate = firstItem.relate_list[0];
          const rawStatus = firstRelate.shipment_status || firstItem.status_name || firstItem.status;
          const targetStatus = SHIPMENT_STATUS_MAP[rawStatus] || rawStatus || null;
          
          if (targetStatus) {
            shipmentStatusMap.set(orderSn, targetStatus);
            console.log(`orderSn=${orderSn} 映射后的status：${targetStatus}（原始值：${rawStatus}）`);
          } else {
            console.warn(`orderSn=${orderSn}无匹配的status映射，原始值：${rawStatus}`);
          }
        } catch (e) {
          console.error(`调用接口查询orderSn=${orderSn}失败：${e.message}`);
          continue;
        }
      }
  
      if (shipmentStatusMap.size === 0) {
        console.warn('接口未返回任何有效shipment_status，无需更新');
        return;
      }
  
      // ========== 步骤4：更新restocking表的fbaShippingList.shipment_status ==========
      console.log('开始更新restocking_center_lingxing表的fbaShippingList字段');
      const updatePromises: Promise<any>[] = [];
  
      for (const [id, { entity, fbaList }] of restockingMap) {
        // 遍历fbaList，更新匹配orderSn的shipment_status
        const updatedFbaList = fbaList.map((item: FbaShippingItem) => {
          if (item.orderSn && shipmentStatusMap.has(item.orderSn)) {
            return {
              ...item,
              shipment_status: shipmentStatusMap.get(item.orderSn) // 覆盖原有值
            };
          }
          return item;
        });
  
        const updateWhere: FindOptionsWhere<AppAmzBsrRestockingCenterLingxingEntity> = {
          id 
        };
  
        updatePromises.push(
          this.restockingCenterRepo.update(
            updateWhere,
            { fbaShippingList: updatedFbaList }
          )
        );
      }
  
      await Promise.all(updatePromises);
      console.log(`成功更新${updatePromises.length}条restocking_center_lingxing记录`);
  
    } catch (err) {
      console.error('处理领星货件状态失败：', err);
      throw new Error(`requestLingXingShipmentStatus失败：${err.message}`);
    }
  }

}
