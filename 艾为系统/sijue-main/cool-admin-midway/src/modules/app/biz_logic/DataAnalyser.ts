import {Inject, Provide} from "@midwayjs/decorator";
import {Singleton} from "@midwayjs/core";
import {InjectEntityModel} from "@midwayjs/typeorm";
import {IsNull, Not, Repository} from "typeorm";
import {appConfig} from "../../../appConfig";
import {AppUtils} from "../utils/appUtils";
import {AppAmzListingEntity} from "../entity/listing";
import {AppAmzListingCompetitorEntity} from "../entity/competitor";
import {AppAmzListingKeywordService} from "../service/keyword";
import {SpiderService} from "../service/spider";
import {KeywordSearchVolumeData} from "../interface/keyword-search-volume-data";
import {AppAmzListingKeywordEntity} from "../entity/keyword";
import {AppAmzListingService} from "../service/listing";
import {AppAmzListingCompetitorService} from "../service/competitor";
import * as dayjs from 'dayjs';
import {AppAmzBsrTaskEntity} from "../entity/bsr_task";
import {AppAmzBsrCandidateEntity} from "../entity/bsr_candidate";
import {AppAmzBsrCandidateCompetitorEntity} from "../entity/bsr_candidate_competitor";
import {AppAmzDepartmentRankFilterService} from "../service/bsr_department_rank_filter";
import {AppAmzBsrCandidateService} from "../service/bsr_candidate";
import 'dayjs/locale/de'; // 引入德语语言包
import 'dayjs/locale/en'; // 引入英语语言包

dayjs.locale('en');
@Provide()
@Singleton()
export class DataAnalyser {
  @Inject()
  appUtils: AppUtils;

  @InjectEntityModel(AppAmzListingEntity)
  listingRepo: Repository<AppAmzListingEntity>;

  @InjectEntityModel(AppAmzBsrTaskEntity)
  bsrTaskRepo: Repository<AppAmzBsrTaskEntity>;

  @InjectEntityModel(AppAmzBsrCandidateEntity)
  bsrCandidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @Inject()
  spiderService: SpiderService;

  @Inject()
  listingService: AppAmzListingService;

  @Inject()
  keywordService: AppAmzListingKeywordService;

  @Inject()
  competitorService: AppAmzListingCompetitorService;

  @Inject()
  deptRankFilterService: AppAmzDepartmentRankFilterService;

  @Inject()
  bsrCandidateService:AppAmzBsrCandidateService


  async analyseKeywordSpiderResult() {
    let keyword = await this.spiderService.getOneKeywordEntity(appConfig.KEYWORD_STATUS.RESEARCHING.value);
    if (!keyword) {
      return;
    }
    try {
      // console.group(`正在分析关键词：${JSON.stringify({
      //   id: keyword.id,
      //   sid: keyword.sid,
      //   asin: keyword.asin,
      //   seller_sku: keyword.seller_sku,
      //   value: keyword.value
      // })}`);


      keyword.score1 = -1;
      keyword.score2 = -1;

      if (!Array.isArray(keyword.spider_res)) {
        console.log('爬虫结果格式有误，应为 Array。');
      }

      if (keyword.spider_res.length === 0) {
        console.log('爬虫结果为空');
      }

      if (Array.isArray(keyword.spider_res) && keyword.spider_res.length > 0) {
        let similarity_sum = keyword.spider_res.reduce((a, b) => {
          return a + (b?.similarity || 0)
        }, 0);
        let similarity_score = similarity_sum / keyword.spider_res.length;
        if (similarity_score < 0) similarity_score = 0;
        keyword.score1 = similarity_score;


        let related_listing = await this.listingRepo.findOne({
          where: {
            sid: keyword.sid,
            asin: keyword.asin,
            seller_sku: keyword.seller_sku,
          }
        });
        if (related_listing) {
          let listing_item_name_words = related_listing?.item_name.split(' ').map(w => w.toLowerCase());
          let totalScore = 0
          for (const spiderItem of keyword.spider_res) {
            let matchCount = 0;
            for (const word of listing_item_name_words) {
              if (spiderItem?.title.toLowerCase().indexOf(word) >= 0) matchCount++;
            }
            totalScore += matchCount / listing_item_name_words.length;
          }
          keyword.score2 = parseFloat((totalScore / keyword.spider_res.length * 100).toFixed(2));
        }
      }

      await this.spiderService.saveKeywordScore(keyword);
    } catch (err) {
      console.log(err);
      try {
        await this.spiderService.saveKeywordScore(keyword);
      } catch (err) {
        console.log(err);
      }
    } finally {
      console.log('分析完成');
      console.groupEnd();
    }
  }


