import { BaseService } from '@cool-midway/core';
import { Inject, Provide } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { createHash } from 'crypto';
import dayjs = require('dayjs');
import { In, Repository } from 'typeorm';
import { AppAmzBsrAnalysisRecordLingxingEntity } from '../entity/bsr_analysis_record_lingxing';
import { AppAmzBsrBatchReplenishSnapshotEntity } from '../entity/bsr_batch_replenish_snapshot';
import { AppAmzBsrProductListingLingxingEntity } from '../entity/bsr_product_Listing_Lingxing';
import { AppAmzBsrLogisticsWarehouseEntity } from '../entity/bsr_logistics_warehouse';
import { AppAmzBsrPurchasePlanRemarkAutoCompleteStatusEntity } from '../entity/bsr_purchase_plan_remark_auto_complete_status';
import { AppAmzBsrPurchaseOrderItemSyncLingxingEntity } from '../entity/bsr_purchase_order_item_sync_lingxing';
import { AppAmzBsrPurchaseOrderSyncLingxingEntity } from '../entity/bsr_purchase_order_sync_lingxing';
import { AppAmzBsrPurchasePlanLingxingEntity } from '../entity/bsr_purchase_plan_lingxing';
import { buildAutoCompleteSnapshotDisplayState } from '../utils/purchase/purchase_plan_auto_complete_snapshot';
import {
  AUTO_REPLENISH_SHIPPING_METHODS,
  AUTO_REPLENISH_SHIPPING_PROFILES,
  AutoReplenishShippingMethodKey,
  AutoReplenishShippingProfileKey,
  getAutoReplenishRemarkMetadata,
  parsePurchasePlanAutoReplenishRemark,
  PurchasePlanAutoReplenishParseResult,
} from '../utils/purchase/purchase_plan_remark_parser';
import { calculateReplenishmentShippingSegments } from '../utils/purchase/replenishment_shipping_calculator';

export const AUTO_REPLENISH_SNAPSHOT_SOURCE = 'purchase_plan_remark_auto_complete';
export const AUTO_REPLENISH_SNAPSHOT_LABEL = '采购计划备注自动补全';

const PROTECTED_SNAPSHOT_SOURCES = new Set(['batch_replenish', 'purchase_order_manual_link']);
const DEFAULT_TARGET_STOCK_DAYS = 20;
const DEFAULT_VOLATILITY_COEFFICIENT = 0.75;
const DEFAULT_MANUAL_COEFFICIENT = 1;
const DEFAULT_SHIPPING_BUFFER_DAYS = 5;

const SHIPPING_METHODS = AUTO_REPLENISH_SHIPPING_METHODS;
const SHIPPING_PROFILES = AUTO_REPLENISH_SHIPPING_PROFILES;

interface AutoCompleteCurrentUser {
  userId: number | null;
  username: string;
  nickname: string;
}

interface AutoCompleteDraftBuildInput {
  parsed: PurchasePlanAutoReplenishParseResult;
  orderItem: any;
  purchaseOrder: any;
  purchasePlan: any;
  listing: any;
  totalPurchaseQty: number;
  currentUser: AutoCompleteCurrentUser;
  warehouseMatch?: AutoCompleteWarehouseMatch;
  planStartResolution?: AutoCompletePlanStartResolution;
  contextHash?: string;
  warnings?: string[];
}

export interface AutoCompletePlanStartResolution {
  value: string;
  source: 'remark' | 'purchase_plan' | 'purchase_order' | 'missing';
  source_label: string;
  field_name: string;
}

export interface AutoCompleteWarehouseMatch {
  matched: boolean;
  warehouse_wid: number | null;
  warehouse_name: string;
  requested_name: string;
  source: string;
  confirmation_required: boolean;
  reason: string;
}

interface AutoCompleteShippingSegmentInput {
  method_key: string;
  method_label?: string;
  days_to_arrive?: number;
  active?: boolean;
  start_date?: string;
  end_date?: string;
  period_days?: number;
  system_suggested_qty?: number;
  final_qty?: number;
  coefficient?: number;
  raw_coefficient?: number;
  adjusted_coefficient?: number;
  calculation_trace?: any;
}

interface AutoCompleteSnapshotDraftInput {
  algorithm_key?: string;
  algorithm_name?: string;
  algorithm_engine_key?: string;
  algorithm_engine_name?: string;
  daily_avg_sales?: number;
  target_stock_days?: number;
  volatility_coefficient?: number;
  manual_coefficient?: number;
  cycle_start_date?: string;
  cycle_end_date?: string;
  system_suggested_qty?: number;
  actual_purchase_qty_before_box?: number;
  final_purchase_qty?: number;
  box_pcs?: number | null;
  warehouse_wid?: number | string | null;
  warehouse_name?: string;
  warehouse_resolution_locked?: boolean;
  shipping_adjust_mode?: string;
  shipping_profile?: any;
  manual_remark?: string;
  shipping_segments?: AutoCompleteShippingSegmentInput[];
  inventory?: any;
  reconstruction_context?: any;
}

interface AutoCompletePreviewInput {
  order_sn?: string;
  order_item_id?: number | string;
  plan_sn?: string;
  planSn?: string;
  remark?: string;
  plan_remark?: string;
  remark_text?: string;
}

interface AutoCompleteSearchPlansInput {
  keyword?: string;
  has_auto_block?: boolean;
  page?: number;
  size?: number;
}

interface AutoCompleteSearchOrdersInput {
  keyword?: string;
  has_auto_block?: boolean;
  page?: number;
  size?: number;
}

interface AutoCompleteStatusPageInput {
  keyword?: string;
  status?: string;
  status_group?: string;
  seller_name?: string;
  marketplace?: string;
  page?: number;
  size?: number;
}

interface AutoCompleteStatusDetailInput {
  plan_sn?: string;
  planSn?: string;
}

const ALGORITHM_LABELS: Record<string, string> = {
  daily_avg: '日均销量',
  history: '历史销量',
  trend: '搜索词趋势',
  combined: '综合走势',
  operator_intent: '运营意向',
};
const ALGORITHM_ENGINE_KEYS: Record<string, string> = {
  daily_avg: 'daily_avg',
  history: 'history',
  trend: 'trend',
  combined: 'combined',
  operator_intent: 'combined',
};

function normalizeText(value: any) {
  return String(value ?? '').trim();
}

function normalizeNullableText(value: any) {
  const text = normalizeText(value);
  return text || null;
}

function positiveNumberOrNull(value: any) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function positiveIntegerOrNull(value: any) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : null;
}

function normalizeDateOnly(value: any) {
  if (value === undefined || value === null || value === '') return '';
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD') : '';
}

function normalizeWarehouseName(value: any) {
  return normalizeText(value).replace(/\s+/g, '').toLowerCase();
}

function stableSortValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableSortValue);
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = stableSortValue(value[key]);
        return result;
      }, {} as any);
  }
  return value;
}

export function buildAutoCompleteContextHash(input: any) {
  return createHash('sha256').update(JSON.stringify(stableSortValue(input || {}))).digest('hex');
}

export function resolveAutoCompletePlanStartDate(
  config: Partial<{ plan_start_date: string }> = {},
  purchasePlan: any = {},
  purchaseOrder: any = {}
): AutoCompletePlanStartResolution {
  const candidates = [
    {
      value: normalizeDateOnly(config.plan_start_date),
      source: 'remark' as const,
      source_label: '采购计划备注',
      field_name: '计划开始',
    },
    {
      value: normalizeDateOnly(purchasePlan?.create_time_remote),
      source: 'purchase_plan' as const,
      source_label: '采购计划表',
      field_name: 'create_time_remote',
    },
    {
      value: normalizeDateOnly(purchaseOrder?.create_time_remote),
      source: 'purchase_order' as const,
      source_label: '采购单主表',
      field_name: 'create_time_remote',
    },
  ];
  const matched = candidates.find(item => item.value);
  return matched || {
    value: '',
    source: 'missing',
    source_label: '缺少来源',
    field_name: '',
  };
}

export function resolveWarehouseMatch(
  requestedName: any,
  warehouses: Array<Partial<AppAmzBsrLogisticsWarehouseEntity>> = [],
  source = 'unknown'
): AutoCompleteWarehouseMatch {
  const requested = normalizeText(requestedName);
  if (!requested) {
    return {
      matched: false,
      warehouse_wid: null,
      warehouse_name: '',
      requested_name: '',
      source,
      confirmation_required: true,
      reason: '没有可用于匹配的仓库名称',
    };
  }
  const normalized = normalizeWarehouseName(requested);
  const matches = (warehouses || []).filter(
    item =>
      normalizeText(item.cloud_status || 'active') === 'active' &&
      normalizeWarehouseName(item.warehouse_name) === normalized
  );
  if (matches.length === 1) {
    return {
      matched: true,
      warehouse_wid: Number(matches[0].wid) || null,
      warehouse_name: normalizeText(matches[0].warehouse_name),
      requested_name: requested,
      source,
      confirmation_required: false,
      reason: '已匹配本地有效仓库',
    };
  }
  return {
    matched: false,
    warehouse_wid: null,
    warehouse_name: '',
    requested_name: requested,
    source,
    confirmation_required: true,
    reason: matches.length > 1 ? '存在多个同名有效仓库，无法唯一确认' : '未匹配到本地有效仓库',
  };
}

function cloneJson<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function parseJsonArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map(item => normalizeText(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value || '[]');
      if (Array.isArray(parsed)) {
        return parsed.map(item => normalizeText(item)).filter(Boolean);
      }
    } catch {
      return normalizeText(value) ? [normalizeText(value)] : [];
    }
  }
  return [];
}

function buildParsePreviewSummary(parsed: PurchasePlanAutoReplenishParseResult) {
  const config = parsed.config || ({ shipping_allocations: {} } as any);
  const profileKey = config.shipping_profile_key || '';
  const profile = profileKey ? SHIPPING_PROFILES[profileKey] : null;
  const shippingAllocations = Object.entries(config.shipping_allocations || {}).map(([methodKey, qty]) => {
    const method = SHIPPING_METHODS.find(item => item.key === methodKey);
    return {
      method_key: methodKey,
      method_label: method?.label || methodKey,
      qty: Number(qty) || 0,
    };
  });

  return {
    matched: parsed.matched,
    valid: parsed.valid,
    version: parsed.version,
    remark_hash: parsed.remark_hash,
    algorithm_key: config.algorithm_key || '',
    algorithm_label: config.algorithm_key ? ALGORITHM_LABELS[config.algorithm_key] || config.algorithm_key : '',
    plan_start_date: config.plan_start_date || '',
    shipping_buffer_days: config.shipping_buffer_days,
    warehouse_name: config.warehouse_name || '',
    shipping_profile_key: profileKey,
    shipping_profile_label: profile?.label || '',
    shipping_allocations: shippingAllocations,
    allocation_total: shippingAllocations.reduce((sum, item) => sum + item.qty, 0),
    manual_remark: config.manual_remark || '',
  };
}

function normalizePage(value: any, defaultValue = 1) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.floor(numberValue) : defaultValue;
}

function normalizePageSize(value: any, defaultValue = 10, maxValue = 50) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return defaultValue;
  return Math.min(maxValue, Math.floor(numberValue));
}

