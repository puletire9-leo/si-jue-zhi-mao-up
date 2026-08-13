import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In, IsNull, Not, Brackets } from 'typeorm';
import { AppAmzBsrPurchaseOrderSyncLingxingEntity } from '../entity/bsr_purchase_order_sync_lingxing';
import { AppAmzBsrPurchaseOrderItemSyncLingxingEntity } from '../entity/bsr_purchase_order_item_sync_lingxing';
import { AppAmzBsrPurchaseOrderLogisticsConfirmLogEntity } from '../entity/bsr_purchase_order_logistics_confirm_log';
import { AppAmzBsrAnalysisRecordLingxingEntity } from '../entity/bsr_analysis_record_lingxing';
import { AppAmzBsrPurchasePlanLingxingEntity } from '../entity/bsr_purchase_plan_lingxing';
import { AppAmzBsrPurchasePlanLingxingService } from './bsr_purchase_plan_lingxing'; // Import service
import { AppAmzBsrPurchaseOrderLogisticsService } from './bsr_purchase_order_logistics';
import { AppAmzBsrProductListingLingxingEntity } from '../entity/bsr_product_Listing_Lingxing';
import { AppAmzBsrRestockingCenterLingxingEntity } from '../entity/bsr_restocking_center_lingxing';
import { AppAmzBsrShipmentPlanLingxingEntity } from '../entity/bsr_shipment_plan_lingxing';
import { LingXingUtils } from '../utils/lingxing/lingxingUtils';
import { buildAutoCompleteCandidateQuery } from '../utils/purchase/purchase_order_auto_complete_candidates';
import { collectPurchaseOrderPlanSnMap } from '../utils/purchase/purchase_order_plan_sn';
import { AppAnalysisCustomService } from './analysis_custom';
import { AppBsrPurchasePlanRemarkAutoCompleteService } from './bsr_purchase_plan_remark_auto_complete';
import * as dayjs from 'dayjs';

const DEFAULT_VOLATILITY_COEFFICIENT = 0.75;
const MIN_VOLATILITY_COEFFICIENT = 0;
const MAX_VOLATILITY_COEFFICIENT = 10;

const roundReplenishCoefficient = (value: number, precision = 6) => {
    const factor = Math.pow(10, precision);
    return Math.round(value * factor) / factor;
};

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

function applyVolatilityCoefficient(rawCoefficient: any, volatilityCoefficient: any): number {
    const raw = Number(rawCoefficient);
    const volatility = normalizeVolatilityCoefficient(volatilityCoefficient);
    const coefficient = Number.isFinite(raw) ? raw : 1;
    return roundReplenishCoefficient((coefficient - 1) * volatility + 1);
}

function parseRequestObject(value: any) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

function pickRequestNumber(...values: any[]) {
    for (const value of values) {
        if (value === undefined || value === null || value === '') continue;
        const num = Number(value);
        if (Number.isFinite(num)) return num;
    }
    return null;
}

function normalizeMonthlyAlphaMap(value: any): Record<string, number> {
    const source = parseRequestObject(value);
    const result: Record<string, number> = {};
    if (!source || typeof source !== 'object' || Array.isArray(source)) return result;
    Object.entries(source).forEach(([month, alpha]) => {
        const num = Number(alpha);
        if (!/^\d{4}-\d{2}$/.test(month) || !Number.isFinite(num)) return;
        result[month] = Math.max(0, Math.min(1, Math.round(num * 100) / 100));
    });
    return result;
}

function normalizeMonthlyCoefficientOverrides(value: any): Record<string, any> {
    const source = parseRequestObject(value);
    const result: Record<string, any> = {};
    if (!source || typeof source !== 'object' || Array.isArray(source)) return result;
    Object.entries(source).forEach(([month, row]) => {
        if (!/^\d{4}-\d{2}$/.test(month)) return;
        const parsed = parseRequestObject(row);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;
        result[month] = parsed;
    });
    return result;
}

function resolveMonthlyCoefficientOverride(
    override: any,
    algorithm: number,
    volatilityCoefficient: number
) {
    if (!override || typeof override !== 'object') return null;
    const alpha = pickRequestNumber(override.alpha, override.manual_alpha, override.system_alpha);
    const salesCoeff = pickRequestNumber(
        override.filled_sales_coefficient,
        override.sales_coefficient,
        override.salesCoeff
    );
    const searchCoeff = pickRequestNumber(
        override.keyword_coefficient,
        override.search_coefficient,
        override.searchCoeff
    );
    let rawCoefficient = pickRequestNumber(
        override.raw_coefficient,
        override.rawCoefficient,
        override.raw_combined_coefficient,
        override.rawCombinedCoefficient
    );

    if (rawCoefficient === null && algorithm === 4 && alpha !== null && salesCoeff !== null && searchCoeff !== null) {
        rawCoefficient = roundReplenishCoefficient(alpha * salesCoeff + (1 - alpha) * searchCoeff);
    }

    if (rawCoefficient === null) {
        const adjusted = pickRequestNumber(
            override.adjusted_coefficient,
            override.adjustedCoefficient,
            override.final_coefficient,
            override.finalCoefficient
        );
        if (adjusted !== null) {
            const volatility = normalizeVolatilityCoefficient(volatilityCoefficient);
            rawCoefficient = volatility === 0
                ? adjusted
                : roundReplenishCoefficient((adjusted - 1) / volatility + 1);
        }
    }

    if (rawCoefficient === null) {
        rawCoefficient = pickRequestNumber(override.coefficient);
    }

    if (rawCoefficient === null) return null;
    const coefficient = applyVolatilityCoefficient(rawCoefficient, volatilityCoefficient);
    return {
        rawCoefficient,
        coefficient,
        detail: {
            ...override,
            alpha,
            filled_sales_coefficient: salesCoeff,
            keyword_coefficient: searchCoeff,
            raw_coefficient: rawCoefficient,
            volatility_coefficient: volatilityCoefficient,
            adjusted_coefficient: coefficient,
            coefficient,
            source: 'snapshot_override'
        }
    };
}

interface ShipmentPlanLocalCreator {
    userId: number | null;
    username: string;
    nickname: string;
}

interface PendingPurchasePlanProduct {
    asin: string;
    marketplace: string;
    store_id: number;
    msku?: string;
    seller_name?: string;
    product_code?: string;
    local_sku?: string;
}

interface PendingPurchasePlanResult {
    plan_qty: number;
    plan_count: number;
    details: any[];
    sync_attempted?: boolean;
    sync_success?: boolean;
    sync_error?: string | null;
    synced_plan_sns?: string[];
}

interface PendingDeliveryResult {
    pending_qty: number;
    pending_count: number;
    details: any[];
    lingxing_pending_qty: number;
    lingxing_pending_count: number;
    lingxing_details: any[];
    sync_attempted?: boolean;
    sync_success?: boolean;
    sync_error?: string | null;
    synced_order_sns?: string[];
    failed_order_sns?: string[];
}

interface PendingDeliverySyncMeta {
    attempted: boolean;
    success: boolean;
    error?: string | null;
    orderSns: string[];
    failedOrderSns: string[];
    remoteMissingOrderSns?: string[];
    requestFailedOrderSns?: string[];
    items?: PurchaseOrderSyncItemResult[];
    autoComplete?: any;
    auto_complete?: any;
}

type PurchaseOrderSyncItemStatus = 'synced' | 'remote_missing' | 'request_failed' | 'invalid';

interface PurchaseOrderSyncItemResult {
    order_sn: string;
    status: PurchaseOrderSyncItemStatus;
    message: string;
    updated?: boolean;
}

interface PurchaseOrderSyncByOrderSnsOptions {
    keepLocalOnMissing?: boolean;
}

interface ConfirmReceiptOptions {
    remark?: string;
    source?: string;
}

interface ConfirmReceiptResult {
    updated: number;
    batch_id: string;
    not_found_order_sns: string[];
    skipped_order_sns: string[];
    skipped_reasons: Record<string, string>;
}

export function getBatchGapCoefficientMonthRange(
    startDate: string,
    endDate: string,
    algorithm: number,
    coefficientStartMonth?: string,
    coefficientEndMonth?: string
) {
    const segmentStart = dayjs(startDate).startOf('month');
    const segmentEnd = dayjs(endDate).startOf('month');

    if (Number(algorithm) !== 4 || !coefficientStartMonth || !coefficientEndMonth) {
        return {
            startMonth: segmentStart.format('YYYY-MM'),
            endMonth: segmentEnd.format('YYYY-MM')
        };
    }

    const extraStart = dayjs(`${coefficientStartMonth}-01`).startOf('month');
    const extraEnd = dayjs(`${coefficientEndMonth}-01`).startOf('month');
    if (!extraStart.isValid() || !extraEnd.isValid()) {
        return {
            startMonth: segmentStart.format('YYYY-MM'),
            endMonth: segmentEnd.format('YYYY-MM')
        };
    }

    // 这里只扩大“综合走势系数补全”的月份上下文。
    // 真实 expectedDemand/gap 仍然只按 startDate/endDate 对应的运输段计算。
    const queryStart = segmentStart.isBefore(extraStart) ? segmentStart : extraStart;
    const queryEnd = segmentEnd.isAfter(extraEnd) ? segmentEnd : extraEnd;

    return {
        startMonth: queryStart.format('YYYY-MM'),
        endMonth: queryEnd.format('YYYY-MM')
    };
}

/**
 * 采购单同步服务
 */
@Provide()
export class AppAmzBsrPurchaseOrderSyncLingxingService extends BaseService {
    @InjectEntityModel(AppAmzBsrPurchaseOrderSyncLingxingEntity)
    orderRepo: Repository<AppAmzBsrPurchaseOrderSyncLingxingEntity>;

    @InjectEntityModel(AppAmzBsrPurchaseOrderItemSyncLingxingEntity)
    orderItemRepo: Repository<AppAmzBsrPurchaseOrderItemSyncLingxingEntity>;

    @InjectEntityModel(AppAmzBsrPurchaseOrderLogisticsConfirmLogEntity)
    logisticsConfirmLogRepo: Repository<AppAmzBsrPurchaseOrderLogisticsConfirmLogEntity>;

    @InjectEntityModel(AppAmzBsrAnalysisRecordLingxingEntity)
    analysisRecordRepo: Repository<AppAmzBsrAnalysisRecordLingxingEntity>;

    @InjectEntityModel(AppAmzBsrPurchasePlanLingxingEntity)
    purchasePlanRepo: Repository<AppAmzBsrPurchasePlanLingxingEntity>;

    @Inject()
    lingxingUtils: LingXingUtils;

    // 采购计划服务 (用于同步采购计划详情)
    @Inject()
    private purchasePlanService: AppAmzBsrPurchasePlanLingxingService;

    @Inject()
    private purchaseOrderLogisticsService: AppAmzBsrPurchaseOrderLogisticsService;

    @Inject()
    analysisService: AppAnalysisCustomService;

    @Inject()
    purchasePlanRemarkAutoCompleteService: AppBsrPurchasePlanRemarkAutoCompleteService;

    @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
    productListingRepo: Repository<AppAmzBsrProductListingLingxingEntity>;

    @InjectEntityModel(AppAmzBsrRestockingCenterLingxingEntity)
    restockingCenterRepo: Repository<AppAmzBsrRestockingCenterLingxingEntity>;

    @InjectEntityModel(AppAmzBsrShipmentPlanLingxingEntity)
    shipmentPlanRepo: Repository<AppAmzBsrShipmentPlanLingxingEntity>;

    // 领星采购单API
    private readonly PURCHASE_ORDER_LIST_API = '/erp/sc/routing/data/local_inventory/purchaseOrderList';
    private readonly PURCHASE_ORDER_LIST_API_RAW = '/erp/sc/routing/data/local_inventory/purchaseOrderList';
    purchaseOrderSyncTimeoutMs = 30000;
    private readonly purchaseOrderSingleFallbackDelayMs = 1000;
    private readonly purchaseOrderRateLimitRetryDelayMs = 4000;

    /**
     * 智能同步 - 主入口
     * @param isForceAll 是否全量重拉采购单(从199x年拉取)
     */
    async smartSync(isForceAll: boolean = false): Promise<{ total: number; matched: number; updated: number; auto_complete?: any }> {
        // 1. 获取所有状态为1的 plan_sn（作为认亲基因血脉备用）
        const allRecords = await this.analysisRecordRepo.find({
            where: {
                plan_sn: Not(IsNull()),
                status: 1
            },
            select: ['id', 'plan_sn']
        });
        const planSnMap = new Map(allRecords.map(r => [r.plan_sn ? r.plan_sn.trim() : '', r.id]));

        // 2. 决定拉取时间游标
        let startDateStr = '1990-01-01'; // 默认全量
        if (!isForceAll) {
            // 获取本地最新的一条 update_time_remote
            const latestOrder = await this.orderRepo.findOne({
                where: {},
                order: { update_time_remote: 'DESC' }
            });
            if (latestOrder && latestOrder.update_time_remote && dayjs(latestOrder.update_time_remote).isValid()) {
                // 游标回退7天防漏 (扩大搜索范围兜底)
                startDateStr = dayjs(latestOrder.update_time_remote).subtract(7, 'day').format('YYYY-MM-DD HH:mm:ss');
            }
        }

        // 结束时间，如果强行拉全量，因为数据庞大，还是以今天为准
        const endDateStr = dayjs().format('YYYY-MM-DD HH:mm:ss');
        console.log(`[smartSync] 开始同步, 时间范围: ${startDateStr} ~ ${endDateStr} (isForceAll: ${isForceAll})`);

        // 3. 循环拉取大杂烩数据
        let offset = 0;
        const length = 500;
        let totalCount = 0;
        let updatedCount = 0;
        const touchedPlanSns = new Set<string>();

        while (true) {
            const response: any = await this.lingxingUtils.httpPost(this.PURCHASE_ORDER_LIST_API, {
                search_field_time: 'update_time', // 使用更新时间作为游标
                start_date: startDateStr,
                end_date: endDateStr,
                offset,
                length
            }, true);

            // 检查 API 返回错误
            const resData = response?.data || response;
            if (resData && resData.code !== undefined && String(resData.code) !== '0' && String(resData.code) !== '200') {
                throw new Error(`领星API错误: ${resData.msg || resData.code}`);
            }

            const result = resData?.data || resData;
            if (!Array.isArray(result) || result.length === 0) break;

            totalCount += result.length;

            // 4. 洗表入库逻辑（全状态保存）
            for (const orderData of result) {
                // 所有状态都 Upsert 入库
                const planSns = await this.saveOrder(orderData, planSnMap);
                this.addPlanSns(touchedPlanSns, planSns);
                updatedCount++;

                await this.refreshPackagesAfterOrderSync(orderData, 'smartSync');
            }

            if (result.length < length) break;
            offset += length;
        }

        // =========================================================================
        // 【二】本地深水活单兜底探查（针对 update_time 长时间未变，脱离了7天滑窗的陈年活单）
        // =========================================================================
        if (!isForceAll) {
            console.log(`[smartSync] 开始执行本地老活单兜底探查...(status=2)`);
            try {
                // 查出所有本地标记为“待到货”的老单 (避开领星时间滑窗的盲区)
                const activeOrders = await this.orderRepo.find({
                    where: { status: 2 },
                    select: ['order_sn']
                });

                // 为了找到对应的 plan_sn，去子表联合获取
                const activeOrderSns = activeOrders.map(o => o.order_sn);
                let activeItems = [];
                if (activeOrderSns.length > 0) {
                    activeItems = await this.orderItemRepo.find({
                        where: { order_sn: In(activeOrderSns), plan_sn: Not(IsNull()) },
                        select: ['order_sn', 'plan_sn']
                    });
                }

                // 构建单号 -> plan_sn 集合的映射；同一采购单可能关联多个采购计划
                const orderPlanMap = collectPurchaseOrderPlanSnMap(activeItems);

                let checkedCount = 0;
                let refreshPackageCount = 0;
                let syncPlanCount = 0;

                for (const localOrder of activeOrders) {
                    checkedCount++;
                    const orderSn = localOrder.order_sn;
                    const planSns = orderPlanMap.get(orderSn);

                    try {
                        // 1. 刷新本地物流包裹，只读取采购单主表 logistics_info，不访问领星物流网页接口
                        await this.purchaseOrderLogisticsService.refreshPackagesFromOrder(orderSn);
                        refreshPackageCount++;

                        // 2. 探查采购计划 (内置1天冷却期，直接调用即可)
                        if (planSns?.size) {
                            for (const planSn of planSns) {
                                // getPurchasePlanInfo 内部已包含 1天 的缓存拦截机制，不会造成过度请求
                                await this.getPurchasePlanInfo(planSn);
                                this.addPlanSns(touchedPlanSns, [planSn]);
                                syncPlanCount++;
                            }
                        }
                    } catch (e) {
                        console.error(`[smartSync] 本地老活单探查失败 [${orderSn}]:`, e.message);
                    }
                }
                console.log(`[smartSync] 本地兜底探查完毕! 触达活单: ${checkedCount} 笔, 刷新物流包裹: ${refreshPackageCount} 笔, 强制校验计划: ${syncPlanCount} 笔`);
            } catch (err) {
                console.error(`[smartSync] 老活单兜底探查发生系统异常:`, err);
            }
        }

        const autoComplete = await this.runPurchasePlanRemarkAutoComplete(touchedPlanSns, 'smartSync', { syncPlans: true });
        console.log(`[smartSync] 同步完成. 扫描API记录: ${totalCount} 条, 新增/更新有效记录: ${updatedCount} 条`);
        return { total: totalCount, matched: updatedCount, updated: updatedCount, auto_complete: autoComplete };
    }

    private async refreshPackagesAfterOrderSync(orderData: any, source: string): Promise<void> {
        const orderSn = this.normalizeText(orderData?.order_sn);
        if (!orderSn) return;
        if (![2, 9].includes(Number(orderData?.status))) return;

        try {
            await this.purchaseOrderLogisticsService.refreshPackagesFromOrder(orderSn);
        } catch (e: any) {
            console.error(`[${source}] 刷新物流包裹失败 - ${orderSn}:`, e?.message || e);
        }
    }

    /**
     * 单条同步 - 根据order_sn从领星同步指定采购单
     */
    async syncSingle(order_sn: string): Promise<any> {
        if (!order_sn) {
            throw new Error('采购单号不能为空');
        }

        console.log(`[syncSingle] 开始同步采购单: ${order_sn}`);

        // 为认亲准备 planSnMap
        const allRecords = await this.analysisRecordRepo.find({ where: { status: 1 }, select: ['id', 'plan_sn'] });
        const planSnMap = new Map(allRecords.map(r => [r.plan_sn ? r.plan_sn.trim() : '', r.id]));

        const response: any = await this.lingxingUtils.httpPost(this.PURCHASE_ORDER_LIST_API, {
            search_field_time: 'update_time', // 改为按 update_time，由于单条同步，也可以不用管
            start_date: '1990-01-01',
            end_date: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            order_sn: [order_sn]
        }, true);

        const resData = response?.data || response;
        const result = resData?.data || resData;

        if (Array.isArray(result) && result.length > 0) {
            const orderData = result[0];
            // 所有状态都允许同步入库
            const planSns = await this.saveOrder(orderData, planSnMap);
            await this.refreshPackagesAfterOrderSync(orderData, 'syncSingle');
            const autoComplete = await this.runPurchasePlanRemarkAutoComplete(planSns, 'syncSingle', { syncPlans: true });
            console.log(`[syncSingle] 同步成功: ${order_sn} (status=${orderData.status})`);
            return { order_sn, updated: true, auto_complete: autoComplete };
        }

        // 领星没查到，说明被删了
        await this.orderItemRepo.delete({ order_sn });
        await this.orderRepo.delete({ order_sn });
        throw new Error(`查无此单: 采购单 ${order_sn} 在领星中不存在或已彻底删除，同步终止`);
    }

