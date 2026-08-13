import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, QueryRunner,In  } from 'typeorm';
import { AppAmzBsrProductListingLingxingEntity } from "../entity/bsr_product_Listing_Lingxing";
import { LingXingUtils, ListingStatus } from '../utils/lingxing/lingxingUtils';
import { SellerspriteTool } from '../utils/maijiajingling/SellerspriteUtil';
import { AppAmzBsrCandidateCompetitorEntity } from "../entity/bsr_candidate_competitor";
import { AppAmzBsrRestockingCenterLingxingEntity } from "../entity/bsr_restocking_center_lingxing";
import { BaseSysUserEntity } from "../../base/entity/sys/user";
import * as dayjs from 'dayjs';
import * as _ from 'lodash';
import {
  foldLingxingListingRows,
  paginateLingxingTopLevelRows,
} from './bsr_product_listing_lingxing_fold';
import {
  normalizeLingxingLocalNameWithProductCode,
  parseNumberedLingxingLocalName,
} from './bsr_product_listing_lingxing_local_name';
import {
  shouldPersistLingxingListing,
  shouldRunLingxingListingBusinessFlow,
} from './bsr_product_listing_lingxing_sync_policy';

export interface RepairHyphenProductCodeLocalNamesParams {
  dryRun?: boolean;
  ids?: number[];
  product_code?: string;
  limit?: number;
}

export interface RepairHyphenProductCodeLocalNameItem {
  id: number;
  msku: string;
  asin: string;
  marketplace: string;
  productCode: string;
  oldLocalName: string;
  newLocalName: string;
  status: 'preview' | 'updated' | 'failed';
  error?: string;
}

@Provide()
export class AppAmzBsrProductListingLingxingService extends BaseService {
  @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
  bsrProductListingLingxingRepo: Repository<AppAmzBsrProductListingLingxingEntity>;

  @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;

  @InjectEntityModel(AppAmzBsrRestockingCenterLingxingEntity)
  restockingRepo: Repository<AppAmzBsrRestockingCenterLingxingEntity>;

  @InjectEntityModel(BaseSysUserEntity)
  userEntity: Repository<BaseSysUserEntity>;

  @Inject()
  private lingXingUtils: LingXingUtils;

  @Inject()
  private sellerspriteTool: SellerspriteTool;

  @Inject()
  ctx;


  /**
   * 保存往期规则
   */
  async saveHistoryRule(body: any) {
    const { product_code, rule_nearly_30_days, rule_history_month } = body;
    if (!product_code) throw new Error('Product Code is required');

    // Update all listings with the same product_code
    await this.bsrProductListingLingxingRepo.update(
        { product_code },
        {
            rule_nearly_30_days: rule_nearly_30_days || null,
            rule_history_month: rule_history_month || null
        }
    );

    return { success: true };
  }

  /**
   * 执行往期规则：重新获取竞品详情 -> 判断规则 -> 更新状态
   */
  async executeHistoryRule(body: any) {
      const { product_code, rule_nearly_30_days, rule_history_month } = body;
      if (!product_code) throw new Error('Product Code is required');

      // 1. 获取该 product_code 下的所有 Listing ASIN
      const listings = await this.bsrProductListingLingxingRepo.find({
          where: { product_code },
          select: ['asin', 'marketplace', 'rule_nearly_30_days', 'rule_history_month']
      });

      if (!listings || listings.length === 0) return { success: true, message: 'No listings found' };

      // 优先使用传入的规则，如果没有传入则使用数据库中的规则
      const finalRuleNearly30Days = rule_nearly_30_days !== undefined ? rule_nearly_30_days : listings[0].rule_nearly_30_days;
      const finalRuleHistoryMonth = rule_history_month !== undefined ? rule_history_month : listings[0].rule_history_month;

      // 提取有效的 ASIN 和国家组合
      const validListings = listings.filter(l => l.asin && l.marketplace);
      if (validListings.length === 0) return { success: true, message: 'No valid ASINs or marketplaces found' };

      // 构建精准查询条件：匹配具体的 (asin_candidate AND marketplace)
      const whereConditions = validListings.map(l => ({
          asin_candidate: l.asin,
          marketplace: l.marketplace,
          status: In([6, 7, 2]) // 直接在数据库查询时过滤状态
      }));

      // 2. 找到关联的竞品 (Candidate Competitors)
      const candidateCompetitors = await this.bsrCandidateCompetitorRepo.find({
          where: whereConditions
      });

      console.log(`[executeHistoryRule] Found ${candidateCompetitors?.length || 0} competitors for product_code: ${product_code} with statuses 6,7`);

      if (!candidateCompetitors || candidateCompetitors.length === 0) {
           return { success: true, message: 'No competitors found in On Sale or History status' };
      }

      // 3. 重新获取竞品详情 (调用 Sellersprite API)
      // 按市场分组
      const asinsByMarketplace = {};
      candidateCompetitors.forEach(c => {
          if (!c.asin_competitor || !c.marketplace) return;
          if (!asinsByMarketplace[c.marketplace]) asinsByMarketplace[c.marketplace] = [];
          if (!asinsByMarketplace[c.marketplace].includes(c.asin_competitor)) {
             asinsByMarketplace[c.marketplace].push(c.asin_competitor);
          }
      });

      for (const marketplace of Object.keys(asinsByMarketplace)) {
          const asins = asinsByMarketplace[marketplace];

          // 分批处理，每批 40 个
          const chunkSize = 40;
          for (let i = 0; i < asins.length; i += chunkSize) {
              const chunkAsins = asins.slice(i, i + chunkSize);
              const apiParams = {
                  marketplace,
                  asins: chunkAsins,
                  type: 'sales',
                  historyRuleMonth: finalRuleHistoryMonth
              };

              try {
                // 获取最新数据
                // competitorLookupOpenApi 内部已调用 updateCompetitorLookupData 处理了数据更新及无数据时的状态置为 7
                await this.sellerspriteTool.competitorLookupOpenApi(apiParams);
              } catch (e) {
                  console.error(`Failed to update competitors for ${marketplace} chunk`, e);
              }
          }
      }

      // 4. 根据规则更新状态 (只更新状态 6 和 7)
      await this.applyRulesForProductCode(product_code, finalRuleNearly30Days, finalRuleHistoryMonth, [6, 7]);

    return { success: true };
  }

  /**
   * 根据 product_code 应用往期规则
   * @param productCode 产品代码
   * @param ruleNearly30Days 近30天规则
   * @param ruleHistoryMonth 历史月份规则
   * @param targetStatuses 目标状态列表 (可选, 默认为空, 表示不筛选)
   */
  async applyRulesForProductCode(productCode: string, ruleNearly30Days?: string, ruleHistoryMonth?: string, targetStatuses: number[] = []) {
      // 如果没有传入规则，尝试从数据库获取
      if (ruleNearly30Days === undefined || ruleHistoryMonth === undefined) {
          const listing = await this.bsrProductListingLingxingRepo.findOne({
              where: { product_code: productCode }
          });
          if (listing) {
              ruleNearly30Days = listing.rule_nearly_30_days;
              ruleHistoryMonth = listing.rule_history_month;
          }
      }

      // 先找到 product_code 下的所有 Listing ASIN 和国家
      const listings = await this.bsrProductListingLingxingRepo.find({
          where: { product_code: productCode },
          select: ['asin', 'marketplace']
      });

      const validListings = listings.filter(l => l.asin && l.marketplace);
      if (validListings.length === 0) return;

      const whereConditions = validListings.map(l => ({
          asin_candidate: l.asin,
          marketplace: l.marketplace,
          ...(targetStatuses && targetStatuses.length > 0 ? { status: In(targetStatuses) } : {})
      }));

      // 重新查询更新后的竞品数据
      const updatedCompetitors = await this.bsrCandidateCompetitorRepo.find({ where: whereConditions });

      for (const comp of updatedCompetitors) {
          const isHistory = this.checkIfShouldBeHistory(comp, ruleNearly30Days, ruleHistoryMonth);

          if (isHistory) {
             comp.status = 7; // 往期
          } else {
             if (comp.status === 7 || comp.status === 6) {
                 comp.status = 6; // 在售
             }
          }
      }

      // 批量保存状态更新
      if (updatedCompetitors.length > 0) {
          await this.bsrCandidateCompetitorRepo.save(updatedCompetitors);
      }
  }

  /**
   * 判断竞品是否应该进入往期
   * @param comp 竞品实体
   * @param ruleNearly30Days 近30天规则 ('nearly' or null)
   * @param ruleHistoryMonth 历史月份规则 ('YYYY-MM' or null)
   */
  checkIfShouldBeHistory(comp: AppAmzBsrCandidateCompetitorEntity, ruleNearly30Days: string, ruleHistoryMonth: string): boolean {
      if (!ruleNearly30Days && !ruleHistoryMonth) return false;

      // 逻辑修改为 AND 关系：
      // 只有当所有被选中的规则都满足“无数据”条件时，才标记为往期。
      // 换句话说，只要有一个被选中的规则显示“有数据”，就不进往期。

      let isSafe = false; // 是否“安全”（即有数据，不进往期）
      let activeRulesCount = 0;

      // 规则 1: 近30天无返回数据
      if (ruleNearly30Days === 'nearly') {
          activeRulesCount++;
          // 根据是否有返回数据（Main_monthly_sales 是否为 null）来判断。
          // 如果有数据返回（哪怕销量为 0），都是安全的。
          if (comp.Main_monthly_sales !== null) {
              isSafe = true;
          }
      }

      // 规则 2: 历史月份销量
      if (ruleHistoryMonth) {
          activeRulesCount++;
          const historyMonthDate = dayjs(ruleHistoryMonth);
          let salesHistory = [];
          try {
              salesHistory = typeof comp.sales_volume_data === 'string'
                  ? JSON.parse(comp.sales_volume_data)
                  : comp.sales_volume_data;
          } catch (e) {}

          if (Array.isArray(salesHistory)) {
              const targetMonthStr = historyMonthDate.format('YYYYMM');
              const targetRecord = salesHistory.find(r => r.date === Number(targetMonthStr) || r.date === targetMonthStr);

              // 如果找到了记录，且 searches > 0 (或者仅仅是存在记录？通常看销量是否>0)
              // 原逻辑是: !targetRecord || !targetRecord.searches || targetRecord.searches === 0 -> 往期
              // 所以反过来：targetRecord && targetRecord.searches > 0 -> 安全
              if (targetRecord && targetRecord.searches > 0) {
                  isSafe = true;
              }
          }
      }

      // 如果没有启用任何规则，不进往期
      if (activeRulesCount === 0) return false;

      // 如果只要有一个规则判定为安全（有数据），就不进往期
      if (isSafe) return false;

      // 所有启用的规则都判定为无数据 -> 进往期
      return true;
  }

