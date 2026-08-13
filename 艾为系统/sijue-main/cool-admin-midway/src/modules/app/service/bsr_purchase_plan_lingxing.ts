import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In } from 'typeorm';
import { AppAmzBsrPurchasePlanLingxingEntity } from '../entity/bsr_purchase_plan_lingxing';
import { AppAmzBsrAnalysisRecordLingxingEntity } from '../entity/bsr_analysis_record_lingxing';
import { AppAmzBsrBatchReplenishSnapshotEntity } from '../entity/bsr_batch_replenish_snapshot';
import { AppAmzBsrProductListingLingxingEntity } from '../entity/bsr_product_Listing_Lingxing';
import { BaseSysUserEntity } from '../../base/entity/sys/user';
import { LingXingUtils } from '../utils/lingxing/lingxingUtils';
import * as dayjs from 'dayjs';

type PurchaseRemarkUpdateParam = {
    enabled?: boolean;
    product_id?: number;
    productId?: number;
    sku?: string;
    product_name?: string;
    sku_identifier?: string;
    original_purchase_remark?: string;
    purchase_remark?: string;
};

type PurchaseRemarkSyncResult = {
    enabled: boolean;
    changed: boolean;
    status: string;
    message: string;
    before: string;
    after: string;
    current?: string;
    verified: boolean;
    rollback_status: string;
    rollback_verified?: boolean;
    rollback_message?: string;
};

/**
 * 采购计划服务
 */
@Provide()
export class AppAmzBsrPurchasePlanLingxingService extends BaseService {
    @InjectEntityModel(AppAmzBsrPurchasePlanLingxingEntity)
    purchasePlanEntity: Repository<AppAmzBsrPurchasePlanLingxingEntity>;

    @InjectEntityModel(AppAmzBsrAnalysisRecordLingxingEntity)
    analysisRecordEntity: Repository<AppAmzBsrAnalysisRecordLingxingEntity>;

    @InjectEntityModel(AppAmzBsrBatchReplenishSnapshotEntity)
    batchReplenishSnapshotEntity: Repository<AppAmzBsrBatchReplenishSnapshotEntity>;

    @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
    listingEntity: Repository<AppAmzBsrProductListingLingxingEntity>;

    @InjectEntityModel(BaseSysUserEntity)
    userEntity: Repository<BaseSysUserEntity>;

    @Inject()
    lingxingUtils: LingXingUtils;

    // 领星采购计划API路径
    private readonly CREATE_PLAN_API = '/erp/sc/routing/data/local_inventory/createPurchasePlan';
    private readonly GET_PLANS_API = '/erp/sc/routing/data/local_inventory/getPurchasePlans';
    private readonly PRODUCT_INFO_API = '/erp/sc/routing/data/local_inventory/productInfo';
    private readonly PRODUCT_SET_API = '/erp/sc/routing/storage/product/set';

    /**
     * 创建采购计划
     * @param param { sku, quantity_plan, manual_remark, analysis_record_id, analysis_data }
     */
    async createPurchasePlan(param: {
        sku: string;
        quantity_plan: number;
        wid?: number | string;
        require_wid?: boolean;
        manual_remark?: string; // 人工备注，传给领星API的data>>remark
        analysis_record_id?: number;
        return_structured_failure?: boolean;
        purchase_remark_update?: PurchaseRemarkUpdateParam;
        // 新增：分析数据（用于创建分析记录）
        analysis_data?: {
            store_id: number;
            asin: string;
            marketplace: string;
            msku?: string;
            local_sku?: string;
            product_code?: string;
            fnsku?: string;
            expected_sales?: any;
            remark?: string;
            manual_remark?: string;
            batch_replenish_snapshot?: any;
        };
    }) {
        const { sku, quantity_plan, wid: rawWid, require_wid, manual_remark, analysis_record_id, analysis_data, purchase_remark_update, return_structured_failure } = param;
        const currentUser = this.getCurrentAdminUser();
        const lingxingRemark = this.normalizeLingxingRemark(manual_remark)
            || this.normalizeLingxingRemark(analysis_data?.manual_remark);
        const wid = this.normalizePositiveInteger(rawWid);
        let purchaseRemarkSync = this.buildPurchaseRemarkSyncSkipped(
            '采购备注未启用同步，已跳过',
            purchase_remark_update
        );

        if (require_wid && !wid) {
            const message = '缺少采购仓库，未创建采购计划';
            purchaseRemarkSync = this.buildPurchaseRemarkSyncSkipped(
                '采购备注未处理：缺少采购仓库，未创建采购计划',
                purchase_remark_update
            );
            if (return_structured_failure) {
                return this.buildStructuredCreateFailure(message, purchaseRemarkSync);
            }
            throw new Error(message);
        }

        try {
            purchaseRemarkSync = await this.syncPurchaseRemarkBeforeCreate(purchase_remark_update, sku);
        } catch (error) {
            purchaseRemarkSync = error?.purchaseRemarkSync || this.buildPurchaseRemarkSyncFailed(error, purchase_remark_update);
            if (return_structured_failure) {
                return this.buildStructuredCreateFailure('采购备注处理失败，未创建采购计划', purchaseRemarkSync);
            }
            throw error;
        }

        // 获取当前用户的领星ID（用作采购员ID cg_uid）
        let cgUid: number | undefined;
        try {
            const userId = currentUser.userId;
            if (userId) {
                const user = await this.userEntity.findOne({ where: { id: userId } });
                if (user?.lingxingID) {
                    cgUid = Number(user.lingxingID);
                    console.log(`[createPurchasePlan] 当前用户 userId=${userId}, lingxingID=${user.lingxingID}`);
                }
            }
        } catch (e) {
            console.warn('[createPurchasePlan] 获取用户lingxingID失败:', e);
        }

        // 1. 调用领星API创建采购计划
        // 使用原始响应，避免领星 error_details 被 openapi.ts 拆包时丢失
        let apiData: any;
        try {
            const rawResponse = await this.lingxingUtils.httpPost(this.CREATE_PLAN_API, {
                data: [{
                    sku: sku,
                    quantity_plan: quantity_plan,
                    ...(wid ? { wid } : {}),
                    ...(analysis_data?.store_id ? { sid: String(analysis_data.store_id) } : {}),
                    ...(analysis_data?.fnsku ? { fnsku: analysis_data.fnsku } : {}),
                    ...(cgUid ? { cg_uid: cgUid } : {}),
                    ...(lingxingRemark ? { remark: lingxingRemark } : {})
                }]
            }, true);

            console.log('[createPurchasePlan] API Raw Response:', JSON.stringify(rawResponse));
            apiData = this.parseCreatePurchasePlanResponse(rawResponse);
            console.log('[createPurchasePlan] API Data:', JSON.stringify(apiData));
        } catch (error) {
            purchaseRemarkSync = await this.rollbackLocalProductPurchaseRemark(purchaseRemarkSync, purchase_remark_update, sku);
            const message = `创建采购计划失败：${error?.message || '未知错误'}`;
            if (return_structured_failure) {
                return this.buildStructuredCreateFailure(message, purchaseRemarkSync);
            }
            throw new Error(`${message}；${purchaseRemarkSync.message}${purchaseRemarkSync.rollback_message ? `；${purchaseRemarkSync.rollback_message}` : ''}`);
        }

        const { ppg_sn, plan_sn } = apiData;
        const planSnValue = Array.isArray(plan_sn) ? plan_sn[0] : plan_sn;

        // 2. 处理分析记录
        let finalRecordId = analysis_record_id;

        // 校验：如果传了 analysis_record_id，先检查这条暂存记录是否还在数据库中
        if (analysis_record_id) {
            const existingRecord = await this.analysisRecordEntity.findOne({ where: { id: analysis_record_id } });
            if (!existingRecord) {
                console.warn(`[createPurchasePlan] 暂存记录 id=${analysis_record_id} 已不存在，将创建新记录`);
                finalRecordId = undefined; // 清掉，走下面创建新记录的分支
            }
        }

        if (finalRecordId) {
            // 更新已有分析记录
            const purchasePlanCreatedTime = new Date();
            await this.analysisRecordEntity.update(finalRecordId, {
                local_sku: sku,
                ppg_sn: ppg_sn,
                plan_sn: planSnValue,
                quantity_plan: quantity_plan,
                status: 1, // 完结
                purchase_plan_created_by_user_id: currentUser.userId,
                purchase_plan_created_by_username: currentUser.username,
                purchase_plan_created_by_nickname: currentUser.nickname,
                purchase_plan_created_time: purchasePlanCreatedTime,
            });
        } else if (analysis_data) {
            // 创建新的分析记录（状态=1完结）
            const purchasePlanCreatedTime = new Date();
            const newRecord = new AppAmzBsrAnalysisRecordLingxingEntity();
            newRecord.store_id = analysis_data.store_id;
            newRecord.asin = analysis_data.asin;
            newRecord.marketplace = analysis_data.marketplace;
            newRecord.msku = analysis_data.msku || '';
            newRecord.expected_sales = analysis_data.expected_sales;
            newRecord.remark = analysis_data.remark || '';
            newRecord.manual_remark = lingxingRemark;
            newRecord.local_sku = sku;
            newRecord.ppg_sn = ppg_sn;
            newRecord.plan_sn = planSnValue;
            newRecord.quantity_plan = quantity_plan;
            newRecord.purchase_plan_created_by_user_id = currentUser.userId;
            newRecord.purchase_plan_created_by_username = currentUser.username;
            newRecord.purchase_plan_created_by_nickname = currentUser.nickname;
            newRecord.purchase_plan_created_time = purchasePlanCreatedTime;
            newRecord.status = 1; // 完结

            const savedRecord = await this.analysisRecordEntity.save(newRecord);
            finalRecordId = savedRecord.id;
            console.log('[createPurchasePlan] Created analysis record:', finalRecordId);
        }

        // 3. 创建本地采购计划记录（包含双向关联）
        const localPlan = new AppAmzBsrPurchasePlanLingxingEntity();
        localPlan.plan_sn = planSnValue;
        localPlan.ppg_sn = ppg_sn;
        localPlan.sku = sku;
        localPlan.quantity_plan = quantity_plan;
        if (wid) {
            localPlan.wid = wid;
        }
        localPlan.status = 2; // 待采购
        localPlan.status_text = '待采购';
        localPlan.sync_time = null; // 标记需要同步详情
        localPlan.analysis_record_id = finalRecordId; // 关联分析记录

        await this.purchasePlanEntity.save(localPlan);

        const batchReplenishSnapshot = await this.trySaveBatchReplenishSnapshot({
            snapshot: analysis_data?.batch_replenish_snapshot,
            analysisData: analysis_data,
            analysisRecordId: finalRecordId,
            planSn: planSnValue,
            ppgSn: ppg_sn,
            sku,
            quantityPlan: quantity_plan,
            currentUser,
        });

        // 4. 尝试立即同步详情（失败不影响主流程）
        try {
            await this.syncPlansFromLingxing([planSnValue]);
        } catch (e) {
            console.warn('创建后同步详情失败，将在下次查询时自动同步:', e);
        }

        return {
            success: true,
            ppg_sn,
            plan_sn: planSnValue,
            local_id: localPlan.id,
            analysis_record_id: finalRecordId,
            purchase_remark_sync: purchaseRemarkSync,
            batch_replenish_snapshot: batchReplenishSnapshot
        };
    }

