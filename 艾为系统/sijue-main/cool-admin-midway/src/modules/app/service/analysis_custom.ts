import { BaseService } from '@cool-midway/core';
import { Provide, Inject } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, Not, IsNull, In } from 'typeorm';
import { AppAmzBsrCandidateCompetitorEntity } from '../entity/bsr_candidate_competitor';
import { AppAmzBsrRestockingCenterLingxingEntity } from '../entity/bsr_restocking_center_lingxing';
import { AmazonProductCompetitorStatisticsEntity } from '../entity/amazon_product_competitor_statistics';
import { AppAmzBsrProductListingLingxingEntity } from '../entity/bsr_product_Listing_Lingxing';
import { AppAmzBsrSalesCacheLingxingEntity } from '../entity/bsr_sales_cache_lingxing';
import { AppAmzListingKeywordEntity } from '../entity/keyword';
import { AppUserKeywordConfigEntity } from '../entity/userKeywordConfig';
import { AppAmzUserAlphaConfigEntity } from '../entity/user_alpha_config';
import { AppAmzBsrReplenishTargetStockDaysEntity } from '../entity/bsr_replenish_target_stock_days';
import { AppAmzBsrReplenishShippingMethodPrefEntity } from '../entity/bsr_replenish_shipping_method_pref';
import { AppAmzBsrReplenishVolatilityCoefficientEntity } from '../entity/bsr_replenish_volatility_coefficient';
import {
    REPLENISH_SHIPPING_METHOD_KEYS,
    buildShippingMethodNaturalKey,
    buildShippingMethodNaturalWhere,
    hasShippingMethodNaturalKey,
    normalizeInactiveShippingMethods,
    resolveShippingMethodPrefMatch,
} from './replenish_shipping_method_pref';
import { LingXingUtils } from '../utils/lingxing/lingxingUtils';
import * as dayjs from 'dayjs';

const DEFAULT_VOLATILITY_COEFFICIENT = 0.75;
const MIN_VOLATILITY_COEFFICIENT = 0;
const MAX_VOLATILITY_COEFFICIENT = 10;

function normalizeVolatilityCoefficient(value: any): number {
    if (value === undefined || value === null || value === '') {
        return DEFAULT_VOLATILITY_COEFFICIENT;
    }
    const num = Number(value);
    if (
        !Number.isFinite(num) ||
        num < MIN_VOLATILITY_COEFFICIENT ||
        num > MAX_VOLATILITY_COEFFICIENT
    ) {
        return DEFAULT_VOLATILITY_COEFFICIENT;
    }
    return Math.round(num * 100) / 100;
}

function parseVolatilityCoefficient(value: any): number {
    if (value === undefined || value === null || value === '') {
        return DEFAULT_VOLATILITY_COEFFICIENT;
    }
    const num = Number(value);
    if (
        !Number.isFinite(num) ||
        num < MIN_VOLATILITY_COEFFICIENT ||
        num > MAX_VOLATILITY_COEFFICIENT
    ) {
        throw new Error(
            `波动系数必须是 ${MIN_VOLATILITY_COEFFICIENT} 到 ${MAX_VOLATILITY_COEFFICIENT} 之间的数字`
        );
    }
    return Math.round(num * 100) / 100;
}


/**
 * 分析模态框专用服务
 * 业务规则：
 * 1. 核心数据源为“月度销量”，抓取数据仅精确到月。
 * 2. 算法自动将月销量平摊到周，保证数学逻辑正确。
 */
@Provide()
export class AppAnalysisCustomService extends BaseService {
    @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
    competitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;

    @InjectEntityModel(AppAmzBsrRestockingCenterLingxingEntity)
    restockingRepo: Repository<AppAmzBsrRestockingCenterLingxingEntity>;

    @InjectEntityModel(AmazonProductCompetitorStatisticsEntity)
    statisticsRepo: Repository<AmazonProductCompetitorStatisticsEntity>;

    @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
    listingRepo: Repository<AppAmzBsrProductListingLingxingEntity>;

    @InjectEntityModel(AppAmzBsrSalesCacheLingxingEntity)
    salesCacheRepo: Repository<AppAmzBsrSalesCacheLingxingEntity>;

    @InjectEntityModel(AppAmzListingKeywordEntity)
    keywordRepo: Repository<AppAmzListingKeywordEntity>;

    @InjectEntityModel(AppUserKeywordConfigEntity)
    userKeywordConfigRepo: Repository<AppUserKeywordConfigEntity>;

    @InjectEntityModel(AppAmzUserAlphaConfigEntity)
    userAlphaConfigRepo: Repository<AppAmzUserAlphaConfigEntity>;

    @InjectEntityModel(AppAmzBsrReplenishTargetStockDaysEntity)
    replenishTargetStockDaysRepo: Repository<AppAmzBsrReplenishTargetStockDaysEntity>;

    @InjectEntityModel(AppAmzBsrReplenishShippingMethodPrefEntity)
    replenishShippingMethodPrefRepo: Repository<AppAmzBsrReplenishShippingMethodPrefEntity>;

    @InjectEntityModel(AppAmzBsrReplenishVolatilityCoefficientEntity)
    replenishVolatilityCoefficientRepo: Repository<AppAmzBsrReplenishVolatilityCoefficientEntity>;

    @Inject()
    ctx;

    @Inject()
    lingXingUtils: LingXingUtils;

    // 促销同步并发锁（按 asin:marketplace 为粒度）
    private static promotionSyncLocks = new Map<string, boolean>();

    // 促销后台同步全局并发计数（限制最多同时 3 个后台同步任务，防止快速 Hover 打爆领星 API）
    private static promotionBackgroundCount = 0;
    private static readonly PROMOTION_MAX_CONCURRENT = 3;

    // 我的销量同步并发锁（按 product_code:marketplace 为粒度）
    private static salesSyncLocks = new Map<string, boolean>();

    private readonly LOCAL_PRODUCT_INFO_API = '/erp/sc/routing/data/local_inventory/productInfo';
    private readonly LOCAL_PRODUCT_INFO_INTERVAL_MS = 500;
    private readonly DEFAULT_TARGET_STOCK_DAYS = 20;
    private readonly MAX_TARGET_STOCK_DAYS = 120;
    private readonly DEFAULT_KEYWORD_LIMIT = 3;

    private toDefaultKeywordNumber(value: number | string | null | undefined): number {
        const num = Number(value);
        return Number.isFinite(num) ? num : 0;
    }

    private selectTopDefaultKeywords<T extends Pick<AppAmzListingKeywordEntity, 'id'> & {
        sif_score?: number | string | null;
        sif_search_volume_monthly?: number | string | null;
    }>(keywords: T[], limit = this.DEFAULT_KEYWORD_LIMIT): T[] {
        return [...keywords]
            .sort((a, b) => {
                const scoreDiff = this.toDefaultKeywordNumber(b.sif_score) - this.toDefaultKeywordNumber(a.sif_score);
                if (scoreDiff !== 0) return scoreDiff;

                const volumeDiff = this.toDefaultKeywordNumber(b.sif_search_volume_monthly) - this.toDefaultKeywordNumber(a.sif_search_volume_monthly);
                if (volumeDiff !== 0) return volumeDiff;

                return Number(a.id) - Number(b.id);
            })
            .slice(0, limit);
    }

    /**
     * 批量获取本地产品装箱数。
     * product_id 是领星本地产品 id；item.id 是本系统 listing id，不能当作领星 id 使用。
     */
    async getLocalProductBoxPcsBatch(items: any[] = []) {
        const safeItems = Array.isArray(items) ? items.slice(0, 50) : [];
        const requestCache = new Map<string, any>();
        const list: any[] = [];

        for (let index = 0; index < safeItems.length; index++) {
            const item = safeItems[index] || {};
            const clientKey = item.clientKey || item._batchId || item.listing_id || item.product_id || item.local_sku || item.msku || `item_${index}`;
            const requestInfo = this.resolveLocalProductInfoRequest(item);

            if (!requestInfo) {
                list.push({
                    clientKey,
                    success: false,
                    cg_box_pcs: null,
                    requestParams: null,
                    message: '缺少 product_id、local_sku 或 msku，无法查询装箱数'
                });
                continue;
            }

            let result = requestCache.get(requestInfo.requestKey);
            let cached = true;

            if (!result) {
                cached = false;
                result = await this.fetchLocalProductBoxPcs(requestInfo, false);
                requestCache.set(requestInfo.requestKey, result);

                if (index < safeItems.length - 1) {
                    await this.sleep(this.LOCAL_PRODUCT_INFO_INTERVAL_MS);
                }
            }

            list.push({
                clientKey,
                requestKey: requestInfo.requestKey,
                source: requestInfo.source,
                requestParams: requestInfo.params,
                product_id: item.product_id ?? null,
                local_sku: item.local_sku || '',
                msku: item.msku || '',
                cached,
                ...result
            });
        }

        return {
            total: safeItems.length,
            successCount: list.filter(item => item.success).length,
            failCount: list.filter(item => !item.success).length,
            list
        };
    }

    /**
     * 单个产品详情调试接口，返回领星原始响应，供前端弹窗手动验证。
     */
    async debugLocalProductInfo(item: any = {}) {
        const requestInfo = this.resolveLocalProductInfoRequest(item);
        if (!requestInfo) {
            return {
                success: false,
                cg_box_pcs: null,
                requestParams: null,
                message: '缺少 product_id、local_sku 或 msku，无法查询本地产品详情'
            };
        }

        const result = await this.fetchLocalProductBoxPcs(requestInfo, true);
        return {
            requestKey: requestInfo.requestKey,
            source: requestInfo.source,
            requestParams: requestInfo.params,
            ...result
        };
    }

    private resolveLocalProductInfoRequest(item: any) {
        const productId = item?.product_id ?? item?.productId;
        if (productId !== undefined && productId !== null && String(productId).trim() !== '' && Number(productId) > 0) {
            const id = Number(productId);
            return {
                source: 'product_id',
                requestKey: `id:${id}`,
                params: { id }
            };
        }

        const localSku = String(item?.local_sku || item?.sku || '').trim();
        if (localSku) {
            return {
                source: 'local_sku',
                requestKey: `sku:${localSku}`,
                params: { sku: localSku }
            };
        }

        const msku = String(item?.msku || '').trim();
        if (msku) {
            return {
                source: 'msku',
                requestKey: `sku:${msku}`,
                params: { sku: msku }
            };
        }

        return null;
    }

    private async fetchLocalProductBoxPcs(requestInfo: { source: string; requestKey: string; params: any }, includeRawResponse = false) {
        console.log('[localProductInfo] request:', JSON.stringify(requestInfo.params));

        try {
            const rawResponse: any = await this.lingXingUtils.httpPost(
                this.LOCAL_PRODUCT_INFO_API,
                requestInfo.params,
                true
            );
            const productInfo = rawResponse?.data ?? rawResponse;
            const cgBoxPcs = this.normalizeBoxPcs(productInfo?.cg_box_pcs);
            const purchaseRemark = this.normalizePurchaseRemark(productInfo?.purchase_remark);
            const responseCode = rawResponse?.code;
            const ok = responseCode === 0 || responseCode === '0' || rawResponse?.message === 'success' || cgBoxPcs !== null;

            console.log('[localProductInfo] result:', JSON.stringify({
                request: requestInfo.params,
                code: responseCode,
                cg_box_pcs: cgBoxPcs,
                purchase_remark: purchaseRemark
            }));

            if (!ok) {
                return {
                    success: false,
                    cg_box_pcs: null,
                    purchase_remark: '',
                    product_info: null,
                    responseCode,
                    message: rawResponse?.message || '领星接口返回异常',
                    ...(includeRawResponse ? { rawResponse } : {})
                };
            }

            return {
                success: true,
                cg_box_pcs: cgBoxPcs,
                purchase_remark: purchaseRemark,
                product_info: {
                    id: productInfo?.id ?? null,
                    sku: productInfo?.sku || '',
                    product_name: productInfo?.product_name || '',
                    cg_box_pcs: cgBoxPcs,
                    purchase_remark: purchaseRemark
                },
                responseCode,
                message: cgBoxPcs === null ? '接口成功但未返回 cg_box_pcs' : 'success',
                ...(includeRawResponse ? { rawResponse } : {})
            };
        } catch (error) {
            console.error('[localProductInfo] failed:', requestInfo.params, error);
            return {
                success: false,
                cg_box_pcs: null,
                purchase_remark: '',
                product_info: null,
                message: error?.message || '领星接口调用失败',
                ...(includeRawResponse ? {
                    rawResponse: error?.response?.data || null
                } : {})
            };
        }
    }