  async analyseCompetitorSpiderResult() {
    let listing = await this.spiderService.getOneListingToAnalyseCompetitorSpiderRes();
    if (!listing) {
      return;
    }
    try {
      // console.group(`正在分析的竞品来自 listing：${JSON.stringify({
      //   id: listing.id,
      //   sid: listing.sid,
      //   asin: listing.asin,
      //   sku: listing.seller_sku,
      // })}`);

      if (!Array.isArray(listing.competitor_spider_res)) {
        console.log('爬虫结果格式有误，应为 Array。');
      }

      if (listing.competitor_spider_res.length === 0) {
        console.log('爬虫结果为空');
      }

      let qualifiedCompetitors: AppAmzListingCompetitorEntity[] = [];
      if (Array.isArray(listing.competitor_spider_res) && listing.competitor_spider_res.length > 0) {
        let siblingKeywords = await this.spiderService.getSiblingKeywords(listing.sid, listing.asin, listing.seller_sku);
        listing.competitor_spider_res.forEach(res => {
          let threshold = 1.5;
          let listing_price_num = parseFloat(listing.landed_price) || -1;
          let competitor_price = this.appUtils.normalizeNumber(res?.price);
          if (competitor_price < listing_price_num / threshold
            || listing_price_num * threshold < competitor_price) {
            return;
          }

          if (!res?.title) {
            return;
          }

          if ('FBM' === appConfig.estimate_distribution_type(res.dispatches_from, res.sold_by)) {
            return;
          }

          let hasKeyword = siblingKeywords.some(keyword => {
            return res?.title.toLowerCase().indexOf(keyword.value.toLowerCase()) >= 0;
          });
          if (hasKeyword) {
            let stars = this.appUtils.normalizeNumber(res.stars);
            if (stars > 5) stars = -1;
            // @ts-ignore
            qualifiedCompetitors.push({
              sid: listing.sid,
              asin_mine: listing.asin,
              asin_competitor: res.asin,
              seller_sku: listing.seller_sku,
              item_name: res.title,
              image_url: res.image_url,
              price: this.appUtils.normalizeNumber(res.price),
              review_num: this.appUtils.normalizeNumber(res.reviews),
              last_star: stars,
              bsr_html: this.appUtils.normalizeBsrInfo(res.bsr_html),
              bsr_rank: appConfig.extract_ranking_from_bsr_info(res.bsr_html),
              dispatches_from: res.dispatches_from,
              sold_by: res.sold_by,
              bullet_points: res.bullet_points,
            });
          } else {
          }
        });
      }

      await this.spiderService.saveCompetitors(qualifiedCompetitors, listing.sid);
      listing.competitor_spider_status = appConfig.LISTING_COMPETITOR_SPIDER_STATUS.RESEARCHED.value;
      await this.spiderService.updateListingCompetitorSpiderStatus(listing);
    } catch (err) {
      console.log(err);
    } finally {
      console.log('分析完成');
      console.groupEnd();
    }
  }