    private async trySaveBatchReplenishSnapshot(options: {
        snapshot: any;
        analysisData: any;
        analysisRecordId: number;
        planSn: string;
        ppgSn: string;
        sku: string;
        quantityPlan: number;
        currentUser: { userId: number | null; username: string; nickname: string };
    }) {
        if (!options.snapshot || typeof options.snapshot !== 'object') {
            return {
                saved: false,
                skipped: true,
                message: '未传批量补货快照'
            };
        }
        if (!options.analysisRecordId) {
            return {
                saved: false,
                skipped: true,
                message: '缺少分析记录ID，未保存批量补货快照'
            };
        }

        try {
            const saved = await this.saveBatchReplenishSnapshot(options);
            return {
                saved: true,
                id: saved.id,
                message: '批量补货快照已保存'
            };
        } catch (error) {
            console.warn('[createPurchasePlan] 保存批量补货快照失败:', error);
            return {
                saved: false,
                skipped: false,
                message: `采购计划已创建，但批量补货快照保存失败：${error?.message || '未知错误'}`
            };
        }
    }

    private async saveBatchReplenishSnapshot(options: {
        snapshot: any;
        analysisData: any;
        analysisRecordId: number;
        planSn: string;
        ppgSn: string;
        sku: string;
        quantityPlan: number;
        currentUser: { userId: number | null; username: string; nickname: string };
    }) {
        const { snapshot, analysisData, analysisRecordId, planSn, ppgSn, sku, quantityPlan, currentUser } = options;
        const identity = snapshot.identity || {};
        const quick = snapshot.quick_fields || {};
        const expectedSales = analysisData?.expected_sales || {};

        const summaryJson = this.normalizeSnapshotJson(snapshot.summary_json || snapshot.summary || null);
        const inputJson = this.normalizeSnapshotJson(snapshot.input_json || snapshot.input || null);
        const calculationJson = this.normalizeSnapshotJson(snapshot.calculation_json || snapshot.calculation || null);
        const shippingJson = this.normalizeSnapshotJson(snapshot.shipping_json || snapshot.shipping || null);
        const adjustmentJson = this.normalizeSnapshotJson(snapshot.adjustment_json || snapshot.adjustment || null);
        const coefficientJson = this.normalizeSnapshotJson(snapshot.coefficient_json || snapshot.coefficient || null);
        const inventoryJson = this.normalizeSnapshotJson(snapshot.inventory_json || snapshot.inventory || null);
        const remarkJson = this.normalizeSnapshotJson(snapshot.remark_json || snapshot.remark || null);
        const uiSnapshotJson = this.normalizeSnapshotJson(snapshot.ui_snapshot_json || snapshot.ui_snapshot || null);
        const fullSnapshotJson = this.normalizeSnapshotJson(snapshot.full_snapshot_json || snapshot);

        let entity = await this.batchReplenishSnapshotEntity.findOne({
            where: { analysis_record_id: analysisRecordId }
        });
        if (!entity) {
            entity = new AppAmzBsrBatchReplenishSnapshotEntity();
        }

        entity.analysis_record_id = analysisRecordId;
        entity.plan_sn = this.normalizeNullableText(planSn);
        entity.ppg_sn = this.normalizeNullableText(ppgSn);
        entity.store_id = this.toNullableInteger(
            this.pickSnapshotValue(identity.store_id, quick.store_id, analysisData?.store_id, expectedSales.store_id)
        );
        entity.asin = this.normalizeNullableText(
            this.pickSnapshotValue(identity.asin, quick.asin, analysisData?.asin, expectedSales.asin)
        );
        entity.msku = this.normalizeNullableText(
            this.pickSnapshotValue(identity.msku, quick.msku, analysisData?.msku, expectedSales.msku)
        );
        entity.marketplace = this.normalizeNullableText(
            this.pickSnapshotValue(identity.marketplace, quick.marketplace, analysisData?.marketplace, expectedSales.marketplace)
        );
        entity.product_code = this.normalizeNullableText(
            this.pickSnapshotValue(identity.product_code, quick.product_code, expectedSales.product_code)
        );
        entity.local_sku = this.normalizeNullableText(
            this.pickSnapshotValue(identity.local_sku, quick.local_sku, sku, expectedSales.local_sku)
        );
        entity.snapshot_version = this.toNullableInteger(snapshot.snapshot_version) || 1;
        entity.snapshot_source = this.normalizeNullableText(snapshot.snapshot_source) || 'batch_replenish';
        entity.algorithm_key = this.normalizeNullableText(
            this.pickSnapshotValue(quick.algorithm_key, inputJson?.algorithm?.key, expectedSales.user_selected_algo_key)
        );
        entity.algorithm_name = this.normalizeNullableText(
            this.pickSnapshotValue(quick.algorithm_name, inputJson?.algorithm?.name, expectedSales.user_selected_algo_name)
        );
        entity.cycle_start_date = this.normalizeDateString(
            this.pickSnapshotValue(quick.cycle_start_date, calculationJson?.cycle?.start_date, expectedSales.start_date, expectedSales.startDate)
        );
        entity.cycle_end_date = this.normalizeDateString(
            this.pickSnapshotValue(quick.cycle_end_date, calculationJson?.cycle?.end_date, expectedSales.end_date, expectedSales.endDate)
        );
        entity.daily_avg_sales = this.toNullableNumber(
            this.pickSnapshotValue(quick.daily_avg_sales, inputJson?.daily_avg_sales, expectedSales.base_daily_avg_sales, expectedSales.dailyAvg)
        );
        entity.target_stock_days = this.toNullableInteger(
            this.pickSnapshotValue(quick.target_stock_days, inputJson?.target_stock_days)
        );
        entity.volatility_coefficient = this.toNullableNumber(
            this.pickSnapshotValue(
                quick.volatility_coefficient,
                inputJson?.volatility_coefficient,
                coefficientJson?.volatility_coefficient,
                expectedSales.volatility_coefficient
            )
        );
        entity.system_suggested_qty = this.toNullableInteger(
            this.pickSnapshotValue(quick.system_suggested_qty, calculationJson?.system_suggested_qty, expectedSales.system_suggested_qty)
        );
        entity.actual_purchase_qty = this.toNullableInteger(
            this.pickSnapshotValue(quick.actual_purchase_qty, calculationJson?.actual_purchase_qty_before_box, expectedSales.actual_purchase_qty_before_box)
        );
        entity.final_purchase_qty = this.toNullableInteger(
            this.pickSnapshotValue(quick.final_purchase_qty, calculationJson?.final_purchase_qty, expectedSales.final_replenishment_qty, quantityPlan)
        );
        entity.warehouse_wid = this.toNullableInteger(
            this.pickSnapshotValue(quick.warehouse_wid, inputJson?.warehouse?.wid, expectedSales.warehouse_wid)
        );
        entity.warehouse_name = this.normalizeNullableText(
            this.pickSnapshotValue(quick.warehouse_name, inputJson?.warehouse?.name, expectedSales.warehouse_name)
        );
        entity.adjust_mode = this.normalizeNullableText(
            this.pickSnapshotValue(quick.adjust_mode, adjustmentJson?.mode, expectedSales.shipping_adjust_mode)
        );
        entity.box_pcs = this.toNullableInteger(
            this.pickSnapshotValue(quick.box_pcs, calculationJson?.box_adjustment?.box_pcs, expectedSales.box_pcs)
        );
        entity.summary_json = summaryJson;
        entity.input_json = inputJson;
        entity.calculation_json = calculationJson;
        entity.shipping_json = shippingJson;
        entity.adjustment_json = adjustmentJson;
        entity.coefficient_json = coefficientJson;
        entity.inventory_json = inventoryJson;
        entity.remark_json = remarkJson;
        entity.ui_snapshot_json = uiSnapshotJson;
        entity.full_snapshot_json = fullSnapshotJson;
        entity.created_by = this.toNullableInteger(currentUser.userId);
        entity.created_by_name = this.normalizeNullableText(currentUser.nickname || currentUser.username);

        return await this.batchReplenishSnapshotEntity.save(entity);
    }