  /**
   * 分页查询
   * @param query
   */
  async page(query) {
      const { keyWord, searchField, searchKeywordList, sellableDaysType, sellableDaysOperator, sellableDaysValue, stockoutRiskFilter, dataStatus, parentFold, prop, order, sort, ...others } = query;

      const fieldEq = ['mergeId','msku','asin','shop','item_name','status','marketplace','product_code',
        'outOfStockStatus',
        'abnormalOfflineStatus',
        'newProductStatus',
        'needUpdateOperationPlan',
        'categoryTrafficStatus',
        'productTrafficStatus',
        'salesChangeStatus',
        'stockOver90Days',
        'seller_name','inventoryStatusText'];

      const fieldIn = ['in_transit_type'];

      const totalSellableDaysSourceExpr = `
          JSON_UNQUOTE(JSON_EXTRACT(ANY_VALUE(b.suggestInfo), '$.availableSaleDays'))
      `;

      const totalSellableDaysExpr = `
        CASE
            WHEN a.dailyAvgSales IS NOT NULL AND a.dailyAvgSales != 0
            THEN FLOOR((
                COALESCE(a.afn_fulfillable_quantity, 0) +
                COALESCE(a.reserved_fc_transfers, 0) +
                COALESCE(a.reserved_fc_processing, 0) +
                COALESCE(a.reserved_customerorders, 0) +
                COALESCE(a.afn_inbound_shipped_quantity, 0) +
                COALESCE(a.afn_unsellable_quantity, 0) +
                COALESCE(a.afn_inbound_working_quantity, 0) +
                COALESCE(a.afn_inbound_receiving_quantity, 0)
            ) / a.dailyAvgSales)
            ELSE 999
        END
    `;

      const fbaSellableDaysExpr = `
          CASE
              WHEN a.sellableDays IS NOT NULL
              THEN CAST(a.sellableDays AS DECIMAL(10,2))
              WHEN a.dailyAvgSales IS NOT NULL AND a.dailyAvgSales != 0
              THEN FLOOR(COALESCE(a.afn_fulfillable_quantity, 0) / a.dailyAvgSales)
              ELSE 999
          END
      `;

      const mappedMarketplaceExpr = `
          CASE a.marketplace
              WHEN '英国' THEN 'UK'
              WHEN '德国' THEN 'DE'
              WHEN '法国' THEN 'FR'
              WHEN '意大利' THEN 'IT'
              WHEN '西班牙' THEN 'ES'
              WHEN '美国' THEN 'US'
              WHEN '加拿大' THEN 'CA'
              WHEN '日本' THEN 'JP'
              ELSE a.marketplace
          END
      `;

      // 1. 获取当前用户信息，并根据店铺权限过滤
      const userId = this.ctx.admin?.userId;
      const username = this.ctx.admin?.username;
      let sidListStr = '';
      if (username !== 'admin') {
          const user = await this.userEntity.findOne({ where: { id: userId } });
          if (user && user.sidList && user.sidList.length > 0) {
              sidListStr = user.sidList.join(',');
          } else {
              // 普通用户如果没有配置店铺权限，则返回空数据
              sidListStr = '-1';
          }
      }

      const hasRiskShipmentExpr = `
          EXISTS (
              SELECT 1
              FROM app_amz_bsr_restocking_center_lingxing risk_b
              JOIN JSON_TABLE(
                  COALESCE(risk_b.fbaShippingList, JSON_ARRAY()),
                  '$[*]' COLUMNS (
                      shipment_status VARCHAR(20) PATH '$.shipment_status',
                      amazonSaleDate VARCHAR(50) PATH '$.amazonSaleDate',
                      quantity DECIMAL(10,2) PATH '$.quantity'
                  )
              ) risk_ship ON 1 = 1
              WHERE risk_b.asin = a.asin
                AND (
                  JSON_CONTAINS(risk_b.marketplaceList, JSON_QUOTE(a.marketplace))
                  OR JSON_CONTAINS(risk_b.marketplaceList, JSON_QUOTE(${mappedMarketplaceExpr}))
                )
                AND (
                  (
                    a.seller_name IS NOT NULL
                    AND TRIM(a.seller_name) != ''
                    AND JSON_CONTAINS(risk_b.storeList, JSON_QUOTE(TRIM(a.seller_name)))
                  )
                  OR a.seller_name IS NULL
                  OR TRIM(a.seller_name) = ''
                )
                AND (
                    risk_ship.shipment_status = '断'
                    OR (
                        risk_ship.amazonSaleDate IS NOT NULL
                        AND risk_ship.amazonSaleDate != ''
                        AND COALESCE(a.dailyAvgSales, 0) > 0
                        AND CAST(risk_ship.amazonSaleDate AS DATETIME) > DATE_ADD(
                            NOW(),
                            INTERVAL FLOOR(
                                (
                                    COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(risk_b.amazonQuantityInfo, '$.afnFulfillableQuantity')) AS SIGNED), a.afn_fulfillable_quantity, 0)
                                    + COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(risk_b.amazonQuantityInfo, '$.reservedFcTransfers')) AS SIGNED), a.reserved_fc_transfers, 0)
                                    + COALESCE(CAST(JSON_UNQUOTE(JSON_EXTRACT(risk_b.amazonQuantityInfo, '$.reservedFcProcessing')) AS SIGNED), a.reserved_fc_processing, 0)
                                    + (
                                        SELECT COALESCE(SUM(jt_inner.quantity), 0)
                                        FROM JSON_TABLE(
                                            COALESCE(risk_b.fbaShippingList, JSON_ARRAY()),
                                            '$[*]' COLUMNS (
                                                amazonSaleDate VARCHAR(50) PATH '$.amazonSaleDate',
                                                quantity DECIMAL(10,2) PATH '$.quantity'
                                            )
                                        ) jt_inner
                                        WHERE jt_inner.amazonSaleDate IS NOT NULL
                                          AND jt_inner.amazonSaleDate != ''
                                          AND CAST(jt_inner.amazonSaleDate AS DATETIME) < CAST(risk_ship.amazonSaleDate AS DATETIME)
                                    )
                                )
                                / a.dailyAvgSales
                            ) DAY
                        )
                    )
                )
          )
      `;

      const customSortFieldMap = {
          totalSellableDaysSort: 'total_sellable_days_calc',
          fbaSellableDaysSort: 'fba_sellable_days_calc',
          afn_fulfillable_quantity: 'COALESCE(a.afn_fulfillable_quantity, 0)',
          afn_reserved_quantity: '(COALESCE(a.reserved_fc_transfers, 0) + COALESCE(a.reserved_fc_processing, 0) + COALESCE(a.reserved_customerorders, 0))',
          restocking_fba_shipping: '(COALESCE(a.afn_inbound_shipped_quantity, 0) + COALESCE(a.afn_inbound_working_quantity, 0) + COALESCE(a.afn_inbound_receiving_quantity, 0))',
          restocking_local_valid: 'COALESCE(a.quantity, 0)',
          score_nf: 'score_nf',
          score_sp: 'score_sp',
          behind_rate_nf: 'behind_rate_nf',
          behind_rate_sp: 'behind_rate_sp',
          restocking_quantity_sug_purchase: 'restocking_quantity_sug_purchase_calc',
      };

      let sql = `
          SELECT
              a.*,
              ANY_VALUE(b.id) as restocking_id,
              ANY_VALUE(b.realtimeSales) as restocking_realtimeSales,
              ANY_VALUE(b.salesInfo) as restocking_salesInfo,
              ANY_VALUE(b.fbaValidList) as restocking_fbaValidList,
              ANY_VALUE(b.fbaShippingList) as restocking_fbaShippingList,
              ANY_VALUE(b.suggestInfo) as restocking_suggestInfo,
              ANY_VALUE(s.score_nf) as score_nf,
              ANY_VALUE(s.score_sp) as score_sp,
              ANY_VALUE(s.behind_rate_nf) as behind_rate_nf,
              ANY_VALUE(s.behind_rate_sp) as behind_rate_sp,
              ANY_VALUE(s.competitor_count) as competitor_count,
              ANY_VALUE(s.behind_count_nf) as behind_count_nf,
              ANY_VALUE(s.behind_count_sp) as behind_count_sp,
              ANY_VALUE(s.summary_date) as summary_date,
              ${totalSellableDaysExpr} as total_sellable_days_calc,
              ${fbaSellableDaysExpr} as fba_sellable_days_calc,
              CAST(JSON_UNQUOTE(JSON_EXTRACT(ANY_VALUE(b.suggestInfo), '$.quantitySugPurchase')) AS DECIMAL(10,2)) as restocking_quantity_sug_purchase_calc
          FROM
              app_amz_bsr_product_listing_lingxing a
              LEFT JOIN app_amz_bsr_restocking_center_lingxing b ON a.asin = b.asin
              AND (
                JSON_CONTAINS(b.marketplaceList, JSON_QUOTE(a.marketplace))
                OR
                JSON_CONTAINS(b.marketplaceList, JSON_QUOTE(${mappedMarketplaceExpr}))
              )
              AND (
                (
                  JSON_CONTAINS(b.storeList, JSON_QUOTE(a.seller_name))
                  AND JSON_SEARCH(JSON_EXTRACT(b.relationListing, '$[*].msku'), 'one', a.msku) IS NOT NULL
                )
                OR JSON_CONTAINS(b.storeList, JSON_QUOTE(a.seller_name))
                OR JSON_SEARCH(JSON_EXTRACT(b.relationListing, '$[*].msku'), 'one', a.msku) IS NOT NULL
              )
              LEFT JOIN (
                  SELECT *
                  FROM (
                      SELECT
                          s0.*,
                          ROW_NUMBER() OVER (
                              PARTITION BY
                                  COALESCE(s0.store_id, 0),
                                  s0.marketplace,
                                  s0.product_code,
                                  s0.asin_self,
                                  COALESCE(s0.msku, '')
                              ORDER BY COALESCE(s0.last_calc_time, s0.updateTime, s0.createTime) DESC, s0.id DESC
                          ) AS rn
                      FROM app_amz_bsr_keyword_tracking_summary s0
                      WHERE s0.summary_date = CURDATE()
                  ) ranked_summary
                  WHERE ranked_summary.rn = 1
              ) s ON s.store_id = a.store_id
                  AND s.marketplace = a.marketplace
                  AND s.product_code = a.product_code
                  AND s.asin_self = a.asin
                  AND s.msku <=> a.msku
          WHERE 1 = 1
      `;

      if (username !== 'admin') {
          if (sidListStr === '-1') {
              sql += ' AND 1 = 0'; // 没有店铺权限，返回空
          } else if (sidListStr !== '') {
              sql += ` AND a.store_id IN (${sidListStr})`;
          }
      }

      // 处理 fieldEq
      for (const field of fieldEq) {
          const val = others[field];
          if (val !== undefined && val !== '') {
               if (Array.isArray(val)) {
                   sql += this.setSql(true, ` AND a.${field} IN (?)`, [val]);
               } else {
                   sql += this.setSql(true, ` AND a.${field} = ?`, [val]);
               }
          }
      }

      // 处理 fieldIn
      for (const field of fieldIn) {
          const val = others[field];
          if (val !== undefined && val !== '' && Array.isArray(val) && val.length > 0) {
              sql += this.setSql(true, ` AND a.${field} IN (?)`, [val]);
          }
      }

      // 处理 keyWord
      if (keyWord) {
          const likeFields = ['mergeId','msku','asin','shop','item_name','product_code','local_name'];
          const conditions = likeFields.map(f => `a.${f} LIKE ?`).join(' OR ');
          const params = likeFields.map(() => `%${keyWord}%`);
          sql += this.setSql(true, ` AND (${conditions})`, params);
      }

      if (searchField && Array.isArray(searchKeywordList) && searchKeywordList.length > 0) {
          const keywordList = searchKeywordList
              .map(item => String(item || '').trim())
              .filter(Boolean);

          if (searchField === 'item_name' || searchField === 'local_name') {
              const conditions = keywordList.map(() => `a.${searchField} LIKE ?`).join(' OR ');
              const params = keywordList.map(item => `%${item}%`);
              sql += keywordList.length ? this.setSql(true, ` AND (${conditions})`, params) : '';
          } else if ([  'msku', 'asin', 'product_code'].includes(searchField)) {
              sql += this.setSql(true, ` AND a.${searchField} IN (?)`, [keywordList]);
          }
      }

      if (stockoutRiskFilter === 'risk') {
          sql += ` AND ${hasRiskShipmentExpr} `;
      } else if (stockoutRiskFilter === 'safe') {
          sql += ` AND NOT (${hasRiskShipmentExpr}) `;
      }

      // 数据状态筛选
      if (dataStatus) {
          // 优化查询性能，避免 OR 导致全表扫描，分为有 product_code 和无 product_code 两种情况进行 EXISTS
          const noCompetitorSql = `
              (
                  (a.product_code IS NOT NULL AND a.product_code != '' AND NOT EXISTS (
                      SELECT 1 FROM app_amz_bsr_product_listing_lingxing inner_a
                      JOIN app_amz_bsr_candidate_competitor c ON c.asin_candidate = inner_a.asin
                      WHERE inner_a.product_code = a.product_code
                        AND c.status IN (2, 6)
                        AND c.marketplace IN ('UK', 'DE', 'FR', 'ES', 'IT', '英国', '德国', '法国', '西班牙', '意大利')
                  ))
                  OR
                  ((a.product_code IS NULL OR a.product_code = '') AND NOT EXISTS (
                      SELECT 1 FROM app_amz_bsr_candidate_competitor c
                      WHERE c.asin_candidate = a.asin
                        AND c.status IN (2, 6)
                        AND c.marketplace IN ('UK', 'DE', 'FR', 'ES', 'IT', '英国', '德国', '法国', '西班牙', '意大利')
                  ))
              )
          `;

          const noKeywordSql = `
              (
                  (a.product_code IS NOT NULL AND a.product_code != '' AND NOT EXISTS (
                      SELECT 1 FROM app_amz_bsr_product_listing_lingxing inner_a
                      JOIN app_amz_listing_keyword k ON k.asin = inner_a.asin
                      WHERE inner_a.product_code = a.product_code
                  ))
                  OR
                  ((a.product_code IS NULL OR a.product_code = '') AND NOT EXISTS (
                      SELECT 1 FROM app_amz_listing_keyword k
                      WHERE k.asin = a.asin
                  ))
              )
          `;

          if (dataStatus === 1 || dataStatus === '1') {
              // 无竞品数据
              sql += ` AND ${noCompetitorSql} `;
          } else if (dataStatus === 2 || dataStatus === '2') {
              // 无关键词数据
              sql += ` AND ${noKeywordSql} `;
          } else if (dataStatus === 3 || dataStatus === '3') {
              // 无竞品关键词数据 (同时满足)
              sql += ` AND ${noCompetitorSql} AND ${noKeywordSql} `;
          }
      }

      const havingClauses: string[] = [];

      // 处理可售天数筛选
      if (sellableDaysType && sellableDaysOperator && sellableDaysValue !== undefined && sellableDaysValue !== '') {
          const val = Number(sellableDaysValue);
          let field = '';

          if (sellableDaysType === 'fba') {
              field = 'fba_sellable_days_calc';
          } else if (sellableDaysType === 'total') {
              field = 'total_sellable_days_calc';
          }

          if (field && !Number.isNaN(val)) {
              const allowedOps = ['gt', 'gte', 'lt', 'lte', 'eq'];
              if (allowedOps.includes(sellableDaysOperator)) {
                  const opMap = { gt: '>', gte: '>=', lt: '<', lte: '<=', eq: '=' };
                  const castField = `${field}`;
                  // 2026-04-01: HAVING 条件也要通过 setSql 注入参数，不能直接保留 ?
                  havingClauses.push(this.setSql(true, `${castField} ${opMap[sellableDaysOperator]} ?`, [val]));

                  // 2026-04-03: 修改过滤逻辑，只要是大于、大于等于、小于、小于等于，都排除 999
                  // 原代码: if (sellableDaysType === 'total' && ['lt', 'lte'].includes(sellableDaysOperator) && val < 999) {
                  if (['gt', 'gte', 'lt', 'lte'].includes(sellableDaysOperator)) {
                      havingClauses.push(`${castField} < 999`);
                  }
              }
          }
      }

      // 增加 GROUP BY 防止一对多关联导致的数据重复
      sql += ` GROUP BY a.id `;

      if (havingClauses.length > 0) {
          sql += ` HAVING ${havingClauses.join(' AND ')} `;
      }

      let autoSort = true;
      const customSortProp = typeof prop === 'string' && customSortFieldMap[prop]
          ? prop
          : typeof order === 'string' && customSortFieldMap[order]
              ? order
              : typeof sort === 'string' && customSortFieldMap[sort]
                  ? sort
                  : undefined;

      let customSortOrder = undefined;
      if (typeof order === 'string' && ['asc', 'desc', 'ascending', 'descending'].includes(String(order).toLowerCase())) {
          customSortOrder = String(order).toLowerCase().startsWith('desc') ? 'desc' : 'asc';
      } else if (typeof sort === 'string' && ['asc', 'desc', 'ascending', 'descending'].includes(String(sort).toLowerCase())) {
          customSortOrder = String(sort).toLowerCase().startsWith('desc') ? 'desc' : 'asc';
      }

      if (customSortProp && customSortOrder) {
          autoSort = false;
          sql += ` ORDER BY ${customSortFieldMap[customSortProp]} ${customSortOrder}`;
          // 移除原始 query 中的 order 和 sort 参数，避免被 baseService 处理
          delete query.order;
          delete query.sort;
      }

      // 2026-04-01: 增加日志以排查 SQL 语法错误
    //   console.log("=== FINAL SQL BEFORE RENDER ===");
    //   console.log(sql);
    //   console.log("=== FINAL SQL PARAMS ===");
    //   console.log(this.sqlParams);
    //   console.log("===============================");

      const parentFoldEnabled = parentFold === 1 || parentFold === '1' || parentFold === true;
      const rawResult = await this.sqlRenderPage(
        sql,
        parentFoldEnabled
          ? { ...query, isExport: true, maxExportLimit: 0 }
          : query,
        autoSort
      );
      const result = parentFoldEnabled
        ? paginateLingxingTopLevelRows(
            foldLingxingListingRows(rawResult.list),
            Number(query.page),
            Number(query.size)
          )
        : rawResult;
      const resultListingRows = (result.list || []).flatMap((row: any) =>
        row?._isParentAggregate ? row._children || [] : [row]
      );

      // 2026-04-21: 新增需求 - 关联 FBA Shipment Report
      if (resultListingRows.length > 0) {
          const mskuList = Array.from(new Set(resultListingRows.map((row: any) => (row.msku || '').trim()).filter((m: string) => m)));
          if (mskuList.length > 0) {
              const conditions = mskuList.map(() => `JSON_SEARCH(item_list, 'one', ?) IS NOT NULL`).join(' OR ');
              const fbaShipments = await this.bsrProductListingLingxingRepo.manager.query(`
                  SELECT *
                  FROM app_amz_lingxing_fba_shipment_report
                  WHERE (${conditions})
                  AND shipment_status NOT IN ('CANCELLED', 'DELETE', 'ERROR')
                  ORDER BY gmt_create ASC
              `, mskuList);

              const mskuShipmentMap: Record<string, any> = {};
              for (const shipment of fbaShipments) {
                  if (!shipment.item_list) continue;
                  const itemListStr = typeof shipment.item_list === 'string' ? shipment.item_list : JSON.stringify(shipment.item_list);
                  for (const msku of mskuList as string[]) {
                      // 简单做字符串匹配
                      if (itemListStr.includes(msku) && !mskuShipmentMap[msku]) {
                          mskuShipmentMap[msku] = shipment;
                      }
                  }
              }

              resultListingRows.forEach((row: any) => {
                  const msku = (row.msku || '').trim();
                  if (msku && mskuShipmentMap[msku]) {
                      const shipment = mskuShipmentMap[msku];
                      row.fba_shipment_status = shipment.shipment_status;
                      row.fba_shipment_id = shipment.shipment_id; // 2026-04-23: 把绑定的货件单号返回给前端

                      let currentStatusTime = '';
                    if (shipment.shipment_status === 'WORKING') currentStatusTime = shipment.working_time;
                    else if (shipment.shipment_status === 'SHIPPED') currentStatusTime = shipment.shipped_time;
                    else if (shipment.shipment_status === 'RECEIVING') currentStatusTime = shipment.receiving_time;
                    else if (shipment.shipment_status === 'CLOSED') currentStatusTime = shipment.closed_time;
                    else currentStatusTime = shipment.gmt_modified;

                    row.fba_shipment_current_status_time = currentStatusTime;

                    let expectedTime = '';
                    const inboundList = typeof shipment.inbound_shipment_lists === 'string' ? JSON.parse(shipment.inbound_shipment_lists || '[]') : shipment.inbound_shipment_lists;
                    if (inboundList && Array.isArray(inboundList) && inboundList.length > 0) {
                        const validDates = inboundList
                            .map((i: any) => i.expected_arrival_date)
                            .filter((ed: any) => ed && ed !== '1990-01-01' && ed !== '1990-01-01 00:00:00');
                        if (validDates.length > 0) {
                            validDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
                            expectedTime = validDates[0];
                        }
                    }
                    if (!expectedTime && shipment.sta_delivery_start_date) {
                        expectedTime = shipment.sta_delivery_start_date;
                    }
                    row.fba_shipment_expected_time = expectedTime;
                }
            });
          }
      }

      // 处理结果结构和 JSON 解析
      if (resultListingRows.length > 0) {
          const safeJsonParse = (val) => {
              if (typeof val === 'string' && val) {
                  try {
                      return JSON.parse(val);
                  } catch (e) {
                      return val;
                  }
              }
              return val;
          };

          resultListingRows.forEach(row => {
              // 还原 restocking 对象
              row.restocking = {
                  id: row.restocking_id,
                  realtimeSales: row.restocking_realtimeSales,
                  salesInfo: safeJsonParse(row.restocking_salesInfo),
                  fbaValidList: safeJsonParse(row.restocking_fbaValidList),
                  fbaShippingList: safeJsonParse(row.restocking_fbaShippingList),
                  suggestInfo: safeJsonParse(row.restocking_suggestInfo),
              };

              row.stockDays = row.total_sellable_days_calc;
              row.sellableDays = row.fba_sellable_days_calc;

              // 删除临时字段
              delete row.restocking_id;
              delete row.restocking_realtimeSales;
              delete row.restocking_salesInfo;
              delete row.restocking_fbaValidList;
              delete row.restocking_fbaShippingList;
              delete row.restocking_suggestInfo;
              delete row.total_sellable_days_calc;
              delete row.fba_sellable_days_calc;
              delete row.restocking_quantity_sug_purchase_calc;

              // 解析 Listing 的 JSON 字段
              ['rank', 'small_rank', 'seller_category', 'variant_text', 'tags'].forEach(key => {
                  row[key] = safeJsonParse(row[key]);
              });
          });
      }

      return result;
  }

