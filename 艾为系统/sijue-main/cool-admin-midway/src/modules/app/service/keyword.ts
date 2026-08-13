import { Inject, Provide } from '@midwayjs/decorator';
import { Logger } from "@midwayjs/core";
import { InjectEntityModel } from '@midwayjs/typeorm';
import { ILogger } from "@midwayjs/logger";
import { BaseService } from '@cool-midway/core';
import { Brackets, IsNull, LessThan, Not, Repository } from 'typeorm';
import { AppAmzListingEntity } from "../entity/listing";
import { AppAmzListingKeywordEntity } from '../entity/keyword';
import { AppAmzListingService } from "./listing";
import { appConfig } from "../../../appConfig";
import { AppUtils } from "../utils/appUtils";
import { SellerSpriteUtils } from "../utils/sellerSpriteUtils";
import * as dayjs from "dayjs";
import { AbaResearchResultItem } from "../interface/aba-research-result-item";
import axios from 'axios';
import { ImageSimilarityTool } from './ImageSearchUtil';
import { AppAmzBsrCandidateEntity } from "../entity/bsr_candidate";
import { RateLimiter } from 'limiter';
import { OxylabsService } from './OxylabsService'; // 根据实际路径调整
import { log } from 'console';



@Provide()
export class AppAmzListingKeywordService extends BaseService {
  @InjectEntityModel(AppAmzListingKeywordEntity)
  amzListingKeywordRepo: Repository<AppAmzListingKeywordEntity>;



  @Inject()
  oxylabsService: OxylabsService;

  @Inject()
  imageSimilarityTool: ImageSimilarityTool;

  @InjectEntityModel(AppAmzBsrCandidateEntity)
  bsrCandidateRepo: Repository<AppAmzBsrCandidateEntity>;


  @InjectEntityModel(AppAmzListingEntity)
  amzListingRepo: Repository<AppAmzListingEntity>;

  @Inject()
  amzListingService: AppAmzListingService;

  @Inject()
  sellerSpriteUtils: SellerSpriteUtils;

  @Inject()
  appUtils: AppUtils;

  @Logger()
  logger: ILogger;

  async batchImport(
    sid: number,
    asin: string,
    seller_sku: string,
    keywords: string[],
    is_core: boolean,
    marketplaces: string,
    weight:number
  ) {
    for (const keywordValue of keywords) {
      let keywordEntity = await this.amzListingKeywordRepo.findOne({
        where: {
          sid,
          asin,
          seller_sku,
          value: keywordValue,
          marketplaces
        }
      });
      if (keywordEntity) {
        keywordEntity.value = keywordValue;
        if (is_core) {
          keywordEntity.is_core = true;
          keywordEntity.status = appConfig.KEYWORD_STATUS.LIBRARY.value;
        }
        await this.amzListingKeywordRepo.save(keywordEntity);
      } else {
        await this.amzListingKeywordRepo.insert({
          sid,
          asin,
          seller_sku,
          value: keywordValue,
          is_core,
          status:  3,
          marketplaces,
          weight,
        });
      }
    }

    return 'ok';
  }

  async getCoreKeywords(
    sid: number,
    asin: string,
    seller_sku: string,
    withSearchVolumeData: boolean = false
  ) {
    let whereOptions = {
      sid,
      asin,
      seller_sku,
      is_core: true,
      status: appConfig.KEYWORD_STATUS.LIBRARY.value,
    };
    if (withSearchVolumeData) {
      Object.assign(whereOptions, {
        search_volume_data: Not(IsNull()),
      });
    }

    return await this.amzListingKeywordRepo.find({
      where: whereOptions
    });
  }

  async getPendingKeywords(
    additional_where_options: object = {},
    limit: number = 30,
  ): Promise<AppAmzListingKeywordEntity[]> {
    let whereOptions = additional_where_options;
    Object.assign(whereOptions, {
      status: appConfig.KEYWORD_STATUS.PENDING.value,
    });

    return await this.amzListingKeywordRepo
      .createQueryBuilder('keyword')
      .select('*')
      .where(whereOptions)
      .limit(limit)
      .execute();
  }

  async getKeywordsToUpdateMonthlySearchVolume(
    limit: number = 50,
  ): Promise<AppAmzListingKeywordEntity[]> {
    return await this.amzListingKeywordRepo
      .createQueryBuilder('keyword')
      .select('*')
      .where({ search_volume_monthly: IsNull() })
      .orWhere({ search_volume_monthly_update_time: IsNull() })
      .orWhere({ search_volume_monthly_update_time: LessThan(dayjs().subtract(1, 'month').toDate()) })
      .orderBy('RAND()')
      .limit(limit)
      .execute();
  }

  async getKeywordsBy(
    additional_where_options: object = {},
  ): Promise<AppAmzListingKeywordEntity[]> {
    let whereOptions = additional_where_options;
    return await this.amzListingKeywordRepo
      .createQueryBuilder('keyword')
      .select('*')
      .where(whereOptions)
      .execute();
  }

