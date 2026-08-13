import {Inject, Provide} from '@midwayjs/decorator';
import {Logger} from "@midwayjs/core";
import {InjectEntityModel} from '@midwayjs/typeorm';
import {ILogger} from "@midwayjs/logger";
import {BaseService, CoolCommException} from '@cool-midway/core';
import {Brackets, IsNull, LessThan, Repository} from 'typeorm';
import {AppAmzListingEntity} from '../entity/listing';
import {AppAmzListingKeywordEntity} from "../entity/keyword";
import {AppAmzSellerEntity} from "../entity/seller";
import {AppAmzSellerService} from "./seller";
import {LingXingUtils} from "../utils/lingxing/lingxingUtils";
import * as dayjs from 'dayjs';
import {PriceTactic} from "../interface/enum-price-tactic";
import {appConfig} from "../../../appConfig";
import {DailyOrderQuantityHistory} from "../interface/daily-order-quantity-history";

@Provide()
export class AppAmzListingService extends BaseService {
  @InjectEntityModel(AppAmzListingEntity)
  amzListingRepo: Repository<AppAmzListingEntity>;

  @InjectEntityModel(AppAmzListingKeywordEntity)
  amzListingKeywordRepo: Repository<AppAmzListingKeywordEntity>;

  @InjectEntityModel(AppAmzSellerEntity)
  sellerRepo: Repository<AppAmzSellerEntity>;

  @Inject()
  sellerService: AppAmzSellerService;

  @Logger()
  logger: ILogger;

  @Inject()
  lingXingUtils: LingXingUtils;

  async syncListingsOnDemand() {
    try {
      let seller = await this.sellerService.getOneSellerToFetchListings();
      if (seller?.sid) {
        await this.fetchListingsBySid(seller.sid);
      }
    } catch (err) {
      console.log(err);
    }
  };

  async syncListingsVolumeOnDemand() {
    try {
      let seller = await this.sellerService.getOneSellerToFetchListingsVolume();
      if (seller?.sid) {
        await this.fetchListingsVolumeBySid_v2(seller.sid);
      }
    } catch (err) {
      console.log(err);
    }
  };

  async fetchListingsBySid(sid: number) {
    this.logger.info(`正在获取 listing：sid 为 ${sid}`);

    let data = await this.lingXingUtils.httpPost('/erp/sc/data/mws/listing', {
      sid,
      page: 0,
      length: 10000,
    });

    if (!Array.isArray(data)) {
      console.log('获取 listing 列表失败');
      return false;
    }

    for (const _data of data) {
      let currentListing = await this.amzListingRepo.findOne({
        where: {
          sid: _data.sid,
          asin: _data.asin,
          seller_sku: _data.seller_sku,
        }
      });
      if (currentListing) {
        Object.assign(currentListing, _data);

        if (_data.landed_price !== currentListing.landed_price) {
          currentListing.landed_price_updateTime = new Date();
          currentListing.daily_order_quantity_status = 0;
        }

        await this.amzListingRepo.save(currentListing);
      } else {
        let newListing = new AppAmzListingEntity();
        Object.assign(newListing, _data);
        await this.amzListingRepo.insert(newListing);
      }
    }


    await new Promise(resolve => {
      setTimeout(async () => {
        await this.fetchListingAgingInventoryBySid(sid);
        resolve({});
      }, 1000 * 3);
    });

    await this.sellerService.updateListingLastFetchDate(sid);

    return 'ok';
  }