    /**
     * 按采购单号批量安全同步。
     * 批量发货弹窗使用 keepLocalOnMissing=true：查到就更新，查不到/失败只返回状态，不清理本地单据。
     */
    async syncByOrderSns(body: { order_sns?: string[]; keepLocalOnMissing?: boolean } = {}) {
        const rawOrderSns = Array.isArray(body.order_sns) ? body.order_sns : [];
        const normalizedOrderSns = [
            ...new Set(rawOrderSns.map(orderSn => this.normalizeText(orderSn)).filter(Boolean))
        ];

        if (normalizedOrderSns.length === 0) {
            return {
                total: 0,
                synced_count: 0,
                remote_missing_count: 0,
                failed_count: 0,
                invalid_count: rawOrderSns.length,
                success: true,
                items: rawOrderSns
                    .filter(orderSn => !this.normalizeText(orderSn))
                    .map(orderSn => ({
                        order_sn: String(orderSn ?? ''),
                        status: 'invalid' as PurchaseOrderSyncItemStatus,
                        message: '采购单号为空，已跳过',
                        updated: false,
                    })),
            };
        }

        const maxOrderCount = 200;
        if (normalizedOrderSns.length > maxOrderCount) {
            throw new Error(`单次最多同步 ${maxOrderCount} 个采购单`);
        }

        const keepLocalOnMissing = body.keepLocalOnMissing !== false;
        const syncPromise = this.syncPurchaseOrdersByOrderSns(normalizedOrderSns, {
            keepLocalOnMissing,
        });
        const syncResult = keepLocalOnMissing
            ? await this.withPurchaseOrderSyncTimeout(syncPromise, normalizedOrderSns, this.purchaseOrderSyncTimeoutMs)
            : await syncPromise;
        const items = syncResult.items || [];

        return {
            total: normalizedOrderSns.length,
            synced_count: syncResult.orderSns.length,
            remote_missing_count: syncResult.remoteMissingOrderSns?.length || 0,
            failed_count: syncResult.requestFailedOrderSns?.length || 0,
            invalid_count: 0,
            success: syncResult.success,
            error: syncResult.error || null,
            order_sns: normalizedOrderSns,
            synced_order_sns: syncResult.orderSns,
            remote_missing_order_sns: syncResult.remoteMissingOrderSns || [],
            failed_order_sns: syncResult.requestFailedOrderSns || [],
            items,
            auto_complete: syncResult.autoComplete || null,
        };
    }

    private withPurchaseOrderSyncTimeout(
        promise: Promise<PendingDeliverySyncMeta>,
        orderSns: string[],
        timeoutMs: number
    ): Promise<PendingDeliverySyncMeta> {
        const safeTimeoutMs = Math.max(1, Number(timeoutMs) || 20000);
        let timer: NodeJS.Timeout | null = null;
        const buildFailureMeta = (message: string): PendingDeliverySyncMeta => ({
            attempted: true,
            success: false,
            error: message,
            orderSns: [],
            failedOrderSns: [...orderSns],
            remoteMissingOrderSns: [],
            requestFailedOrderSns: [...orderSns],
            items: orderSns.map(orderSn => ({
                order_sn: orderSn,
                status: 'request_failed',
                message,
                updated: false,
            })),
        });
        const timeoutPromise = new Promise<PendingDeliverySyncMeta>(resolve => {
            timer = setTimeout(() => {
                const message = `采购单刷新超时（${Math.round(safeTimeoutMs / 1000)}秒），使用本地缓存`;
                resolve(buildFailureMeta(message));
            }, safeTimeoutMs);
        });
        const guardedPromise = promise
            .catch((e: any) => buildFailureMeta(`采购单刷新失败：${e?.message || '未知错误'}，使用本地缓存`))
            .finally(() => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            });