  /**
   * Listing + Lingxing product performance ad data page.
   */
  async adPerformancePage(query: any = {}) {
      const pageNum = Math.max(Number(query.page) || 1, 1);
      const pageSize = Math.min(Math.max(Number(query.size) || 20, 1), 200);
      const offset = (pageNum - 1) * pageSize;

      const conditions: string[] = ['1 = 1'];
      const params: any[] = [];

      const addInCondition = (field: string, value: any) => {
          const values = Array.isArray(value)
              ? value.filter(v => v !== undefined && v !== null && String(v).trim() !== '')
              : value !== undefined && value !== null && String(value).trim() !== ''
                  ? [value]
                  : [];
          if (values.length === 0) return;
          conditions.push(`${field} IN (${values.map(() => '?').join(',')})`);
          params.push(...values);
      };

      const keyword = String(query.keyWord || query.keyword || '').trim();
      if (keyword) {
          const like = `%${keyword}%`;
          conditions.push(`(
              a.asin LIKE ?
              OR a.msku LIKE ?
              OR a.fnsku LIKE ?
              OR a.item_name LIKE ?
              OR a.shop LIKE ?
              OR a.seller_name LIKE ?
              OR a.product_code LIKE ?
          )`);
          params.push(like, like, like, like, like, like, like);
      }

      addInCondition('a.marketplace', query.marketplace);
      addInCondition('a.seller_name', query.seller_name);
      addInCondition('a.shop', query.shop);
      addInCondition('a.status', query.status);

      if (query.asin) {
          conditions.push('a.asin = ?');
          params.push(query.asin);
      }

      if (query.msku) {
          conditions.push('a.msku = ?');
          params.push(query.msku);
      }

      const userId = this.ctx.admin?.userId;
      const username = this.ctx.admin?.username;
      if (username !== 'admin') {
          const user = userId ? await this.userEntity.findOne({ where: { id: userId } }) : null;
          if (user && user.sidList && user.sidList.length > 0) {
              conditions.push(`a.store_id IN (${user.sidList.map(() => '?').join(',')})`);
              params.push(...user.sidList);
          } else {
              conditions.push('1 = 0');
          }
      }

      const whereSql = conditions.join(' AND ');
      const getTableColumns = async (tableName: string) => {
          try {
              const rows = await this.bsrProductListingLingxingRepo.manager.query(`SHOW COLUMNS FROM \`${tableName}\``);
              return new Set<string>((rows || []).map((row: any) => String(row.Field || '')));
          } catch (error) {
              console.warn(`[adPerformancePage] table not available: ${tableName}`, error?.message || error);
              return new Set<string>();
          }
      };

      const perfColumns = await getTableColumns('app_amz_lingxing_product_performance_asin');
      const profitColumns = await getTableColumns('app_amz_lingxing_profit_report_msku');
      const hasPerfJoin = perfColumns.has('id') && perfColumns.has('primary_value');
      const hasProfitJoin = profitColumns.has('id') && profitColumns.has('msku');
      const perfValue = (column: string) => hasPerfJoin && perfColumns.has(column) ? `perf.${column}` : 'NULL';
      const profitValue = (column: string) => hasProfitJoin && profitColumns.has(column) ? `profit.${column}` : 'NULL';
      const perfSelect = (column: string, alias?: string) => `${perfValue(column)} AS ${alias || column}`;
      const profitSelect = (column: string, alias: string) => `${profitValue(column)} AS ${alias}`;

      const perfWhereParts = [`p2.primary_value = a.asin`];
      if (perfColumns.has('summary_field')) {
          perfWhereParts.unshift(`p2.summary_field = 'asin'`);
      }
      if (perfColumns.has('sid')) {
          perfWhereParts.push(`(p2.sid = a.store_id OR p2.sid = 0 OR p2.sid IS NULL)`);
      }
      const perfOrderParts: string[] = [];
      if (perfColumns.has('sid')) {
          perfOrderParts.push(`
                    CASE
                      WHEN p2.sid = a.store_id THEN 0
                      WHEN p2.sid = 0 THEN 1
                      ELSE 2
                    END`);
      }
      if (perfColumns.has('end_date')) perfOrderParts.push('p2.end_date DESC');
      if (perfColumns.has('updateTime')) perfOrderParts.push('p2.updateTime DESC');
      perfOrderParts.push('p2.id DESC');

      const perfJoinSql = hasPerfJoin ? `
          LEFT JOIN app_amz_lingxing_product_performance_asin perf
              ON perf.id = (
                  SELECT p2.id
                  FROM app_amz_lingxing_product_performance_asin p2
                  WHERE ${perfWhereParts.join(' AND ')}
                  ORDER BY ${perfOrderParts.join(', ')}
                  LIMIT 1
              )
      ` : '';

      const profitWhereParts = ['pr2.msku = a.msku'];
      const profitStoreMatches: string[] = [];
      if (profitColumns.has('storeId')) profitStoreMatches.push('pr2.storeId = CAST(a.store_id AS CHAR)');
      if (profitColumns.has('storeName')) {
          profitStoreMatches.push('pr2.storeName = a.seller_name');
          profitStoreMatches.push('pr2.storeName = a.shop');
      }
      if (profitStoreMatches.length > 0) {
          profitWhereParts.push(`(${profitStoreMatches.join(' OR ')})`);
      }
      const profitOrderParts: string[] = [];
      const profitStoreOrderParts: string[] = [];
      if (profitColumns.has('storeId')) profitStoreOrderParts.push('WHEN pr2.storeId = CAST(a.store_id AS CHAR) THEN 0');
      if (profitColumns.has('storeName')) {
          profitStoreOrderParts.push('WHEN pr2.storeName = a.seller_name THEN 1');
          profitStoreOrderParts.push('WHEN pr2.storeName = a.shop THEN 2');
      }
      if (profitStoreOrderParts.length > 0) {
          profitOrderParts.push(`CASE ${profitStoreOrderParts.join(' ')} ELSE 3 END`);
      }
      if (profitColumns.has('requestEndDate')) profitOrderParts.push('pr2.requestEndDate DESC');
      if (profitColumns.has('updateTime')) profitOrderParts.push('pr2.updateTime DESC');
      profitOrderParts.push('pr2.id DESC');

      const profitJoinSql = hasProfitJoin ? `
          LEFT JOIN app_amz_lingxing_profit_report_msku profit
              ON profit.id = (
                  SELECT pr2.id
                  FROM app_amz_lingxing_profit_report_msku pr2
                  WHERE ${profitWhereParts.join(' AND ')}
                  ORDER BY ${profitOrderParts.join(', ')}
                  LIMIT 1
              )
      ` : '';

      const profitSalesNum = `COALESCE(${profitValue('salesNum')}, 0)`;
      const profitRefundRate = `CASE
          WHEN ABS(COALESCE(${profitValue('refundRate')}, 0)) > 1
          THEN ABS(COALESCE(${profitValue('refundRate')}, 0)) / 100
          ELSE ABS(COALESCE(${profitValue('refundRate')}, 0))
      END`;
      const nonAdUnitCostExpr = `(
          (
              ABS(COALESCE(${profitValue('promotionAmount')}, 0))
              + ABS(COALESCE(${profitValue('platformLogisticsAmount')}, 0))
              + ABS(COALESCE(${profitValue('customOtherSalesOrderAmount')}, 0))
              + ABS(COALESCE(${profitValue('platformStorageAmount')}, 0))
              + ABS(COALESCE(${profitValue('purchaseAmount')}, 0))
              + ABS(COALESCE(${profitValue('transportationAmount')}, 0))
          ) / ${profitValue('salesNum')}
          + (
              a.listing_price * 0.15 * ${profitRefundRate}
              + (ABS(COALESCE(${profitValue('platformLogisticsAmount')}, 0)) / ${profitValue('salesNum')}) * ${profitRefundRate}
          )
      )`;

      const sortFieldMap: Record<string, string> = {
          id: 'a.id',
          listing_price: 'a.listing_price',
          dailyAvgSales: 'a.dailyAvgSales',
          non_ad_unit_cost: 'non_ad_unit_cost',
          non_ad_profit_rate: 'non_ad_profit_rate',
      };
      [
          'spend',
          'ad_sales_amount',
          'ad_order_quantity',
          'impressions',
          'acos',
          'tacos',
          'roas',
          'cpc',
          'cpm',
          'cpo',
          'ctr',
          'ad_cvr',
          'adv_rate',
      ].forEach(column => {
          if (hasPerfJoin && perfColumns.has(column)) sortFieldMap[column] = `perf.${column}`;
      });
      if (hasPerfJoin && perfColumns.has('end_date')) {
          sortFieldMap.performance_end_date = 'perf.end_date';
      }
      const sortProp = typeof query.prop === 'string' && sortFieldMap[query.prop]
          ? query.prop
          : typeof query.order === 'string' && sortFieldMap[query.order]
              ? query.order
              : undefined;
      const sortDirection = ['asc', 'ascending'].includes(String(query.sort || query.order).toLowerCase())
          ? 'ASC'
          : ['desc', 'descending'].includes(String(query.sort || query.order).toLowerCase())
              ? 'DESC'
              : 'DESC';
      const orderSql = sortProp
          ? `${sortFieldMap[sortProp]} ${sortDirection}, a.id DESC`
          : [
              hasPerfJoin && perfColumns.has('end_date') ? 'perf.end_date DESC' : '',
              hasPerfJoin && perfColumns.has('updateTime') ? 'perf.updateTime DESC' : '',
              'a.id DESC'
            ].filter(Boolean).join(', ');

      const countRows = await this.bsrProductListingLingxingRepo.manager.query(
          `SELECT COUNT(1) AS total
           FROM app_amz_bsr_product_listing_lingxing a
           WHERE ${whereSql}`,
          params
      );
      const total = Number(countRows?.[0]?.total || 0);

      const list = await this.bsrProductListingLingxingRepo.manager.query(
          `
          SELECT
              a.id,
              a.asin,
              a.asin_url,
              a.image_url,
              a.image_url AS image_url_display,
              a.status,
              a.abnormalOfflineStatus,
              a.restock_setting_type,
              a.future_restock_date,
              a.newProductStatus,
              a.in_transit_type,
              a.marketplace,
              a.item_name,
              a.shop,
              a.seller_name,
              a.store_id,
              a.msku,
              a.fnsku,
              a.listing_price,
              a.currency_symbol,
              a.dailyAvgSales,
              ${perfSelect('id', 'performance_id')},
              ${perfSelect('start_date', 'performance_start_date')},
              ${perfSelect('end_date', 'performance_end_date')},
              ${perfSelect('currency_code', 'performance_currency_code')},
              ${perfSelect('currency_icon', 'performance_currency_icon')},
              ${perfSelect('spend')},
              ${perfSelect('ad_sales_amount')},
              ${perfSelect('ad_order_quantity')},
              ${perfSelect('impressions')},
              ${perfSelect('clicks')},
              ${perfSelect('ctr')},
              ${perfSelect('ad_cvr')},
              ${perfSelect('adv_rate')},
              ${perfSelect('acos')},
              ${perfSelect('tacos')},
              ${perfSelect('acoas')},
              ${perfSelect('roas')},
              ${perfSelect('asoas')},
              ${perfSelect('cpc')},
              ${perfSelect('cpm')},
              ${perfSelect('cpo')},
              ${perfSelect('ads_sp_cost')},
              ${perfSelect('ads_sd_cost')},
              ${perfSelect('shared_ads_sb_cost')},
              ${perfSelect('shared_ads_sbv_cost')},
              ${perfSelect('ads_sp_sales')},
              ${perfSelect('ads_sd_sales')},
              ${perfSelect('shared_ads_sb_sales')},
              ${perfSelect('shared_ads_sbv_sales')},
              ${profitSelect('salesNum', 'profit_sales_num')},
              ${profitSelect('promotionAmount', 'profit_platform_fee')},
              ${profitSelect('platformLogisticsAmount', 'profit_fba_delivery_fee')},
              ${profitSelect('customOtherSalesOrderAmount', 'profit_other_order_fee')},
              ${profitSelect('platformStorageAmount', 'profit_fba_storage_fee')},
              ${profitSelect('purchaseAmount', 'profit_purchase_amount')},
              ${profitSelect('transportationAmount', 'profit_first_leg_amount')},
              ${profitSelect('refundRate', 'profit_refund_rate')},
              CASE
                WHEN ${profitSalesNum} > 0 THEN ${nonAdUnitCostExpr}
                ELSE NULL
              END AS non_ad_unit_cost,
              CASE
                WHEN COALESCE(a.listing_price, 0) > 0 AND ${profitSalesNum} > 0
                THEN (a.listing_price - ${nonAdUnitCostExpr}) / a.listing_price
                ELSE NULL
              END AS non_ad_profit_rate
          FROM app_amz_bsr_product_listing_lingxing a
          ${perfJoinSql}
          ${profitJoinSql}
          WHERE ${whereSql}
          ORDER BY ${orderSql}
          LIMIT ? OFFSET ?
          `,
          [...params, pageSize, offset]
      );

      return {
          list,
          pagination: {
              page: pageNum,
              size: pageSize,
              total,
          },
      };
  }