  async fetchKeywordSearchVolumes() {
    try {
      let listing: AppAmzListingEntity;
      let keywordEntities: AppAmzListingKeywordEntity[] = [];

      listing = await this.amzListingService.getOneListingRequiringKeywordSearchVolumesUpdate();
      if (!listing) return;

      console.group(`正在获取 listing 的已入库核心关键词搜索量数据：${JSON.stringify({
        id: listing.id,
        sid: listing.sid,
        asin: listing.asin,
        seller_sku: listing.seller_sku,
      })}`);

      keywordEntities = await this.getCoreKeywords(listing.sid, listing.asin, listing.seller_sku);

      if (!keywordEntities.length) return;

      let fetch12thWeekDataOnly: Boolean = keywordEntities.every(keyword => {
        if (Array.isArray(keyword.search_volume_data)) {
          let has12weekData = keyword.search_volume_data.length === 12;
          let updatedSuccessfullyLastTime =
            keyword.search_volume_data[0].date === this.appUtils.getNextSaturday(dayjs()
              .subtract(1, 'year')
              .subtract(2, 'weeks')
            );
          return has12weekData && updatedSuccessfullyLastTime;
        } else {
          return false;
        }
      });

      if (!fetch12thWeekDataOnly) {
        keywordEntities.forEach((k) => {
          k.search_volume_data = [];
        });

        let nextSaturdayDate = this.appUtils.getNextSaturday(dayjs()
          .subtract(1, 'year')
          .subtract(2, 'week')
        );
        for (let i = 0; i < 12; i++) {
          let aba_search_result = await this.sellerSpriteUtils.httpPost('/v1/aba/research', {
            marketplace: this.appUtils.marketplaceZhToEnCode(listing.marketplace),
            reverseType: 'W', date: nextSaturdayDate,
            page: 1,
            size: keywordEntities.length,
            keywordList: keywordEntities.map(k => k.value.toLowerCase()),
          });

          if (!Array.isArray(aba_search_result?.data?.items)) {
            console.log('关键词搜索量数据查询失败，请检查 API 接口情况。');
            console.log(aba_search_result);
            return false;
          } else {
            let items: AbaResearchResultItem[] = aba_search_result.data.items;
            items.forEach(item => void console.log(`${item.keyword} | ${item.searches}`));

            let result_list_of_keyword = items.map(item => item.keyword);
            keywordEntities.forEach(k => {
              let index = result_list_of_keyword.indexOf(k.value.toLowerCase());
              k.search_volume_data.push({
                date: nextSaturdayDate,
                searches: index >= 0 ? items[index].searches : -1,
              });
            });
          }

          nextSaturdayDate = this.appUtils.getNextSaturday(nextSaturdayDate);
        }
      } else {
        console.log(`当前 Listing 关键词搜索量数据满足仅滚动更新第 12 周的搜索量的条件`);

        let saturdayDateOf12WeekLater = this.appUtils.getNextSaturday(dayjs()
          .subtract(1, 'year')
          .add(10, 'weeks')
        );

        let aba_search_result = await this.sellerSpriteUtils.httpPost('/v1/aba/research', {
          marketplace: this.appUtils.marketplaceZhToEnCode(listing.marketplace),
          reverseType: 'W', date: saturdayDateOf12WeekLater,
          page: 1,
          size: keywordEntities.length,
          keywordList: keywordEntities.map(k => k.value.toLowerCase()),
        });

        if (!Array.isArray(aba_search_result?.data?.items)) {
          console.log('关键词搜索量数据查询失败，请检查 API 接口情况。');
          console.log(aba_search_result);
          return false;
        } else {
          let items: AbaResearchResultItem[] = aba_search_result.data.items;
          items.forEach(item => void console.log(`${item.keyword} | ${item.searches}`));

          let result_list_of_keyword = items.map(item => item.keyword);
          keywordEntities.forEach(k => {
            k.search_volume_data.shift();
            let index = result_list_of_keyword.indexOf(k.value.toLowerCase());
            k.search_volume_data.push({
              date: saturdayDateOf12WeekLater,
              searches: index >= 0 ? items[index].searches : -1,
            });
          });
        }
      }

      await this.amzListingKeywordRepo.save(keywordEntities);
      Object.assign(listing, {
        kw_search_volume_status: appConfig.LISTING_KEYWORD_ANAL_STATUS.PENDING.value,
        kw_search_volume_update_time: new Date(),
      });
      await this.amzListingRepo.save(listing);

      console.log('查询完成');
    } catch (err) {
      console.log(err);
    } finally {
      console.groupEnd();
    }
  }

  async fetchPendingKeywordsSearchVolumes() {
    try {
      let keywordEntities = await this.getPendingKeywords({
        search_volume_monthly: IsNull(),
      });

      if (!keywordEntities.length) return;

      console.group(`正在获取待入库关键词月搜索量数据`);
      keywordEntities.forEach(keyword => {
        console.log(keyword.sid, keyword.asin, keyword.seller_sku, keyword.value);
      });

      let aba_search_result = await this.sellerSpriteUtils.httpPost('/v1/aba/research', {
        marketplace: 'UK', reverseType: 'M', date: dayjs().subtract(1, 'year').format('YYYYMM'), page: 1,
        size: keywordEntities.length,
        keywordList: keywordEntities.map(k => k.value.toLowerCase()),
      });
      if (!Array.isArray(aba_search_result?.data?.items)) {
        console.log('关键词搜索量数据查询失败，请检查 API 接口情况。');
        console.log(aba_search_result);
        return false;
      } else {
        let items: AbaResearchResultItem[] = aba_search_result.data.items;
        items.forEach(item => void console.log(`${item.keyword} | ${item.searches}`));
        let result_list_of_keyword = items.map(item => item.keyword);
        keywordEntities.forEach(keyword => {
          let index = result_list_of_keyword.indexOf(keyword.value.toLowerCase());
          keyword.search_volume_monthly = index >= 0 ? items[index].searches : -1;
        });
      }

      await this.amzListingKeywordRepo.save(keywordEntities);

      console.log('查询完成');
    } catch (err) {
      console.log(err);
    } finally {
      console.groupEnd();
    }
  }