        return Promise.race([
            guardedPromise,
            timeoutPromise,
        ]);
    }

    /**
     * 分页查询（前端调用）
     */
    async customPage(query: any): Promise<{ list: any[]; pagination: any }> {
        const { page = 1, size = 20, status, status_shipped, pay_status, keyWord, searchType, startDate, endDate, logistics_status, overtime_days } = query;
        const skip = (page - 1) * size;

        const qb = this.orderRepo.createQueryBuilder('o');

        // 筛选条件 (本地状态) —— 前端传数组，空数组=全部
        if (Array.isArray(status) && status.length > 0) {
            qb.andWhere('o.status IN (:...status)', { status: status.map(Number) });
        }

        // 筛选条件 (到货状态)
        if (status_shipped !== undefined && status_shipped !== null && status_shipped !== '') {
            qb.andWhere('o.status_shipped = :status_shipped', { status_shipped });
        }

        // 筛选条件 (付款状态)
        if (pay_status !== undefined && pay_status !== null && pay_status !== '') {
            qb.andWhere('o.pay_status = :pay_status', { pay_status });
        }

        // 关键字搜索：根据 searchType 精确匹配单个字段，不指定则全字段模糊搜索
        if (keyWord) {
            if (searchType === 'order_sn') {
                qb.andWhere('o.order_sn LIKE :keyWord', { keyWord: `%${keyWord}%` });
            } else if (searchType === 'plan_sn') {
                qb.andWhere(`EXISTS (
                    SELECT 1 FROM app_amz_bsr_purchase_order_item_sync_lingxing i
                    WHERE i.order_sn = o.order_sn
                    AND i.plan_sn LIKE :keyWord
                )`, { keyWord: `%${keyWord}%` });
            } else if (searchType === 'asin') {
                qb.andWhere(`EXISTS (
                    SELECT 1 FROM app_amz_bsr_purchase_order_item_sync_lingxing i
                    LEFT JOIN app_amz_bsr_analysis_record_lingxing a ON i.analysis_record_id = a.id
                    WHERE i.order_sn = o.order_sn
                    AND a.asin LIKE :keyWord
                )`, { keyWord: `%${keyWord}%` });
            } else {
                // 兼容旧逻辑：全字段模糊搜索
                qb.andWhere(
                    `(o.order_sn LIKE :keyWord OR o.supplier_name LIKE :keyWord OR EXISTS (
                        SELECT 1 FROM app_amz_bsr_purchase_order_item_sync_lingxing i
                        WHERE i.order_sn = o.order_sn
                        AND (i.plan_sn LIKE :keyWord OR i.sku LIKE :keyWord OR i.product_name LIKE :keyWord)
                    ))`,
                    { keyWord: `%${keyWord}%` }
                );
            }
        }

        if (startDate) {
            qb.andWhere('o.order_time >= :startDate', { startDate });
        }
        if (endDate) {
            qb.andWhere('o.order_time <= :endDate', { endDate });
        }

        // ========== 物流状态筛选 ==========
        const overtimeDaysNum = Number(overtime_days) || 7;
        if (logistics_status) {
            this.purchaseOrderLogisticsService.applyOrderStatusFilter(qb, logistics_status, overtimeDaysNum);
        }

        qb.orderBy('o.order_time', 'DESC')
            .skip(skip)
            .take(size);

        const [list, total] = await qb.getManyAndCount();

        // 填充关联的 plan_sn (用于前端显示)
        if (list.length > 0) {
            const orderSns = list.map(o => o.order_sn);
            const items = await this.orderItemRepo.createQueryBuilder('i')
                .select(['i.order_sn', 'i.plan_sn'])
                .where('i.order_sn IN (:...orderSns)', { orderSns })
                .andWhere('i.plan_sn IS NOT NULL')
                .andWhere("i.plan_sn != ''")
                .getMany();

            const map = new Map<string, string[]>();
            items.forEach(i => {
                if (!map.has(i.order_sn)) map.set(i.order_sn, []);
                // 去重
                if (!map.get(i.order_sn)!.includes(i.plan_sn)) {
                    map.get(i.order_sn)!.push(i.plan_sn);
                }
            });

            // 检查是否有分析记录缺失的子项
            const missingItems = await this.orderItemRepo.createQueryBuilder('mi')
                .select(['mi.order_sn'])
                .where('mi.order_sn IN (:...orderSns)', { orderSns })
                .andWhere('mi.is_analysis_missing = 1')
                .getMany();
            const missingSet = new Set(missingItems.map(i => i.order_sn));

            list.forEach(o => {
                o.related_plans = map.get(o.order_sn) || [];
                (o as any).has_analysis_missing = missingSet.has(o.order_sn);
            });
            for (const orderSn of orderSns) {
                try {
                    await this.purchaseOrderLogisticsService.refreshPackagesFromOrder(orderSn);
                } catch (e: any) {
                    console.error(`[customPage] 刷新本地物流包裹失败 - ${orderSn}:`, e?.message || e);
                }
            }
            await this.purchaseOrderLogisticsService.attachStatusesToOrders(list, {
                overtimeDays: overtimeDaysNum,
            });
        }

        return {
            list,
            pagination: {
                page,
                size,
                total
            }
        };
    }




    /**
     * 批量推演采购缺口
     */
    async batchCalculateGap(body: any): Promise<any[]> {
        const { algorithm = 2, startDate, endDate, items, alpha: globalAlpha,
            coefficientStartMonth, coefficientEndMonth, includeInventoryUsage = false,
            includePreArrivalShortage = false, cycleStartDate, preArrivalEndDate,
            adjustPastInboundToFirstArrival = false } = body;
        if (!startDate || !endDate || !items || !Array.isArray(items)) {
            throw new Error('缺少必要参数 startDate, endDate 或 items');
        }

        const requestStartD = dayjs(startDate).startOf('day');
        const preArrivalCycleStartD = includePreArrivalShortage && cycleStartDate
            ? dayjs(cycleStartDate).startOf('day')
            : null;
        const requestEndD = dayjs(endDate).startOf('day');
        const requestPreArrivalEndD = includePreArrivalShortage && preArrivalEndDate
            ? dayjs(preArrivalEndDate).startOf('day')
            : null;
        const coefficientRangeStartDate = preArrivalCycleStartD
            && preArrivalCycleStartD.isValid()
            && preArrivalCycleStartD.isBefore(requestStartD, 'day')
            ? preArrivalCycleStartD.format('YYYY-MM-DD')
            : startDate;
        const coefficientRangeEndDate = requestPreArrivalEndD
            && requestPreArrivalEndD.isValid()
            && requestPreArrivalEndD.isAfter(requestEndD, 'day')
            ? requestPreArrivalEndD.format('YYYY-MM-DD')
            : endDate;

        const { startMonth, endMonth } = getBatchGapCoefficientMonthRange(
            coefficientRangeStartDate,
            coefficientRangeEndDate,
            Number(algorithm),
            coefficientStartMonth,
            coefficientEndMonth
        );

        // 缓存系数，避免同一个 ASIN 被重复查数据库
        const coeffCache = new Map<string, any>();
        const results: any[] = [];

        for (const item of items) {
            const { id, dailyAvgSales, fbaValid, fbaShippingList, alpha: itemAlpha,
                listing_id } = item;
            const enableSnapshotCoefficientOverrides = Boolean(
                body.useSnapshotCoefficientOverrides ||
                item.useSnapshotCoefficientOverrides
            );
            const itemMonthlyAlphas = enableSnapshotCoefficientOverrides
                ? normalizeMonthlyAlphaMap(item.monthlyAlphas)
                : {};
            const itemMonthlyCoefficientOverrides = enableSnapshotCoefficientOverrides
                ? normalizeMonthlyCoefficientOverrides(item.monthlyCoefficientOverrides)
                : {};
            // 用 let 以支持后续反查补全
            let productCode: string = item.product_code || '';
            let productAsin: string = item.asin || '';
            let productMarketplace: string = item.marketplace || '';
            let productStoreId: number | undefined = item.store_id;
            let msku: string = item.msku || '';

            // 决定本条目的有效 alpha：item.alpha > 全局 alpha > undefined(走默认)
            const effectiveAlpha: number | undefined = itemAlpha ?? globalAlpha ?? undefined;

            // 查询 listing 表：先用 id 匹配，没有 id 就用 5 个自然键匹配
            let fallbackListing: any = null;
            if (listing_id) {
                // 方式1：id 主键直接匹配
                fallbackListing = await this.productListingRepo.findOne({
                    where: { id: listing_id },
                    select: ['id', 'product_code', 'asin', 'marketplace', 'store_id', 'msku']
                });
            }
            if (!fallbackListing && productCode && productMarketplace && productAsin && msku && productStoreId) {
                // 方式2：5个自然键匹配（product_code + marketplace + asin + msku + store_id）
                fallbackListing = await this.productListingRepo.findOne({
                    where: { product_code: productCode, marketplace: productMarketplace, asin: productAsin, msku, store_id: productStoreId },
                    select: ['id', 'product_code', 'asin', 'marketplace', 'store_id', 'msku']
                });
            }

            // 用查到的 listing 覆盖标识字段（以 listing 表为准，不只补空）
            if (fallbackListing) {
                productCode = fallbackListing.product_code || productCode || '';
                productAsin = fallbackListing.asin || productAsin || '';
                productMarketplace = fallbackListing.marketplace || productMarketplace || '';
                productStoreId = fallbackListing.store_id || productStoreId;
                msku = fallbackListing.msku || msku || '';
            }

            // 必须成功定位到 listing 记录才允许继续计算
            if (!fallbackListing) {
                const reason = listing_id
                    ? `listing_id=${listing_id} 在产品表中不存在`
                    : '无法通过 id 或自然键定位到产品记录';
                results.push({ id, gap: 0, expectedDemand: 0, warning: reason });
                continue;
            }

            // 补全后仍缺关键字段 → 报错跳过（理论上走不到这里，因为 listing 必须有这些字段）
            if (!productCode || !productMarketplace) {
                results.push({ id, gap: 0, expectedDemand: 0, warning: '产品记录缺少 product_code 或 marketplace' });
                continue;
            }

            // 统一 listing_id：查到的 listing 为准
            const effectiveListingId = (fallbackListing?.id) || listing_id || null;

            // 缓存key需包含完整标识 + α值，不同店铺/asin/α覆盖可能有不同的系数结果
            const monthlyAlphaCacheKey = Object.keys(itemMonthlyAlphas).length
                ? JSON.stringify(itemMonthlyAlphas)
                : 'default_monthly_alpha';
            const cacheKey = `${productCode}_${productMarketplace}_${productAsin || ''}_${effectiveListingId || ''}_${msku || ''}_${productStoreId || ''}_${effectiveAlpha ?? 'default'}_${monthlyAlphaCacheKey}`;
            let coeffData = coeffCache.get(cacheKey);

            if (!coeffData) {
                try {
                    coeffData = await this.analysisService.getCalendarCoefficients(
                        productCode, productMarketplace, startMonth, endMonth,
                        effectiveAlpha,  // 全局α覆盖
                        Object.keys(itemMonthlyAlphas).length ? itemMonthlyAlphas : undefined,
                        productAsin,     // 用于查找用户α配置
                        effectiveListingId,  // 优先定位用户α配置（含反查补全）
                        msku,            // 备选定位
                        productStoreId   // 备选定位
                    );
                    coeffCache.set(cacheKey, coeffData);
                } catch (e) {
                    console.error(`[batchCalculateGap] 获取系数失败: ${cacheKey}`, e);
                    coeffData = null;
                }
            }

            let currentStock = Number(fbaValid) || 0;
            const baseDailySales = Number(dailyAvgSales) || 0;
            const volatilityCoefficient = normalizeVolatilityCoefficient(item.volatility_coefficient);
            let totalGap = 0;
            let expectedDemand = 0;
            let shortageStartDate = '';
            let shortageEndDate = '';
            let shortageDays = 0;
            const shortageRanges: Array<{
                startDate: string;
                endDate: string;
                days: number;
                quantity: number;
                details: Array<{ date: string; dailyNeed: number; inboundQuantity: number; stockBeforeDemand: number; shortage: number }>;
            }> = [];
            type InventorySourceLot = {
                sourceKey: string;
                sourceType: 'fba' | 'inbound';
                sourceName: string;
                orderSn?: string;
                shippingOrderSn?: string;
                shippingMethod?: string;
                logisticsChannelName?: string;
                amazonSaleDate?: string;
                originalAmazonSaleDate?: string;
                adjustedAmazonSaleDate?: string;
                arrivalAdjusted?: boolean;
                arrivalAdjustReason?: string;
                arrivalAdjustMethodKey?: string;
                arrivalAdjustMethodLabel?: string;
                originalQuantity: number;
                remainingQuantity: number;
            };
            type InventoryUsageSource = Omit<InventorySourceLot, 'remainingQuantity'> & {
                usedQuantity: number;
                remainingAfterSegment: number;
                arrivedInSegment?: boolean;
                openingQuantity?: number;
            };
            const usageLots: InventorySourceLot[] = [];
            const usageSourceMap = new Map<string, InventoryUsageSource>();
            const segmentOpeningMap = new Map<string, number>();
            let segmentOpeningCaptured = false;
            let segmentOpeningFba = 0;
            let segmentOpeningInbound = 0;
            let arrivalsInSegmentForUsage = 0;
            const pushUsageSource = (lot: InventorySourceLot, usedQuantity: number, arrivedInSegment = false) => {
                if (!includeInventoryUsage || (usedQuantity <= 0 && !arrivedInSegment)) return;
                const existed = usageSourceMap.get(lot.sourceKey);
                if (existed) {
                    existed.usedQuantity += usedQuantity;
                    existed.remainingAfterSegment = lot.remainingQuantity;
                    existed.arrivedInSegment = existed.arrivedInSegment || arrivedInSegment;
                    existed.openingQuantity = segmentOpeningMap.get(lot.sourceKey) || existed.openingQuantity || 0;
                    return;
                }
                usageSourceMap.set(lot.sourceKey, {
                    sourceKey: lot.sourceKey,
                    sourceType: lot.sourceType,
                    sourceName: lot.sourceName,
                    orderSn: lot.orderSn,
                    shippingOrderSn: lot.shippingOrderSn,
                    shippingMethod: lot.shippingMethod,
                    logisticsChannelName: lot.logisticsChannelName,
                    amazonSaleDate: lot.amazonSaleDate,
                    originalAmazonSaleDate: lot.originalAmazonSaleDate,
                    adjustedAmazonSaleDate: lot.adjustedAmazonSaleDate,
                    arrivalAdjusted: lot.arrivalAdjusted,
                    arrivalAdjustReason: lot.arrivalAdjustReason,
                    arrivalAdjustMethodKey: lot.arrivalAdjustMethodKey,
                    arrivalAdjustMethodLabel: lot.arrivalAdjustMethodLabel,
                    originalQuantity: lot.originalQuantity,
                    usedQuantity,
                    remainingAfterSegment: lot.remainingQuantity,
                    arrivedInSegment,
                    openingQuantity: segmentOpeningMap.get(lot.sourceKey) || 0
                });
            };
            const captureSegmentOpening = () => {
                if (!includeInventoryUsage || segmentOpeningCaptured) return;
                segmentOpeningCaptured = true;
                for (const lot of usageLots) {
                    const remaining = Math.max(0, Math.round(lot.remainingQuantity * 100) / 100);
                    if (remaining <= 0) continue;
                    segmentOpeningMap.set(lot.sourceKey, remaining);
                    if (lot.sourceType === 'fba') {
                        segmentOpeningFba += remaining;
                    } else {
                        segmentOpeningInbound += remaining;
                    }
                }
            };
            const consumeUsageLots = (dailyNeed: number, shouldRecord: boolean) => {
                if (!includeInventoryUsage || dailyNeed <= 0) return 0;
                let remainNeed = dailyNeed;
                let covered = 0;
                for (const lot of usageLots) {
                    if (remainNeed <= 0) break;
                    if (lot.remainingQuantity <= 0) continue;
                    const used = Math.min(lot.remainingQuantity, remainNeed);
                    lot.remainingQuantity = Math.max(0, Math.round((lot.remainingQuantity - used) * 100) / 100);
                    remainNeed = Math.max(0, Math.round((remainNeed - used) * 100) / 100);
                    covered += used;
                    if (shouldRecord) {
                        pushUsageSource(lot, used);
                    }
                }
                return covered;
            };

            if (baseDailySales <= 0) {
                results.push({ id, gap: 0, expectedDemand: 0, warning: '无日均销量数据' });
                continue;
            }

            const startD = dayjs(startDate).startOf('day');
            const endD = dayjs(endDate).startOf('day');
            const preArrivalStartD = preArrivalCycleStartD && preArrivalCycleStartD.isValid()
                ? preArrivalCycleStartD
                : dayjs().startOf('day');
            const preArrivalArrivalD = includePreArrivalShortage && item.preArrivalDate
                ? dayjs(item.preArrivalDate).startOf('day')
                : startD;
            const defaultPreArrivalEndD = preArrivalArrivalD.subtract(1, 'day').startOf('day');
            const itemPreArrivalEndD = includePreArrivalShortage && item.preArrivalEndDate
                ? dayjs(item.preArrivalEndDate).startOf('day')
                : defaultPreArrivalEndD;
            const preArrivalEndD = itemPreArrivalEndD.isValid() && itemPreArrivalEndD.isBefore(defaultPreArrivalEndD, 'day')
                ? itemPreArrivalEndD
                : defaultPreArrivalEndD;
            const todayD = dayjs().startOf('day');
            const pastInboundEffectiveD = adjustPastInboundToFirstArrival && item.pastInboundEffectiveDate
                ? dayjs(item.pastInboundEffectiveDate).startOf('day')
                : null;
            const getEffectiveInboundAmazonSaleDate = (shipping: any) => {
                const originalAmazonSaleDate = shipping?.amazonSaleDate || '';
                const originalD = originalAmazonSaleDate
                    ? dayjs(originalAmazonSaleDate).startOf('day')
                    : null;
                const canAdjust = Boolean(
                    adjustPastInboundToFirstArrival
                    && originalD
                    && originalD.isValid()
                    && originalD.isBefore(todayD, 'day')
                    && pastInboundEffectiveD
                    && pastInboundEffectiveD.isValid()
                );
                const effectiveD = canAdjust ? pastInboundEffectiveD : originalD;
                const effectiveAmazonSaleDate = effectiveD && effectiveD.isValid()
                    ? effectiveD.format('YYYY-MM-DD')
                    : originalAmazonSaleDate;
                return {
                    effectiveAmazonSaleDate,
                    originalAmazonSaleDate,
                    adjustedAmazonSaleDate: canAdjust ? effectiveAmazonSaleDate : '',
                    arrivalAdjusted: canAdjust,
                    arrivalAdjustReason: canAdjust ? 'past_inbound_to_first_arrival' : '',
                    arrivalAdjustMethodKey: canAdjust ? (item.pastInboundMethodKey || item.preArrivalMethodKey || '') : '',
                    arrivalAdjustMethodLabel: canAdjust ? (item.pastInboundMethodLabel || item.preArrivalMethodLabel || '') : ''
                };
            };
            const shouldTrackPreArrivalShortage = Boolean(includePreArrivalShortage)
                && preArrivalStartD.isValid()
                && preArrivalArrivalD.isValid()
                && preArrivalStartD.isBefore(preArrivalArrivalD, 'day');
            let preArrivalTotal = 0;
            let preArrivalShortageStartDate = '';
            let preArrivalShortageEndDate = '';
            let preArrivalShortageDays = 0;
            let preArrivalLastCoveredDate = '';
            const preArrivalDetails: Array<{
                date: string;
                dailyNeed: number;
                inboundQuantity: number;
                stockBeforeDemand: number;
                shortage: number;
            }> = [];
            const recordPreArrivalShortage = (detail: {
                date: string;
                dailyNeed: number;
                inboundQuantity: number;
                stockBeforeDemand: number;
                shortage: number;
            }) => {
                preArrivalTotal += detail.shortage;
                preArrivalShortageDays += 1;
                if (!preArrivalShortageStartDate) {
                    preArrivalShortageStartDate = detail.date;
                }
                preArrivalShortageEndDate = detail.date;
                preArrivalDetails.push(detail);
            };
            if (includeInventoryUsage && currentStock > 0) {
                usageLots.push({
                    sourceKey: 'fba',
                    sourceType: 'fba',
                    sourceName: 'FBA库存',
                    originalQuantity: currentStock,
                    remainingQuantity: currentStock
                });
            }

            // ========== 算法4: 收集逐月系数详情（供前端展示α和本地重算） ==========
            const monthlyCoeffDetails: Record<string, any> = {};

            // ========== 第一步：计算 expectedDemand（按月分段 + 三重 round，与前端一致）==========
            {
                let segStart = startD;
                while (segStart.isBefore(endD) || segStart.isSame(endD, 'day')) {
                    // 本段结束日 = 本月最后一天 或 用户选定的结束日（取较早者）
                    const monthEnd = segStart.endOf('month').startOf('day');
                    const segEnd = monthEnd.isBefore(endD) ? monthEnd : endD;
                    const segDays = segEnd.diff(segStart, 'day') + 1;

                    // 决定本月系数
                    const segMonthStr = segStart.format('YYYY-MM');
                    let rawCoefficient = 1;
                    let coefficient = applyVolatilityCoefficient(rawCoefficient, volatilityCoefficient);
                    const monthOverride = resolveMonthlyCoefficientOverride(
                        itemMonthlyCoefficientOverrides[segMonthStr],
                        Number(algorithm),
                        volatilityCoefficient
                    );
                    if (monthOverride) {
                        rawCoefficient = monthOverride.rawCoefficient;
                        coefficient = monthOverride.coefficient;
                        monthlyCoeffDetails[segMonthStr] = monthOverride.detail;
                    } else if (algorithm !== 1 && coeffData && coeffData.calendar_data && coeffData.calendar_data[segMonthStr]) {
                        const monthData = coeffData.calendar_data[segMonthStr];
                        if (algorithm === 2 && monthData.sales?.status === 'ok') {
                            rawCoefficient = monthData.sales.coefficient ?? 1;
                        } else if (algorithm === 3 && monthData.keywords?.status === 'ok') {
                            rawCoefficient = monthData.keywords.coefficient ?? 1;
                        } else if (algorithm === 4 && monthData.combined?.coefficient !== undefined) {
                            // α优先级已在 getCalendarCoefficients 内处理，这里再应用波动系数
                            rawCoefficient = monthData.combined.coefficient;
                        }
                        coefficient = applyVolatilityCoefficient(rawCoefficient, volatilityCoefficient);

                        // 算法4: 收集该月的详情供前端使用
                        if (algorithm === 4 && monthData.combined) {
                            monthlyCoeffDetails[segMonthStr] = {
                                alpha: monthData.combined.alpha,
                                alpha_source: monthData.combined.alpha_source,
                                alpha_reason: monthData.combined.alpha_reason,
                                alpha_reason_text: monthData.combined.alpha_reason_text,
                                system_alpha: monthData.combined.system_alpha,
                                user_alpha: monthData.combined.user_alpha,
                                raw_coefficient: rawCoefficient,
                                volatility_coefficient: volatilityCoefficient,
                                adjusted_coefficient: coefficient,
                                coefficient,
                                filled_sales_coefficient: monthData.combined.filled_sales_coefficient,
                                keyword_coefficient: monthData.combined.keyword_coefficient,
                                user_remark: monthData.combined.user_remark || null
                            };
                        }
                        // 算法2: 收集历史销量系数
                        if (algorithm === 2 && monthData.sales) {
                            monthlyCoeffDetails[segMonthStr] = {
                                raw_coefficient: rawCoefficient,
                                volatility_coefficient: volatilityCoefficient,
                                adjusted_coefficient: coefficient,
                                coefficient,
                                status: monthData.sales.status,
                                type: 'sales'
                            };
                        }
                        // 算法3: 收集搜索词系数
                        if (algorithm === 3 && monthData.keywords) {
                            monthlyCoeffDetails[segMonthStr] = {
                                raw_coefficient: rawCoefficient,
                                volatility_coefficient: volatilityCoefficient,
                                adjusted_coefficient: coefficient,
                                coefficient,
                                status: monthData.keywords.status,
                                type: 'keywords'
                            };
                        }
                    }

                    // 三重 round（与前端 Charts / Mini calculateReplenishment 完全一致）
                    const roundedCoeff = Math.round(coefficient * 100) / 100;
                    const dailyNeed = Math.round(baseDailySales * roundedCoeff * 100) / 100;
                    const subtotal = Math.round(segDays * dailyNeed);

                    expectedDemand += subtotal;
                    segStart = segEnd.add(1, 'day');
                }
            }

            // ========== 第二步：逐日模拟库存扣减，计算 gap（缺口）==========
            {
                let checkDate = dayjs().startOf('day');
                // 如果选定的开始日期在今天之前，也应当涵盖那部分（防呆）
                if (startD.isBefore(checkDate)) {
                    checkDate = startD;
                }
                if (shouldTrackPreArrivalShortage && preArrivalStartD.isBefore(checkDate, 'day')) {
                    checkDate = preArrivalStartD;
                }

                const simulationEndD = shouldTrackPreArrivalShortage && preArrivalEndD.isAfter(endD, 'day')
                    ? preArrivalEndD
                    : endD;

                while (checkDate.isBefore(simulationEndD) || checkDate.isSame(simulationEndD, 'day')) {
                    const checkDateStr = checkDate.format('YYYY-MM-DD');
                    const checkMonthStr = checkDate.format('YYYY-MM');
                    const inRange = (checkDate.isAfter(startD) || checkDate.isSame(startD, 'day'))
                        && (checkDate.isBefore(endD) || checkDate.isSame(endD, 'day'));
                    const inPreArrivalRange = shouldTrackPreArrivalShortage
                        && (checkDate.isAfter(preArrivalStartD) || checkDate.isSame(preArrivalStartD, 'day'))
                        && (checkDate.isBefore(preArrivalEndD) || checkDate.isSame(preArrivalEndD, 'day'));
                    if (includeInventoryUsage && checkDate.isSame(startD, 'day')) {
                        captureSegmentOpening();
                    }

                    // 1. 货件入库
                    let inboundQuantity = 0;
                    if (Array.isArray(fbaShippingList)) {
                        for (let shippingIndex = 0; shippingIndex < fbaShippingList.length; shippingIndex++) {
                            const shipping = fbaShippingList[shippingIndex];
                            const inboundDateInfo = getEffectiveInboundAmazonSaleDate(shipping);
                            if (inboundDateInfo.effectiveAmazonSaleDate === checkDateStr) {
                                const qty = Number(shipping.quantity) || 0;
                                currentStock += qty;
                                inboundQuantity += qty;
                                if (includeInventoryUsage && qty > 0) {
                                    if (inRange) arrivalsInSegmentForUsage += qty;
                                    const usageLot = {
                                        sourceKey: `inbound:${shipping.orderSn || shipping.shippingOrderSn || checkDateStr}:${shippingIndex}`,
                                        sourceType: 'inbound',
                                        sourceName: '在途货件',
                                        orderSn: shipping.orderSn || '',
                                        shippingOrderSn: shipping.shippingOrderSn || '',
                                        shippingMethod: shipping.shippingMethod || '',
                                        logisticsChannelName: shipping.logisticsChannelName || '',
                                        amazonSaleDate: inboundDateInfo.effectiveAmazonSaleDate || '',
                                        originalAmazonSaleDate: inboundDateInfo.originalAmazonSaleDate || '',
                                        adjustedAmazonSaleDate: inboundDateInfo.adjustedAmazonSaleDate || '',
                                        arrivalAdjusted: inboundDateInfo.arrivalAdjusted,
                                        arrivalAdjustReason: inboundDateInfo.arrivalAdjustReason,
                                        arrivalAdjustMethodKey: inboundDateInfo.arrivalAdjustMethodKey,
                                        arrivalAdjustMethodLabel: inboundDateInfo.arrivalAdjustMethodLabel,
                                        originalQuantity: qty,
                                        remainingQuantity: qty
                                    } as InventorySourceLot;
                                    usageLots.push(usageLot);
                                    if (inRange) {
                                        pushUsageSource(usageLot, 0, true);
                                    }
                                }
                            }
                        }
                    }

                    // 2. 决定系数（同样使用三重 round 中的 dailyNeed 作为扣减量）
                    let rawCoefficient = 1;
                    let coefficient = applyVolatilityCoefficient(rawCoefficient, volatilityCoefficient);
                    const monthOverride = resolveMonthlyCoefficientOverride(
                        itemMonthlyCoefficientOverrides[checkMonthStr],
                        Number(algorithm),
                        volatilityCoefficient
                    );
                    if (monthOverride) {
                        rawCoefficient = monthOverride.rawCoefficient;
                        coefficient = monthOverride.coefficient;
                        if (!monthlyCoeffDetails[checkMonthStr]) {
                            monthlyCoeffDetails[checkMonthStr] = monthOverride.detail;
                        }
                    } else if (algorithm !== 1 && coeffData && coeffData.calendar_data && coeffData.calendar_data[checkMonthStr]) {
                        const monthData = coeffData.calendar_data[checkMonthStr];
                        if (algorithm === 2 && monthData.sales?.status === 'ok') {
                            rawCoefficient = monthData.sales.coefficient ?? 1;
                        } else if (algorithm === 3 && monthData.keywords?.status === 'ok') {
                            rawCoefficient = monthData.keywords.coefficient ?? 1;
                        } else if (algorithm === 4 && monthData.combined?.coefficient !== undefined) {
                            // α优先级已在 getCalendarCoefficients 内处理，这里再应用波动系数
                            rawCoefficient = monthData.combined.coefficient;
                        }
                        coefficient = applyVolatilityCoefficient(rawCoefficient, volatilityCoefficient);
                    }

                    // 3. 使用与 expectedDemand 一致的 dailyNeed 进行库存扣减
                    const roundedCoeff = Math.round(coefficient * 100) / 100;
                    const dailyNeed = Math.round(baseDailySales * roundedCoeff * 100) / 100;

                    // 只有进入选定的时间范围才统计缺口
                    const stockBeforeDemand = currentStock;
                    if (includeInventoryUsage) {
                        consumeUsageLots(dailyNeed, inRange);
                    }

                    currentStock -= dailyNeed;

                    if (currentStock < 0) {
                        if (inRange) {
                            const dayShortage = Math.abs(currentStock);
                            const shortageDetail = {
                                date: checkDateStr,
                                dailyNeed,
                                inboundQuantity,
                                stockBeforeDemand,
                                shortage: dayShortage
                            };
                            totalGap += dayShortage;
                            shortageDays += 1;
                            if (!shortageStartDate) {
                                shortageStartDate = checkDateStr;
                            }
                            shortageEndDate = checkDateStr;

                            const lastRange = shortageRanges[shortageRanges.length - 1];
                            const isContinuous = lastRange
                                && dayjs(lastRange.endDate).add(1, 'day').format('YYYY-MM-DD') === checkDateStr;
                            if (isContinuous) {
                                lastRange.endDate = checkDateStr;
                                lastRange.days += 1;
                                lastRange.quantity += dayShortage;
                                lastRange.details.push(shortageDetail);
                            } else {
                                shortageRanges.push({
                                    startDate: checkDateStr,
                                    endDate: checkDateStr,
                                    days: 1,
                                    quantity: dayShortage,
                                    details: [shortageDetail]
                                });
                            }
                        }
                        if (!inRange && inPreArrivalRange) {
                            recordPreArrivalShortage({
                                date: checkDateStr,
                                dailyNeed,
                                inboundQuantity,
                                stockBeforeDemand,
                                shortage: Math.abs(currentStock)
                            });
                        }
                        currentStock = 0;
                    } else if (!inRange && inPreArrivalRange && preArrivalShortageDays === 0) {
                        preArrivalLastCoveredDate = checkDateStr;
                    }

                    checkDate = checkDate.add(1, 'day');
                }
            }

            const usageSources = Array.from(usageSourceMap.values())
                .filter(source => source.usedQuantity > 0 || source.arrivedInSegment)
                .map(source => ({
                    sourceType: source.sourceType,
                    sourceName: source.sourceName,
                    orderSn: source.orderSn || '',
                    shippingOrderSn: source.shippingOrderSn || '',
                    shippingMethod: source.shippingMethod || '',
                    logisticsChannelName: source.logisticsChannelName || '',
                    amazonSaleDate: source.amazonSaleDate || '',
                    originalAmazonSaleDate: source.originalAmazonSaleDate || '',
                    adjustedAmazonSaleDate: source.adjustedAmazonSaleDate || '',
                    arrivalAdjusted: Boolean(source.arrivalAdjusted),
                    arrivalAdjustReason: source.arrivalAdjustReason || '',
                    arrivalAdjustMethodKey: source.arrivalAdjustMethodKey || '',
                    arrivalAdjustMethodLabel: source.arrivalAdjustMethodLabel || '',
                    originalQuantity: Math.round(source.originalQuantity),
                    openingQuantity: Math.round(source.openingQuantity || 0),
                    usedQuantity: Math.round(source.usedQuantity),
                    remainingAfterSegment: Math.max(0, Math.round(source.remainingAfterSegment)),
                    arrivedInSegment: Boolean(source.arrivedInSegment),
                    arrivalRelation: source.sourceType === 'fba'
                        ? 'initial'
                        : source.arrivedInSegment
                            ? 'in_segment'
                            : 'before_segment',
                    arrivalRelationText: source.sourceType === 'fba'
                        ? '初始库存'
                        : source.arrivalAdjusted
                            ? `过期预计可售并入${source.arrivalAdjustMethodLabel || '首个运输'}段`
                            : source.arrivedInSegment
                            ? '本段到货'
                            : '段前到货'
                }));
            const usedFromFbaForUsage = usageSources
                .filter(source => source.sourceType === 'fba')
                .reduce((sum, source) => sum + source.usedQuantity, 0);
            const usedFromInboundForUsage = usageSources
                .filter(source => source.sourceType === 'inbound')
                .reduce((sum, source) => sum + source.usedQuantity, 0);
            const preArrivalShortagePayload = shouldTrackPreArrivalShortage
                ? {
                    preArrivalShortage: {
                        startDate: preArrivalStartD.format('YYYY-MM-DD'),
                        endDate: preArrivalEndD.format('YYYY-MM-DD'),
                        fastestArrivalDate: preArrivalArrivalD.format('YYYY-MM-DD'),
                        fastestArrivalMethodKey: item.preArrivalMethodKey || '',
                        fastestArrivalMethodLabel: item.preArrivalMethodLabel || '',
                        total: Math.round(preArrivalTotal),
                        shortageStartDate: preArrivalShortageStartDate || null,
                        shortageEndDate: preArrivalShortageEndDate || null,
                        shortageDays: preArrivalShortageDays,
                        lastCoveredDate: preArrivalLastCoveredDate || null,
                        details: preArrivalDetails.map(detail => ({
                            ...detail,
                            dailyNeed: Math.round(detail.dailyNeed * 100) / 100,
                            inboundQuantity: Math.round(detail.inboundQuantity),
                            stockBeforeDemand: Math.round(detail.stockBeforeDemand * 100) / 100,
                            shortage: Math.round(detail.shortage * 100) / 100
                        }))
                    }
                }
                : {};

            results.push({
                id,
                gap: Math.round(totalGap),
                expectedDemand,
                volatilityCoefficient,
                volatility_coefficient: volatilityCoefficient,
                shortageStartDate: shortageStartDate || null,
                shortageEndDate: shortageEndDate || null,
                shortageDays,
                shortageDemand: Math.round(totalGap),
                shortageRanges: shortageRanges.map(range => ({
                    ...range,
                    quantity: Math.round(range.quantity),
                    details: range.details.map(detail => ({
                        ...detail,
                        dailyNeed: Math.round(detail.dailyNeed * 100) / 100,
                        inboundQuantity: Math.round(detail.inboundQuantity),
                        stockBeforeDemand: Math.round(detail.stockBeforeDemand * 100) / 100,
                        shortage: Math.round(detail.shortage)
                    }))
                })),
                // 所有算法: 附带逐月系数详情（供前端展示和本地重算）
                ...(Object.keys(monthlyCoeffDetails).length > 0
                    ? { monthlyCoefficients: monthlyCoeffDetails }
                    : {}),
                ...preArrivalShortagePayload,
                ...(includeInventoryUsage
                    ? {
                        inventoryUsage: {
                            segmentStartDate: startDate,
                            segmentEndDate: endDate,
                            segmentDemand: expectedDemand,
                            openingFba: Math.round(segmentOpeningFba),
                            openingInbound: Math.round(segmentOpeningInbound),
                            openingAvailable: Math.round(segmentOpeningFba + segmentOpeningInbound),
                            covered: Math.round(usedFromFbaForUsage + usedFromInboundForUsage),
                            shortage: Math.round(totalGap),
                            arrivalsInSegment: Math.round(arrivalsInSegmentForUsage),
                            usedFromFba: usedFromFbaForUsage,
                            usedFromInbound: usedFromInboundForUsage,
                            sources: usageSources
                        }
                    }
                    : {})
            });
        }

        return results;
    }


    /**
     * 保存采购单（主表 + 子表）
     */
    private async saveOrder(orderData: any, planSnMap: Map<string, number>): Promise<string[]> {
        const touchedPlanSns = new Set<string>();
        // 1. 保存/更新主表
        let order = await this.orderRepo.findOne({ where: { order_sn: orderData.order_sn } });

        if (!order) {
            order = new AppAmzBsrPurchaseOrderSyncLingxingEntity();
            order.order_sn = orderData.order_sn;
        }

        // 填充API字段
        order.custom_order_sn = orderData.custom_order_sn;
        order.supplier_id = orderData.supplier_id;
        order.supplier_name = orderData.supplier_name;
        order.wid = orderData.wid;
        order.ware_house_name = orderData.ware_house_name;
        order.ware_house_bak_name = orderData.ware_house_bak_name;
        order.status = orderData.status;
        order.status_text = orderData.status_text;
        order.status_shipped = orderData.status_shipped;
        order.status_shipped_text = orderData.status_shipped_text;
        order.pay_status = orderData.pay_status;
        order.pay_status_text = orderData.pay_status_text;
        order.quantity_total = orderData.quantity_total;
        order.quantity_entry = orderData.quantity_entry;
        order.quantity_real = orderData.quantity_real;
        order.quantity_receive = orderData.quantity_receive;
        order.amount_total = parseFloat(orderData.amount_total) || 0;
        order.total_price = parseFloat(orderData.total_price) || 0;
        order.shipping_price = parseFloat(orderData.shipping_price) || 0;
        order.other_fee = parseFloat(orderData.other_fee) || 0;
        order.payment = parseFloat(orderData.payment) || 0;
        order.purchase_currency = orderData.purchase_currency;
        order.purchase_rate = parseFloat(orderData.purchase_rate) || 1;
        order.shipping_currency = orderData.shipping_currency;
        order.other_currency = orderData.other_currency;
        order.icon = orderData.icon;
        order.opt_uid = orderData.opt_uid;
        order.opt_realname = orderData.opt_realname;
        order.auditor_uid = orderData.auditor_uid;
        order.auditor_realname = orderData.auditor_realname;
        order.last_uid = orderData.last_uid;
        order.last_realname = orderData.last_realname;
        order.principal_uids = orderData.principal_uids;
        order.create_time_remote = orderData.create_time ? new Date(orderData.create_time) : null;
        order.order_time = orderData.order_time ? new Date(orderData.order_time) : null;
        order.auditor_time = orderData.auditor_time ? new Date(orderData.auditor_time) : null;
        order.last_time = orderData.last_time ? new Date(orderData.last_time) : null;
        order.update_time_remote = orderData.update_time ? new Date(orderData.update_time) : null;
        order.purchaser_id = orderData.purchaser_id;
        order.contact_person = orderData.contact_person;
        order.contact_number = orderData.contact_number;
        order.settlement_method = orderData.settlement_method;
        order.settlement_description = orderData.settlement_description;
        order.payment_method = orderData.payment_method;
        order.is_tax = orderData.is_tax;
        order.fee_part_type = orderData.fee_part_type;
        order.reason = orderData.reason;
        order.remark = orderData.remark;
        order.purchase_type = orderData.purchase_type;
        order.purchase_type_text = orderData.purchase_type_text;
        order.alibaba_order_sn = orderData.alibaba_order_sn;
        order.sub_status = orderData.sub_status;
        order.sub_status_text = orderData.sub_status_text;
        order.custom_fields = orderData.custom_fields;
        order.logistics_info = orderData.logistics_info;

        // 本地管理字段
        order.is_deleted_remote = 0;
        order.sync_time = new Date();
        order.raw_data = orderData;

        await this.orderRepo.save(order);

        // 2. 删除旧的子项，重新插入
        await this.orderItemRepo.delete({ order_sn: orderData.order_sn });

        // 3. 保存子项
        const items = orderData.item_list || [];
        for (const itemData of items) {
            const item = new AppAmzBsrPurchaseOrderItemSyncLingxingEntity();
            item.order_sn = orderData.order_sn;
            item.item_id = itemData.id;
            item.plan_sn = itemData.plan_sn || null;
            if (item.plan_sn) {
                touchedPlanSns.add(this.normalizeText(item.plan_sn));
            }
            item.relation_purchase_plan = itemData.relation_purchase_plan;
            item.product_id = itemData.product_id;
            item.product_name = itemData.product_name;
            item.sku = itemData.sku;
            item.fnsku = itemData.fnsku;
            item.msku = itemData.msku;
            // 从 msku JSON 数组中提取第一个值存入 first_msku（用于快速连表 Listing，避免运行时 JSON 解析）
            if (Array.isArray(itemData.msku) && itemData.msku.length > 0 && itemData.msku[0]) {
                item.first_msku = String(itemData.msku[0]).trim();
            } else {
                item.first_msku = null;
            }
            item.model = itemData.model;
            item.spu = itemData.spu;
            item.spu_name = itemData.spu_name;
            item.attribute = itemData.attribute;
            item.wid = itemData.wid;
            item.ware_house_name = itemData.ware_house_name;
            item.sid = itemData.sid;
            item.price = parseFloat(itemData.price) || 0;
            item.amount = parseFloat(itemData.amount) || 0;
            item.tax_rate = itemData.tax_rate;
            item.quantity_plan = itemData.quantity_plan;
            item.quantity_real = itemData.quantity_real;
            item.quantity_entry = itemData.quantity_entry;
            item.quantity_receive = itemData.quantity_receive;
            item.quantity_return = itemData.quantity_return;
            item.quantity_exchange = itemData.quantity_exchange;
            item.quantity_qc = itemData.quantity_qc;
            item.quantity_qc_prepare = itemData.quantity_qc_prepare;
            item.cases_num = itemData.cases_num;
            item.quantity_per_case = itemData.quantity_per_case;
            item.expect_arrive_time = itemData.expect_arrive_time ? new Date(itemData.expect_arrive_time) : null;
            item.remark = itemData.remark;
            item.is_delete = itemData.is_delete || 0;
            item.custom_fields = itemData.custom_fields;

            // 本地管理字段：关联 analysis_record + 检查数据一致性
            // 只认 status=1（已完结）的分析记录，其他状态一律视为异常
            if (item.plan_sn) {
                if (planSnMap.has(item.plan_sn)) {
                    // 正常：有已完结的分析记录
                    item.analysis_record_id = planSnMap.get(item.plan_sn);
                    item.is_analysis_missing = 0;
                } else {
                    // 异常：没有已完结的分析记录（可能被删除、过期、或从未完结）
                    item.analysis_record_id = null;
                    item.is_analysis_missing = 1;
                    console.log(`[saveOrder] ⚠️ 子项 plan_sn=${item.plan_sn} 无已完结的分析记录`);
                }
            } else {
                item.is_analysis_missing = 0;
            }

            // ========== 新增：如果有 plan_sn，获取采购计划信息 ==========
            if (item.plan_sn) {
                const planInfo = await this.getPurchasePlanInfo(item.plan_sn);
                if (planInfo) {
                    item.plan_pic_url = planInfo.pic_url;
                    item.plan_creator_name = planInfo.creator_real_name;
                    item.plan_create_time = planInfo.create_time_remote;
                    item.plan_supplier_name = planInfo.supplier_name;
                    item.plan_warehouse_name = planInfo.warehouse_name;
                    item.plan_seller_name = planInfo.seller_name;
                    item.plan_marketplace = planInfo.marketplace;
                }
            }

            await this.orderItemRepo.save(item);
        }
        return Array.from(touchedPlanSns).filter(Boolean);
    }
    /**
     * 获取产品视图的店铺选项下拉列表
     */
    async getShopList(): Promise<string[]> {
        const qb = this.orderItemRepo.createQueryBuilder('i');

        // 走和产品视图一样的联表逻辑
        qb.leftJoin(
            AppAmzBsrAnalysisRecordLingxingEntity,
            'a',
            'i.analysis_record_id = a.id'
        );
        qb.leftJoin(
            AppAmzBsrProductListingLingxingEntity,
            'l',
            '(a.id IS NOT NULL AND l.asin = a.asin AND l.marketplace = a.marketplace AND l.store_id = a.store_id) OR (a.id IS NULL AND i.msku IS NOT NULL AND JSON_LENGTH(i.msku) > 0 AND l.msku = JSON_UNQUOTE(JSON_EXTRACT(i.msku, "$[0]")) AND l.store_id = i.sid)'
        );

        // 仅提取匹配到 Listing 的店铺名称
        qb.andWhere('l.id IS NOT NULL');

        qb.select('DISTINCT l.shop', 'shop')
            .where('l.shop IS NOT NULL')
            .andWhere('l.shop != ""')
            .orderBy('l.shop', 'ASC');

        const list = await qb.getRawMany();
        return list.map(item => item.shop);
    }

    /**
     * 获取领星真实发货仓库列表（按类型分组）
     * 1: 本地仓, 3: 海外仓, 6: AWD仓
     */
    async getWarehouseList() {
        try {
            const types = [
                { type: 1, key: 'local' },
                { type: 3, key: 'overseas' },
                { type: 6, key: 'awd' }
            ];

            const groupedList: Record<string, any[]> = {
                local: [],
                overseas: [],
                awd: []
            };

            for (const t of types) {
                const res = await this.lingxingUtils.httpPost(
                    '/erp/sc/data/local_inventory/warehouse',
                    { type: t.type, offset: 0, length: 1000 }
                );

                groupedList[t.key] = (Array.isArray(res) ? res : []).map((item: any) => ({
                    wid: item.wid,
                    name: item.name,
                    raw_data: item
                }));

                // 强制等待 500 毫秒，防止并发请求触发领星"new requests too frequently"报错（令牌桶限制）
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            return groupedList;
        } catch (error) {
            // Add a fallback logging if logger is not available or lingxingUtils failed
            console.error('获取领星发货仓库列表失败', error);
            return { local: [], overseas: [], awd: [] };
        }
    }

    /**
     * 创建FBA发货计划（按运输方式分组，逐组调用领星API）
     * 每组对应一次 createShipmentPlan 调用，组间加延迟防止限流
     */
    async createShipmentPlan(params: {
        groups: Array<{
            methodKey: string;
            remark: string;
            product_list: Array<{
                sid: number;
                packing_type: number;
                shipment_time: string;
                msku: string;
                fnsku: string;
                shipment_plan_quantity: number;
                wid: number;
                remark: string;
                purchase_plan_sn: string;
                purchase_order_sn?: string;
            }>;
        }>;
    }) {
        const results: Array<{
            methodKey: string;
            success: boolean;
            seq?: string;
            order_sn?: string[];
            error?: string;
            local_sync_success?: boolean;
            local_sync_error?: string;
        }> = [];
        const localCreator = this.getCurrentAdminUser();

        // 【后端防重】校验每组内 MSKU 不允许重复
        for (const group of params.groups) {
            const mskuSet = new Set<string>();
            for (const p of group.product_list) {
                const msku = (p.msku || '').trim();
                if (msku && mskuSet.has(msku)) {
                    throw new Error(`[${group.methodKey}] 组中存在重复MSKU: ${msku}，同一运输方式下同一商品只能提交一次`);
                }
                if (msku) mskuSet.add(msku);
            }
        }

        for (let i = 0; i < params.groups.length; i++) {
            const group = params.groups[i];

            try {
                const payload = {
                    remark: (group.remark || '').trim(),
                    product_list: group.product_list.map((p: any) => {
                        const row: any = {
                            sid: Number(p.sid) || 0,
                            packing_type: Number(p.packing_type) || 1,
                            shipment_time: (p.shipment_time || '').trim(),
                            msku: (p.msku || '').trim(),
                            fnsku: (p.fnsku || '').trim(),
                            shipment_plan_quantity: Number(p.shipment_plan_quantity) || 0,
                            wid: Number(p.wid) || 0,
                            remark: (p.remark || '').trim(),
                            purchase_plan_sn: (p.purchase_plan_sn || '').trim()
                        };
                        if (p.quantity_in_case !== undefined && p.quantity_in_case !== null && p.quantity_in_case !== '') {
                            row.quantity_in_case = Number(p.quantity_in_case) || 0;
                        }
                        if (p.box_num !== undefined && p.box_num !== null && p.box_num !== '') {
                            row.box_num = Number(p.box_num) || 0;
                        }
                        if (p.logistics_provider_id !== undefined && p.logistics_provider_id !== null && p.logistics_provider_id !== '') {
                            row.logistics_provider_id = Number(p.logistics_provider_id) || 0;
                        }
                        if (p.logistics_channel_id !== undefined && p.logistics_channel_id !== null && p.logistics_channel_id !== '') {
                            row.logistics_channel_id = Number(p.logistics_channel_id) || 0;
                        }
                        return row;
                    })
                };

                console.log(`[createShipmentPlan] 正在提交 ${group.methodKey} 分组，共 ${group.product_list.length} 条商品`);

                const resp: any = await this.lingxingUtils.httpPost(
                    '/erp/sc/routing/storage/shipment/createShipmentPlan',
                    payload,
                    true // return_raw_response: 拿到完整响应以检查 code
                );

                console.log(`[createShipmentPlan] ${group.methodKey} 响应:`, JSON.stringify(resp));

                // resp 就是领星的完整响应 body: {code, message, data, error_details, ...}
                // resp.data 是业务数据: {seq, order_sn}

                // 领星 API: code=0 表示成功，其他表示失败
                if (resp?.code !== undefined && Number(resp.code) !== 0) {
                    const errMsg = resp.error_details?.join('; ') || resp.message || '领星接口返回错误';
                    results.push({
                        methodKey: group.methodKey,
                        success: false,
                        error: `[code:${resp.code}] ${errMsg}`
                    });
                } else {
                    const data = resp?.data || {};
                    const successResult = {
                        methodKey: group.methodKey,
                        success: true,
                        seq: data?.seq || '',
                        order_sn: data?.order_sn || [],
                        local_sync_success: false,
                        local_sync_error: ''
                    };
                    results.push(successResult);

                    // 创建成功后，立刻通过批次号查询领星，将发货计划明细入库
                    if (successResult.seq) {
                        try {
                            // 构建映射: msku -> purchase_plan_sn / purchase_order_sn
                            const planSnMap = new Map<string, string>();
                            const orderSnMap = new Map<string, string>();
                            for (const p of group.product_list) {
                                if (p.msku) {
                                    if (p.purchase_plan_sn) planSnMap.set(p.msku, p.purchase_plan_sn);
                                    if (p.purchase_order_sn) orderSnMap.set(p.msku, p.purchase_order_sn);
                                }
                            }

                            await this.syncShipmentPlansBySeq(
                                successResult.seq,
                                group.methodKey,
                                planSnMap,
                                orderSnMap,
                                localCreator
                            );
                            successResult.local_sync_success = true;
                            console.log(`[createShipmentPlan] ${group.methodKey} 发货计划已自动入库 (seq=${successResult.seq})`);
                        } catch (syncErr: any) {
                            successResult.local_sync_success = false;
                            successResult.local_sync_error = syncErr?.message || '本地发货计划同步失败';
                            console.error(`[createShipmentPlan] 自动入库失败(不影响发货成功):`, syncErr?.message);
                        }
                    } else {
                        successResult.local_sync_success = false;
                        successResult.local_sync_error = '领星未返回批次号，无法同步本地发货计划';
                    }
                }
            } catch (error: any) {
                console.error(`[createShipmentPlan] ${group.methodKey} 提交失败:`, error);

                results.push({
                    methodKey: group.methodKey,
                    success: false,
                    error: error?.message || error?.toString() || '未知错误'
                });
            }

            // 组间延迟 500ms，防止领星限流
            if (i < params.groups.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }

        return results;
    }

    /**
     * 产品视图 - 分页查询 (新增)
     */
    async getProductViewPage(query: any): Promise<{ list: any[]; pagination: any }> {
        const { page = 1, size = 20, status, status_shipped, pay_status, keyWord, startDate, endDate, logistics_status, overtime_days } = query;
        const pageNo = Math.max(1, Number(page) || 1);
        const sizeNo = Math.max(1, Number(size) || 20);
        const skip = (pageNo - 1) * sizeNo;

        const qb = this.orderItemRepo.createQueryBuilder('i');

        // 1. 关联父表 (purchase_order)
        qb.leftJoinAndMapOne(
            'i.parent',
            AppAmzBsrPurchaseOrderSyncLingxingEntity,
            'p',
            'p.order_sn = i.order_sn'
        );

        // 2. 关联分析记录表 (analysis_record)
        qb.leftJoinAndMapOne(
            'i.analysis',
            AppAmzBsrAnalysisRecordLingxingEntity,
            'a',
            'i.analysis_record_id = a.id'
        );

        // 3a. 关联 Listing 路径1：有推演记录 → 走 asin+msku 精确匹配
        //     向后兼容：老分析记录 a.msku 可能为 NULL，此时不加 msku 限制
        qb.leftJoinAndMapOne(
            'i.listing',
            AppAmzBsrProductListingLingxingEntity,
            'l1',
            'a.id IS NOT NULL AND l1.asin = a.asin AND l1.marketplace = a.marketplace AND l1.store_id = a.store_id AND (a.msku IS NULL OR l1.msku = a.msku)'
        );

        // 3b. 关联 Listing 路径2：没推演记录 → 走 first_msku 匹配
        qb.leftJoinAndMapOne(
            'i.listing2',
            AppAmzBsrProductListingLingxingEntity,
            'l2',
            'a.id IS NULL AND i.first_msku IS NOT NULL AND l2.msku = i.first_msku AND l2.store_id = i.sid'
        );

        // 4. 关联 Restocking (通过匹配上的 listing 的 asin 和 marketplace)
        qb.leftJoinAndMapOne(
            'i.restocking',
            AppAmzBsrRestockingCenterLingxingEntity,
            'r',
            `COALESCE(l1.asin, l2.asin) = r.asin AND JSON_CONTAINS(r.marketplaceList, CONCAT('"', COALESCE(l1.marketplace, l2.marketplace), '"'))`
        );

        // 5. 视图区分控制（三级漏斗：产品视图 / 暂无链接视图 / 未匹配产品视图）
        const is_no_link = query.is_no_link;
        if (is_no_link === 1 || is_no_link === '1') {
            // [1] 暂无链接单据：无分析记录，且连 MSKU 都没有
            qb.andWhere('(a.id IS NULL AND (i.first_msku IS NULL))');
        } else if (is_no_link === 2 || is_no_link === '2') {
            // [2] 信息未匹配单据：(无推演记录且填了MSKU但找不到Listing) OR (有推演记录但精准匹配不到Listing)
            qb.andWhere('((a.id IS NULL AND i.first_msku IS NOT NULL AND l2.id IS NULL) OR (a.id IS NOT NULL AND l1.id IS NULL))');
        } else if (is_no_link === 0 || is_no_link === '0') {
            // [0] 纯净产品视图：有分析记录，或者（填了 MSKU 且成功匹配上了 Listing）
            qb.andWhere('(l1.id IS NOT NULL OR l2.id IS NOT NULL)');
        }

        // 筛选条件 (针对父表 p) —— 前端传数组，空数组=全部
        if (Array.isArray(status) && status.length > 0) {
            qb.andWhere('p.status IN (:...status)', { status: status.map(Number) });
        }

        if (status_shipped !== undefined && status_shipped !== null && status_shipped !== '') {
            qb.andWhere('p.status_shipped = :status_shipped', { status_shipped });
        }

        if (pay_status !== undefined && pay_status !== null && pay_status !== '') {
            qb.andWhere('p.pay_status = :pay_status', { pay_status });
        }

        if (startDate) {
            qb.andWhere('p.order_time >= :startDate', { startDate });
        }
        if (endDate) {
            qb.andWhere('p.order_time <= :endDate', { endDate });
        }

        // 店铺筛选 (针对产品视图的 listing 表，l1 或 l2 任一匹配即可)
        const shopName = query.shopName;
        if (shopName) {
            qb.andWhere('(l1.shop = :shopName OR l2.shop = :shopName)', { shopName });
        }

        // 关键字搜索：根据 searchType 精确匹配单个字段
        const searchType = query.searchType;
        if (keyWord) {
            if (searchType === 'order_sn') {
                qb.andWhere('p.order_sn LIKE :keyWord', { keyWord: `%${keyWord}%` });
            } else if (searchType === 'plan_sn') {
                qb.andWhere('i.plan_sn LIKE :keyWord', { keyWord: `%${keyWord}%` });
            } else if (searchType === 'asin') {
                qb.andWhere('(COALESCE(l1.asin, l2.asin) LIKE :keyWord OR a.asin LIKE :keyWord)', { keyWord: `%${keyWord}%` });
            } else {
                // 兼容旧逻辑
                qb.andWhere(new Brackets(qb => {
                    qb.where('i.sku LIKE :keyWord', { keyWord: `%${keyWord}%` })
                        .orWhere('i.product_name LIKE :keyWord', { keyWord: `%${keyWord}%` })
                        .orWhere('i.plan_sn LIKE :keyWord', { keyWord: `%${keyWord}%` })
                        .orWhere('p.order_sn LIKE :keyWord', { keyWord: `%${keyWord}%` })
                        .orWhere('p.supplier_name LIKE :keyWord', { keyWord: `%${keyWord}%` });
                }));
            }
        }

        // ========== 物流状态筛选 ==========
        const overtimeDaysNum = Number(overtime_days) || 7;
        if (logistics_status) {
            this.purchaseOrderLogisticsService.applyOrderStatusFilter(qb, logistics_status, overtimeDaysNum, 'p');
        }

        // 排序逻辑支持
        const { prop, order } = query;
        const sortOrder = String(order || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

        // 核心修复: 排序值必须和前端显示值一致
        // 前端 getFbaInventoryQuantity = sum(fbaValidList[*].quantity)  ← 用总库存
        // 前端 getRestockingFbaShippingQuantity = sum(fbaShippingList[*].quantity)
        // 前端 本地 = r.scmQuantityInfo.scQuantityLocalValid
        if (prop === 'afn_fulfillable_quantity') {
            qb.addSelect(`COALESCE((SELECT SUM(CAST(jt.v AS UNSIGNED)) FROM JSON_TABLE(r.fbaValidList, '$[*]' COLUMNS(v INT PATH '$.quantity')) jt), 0)`, 'sort_val')
                .orderBy('sort_val', sortOrder)
                .addOrderBy('p.order_time', 'DESC')
                .addOrderBy('i.id', 'ASC');
        } else if (prop === 'restocking_fba_shipping') {
            qb.addSelect(`COALESCE((SELECT SUM(CAST(jt.v AS UNSIGNED)) FROM JSON_TABLE(r.fbaShippingList, '$[*]' COLUMNS(v INT PATH '$.quantity')) jt), 0)`, 'sort_val')
                .orderBy('sort_val', sortOrder)
                .addOrderBy('p.order_time', 'DESC')
                .addOrderBy('i.id', 'ASC');
        } else if (prop === 'restocking_local_valid') {
            qb.addSelect(`COALESCE((SELECT SUM(CAST(jt.v AS UNSIGNED)) FROM JSON_TABLE(r.extInfo, '$.localValidDetailList[*]' COLUMNS(v INT PATH '$.quantityValid')) jt), 0)`, 'sort_val')
                .orderBy('sort_val', sortOrder)
                .addOrderBy('p.order_time', 'DESC')
                .addOrderBy('i.id', 'ASC');
        } else {
            qb.orderBy('p.order_time', 'DESC')
                .addOrderBy('i.id', 'ASC');
        }

        qb.skip(skip).take(sizeNo);

        const [list, total] = await qb.getManyAndCount();

        // Logic Injection: 合并双轨 Listing (l1/l2) 并调用 LingXingUtils 计算衍生字段
        for (const item of list as any[]) {
            // == 计算并在子项上注入 link_status ==
            let linkStatus = 'normal';
            if (!item.first_msku && !item.listing && !(item as any).listing2) {
                linkStatus = 'no_link'; // [暂无链接] 没有MSKU，也没有任何关联Listing
            } else if (item.first_msku && !item.listing && !(item as any).listing2) {
                linkStatus = 'unmatched'; // [信息未匹配] 有MSKU，但是在系统里找不到对应的Listing
            }
            item.link_status = linkStatus;

            // 双轨合并：l1(推演路径) 优先，l2(MSKU路径) 兜底
            const mergedListing = item.listing || (item as any).listing2 || null;
            if ((item as any).listing2 && !item.listing) {
                item.listing = (item as any).listing2;
            }
            delete (item as any).listing2;

            // 确保 listing 和 restocking 存在
            if (item.listing && item.restocking) {
                // 1. 计算库存状态 (日均销量, 可售天数, 库存状态文本, 断货, 货件断层标记)
                // 注意：此方法会直接修改 listing 和 restocking 对象
                this.lingxingUtils.updateInventoryStatus(item.listing, item.restocking);

                // 2. 计算产品状态标签 (新品, 流量, 销量变化等)
                const statusSplit = this.lingxingUtils.judgeProductStatusSplit(item.listing, item.restocking);

                // 将计算出的状态合并回 listing 对象，方便前端直接使用
                Object.assign(item.listing, statusSplit);
            }

            // 图片兜底逻辑：如果 Listing 没图，尝试用 Plan 的图
            if (!item.listing?.image_url && item.plan_pic_url) {
                if (!item.listing) item.listing = {};
                item.listing.image_url = item.plan_pic_url;
            }
        }

        // ========== 批量计算物流状态 ==========
        const parentOrderMap = new Map<string, any>();
        (list as any[]).forEach(item => {
            const parent = (item as any).parent;
            if (parent?.order_sn) parentOrderMap.set(parent.order_sn, parent);
        });
        if (parentOrderMap.size > 0) {
            await this.purchaseOrderLogisticsService.attachStatusesToOrders(
                [...parentOrderMap.values()],
                { overtimeDays: overtimeDaysNum }
            );
            (list as any[]).forEach(item => {
                const parent = (item as any).parent;
                if (!parent) return;
                (item as any).logistics_status = parent.logistics_status;
                (item as any).logistics_status_text = parent.logistics_status_text;
                (item as any).logistics_status_reason = parent.logistics_status_reason;
                (item as any).logistics_pkg_count = parent.logistics_pkg_count;
                (item as any).logistics_signed_count = parent.logistics_signed_count;
                (item as any).logistics_packages = parent.logistics_packages || [];
            });
        }

        return {
            list,
            pagination: {
                page: pageNo,
                size: sizeNo,
                total
            }
        };
    }



    /**
     * 获取采购单详情（含子项）
     */
    async getOrderDetail(order_sn: string): Promise<any> {
        const order = await this.orderRepo.findOne({ where: { order_sn } });
        if (!order) return null;

        const items = await this.orderItemRepo.find({
            where: { order_sn },
            order: { id: 'ASC' }
        });

        // 获取关联的分析记录信息
        const itemsWithRecord = await Promise.all(items.map(async (item) => {
            let analysisRecord = null;
            if (item.analysis_record_id) {
                analysisRecord = await this.analysisRecordRepo.findOne({
                    where: { id: item.analysis_record_id },
                    select: ['id', 'asin', 'msku', 'store_id', 'marketplace', 'expected_sales', 'remark']
                });
            }
            return { ...item, analysisRecord };
        }));

        return {
            ...order,
            items: itemsWithRecord
        };
    }

    /**
     * 
     */
    async getOrderItemsPage(order_sn: string, page = 1, size = 20, keyWord?: string): Promise<{ list: any[]; pagination: any }> {
        const pageNo = Math.max(1, Number(page) || 1);
        const sizeNo = Math.max(1, Number(size) || 20);

        if (!order_sn) {
            return {
                list: [],
                pagination: { page: pageNo, size: sizeNo, total: 0 }
            };
        }

        const skip = (pageNo - 1) * sizeNo;
        const qb = this.orderItemRepo.createQueryBuilder('i')
            .where('i.order_sn = :order_sn', { order_sn });

        // 1. 关联分析记录表 (analysis_record)
        qb.leftJoinAndMapOne(
            'i.analysis',
            AppAmzBsrAnalysisRecordLingxingEntity,
            'a',
            'i.analysis_record_id = a.id'
        );

        // 2. 关联 Listing (双轨制：优先推演表，否则MSKU)
        //    向后兼容：老分析记录 a.msku 可能为 NULL，此时不加 msku 限制
        qb.leftJoinAndMapOne(
            'i.listing',
            AppAmzBsrProductListingLingxingEntity,
            'l',
            '(a.id IS NOT NULL AND l.asin = a.asin AND l.marketplace = a.marketplace AND l.store_id = a.store_id AND (a.msku IS NULL OR l.msku = a.msku)) OR (a.id IS NULL AND i.msku IS NOT NULL AND JSON_LENGTH(i.msku) > 0 AND l.msku = JSON_UNQUOTE(JSON_EXTRACT(i.msku, "$[0]")) AND l.store_id = i.sid)'
        );

        // 3. 关联 Restocking (通过 listing.asin 和 marketplace)
        qb.leftJoinAndMapOne(
            'i.restocking',
            AppAmzBsrRestockingCenterLingxingEntity,
            'r',
            `l.asin = r.asin AND JSON_CONTAINS(r.marketplaceList, CONCAT('"', l.marketplace, '"'))`
        );

        if (keyWord) {
            qb.andWhere(
                '(i.plan_sn LIKE :keyWord OR i.sku LIKE :keyWord OR i.product_name LIKE :keyWord)',
                { keyWord: `%${keyWord}%` }
            );
        }

        qb.orderBy('i.id', 'ASC')
            .skip(skip)
            .take(sizeNo);

        const [list, total] = await qb.getManyAndCount();

        // 兜底逻辑：为缺少 analysis_record_id 的子项补充关联
        for (const item of list) {
            if (!item.analysis_record_id && item.plan_sn) {
                console.log(`[getOrderItemsPage] 子项 ${item.id} 缺少 analysis_record_id，尝试通过 plan_sn 查询: ${item.plan_sn}`);
                try {
                    const record = await this.analysisRecordRepo.findOne({
                        where: { plan_sn: item.plan_sn, status: 1 },
                        select: ['id']
                    });
                    if (record) {
                        // 更新子项表的 analysis_record_id
                        await this.orderItemRepo.update(item.id, {
                            analysis_record_id: record.id
                        });
                        item.analysis_record_id = record.id;
                        console.log(`[getOrderItemsPage] 已更新子项 ${item.id} 的 analysis_record_id: ${record.id}`);
                    }
                } catch (e) {
                    console.warn(`[getOrderItemsPage] 查询 plan_sn ${item.plan_sn} 失败:`, e.message);
                }
            }
        }

        const analysisIds = list
            .map((i) => i.analysis_record_id)
            .filter((id) => id);

        const analysisMap = new Map<number, any>();
        if (analysisIds.length > 0) {
            const records = await this.analysisRecordRepo.find({
                where: { id: In(analysisIds as number[]) },
                select: ['id', 'asin', 'msku', 'store_id', 'marketplace', 'expected_sales', 'remark']
            });
            records.forEach((r) => analysisMap.set(r.id, r));
        }

        const listWithRecord = list.map((item: any) => {
            // Logic Injection: 调用 LingXingUtils 计算衍生字段
            if (item.listing && item.restocking) {
                this.lingxingUtils.updateInventoryStatus(item.listing, item.restocking);
                const statusSplit = this.lingxingUtils.judgeProductStatusSplit(item.listing, item.restocking);
                Object.assign(item.listing, statusSplit);
            }

            return {
                ...item,
                analysisRecord: item.analysis_record_id ? analysisMap.get(item.analysis_record_id) || null : null
            };
        });

        return {
            list: listWithRecord,
            pagination: {
                page: pageNo,
                size: sizeNo,
                total
            }
        };
    }

    /**
     * 获取采购单的子项列表
     */
    async getOrderItems(order_sn: string): Promise<any[]> {
        const items = await this.orderItemRepo.find({
            where: { order_sn },
            order: { id: 'ASC' }
        });

        // 获取关联的分析记录和采购计划
        return Promise.all(items.map(async (item) => {
            // 找分析记录 (用于查看算法详情)
            let analysisRecord = null;
            if (item.analysis_record_id) {
                analysisRecord = await this.analysisRecordRepo.findOneBy({ id: item.analysis_record_id });
            }

            // 找采购计划细节 (用于展示图片、店铺、站点等)
            let purchasePlan = null;
            if (item.plan_sn) {
                purchasePlan = await this.purchasePlanRepo.findOneBy({ plan_sn: item.plan_sn });
            }

            return { ...item, analysisRecord, purchasePlan };
        }));
    }

    /**
     * 获取采购计划信息（用于填充子项的采购计划字段）
     * 逻辑：
     * 1. 先查本地采购计划表
     * 2. 如果没有或数据过期（sync_time超过1天），调用领星API同步
     * 3. 返回采购计划的关键信息
     */
    private async getPurchasePlanInfo(plan_sn: string): Promise<any | null> {
        if (!plan_sn) return null;

        try {
            // 1. 先查本地采购计划表
            let plan = await this.purchasePlanRepo.findOne({
                where: { plan_sn },
                select: [
                    'plan_sn', 'pic_url', 'creator_real_name', 'create_time_remote',
                    'supplier_name', 'warehouse_name', 'seller_name', 'marketplace',
                    'sync_time'
                ]
            });

            // 2. 检查是否需要同步
            const needSync = !plan || !plan.sync_time || dayjs().diff(dayjs(plan.sync_time), 'day') >= 1;

            if (needSync) {
                console.log(`[getPurchasePlanInfo] 计划 ${plan_sn} 需要同步，调用领星API`);
                try {
                    // 调用采购计划服务的同步方法
                    await this.purchasePlanService.syncPlansFromLingxing([plan_sn]);

                    // 重新查询获取最新数据
                    plan = await this.purchasePlanRepo.findOne({
                        where: { plan_sn },
                        select: [
                            'plan_sn', 'pic_url', 'creator_real_name', 'create_time_remote',
                            'supplier_name', 'warehouse_name', 'seller_name', 'marketplace',
                            'sync_time'
                        ]
                    });
                } catch (e) {
                    console.warn(`[getPurchasePlanInfo] 同步计划 ${plan_sn} 失败:`, e.message);
                    // 同步失败不影响主流程，继续使用本地缓存数据
                }
            }

            return plan;
        } catch (e) {
            console.error(`[getPurchasePlanInfo] 获取计划 ${plan_sn} 信息失败:`, e);
            return null;
        }
    }

    /**
     * 获取未同步的计划列表（预留接口）
     */
    async getUnsyncedPlans(query?: any): Promise<any> {
        // TODO: 根据业务需求实现
        return { list: [], total: 0 };
    }

    /**
     * 懒加载接口：判断是否跨天，按需更新
     * @param orderSn 采购单号
     */
    async getLogisticsWithLazySync(orderSn: string): Promise<any[]> {
        if (!orderSn) {
            throw new Error('采购单号不能为空');
        }
        return await this.purchaseOrderLogisticsService.getOrderPackages(orderSn);
    }

    /**
     * 强制刷新接口
     * @param orderSn 采购单号
     */
    async forceSyncLogistics(orderSn: string): Promise<any[]> {
        if (!orderSn) {
            throw new Error('采购单号不能为空');
        }
        return await this.purchaseOrderLogisticsService.queryOrderPackages(orderSn);
    }

    /**
     * 人工确认收货（支持单个/批量）
     * @param orderSns 采购单号数组
     * @param confirmed 确认状态: 1=确认, 0=撤销确认
     */
    async confirmReceipt(
        orderSns: string[],
        confirmed: number = 1,
        options: ConfirmReceiptOptions = {}
    ): Promise<ConfirmReceiptResult> {
        const normalizedOrderSns = [
            ...new Set((orderSns || []).map(orderSn => this.normalizeText(orderSn)).filter(Boolean))
        ];

        if (normalizedOrderSns.length === 0) {
            throw new Error('采购单号不能为空');
        }

        const nextConfirmed = Number(confirmed) === 1 ? 1 : 0;
        const action = nextConfirmed === 1 ? 'confirm' : 'cancel';
        const confirmTime = nextConfirmed === 1 ? new Date() : null;
        const batchId = `LC${dayjs().format('YYYYMMDDHHmmssSSS')}${Math.random()
            .toString(36)
            .slice(2, 8)
            .toUpperCase()}`;
        const user = this.getCurrentAdminUser();
        const orders = await this.orderRepo.find({
            where: {
                order_sn: In(normalizedOrderSns)
            }
        });
        const foundOrderSnSet = new Set(orders.map(order => this.normalizeText(order.order_sn)));
        const notFoundOrderSns = normalizedOrderSns.filter(orderSn => !foundOrderSnSet.has(orderSn));

        if (orders.length === 0) {
            return {
                updated: 0,
                batch_id: batchId,
                not_found_order_sns: notFoundOrderSns,
                skipped_order_sns: [],
                skipped_reasons: {},
            };
        }

        await this.purchaseOrderLogisticsService.attachStatusesToOrders(orders);

        const targetOrders = [];
        const skippedReasons: Record<string, string> = {};
        for (const order of orders) {
            const orderSn = this.normalizeText(order.order_sn);
            const beforeConfirmed = Number(order.logistics_confirmed) === 1;
            const logisticsStatus = this.normalizeText((order as any).logistics_status);

            if (nextConfirmed === 1) {
                if (beforeConfirmed || logisticsStatus === 'confirmed') {
                    skippedReasons[orderSn] = '已人工确认收货，无需重复确认';
                    continue;
                }
                if (logisticsStatus === 'signed') {
                    skippedReasons[orderSn] = '快递100已全部签收，无需人工确认';
                    continue;
                }
            } else if (!beforeConfirmed) {
                skippedReasons[orderSn] = '该采购单未人工确认收货，无需撤销';
                continue;
            }

            targetOrders.push(order);
        }

        const skippedOrderSns = Object.keys(skippedReasons);
        if (targetOrders.length === 0) {
            return {
                updated: 0,
                batch_id: batchId,
                not_found_order_sns: notFoundOrderSns,
                skipped_order_sns: skippedOrderSns,
                skipped_reasons: skippedReasons,
            };
        }

        const logs = targetOrders.map(order => {
            const beforeConfirmed = Number(order.logistics_confirmed) === 1 ? 1 : 0;
            const beforeTime = order.logistics_confirmed_time || null;

            order.logistics_confirmed = nextConfirmed;
            order.logistics_confirmed_time = confirmTime;

            return this.logisticsConfirmLogRepo.create({
                order_sn: order.order_sn,
                action,
                before_confirmed: beforeConfirmed,
                after_confirmed: nextConfirmed,
                before_confirmed_time: beforeTime,
                after_confirmed_time: confirmTime,
                operator_user_id: user.userId,
                operator_username: user.username,
                operator_nickname: user.nickname,
                remark: this.normalizeText(options.remark),
                source: this.normalizeText(options.source) || 'purchase_order_view',
                batch_id: batchId,
                raw_snapshot: {
                    order_sn: order.order_sn,
                    status: order.status,
                    status_text: order.status_text,
                    supplier_name: order.supplier_name,
                    purchase_order_time: order.order_time || order.create_time_remote,
                    before_confirmed: beforeConfirmed,
                    after_confirmed: nextConfirmed,
                },
            });
        });

        await this.orderRepo.save(targetOrders);
        await this.logisticsConfirmLogRepo.save(logs);

        return {
            updated: targetOrders.length,
            batch_id: batchId,
            not_found_order_sns: notFoundOrderSns,
            skipped_order_sns: skippedOrderSns,
            skipped_reasons: skippedReasons,
        };
    }

    // ============================================================
    // ==================== 发货计划相关方法 =======================
    // ============================================================

    /**
     * 通过批次号(seq)从领星查询发货计划明细并入库
     * @param seq 批次号，如 RP260309013
     * @param shippingMethod 运输方式(air/sea/express/rail)
     * @param planSnMap msku -> purchase_plan_sn 的映射（可选，用于关联采购计划）
     */
    async syncShipmentPlansBySeq(
        seq: string,
        shippingMethod?: string,
        planSnMap?: Map<string, string>,
        orderSnMap?: Map<string, string>,
        localCreator?: ShipmentPlanLocalCreator
    ): Promise<AppAmzBsrShipmentPlanLingxingEntity[]> {
        if (!seq) throw new Error('批次号不能为空');

        // 调用领星查询接口
        const body = {
            search_field: 'seq',
            search_value: seq,
            offset: 0,
            length: 100
        };

        const res = await this.lingxingUtils.httpPost(
            '/erp/sc/data/fba_report/shipmentPlanLists',
            body,
            true
        );

        if (!res || Number(res.code) !== 0 || !Array.isArray(res.data)) {
            console.warn(`[syncShipmentPlansBySeq] 查询失败: ${JSON.stringify(res)}`);
            throw new Error('从领星查询发货计划失败: ' + (res?.message || '未知错误'));
        }

        const now = new Date();
        const savedEntities: AppAmzBsrShipmentPlanLingxingEntity[] = [];

        for (const group of res.data) {
            if (!group.list || !Array.isArray(group.list)) continue;

            for (const item of group.list) {
                const entity = new AppAmzBsrShipmentPlanLingxingEntity();

                // 领星接口字段
                entity.isp_id = item.isp_id;
                entity.ispg_id = item.ispg_id;
                entity.order_sn = item.order_sn;
                entity.seq = item.seq || seq;
                entity.product_id = item.product_id;
                entity.product_name = item.product_name;
                entity.sku = item.sku;
                entity.msku = item.msku;
                entity.fnsku = item.fnsku;
                entity.pic_url = item.pic_url;
                entity.small_image_url = item.small_image_url;
                entity.sid = item.sid;
                entity.sname = item.sname;
                entity.nation = item.nation;
                entity.wid = item.wid;
                entity.wname = item.wname;
                entity.packing_type = item.packing_type;
                entity.packing_type_name = item.packing_type_name;
                entity.shipment_time = item.shipment_time;
                entity.shipment_plan_quantity = item.shipment_plan_quantity;
                entity.status = item.status;
                entity.status_name = item.status_name;
                entity.is_relate_mws = item.is_relate_mws || 0;
                entity.batch_remark = group.remark || null;
                entity.remark = item.remark;
                entity.create_user = item.create_user;
                entity.create_time_remote = item.create_time ? new Date(item.create_time) : null;

                // 提取 mws_relate 关联信息（如果有）
                if (Array.isArray(item.mws_relate) && item.mws_relate.length > 0) {
                    entity.shipment_mws_sn = item.mws_relate[0].shipment_mws_sn || null;
                    entity.shipment_list_sn = item.mws_relate[0].shipment_list_sn || null;
                }

                // 本地管理字段
                entity.shipping_method = shippingMethod || null;
                entity.last_sync_time = now;
                if (localCreator) {
                    entity.local_created_by_user_id = localCreator.userId;
                    entity.local_created_by_username = localCreator.username;
                    entity.local_created_by_nickname = localCreator.nickname;
                    entity.local_created_time = now;
                }

                // 通过 msku 关联采购计划号和采购单号
                if (planSnMap && item.msku && planSnMap.has(item.msku)) {
                    entity.purchase_plan_sn = planSnMap.get(item.msku);
                }
                if (orderSnMap && item.msku && orderSnMap.has(item.msku)) {
                    entity.purchase_order_sn = orderSnMap.get(item.msku);
                }

                // Upsert: 以 isp_id 为唯一键，存在则更新，不存在则插入
                const existing = await this.shipmentPlanRepo.findOneBy({ isp_id: item.isp_id });
                if (existing) {
                    // 保留原有的本地字段，更新领星字段
                    entity.id = existing.id;
                    if (!entity.purchase_plan_sn && existing.purchase_plan_sn) {
                        entity.purchase_plan_sn = existing.purchase_plan_sn;
                    }
                    if (!entity.purchase_order_sn && existing.purchase_order_sn) {
                        entity.purchase_order_sn = existing.purchase_order_sn;
                    }
                    if (!entity.shipping_method && existing.shipping_method) {
                        entity.shipping_method = existing.shipping_method;
                    }
                    if (
                        existing.local_created_by_user_id ||
                        existing.local_created_by_username ||
                        existing.local_created_time
                    ) {
                        entity.local_created_by_user_id = existing.local_created_by_user_id;
                        entity.local_created_by_username = existing.local_created_by_username;
                        entity.local_created_by_nickname = existing.local_created_by_nickname;
                        entity.local_created_time = existing.local_created_time;
                    }
                }

                const saved = await this.shipmentPlanRepo.save(entity);
                savedEntities.push(saved);
            }
        }

        console.log(`[syncShipmentPlansBySeq] seq=${seq} 共入库 ${savedEntities.length} 条发货计划`);
        return savedEntities;
    }

    /**
     * 查询本地发货计划（支持按采购计划号、批次号、MSKU等查询）
     */
    async queryShipmentPlans(query: {
        purchase_plan_sn?: string;
        seq?: string;
        msku?: string;
        order_sn?: string;
        status?: number;
    }): Promise<AppAmzBsrShipmentPlanLingxingEntity[]> {
        const where: any = {};
        if (query.purchase_plan_sn) where.purchase_plan_sn = query.purchase_plan_sn;
        if (query.seq) where.seq = query.seq;
        if (query.msku) where.msku = query.msku;
        if (query.order_sn) where.order_sn = query.order_sn;
        if (query.status !== undefined) where.status = query.status;

        return this.shipmentPlanRepo.find({
            where,
            order: { id: 'DESC' }
        });
    }

    /**
     * 懒刷新发货计划（检查 last_sync_time，超过4小时才去领星重新拉取）
     * @param seq 批次号
     * @param force 是否强制刷新（忽略冷却时间）
     */
    async refreshShipmentPlan(seq: string, force: boolean = false): Promise<{
        refreshed: boolean;
        data: AppAmzBsrShipmentPlanLingxingEntity[];
    }> {
        if (!seq) throw new Error('批次号不能为空');

        // 检查本地是否有该批次的数据
        const localRecords = await this.shipmentPlanRepo.find({ where: { seq } });

        if (!force && localRecords.length > 0) {
            const lastSync = localRecords[0].last_sync_time;
            if (lastSync && dayjs().diff(dayjs(lastSync), 'hour') < 4) {
                // 不到4小时，直接返回本地数据
                return { refreshed: false, data: localRecords };
            }
        }

        // 超过4小时或强制刷新，重新从领星拉取
        const freshData = await this.syncShipmentPlansBySeq(seq);
        return { refreshed: true, data: freshData };
    }

    /**
     * 批量查询 Listing 产品的「待交付」数据（汇总 + 明细）
     * 
     * 本地待交付只认一条链路：
     * order_item.plan_sn → purchase_plan.plan_sn → purchase_plan.analysis_record_id → analysis_record.id
     * 补货中心 purchaseShippingDetailList 作为领星/外部来源补充，并按 order_sn 去重。
     * 
     * 待交付状态：1(待下单) 2(待到货) 3(待提交) 121(待审核) 122(已驳回)
     * 数量取值：status=2 取 quantity_receive，其他取 quantity_real
     */
    async getPendingDeliveryByProducts(body: {
        products: PendingPurchasePlanProduct[];
        syncLinkedOrders?: boolean;
        keepLocalOnMissing?: boolean;
    }): Promise<Record<string, PendingDeliveryResult>> {
        const { products, syncLinkedOrders = false, keepLocalOnMissing = false } = body;
        if (!products || products.length === 0) return {};

        // 去重
        const uniqueMap = new Map<string, PendingPurchasePlanProduct>();
        for (const p of products) {
            if (p.asin && p.marketplace && p.store_id !== undefined) {
                uniqueMap.set(this.buildPendingPurchasePlanKey(p), { ...p });
            }
        }
        const uniqueProducts = await this.enrichPendingProductsWithSellerName(Array.from(uniqueMap.values()));
        if (uniqueProducts.length === 0) return {};

        // 待交付状态
        const PENDING_STATUSES = [1, 2, 3, 121, 122];
        const manager = this.orderRepo.manager;
        const restockingShippingByKey = await this.getRestockingPurchaseShippingByProducts(uniqueProducts);
        const syncMeta = syncLinkedOrders
            ? await this.syncLinkedPurchaseOrdersForProducts(uniqueProducts, PENDING_STATUSES, restockingShippingByKey, {
                keepLocalOnMissing,
            })
            : null;

        const resultMap: Record<string, PendingDeliveryResult & {
            localOrderSnSet: Set<string>;
            lingxingOrderSnSet: Set<string>;
            allOrderSnSet: Set<string>;
        }> = {};

        uniqueProducts.forEach(p => {
            resultMap[this.buildPendingPurchasePlanKey(p)] = {
                pending_qty: 0,
                pending_count: 0,
                details: [],
                lingxing_pending_qty: 0,
                lingxing_pending_count: 0,
                lingxing_details: [],
                localOrderSnSet: new Set<string>(),
                lingxingOrderSnSet: new Set<string>(),
                allOrderSnSet: new Set<string>()
            };
        });

        const buildRemark = (row: any) => {
            let finalRemark = '';
            if (row.analysis_manual_remark) {
                finalRemark += `[人工] ${row.analysis_manual_remark}\n`;
            }
            if (row.analysis_sys_remark_json) {
                try {
                    const obj = JSON.parse(row.analysis_sys_remark_json);
                    if (obj.remark_text) finalRemark += `[建议] ${obj.remark_text}\n`;
                } catch (e) { }
            }
            if (!row.analysis_manual_remark && !row.analysis_sys_remark_json && row.item_remark) {
                finalRemark += `[明细] ${row.item_remark}\n`;
            }
            return finalRemark.trim();
        };

        const addLocalDetail = (key: string, row: any, origin: string) => {
            const entry = resultMap[key];
            const orderSn = this.normalizeText(row.order_sn);
            if (!entry || !orderSn || entry.allOrderSnSet.has(orderSn)) return;

            const qty = Number(row.pending_qty) || 0;
            entry.pending_qty += qty;
            entry.localOrderSnSet.add(orderSn);
            entry.allOrderSnSet.add(orderSn);
            entry.pending_count = entry.localOrderSnSet.size;
            entry.details.push({
                order_sn: orderSn,
                plan_sn: this.normalizeText(row.plan_sn),
                status: row.status,
                status_text: row.status_text,
                supplier_name: row.supplier_name || '',
                quantity: qty,
                order_time: row.order_time || row.orderDate || null,
                remark: row.remark || buildRemark(row),
                analysis_record_id: row.analysis_record_id || null,
                source: 'local',
                source_label: '艾为',
                source_origin: origin
            });
        };

        const addLingxingDetail = (key: string, row: any, origin: string) => {
            const entry = resultMap[key];
            const orderSn = this.normalizeText(row.order_sn || row.orderSn);
            if (!entry || !orderSn || entry.allOrderSnSet.has(orderSn)) return;

            const qty = Number(row.pending_qty ?? row.quantity) || 0;
            entry.lingxing_pending_qty += qty;
            entry.lingxingOrderSnSet.add(orderSn);
            entry.allOrderSnSet.add(orderSn);
            entry.lingxing_pending_count = entry.lingxingOrderSnSet.size;
            entry.lingxing_details.push({
                order_sn: orderSn,
                plan_sn: this.normalizeText(row.plan_sn),
                status: row.status ?? null,
                status_text: row.status_text || row.statusName || '',
                supplier_name: row.supplier_name || '',
                quantity: qty,
                order_time: row.order_time || row.orderDate || null,
                remark: row.remark || buildRemark(row),
                source: 'lingxing',
                source_label: '领星',
                source_origin: origin,
                sku: row.sku || '',
                store_name: row.store_name || row.storeName || '',
                warehouse_name: row.warehouse_name || row.whName || '',
                amazon_sale_date: row.amazon_sale_date || row.amazonSaleDate || null,
                expect_arrive_date: row.expect_arrive_date || row.expectArriveDate || null
            });
        };

        const strictLocalParams: any[] = [];
        const strictLocalConditions = uniqueProducts.map((p) => {
            strictLocalParams.push(p.asin, p.marketplace, p.store_id);
            if (p.msku) strictLocalParams.push(p.msku);

            return `(
                a.asin = ? AND a.marketplace = ? AND a.store_id = ?
                ${p.msku ? 'AND a.msku = ?' : ''}
            )`;
        }).join(' OR ');

        // ========== 严格本地：采购单必须通过 plan_sn 认回本地采购计划和本地分析记录 ==========
        const strictLocalSql = `
            SELECT
                CONCAT_WS('|', a.asin, a.marketplace, a.store_id, IFNULL(a.msku, '')) AS listing_key,
                o.order_sn,
                i.plan_sn,
                o.status,
                o.status_text,
                o.supplier_name,
                o.order_time,
                CASE WHEN o.status = 2
                    THEN i.quantity_receive
                    ELSE i.quantity_real
                END AS pending_qty,
                a.manual_remark AS analysis_manual_remark,
                a.remark AS analysis_sys_remark_json,
                i.remark AS item_remark,
                a.id AS analysis_record_id
            FROM app_amz_bsr_purchase_order_item_sync_lingxing i
            INNER JOIN app_amz_bsr_purchase_order_sync_lingxing o
                ON i.order_sn = o.order_sn
                AND o.status IN (${PENDING_STATUSES.join(',')})
            INNER JOIN app_amz_bsr_purchase_plan_lingxing pp
                ON pp.plan_sn = i.plan_sn
                AND pp.analysis_record_id IS NOT NULL
            INNER JOIN app_amz_bsr_analysis_record_lingxing a
                ON a.id = pp.analysis_record_id
            WHERE ${strictLocalConditions}
            ORDER BY o.order_time DESC
        `;

        const strictLocalRows: any[] = await manager.query(strictLocalSql, strictLocalParams);
        for (const row of strictLocalRows) {
            addLocalDetail(row.listing_key, row, 'order_sync');
        }

        const isSyncedOrderRowLocalForProduct = (row: any, product: PendingPurchasePlanProduct) => {
            if (!row?.analysis_record_id) return false;
            if (this.normalizeText(row.analysis_asin) !== this.normalizeText(product.asin)) return false;
            if (this.normalizeText(row.analysis_marketplace) !== this.normalizeText(product.marketplace)) return false;
            if (String(row.analysis_store_id ?? '') !== String(product.store_id ?? '')) return false;
            if (product.msku && this.normalizeText(row.analysis_msku) !== this.normalizeText(product.msku)) return false;
            return true;
        };

        const pickSyncedOrderRowForRestockingItem = (
            rows: any[],
            product: PendingPurchasePlanProduct,
            item: any
        ) => {
            if (!rows.length) return null;

            const localMatch = rows.find(row => isSyncedOrderRowLocalForProduct(row, product));
            if (localMatch) return localMatch;

            const itemSku = this.normalizeText(item?.sku);
            if (itemSku) {
                const skuMatch = rows.find(row => this.normalizeText(row.sku) === itemSku);
                if (skuMatch) return skuMatch;
            }

            const msku = this.normalizeText(product.msku);
            if (msku) {
                const listingMatch = rows.find(row =>
                    this.normalizeText(row.first_msku) === msku
                    && String(row.sid ?? '') === String(product.store_id ?? '')
                );
                if (listingMatch) return listingMatch;
            }

            return rows.length === 1 ? rows[0] : null;
        };

        // ========== 补货中心：先用 orderSn 反查本地采购单同步表补全，再判断本地/领星 ==========
        const restockingOrderSns = [
            ...new Set(
                Array.from(restockingShippingByKey.values())
                    .flat()
                    .map(item => this.normalizeText(item?.orderSn))
                    .filter(Boolean)
            )
        ];
        const syncedRowsByOrderSn = new Map<string, any[]>();
        if (restockingOrderSns.length > 0) {
            const placeholders = restockingOrderSns.map(() => '?').join(',');
            const syncedRows: any[] = await manager.query(`
                SELECT
                    o.order_sn,
                    i.plan_sn,
                    i.sku,
                    i.first_msku,
                    i.sid,
                    i.plan_seller_name AS store_name,
                    i.ware_house_name AS warehouse_name,
                    i.expect_arrive_time AS expect_arrive_date,
                    o.status,
                    o.status_text,
                    o.supplier_name,
                    o.order_time,
                    CASE WHEN o.status = 2
                        THEN i.quantity_receive
                        ELSE i.quantity_real
                    END AS pending_qty,
                    a.manual_remark AS analysis_manual_remark,
                    a.remark AS analysis_sys_remark_json,
                    i.remark AS item_remark,
                    a.id AS analysis_record_id,
                    a.asin AS analysis_asin,
                    a.marketplace AS analysis_marketplace,
                    a.store_id AS analysis_store_id,
                    a.msku AS analysis_msku
                FROM app_amz_bsr_purchase_order_item_sync_lingxing i
                INNER JOIN app_amz_bsr_purchase_order_sync_lingxing o
                    ON i.order_sn = o.order_sn
                    AND o.status IN (${PENDING_STATUSES.join(',')})
                LEFT JOIN app_amz_bsr_purchase_plan_lingxing pp
                    ON pp.plan_sn = i.plan_sn
                    AND pp.analysis_record_id IS NOT NULL
                LEFT JOIN app_amz_bsr_analysis_record_lingxing a
                    ON a.id = pp.analysis_record_id
                WHERE i.order_sn IN (${placeholders})
            `, restockingOrderSns);

            for (const row of syncedRows) {
                const orderSn = this.normalizeText(row.order_sn);
                if (!orderSn) continue;
                if (!syncedRowsByOrderSn.has(orderSn)) syncedRowsByOrderSn.set(orderSn, []);
                syncedRowsByOrderSn.get(orderSn)!.push(row);
            }
        }

        for (const p of uniqueProducts) {
            const key = this.buildPendingPurchasePlanKey(p);
            const restockingItems = restockingShippingByKey.get(key) || [];
            for (const item of restockingItems) {
                const orderSn = this.normalizeText(item?.orderSn);
                const syncedRows = syncedRowsByOrderSn.get(orderSn) || [];
                const syncedRow = pickSyncedOrderRowForRestockingItem(syncedRows, p, item);
                if (syncedRow) {
                    const mergedRow = {
                        ...item,
                        ...syncedRow,
                        order_sn: orderSn,
                        amazon_sale_date: item?.amazonSaleDate || null
                    };
                    if (isSyncedOrderRowLocalForProduct(syncedRow, p)) {
                        addLocalDetail(key, mergedRow, 'restocking_center_order_sync');
                    } else {
                        addLingxingDetail(key, mergedRow, 'restocking_center_order_sync');
                    }
                    continue;
                }

                addLingxingDetail(key, item, 'restocking_center');
            }
        }

        // ========== 领星同步表兜底：旧 first_msku+sid 匹配不再算本地，只作为外部明细 ==========
        const externalProducts = uniqueProducts.filter(p => p.msku);
        const externalParams: any[] = [];
        if (externalProducts.length > 0) {
            const externalConditionBlocks = externalProducts.map((p) => {
                // SELECT ? AS listing_key 在 SQL 中最先出现，占位参数也必须最先传。
                externalParams.push(this.buildPendingPurchasePlanKey(p));
                externalParams.push(p.msku, p.store_id);
                externalParams.push(p.asin, p.marketplace, p.store_id);
                externalParams.push(p.msku);

                return `(
                    i.first_msku IS NOT NULL
                    AND i.first_msku = ?
                    AND i.sid = ?
                    AND NOT (
                        a.id IS NOT NULL
                        AND a.asin = ? AND a.marketplace = ? AND a.store_id = ?
                        AND a.msku = ?
                    )
                )`;
            });

            const externalSql = `
                SELECT
                    listing_key,
                    order_sn,
                    plan_sn,
                    status,
                    status_text,
                    supplier_name,
                    order_time,
                    pending_qty,
                    analysis_manual_remark,
                    analysis_sys_remark_json,
                    item_remark
                FROM (
                    ${externalConditionBlocks.map(block => `
                        SELECT
                            ? AS listing_key,
                            o.order_sn,
                            i.plan_sn,
                            o.status,
                            o.status_text,
                            o.supplier_name,
                            o.order_time,
                            CASE WHEN o.status = 2
                                THEN i.quantity_receive
                                ELSE i.quantity_real
                            END AS pending_qty,
                            a.manual_remark AS analysis_manual_remark,
                            a.remark AS analysis_sys_remark_json,
                            i.remark AS item_remark,
                            i.first_msku,
                            i.sid,
                            a.id AS analysis_id,
                            a.asin AS analysis_asin,
                            a.marketplace AS analysis_marketplace,
                            a.store_id AS analysis_store_id,
                            a.msku AS analysis_msku
                        FROM app_amz_bsr_purchase_order_item_sync_lingxing i
                        INNER JOIN app_amz_bsr_purchase_order_sync_lingxing o
                            ON i.order_sn = o.order_sn
                            AND o.status IN (${PENDING_STATUSES.join(',')})
                        LEFT JOIN app_amz_bsr_purchase_plan_lingxing pp
                            ON pp.plan_sn = i.plan_sn
                        LEFT JOIN app_amz_bsr_analysis_record_lingxing a
                            ON a.id = pp.analysis_record_id
                        WHERE ${block}
                    `).join(' UNION ALL ')}
                ) AS external_rows
                ORDER BY order_time DESC
            `;

            const externalRows: any[] = await manager.query(externalSql, externalParams);
            for (const row of externalRows) {
                addLingxingDetail(row.listing_key, row, 'order_sync');
            }
        }

        const finalResultMap: Record<string, PendingDeliveryResult> = {};
        uniqueProducts.forEach(p => {
            const key1 = this.buildPendingPurchasePlanKey(p);
            const groupData = resultMap[key1];
            if (groupData) {
                finalResultMap[key1] = {
                    pending_qty: groupData.pending_qty,
                    pending_count: groupData.pending_count,
                    details: groupData.details,
                    lingxing_pending_qty: groupData.lingxing_pending_qty,
                    lingxing_pending_count: groupData.lingxing_pending_count,
                    lingxing_details: groupData.lingxing_details,
                    ...(syncMeta
                        ? {
                            sync_attempted: syncMeta.attempted,
                            sync_success: syncMeta.success,
                            sync_error: syncMeta.error || null,
                            synced_order_sns: syncMeta.orderSns,
                            failed_order_sns: syncMeta.failedOrderSns
                        }
                        : {})
                };
            }
        });

        return finalResultMap;
    }

    private async enrichPendingProductsWithSellerName(
        products: PendingPurchasePlanProduct[]
    ): Promise<PendingPurchasePlanProduct[]> {
        return Promise.all(products.map(async (product) => {
            if (this.normalizeText(product.seller_name)) return product;

            const where: any = {
                asin: product.asin,
                marketplace: product.marketplace,
                store_id: product.store_id
            };
            if (product.msku) where.msku = product.msku;

            const listing = await this.productListingRepo.findOne({
                where,
                select: ['seller_name', 'shop'] as any
            });
            const sellerName = this.normalizeText((listing as any)?.seller_name);
            const shopName = this.normalizeText((listing as any)?.shop);
            return {
                ...product,
                seller_name: sellerName || (shopName ? shopName.replace(/\s+\S+$/, '') : '')
            };
        }));
    }

    private async getRestockingPurchaseShippingByProducts(
        products: PendingPurchasePlanProduct[]
    ): Promise<Map<string, any[]>> {
        const result = new Map<string, any[]>();
        const uniqueProducts = products.filter(p => p?.asin && p?.marketplace);
        uniqueProducts.forEach(p => result.set(this.buildPendingPurchasePlanKey(p), []));

        const productsWithSeller = uniqueProducts.filter(p => this.normalizeText(p.seller_name));
        if (productsWithSeller.length === 0) return result;

        const qb = this.restockingCenterRepo
            .createQueryBuilder('restocking')
            .where(new Brackets(qb => {
                productsWithSeller.forEach((p, index) => {
                    const params: Record<string, any> = {
                        [`asin${index}`]: p.asin,
                        [`marketplace${index}`]: JSON.stringify(p.marketplace),
                        [`store${index}`]: JSON.stringify(this.normalizeText(p.seller_name)),
                    };
                    const where = [
                        `restocking.asin = :asin${index}`,
                        `JSON_CONTAINS(restocking.marketplaceList, :marketplace${index})`,
                        `JSON_CONTAINS(restocking.storeList, :store${index})`
                    ].join(' AND ');

                    if (index === 0) qb.where(where, params);
                    else qb.orWhere(where, params);
                });
            }));

        const restockingRows = await qb.getMany();
        for (const product of productsWithSeller) {
            const key = this.buildPendingPurchasePlanKey(product);
            const matchedRows = restockingRows.filter(row => this.restockingMatchesPendingProduct(row, product));
            const details = matchedRows.flatMap(row => {
                const extInfo = this.safeJsonObject((row as any).extInfo);
                const list = this.safeJsonArray(extInfo.purchaseShippingDetailList);
                return list
                    .filter(item => this.normalizeText(item?.orderSn))
                    .map(item => ({
                        ...item,
                        restocking_id: row.id
                    }));
            });
            result.set(key, details);
        }

        return result;
    }

    private async syncLinkedPurchaseOrdersForProducts(
        products: PendingPurchasePlanProduct[],
        pendingStatuses: number[],
        restockingShippingByKey: Map<string, any[]>,
        options: PurchaseOrderSyncByOrderSnsOptions = {}
    ): Promise<PendingDeliverySyncMeta> {
        if (!products.length) {
            return { attempted: false, success: true, orderSns: [], failedOrderSns: [] };
        }

        try {
            const orderSns = await this.collectPendingDeliveryOrderSnsForProducts(
                products,
                pendingStatuses,
                restockingShippingByKey
            );
            if (orderSns.length === 0) {
                return { attempted: true, success: true, orderSns: [], failedOrderSns: [] };
            }

            return await this.syncPurchaseOrdersByOrderSns(orderSns, options);
        } catch (e: any) {
            console.warn('[getPendingDeliveryByProducts] 同步关联采购单失败，降级使用本地数据:', e?.message || e);
            return {
                attempted: true,
                success: false,
                error: e?.message || '同步关联采购单失败',
                orderSns: [],
                failedOrderSns: []
            };
        }
    }

    private async collectPendingDeliveryOrderSnsForProducts(
        products: PendingPurchasePlanProduct[],
        pendingStatuses: number[],
        restockingShippingByKey: Map<string, any[]>
    ): Promise<string[]> {
        const orderSnSet = new Set<string>();
        for (const items of restockingShippingByKey.values()) {
            for (const item of items) {
                const orderSn = this.normalizeText(item?.orderSn);
                if (orderSn) orderSnSet.add(orderSn);
            }
        }

        const manager = this.orderRepo.manager;
        const strictParams: any[] = [];
        const strictConditions = products.map((p) => {
            strictParams.push(p.asin, p.marketplace, p.store_id);
            if (p.msku) strictParams.push(p.msku);

            return `(
                a.asin = ? AND a.marketplace = ? AND a.store_id = ?
                ${p.msku ? 'AND a.msku = ?' : ''}
            )`;
        }).join(' OR ');

        const strictRows: Array<{ order_sn: string }> = await manager.query(`
            SELECT DISTINCT o.order_sn
            FROM app_amz_bsr_purchase_order_item_sync_lingxing i
            INNER JOIN app_amz_bsr_purchase_order_sync_lingxing o
                ON i.order_sn = o.order_sn
                AND o.status IN (${pendingStatuses.join(',')})
            INNER JOIN app_amz_bsr_purchase_plan_lingxing pp
                ON pp.plan_sn = i.plan_sn
                AND pp.analysis_record_id IS NOT NULL
            INNER JOIN app_amz_bsr_analysis_record_lingxing a
                ON a.id = pp.analysis_record_id
            WHERE ${strictConditions}
        `, strictParams);
        for (const row of strictRows) {
            const orderSn = this.normalizeText(row.order_sn);
            if (orderSn) orderSnSet.add(orderSn);
        }

        const externalProducts = products.filter(p => p.msku);
        if (externalProducts.length > 0) {
            const externalParams: any[] = [];
            const externalConditions = externalProducts.map((p) => {
                externalParams.push(p.msku, p.store_id);
                return `(i.first_msku IS NOT NULL AND i.first_msku = ? AND i.sid = ?)`;
            }).join(' OR ');

            const externalRows: Array<{ order_sn: string }> = await manager.query(`
                SELECT DISTINCT o.order_sn
                FROM app_amz_bsr_purchase_order_item_sync_lingxing i
                INNER JOIN app_amz_bsr_purchase_order_sync_lingxing o
                    ON i.order_sn = o.order_sn
                    AND o.status IN (${pendingStatuses.join(',')})
                WHERE ${externalConditions}
            `, externalParams);
            for (const row of externalRows) {
                const orderSn = this.normalizeText(row.order_sn);
                if (orderSn) orderSnSet.add(orderSn);
            }
        }

        return Array.from(orderSnSet);
    }

    private async syncPurchaseOrdersByOrderSns(
        orderSns: string[],
        options: PurchaseOrderSyncByOrderSnsOptions = {}
    ): Promise<PendingDeliverySyncMeta> {
        const normalizedOrderSns = [
            ...new Set(orderSns.map(orderSn => this.normalizeText(orderSn)).filter(Boolean))
        ];
        if (normalizedOrderSns.length === 0) {
            return {
                attempted: true,
                success: true,
                orderSns: [],
                failedOrderSns: [],
                remoteMissingOrderSns: [],
                requestFailedOrderSns: [],
                items: [],
            };
        }

        const keepLocalOnMissing = Boolean(options.keepLocalOnMissing);
        const allRecords = await this.analysisRecordRepo.find({
            where: { status: 1 },
            select: ['id', 'plan_sn']
        });
        const planSnMap = new Map(allRecords.map(r => [r.plan_sn ? r.plan_sn.trim() : '', r.id]));
        const syncedSet = new Set<string>();
        const failedSet = new Set<string>();
        const remoteMissingSet = new Set<string>();
        const requestFailedSet = new Set<string>();
        const itemResultMap = new Map<string, PurchaseOrderSyncItemResult>();
        const errors: string[] = [];
        const touchedPlanSns = new Set<string>();
        const chunkSize = 500;
        const setItemResult = (
            orderSn: string,
            status: PurchaseOrderSyncItemStatus,
            message: string,
            updated = false
        ) => {
            itemResultMap.set(orderSn, {
                order_sn: orderSn,
                status,
                message,
                updated,
            });
        };
        const markSynced = (orderSn: string) => {
            syncedSet.add(orderSn);
            failedSet.delete(orderSn);
            remoteMissingSet.delete(orderSn);
            requestFailedSet.delete(orderSn);
            setItemResult(orderSn, 'synced', '已同步最新采购单', true);
        };
        const markRemoteMissing = async (orderSn: string) => {
            if (!keepLocalOnMissing) {
                await this.orderItemRepo.delete({ order_sn: orderSn });
                await this.orderRepo.delete({ order_sn: orderSn });
            }
            failedSet.add(orderSn);
            remoteMissingSet.add(orderSn);
            setItemResult(
                orderSn,
                'remote_missing',
                keepLocalOnMissing
                    ? '领星未返回该采购单，本地数据已保留'
                    : '领星未返回该采购单，本地旧数据已清理',
                false
            );
            errors.push(`${orderSn}: 领星未返回该采购单`);
        };
        const markRequestFailed = (orderSn: string, error: any) => {
            const message = error?.message || '同步失败';
            failedSet.add(orderSn);
            requestFailedSet.add(orderSn);
            setItemResult(orderSn, 'request_failed', `刷新失败：${message}`, false);
            errors.push(`${orderSn}: ${message}`);
        };

        for (let start = 0; start < normalizedOrderSns.length; start += chunkSize) {
            const chunk = normalizedOrderSns.slice(start, start + chunkSize);
            try {
                const orders = await this.fetchPurchaseOrdersFromLingxingWithRetry(chunk);
                const returnedSet = new Set<string>();
                for (const orderData of orders) {
                    const orderSn = this.normalizeText(orderData?.order_sn);
                    if (!orderSn) continue;
                    returnedSet.add(orderSn);
                    const planSns = await this.saveOrder(orderData, planSnMap);
                    this.addPlanSns(touchedPlanSns, planSns);
                    await this.refreshPackagesAfterOrderSync(orderData, 'syncPurchaseOrdersByOrderSns');
                    markSynced(orderSn);
                }

                const missingOrderSns = chunk.filter(orderSn => !returnedSet.has(orderSn));
                for (const orderSn of missingOrderSns) {
                    try {
                        const singleOrders = await this.fetchPurchaseOrdersFromLingxingWithRetry([orderSn], {
                            delayBeforeRequestMs: this.purchaseOrderSingleFallbackDelayMs,
                        });
                        const singleOrder = singleOrders.find(order => this.normalizeText(order?.order_sn) === orderSn);
                        if (singleOrder) {
                            const planSns = await this.saveOrder(singleOrder, planSnMap);
                            this.addPlanSns(touchedPlanSns, planSns);
                            await this.refreshPackagesAfterOrderSync(singleOrder, 'syncPurchaseOrdersByOrderSns');
                            markSynced(orderSn);
                            continue;
                        }

                        // 批量和单个都查不到才判定为远端未返回；安全模式只返回状态，不清理本地旧数据。
                        await markRemoteMissing(orderSn);
                    } catch (e: any) {
                        markRequestFailed(orderSn, e);
                    }
                }
            } catch (e: any) {
                console.warn('[syncPurchaseOrdersByOrderSns] 批量同步采购单失败，尝试单个兜底:', e?.message || e);
                for (const orderSn of chunk) {
                    try {
                        const singleOrders = await this.fetchPurchaseOrdersFromLingxingWithRetry([orderSn], {
                            delayBeforeRequestMs: this.purchaseOrderSingleFallbackDelayMs,
                        });
                        const singleOrder = singleOrders.find(order => this.normalizeText(order?.order_sn) === orderSn);
                        if (singleOrder) {
                            const planSns = await this.saveOrder(singleOrder, planSnMap);
                            this.addPlanSns(touchedPlanSns, planSns);
                            await this.refreshPackagesAfterOrderSync(singleOrder, 'syncPurchaseOrdersByOrderSns');
                            markSynced(orderSn);
                            continue;
                        }

                        await markRemoteMissing(orderSn);
                    } catch (singleError: any) {
                        markRequestFailed(orderSn, singleError || e);
                    }
                }
            }
        }

        const autoComplete = await this.runPurchasePlanRemarkAutoComplete(touchedPlanSns, 'syncPurchaseOrdersByOrderSns', { syncPlans: true });
        return {
            attempted: true,
            success: failedSet.size === 0,
            error: errors.length ? errors.join('；') : null,
            orderSns: Array.from(syncedSet),
            failedOrderSns: Array.from(failedSet),
            remoteMissingOrderSns: Array.from(remoteMissingSet),
            requestFailedOrderSns: Array.from(requestFailedSet),
            items: normalizedOrderSns.map(orderSn => itemResultMap.get(orderSn) || {
                order_sn: orderSn,
                status: 'request_failed',
                message: '同步失败，未返回处理结果',
                updated: false,
            }),
            autoComplete,
            auto_complete: autoComplete,
        };
    }

    private async fetchPurchaseOrdersFromLingxing(orderSns: string[]): Promise<any[]> {
        const normalizedOrderSns = [
            ...new Set(orderSns.map(orderSn => this.normalizeText(orderSn)).filter(Boolean))
        ];
        if (normalizedOrderSns.length === 0) return [];

        const response: any = await this.lingxingUtils.httpPost(this.PURCHASE_ORDER_LIST_API, {
            search_field_time: 'update_time',
            start_date: '1990-01-01',
            end_date: dayjs().format('YYYY-MM-DD HH:mm:ss'),
            order_sn: normalizedOrderSns,
            offset: 0,
            length: Math.min(500, Math.max(1, normalizedOrderSns.length))
        }, true);

        const payload = response?.data && !Array.isArray(response.data) ? response.data : response;
        if (payload && payload.code !== undefined && String(payload.code) !== '0' && String(payload.code) !== '200') {
            throw new Error(`领星采购单API错误: ${payload.message || payload.msg || payload.code}`);
        }

        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
    }

    private async fetchPurchaseOrdersFromLingxingWithRetry(
        orderSns: string[],
        options: { delayBeforeRequestMs?: number } = {}
    ): Promise<any[]> {
        const delayBeforeRequestMs = Number(options.delayBeforeRequestMs) || 0;
        if (delayBeforeRequestMs > 0) {
            await this.sleep(delayBeforeRequestMs);
        }

        try {
            return await this.fetchPurchaseOrdersFromLingxing(orderSns);
        } catch (e: any) {
            if (!this.isLingxingRateLimitError(e)) {
                throw e;
            }

            await this.sleep(this.purchaseOrderRateLimitRetryDelayMs);
            return await this.fetchPurchaseOrdersFromLingxing(orderSns);
        }
    }

    private isLingxingRateLimitError(error: any) {
        const message = String(error?.message || error || '').toLowerCase();
        return (
            message.includes('new requests too frequently') ||
            message.includes('please request later')
        );
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
    }

    /**
     * 批量查询 Listing 产品的「采购计划」数据（汇总 + 明细）
     * 
     * 【三路线 UNION ALL + GROUP BY 去重 + MAX() 取备注】
     * - 路线A：purchase_plan 直接通过 msku+sid+marketplace 匹配
     * - 路线B：order_item → plan_sn → purchase_plan 反查
     * - 路线C：analysis_record(status=1) → plan_sn → purchase_plan 反查
     * - GROUP BY pp.id 去重，MAX() 自动取有备注的那条
     * 
     * 采购计划状态：2(待采购) 121(待审批)
     */
    async getPendingPurchasePlansByProducts(body: {
        products: PendingPurchasePlanProduct[];
        syncLinkedPlans?: boolean;
    }): Promise<Record<string, PendingPurchasePlanResult>> {
        const { products, syncLinkedPlans = false } = body;
        if (!products || products.length === 0) return {};

        // 去重
        const uniqueMap = new Map<string, PendingPurchasePlanProduct>();
        for (const p of products) {
            if (p.asin && p.marketplace && p.store_id !== undefined) {
                uniqueMap.set(`${p.asin}|${p.marketplace}|${p.store_id}|${p.msku || ''}`, p);
            }
        }
        const uniqueProducts = Array.from(uniqueMap.values());
        if (uniqueProducts.length === 0) return {};

        const PLAN_STATUSES = [2, 121];
        const syncMeta = syncLinkedPlans
            ? await this.syncLinkedPurchasePlansForProducts(uniqueProducts, PLAN_STATUSES)
            : null;

        // 为每个产品构建三路线 UNION 并汇总
        const unionBlocks = uniqueProducts.map((p) => {
            const msku = p.msku || '';
            const mskuJson = msku ? `"${msku}"` : '';

            return `
                SELECT pp.id,
                    CONCAT_WS('|', ?, ?, ?, ?) AS listing_key,
                    pp.plan_sn, pp.status, pp.status_text, pp.quantity_plan,
                    pp.creator_real_name, pp.create_time_remote, pp.sync_time,
                    CASE WHEN a.id IS NOT NULL THEN 1 ELSE 0 END AS is_local_linked,
                    a.id AS analysis_record_id,
                    a.manual_remark AS analysis_manual_remark,
                    a.remark AS analysis_sys_remark_json
                FROM app_amz_bsr_purchase_plan_lingxing pp
                LEFT JOIN app_amz_bsr_analysis_record_lingxing a ON pp.analysis_record_id = a.id
                WHERE pp.status IN (${PLAN_STATUSES.join(',')})
                  AND IFNULL(pp.is_deleted_remote, 0) = 0
                  AND JSON_UNQUOTE(JSON_EXTRACT(pp.msku, '$[0]')) IS NOT NULL
                  ${mskuJson ? `AND JSON_CONTAINS(pp.msku, ?)` : `AND 1=0`}
                  AND pp.sid = ? AND pp.marketplace = ?

                UNION ALL

                SELECT pp.id,
                    CASE WHEN a2.id IS NOT NULL
                        THEN CONCAT_WS('|', a2.asin, a2.marketplace, a2.store_id, IFNULL(a2.msku, ''))
                        ELSE CONCAT_WS('|', i.first_msku, i.sid, '')
                    END AS listing_key,
                    pp.plan_sn, pp.status, pp.status_text, pp.quantity_plan,
                    pp.creator_real_name, pp.create_time_remote, pp.sync_time,
                    CASE WHEN a2.id IS NOT NULL THEN 1 ELSE 0 END AS is_local_linked,
                    a2.id AS analysis_record_id,
                    a2.manual_remark AS analysis_manual_remark,
                    a2.remark AS analysis_sys_remark_json
                FROM app_amz_bsr_purchase_order_item_sync_lingxing i
                LEFT JOIN app_amz_bsr_analysis_record_lingxing a2 ON i.analysis_record_id = a2.id
                INNER JOIN app_amz_bsr_purchase_plan_lingxing pp ON i.plan_sn = pp.plan_sn
                WHERE pp.status IN (${PLAN_STATUSES.join(',')})
                  AND IFNULL(pp.is_deleted_remote, 0) = 0
                  AND i.plan_sn IS NOT NULL AND i.plan_sn != ''
                  AND (
                    (a2.id IS NOT NULL AND a2.asin = ? AND a2.marketplace = ? AND a2.store_id = ? ${p.msku ? 'AND a2.msku = ?' : ''})
                    OR
                    (a2.id IS NULL AND i.first_msku IS NOT NULL AND i.first_msku = ? AND i.sid = ?)
                  )

                UNION ALL

                SELECT pp.id,
                    CONCAT_WS('|', ?, ?, ?, ?) AS listing_key,
                    pp.plan_sn, pp.status, pp.status_text, pp.quantity_plan,
                    pp.creator_real_name, pp.create_time_remote, pp.sync_time,
                    1 AS is_local_linked,
                    a3.id AS analysis_record_id,
                    a3.manual_remark AS analysis_manual_remark,
                    a3.remark AS analysis_sys_remark_json
                FROM app_amz_bsr_analysis_record_lingxing a3
                INNER JOIN app_amz_bsr_purchase_plan_lingxing pp ON a3.plan_sn = pp.plan_sn
                WHERE a3.status = 1
                  AND a3.plan_sn IS NOT NULL AND a3.plan_sn != ''
                  AND pp.status IN (${PLAN_STATUSES.join(',')})
                  AND IFNULL(pp.is_deleted_remote, 0) = 0
                  AND a3.asin = ? AND a3.marketplace = ? AND a3.store_id = ? ${p.msku ? 'AND a3.msku = ?' : ''}
            `;
        }).join(' UNION ALL ');

        const finalSql = `
            SELECT
                id, listing_key, plan_sn, status, status_text,
                quantity_plan, creator_real_name, create_time_remote, sync_time,
                MAX(is_local_linked) AS is_local_linked,
                MAX(analysis_record_id) AS analysis_record_id,
                MAX(analysis_manual_remark) AS analysis_manual_remark,
                MAX(analysis_sys_remark_json) AS analysis_sys_remark_json
            FROM (${unionBlocks}) AS combined
            GROUP BY id, listing_key, plan_sn, status, status_text,
                     quantity_plan, creator_real_name, create_time_remote, sync_time
            ORDER BY create_time_remote DESC
        `;

        // 修正参数：路线A 当 mskuJson 为空时，不需要 JSON_CONTAINS 的参数
        // 重新构建参数，处理 msku 为空的情况
        const cleanParamValues: any[] = [];
        for (const p of uniqueProducts) {
            const msku = p.msku || '';
            const mskuJson = msku ? `"${msku}"` : '';

            // 路线A：listing_key 4个(含msku) + (mskuJson ? 1 : 0) + sid + marketplace
            cleanParamValues.push(p.asin, p.marketplace, p.store_id, msku);
            if (mskuJson) cleanParamValues.push(mskuJson);
            cleanParamValues.push(p.store_id, p.marketplace);

            // 路线B：asin + marketplace + store_id + (msku) + msku(first_msku) + store_id
            cleanParamValues.push(p.asin, p.marketplace, p.store_id);
            if (p.msku) cleanParamValues.push(p.msku);
            cleanParamValues.push(msku, p.store_id);

            // 路线C：listing_key 4个(含msku) + asin + marketplace + store_id + (msku)
            cleanParamValues.push(p.asin, p.marketplace, p.store_id, msku);
            cleanParamValues.push(p.asin, p.marketplace, p.store_id);
            if (p.msku) cleanParamValues.push(p.msku);
        }

        const manager = this.orderRepo.manager;
        const rows: any[] = await manager.query(finalSql, cleanParamValues);

        // ========== 组装结果 ==========
        const resultMap: Record<string, { plan_qty: number; plan_count: number; planSnSet: Set<string>; details: any[] }> = {};

        // 预初始化
        uniqueProducts.forEach(p => {
            const key = `${p.asin}|${p.marketplace}|${p.store_id}|${p.msku || ''}`;
            resultMap[key] = { plan_qty: 0, plan_count: 0, planSnSet: new Set<string>(), details: [] };
        });

        for (const row of rows) {
            const key = row.listing_key;
            // 尝试直接匹配
            let entry = resultMap[key];
            if (!entry) {
                // 路线B的 listing_key 可能是 msku|sid| 格式，需要反查到 asin key
                for (const p of uniqueProducts) {
                    const msku = p.msku || '';
                    if (key === `${msku}|${p.store_id}|`) {
                        entry = resultMap[`${p.asin}|${p.marketplace}|${p.store_id}|${msku}`];
                        break;
                    }
                }
            }
            if (!entry) continue;

            const qty = Number(row.quantity_plan) || 0;
            const planSn = this.normalizeText(row.plan_sn);
            if (!planSn) continue;

            // 用计划号去重，避免本地关联和补货中心重复累计。
            if (entry.planSnSet.has(planSn)) continue;
            entry.planSnSet.add(planSn);

            entry.plan_qty += qty;
            entry.plan_count++;

            // 拼装备注（人工备注优先）
            let finalRemark = '';
            if (row.analysis_manual_remark) {
                finalRemark += `[人工] ${row.analysis_manual_remark}\n`;
            }
            if (row.analysis_sys_remark_json) {
                try {
                    const obj = JSON.parse(row.analysis_sys_remark_json);
                    if (obj.remark_text) finalRemark += `[建议] ${obj.remark_text}\n`;
                } catch (e) { }
            }

            const source = Number(row.is_local_linked) === 1 ? 'local' : 'lingxing';
            entry.details.push({
                plan_sn: planSn,
                status: row.status,
                status_text: row.status_text,
                quantity_plan: qty,
                creator_real_name: row.creator_real_name,
                create_time_remote: row.create_time_remote,
                sync_time: row.sync_time,
                analysis_record_id: row.analysis_record_id,
                remark: finalRemark.trim(),
                source,
                source_label: source === 'local' ? '艾为' : '领星'
            });
        }

        const restockingPlansByKey = await this.getRestockingPurchasePlansByProducts(uniqueProducts);
        const restockingPlanSns = [
            ...new Set(
                Array.from(restockingPlansByKey.values())
                    .flat()
                    .map(item => this.normalizeText(item?.orderSn))
                    .filter(Boolean)
            )
        ];

        const alreadySyncedPlanSns = new Set(syncMeta?.planSns || []);
        const restockingPlanSnsToSync = restockingPlanSns.filter(planSn => !alreadySyncedPlanSns.has(planSn));
        let restockingSyncMeta: { attempted: boolean; success: boolean; error?: string; planSns: string[] } | null = null;
        if (syncLinkedPlans && restockingPlanSnsToSync.length > 0) {
            try {
                const syncResult = await this.purchasePlanService.syncPlansFromLingxing(restockingPlanSnsToSync);
                restockingSyncMeta = {
                    attempted: true,
                    success: !syncResult?.error,
                    error: syncResult?.error,
                    planSns: restockingPlanSnsToSync
                };
            } catch (e: any) {
                restockingSyncMeta = {
                    attempted: true,
                    success: false,
                    error: e?.message || '同步补货中心采购计划失败',
                    planSns: restockingPlanSnsToSync
                };
            }
        }

        const restockingPlanInfoMap = new Map<string, AppAmzBsrPurchasePlanLingxingEntity>();
        if (restockingPlanSns.length > 0) {
            const planInfoList = await this.purchasePlanRepo.find({
                where: { plan_sn: In(restockingPlanSns) }
            });
            for (const plan of planInfoList) {
                const planSn = this.normalizeText(plan.plan_sn);
                if (planSn) restockingPlanInfoMap.set(planSn, plan);
            }
        }

        for (const p of uniqueProducts) {
            const key = this.buildPendingPurchasePlanKey(p);
            const entry = resultMap[key];
            if (!entry) continue;

            const restockingPlans = restockingPlansByKey.get(key) || [];
            for (const item of restockingPlans) {
                const planSn = this.normalizeText(item?.orderSn);
                if (!planSn || entry.planSnSet.has(planSn)) continue;

                const planInfo = restockingPlanInfoMap.get(planSn);
                const hasFreshInactiveInfo = syncLinkedPlans
                    && planInfo
                    && (Number(planInfo.is_deleted_remote) === 1 || !PLAN_STATUSES.includes(Number(planInfo.status)));
                if (hasFreshInactiveInfo) continue;

                const usePlanInfo = planInfo
                    && Number(planInfo.is_deleted_remote) !== 1
                    && PLAN_STATUSES.includes(Number(planInfo.status));
                const qty = usePlanInfo ? Number(planInfo.quantity_plan) || 0 : Number(item?.quantity) || 0;
                const statusText = usePlanInfo
                    ? planInfo.status_text
                    : this.normalizeText(item?.statusName) || '待采购';
                const status = usePlanInfo
                    ? planInfo.status
                    : (statusText.includes('待审批') ? 121 : statusText.includes('待采购') ? 2 : null);

                if (status && !PLAN_STATUSES.includes(Number(status))) continue;

                entry.planSnSet.add(planSn);
                entry.plan_qty += qty;
                entry.plan_count++;
                entry.details.push({
                    plan_sn: planSn,
                    status,
                    status_text: statusText,
                    quantity_plan: qty,
                    creator_real_name: usePlanInfo ? planInfo.creator_real_name : '',
                    create_time_remote: usePlanInfo ? planInfo.create_time_remote : null,
                    sync_time: usePlanInfo ? planInfo.sync_time : null,
                    analysis_record_id: usePlanInfo ? planInfo.analysis_record_id : null,
                    remark: usePlanInfo ? this.normalizeText(planInfo.remark || planInfo.plan_remark) : '',
                    source: 'lingxing',
                    source_label: '领星',
                    sync_status: usePlanInfo ? 'synced' : 'fallback',
                    sku: item?.sku || (usePlanInfo ? planInfo.sku : ''),
                    store_name: item?.storeName || (usePlanInfo ? planInfo.seller_name : ''),
                    warehouse_name: item?.whName || (usePlanInfo ? planInfo.warehouse_name : ''),
                    amazon_sale_date: item?.amazonSaleDate || null,
                    expect_arrive_date: item?.expectArriveDate || (usePlanInfo ? planInfo.expect_arrive_time : null)
                });
            }
        }

        // 清理辅助 Set
        const finalResultMap: Record<string, PendingPurchasePlanResult> = {};
        const combinedSyncMeta = syncMeta || restockingSyncMeta
            ? {
                attempted: Boolean(syncMeta?.attempted || restockingSyncMeta?.attempted),
                success: syncMeta?.success !== false && restockingSyncMeta?.success !== false,
                error: [syncMeta?.error, restockingSyncMeta?.error].filter(Boolean).join('；') || null,
                planSns: [
                    ...new Set([
                        ...(syncMeta?.planSns || []),
                        ...(restockingSyncMeta?.planSns || [])
                    ])
                ]
            }
            : null;
        uniqueProducts.forEach(p => {
            const key = `${p.asin}|${p.marketplace}|${p.store_id}|${p.msku || ''}`;
            const data = resultMap[key];
            if (data) {
                finalResultMap[key] = {
                    plan_qty: data.plan_qty,
                    plan_count: data.plan_count,
                    details: data.details,
                    ...(combinedSyncMeta
                        ? {
                            sync_attempted: combinedSyncMeta.attempted,
                            sync_success: combinedSyncMeta.success,
                            sync_error: combinedSyncMeta.error,
                            synced_plan_sns: combinedSyncMeta.planSns
                        }
                        : {})
                };
            }
        });

        return finalResultMap;
    }

    private buildPendingPurchasePlanKey(product: PendingPurchasePlanProduct) {
        return `${product.asin}|${product.marketplace}|${product.store_id}|${product.msku || ''}`;
    }

    private safeJsonArray(value: any): any[] {
        if (Array.isArray(value)) return value;
        if (typeof value === 'string' && value.trim()) {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                return [];
            }
        }
        return [];
    }

    private safeJsonObject(value: any): any {
        if (value && typeof value === 'object' && !Array.isArray(value)) return value;
        if (typeof value === 'string' && value.trim()) {
            try {
                const parsed = JSON.parse(value);
                return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
            } catch (e) {
                return {};
            }
        }
        return {};
    }

    private restockingMatchesPendingProduct(restocking: AppAmzBsrRestockingCenterLingxingEntity, product: PendingPurchasePlanProduct) {
        if (!restocking || !product?.asin || !product?.marketplace) return false;
        if (this.normalizeText(restocking.asin) !== this.normalizeText(product.asin)) return false;

        const marketplaces = this.safeJsonArray((restocking as any).marketplaceList).map(item => this.normalizeText(item));
        if (!marketplaces.includes(this.normalizeText(product.marketplace))) return false;

        const sellerName = this.normalizeText(product.seller_name);
        if (!sellerName) return true;

        const stores = this.safeJsonArray((restocking as any).storeList).map(item => this.normalizeText(item));
        return stores.includes(sellerName);
    }

    private async getRestockingPurchasePlansByProducts(
        products: PendingPurchasePlanProduct[]
    ): Promise<Map<string, any[]>> {
        const result = new Map<string, any[]>();
        const uniqueProducts = products.filter(p => p?.asin && p?.marketplace);
        uniqueProducts.forEach(p => result.set(this.buildPendingPurchasePlanKey(p), []));
        if (uniqueProducts.length === 0) return result;

        const qb = this.restockingCenterRepo
            .createQueryBuilder('restocking')
            .where(new Brackets(qb => {
                uniqueProducts.forEach((p, index) => {
                    const params: Record<string, any> = {
                        [`asin${index}`]: p.asin,
                        [`marketplace${index}`]: JSON.stringify(p.marketplace),
                    };
                    const conditions = [
                        `restocking.asin = :asin${index}`,
                        `JSON_CONTAINS(restocking.marketplaceList, :marketplace${index})`
                    ];

                    if (p.seller_name) {
                        conditions.push(`JSON_CONTAINS(restocking.storeList, :store${index})`);
                        params[`store${index}`] = JSON.stringify(p.seller_name);
                    }

                    const where = conditions.join(' AND ');
                    if (index === 0) qb.where(where, params);
                    else qb.orWhere(where, params);
                });
            }));

        const restockingRows = await qb.getMany();
        for (const product of uniqueProducts) {
            const key = this.buildPendingPurchasePlanKey(product);
            const matchedRows = restockingRows.filter(row => this.restockingMatchesPendingProduct(row, product));
            const plans = matchedRows.flatMap(row => {
                const extInfo = this.safeJsonObject((row as any).extInfo);
                const list = this.safeJsonArray(extInfo.purchasePlanDetailList);
                return list.filter(item => this.normalizeText(item?.orderSn));
            });
            result.set(key, plans);
        }

        return result;
    }

    private async syncLinkedPurchasePlansForProducts(
        products: PendingPurchasePlanProduct[],
        planStatuses: number[]
    ): Promise<{ attempted: boolean; success: boolean; error?: string; planSns: string[] }> {
        if (!products.length) {
            return { attempted: false, success: true, planSns: [] };
        }

        try {
            const qb = this.analysisRecordRepo
                .createQueryBuilder('ar')
                .leftJoin('app_amz_bsr_purchase_plan_lingxing', 'pp', 'pp.plan_sn = ar.plan_sn')
                .select('ar.plan_sn', 'plan_sn')
                .where('ar.status = :recordStatus', { recordStatus: 1 })
                .andWhere('ar.plan_sn IS NOT NULL')
                .andWhere("ar.plan_sn != ''")
                .andWhere('(pp.id IS NULL OR pp.status IN (:...planStatuses))', { planStatuses })
                .andWhere(new Brackets(qb => {
                    products.forEach((p, index) => {
                        const params: Record<string, any> = {
                            [`asin${index}`]: p.asin,
                            [`marketplace${index}`]: p.marketplace,
                            [`storeId${index}`]: p.store_id,
                        };
                        let condition = `ar.asin = :asin${index} AND ar.marketplace = :marketplace${index} AND ar.store_id = :storeId${index}`;
                        if (p.msku) {
                            condition += ` AND ar.msku = :msku${index}`;
                            params[`msku${index}`] = p.msku;
                        }

                        if (index === 0) {
                            qb.where(condition, params);
                        } else {
                            qb.orWhere(condition, params);
                        }
                    });
                }));

            const rows: Array<{ plan_sn: string }> = await qb.getRawMany();
            const planSns = [...new Set(rows.map(row => this.normalizeText(row.plan_sn)).filter(Boolean))];

            if (planSns.length === 0) {
                return { attempted: true, success: true, planSns: [] };
            }

            const syncResult = await this.purchasePlanService.syncPlansFromLingxing(planSns);
            if (syncResult?.error) {
                return {
                    attempted: true,
                    success: false,
                    error: syncResult.error,
                    planSns
                };
            }

            return { attempted: true, success: true, planSns };
        } catch (e: any) {
            console.warn('[getPendingPurchasePlansByProducts] 同步关联采购计划失败，降级使用本地数据:', e?.message || e);
            return {
                attempted: true,
                success: false,
                error: e?.message || '同步关联采购计划失败',
                planSns: []
            };
        }
    }

    private addPlanSns(target: Set<string>, planSns: Iterable<any> | any[]) {
        for (const planSn of planSns || []) {
            const text = this.normalizeText(planSn);
            if (text) {
                target.add(text);
            }
        }
    }

    async refreshAutoCompleteCandidates(param: { limit?: number; all?: boolean; syncPlans?: boolean } = {}) {
        const candidateQuery = buildAutoCompleteCandidateQuery(param);
        const scanScopeText = candidateQuery.limit ? `限制前 ${candidateQuery.limit} 条` : '全量本地候选';
        const planRemarkSourceText = candidateQuery.syncPlans
            ? '会先请求领星采购计划接口刷新备注'
            : '不会请求领星采购计划接口，本次只使用本地 plan_remark';
        console.log(
            `[refreshAutoCompleteCandidates] 开始：扫描本地采购计划备注自动补全候选；` +
            `范围=${scanScopeText}；${planRemarkSourceText}`
        );
        const rows = await this.purchasePlanRepo.query(candidateQuery.sql, candidateQuery.params);
        const planSns = (rows || []).map(row => this.normalizeText(row.plan_sn)).filter(Boolean);
        console.log(`[refreshAutoCompleteCandidates] 本次找到 ${planSns.length} 个候选计划`);
        if (!planSns.length) {
            const emptyAutoComplete = {
                attempted: false,
                total: 0,
                created: 0,
                updated: 0,
                skipped: 0,
                failed: 0,
                warning_count: 0,
                items: [],
            };
            console.log('[refreshAutoCompleteCandidates] 没有可处理候选，本次结束');
            return {
                candidate_count: 0,
                limit: candidateQuery.limit,
                all: candidateQuery.all,
                sync_plans: candidateQuery.syncPlans,
                auto_complete: emptyAutoComplete,
            };
        }
        const autoComplete = await this.runPurchasePlanRemarkAutoComplete(planSns, 'refreshAutoCompleteCandidates', {
            syncPlans: candidateQuery.syncPlans,
        });
        const items = Array.isArray(autoComplete?.items) ? autoComplete.items : [];
        const formatAutoCompleteItem = (item: any) => {
            const planSn = this.normalizeText(item?.plan_sn) || '-';
            const messages = Array.isArray(item?.warnings) && item.warnings.length
                ? item.warnings
                : [item?.message || item?.error || '未返回原因'];
            return `${planSn}：${messages.map(message => this.normalizeText(message)).filter(Boolean).join('；') || '未返回原因'}`;
        };
        const failedItems = items.filter(item => item?.status === 'failed').slice(0, 5);
        const warningItems = items
            .filter(item => Number(item?.warning_count) > 0 || (Array.isArray(item?.warnings) && item.warnings.length > 0))
            .slice(0, 5);
        console.log(
            `[refreshAutoCompleteCandidates] 完成：检查 ${planSns.length} 个计划，` +
            `新生成 ${autoComplete.created || 0}，更新 ${autoComplete.updated || 0}，` +
            `跳过 ${autoComplete.skipped || 0}，失败 ${autoComplete.failed || 0}，` +
            `有警告 ${autoComplete.warning_count || 0}；${planRemarkSourceText}`
        );
        if (failedItems.length) {
            console.warn(`[refreshAutoCompleteCandidates] 失败计划前 ${failedItems.length} 个：${failedItems.map(formatAutoCompleteItem).join(' | ')}`);
        }
        if (warningItems.length) {
            console.warn(`[refreshAutoCompleteCandidates] 警告计划前 ${warningItems.length} 个：${warningItems.map(formatAutoCompleteItem).join(' | ')}`);
        }
        return {
            candidate_count: planSns.length,
            limit: candidateQuery.limit,
            all: candidateQuery.all,
            sync_plans: candidateQuery.syncPlans,
            auto_complete: autoComplete,
        };
    }

    private async runPurchasePlanRemarkAutoComplete(
        planSns: Iterable<any> | any[],
        source: string,
        options: { syncPlans?: boolean } = {}
    ) {
        const uniquePlanSns = [...new Set([...(planSns || [])].map(planSn => this.normalizeText(planSn)).filter(Boolean))];
        if (!uniquePlanSns.length) {
            return {
                attempted: false,
                total: 0,
                created: 0,
                updated: 0,
                skipped: 0,
                failed: 0,
                warning_count: 0,
                items: [],
            };
        }

        try {
            let planRefresh: any = { attempted: false, success: true, syncCount: 0 };
            if (options.syncPlans === true) {
                try {
                    const syncResult = await this.purchasePlanService.syncPlansFromLingxing(uniquePlanSns);
                    planRefresh = { attempted: true, success: !syncResult?.error, ...syncResult };
                    if (syncResult?.error) {
                        throw new Error(syncResult.error);
                    }
                } catch (refreshError: any) {
                    const message = refreshError?.message || '采购计划备注刷新失败';
                    console.warn(`[${source}] 采购计划备注刷新失败，将继续使用本地备注自动补全:`, message);
                    planRefresh = { attempted: true, success: false, error: message };
                }
            }

            const result = await this.purchasePlanRemarkAutoCompleteService.processPlanSns(uniquePlanSns, {
                currentUser: this.getCurrentAdminUser(),
                source,
            });
            console.log(
                `[${source}] 采购计划备注自动补全完成: plan_sn ${uniquePlanSns.length} 个, ` +
                `created=${result.created || 0}, updated=${result.updated || 0}, ` +
                `skipped=${result.skipped || 0}, failed=${result.failed || 0}, ` +
                `warnings=${result.warning_count || 0}`
            );
            return {
                attempted: true,
                plan_refresh: planRefresh,
                ...result,
            };
        } catch (e: any) {
            console.error(`[${source}] 采购计划备注自动补全后置处理失败:`, e?.message || e);
            return {
                attempted: true,
                total: uniquePlanSns.length,
                created: 0,
                updated: 0,
                skipped: 0,
                failed: uniquePlanSns.length,
                warning_count: 0,
                error: e?.message || '采购计划备注自动补全失败',
                items: uniquePlanSns.map(planSn => ({
                    plan_sn: planSn,
                    status: 'failed',
                    message: e?.message || '采购计划备注自动补全失败',
                })),
            };
        }
    }

    private getCurrentAdminUser(): ShipmentPlanLocalCreator {
        const admin = (this.baseCtx as any)?.admin || {};
        const username = this.normalizeText(admin.username);
        return {
            userId: Number(admin.userId) || null,
            username,
            nickname: this.normalizeText(admin.nickName || admin.name || username),
        };
    }

    private normalizeText(value: any) {
        return String(value ?? '').trim();
    }
}