function buildRemarkSnippet(value: any, maxLength = 120) {
  const text = normalizeText(value).replace(/\s+/g, ' ');
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function parseStoredJson(value: any, fallback: any = null) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getAutoCompleteStatusLabel(status: string) {
  const text = normalizeText(status);
  if (text === 'success') return '成功';
  if (text === 'success_with_warnings') return '成功有警告';
  if (text === 'failed') return '失败';
  if (text === 'needs_attention') return '需处理';
  if (text === 'skipped') return '已跳过';
  return text || '-';
}

function getSnapshotRemarkHash(snapshot: any) {
  return normalizeText(
    snapshot?.input_json?.reconstruction?.remark_hash ||
      snapshot?.full_snapshot_json?.reconstruction?.remark_hash ||
      snapshot?.remark_json?.auto_replenish_remark?.remark_hash
  );
}

function getSnapshotContextHash(snapshot: any) {
  return normalizeText(
    snapshot?.input_json?.reconstruction?.context_hash ||
      snapshot?.full_snapshot_json?.reconstruction?.context_hash ||
      snapshot?.remark_json?.auto_replenish_remark?.context_hash
  );
}

export function decideAutoCompleteSnapshotAction(
  existingSnapshot: any,
  remarkHash: string,
  contextHash = ''
) {
  if (!existingSnapshot) {
    return { action: 'create' as const, reason: '没有历史自动快照' };
  }

  const source = normalizeText(existingSnapshot.snapshot_source);
  if (PROTECTED_SNAPSHOT_SOURCES.has(source)) {
    return {
      action: 'skip' as const,
      reason: source === 'batch_replenish' ? '已存在批量补货快照，不覆盖' : '已存在人工补全快照，不覆盖',
    };
  }

  if (source === AUTO_REPLENISH_SNAPSHOT_SOURCE && getSnapshotRemarkHash(existingSnapshot) === remarkHash) {
    if (contextHash && getSnapshotContextHash(existingSnapshot) === contextHash) {
      return { action: 'skip' as const, reason: '备注未变化且业务上下文未变化，已自动补全' };
    }
    return { action: 'update' as const, reason: '备注未变化，但业务上下文变化' };
  }

  return { action: 'update' as const, reason: '备注变化或可更新快照' };
}

function resolveDailyAvgSales(listing: any, finalPurchaseQty: number) {
  return (
    positiveNumberOrNull(listing?.average_thirty_volume) ||
    positiveNumberOrNull(listing?.average_fourteen_volume) ||
    positiveNumberOrNull(listing?.average_seven_volume) ||
    Math.max(1, Number((finalPurchaseQty / 30).toFixed(4)))
  );
}

export function buildAutoCompleteDraftFromRemark(
  input: AutoCompleteDraftBuildInput
): AutoCompleteSnapshotDraftInput {
  const { parsed, purchasePlan, orderItem, purchaseOrder, listing, totalPurchaseQty, currentUser } = input;
  if (!parsed.matched || !parsed.valid) {
    throw new Error(parsed.errors.join('；') || '采购计划备注自动补全配置无效');
  }

  const finalPurchaseQty = positiveIntegerOrNull(totalPurchaseQty) ||
    positiveIntegerOrNull(orderItem?.quantity_plan) ||
    positiveIntegerOrNull(purchasePlan?.quantity_plan);
  if (!finalPurchaseQty) {
    throw new Error('采购单数量为空，无法自动补全');
  }

  const allocationTotal = Object.values(parsed.config.shipping_allocations || {}).reduce(
    (sum, qty) => sum + (Number(qty) || 0),
    0
  );
  if (allocationTotal !== finalPurchaseQty) {
    throw new Error(`发货分配合计必须等于采购单数量：当前 ${allocationTotal} / ${finalPurchaseQty}`);
  }

  const dailyAvgSales = resolveDailyAvgSales(listing, finalPurchaseQty);
  const planStartResolution =
    input.planStartResolution ||
    resolveAutoCompletePlanStartDate(parsed.config, purchasePlan, purchaseOrder);
  if (!planStartResolution.value) {
    throw new Error('备注、采购计划和采购单均缺少计划开始时间');
  }
  const bufferDays = parsed.config.shipping_buffer_days ?? DEFAULT_SHIPPING_BUFFER_DAYS;
  const shippingResult = calculateReplenishmentShippingSegments({
    planStartDate: planStartResolution.value,
    bufferDays,
    profileKey: parsed.config.shipping_profile_key || 'default',
    allocations: parsed.config.shipping_allocations,
    dailyAvgSales,
    targetStockDays: DEFAULT_TARGET_STOCK_DAYS,
    volatilityCoefficient: DEFAULT_VOLATILITY_COEFFICIENT,
    manualCoefficient: DEFAULT_MANUAL_COEFFICIENT,
    source: AUTO_REPLENISH_SNAPSHOT_SOURCE,
    sourceLabel: AUTO_REPLENISH_SNAPSHOT_LABEL,
  });
  const shippingSegments = shippingResult.segments;
  const systemSuggestedQty = shippingSegments.reduce(
    (sum, segment) => sum + (Number(segment.system_suggested_qty) || 0),
    0
  );
  const cycleStartDate = shippingResult.cycle_start_date;
  const cycleEndDate = shippingResult.cycle_end_date;
  const warehouseMatch = input.warehouseMatch || resolveWarehouseMatch(
    parsed.config.warehouse_name || purchasePlan?.warehouse_name || purchaseOrder?.ware_house_name,
    [],
    parsed.config.warehouse_name ? 'remark' : purchasePlan?.warehouse_name ? 'purchase_plan' : 'purchase_order'
  );
  const boxPcs = positiveIntegerOrNull(purchasePlan?.cg_box_pcs) || positiveIntegerOrNull(orderItem?.quantity_per_case);
  const warnings = [...(input.warnings || [])];
  if (!warehouseMatch.matched) warnings.push(`仓库未匹配：${warehouseMatch.reason}`);

  return {
    algorithm_key: parsed.config.algorithm_key,
    algorithm_name: ALGORITHM_LABELS[parsed.config.algorithm_key || ''] || parsed.config.algorithm_key,
    algorithm_engine_key: ALGORITHM_ENGINE_KEYS[parsed.config.algorithm_key || ''] || parsed.config.algorithm_key,
    algorithm_engine_name: ALGORITHM_LABELS[ALGORITHM_ENGINE_KEYS[parsed.config.algorithm_key || ''] || ''] || '',
    daily_avg_sales: dailyAvgSales,
    target_stock_days: DEFAULT_TARGET_STOCK_DAYS,
    volatility_coefficient: DEFAULT_VOLATILITY_COEFFICIENT,
    manual_coefficient: DEFAULT_MANUAL_COEFFICIENT,
    cycle_start_date: cycleStartDate,
    cycle_end_date: cycleEndDate,
    system_suggested_qty: systemSuggestedQty,
    actual_purchase_qty_before_box: finalPurchaseQty,
    final_purchase_qty: finalPurchaseQty,
    box_pcs: boxPcs,
    warehouse_wid: warehouseMatch.warehouse_wid,
    warehouse_name: warehouseMatch.warehouse_name,
    warehouse_resolution_locked: true,
    shipping_adjust_mode: 'independent',
    shipping_profile: {
      profile_key: parsed.config.shipping_profile_key || 'default',
      profile_label: SHIPPING_PROFILES[parsed.config.shipping_profile_key || 'default'].label,
      buffer_days: bufferDays,
    },
    manual_remark: normalizeText(parsed.config.manual_remark) || AUTO_REPLENISH_SNAPSHOT_LABEL,
    shipping_segments: shippingSegments,
    inventory: {
      fba_valid: Number(listing?.afn_fulfillable_quantity) || 0,
      fba_reserved: Number(listing?.reserved_quantity) || 0,
      inbound_qty:
        Number(listing?.afn_inbound_shipped_quantity) +
          Number(listing?.afn_inbound_receiving_quantity) +
          Number(listing?.afn_inbound_working_quantity) || 0,
      local_valid: 0,
      local_purchase_plan: 0,
      local_pending_delivery: 0,
      lingxing_purchase_plan: 0,
      lingxing_pending_delivery: 0,
    },
    reconstruction_context: {
      source: AUTO_REPLENISH_SNAPSHOT_SOURCE,
      source_label: AUTO_REPLENISH_SNAPSHOT_LABEL,
      confidence: warnings.length ? 'plan_remark_with_warnings' : 'plan_remark_confirmed',
      remark_hash: parsed.remark_hash,
      context_hash: input.contextHash || '',
      parser_version: parsed.version,
      raw_block: parsed.raw_block,
      auto_complete_status: warnings.length ? 'completed_with_warnings' : 'completed',
      warnings,
      plan_start_date: planStartResolution.value,
      plan_start_source: planStartResolution,
      warehouse_match: warehouseMatch,
      warehouse_confirmation_required: warehouseMatch.confirmation_required,
      filled_by_user_id: currentUser.userId,
      filled_by_username: currentUser.username,
      filled_by_nickname: currentUser.nickname,
      sources: [
        { label: '采购计划备注', value: 'plan_remark' },
        { label: '采购单数量', value: finalPurchaseQty },
        { label: '计划开始', value: `${planStartResolution.source_label}.${planStartResolution.field_name}` },
        { label: '缓冲天数', value: parsed.config.shipping_buffer_days === undefined ? '系统默认 5' : '采购计划备注' },
      ],
    },
  };
}

@Provide()
export class AppBsrPurchasePlanRemarkAutoCompleteService extends BaseService {
  @InjectEntityModel(AppAmzBsrPurchasePlanLingxingEntity)
  purchasePlanRepo: Repository<AppAmzBsrPurchasePlanLingxingEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderItemSyncLingxingEntity)
  orderItemRepo: Repository<AppAmzBsrPurchaseOrderItemSyncLingxingEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderSyncLingxingEntity)
  orderRepo: Repository<AppAmzBsrPurchaseOrderSyncLingxingEntity>;

  @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
  listingRepo: Repository<AppAmzBsrProductListingLingxingEntity>;

  @InjectEntityModel(AppAmzBsrAnalysisRecordLingxingEntity)
  analysisRecordRepo: Repository<AppAmzBsrAnalysisRecordLingxingEntity>;

  @InjectEntityModel(AppAmzBsrBatchReplenishSnapshotEntity)
  batchSnapshotRepo: Repository<AppAmzBsrBatchReplenishSnapshotEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsWarehouseEntity)
  warehouseRepo: Repository<AppAmzBsrLogisticsWarehouseEntity>;

  @InjectEntityModel(AppAmzBsrPurchasePlanRemarkAutoCompleteStatusEntity)
  autoCompleteStatusRepo: Repository<AppAmzBsrPurchasePlanRemarkAutoCompleteStatusEntity>;

  @Inject('appAnalysisCustomService')
  analysisCustomService: any;

  private async resolveWarehouseForContext(parsed: PurchasePlanAutoReplenishParseResult, purchasePlan: any, purchaseOrder: any) {
    const requestedName = normalizeText(
      parsed.config.warehouse_name || purchasePlan?.warehouse_name || purchaseOrder?.ware_house_name
    );
    const source = parsed.config.warehouse_name
      ? 'remark'
      : purchasePlan?.warehouse_name
        ? 'purchase_plan'
        : purchaseOrder?.ware_house_name
          ? 'purchase_order'
          : 'missing';
    const warehouses = this.warehouseRepo?.find
      ? await this.warehouseRepo.find({ where: { cloud_status: 'active' } as any })
      : [];
    return resolveWarehouseMatch(requestedName, warehouses || [], source);
  }

  private buildShippingProfileWarnings(profileKey: AutoReplenishShippingProfileKey, marketplace: any) {
    const market = normalizeText(marketplace).toLowerCase();
    if (!market || profileKey === 'default') return [];
    const isUk = market.includes('英国') || market === 'uk' || market.includes('united kingdom');
    const isDe = market.includes('德国') || market === 'de' || market.includes('germany');
    if ((profileKey === 'uk' && isDe) || (profileKey === 'de' && isUk)) {
      return [`运输配置与店铺国家不一致：备注选择${SHIPPING_PROFILES[profileKey].label}，店铺国家为${normalizeText(marketplace)}`];
    }
    return [];
  }

  private buildContextHashInput(options: {
    planSn: string;
    totalPurchaseQty: number;
    planStartResolution: AutoCompletePlanStartResolution;
    purchasePlan: any;
    purchaseOrder: any;
    listing: any;
    parsed: PurchasePlanAutoReplenishParseResult;
    warehouseMatch: AutoCompleteWarehouseMatch;
  }) {
    return {
      plan_sn: options.planSn,
      purchase_qty: options.totalPurchaseQty,
      plan_start_date: options.planStartResolution.value,
      purchase_plan_create_time: normalizeDateOnly(options.purchasePlan?.create_time_remote),
      purchase_order_create_time: normalizeDateOnly(options.purchaseOrder?.create_time_remote),
      listing_id: Number(options.listing?.id) || null,
      shipping_profile: options.parsed.config.shipping_profile_key || 'default',
      warehouse: {
        wid: options.warehouseMatch.warehouse_wid,
        name: options.warehouseMatch.warehouse_name,
        requested_name: options.warehouseMatch.requested_name,
        matched: options.warehouseMatch.matched,
      },
      shipping_allocations: options.parsed.config.shipping_allocations || {},
    };
  }

  async processPlanSns(
    planSns: string[],
    options: { currentUser?: AutoCompleteCurrentUser; source?: string } = {}
  ) {
    const uniquePlanSns = [...new Set((planSns || []).map(item => normalizeText(item)).filter(Boolean))];
    const result = {
      total: uniquePlanSns.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      warning_count: 0,
      items: [] as any[],
    };

    for (const planSn of uniquePlanSns) {
      try {
        const itemResult = await this.processPlanSn(planSn, options);
        await this.saveAutoCompleteStatus(planSn, {
          ...itemResult,
          source: options.source,
        });
        result.items.push(itemResult);
        if (itemResult.status === 'created') result.created += 1;
        else if (itemResult.status === 'updated') result.updated += 1;
        else result.skipped += 1;
        result.warning_count += Number(itemResult.warning_count) || 0;
      } catch (e: any) {
        await this.saveAutoCompleteStatus(planSn, {
          status: 'failed',
          message: e?.message || '自动补全失败',
          context_hash: normalizeText(e?.contextHash),
          source: options.source,
          errors: [e?.message || '自动补全失败'],
        });
        await this.markExistingAutoSnapshotNeedsAttention(
          planSn,
          e?.message || '自动补全失败',
          normalizeText(e?.contextHash)
        );
        result.failed += 1;
        result.items.push({
          plan_sn: planSn,
          status: 'failed',
          message: e?.message || '自动补全失败',
        });
        console.error(`[purchase_plan_remark_auto_complete] plan_sn=${planSn} 自动补全失败:`, e?.message || e);
      }
    }

    return result;
  }

  async recordPlanFailures(planSns: string[], message: string, source = '') {
    const uniquePlanSns = [...new Set((planSns || []).map(item => normalizeText(item)).filter(Boolean))];
    for (const planSn of uniquePlanSns) {
      await this.saveAutoCompleteStatus(planSn, {
        status: 'failed',
        message,
        errors: [message],
        source,
      });
    }
    return {
      total: uniquePlanSns.length,
      failed: uniquePlanSns.length,
    };
  }

  private mapPersistentStatus(status: string, warningCount = 0) {
    const text = normalizeText(status);
    if (text === 'created' || text === 'updated') {
      return warningCount > 0 ? 'success_with_warnings' : 'success';
    }
    if (text === 'success' || text === 'success_with_warnings') return text;
    if (text === 'failed' || text === 'needs_attention' || text === 'skipped') return text;
    return text || 'skipped';
  }

  private async saveAutoCompleteStatus(planSn: string, input: any = {}) {
    if (!this.autoCompleteStatusRepo?.save) return null;
    const normalizedPlanSn = normalizeText(planSn || input.plan_sn);
    if (!normalizedPlanSn) return null;

    const warningList = Array.isArray(input.warnings) ? input.warnings : [];
    const errorList = Array.isArray(input.errors)
      ? input.errors
      : input.message && normalizeText(input.status) === 'failed'
        ? [input.message]
        : [];
    const status = this.mapPersistentStatus(input.status, warningList.length || Number(input.warning_count) || 0);
    const existing = this.autoCompleteStatusRepo.findOne
      ? await this.autoCompleteStatusRepo.findOne({ where: { plan_sn: normalizedPlanSn } })
      : null;
    const entity: any = existing || this.autoCompleteStatusRepo.create({ plan_sn: normalizedPlanSn } as any);

    entity.plan_sn = normalizedPlanSn;
    entity.status = status;
    entity.status_label = getAutoCompleteStatusLabel(status);
    entity.order_sn = normalizeNullableText(input.order_sn || entity.order_sn);
    entity.remark_hash = normalizeNullableText(input.remark_hash || entity.remark_hash);
    entity.context_hash = normalizeNullableText(input.context_hash || input.contextHash || entity.context_hash);
    entity.purchase_qty = positiveIntegerOrNull(input.purchase_qty) || entity.purchase_qty || null;
    entity.allocation_total = positiveIntegerOrNull(input.allocation_total) || entity.allocation_total || null;
    entity.analysis_record_id = positiveIntegerOrNull(input.analysis_record_id) || entity.analysis_record_id || null;
    entity.snapshot_id = positiveIntegerOrNull(input.snapshot_id) || entity.snapshot_id || null;
    entity.listing_id = positiveIntegerOrNull(input.listing_id) || entity.listing_id || null;
    entity.asin = normalizeNullableText(input.asin || entity.asin);
    entity.msku = normalizeNullableText(input.msku || entity.msku);
    entity.local_sku = normalizeNullableText(input.local_sku || entity.local_sku);
    entity.seller_name = normalizeNullableText(input.seller_name || entity.seller_name);
    entity.marketplace = normalizeNullableText(input.marketplace || entity.marketplace);
    entity.warehouse_wid = positiveIntegerOrNull(input.warehouse_wid) || null;
    entity.warehouse_name = normalizeNullableText(input.warehouse_name);
    entity.warehouse_confirmation_required = input.warehouse_confirmation_required ? 1 : 0;
    entity.errors_json = cloneJson(errorList);
    entity.warnings_json = cloneJson(warningList);
    entity.context_json = cloneJson({
      message: input.message || '',
      raw_status: input.status || '',
      warning_count: Number(input.warning_count) || warningList.length || 0,
      source: normalizeText(input.source),
    });
    entity.last_run_source = normalizeNullableText(input.source);
    entity.last_run_time = new Date();

    return await this.autoCompleteStatusRepo.save(entity);
  }

  private async markExistingAutoSnapshotNeedsAttention(planSn: string, message: string, contextHash = '') {
    try {
      const analysisRecord = await this.analysisRecordRepo.findOne({
        where: { plan_sn: planSn, status: 1 },
        order: { id: 'DESC' },
      });
      if (!analysisRecord) return;
      const snapshot = await this.batchSnapshotRepo.findOne({
        where: { analysis_record_id: Number(analysisRecord.id) },
        order: { id: 'DESC' },
      });
      if (!snapshot || normalizeText(snapshot.snapshot_source) !== AUTO_REPLENISH_SNAPSHOT_SOURCE) return;
      const inputJson: any = cloneJson(snapshot.input_json || {});
      inputJson.reconstruction = {
        ...(inputJson.reconstruction || {}),
        auto_complete_status: 'needs_attention',
        current_validation_errors: [message],
        current_context_hash: contextHash || inputJson.reconstruction?.current_context_hash || '',
        last_validation_time: new Date().toISOString(),
      };
      snapshot.input_json = inputJson;
      const fullSnapshot: any = cloneJson(snapshot.full_snapshot_json || {});
      fullSnapshot.reconstruction = {
        ...(fullSnapshot.reconstruction || inputJson.reconstruction),
        auto_complete_status: 'needs_attention',
        current_validation_errors: [message],
        current_context_hash: inputJson.reconstruction.current_context_hash,
        last_validation_time: inputJson.reconstruction.last_validation_time,
      };
      snapshot.full_snapshot_json = fullSnapshot;
      const remarkJson: any = cloneJson(snapshot.remark_json || {});
      remarkJson.auto_replenish_remark = {
        ...(remarkJson.auto_replenish_remark || {}),
        auto_complete_status: 'needs_attention',
        current_validation_errors: [message],
        current_context_hash: contextHash || '',
      };
      snapshot.remark_json = remarkJson;
      await this.batchSnapshotRepo.save(snapshot);
    } catch (markError: any) {
      console.error(`[purchase_plan_remark_auto_complete] plan_sn=${planSn} 标记需处理失败:`, markError?.message || markError);
    }
  }

  async preview(input: AutoCompletePreviewInput = {}) {
    const planSn = normalizeText(input.plan_sn || input.planSn);
    const directRemark = normalizeText(input.remark ?? input.plan_remark ?? input.remark_text);
    const orderSn = normalizeText(input.order_sn);
    const orderItemId = Number(input.order_item_id) || 0;
    const hasContextInput = Boolean(orderSn || orderItemId || planSn);
    const source = directRemark
      ? hasContextInput
        ? 'order_remark_override'
        : 'remark'
      : orderSn
        ? 'order'
        : 'plan_sn';
    let purchasePlan: any = null;
    const errors: string[] = [];
    const warnings: string[] = [];

    if (hasContextInput && !planSn) {
      errors.push('请选择采购单中的具体采购计划');
    }

    if (planSn) {
      purchasePlan = await this.purchasePlanRepo.findOne({ where: { plan_sn: planSn } });
      if (!purchasePlan) {
        errors.push('本地采购计划不存在');
      }
    }

    const remarkText = directRemark || normalizeText(purchasePlan?.plan_remark);
    if (!remarkText) {
      errors.push('请输入 plan_sn 或备注文本');
    }

    const parsed = parsePurchasePlanAutoReplenishRemark(remarkText);
    const metadata = getAutoReplenishRemarkMetadata();
    const result: any = {
      source,
      plan_sn: planSn || normalizeText(purchasePlan?.plan_sn),
      plan_remark: remarkText,
      parsed,
      metadata,
      summary: buildParsePreviewSummary(parsed),
      errors: [...errors, ...(parsed.errors || [])],
      warnings,
      remark_hash: parsed.remark_hash,
      context_hash: '',
      validation: {
        syntax: { valid: parsed.valid, errors: [...errors, ...(parsed.errors || [])] },
        quantity: { valid: false, purchase_qty: null, allocation_total: 0 },
        warehouse: null,
        product: { valid: false, listing: null },
        shipping: { valid: false, profile: null, plan_start: null, segments: [] },
        readiness: {
          status: directRemark && !hasContextInput && parsed.valid ? 'syntax_only' : 'blocked',
          can_auto_complete: false,
          text: directRemark && !hasContextInput && parsed.valid
            ? '仅完成语法与仓库名称校验，未校验采购数量、店铺商品和完整运输周期'
            : '不可自动补全',
        },
      },
      context: {
        purchase_plan: purchasePlan
          ? {
              id: purchasePlan.id,
              plan_sn: purchasePlan.plan_sn,
              ppg_sn: purchasePlan.ppg_sn,
              sku: purchasePlan.sku,
              msku: parseJsonArray(purchasePlan.msku),
              sid: purchasePlan.sid,
              marketplace: purchasePlan.marketplace,
              quantity_plan: purchasePlan.quantity_plan,
              warehouse_name: purchasePlan.warehouse_name,
              create_time_remote: purchasePlan.create_time_remote,
              update_time_remote: purchasePlan.update_time_remote,
            }
          : null,
        order_item_count: 0,
        order_sn: '',
        matched_listing: null,
        purchase_order: null,
        selected_order_item: null,
      },
      draft: null,
      draft_error: '',
    };

    result.validation.quantity.allocation_total = result.summary.allocation_total;

    if (directRemark && !hasContextInput) {
      if (parsed.matched && parsed.config.warehouse_name) {
        const warehouseMatch = await this.resolveWarehouseForContext(parsed, null, null);
        result.validation.warehouse = warehouseMatch;
        if (!warehouseMatch.matched) {
          warnings.push(`仓库未匹配：${warehouseMatch.reason}`);
        }
      }
      if (parsed.valid) {
        warnings.push('粘贴模式未校验采购数量、店铺商品和完整运输周期');
      }
      return result;
    }

    if (!parsed.valid || !purchasePlan) {
      return result;
    }

    try {
      const orderItems = await this.orderItemRepo.find({ where: { plan_sn: purchasePlan.plan_sn } });
      result.context.order_item_count = orderItems.length;
      if (!orderItems.length) {
        result.draft_error = '没有关联采购单明细';
        result.errors.push(result.draft_error);
        return result;
      }

      const representativeItem =
        orderItems.find(item => Number(item.id) === orderItemId) ||
        orderItems.find(item => !orderSn || normalizeText(item.order_sn) === orderSn) ||
        orderItems[0];
      if (orderItemId && Number(representativeItem?.id) !== orderItemId) {
        result.draft_error = '所选采购单明细不属于该采购计划';
        result.errors.push(result.draft_error);
        return result;
      }
      if (orderSn && normalizeText(representativeItem?.order_sn) !== orderSn) {
        result.draft_error = '所选采购单与采购计划关联关系不一致';
        result.errors.push(result.draft_error);
        return result;
      }
      result.context.order_sn = normalizeText(representativeItem.order_sn);
      const purchaseOrder = representativeItem.order_sn
        ? await this.orderRepo.findOne({ where: { order_sn: representativeItem.order_sn } })
        : null;
      result.context.purchase_order = purchaseOrder;
      result.context.selected_order_item = representativeItem;
      const listing = await this.findMatchedListing(purchasePlan, orderItems);
      if (listing) {
        result.context.matched_listing = {
          id: listing.id,
          store_id: listing.store_id,
          asin: listing.asin,
          msku: listing.msku,
          local_sku: listing.local_sku,
          product_code: listing.product_code,
          marketplace: listing.marketplace,
          seller_name: listing.seller_name,
          item_name: listing.item_name,
        };
      }
      if (!listing) {
        result.draft_error = '未匹配到真实店铺商品';
        result.errors.push(result.draft_error);
        result.validation.product = { valid: false, listing: null, reason: result.draft_error };
        return result;
      }

      result.validation.product = { valid: true, listing: result.context.matched_listing };

      const totalPurchaseQty = this.resolveTotalPurchaseQty(orderItems, purchasePlan);
      const allocationTotal = result.summary.allocation_total;
      result.validation.quantity = {
        valid: totalPurchaseQty > 0 && allocationTotal === totalPurchaseQty,
        purchase_qty: totalPurchaseQty,
        allocation_total: allocationTotal,
        difference: allocationTotal - totalPurchaseQty,
      };
      if (!result.validation.quantity.valid) {
        result.errors.push(`发货分配合计必须等于采购单数量：当前 ${allocationTotal} / ${totalPurchaseQty}`);
      }

      const planStartResolution = resolveAutoCompletePlanStartDate(parsed.config, purchasePlan, purchaseOrder);
      if (!planStartResolution.value) {
        result.errors.push('备注、采购计划和采购单均缺少计划开始时间');
      }
      const warehouseMatch = await this.resolveWarehouseForContext(parsed, purchasePlan, purchaseOrder);
      result.validation.warehouse = warehouseMatch;
      if (!warehouseMatch.matched) {
        warnings.push(`仓库未匹配：${warehouseMatch.reason}`);
      }
      warnings.push(...this.buildShippingProfileWarnings(
        parsed.config.shipping_profile_key || 'default',
        listing.marketplace || purchasePlan.marketplace
      ));
      const contextHash = buildAutoCompleteContextHash(this.buildContextHashInput({
        planSn: purchasePlan.plan_sn,
        totalPurchaseQty,
        planStartResolution,
        purchasePlan,
        purchaseOrder,
        listing,
        parsed,
        warehouseMatch,
      }));
      result.context_hash = contextHash;
      const snapshotOrderItem = {
        ...representativeItem,
        quantity_plan: totalPurchaseQty,
        quantity_real: totalPurchaseQty,
      };
      if (!result.errors.length) {
        result.draft = buildAutoCompleteDraftFromRemark({
          parsed,
          orderItem: snapshotOrderItem,
          purchaseOrder,
          purchasePlan,
          listing,
          totalPurchaseQty,
          warehouseMatch,
          planStartResolution,
          contextHash,
          warnings,
          currentUser: {
            userId: null,
            username: 'preview',
            nickname: '备注解析预览',
          },
        });
      }
      result.validation.shipping = {
        valid: Boolean(result.draft),
        profile: SHIPPING_PROFILES[parsed.config.shipping_profile_key || 'default'],
        plan_start: planStartResolution,
        buffer_days: parsed.config.shipping_buffer_days ?? DEFAULT_SHIPPING_BUFFER_DAYS,
        buffer_source: parsed.config.shipping_buffer_days === undefined ? '系统默认' : '采购计划备注',
        segments: result.draft?.shipping_segments || [],
      };
      result.validation.readiness = {
        status: result.errors.length ? 'blocked' : warnings.length ? 'ready_with_warnings' : 'ready',
        can_auto_complete: result.errors.length === 0,
        text: result.errors.length
          ? '不可自动补全'
          : warnings.length
            ? '可自动补全，但存在非阻断警告'
            : '可自动补全',
      };
    } catch (e: any) {
      result.draft_error = e?.message || '草稿构造失败';
      result.errors.push(result.draft_error);
      result.validation.readiness = {
        status: 'blocked',
        can_auto_complete: false,
        text: '不可自动补全',
      };
    }

    return result;
  }

  async searchPlans(input: AutoCompleteSearchPlansInput = {}) {
    const page = normalizePage(input.page);
    const size = normalizePageSize(input.size);
    const offset = (page - 1) * size;
    const keyword = normalizeText(input.keyword);
    const onlyAutoBlock = input.has_auto_block !== false;
    const whereParts = ['pp.plan_remark IS NOT NULL', "TRIM(pp.plan_remark) <> ''"];
    const params: any[] = [];

    if (onlyAutoBlock) {
      whereParts.push('pp.plan_remark LIKE ?');
      params.push('%【自动补全V1】%');
    }

    if (keyword) {
      const like = `%${keyword}%`;
      whereParts.push(`(
        pp.plan_sn LIKE ?
        OR pp.ppg_sn LIKE ?
        OR pp.sku LIKE ?
        OR pp.product_name LIKE ?
        OR pp.seller_name LIKE ?
        OR pp.marketplace LIKE ?
        OR pp.warehouse_name LIKE ?
        OR CAST(pp.msku AS CHAR) LIKE ?
        OR oi.order_sn LIKE ?
        OR oi.first_msku LIKE ?
      )`);
      params.push(like, like, like, like, like, like, like, like, like, like);
    }

    const joinSql = `
      LEFT JOIN (
        SELECT
          plan_sn,
          MIN(order_sn) AS order_sn,
          COUNT(*) AS order_item_count,
          MAX(first_msku) AS first_msku,
          SUM(COALESCE(quantity_plan, quantity_real, 0)) AS order_quantity
        FROM app_amz_bsr_purchase_order_item_sync_lingxing
        WHERE plan_sn IS NOT NULL AND plan_sn <> ''
        GROUP BY plan_sn
      ) oi ON oi.plan_sn = pp.plan_sn
    `;
    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const listSql = `
      SELECT
        pp.id,
        pp.plan_sn,
        pp.ppg_sn,
        pp.sku,
        pp.product_name,
        pp.pic_url,
        CAST(pp.msku AS CHAR) AS msku_text,
        pp.seller_name,
        pp.marketplace,
        pp.quantity_plan,
        pp.warehouse_name,
        pp.status,
        pp.status_text,
        pp.create_time_remote,
        pp.update_time_remote,
        pp.sync_time,
        pp.plan_remark,
        oi.order_sn,
        oi.order_item_count,
        oi.order_quantity,
        oi.first_msku
      FROM app_amz_bsr_purchase_plan_lingxing pp
      ${joinSql}
      ${whereSql}
      ORDER BY COALESCE(pp.update_time_remote, pp.sync_time, pp.create_time_remote, pp.updateTime, pp.createTime) DESC, pp.id DESC
      LIMIT ? OFFSET ?
    `;
    const countSql = `
      SELECT COUNT(DISTINCT pp.plan_sn) AS total
      FROM app_amz_bsr_purchase_plan_lingxing pp
      ${joinSql}
      ${whereSql}
    `;

    const rows = await this.purchasePlanRepo.query(listSql, [...params, size, offset]);
    const countRows = await this.purchasePlanRepo.query(countSql, params);
    const total = Number(countRows?.[0]?.total) || 0;
    const list = (rows || []).map(row => {
      const parsed = parsePurchasePlanAutoReplenishRemark(row.plan_remark);
      return {
        id: row.id,
        plan_sn: normalizeText(row.plan_sn),
        ppg_sn: normalizeText(row.ppg_sn),
        order_sn: normalizeText(row.order_sn),
        order_item_count: Number(row.order_item_count) || 0,
        order_quantity: Number(row.order_quantity) || 0,
        sku: normalizeText(row.sku),
        msku: parseJsonArray(row.msku_text),
        first_msku: normalizeText(row.first_msku),
        product_name: normalizeText(row.product_name),
        pic_url: normalizeText(row.pic_url),
        seller_name: normalizeText(row.seller_name),
        marketplace: normalizeText(row.marketplace),
        quantity_plan: Number(row.quantity_plan) || 0,
        warehouse_name: normalizeText(row.warehouse_name),
        status: row.status,
        status_text: normalizeText(row.status_text),
        create_time_remote: row.create_time_remote,
        update_time_remote: row.update_time_remote,
        sync_time: row.sync_time,
        plan_remark: row.plan_remark,
        plan_remark_snippet: buildRemarkSnippet(row.plan_remark),
        auto_block_matched: parsed.matched,
        auto_block_valid: parsed.valid,
        auto_block_errors: parsed.errors || [],
        summary: buildParsePreviewSummary(parsed),
      };
    });

    return {
      page,
      size,
      total,
      list,
    };
  }

  async searchOrders(input: AutoCompleteSearchOrdersInput = {}) {
    const page = normalizePage(input.page);
    const size = normalizePageSize(input.size);
    const offset = (page - 1) * size;
    const keyword = normalizeText(input.keyword);
    const onlyAutoBlock = input.has_auto_block !== false;
    const whereParts = ["oi.plan_sn IS NOT NULL", "oi.plan_sn <> ''"];
    const params: any[] = [];

    if (onlyAutoBlock) {
      whereParts.push(`EXISTS (
        SELECT 1
        FROM app_amz_bsr_purchase_order_item_sync_lingxing oi_auto
        INNER JOIN app_amz_bsr_purchase_plan_lingxing pp_auto ON pp_auto.plan_sn = oi_auto.plan_sn
        WHERE oi_auto.order_sn = o.order_sn AND pp_auto.plan_remark LIKE ?
      )`);
      params.push('%【自动补全V1】%');
    }
    if (keyword) {
      const like = `%${keyword}%`;
      whereParts.push(`(
        o.order_sn LIKE ? OR o.custom_order_sn LIKE ? OR o.supplier_name LIKE ?
        OR o.ware_house_name LIKE ? OR oi.product_name LIKE ? OR oi.sku LIKE ?
        OR oi.fnsku LIKE ? OR oi.first_msku LIKE ? OR oi.plan_sn LIKE ?
      )`);
      params.push(like, like, like, like, like, like, like, like, like);
    }

    const joinSql = `
      INNER JOIN app_amz_bsr_purchase_order_item_sync_lingxing oi ON oi.order_sn = o.order_sn
      LEFT JOIN app_amz_bsr_purchase_plan_lingxing pp ON pp.plan_sn = oi.plan_sn
    `;
    const whereSql = `WHERE ${whereParts.join(' AND ')}`;
    const rows = await this.orderRepo.query(`
      SELECT
        o.order_sn,
        MAX(o.custom_order_sn) AS custom_order_sn,
        MAX(o.status) AS status,
        MAX(o.status_text) AS status_text,
        MAX(o.supplier_name) AS supplier_name,
        MAX(o.ware_house_name) AS ware_house_name,
        MAX(o.quantity_total) AS quantity_total,
        MAX(o.create_time_remote) AS create_time_remote,
        COUNT(DISTINCT oi.id) AS order_item_count,
        COUNT(DISTINCT oi.plan_sn) AS plan_count,
        COUNT(DISTINCT CASE WHEN pp.plan_remark LIKE '%【自动补全V1】%' THEN oi.plan_sn END) AS auto_plan_count
      FROM app_amz_bsr_purchase_order_sync_lingxing o
      ${joinSql}
      ${whereSql}
      GROUP BY o.order_sn
      ORDER BY COALESCE(MAX(o.update_time_remote), MAX(o.create_time_remote), MAX(o.updateTime), MAX(o.createTime)) DESC
      LIMIT ? OFFSET ?
    `, [...params, size, offset]);
    const countRows = await this.orderRepo.query(`
      SELECT COUNT(DISTINCT o.order_sn) AS total
      FROM app_amz_bsr_purchase_order_sync_lingxing o
      ${joinSql}
      ${whereSql}
    `, params);

    return {
      page,
      size,
      total: Number(countRows?.[0]?.total) || 0,
      list: (rows || []).map(row => ({
        order_sn: normalizeText(row.order_sn),
        custom_order_sn: normalizeText(row.custom_order_sn),
        status: row.status,
        status_text: normalizeText(row.status_text),
        supplier_name: normalizeText(row.supplier_name),
        ware_house_name: normalizeText(row.ware_house_name),
        quantity_total: Number(row.quantity_total) || 0,
        create_time_remote: row.create_time_remote,
        order_item_count: Number(row.order_item_count) || 0,
        plan_count: Number(row.plan_count) || 0,
        auto_plan_count: Number(row.auto_plan_count) || 0,
      })),
    };
  }

  async orderContext(input: { order_sn?: string } = {}) {
    const orderSn = normalizeText(input.order_sn);
    if (!orderSn) throw new Error('请选择采购单');
    const order = await this.orderRepo.findOne({ where: { order_sn: orderSn } });
    if (!order) throw new Error('本地采购单不存在');
    const items = await this.orderItemRepo.find({ where: { order_sn: orderSn }, order: { id: 'ASC' } as any });
    const planSns = [...new Set(items.map(item => normalizeText(item.plan_sn)).filter(Boolean))];
    const plans = planSns.length
      ? await this.purchasePlanRepo.find({ where: { plan_sn: In(planSns) } as any })
      : [];
    const planMap = new Map((plans || []).map(plan => [normalizeText(plan.plan_sn), plan]));

    return {
      order,
      items: items.map(item => {
        const plan = planMap.get(normalizeText(item.plan_sn));
        const parsed = parsePurchasePlanAutoReplenishRemark(plan?.plan_remark);
        return {
          ...item,
          purchase_plan: plan
            ? {
                ...plan,
                plan_remark_snippet: buildRemarkSnippet(plan.plan_remark),
                auto_block_matched: parsed.matched,
                auto_block_valid: parsed.valid,
                auto_block_errors: parsed.errors || [],
                summary: buildParsePreviewSummary(parsed),
              }
            : null,
        };
      }),
    };
  }

  async statusPage(input: AutoCompleteStatusPageInput = {}) {
    const page = normalizePage(input.page);
    const size = normalizePageSize(input.size, 10, 100);
    const offset = (page - 1) * size;
    const keyword = normalizeText(input.keyword);
    const status = normalizeText(input.status);
    const statusGroup = normalizeText(input.status_group);
    const sellerName = normalizeText(input.seller_name);
    const marketplace = normalizeText(input.marketplace);
    const whereParts: string[] = ['1 = 1'];
    const params: any[] = [];

    if (status) {
      whereParts.push('acs.status = ?');
      params.push(status);
    } else if (statusGroup && statusGroup !== 'all') {
      const groupMap: Record<string, string[]> = {
        available: ['success', 'success_with_warnings'],
        problem: ['failed', 'needs_attention'],
        skipped: ['skipped'],
      };
      const groupStatuses = groupMap[statusGroup] || [];
      if (groupStatuses.length) {
        whereParts.push(`acs.status IN (${groupStatuses.map(() => '?').join(', ')})`);
        params.push(...groupStatuses);
      }
    }
    if (sellerName) {
      whereParts.push('(acs.seller_name LIKE ? OR pp.seller_name LIKE ?)');
      params.push(`%${sellerName}%`, `%${sellerName}%`);
    }
    if (marketplace) {
      whereParts.push('(acs.marketplace LIKE ? OR pp.marketplace LIKE ?)');
      params.push(`%${marketplace}%`, `%${marketplace}%`);
    }
    if (keyword) {
      const like = `%${keyword}%`;
      whereParts.push(`(
        acs.plan_sn LIKE ?
        OR acs.order_sn LIKE ?
        OR acs.asin LIKE ?
        OR acs.msku LIKE ?
        OR acs.local_sku LIKE ?
        OR acs.seller_name LIKE ?
        OR acs.warehouse_name LIKE ?
        OR pp.product_name LIKE ?
        OR pp.sku LIKE ?
        OR CAST(acs.errors_json AS CHAR) LIKE ?
        OR CAST(acs.warnings_json AS CHAR) LIKE ?
      )`);
      params.push(like, like, like, like, like, like, like, like, like, like, like);
    }

    const whereSql = `WHERE ${whereParts.join(' AND ')}`;
    const listSql = `
      SELECT
        acs.*,
        pp.ppg_sn,
        pp.product_name,
        pp.pic_url,
        pp.sku,
        pp.plan_remark,
        pp.quantity_plan AS plan_quantity,
        COALESCE(acs.seller_name, pp.seller_name) AS display_seller_name,
        COALESCE(acs.marketplace, pp.marketplace) AS display_marketplace
      FROM app_amz_bsr_purchase_plan_remark_auto_complete_status acs
      LEFT JOIN app_amz_bsr_purchase_plan_lingxing pp ON pp.plan_sn = acs.plan_sn
      ${whereSql}
      ORDER BY acs.last_run_time DESC, acs.updateTime DESC, acs.id DESC
      LIMIT ? OFFSET ?
    `;
    const countSql = `
      SELECT COUNT(*) AS total
      FROM app_amz_bsr_purchase_plan_remark_auto_complete_status acs
      LEFT JOIN app_amz_bsr_purchase_plan_lingxing pp ON pp.plan_sn = acs.plan_sn
      ${whereSql}
    `;

    const rows = await this.autoCompleteStatusRepo.query(listSql, [...params, size, offset]);
    const countRows = await this.autoCompleteStatusRepo.query(countSql, params);
    const list = (rows || []).map(row => {
      const errors = parseStoredJson(row.errors_json, []);
      const warnings = parseStoredJson(row.warnings_json, []);
      return {
        id: row.id,
        plan_sn: normalizeText(row.plan_sn),
        ppg_sn: normalizeText(row.ppg_sn),
        order_sn: normalizeText(row.order_sn),
        status: normalizeText(row.status),
        status_label: normalizeText(row.status_label) || getAutoCompleteStatusLabel(row.status),
        remark_hash: normalizeText(row.remark_hash),
        context_hash: normalizeText(row.context_hash),
        purchase_qty: Number(row.purchase_qty) || 0,
        allocation_total: Number(row.allocation_total) || 0,
        analysis_record_id: Number(row.analysis_record_id) || null,
        snapshot_id: Number(row.snapshot_id) || null,
        listing_id: Number(row.listing_id) || null,
        asin: normalizeText(row.asin),
        msku: normalizeText(row.msku),
        local_sku: normalizeText(row.local_sku),
        sku: normalizeText(row.sku),
        product_name: normalizeText(row.product_name),
        pic_url: normalizeText(row.pic_url),
        seller_name: normalizeText(row.display_seller_name),
        marketplace: normalizeText(row.display_marketplace),
        warehouse_wid: Number(row.warehouse_wid) || null,
        warehouse_name: normalizeText(row.warehouse_name),
        warehouse_confirmation_required: Number(row.warehouse_confirmation_required) === 1,
        errors: Array.isArray(errors) ? errors : [],
        warnings: Array.isArray(warnings) ? warnings : [],
        context: parseStoredJson(row.context_json, {}),
        last_run_source: normalizeText(row.last_run_source),
        last_run_time: row.last_run_time,
        restorable: ['success', 'success_with_warnings', 'needs_attention'].includes(normalizeText(row.status)),
      };
    });

    return {
      page,
      size,
      total: Number(countRows?.[0]?.total) || 0,
      list,
    };
  }

  async statusStats(input: AutoCompleteStatusPageInput = {}) {
    const keyword = normalizeText(input.keyword);
    const sellerName = normalizeText(input.seller_name);
    const marketplace = normalizeText(input.marketplace);
    const whereParts: string[] = ['1 = 1'];
    const params: any[] = [];

    if (sellerName) {
      whereParts.push('(acs.seller_name LIKE ? OR pp.seller_name LIKE ?)');
      params.push(`%${sellerName}%`, `%${sellerName}%`);
    }
    if (marketplace) {
      whereParts.push('(acs.marketplace LIKE ? OR pp.marketplace LIKE ?)');
      params.push(`%${marketplace}%`, `%${marketplace}%`);
    }
    if (keyword) {
      const like = `%${keyword}%`;
      whereParts.push(`(
        acs.plan_sn LIKE ?
        OR acs.order_sn LIKE ?
        OR acs.asin LIKE ?
        OR acs.msku LIKE ?
        OR acs.local_sku LIKE ?
        OR pp.product_name LIKE ?
      )`);
      params.push(like, like, like, like, like, like);
    }
    const whereSql = `WHERE ${whereParts.join(' AND ')}`;
    const rows = await this.autoCompleteStatusRepo.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN acs.status = 'success' THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN acs.status = 'success_with_warnings' THEN 1 ELSE 0 END) AS success_with_warnings,
        SUM(CASE WHEN acs.status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN acs.status = 'needs_attention' THEN 1 ELSE 0 END) AS needs_attention,
        SUM(CASE WHEN acs.status = 'skipped' THEN 1 ELSE 0 END) AS skipped,
        MAX(acs.last_run_time) AS latest_run_time
      FROM app_amz_bsr_purchase_plan_remark_auto_complete_status acs
      LEFT JOIN app_amz_bsr_purchase_plan_lingxing pp ON pp.plan_sn = acs.plan_sn
      ${whereSql}
    `, params);
    const row = rows?.[0] || {};
    return {
      total: Number(row.total) || 0,
      success: Number(row.success) || 0,
      success_with_warnings: Number(row.success_with_warnings) || 0,
      failed: Number(row.failed) || 0,
      needs_attention: Number(row.needs_attention) || 0,
      skipped: Number(row.skipped) || 0,
      latest_run_time: row.latest_run_time || null,
    };
  }

  async statusDetail(input: AutoCompleteStatusDetailInput = {}) {
    const planSn = normalizeText(input.plan_sn || input.planSn);
    if (!planSn) {
      throw new Error('请选择采购计划');
    }

    const statusRow = await this.autoCompleteStatusRepo.findOne({ where: { plan_sn: planSn } });
    if (!statusRow) {
      throw new Error('自动补全记录不存在');
    }

    const purchasePlan = await this.purchasePlanRepo.findOne({ where: { plan_sn: planSn } });
    if (!purchasePlan) {
      throw new Error('本地采购计划不存在');
    }

    const orderItems = await this.orderItemRepo.find({
      where: { plan_sn: planSn },
      order: { id: 'ASC' } as any,
    });
    const orderSns = [...new Set([
      ...normalizeText(statusRow.order_sn)
        .split(/[,，]/)
        .map(item => normalizeText(item))
        .filter(Boolean),
      ...orderItems.map(item => normalizeText(item.order_sn)).filter(Boolean),
    ])];
    const purchaseOrders = orderSns.length
      ? await this.orderRepo.find({ where: { order_sn: In(orderSns) } as any })
      : [];
    const purchaseOrderMap = new Map(
      (purchaseOrders || []).map(order => [normalizeText((order as any).order_sn), order])
    );
    const parsed = parsePurchasePlanAutoReplenishRemark(purchasePlan.plan_remark);
    const representativeItem =
      orderItems.find(item => normalizeText(item.order_sn) === normalizeText(orderSns[0])) ||
      orderItems[0] ||
      null;
    const previewInput = representativeItem
      ? {
          plan_sn: planSn,
          order_sn: normalizeText(representativeItem.order_sn),
          order_item_id: Number(representativeItem.id) || undefined,
        }
      : { plan_sn: planSn };
    let preview: any = null;
    let previewError = '';
    try {
      preview = await this.preview(previewInput);
    } catch (error: any) {
      previewError = error?.message || '备注解析预览失败';
    }

    const analysisRecord = statusRow.analysis_record_id
      ? await this.analysisRecordRepo.findOne({ where: { id: Number(statusRow.analysis_record_id) } as any })
      : null;
    let snapshot = statusRow.snapshot_id
      ? await this.batchSnapshotRepo.findOne({ where: { id: Number(statusRow.snapshot_id) } as any })
      : null;
    if (!snapshot && analysisRecord?.id) {
      snapshot = await this.batchSnapshotRepo.findOne({
        where: { analysis_record_id: Number(analysisRecord.id) } as any,
        order: { id: 'DESC' } as any,
      });
    }
    const snapshotState = snapshot
      ? buildAutoCompleteSnapshotDisplayState(snapshot)
      : {
          auto_complete_status: normalizeText(statusRow.status),
          auto_complete_status_label: normalizeText(statusRow.status_label) || getAutoCompleteStatusLabel(statusRow.status),
          auto_complete_warnings: [],
          warehouse_confirmation_required: Boolean(statusRow.warehouse_confirmation_required),
          blocks_shipping: normalizeText(statusRow.status) === 'needs_attention',
          source_label_suffix: [
            normalizeText(statusRow.status_label) || getAutoCompleteStatusLabel(statusRow.status),
            statusRow.warehouse_confirmation_required ? '仓库未匹配' : '',
          ]
            .filter(Boolean)
            .join(' · '),
        };
    const previewListingId = Number(preview?.context?.matched_listing?.id) || 0;
    const currentListing = statusRow.listing_id
      ? await this.listingRepo.findOne({ where: { id: Number(statusRow.listing_id) } as any })
      : previewListingId
        ? await this.listingRepo.findOne({ where: { id: previewListingId } as any })
        : null;
    const matchDetail = await this.buildAutoCompleteMatchDetail(purchasePlan, orderItems, currentListing);

    return {
      status: {
        id: statusRow.id,
        plan_sn: normalizeText(statusRow.plan_sn),
        status: normalizeText(statusRow.status),
        status_label: normalizeText(statusRow.status_label) || getAutoCompleteStatusLabel(statusRow.status),
        order_sn: normalizeText(statusRow.order_sn),
        remark_hash: normalizeText(statusRow.remark_hash),
        context_hash: normalizeText(statusRow.context_hash),
        purchase_qty: Number(statusRow.purchase_qty) || 0,
        allocation_total: Number(statusRow.allocation_total) || 0,
        analysis_record_id: Number(statusRow.analysis_record_id) || null,
        snapshot_id: Number(statusRow.snapshot_id) || null,
        listing_id: Number(statusRow.listing_id) || null,
        asin: normalizeText(statusRow.asin),
        msku: normalizeText(statusRow.msku),
        local_sku: normalizeText(statusRow.local_sku),
        seller_name: normalizeText(statusRow.seller_name),
        marketplace: normalizeText(statusRow.marketplace),
        warehouse_wid: Number(statusRow.warehouse_wid) || null,
        warehouse_name: normalizeText(statusRow.warehouse_name),
        warehouse_confirmation_required: Number(statusRow.warehouse_confirmation_required) === 1,
        errors: parseStoredJson(statusRow.errors_json, []),
        warnings: parseStoredJson(statusRow.warnings_json, []),
        context: parseStoredJson(statusRow.context_json, {}),
        last_run_source: normalizeText(statusRow.last_run_source),
        last_run_time: statusRow.last_run_time,
      },
      purchase_plan: purchasePlan
        ? {
            ...purchasePlan,
            plan_remark_snippet: buildRemarkSnippet(purchasePlan.plan_remark),
            auto_block_matched: parsed.matched,
            auto_block_valid: parsed.valid,
            auto_block_errors: parsed.errors || [],
            summary: buildParsePreviewSummary(parsed),
          }
        : null,
      parsed,
      parse_summary: buildParsePreviewSummary(parsed),
      purchase_order: {
        order_sns: orderSns,
        representative_order_sn: orderSns[0] || '',
        orders: (purchaseOrders || []).map(order => ({
          ...order,
          order_item_count: orderItems.filter(item => normalizeText(item.order_sn) === normalizeText((order as any).order_sn)).length,
        })),
        order_items: orderItems.map(item => ({
          ...item,
          purchase_order: purchaseOrderMap.get(normalizeText(item.order_sn)) || null,
          purchase_plan: {
            plan_sn: normalizeText(purchasePlan.plan_sn),
            ppg_sn: normalizeText(purchasePlan.ppg_sn),
            sku: normalizeText(purchasePlan.sku),
            msku: parseJsonArray(purchasePlan.msku),
            seller_name: normalizeText(purchasePlan.seller_name),
            marketplace: normalizeText(purchasePlan.marketplace),
            quantity_plan: Number(purchasePlan.quantity_plan) || 0,
            warehouse_name: normalizeText(purchasePlan.warehouse_name),
            plan_remark_snippet: buildRemarkSnippet(purchasePlan.plan_remark),
          },
        })),
      },
      listing: currentListing
        ? {
            id: currentListing.id,
            store_id: currentListing.store_id,
            asin: currentListing.asin,
            msku: currentListing.msku,
            local_sku: currentListing.local_sku,
            product_code: currentListing.product_code,
            marketplace: currentListing.marketplace,
            seller_name: currentListing.seller_name,
            item_name: currentListing.item_name,
            image_url: (currentListing as any).image_url,
            pic_url: (currentListing as any).image_url,
            average_thirty_volume: currentListing.average_thirty_volume,
            afn_inbound_working_quantity: currentListing.afn_inbound_working_quantity,
            afn_inbound_shipped_quantity: currentListing.afn_inbound_shipped_quantity,
            afn_inbound_receiving_quantity: currentListing.afn_inbound_receiving_quantity,
          }
        : preview?.context?.matched_listing || null,
      match_detail: matchDetail,
      preview,
      preview_error: previewError,
      analysis_record: analysisRecord,
      snapshot: snapshot
        ? {
            ...snapshot,
            auto_complete_state: snapshotState,
          }
        : null,
      snapshot_state: snapshotState,
    };
  }

  private async processPlanSn(
    planSn: string,
    options: { currentUser?: AutoCompleteCurrentUser; source?: string } = {}
  ) {
    const currentUser = options.currentUser || {
      userId: null,
      username: 'system',
      nickname: '系统自动补全',
    };
    const purchasePlan = await this.purchasePlanRepo.findOne({ where: { plan_sn: planSn } });
    if (!purchasePlan) {
      return { plan_sn: planSn, status: 'skipped', message: '本地采购计划不存在' };
    }

    const parsed = parsePurchasePlanAutoReplenishRemark(purchasePlan.plan_remark);
    if (!parsed.matched) {
      await this.markExistingAutoSnapshotNeedsAttention(planSn, '采购计划备注已移除自动补全配置块');
      return { plan_sn: planSn, status: 'skipped', message: '采购计划备注未配置自动补全块' };
    }
    if (!parsed.valid) {
      throw new Error(parsed.errors.join('；') || '备注解析失败');
    }

    const orderItems = await this.orderItemRepo.find({ where: { plan_sn: planSn } });
    if (!orderItems.length) {
      throw new Error('没有关联采购单明细');
    }

    const representativeItem = orderItems[0];
    const purchaseOrder = representativeItem.order_sn
      ? await this.orderRepo.findOne({ where: { order_sn: representativeItem.order_sn } })
      : null;
    const listing = await this.findMatchedListing(purchasePlan, orderItems);
    if (!listing) {
      throw new Error('未匹配到真实店铺商品');
    }
    if (!normalizeText(listing.asin) || !normalizeText(listing.local_sku)) {
      throw new Error('店铺商品缺少 ASIN 或本地SKU');
    }

    let analysisRecord = await this.analysisRecordRepo.findOne({
      where: { plan_sn: planSn, status: 1 },
      order: { id: 'DESC' },
    });
    let existingSnapshot: AppAmzBsrBatchReplenishSnapshotEntity | null = null;
    if (analysisRecord) {
      existingSnapshot = await this.batchSnapshotRepo.findOne({
        where: { analysis_record_id: Number(analysisRecord.id) },
        order: { id: 'DESC' },
      });
      const protectedDecision = decideAutoCompleteSnapshotAction(existingSnapshot, parsed.remark_hash);
      if (PROTECTED_SNAPSHOT_SOURCES.has(normalizeText(existingSnapshot?.snapshot_source))) {
        return { plan_sn: planSn, status: 'skipped', message: protectedDecision.reason };
      }
    }

    const totalPurchaseQty = this.resolveTotalPurchaseQty(orderItems, purchasePlan);
    const planStartResolution = resolveAutoCompletePlanStartDate(parsed.config, purchasePlan, purchaseOrder);
    if (!planStartResolution.value) {
      throw new Error('备注、采购计划和采购单均缺少计划开始时间');
    }
    const warehouseMatch = await this.resolveWarehouseForContext(parsed, purchasePlan, purchaseOrder);
    const warnings = this.buildShippingProfileWarnings(
      parsed.config.shipping_profile_key || 'default',
      listing.marketplace || purchasePlan.marketplace
    );
    if (!warehouseMatch.matched) warnings.push(`仓库未匹配：${warehouseMatch.reason}`);
    const contextHash = buildAutoCompleteContextHash(this.buildContextHashInput({
      planSn,
      totalPurchaseQty,
      planStartResolution,
      purchasePlan,
      purchaseOrder,
      listing,
      parsed,
      warehouseMatch,
    }));
    const decision = decideAutoCompleteSnapshotAction(existingSnapshot, parsed.remark_hash, contextHash);
    if (decision.action === 'skip') {
      const persistentStatus = warnings.length > 0 ? 'success_with_warnings' : 'success';
      return {
        plan_sn: planSn,
        status: persistentStatus,
        message: `${decision.reason}，本次未重复生成快照`,
        remark_hash: parsed.remark_hash,
        context_hash: contextHash,
        purchase_qty: totalPurchaseQty,
        allocation_total: buildParsePreviewSummary(parsed).allocation_total,
        analysis_record_id: analysisRecord?.id || null,
        snapshot_id: existingSnapshot?.id || null,
        listing_id: listing?.id || null,
        asin: listing?.asin || '',
        msku: listing?.msku || '',
        local_sku: listing?.local_sku || '',
        seller_name: purchasePlan?.seller_name || '',
        marketplace: listing?.marketplace || purchasePlan?.marketplace || '',
        warehouse_wid: warehouseMatch.warehouse_wid,
        warehouse_name: warehouseMatch.warehouse_name,
        warehouse_confirmation_required: warehouseMatch.confirmation_required,
        warnings,
        warning_count: warnings.length,
        order_sn: orderItems.map(item => normalizeText(item.order_sn)).filter(Boolean).join(','),
      };
    }
    const snapshotOrderItem = {
      ...representativeItem,
      quantity_plan: totalPurchaseQty,
      quantity_real: totalPurchaseQty,
    };
    let draft: AutoCompleteSnapshotDraftInput;
    try {
      draft = buildAutoCompleteDraftFromRemark({
        parsed,
        orderItem: snapshotOrderItem,
        purchaseOrder,
        purchasePlan,
        listing,
        totalPurchaseQty,
        warehouseMatch,
        planStartResolution,
        contextHash,
        warnings,
        currentUser,
      });
    } catch (error: any) {
      error.contextHash = contextHash;
      throw error;
    }
    const calendarCoefficients = await this.loadCalendarCoefficients(draft, listing, purchasePlan);
    const { buildManualReplenishmentSnapshotPayload } = require('./bsr_purchase_order_manual_link');
    const manualPayload = buildManualReplenishmentSnapshotPayload({
      orderItem: snapshotOrderItem,
      purchaseOrder,
      purchasePlan,
      listing,
      draft,
      calendarCoefficients,
      currentUser,
      snapshotSource: AUTO_REPLENISH_SNAPSHOT_SOURCE,
      snapshotLabel: AUTO_REPLENISH_SNAPSHOT_LABEL,
    });
    const payload = manualPayload.analysisData;

    const now = new Date();
    if (!analysisRecord) {
      analysisRecord = this.analysisRecordRepo.create({
        store_id: Number(listing.store_id) || Number(purchasePlan.sid) || Number(representativeItem.sid) || 0,
        asin: normalizeText(listing.asin),
        marketplace:
          normalizeText(listing.marketplace) ||
          normalizeText(purchasePlan.marketplace) ||
          normalizeText(representativeItem.plan_marketplace),
        msku: normalizeText(listing.msku) || normalizeText(representativeItem.first_msku),
        local_sku: normalizeText(listing.local_sku) || normalizeText(purchasePlan.sku),
        ppg_sn: normalizeText(purchasePlan.ppg_sn),
        plan_sn: planSn,
        quantity_plan: payload.expected_sales.final_replenishment_qty,
        expected_sales: payload.expected_sales,
        remark: payload.remark,
        manual_remark: payload.manual_remark,
        staged_by_user_id: currentUser.userId,
        staged_by_username: currentUser.username,
        staged_by_nickname: currentUser.nickname,
        staged_time: now,
        purchase_plan_created_by_user_id: currentUser.userId,
        purchase_plan_created_by_username: currentUser.username,
        purchase_plan_created_by_nickname: currentUser.nickname,
        purchase_plan_created_time: now,
        status: 1,
      });
    } else {
      analysisRecord.store_id = Number(listing.store_id) || Number(purchasePlan.sid) || Number(representativeItem.sid) || 0;
      analysisRecord.asin = normalizeText(listing.asin);
      analysisRecord.marketplace =
        normalizeText(listing.marketplace) ||
        normalizeText(purchasePlan.marketplace) ||
        normalizeText(representativeItem.plan_marketplace);
      analysisRecord.msku = normalizeText(listing.msku) || normalizeText(representativeItem.first_msku);
      analysisRecord.local_sku = normalizeText(listing.local_sku) || normalizeText(purchasePlan.sku);
      analysisRecord.ppg_sn = normalizeText(purchasePlan.ppg_sn);
      analysisRecord.plan_sn = planSn;
      analysisRecord.quantity_plan = payload.expected_sales.final_replenishment_qty;
      analysisRecord.expected_sales = payload.expected_sales;
      analysisRecord.remark = payload.remark;
      analysisRecord.manual_remark = payload.manual_remark;
      analysisRecord.staged_by_user_id = currentUser.userId;
      analysisRecord.staged_by_username = currentUser.username;
      analysisRecord.staged_by_nickname = currentUser.nickname;
      analysisRecord.staged_time = now;
      analysisRecord.purchase_plan_created_by_user_id = currentUser.userId;
      analysisRecord.purchase_plan_created_by_username = currentUser.username;
      analysisRecord.purchase_plan_created_by_nickname = currentUser.nickname;
      analysisRecord.purchase_plan_created_time = now;
    }
    analysisRecord = await this.analysisRecordRepo.save(analysisRecord);
    const snapshot = await this.saveAutoSnapshot(existingSnapshot, {
      analysisRecordId: Number(analysisRecord.id),
      planSn,
      ppgSn: normalizeText(purchasePlan.ppg_sn),
      snapshot: manualPayload.snapshot,
      payload,
      currentUser,
    });

    await this.purchasePlanRepo.update({ plan_sn: planSn }, { analysis_record_id: Number(analysisRecord.id) });
    await this.orderItemRepo.update({ plan_sn: planSn }, {
      analysis_record_id: Number(analysisRecord.id),
      is_analysis_missing: 0,
    });

    return {
      plan_sn: planSn,
      status: existingSnapshot ? 'updated' : 'created',
      analysis_record_id: analysisRecord.id,
      snapshot_id: snapshot.id,
      remark_hash: parsed.remark_hash,
      context_hash: contextHash,
      purchase_qty: totalPurchaseQty,
      allocation_total: buildParsePreviewSummary(parsed).allocation_total,
      listing_id: listing?.id || null,
      asin: listing?.asin || '',
      msku: listing?.msku || '',
      local_sku: listing?.local_sku || '',
      seller_name: purchasePlan?.seller_name || '',
      marketplace: listing?.marketplace || purchasePlan?.marketplace || '',
      warehouse_wid: warehouseMatch.warehouse_wid,
      warehouse_name: warehouseMatch.warehouse_name,
      warehouse_confirmation_required: warehouseMatch.confirmation_required,
      order_sn: orderItems.map(item => normalizeText(item.order_sn)).filter(Boolean).join(','),
      warnings,
      warning_count: warnings.length,
      message: existingSnapshot ? '自动补全快照已更新' : '自动补全快照已创建',
    };
  }

  private resolveTotalPurchaseQty(orderItems: AppAmzBsrPurchaseOrderItemSyncLingxingEntity[], purchasePlan: any) {
    const itemTotal = orderItems.reduce((sum, item) => {
      return sum + (positiveIntegerOrNull(item.quantity_plan) || positiveIntegerOrNull(item.quantity_real) || 0);
    }, 0);
    return itemTotal || positiveIntegerOrNull(purchasePlan?.quantity_plan) || 0;
  }

  private async findMatchedListing(
    purchasePlan: AppAmzBsrPurchasePlanLingxingEntity,
    orderItems: AppAmzBsrPurchaseOrderItemSyncLingxingEntity[]
  ) {
    const candidates: Array<{ sourceLabel: string; field: 'msku' | 'local_sku'; storeId: any; value: any }> = [];
    for (const item of orderItems) {
      candidates.push({ sourceLabel: '采购单明细MSKU', field: 'msku', storeId: item.sid, value: item.first_msku });
    }
    candidates.push({
      sourceLabel: '采购计划本地SKU',
      field: 'local_sku',
      storeId: purchasePlan.sid || orderItems[0]?.sid,
      value: purchasePlan.sku,
    });
    for (const msku of parseJsonArray(purchasePlan.msku)) {
      candidates.push({
        sourceLabel: '采购计划MSKU',
        field: 'msku',
        storeId: purchasePlan.sid || orderItems[0]?.sid,
        value: msku,
      });
    }

    const expectedMarketplace = normalizeText(
      purchasePlan?.marketplace || orderItems.find(item => normalizeText((item as any).plan_marketplace))?.plan_marketplace
    );
    const uniqueCandidates = new Map<string, typeof candidates[number]>();
    for (const candidate of candidates) {
      const storeId = Number(candidate.storeId) || 0;
      const value = normalizeText(candidate.value);
      if (!storeId || !value) continue;
      uniqueCandidates.set(`${candidate.sourceLabel}|${candidate.field}|${storeId}|${value}`, {
        ...candidate,
        storeId,
        value,
      });
    }

    const hits: Array<{ candidate: typeof candidates[number]; listing: any }> = [];
    for (const candidate of uniqueCandidates.values()) {
      const rows = await this.listingRepo.find({
        where: {
          store_id: Number(candidate.storeId),
          [candidate.field]: candidate.value,
        } as any,
        order: { id: 'DESC' } as any,
      });
      if (!rows?.length) continue;

      const marketplaceMatchedRows = expectedMarketplace
        ? rows.filter(row => normalizeText((row as any).marketplace) === expectedMarketplace)
        : rows;
      if (expectedMarketplace && rows.length > 0 && marketplaceMatchedRows.length === 0) {
        throw new Error(
          `店铺商品站点不一致：${candidate.sourceLabel} ${candidate.value} 要求 ${expectedMarketplace}，命中 ${rows
            .map(row => normalizeText((row as any).marketplace) || '-')
            .join('、')}`
        );
      }
      if (marketplaceMatchedRows.length > 1) {
        throw new Error(
          `店铺商品匹配不唯一：${candidate.sourceLabel} ${candidate.value} 在店铺 ${candidate.storeId} 命中 ${marketplaceMatchedRows.length} 条`
        );
      }
      hits.push({ candidate, listing: marketplaceMatchedRows[0] });
    }

    if (!hits.length) return null;

    const byListing = new Map<string, { candidateLabels: string[]; listing: any }>();
    for (const hit of hits) {
      const listing = hit.listing || {};
      const listingKey = normalizeText(listing.id) || [
        normalizeText(listing.store_id),
        normalizeText(listing.asin),
        normalizeText(listing.marketplace),
        normalizeText(listing.msku),
        normalizeText(listing.local_sku),
      ].join('|');
      const existing = byListing.get(listingKey) || { candidateLabels: [], listing };
      existing.candidateLabels.push(`${hit.candidate.sourceLabel}:${hit.candidate.value}`);
      byListing.set(listingKey, existing);
    }
    if (byListing.size > 1) {
      const detail = Array.from(byListing.values())
        .map(item => {
          const listing = item.listing || {};
          return `${item.candidateLabels.join('/')} -> ${normalizeText(listing.local_sku || listing.msku || listing.asin || listing.id)}`;
        })
        .join('；');
      throw new Error(`店铺商品匹配冲突：${detail}`);
    }

    return Array.from(byListing.values())[0].listing;
  }

  private async buildAutoCompleteMatchDetail(
    purchasePlan: AppAmzBsrPurchasePlanLingxingEntity,
    orderItems: AppAmzBsrPurchaseOrderItemSyncLingxingEntity[],
    currentListing: any = null
  ) {
    const expectedMarketplace = normalizeText(
      purchasePlan?.marketplace || orderItems.find(item => normalizeText((item as any).plan_marketplace))?.plan_marketplace
    );
    const planStoreId = Number(purchasePlan?.sid) || Number(orderItems[0]?.sid) || 0;
    const candidates: Array<{
      source_label: string;
      field: 'msku' | 'local_sku';
      store_id: number;
      value: string;
      source_type: string;
      source_id: number | null;
    }> = [];

    for (const item of orderItems || []) {
      const storeId = Number(item.sid) || planStoreId;
      const value = normalizeText(item.first_msku);
      if (!storeId || !value) continue;
      candidates.push({
        source_label: '采购单明细 MSKU',
        field: 'msku',
        store_id: storeId,
        value,
        source_type: 'order_item',
        source_id: Number(item.id) || null,
      });
    }

    const planSku = normalizeText(purchasePlan?.sku);
    if (planStoreId && planSku) {
      candidates.push({
        source_label: '采购计划本地 SKU',
        field: 'local_sku',
        store_id: planStoreId,
        value: planSku,
        source_type: 'purchase_plan',
        source_id: Number(purchasePlan?.id) || null,
      });
    }

    for (const value of parseJsonArray(purchasePlan?.msku)) {
      const text = normalizeText(value);
      if (!planStoreId || !text) continue;
      candidates.push({
        source_label: '采购计划 MSKU',
        field: 'msku',
        store_id: planStoreId,
        value: text,
        source_type: 'purchase_plan',
        source_id: Number(purchasePlan?.id) || null,
      });
    }

    const candidateMap = new Map<string, typeof candidates[number]>();
    for (const candidate of candidates) {
      candidateMap.set(
        `${candidate.source_label}|${candidate.field}|${candidate.store_id}|${candidate.value}`,
        candidate
      );
    }

    const candidate_rows: any[] = [];
    for (const candidate of candidateMap.values()) {
      const rows = await this.listingRepo.find({
        where: {
          store_id: Number(candidate.store_id),
          [candidate.field]: candidate.value,
        } as any,
        order: { id: 'DESC' } as any,
      });
      const matchedRows = expectedMarketplace
        ? rows.filter(row => normalizeText((row as any).marketplace) === expectedMarketplace)
        : rows;
      const matchedListingIds = [...new Set(rows.map(row => Number((row as any).id) || null).filter(Boolean))];
      const marketplaceMatchedListingIds = [
        ...new Set(matchedRows.map(row => Number((row as any).id) || null).filter(Boolean)),
      ];
      let status: 'matched' | 'ambiguous' | 'marketplace_mismatch' | 'not_found' = 'not_found';
      if (!rows.length) {
        status = 'not_found';
      } else if (expectedMarketplace && !matchedRows.length) {
        status = 'marketplace_mismatch';
      } else if (matchedRows.length > 1) {
        status = 'ambiguous';
      } else if (matchedRows.length === 1) {
        status = 'matched';
      } else if (!expectedMarketplace && rows.length === 1) {
        status = 'matched';
      } else if (!expectedMarketplace && rows.length > 1) {
        status = 'ambiguous';
      }

      candidate_rows.push({
        source_label: candidate.source_label,
        field: candidate.field,
        store_id: candidate.store_id,
        value: candidate.value,
        source_type: candidate.source_type,
        source_id: candidate.source_id,
        matched_count: rows.length,
        marketplace_matched_count: matchedRows.length,
        matched_listing_id: matchedRows[0]?.id ? Number(matchedRows[0].id) : null,
        matched_listing_ids: matchedListingIds,
        marketplace_matched_listing_ids: marketplaceMatchedListingIds,
        matched_to_current_listing: Boolean(currentListing?.id) &&
          (matchedListingIds.includes(Number(currentListing.id)) ||
            marketplaceMatchedListingIds.includes(Number(currentListing.id))),
        status,
        matched_marketplaces: [...new Set(rows.map(row => normalizeText((row as any).marketplace)).filter(Boolean))],
      });
    }

    const matchedRows = candidate_rows.filter(row => row.status === 'matched' && row.matched_listing_id);
    const matchedListingIds = [...new Set(matchedRows.map(row => Number(row.matched_listing_id) || null).filter(Boolean))];
    const currentListingId = Number(currentListing?.id) || null;
    const matchedBasis = currentListingId
      ? candidate_rows
          .filter(row => row.matched_to_current_listing)
          .map(row => row.source_label)
      : matchedRows.map(row => row.source_label);
    const uniqueMatch =
      matchedListingIds.length === 1 &&
      candidate_rows.every(row => row.status !== 'ambiguous' && row.status !== 'marketplace_mismatch');

    return {
      expected_marketplace: expectedMarketplace,
      current_listing_id: currentListingId || matchedListingIds[0] || null,
      current_listing: currentListing
        ? {
            id: currentListing.id,
            store_id: currentListing.store_id,
            asin: currentListing.asin,
            msku: currentListing.msku,
            local_sku: currentListing.local_sku,
            product_code: currentListing.product_code,
            marketplace: currentListing.marketplace,
            seller_name: currentListing.seller_name,
            item_name: currentListing.item_name,
            image_url: (currentListing as any).image_url,
            pic_url: (currentListing as any).image_url,
          }
        : null,
      unique_match: uniqueMatch,
      matched_basis: matchedBasis,
      candidate_count: candidate_rows.length,
      candidate_rows,
    };
  }

  private async loadCalendarCoefficients(
    draft: AutoCompleteSnapshotDraftInput,
    listing: any,
    purchasePlan: any
  ) {
    try {
      const startMonth = dayjs(draft.cycle_start_date).format('YYYY-MM');
      const endMonth = dayjs(draft.cycle_end_date).format('YYYY-MM');
      const productCode = normalizeText(listing?.product_code);
      const marketplace = normalizeText(listing?.marketplace || purchasePlan?.marketplace);
      if (!productCode || !marketplace || !this.analysisCustomService?.getCalendarCoefficients) {
        return null;
      }
      return await this.analysisCustomService.getCalendarCoefficients(
        productCode,
        marketplace,
        startMonth,
        endMonth,
        undefined,
        undefined,
        normalizeText(listing?.asin),
        Number(listing?.id) || undefined,
        normalizeText(listing?.msku),
        Number(listing?.store_id) || undefined
      );
    } catch {
      return null;
    }
  }

  private async saveAutoSnapshot(
    existingSnapshot: AppAmzBsrBatchReplenishSnapshotEntity | null,
    options: {
      analysisRecordId: number;
      planSn: string;
      ppgSn: string;
      snapshot: any;
      payload: any;
      currentUser: AutoCompleteCurrentUser;
    }
  ) {
    const snapshot = options.snapshot || {};
    const identity = snapshot.identity || {};
    const quick = snapshot.quick_fields || {};
    const expectedSales = options.payload?.expected_sales || {};
    const entity = existingSnapshot || this.batchSnapshotRepo.create();

    entity.analysis_record_id = options.analysisRecordId;
    entity.plan_sn = normalizeNullableText(options.planSn);
    entity.ppg_sn = normalizeNullableText(options.ppgSn);
    entity.store_id = Number(identity.store_id || quick.store_id || options.payload?.store_id) || null;
    entity.asin = normalizeNullableText(identity.asin || quick.asin || options.payload?.asin);
    entity.msku = normalizeNullableText(identity.msku || quick.msku || options.payload?.msku);
    entity.marketplace = normalizeNullableText(identity.marketplace || quick.marketplace || options.payload?.marketplace);
    entity.product_code = normalizeNullableText(identity.product_code || quick.product_code || options.payload?.product_code);
    entity.local_sku = normalizeNullableText(identity.local_sku || quick.local_sku || options.payload?.local_sku);
    entity.snapshot_version = Number(snapshot.snapshot_version) || 1;
    entity.snapshot_source = AUTO_REPLENISH_SNAPSHOT_SOURCE;
    entity.algorithm_key = normalizeNullableText(quick.algorithm_key || snapshot.input_json?.algorithm?.key);
    entity.algorithm_name = normalizeNullableText(quick.algorithm_name || snapshot.input_json?.algorithm?.name);
    entity.cycle_start_date = normalizeNullableText(
      quick.cycle_start_date || snapshot.calculation_json?.cycle?.start_date || expectedSales.start_date
    );
    entity.cycle_end_date = normalizeNullableText(
      quick.cycle_end_date || snapshot.calculation_json?.cycle?.end_date || expectedSales.end_date
    );
    entity.daily_avg_sales = Number(quick.daily_avg_sales || snapshot.input_json?.daily_avg_sales) || null;
    entity.target_stock_days = Number(quick.target_stock_days || snapshot.input_json?.target_stock_days) || null;
    entity.volatility_coefficient =
      Number(quick.volatility_coefficient || snapshot.input_json?.volatility_coefficient) || null;
    entity.system_suggested_qty =
      Number(quick.system_suggested_qty || snapshot.calculation_json?.system_suggested_qty) || null;
    entity.actual_purchase_qty =
      Number(quick.actual_purchase_qty || snapshot.calculation_json?.actual_purchase_qty_before_box) || null;
    entity.final_purchase_qty =
      Number(quick.final_purchase_qty || snapshot.calculation_json?.final_purchase_qty) || null;
    entity.warehouse_wid = Number(quick.warehouse_wid || snapshot.input_json?.warehouse?.wid) || null;
    entity.warehouse_name = normalizeNullableText(quick.warehouse_name || snapshot.input_json?.warehouse?.name);
    entity.adjust_mode = normalizeNullableText(quick.adjust_mode || snapshot.adjustment_json?.mode);
    entity.box_pcs =
      Number(quick.box_pcs || snapshot.calculation_json?.box_adjustment?.box_pcs || expectedSales.box_pcs) || null;
    entity.summary_json = cloneJson(snapshot.summary_json || null);
    entity.input_json = cloneJson(snapshot.input_json || null);
    entity.calculation_json = cloneJson(snapshot.calculation_json || null);
    entity.shipping_json = cloneJson(snapshot.shipping_json || null);
    entity.adjustment_json = cloneJson(snapshot.adjustment_json || null);
    entity.coefficient_json = cloneJson(snapshot.coefficient_json || null);
    entity.inventory_json = cloneJson(snapshot.inventory_json || null);
    entity.remark_json = cloneJson({
      ...(snapshot.remark_json || {}),
      auto_replenish_remark: {
        source: AUTO_REPLENISH_SNAPSHOT_SOURCE,
        source_label: AUTO_REPLENISH_SNAPSHOT_LABEL,
        remark_hash: getSnapshotRemarkHash(snapshot),
        context_hash: getSnapshotContextHash(snapshot),
        auto_complete_status:
          snapshot.input_json?.reconstruction?.auto_complete_status || 'completed',
        warnings: cloneJson(snapshot.input_json?.reconstruction?.warnings || []),
        raw_block: snapshot.input_json?.reconstruction?.raw_block || '',
      },
    });
    entity.ui_snapshot_json = cloneJson(snapshot.ui_snapshot_json || null);
    entity.full_snapshot_json = cloneJson(snapshot.full_snapshot_json || snapshot);
    entity.created_by = options.currentUser.userId;
    entity.created_by_name = normalizeText(options.currentUser.nickname || options.currentUser.username);

    return await this.batchSnapshotRepo.save(entity);
  }
}