  /**
   * 批量更新毛利率任务
   */
  async updateListingGrossProfitTask() {
      const queryRunner = this.bsrProductListingLingxingRepo.manager.connection.createQueryRunner();
      await queryRunner.connect();

      try {
          // 获取所有正常在售的 Listing (status=1)
          const listingList = await queryRunner.manager.find(AppAmzBsrProductListingLingxingEntity, {
              where: { status: ListingStatus.ON_SALE }
          });

          if (listingList.length > 0) {
              await this.lingXingUtils.updateListingGrossProfit(queryRunner, listingList);
          }

          return { success: true, count: listingList.length };
      } catch (error) {
          console.error("更新毛利率任务失败", error);
          throw error;
      } finally {
          await queryRunner.release();
      }
  }

  /**
   * 批量更新竞品详情

   * 1. 筛选 Listing (UK/DE, Status=1)
   * 2. 根据 ASIN+Marketplace 查找 CandidateCompetitor (Status=6)
   * 3. 调用 Sellersprite API 更新数据
   */
  async batchUpdateCompetitorDetails() {
      console.log('开始执行批量更新竞品详情任务...');

      const marketplaceToCode: Record<string, string> = {
          英国: 'UK',
          德国: 'DE',
          法国: 'FR',
          西班牙: 'ES',
          意大利: 'IT',
          美国: 'US',
          日本: 'JP',
          加拿大: 'CA',
          澳大利亚: 'AU'
      };
      const codeToMarketplace: Record<string, string> = {
          UK: '英国',
          DE: '德国',
          FR: '法国',
          ES: '西班牙',
          IT: '意大利',
          US: '美国',
          JP: '日本',
          CA: '加拿大',
          AU: '澳大利亚'
      };

      // 1. 获取符合条件的“种子”Listing (UK/DE, Status=1)
      const targetMarketplaces = ['UK', 'DE', '英国', '德国'];
      const seedListings = await this.bsrProductListingLingxingRepo.find({
          where: {
              status: 1, // 在售
              marketplace: In(targetMarketplaces),
            //   product_code:"1914"
          }
      });

      console.log(`找到符合条件的种子Listing数量: ${seedListings.length}`);
      if (seedListings.length === 0) return { message: '无符合条件的Listing' };

      // 2. 扩展范围：获取相同 product_code 的所有 Listing (仅限 UK/DE)
      // 收集 product_code 和 无 product_code 的 listing ID
      const productCodes = new Set<string>();
      const standaloneListingIds = new Set<number>();

      seedListings.forEach(l => {
          if (l.product_code) {
              productCodes.add(l.product_code);
          } else {
              standaloneListingIds.add(l.id);
          }
      });

      // 构建查询条件
      const queryConditions: any[] = [];
      if (productCodes.size > 0) {
          queryConditions.push({
              product_code: In(Array.from(productCodes)),
              marketplace: In(targetMarketplaces)
          });
      }
      if (standaloneListingIds.size > 0) {
          queryConditions.push({
              id: In(Array.from(standaloneListingIds))
          });
      }

      let allListings: AppAmzBsrProductListingLingxingEntity[] = [];
      if (queryConditions.length > 0) {
          allListings = await this.bsrProductListingLingxingRepo.find({
              where: queryConditions
          });
      }

      console.log(`扩展后的Listing总数: ${allListings.length}`);

      // 3. 收集需要查询的竞品 ASIN (按市场分组)
      const marketAsinMap = new Map<string, Set<string>>();

      for (const listing of allListings) {
          if (!listing.asin || !listing.marketplace) continue;

          const marketplaceCode = marketplaceToCode[listing.marketplace] || listing.marketplace.toUpperCase();
          const dbMarketplace = codeToMarketplace[marketplaceCode] || listing.marketplace;
          const marketplaceCandidates = Array.from(new Set([listing.marketplace, dbMarketplace]));

          // 查找对应的竞品 (Status=6: 手机壳/候选)
          const competitors = await this.bsrCandidateCompetitorRepo.find({
              where: {
                  asin_candidate: listing.asin,
                  marketplace: In(marketplaceCandidates),
                  status: 6
              }
          });

          if (competitors.length > 0) {
              if (!marketAsinMap.has(marketplaceCode)) {
                  marketAsinMap.set(marketplaceCode, new Set());
              }
              const asinSet = marketAsinMap.get(marketplaceCode);
              competitors.forEach(comp => {
                  if (comp.asin_competitor) {
                      asinSet.add(comp.asin_competitor);
                  }
              });
          }
      }

      // 4. 逐个市场调用 API
      const results = [];
      for (const [marketplace, asinSet] of marketAsinMap) {
          const asins = Array.from(asinSet);
          console.log(`正在处理市场 ${marketplace}, 竞品数量: ${asins.length}`);

          if (asins.length === 0) continue;

          try {
              const result = await this.sellerspriteTool.competitorLookupOpenApi({
                  marketplace: marketplace,
                  asins: asins
              });
              results.push(result);
          } catch (error) {
              console.error(`处理市场 ${marketplace} 失败:`, error);
              results.push({ marketplace, success: false, error: (error as Error).message });
          }
      }

      // 5. 应用往期规则
      // 收集所有涉及的 product_code
      const productCodesToProcess = new Set<string>();
      allListings.forEach(l => {
          if (l.product_code) productCodesToProcess.add(l.product_code);
      });

      console.log(`开始应用往期规则，涉及 product_code 数量: ${productCodesToProcess.size}`);
      for (const productCode of productCodesToProcess) {
          try {
              // 全量更新时，只对状态 6 (在售) 的竞品应用规则，避免影响其他状态
              await this.applyRulesForProductCode(productCode, undefined, undefined, [6]);
          } catch (error) {
              console.error(`应用往期规则失败 (product_code: ${productCode}):`, error);
          }
      }

      // 6. [新增] 针对配置了“历史规则月”的Listing，尝试回捞 Status=7 (往期) 的竞品
      // 如果能捞到数据，说明该竞品满足历史规则，应被恢复为 Status=6
      console.log('开始执行全量更新第二阶段：检查配置了历史规则的往期(Status 7)竞品...');

      const historyRuleListings = allListings.filter(l => l.rule_history_month);

      if (historyRuleListings.length > 0) {
          const historyGroups = new Map<string, Set<string>>(); // Key: `${marketplace}|${ruleHistoryMonth}`, Value: Set<ASIN>

          // 批量查询这些Listing对应的 Status 7 竞品
          // 优化：一次性查出所有相关的 Status 7 竞品，然后在内存中匹配
          const historyListingAsins = historyRuleListings.map(l => l.asin).filter(Boolean);
          const status7Competitors = await this.bsrCandidateCompetitorRepo.find({
              where: {
                  asin_candidate: In(historyListingAsins),
                  status: 7
              }
          });

          if (status7Competitors.length > 0) {
              // 构建 Listing 映射以便快速查找规则月
              const listingRuleMap = new Map<string, string>(); // Key: `${asin}|${marketplace}`, Value: rule_history_month
              historyRuleListings.forEach(l => {
                  const marketplaceCode = marketplaceToCode[l.marketplace] || l.marketplace?.toUpperCase();
                  const dbMarketplace = codeToMarketplace[marketplaceCode] || l.marketplace;
                  listingRuleMap.set(`${l.asin}|${l.marketplace}`, l.rule_history_month);
                  listingRuleMap.set(`${l.asin}|${dbMarketplace}`, l.rule_history_month);
                  listingRuleMap.set(`${l.asin}|${marketplaceCode}`, l.rule_history_month);
              });

              // 分组
              for (const comp of status7Competitors) {
                  if (!comp.asin_competitor || !comp.marketplace || !comp.asin_candidate) continue;

                  const ruleMonth = listingRuleMap.get(`${comp.asin_candidate}|${comp.marketplace}`);
                  if (ruleMonth) {
                      const key = `${comp.marketplace}|${ruleMonth}`;
                      if (!historyGroups.has(key)) {
                          historyGroups.set(key, new Set());
                      }
                      historyGroups.get(key).add(comp.asin_competitor);
                  }
              }

              // 执行 API 调用
              for (const [key, asinSet] of historyGroups) {
                  const [marketplace, ruleMonth] = key.split('|');
                  const asins = Array.from(asinSet);
                  console.log(`处理往期回捞: 市场 ${marketplace}, 规则月 ${ruleMonth}, 竞品数 ${asins.length}`);

                   // 分批处理
                    const chunkSize = 40;
                    for (let i = 0; i < asins.length; i += chunkSize) {
                      const chunkAsins = asins.slice(i, i + chunkSize);
                       try {
                          await this.sellerspriteTool.competitorLookupOpenApi({
                              marketplace: marketplace,
                              asins: chunkAsins,
                              month: ruleMonth
                          });
                      } catch (error) {
                          console.error(`往期回捞失败 ${key}:`, error);
                      }
                   }
              }

              // 再次应用规则 (仅针对 Status 7)
               const productCodesWithHistory = new Set<string>();
               historyRuleListings.forEach(l => {
                  if(l.product_code) productCodesWithHistory.add(l.product_code);
               });

               console.log(`对往期竞品应用规则，涉及 product_code 数量: ${productCodesWithHistory.size}`);
               for (const productCode of productCodesWithHistory) {
                   try {
                      await this.applyRulesForProductCode(productCode, undefined, undefined, [7]);
                  } catch (error) {
                      console.error(`应用往期规则失败 (product_code: ${productCode}):`, error);
                  }
               }
          }
      }

      console.log('批量更新竞品详情任务完成');
      return results;
  }