  async fetchKeywordsMonthlySearchVolume() {
    try {
      let listing = await this.amzListingService.getOneListingRequiringMonthlyKeywordSearchVolumesUpdate();
      if (!listing) return;

      let keywordEntities = await this.amzListingKeywordRepo.find({
        where: {
          sid: listing.sid,
          asin: listing.asin,
          seller_sku: listing.seller_sku,
        }
      });
      if (!keywordEntities.length) return;

      console.group(`正在查询来自该 Listing 的关键词的月搜索量：${JSON.stringify({
        sid: listing.sid,
        asin: listing.asin,
        seller_sku: listing.seller_sku,
      })}`);
      console.log(`共 ${keywordEntities.length} 个关键词`);

      let keyword_entities_batches = [];
      let batch_size = 50;
      for (let i = 0; i < Math.ceil(keywordEntities.length / batch_size); i++) {
        keyword_entities_batches.push(keywordEntities.slice(
          batch_size * i,
          batch_size * (i + 1)
        ));
      }

      let result_items: AbaResearchResultItem[] = [];
      for (let i = 0; i < keyword_entities_batches.length; i++) {
        console.log(`正在查询第 ${i + 1} 批...`);
        let batch = keyword_entities_batches[i];

        let aba_search_result = await this.sellerSpriteUtils.httpPost('/v1/aba/research', {
          marketplace: appConfig.normalize_marketplace_code(listing?.marketplace),
          reverseType: 'M', page: 1,
          size: batch.length,
          keywordList: batch.map(k => k.value.toLowerCase()),
        });

        if (!Array.isArray(aba_search_result?.data?.items)) {
          console.log('关键词搜索量数据查询失败，请检查 API 接口情况。');
          console.log(aba_search_result);
          return false;
        } else {
          let items: AbaResearchResultItem[] = aba_search_result.data.items;
          items.forEach(item => void console.log(`${item.keyword} | ${item.searches}`));
          result_items = result_items.concat(items);
        }
      }

      let result_list_of_keyword = result_items.map(item => item.keyword);
      keywordEntities.forEach(keyword => {
        let index = result_list_of_keyword.indexOf(keyword.value.toLowerCase());
        keyword.search_volume_monthly = index >= 0 ? result_items[index].searches : -1;
        keyword.search_volume_monthly_update_time = new Date();
      });

      await this.amzListingKeywordRepo.save(keywordEntities);

      console.log('查询完成');
    } catch (err) {
      console.log(err);
    } finally {
      console.groupEnd();
    }
  }

  async getKeywordTodoTotalCount(additional_where_options: object = {}) {
    let whereOptions = additional_where_options;
    Object.assign(whereOptions, { status: appConfig.KEYWORD_STATUS.PENDING.value });
    return await this.amzListingKeywordRepo.count({ where: whereOptions });
  }

  async batchDuplicateToListings(
    keywords: AppAmzListingKeywordEntity[],
    listings: AppAmzListingEntity[],
  ) {

    for (const listing of listings) {
      try {
        let associated_keywords = await this.amzListingKeywordRepo.find({
          where: {
            sid: listing.sid,
            asin: listing.asin,
            seller_sku: listing.seller_sku,
          }
        });

        for (const keywordToBeDuplicated of keywords) {
          let is_exist = false;
          for (const keywordAssociated of associated_keywords) {

            if (keywordAssociated.value.toLowerCase() === keywordToBeDuplicated.value.toLowerCase()) {
              let origin_props = {
                id: keywordAssociated.id,
                sid: keywordAssociated.sid,
                asin: keywordAssociated.asin,
                seller_sku: keywordAssociated.seller_sku,
              }
              Object.assign(keywordAssociated, keywordToBeDuplicated);
              Object.assign(keywordAssociated, origin_props);
              await this.amzListingKeywordRepo.save(keywordAssociated);
              is_exist = true;
              break;
            }
          }

          if (!is_exist) {
            Object.assign(keywordToBeDuplicated, {
              sid: listing.sid,
              asin: listing.asin,
              seller_sku: listing.seller_sku,
            });
            delete keywordToBeDuplicated.id;
            await this.amzListingKeywordRepo.insert(keywordToBeDuplicated);
          }
        }
      } catch (err) {
        console.log(err);
      }
    }
  }

  async batchUpdateStatusLibrary(keywords: AppAmzListingKeywordEntity[]) {
    for (const keyword of keywords) {

      try {
        keyword.status = appConfig.KEYWORD_STATUS.LIBRARY.value;
        await this.amzListingKeywordRepo.save(keyword);

        let custom_listing: AppAmzListingEntity = await this.amzListingRepo.findOne({
          where: {
            sid: keyword.sid,
            asin: keyword.asin,
            seller_sku: keyword.seller_sku,
            is_custom_listing: 1,
          },
        });

        if (custom_listing) {

          if (custom_listing.local_sku === null || String(custom_listing.local_sku).trim() === '') {
            break;
          }

          let equivalent_listings: AppAmzListingEntity[] = await this.amzListingRepo.find({
            where: {
              local_sku: custom_listing.local_sku,
              is_custom_listing: 0,
              status: 1,
              is_delete: 0,
            },
          });

          await this.batchDuplicateToListings([keyword], equivalent_listings);
        }
      } catch (err) {
        console.log(err);
      }
    }
  }