    private normalizeBoxPcs(value: any): number | null {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    private normalizePurchaseRemark(value: any): string {
        if (value === undefined || value === null) return '';
        return String(value);
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 批量查询单品运输方式偏好。优先 user_id + listing_id，未命中再用用户级自然键兜底。
     */
    async getShippingMethodPrefsBatch(items: any[] = []) {
        const userId = this.ctx?.admin?.userId;
        if (!userId) throw new Error('未登录');

        const safeItems = Array.isArray(items) ? items.slice(0, 200) : [];
        const listingIds = Array.from(new Set(
            safeItems
                .map(item => this.normalizeListingId(item))
                .filter(id => id > 0)
        ));

        const records: AppAmzBsrReplenishShippingMethodPrefEntity[] = [];
        if (listingIds.length > 0) {
            records.push(...await this.replenishShippingMethodPrefRepo.find({
                where: { user_id: userId, listing_id: In(listingIds) }
            }));
        }

        const naturalWhere = this.buildUniqueShippingMethodPrefNaturalWhereList(safeItems, userId);
        if (naturalWhere.length > 0) {
            records.push(...await this.replenishShippingMethodPrefRepo.find({
                where: naturalWhere as any
            }));
        }

        const uniqueRecords = this.deduplicateShippingMethodPrefRecords(records);
        const recordsToPatch: AppAmzBsrReplenishShippingMethodPrefEntity[] = [];

        const list = safeItems.map((item, index) => {
            const clientKey = this.getShippingMethodPrefClientKey(item, index);
            const listingId = this.normalizeListingId(item);
            const match = resolveShippingMethodPrefMatch<AppAmzBsrReplenishShippingMethodPrefEntity>(item, userId, uniqueRecords);
            const record = match.record;

            if (record && listingId > 0 && record.listing_id !== listingId) {
                record.listing_id = listingId;
                recordsToPatch.push(record);
            }

            return {
                clientKey,
                found: !!record,
                matchedBy: match.matchedBy,
                record_id: record?.id || null,
                listing_id: listingId || null,
                inactive_methods: normalizeInactiveShippingMethods(record?.inactive_methods),
                updated_by_name: record?.updated_by_name || ''
            };
        });

        if (recordsToPatch.length > 0) {
            await this.replenishShippingMethodPrefRepo.save(recordsToPatch);
        }

        return {
            total: safeItems.length,
            list
        };
    }

    /**
     * 保存单品运输方式偏好。保存关闭列表，新运输方式默认开启。
     */
    async saveShippingMethodPrefs(param: any = {}) {
        const admin = this.ctx?.admin || {};
        const userId = admin.userId;
        if (!userId) throw new Error('未登录');
        if (!hasShippingMethodNaturalKey(param)) {
            throw new Error('缺少 product_code、marketplace、asin、msku 或 store_id，无法保存运输方式偏好');
        }

        const listingId = this.normalizeListingId(param);
        const inactiveMethods = normalizeInactiveShippingMethods(param.inactive_methods);
        if (inactiveMethods.length >= REPLENISH_SHIPPING_METHOD_KEYS.length) {
            throw new Error('至少保留一种运输方式');
        }

        let record: AppAmzBsrReplenishShippingMethodPrefEntity = null;
        let action: 'created' | 'updated' = 'created';

        if (listingId > 0) {
            record = await this.replenishShippingMethodPrefRepo.findOne({
                where: { user_id: userId, listing_id: listingId }
            });
        }

        if (!record) {
            record = await this.replenishShippingMethodPrefRepo.findOne({
                where: {
                    user_id: userId,
                    ...buildShippingMethodNaturalWhere(param)
                } as any
            });
        }

        if (record) {
            action = 'updated';
        } else {
            record = new AppAmzBsrReplenishShippingMethodPrefEntity();
        }

        const natural = buildShippingMethodNaturalWhere(param);
        record.user_id = userId;
        record.listing_id = listingId || null;
        record.product_code = natural.product_code;
        record.marketplace = natural.marketplace;
        record.asin = natural.asin;
        record.msku = natural.msku;
        record.store_id = natural.store_id;
        record.inactive_methods = inactiveMethods;
        record.updated_by_name = admin.username || admin.nickName || admin.name || '';

        const saved = await this.replenishShippingMethodPrefRepo.save(record);

        return {
            success: true,
            action,
            record_id: saved.id,
            listing_id: saved.listing_id,
            inactive_methods: normalizeInactiveShippingMethods(saved.inactive_methods),
            updated_by_name: saved.updated_by_name || ''
        };
    }

    /**
     * 批量查询目标库存天数。优先 listing_id，未命中再用 5 个自然键兜底。
     */
    async getTargetStockDaysBatch(items: any[] = []) {
        const safeItems = Array.isArray(items) ? items.slice(0, 200) : [];
        const list: any[] = [];
        const listingIds = Array.from(new Set(
            safeItems
                .map(item => this.normalizeListingId(item))
                .filter(id => id > 0)
        ));

        const byListingId = new Map<number, AppAmzBsrReplenishTargetStockDaysEntity>();
        if (listingIds.length > 0) {
            const records = await this.replenishTargetStockDaysRepo.find({
                where: { listing_id: In(listingIds) }
            });
            for (const record of records) {
                if (record.listing_id && !byListingId.has(Number(record.listing_id))) {
                    byListingId.set(Number(record.listing_id), record);
                }
            }
        }

        const unmatchedItems = safeItems.filter(item => {
            const listingId = this.normalizeListingId(item);
            return !(listingId > 0 && byListingId.has(listingId)) && this.hasTargetStockDaysNaturalKey(item);
        });
        const naturalWhere = this.buildUniqueNaturalWhereList(unmatchedItems);
        const byNaturalKey = new Map<string, AppAmzBsrReplenishTargetStockDaysEntity>();

        if (naturalWhere.length > 0) {
            const records = await this.replenishTargetStockDaysRepo.find({ where: naturalWhere as any });
            for (const record of records) {
                byNaturalKey.set(this.buildNaturalKey(record), record);
            }
        }

        const recordsToPatch: AppAmzBsrReplenishTargetStockDaysEntity[] = [];

        for (let index = 0; index < safeItems.length; index++) {
            const item = safeItems[index] || {};
            const clientKey = item.clientKey || item._batchId || item.listing_id || item.id || item.product_code || `item_${index}`;
            const listingId = this.normalizeListingId(item);
            let record = listingId > 0 ? byListingId.get(listingId) : null;
            let matchedBy = record ? 'listing_id' : '';

            if (!record && this.hasTargetStockDaysNaturalKey(item)) {
                record = byNaturalKey.get(this.buildNaturalKey(item));
                matchedBy = record ? 'natural_key' : '';
            }

            if (record && listingId > 0 && record.listing_id !== listingId) {
                record.listing_id = listingId;
                recordsToPatch.push(record);
            }

            list.push({
                clientKey,
                found: !!record,
                matchedBy,
                record_id: record?.id || null,
                listing_id: listingId || null,
                target_days: this.normalizeStoredTargetDays(record?.target_days),
                updated_by: record?.updated_by ?? null,
                updated_by_name: record?.updated_by_name || ''
            });
        }

        if (recordsToPatch.length > 0) {
            await this.replenishTargetStockDaysRepo.save(recordsToPatch);
        }

        return {
            total: safeItems.length,
            list
        };
    }

    /**
     * 保存目标库存天数。允许清空 target_days。
     */
    async saveTargetStockDays(param: any = {}) {
        const listingId = this.normalizeListingId(param);
        const targetDays = this.normalizeTargetDays(param.target_days);

        if (!this.hasTargetStockDaysNaturalKey(param)) {
            throw new Error('缺少 product_code、marketplace、asin、msku 或 store_id，无法保存目标库存天数');
        }

        let record: AppAmzBsrReplenishTargetStockDaysEntity = null;
        let matchedBy = '';

        if (listingId > 0) {
            record = await this.replenishTargetStockDaysRepo.findOne({
                where: { listing_id: listingId }
            });
            matchedBy = record ? 'listing_id' : '';
        }

        if (!record) {
            record = await this.replenishTargetStockDaysRepo.findOne({
                where: this.buildNaturalWhere(param) as any
            });
            matchedBy = record ? 'natural_key' : '';
        }

        if (!record) {
            record = new AppAmzBsrReplenishTargetStockDaysEntity();
            matchedBy = 'created';
        }

        const admin = this.ctx?.admin || {};
        record.listing_id = listingId || null;
        record.product_code = String(param.product_code).trim();
        record.marketplace = String(param.marketplace).trim();
        record.asin = String(param.asin).trim();
        record.msku = String(param.msku).trim();
        record.store_id = Number(param.store_id);
        record.target_days = targetDays;
        record.updated_by = admin.userId || null;
        record.updated_by_name = admin.username || '';

        const saved = await this.replenishTargetStockDaysRepo.save(record);

        return {
            success: true,
            matchedBy,
            record_id: saved.id,
            listing_id: saved.listing_id,
            target_days: saved.target_days,
            updated_by: saved.updated_by,
            updated_by_name: saved.updated_by_name
        };
    }

    /**
     * 批量查询波动系数。查不到配置时创建默认 0.75，确保前端回显和后续保存口径稳定。
     */
    async getVolatilityCoefficientBatch(items: any[] = []) {
        const safeItems = Array.isArray(items) ? items.slice(0, 200) : [];
        const listingIds = Array.from(new Set(
            safeItems
                .map(item => this.normalizeListingId(item))
                .filter(id => id > 0)
        ));

        const byListingId = new Map<number, AppAmzBsrReplenishVolatilityCoefficientEntity>();
        if (listingIds.length > 0) {
            const records = await this.replenishVolatilityCoefficientRepo.find({
                where: { listing_id: In(listingIds) }
            });
            for (const record of records) {
                if (record.listing_id && !byListingId.has(Number(record.listing_id))) {
                    byListingId.set(Number(record.listing_id), record);
                }
            }
        }

        const unmatchedItems = safeItems.filter(item => {
            const listingId = this.normalizeListingId(item);
            return !(listingId > 0 && byListingId.has(listingId)) && this.hasTargetStockDaysNaturalKey(item);
        });
        const naturalWhere = this.buildUniqueNaturalWhereList(unmatchedItems);
        const byNaturalKey = new Map<string, AppAmzBsrReplenishVolatilityCoefficientEntity>();

        if (naturalWhere.length > 0) {
            const records = await this.replenishVolatilityCoefficientRepo.find({ where: naturalWhere as any });
            for (const record of records) {
                byNaturalKey.set(this.buildNaturalKey(record), record);
            }
        }

        const admin = this.ctx?.admin || {};
        const recordsToSave: AppAmzBsrReplenishVolatilityCoefficientEntity[] = [];
        const createdByNaturalKey = new Map<string, AppAmzBsrReplenishVolatilityCoefficientEntity>();
        const rows: Array<{
            clientKey: string;
            matchedBy: string;
            listingId: number;
            record: AppAmzBsrReplenishVolatilityCoefficientEntity | null;
        }> = [];

        for (let index = 0; index < safeItems.length; index++) {
            const item = safeItems[index] || {};
            const clientKey = item.clientKey || item._batchId || item.listing_id || item.id || item.product_code || `item_${index}`;
            const listingId = this.normalizeListingId(item);
            let record = listingId > 0 ? byListingId.get(listingId) : null;
            let matchedBy = record ? 'listing_id' : '';

            if (!record && this.hasTargetStockDaysNaturalKey(item)) {
                const naturalKey = this.buildNaturalKey(item);
                record = byNaturalKey.get(naturalKey) || createdByNaturalKey.get(naturalKey);
                matchedBy = record ? 'natural_key' : '';

                if (!record) {
                    record = new AppAmzBsrReplenishVolatilityCoefficientEntity();
                    this.fillVolatilityRecordIdentity(record, item, listingId);
                    record.volatility_coefficient = DEFAULT_VOLATILITY_COEFFICIENT;
                    record.updated_by = admin.userId || null;
                    record.updated_by_name = admin.username || '';
                    recordsToSave.push(record);
                    createdByNaturalKey.set(naturalKey, record);
                    matchedBy = 'default_created';
                }
            }

            if (record && listingId > 0 && record.listing_id !== listingId) {
                record.listing_id = listingId;
                if (!recordsToSave.includes(record)) recordsToSave.push(record);
            }

            rows.push({ clientKey, matchedBy, listingId, record: record || null });
        }

        if (recordsToSave.length > 0) {
            await this.replenishVolatilityCoefficientRepo.save(recordsToSave);
        }

        return {
            total: safeItems.length,
            list: rows.map(row => ({
                clientKey: row.clientKey,
                found: !!row.record,
                matchedBy: row.matchedBy,
                record_id: row.record?.id || null,
                listing_id: row.listingId || null,
                volatility_coefficient: normalizeVolatilityCoefficient(row.record?.volatility_coefficient),
                updated_by: row.record?.updated_by ?? null,
                updated_by_name: row.record?.updated_by_name || ''
            }))
        };
    }

    /**
     * 保存单品波动系数。
     */
    async saveVolatilityCoefficient(param: any = {}) {
        const listingId = this.normalizeListingId(param);
        const volatilityCoefficient = parseVolatilityCoefficient(param.volatility_coefficient);

        if (!this.hasTargetStockDaysNaturalKey(param)) {
            throw new Error('缺少 product_code、marketplace、asin、msku 或 store_id，无法保存波动系数');
        }

        let record: AppAmzBsrReplenishVolatilityCoefficientEntity = null;
        let matchedBy = '';

        if (listingId > 0) {
            record = await this.replenishVolatilityCoefficientRepo.findOne({
                where: { listing_id: listingId }
            });
            matchedBy = record ? 'listing_id' : '';
        }

        if (!record) {
            record = await this.replenishVolatilityCoefficientRepo.findOne({
                where: this.buildNaturalWhere(param) as any
            });
            matchedBy = record ? 'natural_key' : '';
        }

        if (!record) {
            record = new AppAmzBsrReplenishVolatilityCoefficientEntity();
            matchedBy = 'created';
        }

        const admin = this.ctx?.admin || {};
        this.fillVolatilityRecordIdentity(record, param, listingId);
        record.volatility_coefficient = volatilityCoefficient;
        record.updated_by = admin.userId || null;
        record.updated_by_name = admin.username || '';

        const saved = await this.replenishVolatilityCoefficientRepo.save(record);

        return {
            success: true,
            matchedBy,
            record_id: saved.id,
            listing_id: saved.listing_id,
            volatility_coefficient: normalizeVolatilityCoefficient(saved.volatility_coefficient),
            updated_by: saved.updated_by,
            updated_by_name: saved.updated_by_name
        };
    }

    /**
     * 目标库存天数总量算法。
     *
     * 口径：
     * 1. 目标天数从今天开始算，包含今天；
     * 2. target_days 为空或 0 时使用全局默认 20 天；
     * 3. 只统计 amazonSaleDate 落在目标窗口内的在途货件；
     * 4. 只做总量，不模拟中间断货。
     */
    async calculateTargetReplenishmentBatch(items: any[] = [], defaultTargetDays?: number) {
        const safeItems = Array.isArray(items) ? items.slice(0, 200) : [];
        const normalizedDefaultDays = this.normalizeDefaultTargetDays(defaultTargetDays);
        const today = dayjs().startOf('day');

        const list = safeItems.map((item, index) => {
            const clientKey = item?.clientKey || item?._batchId || item?.listing_id || item?.id || item?.product_code || `item_${index}`;

            try {
                return {
                    clientKey,
                    success: true,
                    ...this.calculateTargetReplenishmentForItem(item || {}, today, normalizedDefaultDays)
                };
            } catch (error) {
                return {
                    clientKey,
                    success: false,
                    message: error?.message || '目标补货建议计算失败',
                    effective_target_days: normalizedDefaultDays,
                    suggest_quantity: 0
                };
            }
        });

        return {
            defaultTargetDays: normalizedDefaultDays,
            total: safeItems.length,
            list
        };
    }

    private calculateTargetReplenishmentForItem(item: any, today: dayjs.Dayjs, defaultTargetDays: number) {
        const targetDays = this.normalizeTargetCalcDays(item?.target_days);
        const effectiveTargetDays = targetDays > 0 ? targetDays : defaultTargetDays;
        const startDate = today.format('YYYY-MM-DD');
        const endDate = today.add(effectiveTargetDays - 1, 'day').format('YYYY-MM-DD');
        const dailyAvgSales = this.normalizeTargetQuantity(item?.dailyAvgSales ?? item?.daily_avg_sales);
        const fbaQuantity = this.normalizeTargetQuantity(item?.fba_quantity ?? item?.fbaValid ?? item?.fba_valid);
        const inboundDetails = this.getTargetInboundDetails(item, startDate, endDate);
        const inboundQuantity = inboundDetails.reduce((sum, detail) => sum + detail.quantity, 0);
        const targetDemandRaw = dailyAvgSales * effectiveTargetDays;
        const targetDemand = Math.round(targetDemandRaw);
        const suggestQuantity = Math.max(0, Math.round(targetDemand - fbaQuantity - inboundQuantity));

        return {
            listing_id: this.normalizeListingId(item) || null,
            product_code: item?.product_code || '',
            marketplace: item?.marketplace || '',
            asin: item?.asin || '',
            msku: item?.msku || '',
            store_id: Number(item?.store_id) || null,
            target_days: targetDays,
            effective_target_days: effectiveTargetDays,
            used_default_target_days: !(targetDays > 0),
            target_start_date: startDate,
            target_end_date: endDate,
            daily_avg_sales: dailyAvgSales,
            fba_quantity: fbaQuantity,
            inbound_quantity_in_target_days: inboundQuantity,
            inbound_details: inboundDetails,
            target_demand: targetDemand,
            target_demand_raw: Number(targetDemandRaw.toFixed(2)),
            suggest_quantity: suggestQuantity,
            formula: `${targetDemand} - ${fbaQuantity} - ${inboundQuantity} = ${suggestQuantity}`
        };
    }

    private normalizeDefaultTargetDays(value: any) {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) return this.DEFAULT_TARGET_STOCK_DAYS;
        return Math.min(Math.round(num), this.MAX_TARGET_STOCK_DAYS);
    }

    private normalizeTargetCalcDays(value: any) {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        if (!Number.isInteger(num) || num < 0 || num > this.MAX_TARGET_STOCK_DAYS) {
            throw new Error(`目标库存天数必须是 0 到 ${this.MAX_TARGET_STOCK_DAYS} 之间的整数`);
        }
        return num;
    }

    private normalizeTargetQuantity(value: any) {
        const num = Number(value);
        return Number.isFinite(num) && num > 0 ? num : 0;
    }

    private getTargetInboundDetails(item: any, startDate: string, endDate: string) {
        const list = Array.isArray(item?.fbaShippingList)
            ? item.fbaShippingList
            : (Array.isArray(item?.restocking?.fbaShippingList) ? item.restocking.fbaShippingList : []);
        const rowMsku = String(item?.msku || '').trim();

        return list
            .filter((shipping: any) => {
                if (rowMsku && shipping?.msku && shipping.msku !== rowMsku) return false;
                const saleDate = this.normalizeTargetDateString(shipping?.amazonSaleDate);
                return saleDate && saleDate >= startDate && saleDate <= endDate;
            })
            .map((shipping: any) => ({
                orderSn: shipping?.orderSn || shipping?.order_sn || '',
                shippingOrderSn: shipping?.shippingOrderSn || shipping?.shipping_order_sn || '',
                shipmentSn: shipping?.shipmentSn || shipping?.shipment_sn || '',
                shippingMethod: shipping?.shippingMethod || shipping?.shipping_method || shipping?.logisticsChannelName || '',
                logisticsChannelName: shipping?.logisticsChannelName || '',
                amazonSaleDate: this.normalizeTargetDateString(shipping?.amazonSaleDate),
                quantity: Math.round(this.normalizeTargetQuantity(shipping?.quantity))
            }))
            .filter((shipping: any) => shipping.quantity > 0);
    }

    private normalizeTargetDateString(value: any) {
        if (!value) return '';
        const parsed = dayjs(value);
        return parsed.isValid() ? parsed.format('YYYY-MM-DD') : '';
    }

    private normalizeListingId(item: any) {
        const raw = item?.listing_id ?? item?.id;
        const id = Number(raw);
        return Number.isFinite(id) && id > 0 ? id : 0;
    }

    private normalizeTargetDays(value: any): number | null {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        if (!Number.isInteger(num) || num < 0 || num > this.MAX_TARGET_STOCK_DAYS) {
            throw new Error(`目标库存天数必须是 0 到 ${this.MAX_TARGET_STOCK_DAYS} 之间的整数`);
        }
        return num;
    }

    private normalizeStoredTargetDays(value: any): number | null {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        return Number.isInteger(num) && num >= 0 && num <= this.MAX_TARGET_STOCK_DAYS ? num : null;
    }

    private hasTargetStockDaysNaturalKey(item: any) {
        return Boolean(
            String(item?.product_code || '').trim() &&
            String(item?.marketplace || '').trim() &&
            String(item?.asin || '').trim() &&
            String(item?.msku || '').trim() &&
            Number(item?.store_id) > 0
        );
    }

    private buildNaturalWhere(item: any) {
        return {
            product_code: String(item.product_code).trim(),
            marketplace: String(item.marketplace).trim(),
            asin: String(item.asin).trim(),
            msku: String(item.msku).trim(),
            store_id: Number(item.store_id)
        };
    }

    private buildNaturalKey(item: any) {
        const key = this.buildNaturalWhere(item);
        return [
            key.product_code,
            key.marketplace,
            key.asin,
            key.msku,
            key.store_id
        ].join('|');
    }

    private buildUniqueNaturalWhereList(items: any[]) {
        const seen = new Set<string>();
        const whereList: any[] = [];

        for (const item of items) {
            if (!this.hasTargetStockDaysNaturalKey(item)) continue;
            const key = this.buildNaturalKey(item);
            if (seen.has(key)) continue;
            seen.add(key);
            whereList.push(this.buildNaturalWhere(item));
        }

        return whereList;
    }

    private fillVolatilityRecordIdentity(
        record: AppAmzBsrReplenishVolatilityCoefficientEntity,
        item: any,
        listingId: number
    ) {
        record.listing_id = listingId || null;
        record.product_code = String(item.product_code).trim();
        record.marketplace = String(item.marketplace).trim();
        record.asin = String(item.asin).trim();
        record.msku = String(item.msku).trim();
        record.store_id = Number(item.store_id);
    }

    private getShippingMethodPrefClientKey(item: any, index: number) {
        return item?.clientKey || item?._batchId || item?.listing_id || item?.id || item?.product_code || `item_${index}`;
    }

    private buildUniqueShippingMethodPrefNaturalWhereList(items: any[], userId: number) {
        const seen = new Set<string>();
        const whereList: any[] = [];

        for (const item of items) {
            if (!hasShippingMethodNaturalKey(item)) continue;
            const key = buildShippingMethodNaturalKey(item);
            if (seen.has(key)) continue;
            seen.add(key);
            whereList.push({
                user_id: userId,
                ...buildShippingMethodNaturalWhere(item)
            });
        }

        return whereList;
    }

    private deduplicateShippingMethodPrefRecords(records: AppAmzBsrReplenishShippingMethodPrefEntity[]) {
        const byId = new Map<number, AppAmzBsrReplenishShippingMethodPrefEntity>();
        const withoutId: AppAmzBsrReplenishShippingMethodPrefEntity[] = [];

        for (const record of records || []) {
            if (record?.id) {
                byId.set(Number(record.id), record);
            } else if (record) {
                withoutId.push(record);
            }
        }

        return [...byId.values(), ...withoutId];
    }


    /**
     * 获取分析图表全量数据
     * @param product_code 产品编码（用于汇总该编码下所有选品的竞品数据）
     * @param marketplace 国家/站点
     * @param asin 当前选品的ASIN（用于查询库存数据）
     * @param shop 当前选品的店铺名称（用于精确匹配 restocking 表）
     */
    async getAnalysisData(product_code: string, marketplace: string, asin?: string, shop?: string) {
        const currentYear = dayjs().year();
        const lastYear = currentYear - 1;

        // 步骤1: 查询该 product_code 下的所有选品的 ASIN（去重）
        const listings = await this.listingRepo.find({
            where: { product_code, marketplace },
            select: ['asin']
        });
        const allAsins = [...new Set(listings.map(l => l.asin).filter(Boolean))];

        if (allAsins.length === 0) {
            // 没有找到选品，返回空数据
            return this.emptyAnalysisData(currentYear, lastYear);
        }

        // 步骤2: 查询这些选品的竞品（按 asin_competitor 去重）
        const competitors = await this.competitorRepo
            .createQueryBuilder('c')
            .where('c.asin_candidate IN (:...asins)', { asins: allAsins })
            .andWhere('c.marketplace = :marketplace', { marketplace })
            .andWhere('c.status = 6')
            .orderBy('c.asin_competitor')
            .addOrderBy('c.updateTime', 'DESC')
            .getMany();

        // 按 asin_competitor 去重（保留最新的一条）
        const uniqueCompetitors = this.deduplicateByAsinCompetitor(competitors);

        // 库存使用传入的 asin 参数（如果未传则用第一个 ASIN 作为后备）
        const inventoryAsin = asin || allAsins[0];

        // ========== 修改：用 asin + shop + marketplace 精确查询 restocking 表 ==========
        let myRestocking: any = null;
        if (shop) {
            // 店铺名称处理：listing 表的 shop 格式是 "琦路-UK 英国"，restocking 表是 "琦路-UK"
            // 去掉最后的国家名称后缀进行匹配
            const shopPrefix = shop.replace(/\s+\S+$/, '');  // "琦路-UK 英国" -> "琦路-UK"

            // 用 QueryBuilder 精确匹配
            myRestocking = await this.restockingRepo
                .createQueryBuilder('r')
                .where('r.asin = :asin', { asin: inventoryAsin })
                .andWhere('JSON_UNQUOTE(JSON_EXTRACT(r.storeList, "$[0]")) = :shopPrefix', { shopPrefix })
                .andWhere('JSON_UNQUOTE(JSON_EXTRACT(r.marketplaceList, "$[0]")) = :marketplace', { marketplace })
                .getOne();
        }

        // 如果精确匹配没找到，fallback 到只用 asin 查询
        if (!myRestocking) {
            myRestocking = await this.restockingRepo.findOne({
                where: { asin: inventoryAsin }
            });
        }

        const salesData = this.aggregateSales(uniqueCompetitors, currentYear, lastYear);
        const inventoryData = await this.aggregateInventoryFromStatistics(inventoryAsin, marketplace, currentYear, lastYear);
        const inventoryRatio = this.calculateInventoryRatio(myRestocking);

        // ========== 修改：从新字段计算本地可用库存和 FBA 库存 ==========
        // 本地可用库存 = sum(extInfo.localValidDetailList[].quantityValid)
        const localValidList = myRestocking?.extInfo?.localValidDetailList || [];
        const totalLocalValid = localValidList.reduce((sum: number, item: any) => sum + (item.quantityValid || 0), 0);

        // FBA库存 = sum(fbaValidList[].afnFulfillableQuantity)
        const fbaValidList = myRestocking?.fbaValidList || [];
        const totalFbaStock = fbaValidList.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);

        // 货件数据（只取当前 ASIN 的）
        const shipmentByMonth = this.aggregateShipmentsByMonth(myRestocking ? [myRestocking] : []);

        // 注意：促销数据已移至独立接口 /getPromotions，不再阻塞主数据

        return {
            currentYear,
            lastYear,
            salesData,
            inventoryData,
            inventoryRatio,
            stockInfo: {
                localValid: totalLocalValid,  // 修改：使用新字段计算
                inbound: this.sumInbound(myRestocking?.fbaShippingList),
                totalSales30: Number(myRestocking?.salesInfo?.salesTotal30 || 0)
            },
            shipmentList: myRestocking?.fbaShippingList || [],
            // 新增返回
            totalLocalValid,      // 本地可用库存
            totalFbaStock,        // FBA库存（新增）
            shipmentByMonth       // 按月份汇总的货件数据
        };
    }