  /**
   * 批量更新库存状态
   * @param ids
   */
  async batchUpdateInventoryStatus(ids: number[]) {
      // 1. 获取 Listing
      const listings = await this.bsrProductListingLingxingRepo.find({
          where: { id: In(ids) }
      });

      if (listings.length === 0) return { message: '未找到选中的Listing' };

      // 2. 批量获取 Restocking 数据
      // 收集所有涉及的 ASIN 和 Marketplace
      const asins = [...new Set(listings.map(l => l.asin).filter(Boolean))];
      const marketplaces = [...new Set(listings.map(l => l.marketplace).filter(Boolean))];

      if (asins.length === 0 || marketplaces.length === 0) {
           return { message: '选中的Listing缺少ASIN或Marketplace信息' };
      }

      // 3. 查找所有潜在匹配的 Restocking 记录
      const allRestockings = await this.restockingRepo.find({
          where: {
              asin: In(asins)
          }
      });

      let updatedCount = 0;
      const restockingToSave: AppAmzBsrRestockingCenterLingxingEntity[] = [];

      // 4. 遍历更新
      for (const listing of listings) {
          // 寻找匹配的 Restocking
          // 匹配优先级：1. ASIN + Marketplace + SellerName + MSKU
          //           2. ASIN + Marketplace + SellerName
          //           3. ASIN + Marketplace + MSKU
          //           4. ASIN + Marketplace

          let matchedRestocking = null;

          const potentialMatches = allRestockings.filter(r =>
              r.asin === listing.asin &&
              Array.isArray(r.marketplaceList) &&
              r.marketplaceList.includes(listing.marketplace)
          );

          if (potentialMatches.length > 0) {
              const sellerName = (listing.seller_name || '').trim();
              const msku = (listing.msku || '').trim();

              if (sellerName && msku) {
                 matchedRestocking = potentialMatches.find(r =>
                     Array.isArray(r.storeList)
                     && r.storeList.some(s => s === sellerName || s.trim() === sellerName)
                     && Array.isArray(r.relationListing)
                     && r.relationListing.some(item => (item?.msku || '').trim() === msku)
                 );
              }

              if (!matchedRestocking && sellerName) {
                 matchedRestocking = potentialMatches.find(r =>
                     Array.isArray(r.storeList) && r.storeList.some(s => s === sellerName || s.trim() === sellerName)
                 );
              }

              if (!matchedRestocking && msku) {
                 matchedRestocking = potentialMatches.find(r =>
                     Array.isArray(r.relationListing)
                     && r.relationListing.some(item => (item?.msku || '').trim() === msku)
                 );
              }

              // 如果没找到或没有店铺名，使用第一个匹配项
              if (!matchedRestocking) {
                  matchedRestocking = potentialMatches[0];
              }
          }

          if (matchedRestocking) {
              this.lingXingUtils.updateInventoryStatus(listing, matchedRestocking);
              updatedCount++;
              if (!restockingToSave.includes(matchedRestocking)) {
                  restockingToSave.push(matchedRestocking);
              }
          }
      }

      // 5. 保存
      if (updatedCount > 0) {
          await this.bsrProductListingLingxingRepo.save(listings);
      }

      // 保存 Restocking 更改 (主要是 fbaShippingList 的断层标记)
      if (restockingToSave.length > 0) {
          // 分批保存
          for (let i = 0; i < restockingToSave.length; i += 500) {
              await this.restockingRepo.save(restockingToSave.slice(i, i + 500));
          }
      }

      return { success: true, updatedCount, message: `成功更新 ${updatedCount} 条数据的库存状态` };
  }