  async countByCountry(asin: string): Promise<Record<string, number>> {
    // 首先初始化所有国家的计数器为0
    const countryCounts: Record<string, number> = {
      '美国': 0,
      '英国': 0,
      '德国': 0,
      '法国': 0,
      '意大利': 0,
      '西班牙': 0
    };

    try {
      // 使用 TypeORM 查询构建器进行分组统计
      const results = await this.amzListingKeywordRepo
        .createQueryBuilder('keyword')
        .select('keyword.marketplaces', 'country')
        .addSelect('COUNT(keyword.id)', 'count')
        .where('keyword.asin = :asin', { asin })
        .andWhere('keyword.status = :status', { status: appConfig.KEYWORD_STATUS.LIBRARY.value })
        .andWhere('keyword.marketplaces IN (:...countries)', {
          countries: Object.keys(countryCounts)
        })
        .groupBy('keyword.marketplaces')
        .getRawMany();

      // 将结果填充到计数器中
      results.forEach(result => {
        if (result.country && countryCounts.hasOwnProperty(result.country)) {
          countryCounts[result.country] = parseInt(result.count, 10) || 0;
        }
      });

      return countryCounts;
    } catch (error) {
      this.logger.error('统计国家关键词数量失败:', error);
      return countryCounts; // 返回初始化的0值
    }
  }

  async add2(param: any | any[]): Promise<void> {
    const items = Array.isArray(param) ? param : [param];

    // 1. 分类需要计算和不需要计算的关键词
    const classifiedProducts = new Map<string, boolean>();
    items.forEach(item => {
      const productKey = `${item.asin}-${item.marketplaces}`;
      if (item.keyword_type && item.keyword_type.trim() !== '') {
        classifiedProducts.set(productKey, true);
      }
    });

    const itemsToCalculate = items.filter(item => {
      const productKey = `${item.asin}-${item.marketplaces}`;
      return !(
        (item.keyword_type && item.key_type.trim() !== '') ||
        classifiedProducts.get(productKey) === true
      );
    });

    // 筛选：每个国家 trafficPercentage 前30的关键词才进行计算
    const filteredItemsToCalculate: any[] = [];
    const itemsByCountry: Record<string, any[]> = {};

    // 按国家分组
    for (const item of itemsToCalculate) {
      const country = item.marketplaces || 'unknown';
      if (!itemsByCountry[country]) {
        itemsByCountry[country] = [];
      }
      itemsByCountry[country].push(item);
    }

    // 每个国家取前30
    for (const country in itemsByCountry) {
      const countryItems = itemsByCountry[country];
      // 按 trafficPercentage 降序排序
      countryItems.sort((a, b) => {
        const tpA = parseFloat(a.trafficPercentage) || 0;
        const tpB = parseFloat(b.trafficPercentage) || 0;
        return tpB - tpA;
      });
      
      // 取前30
      filteredItemsToCalculate.push(...countryItems.slice(0, 30));
    }

    // 2. 批量计算需要处理的关键词
    if (filteredItemsToCalculate.length > 0) {
      await this.batchCalculateScore2(filteredItemsToCalculate);
    }
    await this.upsertKeywords(items);
  }
  

  private async upsertKeywords(keywords: AppAmzListingKeywordEntity[]) {
    // 收集所有关键词的唯一标识
    const identifiers = keywords.map(k => ({
      value: k.value,
      asin: k.asin,
      marketplaces: k.marketplaces
    }));

    // 批量查询已存在的记录
    let existingKeywords: AppAmzListingKeywordEntity[] = [];
 
    if (identifiers.length > 0) {
      // 手动构建元组条件
      const conditionStrings = identifiers.map(id =>
        `(value = '${id.value}' AND asin = '${id.asin}' AND marketplaces = '${id.marketplaces}')`
      ).join(' OR ');

      existingKeywords = await this.amzListingKeywordRepo
        .createQueryBuilder('keyword')
        .where(conditionStrings)
        .getMany();
    }

    // 构建存在记录的Map
    const existingMap = new Map<string, AppAmzListingKeywordEntity>();
    existingKeywords.forEach(k => {
      existingMap.set(`${k.value}-${k.asin}-${k.marketplaces}`, k);
    });

    // 准备批量保存的数组
    const toSave: AppAmzListingKeywordEntity[] = [];

    for (const keyword of keywords) {
      const key = `${keyword.value}-${keyword.asin}-${keyword.marketplaces}`;
      const existing = existingMap.get(key);

      if (existing) {
        // 更新已存在记录
        if (keyword.score1 !== undefined) existing.score1 = keyword.score1 * 10;
        if (keyword.score2 !== undefined) existing.score2 = keyword.score2;
        if (keyword.score1 !== undefined && keyword.score2 !== undefined) existing.weight = keyword.score2 + (keyword.score1 * 10);
        if (keyword.score_time) existing.score_time = keyword.score_time;
        if (keyword.keyword_type) existing.keyword_type = keyword.keyword_type;
        existing.search_volume_data = keyword.search_volume_data;
        existing.search_volume_monthly = keyword.search_volume_monthly;
        existing.search_volume_monthly_update_time = keyword.search_volume_monthly_update_time;
        existing.trafficPercentage = keyword.trafficPercentage;
        toSave.push(existing);
      } else {
        // 添加新记录
        toSave.push(keyword);
      }
    }

    // 批量保存
    if (toSave.length > 0) {
      await this.amzListingKeywordRepo.save(toSave);
    }
  }
  
