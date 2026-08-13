import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AppAmzBsrAnalysisRecordLingxingEntity } from '../entity/bsr_analysis_record_lingxing';
import { AppAmzBsrProductListingLingxingEntity } from '../entity/bsr_product_Listing_Lingxing';
import { AppAmzBsrPurchaseOrderItemSyncLingxingEntity } from '../entity/bsr_purchase_order_item_sync_lingxing';
import { AppAmzBsrPurchaseOrderSyncLingxingEntity } from '../entity/bsr_purchase_order_sync_lingxing';
import { AppAmzBsrPurchaseOrderLogisticsService } from './bsr_purchase_order_logistics';
import { AppAmzBsrPurchaseOrderSyncLingxingService } from './bsr_purchase_order_sync_lingxing';
import { AppAmzBsrRestockingCenterLingxingService } from './bsr_restocking_center_lingxing';
import { AppAmzBsrShipmentActualLingxingService } from './bsr_shipment_actual_lingxing';
import {
  AppAmzBsrPurchaseOrderFulfillmentAdjustmentService,
  computeFulfillmentSummary,
} from './bsr_purchase_order_fulfillment_adjustment';
import { BaseSysUserEntity } from '../../base/entity/sys/user';
import * as dayjs from 'dayjs';
import { buildAutoCompleteSnapshotDisplayState } from '../utils/purchase/purchase_plan_auto_complete_snapshot';

type QueryValue = string | number | Array<string | number> | null | undefined;

interface ProductIdentity {
  store_id: number | string;
  asin: string;
  marketplace: string;
  msku?: string | null;
  product_code?: string | null;
}

interface PageParam {
  page?: number;
  size?: number;
  keyWord?: string;
  marketplace?: QueryValue;
  seller_name?: QueryValue;
  store_id?: QueryValue;
  product_code?: QueryValue;
  fulfillment_status?: string;
  work_status?: string;
  purchase_order_statuses?: QueryValue;
  logistics_status?: string;
}

interface PurchaseOrderFlowParam {
  store_id?: QueryValue;
  marketplace?: QueryValue;
  asin?: QueryValue;
  msku?: QueryValue;
  product_code?: QueryValue;
  plan_sn?: QueryValue;
  analysis_record_id?: QueryValue;
  purchase_order_sn?: QueryValue;
}

interface PurchaseOrderFlowBatchItemParam extends PurchaseOrderFlowParam {
  clientKey?: string;
  row_key?: string;
  plan_sns?: QueryValue;
  analysis_record_ids?: QueryValue;
  order_sns?: QueryValue;
  orders?: Array<PurchaseOrderFlowParam & { linked_plan_sns?: QueryValue }>;
}

interface PurchaseOrderFlowBatchParam {
  items?: PurchaseOrderFlowBatchItemParam[];
  preserve_order_traces?: boolean;
}

interface SyncLatestRelatedDataItem {
  row_key?: string;
  product?: Partial<ProductIdentity> & {
    local_sku?: string | null;
    seller_name?: string | null;
  };
  plans?: Array<{
    plan_sn?: string | null;
    purchase_orders?: Array<{ order_sn?: string | null }>;
    shipment_plans?: Array<{
      seq?: string | null;
      sku?: string | null;
      purchase_order_sn?: string | null;
      purchase_plan_sn?: string | null;
    }>;
  }>;
}

interface SyncLatestRelatedDataParam {
  items?: SyncLatestRelatedDataItem[];
}

const PURCHASE_ORDER_STATUS_COUNT_VALUES = [2, 9, 1, 3, -1, 121, 122, 124];

const FULFILLMENT_STATUS_COUNT_VALUES = [
  'shippable',
  'completed',
  'exception_completed',
  'abnormal',
];

const LOGISTICS_STATUS_COUNT_VALUES = [
  'in_transit',
  'signed',
  'confirmed',
  'overtime_unsigned',
  'partial_signed',
  'partial_overtime_unsigned',
  'pending_mapping',
  'phone_required',
  'manual_required',
  'logistics_abnormal',
  'logistics_exception',
  'no_logistics',
];

interface PurchaseOrderFlowIdentity {
  store_id: number;
  marketplace: string;
  asin: string;
  msku: string;
  product_code: string;
  plan_sn: string;
  analysis_record_id: number;
  purchase_order_sn: string;
}

type ReplenishmentTraceLevel =
  | 'full_record'
  | 'legacy_snapshot'
  | 'legacy_compatible';

type ReplenishmentSnapshotSectionKey =
  | 'quick_fields'
  | 'summary_json'
  | 'input_json'
  | 'calculation_json'
  | 'shipping_json'
  | 'adjustment_json'
  | 'coefficient_json'
  | 'inventory_json'
  | 'remark_json'
  | 'ui_snapshot_json'
  | 'full_snapshot_json';

interface ReplenishmentTraceLike {
  key: string;
  plan_sn?: string;
  analysis_record_id?: number | null;
  linked_order_sns?: string[];
  linked_order_count?: number;
  error?: string;
  flow?: any;
}

const SNAPSHOT_SECTION_KEYS: ReplenishmentSnapshotSectionKey[] = [
  'quick_fields',
  'summary_json',
  'input_json',
  'calculation_json',
  'shipping_json',
  'adjustment_json',
  'coefficient_json',
  'inventory_json',
  'remark_json',
  'ui_snapshot_json',
  'full_snapshot_json',
];

const CRITICAL_SNAPSHOT_SECTION_KEYS: ReplenishmentSnapshotSectionKey[] = [
  'calculation_json',
  'shipping_json',
  'coefficient_json',
  'inventory_json',
];

const SNAPSHOT_SECTION_LABELS: Record<string, string> = {
  calculation_json: '计算过程',
  shipping_json: '运输段',
  coefficient_json: '系数复盘',
  inventory_json: '库存推演',
};

export function buildProductRowKey(product: ProductIdentity) {
  return [
    product.store_id ?? '',
    product.asin ?? '',
    product.marketplace ?? '',
    product.msku ?? '',
    product.product_code ?? '',
  ].join('|');
}

function parseMaybeJson(value: any) {
  if (!value) return {};
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function pickFirst(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
}

function toNumber(value: any) {
  return Number(value) || 0;
}

function toNullableNumber(value: any) {
  if (!hasValue(value)) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function normalizeReplenishmentAlgorithmKey(value: any) {
  const text = normalizeFlowText(value).toLowerCase();
  if (!text) return '';
  if (['1', 'daily', 'daily_avg', 'dailyavg'].includes(text) || text.includes('日均')) {
    return 'daily_avg';
  }
  if (['2', 'history', 'sales', 'historical'].includes(text) || text.includes('历史')) {
    return 'history';
  }
  if (
    ['3', 'trend', 'keyword', 'keywords', 'search', 'search_trend'].includes(text) ||
    text.includes('搜索')
  ) {
    return 'trend';
  }
  if (['4', 'combined', 'combine'].includes(text) || text.includes('综合')) {
    return 'combined';
  }
  if (['operator_intent', 'operator-intent', 'operation_intent'].includes(text) || text.includes('运营意')) {
    return 'combined';
  }
  return text;
}

function getSnapshotMonthKey(value: any) {
  const text = normalizeFlowText(value);
  const matched = text.match(/\d{4}-\d{2}/);
  return matched ? matched[0] : text;
}

function hasRestorableNumber(value: any, positive = false) {
  const num = toNullableNumber(value);
  if (num === null) return false;
  return positive ? num > 0 : true;
}

function getSnapshotMonthlyCoefficientMap(segment: any) {
  const raw = parseMaybeJson(
    pickFirst(segment?.monthly_coefficients, segment?.monthlyCoefficients)
  );
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw;
}

function getSnapshotDemandRows(segment: any) {
  const raw = parseMaybeJson(segment?.demand_breakdown);
  return Array.isArray(raw) ? raw : [];
}

function hasCombinedCoefficientParts(row: any) {
  return hasRestorableNumber(row?.alpha) &&
    (hasRestorableNumber(row?.filled_sales_coefficient) ||
      hasRestorableNumber(row?.sales_coefficient) ||
      hasRestorableNumber(row?.salesCoeff)) &&
    (hasRestorableNumber(row?.keyword_coefficient) ||
      hasRestorableNumber(row?.search_coefficient) ||
      hasRestorableNumber(row?.searchCoeff));
}

function hasRestorableCoefficientRow(row: any, algorithmKey: string) {
  if (!row || typeof row !== 'object') return false;
  if (
    hasRestorableNumber(row.raw_coefficient) ||
    hasRestorableNumber(row.rawCoefficient) ||
    hasRestorableNumber(row.raw_combined_coefficient) ||
    hasRestorableNumber(row.rawCombinedCoefficient)
  ) {
    return algorithmKey === 'combined' ? hasCombinedCoefficientParts(row) || hasRestorableNumber(row.alpha) : true;
  }
  if (algorithmKey === 'combined') return hasCombinedCoefficientParts(row);
  return hasRestorableNumber(row.coefficient) || hasRestorableNumber(row.adjusted_coefficient);
}

function hasSegmentCoefficientRestoreData(segment: any, algorithmKey: string) {
  if (algorithmKey === 'daily_avg') return true;
  const monthMap = getSnapshotMonthlyCoefficientMap(segment);
  if (Object.keys(monthMap).some(month => getSnapshotMonthKey(month) && hasRestorableCoefficientRow(monthMap[month], algorithmKey))) {
    return true;
  }
  return getSnapshotDemandRows(segment).some(row => hasRestorableCoefficientRow(row, algorithmKey));
}

function buildReplenishmentRestoreCapability(options: {
  snapshotMeta: any;
  sections: Record<string, any>;
  shippingSegments: any[];
}) {
  const missing: string[] = [];
  const missingLabels: string[] = [];
  const algorithmKey = normalizeReplenishmentAlgorithmKey(
    pickFirst(
      options.snapshotMeta?.algorithm_key,
      options.snapshotMeta?.algorithm_id,
      options.snapshotMeta?.algorithm_name,
      options.sections?.input_json?.algorithm?.key,
      options.sections?.input_json?.algorithm?.id,
      options.sections?.quick_fields?.algorithm_key,
      options.sections?.quick_fields?.algorithm_name
    )
  );

  const addMissing = (key: string, label: string) => {
    if (missing.includes(key)) return;
    missing.push(key);
    missingLabels.push(label);
  };

  if (!hasRestorableNumber(options.snapshotMeta?.daily_avg_sales, true)) {
    addMissing('daily_avg_sales', '当时日均销量');
  }
  if (!hasRestorableNumber(options.snapshotMeta?.target_stock_days, true)) {
    addMissing('target_stock_days', '目标库存天数');
  }
  if (!hasRestorableNumber(options.snapshotMeta?.volatility_coefficient)) {
    addMissing('volatility_coefficient', '波动系数');
  }
  if (!algorithmKey) {
    addMissing('algorithm_key', '算法类型');
  }

  const effectiveSegments = (options.shippingSegments || []).filter(
    segment => segment?.has_segment
  );
  if (!effectiveSegments.length) {
    addMissing('shipping_segments', '运输段明细');
  }
  if (
    algorithmKey &&
    algorithmKey !== 'daily_avg' &&
    effectiveSegments.length > 0 &&
    effectiveSegments.some(segment => !hasSegmentCoefficientRestoreData(segment, algorithmKey))
  ) {
    addMissing('monthly_coefficients', '逐月系数/α');
  }

  return {
    restorable: missing.length === 0,
    label: missing.length === 0 ? '可还原' : '仅展示',
    algorithm_key: algorithmKey,
    missing,
    missing_labels: missingLabels,
    reason: missing.length
      ? `缺少${missingLabels.join('、')}，只能查看不能还原算法`
      : '完整记录包含算法、参数和运输段系数，可作为批量发货推演来源',
  };
}

function hasValue(value: any) {
  return value !== undefined && value !== null && value !== '';
}

function safeJsonParse(value: any) {
  if (!value) return null;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getMatchedListByMsku(list: any, msku: any, field = 'msku') {
  if (!Array.isArray(list)) return [];
  const target = String(msku || '').trim();

  return list.filter((item: any) => {
    if (!target) return true;
    const value = String(item?.[field] || '').trim();
    return value ? value === target : true;
  });
}

function pickLatestTime(current: any, next: any) {
  if (!next) return current || null;
  if (!current) return next;

  return new Date(next).getTime() > new Date(current).getTime()
    ? next
    : current;
}

function normalizeFlowText(value: any) {
  return String(value ?? '').trim();
}

function uniqueTextList(values: any[]) {
  return Array.from(
    new Set(values.map(value => normalizeFlowText(value)).filter(Boolean))
  );
}

function buildReplenishmentSnapshotSectionMap(snapshot: any) {
  const fullSnapshotJson = parseMaybeJson(snapshot?.full_snapshot_json);
  const sections: Record<string, any> = {};

  SNAPSHOT_SECTION_KEYS.forEach(key => {
    const directValue = parseMaybeJson(snapshot?.[key]);
    const fullSnapshotValue = parseMaybeJson(fullSnapshotJson?.[key]);
    sections[key] = isMeaningfulSnapshotValue(directValue)
      ? directValue
      : fullSnapshotValue;
  });

  if (!isMeaningfulSnapshotValue(sections.full_snapshot_json)) {
    sections.full_snapshot_json = fullSnapshotJson;
  }

  return sections;
}

function buildReplenishmentSnapshotMeta(snapshot: any, analysis?: any) {
  const sections = buildReplenishmentSnapshotSectionMap(snapshot);
  const quickFields = sections.quick_fields || {};
  const inputJson = sections.input_json || {};
  const calculationJson = sections.calculation_json || {};
  const coefficientJson = sections.coefficient_json || {};
  const fullSnapshotJson = sections.full_snapshot_json || {};
  const periodJson = inputJson.period || {};

  return {
    snapshot_id: toNullableNumber(
      pickFirst(snapshot?.id, fullSnapshotJson?.snapshot_id, fullSnapshotJson?.id)
    ),
    plan_sn: normalizeFlowText(
      pickFirst(snapshot?.plan_sn, fullSnapshotJson?.plan_sn, analysis?.plan_sn)
    ),
    analysis_record_id: toNullableNumber(
      pickFirst(snapshot?.analysis_record_id, fullSnapshotJson?.analysis_record_id, analysis?.id)
    ),
    created_at: normalizeFlowText(
      pickFirst(
        snapshot?.createTime,
        snapshot?.created_at,
        fullSnapshotJson?.createTime,
        fullSnapshotJson?.created_at,
        analysis?.analysis_create_time,
        analysis?.createTime
      )
    ),
    updated_at: normalizeFlowText(
      pickFirst(snapshot?.updateTime, snapshot?.updated_at, fullSnapshotJson?.updateTime)
    ),
    created_by: pickFirst(
      snapshot?.created_by,
      fullSnapshotJson?.created_by,
      analysis?.purchase_plan_created_by_user_id
    ),
    created_by_name: normalizeFlowText(
      pickFirst(
        snapshot?.created_by_name,
        fullSnapshotJson?.created_by_name,
        analysis?.purchase_plan_created_by_nickname,
        analysis?.purchase_plan_created_by_username
      )
    ),
    algorithm_name: normalizeFlowText(
      pickFirst(
        snapshot?.algorithm_name,
        quickFields.algorithm_name,
        inputJson.algorithm?.name,
        inputJson.algorithm?.label,
        analysis?.user_selected_algo_name
      )
    ),
    algorithm_key: normalizeReplenishmentAlgorithmKey(
      pickFirst(
        snapshot?.algorithm_key,
        snapshot?.algorithm_id,
        quickFields.algorithm_key,
        quickFields.algorithm_id,
        inputJson.algorithm?.key,
        inputJson.algorithm?.value,
        inputJson.algorithm?.id,
        inputJson.algorithm_key,
        analysis?.user_selected_algo_key,
        analysis?.user_selected_algo_id,
        analysis?.user_selected_algo_name,
        snapshot?.algorithm_name,
        quickFields.algorithm_name
      )
    ),
    cycle_start_date: normalizeFlowText(
      pickFirst(
        snapshot?.cycle_start_date,
        quickFields.cycle_start_date,
        periodJson.start_date,
        calculationJson.cycle?.start_date,
        analysis?.start_date
      )
    ),
    cycle_end_date: normalizeFlowText(
      pickFirst(
        snapshot?.cycle_end_date,
        quickFields.cycle_end_date,
        periodJson.end_date,
        calculationJson.cycle?.end_date,
        analysis?.end_date
      )
    ),
    cycle_days: toNullableNumber(
      pickFirst(
        quickFields.total_days,
        periodJson.total_days,
        calculationJson.cycle?.total_days,
        analysis?.total_days
      )
    ),
    daily_avg_sales: toNullableNumber(
      pickFirst(
        snapshot?.daily_avg_sales,
        quickFields.daily_avg_sales,
        calculationJson.daily_avg_sales,
        analysis?.base_daily_avg_sales
      )
    ),
    target_stock_days: toNullableNumber(
      pickFirst(snapshot?.target_stock_days, quickFields.target_stock_days)
    ),
    volatility_coefficient: toNullableNumber(
      pickFirst(
        snapshot?.volatility_coefficient,
        quickFields.volatility_coefficient,
        inputJson.volatility_coefficient,
        coefficientJson.volatility_coefficient,
        analysis?.volatility_coefficient
      )
    ),
  };
}

function classifyReplenishmentSnapshotQuality(options: {
  hasSnapshot: boolean;
  sections: Record<string, any>;
}) {
  if (!options.hasSnapshot) {
    return {
      trace_level: 'legacy_compatible' as ReplenishmentTraceLevel,
      snapshot_label: '历史记录',
      actionable: false,
      available_sections: [],
      missing_sections: [],
      missing_section_labels: [],
    };
  }

  const sections = options.sections || {};
  const availableSections = SNAPSHOT_SECTION_KEYS.filter(key =>
    isMeaningfulSnapshotSection(key, sections[key])
  );
  const missingSections = CRITICAL_SNAPSHOT_SECTION_KEYS.filter(
    key => !isMeaningfulSnapshotSection(key, sections[key])
  );

  if (missingSections.length > 0) {
    return {
      trace_level: 'legacy_snapshot' as ReplenishmentTraceLevel,
      snapshot_label: '旧版快照',
      actionable: false,
      available_sections: availableSections,
      missing_sections: missingSections,
      missing_section_labels: missingSections.map(
        key => SNAPSHOT_SECTION_LABELS[key] || key
      ),
    };
  }

  return {
    trace_level: 'full_record' as ReplenishmentTraceLevel,
    snapshot_label: '完整记录',
    actionable: true,
    available_sections: availableSections,
    missing_sections: [],
    missing_section_labels: [],
  };
}

function getReplenishmentSnapshotSourceLabel(source: any) {
  const text = normalizeFlowText(source);
  if (text === 'purchase_plan_remark_auto_complete') return '采购计划备注自动补全';
  if (text === 'purchase_order_manual_link') return '人工历史补全';
  if (text === 'batch_replenish') return '批量补货生成';
  if (text === 'ui_batch_ship_test') return '批量发货测试';
  return text;
}

function mergeReplenishmentTraceResults<T extends ReplenishmentTraceLike>(
  traces: T[]
): T[] {
  const grouped = new Map<string, T>();

  for (const trace of traces) {
    const key = getResolvedReplenishmentTraceGroupKey(trace);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, normalizeMergedReplenishmentTrace(trace, key) as T);
      continue;
    }

    grouped.set(key, mergeTwoReplenishmentTraces(existing, trace, key) as T);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const rankDiff = getReplenishmentTraceQualityRank(b) - getReplenishmentTraceQualityRank(a);
    if (rankDiff !== 0) return rankDiff;
    return String(a.plan_sn || a.key).localeCompare(String(b.plan_sn || b.key));
  });
}

function mergeTwoReplenishmentTraces<T extends ReplenishmentTraceLike>(
  existing: T,
  incoming: T,
  key: string
) {
  const preferred = getReplenishmentTraceQualityRank(incoming) >
    getReplenishmentTraceQualityRank(existing)
    ? incoming
    : existing;
  const fallback = preferred === incoming ? existing : incoming;
  const merged = {
    ...fallback,
    ...preferred,
    key,
    plan_sn: preferred.plan_sn || fallback.plan_sn || '',
    analysis_record_id:
      preferred.analysis_record_id || fallback.analysis_record_id || null,
    linked_order_sns: uniqueTextList([
      ...(existing.linked_order_sns || []),
      ...(incoming.linked_order_sns || []),
    ]),
  };
  merged.linked_order_count = merged.linked_order_sns.length;
  if (!preferred.error) {
    delete merged.error;
  }
  return merged;
}

function normalizeMergedReplenishmentTrace<T extends ReplenishmentTraceLike>(
  trace: T,
  key: string
) {
  const linkedOrderSns = uniqueTextList(trace.linked_order_sns || []);
  return {
    ...trace,
    key,
    linked_order_sns: linkedOrderSns,
    linked_order_count: linkedOrderSns.length,
  };
}

function getResolvedReplenishmentTraceGroupKey(trace: ReplenishmentTraceLike) {
  const analysisId = Number(
    trace.analysis_record_id || trace.flow?.summary?.analysis_record_id
  ) || 0;
  if (analysisId) return `analysis:${analysisId}`;

  const planSn = normalizeFlowText(trace.plan_sn || trace.flow?.summary?.plan_sn);
  if (planSn) return `plan:${planSn}`;

  return trace.key;
}

function getReplenishmentTraceQualityRank(trace: ReplenishmentTraceLike) {
  if (trace.error) return 0;
  const analysis = trace.flow?.details?.replenishment_analysis || {};
  const sectionCount = Array.isArray(analysis.available_sections)
    ? analysis.available_sections.length
    : 0;
  const level = analysis.trace_level as ReplenishmentTraceLevel;
  const base =
    level === 'full_record'
      ? 300
      : level === 'legacy_snapshot'
        ? 200
        : level === 'legacy_compatible'
          ? 100
          : 50;

  return base + sectionCount;
}

function isMeaningfulSnapshotSection(
  key: ReplenishmentSnapshotSectionKey,
  value: any
) {
  const parsed = parseMaybeJson(value);
  if (key === 'shipping_json') {
    return hasNonEmptySnapshotArray(parsed?.segments) ||
      hasNonEmptySnapshotArray(parsed?.actual_shipping_breakdown) ||
      hasNonEmptySnapshotArray(parsed?.shipping_segments);
  }
  if (key === 'coefficient_json') {
    return hasNonEmptySnapshotArray(parsed?.five_month_rows) ||
      isMeaningfulSnapshotValue(parsed?.segment_alpha_details) ||
      isMeaningfulSnapshotValue(parsed?.window_calculation);
  }
  if (key === 'calculation_json') {
    return isMeaningfulSnapshotValue(parsed);
  }
  if (key === 'inventory_json') {
    return Boolean(parsed && typeof parsed === 'object' && Object.keys(parsed).some(
      key => parsed[key] !== undefined && parsed[key] !== null
    ));
  }
  return isMeaningfulSnapshotValue(parsed);
}

function isMeaningfulSnapshotValue(value: any): boolean {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) return parsed.length > 0;
  if (parsed && typeof parsed === 'object') {
    return Object.keys(parsed).some(key => isMeaningfulSnapshotValue(parsed[key]));
  }
  return parsed !== undefined && parsed !== null && parsed !== '';
}

function hasNonEmptySnapshotArray(value: any) {
  const parsed = parseMaybeJson(value);
  return Array.isArray(parsed) && parsed.length > 0;
}

function normalizeQueryValueList(value: any) {
  if (Array.isArray(value)) return value.map(item => normalizeFlowText(item)).filter(Boolean);
  const text = normalizeFlowText(value);
  if (!text) return [];
  return text
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function getTimeMs(value: any) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function pickLatestRow(rows: any[], fields: string[]) {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return [...rows].sort((a, b) => {
    const timeA = Math.max(...fields.map(field => getTimeMs(a?.[field])));
    const timeB = Math.max(...fields.map(field => getTimeMs(b?.[field])));
    return timeB - timeA;
  })[0];
}

function buildFlowOperator(value: any, missingWhenEmpty = true) {
  const name = normalizeFlowText(value);
  if (name) {
    return {
      operator_name: name,
      operator_missing: false,
    };
  }

  return {
    operator_name: missingWhenEmpty ? '缺少操作人' : '-',
    operator_missing: missingWhenEmpty,
  };
}

function flowNumber(value: any) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
}