    /**
     * 核心聚合与分配算法
     * 注意：当前月份的销量从 Main_monthly_sales 字段获取（实时数据）
     */
    private aggregateSales(competitors: AppAmzBsrCandidateCompetitorEntity[], currentYear: number, lastYear: number) {
        const result = {
            current: { month: new Array(12).fill(0), week: new Array(52).fill(0) },
            last: { month: new Array(12).fill(0), week: new Array(52).fill(0) }
        };

        const currentMonth = dayjs().month(); // 0-indexed (0 = January)

        for (const comp of competitors) {
            const rawNodes = this.safeParseJson(comp.sales_volume_data);
            const rawByMonth = this.groupByMonth(rawNodes);

            for (let y of [currentYear, lastYear]) {
                const target = y === currentYear ? result.current : result.last;
                for (let m = 1; m <= 12; m++) {
                    // 跳过当前年份的当前月，避免与 Main_monthly_sales 重复计算
                    if (y === currentYear && (m - 1) === currentMonth) {
                        continue;
                    }

                    const ym = `${y}${m.toString().padStart(2, '0')}`;
                    const items = rawByMonth.get(ym);
                    if (!items || items.length === 0) continue;

                    const totalMonthSales = Number(items[0].searches || 0);
                    target.month[m - 1] += totalMonthSales;

                    const distribution = this.calculateDistributionPerDay(y, m, totalMonthSales);
                    distribution.forEach((val, wIdx) => {
                        target.week[wIdx] += val;
                    });
                }
            }

            // 累加当前月的实时销量 (Main_monthly_sales)
            const currentMonthSales = Number(comp.Main_monthly_sales || 0);
            if (currentMonthSales > 0) {
                result.current.month[currentMonth] += currentMonthSales;

                // 同时分配到对应的周
                const distribution = this.calculateDistributionPerDay(currentYear, currentMonth + 1, currentMonthSales);
                distribution.forEach((val, wIdx) => {
                    result.current.week[wIdx] += val;
                });
            }
        }
        return result;
    }