  private async batchCalculateScore2(items: AppAmzListingKeywordEntity[]) {
    const countryGroups = this.groupKeywordsByCountry(items);

    for (const [country, keywords] of Object.entries(countryGroups)) {
      try {
        // 计算所有关键词的得分
        for (const keyword of keywords) {
          if (!keyword.title) {
            this.logger.warn(`关键词 ${keyword.value} 缺少标题，跳过计算`);
            keyword.score2 = 0;
            keyword.score1 = 0;
            keyword.score_time = new Date();
            continue;
          }

          const candidateKeywords = this.processTitleToKeywords(keyword.title);
          await this.calculateScoreForKeyword(keyword, candidateKeywords);
        }

        // 按新规则处理关键词类型分配
        // 1. 过滤掉score2 < 2的关键词
        const validKeywords = keywords.filter(k => k.score2 >= 2);
        
        // 2. 按总分排序（score2 + score1 * 10）
        const sortedKeywords = validKeywords
          .map(keyword => ({
            keyword,
            totalScore: keyword.score2 + (keyword.score1 * 10),
            score1: keyword.score1 || 0,
            score2: keyword.score2 || 0
          }))
          .sort((a, b) => b.totalScore - a.totalScore);

        // 3. 分配关键词类型
        const updatedKeywords = this.assignKeywordTypes(sortedKeywords);
        
        // 保存更新后的关键词
        await this.upsertKeywords(updatedKeywords.map(item => item.keyword));

      } catch (error) {
        this.logger.error(`计算 ${country} 关键词的 score2 失败:`, error);
        keywords.forEach(k => {
          k.score2 = 0;
          k.score_time = new Date();
        });
      }
    }
  }

  /**
   * 根据新规则分配关键词类型
   */
  private assignKeywordTypes(scoredKeywords: Array<{
    keyword: AppAmzListingKeywordEntity,
    totalScore: number,
    score1: number,
    score2: number
  }>): Array<{
    keyword: AppAmzListingKeywordEntity,
    totalScore: number,
    score1: number,
    score2: number
  }> {
    // 1. 筛选出score1 > 6.8的关键词并排序
    const highScore1Keywords = scoredKeywords
      .filter(item => item.score1 >= 6.8)
      .sort((a, b) => b.score1 - a.score1);
    
    let allSelected: Array<{
      keyword: AppAmzListingKeywordEntity,
      totalScore: number,
      score1: number,
      score2: number
    }> = [];

    if (highScore1Keywords.length === 0) {
      // 当没有score1 > 6.8的关键词时，从所有validKeywords中按totalScore排序分配
      const sortedByTotalScore = [...scoredKeywords]
        .sort((a, b) => b.totalScore - a.totalScore);
      
      // 分配1个core_major，2个core，其余long_tail，总数不超过100
      sortedByTotalScore.forEach((item, index) => {
        if (index >= 30) return; // 总数不超过30
        
        if (index === 0) {
          item.keyword.keyword_type = "core_major";
        } else if (index <= 2) { // 第2、3位
          item.keyword.keyword_type = "core";
        } else {
          item.keyword.keyword_type = "long_tail";
        }
        allSelected.push(item);
      });
    } else {
      // 原逻辑：处理highScore1Keywords
      highScore1Keywords.forEach((item, index) => {
        if (index === 0) {
          item.keyword.keyword_type = "core_major";
        } else if (index <= 2) { // 第2、3位
          item.keyword.keyword_type = "core";
        } else {
          item.keyword.keyword_type = "long_tail";
        }
      });
      
      // 剩余的关键词（score1 <= 6.8）按weight排序
      const remainingKeywords = scoredKeywords
        .filter(item => item.score1 < 6.8)
        .sort((a, b) => b.totalScore - a.totalScore);
      
      // 计算还能从剩余关键词中选择多少个（总数不超过100）
      const remainingSlots = Math.max(0, 100 - highScore1Keywords.length);
      
      // 从剩余关键词中选择，分配为长尾词
      const selectedRemaining = remainingKeywords.slice(0, remainingSlots);
      selectedRemaining.forEach(item => {
        item.keyword.keyword_type = "long_tail";
      });
      
      allSelected = [...highScore1Keywords, ...selectedRemaining].slice(0, 100);
    }

    // 未被选中的关键词清除类型
    scoredKeywords.forEach(item => {
      if (!allSelected.includes(item)) {
        item.keyword.keyword_type = null;
      }
    });
    
    return allSelected;
  }