function createEmptyShipmentPlanBundleForProductView() {
  return {
    summary: {
      plan_count: 0,
      batch_count: 0,
      shipment_plan_qty_sum: 0,
      actual_order_count: 0,
      actual_item_count: 0,
      actual_qty_sum: 0,
      latest_plan_time: null,
      latest_actual_time: null,
    },
    shipment_plans: [],
  };
}

function buildPurchaseOrderShipmentKey(planSn: any, orderSn: any) {
  return `plan:${String(planSn || '').trim()}|order:${String(
    orderSn || ''
  ).trim()}`;
}

function getPurchaseOrderEntryQuantity(order?: any) {
  return toNumber(
    pickFirst(order?.quantity_entry_sum, order?.quantity_entry, 0)
  );
}

function createEmptyPurchaseOrderShipmentBundleForProductView(order?: any) {
  const quantityEntry = getPurchaseOrderEntryQuantity(order);

  return {
    summary: {
      shipment_plan_qty_sum: 0,
      actual_shipment_qty_sum: 0,
      shippable_remaining_qty: quantityEntry,
      fulfillment_diff_qty: 0,
      shipment_plan_count: 0,
      actual_shipment_order_count: 0,
      actual_shipment_item_count: 0,
      latest_plan_time: null,
      latest_actual_time: null,
    },
    shipment_plans: [],
  };
}

function applyPurchaseOrderQuantityToShipmentBundle(bundle: any, order?: any) {
  const summary = bundle.summary;
  const quantityEntry = getPurchaseOrderEntryQuantity(order);

  summary.shippable_remaining_qty =
    quantityEntry - toNumber(summary.actual_shipment_qty_sum);
  summary.fulfillment_diff_qty =
    toNumber(summary.actual_shipment_qty_sum) -
    toNumber(summary.shipment_plan_qty_sum);

  return bundle;
}

export function buildPurchaseOrderShipmentBundleForProductView(
  rows: any[],
  purchaseOrderQuantityMap = new Map<string, any>()
) {
  const grouped = new Map<string, any>();

  for (const row of rows || []) {
    const purchasePlanSn = String(row.purchase_plan_sn || '').trim();
    const purchaseOrderSn = String(row.purchase_order_sn || '').trim();
    if (!purchasePlanSn || !purchaseOrderSn) continue;

    const orderKey = buildPurchaseOrderShipmentKey(
      purchasePlanSn,
      purchaseOrderSn
    );

    if (!grouped.has(orderKey)) {
      grouped.set(orderKey, {
        bundle: createEmptyPurchaseOrderShipmentBundleForProductView(
          purchaseOrderQuantityMap.get(orderKey)
        ),
        planMap: new Map<string, any>(),
        actualOrderSet: new Set<string>(),
      });
    }

    const group = grouped.get(orderKey);
    const bundle = group.bundle;
    const summary = bundle.summary;
    const planKey = String(
      pickFirst(
        row.shipment_plan_row_id,
        row.isp_id,
        row.seq,
        row.shipment_plan_sn,
        ''
      )
    );
    if (!planKey) continue;

    if (!group.planMap.has(planKey)) {
      const shipmentPlan = {
        id: row.shipment_plan_row_id ?? null,
        isp_id: row.isp_id ?? null,
        seq: row.seq || '',
        shipment_plan_sn: row.shipment_plan_sn || '',
        purchase_plan_sn: purchasePlanSn,
        purchase_order_sn: purchaseOrderSn,
        sku: row.sku || '',
        msku: row.msku || '',
        fnsku: row.fnsku || '',
        product_name: row.product_name || '',
        small_image_url: row.small_image_url || '',
        shipment_plan_quantity: toNumber(row.shipment_plan_quantity),
        actual_qty_sum: 0,
        diff_qty: 0,
        shipping_method: row.shipping_method || '',
        sname: row.sname || '',
        wname: row.wname || '',
        status: row.shipment_plan_status ?? null,
        status_name: row.shipment_plan_status_name || '',
        status_text: row.shipment_plan_status_name || '',
        batch_remark: row.batch_remark || '',
        remark: row.remark || '',
        create_time: row.shipment_plan_create_time || null,
        shipment_plan_create_user: row.shipment_plan_create_user || '',
        local_created_by_user_id: row.local_created_by_user_id || null,
        local_created_by_username: row.local_created_by_username || '',
        local_created_by_nickname: row.local_created_by_nickname || '',
        local_created_time: row.local_created_time || null,
        last_sync_time: row.shipment_plan_last_sync_time || null,
        actual_details: [],
      };

      group.planMap.set(planKey, shipmentPlan);
      bundle.shipment_plans.push(shipmentPlan);
      summary.shipment_plan_count += 1;
      summary.shipment_plan_qty_sum += shipmentPlan.shipment_plan_quantity;
      summary.latest_plan_time = pickLatestTime(
        summary.latest_plan_time,
        shipmentPlan.create_time
      );
    }

    const shipmentPlan = group.planMap.get(planKey);
    if (!row.actual_row_id && !row.ispr_id && !row.shipment_sn) continue;

    const actualDetail = {
      id: row.actual_row_id ?? null,
      ispr_id: row.ispr_id ?? null,
      shipment_sn: row.shipment_sn || '',
      shipment_list_quantity: toNumber(row.shipment_list_quantity),
      shipment_status: row.shipment_status ?? null,
      shipment_status_name: row.shipment_status_name || '',
      shipment_status_mws: row.shipment_status_mws || '',
      seq: row.actual_seq || row.seq || '',
      shipment_plan_sn:
        row.actual_shipment_plan_sn || row.shipment_plan_sn || '',
      shipment_time: row.shipment_time || null,
      method_name: row.method_name || '',
      logistics_channel_name: row.logistics_channel_name || '',
      wname: row.actual_wname || '',
      sku: row.actual_sku || '',
      msku: row.actual_msku || '',
      fnsku: row.actual_fnsku || '',
      product_name: row.actual_product_name || '',
      pic_url: row.actual_pic_url || '',
      asin: row.actual_asin || '',
      sname: row.actual_sname || '',
      sid: row.actual_sid ?? null,
      nation: row.actual_nation || '',
      expected_arrival_date: row.expected_arrival_date || '',
      is_final: row.is_final ?? null,
      create_user: row.actual_create_user || '',
      create_time_remote: row.actual_create_time || null,
    };

    shipmentPlan.actual_details.push(actualDetail);
    shipmentPlan.actual_qty_sum += actualDetail.shipment_list_quantity;
    summary.actual_shipment_item_count += 1;
    summary.actual_shipment_qty_sum += actualDetail.shipment_list_quantity;
    summary.latest_actual_time = pickLatestTime(
      summary.latest_actual_time,
      actualDetail.shipment_time
    );

    if (actualDetail.shipment_sn) {
      group.actualOrderSet.add(actualDetail.shipment_sn);
    }
  }

  grouped.forEach((group: any, orderKey: string) => {
    const bundle = group.bundle;
    bundle.summary.actual_shipment_order_count = group.actualOrderSet.size;
    bundle.shipment_plans.forEach((shipmentPlan: any) => {
      shipmentPlan.diff_qty =
        toNumber(shipmentPlan.actual_qty_sum) -
        toNumber(shipmentPlan.shipment_plan_quantity);
    });
    applyPurchaseOrderQuantityToShipmentBundle(
      bundle,
      purchaseOrderQuantityMap.get(orderKey)
    );
  });

  return new Map(
    Array.from(grouped.entries()).map(([orderKey, group]: [string, any]) => [
      orderKey,
      group.bundle,
    ])
  );
}

function buildShipmentPlanBundleForProductView(rows: any[]) {
  const bundle = createEmptyShipmentPlanBundleForProductView();
  const summary = bundle.summary;
  const planMap = new Map<string, any>();
  const batchSet = new Set<string>();
  const actualOrderSet = new Set<string>();

  for (const row of rows || []) {
    const planKey = String(
      pickFirst(row.shipment_plan_row_id, row.isp_id, row.seq, row.shipment_plan_sn, '')
    );
    if (!planKey) continue;

    if (!planMap.has(planKey)) {
      const shipmentPlan = {
        id: row.shipment_plan_row_id ?? null,
        isp_id: row.isp_id ?? null,
        seq: row.seq || '',
        shipment_plan_sn: row.shipment_plan_sn || '',
        purchase_plan_sn: row.purchase_plan_sn || '',
        purchase_order_sn: row.purchase_order_sn || '',
        sku: row.sku || '',
        msku: row.msku || '',
        fnsku: row.fnsku || '',
        product_name: row.product_name || '',
        small_image_url: row.small_image_url || '',
        shipment_plan_quantity: toNumber(row.shipment_plan_quantity),
        shipping_method: row.shipping_method || '',
        sname: row.sname || '',
        wname: row.wname || '',
        status: row.shipment_plan_status ?? null,
        status_name: row.shipment_plan_status_name || '',
        status_text: row.shipment_plan_status_name || '',
        batch_remark: row.batch_remark || '',
        remark: row.remark || '',
        create_time: row.shipment_plan_create_time || null,
        shipment_plan_create_user: row.shipment_plan_create_user || '',
        local_created_by_user_id: row.local_created_by_user_id || null,
        local_created_by_username: row.local_created_by_username || '',
        local_created_by_nickname: row.local_created_by_nickname || '',
        local_created_time: row.local_created_time || null,
        last_sync_time: row.shipment_plan_last_sync_time || null,
        actual: {
          actual_order_count: 0,
          actual_item_count: 0,
          actual_qty_sum: 0,
          details: [],
        },
      };

      planMap.set(planKey, shipmentPlan);
      bundle.shipment_plans.push(shipmentPlan);
      summary.plan_count += 1;
      summary.shipment_plan_qty_sum += shipmentPlan.shipment_plan_quantity;
      summary.latest_plan_time = pickLatestTime(
        summary.latest_plan_time,
        shipmentPlan.create_time
      );

      if (shipmentPlan.seq) {
        batchSet.add(shipmentPlan.seq);
      }
    }

    const shipmentPlan = planMap.get(planKey);
    if (!row.actual_row_id && !row.ispr_id && !row.shipment_sn) continue;

    const actualDetail = {
      id: row.actual_row_id ?? null,
      ispr_id: row.ispr_id ?? null,
      shipment_sn: row.shipment_sn || '',
      shipment_list_quantity: toNumber(row.shipment_list_quantity),
      shipment_status: row.shipment_status ?? null,
      shipment_status_name: row.shipment_status_name || '',
      shipment_status_mws: row.shipment_status_mws || '',
      seq: row.actual_seq || row.seq || '',
      shipment_plan_sn:
        row.actual_shipment_plan_sn || row.shipment_plan_sn || '',
      shipment_time: row.shipment_time || null,
      method_name: row.method_name || '',
      logistics_channel_name: row.logistics_channel_name || '',
      wname: row.actual_wname || '',
      expected_arrival_date: row.expected_arrival_date || '',
      is_final: row.is_final ?? null,
      create_user: row.actual_create_user || '',
      create_time_remote: row.actual_create_time || null,
    };

    shipmentPlan.actual.details.push(actualDetail);
    shipmentPlan.actual.actual_item_count += 1;
    shipmentPlan.actual.actual_qty_sum += actualDetail.shipment_list_quantity;

    summary.actual_item_count += 1;
    summary.actual_qty_sum += actualDetail.shipment_list_quantity;
    summary.latest_actual_time = pickLatestTime(
      summary.latest_actual_time,
      actualDetail.shipment_time
    );

    if (actualDetail.shipment_sn) {
      actualOrderSet.add(actualDetail.shipment_sn);
    }
  }

  summary.batch_count = batchSet.size;
  summary.actual_order_count = actualOrderSet.size;

  for (const shipmentPlan of bundle.shipment_plans) {
    const orderSet = new Set<string>();
    shipmentPlan.actual.details.forEach((detail: any) => {
      if (detail.shipment_sn) {
        orderSet.add(detail.shipment_sn);
      }
    });
    shipmentPlan.actual.actual_order_count = orderSet.size;
  }

  return bundle;
}

export function parsePlanPayloadForProductView(row: any) {
  const expectedSales = parseMaybeJson(row.expected_sales);
  const remarkData = parseMaybeJson(row.local_remark);
  const breakdown = Array.isArray(remarkData.breakdown)
    ? remarkData.breakdown
    : Array.isArray(expectedSales.breakdown)
    ? expectedSales.breakdown
    : [];

  const localQuantityPlan =
    Number(
      pickFirst(
        row.local_quantity_plan,
        expectedSales.actual_purchase_qty,
        expectedSales.final_replenishment_qty,
        expectedSales.finalQty,
        expectedSales.totalQty,
        0
      )
    ) || 0;

  const summary = pickFirst(remarkData.summary, expectedSales.summary, '');
  const formula = pickFirst(remarkData.formula, expectedSales.formula, '');
  const remarkText = pickFirst(
    remarkData.remark_text,
    expectedSales.remark_text,
    ''
  );
  const startDate = pickFirst(
    remarkData.start_date,
    remarkData.startDate,
    expectedSales.start_date,
    expectedSales.startDate,
    null
  );
  const endDate = pickFirst(
    remarkData.end_date,
    remarkData.endDate,
    expectedSales.end_date,
    expectedSales.endDate,
    null
  );
  const totalDays =
    Number(
      pickFirst(
        remarkData.total_days,
        remarkData.days,
        expectedSales.total_days,
        expectedSales.days,
        0
      )
    ) || 0;

  return {
    plan_sn: row.plan_sn || '',
    lingxing: {
      plan_sn: row.plan_sn || '',
      ppg_sn: row.lingxing_ppg_sn || row.local_ppg_sn || '',
      sku: row.lingxing_sku || '',
      product_name: row.lingxing_product_name || '',
      pic_url: row.lingxing_pic_url || '',
      fnsku: row.lingxing_fnsku || '',
      msku: row.lingxing_msku || null,
      seller_name: row.lingxing_seller_name || '',
      marketplace: row.lingxing_marketplace || '',
      quantity_plan: Number(row.lingxing_quantity_plan) || 0,
      cg_box_pcs: Number(row.cg_box_pcs) || 0,
      status: row.lingxing_status ?? null,
      status_text: row.lingxing_status_text || '',
      supplier_name: row.supplier_name || '',
      warehouse_name: row.warehouse_name || '',
      purchaser_name: row.purchaser_name || '',
      cg_opt_username: row.cg_opt_username || '',
      creator_real_name: row.creator_real_name || '',
      create_time_remote: row.create_time_remote || null,
      update_time_remote: row.update_time_remote || null,
      expect_arrive_time: row.expect_arrive_time || null,
      plan_remark: row.plan_remark || '',
      remark: row.purchase_remark || '',
    },
    local_record: {
      analysis_record_id: row.analysis_record_id,
      status: row.local_status ?? null,
      ppg_sn: row.local_ppg_sn || '',
      quantity_plan: localQuantityPlan,
      manual_remark: row.manual_remark || '',
      staged_by_user_id: row.staged_by_user_id || null,
      staged_by_username: row.staged_by_username || '',
      staged_by_nickname: row.staged_by_nickname || '',
      staged_time: row.staged_time || null,
      purchase_plan_created_by_user_id:
        row.purchase_plan_created_by_user_id || null,
      purchase_plan_created_by_username:
        row.purchase_plan_created_by_username || '',
      purchase_plan_created_by_nickname:
        row.purchase_plan_created_by_nickname || '',
      purchase_plan_created_time: row.purchase_plan_created_time || null,
      create_time: row.analysis_create_time || null,
      summary,
      formula,
      remark_text: remarkText,
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      breakdown,
      calculation: {
        system_suggested_qty: Number(expectedSales.system_suggested_qty) || 0,
        pending_delivery_qty: Number(expectedSales.pending_delivery_qty) || 0,
        purchase_plan_qty: Number(expectedSales.purchase_plan_qty) || 0,
        actual_purchase_qty:
          Number(
            pickFirst(
              expectedSales.actual_purchase_qty,
              expectedSales.final_replenishment_qty,
              expectedSales.finalQty,
              expectedSales.totalQty,
              0
            )
          ) || 0,
        base_daily_avg_sales:
          Number(
            pickFirst(
              expectedSales.base_daily_avg_sales,
              expectedSales.dailyAvg,
              0
            )
          ) || 0,
        artificial_coefficient:
          Number(
            pickFirst(
              expectedSales.artificial_coefficient,
              expectedSales.manualCoefficient,
              0
            )
          ) || 0,
      },
      target_stock_days:
        row.snapshot_target_stock_days !== null && row.snapshot_target_stock_days !== undefined
          ? toNumber(row.snapshot_target_stock_days)
          : null,
      volatility_coefficient:
        row.snapshot_volatility_coefficient !== null && row.snapshot_volatility_coefficient !== undefined
          ? toNumber(row.snapshot_volatility_coefficient)
          : toNumber(pickFirst(expectedSales.volatility_coefficient, null)),
      target_stock_days_source:
        row.snapshot_target_stock_days !== null && row.snapshot_target_stock_days !== undefined
          ? 'full_snapshot'
          : '',
      target_stock_days_source_label:
        row.snapshot_target_stock_days !== null && row.snapshot_target_stock_days !== undefined
          ? '完整快照'
          : '历史兼容',
      snapshot_available:
        row.snapshot_target_stock_days !== null && row.snapshot_target_stock_days !== undefined,
      expected_sales: expectedSales,
      raw_remark: remarkData,
    },
    purchase_orders_summary: row.purchase_orders_summary || {
      order_count: 0,
      all_order_count: 0,
      linked_item_count: 0,
      all_linked_item_count: 0,
      quantity_plan_sum: 0,
      quantity_real_sum: 0,
      quantity_entry_sum: 0,
      quantity_receive_sum: 0,
      excluded_order_count: 0,
      completed_order_count: 0,
      void_order_count: 0,
      other_order_count: 0,
      latest_order_time: null,
      confirmed_count: 0,
      signed_count: 0,
      in_transit_count: 0,
      overtime_unsigned_count: 0,
      logistics_abnormal_count: 0,
      no_logistics_count: 0,
      logistics_tracked_order_count: 0,
      worst_logistics_status: '',
      worst_logistics_status_text: '',
    },
    purchase_orders: Array.isArray(row.purchase_orders)
      ? row.purchase_orders
      : [],
    shipment_plans_summary: row.shipment_plans_summary || {
      plan_count: 0,
      batch_count: 0,
      shipment_plan_qty_sum: 0,
      actual_order_count: 0,
      actual_item_count: 0,
      actual_qty_sum: 0,
      latest_plan_time: null,
      latest_actual_time: null,
    },
    shipment_plans: Array.isArray(row.shipment_plans)
      ? row.shipment_plans
      : [],
  };
}

/**
 * 采购计划产品视图服务
 * 该服务只负责新页面的数据聚合，不承载创建采购计划、同步领星等旧流程。
 */
@Provide()
export class AppBsrPurchasePlanProductViewService extends BaseService {
  @InjectEntityModel(AppAmzBsrAnalysisRecordLingxingEntity)
  analysisRecordEntity: Repository<AppAmzBsrAnalysisRecordLingxingEntity>;