    private async syncPurchaseRemarkBeforeCreate(update: PurchaseRemarkUpdateParam | undefined, fallbackSku: string): Promise<PurchaseRemarkSyncResult> {
        if (!update?.enabled) {
            return this.buildPurchaseRemarkSyncSkipped('采购备注未启用同步，已跳过', update);
        }

        const beforeFromClient = this.normalizePurchaseRemark(update.original_purchase_remark);
        const desired = this.normalizePurchaseRemark(update.purchase_remark);

        if (beforeFromClient === desired) {
            return this.buildPurchaseRemarkSyncSkipped('采购备注未修改，已跳过同步', update, beforeFromClient, desired);
        }

        const productInfo = await this.fetchLocalProductInfoForPurchaseRemark(update, fallbackSku);
        const before = this.normalizePurchaseRemark(productInfo?.purchase_remark);
        const productSku = String(productInfo?.sku || update.sku || fallbackSku || '').trim();

        if (!productSku) {
            throw new Error('采购备注更新失败：缺少产品 SKU');
        }

        if (before === desired) {
            return {
                enabled: true,
                changed: false,
                status: 'already_current',
                message: '采购备注已是目标值，已跳过更新并通过验证',
                before,
                after: desired,
                current: before,
                verified: true,
                rollback_status: 'not_needed'
            };
        }

        await this.updateLocalProductPurchaseRemark(productInfo, update, fallbackSku, desired);
        const verifiedInfo = await this.verifyLocalProductPurchaseRemark(update, fallbackSku, desired);
        const current = this.normalizePurchaseRemark(verifiedInfo?.purchase_remark);

        if (current !== desired) {
            const syncResult: PurchaseRemarkSyncResult = {
                enabled: true,
                changed: true,
                status: 'verify_failed',
                message: `采购备注更新后查询验证失败，当前值：${current || '(空)'}`,
                before,
                after: desired,
                current,
                verified: false,
                rollback_status: 'not_needed'
            };
            const rolledBack = await this.rollbackLocalProductPurchaseRemark(syncResult, update, fallbackSku);
            const error: any = new Error(`${syncResult.message}${rolledBack.rollback_message ? `；${rolledBack.rollback_message}` : ''}`);
            error.purchaseRemarkSync = rolledBack;
            throw error;
        }

        return {
            enabled: true,
            changed: true,
            status: 'verified',
            message: '采购备注已更新并验证成功',
            before,
            after: desired,
            current,
            verified: true,
            rollback_status: 'not_needed'
        };
    }

    private async fetchLocalProductInfoForPurchaseRemark(update: PurchaseRemarkUpdateParam | undefined, fallbackSku: string) {
        const productId = update?.product_id ?? update?.productId;
        const sku = String(update?.sku || fallbackSku || '').trim();
        const params = productId ? { id: Number(productId) } : { sku };

        if (!params.id && !params.sku) {
            throw new Error('采购备注查询失败：缺少 product_id 或 SKU');
        }

        const rawResponse: any = await this.lingxingUtils.httpPost(this.PRODUCT_INFO_API, params, true);
        const productInfo = rawResponse?.data ?? rawResponse;
        const responseCode = rawResponse?.code;
        const ok = responseCode === 0 || responseCode === '0' || rawResponse?.message === 'success';

        if (!ok || !productInfo || Array.isArray(productInfo)) {
            throw new Error(rawResponse?.message || rawResponse?.error_details || '采购备注查询失败：领星未返回产品详情');
        }

        return productInfo;
    }