  async fetchListingsVolumeBySid(sid: number, days: number = 15) {
    this.logger.info(`正在获取产品表现（销量数据）：sid 为 ${sid}`);

    let today = dayjs();
    let before = today.subtract(days, 'days');

    let data = await this.lingXingUtils.httpPost('/bd/productPerformance/openApi/asinList', {
      sid: [sid],
      offset: 0,
      length: 10000,
      sort_field: 'volume',
      sort_type: 'desc',
      summary_field: 'msku',
      start_date: before.format('YYYY-MM-DD'),
      end_date: today.format('YYYY-MM-DD'),
    });

    if (!Array.isArray(data?.list)) {
      console.log('获取产品表现列表失败');
      return false;
    }


    for (const _data of data.list) {
      let currentListing = await this.amzListingRepo.findOne({
        where: {
          sid: sid,
          asin: _data?.asins?.[0]?.asin,
          seller_sku: _data?.price_list?.[0]?.seller_sku,
        }
      });
      if (currentListing) {
        currentListing.daily_order_quantity = _data?.avg_volume || -1;
        await this.amzListingRepo.save(currentListing);
      }
    }

    return 'ok';
  }

  async fetchListingsVolumeBySid_v2(sid: number) {
    this.logger.info(`正在获取产品表现（销量数据）：sid 为 ${sid}`);

    let yesterday = dayjs().subtract(1, 'day');
    let data = await this.lingXingUtils.httpPost('/bd/productPerformance/openApi/asinList', {
      sid: [sid],
      offset: 0,
      length: 10000,
      sort_field: 'volume',
      sort_type: 'desc',
      summary_field: 'msku',
      start_date: yesterday.format('YYYY-MM-DD'),
      end_date: yesterday.format('YYYY-MM-DD'),
    });

    if (!Array.isArray(data?.list)) {
      console.log('获取产品表现列表失败');
      return false;
    }

    let listings: AppAmzListingEntity[] = await this.amzListingRepo.find({
      where: {
        sid: sid,
        status: 1,
        is_delete: 0,
      }
    });
    for (const listing of listings) {
      for (const volumeData of data.list) {
        if (listing.asin === volumeData?.asins?.[0]?.asin
          && listing.seller_sku === volumeData?.price_list?.[0]?.seller_sku) {
          if (!listing.daily_order_quantity_history) {
            listing.daily_order_quantity_history = [];
          }

          let history: DailyOrderQuantityHistory[] = listing.daily_order_quantity_history;

          if (history.length > 0) {
            let final_date = history[history.length - 1].date;
            if (!yesterday.subtract(1, 'day').isSame(final_date, 'day')) {
              while (dayjs(history[history.length - 1].date).isBefore(yesterday, 'day')) {
                let next_date = dayjs(history[history.length - 1].date).add(1, 'day').format('YYYYMMDD');
                history.push({
                  date: next_date,
                  quantity: 0,
                });
              }
            }
          }

          if (history.length === 0 || !dayjs(history[history.length - 1].date).isSame(yesterday, 'day')) {
            while (history.length > 15 - 1) {
              history.shift();
            }

            history.push({
              date: yesterday.format('YYYYMMDD'),
              quantity: parseFloat(volumeData?.avg_volume) || 0,
            });
          } else {
            console.log(`已有昨日的日销量数据 sid: ${listing.sid} asin: ${listing.asin}`);
          }
        }
      }

      listing.daily_order_quantity_status = 0;
    }

    await this.amzListingRepo.save(listings);
    await this.sellerService.updateListingVolumeLastFetchDate(sid);

    return 'ok';
  }

  async fetchListingVolume(
    listing: AppAmzListingEntity,
    search_by: 'yesterday' | 'today' | 'last_week' = 'today',
  ): Promise<number> {
    let today = dayjs();

    let start_date = today.format('YYYY-MM-DD');
    if ('yesterday' === search_by) {
      start_date = today.subtract(1, 'days').format('YYYY-MM-DD');
    }
    if ('last_week' === search_by) {
      start_date = today.subtract(7, 'days').format('YYYY-MM-DD');
    }

    let data = await this.lingXingUtils.httpPost('/bd/productPerformance/openApi/asinList', {
      sid: [listing?.sid],
      offset: 0,
      length: 10000, sort_field: 'volume', sort_type: 'desc', summary_field: 'msku', start_date: start_date,
      end_date: today.format('YYYY-MM-DD'),
    });

    if (!Array.isArray(data?.list)) {
      console.log(`获取产品销量（${search_by}）失败`);
      return null;
    }

    for (const _data of data.list) {
      if (listing.asin === _data?.asins?.[0]?.asin) {
        console.log(`listing(sid ${listing.sid} | asin ${listing.asin})  | seller_sku ${listing.seller_sku}) 昨日销量：${_data?.volume}`);
        return _data?.volume;
      }
    }

    console.log('领星接口响应数据中没有包含该 listing 的销量数据。');
    return null;
  }