  async analyseListingKeywordSearchVolume() {
    let listing = await this.listingRepo.findOne({
      where: {
        kw_search_volume_status: appConfig.LISTING_KEYWORD_ANAL_STATUS.PENDING.value,
      },
    });

    if (!listing) {
      return;
    }

    try {
      // console.group(`正在分析 listing 的关键词搜索量数据：${JSON.stringify({
      //   id: listing.id,
      //   sid: listing.sid,
      //   asin: listing.asin,
      //   seller_sku: listing.seller_sku,
      // })}`);

      Object.assign(listing, {
        kw_search_volume_status: appConfig.LISTING_KEYWORD_ANAL_STATUS.ANALYSED.value,
      });

      let keywordEntities: AppAmzListingKeywordEntity[] = await this.keywordService.getCoreKeywords(
        listing.sid, listing.asin, listing.seller_sku, true
      );
      if (!keywordEntities.length) {
        console.log('该 listing 当前没有已入库的核心关键词');
        throw new Error('该 listing 当前没有已入库的核心关键词');
      }

      let weight_sum: number = keywordEntities.reduce(
        (pre: number, next: AppAmzListingKeywordEntity) => {
          let w = next.weight;
          if (w === null) w = 0;
          return pre + w;
        }, 0
      );

      let analysis_result: Array<KeywordSearchVolumeData> = [];
      let dates = keywordEntities[0].search_volume_data.map(d => d.date);
      dates.forEach((date, index) => {
        let weight_sum_searches: number = keywordEntities.reduce(
          (pre: number, next: AppAmzListingKeywordEntity) => {
            return pre + next.search_volume_data[index].searches * next.weight;
          }, 0
        );

        let weighted_mean_searches = weight_sum_searches / weight_sum || 1;
        if (weighted_mean_searches <= 0) weighted_mean_searches = 1;
        weighted_mean_searches = Math.round(weighted_mean_searches);

        let expected_orders = listing.daily_order_quantity * 7 || 0;
        if (index !== 0) {
          expected_orders = listing.daily_order_quantity * 7 * weighted_mean_searches / analysis_result[0].searches || 0;
          if (expected_orders < 0) expected_orders = 0;
        }
        expected_orders = Math.round(expected_orders);

        analysis_result.push({
          date: date,
          searches: weighted_mean_searches,
          expected_orders: expected_orders,
        });
      });

      listing.kw_search_volume_anal_res = analysis_result;
      await this.listingRepo.save(listing);
    } catch (err) {
      console.log(err);
      try {
        await this.listingRepo.save(listing);
      } catch (err) {
        console.log(err);
      }
    } finally {
      console.log('分析完成');
      console.groupEnd();
    }
  }

  async updateCompetitorCountHistory() {
    let listing: AppAmzListingEntity = await this.listingService.getOneListingRequiringCompetitorHistoryUpdate()
    if (!listing) return false;

    try {
      // console.group(`正在更新竞品数量历史，来自 listing：${JSON.stringify({
      //   id: listing.id,
      //   sid: listing.sid,
      //   asin: listing.asin,
      //   sku: listing.seller_sku,
      // })}`);

      let history_arr = listing.competitor_amount_history;
      if (!Array.isArray(history_arr)) history_arr = [];

      if (history_arr.length >= 8) {
        history_arr.length = 8;
        history_arr.shift();
      }

      history_arr.push({
        date: this.appUtils.getFormattedDate(),
        amount: await this.competitorService.getCompetitorLibraryCount({
          sid: listing.sid,
          asin_mine: listing.asin,
          seller_sku: listing.seller_sku,
          price: Not(IsNull()),
        }),
      });

      listing.competitor_amount_history = history_arr;
      listing.competitor_amount_history_updateTime = new Date();
      await this.listingRepo.save(listing);
    } catch (err) {
      console.log(err);
    } finally {
      console.log('执行完成');
      console.groupEnd();
    }
  }