    private async updateLocalProductPurchaseRemark(productInfo: any, update: PurchaseRemarkUpdateParam | undefined, fallbackSku: string, purchaseRemark: string) {
        const sku = String(productInfo?.sku || update?.sku || fallbackSku || '').trim();
        const productName = String(productInfo?.product_name || '').trim();
        const skuIdentifier = String(productInfo?.sku_identifier || '').trim();

        if (!sku) {
            throw new Error('采购备注更新失败：缺少产品 SKU');
        }
        if (!productName) {
            throw new Error('采购备注更新失败：领星产品详情未返回产品名称，为避免覆盖产品资料已停止更新');
        }

        const payload: any = {
            sku,
            product_name: productName,
            purchase_remark: purchaseRemark
        };
        if (skuIdentifier) {
            payload.sku_identifier = skuIdentifier;
        }

        const rawResponse: any = await this.lingxingUtils.httpPost(this.PRODUCT_SET_API, payload, true);
        const responseCode = rawResponse?.code;
        const ok = responseCode === 0 || responseCode === '0' || rawResponse?.message === 'success';

        if (!ok) {
            const detail = Array.isArray(rawResponse?.error_details)
                ? rawResponse.error_details.join('; ')
                : rawResponse?.error_details;
            throw new Error(rawResponse?.message || detail || '采购备注更新失败：领星接口返回异常');
        }

        return rawResponse;
    }

    private async verifyLocalProductPurchaseRemark(update: PurchaseRemarkUpdateParam | undefined, fallbackSku: string, expected: string) {
        let lastInfo: any = null;
        for (let attempt = 0; attempt < 2; attempt++) {
            if (attempt > 0) {
                await this.sleep(800);
            }
            lastInfo = await this.fetchLocalProductInfoForPurchaseRemark(update, fallbackSku);
            if (this.normalizePurchaseRemark(lastInfo?.purchase_remark) === expected) {
                return lastInfo;
            }
        }
        return lastInfo;
    }

    private async rollbackLocalProductPurchaseRemark(
        syncResult: PurchaseRemarkSyncResult,
        update: PurchaseRemarkUpdateParam | undefined,
        fallbackSku: string
    ): Promise<PurchaseRemarkSyncResult> {
        if (!syncResult?.enabled || !syncResult.changed) {
            return syncResult;
        }

        try {
            const productInfo = await this.fetchLocalProductInfoForPurchaseRemark(update, fallbackSku);
            await this.updateLocalProductPurchaseRemark(productInfo, update, fallbackSku, syncResult.before);
            const rollbackInfo = await this.verifyLocalProductPurchaseRemark(update, fallbackSku, syncResult.before);
            const current = this.normalizePurchaseRemark(rollbackInfo?.purchase_remark);
            const rollbackVerified = current === syncResult.before;

            return {
                ...syncResult,
                status: rollbackVerified ? 'rollback_success' : 'rollback_failed',
                rollback_status: rollbackVerified ? 'success' : 'failed',
                rollback_verified: rollbackVerified,
                rollback_message: rollbackVerified
                    ? '采购计划创建失败，采购备注已恢复'
                    : `采购计划创建失败，采购备注恢复验证失败，当前值：${current || '(空)'}`
            };
        } catch (error) {
            return {
                ...syncResult,
                status: 'rollback_failed',
                rollback_status: 'failed',
                rollback_verified: false,
                rollback_message: `采购计划创建失败，采购备注恢复失败：${error?.message || '未知错误'}`
            };
        }
    }

    private buildPurchaseRemarkSyncSkipped(
        message: string,
        update?: PurchaseRemarkUpdateParam,
        before = this.normalizePurchaseRemark(update?.original_purchase_remark),
        after = this.normalizePurchaseRemark(update?.purchase_remark)
    ): PurchaseRemarkSyncResult {
        return {
            enabled: !!update?.enabled,
            changed: false,
            status: update?.enabled ? 'skipped' : 'disabled',
            message,
            before,
            after,
            current: before,
            verified: true,
            rollback_status: 'not_needed'
        };
    }

    private buildPurchaseRemarkSyncFailed(error: any, update?: PurchaseRemarkUpdateParam): PurchaseRemarkSyncResult {
        return {
            enabled: !!update?.enabled,
            changed: this.normalizePurchaseRemark(update?.original_purchase_remark) !== this.normalizePurchaseRemark(update?.purchase_remark),
            status: 'failed',
            message: error?.message || '采购备注处理失败',
            before: this.normalizePurchaseRemark(update?.original_purchase_remark),
            after: this.normalizePurchaseRemark(update?.purchase_remark),
            verified: false,
            rollback_status: 'not_needed'
        };
    }

    private buildStructuredCreateFailure(message: string, purchaseRemarkSync: PurchaseRemarkSyncResult) {
        return {
            success: false,
            plan_created: false,
            ppg_sn: '',
            plan_sn: '',
            local_id: null,
            analysis_record_id: null,
            message,
            purchase_remark_sync: purchaseRemarkSync
        };
    }

    private parseCreatePurchasePlanResponse(rawResponse: any) {
        const apiData = this.findCreatePurchasePlanData(rawResponse);
        if (apiData?.ppg_sn) {
            return apiData;
        }
        throw new Error(this.buildCreatePurchasePlanApiErrorMessage(rawResponse));
    }

    private findCreatePurchasePlanData(value: any): any {
        if (!value) return null;
        if (Array.isArray(value)) {
            return value.find(item => item && typeof item === 'object' && this.normalizeNullableText(item.ppg_sn)) || null;
        }
        if (typeof value !== 'object') return null;
        if (this.normalizeNullableText(value.ppg_sn)) return value;
        if (value.data !== undefined && value.data !== value) {
            return this.findCreatePurchasePlanData(value.data);
        }
        return null;
    }

    private buildCreatePurchasePlanApiErrorMessage(rawResponse: any) {
        const directError = this.pickCreatePurchasePlanErrorText(rawResponse);
        if (directError) return directError;

        const dataError = this.pickCreatePurchasePlanErrorText(rawResponse?.data);
        if (dataError) return dataError;

        return 'API返回数据异常，缺少ppg_sn';
    }

    private pickCreatePurchasePlanErrorText(value: any): string {
        if (!value) return '';
        if (Array.isArray(value)) {
            for (const item of value) {
                const text = this.pickCreatePurchasePlanErrorText(item);
                if (text) return text;
            }
            return '';
        }
        if (typeof value !== 'object') return '';

        const text = this.pickFirstMeaningfulText(
            value.error_details,
            value.errorDetail,
            value.error_message,
            value.message,
            value.msg,
            value.error
        );
        if (!text || this.isSuccessLikeMessage(text)) return '';
        return text;
    }

    private pickFirstMeaningfulText(...values: any[]): string {
        for (const value of values) {
            const text = this.normalizeNullableText(value);
            if (text) return text;
        }
        return '';
    }

    private isSuccessLikeMessage(value: string) {
        const text = value.trim().toLowerCase();
        return text === 'success' || text === 'ok' || text === '成功';
    }

    private normalizePurchaseRemark(value: any): string {
        if (value === undefined || value === null) return '';
        return String(value);
    }

    private normalizePositiveInteger(value: any): number {
        const num = Number(value);
        return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
    }

    private pickSnapshotValue(...values: any[]) {
        for (const value of values) {
            if (value === undefined || value === null || value === '') continue;
            return value;
        }
        return null;
    }

    private normalizeSnapshotJson(value: any) {
        if (value === undefined) return null;
        try {
            return JSON.parse(JSON.stringify(value ?? null));
        } catch (error) {
            return {
                _snapshot_error: 'JSON序列化失败',
                message: error?.message || String(error)
            };
        }
    }

    private normalizeNullableText(value: any): string | null {
        if (value === undefined || value === null) return null;
        const text = String(value).trim();
        return text || null;
    }