  async fetchListingAgingInventoryBySid(sid: number) {
    this.logger.info(`正在获取产品 FBA 库龄信息：sid 为 ${sid}`);
    let data = await this.lingXingUtils.httpPost('/erp/sc/routing/fba/fbaStock/fbaList', {
      sid,
      offset: 0,
      length: 10000,
    });

    if (!Array.isArray(data?.list)) {
      throw new CoolCommException('获取 FBA 库存列表失败');
    }

    if (data.list.length === 0) {
      console.log(`店铺 ${sid} 当前没有查询到 FBA 库存列表数据。`);
    }

    for (const _data of data.list) {
      let currentListing = await this.amzListingRepo.findOne({
        where: {
          sid: sid,
          asin: _data?.asin,
          seller_sku: _data?.msku,
        }
      });
      if (currentListing) {
        currentListing.inv_age_91_to_180_days = _data?.inv_age_91_to_180_days;
        await this.amzListingRepo.save(currentListing);
      }
    }

    return 'ok';
  }

  async getListingsRequiringDailyOrderQuantityUpdate(amount: number = 1000) {
    return await this.amzListingRepo.find({
      where: {daily_order_quantity_status: 0},
      take: amount || 1000,
    });
  }

  async getOneListingRequiringKeywordSearchVolumesUpdate() {
    try {
      let queryResult = await this.amzListingKeywordRepo.createQueryBuilder('keyword')
        .leftJoin(AppAmzListingEntity, 'listing', 'keyword.sid = listing.sid AND keyword.asin = listing.asin AND keyword.seller_sku = listing.seller_sku')
        .where({is_core: true})
        .andWhere(`keyword.status = ${appConfig.KEYWORD_STATUS.LIBRARY.value}`)
        .andWhere(new Brackets(qb => {
          qb
            .where(`listing.is_custom_listing = 0 AND listing.status = 1 AND listing.is_delete = 0`)
            .orWhere('listing.is_custom_listing = 1')
        }))
        .andWhere(new Brackets(qb => {
          qb.where(
            'listing.kw_search_volume_status = :status',
            {status: appConfig.LISTING_KEYWORD_ANAL_STATUS.CREATED.value}
          ).orWhere(
            'listing.kw_search_volume_update_time < :weekAgo',
            {weekAgo: dayjs().subtract(7, "days").format('YYYY-MM-DD')}
          )
        }))
        .groupBy('keyword.sid, keyword.asin, keyword.seller_sku')
        .select([
          'listing.sid AS sid', 'listing.asin AS asin',
          'listing.seller_sku AS seller_sku',
        ])
        .orderBy('RAND()')
        .limit(1)
        .execute();


      if (!queryResult.length) {
        return null;
      }

      return await this.amzListingRepo.findOne({
        where: {
          sid: queryResult[0].sid,
          asin: queryResult[0].asin,
          seller_sku: queryResult[0].seller_sku,
        }
      });
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async getOneListingRequiringMonthlyKeywordSearchVolumesUpdate() {
    try {
      let queryResult = await this.amzListingKeywordRepo.createQueryBuilder('keyword')
        .leftJoin(AppAmzListingEntity, 'listing', 'keyword.sid = listing.sid AND keyword.asin = listing.asin AND keyword.seller_sku = listing.seller_sku')
        .where(new Brackets(qb => {
          qb
            .where(`listing.is_custom_listing = 0 AND listing.status = 1 AND listing.is_delete = 0`)
            .orWhere('listing.is_custom_listing = 1')
        }))
        .andWhere(new Brackets(qb => {
          qb
            .where({search_volume_monthly: IsNull()})
            .orWhere({search_volume_monthly_update_time: IsNull()})
            .orWhere({search_volume_monthly_update_time: LessThan(dayjs().subtract(1, 'month').toDate())})
        }))
        .groupBy('keyword.sid, keyword.asin, keyword.seller_sku')
        .select([
          'listing.sid AS sid', 'listing.asin AS asin',
          'listing.seller_sku AS seller_sku',
        ])
        .orderBy('RAND()')
        .limit(1)
        .execute();

      if (!queryResult.length) {
        return null;
      }

      return await this.amzListingRepo.findOne({
        where: {
          sid: queryResult[0].sid,
          asin: queryResult[0].asin,
          seller_sku: queryResult[0].seller_sku,
        }
      });
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async getOneListingRequiringPendingKeywordsSearchVolumes() {
    try {
      let queryResult = await this.amzListingKeywordRepo.createQueryBuilder('keyword')
        .leftJoin(AppAmzListingEntity, 'listing', 'keyword.sid = listing.sid AND keyword.asin = listing.asin')
        .andWhere(`keyword.status = ${appConfig.KEYWORD_STATUS.PENDING.value}`).andWhere(`keyword.search_volume_data IS NULL`).andWhere(`listing.status = 1`).andWhere(`listing.is_delete = 0`).groupBy('keyword.sid, keyword.asin')
        .select([
          'listing.sid AS sid', 'listing.asin AS asin',
        ])
        .orderBy('RAND()')
        .limit(1)
        .execute();

      if (!queryResult.length) {
        return null;
      }

      return await this.amzListingRepo.findOne({
        where: {
          sid: queryResult[0].sid,
          asin: queryResult[0].asin,
        }
      });
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  async getOneListingRequiringCompetitorHistoryUpdate(): Promise<AppAmzListingEntity> {
    try {
      let queryResult = await this.amzListingRepo.createQueryBuilder('listing')
        .select('*')
        .where(new Brackets(qb => {
          qb.where({competitor_amount_history_updateTime: IsNull()})
            .orWhere('listing.competitor_amount_history_updateTime < :weekAgo',
              {weekAgo: dayjs().subtract(7, "days").format('YYYY-MM-DD')}
            )
        }))
        .andWhere(`listing.status = 1`).andWhere(`listing.is_delete = 0`).orderBy('RAND()')
        .limit(1)
        .execute();

      if (!queryResult.length) {
        return null;
      }

      return queryResult[0];
    } catch (err) {
      console.log(err);
      return null;
    }
  }


  async getListingOfInventoryTactic() {
    let sql = `
      SELECT 
          l.* 
      FROM
          app_amz_listing AS l 
      WHERE
          ( tactic_inventory_ignore_until IS NULL OR tactic_inventory_ignore_until < NOW() ) 
          AND tactic_inventory_active = 1
          AND 1 = 1
      ORDER BY RAND()
      LIMIT 1;
    `;

    `
          AND kw_search_volume_anal_res IS NOT NULL 
          AND afn_fulfillable_quantity IS NOT NULL 
          AND daily_order_quantity IS NOT NULL 
    `

    try {
      let queryResult: AppAmzListingEntity[] = await this.amzListingRepo.query(sql);
      return queryResult.length ? queryResult[0] : null;
    } catch (err) {
      console.log(err);
    }
  }

  async getListingOfPriceTactic(tactic: PriceTactic) {
    if (![
      PriceTactic.p1,
      PriceTactic.p2,
      PriceTactic.p3,
      PriceTactic.p4].includes(tactic)) {
      return null;
    }

    if (PriceTactic.p2 === tactic) {
      return await this.__getListingOfPriceTacticSqlPartP2();
    }


    const commonSql = {
      start: `
          SELECT
              l.* 
          FROM
              app_amz_listing AS l 
          WHERE
              -- 没有忽略调价策略的时间，或当前已超过设置的忽略时间
              ( tactic_price_ignore_until IS NULL OR tactic_price_ignore_until < NOW() )
              -- 且 带有调价策略标签 
              AND tags IS NOT NULL 
              AND JSON_VALID( tags ) 
              AND JSON_LENGTH( tags ) <> 0 
              -- 且 FBA 可售大于 0（即为 0 时不用触发调价提醒）
              AND afn_fulfillable_quantity > 0
      `,
      end: ` AND 1 = 1 ORDER BY RAND() LIMIT 1;`,
    };

    let sqlPart: string;
    switch (tactic) {
      case PriceTactic.p1:
        sqlPart = this.__getListingOfPriceTacticSqlPartP1();
        break;
      case PriceTactic.p3:
        sqlPart = this.__getListingOfPriceTacticSqlPartP3();
        break;
      case PriceTactic.p4:
        sqlPart = this.__getListingOfPriceTacticSqlPartP4();
        break;
    }

    const sql = commonSql.start + sqlPart + commonSql.end;

    try {
      let queryResult: AppAmzListingEntity[] = await this.amzListingRepo.query(sql);
      return queryResult.length ? queryResult[0] : null;
    } catch (err) {
      console.log(err);
    }
  }

  __getListingOfPriceTacticSqlPartP1() {
    return `
      AND NOT(JSON_CONTAINS( tags, '["p3"]' ))                           -- 不能包含清仓策略，因为其无视优先级 
      AND JSON_EXTRACT( tags, '$[0]' ) = "p1"                            -- 调价策略的第一项为 p1 
      AND tactic_new_product_date IS NOT NULL                            -- 带有新品上架日期 
      AND DATEDIFF( NOW(), tactic_new_product_date ) < 60                -- 新品上架日期距离现在小于 60 天，才算是新品 
      AND tactic_new_product_expected_daily_order_quantity IS NOT NULL   -- 需要设置预期日单量  
      `;
  }

  async __getListingOfPriceTacticSqlPartP2() {
    let sql = `
      SELECT
          l.sid,
          l.asin,
          l.seller_sku
          -- count(*) AS competitor_count
          -- any_value ( l.item_name ) -- 检查一下标题
      FROM
          app_amz_listing_competitor AS c
              LEFT JOIN app_amz_listing AS l 
                  ON l.asin = c.asin_mine AND l.seller_sku = c.seller_sku AND l.sid = c.sid 
      WHERE
          c.is_core = TRUE                                             -- 是核心竞品的
          AND c.STATUS = ${appConfig.COMPETITOR_STATUS.LIBRARY.value}  -- 已入库的
          AND ( l.tactic_price_ignore_until IS NULL OR l.tactic_price_ignore_until < NOW() ) -- 没有忽略调价策略的时间，或当前已超过设置的忽略时间
          AND NOT (JSON_CONTAINS( l.tags, '["p3"]' ))                  -- listing 包含清仓策略 p3 的 
          AND JSON_EXTRACT( l.tags, '$[0]' ) = "p2"                    -- 调价策略的第一项为 p2 
          AND l.afn_fulfillable_quantity > 0                           -- 且 FBA 可售大于 0（即为 0 时不用触发调价提醒）
      GROUP BY
          c.sid,
          c.asin_mine,
          c.seller_sku
      ORDER BY
          RAND() 
          LIMIT 1;
    `;

    try {
      let queryResult = await this.amzListingRepo.query(sql);
      if (!queryResult.length) return null;

      let {sid, asin, seller_sku} = queryResult[0];
      return await this.amzListingRepo.findOne({where: {sid, asin, seller_sku}});
    } catch (err) {
      console.log(err);
      return null;
    }
  }

  __getListingOfPriceTacticSqlPartP3() {
    return `
      AND JSON_CONTAINS( tags, '["p3"]' ) -- 只要包含了清仓策略 p3 就行。优先级最高
      AND tactic_clearance_price_modify_range IS NOT NULL             -- 和清仓调价策略相关的字段都不能为空
      AND tactic_clearance_price_modify_upper_limit IS NOT NULL
      AND tactic_clearance_price_modify_lower_limit IS NOT NULL
      AND tactic_clearance_expected_order_max_before_9 IS NOT NULL
      AND tactic_clearance_expected_order_min_before_9 IS NOT NULL
      AND tactic_clearance_expected_order_max_before_12 IS NOT NULL
      AND tactic_clearance_expected_order_min_before_12 IS NOT NULL
      AND tactic_clearance_expected_order_max_before_15 IS NOT NULL
      AND tactic_clearance_expected_order_min_before_15 IS NOT NULL
      AND tactic_clearance_expected_order_max_before_18 IS NOT NULL
      AND tactic_clearance_expected_order_min_before_18 IS NOT NULL
      AND tactic_clearance_expected_order_max_before_21 IS NOT NULL
      AND tactic_clearance_expected_order_min_before_21 IS NOT NULL
      AND tactic_clearance_expected_order_max_before_24 IS NOT NULL
      AND tactic_clearance_expected_order_min_before_24 IS NOT NULL
      `;

  }

  __getListingOfPriceTacticSqlPartP4() {
    return `
      AND NOT(JSON_CONTAINS( tags, '["p3"]' ))   -- 不能包含清仓策略，因为其无视优先级
      AND JSON_EXTRACT( tags, '$[0]' ) = "p4"    -- 调价策略的第一项为 p4
      AND (
        -- 目标库存天数、当前 FBA 可售、当前日均单量 不为空
        ( 
          tactic_normal_target_inventory_days_min IS NOT NULL 
          AND tactic_normal_target_inventory_days_max IS NOT NULL 
          AND afn_fulfillable_quantity IS NOT NULL 
          AND daily_order_quantity IS NOT NULL 
        )
        
        -- 目标日均出单、当前日均单量 不为空
        OR ( 
          tactic_normal_target_daily_order_quantity IS NOT NULL 
          AND tactic_normal_target_daily_order_quantity_alert_threshold IS NOT NULL 
          AND daily_order_quantity IS NOT NULL
        )
        
        -- 关键词搜索量数据 不为空 
        OR ( kw_search_volume_anal_res IS NOT NULL ) 
      ) 
      `;
  }


  async saveListingEntity(listing: AppAmzListingEntity) {
    return await this.amzListingRepo.save(listing);
  }


  async getListingTotalCount(valid: boolean = true,
                             additional_where_options: object = {}) {
    let whereOptions = additional_where_options;
    if (valid) {
      Object.assign(whereOptions, {is_delete: 0, status: 1});
    }
    return await this.amzListingRepo.count({where: whereOptions});
  }


  async modifyPrice(listingList: Array<AppAmzListingEntity>) {
    let res = await this.lingXingUtils.httpPost('/erp/sc/listing/ProductPricing/pricingSubmit', {
      pricing_params: listingList.map(listing => {
        return {
          sid: listing.sid,
          msku: listing.seller_sku,
          standard_price: listing.tactic_price_suggested_new_price,
        };
      }),
    });
    return res;
  }

  async createPurchasePlan(listingList: Array<AppAmzListingEntity>, remark = '由艾为系统创建') {
    if (!remark) remark = '-';
    let res = await this.lingXingUtils.httpPost(
      '/erp/sc/routing/data/local_inventory/createPurchasePlan',
      {
        data: listingList.map(listing => {
          return {
            sid: listing.sid,
            sku: listing.local_sku,
            quantity_plan: parseInt(listing.tactic_inventory_new_quantity_plan.toString()),
          };
        }),
        remark,
      },
      true,
    );
    return res;
  }

  async queryLocalProductInfo(sku_list: string[] = []) {
    try {
      let res = await this.lingXingUtils.httpPost(
        '/erp/sc/routing/data/local_inventory/productList',
        {
          offset: 0,
          length: 1000,
          sku_list,
        },
      );
      return res;
    } catch (err) {
      console.log(err);
      return err;
    }
  }

}