  @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
  listingEntity: Repository<AppAmzBsrProductListingLingxingEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderItemSyncLingxingEntity)
  purchaseOrderItemEntity: Repository<AppAmzBsrPurchaseOrderItemSyncLingxingEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderSyncLingxingEntity)
  purchaseOrderEntity: Repository<AppAmzBsrPurchaseOrderSyncLingxingEntity>;

  @InjectEntityModel(BaseSysUserEntity)
  userEntity: Repository<BaseSysUserEntity>;

  @Inject()
  purchaseOrderSyncService: AppAmzBsrPurchaseOrderSyncLingxingService;

  @Inject()
  purchaseOrderLogisticsService: AppAmzBsrPurchaseOrderLogisticsService;

  @Inject()
  shipmentActualService: AppAmzBsrShipmentActualLingxingService;

  @Inject()
  restockingCenterService: AppAmzBsrRestockingCenterLingxingService;

  @Inject()
  fulfillmentAdjustmentService: AppAmzBsrPurchaseOrderFulfillmentAdjustmentService;

  async page(param: PageParam) {
    const page = Math.max(Number(param.page) || 1, 1);
    const size = Math.min(Math.max(Number(param.size) || 20, 1), 100);
    const fulfillmentStatus = String(param.fulfillment_status || '').trim();
    const workStatus = String(param.work_status || 'current').trim();
    const logisticsStatus = String(param.logistics_status || '').trim();
    const purchaseOrderStatuses = this.normalizePurchaseOrderStatusList(
      param.purchase_order_statuses
    );
    const shouldFilterInMemory = Boolean(
      fulfillmentStatus || logisticsStatus || purchaseOrderStatuses.length || workStatus
    );
    const authorizedSidList = await this.getAuthorizedSidList();

    if (authorizedSidList !== null && authorizedSidList.length === 0) {
      return {
        list: [],
        pagination: { page, size, total: 0 },
      };
    }

    const filter = this.buildFilterSql(param, authorizedSidList);
    const baseTotal = await this.countProductRows(filter.sql, filter.params);
    const productRows = shouldFilterInMemory
      ? await this.queryAllProductRows(filter.sql, filter.params)
      : await this.queryProductRows(filter.sql, filter.params, page, size);

    if (productRows.length === 0) {
      return {
        list: [],
        pagination: { page, size, total: 0 },
      };
    }

    let list = await this.buildProductViewList(productRows);

    if (shouldFilterInMemory) {
      const filtered = this.fulfillmentAdjustmentService.filterProductViewList(
        list,
        {
          fulfillmentStatus,
          workStatus,
          purchaseOrderStatuses,
          logisticsStatus,
        }
      );
      const total = filtered.length;
      list = filtered.slice((page - 1) * size, page * size);

      return {
        list,
        pagination: { page, size, total },
      };
    }

    return {
      list,
      pagination: { page, size, total: baseTotal },
    };
  }

  async statusCounts(param: PageParam) {
    const authorizedSidList = await this.getAuthorizedSidList();
    if (authorizedSidList !== null && authorizedSidList.length === 0) {
      return {
        fulfillment_status_counts: this.createZeroCountMap(
          FULFILLMENT_STATUS_COUNT_VALUES
        ),
        purchase_order_status_counts: this.createZeroCountMap(
          PURCHASE_ORDER_STATUS_COUNT_VALUES
        ),
        logistics_status_counts: this.createZeroCountMap(
          LOGISTICS_STATUS_COUNT_VALUES
        ),
      };
    }

    const filter = this.buildFilterSql(param, authorizedSidList);
    const productRows = await this.queryAllProductRows(filter.sql, filter.params);
    if (productRows.length === 0) {
      return {
        fulfillment_status_counts: this.createZeroCountMap(
          FULFILLMENT_STATUS_COUNT_VALUES
        ),
        purchase_order_status_counts: this.createZeroCountMap(
          PURCHASE_ORDER_STATUS_COUNT_VALUES
        ),
        logistics_status_counts: this.createZeroCountMap(
          LOGISTICS_STATUS_COUNT_VALUES
        ),
      };
    }

    const list = await this.buildProductViewList(productRows);
    const fulfillmentStatus = String(param.fulfillment_status || '').trim();
    const workStatus = String(param.work_status || 'current').trim();
    const logisticsStatus = String(param.logistics_status || '').trim();
    const purchaseOrderStatuses = this.normalizePurchaseOrderStatusList(
      param.purchase_order_statuses
    );

    return {
      fulfillment_status_counts: this.countFulfillmentStatusFacets(list, {
        workStatus,
        logisticsStatus,
        purchaseOrderStatuses,
      }),
      purchase_order_status_counts: this.countPurchaseOrderStatusFacets(list, {
        fulfillmentStatus,
        workStatus,
        logisticsStatus,
      }),
      logistics_status_counts: this.countLogisticsStatusFacets(list, {
        fulfillmentStatus,
        workStatus,
        purchaseOrderStatuses,
      }),
    };
  }

  private async buildProductViewList(productRows: any[]) {
    const plansByKey = await this.queryPlansForProducts(productRows);
    const restockingMap = await this.queryRestockingMapForProductRows(productRows);
    const productMetricMaps = await this.queryProductMetricExternalMaps(productRows);

    let list = productRows.map((row: any) => {
      const rowKey = buildProductRowKey(row);
      const plans = plansByKey.get(rowKey) || [];

      return {
        row_key: rowKey,
        product: {
          listing_id: row.listing_id || null,
          product_id: row.product_id || null,
          store_id: row.store_id,
          asin: row.asin,
          marketplace: row.marketplace,
          msku: row.msku || '',
          product_code: row.product_code || '',
          local_sku: row.local_sku || '',
          fnsku: row.fnsku || '',
          seller_name: row.seller_name || '',
          shop: row.shop || '',
          item_name: row.item_name || '',
          image_url: row.image_url || '',
          stars: Array.isArray(row.stars) ? row.stars : safeJsonParse(row.stars) || [],
          reviews_num: Array.isArray(row.reviews_num)
            ? row.reviews_num
            : safeJsonParse(row.reviews_num) || [],
          product_metrics: this.buildProductMetrics(
            {
              ...row,
              restocking: restockingMap.get(this.getProductMetricKey(row)),
            },
            productMetricMaps.pendingDeliveryMap,
            productMetricMaps.purchasePlanMap
          ),
        },
        summary: {
          purchase_plan_count: Number(row.plan_count) || plans.length,
          local_total_quantity_plan: Number(row.total_quantity_plan) || 0,
          latest_local_create_time: row.latest_plan_time || null,
        },
        latest_plan_time: row.latest_plan_time || null,
        selected_plan_sn: plans[0]?.plan_sn || '',
        plans,
      };
    });

    list = await this.fulfillmentAdjustmentService.applyToProductViewList(list);
    this.attachPurchaseFlowSummaryToProductViewList(list);
    return list;
  }

  private createZeroCountMap(values: Array<string | number>) {
    return values.reduce((map: Record<string, number>, value) => {
      map[String(value)] = 0;
      return map;
    }, {});
  }

  private countPurchaseOrderStatusFacets(
    list: any[],
    filters: { fulfillmentStatus: string; workStatus: string; logisticsStatus: string }
  ) {
    const counts = this.createZeroCountMap(PURCHASE_ORDER_STATUS_COUNT_VALUES);
    for (const status of PURCHASE_ORDER_STATUS_COUNT_VALUES) {
      counts[String(status)] = this.countFilteredProductRows(list, {
        fulfillmentStatus: filters.fulfillmentStatus,
        workStatus: filters.workStatus,
        logisticsStatus: filters.logisticsStatus,
        purchaseOrderStatuses: [status],
      });
    }
    return counts;
  }

  private countFulfillmentStatusFacets(
    list: any[],
    filters: {
      workStatus: string;
      logisticsStatus: string;
      purchaseOrderStatuses: number[];
    }
  ) {
    const counts = this.createZeroCountMap(FULFILLMENT_STATUS_COUNT_VALUES);
    for (const status of FULFILLMENT_STATUS_COUNT_VALUES) {
      counts[status] = this.countFilteredProductRows(list, {
        fulfillmentStatus: status,
        workStatus: filters.workStatus,
        logisticsStatus: filters.logisticsStatus,
        purchaseOrderStatuses: filters.purchaseOrderStatuses,
      });
    }
    return counts;
  }

  private countLogisticsStatusFacets(
    list: any[],
    filters: {
      fulfillmentStatus: string;
      workStatus: string;
      purchaseOrderStatuses: number[];
    }
  ) {
    const counts = this.createZeroCountMap(LOGISTICS_STATUS_COUNT_VALUES);
    for (const status of LOGISTICS_STATUS_COUNT_VALUES) {
      counts[status] = this.countFilteredProductRows(list, {
        fulfillmentStatus: filters.fulfillmentStatus,
        workStatus: filters.workStatus,
        logisticsStatus: status,
        purchaseOrderStatuses: filters.purchaseOrderStatuses,
      });
    }
    return counts;
  }

  private countFilteredProductRows(
    list: any[],
    filters: {
      fulfillmentStatus?: string;
      workStatus?: string;
      logisticsStatus?: string;
      purchaseOrderStatuses?: any[];
    }
  ) {
    return this.fulfillmentAdjustmentService.filterProductViewList(
      list.map(row => ({ ...row })),
      filters
    ).length;
  }

  async syncLatestRelatedData(param: SyncLatestRelatedDataParam = {}) {
    const items = Array.isArray(param.items) ? param.items : [];
    const targets = this.collectSyncLatestTargets(items);
    const warnings: string[] = [];
    const sections: Record<string, any> = {};

    sections.purchase_plan = await this.syncLatestPurchasePlans(
      targets.products,
      warnings
    );
    sections.pending_delivery = await this.syncLatestPendingDelivery(
      targets.products,
      warnings
    );
    sections.purchase_order = await this.syncLatestPurchaseOrders(
      targets.orderSns,
      warnings
    );
    sections.logistics = await this.syncLatestPurchaseOrderLogistics(
      targets.orderSns,
      warnings
    );
    sections.shipment_plan = await this.syncLatestShipmentPlans(
      targets.seqs,
      warnings
    );
    sections.shipment_actual = await this.syncLatestShipmentActuals(
      targets.skus,
      warnings
    );

    return {
      item_count: items.length,
      target_counts: {
        products: targets.products.length,
        purchase_orders: targets.orderSns.length,
        shipment_plan_batches: targets.seqs.length,
        shipment_skus: targets.skus.length,
      },
      sections,
      warnings,
    };
  }

  async preflightBatchShip(param: SyncLatestRelatedDataParam = {}) {
    const items = Array.isArray(param.items) ? param.items : [];
    const generatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const syncResult = await this.syncLatestRelatedData({ items });
    const flowItems = this.buildPreflightFlowItems(items);
    const flowResult = await this.purchaseOrderFlowBatch({
      items: flowItems,
      preserve_order_traces: true,
    });
    const orderRows = await this.buildBatchShipPreflightOrders(flowResult);
    const summary = this.buildBatchShipPreflightSummary(orderRows);

    return {
      generated_at: generatedAt,
      input_count: items.length,
      sync_result: syncResult,
      summary,
      orders: orderRows,
    };
  }

  private buildPreflightFlowItems(
    items: SyncLatestRelatedDataItem[]
  ): PurchaseOrderFlowBatchItemParam[] {
    return (items || []).map(item => {
      const product = item?.product || {};
      const plans = Array.isArray(item?.plans) ? item.plans : [];
      const orderRows = plans.flatMap(plan =>
        (Array.isArray(plan?.purchase_orders) ? plan.purchase_orders : []).map(order => ({
          purchase_order_sn: normalizeFlowText(order?.order_sn),
        }))
      );
      const orderSns = uniqueTextList(
        orderRows.map(order => order.purchase_order_sn).filter(Boolean)
      );

      return {
        row_key: item?.row_key || '',
        clientKey: item?.row_key || '',
        store_id: product.store_id,
        marketplace: product.marketplace,
        asin: product.asin,
        msku: product.msku,
        product_code: product.product_code,
        order_sns: orderSns,
        orders: orderRows.filter(order => order.purchase_order_sn),
      };
    });
  }

  private async buildBatchShipPreflightOrders(flowResult: any) {
    const rows: any[] = [];
    const seen = new Set<string>();
    const lists = Array.isArray(flowResult?.list) ? flowResult.list : [];

    for (const item of lists) {
      const rowKey = normalizeFlowText(item?.row_key || item?.clientKey);
      const traces = Array.isArray(item?.traces) ? item.traces : [];
      for (const trace of traces) {
        const flow = trace?.flow;
        const purchaseOrder = flow?.details?.purchase_order;
        const summary = flow?.summary || {};
        const orderSn = normalizeFlowText(
          purchaseOrder?.order_sn ||
            summary.purchase_order_sn ||
            (Array.isArray(trace?.linked_order_sns) ? trace.linked_order_sns[0] : '')
        );
        if (!orderSn) continue;

        const key = `${rowKey}|${orderSn}`;
        if (seen.has(key)) continue;
        seen.add(key);

        let logisticsOverview: any = null;
        try {
          logisticsOverview =
            await this.purchaseOrderLogisticsService.getOrderLogisticsOverview({
              order_sn: orderSn,
              query: false,
              include_packages: false,
            });
        } catch (e: any) {
          logisticsOverview = {
            logistics_status: summary.logistics_status || '',
            logistics_status_text: summary.logistics_status_text || '',
            logistics_status_reason:
              e?.message || summary.logistics_status_reason || '物流状态读取失败',
          };
        }

        rows.push(
          this.buildBatchShipPreflightOrderRow({
            rowKey,
            trace,
            flow,
            purchaseOrder,
            summary,
            logisticsOverview,
            orderSn,
          })
        );
      }
    }

    return rows.sort((a, b) => {
      const statusRank: Record<string, number> = { eligible: 0, warning: 1, blocked: 2 };
      const rankDiff =
        (statusRank[a.preflight_status] ?? 9) -
        (statusRank[b.preflight_status] ?? 9);
      if (rankDiff) return rankDiff;
      return String(a.order_sn || '').localeCompare(String(b.order_sn || ''));
    });
  }

  private buildBatchShipPreflightOrderRow(input: {
    rowKey: string;
    trace: any;
    flow: any;
    purchaseOrder: any;
    summary: any;
    logisticsOverview: any;
    orderSn?: string;
  }) {
    const summary = input.summary || {};
    const order = input.purchaseOrder || {};
    const actualShippableQty = toNumber(summary.actual_shippable_qty);
    const groupStatus = normalizeFlowText(summary.fulfillment_group_status);
    const fulfillmentStatus = normalizeFlowText(summary.fulfillment_status);
    const logisticsStatus = normalizeFlowText(
      input.logisticsOverview?.logistics_status || summary.logistics_status
    );
    const purchaseOrderStatus = Number(summary.purchase_order_status);
    const reasons: string[] = [];
    const warnings: string[] = [];
    const notes: string[] = [];

    if (!summary.has_purchase_order && !order?.order_sn) {
      reasons.push('没有找到关联采购单');
    }
    if (![2, 9].includes(purchaseOrderStatus)) {
      reasons.push(
        `采购单状态为${summary.purchase_order_status_text || order?.status_text || '未知'}，不属于待到货/已完成`
      );
    }
    if (actualShippableQty <= 0) {
      reasons.push('实际可发数量为 0');
    }
    if (fulfillmentStatus === 'manual_completed') {
      reasons.push('该采购单已标记人工完成，不再进入批量发货');
    }
    if (fulfillmentStatus === 'exception_pending') {
      reasons.push('存在未处理的残次品或商家少发异常');
    }
    if (groupStatus === 'abnormal') {
      reasons.push(
        `物流或履约状态异常：${summary.fulfillment_status_text || summary.fulfillment_group_status_text || '需人工处理'}`
      );
    }

    if (logisticsStatus === 'confirmed' || logisticsStatus === 'signed') {
      notes.push('已签收');
    }
    if (
      input.logisticsOverview?.logistics_status_reason &&
      logisticsStatus !== 'confirmed' &&
      logisticsStatus !== 'signed'
    ) {
      warnings.push(input.logisticsOverview.logistics_status_reason);
    }

    const eligible =
      groupStatus === 'shippable' && actualShippableQty > 0 && reasons.length === 0;
    const preflightStatus = eligible
      ? warnings.length
        ? 'warning'
        : 'eligible'
      : 'blocked';

    return {
      row_key: input.rowKey,
      order_sn: normalizeFlowText(order?.order_sn || input.orderSn),
      plan_sn: summary.plan_sn || input.trace?.plan_sn || '',
      analysis_record_id: summary.analysis_record_id || null,
      preflight_status: preflightStatus,
      preflight_status_text:
        preflightStatus === 'eligible'
          ? '可发货'
          : preflightStatus === 'warning'
            ? '有警告，可继续'
            : '不可发货',
      reasons: uniqueTextList(reasons),
      warnings: uniqueTextList(warnings),
      notes: uniqueTextList(notes),
      actual_shippable_qty: actualShippableQty,
      purchase_order_status: purchaseOrderStatus || null,
      purchase_order_status_text:
        summary.purchase_order_status_text || order?.status_text || '',
      fulfillment_status: fulfillmentStatus,
      fulfillment_status_text: summary.fulfillment_status_text || '',
      fulfillment_group_status: groupStatus,
      logistics: {
        status: logisticsStatus,
        text:
          input.logisticsOverview?.logistics_status_text ||
          summary.logistics_status_text ||
          '',
        reason:
          input.logisticsOverview?.logistics_status_reason ||
          summary.logistics_status_reason ||
          '',
        package_count: Number(input.logisticsOverview?.package_count) || 0,
        signed_count: Number(input.logisticsOverview?.signed_count) || 0,
        unsigned_count: Number(input.logisticsOverview?.unsigned_count) || 0,
        can_query: Boolean(input.logisticsOverview?.can_query),
        query_hint: input.logisticsOverview?.query_hint || '',
      },
      quantity: {
        quantity_real_sum: toNumber(summary.quantity_real_sum),
        actual_shipment_qty_sum: toNumber(summary.actual_shipment_qty_sum),
        exception_qty: toNumber(summary.defective_qty) + toNumber(summary.short_shipped_qty),
      },
    };
  }

  private buildBatchShipPreflightSummary(rows: any[]) {
    const countByStatus = (status: string) =>
      rows.filter(row => row.preflight_status === status).length;
    const eligibleCount = countByStatus('eligible');
    const warningCount = countByStatus('warning');
    const blockedCount = countByStatus('blocked');

    return {
      total_orders: rows.length,
      eligible_count: eligibleCount,
      warning_count: warningCount,
      blocked_count: blockedCount,
      continuable_count: eligibleCount + warningCount,
      actual_shippable_qty: rows
        .filter(row => row.preflight_status !== 'blocked')
        .reduce((sum, row) => sum + toNumber(row.actual_shippable_qty), 0),
    };
  }

  private collectSyncLatestTargets(items: SyncLatestRelatedDataItem[]) {
    const productMap = new Map<string, any>();
    const orderSnSet = new Set<string>();
    const seqSet = new Set<string>();
    const skuSet = new Set<string>();
    const planSnSet = new Set<string>();

    const addText = (set: Set<string>, value: any) => {
      const text = normalizeFlowText(value);
      if (text) set.add(text);
    };

    for (const item of items || []) {
      const product = item?.product || {};
      const storeIdRaw = (product as any).store_id;
      const hasStoreId =
        storeIdRaw !== undefined &&
        storeIdRaw !== null &&
        normalizeFlowText(storeIdRaw) !== '';
      const numericStoreId = Number(storeIdRaw);
      const normalizedProduct = {
        asin: normalizeFlowText(product.asin),
        marketplace: normalizeFlowText(product.marketplace),
        store_id:
          hasStoreId && Number.isFinite(numericStoreId)
            ? numericStoreId
            : storeIdRaw,
        msku: normalizeFlowText(product.msku),
        product_code: normalizeFlowText(product.product_code),
        local_sku: normalizeFlowText((product as any).local_sku),
        seller_name: normalizeFlowText((product as any).seller_name),
      };

      if (
        normalizedProduct.asin &&
        normalizedProduct.marketplace &&
        hasStoreId
      ) {
        productMap.set(buildProductRowKey(normalizedProduct), normalizedProduct);
      }

      for (const plan of Array.isArray(item?.plans) ? item.plans : []) {
        addText(planSnSet, plan?.plan_sn);

        for (const order of Array.isArray(plan?.purchase_orders)
          ? plan.purchase_orders
          : []) {
          addText(orderSnSet, order?.order_sn);
        }

        for (const shipmentPlan of Array.isArray(plan?.shipment_plans)
          ? plan.shipment_plans
          : []) {
          addText(seqSet, shipmentPlan?.seq);
          addText(skuSet, shipmentPlan?.sku);
          addText(orderSnSet, shipmentPlan?.purchase_order_sn);
          addText(planSnSet, shipmentPlan?.purchase_plan_sn);
        }
      }
    }

    return {
      products: Array.from(productMap.values()),
      planSns: Array.from(planSnSet),
      orderSns: Array.from(orderSnSet),
      seqs: Array.from(seqSet),
      skus: Array.from(skuSet),
    };
  }

  private createSyncLatestSection(key: string, label: string, total: number) {
    return {
      key,
      label,
      total,
      success_count: 0,
      failed_count: 0,
      skipped_count: 0,
      message: '',
      items: [] as any[],
    };
  }

  private getSyncResultValues(result: any) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) return [];
    return Object.values(result);
  }

  private async syncLatestPurchasePlans(products: any[], warnings: string[]) {
    const section = this.createSyncLatestSection(
      'purchase_plan',
      '采购计划',
      products.length
    );
    if (!products.length) {
      section.message = '当前页面没有可同步的产品身份，已跳过采购计划同步';
      warnings.push(section.message);
      return section;
    }

    try {
      const result =
        await this.purchaseOrderSyncService.getPendingPurchasePlansByProducts({
          products,
          syncLinkedPlans: true,
        });
      const values = this.getSyncResultValues(result);
      const failedCount = values.filter(
        (item: any) => item?.sync_attempted && item?.sync_success === false
      ).length;
      section.failed_count = failedCount;
      section.success_count = Math.max(0, section.total - failedCount);
      (section as any).synced_plan_sns = uniqueTextList(
        values.flatMap((item: any) => item?.synced_plan_sns || [])
      );
      section.message = failedCount
        ? `采购计划部分同步失败 ${failedCount}/${section.total}`
        : '采购计划已同步';
    } catch (e: any) {
      section.failed_count = section.total;
      section.message = e?.message || '采购计划同步失败';
      warnings.push(section.message);
    }

    return section;
  }

  private async syncLatestPendingDelivery(products: any[], warnings: string[]) {
    const section = this.createSyncLatestSection(
      'pending_delivery',
      '待交付/采购单',
      products.length
    );
    if (!products.length) {
      section.message = '当前页面没有可同步的产品身份，已跳过待交付同步';
      warnings.push(section.message);
      return section;
    }

    try {
      const result = await this.purchaseOrderSyncService.getPendingDeliveryByProducts({
        products,
        syncLinkedOrders: true,
        keepLocalOnMissing: true,
      });
      const values = this.getSyncResultValues(result);
      const failedCount = values.filter(
        (item: any) => item?.sync_attempted && item?.sync_success === false
      ).length;
      section.failed_count = failedCount;
      section.success_count = Math.max(0, section.total - failedCount);
      (section as any).synced_order_sns = uniqueTextList(
        values.flatMap((item: any) => item?.synced_order_sns || [])
      );
      section.message = failedCount
        ? `待交付/采购单部分同步失败 ${failedCount}/${section.total}`
        : '待交付/采购单已同步';
    } catch (e: any) {
      section.failed_count = section.total;
      section.message = e?.message || '待交付/采购单同步失败';
      warnings.push(section.message);
    }

    return section;
  }

  private async syncLatestPurchaseOrders(orderSns: string[], warnings: string[]) {
    const section = this.createSyncLatestSection(
      'purchase_order',
      '采购单',
      orderSns.length
    );
    if (!orderSns.length) {
      section.message = '当前页面没有采购单号，已跳过采购单同步';
      warnings.push(section.message);
      return section;
    }

    try {
      const result = await this.purchaseOrderSyncService.syncByOrderSns({
        order_sns: orderSns,
        keepLocalOnMissing: true,
      });
      section.success_count = Number(result?.synced_count) || 0;
      section.failed_count = Number(result?.failed_count) || 0;
      section.skipped_count =
        Number(result?.remote_missing_count) + Number(result?.invalid_count) || 0;
      section.items = Array.isArray(result?.items) ? result.items : [];
      (section as any).synced_order_sns = result?.synced_order_sns || [];
      (section as any).remote_missing_order_sns =
        result?.remote_missing_order_sns || [];
      section.message = section.failed_count
        ? `采购单部分同步失败 ${section.failed_count}/${section.total}`
        : '采购单已同步';
    } catch (e: any) {
      section.failed_count = section.total;
      section.message = e?.message || '采购单同步失败';
      warnings.push(section.message);
    }

    return section;
  }

  private async syncLatestPurchaseOrderLogistics(
    orderSns: string[],
    warnings: string[]
  ) {
    const section = this.createSyncLatestSection(
      'logistics',
      '采购单物流',
      orderSns.length
    );
    if (!orderSns.length) {
      section.message = '当前页面没有采购单号，已跳过快递100物流刷新';
      warnings.push(section.message);
      return section;
    }

    try {
      const result = await this.purchaseOrderLogisticsService.autoRefreshOrderPackages(
        orderSns,
        { maxPackages: 20 }
      );
      section.success_count = Math.max(
        0,
        Number(result?.orderCount) - Number(result?.errorCount || 0)
      );
      section.failed_count = Number(result?.errorCount) || 0;
      section.skipped_count = Number(result?.skippedCount) || 0;
      (section as any).package_count = Number(result?.packageCount) || 0;
      (section as any).queried_count = Number(result?.queriedCount) || 0;
      (section as any).errors = Array.isArray(result?.errors) ? result.errors : [];
      section.message = section.failed_count
        ? `物流部分刷新失败 ${section.failed_count}/${section.total}`
        : '物流已按当前页面采购单刷新';
    } catch (e: any) {
      section.failed_count = section.total;
      section.message = e?.message || '物流刷新失败';
      warnings.push(section.message);
    }

    return section;
  }

  private async syncLatestShipmentPlans(seqs: string[], warnings: string[]) {
    const section = this.createSyncLatestSection(
      'shipment_plan',
      '发货计划',
      seqs.length
    );
    if (!seqs.length) {
      section.message = '当前页面没有发货计划批次号，已跳过发货计划同步';
      warnings.push(section.message);
      return section;
    }

    for (const seq of seqs) {
      try {
        const result = await this.purchaseOrderSyncService.refreshShipmentPlan(
          seq,
          true
        );
        section.success_count += 1;
        section.items.push({
          seq,
          status: 'success',
          refreshed: Boolean(result?.refreshed),
          count: Array.isArray(result?.data) ? result.data.length : 0,
        });
      } catch (e: any) {
        section.failed_count += 1;
        section.items.push({
          seq,
          status: 'failed',
          message: e?.message || '发货计划同步失败',
        });
      }
    }

    section.message = section.failed_count
      ? `发货计划部分同步失败 ${section.failed_count}/${section.total}`
      : '发货计划已同步';
    if (section.failed_count) warnings.push(section.message);
    return section;
  }

  private async syncLatestShipmentActuals(skus: string[], warnings: string[]) {
    const section = this.createSyncLatestSection(
      'shipment_actual',
      '发货单',
      skus.length
    );
    if (!skus.length) {
      section.message = '当前页面没有发货计划 SKU，已跳过发货单同步';
      warnings.push(section.message);
      return section;
    }

    try {
      const result = await this.shipmentActualService.syncBySkuList(skus);
      section.success_count = Number(result?.totalSkus) || skus.length;
      section.failed_count = 0;
      (section as any).total_upserted = Number(result?.totalUpserted) || 0;
      (section as any).skipped_final = Number(result?.skippedFinal) || 0;
      section.message = '发货单已按当前页面 SKU 同步';
    } catch (e: any) {
      section.failed_count = section.total;
      section.message = e?.message || '发货单同步失败';
      warnings.push(section.message);
    }

    return section;
  }

  async purchaseOrderFlow(param: PurchaseOrderFlowParam) {
    const identity = this.normalizePurchaseOrderFlowIdentity(param);
    const directAnalysisRows =
      await this.queryPurchaseOrderFlowAnalysisRows(identity);
    const itemRows = await this.queryPurchaseOrderFlowItems(identity);
    const analysisRows = this.mergePurchaseOrderFlowAnalysisRows(
      directAnalysisRows,
      itemRows
    );
    const planSns = uniqueTextList([
      identity.plan_sn,
      ...analysisRows.map(row => row.plan_sn),
      ...itemRows.map(row => row.plan_sn),
      ...itemRows.flatMap(row =>
        this.extractRelationPlanSns(row.relation_purchase_plan)
      ),
    ]);
    const purchaseOrder = identity.purchase_order_sn
      ? await this.queryPurchaseOrderFlowOrder(identity.purchase_order_sn)
      : null;
    if (purchaseOrder) {
      await this.purchaseOrderLogisticsService.attachStatusesToOrders([
        purchaseOrder,
      ]);
    }
    const purchaseOrderLogisticsStatus = purchaseOrder
      ? this.extractPurchaseOrderLogisticsStatus(purchaseOrder)
      : {
          logistics_status: '',
          logistics_status_text: '',
          logistics_status_reason: '',
        };
    const purchasePlans = await this.queryPurchaseOrderFlowPlans(planSns);
    const shipmentRows = await this.queryPurchaseOrderFlowShipmentRows(
      identity.purchase_order_sn,
      planSns
    );
    const shipmentData =
      this.buildPurchaseOrderFlowShipmentData(shipmentRows);
    const adjustmentData = identity.purchase_order_sn
      ? await this.queryPurchaseOrderFlowAdjustment(identity)
      : { adjustment: null, logs: [] };
    const analysisRecords =
      this.buildPurchaseOrderFlowAnalysisRecords(analysisRows);
    const snapshot = await this.queryPurchaseOrderFlowSnapshot(
      identity,
      analysisRecords
    );
    const replenishmentAnalysis =
      this.buildPurchaseOrderFlowReplenishmentAnalysis(
        analysisRecords,
        snapshot
      );
    const quantityPlanSum = itemRows.reduce(
      (sum, row) => sum + toNumber(row.quantity_plan),
      0
    );
    const quantityRealSum = itemRows.reduce(
      (sum, row) => sum + toNumber(row.quantity_real),
      0
    );
    const quantityEntrySum = itemRows.reduce(
      (sum, row) => sum + toNumber(row.quantity_entry),
      0
    );
    const quantityReceiveSum = itemRows.reduce(
      (sum, row) => sum + toNumber(row.quantity_receive),
      0
    );
    const fulfillmentSummary = computeFulfillmentSummary({
      purchase_order_status: purchaseOrder?.status,
      logistics_status: purchaseOrderLogisticsStatus.logistics_status,
      quantity_real_sum: quantityRealSum,
      quantity_entry_sum: quantityEntrySum,
      actual_shipment_qty_sum: shipmentData.summary.actual_shipment_qty_sum,
      defective_qty: adjustmentData.adjustment?.defective_qty,
      defective_status: adjustmentData.adjustment?.defective_status,
      short_shipped_qty: adjustmentData.adjustment?.short_shipped_qty,
      short_shipped_status: adjustmentData.adjustment?.short_shipped_status,
      manual_completed: adjustmentData.adjustment?.manual_completed,
    });
    const summary = {
      flow_scope: identity.plan_sn ? 'purchase_plan' : 'purchase_order',
      plan_sn: identity.plan_sn || planSns[0] || '',
      analysis_record_id:
        identity.analysis_record_id || analysisRecords[0]?.id || null,
      has_purchase_order: Boolean(purchaseOrder),
      purchase_order_status: purchaseOrder?.status ?? null,
      purchase_order_status_text: purchaseOrder?.status_text || '',
      logistics_status: purchaseOrderLogisticsStatus.logistics_status,
      logistics_status_text: purchaseOrderLogisticsStatus.logistics_status_text,
      logistics_status_reason:
        purchaseOrderLogisticsStatus.logistics_status_reason,
      fulfillment_status: fulfillmentSummary.fulfillment_status,
      fulfillment_status_text: fulfillmentSummary.fulfillment_status_text,
      fulfillment_group_status: fulfillmentSummary.fulfillment_group_status,
      fulfillment_group_status_text:
        fulfillmentSummary.fulfillment_group_status_text,
      quantity_plan_sum: quantityPlanSum,
      quantity_real_sum: quantityRealSum,
      quantity_entry_sum: quantityEntrySum,
      quantity_receive_sum: quantityReceiveSum,
      shipment_plan_qty_sum: shipmentData.summary.shipment_plan_qty_sum,
      actual_shipment_qty_sum: shipmentData.summary.actual_shipment_qty_sum,
      estimated_shippable_qty: fulfillmentSummary.estimated_shippable_qty,
      actual_shippable_qty: fulfillmentSummary.actual_shippable_qty,
      defective_qty: fulfillmentSummary.defective_qty,
      short_shipped_qty: fulfillmentSummary.short_shipped_qty,
      linked_item_count: itemRows.length,
      latest_event_time: null as any,
    };
    const details = {
      analysis_records: analysisRecords,
      replenishment_analysis: replenishmentAnalysis,
      purchase_plans: purchasePlans,
      purchase_order: purchaseOrder,
      purchase_order_items: itemRows,
      shipment_plans: shipmentData.shipment_plans,
      shipment_actuals: shipmentData.actuals,
      fulfillment_adjustment: adjustmentData.adjustment,
      adjustment_logs: adjustmentData.logs,
    };
    const nodes = this.buildPurchaseOrderFlowNodes(summary, details);
    const events = this.buildPurchaseOrderFlowEvents(summary, details);

    summary.latest_event_time =
      events.reduce((latest, event) => pickLatestTime(latest, event.time), null) ||
      null;

    return {
      identity,
      summary,
      nodes,
      events,
      details,
    };
  }

  async purchaseOrderFlowBatch(param: PurchaseOrderFlowBatchParam) {
    const items = Array.isArray(param?.items) ? param.items : [];
    const results = [];

    for (const item of items) {
      const clientKey = normalizeFlowText(item.clientKey || item.row_key);
      const traceRequests = this.buildPurchaseOrderFlowBatchTraceRequests(item);
      const traces = [];

      for (const request of traceRequests) {
        try {
          const flow = await this.purchaseOrderFlow(request.identity);
          const analysis: any = flow.details?.replenishment_analysis || {};
          traces.push({
            key:
              flow.summary?.analysis_record_id
                ? `analysis:${flow.summary.analysis_record_id}`
                : `plan:${flow.summary?.plan_sn || request.identity.plan_sn}`,
            plan_sn: flow.summary?.plan_sn || request.identity.plan_sn,
            analysis_record_id:
              flow.summary?.analysis_record_id || request.identity.analysis_record_id || null,
            linked_order_sns: request.linked_order_sns,
            linked_order_count: request.linked_order_sns.length,
            source: 'purchase_order_flow',
            trace_level: analysis.trace_level || 'legacy_compatible',
            snapshot_label: analysis.snapshot_label || analysis.source_label || '历史记录',
            actionable: Boolean(analysis.actionable),
            available_sections: Array.isArray(analysis.available_sections)
              ? analysis.available_sections
              : [],
            missing_sections: Array.isArray(analysis.missing_sections)
              ? analysis.missing_sections
              : [],
            missing_section_labels: Array.isArray(analysis.missing_section_labels)
              ? analysis.missing_section_labels
              : [],
            flow,
          });
        } catch (error: any) {
          traces.push({
            key: request.key,
            plan_sn: request.identity.plan_sn,
            analysis_record_id: request.identity.analysis_record_id || null,
            linked_order_sns: request.linked_order_sns,
            linked_order_count: request.linked_order_sns.length,
            source: 'purchase_order_flow',
            error: error?.message || '补货依据加载失败',
          });
        }
      }
      const resultTraces = param?.preserve_order_traces
        ? traces
        : mergeReplenishmentTraceResults(traces);

      results.push({
        clientKey,
        row_key: normalizeFlowText(item.row_key),
        trace_count: resultTraces.filter(trace => !trace.error).length,
        order_count: uniqueTextList(
          resultTraces.flatMap(trace => trace.linked_order_sns || [])
        ).length,
        traces: resultTraces,
      });
    }

    return { list: results };
  }

  private normalizePurchaseOrderFlowIdentity(
    param: PurchaseOrderFlowParam
  ): PurchaseOrderFlowIdentity {
    const identity = {
      store_id: Number(param.store_id) || 0,
      marketplace: normalizeFlowText(param.marketplace),
      asin: normalizeFlowText(param.asin),
      msku: normalizeFlowText(param.msku),
      product_code: normalizeFlowText(param.product_code),
      plan_sn: normalizeFlowText(param.plan_sn),
      analysis_record_id: Number(param.analysis_record_id) || 0,
      purchase_order_sn: normalizeFlowText(param.purchase_order_sn),
    };

    if (!identity.store_id) throw new Error('缺少店铺ID');
    if (!identity.marketplace) throw new Error('缺少国家/站点');
    if (!identity.asin) throw new Error('缺少ASIN');
    if (!identity.plan_sn && !identity.purchase_order_sn && !identity.analysis_record_id) {
      throw new Error('缺少采购计划号、采购单号或分析记录ID');
    }

    return identity;
  }

  private buildPurchaseOrderFlowBatchTraceRequests(item: PurchaseOrderFlowBatchItemParam) {
    const base = {
      store_id: item.store_id,
      marketplace: item.marketplace,
      asin: item.asin,
      msku: item.msku,
      product_code: item.product_code,
    };
    const explicitPlanSns = uniqueTextList([
      ...normalizeQueryValueList(item.plan_sns),
      normalizeFlowText(item.plan_sn),
    ]);
    const explicitAnalysisIds = normalizeQueryValueList(item.analysis_record_ids)
      .map(value => Number(value) || 0)
      .filter(Boolean);
    const orderRows = Array.isArray(item.orders) ? item.orders : [];
    const orderSns = uniqueTextList([
      ...normalizeQueryValueList(item.order_sns),
      normalizeFlowText(item.purchase_order_sn),
      ...orderRows.map(order => order.purchase_order_sn),
    ]);
    const grouped = new Map<
      string,
      {
        identity: PurchaseOrderFlowParam;
        linked_order_sns: string[];
        key: string;
      }
    >();
    const addTrace = (
      identity: PurchaseOrderFlowParam,
      linkedOrderSns: string[] = []
    ) => {
      const planSn = normalizeFlowText(identity.plan_sn);
      const analysisId = Number(identity.analysis_record_id) || 0;
      const orderSn = normalizeFlowText(identity.purchase_order_sn);
      if (!planSn && !analysisId && !orderSn) return;

      const key = analysisId
        ? `analysis:${analysisId}`
        : planSn
          ? `plan:${planSn}`
          : `order:${orderSn}`;
      const current = grouped.get(key);
      if (current) {
        current.linked_order_sns = uniqueTextList([
          ...current.linked_order_sns,
          ...linkedOrderSns,
          orderSn,
        ]);
        return;
      }

      grouped.set(key, {
        key,
        identity: {
          ...base,
          ...identity,
          plan_sn: planSn,
          analysis_record_id: analysisId || undefined,
          purchase_order_sn: orderSn,
        },
        linked_order_sns: uniqueTextList([...linkedOrderSns, orderSn]),
      });
    };

    orderRows.forEach(order => {
      const linkedPlanSns = uniqueTextList([
        ...normalizeQueryValueList(order.linked_plan_sns),
        normalizeFlowText(order.plan_sn),
      ]);
      const orderSn = normalizeFlowText(order.purchase_order_sn);
      const analysisId = Number(order.analysis_record_id) || 0;

      linkedPlanSns.forEach(planSn =>
        addTrace(
          {
            ...order,
            plan_sn: planSn,
            analysis_record_id: analysisId || order.analysis_record_id,
            purchase_order_sn: '',
          },
          orderSn ? [orderSn] : []
        )
      );

      if (!linkedPlanSns.length) {
        addTrace(
          {
            ...order,
            analysis_record_id: analysisId || order.analysis_record_id,
            purchase_order_sn: orderSn,
          },
          orderSn ? [orderSn] : []
        );
      }
    });

    explicitPlanSns.forEach(planSn => addTrace({ ...base, plan_sn: planSn }));
    explicitAnalysisIds.forEach(analysisId =>
      addTrace({ ...base, analysis_record_id: analysisId })
    );
    orderSns.forEach(orderSn =>
      addTrace({ ...base, purchase_order_sn: orderSn }, [orderSn])
    );

    return Array.from(grouped.values());
  }

  private async queryPurchaseOrderFlowAnalysisRows(
    identity: PurchaseOrderFlowIdentity
  ) {
    if (!identity.analysis_record_id && !identity.plan_sn) return [];

    const where = ['ar.store_id = ?', 'ar.marketplace = ?', 'ar.asin = ?'];
    const params: any[] = [
      identity.store_id,
      identity.marketplace,
      identity.asin,
    ];

    if (identity.msku) {
      where.push("COALESCE(ar.msku, '') = ?");
      params.push(identity.msku);
    }

    if (identity.product_code) {
      where.push("COALESCE(l.product_code, '') = ?");
      params.push(identity.product_code);
    }

    if (identity.analysis_record_id) {
      where.push('ar.id = ?');
      params.push(identity.analysis_record_id);
    } else {
      where.push('ar.plan_sn = ?');
      params.push(identity.plan_sn);
    }

    return this.analysisRecordEntity.manager.query(
      `
        SELECT
          NULL AS order_item_id,
          ar.id AS analysis_record_id,
          ar.plan_sn,
          '' AS order_sn,
          NULL AS product_id,
          '' AS product_name,
          '' AS sku,
          '' AS fnsku,
          '' AS first_msku,
          NULL AS wid,
          '' AS ware_house_name,
          0 AS quantity_plan,
          0 AS quantity_real,
          0 AS quantity_entry,
          0 AS quantity_receive,
          NULL AS expect_arrive_time,
          '' AS plan_creator_name,
          NULL AS plan_create_time,
          '' AS plan_supplier_name,
          '' AS plan_warehouse_name,
          ar.id AS analysis_id,
          ar.store_id,
          ar.asin,
          ar.marketplace,
          ar.msku,
          COALESCE(l.product_code, '') AS product_code,
          ar.local_sku,
          ar.ppg_sn,
          ar.quantity_plan AS analysis_quantity_plan,
          ar.status AS analysis_status,
          ar.expected_sales AS analysis_expected_sales,
          ar.remark AS analysis_remark,
          ar.manual_remark AS analysis_manual_remark,
          ar.staged_by_user_id,
          ar.staged_by_username,
          ar.staged_by_nickname,
          ar.staged_time,
          ar.purchase_plan_created_by_user_id,
          ar.purchase_plan_created_by_username,
          ar.purchase_plan_created_by_nickname,
          ar.purchase_plan_created_time,
          ar.\`createTime\` AS analysis_create_time,
          ar.\`updateTime\` AS analysis_update_time
        FROM app_amz_bsr_analysis_record_lingxing ar
        LEFT JOIN app_amz_bsr_product_listing_lingxing l
          ON l.store_id = ar.store_id
          AND l.asin = ar.asin
          AND l.marketplace = ar.marketplace
          AND l.msku = ar.msku
        WHERE ${where.join(' AND ')}
        ORDER BY ar.\`createTime\` DESC, ar.id DESC
        LIMIT 5
      `,
      params
    );
  }

  private async queryPurchaseOrderFlowItems(identity: PurchaseOrderFlowIdentity) {
    const where = [
      'ar.store_id = ?',
      'ar.marketplace = ?',
      'ar.asin = ?',
    ];
    const params: any[] = [identity.store_id, identity.marketplace, identity.asin];
    const linkWhere: string[] = [];

    if (identity.msku) {
      where.push("COALESCE(ar.msku, '') = ?");
      params.push(identity.msku);
    }

    if (identity.product_code) {
      where.push("COALESCE(l.product_code, '') = ?");
      params.push(identity.product_code);
    }

    if (identity.purchase_order_sn) {
      linkWhere.push('i.order_sn = ?');
      params.push(identity.purchase_order_sn);
    }

    if (identity.analysis_record_id) {
      linkWhere.push('i.analysis_record_id = ?');
      params.push(identity.analysis_record_id);
    }

    if (identity.plan_sn) {
      linkWhere.push('i.plan_sn = ?');
      params.push(identity.plan_sn);
      linkWhere.push(
        'JSON_CONTAINS(COALESCE(i.relation_purchase_plan, JSON_ARRAY()), JSON_QUOTE(?))'
      );
      params.push(identity.plan_sn);
    }

    if (linkWhere.length === 0) return [];
    where.push(`(${linkWhere.join(' OR ')})`);

    const sql = `
      SELECT
        i.id AS order_item_id,
        i.analysis_record_id,
        i.plan_sn,
        i.relation_purchase_plan,
        i.order_sn,
        i.product_id,
        i.product_name,
        i.sku,
        i.fnsku,
        i.first_msku,
        i.wid,
        i.ware_house_name,
        i.quantity_plan,
        i.quantity_real,
        i.quantity_entry,
        i.quantity_receive,
        i.expect_arrive_time,
        i.plan_creator_name,
        i.plan_create_time,
        i.plan_supplier_name,
        i.plan_warehouse_name,
        ar.id AS analysis_id,
        ar.store_id,
        ar.asin,
        ar.marketplace,
        ar.msku,
        COALESCE(l.product_code, '') AS product_code,
        ar.local_sku,
        ar.ppg_sn,
        ar.quantity_plan AS analysis_quantity_plan,
        ar.status AS analysis_status,
        ar.expected_sales AS analysis_expected_sales,
        ar.remark AS analysis_remark,
        ar.manual_remark AS analysis_manual_remark,
        ar.staged_by_user_id,
        ar.staged_by_username,
        ar.staged_by_nickname,
        ar.staged_time,
        ar.purchase_plan_created_by_user_id,
        ar.purchase_plan_created_by_username,
        ar.purchase_plan_created_by_nickname,
        ar.purchase_plan_created_time,
        ar.\`createTime\` AS analysis_create_time,
        ar.\`updateTime\` AS analysis_update_time
      FROM app_amz_bsr_purchase_order_item_sync_lingxing i
      INNER JOIN app_amz_bsr_analysis_record_lingxing ar
        ON (
          (i.analysis_record_id IS NOT NULL AND ar.id = i.analysis_record_id)
          OR (i.analysis_record_id IS NULL AND ar.plan_sn = i.plan_sn)
        )
      LEFT JOIN app_amz_bsr_product_listing_lingxing l
        ON l.store_id = ar.store_id
        AND l.asin = ar.asin
        AND l.marketplace = ar.marketplace
        AND l.msku = ar.msku
      WHERE ${where.join(' AND ')}
      ORDER BY i.id DESC
    `;

    return this.analysisRecordEntity.manager.query(sql, params);
  }

  private mergePurchaseOrderFlowAnalysisRows(
    directRows: any[],
    itemRows: any[]
  ) {
    const map = new Map<string, any>();
    const addRow = (row: any) => {
      if (!row) return;
      const key = row.analysis_id || row.analysis_record_id
        ? `analysis:${row.analysis_id || row.analysis_record_id}`
        : row.plan_sn
          ? `plan:${row.plan_sn}`
          : '';
      if (!key || map.has(key)) return;
      map.set(key, row);
    };

    (directRows || []).forEach(addRow);
    (itemRows || []).forEach(addRow);

    return Array.from(map.values());
  }

  private extractRelationPlanSns(value: any) {
    const parsed = parseMaybeJson(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(item => normalizeFlowText(item))
      .filter(Boolean);
  }

  private async queryPurchaseOrderFlowOrder(purchaseOrderSn: string) {
    const rows = await this.analysisRecordEntity.manager.query(
      `
        SELECT
          id,
          order_sn,
          custom_order_sn,
          supplier_name,
          wid,
          ware_house_name,
          status,
          status_text,
          status_shipped,
          status_shipped_text,
          pay_status,
          pay_status_text,
          quantity_total,
          quantity_entry,
          quantity_real,
          quantity_receive,
          opt_uid,
          opt_realname,
          auditor_uid,
          auditor_realname,
          last_uid,
          last_realname,
          create_time_remote,
          order_time,
          auditor_time,
          last_time,
          update_time_remote,
          purchaser_id,
          purchase_type,
          purchase_type_text,
          remark,
          logistics_confirmed,
          logistics_confirmed_time
        FROM app_amz_bsr_purchase_order_sync_lingxing
        WHERE order_sn = ?
        LIMIT 1
      `,
      [purchaseOrderSn]
    );

    return rows?.[0] || null;
  }

  private async queryPurchaseOrderFlowPlans(planSns: string[]) {
    if (planSns.length === 0) return [];

    const rows = await this.analysisRecordEntity.manager.query(
      `
        SELECT
          plan_sn,
          ppg_sn,
          sku,
          product_name,
          pic_url,
          fnsku,
          msku,
          sid,
          seller_name,
          marketplace,
          quantity_plan,
          status,
          status_text,
          supplier_name,
          warehouse_name,
          purchaser_name,
          cg_opt_username,
          creator_uid,
          creator_real_name,
          create_time_remote,
          update_time_remote,
          expect_arrive_time,
          remark,
          plan_remark,
          analysis_record_id
        FROM app_amz_bsr_purchase_plan_lingxing
        WHERE plan_sn IN (${planSns.map(() => '?').join(',')})
        ORDER BY create_time_remote DESC, id DESC
      `,
      planSns
    );
    const orderMap = new Map(planSns.map((sn, index) => [sn, index]));

    return rows.sort(
      (a: any, b: any) =>
        (orderMap.get(a.plan_sn) ?? 9999) - (orderMap.get(b.plan_sn) ?? 9999)
    );
  }

  private async queryPurchaseOrderFlowShipmentRows(
    purchaseOrderSn: string,
    planSns: string[]
  ) {
    if (planSns.length === 0) return [];
    const where = [
      `sp.purchase_plan_sn IN (${planSns.map(() => '?').join(',')})`,
      'sp.purchase_plan_sn IS NOT NULL',
      "sp.purchase_plan_sn != ''",
    ];
    const params: any[] = [...planSns];

    if (purchaseOrderSn) {
      where.push('sp.purchase_order_sn = ?');
      params.push(purchaseOrderSn);
    }

    return this.analysisRecordEntity.manager.query(
      `
        SELECT
          sp.id AS shipment_plan_row_id,
          sp.isp_id,
          sp.seq,
          sp.order_sn AS shipment_plan_sn,
          sp.purchase_plan_sn,
          sp.purchase_order_sn,
          sp.sku,
          sp.msku,
          sp.fnsku,
          sp.product_name,
          sp.pic_url,
          sp.small_image_url,
          sp.sid,
          sp.sname,
          sp.nation,
          sp.wid,
          sp.wname,
          sp.shipment_time AS planned_shipment_time,
          sp.shipment_plan_quantity,
          sp.status AS shipment_plan_status,
          sp.status_name AS shipment_plan_status_name,
          sp.shipping_method,
          sp.create_user AS shipment_plan_create_user,
          sp.create_time_remote AS shipment_plan_create_time,
          sp.local_created_by_user_id,
          sp.local_created_by_username,
          sp.local_created_by_nickname,
          sp.local_created_time,
          sp.batch_remark,
          sp.remark AS shipment_plan_remark,
          sp.last_sync_time AS shipment_plan_last_sync_time,
          sa.id AS actual_row_id,
          sa.ispr_id,
          sa.shipment_sn,
          sa.shipment_list_quantity,
          sa.shipment_status,
          sa.shipment_status_name,
          sa.shipment_status_mws,
          sa.shipment_time,
          sa.method_name,
          sa.logistics_channel_name,
          sa.wname AS actual_wname,
          sa.wid AS actual_wid,
          sa.expected_arrival_date,
          sa.create_user AS actual_create_user,
          sa.create_time_remote AS actual_create_time,
          sa.update_time_remote AS actual_update_time,
          sa.shipment_id,
          sa.sku AS actual_sku,
          sa.msku AS actual_msku,
          sa.fnsku AS actual_fnsku,
          sa.product_name AS actual_product_name,
          sa.num AS actual_product_num,
          sa.apply_num AS actual_apply_num,
          sa.pic_url AS actual_pic_url,
          sa.asin AS actual_asin,
          sa.sname AS actual_sname,
          sa.sid AS actual_sid,
          sa.nation AS actual_nation,
          sa.is_final
        FROM app_amz_bsr_shipment_plan_lingxing sp
        LEFT JOIN app_amz_bsr_shipment_actual_lingxing sa
          ON sa.isp_id = sp.isp_id
        WHERE ${where.join(' AND ')}
        ORDER BY sp.local_created_time DESC, sp.create_time_remote DESC, sp.id DESC, sa.id DESC
      `,
      params
    );
  }

  private buildPurchaseOrderFlowShipmentData(rows: any[]) {
    const planMap = new Map<string, any>();
    const actuals: any[] = [];
    const actualSeen = new Set<string>();
    const summary = {
      shipment_plan_qty_sum: 0,
      actual_shipment_qty_sum: 0,
    };

    for (const row of rows || []) {
      const planKey = normalizeFlowText(
        pickFirst(row.shipment_plan_row_id, row.isp_id, row.seq, row.shipment_plan_sn)
      );
      if (!planKey) continue;

      if (!planMap.has(planKey)) {
        const shipmentPlan = {
          id: row.shipment_plan_row_id ?? null,
          isp_id: row.isp_id ?? null,
          seq: row.seq || '',
          shipment_plan_sn: row.shipment_plan_sn || '',
          purchase_plan_sn: row.purchase_plan_sn || '',
          purchase_order_sn: row.purchase_order_sn || '',
          sku: row.sku || '',
          msku: row.msku || '',
          fnsku: row.fnsku || '',
          product_name: row.product_name || '',
          pic_url: row.pic_url || row.small_image_url || '',
          small_image_url: row.small_image_url || row.pic_url || '',
          sid: row.sid ?? null,
          sname: row.sname || '',
          nation: row.nation || '',
          wid: row.wid ?? null,
          wname: row.wname || '',
          planned_shipment_time: row.planned_shipment_time || null,
          shipment_plan_quantity: toNumber(row.shipment_plan_quantity),
          actual_qty_sum: 0,
          diff_qty: 0,
          shipment_plan_status: row.shipment_plan_status ?? null,
          shipment_plan_status_name: row.shipment_plan_status_name || '',
          shipping_method: row.shipping_method || '',
          shipment_plan_create_user: row.shipment_plan_create_user || '',
          shipment_plan_create_time: row.shipment_plan_create_time || null,
          local_created_by_user_id: row.local_created_by_user_id || null,
          local_created_by_username: row.local_created_by_username || '',
          local_created_by_nickname: row.local_created_by_nickname || '',
          local_created_time: row.local_created_time || null,
          batch_remark: row.batch_remark || '',
          remark: row.shipment_plan_remark || '',
          last_sync_time: row.shipment_plan_last_sync_time || null,
          actual_details: [],
        };

        planMap.set(planKey, shipmentPlan);
        summary.shipment_plan_qty_sum += shipmentPlan.shipment_plan_quantity;
      }

      if (!row.actual_row_id && !row.ispr_id && !row.shipment_sn) continue;

      const actualKey = normalizeFlowText(
        pickFirst(row.actual_row_id, row.ispr_id, row.shipment_sn)
      );
      if (actualSeen.has(`${planKey}|${actualKey}`)) continue;
      actualSeen.add(`${planKey}|${actualKey}`);

      const actual = {
        id: row.actual_row_id ?? null,
        ispr_id: row.ispr_id ?? null,
        isp_id: row.isp_id ?? null,
        seq: row.seq || '',
        shipment_plan_sn: row.shipment_plan_sn || '',
        shipment_sn: row.shipment_sn || '',
        shipment_list_quantity: toNumber(row.shipment_list_quantity),
        shipment_status: row.shipment_status ?? null,
        shipment_status_name: row.shipment_status_name || '',
        shipment_status_mws: row.shipment_status_mws || '',
        shipment_time: row.shipment_time || null,
        method_name: row.method_name || '',
        logistics_channel_name: row.logistics_channel_name || '',
        wname: row.actual_wname || row.wname || '',
        wid: row.actual_wid || row.wid || null,
        expected_arrival_date: row.expected_arrival_date || null,
        create_user: row.actual_create_user || '',
        create_time_remote: row.actual_create_time || null,
        update_time_remote: row.actual_update_time || null,
        shipment_id: row.shipment_id || '',
        sku: row.actual_sku || row.sku || '',
        msku: row.actual_msku || row.msku || '',
        fnsku: row.actual_fnsku || row.fnsku || '',
        product_name: row.actual_product_name || row.product_name || '',
        pic_url: row.actual_pic_url || row.pic_url || row.small_image_url || '',
        asin: row.actual_asin || '',
        sname: row.actual_sname || row.sname || '',
        sid: row.actual_sid || row.sid || null,
        nation: row.actual_nation || row.nation || '',
        is_final: row.is_final ?? null,
      };
      const shipmentPlan = planMap.get(planKey);

      shipmentPlan.actual_details.push(actual);
      shipmentPlan.actual_qty_sum += actual.shipment_list_quantity;
      shipmentPlan.diff_qty =
        shipmentPlan.actual_qty_sum - shipmentPlan.shipment_plan_quantity;
      summary.actual_shipment_qty_sum += actual.shipment_list_quantity;
      actuals.push(actual);
    }

    return {
      summary,
      shipment_plans: Array.from(planMap.values()),
      actuals,
    };
  }

  private async queryPurchaseOrderFlowAdjustment(
    identity: PurchaseOrderFlowIdentity
  ) {
    const adjustmentRows = await this.analysisRecordEntity.manager.query(
      `
        SELECT *
        FROM app_amz_bsr_purchase_order_fulfillment_adjustment
        WHERE store_id = ?
          AND marketplace = ?
          AND asin = ?
          AND msku = ?
          AND product_code = ?
          AND purchase_order_sn = ?
        LIMIT 1
      `,
      [
        identity.store_id,
        identity.marketplace,
        identity.asin,
        identity.msku,
        identity.product_code,
        identity.purchase_order_sn,
      ]
    );
    const adjustment = adjustmentRows?.[0] || null;

    if (!adjustment?.id) {
      return { adjustment, logs: [] };
    }

    const logs = await this.analysisRecordEntity.manager.query(
      `
        SELECT *
        FROM app_amz_bsr_purchase_order_fulfillment_adjustment_log
        WHERE adjustment_id = ?
        ORDER BY \`createTime\` DESC, id DESC
        LIMIT 100
      `,
      [adjustment.id]
    );

    return { adjustment, logs };
  }

  private buildPurchaseOrderFlowAnalysisRecords(itemRows: any[]) {
    const map = new Map<number, any>();

    for (const row of itemRows || []) {
      const id = Number(row.analysis_id || row.analysis_record_id) || 0;
      if (!id || map.has(id)) continue;
      const analysisPayload = this.buildPurchaseOrderFlowAnalysisPayload(row);

      map.set(id, {
        id,
        store_id: row.store_id,
        marketplace: row.marketplace,
        asin: row.asin,
        msku: row.msku || '',
        product_code: row.product_code || '',
        local_sku: row.local_sku || '',
        plan_sn: row.plan_sn || '',
        ppg_sn: row.ppg_sn || '',
        quantity_plan: row.analysis_quantity_plan || 0,
        status: row.analysis_status,
        ...analysisPayload,
        plan_creator_name: row.plan_creator_name || '',
        plan_create_time: row.plan_create_time || null,
        staged_by_user_id: row.staged_by_user_id || null,
        staged_by_username: row.staged_by_username || '',
        staged_by_nickname: row.staged_by_nickname || '',
        staged_time: row.staged_time || null,
        purchase_plan_created_by_user_id:
          row.purchase_plan_created_by_user_id || null,
        purchase_plan_created_by_username:
          row.purchase_plan_created_by_username || '',
        purchase_plan_created_by_nickname:
          row.purchase_plan_created_by_nickname || '',
        purchase_plan_created_time: row.purchase_plan_created_time || null,
        create_time: row.analysis_create_time || null,
        update_time: row.analysis_update_time || null,
      });
    }

    return Array.from(map.values());
  }

  private buildPurchaseOrderFlowAnalysisPayload(row: any) {
    const expectedSales = parseMaybeJson(row.analysis_expected_sales);
    const remarkData = parseMaybeJson(row.analysis_remark);
    const breakdown = Array.isArray(remarkData.breakdown)
      ? remarkData.breakdown
      : Array.isArray(expectedSales.breakdown)
      ? expectedSales.breakdown
      : [];
    const shippingMap = new Map<string, any>();

    for (const item of breakdown) {
      const method = normalizeFlowText(
        item?.shipping_method || item?.method || item?.algorithm || item?.algo_used_name || 'calculation'
      );
      const label = normalizeFlowText(
        item?.shipping_label ||
          item?.label ||
          item?.algorithm ||
          item?.algo_used_name ||
          '测算合计'
      );
      const key = `${method}|${label}`;

      if (!shippingMap.has(key)) {
        shippingMap.set(key, {
          shipping_method: method,
          shipping_label: label,
          days: 0,
          quantity: 0,
          segment_count: 0,
        });
      }

      const target = shippingMap.get(key);
      target.days += toNumber(item?.days);
      target.quantity += toNumber(item?.subtotal);
      target.segment_count += 1;
    }

    const startDate = pickFirst(
      remarkData.start_date,
      remarkData.startDate,
      expectedSales.start_date,
      expectedSales.startDate
    );
    const endDate = pickFirst(
      remarkData.end_date,
      remarkData.endDate,
      expectedSales.end_date,
      expectedSales.endDate
    );

    return {
      manual_remark: row.analysis_manual_remark || '',
      expected_sales: expectedSales,
      raw_remark: remarkData,
      summary: pickFirst(remarkData.summary, expectedSales.summary, ''),
      formula: pickFirst(remarkData.formula, expectedSales.formula, ''),
      remark_text: pickFirst(remarkData.remark_text, expectedSales.remark_text, ''),
      start_date: startDate || null,
      end_date: endDate || null,
      total_days:
        toNumber(
          pickFirst(
            remarkData.total_days,
            remarkData.days,
            expectedSales.total_days,
            expectedSales.days
          )
        ) || 0,
      base_daily_avg_sales: toNumber(
        pickFirst(
          remarkData.base_daily_avg_sales,
          expectedSales.base_daily_avg_sales,
          expectedSales.dailyAvg
        )
      ),
      artificial_coefficient: toNumber(
        pickFirst(
          remarkData.artificial_coefficient,
          remarkData.manualCoefficient,
          expectedSales.artificial_coefficient,
          expectedSales.manualCoefficient
        )
      ),
      user_selected_algo_id: toNumber(
        pickFirst(
          remarkData.user_selected_algo_id,
          remarkData.userSelectedAlgo,
          expectedSales.user_selected_algo_id,
          expectedSales.userSelectedAlgo
        )
      ),
      user_selected_algo_name: pickFirst(
        remarkData.user_selected_algo_name,
        expectedSales.user_selected_algo_name,
        ''
      ),
      custom_alpha: pickFirst(remarkData.custom_alpha, expectedSales.custom_alpha, null),
      breakdown,
      shipping_breakdown_summary: Array.from(shippingMap.values()),
    };
  }

  private async queryPurchaseOrderFlowSnapshot(
    identity: PurchaseOrderFlowIdentity,
    analysisRecords: any[]
  ) {
    const analysisId =
      identity.analysis_record_id || Number(analysisRecords?.[0]?.id) || 0;

    try {
      if (analysisId) {
        const rows = await this.analysisRecordEntity.manager.query(
          `
            SELECT *
            FROM app_amz_bsr_batch_replenish_snapshot
            WHERE analysis_record_id = ?
            ORDER BY \`createTime\` DESC, id DESC
            LIMIT 1
          `,
          [analysisId]
        );
        if (rows?.[0]) return rows[0];
      }

      if (!identity.plan_sn) return null;

      const where = [
        'plan_sn = ?',
        'store_id = ?',
        'marketplace = ?',
        'asin = ?',
      ];
      const params: any[] = [
        identity.plan_sn,
        identity.store_id,
        identity.marketplace,
        identity.asin,
      ];

      if (identity.msku) {
        where.push("COALESCE(msku, '') = ?");
        params.push(identity.msku);
      }

      if (identity.product_code) {
        where.push("COALESCE(product_code, '') = ?");
        params.push(identity.product_code);
      }

      const rows = await this.analysisRecordEntity.manager.query(
        `
          SELECT *
          FROM app_amz_bsr_batch_replenish_snapshot
          WHERE ${where.join(' AND ')}
          ORDER BY \`createTime\` DESC, id DESC
          LIMIT 1
        `,
        params
      );

      return rows?.[0] || null;
    } catch {
      return null;
    }
  }

  private buildPurchaseOrderFlowReplenishmentAnalysis(
    analysisRecords: any[],
    snapshot: any
  ) {
    const analysis = analysisRecords?.[0] || null;

    if (snapshot) {
      return this.buildFullSnapshotReplenishmentAnalysis(analysis, snapshot);
    }

    if (analysis) {
      return this.buildLegacyReplenishmentAnalysis(analysis);
    }

    return {
      source: 'none',
      source_label: '暂无数据',
      trace_level: 'legacy_compatible',
      snapshot_label: '暂无数据',
      actionable: false,
      available_sections: [],
      missing_sections: [],
      missing_section_labels: [],
      analysis_record_id: null,
      plan_sn: '',
      summary_cards: [],
      demand_basis_rows: [],
      formula_text: '',
      formula_steps: [],
      summary_text: '',
      shipping_segments: [],
      deduction_rows: [],
      inventory_rows: [],
      coefficient_rows: [],
      adjustment_log: [],
      adjustment_summary: '',
      manual_remark: '',
      raw_snapshot_available: false,
    };
  }

  private buildFullSnapshotReplenishmentAnalysis(analysis: any, snapshot: any) {
    const snapshotSections = buildReplenishmentSnapshotSectionMap(snapshot);
    const snapshotQuality = classifyReplenishmentSnapshotQuality({
      hasSnapshot: true,
      sections: snapshotSections,
    });
    const snapshotSource = normalizeFlowText(snapshot?.snapshot_source);
    const snapshotSourceLabel = getReplenishmentSnapshotSourceLabel(snapshotSource);
    const autoCompleteState = buildAutoCompleteSnapshotDisplayState(snapshot);
    const displaySourceLabel = snapshotSource === 'purchase_plan_remark_auto_complete' && snapshotSourceLabel
      ? `${snapshotQuality.snapshot_label} · ${snapshotSourceLabel}${autoCompleteState.source_label_suffix ? ` · ${autoCompleteState.source_label_suffix}` : ''}`
      : snapshotQuality.snapshot_label;
    const snapshotMeta = buildReplenishmentSnapshotMeta(snapshot, analysis);
    const quickFields = snapshotSections.quick_fields || {};
    const inputJson = snapshotSections.input_json || {};
    const summaryJson = snapshotSections.summary_json || {};
    const calculationJson = snapshotSections.calculation_json || {};
    const shippingJson = snapshotSections.shipping_json || {};
    const adjustmentJson = snapshotSections.adjustment_json || {};
    const coefficientJson = snapshotSections.coefficient_json || {};
    const inventoryJson = snapshotSections.inventory_json || {};
    const remarkJson = snapshotSections.remark_json || {};
    const uiSnapshotJson = snapshotSections.ui_snapshot_json || {};
    const fullSnapshotJson = snapshotSections.full_snapshot_json || {};
    const periodJson = inputJson.period || {};
    const cycleStartDate = pickFirst(
      snapshot.cycle_start_date,
      quickFields.cycle_start_date,
      periodJson.start_date,
      calculationJson.cycle?.start_date,
      analysis?.start_date
    );
    const cycleEndDate = pickFirst(
      snapshot.cycle_end_date,
      quickFields.cycle_end_date,
      periodJson.end_date,
      calculationJson.cycle?.end_date,
      analysis?.end_date
    );
    const cycleDays = toNumber(
      pickFirst(
        quickFields.total_days,
        periodJson.total_days,
        calculationJson.cycle?.total_days,
        analysis?.total_days
      )
    );
    const summaryCards = [
      {
        key: 'final_purchase_qty',
        label: '实际采购',
        value: toNumber(
          pickFirst(
            snapshot.final_purchase_qty,
            summaryJson.final_purchase_qty,
            calculationJson.final_purchase_qty
          )
        ),
      },
      {
        key: 'system_suggested_qty',
        label: '系统建议',
        value: toNumber(
          pickFirst(
            snapshot.system_suggested_qty,
            summaryJson.system_suggested_qty,
            calculationJson.system_suggested_qty
          )
        ),
      },
      {
        key: 'actual_before_box',
        label: '装箱前',
        value: toNumber(
          pickFirst(
            snapshot.actual_purchase_qty,
            calculationJson.actual_purchase_qty_before_box,
            calculationJson.actual_purchase_qty
          )
        ),
      },
      {
        key: 'daily_avg_sales',
        label: '当时基础日均',
        value: toNumber(
          pickFirst(
            snapshot.daily_avg_sales,
            quickFields.daily_avg_sales,
            calculationJson.daily_avg_sales,
            analysis?.base_daily_avg_sales
          )
        ),
      },
      {
        key: 'target_stock_days',
        label: '目标库存天数',
        value: toNumber(
          pickFirst(snapshot.target_stock_days, quickFields.target_stock_days)
        ),
      },
      {
        key: 'volatility_coefficient',
        label: '波动系数',
        value: toNumber(
          pickFirst(
            snapshot.volatility_coefficient,
            quickFields.volatility_coefficient,
            inputJson.volatility_coefficient,
            coefficientJson.volatility_coefficient,
            analysis?.volatility_coefficient
          )
        ),
      },
      {
        key: 'algorithm_name',
        label: '使用算法',
        value: pickFirst(
          snapshot.algorithm_name,
          quickFields.algorithm_name,
          inputJson.algorithm?.name,
          analysis?.user_selected_algo_name,
          '-'
        ),
      },
      {
        key: 'cycle_range',
        label: '销售周期',
        value: this.formatSnapshotDateRange(
          cycleStartDate,
          cycleEndDate,
          cycleDays
        ),
      },
      {
        key: 'warehouse_name',
        label: '仓库',
        value: pickFirst(
          snapshot.warehouse_name,
          quickFields.warehouse_name,
          inputJson.warehouse?.name,
          '-'
        ),
      },
      {
        key: 'manual_coefficient',
        label: '人工系数',
        value: pickFirst(
          coefficientJson.manual_coefficient,
          calculationJson.manual_coefficient,
          analysis?.artificial_coefficient,
          '-'
        ),
      },
      {
        key: 'box_pcs',
        label: '装箱数',
        value: toNumber(
          pickFirst(
            snapshot.box_pcs,
            calculationJson.box_adjustment?.box_pcs,
            calculationJson.box_pcs
          )
        ),
      },
    ];
    const formulaText = pickFirst(
      summaryJson.formula,
      calculationJson.actual_purchase_formula_text,
      calculationJson.system_formula_text,
      analysis?.formula,
      ''
    );
    const shippingSource = Array.isArray(shippingJson.segments)
        ? shippingJson.segments
        : Array.isArray(shippingJson.actual_shipping_breakdown)
          ? shippingJson.actual_shipping_breakdown
          : [];
    const shippingSegments = shippingSource.map((item: any, index: number) =>
      this.buildSnapshotShippingSegment(item, index)
    );
    const restoreCapability = buildReplenishmentRestoreCapability({
      snapshotMeta,
      sections: snapshotSections,
      shippingSegments,
    });
    const effectiveRestoreCapability = autoCompleteState.blocks_shipping
      ? {
          ...restoreCapability,
          restorable: false,
          label: '需处理',
          reason: autoCompleteState.auto_complete_warnings.join('；') || '自动补全当前业务上下文校验失败',
        }
      : restoreCapability;

    return {
      source: snapshotQuality.actionable ? 'full_snapshot' : 'legacy_snapshot',
      source_label: displaySourceLabel,
      trace_level: snapshotQuality.trace_level,
      snapshot_label: snapshotQuality.snapshot_label,
      snapshot_source_label: snapshotSourceLabel,
      ...autoCompleteState,
      actionable: snapshotQuality.actionable && !autoCompleteState.blocks_shipping,
      available_sections: snapshotQuality.available_sections,
      missing_sections: snapshotQuality.missing_sections,
      missing_section_labels: snapshotQuality.missing_section_labels,
      restore_capability: effectiveRestoreCapability,
      restorable: effectiveRestoreCapability.restorable,
      restore_label: effectiveRestoreCapability.label,
      analysis_record_id: snapshot.analysis_record_id || analysis?.id || null,
      plan_sn: snapshot.plan_sn || analysis?.plan_sn || '',
      snapshot_meta: snapshotMeta,
      summary_cards: summaryCards,
      demand_basis_rows: this.buildSnapshotDemandBasisRows(
        snapshot,
        calculationJson,
        inventoryJson
      ),
      formula_text: formulaText,
      formula_steps: this.splitFormulaSteps(formulaText),
      summary_text: pickFirst(summaryJson.summary, analysis?.summary, ''),
      shipping_segments: shippingSegments,
      deduction_rows: this.buildSnapshotDeductionRows(calculationJson),
      inventory_rows: this.buildSnapshotInventoryRows(inventoryJson),
      coefficient_rows: this.buildSnapshotCoefficientRows(coefficientJson),
      adjustment_log: Array.isArray(adjustmentJson.adjustment_log)
        ? adjustmentJson.adjustment_log
        : [],
      adjustment_summary: adjustmentJson.adjustment_summary || '',
      manual_remark: pickFirst(
        remarkJson.manual_replenish_remark,
        analysis?.manual_remark,
        ''
      ),
      raw_snapshot_sections: {
        quick_fields: quickFields,
        summary_json: summaryJson,
        input_json: inputJson,
        calculation_json: calculationJson,
        shipping_json: shippingJson,
        adjustment_json: adjustmentJson,
        coefficient_json: coefficientJson,
        inventory_json: inventoryJson,
        remark_json: remarkJson,
        ui_snapshot_json: uiSnapshotJson,
        full_snapshot_json: fullSnapshotJson,
      },
      raw_snapshot_available: true,
    };
  }

  private buildSnapshotCoefficientRows(coefficientJson: any) {
    const rows = Array.isArray(coefficientJson.five_month_rows)
      ? coefficientJson.five_month_rows
      : [];

    return rows.map((row: any, index: number) => {
      const rawText = this.formatSnapshotCoefficientText(
        pickFirst(
          row.rawCombinedCoeffText,
          row.rawCoefficientText,
          row.rawCoefficient,
          row.raw_coefficient,
          row.raw_combined_coefficient
        )
      );
      const volatilityText = this.formatSnapshotCoefficientText(
        pickFirst(
          row.volatilityCoefficientText,
          row.volatilityCoefficient,
          row.volatility_coefficient,
          coefficientJson.volatility_coefficient
        )
      );
      const adjustedText = this.formatSnapshotCoefficientText(
        pickFirst(
          row.combinedCoeffText,
          row.coeffText,
          row.adjustedCoefficientText,
          row.adjustedCoefficient,
          row.adjusted_coefficient,
          row.coefficient
        )
      );
      const dailyNeedText = this.formatSnapshotPlainText(
        pickFirst(row.dailyNeedText, row.daily_need_text, row.dailyNeed)
      );
      const subtotalText = this.formatSnapshotPlainText(
        pickFirst(row.subtotalText, row.subtotal_text, row.subtotalValue, row.subtotal)
      );
      const tooltipLines = this.normalizeSnapshotStringList(
        pickFirst(
          row.combinedTooltipLines,
          row.tooltipLines,
          row.formula_lines,
          row.tooltip_lines
        )
      );
      const formulaText = String(
        pickFirst(row.formulaText, row.tooltipText, row.reasonText, '') || ''
      ).trim();
      const chainText = this.buildCoefficientChainText(
        rawText,
        volatilityText,
        adjustedText,
        dailyNeedText,
        row.days,
        subtotalText
      );

      return {
        key: row.key || row.month || row.label || `coefficient_${index}`,
        label: row.label || row.month || '-',
        value: pickFirst(adjustedText, dailyNeedText, subtotalText, '-'),
        extra: formulaText || chainText,
        raw_coefficient_text: rawText,
        volatility_coefficient_text: volatilityText,
        adjusted_coefficient_text: adjustedText,
        daily_need_text: dailyNeedText,
        subtotal_text: subtotalText,
        formula_text: formulaText || chainText,
        tooltip_lines: tooltipLines.length ? tooltipLines : this.splitFormulaSteps(formulaText),
        coefficient_chain_text: chainText,
        source_text: row.sourceText || row.reasonText || '',
      };
    });
  }

  private buildSnapshotShippingSegment(item: any, index: number) {
    const parsedDemandRows = parseMaybeJson(item.demand_breakdown);
    const demandRows = Array.isArray(parsedDemandRows)
      ? parsedDemandRows
      : [];
    const rawCalcResult = parseMaybeJson(item.raw_calc_result);
    const monthlyCoefficients = parseMaybeJson(
      pickFirst(
        item.monthly_coefficients,
        item.monthlyCoefficients,
        rawCalcResult?.monthlyCoefficients,
        rawCalcResult?.monthly_coefficients
      )
    );
    const firstDemand = demandRows[0] || {};
    const startDate = pickFirst(item.start_date, item.startDate);
    const endDate = pickFirst(item.end_date, item.endDate);
    const days = toNumber(pickFirst(item.period_days, item.days));
    const quantity = toNumber(
      pickFirst(
        item.final_qty,
        item.actual_qty,
        item.quantity,
        item.system_suggested_qty
      )
    );
    const systemQuantity = toNumber(
      pickFirst(item.system_suggested_qty, item.original_suggested_qty)
    );
    const dailyNeed = toNumber(
      pickFirst(firstDemand.dailyNeed, firstDemand.suggestedDaily)
    );
    const rawCoefficient = toNullableNumber(
      pickFirst(
        firstDemand.rawCoefficient,
        firstDemand.raw_coefficient,
        firstDemand.rawCombinedCoefficient,
        firstDemand.raw_combined_coefficient
      )
    );
    const volatilityCoefficient = toNullableNumber(
      pickFirst(
        firstDemand.volatilityCoefficient,
        firstDemand.volatility_coefficient,
        item.volatility_coefficient
      )
    );
    const adjustedCoefficient = toNullableNumber(
      pickFirst(
        firstDemand.adjustedCoefficient,
        firstDemand.adjusted_coefficient,
        firstDemand.combined,
        firstDemand.coefficient
      )
    );
    const coefficient = toNumber(
      pickFirst(adjustedCoefficient, firstDemand.combined, firstDemand.coefficient)
    );
    const demandSubtotal = pickFirst(firstDemand.subtotal, item.expected_demand, quantity);
    const hasSegment = Boolean(
      startDate ||
        endDate ||
        days ||
        quantity ||
        systemQuantity ||
        dailyNeed ||
        coefficient ||
        demandRows.length
    );
    const rawShortageLabel = String(item.shortage_label || '').trim();
    const shortageLabel =
      hasSegment && rawShortageLabel && rawShortageLabel !== '已覆盖'
        ? rawShortageLabel
        : '';
    const statusText = !hasSegment
      ? '未参与本次测算'
      : shortageLabel
        ? `缺口 ${shortageLabel}`
        : '已覆盖';
    const periodLabel = hasSegment
      ? item.period_label || this.formatSnapshotDateRange(startDate, endDate, days)
      : '';

    return {
      key: item.method_key || item.shipping_method || `shipping_${index}`,
      method_key: item.method_key || item.shipping_method || `shipping_${index}`,
      shipping_method: item.shipping_method || item.method_key || `shipping_${index}`,
      label:
        item.method_label ||
        item.shipping_label ||
        item.method_key ||
        item.shipping_method ||
        '运输',
      quantity,
      system_quantity: systemQuantity,
      days,
      start_date: startDate || '',
      end_date: endDate || '',
      period_label: periodLabel,
      shortage_label: shortageLabel,
      status_text: statusText,
      has_segment: hasSegment,
      daily_need: dailyNeed,
      coefficient,
      raw_coefficient: rawCoefficient,
      volatility_coefficient: volatilityCoefficient,
      adjusted_coefficient: adjustedCoefficient,
      coefficient_chain_text: this.buildShippingCoefficientChainText(
        rawCoefficient,
        volatilityCoefficient,
        adjustedCoefficient,
        firstDemand.dailyAvg,
        dailyNeed,
        days,
        demandSubtotal
      ),
      alpha: pickFirst(firstDemand.alpha, item.alpha, item.manual_alpha, null),
      manual_alpha: pickFirst(item.manual_alpha, rawCalcResult?._manualAlpha, null),
      alpha_mode: pickFirst(item.alpha_mode, rawCalcResult?._alphaMode, ''),
      monthly_coefficients:
        monthlyCoefficients && typeof monthlyCoefficients === 'object'
          ? monthlyCoefficients
          : {},
      demand_breakdown: demandRows,
      raw_calc_result: rawCalcResult && typeof rawCalcResult === 'object' ? rawCalcResult : {},
      extra: periodLabel,
    };
  }

  private formatSnapshotCoefficientText(value: any) {
    if (!hasValue(value)) return '-';
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value).trim() || '-';
    return num.toFixed(2);
  }

  private formatSnapshotPlainText(value: any) {
    if (!hasValue(value)) return '-';
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value).trim() || '-';
    return Number.isInteger(num) ? String(num) : String(Number(num.toFixed(2)));
  }

  private normalizeSnapshotStringList(value: any) {
    if (Array.isArray(value)) {
      return value.map(item => String(item || '').trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
      const parsed = safeJsonParse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(item => String(item || '').trim()).filter(Boolean);
      }

      return value
        .split(/\r?\n/)
        .map(item => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  private buildCoefficientChainText(
    rawText: string,
    volatilityText: string,
    adjustedText: string,
    dailyNeedText = '-',
    days: any = '',
    subtotalText = '-'
  ) {
    const parts = [
      rawText !== '-' ? `原始系数 ${rawText}` : '',
      volatilityText !== '-' ? `波动系数 ${volatilityText}` : '',
      adjustedText !== '-' ? `最终系数 ${adjustedText}` : '',
    ].filter(Boolean);

    if (dailyNeedText !== '-' || subtotalText !== '-') {
      const demandText = [
        dailyNeedText !== '-' ? `日耗 ${dailyNeedText}` : '',
        hasValue(days) ? `${days}天` : '',
        subtotalText !== '-' ? `数量 ${subtotalText}` : '',
      ].filter(Boolean);
      if (demandText.length) parts.push(demandText.join(' / '));
    }

    return parts.join(' → ');
  }

  private buildShippingCoefficientChainText(
    rawCoefficient: number | null,
    volatilityCoefficient: number | null,
    adjustedCoefficient: number | null,
    dailyAvg: any,
    dailyNeed: any,
    days: any,
    subtotal: any
  ) {
    const rawText = this.formatSnapshotCoefficientText(rawCoefficient);
    const volatilityText = this.formatSnapshotCoefficientText(volatilityCoefficient);
    const adjustedText = this.formatSnapshotCoefficientText(adjustedCoefficient);
    const dailyNeedText = this.formatSnapshotPlainText(dailyNeed);
    const subtotalText = this.formatSnapshotPlainText(subtotal);
    const chainText = this.buildCoefficientChainText(
      rawText,
      volatilityText,
      adjustedText,
      dailyNeedText,
      days,
      subtotalText
    );

    if (!chainText || !hasValue(dailyAvg) || adjustedText === '-') return chainText;

    return `${chainText}；日均 ${this.formatSnapshotPlainText(
      dailyAvg
    )} × ${adjustedText} = 日耗 ${dailyNeedText}`;
  }

  private formatSnapshotDateRange(startDate: any, endDate: any, days = 0) {
    const normalizedStart = this.formatSnapshotDate(startDate);
    const normalizedEnd = this.formatSnapshotDate(endDate);
    if (!normalizedStart && !normalizedEnd) return '-';

    return `${normalizedStart || '-'} 至 ${normalizedEnd || '-'}${
      days ? ` (${days}天)` : ''
    }`;
  }

  private formatSnapshotDate(value: any) {
    if (!value) return '';
    const parsed = dayjs(value);
    if (parsed.isValid()) return parsed.format('YYYY-MM-DD');

    return String(value).replace('T', ' ').slice(0, 10);
  }

  private splitFormulaSteps(value: any) {
    const text = String(value || '').trim();
    if (!text) return [];

    return text
      .split(/[；;]\s*/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  private buildLegacyReplenishmentAnalysis(analysis: any) {
    return {
      source: 'legacy_compatible',
      source_label: '历史记录',
      trace_level: 'legacy_compatible',
      snapshot_label: '历史记录',
      actionable: false,
      available_sections: [],
      missing_sections: [],
      missing_section_labels: [],
      analysis_record_id: analysis.id || null,
      plan_sn: analysis.plan_sn || '',
      summary_cards: [
        { key: 'quantity_plan', label: '建议采购', value: toNumber(analysis.quantity_plan) },
        {
          key: 'daily_avg_sales',
          label: '基础日均',
          value: toNumber(analysis.base_daily_avg_sales),
        },
        {
          key: 'coefficient',
          label: '人工系数',
          value: pickFirst(analysis.artificial_coefficient, '-'),
        },
        {
          key: 'days',
          label: '销售天数',
          value: toNumber(analysis.total_days),
        },
      ],
      demand_basis_rows: [],
      formula_text: analysis.formula || '',
      formula_steps: this.splitFormulaSteps(analysis.formula || ''),
      summary_text: analysis.summary || '',
      shipping_segments: Array.isArray(analysis.shipping_breakdown_summary)
        ? analysis.shipping_breakdown_summary.map((item: any, index: number) => ({
            key: item.shipping_method || `shipping_${index}`,
            label: item.shipping_label || item.shipping_method || '运输',
            quantity: toNumber(item.quantity),
            days: toNumber(item.days),
            extra: item.segment_count ? `${item.segment_count} 段` : '',
          }))
        : [],
      deduction_rows: [],
      inventory_rows: [],
      coefficient_rows: [],
      adjustment_log: [],
      adjustment_summary: '',
      manual_remark: analysis.manual_remark || '',
      raw_snapshot_available: false,
    };
  }

  private buildSnapshotDeductionRows(calculationJson: any) {
    const deductions = calculationJson?.deductions || {};
    const rows = [
      ['purchase_plan_deducted_qty', '采购计划抵扣'],
      ['local_pending_delivery_deducted_qty', '艾为待交付抵扣'],
      ['lingxing_final_deducted_qty', '领星待交付抵扣'],
    ];

    return rows
      .map(([key, label]) => ({
        key,
        label,
        value: toNumber(
          pickFirst(deductions[key], calculationJson?.[key])
        ),
      }))
      .filter(row => row.value);
  }

  private buildSnapshotDemandBasisRows(
    snapshot: any,
    calculationJson: any,
    inventoryJson: any
  ) {
    const cycleDemandSource = pickFirst(
      calculationJson?.cycle?.demand_qty,
      calculationJson?.cycle_demand_qty,
      snapshot?.cycle_demand_qty
    );
    const cycleDemandQty = toNumber(
      cycleDemandSource
    );
    const fbaValidSource = pickFirst(
      inventoryJson?.fba_valid,
      calculationJson?.fba_valid
    );
    const fbaValid = toNumber(
      fbaValidSource
    );
    const inboundQtySource = pickFirst(
      inventoryJson?.inbound_qty,
      calculationJson?.inbound_qty
    );
    const inboundQty = toNumber(
      inboundQtySource
    );
    const computedTheoreticalReplenishmentQty =
      hasValue(cycleDemandSource) &&
      hasValue(fbaValidSource) &&
      hasValue(inboundQtySource)
        ? Math.max(cycleDemandQty - fbaValid - inboundQty, 0)
        : null;
    const theoreticalReplenishmentSource = pickFirst(
      calculationJson?.theoretical_replenishment_qty,
      computedTheoreticalReplenishmentQty
    );
    const theoreticalReplenishmentQty = toNumber(
      theoreticalReplenishmentSource
    );
    const systemSuggestedSource = pickFirst(
      snapshot?.system_suggested_qty,
      calculationJson?.system_suggested_qty
    );
    const systemSuggestedQty = toNumber(
      systemSuggestedSource
    );

    return [
      {
        key: 'cycle_demand_qty',
        label: '周期总需求',
        value: cycleDemandQty,
        source: cycleDemandSource,
      },
      {
        key: 'fba_valid',
        label: 'FBA库存',
        value: fbaValid,
        source: fbaValidSource,
      },
      {
        key: 'inbound_qty',
        label: '期内在途',
        value: inboundQty,
        source: inboundQtySource,
      },
      {
        key: 'theoretical_replenishment_qty',
        label: '理论可补',
        value: theoreticalReplenishmentQty,
        source: theoreticalReplenishmentSource,
      },
      {
        key: 'system_suggested_qty',
        label: '系统建议',
        value: systemSuggestedQty,
        source: systemSuggestedSource,
      },
    ]
      .filter(row => hasValue(row.source))
      .map(({ source, ...row }) => row);
  }

  private buildSnapshotInventoryRows(inventoryJson: any) {
    const rows = [
      ['fba_valid', 'FBA库存'],
      ['inbound_qty', '期内在途'],
      ['local_valid', '本地库存'],
      ['lingxing_pending_delivery.total', '领星待交付'],
    ];

    return rows
      .map(([path, label]) => {
        const value = path
          .split('.')
          .reduce((target: any, key: string) => target?.[key], inventoryJson);
        return {
          key: path,
          label,
          value: toNumber(value),
        };
      })
      .filter(row => row.value);
  }

  private buildPurchaseOrderFlowNodes(summary: any, details: any) {
    const analysisRecords = details.analysis_records || [];
    const purchasePlans = details.purchase_plans || [];
    const shipmentPlans = details.shipment_plans || [];
    const shipmentActuals = details.shipment_actuals || [];
    const adjustmentLogs = details.adjustment_logs || [];
    const purchaseOrder = details.purchase_order;
    const firstAnalysis = analysisRecords[0] || {};
    const firstPlan = purchasePlans[0] || {};
    const firstShipmentPlan = shipmentPlans[0] || {};
    const firstActual = shipmentActuals[0] || {};
    const latestAdjustmentLog = adjustmentLogs[0] || null;
    const fulfillmentStatus = String(summary.fulfillment_status || '');
    const analysisOperator = buildFlowOperator(
      pickFirst(
        firstAnalysis.purchase_plan_created_by_nickname,
        firstAnalysis.purchase_plan_created_by_username,
        firstAnalysis.plan_creator_name,
        firstPlan.creator_real_name,
        firstPlan.cg_opt_username,
        firstAnalysis.staged_by_nickname,
        firstAnalysis.staged_by_username
      ),
      analysisRecords.length > 0
    );
    const purchasePlanOperator = buildFlowOperator(
      pickFirst(
        firstAnalysis.purchase_plan_created_by_nickname,
        firstAnalysis.purchase_plan_created_by_username,
        firstPlan.creator_real_name,
        firstPlan.cg_opt_username
      ),
      purchasePlans.length > 0
    );
    const purchaseOrderOperator = buildFlowOperator(
      pickFirst(purchaseOrder?.opt_realname, purchaseOrder?.last_realname),
      Boolean(purchaseOrder)
    );
    const shipmentPlanOperator = buildFlowOperator(
      pickFirst(
        firstShipmentPlan.local_created_by_nickname,
        firstShipmentPlan.local_created_by_username,
        firstShipmentPlan.shipment_plan_create_user
      ),
      shipmentPlans.length > 0
    );
    const shipmentActualOperator = buildFlowOperator(
      firstActual.create_user || '',
      shipmentActuals.length > 0
    );
    const fulfillmentOperator = latestAdjustmentLog
      ? buildFlowOperator(
          pickFirst(
            latestAdjustmentLog.operator_nickname,
            latestAdjustmentLog.operator_username
          )
        )
      : {
          operator_name: '系统计算',
          operator_missing: false,
        };

    return [
      {
        key: 'analysis',
        label: '补货分析',
        status: analysisRecords.length ? 'done' : 'empty',
        count: analysisRecords.length,
        ...analysisOperator,
        time: pickFirst(
          firstAnalysis.purchase_plan_created_time,
          firstAnalysis.plan_create_time,
          firstPlan.create_time_remote,
          firstAnalysis.staged_time,
          firstAnalysis.create_time
        ),
      },
      {
        key: 'purchase_plan',
        label: '采购计划',
        status: purchasePlans.length ? 'done' : 'empty',
        count: purchasePlans.length,
        ...purchasePlanOperator,
        time: pickFirst(
          firstAnalysis.purchase_plan_created_time,
          firstPlan.create_time_remote
        ),
      },
      {
        key: 'purchase_order',
        label: '采购单',
        status: purchaseOrder ? 'done' : 'empty',
        count: purchaseOrder ? 1 : 0,
        ...purchaseOrderOperator,
        time: pickFirst(
          purchaseOrder?.order_time,
          purchaseOrder?.create_time_remote,
          purchaseOrder?.update_time_remote
        ),
      },
      {
        key: 'shipment_plan',
        label: '发货计划',
        status: shipmentPlans.length ? 'done' : 'empty',
        count: shipmentPlans.length,
        ...shipmentPlanOperator,
        time: pickFirst(
          firstShipmentPlan.local_created_time,
          firstShipmentPlan.shipment_plan_create_time
        ),
      },
      {
        key: 'shipment_actual',
        label: '实际发货',
        status: shipmentActuals.length
          ? 'done'
          : shipmentPlans.length
            ? 'pending'
            : 'empty',
        count: shipmentActuals.length,
        ...shipmentActualOperator,
        time: pickFirst(firstActual.shipment_time, firstActual.create_time_remote),
      },
      {
        key: 'fulfillment',
        label: '履约状态',
        status:
          ['exception_pending', 'logistics_exception'].includes(fulfillmentStatus)
            ? 'warning'
            : ['normal_completed', 'exception_completed'].includes(fulfillmentStatus)
              ? 'done'
              : fulfillmentStatus === 'shippable'
                ? 'pending'
                : 'empty',
        count: summary.actual_shippable_qty,
        ...fulfillmentOperator,
        time: latestAdjustmentLog?.createTime || summary.latest_event_time || null,
      },
    ];
  }

  private buildPurchaseOrderFlowEvents(summary: any, details: any) {
    const events: any[] = [];
    const pushEvent = (event: any) => {
      if (!event.time) return;
      events.push({
        source: '本系统',
        ref_sn: '',
        operator_name: '',
        description: '',
        ...event,
      });
    };

    for (const record of details.analysis_records || []) {
      pushEvent({
        time: pickFirst(
          record.purchase_plan_created_time,
          record.plan_create_time,
          record.staged_time,
          record.create_time
        ),
        type: 'analysis',
        title: '生成补货测算记录',
        operator_name: pickFirst(
          record.purchase_plan_created_by_nickname,
          record.purchase_plan_created_by_username,
          record.plan_creator_name,
          record.staged_by_nickname,
          record.staged_by_username
        ),
        ref_sn: record.plan_sn || '',
        description: `本地建议采购 ${record.quantity_plan || 0}，算法 ${
          record.user_selected_algo_name || '-'
        }，人工系数 ${record.artificial_coefficient || 0}`,
      });

      pushEvent({
        time: record.purchase_plan_created_time,
        type: 'purchase_plan_create',
        title: '本系统创建采购计划',
        operator_name: pickFirst(
          record.purchase_plan_created_by_nickname,
          record.purchase_plan_created_by_username
        ),
        ref_sn: record.plan_sn || '',
        description: `调用领星接口创建采购计划 ${record.plan_sn || '-'}`,
      });
    }

    for (const plan of details.purchase_plans || []) {
      pushEvent({
        time: plan.create_time_remote,
        type: 'purchase_plan_sync',
        title: '同步到领星采购计划',
        source: '领星同步',
        operator_name: pickFirst(plan.creator_real_name, plan.cg_opt_username),
        ref_sn: plan.plan_sn || '',
        description: `领星计划量 ${plan.quantity_plan || 0}，状态 ${plan.status_text || '-'}`,
      });
    }

    const purchaseOrder = details.purchase_order;
    if (purchaseOrder) {
      pushEvent({
        time: pickFirst(
          purchaseOrder.order_time,
          purchaseOrder.create_time_remote,
          purchaseOrder.update_time_remote
        ),
        type: 'purchase_order',
        title: '采购单同步',
        source: '领星同步',
        operator_name: pickFirst(
          purchaseOrder.opt_realname,
          purchaseOrder.last_realname
        ),
        ref_sn: purchaseOrder.order_sn || '',
        description: `状态 ${purchaseOrder.status_text || '-'}，采购实际 ${summary.quantity_real_sum || 0}，入库 ${summary.quantity_entry_sum || 0}`,
      });
    }

    for (const plan of details.shipment_plans || []) {
      pushEvent({
        time: pickFirst(plan.local_created_time, plan.shipment_plan_create_time),
        type: 'shipment_plan',
        title: plan.local_created_time ? '本系统创建发货计划' : '同步发货计划',
        source: plan.local_created_time ? '本系统' : '领星同步',
        operator_name: pickFirst(
          plan.local_created_by_nickname,
          plan.local_created_by_username,
          plan.shipment_plan_create_user
        ),
        ref_sn: plan.shipment_plan_sn || plan.seq || '',
        description: `计划发货 ${plan.shipment_plan_quantity || 0}，采购计划 ${plan.purchase_plan_sn || '-'}`,
      });
    }

    for (const actual of details.shipment_actuals || []) {
      pushEvent({
        time: pickFirst(actual.shipment_time, actual.create_time_remote),
        type: 'shipment_actual',
        title: '实际发货单同步',
        source: '领星同步',
        operator_name: actual.create_user || '',
        ref_sn: actual.shipment_sn || '',
        description: `实际发货 ${actual.shipment_list_quantity || 0}，状态 ${actual.shipment_status_name || '-'}`,
      });
    }

    for (const log of details.adjustment_logs || []) {
      pushEvent({
        time: log.createTime,
        type: 'adjustment',
        title: '履约调整',
        operator_name: pickFirst(log.operator_nickname, log.operator_username),
        ref_sn: details.purchase_order?.order_sn || '',
        description: log.remark || this.getFlowAdjustmentLogText(log),
      });
    }

    return events.sort((a, b) => getTimeMs(b.time) - getTimeMs(a.time));
  }

  private attachPurchaseFlowSummaryToProductViewList(list: any[]) {
    for (const row of list || []) {
      for (const plan of row?.plans || []) {
        for (const order of plan?.purchase_orders || []) {
          order.purchase_flow_summary =
            this.buildPurchaseFlowSummaryForProductView(plan, order);
        }
      }
    }
  }

  private buildPurchaseFlowSummaryForProductView(plan: any, order: any) {
    const local = plan?.local_record || {};
    const lingxing = plan?.lingxing || {};
    const shipmentSummary = order?.shipment_summary || {};
    const fulfillmentSummary = order?.fulfillment_summary || {};
    const adjustment = order?.fulfillment_adjustment || {};
    const latestLog = order?.fulfillment_latest_log || null;
    const shipmentPlans = Array.isArray(order?.shipment_plans)
      ? order.shipment_plans
      : [];
    const actualDetails = shipmentPlans.flatMap((shipmentPlan: any) =>
      Array.isArray(shipmentPlan?.actual_details)
        ? shipmentPlan.actual_details
        : []
    );
    const latestShipmentPlan = pickLatestRow(shipmentPlans, [
      'local_created_time',
      'create_time',
      'shipment_plan_create_time',
    ]);
    const latestActual = pickLatestRow(actualDetails, [
      'shipment_time',
      'create_time_remote',
    ]);
    const planQty = toNumber(
      pickFirst(
        local.quantity_plan,
        lingxing.quantity_plan,
        order?.quantity_plan_sum,
        0
      )
    );
    const algoName = pickFirst(
      local.raw_remark?.user_selected_algo_name,
      local.expected_sales?.user_selected_algo_name,
      local.breakdown?.[0]?.algo_used_name,
      local.breakdown?.[0]?.algorithm,
      '补货测算'
    );
    const coefficient = pickFirst(
      local.raw_remark?.artificial_coefficient,
      local.expected_sales?.artificial_coefficient,
      local.expected_sales?.manualCoefficient,
      '-'
    );
    const analysisOperator = buildFlowOperator(
      pickFirst(
        local.purchase_plan_created_by_nickname,
        local.purchase_plan_created_by_username,
        local.staged_by_nickname,
        local.staged_by_username,
        lingxing.creator_real_name,
        lingxing.cg_opt_username
      )
    );
    const planOperator = buildFlowOperator(
      pickFirst(
        local.purchase_plan_created_by_nickname,
        local.purchase_plan_created_by_username,
        lingxing.creator_real_name,
        lingxing.cg_opt_username,
        local.staged_by_nickname,
        local.staged_by_username
      )
    );
    const orderOperator = buildFlowOperator(
      pickFirst(order?.opt_realname, order?.last_realname, order?.auditor_realname)
    );
    const shipmentPlanOperator = buildFlowOperator(
      shipmentPlans.length
        ? pickFirst(
            latestShipmentPlan?.local_created_by_nickname,
            latestShipmentPlan?.local_created_by_username,
            latestShipmentPlan?.shipment_plan_create_user
          )
        : '',
      shipmentPlans.length > 0
    );
    const actualOperator = buildFlowOperator(
      actualDetails.length ? latestActual?.create_user : '',
      actualDetails.length > 0
    );
    const fulfillmentOperator = latestLog
      ? buildFlowOperator(
          pickFirst(latestLog.operator_nickname, latestLog.operator_username)
        )
      : {
          operator_name: '系统计算',
          operator_missing: false,
        };
    const exceptionQty =
      toNumber(adjustment.defective_qty) + toNumber(adjustment.short_shipped_qty);

    return {
      nodes: [
        {
          key: 'analysis',
          label: '补货分析',
          status: planQty > 0 ? 'done' : 'empty',
          time: pickFirst(
            local.purchase_plan_created_time,
            local.staged_time,
            local.create_time,
            lingxing.create_time_remote
          ),
          ...analysisOperator,
          main_text: `建议 ${flowNumber(planQty)}`,
          meta_text: `${algoName} / 系数${coefficient}`,
        },
        {
          key: 'purchase_plan',
          label: '采购计划',
          status: plan?.plan_sn ? 'done' : 'empty',
          time: pickFirst(
            local.purchase_plan_created_time,
            lingxing.create_time_remote,
            local.create_time
          ),
          ...planOperator,
          main_text: `计划 ${flowNumber(planQty)}`,
          meta_text: plan?.plan_sn || lingxing.status_text || '-',
        },
        {
          key: 'purchase_order',
          label: '采购单',
          status: order?.order_sn ? 'done' : 'empty',
          time: order?.purchase_order_time || null,
          ...orderOperator,
          main_text: `采购 ${flowNumber(order?.quantity_real_sum)} / 入库 ${flowNumber(order?.quantity_entry_sum)}`,
          meta_text: order?.purchase_order_status_text || order?.order_sn || '-',
        },
        {
          key: 'shipment_plan',
          label: '发货计划',
          status: shipmentPlans.length ? 'done' : 'empty',
          time: pickFirst(
            latestShipmentPlan?.local_created_time,
            latestShipmentPlan?.create_time,
            shipmentSummary.latest_plan_time
          ),
          ...shipmentPlanOperator,
          main_text: shipmentPlans.length
            ? `计划发货 ${flowNumber(shipmentSummary.shipment_plan_qty_sum)}`
            : '未安排',
          meta_text: shipmentPlans.length ? `${shipmentPlans.length}批` : '暂无发货计划',
        },
        {
          key: 'shipment_actual',
          label: '实际发货',
          status: actualDetails.length
            ? 'done'
            : shipmentPlans.length
              ? 'pending'
              : 'empty',
          time: pickFirst(
            latestActual?.shipment_time,
            latestActual?.create_time_remote,
            shipmentSummary.latest_actual_time
          ),
          ...actualOperator,
          main_text: actualDetails.length
            ? `实发 ${flowNumber(shipmentSummary.actual_shipment_qty_sum)}`
            : '暂无实发',
          meta_text: actualDetails.length
            ? `${shipmentSummary.actual_shipment_order_count || 0}单 / ${
                latestActual?.shipment_status_name || '-'
              }`
            : '-',
        },
        {
          key: 'fulfillment',
          label: '履约状态',
          status:
            fulfillmentSummary.fulfillment_group_status === 'abnormal'
              ? 'warning'
              : ['completed', 'exception_completed'].includes(
                    fulfillmentSummary.fulfillment_group_status
                  )
                ? 'done'
                : fulfillmentSummary.fulfillment_group_status === 'shippable'
                  ? 'pending'
                  : 'empty',
          time: pickFirst(
            latestLog?.createTime,
            adjustment.updateTime,
            shipmentSummary.latest_actual_time,
            shipmentSummary.latest_plan_time,
            order?.purchase_order_time
          ),
          ...fulfillmentOperator,
          main_text: `实际可发 ${flowNumber(fulfillmentSummary.actual_shippable_qty)}`,
          meta_text: `预计${flowNumber(
            fulfillmentSummary.estimated_shippable_qty
          )} / 异常${flowNumber(exceptionQty)}`,
        },
      ],
      edges: [
        { from: 'analysis', to: 'purchase_plan', label: '生成采购计划' },
        { from: 'purchase_plan', to: 'purchase_order', label: '同步采购单' },
        { from: 'purchase_order', to: 'shipment_plan', label: '创建发货计划' },
        { from: 'shipment_plan', to: 'shipment_actual', label: '同步实际发货' },
        { from: 'shipment_actual', to: 'fulfillment', label: '计算履约' },
      ],
    };
  }

  private getFlowAdjustmentLogText(log: any) {
    const actionMap: Record<string, string> = {
      create: '新增履约调整',
      update: '修改履约调整',
      process: '标记异常已处理',
      reopen: '重新打开异常',
      manual_complete: '标记人工完成',
      manual_reopen: '恢复可发',
      shelf: '标记搁置',
      unshelf: '恢复搁置',
    };
    const groupMap: Record<string, string> = {
      defective: '残次品',
      short_shipped: '商家少发',
      manual_completed: '人工完成',
      shelved: '搁置',
      general: '履约',
    };

    return `${actionMap[log?.action_type] || '履约调整'} / ${
      groupMap[log?.field_group] || log?.field_group || '-'
    }`;
  }

  private buildFilterSql(param: PageParam, authorizedSidList: number[] | null) {
    const where: string[] = [
      'ar.status = 1',
      'ar.plan_sn IS NOT NULL',
      "ar.plan_sn != ''",
    ];
    const params: any[] = [];

    if (authorizedSidList !== null) {
      where.push(
        `ar.store_id IN (${authorizedSidList.map(() => '?').join(',')})`
      );
      params.push(...authorizedSidList);
    }

    this.appendInFilter(where, params, 'ar.store_id', param.store_id);
    this.appendInFilter(where, params, 'ar.marketplace', param.marketplace);
    this.appendInFilter(where, params, 'l.seller_name', param.seller_name);
    this.appendInFilter(where, params, 'l.product_code', param.product_code);

    const keyWord = String(param.keyWord || '').trim();
    if (keyWord) {
      const like = `%${keyWord}%`;
      where.push(`(
                ar.asin LIKE ?
                OR ar.msku LIKE ?
                OR ar.local_sku LIKE ?
                OR ar.plan_sn LIKE ?
                OR l.local_sku LIKE ?
                OR l.fnsku LIKE ?
                OR l.product_code LIKE ?
                OR l.item_name LIKE ?
                OR l.seller_name LIKE ?
            )`);
      params.push(like, like, like, like, like, like, like, like, like);
    }

    return {
      sql: where.join(' AND '),
      params,
    };
  }

  private appendInFilter(
    where: string[],
    params: any[],
    field: string,
    value: QueryValue
  ) {
    if (value === undefined || value === null || value === '') return;

    const values = (Array.isArray(value) ? value : [value])
      .map(item => String(item).trim())
      .filter(Boolean);

    if (values.length === 0) return;

    where.push(`${field} IN (${values.map(() => '?').join(',')})`);
    params.push(...values);
  }

  private normalizePurchaseOrderStatusList(value: QueryValue) {
    const rawValues = Array.isArray(value) ? value : String(value || '').split(',');
    return rawValues
      .map(item => String(item ?? '').trim())
      .filter(Boolean)
      .map(item => Number(item))
      .filter(item => Number.isFinite(item));
  }

  private async countProductRows(whereSql: string, params: any[]) {
    const sql = `
            SELECT COUNT(*) AS total
            FROM (
                SELECT
                    ar.store_id,
                    ar.asin,
                    ar.marketplace,
                    ar.msku,
                    COALESCE(l.product_code, '') AS product_code
                FROM app_amz_bsr_analysis_record_lingxing ar
                LEFT JOIN app_amz_bsr_product_listing_lingxing l
                    ON l.store_id = ar.store_id
                    AND l.asin = ar.asin
                    AND l.marketplace = ar.marketplace
                    AND l.msku = ar.msku
                WHERE ${whereSql}
                GROUP BY
                    ar.store_id,
                    ar.asin,
                    ar.marketplace,
                    ar.msku,
                    COALESCE(l.product_code, '')
            ) t
        `;

    const rows = await this.analysisRecordEntity.manager.query(sql, params);
    return Number(rows?.[0]?.total) || 0;
  }

  private async queryProductRows(
    whereSql: string,
    params: any[],
    page: number,
    size: number
  ) {
    const offset = (page - 1) * size;
    const sql = `
            SELECT
                ar.store_id,
                ar.asin,
                ar.marketplace,
                ar.msku,
                ANY_VALUE(l.id) AS listing_id,
                ANY_VALUE(l.product_id) AS product_id,
                COALESCE(l.product_code, '') AS product_code,
                ANY_VALUE(l.image_url) AS image_url,
                ANY_VALUE(l.seller_name) AS seller_name,
                ANY_VALUE(l.shop) AS shop,
                ANY_VALUE(l.item_name) AS item_name,
                COALESCE(ANY_VALUE(l.local_sku), ANY_VALUE(ar.local_sku)) AS local_sku,
                ANY_VALUE(l.fnsku) AS fnsku,
                ANY_VALUE(l.listing_price) AS listing_price,
                ANY_VALUE(l.fba_fee) AS fba_fee,
                ANY_VALUE(l.currency_symbol) AS currency_symbol,
                ANY_VALUE(l.profit_rate) AS profit_rate,
                ANY_VALUE(l.profit) AS profit,
                ANY_VALUE(l.dailyAvgSales) AS dailyAvgSales,
                ANY_VALUE(l.stars) AS stars,
                ANY_VALUE(l.reviews_num) AS reviews_num,
                ANY_VALUE(l.sellableDays) AS sellableDays,
                ANY_VALUE(l.afn_fulfillable_quantity) AS afn_fulfillable_quantity,
                ANY_VALUE(l.reserved_fc_transfers) AS reserved_fc_transfers,
                ANY_VALUE(l.reserved_fc_processing) AS reserved_fc_processing,
                COUNT(DISTINCT ar.id) AS plan_count,
                SUM(COALESCE(ar.quantity_plan, 0)) AS total_quantity_plan,
                MAX(COALESCE(ar.purchase_plan_created_time, ar.staged_time, ar.\`updateTime\`, ar.\`createTime\`)) AS latest_plan_time
            FROM app_amz_bsr_analysis_record_lingxing ar
            LEFT JOIN app_amz_bsr_product_listing_lingxing l
                ON l.store_id = ar.store_id
                AND l.asin = ar.asin
                AND l.marketplace = ar.marketplace
                AND l.msku = ar.msku
            WHERE ${whereSql}
            GROUP BY
                ar.store_id,
                ar.asin,
                ar.marketplace,
                ar.msku,
                COALESCE(l.product_code, '')
            ORDER BY latest_plan_time DESC
            LIMIT ? OFFSET ?
        `;

    return this.analysisRecordEntity.manager.query(sql, [
      ...params,
      size,
      offset,
    ]);
  }

  private async queryAllProductRows(whereSql: string, params: any[]) {
    const sql = `
            SELECT
                ar.store_id,
                ar.asin,
                ar.marketplace,
                ar.msku,
                ANY_VALUE(l.id) AS listing_id,
                ANY_VALUE(l.product_id) AS product_id,
                COALESCE(l.product_code, '') AS product_code,
                ANY_VALUE(l.image_url) AS image_url,
                ANY_VALUE(l.seller_name) AS seller_name,
                ANY_VALUE(l.shop) AS shop,
                ANY_VALUE(l.item_name) AS item_name,
                COALESCE(ANY_VALUE(l.local_sku), ANY_VALUE(ar.local_sku)) AS local_sku,
                ANY_VALUE(l.fnsku) AS fnsku,
                ANY_VALUE(l.listing_price) AS listing_price,
                ANY_VALUE(l.fba_fee) AS fba_fee,
                ANY_VALUE(l.currency_symbol) AS currency_symbol,
                ANY_VALUE(l.profit_rate) AS profit_rate,
                ANY_VALUE(l.profit) AS profit,
                ANY_VALUE(l.dailyAvgSales) AS dailyAvgSales,
                ANY_VALUE(l.stars) AS stars,
                ANY_VALUE(l.reviews_num) AS reviews_num,
                ANY_VALUE(l.sellableDays) AS sellableDays,
                ANY_VALUE(l.afn_fulfillable_quantity) AS afn_fulfillable_quantity,
                ANY_VALUE(l.reserved_fc_transfers) AS reserved_fc_transfers,
                ANY_VALUE(l.reserved_fc_processing) AS reserved_fc_processing,
                COUNT(DISTINCT ar.id) AS plan_count,
                SUM(COALESCE(ar.quantity_plan, 0)) AS total_quantity_plan,
                MAX(COALESCE(ar.purchase_plan_created_time, ar.staged_time, ar.\`updateTime\`, ar.\`createTime\`)) AS latest_plan_time
            FROM app_amz_bsr_analysis_record_lingxing ar
            LEFT JOIN app_amz_bsr_product_listing_lingxing l
                ON l.store_id = ar.store_id
                AND l.asin = ar.asin
                AND l.marketplace = ar.marketplace
                AND l.msku = ar.msku
            WHERE ${whereSql}
            GROUP BY
                ar.store_id,
                ar.asin,
                ar.marketplace,
                ar.msku,
                COALESCE(l.product_code, '')
            ORDER BY latest_plan_time DESC
        `;

    return this.analysisRecordEntity.manager.query(sql, params);
  }

  private getProductMetricKey(row: any) {
    return `${row.asin}|${row.marketplace}|${row.store_id}|${row.msku || ''}`;
  }

  private getRestockingCacheKey(
    asin: any,
    marketplace: any,
    sellerName?: any
  ) {
    return `${asin || ''}__${marketplace || ''}__${String(
      sellerName || ''
    ).trim()}`;
  }

  private async queryRestockingMapForProductRows(productRows: any[]) {
    const result = new Map<string, any>();
    const uniqueMap = new Map<
      string,
      { asin: string; marketplace: string; sellerName?: string }
    >();

    for (const row of productRows || []) {
      if (!row?.asin || !row?.marketplace) continue;

      const item = {
        asin: row.asin,
        marketplace: row.marketplace,
        sellerName: row.seller_name
          ? String(row.seller_name).trim()
          : undefined,
      };
      uniqueMap.set(
        this.getRestockingCacheKey(item.asin, item.marketplace, item.sellerName),
        item
      );
    }

    const items = Array.from(uniqueMap.values());
    if (items.length === 0) return result;

    let restockingRows: any[] = [];
    try {
      restockingRows =
        (await this.restockingCenterService.getByAsinAndMarketplaceBatch(
          items
        )) || [];
    } catch {
      return result;
    }

    const restockingCache = new Map<string, any>();
    for (const entity of restockingRows) {
      const marketplaces = Array.isArray(entity?.marketplaceList)
        ? entity.marketplaceList
        : [];
      const stores =
        Array.isArray(entity?.storeList) && entity.storeList.length > 0
          ? entity.storeList
          : [''];

      if (!entity?.asin || marketplaces.length === 0) continue;

      for (const marketplace of marketplaces) {
        for (const storeName of stores) {
          restockingCache.set(
            this.getRestockingCacheKey(entity.asin, marketplace, storeName),
            entity
          );
        }
      }
    }

    for (const row of productRows || []) {
      const sellerName = row?.seller_name
        ? String(row.seller_name).trim()
        : '';
      const restocking =
        restockingCache.get(
          this.getRestockingCacheKey(row.asin, row.marketplace, sellerName)
        ) ||
        restockingCache.get(
          this.getRestockingCacheKey(row.asin, row.marketplace)
        );

      if (restocking) {
        result.set(this.getProductMetricKey(row), restocking);
      }
    }

    return result;
  }

  private async queryProductMetricExternalMaps(productRows: any[]) {
    const uniqueMap = new Map<
      string,
      { asin: string; marketplace: string; store_id: number; msku?: string }
    >();

    for (const row of productRows || []) {
      if (!row?.asin || !row?.marketplace || row?.store_id === undefined) {
        continue;
      }

      const item = {
        asin: row.asin,
        marketplace: row.marketplace,
        store_id: Number(row.store_id),
        msku: row.msku || '',
      };
      uniqueMap.set(this.getProductMetricKey(item), item);
    }

    const products = Array.from(uniqueMap.values());
    let pendingDeliveryMap: Record<string, any> = {};
    let purchasePlanMap: Record<string, any> = {};

    if (products.length === 0) {
      return { pendingDeliveryMap, purchasePlanMap };
    }

    try {
      pendingDeliveryMap =
        (await this.purchaseOrderSyncService.getPendingDeliveryByProducts({
          products,
        })) || {};
    } catch {
      pendingDeliveryMap = {};
    }

    try {
      purchasePlanMap =
        (await this.purchaseOrderSyncService.getPendingPurchasePlansByProducts({
          products,
        })) || {};
    } catch {
      purchasePlanMap = {};
    }

    return { pendingDeliveryMap, purchasePlanMap };
  }

  private buildProductMetrics(
    row: any,
    pendingDeliveryMap: Record<string, any>,
    purchasePlanMap: Record<string, any>
  ) {
    const restocking = row?.restocking || {};
    const salesInfo = safeJsonParse(restocking.salesInfo) || {};
    const fbaValidList = safeJsonParse(restocking.fbaValidList);
    const fbaShippingList = safeJsonParse(restocking.fbaShippingList);
    const suggestInfo = safeJsonParse(restocking.suggestInfo) || {};
    const extInfo = safeJsonParse(restocking.extInfo) || {};
    const scmQuantityInfo = safeJsonParse(restocking.scmQuantityInfo) || {};
    const stockQuantityInfo = safeJsonParse(restocking.stockQuantityInfo) || {};
    const amazonQuantityInfo = safeJsonParse(restocking.amazonQuantityInfo) || {};
    const hasSalesInfo = hasValue(restocking.salesInfo);
    const hasStockQuantityInfo = hasValue(restocking.stockQuantityInfo);
    const hasSuggestInfo = hasValue(restocking.suggestInfo);
    const hasAmazonQuantityInfo = hasValue(restocking.amazonQuantityInfo);

    const dailyAvgSales = this.calculateListingDailyAvg(row, salesInfo);
    const fbaQty = this.calculateFbaInventoryQuantity(row, fbaValidList);
    const fbaReservedQty = this.calculateFbaReservedQuantity(row, fbaValidList);
    const inTransitQty = this.calculateInTransitQuantity(row, fbaShippingList);
    const localQty = this.calculateLocalValidQuantity(
      row,
      extInfo,
      scmQuantityInfo
    );
    const metricKey = this.getProductMetricKey(row);
    const pendingDelivery = pendingDeliveryMap?.[metricKey] || {};
    const purchasePlan = purchasePlanMap?.[metricKey] || {};

    return {
      profit_rate:
        row.profit_rate === undefined || row.profit_rate === null
          ? null
          : Number(row.profit_rate),
      sales_avg_3: hasSalesInfo ? toNumber(salesInfo.salesAvg3) : null,
      sales_avg_7: hasSalesInfo ? toNumber(salesInfo.salesAvg7) : null,
      sales_avg_14: hasSalesInfo ? toNumber(salesInfo.salesAvg14) : null,
      sales_total_3: hasSalesInfo ? toNumber(salesInfo.salesTotal3) : null,
      sales_total_7: hasSalesInfo ? toNumber(salesInfo.salesTotal7) : null,
      sales_total_14: hasSalesInfo ? toNumber(salesInfo.salesTotal14) : null,
      realtime_sales: hasValue(restocking.realtimeSales)
        ? toNumber(restocking.realtimeSales)
        : null,
      recent_sales_trend_list:
        hasSalesInfo && Array.isArray(salesInfo.recentSalesTrendList)
          ? salesInfo.recentSalesTrendList
          : [],
      sellable_days_total:
        hasSuggestInfo && hasValue(suggestInfo.availableSaleDays)
          ? toNumber(suggestInfo.availableSaleDays)
          : dailyAvgSales > 0 ? Math.floor((fbaQty + inTransitQty) / dailyAvgSales) : 999,
      sellable_days_fba:
        hasSuggestInfo && hasValue(suggestInfo.availableSaleDaysFba)
          ? toNumber(suggestInfo.availableSaleDaysFba)
          : dailyAvgSales > 0 ? Math.floor(fbaQty / dailyAvgSales) : 999,
      daily_avg_sales: dailyAvgSales > 0 ? dailyAvgSales : null,
      fba_qty: fbaQty,
      fba_reserved_qty: fbaReservedQty,
      in_transit_qty: inTransitQty,
      local_qty: localQty,
      stock_total: hasStockQuantityInfo ? toNumber(stockQuantityInfo.stockTotal) : null,
      suggested_purchase_qty: hasSuggestInfo
        ? toNumber(suggestInfo.quantitySugPurchase)
        : null,
      estimated_shipping_qty: hasAmazonQuantityInfo
        ? toNumber(amazonQuantityInfo.amazonQuantityShippingPlan)
        : null,
      estimated_shipping_details: Array.isArray(extInfo.fbaShippingPlanDetailList)
        ? extInfo.fbaShippingPlanDetailList
        : [],
      out_stock_date: hasSuggestInfo ? suggestInfo.outStockDate || null : null,
      pending_delivery_qty: toNumber(pendingDelivery.pending_qty),
      pending_delivery_count: toNumber(pendingDelivery.pending_count),
      pending_delivery_details: Array.isArray(pendingDelivery.details)
        ? pendingDelivery.details
        : [],
      purchase_plan_qty: toNumber(purchasePlan.plan_qty),
      purchase_plan_count: toNumber(purchasePlan.plan_count),
      purchase_plan_details: Array.isArray(purchasePlan.details)
        ? purchasePlan.details
        : [],
    };
  }

  private calculateListingDailyAvg(row: any, salesInfo: any) {
    const value = Number(row?.dailyAvgSales);
    if (!Number.isNaN(value) && value > 0) return value;

    const avg3 = toNumber(salesInfo?.salesAvg3);
    const avg7 = toNumber(salesInfo?.salesAvg7);
    const avg14 = toNumber(salesInfo?.salesAvg14);
    let dailyAvgSales = 0;

    if (avg14 === 0) dailyAvgSales = 0;
    else if (avg7 === 0) dailyAvgSales = 0;
    else if (avg3 === 0) dailyAvgSales = avg7;
    else {
      const rate3To7 = avg7 > 0 ? (avg3 - avg7) / avg7 : 0;
      const rate3To14 = avg14 > 0 ? (avg3 - avg14) / avg14 : 0;

      if (rate3To7 < -0.66) {
        dailyAvgSales = (avg3 * 2 + avg7 * 0.8 + avg14 * 0.2) / 3;
      } else if (rate3To7 > 2) {
        dailyAvgSales = (avg3 * 2 + avg7 * 0.8 + avg14 * 0.2) / 3;
      } else if (rate3To14 > 1) {
        dailyAvgSales = (avg3 * 1.8 + avg7 * 0.8 + avg14 * 0.4) / 3;
      } else if (rate3To14 < -0.5) {
        dailyAvgSales = (avg3 * 1.8 + avg7 * 0.8 + avg14 * 0.4) / 3;
      } else if (rate3To14 > 0.5) {
        dailyAvgSales = (avg3 * 1.4 + avg7 + avg14 * 0.6) / 3;
      } else if (rate3To14 < -0.33) {
        dailyAvgSales = (avg3 * 1.4 + avg7 + avg14 * 0.6) / 3;
      } else {
        dailyAvgSales = (avg3 * 1.1 + avg7 * 1.1 + avg14 * 0.8) / 3;
      }
    }

    return Number(dailyAvgSales.toFixed(2));
  }

  private calculateFbaInventoryQuantity(row: any, fbaValidList: any) {
    if (Array.isArray(fbaValidList) && fbaValidList.length > 0) {
      const matchedList = getMatchedListByMsku(fbaValidList, row?.msku);

      if (matchedList.length > 0) {
        return matchedList.reduce(
          (sum: number, item: any) => sum + toNumber(item?.quantity),
          0
        );
      }
    }

    return toNumber(row?.afn_fulfillable_quantity);
  }

  private calculateFbaReservedQuantity(row: any, fbaValidList: any) {
    if (Array.isArray(fbaValidList) && fbaValidList.length > 0) {
      const matchedList = getMatchedListByMsku(fbaValidList, row?.msku);

      if (matchedList.length > 0) {
        return matchedList.reduce(
          (sum: number, item: any) =>
            sum + toNumber(item?.afnReservedQuantity),
          0
        );
      }
    }

    const directValue = row?.afnReservedQuantity ?? row?.afn_reserved_quantity;
    if (hasValue(directValue)) {
      return toNumber(directValue);
    }

    return (
      toNumber(row?.reserved_customerorders) +
      toNumber(row?.reserved_fc_processing) +
      toNumber(row?.reserved_fc_transfers)
    );
  }

  private calculateInTransitQuantity(row: any, fbaShippingList: any) {
    if (!Array.isArray(fbaShippingList)) return 0;

    return getMatchedListByMsku(fbaShippingList, row?.msku).reduce(
      (sum: number, item: any) => sum + toNumber(item?.quantity),
      0
    );
  }

  private calculateLocalValidQuantity(
    row: any,
    extInfo: any,
    scmQuantityInfo: any
  ) {
    const localValidDetailList = extInfo?.localValidDetailList;

    if (Array.isArray(localValidDetailList) && localValidDetailList.length > 0) {
      return getMatchedListByMsku(localValidDetailList, row?.msku, 'sku').reduce(
        (sum: number, item: any) =>
          sum + toNumber(item?.quantityValid) + toNumber(item?.quantityLocked),
        0
      );
    }

    return hasValue(scmQuantityInfo?.scQuantityLocalValid)
      ? toNumber(scmQuantityInfo.scQuantityLocalValid)
      : null;
  }

  private async queryPlansForProducts(products: any[]) {
    const conditions: string[] = [];
    const params: any[] = [];

    for (const product of products) {
      conditions.push(`(
                ar.store_id = ?
                AND ar.asin = ?
                AND ar.marketplace = ?
                AND COALESCE(ar.msku, '') = ?
                AND COALESCE(l.product_code, '') = ?
            )`);
      params.push(
        product.store_id,
        product.asin,
        product.marketplace,
        product.msku || '',
        product.product_code || ''
      );
    }

    const sql = `
            SELECT
                ar.id AS analysis_record_id,
                ar.store_id,
                ar.asin,
                ar.marketplace,
                ar.msku,
                COALESCE(l.product_code, '') AS product_code,
                ar.local_sku,
                ar.plan_sn,
                ar.ppg_sn AS local_ppg_sn,
                ar.quantity_plan AS local_quantity_plan,
                ar.status AS local_status,
                ar.expected_sales,
                ar.remark AS local_remark,
                ar.manual_remark,
                ar.staged_by_user_id,
                ar.staged_by_username,
                ar.staged_by_nickname,
                ar.staged_time,
                ar.purchase_plan_created_by_user_id,
                ar.purchase_plan_created_by_username,
                ar.purchase_plan_created_by_nickname,
                ar.purchase_plan_created_time,
                ar.\`createTime\` AS analysis_create_time,
                snap.target_stock_days AS snapshot_target_stock_days,
                snap.volatility_coefficient AS snapshot_volatility_coefficient
            FROM app_amz_bsr_analysis_record_lingxing ar
            LEFT JOIN app_amz_bsr_product_listing_lingxing l
                ON l.store_id = ar.store_id
                AND l.asin = ar.asin
                AND l.marketplace = ar.marketplace
                AND l.msku = ar.msku
            LEFT JOIN app_amz_bsr_batch_replenish_snapshot snap
                ON snap.analysis_record_id = ar.id
            WHERE ar.status = 1
                AND ar.plan_sn IS NOT NULL
                AND ar.plan_sn != ''
                AND (${conditions.join(' OR ')})
            ORDER BY COALESCE(ar.purchase_plan_created_time, ar.staged_time, ar.\`updateTime\`, ar.\`createTime\`) DESC, ar.id DESC
        `;

    const rows = await this.analysisRecordEntity.manager.query(sql, params);
    const purchasePlanMap = await this.queryPurchasePlanDetails(rows);
    const purchaseOrderMap = await this.queryPurchaseOrdersForAnalysisRows(
      rows
    );
    const purchaseOrderQuantityMap = this.buildPurchaseOrderQuantityMap(
      rows,
      purchaseOrderMap
    );
    const shipmentPlanMap = await this.queryShipmentPlansForAnalysisRows(
      rows,
      purchaseOrderQuantityMap
    );
    const map = new Map<string, any[]>();

    for (const row of rows) {
      const key = buildProductRowKey(row);
      const planDetail = purchasePlanMap.get(row.plan_sn) || {};
      const purchaseOrders =
        purchaseOrderMap.get(`analysis:${row.analysis_record_id}`) ||
        purchaseOrderMap.get(`plan:${row.plan_sn}`) ||
        this.createEmptyPurchaseOrderBundle();
      const shipmentPlans =
        shipmentPlanMap.get(`plan:${row.plan_sn}`) ||
        createEmptyShipmentPlanBundleForProductView();
      const purchaseOrderRows = purchaseOrders.orders.map((order: any) => {
        const orderKey = buildPurchaseOrderShipmentKey(
          row.plan_sn,
          order.order_sn
        );
        const orderShipmentBundle =
          shipmentPlanMap.get(orderKey) ||
          createEmptyPurchaseOrderShipmentBundleForProductView(order);

        return {
          ...order,
          shipment_summary: orderShipmentBundle.summary,
          shipment_plans: orderShipmentBundle.shipment_plans,
        };
      });
      const plan = parsePlanPayloadForProductView({
        ...row,
        ...planDetail,
        purchase_orders_summary: purchaseOrders.summary,
        purchase_orders: purchaseOrderRows,
        shipment_plans_summary: shipmentPlans.summary,
        shipment_plans: shipmentPlans.shipment_plans,
      });

      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)?.push(plan);
    }

    return map;
  }

  private buildPurchaseOrderQuantityMap(
    analysisRows: any[],
    purchaseOrderMap: Map<string, any>
  ) {
    const map = new Map<string, any>();

    for (const row of analysisRows) {
      const purchaseOrders =
        purchaseOrderMap.get(`analysis:${row.analysis_record_id}`) ||
        purchaseOrderMap.get(`plan:${row.plan_sn}`) ||
        this.createEmptyPurchaseOrderBundle();

      for (const order of purchaseOrders.orders || []) {
        if (!order?.order_sn) continue;
        map.set(buildPurchaseOrderShipmentKey(row.plan_sn, order.order_sn), order);
      }
    }

    return map;
  }

  private async queryShipmentPlansForAnalysisRows(
    analysisRows: any[],
    purchaseOrderQuantityMap = new Map<string, any>()
  ) {
    const planSns = Array.from(
      new Set(
        analysisRows
          .map(row => String(row.plan_sn || '').trim())
          .filter(Boolean)
      )
    );

    const map = new Map<string, any>();

    if (planSns.length === 0) {
      return map;
    }

    const sql = `
      SELECT
        sp.id AS shipment_plan_row_id,
        sp.isp_id,
        sp.seq,
        sp.order_sn AS shipment_plan_sn,
        sp.purchase_plan_sn,
        sp.purchase_order_sn,
        sp.sku,
        sp.msku,
        sp.fnsku,
        sp.product_name,
        sp.small_image_url,
        sp.shipment_plan_quantity,
        sp.shipping_method,
        sp.sname,
        sp.wname,
        sp.status AS shipment_plan_status,
        sp.status_name AS shipment_plan_status_name,
        sp.batch_remark,
        sp.remark,
        sp.create_user AS shipment_plan_create_user,
        sp.create_time_remote AS shipment_plan_create_time,
        sp.local_created_by_user_id,
        sp.local_created_by_username,
        sp.local_created_by_nickname,
        sp.local_created_time,
        sp.last_sync_time AS shipment_plan_last_sync_time,
        sa.id AS actual_row_id,
        sa.ispr_id,
        sa.seq AS actual_seq,
        sa.shipment_plan_sn AS actual_shipment_plan_sn,
        sa.shipment_sn,
        sa.shipment_list_quantity,
        sa.shipment_status,
        sa.shipment_status_name,
        sa.shipment_status_mws,
        sa.shipment_time,
        sa.create_user AS actual_create_user,
        sa.create_time_remote AS actual_create_time,
        sa.method_name,
        sa.logistics_channel_name,
        sa.wname AS actual_wname,
        sa.sku AS actual_sku,
        sa.msku AS actual_msku,
        sa.fnsku AS actual_fnsku,
        sa.product_name AS actual_product_name,
        sa.pic_url AS actual_pic_url,
        sa.asin AS actual_asin,
        sa.sname AS actual_sname,
        sa.sid AS actual_sid,
        sa.nation AS actual_nation,
        sa.expected_arrival_date,
        sa.is_final
      FROM app_amz_bsr_shipment_plan_lingxing sp
      LEFT JOIN app_amz_bsr_shipment_actual_lingxing sa
        ON sa.isp_id = sp.isp_id
      WHERE sp.purchase_plan_sn IN (${planSns.map(() => '?').join(',')})
        AND sp.purchase_plan_sn IS NOT NULL
        AND sp.purchase_plan_sn != ''
        AND sp.purchase_order_sn IS NOT NULL
        AND sp.purchase_order_sn != ''
      ORDER BY sp.purchase_plan_sn, sp.id DESC, sa.id DESC
    `;

    const rows = await this.analysisRecordEntity.manager.query(sql, planSns);
    const grouped = new Map<string, any[]>();

    for (const row of rows) {
      const planSn = String(row.purchase_plan_sn || '').trim();
      if (!planSn) continue;

      if (!grouped.has(planSn)) {
        grouped.set(planSn, []);
      }
      grouped.get(planSn)?.push(row);
    }

    grouped.forEach((groupRows, planSn) => {
      map.set(`plan:${planSn}`, buildShipmentPlanBundleForProductView(groupRows));
    });
    buildPurchaseOrderShipmentBundleForProductView(
      rows,
      purchaseOrderQuantityMap
    ).forEach((bundle, key) => {
      map.set(key, bundle);
    });

    return map;
  }

  private async queryPurchasePlanDetails(analysisRows: any[]) {
    const planSns = Array.from(
      new Set(analysisRows.map(row => row.plan_sn).filter(Boolean))
    );

    if (planSns.length === 0) {
      return new Map<string, any>();
    }

    const sql = `
            SELECT
                plan_sn,
                ppg_sn AS lingxing_ppg_sn,
                sku AS lingxing_sku,
                product_name AS lingxing_product_name,
                pic_url AS lingxing_pic_url,
                fnsku AS lingxing_fnsku,
                msku AS lingxing_msku,
                seller_name AS lingxing_seller_name,
                marketplace AS lingxing_marketplace,
                quantity_plan AS lingxing_quantity_plan,
                cg_box_pcs,
                status AS lingxing_status,
                status_text AS lingxing_status_text,
                create_time_remote,
                update_time_remote,
                expect_arrive_time,
                creator_real_name,
                cg_opt_username,
                purchaser_name,
                supplier_name,
                warehouse_name,
                plan_remark,
                remark AS purchase_remark
            FROM app_amz_bsr_purchase_plan_lingxing
            WHERE plan_sn IN (${planSns.map(() => '?').join(',')})
            ORDER BY sync_time DESC, \`updateTime\` DESC, id DESC
        `;

    const rows = await this.analysisRecordEntity.manager.query(sql, planSns);
    const map = new Map<string, any>();

    for (const row of rows) {
      if (!map.has(row.plan_sn)) {
        map.set(row.plan_sn, row);
      }
    }

    return map;
  }

  private createEmptyPurchaseOrderBundle() {
    return {
      summary: {
        order_count: 0,
        all_order_count: 0,
        linked_item_count: 0,
        all_linked_item_count: 0,
        quantity_plan_sum: 0,
        quantity_real_sum: 0,
        quantity_entry_sum: 0,
        quantity_receive_sum: 0,
        excluded_order_count: 0,
        completed_order_count: 0,
        void_order_count: 0,
        other_order_count: 0,
        latest_order_time: null,
        confirmed_count: 0,
        signed_count: 0,
        in_transit_count: 0,
        overtime_unsigned_count: 0,
        logistics_abnormal_count: 0,
        no_logistics_count: 0,
        logistics_tracked_order_count: 0,
        worst_logistics_status: '',
        worst_logistics_status_text: '',
      },
      orders: [],
    };
  }

  private async queryPurchaseOrdersForAnalysisRows(analysisRows: any[]) {
    const analysisIds = Array.from(
      new Set(
        analysisRows
          .map(row => Number(row.analysis_record_id))
          .filter(id => Number.isFinite(id) && id > 0)
      )
    );
    const planSns = Array.from(
      new Set(
        analysisRows
          .map(row => String(row.plan_sn || '').trim())
          .filter(Boolean)
      )
    );

    if (analysisIds.length === 0 && planSns.length === 0) {
      return new Map<string, any>();
    }

    const whereParts: string[] = [];
    const params: any[] = [];

    if (analysisIds.length > 0) {
      whereParts.push(
        `i.analysis_record_id IN (${analysisIds.map(() => '?').join(',')})`
      );
      params.push(...analysisIds);
    }

    if (planSns.length > 0) {
      whereParts.push(
        `(i.analysis_record_id IS NULL AND i.plan_sn IN (${planSns
          .map(() => '?')
          .join(',')}))`
      );
      params.push(...planSns);
      whereParts.push(
        `(${planSns
          .map(
            () =>
              'JSON_CONTAINS(COALESCE(i.relation_purchase_plan, JSON_ARRAY()), JSON_QUOTE(?))'
          )
          .join(' OR ')})`
      );
      params.push(...planSns);
    }

    const itemSql = `
      SELECT
        i.id AS order_item_id,
        i.analysis_record_id,
        i.plan_sn,
        i.relation_purchase_plan,
        i.order_sn,
        COALESCE(i.quantity_plan, 0) AS quantity_plan,
        COALESCE(i.quantity_real, 0) AS quantity_real,
        COALESCE(i.quantity_entry, 0) AS quantity_entry,
        COALESCE(i.quantity_receive, 0) AS quantity_receive
      FROM app_amz_bsr_purchase_order_item_sync_lingxing i
      WHERE ${whereParts.join(' OR ')}
      ORDER BY i.id DESC
    `;

    const itemRows = await this.analysisRecordEntity.manager.query(
      itemSql,
      params
    );
    const orderSns: string[] = Array.from(
      new Set<string>(
        itemRows
          .map((row: any) => String(row.order_sn || '').trim())
          .filter((orderSn: string) => Boolean(orderSn))
      )
    );

    const orderMap = await this.queryPurchaseOrderMap(orderSns);
    if (orderMap.size > 0) {
      for (const orderSn of orderMap.keys()) {
        try {
          await this.purchaseOrderLogisticsService.refreshPackagesFromOrder(orderSn);
        } catch (e: any) {
          console.error(`[purchase_plan_product_view] 刷新本地物流包裹失败 - ${orderSn}:`, e?.message || e);
        }
      }
      await this.purchaseOrderLogisticsService.attachStatusesToOrders([
        ...orderMap.values(),
      ]);
    }
    const grouped = new Map<string, Map<string, any>>();
    const planSnSet = new Set(planSns);

    for (const row of itemRows) {
      const orderSn = String(row.order_sn || '').trim();

      if (!orderSn) continue;

      const keys = uniqueTextList([
        row.analysis_record_id ? `analysis:${row.analysis_record_id}` : '',
        planSnSet.has(String(row.plan_sn || '').trim())
          ? `plan:${String(row.plan_sn || '').trim()}`
          : '',
        ...this.extractRelationPlanSns(row.relation_purchase_plan)
          .filter(planSn => planSnSet.has(planSn))
          .map(planSn => `plan:${planSn}`),
      ]);

      for (const key of keys) {
        if (!grouped.has(key)) {
          grouped.set(key, new Map<string, any>());
        }

        this.addPurchaseOrderFlowGroupedItem(
          grouped.get(key)!,
          row,
          orderSn,
          orderMap
        );
      }
    }

    const result = new Map<string, any>();
    const fallbackByPlan = new Map<string, any>();

    for (const row of analysisRows) {
      const analysisKey = `analysis:${row.analysis_record_id}`;
      const planKey = `plan:${row.plan_sn}`;
      const group =
        grouped.get(analysisKey) ||
        grouped.get(planKey) ||
        new Map<string, any>();
      const orders = Array.from(group.values()).sort((a: any, b: any) => {
        const timeA = a.purchase_order_time
          ? new Date(a.purchase_order_time).getTime()
          : 0;
        const timeB = b.purchase_order_time
          ? new Date(b.purchase_order_time).getTime()
          : 0;
        return (
          timeB - timeA || String(b.order_sn).localeCompare(String(a.order_sn))
        );
      });
      const bundle = this.buildPurchaseOrderBundle(orders);

      result.set(analysisKey, bundle);
      fallbackByPlan.set(planKey, bundle);
    }

    fallbackByPlan.forEach((value, key) => {
      if (!result.has(key)) {
        result.set(key, value);
      }
    });

    return result;
  }

  private addPurchaseOrderFlowGroupedItem(
    currentGroup: Map<string, any>,
    row: any,
    orderSn: string,
    orderMap: Map<string, any>
  ) {
    if (!currentGroup.has(orderSn)) {
      const order = orderMap.get(orderSn) || {};
      const isCalculatedOrder = this.isCalculatedPurchaseOrder(order);
      const logisticsStatus = this.extractPurchaseOrderLogisticsStatus(order);

      currentGroup.set(orderSn, {
        purchase_order_id: order.purchase_order_id || null,
        order_sn: orderSn,
        purchase_order_status:
          order.purchase_order_status !== undefined
            ? Number(order.purchase_order_status)
            : null,
        purchase_order_status_text: order.purchase_order_status_text || '',
        purchase_order_supplier_name:
          order.purchase_order_supplier_name || '',
        purchase_order_time:
          order.purchase_order_time || order.create_time_remote || null,
        opt_realname: order.opt_realname || '',
        auditor_realname: order.auditor_realname || '',
        last_realname: order.last_realname || '',
        item_count: 0,
        calculated_item_count: 0,
        quantity_plan_sum: 0,
        quantity_real_sum: 0,
        quantity_entry_sum: 0,
        quantity_receive_sum: 0,
        is_void_order: this.isVoidPurchaseOrder(order),
        is_calculated_order: isCalculatedOrder,
        calculation_excluded_reason: isCalculatedOrder
          ? ''
          : this.getPurchaseOrderCalculationExcludedReason(order),
        logistics_packages: order.logistics_packages || [],
        logistics_package_count: (order.logistics_packages || []).length,
        ...logisticsStatus,
      });
    }

    const target = currentGroup.get(orderSn)!;
    target.item_count += 1;
    target.quantity_plan_sum +=
      this.getEffectivePurchaseOrderItemPlanQuantity(row);
    target.quantity_real_sum += Number(row.quantity_real) || 0;
    target.quantity_entry_sum += Number(row.quantity_entry) || 0;
    target.quantity_receive_sum += Number(row.quantity_receive) || 0;

    if (target.is_calculated_order) {
      target.calculated_item_count += 1;
    }
  }

  private getEffectivePurchaseOrderItemPlanQuantity(row: any) {
    const planQty = Number(row?.quantity_plan) || 0;
    if (planQty > 0) return planQty;

    return Math.max(
      Number(row?.quantity_real) || 0,
      Number(row?.quantity_entry) || 0,
      Number(row?.quantity_receive) || 0
    );
  }

  private isVoidPurchaseOrder(order: any) {
    const status = Number(order?.purchase_order_status);
    const statusText = String(order?.purchase_order_status_text || '');

    return status === -1 || status === 124 || statusText.includes('作废');
  }

  private isCalculatedPurchaseOrder(order: any) {
    const status = Number(order?.purchase_order_status);
    return status === 2 || status === 9;
  }

  private getPurchaseOrderCalculationExcludedReason(order: any) {
    if (this.isVoidPurchaseOrder(order)) return '已作废，不计入汇总';

    const statusText = String(order?.purchase_order_status_text || '').trim();
    return statusText
      ? `${statusText}，不计入汇总`
      : '非待到货/已完成状态，不计入汇总';
  }

  private async queryPurchaseOrderMap(orderSns: string[]) {
    const map = new Map<string, any>();

    if (orderSns.length === 0) {
      return map;
    }

    const sql = `
      SELECT
        id AS purchase_order_id,
        order_sn,
        status AS purchase_order_status,
        status_text AS purchase_order_status_text,
        supplier_name AS purchase_order_supplier_name,
        order_time AS purchase_order_time,
        create_time_remote,
        opt_realname,
        auditor_realname,
        last_realname,
        logistics_confirmed,
        logistics_confirmed_time
      FROM app_amz_bsr_purchase_order_sync_lingxing
      WHERE order_sn IN (${orderSns.map(() => '?').join(',')})
    `;

    const rows = await this.analysisRecordEntity.manager.query(sql, orderSns);
    rows.forEach((row: any) => {
      map.set(row.order_sn, row);
    });

    return map;
  }

  private extractPurchaseOrderLogisticsStatus(order: any) {
    return {
      logistics_status: order?.logistics_status || '',
      logistics_status_text: order?.logistics_status_text || '',
      logistics_status_reason: order?.logistics_status_reason || '',
      logistics_pkg_count: Number(order?.logistics_pkg_count) || 0,
      logistics_signed_count: Number(order?.logistics_signed_count) || 0,
      logistics_last_sync_time: order?.logistics_last_sync_time || null,
    };
  }

  private buildPurchaseOrderBundle(orders: any[]) {
    const bundle = this.createEmptyPurchaseOrderBundle();
    const summary = bundle.summary;
    const severity: Record<string, number> = {
      confirmed: 1,
      signed: 2,
      partial_signed: 3,
      in_transit: 3,
      no_logistics: 4,
      overtime_unsigned: 5,
      partial_overtime_unsigned: 5,
      manual_required: 6,
      pending_mapping: 7,
      phone_required: 7,
      logistics_exception: 8,
      logistics_abnormal: 8,
    };
    let worstStatus = '';
    let worstScore = 0;

    orders.forEach((order: any) => {
      summary.all_order_count += 1;
      summary.all_linked_item_count += Number(order.item_count) || 0;

      if (!order.is_calculated_order) {
        summary.excluded_order_count += 1;
        if (order.is_void_order) {
          summary.void_order_count += 1;
        } else {
          summary.other_order_count += 1;
        }
        return;
      }

      summary.order_count += 1;
      summary.linked_item_count += Number(order.calculated_item_count) || 0;
      summary.quantity_plan_sum += Number(order.quantity_plan_sum) || 0;
      summary.quantity_real_sum += Number(order.quantity_real_sum) || 0;
      summary.quantity_entry_sum += Number(order.quantity_entry_sum) || 0;
      summary.quantity_receive_sum += Number(order.quantity_receive_sum) || 0;

      if (order.purchase_order_time) {
        const currentTime = new Date(order.purchase_order_time).getTime();
        const latestTime = summary.latest_order_time
          ? new Date(summary.latest_order_time).getTime()
          : 0;
        if (currentTime > latestTime) {
          summary.latest_order_time = order.purchase_order_time;
        }
      }

      if (Number(order.purchase_order_status) === 9) {
        summary.completed_order_count += 1;
      } else {
        summary.other_order_count += 1;
      }

      const logisticsStatus = String(order.logistics_status || '');
      if (logisticsStatus) {
        summary.logistics_tracked_order_count += 1;
      }

      switch (logisticsStatus) {
        case 'confirmed':
          summary.confirmed_count += 1;
          break;
        case 'signed':
          summary.signed_count += 1;
          break;
        case 'partial_signed':
          summary.in_transit_count += 1;
          break;
        case 'in_transit':
          summary.in_transit_count += 1;
          break;
        case 'overtime_unsigned':
        case 'partial_overtime_unsigned':
          summary.overtime_unsigned_count += 1;
          break;
        case 'logistics_exception':
        case 'pending_mapping':
        case 'phone_required':
        case 'manual_required':
        case 'logistics_abnormal':
          summary.logistics_abnormal_count += 1;
          break;
        case 'no_logistics':
          summary.no_logistics_count += 1;
          break;
      }

      const score = severity[logisticsStatus] || 0;
      if (score >= worstScore) {
        worstScore = score;
        worstStatus = logisticsStatus;
        summary.worst_logistics_status_text = order.logistics_status_text || '';
      }
    });

    summary.worst_logistics_status = worstStatus;
    bundle.orders = orders;

    return bundle;
  }

  private async getAuthorizedSidList(): Promise<number[] | null> {
    const userId = (this.baseCtx as any).admin?.userId;
    const username = (this.baseCtx as any).admin?.username;

    if (username === 'admin') return null;
    if (!userId) return [];

    const user = await this.userEntity.findOne({ where: { id: userId } });
    if (!Array.isArray(user?.sidList)) return [];

    return user.sidList
      .map(item => Number(item))
      .filter(item => Number.isFinite(item));
  }
}