  // 处理标题生成关键词列表
  private processTitleToKeywords(title: string): string[] {
    if (!title) return [];

    // 替换特殊字符
    let cleanedTitle = title
      .replace(/,/g, '')   // 移除逗号
      .replace(/&/g, '')   // 移除&符号
      .replace(/\./g, '')  // 移除句点
      .replace(/"/g, '')   // 移除双引号
      .replace(/\|/g, '')  // 移除竖线
      .replace(/\s+/g, ' '); // 压缩多个空格为一个

    // 取前7个单词，然后删除第一个单词，保留6个
    const words = cleanedTitle.split(' ').filter(word => word.length > 0);
    if (words.length > 7) {
      words.splice(0, 1); // 删除第一个单词
      return words.slice(0, 6);
    } else if (words.length > 1) {
      return words;
    } else {
      return [cleanedTitle];
    }
  }


  // 按国家分组关键词
  private groupKeywordsByCountry(items: AppAmzListingKeywordEntity[]): Record<string, AppAmzListingKeywordEntity[]> {
    return items.reduce((groups, item) => {
      const country = item.marketplaces;
      if (!groups[country]) groups[country] = [];
      groups[country].push(item);
      return groups;
    }, {});
  }
  // 批量获取选品关键词
  private async batchGetCandidateKeywords(
    asins: string[],
    marketplace: string
  ): Promise<Record<string, string[]>> {
    if (asins.length === 0) return {};

    const query = `
      SELECT 
        cand.asin AS asin,
        SUBSTRING_INDEX(
          TRIM(
            REPLACE(
              REPLACE(
                REPLACE(
                  REPLACE(
                    REPLACE(
                      REPLACE(
                        REPLACE(
                          REPLACE(
                            REPLACE(
                              REPLACE(
                                REPLACE(cand.item_name, ',', ''),  
                                '&', ''), 
                              '.', ''),                        
                            '"', ''),                         
                          '|', ''),                            
                        '  ', ' '),                         
                      '  ', ' '),                            
                    '  ', ' '),                           
                  '  ', ' '),                                  
              '  ', ' '),                                   
            '  ', ' ')                                     
          ),
          ' ',  
          6     
        ) AS keywords
      FROM app_amz_bsr_candidate cand
      WHERE 
        cand.asin IN (?)
        AND cand.marketplace = ?
    `;

    try {
      const results = await this.amzListingKeywordRepo.manager.query(query, [asins, marketplace]);
      return results.reduce((map, row) => {
        if (row.keywords) {
          const keywords = row.keywords.split(' ');
          map[row.asin] = keywords.map(k => this.normalizeText(k)).filter(k => k.length > 0);
        } else {
          map[row.asin] = [];
        }
        return map;
      }, {});
    } catch (error) {
      this.logger.error('批量获取候选关键词失败', error);
      // 返回空映射
      return asins.reduce((map, asin) => {
        map[asin] = [];
        return map;
      }, {});
    }
  }

  private imageRateLimiter = new RateLimiter({
    tokensPerInterval: 10,  // 每秒10个令牌
    interval: 'second'
  });

  private async calculateScoreForKeyword(
    keyword: AppAmzListingKeywordEntity,
    candidateKeywords: string[]
  ): Promise<void> {
    console.log(`开始计算关键词 ${keyword.value},${keyword.marketplaces},${candidateKeywords} 的 score2`);

    let results = [];
    let retryCount = 0;
    while (results.length < 15 && retryCount < 10) {
      results = await this.oxylabsService.searchAmazon(
        keyword.value,
        keyword.marketplaces,
        1,
        'keyword.calculateScoreForKeyword.searchAmazon',
      );

      if (results.length < 15) {
        retryCount++;
        console.log(`第${retryCount}次重试，因为只获取到${results.length}条结果`);
      } else {
        break;
      }
    }

    // 如果重试后仍不足5条，使用实际获取的结果
    if (results.length === 0) {
      keyword.score2 = 0;
      keyword.score1 = 0;
      keyword.score_time = new Date();
      await this.upsertKeywords([keyword]);
      return;
    }
    console.log(`获取到${results.length}条结果`);
    keyword.score2 = this.calculateMatchScore(results, candidateKeywords);

    if (keyword.score2 > 2) {
      if (results.length > 0) {
        const resultImageUrls = results
          .map(result => result.url_image)
          .filter(url => !!url && url.includes('m.media-amazon.com'));

        let totalSimilarity = 0;
        let validCount = 0;

        const processedUrls = resultImageUrls.map(url =>
          url.replace(/_AC_US\d+/g, '_AC_US1000')
            .replace(/_AC_UL\d+/g, '_AC_UL1000')
            .replace(/_SL\d+/g, '_SL1000')
            .replace(/SS40+/g, 'SS500')
            .replace(/_AC_SR\d+,?\d*/g, '_AC_SR1000,1000')
            .replace(/_SX\d+_SY\d+_CR[^_]*_/, '_SX1000_SY1000_CR,0,0,1000,1000_')
        );
        const resultDetails = results
          .filter(result => !!result.url_image && result.url_image.includes('m.media-amazon.com') &&!result.url_image.toLowerCase().includes('.gif'))
          .map(result => ({
            asin: result.asin,
            url_image: result.url_image,
          }));
        keyword.result_details = resultDetails;

        for (const resultImageUrl of processedUrls) {
          try {
            await this.imageRateLimiter.removeTokens(1);
            console.log('Processing image URL:', resultImageUrl, "asinCandidate:", keyword.asin);
            const similarity = await this.imageSimilarityTool.getSimilarityScore(
              resultImageUrl,
              keyword.asin,
              keyword.value
            );

            if (similarity !== null) {
              totalSimilarity += similarity;
              validCount++;
            }
            console.log(`图片相似度计算完成（${similarity}）`);
          } catch (error) {
            keyword.score1 = validCount > 0
              ? totalSimilarity / validCount
              : 0;
            await this.upsertKeywords([keyword]);
            this.logger.error(`图片相似度计算失败（${keyword.value}）:`, error);
          }
        }

        // 计算平均相似度作为 score1
        keyword.score1 = validCount > 0
          ? totalSimilarity / validCount
          : 0;

        keyword.score_time = new Date();
        await this.upsertKeywords([keyword]);
      }
    } else {
      keyword.score1 = 0; // score2≤2时不计算
      keyword.score_time = new Date();
      await this.upsertKeywords([keyword]);
    }
  }

  
  // 新增方法：获取候选产品图片URL
  private async getCandidateImageUrl(
    asin: string,
    marketplace: string
  ): Promise<string | null> {
    try {
      const candidate = await this.amzListingKeywordRepo.manager.findOne(
        AppAmzBsrCandidateEntity, // 确保已导入该实体
        {
          where: {
            asin,
            marketplace,
            status: 6 // 仅查询有效候选
          },
          select: ['aliyun_img'] // 只需图片URL
        }
      );

      return candidate?.aliyun_img || null;
    } catch (error) {
      this.logger.error(
        `获取候选产品图片失败（ASIN:${asin}）:`,
        error
      );
      return null;
    }
  }


  // 映射国家到域名
  private mapMarketplaceToDomain(marketplace: string): string {
    const map: Record<string, string> = {
      '美国': 'com',
      '英国': 'co.uk',
      '德国': 'de',
      '法国': 'fr',
      '意大利': 'it',
      '西班牙': 'es',
      '荷兰': 'nl',
      '瑞典': 'se',
      '波兰': 'pl',
      '日本': 'co.jp',
      '加拿大': 'ca',
      '墨西哥': 'com.mx',
      '巴西': 'com.br',
      '澳大利亚': 'com.au',
      '阿联酋': 'ae',
      '印度': 'in',
      '新加坡': 'sg',
      '沙特阿拉伯': 'sa',
      '土耳其': 'com.tr',
    };

    return map[marketplace] || 'com';
  }

  private calculateMatchScore(results: any[], candidateKeywords: string[]): number {
    let totalScore = 0;
    const resultCount = Math.min(results.length, 30);

    // 如果没有候选关键词，直接返回0分
    if (candidateKeywords.length === 0) {
      return 0;
    }

    // 提前标准化候选关键词
    const normalizedCandidateKeywords = candidateKeywords.map(kw =>
      this.normalizeText(kw).toLowerCase()
    );

    for (let i = 0; i < resultCount; i++) {
      const title = results[i].title || '';
      const normalizedTitle = this.normalizeText(title).toLowerCase();

      let hitCount = 0;
      // 2026-04-10: 日志简化 - 取消标题对比打印
      // console.log(`检查标题: ${normalizedTitle}`);

      for (const kw of normalizedCandidateKeywords) {
        const regex = new RegExp(`(\\b${kw}\\b|${kw}(?=[a-z]))`, 'i');

        if (regex.test(normalizedTitle)) {
          hitCount++;
          // console.log(`  命中关键词: ${kw}`);
        }
      }

      // 计算当前结果的得分
      const itemScore = Math.min(hitCount * 1.66, 10);
      totalScore += itemScore;

      // console.log(`  命中数: ${hitCount}, 得分: ${itemScore.toFixed(2)}`);
    }

    // 计算平均分
    const avgScore = totalScore / resultCount;
    // console.log(`总得分: ${totalScore}, 平均分: ${avgScore.toFixed(2)}`);

    return parseFloat(avgScore.toFixed(2));
  }
  // 文本标准化方法
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]|_/g, '')  // 移除所有特殊字符和下划线
      .replace(/\d+/g, '')        // 新增：移除所有数字
      .replace(/\s+/g, ' ')
      .trim();
  }

  async setKeywordTypesByAsin(asin: string) {
    try {
      this.logger.info(`开始处理ASIN: ${asin} 的关键词类型设置`);
      
      // 1. 获取已入库关键词
      const keywords = await this.amzListingKeywordRepo.find({
        where: {
          asin,
          status: appConfig.KEYWORD_STATUS.LIBRARY.value
        }
      });

      if (keywords.length === 0) {
        this.logger.info(`ASIN: ${asin} 没有找到需要更新的关键词`);
        return "没有找到需要更新的关键词";
      }

      this.logger.info(`ASIN: ${asin} 找到 ${keywords.length} 个关键词，开始处理`);

      // 第一步：清除所有现有关键词类型并重新计算weight
      try {
        keywords.forEach((keyword, index) => {
          // 防御性检查：确保关键词对象有效
          if (!keyword) {
            throw new Error(`第 ${index} 个关键词为null或undefined`);
          }
          
          keyword.keyword_type = null;
          
          const score1 = Number(keyword.score1); // 强制转为数字
          const score2 = Number(keyword.score2); // 强制转为数字
          
          // 处理转换失败的情况（如非数字字符串）
          const safeScore1 = isNaN(score1) ? 0 : score1;
          const safeScore2 = isNaN(score2) ? 0 : score2;
          
          // 计算weight
          keyword.weight = safeScore2 + safeScore1;

          // 检查计算结果是否有效
          if (isNaN(keyword.weight)) {
            throw new Error(`第 ${index} 个关键词(值: ${keyword.value})计算weight为NaN，score1: ${score1}, score2: ${score2}`);
          }
        });
        
        // 保存清除操作和weight更新
        await this.amzListingKeywordRepo.save(keywords);
        this.logger.info(`ASIN: ${asin} 已清除所有关键词类型并重新计算weight`);
      } catch (error) {
        this.logger.error(`ASIN: ${asin} 清除类型或计算weight时出错:`, error);
        throw new Error(`清除类型或计算weight失败: ${(error as Error).message}`);
      }

      // 2. 按国家分组（增加异常处理）
      const keywordsByCountry: Record<string, AppAmzListingKeywordEntity[]> = {};
      try {
        keywords.forEach((keyword, index) => {
          const country = keyword.marketplaces;
          if (!country) {
            throw new Error(`第 ${index} 个关键词(值: ${keyword.value})的marketplaces为空`);
          }
          if (!keywordsByCountry[country]) {
            keywordsByCountry[country] = [];
          }
          keywordsByCountry[country].push(keyword);
        });
        this.logger.info(`ASIN: ${asin} 按国家分组完成，涉及国家: ${Object.keys(keywordsByCountry).join(',')}`);
      } catch (error) {
        this.logger.error(`ASIN: ${asin} 按国家分组时出错:`, error);
        throw new Error(`按国家分组失败: ${(error as Error).message}`);
      }

      // 3. 处理每个国家的关键词，重新分配类型
      try {
        const updatePromises = Object.keys(keywordsByCountry).map(async (country) => {
          this.logger.info(`开始处理ASIN: ${asin} 在 ${country} 的关键词，共 ${keywordsByCountry[country].length} 个`);
          
          const countryKeywords = keywordsByCountry[country];
          const scoredKeywords = countryKeywords.map(k => ({
            keyword: k,
            totalScore: k.weight, // 使用重新计算后的weight
            score1: k.score1 || 0,
            score2: k.score2 || 0
          }));

          // 过滤无效关键词
          const validKeywords = scoredKeywords.filter(k => {
            const isValid = k.score2 >= 2;
            if (!isValid) {
              this.logger.debug(`ASIN: ${asin} 在 ${country} 的关键词(值: ${k.keyword.value})因score2=${k.score2}被过滤`);
            }
            return isValid;
          });

          // 分配类型
          const updatedKeywords = this.assignKeywordTypes(validKeywords);
          
          // 保存更新
          if (updatedKeywords.length > 0) {
            await this.amzListingKeywordRepo.save(updatedKeywords.map(item => item.keyword));
          }
          
          this.logger.info(`完成处理ASIN: ${asin} 在 ${country} 的关键词，更新了 ${updatedKeywords.length} 个`);
          return updatedKeywords.length;
        });

        // 等待所有国家更新完成
        const results = await Promise.all(updatePromises);
        const totalUpdated = results.reduce((sum, count) => sum + count, 0);
        this.logger.info(`ASIN: ${asin} 关键词类型设置完成，共更新 ${totalUpdated} 个关键词`);
        
        return `成功更新了 ${totalUpdated} 个关键词的类型（已先清除所有旧类型并重新计算weight）`;
      } catch (error) {
        this.logger.error(`ASIN: ${asin} 分配关键词类型时出错:`, error);
        throw new Error(`分配类型失败: ${(error as Error).message}`);
      }

    } catch (error) {
      // 记录完整错误堆栈，方便定位问题
      this.logger.error(`ASIN: ${asin} 处理关键词类型时发生错误`, error);
      // 抛出包含具体信息的错误
      throw new Error(`处理关键词类型时发生错误: ${(error as Error).message}`);
    }
  }
    
    
    


  async exportKeyword(asin: string) {
    const qb = this.amzListingKeywordRepo
      .createQueryBuilder('keyword')
      .where('keyword.asin = :asin', { asin })
      .select([
        'keyword.value AS value',
        'keyword.value_cn AS value_cn',
        'keyword.keyword_type AS keyword_type',
        'keyword.marketplaces AS marketplaces',
        'keyword.ad_competitor_count AS ad_competitor_count',
        'keyword.ppc_bid AS ppc_bid',
        'keyword.ppc_bid_min AS ppc_bid_min',
        'keyword.ppc_bid_max AS ppc_bid_max',
        'keyword.search_volume_monthly AS search_volume_monthly',
        'keyword.weight AS weight',
        'keyword.score1 AS score1',
        'keyword.score2 AS score2',
        'keyword.sif_search_volume_monthly AS sif_search_volume_monthly',
        'keyword.sif_search_history AS sif_search_history',
        'keyword.createTime AS createTime',
        'keyword.updateTime AS updateTime'
      ])

    const data = await qb.getRawMany();
    console.log(asin);
    console.log(data);
    const headers = [
      '关键词', '关键词中文意思', '关键词类型', '国家', '广告竞品数', 'PPC竞价',
      'PPC竞价最小值', 'PPC竞价最大值', '月搜索量', '综合评分', '图片相似度评分',
      '关键词匹配度评分', '搜索量数据', '搜索量走势', '创建时间', '更新时间'
    ];

    let csv = headers.join(',') + '\n';

    data.forEach(item => {
      const row = [
        `"${item.value?.replace(/"/g, '""')}"`,      // 处理双引号转义
        `"${item.value_cn?.replace(/"/g, '""')}"`,
        item.keyword_type,
        item.marketplaces,
        item.ad_competitor_count,
        item.ppc_bid,
        item.ppc_bid_min,
        item.ppc_bid_max,
        item.search_volume_monthly,
        item.weight,                                 // 综合评分用weight字段
        item.score1,                                // 图片相似度
        item.score2,                                // 关键词匹配度
        JSON.stringify(item.sif_search_volume_monthly),    // 序列化JSON数组
        JSON.stringify(item.sif_search_history),            // 序列化走势数据
        item.createTime?.toISOString(),             // 日期标准化
        item.updateTime?.toISOString()
      ];
      csv += row.join(',') + '\n';
    });

    return { csv };
  }



}