  async updateDailyOrderQuantity() {
    let listings = await this.listingService.getListingsRequiringDailyOrderQuantityUpdate();
    if (listings.length === 0) return;

    try {
      console.group(`正在更新逻辑日均单量，共 ${listings.length} 个 listing`);

      for (const listing of listings) {
        let history = listing.daily_order_quantity_history;

        if (!history || !Array.isArray(history)) continue;

        let volumes_after_price_change = history
          .filter(data => {
            return dayjs(data.date).isAfter(listing.landed_price_updateTime, 'day')
              || dayjs(data.date).isSame(listing.landed_price_updateTime, 'day');
          }).map(data => data.quantity);

        let avg_volume: number = 0;

        if (volumes_after_price_change.length !== 0) {
          avg_volume = volumes_after_price_change.reduce((acc, val) => acc + val, 0) / volumes_after_price_change.length;
        } else {
          avg_volume = history
            .map(data => data.quantity)
            .reduce((acc, val) => acc + val, 0) / history.length;
        }

        if (isNaN(avg_volume)) avg_volume = 0;

        avg_volume = Number(avg_volume.toFixed(2));

        listing.daily_order_quantity = avg_volume;
      }

      listings.forEach(listing => listing.daily_order_quantity_status = 1);
      await this.listingRepo.save(listings);
    } catch (err) {
      console.log(err);
    } finally {
      console.log('执行完成');
      console.groupEnd();
    }
  }
  async analyseBsrTaskSpiderResult() {
    let bsrTask = await this.spiderService.getOneBsrTaskEntity(appConfig.BSR_TASK_STATUS.RESEARCHING.value);
    if (!bsrTask) {
      return;
    }
    try {
      console.group(`正在分析选品数据：${JSON.stringify({
        id: bsrTask.id,
        bsr_link: bsrTask.bsr_link,
        category: bsrTask.category
      })}`);
  
      if (!Array.isArray(bsrTask.spider_res?.products_info)) {
        console.log('爬虫结果格式有误，产品信息应为 Array。');
      }
  
      if (bsrTask.spider_res?.products_info?.length === 0) {
        console.log('爬虫结果为空');
      }
  
      let bsrCandidates: AppAmzBsrCandidateEntity[] = [];
      const monthMapping = {
        Januar: 'January',
        Februar: 'February',
        März: 'March',
        April: 'April',
        Mai: 'May',
        Juni: 'June',
        Juli: 'July',
        August: 'August',
        September: 'September',
        Oktober: 'October',
        November: 'November',
        Dezember: 'December',
      };
      const existingCandidates = await this.bsrCandidateRepo.find({ 
        select: ['asin'],
        where: { 
          marketplace: bsrTask.marketplace 
        }
      });
      const existingAsinSet = new Set(existingCandidates.map(c => c.asin));
      const currentBatchAsins = new Set();

      if (Array.isArray(bsrTask.spider_res?.products_info)
        && bsrTask.spider_res?.products_info?.length > 0) {
        bsrTask.spider_res.products_info.forEach(info => {
          if (!info) {
            console.log('跳过无效的产品信息:', info);
            return;
          }
          
          if (existingAsinSet.has(info.asin) || currentBatchAsins.has(info.asin)) {
            console.log(`[去重] 跳过重复ASIN: ${info.asin}`);
            return;
          }
          currentBatchAsins.add(info.asin);
          
          let dateFirstAvailable = null;
  
          if (info.date_first_available) {
            // 手动转换德语月份为英语
            let dateStr = info.date_first_available;
            for (const [deMonth, enMonth] of Object.entries(monthMapping)) {
              if (dateStr.includes(deMonth)) {
                dateStr = dateStr.replace(deMonth, enMonth);
                break;
              }
            }
  
            // 使用 dayjs 解析日期字符串
            let date = dayjs(dateStr, 'D. MMMM YYYY');
            if (!date.isValid()) {
              // 如果解析失败，设置为默认日期 1990-01-01
              dateFirstAvailable = dayjs('1990-01-01').toDate();
            } else {
              dateFirstAvailable = date.toDate();
            }
          }
  
          // @ts-ignore
          bsrCandidates.push({
            bsr_task_id: bsrTask.id,
            bsr_link: bsrTask.bsr_link,
            marketplace: bsrTask.marketplace,
            remark: bsrTask.remark,
            asin: info.asin,
            item_name: info.title,
            image_url: info.image_url,
            // price: info.price ? this.appUtils.normalizeNumber(info.price.replace(',', '.')) : null,
            price: info.price ? this.appUtils.normalizeNumber(info.price) : null,
  
            review_num: this.appUtils.normalizeNumber(info.reviews),
            // last_star: info.stars ? this.appUtils.normalizeNumber(info.stars.replace(',', '.')) : null,
            last_star: info.stars ? this.appUtils.normalizeNumber(info.stars) : null,

  
            bsr_html: this.appUtils.normalizeBsrInfo(info.bsr_html), 
            bsr_rank: appConfig.extract_ranking_from_bsr_info(info.bsr_html),
            dispatches_from: info.dispatches_from,
            sold_by: info.sold_by,
            bullet_points: info.bullet_points,
            dimensions: appConfig.parseDimensionsInfo(info.dimensions).dimensions,
            weight: appConfig.parseWeightToKilogram(info.weight) || appConfig.parseDimensionsInfo(info.dimensions).weight,
            seller_country: info.seller_country,
            
            date_first_available: dateFirstAvailable,
  
            status: appConfig.BSR_CANDIDATE_STATUS.PENDING.value,
            selling_price: this.appUtils.normalizeNumber(info.price),
          });
        });
      }
  
      let rankFilters = await this.deptRankFilterService.getDepartmentRankFilters(bsrTask.marketplace);
      let qualifiedBsrCandidates = bsrCandidates.filter((can, index) => {
        let debug = true;
        if (debug) {
          console.group(`(#${index + 1}) ${can.asin}`);
        }
        try {

          
          if (!can?.item_name) {
            if (debug) console.log('产品没有标题，排除。');
            return false;
          }
  
          if (bsrTask.price_min && can.price < bsrTask.price_min) {
            if (debug) console.log(`价格 ${can.price} 低于下限 ${bsrTask.price_min}，排除。`);
            return false;
          }
          if (bsrTask.price_max && can.price > bsrTask.price_max) {
            if (debug) console.log(`价格 ${can.price} 高于上限 ${bsrTask.price_max}，排除。`);
            return false;
          }
  
          if (bsrTask.review_min && can.review_num < bsrTask.review_min) {
            if (debug) console.log(`评论数量 ${can.review_num} 低于下限 ${bsrTask.review_min}，排除。`);
            return false;
          }
          if (bsrTask.review_max && can.review_num > bsrTask.review_max) {
            if (debug) console.log(`评论数量 ${can.review_num} 高于上限 ${bsrTask.review_max}，排除。`);
            return false;
          }
  
          if (bsrTask.last_star_min && can.last_star < bsrTask.last_star_min) {
            if (debug) console.log(`星级 ${can.last_star} 低于下限 ${bsrTask.last_star_min}，排除。`);
            return false;
          }
  
          if (bsrTask.weight_min && this.appUtils.normalizeNumber(can.weight) < bsrTask.weight_min) {
            if (debug) console.log(`重量 ${can.weight} 低于下限 ${bsrTask.weight_min}，排除。`);
            return false;
          }
          if (bsrTask.weight_max && this.appUtils.normalizeNumber(can.weight) > bsrTask.weight_max) {
            if (debug) console.log(`重量 ${can.weight} 高于上限 ${bsrTask.weight_max}，排除。`);
            return false;
          }
  
  
          if (bsrTask.date_first_available
            && dayjs(can.date_first_available).isBefore(bsrTask.date_first_available)) {
            if (debug) console.log(`上架时间 ${dayjs(can.date_first_available).toDate()} 早于指定日期 ${dayjs(bsrTask.date_first_available)}，排除。`);
            return false;
          }
  
          if (Array.isArray(bsrTask.delivery_type) && bsrTask.delivery_type.length > 0) {
            let distribution_type_code = appConfig.estimate_distribution_type(
              can.dispatches_from,
              can.sold_by,
              true,
            );
  
            if (distribution_type_code !== -1 && !bsrTask.delivery_type.includes(Number(distribution_type_code))) {
              if (debug) console.log(`任务设置配送方式为 ${bsrTask.delivery_type}，本选品为 ${distribution_type_code}，排除`);
              return false;
            }
          }
  
          if (Array.isArray(bsrTask.seller_countries) && bsrTask.seller_countries.length > 0) {
            if (!bsrTask.seller_countries.includes(can.seller_country)) {
              if (debug) console.log(`卖家所属国家 ${can.seller_country} 不在指定范围 ${bsrTask.seller_countries}，排除`);
              if(can.seller_country != null){
                return false;
              }
            }
          }
  
          if (can.bsr_html && rankFilters.some(filter => can.bsr_html.includes(filter.department))) {
            let bsrContentPieces = can.bsr_html.split("\n");
            let bsrInfoArr = bsrContentPieces.map(info => {
              return {
                rank: appConfig.extract_ranking_from_bsr_info(info),
                content: info,
              }
            });
            for (const bsrInfo of bsrInfoArr) {
              for (const filter of rankFilters) {
                if(bsrInfo.content.includes(filter.department)){
                  console.log('类目:'+filter.department,'----排名:'+bsrInfo.rank,'----设置的排名'+filter.rank_limit);
                }
                if (bsrInfo.content.includes(filter.department)
                  && bsrInfo.rank > filter.rank_limit) {
                  if (debug) {
                    console.log(`BSR 信息（${bsrInfo.content}）中的排名超出指定限制：`
                      + `类目 ${filter.department} 排名不低于 ${filter.rank_limit}，排除`);
                  }
                  return false;
                }
              }
            }
          }
        } catch (err) {
          console.dir(err);
          return true;
        } finally {
          if (debug) {
            console.groupEnd();
          }
        }
  
        return true;
      });
  
      console.log(`选品个数：过滤前 ${bsrCandidates.length} 过滤后 ${qualifiedBsrCandidates.length}`);
  
      await this.spiderService.saveBsrCandidates(qualifiedBsrCandidates);
      await this.bsrTaskRepo.update(
        {id: bsrTask.id},
        {status: appConfig.BSR_TASK_STATUS.RESEARCHED.value}
      );
    } catch (err) {
      console.log(err);
    } finally {
      console.log('分析完成');
      console.groupEnd();
    }
  }
  
  