    private toNullableNumber(value: any): number | null {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    private toNullableInteger(value: any): number | null {
        const num = this.toNullableNumber(value);
        return num === null ? null : Math.round(num);
    }

    private normalizeDateString(value: any): string | null {
        const text = this.normalizeNullableText(value);
        if (!text) return null;
        const match = text.match(/^\d{4}-\d{2}-\d{2}/);
        return match ? match[0] : null;
    }

    private sleep(ms: number) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 批量从暂存记录创建采购计划
     * 
     * 使用场景：用户在Listing列表页勾选多个产品，一键批量创建采购计划
     * 
     * @param param.items 产品列表，每个包含 asin + marketplace + store_id
     * @param param.include_history 是否包含历史暂存(status=2)，默认false只处理最新暂存(status=0)
     * 
     * @returns 按产品分组的创建结果，每个产品内含暂存记录明细
     */
    async batchCreateFromStaging(param: {
        items: Array<{ asin: string; marketplace: string; store_id: number; record_ids?: number[] }>;
        include_history?: boolean;
    }) {
        const { items, include_history = true } = param;

        if (!items || items.length === 0) {
            return { total_items: 0, total_plans_created: 0, total_failed: 0, total_skipped: 0, results: [] };
        }

        const currentUser = this.getCurrentAdminUser();
        const results: any[] = [];
        let totalPlansCreated = 0;
        let totalFailed = 0;
        let totalSkipped = 0;

        // 获取当前用户的领星ID（用作采购员ID cg_uid）
        let cgUid: number | undefined;
        try {
            const userId = currentUser.userId;
            if (userId) {
                const user = await this.userEntity.findOne({ where: { id: userId } });
                if (user?.lingxingID) {
                    cgUid = Number(user.lingxingID);
                    console.log(`[batchCreateFromStaging] 当前用户 userId=${userId}, lingxingID=${user.lingxingID}`);
                }
            }
        } catch (e) {
            console.warn('[batchCreateFromStaging] 获取用户lingxingID失败:', e);
        }

        console.log(`[batchCreateFromStaging] 开始批量创建，共 ${items.length} 个产品，include_history=${include_history}`);

        for (const item of items) {
            const { asin, marketplace, store_id, record_ids } = item;

            // 1. 查询暂存记录
            // 如果传了 record_ids，只查询指定的记录；否则按 status 查询
            let records: any[];
            if (record_ids && record_ids.length > 0) {
                records = await this.analysisRecordEntity.find({
                    where: record_ids.map(id => ({ id })),
                    order: { createTime: 'DESC' }
                });
            } else {
                const statusList = include_history ? [0, 2] : [0];
                const whereConditions = statusList.map(s => ({ asin, marketplace, store_id, status: s }));
                records = await this.analysisRecordEntity.find({
                    where: whereConditions,
                    order: { createTime: 'DESC' }
                });
            }

            if (records.length === 0) {
                results.push({
                    asin, marketplace, store_id,
                    message: '跳过：该产品没有暂存记录',
                    details: []
                });
                totalSkipped++;
                continue;
            }

            // 2. 逐条处理暂存记录
            const details: any[] = [];
            let itemSuccess = 0;
            let itemFailed = 0;
            let itemSkipped = 0;

            for (const record of records) {
                const localSku = record.local_sku;
                const quantity = record.expected_sales?.finalQty
                    || record.expected_sales?.final_replenishment_qty
                    || record.expected_sales?.totalQty
                    || 0;

                // 校验 local_sku
                if (!localSku) {
                    details.push({
                        record_id: record.id,
                        record_status: record.status === 0 ? '当前暂存' : '历史暂存',
                        local_sku: '',
                        quantity,
                        success: false,
                        message: '跳过：缺少本地SKU，无法创建采购计划'
                    });
                    itemSkipped++;
                    continue;
                }

                // 校验数量
                if (quantity <= 0) {
                    details.push({
                        record_id: record.id,
                        record_status: record.status === 0 ? '当前暂存' : '历史暂存',
                        local_sku: localSku,
                        quantity,
                        success: false,
                        message: '跳过：补货数量为0'
                    });
                    itemSkipped++;
                    continue;
                }

                const lingxingRemark = this.normalizeLingxingRemark(record.manual_remark);

                // 查询 listing 获取 fnsku
                let fnsku = '';
                try {
                    const listing = await this.listingEntity.findOne({
                        where: { asin, marketplace, store_id },
                        select: ['fnsku']
                    });
                    fnsku = listing?.fnsku || '';
                } catch (e) {
                    console.warn(`[batchCreate] 查询fnsku失败: ${asin}`, e);
                }

                try {
                    // 3. 调用领星API创建采购计划
                    const rawResponse = await this.lingxingUtils.httpPost(this.CREATE_PLAN_API, {
                        data: [{
                            sku: localSku,
                            quantity_plan: quantity,
                            ...(store_id ? { sid: String(store_id) } : {}),
                            ...(fnsku ? { fnsku } : {}),
                            ...(cgUid ? { cg_uid: cgUid } : {}),
                            ...(lingxingRemark ? { remark: lingxingRemark } : {})
                        }]
                    }, true);

                    const apiData = this.parseCreatePurchasePlanResponse(rawResponse);
                    const { ppg_sn, plan_sn } = apiData;
                    const planSnValue = Array.isArray(plan_sn) ? plan_sn[0] : plan_sn;

                    // 4. 更新暂存记录为完结
                    const purchasePlanCreatedTime = new Date();
                    await this.analysisRecordEntity.update(record.id, {
                        local_sku: localSku,
                        ppg_sn: ppg_sn,
                        plan_sn: planSnValue,
                        quantity_plan: quantity,
                        status: 1, // 完结
                        purchase_plan_created_by_user_id: currentUser.userId,
                        purchase_plan_created_by_username: currentUser.username,
                        purchase_plan_created_by_nickname: currentUser.nickname,
                        purchase_plan_created_time: purchasePlanCreatedTime,
                    });

                    // 5. 创建本地采购计划记录
                    const localPlan = new AppAmzBsrPurchasePlanLingxingEntity();
                    localPlan.plan_sn = planSnValue;
                    localPlan.ppg_sn = ppg_sn;
                    localPlan.sku = localSku;
                    localPlan.quantity_plan = quantity;
                    localPlan.status = 2; // 待采购
                    localPlan.status_text = '待采购';
                    localPlan.sync_time = null;
                    localPlan.analysis_record_id = record.id;

                    await this.purchasePlanEntity.save(localPlan);

                    // 6. 尝试同步详情（失败不中断）
                    try {
                        await this.syncPlansFromLingxing([planSnValue]);
                    } catch (e) {
                        console.warn(`[batchCreate] 同步详情失败(不影响): ${planSnValue}`, e);
                    }

                    details.push({
                        record_id: record.id,
                        record_status: record.status === 0 ? '当前暂存' : '历史暂存',
                        local_sku: localSku,
                        quantity,
                        success: true,
                        message: '创建成功',
                        plan_sn: planSnValue,
                        ppg_sn: ppg_sn
                    });

                    itemSuccess++;
                    totalPlansCreated++;

                    console.log(`[batchCreate] 成功: ${asin} record_id=${record.id} → ${planSnValue}`);

                } catch (e: any) {
                    details.push({
                        record_id: record.id,
                        record_status: record.status === 0 ? '当前暂存' : '历史暂存',
                        local_sku: localSku,
                        quantity,
                        success: false,
                        message: `失败：${e.message || '未知错误'}`
                    });

                    itemFailed++;
                    totalFailed++;

                    console.error(`[batchCreate] 失败: ${asin} record_id=${record.id}`, e.message);
                }

                // 7. 节流 200ms，防止领星API限流
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // 汇总该产品的结果
            const parts: string[] = [];
            parts.push(`找到${records.length}条暂存`);
            if (itemSuccess > 0) parts.push(`成功${itemSuccess}条`);
            if (itemFailed > 0) parts.push(`失败${itemFailed}条`);
            if (itemSkipped > 0) parts.push(`跳过${itemSkipped}条`);

            results.push({
                asin, marketplace, store_id,
                message: parts.join('，'),
                details
            });
        }

        const summary = `批量创建完成：共${items.length}个产品，创建${totalPlansCreated}个采购计划，失败${totalFailed}个，跳过${totalSkipped}个`;
        console.log(`[batchCreateFromStaging] ${summary}`);

        return {
            total_items: items.length,
            total_plans_created: totalPlansCreated,
            total_failed: totalFailed,
            total_skipped: totalSkipped,
            message: summary,
            results
        };
    }

    /**
     * 检查是否已有待采购计划
     * @param sku SKU
     */
    async checkExistingPlan(sku: string) {
        const existingPlans = await this.purchasePlanEntity.find({
            where: {
                sku: sku,
                status: 2, // 待采购
                is_deleted_remote: 0,
            },
            order: {
                createTime: 'DESC'
            }
        });

        return {
            hasExisting: existingPlans.length > 0,
            plans: existingPlans.map(p => ({
                plan_sn: p.plan_sn,
                quantity_plan: p.quantity_plan,
                createTime: p.createTime,
                status_text: p.status_text,
                creator_real_name: p.creator_real_name
            }))
        };
    }

    /**
     * 根据产品维度批量查询近N天的采购计划
     *
     * @param param.days 近几天，默认3天
     * @param param.items 产品列表，每个包含 asin + marketplace + store_id
     * @returns 按产品分组的采购计划列表
     */
    async getByProduct(param: {
        days?: number;
        items: Array<{ asin: string; marketplace: string; store_id: number }>;
    }) {
        const { days = 3, items } = param;

        // 参数校验
        if (!items || items.length === 0) {
            return { total: 0, list: [] };
        }

        // 计算日期阈值（精确到天）
        const dateThreshold = dayjs().subtract(days, 'day').format('YYYY-MM-DD');

        // 构建 QueryBuilder，一次 SQL 搞定
        const qb = this.purchasePlanEntity
            .createQueryBuilder('pp')
            .innerJoin(
                'app_amz_bsr_analysis_record_lingxing',
                'ar',
                'ar.plan_sn = pp.plan_sn AND ar.status = 1'
            )
            .select([
                'ar.asin AS asin',
                'ar.marketplace AS marketplace',
                'ar.store_id AS store_id',
                'pp.plan_sn AS plan_sn',
                'pp.quantity_plan AS quantity_plan',
                'pp.status AS status',
                'pp.status_text AS status_text',
                'pp.creator_real_name AS creator_real_name',
                'pp.create_time_remote AS create_time_remote'
            ])
            .where(`DATE(pp.create_time_remote) >= :dateThreshold`, { dateThreshold })
            .orderBy('pp.create_time_remote', 'DESC');

        // 构建批量产品筛选条件
        const orConditions = items.map((item, idx) =>
            `(ar.asin = :asin${idx} AND ar.marketplace = :marketplace${idx} AND ar.store_id = :storeId${idx})`
        ).join(' OR ');

        qb.andWhere(`(${orConditions})`);

        items.forEach((item, idx) => {
            qb.setParameter(`asin${idx}`, item.asin);
            qb.setParameter(`marketplace${idx}`, item.marketplace);
            qb.setParameter(`storeId${idx}`, item.store_id);
        });

        // 执行查询
        const rawList = await qb.getRawMany();

        // 初始化分组 Map（保证没有采购计划的产品也返回）
        const groupedMap = new Map<string, any>();

        items.forEach(item => {
            const key = `${item.asin}_${item.marketplace}_${item.store_id}`;
            groupedMap.set(key, {
                asin: item.asin,
                marketplace: item.marketplace,
                store_id: item.store_id,
                plan_count: 0,
                total_quantity: 0,
                plans: []
            });
        });

        // 填充有采购计划的数据
        rawList.forEach((row: any) => {
            const key = `${row.asin}_${row.marketplace}_${row.store_id}`;
            const group = groupedMap.get(key);

            if (group) {
                group.plan_count++;
                group.total_quantity += row.quantity_plan || 0;
                group.plans.push({
                    plan_sn: row.plan_sn,
                    quantity_plan: row.quantity_plan,
                    status: row.status,
                    status_text: row.status_text,
                    creator_real_name: row.creator_real_name,
                    create_time_remote: row.create_time_remote
                });
            }
        });

        // 返回结果
        const list = Array.from(groupedMap.values());

        return {
            total: list.filter(item => item.plan_count > 0).length,
            list
        };
    }

    /**
    /**
     * 从领星同步采购计划
     * @param planSns 计划编号数组
     * @returns { syncCount, error?, errorType? }
     */
    async syncPlansFromLingxing(planSns: string[]): Promise<{ syncCount: number; error?: string; errorType?: string }> {
        if (!planSns || planSns.length === 0) {
            return { syncCount: 0 };
        }

        // 调用领星API查询
        let allData: any[] = [];
        let apiError: { message: string; type: string } | null = null;

        try {
            allData = await this.fetchAllPagesFromLingxing(planSns);
        } catch (e: any) {
            apiError = {
                message: e.message || '领星API调用失败',
                type: e.errorType || 'API_ERROR'
            };
        }

        if (apiError) {
            return {
                syncCount: 0,
                error: apiError.message,
                errorType: apiError.type
            };
        }

        if (allData.length === 0) {
            // 没查到数据，可能已被删除
            await this.purchasePlanEntity.update(
                { plan_sn: In(planSns) },
                { is_deleted_remote: 1, sync_time: new Date() }
            );
            return { syncCount: 0 };
        }

        // 更新本地数据
        let syncCount = 0;
        for (const item of allData) {
            const existingPlan = await this.purchasePlanEntity.findOne({
                where: { plan_sn: item.plan_sn }
            });

            if (existingPlan) {
                // 更新已有记录
                await this.updatePlanFromApiData(existingPlan.id, item);
            } else {
                // 创建新记录（理论上不会走到这里）
                await this.createPlanFromApiData(item);
            }
            syncCount++;
        }

        // 检查哪些plan_sn在API中没有返回（可能被删除）
        const returnedPlanSns = allData.map(d => d.plan_sn);

        const missingPlanSns = planSns.filter(sn => !returnedPlanSns.includes(sn));
        if (missingPlanSns.length > 0) {
            await this.purchasePlanEntity.update(
                { plan_sn: In(missingPlanSns) },
                { is_deleted_remote: 1, sync_time: new Date() }
            );
        }

        return { syncCount };
    }

    /**
     * 从领星API获取所有分页数据
     * 注：httpPost 返回的直接是 data 数组，不是 { code, data } 结构
     * @throws 如果API返回错误，抛出带有 errorType 的异常
     */
    private async fetchAllPagesFromLingxing(planSns: string[]): Promise<any[]> {
        const allData: any[] = [];
        let offset = 0;
        const length = 500;

        while (true) {
            const dataList = await this.lingxingUtils.httpPost(this.GET_PLANS_API, {
                search_field_time: 'creator_time',
                start_date: '1970-01-01',
                end_date: '2099-12-31',
                plan_sns: planSns,
                offset,
                length
            });

            console.log('[fetchAllPagesFromLingxing] Received data count:', Array.isArray(dataList) ? dataList.length : 'not array');

            // httpPost 直接返回 data 数组，如果不是数组说明出错了
            if (!Array.isArray(dataList)) {
                console.error('查询领星采购计划失败: 返回数据不是数组', dataList);
                // 检查是否是 Token 过期
                if (dataList && (dataList.code === '2001005' || dataList.msg?.includes('token'))) {
                    const error = new Error('领星Token已过期，请重新授权');
                    (error as any).errorType = 'TOKEN_EXPIRED';
                    throw error;
                }
                const error = new Error('领星API返回异常数据');
                (error as any).errorType = 'API_ERROR';
                throw error;
            }

            allData.push(...dataList);

            if (dataList.length < length) {
                break; // 没有更多数据
            }
            offset += length;
        }

        return allData;
    }

    /**
     * 从API数据更新本地记录
     */
    private async updatePlanFromApiData(id: number, apiData: any) {
        await this.purchasePlanEntity.update(id, {
            ppg_sn: apiData.ppg_sn,
            sku: apiData.sku,
            product_name: apiData.product_name,
            pic_url: apiData.pic_url,
            product_id: apiData.product_id,
            fnsku: apiData.fnsku,
            msku: apiData.msku,
            spu: apiData.spu,
            spu_name: apiData.spu_name,
            attribute: apiData.attribute,
            sid: apiData.sid,
            seller_name: apiData.seller_name,
            marketplace: apiData.marketplace,
            quantity_plan: apiData.quantity_plan,
            cg_box_pcs: apiData.cg_box_pcs,
            expect_arrive_time: apiData.expect_arrive_time ? new Date(apiData.expect_arrive_time) : null,
            status: apiData.status,
            status_text: apiData.status_text,
            supplier_id: apiData.supplier_id,
            supplier_name: apiData.supplier_name,
            wid: apiData.wid,
            warehouse_name: apiData.warehouse_name,
            purchaser_id: apiData.purchaser_id,
            purchaser_name: apiData.purchaser_name,
            cg_uid: apiData.cg_uid,
            cg_opt_username: apiData.cg_opt_username,
            creator_uid: apiData.creator_uid,
            creator_real_name: apiData.creator_real_name,
            create_time_remote: apiData.create_time ? new Date(apiData.create_time) : null,
            update_time_remote: apiData.update_time ? new Date(apiData.update_time) : null,
            gmt_modified: apiData.gmt_modified ? new Date(apiData.gmt_modified) : null,
            group_id: apiData.group_id,
            perm_username: apiData.perm_username,
            audit_uids: apiData.audit_uids,
            remark: apiData.remark,
            plan_remark: apiData.plan_remark,
            file: apiData.file,
            is_combo: apiData.is_combo || 0,
            is_aux: apiData.is_aux || 0,
            is_related_process_plan: apiData.is_related_process_plan || 0,
            is_deleted_remote: 0,
            sync_time: new Date(),
        });
    }

    /**
     * 从API数据创建本地记录
     * 自动反查 analysis_record 表设置关联ID
     */
    private async createPlanFromApiData(apiData: any) {
        const plan = new AppAmzBsrPurchasePlanLingxingEntity();
        plan.plan_sn = apiData.plan_sn;
        plan.ppg_sn = apiData.ppg_sn;
        plan.sku = apiData.sku;
        plan.product_name = apiData.product_name;
        plan.pic_url = apiData.pic_url;
        plan.product_id = apiData.product_id;
        plan.fnsku = apiData.fnsku;
        plan.msku = apiData.msku;
        plan.spu = apiData.spu;
        plan.spu_name = apiData.spu_name;
        plan.attribute = apiData.attribute;
        plan.sid = apiData.sid;
        plan.seller_name = apiData.seller_name;
        plan.marketplace = apiData.marketplace;
        plan.quantity_plan = apiData.quantity_plan;
        plan.cg_box_pcs = apiData.cg_box_pcs;
        plan.expect_arrive_time = apiData.expect_arrive_time ? new Date(apiData.expect_arrive_time) : null;
        plan.status = apiData.status;
        plan.status_text = apiData.status_text;
        plan.supplier_id = apiData.supplier_id;
        plan.supplier_name = apiData.supplier_name;
        plan.wid = apiData.wid;
        plan.warehouse_name = apiData.warehouse_name;
        plan.purchaser_id = apiData.purchaser_id;
        plan.purchaser_name = apiData.purchaser_name;
        plan.cg_uid = apiData.cg_uid;
        plan.cg_opt_username = apiData.cg_opt_username;
        plan.creator_uid = apiData.creator_uid;
        plan.creator_real_name = apiData.creator_real_name;
        plan.create_time_remote = apiData.create_time ? new Date(apiData.create_time) : null;
        plan.update_time_remote = apiData.update_time ? new Date(apiData.update_time) : null;
        plan.gmt_modified = apiData.gmt_modified ? new Date(apiData.gmt_modified) : null;
        plan.group_id = apiData.group_id;
        plan.perm_username = apiData.perm_username;
        plan.audit_uids = apiData.audit_uids;
        plan.remark = apiData.remark;
        plan.plan_remark = apiData.plan_remark;
        plan.file = apiData.file;
        plan.is_combo = apiData.is_combo || 0;
        plan.is_aux = apiData.is_aux || 0;
        plan.is_related_process_plan = apiData.is_related_process_plan || 0;
        plan.is_deleted_remote = 0;
        plan.sync_time = new Date();

        // 反查 analysis_record 表，设置关联ID（只查已完结的记录）
        const analysisRecord = await this.analysisRecordEntity.findOne({
            where: {
                plan_sn: apiData.plan_sn,
                status: 1  // 只找已完结的
            },
            order: {
                createTime: 'DESC'  // 取最新的
            }
        });
        if (analysisRecord) {
            plan.analysis_record_id = analysisRecord.id;
        }

        await this.purchasePlanEntity.save(plan);
    }

    /**
     * 智能分页查询 - 自动同步过期或无数据的记录
     */
    async smartPage(param: any) {
        // 1. 先执行普通分页查询
        const { page = 1, size = 20, ...query } = param;
        const skip = (page - 1) * size;

        const [list, total] = await this.purchasePlanEntity.findAndCount({
            where: query,
            order: { createTime: 'DESC' },
            skip,
            take: size,
        });

        // 2. 检查哪些记录需要同步
        const needSyncPlanSns: string[] = [];
        const oneDayAgo = dayjs().subtract(1, 'day').toDate();

        for (const item of list) {
            // 条件1: 没有详细数据（只有plan_sn）
            const hasNoDetail = !item.product_name && !item.status_text;
            // 条件2: 同步时间超过1天
            const syncTimeExpired = !item.sync_time || new Date(item.sync_time) < oneDayAgo;

            if (hasNoDetail || syncTimeExpired) {
                needSyncPlanSns.push(item.plan_sn);
            }
        }

        // 3. 批量同步
        if (needSyncPlanSns.length > 0) {
            try {
                await this.syncPlansFromLingxing(needSyncPlanSns);
                // 重新查询获取最新数据
                const [updatedList] = await this.purchasePlanEntity.findAndCount({
                    where: query,
                    order: { createTime: 'DESC' },
                    skip,
                    take: size,
                });
                return {
                    list: updatedList,
                    pagination: { page, size, total }
                };
            } catch (e) {
                console.warn('智能同步失败，返回缓存数据:', e);
            }
        }

        return {
            list,
            pagination: { page, size, total }
        };
    }

    /**
     * 获取关联的分析记录详情
     * @param analysisRecordId 分析记录ID
     */
    async getAnalysisRecordById(analysisRecordId: number) {
        if (!analysisRecordId) {
            return null;
        }

        const record = await this.analysisRecordEntity.findOne({
            where: { id: analysisRecordId }
        });

        if (!record) {
            return null;
        }

        // 解析 remark JSON
        let parsedRemark = null;
        if (record.remark) {
            try {
                parsedRemark = JSON.parse(record.remark);
            } catch (e) {
                parsedRemark = { raw: record.remark };
            }
        }

        return {
            id: record.id,
            store_id: record.store_id,
            asin: record.asin,
            marketplace: record.marketplace,
            msku: record.msku,
            expected_sales: record.expected_sales,
            status: record.status,
            plan_sn: record.plan_sn,
            remark: parsedRemark,
            manual_remark: record.manual_remark,
            createTime: record.createTime
        };
    }

    /**
     * 自定义分页查询 - 支持日期范围筛选
     */
    async customPage(param: {
        page?: number;
        size?: number;
        status?: number;
        is_deleted_remote?: number;
        startDate?: string;
        endDate?: string;
        keyWord?: string;
        plan_sns?: string[];
        order?: string;
        sort?: string;
    }) {
        const { page = 1, size = 20, status, is_deleted_remote, startDate, endDate, keyWord, plan_sns, order, sort } = param;
        const hasPlanSnFilter = Array.isArray(plan_sns);
        const planSns = hasPlanSnFilter
            ? Array.from(new Set(plan_sns.map(sn => String(sn || '').trim()).filter(Boolean)))
            : [];

        if (hasPlanSnFilter && planSns.length === 0) {
            return {
                list: [],
                pagination: { page, size, total: 0 }
            };
        }

        const qb = this.purchasePlanEntity.createQueryBuilder('pp');

        if (planSns.length > 0) {
            qb.andWhere('pp.plan_sn IN (:...planSns)', { planSns });
        }

        // 状态筛选
        if (status !== undefined && status !== null) {
            qb.andWhere('pp.status = :status', { status });
        }

        // 领星状态筛选
        if (is_deleted_remote !== undefined && is_deleted_remote !== null) {
            qb.andWhere('pp.is_deleted_remote = :is_deleted_remote', { is_deleted_remote });
        }

        // 日期范围筛选
        if (startDate) {
            qb.andWhere('pp.createTime >= :startDate', { startDate: `${startDate} 00:00:00` });
        }
        if (endDate) {
            qb.andWhere('pp.createTime <= :endDate', { endDate: `${endDate} 23:59:59` });
        }

        // 关键字搜索
        if (keyWord) {
            qb.andWhere('(pp.plan_sn LIKE :kw OR pp.sku LIKE :kw OR pp.product_name LIKE :kw)', { kw: `%${keyWord}%` });
        }

        // 排序
        const orderField = order || 'createTime';
        const sortDir = (sort?.toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
        qb.orderBy(`pp.${orderField}`, sortDir);

        // 分页
        const skip = (page - 1) * size;
        qb.skip(skip).take(size);

        // 关联查询 analysis_record 以检查数据完整性
        qb.leftJoinAndMapOne(
            'pp.analysis_record',
            AppAmzBsrAnalysisRecordLingxingEntity,
            'ar',
            'ar.id = pp.analysis_record_id'
        );

        const [list, total] = await qb.getManyAndCount();

        // 处理列表，标记分析数据丢失的情况
        const resultList = list.map((item: any) => {
            // 如果有 analysis_record_id 但没有查询到 analysis_record，说明数据丢失
            if (item.analysis_record_id && !item.analysis_record) {
                item.analysis_data_missing = true;
            } else {
                item.analysis_data_missing = false;
            }
            // 移除 analysis_record 对象，避免返回过多冗余数据
            delete item.analysis_record;
            return item;
        });

        return {
            list: resultList,
            pagination: { page, size, total }
        };
    }

    /**
     * 悬浮查看明细专用接口（带前端容错降级）
     */
    async getPlanDetailsForHover(planSns: string[]) {
        if (!planSns || planSns.length === 0) return { is_degraded: false, list: [] };

        // 1. 获取本地数据库现有记录
        let localData = await this.purchasePlanEntity.find({
            where: { plan_sn: In(planSns) }
        });

        // 2. 检查哪些记录需要重新同步 (距离上次同步超过2小时)
        const twoHoursAgo = dayjs().subtract(2, 'hour').toDate();
        const needSyncPlanSns: string[] = [];

        for (const sn of planSns) {
            const item = localData.find(p => p.plan_sn === sn);
            if (!item) {
                // 本地库完全没有，必须同步
                needSyncPlanSns.push(sn);
            } else {
                // 本地库有，但没有详细数据或最后同步时间已超过2小时
                const hasNoDetail = !item.product_name && !item.status_text;
                const syncTimeExpired = !item.sync_time || new Date(item.sync_time) < twoHoursAgo;
                if (hasNoDetail || syncTimeExpired) {
                    needSyncPlanSns.push(sn);
                }
            }
        }

        let is_degraded = false;

        // 3. 执行同步
        if (needSyncPlanSns.length > 0) {
            try {
                const syncResult = await this.syncPlansFromLingxing(needSyncPlanSns);
                if (syncResult && syncResult.error) {
                    // 同步方法内捕获到了错误并返回
                    is_degraded = true;
                    console.warn(`[getPlanDetailsForHover] 悬浮同步失败(API内部错误)，降级使用本地数据: ${syncResult.error}`);
                } else {
                    // 成功同步，重新查询本地最新数据
                    localData = await this.purchasePlanEntity.find({
                        where: { plan_sn: In(planSns) }
                    });
                }
            } catch (e: any) {
                // 意外崩溃错误捕获
                is_degraded = true;
                console.warn(`[getPlanDetailsForHover] 悬浮同步发生严重异常，降级使用本地数据: ${e.message}`);
            }
        }

        // 4. 处理返回结果（筛选核心字段）
        const resultList = localData.map(item => ({
            plan_sn: item.plan_sn,
            product_name: item.product_name,
            sku: item.sku,
            pic_url: item.pic_url,
            quantity_plan: item.quantity_plan,
            status_text: item.status_text,
            is_deleted_remote: item.is_deleted_remote,
            sync_time: item.sync_time
        }));

        return {
            is_degraded, // 前端依靠此标识展现警告
            list: resultList
        };
    }

    /**
     * 查询其他店铺的同品listing
     * 根据 product_code + marketplace 查询当前用户有权限的所有店铺的 listing
     * @param param { product_code, marketplace }
     */
    async getOtherStoreListings(param: { product_code: string; marketplace: string }) {
        const { product_code, marketplace } = param;
        if (!product_code || !marketplace) {
            throw new Error('缺少必要参数: product_code 或 marketplace');
        }

        // 1. 获取当前用户信息
        const userId = (this.baseCtx as any).admin?.userId;
        const username = (this.baseCtx as any).admin?.username;
        if (!userId) {
            throw new Error('无法获取当前用户信息');
        }

        // 2. 构建查询条件
        const whereCondition: any = {
            product_code: String(product_code),
            marketplace,
        };

        // 管理员不限制 sidList，普通用户按 sidList 过滤
        if (username !== 'admin') {
            const user = await this.userEntity.findOne({ where: { id: userId } });
            if (!user) {
                throw new Error('用户不存在');
            }
            const sidList = user.sidList;
            if (!sidList || sidList.length === 0) {
                return [];
            }
            whereCondition.store_id = In(sidList);
        }

        // 3. 查询 listing 表
        const listings = await this.listingEntity.find({
            where: whereCondition,
            select: [
                'id', 'store_id', 'shop', 'asin', 'local_sku', 'msku', 'fnsku',
                'seller_name', 'item_name', 'image_url', 'local_name',
                'status_text', 'status', 'variant_text', 'price',
                'afn_fulfillable_quantity', 'dailyAvgSales', 'marketplace',
            ],
        });

        console.log(`[getOtherStoreListings] user=${username}, product_code=${product_code}, marketplace=${marketplace}, found=${listings.length}`);
        return listings;
    }

    private getCurrentAdminUser() {
        const admin = (this.baseCtx as any)?.admin || {};
        const username = this.normalizeText(admin.username);
        return {
            userId: Number(admin.userId) || null,
            username,
            nickname: this.normalizeText(admin.nickName || admin.name || username),
        };
    }

    private normalizeLingxingRemark(value: any) {
        return this.normalizeText(value);
    }

    private normalizeText(value: any) {
        return String(value ?? '').trim();
    }
}