  /**
   * 定时任务：更新所有库存状态
   */
  async updateAllInventoryStatusTask() {
      console.log('开始执行全量更新库存状态任务...');
      // 1. 获取所有在售Listing的ID
      const listings = await this.bsrProductListingLingxingRepo.find({
          select: ['id'],
        //   where: { status: ListingStatus.ON_SALE }
      });

      const ids = listings.map(l => l.id);
      console.log(`共找到 ${ids.length} 个在售Listing需要更新`);

      if (ids.length === 0) return { message: '无数据需要更新' };

      // 2. 分批处理
      const batchSize = 100;
      let totalUpdated = 0;

      for (let i = 0; i < ids.length; i += batchSize) {
          const batchIds = ids.slice(i, i + batchSize);
          console.log(`正在处理第 ${i + 1} - ${Math.min(i + batchSize, ids.length)} 条...`);
          const result = await this.batchUpdateInventoryStatus(batchIds);
          if (result.updatedCount) {
              totalUpdated += result.updatedCount;
          }
      }

      console.log(`全量更新库存状态任务完成，共更新 ${totalUpdated} 条`);
      return { success: true, totalUpdated };
  }

  /**
   * 同步Listing数据（事务内执行）
   */
  async syncListingData(queryRunner: QueryRunner): Promise<number> {
    // 1. 获取原始数据
    const rawList = await this.lingXingUtils.requestLingXingListing();
    if (rawList.length === 0) {
      throw new Error("未获取到Listing原始数据");
    }

    // 2. 获取现有数据，用于更新判断
    // 修改：使用数组存储相同Key的实体，以便处理重复数据
    const existingDataMap = new Map<string, AppAmzBsrProductListingLingxingEntity[]>();
    // 修改：查询所有数据，不再过滤状态，确保即使是已删除的数据也能被复用更新，而不是新增
    const existingData = await queryRunner.manager.find(AppAmzBsrProductListingLingxingEntity);

    existingData.forEach(item => {
      // 使用 asin + marketplace + seller_name + msku 作为唯一标识
      const asin = (item.asin || '').trim();
      const marketplace = (item.marketplace || '').trim();
      const sellerName = (item.seller_name || '').trim();
      const msku = (item.msku || '').trim();
      const key = `${asin}|${marketplace}|${sellerName}|${msku}`;
      if (!existingDataMap.has(key)) {
        existingDataMap.set(key, []);
      }
      existingDataMap.get(key).push(item);
    });

    // 3. 准备处理结果
    const entityList: AppAmzBsrProductListingLingxingEntity[] = [];
    const processedKeys = new Set<string>();

    // 4. 解析数据并进行更新或新增
    for (const rawItem of rawList) {
      if (!shouldPersistLingxingListing(rawItem)) {
        continue;
      }

      const asin = (rawItem.asin || "").trim();
      const marketplace = (rawItem.marketplace || "").trim();
      const sellerName = (rawItem.seller_name || "").trim();
      const msku = (rawItem.msku || "").trim();

      const key = `${asin}|${marketplace}|${sellerName}|${msku}`;

      // 如果已经处理过该 key，跳过
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);

      const existingEntities = existingDataMap.get(key);
      let existingEntity: AppAmzBsrProductListingLingxingEntity | null = null;

      // 如果存在历史数据
      if (existingEntities && existingEntities.length > 0) {
        // 取第一个作为主实体进行更新
        existingEntity = existingEntities[0];

        // 关键逻辑：如果有重复数据（多条相同Key），将多余的全部标记删除
        if (existingEntities.length > 1) {
            for (let i = 1; i < existingEntities.length; i++) {
                const duplicate = existingEntities[i];
                duplicate.status = ListingStatus.DELETED;
                duplicate.updateTime = new Date();
                entityList.push(duplicate);
            }
        }

        // 从Map中移除，表示已处理
        existingDataMap.delete(key);
      }

      // 执行解析逻辑
      const entity = this.lingXingUtils.parseListingData(rawItem);
      if (!entity) continue;

      const parseArray = (val: any): any[] => {
        if (val === null || val === undefined) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed;
          } catch (e) {}
        }
        return [val];
      };

      const appendHistoryArray = (newValue: any, oldValue: any) => {
        return [newValue, ...parseArray(oldValue)].slice(0, 15);
      };

      // 2026-03-30: 售价保存15天历史
      entity.listing_price_history = appendHistoryArray(entity.listing_price ?? null, existingEntity?.listing_price_history);

      // 如果是更新操作，继承 ID 并追加排名历史
      if (existingEntity) {
        entity.id = existingEntity.id;

        // 保留用户在页面上设置的往期规则（如果用户有明确设置，则不覆盖；如果是 null 也会保留用户的清空操作）
        if (existingEntity.rule_nearly_30_days !== undefined) {
          entity.rule_nearly_30_days = existingEntity.rule_nearly_30_days;
        }
        if (existingEntity.rule_history_month !== undefined) {
          entity.rule_history_month = existingEntity.rule_history_month;
        }

        // 排名数组追加逻辑：新值 + 旧值列表，截取前15个
        // parseListingData 已将新值放在 index 0
        const newRank = (entity.rank && entity.rank.length > 0) ? entity.rank[0] : 0;
        let oldRanks = parseArray(existingEntity.rank);
        entity.rank = [newRank, ...oldRanks].slice(0, 15);

        const newSmallRank = (entity.small_rank && entity.small_rank.length > 0) ? entity.small_rank[0] : 0;
        let oldSmallRanks = parseArray(existingEntity.small_rank);
        entity.small_rank = [newSmallRank, ...oldSmallRanks].slice(0, 15);

        // 2026-03-17 评分和Rating总数追加逻辑
        const newStars = (entity.stars && entity.stars.length > 0) ? entity.stars[0] : 0;
        let oldStars = parseArray(existingEntity.stars);
        entity.stars = [newStars, ...oldStars].slice(0, 15);

        const newReviewsNum = (entity.reviews_num && entity.reviews_num.length > 0) ? entity.reviews_num[0] : 0;
        let oldReviewsNum = parseArray(existingEntity.reviews_num);
        entity.reviews_num = [newReviewsNum, ...oldReviewsNum].slice(0, 15);
      }

      entityList.push(entity);
    }

    // 5. 处理不再出现在原始数据中的现有记录（标记为删除）
    for (const [key, abandonedEntities] of existingDataMap) {
        // 遍历所有未匹配的实体，全部标记删除
        for (const abandonedEntity of abandonedEntities) {
            // 优化：如果已经是删除状态，无需重复更新
            if (abandonedEntity.status === ListingStatus.DELETED) {
                continue;
            }
            abandonedEntity.status = ListingStatus.DELETED;
            abandonedEntity.updateTime = new Date();
            entityList.push(abandonedEntity);
        }
    }

    if (entityList.length === 0) {
        throw new Error("解析后无有效Listing数据");
    }

    // ========== 2025-01-16 新增：批量计算库存状态 ==========
    const businessFlowEntityList = entityList.filter(item => shouldRunLingxingListingBusinessFlow(item));
    const asins = businessFlowEntityList.map(e => e.asin).filter(a => !!a);
    if (asins.length > 0) {
        // 分批查询 Restocking 数据，避免参数过多
        const restockingMap = new Map<string, AppAmzBsrRestockingCenterLingxingEntity[]>();

        // 简单去重
        const uniqueAsins = [...new Set(asins)];

        // 每次查1000个
        const batchSize = 1000;
        for (let i = 0; i < uniqueAsins.length; i += batchSize) {
            const batchAsins = uniqueAsins.slice(i, i + batchSize);
            const batchRestocking = await queryRunner.manager.find(AppAmzBsrRestockingCenterLingxingEntity, {
                where: { asin: In(batchAsins) }
            });
            batchRestocking.forEach(r => {
                if (r.asin) {
                    if (!restockingMap.has(r.asin)) {
                        restockingMap.set(r.asin, []);
                    }
                    restockingMap.get(r.asin).push(r);
                }
            });
        }

        const restockingToSave: AppAmzBsrRestockingCenterLingxingEntity[] = [];

        for (const entity of businessFlowEntityList) {
            if (entity.asin && restockingMap.has(entity.asin)) {
                const candidates = restockingMap.get(entity.asin);
                let restocking: AppAmzBsrRestockingCenterLingxingEntity | null = null;

                if (candidates && candidates.length > 0) {
                    const marketplaceMatches = candidates.filter(r =>
                        Array.isArray(r.marketplaceList) &&
                        r.marketplaceList.includes(entity.marketplace)
                    );

                    if (marketplaceMatches.length > 0) {
                        const sellerName = (entity.seller_name || '').trim();
                        const msku = (entity.msku || '').trim();

                        if (sellerName && msku) {
                            restocking = marketplaceMatches.find(r =>
                                Array.isArray(r.storeList)
                                && r.storeList.some(s => s === sellerName || s.trim() === sellerName)
                                && Array.isArray(r.relationListing)
                                && r.relationListing.some(item => (item?.msku || '').trim() === msku)
                            );
                        }

                        if (!restocking && sellerName) {
                            restocking = marketplaceMatches.find(r =>
                                Array.isArray(r.storeList) &&
                                r.storeList.some(s => s === sellerName || s.trim() === sellerName)
                            );
                        }

                        if (!restocking && msku) {
                            restocking = marketplaceMatches.find(r =>
                                Array.isArray(r.relationListing)
                                && r.relationListing.some(item => (item?.msku || '').trim() === msku)
                            );
                        }

                        if (!restocking) {
                            restocking = marketplaceMatches[0];
                        }
                    }
                }

                if (restocking) {
                    // 调用计算逻辑
                    this.lingXingUtils.updateInventoryStatus(entity, restocking);

                    // 因为 updateInventoryStatus 可能修改了 restocking 的 fbaShippingList，需要保存
                    // 为了避免重复保存同一个 restocking (如果有多个listing对应同一个restocking，虽然ASIN通常唯一)，去重
                    if (!restockingToSave.includes(restocking)) {
                        restockingToSave.push(restocking);
                    }
                }
            }
        }

        // 保存 Restocking 更改 (主要是 fbaShippingList 的断层标记)
        if (restockingToSave.length > 0) {
            // 分批保存
            for (let i = 0; i < restockingToSave.length; i += 500) {
                await queryRunner.manager.save(restockingToSave.slice(i, i + 500));
            }
        }
    }
    // =====================================================

    // 6. 批量保存
    const savedList = await queryRunner.manager.save(entityList);

    return savedList.length;
  }

  async syncListingDataByAsin(asin: string): Promise<{
    success: boolean;
    asin: string;
    fetched: number;
    saved: number;
    id?: number;
    ids?: number[];
    message: string;
    listing?: AppAmzBsrProductListingLingxingEntity;
    listings?: AppAmzBsrProductListingLingxingEntity[];
  }> {
    const normalizedAsin = String(asin || '').trim().toUpperCase();
    if (!normalizedAsin) {
      throw new Error('ASIN不能为空');
    }

    const rawList = await this.lingXingUtils.requestLingXingListingByAsin(normalizedAsin);
    const rawItems = rawList.filter(item =>
      shouldPersistLingxingListing(item)
      && String(item?.asin || '').trim().toUpperCase() === normalizedAsin
    );

    if (rawItems.length === 0) {
      return {
        success: false,
        asin: normalizedAsin,
        fetched: rawList.length,
        saved: 0,
        message: '未获取到Listing数据',
      };
    }

    const queryRunner = this.bsrProductListingLingxingRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const entityList: AppAmzBsrProductListingLingxingEntity[] = [];
      const restockingToSave: AppAmzBsrRestockingCenterLingxingEntity[] = [];

      const parseArray = (val: any): any[] => {
        if (val === null || val === undefined) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed;
          } catch (e) {}
        }
        return [val];
      };
      const appendHistoryArray = (newValue: any, oldValue: any) => {
        return [newValue, ...parseArray(oldValue)].slice(0, 15);
      };

      for (const rawItem of rawItems) {
        const entity = this.lingXingUtils.parseListingData(rawItem);
        if (!entity) {
          continue;
        }

        const existingEntities = await queryRunner.manager.find(AppAmzBsrProductListingLingxingEntity, {
          where: {
            asin: entity.asin,
            marketplace: entity.marketplace,
            seller_name: entity.seller_name,
            msku: entity.msku,
          },
        });
        const existingEntity = existingEntities?.[0] || null;

        if (existingEntities && existingEntities.length > 1) {
          for (let i = 1; i < existingEntities.length; i++) {
            const duplicate = existingEntities[i];
            duplicate.status = ListingStatus.DELETED;
            duplicate.updateTime = new Date();
            entityList.push(duplicate);
          }
        }

        entity.listing_price_history = appendHistoryArray(entity.listing_price ?? null, existingEntity?.listing_price_history);

        if (existingEntity) {
          entity.id = existingEntity.id;
          if (existingEntity.rule_nearly_30_days !== undefined) {
            entity.rule_nearly_30_days = existingEntity.rule_nearly_30_days;
          }
          if (existingEntity.rule_history_month !== undefined) {
            entity.rule_history_month = existingEntity.rule_history_month;
          }

          const newRank = (entity.rank && entity.rank.length > 0) ? entity.rank[0] : 0;
          entity.rank = [newRank, ...parseArray(existingEntity.rank)].slice(0, 15);

          const newSmallRank = (entity.small_rank && entity.small_rank.length > 0) ? entity.small_rank[0] : 0;
          entity.small_rank = [newSmallRank, ...parseArray(existingEntity.small_rank)].slice(0, 15);

          const newStars = (entity.stars && entity.stars.length > 0) ? entity.stars[0] : 0;
          entity.stars = [newStars, ...parseArray(existingEntity.stars)].slice(0, 15);

          const newReviewsNum = (entity.reviews_num && entity.reviews_num.length > 0) ? entity.reviews_num[0] : 0;
          entity.reviews_num = [newReviewsNum, ...parseArray(existingEntity.reviews_num)].slice(0, 15);
        }

        if (shouldRunLingxingListingBusinessFlow(entity) && entity.asin) {
          const restockingRows = await queryRunner.manager.find(AppAmzBsrRestockingCenterLingxingEntity, {
            where: { asin: entity.asin },
          });
          const restocking = this.matchRestockingFromCandidates(entity, restockingRows || []);
          if (restocking) {
            this.lingXingUtils.updateInventoryStatus(entity, restocking);
            if (!restockingToSave.includes(restocking)) {
              restockingToSave.push(restocking);
            }
          }
        }

        entityList.push(entity);
      }

      if (entityList.length === 0) {
        throw new Error('解析后无有效Listing数据');
      }

      if (restockingToSave.length > 0) {
        await queryRunner.manager.save(restockingToSave);
      }
      const savedList = await queryRunner.manager.save(entityList);
      await queryRunner.commitTransaction();

      const listings = entityList.filter(item => String(item.asin || '').trim().toUpperCase() === normalizedAsin);
      const ids = listings.map(item => item.id).filter(id => !!id);

      return {
        success: true,
        asin: normalizedAsin,
        fetched: rawList.length,
        saved: Array.isArray(savedList) ? savedList.length : entityList.length,
        id: ids[0],
        ids,
        message: '同步成功',
        listing: listings[0],
        listings,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * 获取所有店铺列表
   */
  async getStores() {
    const qb = this.bsrProductListingLingxingRepo
      .createQueryBuilder('listing')
      .select('DISTINCT(listing.seller_name)', 'seller_name')
      .where('listing.seller_name IS NOT NULL')
      .andWhere("listing.seller_name != ''");

    // 添加店铺权限过滤
    const userId = this.ctx.admin?.userId;
    const username = this.ctx.admin?.username;
    if (username !== 'admin' && userId) {
        const user = await this.userEntity.findOne({ where: { id: userId } });
        if (user && user.sidList && user.sidList.length > 0) {
            qb.andWhere('listing.store_id IN (:...sidList)', { sidList: user.sidList });
        } else {
            return []; // 没有店铺权限
        }
    }

    const result = await qb.getRawMany();
    return result.map(item => item.seller_name);
  }

  /**
   * 获取所有店铺名称列表(shop)
   */
  /**
   * Get all used numeric product codes.
   */
  async getProductCodes() {
    const result = await this.bsrProductListingLingxingRepo
      .createQueryBuilder('listing')
      .select('DISTINCT(listing.product_code)', 'product_code')
      .where('listing.product_code IS NOT NULL')
      .andWhere("listing.product_code != ''")
      .getRawMany<{ product_code: string }>();

    return result.map(item => item.product_code).filter(Boolean);
  }

  /**
   * Preview or repair legacy "number-name" local_name values.
   */
  async repairHyphenProductCodeLocalNames(
    body: RepairHyphenProductCodeLocalNamesParams = {}
  ) {
    const dryRun = body.dryRun !== false;
    const ids = Array.isArray(body.ids)
      ? body.ids.map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0)
      : [];
    const productCode = String(body.product_code || '').trim();
    const rawLimit = Number(body.limit);
    const limit = Math.min(Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 200, 1), 1000);

    const qb = this.bsrProductListingLingxingRepo
      .createQueryBuilder('listing')
      .where("listing.local_name REGEXP '^[0-9]{1,4}-.+'");

    if (ids.length) {
      qb.andWhere('listing.id IN (:...ids)', { ids });
    }

    if (productCode) {
      qb.andWhere(
        '(listing.product_code = :productCode OR listing.local_name LIKE :legacyLocalNamePrefix)',
        {
          productCode,
          legacyLocalNamePrefix: `${productCode}-%`,
        }
      );
    }

    const listings = await qb
      .orderBy('listing.id', 'ASC')
      .limit(limit)
      .getMany();

    const items: RepairHyphenProductCodeLocalNameItem[] = [];
    let synced = 0;
    let failed = 0;

    for (const listing of listings) {
      const oldLocalName = String(listing.local_name || '').trim();
      const parsed = parseNumberedLingxingLocalName(oldLocalName);
      if (!parsed || parsed.separator !== '-') continue;

      const currentProductCode = String(listing.product_code || '').trim();
      const targetProductCode = currentProductCode || parsed.code;
      const newLocalName = normalizeLingxingLocalNameWithProductCode(
        targetProductCode,
        oldLocalName
      );
      const baseItem = {
        id: listing.id,
        msku: String(listing.msku || '').trim(),
        asin: String(listing.asin || '').trim(),
        marketplace: String(listing.marketplace || '').trim(),
        productCode: targetProductCode,
        oldLocalName,
        newLocalName,
      };

      if (currentProductCode && currentProductCode !== parsed.code) {
        failed += 1;
        items.push({
          ...baseItem,
          status: 'failed',
          error: `product_code(${currentProductCode}) 与品名前缀(${parsed.code})不一致`,
        });
        continue;
      }

      if (dryRun) {
        items.push({
          ...baseItem,
          status: 'preview',
        });
        continue;
      }

      if (!baseItem.msku) {
        failed += 1;
        items.push({
          ...baseItem,
          status: 'failed',
          error: '缺少 msku，无法同步领星',
        });
        continue;
      }

      try {
        await this.lingXingUtils.syncProductNameToLingXing(baseItem.msku, newLocalName);

        listing.product_code = targetProductCode;
        listing.local_name = newLocalName;
        await this.bsrProductListingLingxingRepo.save(listing);

        synced += 1;
        items.push({
          ...baseItem,
          status: 'updated',
        });
      } catch (error: any) {
        failed += 1;
        items.push({
          ...baseItem,
          status: 'failed',
          error: error?.message || '同步领星或保存本地失败',
        });
      }
    }

    return {
      dryRun,
      limit,
      total: items.length,
      changed: items.filter(item => item.status === 'preview' || item.status === 'updated').length,
      synced,
      failed,
      items,
    };
  }

  /**
   * Assign product_code and local_name, then sync to Lingxing.
   */
  async assignProductCode(id: number, productCode: string) {
    const listing = await this.bsrProductListingLingxingRepo.findOne({ where: { id } });
    if (!listing) throw new Error('Listing 不存在');

    const newLocalName = normalizeLingxingLocalNameWithProductCode(
      productCode,
      listing.local_name || ''
    );

    const sku = (listing.msku || '').trim();
    if (!sku) throw new Error('该 Listing 缺少 msku，无法同步领星');

    await this.lingXingUtils.syncProductNameToLingXing(sku, newLocalName);

    listing.product_code = productCode;
    listing.local_name = newLocalName;
    await this.bsrProductListingLingxingRepo.save(listing);

    return { success: true, local_name: newLocalName };
  }

  /**
   * Batch update restock setting.
   */
  async batchSetRestockSetting(body: {
    ids: number[];
    settingType: number;
    futureRestockDate?: string;
    futureRestockQuantity?: number;
  }) {
    const { ids, settingType, futureRestockDate, futureRestockQuantity } = body;
    if (!ids || ids.length === 0) throw new Error('请选择产品');
    if (![0, 1, 2].includes(settingType)) throw new Error('无效的设置类型');

    const updateData: any = { restock_setting_type: settingType };

    if (settingType === 0) {
      updateData.future_restock_date = null;
    } else if (settingType === 1) {
      updateData.future_restock_date = null;
    } else if (settingType === 2) {
      if (!futureRestockDate) throw new Error('请设置未来补货日期');
      updateData.future_restock_date = futureRestockDate;
    }

    await this.bsrProductListingLingxingRepo.update({ id: In(ids) }, updateData);

    if (settingType === 2 && futureRestockQuantity != null) {
      const listings = await this.bsrProductListingLingxingRepo.find({ where: { id: In(ids) } });
      const asins = [...new Set(listings.map(l => l.asin).filter(Boolean))];
      const allCandidates = asins.length > 0
        ? await this.restockingRepo.createQueryBuilder('b').where('b.asin IN (:...asins)', { asins }).getMany()
        : [];
      const candidatesByAsin = new Map<string, typeof allCandidates>();
      for (const c of allCandidates) {
        if (!candidatesByAsin.has(c.asin)) candidatesByAsin.set(c.asin, []);
        candidatesByAsin.get(c.asin).push(c);
      }

      for (const listing of listings) {
        const restockingRow = this.matchRestockingFromCandidates(listing, candidatesByAsin.get(listing.asin) || []);
        if (restockingRow) {
          const suggestInfo = restockingRow.suggestInfo || {};
          (suggestInfo as any).quantitySugPurchase = futureRestockQuantity;
          await this.restockingRepo.update(
            { id: restockingRow.id },
            { suggestInfo: suggestInfo as any }
          );
        }
      }
    }

    return { success: true, count: ids.length };
  }

  private matchRestockingFromCandidates(
    listing: AppAmzBsrProductListingLingxingEntity,
    candidates: AppAmzBsrRestockingCenterLingxingEntity[]
  ) {
    const marketplaceMap: Record<string, string> = {
      '英国': 'UK',
      '德国': 'DE',
    };
    const mappedMp = marketplaceMap[listing.marketplace] || listing.marketplace;

    const marketplaceMatches = candidates.filter(r =>
      Array.isArray(r.marketplaceList) &&
      (r.marketplaceList.includes(listing.marketplace) || r.marketplaceList.includes(mappedMp))
    );
    if (!marketplaceMatches.length) return null;

    const sellerName = (listing.seller_name || '').trim();
    const msku = (listing.msku || '').trim();

    let match = marketplaceMatches.find(r =>
      Array.isArray(r.storeList) && r.storeList.some((s: string) => s.trim() === sellerName) &&
      Array.isArray(r.relationListing) && r.relationListing.some((item: any) => (item?.msku || '').trim() === msku)
    );

    if (!match && sellerName) {
      match = marketplaceMatches.find(r =>
        Array.isArray(r.storeList) && r.storeList.some((s: string) => s.trim() === sellerName)
      );
    }

    if (!match && msku) {
      match = marketplaceMatches.find(r =>
        Array.isArray(r.relationListing) && r.relationListing.some((item: any) => (item?.msku || '').trim() === msku)
      );
    }

    if (!match) match = marketplaceMatches[0];

    return match;
  }

  async getShops() {
    const qb = this.bsrProductListingLingxingRepo
      .createQueryBuilder('listing')
      .select('DISTINCT(listing.shop)', 'shop')
      .where('listing.shop IS NOT NULL')
      .andWhere("listing.shop != ''");

    // 添加店铺权限过滤
    const userId = this.ctx.admin?.userId;
    const username = this.ctx.admin?.username;
    if (username !== 'admin' && userId) {
        const user = await this.userEntity.findOne({ where: { id: userId } });
        if (user && user.sidList && user.sidList.length > 0) {
            qb.andWhere('listing.store_id IN (:...sidList)', { sidList: user.sidList });
        } else {
            return []; // 没有店铺权限
        }
    }

    const result = await qb.getRawMany();
    return result.map(item => item.shop);
  }
}