  async analyseBsrCandidateCompetitorSpiderResult() {
    let candidate: AppAmzBsrCandidateEntity = await this.spiderService.getOneBsrCandidateToAnalyseCompetitorSpiderRes();
    if (!candidate) {
      return;
    }

    try {
      console.group(`正在分析的竞品来自 BSR 选品：${JSON.stringify({
        id: candidate.id,
        bsr_task_id: candidate.bsr_task_id,
        asin: candidate.asin,
        item_name: candidate.item_name,
      })}`);

      if (!Array.isArray(candidate.competitor_spider_res)) {
        console.log('爬虫结果格式有误，应为 Array。');
      }

      if (candidate.competitor_spider_res.length === 0) {
        console.log('爬虫结果为空');
      }
      let qualifiedCompetitors: AppAmzBsrCandidateCompetitorEntity[] = [];
      if (Array.isArray(candidate.competitor_spider_res) && candidate.competitor_spider_res.length > 0) {
        candidate.competitor_spider_res.forEach(res => {
          const monthMapping = {
            Januar: 'January',
            Februar: 'February',
            März: 'March',
            April: 'April',
            Mai: 'May',
            Juni: 'June',
            Juli: 'July',
            August: 'August',
            September: 'September',
            Oktober: 'October',
            November: 'November',
            Dezember: 'December',
          };
          let dateFirstAvailable = null;
  
          if (res.date_first_available) {
            // 手动转换德语月份为英语
            let dateStr = res.date_first_available;
            for (const [deMonth, enMonth] of Object.entries(monthMapping)) {
              if (dateStr.includes(deMonth)) {
                dateStr = dateStr.replace(deMonth, enMonth);
                break;
              }
            }
  
            // 使用 dayjs 解析日期字符串
            let date = dayjs(dateStr, 'D. MMMM YYYY');
            if (!date.isValid()) {
              // 如果解析失败，设置为默认日期 1990-01-01
              dateFirstAvailable = dayjs('1990-01-01').toDate();
            } else {
              dateFirstAvailable = date.toDate();
            }
          }

          // let threshold = 1.5;
          // let can_price_num = candidate.price || -1;
          // let competitor_price = this.appUtils.normalizeNumber(res?.price);
          // if (competitor_price < can_price_num / threshold
          //   || can_price_num * threshold < competitor_price) {
          //   return;
          // }

          // if (!res?.title) {
          //   return;
          // }

          // if ('FBM' === appConfig.estimate_distribution_type(res.dispatches_from, res.sold_by)) {
          //   return;
          // }
          let bsr_html = "";
          if(!res?.bsr_html){
            bsr_html = "未出单"
          }else{
            bsr_html = this.appUtils.normalizeBsrInfo(res.bsr_html)
          }
          
          let distribution_type_code = appConfig.estimate_distribution_type(
            res.dispatches_from,
            res.sold_by,
            true,
          );
          let stars = this.appUtils.normalizeNumber(res.stars);
          if (stars > 5) stars = -1;
          // @ts-ignore
          qualifiedCompetitors.push({
            candidate_id: candidate.id,
            asin_candidate: candidate.asin,
            asin_competitor: res.asin,
            item_name: res.title,
            image_url: res.image_url,
            // price: res.price ? this.appUtils.normalizeNumber(res.price.replace(',', '.')) : null,
            price: res.price ?  res.price: null,
            review_num: this.appUtils.normalizeNumber(res.reviews),
            last_star: stars,
            bsr_html: bsr_html,
            bsr_rank: appConfig.extract_ranking_from_bsr_info(res.bsr_html),
            dispatches_from: res.dispatches_from,
            sold_by: res.sold_by,
            bullet_points: res.bullet_points,
            date_first_available:dateFirstAvailable,
            marketplace:res.marketplace,
            
            dispatches_type:distribution_type_code as string,

            spider_time: new Date(),
          });
        });
      }
      console.log("竞品保存数据："+qualifiedCompetitors)
      await this.spiderService.saveBsrCandidateCompetitors(qualifiedCompetitors);
      await this.bsrCandidateRepo.update(
        {id: candidate.id},
        {competitor_spider_status: appConfig.BSR_CANDIDATE_COMPETITOR_SPIDER_STATUS.RESEARCHED.value}
      );
    } catch (err) {
      console.log(err);
    } finally {
      console.log('分析完成');
      console.groupEnd();
    }
  }
}