    /**
     * 余额补齐 (Balance Forward) 分配算法
     */
    private calculateDistributionPerDay(year: number, month: number, total: number): Map<number, number> {
        const finalResult = new Map<number, number>();
        const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
        const weekDays = new Map<number, number>();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}${month.toString().padStart(2, '0')}${d.toString().padStart(2, '0')}`;
            const wIdx = this.getCustomWeekIndex(dateStr);
            weekDays.set(wIdx, (weekDays.get(wIdx) || 0) + 1);
        }

        const indices = Array.from(weekDays.keys()).sort((a, b) => a - b);
        let runningSum = 0;
        const targetTotal = Math.round(total);

        indices.forEach((wIdx, i) => {
            if (i === indices.length - 1) {
                // 最后一周：补齐数学误差，确保总和分毫不差
                finalResult.set(wIdx, Math.max(0, targetTotal - runningSum));
            } else {
                const share = Math.round((weekDays.get(wIdx) / daysInMonth) * targetTotal);
                finalResult.set(wIdx, share);
                runningSum += share;
            }
        });

        return finalResult;
    }

    private groupByMonth(nodes: any[]) {
        const groups = new Map<string, any[]>();
        nodes.forEach(item => {
            const dateStr = this.normalizeDate(item.date);
            if (!dateStr) return;
            const ym = dateStr.substring(0, 6);
            if (!groups.has(ym)) groups.set(ym, []);
            groups.get(ym).push({ ...item, dateStr });
        });
        return groups;
    }

    private normalizeDate(date: any): string {
        if (!date) return '';
        let d = String(date).trim();
        if (d.length === 6 && /^\d+$/.test(d)) d += '01';
        if (d.length === 8 && /^\d+$/.test(d)) return d;
        if (d.includes('-')) {
            const parts = d.split('-');
            if (parts.length >= 2) return parts[0] + parts[1].padStart(2, '0') + (parts[2] || '01').padStart(2, '0');
        }
        return dayjs(date).format('YYYYMMDD');
    }

    private getCustomWeekIndex(dateStr: string): number {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        const targetDate = dayjs(`${year}-${month}-${day}`);
        const startOfYear = dayjs(`${year}-01-01`);
        const diffDays = targetDate.diff(startOfYear, 'day');
        let weekIndex = Math.floor(diffDays / 7);
        return weekIndex >= 52 ? 51 : (weekIndex < 0 ? 0 : weekIndex);
    }

    private safeParseJson(data: any): any[] {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) { return []; }
    }

    private calculateInventoryRatio(data: AppAmzBsrRestockingCenterLingxingEntity) {
        if (!data) return 0;
        const local = Number(data.scmQuantityInfo?.scQuantityLocalValid || 0);
        const inbound = this.sumInbound(data.fbaShippingList);
        const sales30 = Number(data.salesInfo?.salesTotal30 || 1);
        const totalStock = local + inbound;
        return Math.round((totalStock / (sales30 || 1)) * 100);
    }

    private sumInbound(list: any[]) {
        if (!list) return 0;
        return list.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    }

    /**
     * 汇总所有选品的货件数据，按 amazonSaleDate 月份分组
     * 返回格式: { "2026-01": { total: 50, details: [...] }, ... }
     */
    private aggregateShipmentsByMonth(restockingData: AppAmzBsrRestockingCenterLingxingEntity[]) {
        const result: Record<string, { total: number; details: any[] }> = {};

        for (const item of restockingData) {
            const fbaShippingList = item.fbaShippingList || [];
            for (const shipment of fbaShippingList) {
                // 用 amazonSaleDate 提取月份
                const amazonSaleDate = shipment.amazonSaleDate;
                if (!amazonSaleDate) continue;

                const month = amazonSaleDate.substring(0, 7); // "2026-01-29" → "2026-01"

                if (!result[month]) {
                    result[month] = { total: 0, details: [] };
                }

                result[month].total += Number(shipment.quantity) || 0;
                result[month].details.push({
                    asin: item.asin,
                    store_name: item.storeList?.[0] || '未知店铺',
                    orderSn: shipment.orderSn,
                    quantity: shipment.quantity,
                    amazonSaleDate: shipment.amazonSaleDate,
                    shipmentTime: shipment.shipmentTime,
                    logisticsChannelName: shipment.logisticsChannelName,
                    shippingMethod: shipment.shippingMethod
                });
            }
        }

        return result;
    }

    /**
     * 从 amazon_product_competitor_statistics 表查询库存数据
     * 算法：
     * - 月视图：该月所有有效采集库存的平均值（取整）
     * - 周视图：直接使用该周采集的快照值，无数据显示0
     */
    private async aggregateInventoryFromStatistics(asin: string, marketplace: string, currentYear: number, lastYear: number) {
        // 国家 -> 字段名映射
        const fieldMap: Record<string, string> = {
            '英国': 'units_30_sum_fba_uk',
            '德国': 'units_30_sum_fba_de',
            '法国': 'units_30_sum_fba_fr',
            '西班牙': 'units_30_sum_fba_es',
            '意大利': 'units_30_sum_fba_it'
        };
        const targetField = fieldMap[marketplace] || 'units_30_sum_fba_uk';

        // 查询所有有效记录 (crawler_time 不为空)
        const records = await this.statisticsRepo.find({
            where: {
                asin_candidate: asin,
                marketplace: marketplace,
                crawler_time: Not(IsNull())
            },
            order: { crawler_time: 'ASC' }
        });

        // 结果结构
        const result = {
            current: { month: new Array(12).fill(0), week: new Array(52).fill(0) },
            last: { month: new Array(12).fill(0), week: new Array(52).fill(0) }
        };

        // 用于计算月平均的临时存储 { '202501': [100, 120, ...], ... }
        const monthlyData: Record<string, number[]> = {};
        // 周数据分年份存储 { '2025_0': 800, '2025_1': 850, '2026_0': 1080, ... }
        const weeklyDataByYear: Record<string, number> = {};

        const today = dayjs();

        for (const record of records) {
            if (!record.crawler_time) continue;

            // 解析 crawler_time (格式: yyyyMMdd)
            const crawlerDate = dayjs(record.crawler_time, 'YYYYMMDD');
            if (!crawlerDate.isValid()) continue;

            const year = crawlerDate.year();
            // 只处理当前年和上一年的数据
            if (year !== currentYear && year !== lastYear) continue;

            // 跳过未来日期
            if (crawlerDate.isAfter(today)) continue;

            // 解析库存值 (格式: "销量|库存")
            const fieldValue = (record as any)[targetField];
            if (!fieldValue || fieldValue === '0|0') continue;

            const parts = String(fieldValue).split('|');
            const inventory = parseInt(parts[1] || '0', 10);
            if (isNaN(inventory) || inventory <= 0) continue;

            // 月份 key (YYYYMM)
            const monthKey = crawlerDate.format('YYYYMM');
            if (!monthlyData[monthKey]) monthlyData[monthKey] = [];
            monthlyData[monthKey].push(inventory);

            // 周索引 (使用年份+周索引作为复合键)
            const weekIdx = this.getCustomWeekIndex(record.crawler_time);
            const weekKey = `${year}_${weekIdx}`;
            // 周数据只保留最新的（后采集的覆盖先采集的）
            weeklyDataByYear[weekKey] = inventory;
        }

        // 填充月数据（平均值取整）
        for (const [monthKey, inventories] of Object.entries(monthlyData)) {
            const year = parseInt(monthKey.substring(0, 4), 10);
            const month = parseInt(monthKey.substring(4, 6), 10) - 1; // 0-indexed
            const avg = Math.round(inventories.reduce((a, b) => a + b, 0) / inventories.length);

            if (year === currentYear) {
                result.current.month[month] = avg;
            } else if (year === lastYear) {
                result.last.month[month] = avg;
            }
        }

        // 填充周数据（按年份分离）
        for (const [weekKey, inventory] of Object.entries(weeklyDataByYear)) {
            const [yearStr, weekIdxStr] = weekKey.split('_');
            const year = parseInt(yearStr, 10);
            const weekIdx = parseInt(weekIdxStr, 10);

            if (weekIdx >= 0 && weekIdx < 52) {
                if (year === currentYear) {
                    result.current.week[weekIdx] = inventory;
                } else if (year === lastYear) {
                    result.last.week[weekIdx] = inventory;
                }
            }
        }

        return result;
    }

    /**
     * 旧的模拟方法（作为备用）
     */
    private aggregateInventory(competitors: AppAmzBsrCandidateCompetitorEntity[], currentYear: number, lastYear: number) {
        const mockMonthlyLast = [100, 150, 180, 200, 170, 160, 190, 220, 200, 180, 160, 140];
        const mockMonthlyCurrent = [120, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        const lastWeek = new Array(52).fill(0);
        const currentWeek = new Array(52).fill(0);

        for (let m = 0; m < 12; m++) {
            const distribution = this.calculateDistributionPerDay(lastYear, m + 1, mockMonthlyLast[m]);
            distribution.forEach((val, wIdx) => {
                lastWeek[wIdx] += val;
            });
        }
        for (let m = 0; m < 12; m++) {
            const distribution = this.calculateDistributionPerDay(currentYear, m + 1, mockMonthlyCurrent[m]);
            distribution.forEach((val, wIdx) => {
                currentWeek[wIdx] += val;
            });
        }
        return {
            current: { month: mockMonthlyCurrent, week: currentWeek },
            last: { month: mockMonthlyLast, week: lastWeek }
        };
    }

    /**
     * 按竞品 ASIN 去重（保留每个竞品的第一条记录，因为已按 updateTime DESC 排序）
     */
    private deduplicateByAsinCompetitor(competitors: AppAmzBsrCandidateCompetitorEntity[]): AppAmzBsrCandidateCompetitorEntity[] {
        const seen = new Set<string>();
        const result: AppAmzBsrCandidateCompetitorEntity[] = [];

        for (const comp of competitors) {
            const key = comp.asin_competitor;
            if (key && !seen.has(key)) {
                seen.add(key);
                result.push(comp);
            }
        }

        return result;
    }

    /**
     * 返回空的分析数据（当没有找到选品时使用）
     */
    private emptyAnalysisData(currentYear: number, lastYear: number) {
        return {
            currentYear,
            lastYear,
            salesData: {
                current: { month: new Array(12).fill(0), week: new Array(52).fill(0) },
                last: { month: new Array(12).fill(0), week: new Array(52).fill(0) }
            },
            inventoryData: {
                current: { month: new Array(12).fill(0), week: new Array(52).fill(0) },
                last: { month: new Array(12).fill(0), week: new Array(52).fill(0) }
            },
            inventoryRatio: 0,
            stockInfo: {
                localValid: 0,
                inbound: 0,
                totalSales30: 0
            },
            shipmentList: []
        };
    }

    // =====================================================
    // ========== 领星"我的销量"数据获取逻辑 ==========
    // =====================================================

    /**
     * 获取我的销量数据（智能缓存版本 - 使用新表 app_amz_bsr_sales_cache_lingxing）
     * 1. 从 listing 表获取基础信息（store_id, asin, msku）
     * 2. 在新缓存表中查找/创建记录
     * 3. 检查历史数据完整性（带并发锁）
     * 4. 更新缓存表
     * 5. 清理超过15个月的旧数据
     */
    async getMySalesData(product_code: string, marketplace: string, forceRefresh: boolean = false) {
        const lockKey = `${product_code}:${marketplace}`;

        // Step 1: 从 listing 表获取基础信息
        const listings = await this.listingRepo.find({
            where: { product_code, marketplace },
            select: ['id', 'msku', 'store_id', 'asin']
        });

        if (listings.length === 0) {
            console.log(`[我的销量] 未找到选品`);
            return { ...this.emptyMySalesData(), syncing: false };
        }

        const today = dayjs();
        const todayStr = today.format('YYYY-MM-DD');
        const currentMonth = today.format('YYYY-MM');

        // Step 2: 确保新表中有对应的缓存记录
        const cacheRecords: AppAmzBsrSalesCacheLingxingEntity[] = [];
        for (const listing of listings) {
            if (!listing.store_id || !listing.asin) continue;

            let cacheRecord = await this.salesCacheRepo.findOne({
                where: { store_id: listing.store_id, asin: listing.asin, marketplace }
            });

            if (!cacheRecord) {
                // 创建新记录
                cacheRecord = await this.salesCacheRepo.save({
                    store_id: listing.store_id,
                    asin: listing.asin,
                    marketplace,
                    msku: listing.msku,
                    my_sales_monthly: {},
                    my_sales_weekly: {}
                });
                console.log(`[我的销量] 创建缓存记录: store=${listing.store_id}, asin=${listing.asin}`);
            } else if (cacheRecord.msku !== listing.msku) {
                // 更新 msku（以防变更）
                await this.salesCacheRepo.update(cacheRecord.id, { msku: listing.msku });
                cacheRecord.msku = listing.msku;
            }

            cacheRecords.push(cacheRecord);
        }

        if (cacheRecords.length === 0) {
            console.log(`[我的销量] 无有效缓存记录`);
            return { ...this.emptyMySalesData(), syncing: false };
        }

        const storeIds = [...new Set(cacheRecords.map(r => r.store_id).filter(Boolean))];
        const allMskus = cacheRecords.map(r => r.msku).filter(Boolean);

        // Step 3: 检查是否需要同步
        let needsSync = forceRefresh;
        if (!forceRefresh) {
            const requiredMonths = this.getRequiredMonths(today);
            const { missingMonths, hasAnyData } = this.checkHistoryCompletenessV2(cacheRecords, requiredMonths);
            if (!hasAnyData || missingMonths.length > 0) {
                needsSync = true;
            } else {
                needsSync = this.checkCurrentMonthNeedsUpdateV2(cacheRecords, currentMonth, todayStr);
            }
        }

        // Step 4: 如果需要同步，检查并发锁
        if (needsSync) {
            if (AppAnalysisCustomService.salesSyncLocks.get(lockKey)) {
                console.log(`[我的销量] ${lockKey} 正在同步中，返回当前缓存`);
                return { ...this.aggregateMySalesV2(cacheRecords), syncing: true };
            }

            try {
                // 加锁
                AppAnalysisCustomService.salesSyncLocks.set(lockKey, true);
                console.log(`\n${'='.repeat(50)}`);
                console.log(`[我的销量] 开始同步 ${lockKey}（使用新缓存表）`);
                console.log(`[我的销量] 缓存记录: ${cacheRecords.length} 个, MSKU: ${allMskus.join(', ')}`);
                console.log(`${'='.repeat(50)}`);

                if (forceRefresh) {
                    console.log(`[我的销量] 强制刷新模式 - 重新请求所有数据`);
                    await this.fetchAndUpdateMySalesV2(storeIds, allMskus, cacheRecords, marketplace, true);
                } else {
                    const requiredMonths = this.getRequiredMonths(today);
                    const { missingMonths, hasAnyData } = this.checkHistoryCompletenessV2(cacheRecords, requiredMonths);

                    if (!hasAnyData) {
                        console.log(`[我的销量] 没有历史数据，执行全量请求`);
                        await this.fetchAndUpdateMySalesV2(storeIds, allMskus, cacheRecords, marketplace, true);
                    } else if (missingMonths.length > 0) {
                        console.log(`[我的销量] 缺少 ${missingMonths.length} 个月份: ${missingMonths.join(', ')}`);
                        await this.fetchMissingMonthsV2(storeIds, allMskus, cacheRecords, missingMonths, todayStr, marketplace);
                        await this.updateCurrentMonthOnlyV2(storeIds, allMskus, cacheRecords, currentMonth, todayStr, marketplace);
                    } else {
                        const needsUpdate = this.checkCurrentMonthNeedsUpdateV2(cacheRecords, currentMonth, todayStr);
                        if (needsUpdate && storeIds.length > 0) {
                            console.log(`[我的销量] 历史完整，更新当前月份: ${currentMonth}`);
                            await this.updateCurrentMonthOnlyV2(storeIds, allMskus, cacheRecords, currentMonth, todayStr, marketplace);
                        } else {
                            console.log(`[我的销量] 所有数据已是最新`);
                        }
                    }
                }
            } finally {
                // 解锁
                AppAnalysisCustomService.salesSyncLocks.delete(lockKey);
                console.log(`[我的销量] ${lockKey} 同步完成，解锁`);
            }
        } else {
            console.log(`[我的销量] 所有数据已是最新，无需同步`);
        }

        // 重新查询更新后的缓存数据
        const updatedCaches = await this.salesCacheRepo.find({
            where: cacheRecords.map(r => ({ store_id: r.store_id, asin: r.asin, marketplace }))
        });

        // 清理过期数据并保存
        for (const cache of updatedCaches) {
            const monthlyCache = cache.my_sales_monthly || {};
            const weeklyCache = cache.my_sales_weekly || {};
            this.cleanOldCacheData(monthlyCache, 15, false);
            this.cleanOldCacheData(weeklyCache, 60, true);
            await this.salesCacheRepo.update(cache.id, {
                my_sales_monthly: monthlyCache,
                my_sales_weekly: weeklyCache
            });
        }

        // 打印明细表
        this.printMySalesSummaryV2(updatedCaches, storeIds);

        return { ...this.aggregateMySalesV2(updatedCaches), syncing: false };
    }


    /**
     * 获取柱状图需要的13个月列表
     */
    private getRequiredMonths(today: dayjs.Dayjs): string[] {
        const months: string[] = [];
        const start = today.subtract(12, 'month').startOf('month');
        for (let i = 0; i <= 12; i++) {
            months.push(start.add(i, 'month').format('YYYY-MM'));
        }
        return months;
    }



    /**
     * 分页获取领星销量数据（按单个店铺请求）
     */
    private async fetchLingxingSalesPages(
        storeIds: number[],
        startDate: string,
        endDate: string,
        dateUnit: string
    ): Promise<any[]> {
        const allData: any[] = [];
        const dateUnitName = dateUnit === '2' ? '月' : '周';

        // 按店铺逐个请求
        for (const storeId of storeIds) {
            let page = 1;
            const length = 200;
            let hasMore = true;

            console.log(`[领星API] 开始请求 店铺=${storeId}, ${dateUnitName}视图`);

            while (hasMore) {
                const params = {
                    start_date: startDate,
                    end_date: endDate,
                    result_type: '1', // 销量
                    date_unit: dateUnit,
                    page,
                    length,
                    data_type: '3', // MSKU
                    sids: [String(storeId)]
                };

                // 简洁请求日志
                console.log(`[领星API] 请求: {sids: ["${storeId}"], date_unit: "${dateUnit}", page: ${page}, start_date: "${startDate}", end_date: "${endDate}"}`);

                const result = await this.lingXingUtils.httpPost(
                    '/basicOpen/platformStatisticsV2/saleStat/pageList',
                    params,
                    true // return_raw_response
                );

                if (result && result.code === 0 && Array.isArray(result.data)) {
                    console.log(`[领星API] 响应: code=${result.code}, 返回 ${result.data.length} 条, total=${result.total}`);
                    // 打印完整原始响应（使用 JSON.stringify 确保显示所有嵌套内容）
                    if (result.data.length > 0 && page === 1) {
                        console.log(`[领星API] 完整响应数据:\n${JSON.stringify(result.data, null, 2)}`);
                    }
                    allData.push(...result.data);
                    hasMore = result.data.length >= length;
                    page++;
                    // 添加请求间隔避免限流
                    await new Promise(resolve => setTimeout(resolve, 300));
                } else {
                    console.error(`[领星API] 响应错误: code=${result?.code}, message=${result?.message}`);
                    hasMore = false;
                }
            }
        }

        console.log(`[领星API] 总计获取 ${allData.length} 条 (${dateUnitName}视图)`);
        return allData;
    }

    /**
     * 清理过期的缓存数据
     * @param cache 缓存对象
     * @param maxPeriods 保留的最大期数（月视图=月数，周视图=周数）
     * @param isWeekly 是否为周视图
     */
    private cleanOldCacheData(cache: Record<string, any>, maxPeriods: number, isWeekly: boolean = false) {
        const cutoff = isWeekly
            ? dayjs().subtract(maxPeriods, 'week').format('YYYY-MM-DD')
            : dayjs().subtract(maxPeriods, 'month').format('YYYY-MM');

        let deletedCount = 0;
        for (const key of Object.keys(cache)) {
            // 提取日期部分进行比较
            const datePart = key.split('~')[0]; // 月视图："YYYY-MM"，周视图："YYYY-MM-DD"
            const compareDate = isWeekly ? datePart : datePart.substring(0, 7);

            if (compareDate < cutoff) {
                console.log(`[清理] 删除过期数据: ${key}`);
                delete cache[key];
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            console.log(`[清理] 共删除 ${deletedCount} 条过期${isWeekly ? '周' : '月'}数据 (cutoff=${cutoff})`);
        }
    }



    /**
     * 返回空的我的销量数据结构
     */
    private emptyMySalesData() {
        return {
            monthly: {},
            weekly: {},
            lastUpdated: null
        };
    }

    /**
     * 强制刷新我的销量数据
     */
    async forceRefreshMySales(product_code: string, marketplace: string) {
        console.log(`[forceRefreshMySales] 强制刷新: product_code=${product_code}, marketplace=${marketplace}`);
        return this.getMySalesData(product_code, marketplace, true);
    }

    // ================== 批量请求辅助方法 ==================

    /**
     * 生成2个月一批的时间段列表
     */
    private generateMonthBatches(start: dayjs.Dayjs, end: dayjs.Dayjs): { start: string; end: string }[] {
        const batches: { start: string; end: string }[] = [];
        let current = start.startOf('month');

        while (current.isBefore(end) || current.isSame(end, 'month')) {
            const batchStart = current.format('YYYY-MM-DD');
            const batchEndMonth = current.add(1, 'month').endOf('month');
            const actualEnd = batchEndMonth.isAfter(end) ? end.format('YYYY-MM-DD') : batchEndMonth.format('YYYY-MM-DD');

            batches.push({ start: batchStart, end: actualEnd });
            current = current.add(2, 'month');
        }

        return batches;
    }

    /**
     * 获取时间范围内的月份列表
     */
    private getMonthsInRange(start: string, end: string): string[] {
        const months: string[] = [];
        let current = dayjs(start).startOf('month');
        const endDate = dayjs(end);

        while (current.isBefore(endDate) || current.isSame(endDate, 'month')) {
            months.push(current.format('YYYY-MM'));
            current = current.add(1, 'month');
        }

        return months;
    }



    /**
     * 扩展月份列表，添加前后邻居月份
     */
    private expandMonthsWithNeighbors(months: string[]): string[] {
        const expanded = new Set<string>();

        for (const month of months) {
            const current = dayjs(month + '-01');
            expanded.add(current.subtract(1, 'month').format('YYYY-MM'));
            expanded.add(month);
            expanded.add(current.add(1, 'month').format('YYYY-MM'));
        }

        const today = dayjs();
        return [...expanded]
            .filter(m => dayjs(m + '-01').isBefore(today.add(1, 'month')))
            .sort();
    }

    /**
     * 通用批次数据请求（简化日志）
     */
    private async fetchBatchData(
        storeId: number,
        startDate: string,
        endDate: string,
        dateUnit: string,
        targetMskus: string[]
    ): Promise<any[]> {
        const allData: any[] = [];
        const dateUnitName = dateUnit === '2' ? '月' : '周';
        let page = 1;
        const length = 200;
        let hasMore = true;

        while (hasMore) {
            const params = {
                start_date: startDate,
                end_date: endDate,
                result_type: '1',
                date_unit: dateUnit,
                page,
                length,
                data_type: '3',
                sids: [String(storeId)]
            };

            // 简化请求日志
            console.log(`[API] ${dateUnitName}视图 店铺=${storeId} ${startDate}~${endDate} 页=${page}`);

            const result = await this.lingXingUtils.httpPost(
                '/basicOpen/platformStatisticsV2/saleStat/pageList',
                params,
                true
            );

            if (result && result.code === 0 && Array.isArray(result.data)) {
                // 过滤只保留匹配的 MSKU
                const matchedData = result.data.filter((item: any) => {
                    const itemMskus = Array.isArray(item.msku) ? item.msku : [item.msku];
                    return itemMskus.some((m: string) => targetMskus.includes(m));
                });

                if (matchedData.length > 0) {
                    // 只打印匹配到的数据，简洁格式
                    for (const item of matchedData) {
                        console.log(`[匹配] msku=${JSON.stringify(item.msku)}, date_collect=${JSON.stringify(item.date_collect)}, total=${item.volumeTotal}`);
                    }
                    allData.push(...matchedData);
                }

                hasMore = result.data.length >= length;
                page++;

                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } else {
                console.error(`[API错误] code=${result?.code}, msg=${result?.message || result?.msg}`);
                hasMore = false;
            }
        }

        return allData;
    }

    // =====================================================
    // ========== V2 版本方法 - 使用新缓存表 ==========
    // =====================================================

    /**
     * V2: 检查历史数据完整性（使用缓存表）
     */
    private checkHistoryCompletenessV2(cacheRecords: AppAmzBsrSalesCacheLingxingEntity[], requiredMonths: string[]): { missingMonths: string[], hasAnyData: boolean } {
        const missingMonths = new Set<string>();
        let hasAnyData = false;

        for (const cache of cacheRecords) {
            const monthlyCache = cache.my_sales_monthly || {};
            if (Object.keys(monthlyCache).length > 0) {
                hasAnyData = true;
            }
            for (const month of requiredMonths) {
                if (!monthlyCache[month]) {
                    missingMonths.add(month);
                }
            }
        }

        return { missingMonths: [...missingMonths].sort(), hasAnyData };
    }

    /**
     * V2: 检查当前月份是否需要更新
     */
    private checkCurrentMonthNeedsUpdateV2(cacheRecords: AppAmzBsrSalesCacheLingxingEntity[], currentMonth: string, today: string): boolean {
        for (const cache of cacheRecords) {
            const monthlyCache = cache.my_sales_monthly || {};
            const currentMonthData = monthlyCache[currentMonth];
            if (!currentMonthData || currentMonthData.updated_at !== today) {
                return true;
            }
        }
        return false;
    }

    /**
     * V2: 全量请求并更新销量数据（与原逻辑保持一致）
     * 优化策略：
     * 1. 每次请求2个完整月，避免90天限制
     * 2. 先收集所有数据，再统一更新
     * 3. 先初始化13个月默认值为0，再用实际数据覆盖
     */
    private async fetchAndUpdateMySalesV2(
        storeIds: number[],
        allMskus: string[],
        cacheRecords: AppAmzBsrSalesCacheLingxingEntity[],
        marketplace: string,
        fullRefresh: boolean
    ) {
        const today = dayjs();
        const todayStr = today.format('YYYY-MM-DD');
        const currentMonth = today.format('YYYY-MM');
        const chartStart = today.subtract(1, 'year').startOf('month');

        console.log(`\n${'='.repeat(60)}`);
        console.log(`[V2] 开始获取销量数据`);
        console.log(`[V2] 时间范围: ${chartStart.format('YYYY-MM-DD')} ~ ${todayStr}`);
        console.log(`[V2] 店铺: ${storeIds.join(', ')}`);
        console.log(`[V2] 待匹配 MSKU: ${allMskus.join(', ')}`);
        console.log(`${'='.repeat(60)}\n`);

        try {
            // ========== 第一步：生成2个月一批的时间段 ==========
            const monthBatches = this.generateMonthBatches(chartStart, today);
            console.log(`[V2] 共 ${monthBatches.length} 个批次`);

            // ========== 第二步：请求月视图数据，收集到 Map ==========
            const monthlyDataMap: Record<string, any[]> = {};
            const monthsWithData = new Set<string>();

            for (let i = 0; i < monthBatches.length; i++) {
                const batch = monthBatches[i];
                console.log(`\n[V2] >>> 批次 ${i + 1}/${monthBatches.length}: ${batch.start} ~ ${batch.end}`);

                for (const storeId of storeIds) {
                    const batchData = await this.fetchBatchData(storeId, batch.start, batch.end, '2', allMskus);

                    for (const item of batchData) {
                        const dateCollect = item.date_collect || {};
                        for (const month of Object.keys(dateCollect)) {
                            if (!monthlyDataMap[month]) monthlyDataMap[month] = [];
                            monthlyDataMap[month].push(item);
                            monthsWithData.add(month);
                        }
                    }

                    if (storeIds.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }

                await new Promise(resolve => setTimeout(resolve, 500));
            }

            console.log(`\n[V2] 有数据的月份: ${[...monthsWithData].sort().join(', ')}`);

            // ========== 第三步：智能请求周视图 ==========
            const weeklyDataMap: Record<string, any[]> = {};

            if (monthsWithData.size > 0) {
                const monthsToFetchWeekly = this.expandMonthsWithNeighbors([...monthsWithData]);
                console.log(`\n[V2] 周视图需要请求的月份: ${monthsToFetchWeekly.join(', ')}`);

                for (const month of monthsToFetchWeekly) {
                    const monthStart = dayjs(month + '-01').startOf('month');
                    const monthEnd = monthStart.endOf('month');
                    const endDate = monthEnd.isAfter(today) ? todayStr : monthEnd.format('YYYY-MM-DD');

                    for (const storeId of storeIds) {
                        const weekData = await this.fetchBatchData(storeId, monthStart.format('YYYY-MM-DD'), endDate, '3', allMskus);

                        for (const item of weekData) {
                            const dateCollect = item.date_collect || {};
                            for (const weekRange of Object.keys(dateCollect)) {
                                if (!weeklyDataMap[weekRange]) weeklyDataMap[weekRange] = [];
                                weeklyDataMap[weekRange].push(item);
                            }
                        }

                        if (storeIds.length > 1) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }

            // ========== 第四步：更新缓存表 ==========
            console.log(`\n[V2] 开始更新 ${cacheRecords.length} 条缓存记录...`);

            // 获取需要初始化的13个月列表
            const requiredMonths = this.getRequiredMonths(today);

            for (const cache of cacheRecords) {
                if (!cache.msku) continue;

                const monthlyCache = fullRefresh ? {} : (cache.my_sales_monthly || {});
                const weeklyCache = fullRefresh ? {} : (cache.my_sales_weekly || {});

                // ★ 关键：先为所有13个月初始化0值（避免每次都重新请求）
                if (fullRefresh) {
                    for (const month of requiredMonths) {
                        monthlyCache[month] = { value: 0, updated_at: todayStr };
                    }
                    console.log(`[V2 初始化] ${cache.msku} 初始化 ${requiredMonths.length} 个月为0`);
                }

                // 用实际数据覆盖
                for (const [month, items] of Object.entries(monthlyDataMap)) {
                    for (const item of items) {
                        const itemMskus = Array.isArray(item.msku) ? item.msku : [item.msku];
                        if (itemMskus.includes(cache.msku)) {
                            const value = parseInt(String(item.date_collect?.[month] || '0'), 10);
                            monthlyCache[month] = { value, updated_at: todayStr };
                            if (value > 0) {
                                console.log(`[V2 匹配] ${cache.msku} 月=${month}: ${value}`);
                            }
                        }
                    }
                }

                // 更新周数据
                for (const [weekRange, items] of Object.entries(weeklyDataMap)) {
                    for (const item of items) {
                        const itemMskus = Array.isArray(item.msku) ? item.msku : [item.msku];
                        if (itemMskus.includes(cache.msku)) {
                            const value = parseInt(String(item.date_collect?.[weekRange] || '0'), 10);
                            if (value > 0) {
                                weeklyCache[weekRange] = { value, updated_at: todayStr };
                            }
                        }
                    }
                }

                // 清理过期数据
                this.cleanOldCacheData(monthlyCache, 15, false);
                this.cleanOldCacheData(weeklyCache, 60, true);

                // 更新数据库
                await this.salesCacheRepo.update(cache.id, {
                    my_sales_monthly: monthlyCache,
                    my_sales_weekly: weeklyCache
                });
            }

            console.log(`\n${'='.repeat(60)}`);
            console.log(`[V2] 更新完成！`);
            console.log(`${'='.repeat(60)}\n`);
        } catch (error) {
            console.error(`[V2] 请求失败:`, error);
        }
    }


    /**
     * V2: 补充请求缺失的月份数据（与原逻辑一致）
     * 注意：周视图逐月请求，确保不超过90天限制
     */
    private async fetchMissingMonthsV2(
        storeIds: number[],
        allMskus: string[],
        cacheRecords: AppAmzBsrSalesCacheLingxingEntity[],
        missingMonths: string[],
        todayStr: string,
        marketplace: string
    ) {
        console.log(`[V2] 补充请求缺失的 ${missingMonths.length} 个月份`);

        for (const month of missingMonths) {
            const monthStart = dayjs(month + '-01').startOf('month').format('YYYY-MM-DD');
            const monthEnd = dayjs(month + '-01').endOf('month').format('YYYY-MM-DD');

            // 周视图需要请求前后邻月，但逐月请求避免超过90天限制
            const prevMonth = dayjs(month + '-01').subtract(1, 'month');
            const nextMonth = dayjs(month + '-01').add(1, 'month');
            const weeklyMonths = [
                { start: prevMonth.startOf('month').format('YYYY-MM-DD'), end: prevMonth.endOf('month').format('YYYY-MM-DD'), label: prevMonth.format('YYYY-MM') },
                { start: monthStart, end: monthEnd, label: month },
                { start: nextMonth.startOf('month').format('YYYY-MM-DD'), end: nextMonth.endOf('month').format('YYYY-MM-DD'), label: nextMonth.format('YYYY-MM') }
            ];

            console.log(`[V2] 月份 ${month}: 月视图 ${monthStart} ~ ${monthEnd}`);
            console.log(`[V2] 周视图将分3次请求: ${weeklyMonths.map(w => w.label).join(', ')}`);

            for (const storeId of storeIds) {
                // 请求月视图（仅当前月份范围）
                const monthlyData = await this.fetchBatchData(storeId, monthStart, monthEnd, '2', allMskus);

                // 请求周视图（逐月请求）
                let allWeeklyData: any[] = [];
                for (const wm of weeklyMonths) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const weekChunk = await this.fetchBatchData(storeId, wm.start, wm.end, '3', allMskus);
                    allWeeklyData = allWeeklyData.concat(weekChunk);
                }

                // 更新缓存
                for (const cache of cacheRecords) {
                    if (!cache.msku || cache.store_id !== storeId) continue;

                    const monthlyCache = cache.my_sales_monthly || {};
                    const weeklyCache = cache.my_sales_weekly || {};
                    let foundInMonth = false;

                    // 匹配月数据
                    for (const item of monthlyData) {
                        const itemMskus = Array.isArray(item.msku) ? item.msku : [item.msku];
                        if (itemMskus.includes(cache.msku)) {
                            const value = parseInt(String(item.date_collect?.[month] || '0'), 10);
                            monthlyCache[month] = { value, updated_at: todayStr };
                            foundInMonth = true;
                        }
                    }
                    // ★ 关键：如果没有匹配到，记录为0
                    if (!foundInMonth) {
                        monthlyCache[month] = { value: 0, updated_at: todayStr };
                    }

                    // 匹配周数据
                    for (const item of allWeeklyData) {
                        const itemMskus = Array.isArray(item.msku) ? item.msku : [item.msku];
                        if (itemMskus.includes(cache.msku)) {
                            const dateCollect = item.date_collect || {};
                            for (const [weekRange, value] of Object.entries(dateCollect)) {
                                weeklyCache[weekRange] = {
                                    value: parseInt(String(value) || '0', 10),
                                    updated_at: todayStr
                                };
                            }
                        }
                    }

                    await this.salesCacheRepo.update(cache.id, {
                        my_sales_monthly: monthlyCache,
                        my_sales_weekly: weeklyCache
                    });
                }

                if (storeIds.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log(`[V2] 补充请求完成`);
    }


    /**
     * V2: 只更新当前月份的数据
     */
    private async updateCurrentMonthOnlyV2(
        storeIds: number[],
        allMskus: string[],
        cacheRecords: AppAmzBsrSalesCacheLingxingEntity[],
        currentMonth: string,
        todayStr: string,
        marketplace: string
    ) {
        const monthStart = dayjs(currentMonth + '-01').startOf('month').format('YYYY-MM-DD');

        console.log(`[V2] 更新当前月: ${monthStart} ~ ${todayStr}`);

        for (const storeId of storeIds) {
            const monthlyData = await this.fetchBatchData(storeId, monthStart, todayStr, '2', allMskus);
            const weeklyData = await this.fetchBatchData(storeId, monthStart, todayStr, '3', allMskus);

            for (const cache of cacheRecords) {
                if (!cache.msku || cache.store_id !== storeId) continue;

                const monthlyCache = cache.my_sales_monthly || {};
                const weeklyCache = cache.my_sales_weekly || {};
                let foundInMonth = false;

                // 更新月数据
                for (const item of monthlyData) {
                    const itemMskus = Array.isArray(item.msku) ? item.msku : [item.msku];
                    if (itemMskus.includes(cache.msku)) {
                        const value = parseInt(String(item.date_collect?.[currentMonth] || '0'), 10);
                        monthlyCache[currentMonth] = { value, updated_at: todayStr };
                        foundInMonth = true;
                        console.log(`[V2 匹配] ${cache.msku} ${currentMonth}: ${value}`);
                    }
                }

                // ★ 关键修复：即使未匹配，也要更新 updated_at（避免重复请求）
                if (!foundInMonth) {
                    const oldValue = monthlyCache[currentMonth]?.value || 0;
                    monthlyCache[currentMonth] = { value: oldValue, updated_at: todayStr };
                    console.log(`[V2 未匹配] ${cache.msku} ${currentMonth}: 保持原值 ${oldValue}, 更新时间戳`);
                }

                // 更新周数据
                for (const item of weeklyData) {
                    const itemMskus = Array.isArray(item.msku) ? item.msku : [item.msku];
                    if (itemMskus.includes(cache.msku)) {
                        const dateCollect = item.date_collect || {};
                        for (const [weekRange, value] of Object.entries(dateCollect)) {
                            weeklyCache[weekRange] = {
                                value: parseInt(String(value) || '0', 10),
                                updated_at: todayStr
                            };
                        }
                    }
                }

                await this.salesCacheRepo.update(cache.id, {
                    my_sales_monthly: monthlyCache,
                    my_sales_weekly: weeklyCache
                });
            }

            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }


    /**
     * V2: 打印销量明细表
     */
    private printMySalesSummaryV2(cacheRecords: AppAmzBsrSalesCacheLingxingEntity[], storeIds: number[]) {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`========== 我的销量明细 (V2) ==========`);

        for (const storeId of storeIds) {
            const storeCaches = cacheRecords.filter(c => c.store_id === storeId);
            if (storeCaches.length === 0) continue;

            console.log(`\n店铺: ${storeId}`);

            for (let i = 0; i < storeCaches.length; i++) {
                const cache = storeCaches[i];
                const isLast = i === storeCaches.length - 1;
                const prefix = isLast ? '  └─' : '  ├─';
                const indent = isLast ? '     ' : '  │  ';

                const monthlyCache = cache.my_sales_monthly || {};
                const weeklyCache = cache.my_sales_weekly || {};

                // 提取月视图数值
                const monthlyValues: Record<string, number> = {};
                for (const [k, v] of Object.entries(monthlyCache)) {
                    monthlyValues[k] = (v as any)?.value || 0;
                }

                // 提取周视图数值
                const weeklyValues: Record<string, number> = {};
                for (const [k, v] of Object.entries(weeklyCache)) {
                    weeklyValues[k] = (v as any)?.value || 0;
                }

                console.log(`${prefix} ASIN: ${cache.asin}, MSKU: ${cache.msku}`);
                console.log(`${indent}  月视图: ${JSON.stringify(monthlyValues)}`);
                console.log(`${indent}  周视图: ${JSON.stringify(weeklyValues)}`);
            }
        }

        console.log(`${'='.repeat(50)}\n`);
    }


    /**
     * V2: 汇总所有缓存记录的销量数据
     */
    private aggregateMySalesV2(cacheRecords: AppAmzBsrSalesCacheLingxingEntity[]) {
        const monthlyTotal: Record<string, number> = {};
        const weeklyTotal: Record<string, number> = {};
        let lastUpdated: string | null = null;

        for (const cache of cacheRecords) {
            // 汇总月销量
            const monthlyCache = cache.my_sales_monthly || {};
            for (const [period, data] of Object.entries(monthlyCache)) {
                monthlyTotal[period] = (monthlyTotal[period] || 0) + (data?.value || 0);
                if (!lastUpdated || (data?.updated_at && data.updated_at > lastUpdated)) {
                    lastUpdated = data.updated_at;
                }
            }

            // 汇总周销量
            const weeklyCache = cache.my_sales_weekly || {};
            for (const [period, data] of Object.entries(weeklyCache)) {
                weeklyTotal[period] = (weeklyTotal[period] || 0) + (data?.value || 0);
            }
        }

        return {
            monthly: monthlyTotal,
            weekly: weeklyTotal,
            lastUpdated
        };
    }

    // =====================================================
    // ========== 促销活动（秒杀）数据获取逻辑 ==========
    // =====================================================

    /**
     * 获取促销活动数据（SWR 模式：先返回缓存，后台异步刷新）
     * - 不管缓存是否过期，立即返回本地缓存数据
     * - 如果需要更新，在后台异步触发领星 API 同步（不阻塞前端）
     * - 全局最多同时运行 PROMOTION_MAX_CONCURRENT 个后台同步任务
     * @param asin 当前分析的 ASIN（只查这一个的促销）
     * @param marketplace 国家/站点
     * @param forceRefresh 是否强制刷新
     */
    async getPromotionData(asin: string, marketplace: string, forceRefresh: boolean = false) {
        const lockKey = `${asin}:${marketplace}`;
        const todayStr = dayjs().format('YYYY-MM-DD');

        // Step 1: 从 listing 表获取当前 ASIN 的选品信息
        const listings = await this.listingRepo.find({
            where: { asin, marketplace },
            select: ['id', 'store_id', 'asin', 'msku']
        });

        if (listings.length === 0) {
            console.log(`[促销] 未找到选品`);
            return { promotions: {}, syncing: false };
        }

        // Step 2: 确保缓存表有记录并检查是否需要更新
        const cacheRecords: AppAmzBsrSalesCacheLingxingEntity[] = [];
        let needsUpdate = forceRefresh;

        for (const listing of listings) {
            if (!listing.store_id || !listing.asin) continue;

            let cacheRecord = await this.salesCacheRepo.findOne({
                where: { store_id: listing.store_id, asin: listing.asin, marketplace }
            });

            if (!cacheRecord) {
                cacheRecord = await this.salesCacheRepo.save({
                    store_id: listing.store_id,
                    asin: listing.asin,
                    marketplace,
                    msku: listing.msku,
                    my_sales_monthly: {},
                    my_sales_weekly: {},
                    promotions_flash_sale: {}
                });
                needsUpdate = true;  // 新记录需要同步
            } else if (!forceRefresh && cacheRecord.promotion_last_sync !== todayStr) {
                needsUpdate = true;  // 今天没同步过
            }
            cacheRecords.push(cacheRecord);
        }

        // Step 3（SWR 核心）: 先返回缓存数据，需要更新则后台异步触发
        const cachedPromotions = await this.collectPromotions(cacheRecords);

        if (needsUpdate) {
            // 检查是否已有该 ASIN 的同步在跑
            if (AppAnalysisCustomService.promotionSyncLocks.get(lockKey)) {
                console.log(`[促销 SWR] ${lockKey} 正在同步中，直接返回缓存`);
                return { promotions: cachedPromotions, syncing: true };
            }

            // 检查全局并发数是否已达上限
            if (AppAnalysisCustomService.promotionBackgroundCount >= AppAnalysisCustomService.PROMOTION_MAX_CONCURRENT) {
                console.log(`[促销 SWR] 全局后台同步已达上限 (${AppAnalysisCustomService.promotionBackgroundCount}/${AppAnalysisCustomService.PROMOTION_MAX_CONCURRENT})，跳过 ${lockKey}`);
                return { promotions: cachedPromotions, syncing: false };
            }

            // 后台异步同步（不 await，不阻塞前端响应）
            const storeIds = [...new Set(cacheRecords.map(c => c.store_id))];
            this.backgroundSyncPromotions(lockKey, storeIds, cacheRecords, marketplace, todayStr);

            console.log(`[促销 SWR] ${lockKey} 已触发后台同步，先返回缓存数据`);
            return { promotions: cachedPromotions, syncing: true };
        }

        console.log(`[促销 SWR] ${lockKey} 数据已是最新，直接返回缓存`);
        return { promotions: cachedPromotions, syncing: false };
    }

    /**
     * 后台异步同步促销数据（SWR 模式的后台任务）
     * 不阻塞前端响应，同步完成后自动更新数据库
     */
    private backgroundSyncPromotions(
        lockKey: string,
        storeIds: number[],
        cacheRecords: AppAmzBsrSalesCacheLingxingEntity[],
        marketplace: string,
        todayStr: string
    ) {
        // 加锁 + 全局计数
        AppAnalysisCustomService.promotionSyncLocks.set(lockKey, true);
        AppAnalysisCustomService.promotionBackgroundCount++;
        console.log(`[促销 后台] 开始同步 ${lockKey}（当前并发: ${AppAnalysisCustomService.promotionBackgroundCount}/${AppAnalysisCustomService.PROMOTION_MAX_CONCURRENT}）`);

        // 异步执行（不 await）
        (async () => {
            try {
                // 请求领星 API 并更新缓存
                await this.fetchAndUpdatePromotions(storeIds, cacheRecords, marketplace, todayStr);

                // 更新 promotion_last_sync 字段
                for (const cache of cacheRecords) {
                    await this.salesCacheRepo.update(cache.id, { promotion_last_sync: todayStr });
                }

                console.log(`[促销 后台] ${lockKey} 同步成功`);
            } catch (error) {
                console.error(`[促销 后台] ${lockKey} 同步失败:`, error);
            } finally {
                // 解锁 + 全局计数减 1
                AppAnalysisCustomService.promotionSyncLocks.delete(lockKey);
                AppAnalysisCustomService.promotionBackgroundCount--;
                console.log(`[促销 后台] ${lockKey} 解锁（剩余并发: ${AppAnalysisCustomService.promotionBackgroundCount}）`);
            }
        })();
    }

    /**
     * 汇总多个缓存记录的促销数据（附带父级信息+店铺名）
     */
    private async collectPromotions(cacheRecords: AppAmzBsrSalesCacheLingxingEntity[]): Promise<Record<string, any>> {
        const allPromotions: Record<string, any> = {};
        for (const cache of cacheRecords) {
            const promotions = cache.promotions_flash_sale || {};

            // 查询 listing 获取店铺名
            let shopName = `店铺${cache.store_id}`;
            try {
                const listing = await this.listingRepo.findOne({
                    where: { store_id: cache.store_id, asin: cache.asin, marketplace: cache.marketplace },
                    select: ['shop']
                });
                if (listing?.shop) {
                    shopName = listing.shop;
                }
            } catch (e) {
                console.warn(`[促销] 查询店铺名失败: ${e.message}`);
            }

            for (const [id, data] of Object.entries(promotions)) {
                allPromotions[id] = {
                    ...data,
                    // 附加父级记录信息
                    asin: cache.asin,
                    store_id: cache.store_id,
                    marketplace: cache.marketplace,
                    shop_name: shopName
                };
            }
        }
        return allPromotions;
    }



    /**
     * 检查促销数据是否需要更新（已废弃，改用 promotion_last_sync 字段）
     */
    private checkPromotionNeedsUpdate(cacheRecords: AppAmzBsrSalesCacheLingxingEntity[], today: string): boolean {
        for (const cache of cacheRecords) {
            if (cache.promotion_last_sync !== today) return true;
        }
        return false;
    }


    /**
     * 请求并更新促销活动数据
     * 策略：每次请求2个完整月，避免90天限制
     */
    private async fetchAndUpdatePromotions(
        storeIds: number[],
        cacheRecords: AppAmzBsrSalesCacheLingxingEntity[],
        marketplace: string,
        todayStr: string
    ) {
        const today = dayjs();
        // 生成2个月一批的时间段（共7批次覆盖14个月）
        const chartStart = today.startOf('month');
        const chartEnd = today.add(1, 'year').endOf('month');
        const monthBatches = this.generateMonthBatches(chartStart, chartEnd);

        console.log(`\n${'='.repeat(60)}`);
        console.log(`[促销] 开始获取秒杀活动数据`);
        console.log(`[促销] 时间范围: ${chartStart.format('YYYY-MM-DD')} ~ ${chartEnd.format('YYYY-MM-DD')}`);
        console.log(`[促销] 店铺: ${storeIds.join(', ')}`);
        console.log(`[促销] 共 ${monthBatches.length} 个批次`);
        console.log(`${'='.repeat(60)}\n`);

        try {
            const allPromotions: any[] = [];

            // 分批请求
            for (let i = 0; i < monthBatches.length; i++) {
                const batch = monthBatches[i];
                console.log(`\n[促销] >>> 批次 ${i + 1}/${monthBatches.length}: ${batch.start} ~ ${batch.end}`);

                const batchData = await this.fetchPromotionsFromAPI(storeIds, batch.start, batch.end, todayStr);
                allPromotions.push(...batchData);

                // 批次间延迟
                if (i < monthBatches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            console.log(`\n[促销] 共获取 ${allPromotions.length} 个秒杀活动`);

            // 按 ASIN 分组
            const promotionsByAsin: Record<string, any[]> = {};
            for (const promo of allPromotions) {
                const asin = promo.asin;
                if (!promotionsByAsin[asin]) promotionsByAsin[asin] = [];
                promotionsByAsin[asin].push(promo);
            }

            // 更新缓存（直接替换，而不是合并，这样不存在的活动会被删除）
            for (const cache of cacheRecords) {
                const asinPromotions = promotionsByAsin[cache.asin] || [];

                // 用最新数据直接构建新的促销对象（替换旧数据）
                const newPromotions: Record<string, any> = {};
                for (const promo of asinPromotions) {
                    newPromotions[promo.promotion_id] = {
                        type: promo.promotion_type_text || 'BD',
                        start: promo.start_time,
                        end: promo.end_time,
                        status: parseInt(promo.status) || 0,
                        discount_price: promo.discount_price || '0.00',
                        discount_rate: promo.discount_rate || '0.00',
                        name: promo.name || '',
                        updated_at: todayStr
                    };
                }

                // 直接保存新数据（替换旧数据，不存在的活动自动被删除）
                await this.salesCacheRepo.update(cache.id, {
                    promotions_flash_sale: newPromotions
                });

                console.log(`[促销] ${cache.asin}: 更新 ${Object.keys(newPromotions).length} 个活动`);
            }

            console.log(`\n${'='.repeat(60)}`);
            console.log(`[促销] 更新完成！`);
            console.log(`${'='.repeat(60)}\n`);
        } catch (error) {
            console.error(`[促销] 请求失败:`, error);
        }
    }


    /**
     * 调用领星 API 获取促销活动列表（分页）
     */
    private async fetchPromotionsFromAPI(
        storeIds: number[],
        startTime: string,
        endTime: string,
        siteDate: string
    ): Promise<any[]> {
        const allData: any[] = [];
        let offset = 0;
        const length = 200;
        let hasMore = true;

        while (hasMore) {
            const params = {
                site_date: siteDate,
                start_time: startTime,
                end_time: endTime,
                product_status: [1],           // 在售商品
                promotion_category: [2],       // 秒杀类型
                sids: storeIds.map(String),    // 店铺列表
                offset,
                length
            };

            console.log(`[促销 API] 请求 offset=${offset}, length=${length}`);

            const result = await this.lingXingUtils.httpPost(
                '/basicOpen/promotion/listingList',
                params,
                true
            );

            if (result && result.code === 0 && Array.isArray(result.data)) {
                // 提取每个商品的促销活动
                for (const item of result.data) {
                    const promotionList = item.promotion_list || [];
                    for (const promo of promotionList) {
                        allData.push({
                            asin: item.asin,
                            seller_sku: item.seller_sku,
                            store_id: item.sid,
                            promotion_id: promo.promotion_id,
                            name: promo.name,
                            status: promo.status,
                            promotion_type_text: promo.promotion_type_text,
                            start_time: promo.promotion_start_time,
                            end_time: promo.promotion_end_time,
                            discount_price: promo.discount_price,
                            discount_rate: promo.discount_rate
                        });
                    }
                }

                console.log(`[促销 API] 本页返回 ${result.data.length} 条商品, 总计活动 ${allData.length} 个`);

                hasMore = result.data.length >= length;
                offset += length;

                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } else {
                console.error(`[促销 API 错误] code=${result?.code}, msg=${result?.message}`);
                hasMore = false;
            }
        }

        return allData;
    }

    /**
     * 清理已过期的促销活动
     * 规则：删除结束时间早于「当前月份 - 15个月」的活动
     * 解释：柱状图显示13个月 + 3个月缓冲期 = 15个月
     */
    private cleanExpiredPromotions(promotions: Record<string, any>, today: dayjs.Dayjs) {
        // 计算删除截止线：当前月份 - 15个月
        const cutoff = today.subtract(15, 'month').startOf('month').format('YYYY-MM-DD');
        let deletedCount = 0;

        console.log(`[促销清理] 删除截止线: ${cutoff} (当前 ${today.format('YYYY-MM-DD')} - 15个月)`);

        for (const [id, promo] of Object.entries(promotions)) {
            const endDate = promo.end?.split(' ')[0]; // 取日期部分
            if (endDate && endDate < cutoff) {
                console.log(`[促销清理] 删除过期活动: ${id} (结束于 ${endDate})`);
                delete promotions[id];
                deletedCount++;
            }
        }

        if (deletedCount > 0) {
            console.log(`[促销清理] 共删除 ${deletedCount} 个过期活动`);
        }
    }

    // =====================================================
    // ========== 批量预缓存促销数据（供定时任务调用） ==========
    // =====================================================

    /**
     * 批量同步所有促销数据（供定时任务管理系统调用）
     * 逻辑：
     * 1. 查 salesCache 表所有 promotion_last_sync < 今天 或为 null 的记录
     * 2. 按 store_id + marketplace 分组（同一个店铺同一个站点只请求一次领星 API）
     * 3. 逐组请求，每组间 sleep 2 秒防限流
     * 4. 更新数据库缓存 + promotion_last_sync
     * @returns 统计结果 { total, updated, failed, skipped }
     */
    async batchSyncAllPromotions() {
        const todayStr = dayjs().format('YYYY-MM-DD');

        console.log(`\n${'='.repeat(60)}`);
        console.log(`[批量促销同步] 开始执行 - ${todayStr}`);
        console.log(`${'='.repeat(60)}\n`);

        // Step 1: 查出所有需要更新的缓存记录
        const allCacheRecords = await this.salesCacheRepo
            .createQueryBuilder('c')
            .where('c.promotion_last_sync IS NULL OR c.promotion_last_sync < :today', { today: todayStr })
            .getMany();

        if (allCacheRecords.length === 0) {
            console.log(`[批量促销同步] 所有记录已是最新，无需同步`);
            return { total: 0, updated: 0, failed: 0, skipped: 0 };
        }

        console.log(`[批量促销同步] 找到 ${allCacheRecords.length} 条需要更新的记录`);

        // Step 2: 按 store_id + marketplace 分组
        const groups = new Map<string, AppAmzBsrSalesCacheLingxingEntity[]>();
        for (const record of allCacheRecords) {
            const key = `${record.store_id}:${record.marketplace}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(record);
        }

        console.log(`[批量促销同步] 按店铺+站点分为 ${groups.size} 个组`);

        // Step 3: 逐组请求领星 API
        let updated = 0;
        let failed = 0;
        let skipped = 0;
        let groupIndex = 0;

        for (const [groupKey, records] of groups) {
            groupIndex++;
            const [storeIdStr, marketplace] = groupKey.split(':');
            const storeId = Number(storeIdStr);

            console.log(`\n[批量促销同步] >>> 组 ${groupIndex}/${groups.size}: store_id=${storeId}, marketplace=${marketplace}, 包含 ${records.length} 个ASIN`);

            try {
                // 请求领星 API
                await this.fetchAndUpdatePromotions([storeId], records, marketplace, todayStr);

                // 更新 promotion_last_sync
                for (const record of records) {
                    await this.salesCacheRepo.update(record.id, { promotion_last_sync: todayStr });
                }

                updated += records.length;
                console.log(`[批量促销同步] 组 ${groupIndex} 同步成功，更新 ${records.length} 条记录`);
            } catch (error) {
                failed += records.length;
                console.error(`[批量促销同步] 组 ${groupIndex} 同步失败:`, error);
            }

            // 组间间隔 2 秒防限流（最后一组不等待）
            if (groupIndex < groups.size) {
                console.log(`[批量促销同步] 等待 2 秒后继续下一组...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`[批量促销同步] 执行完毕！总计: ${allCacheRecords.length}, 成功: ${updated}, 失败: ${failed}, 跳过: ${skipped}`);
        console.log(`${'='.repeat(60)}\n`);

        return {
            total: allCacheRecords.length,
            updated,
            failed,
            skipped
        };
    }


    /**
     * 获取关键词搜索趋势（个性化版本）
     * 优先显示用户的默认关键词，不足 3 个时按 sif_score 补齐
     * 注意：不再依赖 asin，改为按 product_code + marketplace 查询
     *
     * @param marketplace 国家（中文）
     * @param product_code 产品编码
     */
    async getKeywordTrendData(marketplace: string, product_code: string) {
        // 1. 生成过去13个月的标准时间轴 (多返回一个月用于环比计算)
        const last13Months = [];
        for (let i = 0; i < 13; i++) {
            last13Months.push(dayjs().subtract(13 - i, 'month').format('YYYY-MM'));
        }

        const MAX_KEYWORDS = this.DEFAULT_KEYWORD_LIMIT;
        let finalKeywords: AppAmzListingKeywordEntity[] = [];

        // 2. 尝试获取用户的默认关键词
        const userId = this.ctx?.admin?.userId;
        let defaultKeywordIds: number[] = [];

        if (userId) {
            try {
                const config = await this.userKeywordConfigRepo.findOne({
                    where: { user_id: userId, product_code, marketplaces: marketplace },
                });
                if (config?.default_keyword_ids?.length > 0) {
                    defaultKeywordIds = config.default_keyword_ids;
                }
            } catch (err) {
                console.error('[getKeywordTrendData] 查询用户默认关键词配置失败:', err?.message);
            }
        }

        // 3. 查询默认关键词（按流量得分最多取3个）
        if (defaultKeywordIds.length > 0) {
            const defaultKeywords = await this.keywordRepo.find({
                where: { id: In(defaultKeywordIds), product_code, marketplaces: marketplace },
            });

            finalKeywords = this.selectTopDefaultKeywords(defaultKeywords, MAX_KEYWORDS);
            defaultKeywordIds = finalKeywords.map(item => item.id);
        }

        // 4. 如果不足3个，用非默认的关键词按 sif_score 补齐
        const remaining = MAX_KEYWORDS - finalKeywords.length;
        if (remaining > 0) {
            const query = this.keywordRepo
                .createQueryBuilder('k')
                .where('k.marketplaces = :marketplace', { marketplace })
                .andWhere('k.product_code = :product_code', { product_code })
                .andWhere('k.status = 3');

            // 排除已在默认列表中的 ID
            if (defaultKeywordIds.length > 0) {
                query.andWhere('k.id NOT IN (:...excludeIds)', { excludeIds: defaultKeywordIds });
            }

            // 必须有 SIF 搜索趋势数据
            query.andWhere('k.sif_search_volume_monthly > 0')
                .andWhere('k.sif_search_history IS NOT NULL')
                .andWhere("JSON_LENGTH(k.sif_search_history) > 0");

            // 按 sif_score 倒序排列
            query.orderBy('k.sif_score', 'DESC')
                .addOrderBy('k.sif_search_volume_monthly', 'DESC')
                .limit(remaining);

            const extraKeywords = await query.getMany();
            finalKeywords = [...finalKeywords, ...extraKeywords];
        }

        // 5. 数据清洗与对齐（使用新的 sif_search_history 字段）
        const series = finalKeywords.map(kw => {
            const dataMap = new Map<string, number>();

            // 解析 sif_search_history：[{date: "2025-03", searches: 131419, searchRank: 30}, ...]
            if (Array.isArray(kw.sif_search_history)) {
                kw.sif_search_history.forEach((item: any) => {
                    if (item.date && item.searches != null) {
                        // 新格式 date 已经是 "YYYY-MM"，直接使用
                        dataMap.set(item.date, Number(item.searches));
                    }
                });
            }

            // 严格对齐到标准时间轴
            const alignedData = last13Months.map(month => dataMap.get(month) || 0);

            return {
                name: kw.value,
                total: kw.sif_search_volume_monthly || 0,
                data: alignedData,
                isDefault: defaultKeywordIds.includes(kw.id),
            };
        });

        return {
            xAxis: last13Months,
            series
        };
    }

    /**
     * 获取日历模式所需的系数数据
     * 支持灵活的时间范围，自动回溯查询所需的历史数据（包括前年）
     * @param product_code 产品编码
     * @param marketplace 站点
     * @param startMonth 起始月份 (YYYY-MM 格式)
     * @param endMonth 结束月份 (YYYY-MM 格式)
     * @param customAlpha 前端传入的全局α覆盖
     * @param monthlyAlphas 前端传入的逐月α覆盖
     * @param asin ASIN（用于查找用户α配置）
     * @param listing_id Listing表ID（优先用于查找用户α配置）
     * @param msku MSKU（备选定位用户α配置）
     * @param store_id 店铺ID（备选定位用户α配置）
     */
    async getCalendarCoefficients(
        product_code: string,
        marketplace: string,
        startMonth: string,
        endMonth: string,
        customAlpha?: number,
        monthlyAlphas?: Record<string, number>,
        asin?: string,
        listing_id?: number,
        msku?: string,
        store_id?: number
    ) {
        // 1. 计算基准月：当前真实时间的去年同月
        const baseMonth = dayjs().subtract(1, 'year').format('YYYY-MM');

        // 2. 生成需要计算的目标月份列表
        const targetMonths: string[] = [];
        let current = dayjs(startMonth + '-01');
        const end = dayjs(endMonth + '-01');
        while (current.isBefore(end) || current.isSame(end, 'month')) {
            targetMonths.push(current.format('YYYY-MM'));
            current = current.add(1, 'month');
        }

        // 3. 生成需要查询的历史月份列表（目标月份的去年同期 + 基准月）
        const historicalMonthsSet = new Set<string>();
        historicalMonthsSet.add(baseMonth);
        for (const tm of targetMonths) {
            const histMonth = dayjs(tm + '-01').subtract(1, 'year').format('YYYY-MM');
            historicalMonthsSet.add(histMonth);
        }
        const historicalMonths = Array.from(historicalMonthsSet);

        // 4. 查询历史销量数据
        const salesDataMap = await this.fetchSalesDataForMonths(product_code, marketplace, historicalMonths);

        // 5. 查询搜索词数据
        const keywordDataMap = await this.fetchKeywordDataForMonths(marketplace, product_code, historicalMonths);

        // 6. 获取基准月的值（分母）
        const baseSalesValue = salesDataMap.get(baseMonth) || 0;
        const baseKeywordValue = keywordDataMap.get(baseMonth) || 0;

        // ===== 算法4: 分别对销量和搜索数据进行0值补全（在副本上操作，不影响原始数据和算法2/3） =====
        const salesFill = this.fillZeroMonths(salesDataMap, historicalMonths);
        const searchFill = this.fillZeroMonths(keywordDataMap, historicalMonths);

        // 7. 查询用户α配置
        const userId = this.ctx?.admin?.userId;
        let userAlphaConfig: AppAmzUserAlphaConfigEntity | null = null;
        if (userId) {
            userAlphaConfig = await this.findUserAlphaConfig(userId, product_code, marketplace, asin, listing_id, msku, store_id);
        }

        // 8. 计算每个目标月的系数
        const calendarData: Record<string, any> = {};
        for (const tm of targetMonths) {
            const histMonth = dayjs(tm + '-01').subtract(1, 'year').format('YYYY-MM');
            const salesRef = salesDataMap.get(histMonth) || 0;
            const keywordRef = keywordDataMap.get(histMonth) || 0;

            calendarData[tm] = {
                sales: {
                    ref_month: histMonth,
                    ref_value: salesRef,
                    coefficient: baseSalesValue > 0 ? salesRef / baseSalesValue : 1,
                    status: salesRef > 0 ? 'ok' : 'missing'
                },
                keywords: {
                    ref_month: histMonth,
                    ref_value: keywordRef,
                    coefficient: baseKeywordValue > 0 ? keywordRef / baseKeywordValue : 1,
                    status: keywordRef > 0 ? 'ok' : 'missing'
                },
                // ===== 算法4: 综合走势预测（V2 - 含搜索补全+多层α+解释文本） =====
                combined: this.calculateCombinedCoefficientV2({
                    salesFill, searchFill,
                    salesDataMap, keywordDataMap,
                    baseSalesValue, baseKeywordValue,
                    histMonth, targetMonth: tm,
                    frontendAlpha: customAlpha,
                    frontendMonthlyAlpha: monthlyAlphas?.[tm],
                    userAlphaConfig
                })
            };
        }

        return {
            base_month: baseMonth,
            base_sales_value: baseSalesValue,
            base_keyword_value: baseKeywordValue,
            user_alpha_config: userAlphaConfig ? {
                id: userAlphaConfig.id,
                default_alpha: userAlphaConfig.default_alpha,
                monthly_alphas: userAlphaConfig.monthly_alphas,
                monthly_remarks: userAlphaConfig.monthly_remarks
            } : null,
            calendar_data: calendarData
        };
    }

    /**
     * 从竞品数据中提取指定月份的销量汇总
     * @param product_code 产品编码
     * @param marketplace 站点
     * @param months 需要的月份列表 (YYYY-MM 格式)
     */
    private async fetchSalesDataForMonths(
        product_code: string,
        marketplace: string,
        months: string[]
    ): Promise<Map<string, number>> {
        const result = new Map<string, number>();

        // 初始化所有月份为0
        for (const m of months) {
            result.set(m, 0);
        }

        // 查询该 product_code 下的所有选品的 ASIN
        const listings = await this.listingRepo.find({
            where: { product_code, marketplace },
            select: ['asin']
        });
        const allAsins = [...new Set(listings.map(l => l.asin).filter(Boolean))];

        if (allAsins.length === 0) {
            return result;
        }

        // 查询这些选品的竞品
        const competitors = await this.competitorRepo
            .createQueryBuilder('c')
            .where('c.asin_candidate IN (:...asins)', { asins: allAsins })
            .andWhere('c.marketplace = :marketplace', { marketplace })
            .andWhere('c.status = 6')
            .orderBy('c.asin_competitor')
            .addOrderBy('c.updateTime', 'DESC')
            .getMany();

        // 按 asin_competitor 去重
        const uniqueCompetitors = this.deduplicateByAsinCompetitor(competitors);

        // 遍历竞品，提取指定月份的销量
        for (const comp of uniqueCompetitors) {
            const rawNodes = this.safeParseJson(comp.sales_volume_data);
            const rawByMonth = this.groupByMonth(rawNodes);

            for (const m of months) {
                // 将 YYYY-MM 转换为 YYYYMM 格式
                const ym = m.replace('-', '');
                const items = rawByMonth.get(ym);
                if (items && items.length > 0) {
                    const monthSales = Number(items[0].searches || 0);
                    result.set(m, (result.get(m) || 0) + monthSales);
                }
            }
        }

        return result;
    }

    /**
     * 从关键词数据中提取指定月份的搜索量汇总
     * 注意：不再依赖 asin，改为按 product_code + marketplace 查询
     * @param marketplace 站点
     * @param product_code 产品编码
     * @param months 需要的月份列表 (YYYY-MM 格式)
     */
    private async fetchKeywordDataForMonths(
        marketplace: string,
        product_code: string,
        months: string[]
    ): Promise<Map<string, number>> {
        const result = new Map<string, number>();

        // 初始化所有月份为0
        for (const m of months) {
            result.set(m, 0);
        }

        const MAX_KEYWORDS = this.DEFAULT_KEYWORD_LIMIT;
        let finalKeywords: AppAmzListingKeywordEntity[] = [];

        // 1. 尝试获取用户的默认关键词
        const userId = this.ctx?.admin?.userId;
        let defaultKeywordIds: number[] = [];

        if (userId) {
            try {
                const config = await this.userKeywordConfigRepo.findOne({
                    where: { user_id: userId, product_code, marketplaces: marketplace },
                });
                if (config?.default_keyword_ids?.length > 0) {
                    defaultKeywordIds = config.default_keyword_ids;
                }
            } catch (err) {
                console.error('[fetchKeywordDataForMonths] 查询用户默认关键词配置失败:', err?.message);
            }
        }

        // 2. 查询默认关键词（按流量得分最多取3个）
        if (defaultKeywordIds.length > 0) {
            const defaultKeywords = await this.keywordRepo.find({
                where: { id: In(defaultKeywordIds), product_code, marketplaces: marketplace },
            });
            finalKeywords = this.selectTopDefaultKeywords(defaultKeywords, MAX_KEYWORDS);
            defaultKeywordIds = finalKeywords.map(item => item.id);
        }

        // 3. 如果不足3个，用非默认的关键词按 sif_score 补齐
        const remaining = MAX_KEYWORDS - finalKeywords.length;
        if (remaining > 0) {
            const query = this.keywordRepo
                .createQueryBuilder('k')
                .where('k.marketplaces = :marketplace', { marketplace })
                .andWhere('k.product_code = :product_code', { product_code })
                .andWhere('k.status = 3');

            // 排除已在默认列表中的 ID
            if (defaultKeywordIds.length > 0) {
                query.andWhere('k.id NOT IN (:...excludeIds)', { excludeIds: defaultKeywordIds });
            }

            // 必须有 SIF 搜索趋势数据
            query.andWhere('k.sif_search_volume_monthly > 0')
                .andWhere('k.sif_search_history IS NOT NULL')
                .andWhere("JSON_LENGTH(k.sif_search_history) > 0");

            // 按 sif_score 倒序排列
            query.orderBy('k.sif_score', 'DESC')
                .addOrderBy('k.sif_search_volume_monthly', 'DESC')
                .limit(remaining);

            const extraKeywords = await query.getMany();
            finalKeywords = [...finalKeywords, ...extraKeywords];
        }

        // 4. 遍历最终决定的关键词，提取指定月份的搜索量（使用新的 sif_search_history 字段）
        for (const kw of finalKeywords) {
            if (Array.isArray(kw.sif_search_history)) {
                kw.sif_search_history.forEach((item: any) => {
                    if (item.date && item.searches != null) {
                        // 新格式 date 已经是 "YYYY-MM"
                        const monthKey = String(item.date);
                        if (months.includes(monthKey)) {
                            result.set(monthKey, (result.get(monthKey) || 0) + Number(item.searches));
                        }
                    }
                });
            }
        }

        return result;
    }

    // ========================================================================================
    // 算法4: 综合走势预测 V2 - 辅助方法
    // 公式: 综合系数 = α × 补全后销量系数 + (1-α) × 补全后搜索系数
    // α 由6级决策矩阵自动计算，支持4层优先级覆盖
    // ========================================================================================

    /**
     * 通用零值补全（销量和搜索共用）
     * 规则：遇到0值时往后找最近非0值填充，找不到则往前找，全为0则保持0。
     * 在副本上操作，不修改原始数据。
     *
     * @returns filledMap: 补全后副本, filledMonths: 被补全的月份集合, fillSources: 每个被补全月份的来源月
     */
    private fillZeroMonths(
        dataMap: Map<string, number>,
        months: string[]
    ): { filledMap: Map<string, number>; filledMonths: Set<string>; fillSources: Map<string, string> } {
        const filledMap = new Map(dataMap);
        const filledMonths = new Set<string>();
        const fillSources = new Map<string, string>(); // month → 来源月份
        const sortedMonths = [...months].sort();

        for (let i = 0; i < sortedMonths.length; i++) {
            const month = sortedMonths[i];
            if ((filledMap.get(month) || 0) > 0) continue;

            // 往后找
            let fillValue = 0;
            let sourceMonth = '';
            for (let j = i + 1; j < sortedMonths.length; j++) {
                const v = filledMap.get(sortedMonths[j]) || 0;
                if (v > 0) { fillValue = v; sourceMonth = sortedMonths[j]; break; }
            }
            // 往前找
            if (fillValue === 0) {
                for (let j = i - 1; j >= 0; j--) {
                    const v = filledMap.get(sortedMonths[j]) || 0;
                    if (v > 0) { fillValue = v; sourceMonth = sortedMonths[j]; break; }
                }
            }
            if (fillValue > 0) {
                filledMap.set(month, fillValue);
                filledMonths.add(month);
                fillSources.set(month, sourceMonth);
            }
        }
        return { filledMap, filledMonths, fillSources };
    }

    /**
     * 查找用户α配置
     * 一条 listing 对应一条配置，两种定位方式：
     *   1. listing_id 精确定位
     *   2. product_code + marketplace + asin + msku + store_id 组合定位
     */
    private async findUserAlphaConfig(
        userId: number,
        product_code: string,
        marketplace: string,
        asin?: string,
        listing_id?: number,
        msku?: string,
        store_id?: number
    ): Promise<AppAmzUserAlphaConfigEntity | null> {
        // 1. 优先用 listing_id 精确定位
        if (listing_id) {
            const config = await this.userAlphaConfigRepo.findOne({
                where: { user_id: userId, listing_id }
            });
            if (config) return config;
        }
        // 2. 用完整自然键组合定位（和 CRUD findConfig 同一套精确匹配规则）
        if (product_code && marketplace) {
            const qb = this.userAlphaConfigRepo
                .createQueryBuilder('c')
                .where('c.user_id = :userId', { userId })
                .andWhere('c.product_code = :product_code', { product_code })
                .andWhere('c.marketplace = :marketplace', { marketplace });
            if (asin) {
                qb.andWhere('c.asin = :asin', { asin });
            } else {
                qb.andWhere('c.asin IS NULL');
            }
            if (msku) {
                qb.andWhere('c.msku = :msku', { msku });
            } else {
                qb.andWhere('c.msku IS NULL');
            }
            if (store_id) {
                qb.andWhere('c.store_id = :store_id', { store_id });
            } else {
                qb.andWhere('c.store_id IS NULL');
            }
            const config = await qb.getOne();
            if (config) return config;
        }
        return null;
    }

    /**
     * 算法4 V2 - 计算单个月份的综合系数
     *
     * 决策矩阵（按优先级命中即停）：
     *   1. 销量+搜索都完全无数据 → coefficient=1, reason=no_data
     *   2. 销量完全无数据 → α=0, reason=no_sales
     *   3. 搜索完全无数据 → α=1, reason=no_search
     *   4. 销量有真实数据 → α=0.7, reason=sales_real
     *   5. 销量被补全+搜索真实 → α=0.2, reason=sales_filled_search_real
     *   6. 两者都被补全 → α=0.7, reason=both_filled
     *
     * α 四层优先级：前端逐月 > 前端全局 > 用户逐月 > 用户全局 > 系统计算
     */
    private calculateCombinedCoefficientV2(params: {
        salesFill: { filledMap: Map<string, number>; filledMonths: Set<string>; fillSources: Map<string, string> };
        searchFill: { filledMap: Map<string, number>; filledMonths: Set<string>; fillSources: Map<string, string> };
        salesDataMap: Map<string, number>;
        keywordDataMap: Map<string, number>;
        baseSalesValue: number;
        baseKeywordValue: number;
        histMonth: string;
        targetMonth: string;
        frontendAlpha?: number;
        frontendMonthlyAlpha?: number;
        userAlphaConfig?: AppAmzUserAlphaConfigEntity | null;
    }) {
        const {
            salesFill, searchFill, salesDataMap, keywordDataMap,
            baseSalesValue, baseKeywordValue, histMonth, targetMonth,
            frontendAlpha, frontendMonthlyAlpha, userAlphaConfig
        } = params;

        // --- 原始值和补全后值 ---
        const salesOriginal = salesDataMap.get(histMonth) || 0;
        const searchOriginal = keywordDataMap.get(histMonth) || 0;
        const salesAfterFill = salesFill.filledMap.get(histMonth) || 0;
        const searchAfterFill = searchFill.filledMap.get(histMonth) || 0;
        const salesIsFilled = salesFill.filledMonths.has(histMonth);
        const searchIsFilled = searchFill.filledMonths.has(histMonth);
        const salesAvailable = salesAfterFill > 0; // 补全后仍有值
        const searchAvailable = searchAfterFill > 0;

        // --- 计算系数 ---
        const filledSalesCoeff = baseSalesValue > 0 ? salesAfterFill / baseSalesValue : 1;
        const filledSearchCoeff = baseKeywordValue > 0 ? searchAfterFill / baseKeywordValue : 1;

        // --- 系统α决策矩阵 ---
        let systemAlpha = 0.7;
        let alphaReason = 'sales_real';

        if (!salesAvailable && !searchAvailable) {
            // 两边都没数据
            alphaReason = 'no_data';
            systemAlpha = 0;
        } else if (!salesAvailable) {
            alphaReason = 'no_sales';
            systemAlpha = 0;
        } else if (!searchAvailable) {
            alphaReason = 'no_search';
            systemAlpha = 1;
        } else if (!salesIsFilled) {
            // 销量有真实数据
            alphaReason = 'sales_real';
            systemAlpha = 0.7;
        } else if (salesIsFilled && !searchIsFilled) {
            alphaReason = 'sales_filled_search_real';
            systemAlpha = 0.2;
        } else {
            // 两者都被补全
            alphaReason = 'both_filled';
            systemAlpha = 0.7;
        }

        // --- 用户配置 ---
        const userMonthlyAlpha = userAlphaConfig?.monthly_alphas?.[targetMonth];
        const userDefaultAlpha = userAlphaConfig?.default_alpha;
        const userRemark = userAlphaConfig?.monthly_remarks?.[targetMonth] || userAlphaConfig?.monthly_remarks?.['_global'] || null;

        // --- 四层优先级决定最终α ---
        let finalAlpha: number;
        let alphaSource: string;

        if (frontendMonthlyAlpha !== undefined) {
            finalAlpha = frontendMonthlyAlpha;
            alphaSource = 'frontend_monthly';
        } else if (frontendAlpha !== undefined) {
            finalAlpha = frontendAlpha;
            alphaSource = 'frontend_override';
        } else if (userMonthlyAlpha !== undefined) {
            finalAlpha = userMonthlyAlpha;
            alphaSource = 'user_monthly';
        } else if (userDefaultAlpha !== undefined && userDefaultAlpha !== null) {
            finalAlpha = Number(userDefaultAlpha);
            alphaSource = 'user_default';
        } else {
            finalAlpha = systemAlpha;
            alphaSource = 'system';
        }

        // --- 计算综合系数 ---
        let coefficient: number;
        if (alphaReason === 'no_data') {
            // 两边都没数据，强制系数=1（按日均算）
            coefficient = 1;
        } else {
            coefficient = finalAlpha * filledSalesCoeff + (1 - finalAlpha) * filledSearchCoeff;
        }

        // --- 生成解释文本 ---
        const reasonText = this.buildAlphaReasonText({
            histMonth, targetMonth, alphaReason, alphaSource, finalAlpha, systemAlpha,
            salesOriginal, salesAfterFill, salesIsFilled,
            searchOriginal, searchAfterFill, searchIsFilled,
            salesFillSource: salesFill.fillSources.get(histMonth),
            searchFillSource: searchFill.fillSources.get(histMonth),
            userRemark
        });

        return {
            coefficient: Number(coefficient.toFixed(6)),
            alpha: finalAlpha,
            alpha_source: alphaSource,
            alpha_reason: alphaReason,
            alpha_reason_text: reasonText,
            system_alpha: systemAlpha,
            user_alpha: userMonthlyAlpha ?? userDefaultAlpha ?? null,
            user_remark: userRemark,
            sales_filled: salesIsFilled,
            search_filled: searchIsFilled,
            sales_available: salesAvailable,
            search_available: searchAvailable,
            sales_original: salesOriginal,
            sales_after_fill: salesAfterFill,
            search_original: searchOriginal,
            search_after_fill: searchAfterFill,
            filled_sales_coefficient: Number(filledSalesCoeff.toFixed(6)),
            keyword_coefficient: Number(filledSearchCoeff.toFixed(6))
        };
    }

    /**
     * 生成 alpha_reason_text 详细解释文本
     */
    private buildAlphaReasonText(p: {
        histMonth: string; targetMonth: string;
        alphaReason: string; alphaSource: string;
        finalAlpha: number; systemAlpha: number;
        salesOriginal: number; salesAfterFill: number; salesIsFilled: boolean;
        searchOriginal: number; searchAfterFill: number; searchIsFilled: boolean;
        salesFillSource?: string; searchFillSource?: string;
        userRemark?: string | null;
    }): string {
        const m = p.histMonth;
        const parts: string[] = [];

        // 销量描述
        if (p.salesOriginal > 0) {
            parts.push(`销量有真实数据(${p.salesOriginal})`);
        } else if (p.salesIsFilled) {
            parts.push(`销量原值为0，已用${p.salesFillSource || '相邻月'}数据(${p.salesAfterFill})补全`);
        } else {
            parts.push(`销量完全无数据且无法补全`);
        }

        // 搜索描述
        if (p.searchOriginal > 0) {
            parts.push(`搜索有真实数据(${p.searchOriginal})`);
        } else if (p.searchIsFilled) {
            parts.push(`搜索原值为0，已用${p.searchFillSource || '相邻月'}数据(${p.searchAfterFill})补全`);
        } else {
            parts.push(`搜索完全无数据且无法补全`);
        }

        let text = `${m}月: ${parts.join('；')}。`;

        // α 来源描述
        switch (p.alphaSource) {
            case 'system':
                if (p.alphaReason === 'no_data') {
                    text += ` 系统按日均计算，系数强制=1。`;
                } else {
                    text += ` 系统建议α=${p.systemAlpha}。`;
                }
                break;
            case 'user_monthly':
                text += ` 用户逐月自定义α=${p.finalAlpha}`;
                if (p.userRemark) text += `(备注:${p.userRemark})`;
                text += `，系统建议值为${p.systemAlpha}。`;
                break;
            case 'user_default':
                text += ` 用户全局默认α=${p.finalAlpha}，系统建议值为${p.systemAlpha}。`;
                break;
            case 'frontend_monthly':
                text += ` 前端逐月传入α=${p.finalAlpha}，系统建议值为${p.systemAlpha}。`;
                break;
            case 'frontend_override':
                text += ` 前端全局传入α=${p.finalAlpha}，系统建议值为${p.systemAlpha}。`;
                break;
        }

        return text;
    }
}

