import { BaseService } from '@cool-midway/core';
import { Inject, Provide } from '@midwayjs/decorator';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { AppAmzBsrAnalysisRecordLingxingEntity } from '../entity/bsr_analysis_record_lingxing';
import { AppAmzBsrBatchReplenishSnapshotEntity } from '../entity/bsr_batch_replenish_snapshot';
import { AppAmzBsrProductListingLingxingEntity } from '../entity/bsr_product_Listing_Lingxing';
import { AppAmzBsrPurchaseOrderItemSyncLingxingEntity } from '../entity/bsr_purchase_order_item_sync_lingxing';
import { AppAmzBsrPurchaseOrderManualLinkShelfEntity } from '../entity/bsr_purchase_order_manual_link_shelf';
import { AppAmzBsrPurchaseOrderManualLinkShelfLogEntity } from '../entity/bsr_purchase_order_manual_link_shelf_log';
import { AppAmzBsrPurchaseOrderSyncLingxingEntity } from '../entity/bsr_purchase_order_sync_lingxing';
import { AppAmzBsrPurchasePlanLingxingEntity } from '../entity/bsr_purchase_plan_lingxing';
import { AppAnalysisCustomService } from './analysis_custom';

export type ManualLinkMatchStatus =
  | 'auto_item_first_msku'
  | 'auto_plan_local_sku'
  | 'auto_plan_msku'
  | 'manual_required'
  | 'blocked';

type ManualLinkWorkStatus = 'current' | 'shelved';

interface ManualLinkCandidateInput {
  has_plan_sn?: boolean;
  has_purchase_plan: boolean;
  item_candidate_listing_id?: number | string | null;
  plan_sku_candidate_listing_id?: number | string | null;
  plan_msku_candidate_listing_id?: number | string | null;
}

interface ManualHistoryPayloadInput {
  quantity_plan: number;
  cycle_start_date: string;
  cycle_end_date: string;
  expected_sales_qty: number;
  manual_remark: string;
}

export interface ManualReplenishmentShippingSegmentInput {
  method_key: string;
  method_label?: string;
  days_to_arrive?: number;
  active?: boolean;
  start_date?: string;
  end_date?: string;
  period_days?: number;
  system_suggested_qty?: number;
  purchase_plan_deducted_qty?: number;
  local_pending_delivery_deducted_qty?: number;
  final_qty?: number;
  coefficient?: number;
  raw_coefficient?: number;
  adjusted_coefficient?: number;
  manual_alpha?: number | null;
  alpha_mode?: string;
  monthly_coefficients?: any;
  formula?: string;
  calculation_trace?: any;
}

export interface ManualReplenishmentSnapshotDraftInput {
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
  shipping_segments?: ManualReplenishmentShippingSegmentInput[];
  inventory?: any;
  reconstruction_context?: any;
}

interface ManualReplenishmentSnapshotBuildInput {
  orderItem: any;
  purchaseOrder: any;
  purchasePlan: any;
  listing: any;
  draft: ManualReplenishmentSnapshotDraftInput;
  calendarCoefficients?: any;
  currentUser?: { userId: number | null; username: string; nickname: string };
  snapshotSource?: string;
  snapshotLabel?: string;
}

interface ManualLinkBaseQueryResult {
  sql: string;
  params: any[];
}

interface ManualLinkPageParam {
  page?: number;
  size?: number;
  keyWord?: string;
  keyword?: string;
  purchase_order_statuses?: any;
  statuses?: any;
  status_scope?: string;
  match_status?: ManualLinkMatchStatus | ManualLinkMatchStatus[];
  include_no_plan_blocked?: boolean;
  order_sn?: any;
  plan_sn?: any;
  seller_name?: any;
  marketplace?: any;
  store_id?: any;
  order_item_id?: any;
  work_status?: ManualLinkWorkStatus | string;
}

interface ManualLinkCompletedPageParam {
  page?: number;
  size?: number;
  keyWord?: string;
  keyword?: string;
  plan_sn?: any;
  order_sn?: any;
  marketplace?: any;
  store_id?: any;
  seller_name?: any;
  created_by_name?: any;
  created_by?: any;
}

interface PrepareFieldReference {
  key: string;
  label: string;
  value?: any;
  source: string;
  source_label?: string;
  table_name?: string;
  field_name?: string;
  source_record_id?: number | string | null;
  priority_trace?: any[];
  confidence: string;
  required: boolean;
  write_target: string;
  help_text: string;
  is_recommendation?: boolean;
}

interface PrepareSourceDetail {
  source_label: string;
  table_name?: string;
  field_name?: string;
  source_record_id?: number | string | null;
}

const DEFAULT_PURCHASE_ORDER_STATUSES = [2, 9];
const MANUAL_ALGO_NAME = '历史手动补全';
const MANUAL_SNAPSHOT_SOURCE = 'purchase_order_manual_link';
const MANUAL_SNAPSHOT_LABEL = '人工历史补全';
const DEFAULT_TARGET_STOCK_DAYS = 20;
const DEFAULT_VOLATILITY_COEFFICIENT = 0.75;
const DEFAULT_MANUAL_COEFFICIENT = 1;
const DEFAULT_SHIPPING_ADJUST_MODE = 'independent';
const DEFAULT_SHIPPING_BUFFER_DAYS = 5;
const DEFAULT_SHIPPING_METHODS = [
  { key: 'express', label: '快递', days: 5, color: '#FF6B9D', icon: '🚚' },
  { key: 'air', label: '空快', days: 8, color: '#409EFF', icon: '✈️' },
  { key: 'air_slow', label: '空慢', days: 10, color: '#67B8FF', icon: '✈️' },
  { key: 'truck', label: '卡车', days: 30, color: '#67C23A', icon: '🚛' },
  { key: 'rail', label: '铁路', days: 35, color: '#E6A23C', icon: '🚂' },
  { key: 'sea', label: '海运', days: 60, color: '#F56C6C', icon: '🚢' },
];
const DEFAULT_SHIPPING_METHOD_DAYS = Object.fromEntries(
  DEFAULT_SHIPPING_METHODS.map(method => [method.key, method.days])
);
const SHIPPING_PROFILES = {
  default: {
    key: 'default',
    label: '默认',
    methodDays: { ...DEFAULT_SHIPPING_METHOD_DAYS },
    selectedMethods: DEFAULT_SHIPPING_METHODS.map(method => method.key),
  },
  uk: {
    key: 'uk',
    label: '英国',
    methodDays: {
      express: 5,
      air: 9,
      air_slow: 14,
      truck: 28,
      sea: 52,
    },
    selectedMethods: ['express', 'air', 'air_slow', 'truck', 'sea'],
  },
  de: {
    key: 'de',
    label: '德国',
    methodDays: {
      express: 5,
      air: 16,
      air_slow: 20,
      truck: 30,
      sea: 56,
    },
    selectedMethods: ['express', 'air', 'air_slow', 'truck', 'sea'],
  },
} as const;
const ALGORITHM_OPTIONS = [
  { key: 'daily_avg', id: 1, label: '日均单量', engineKey: 'daily_avg', engineLabel: '日均单量' },
  { key: 'history', id: 2, label: '历史销量', engineKey: 'history', engineLabel: '历史销量' },
  { key: 'trend', id: 3, label: '搜索词趋势', engineKey: 'trend', engineLabel: '搜索词趋势' },
  { key: 'combined', id: 4, label: '综合走势', engineKey: 'combined', engineLabel: '综合走势' },
  { key: 'operator_intent', id: 4, label: '运营意向', engineKey: 'combined', engineLabel: '综合走势' },
];
const ALGORITHM_MAP = new Map(ALGORITHM_OPTIONS.map(item => [item.key, item]));
const SHIPPING_METHOD_MAP = new Map(DEFAULT_SHIPPING_METHODS.map(item => [item.key, item]));

function hasValue(value: any) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function normalizeText(value: any) {
  return String(value ?? '').trim();
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function round4(value: number) {
  return Math.round(value * 10000) / 10000;
}

function formatSnapshotNumber(value: any, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return num.toFixed(digits);
}

function formatSnapshotPlainNumber(value: any) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return Number.isInteger(num) ? String(num) : String(round2(num));
}

function normalizeDateOnly(value: any) {
  const text = normalizeText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) {
    throw new Error('日期格式必须为 YYYY-MM-DD');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error('日期不合法');
  }

  return text;
}

function diffDaysInclusive(startDate: string, endDate: string) {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  const diff = Math.floor((end - start) / 86400000) + 1;
  if (diff <= 0) {
    throw new Error('结束日期必须大于等于开始日期');
  }
  return diff;
}

function toMonthKey(dateText: string) {
  return normalizeText(dateText).slice(0, 7);
}

function addMonths(monthKey: string, months: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + months);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function getMonthDays(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function getMonthFirstDate(monthKey: string) {
  return `${monthKey}-01`;
}

function getMonthLastDate(monthKey: string) {
  return `${monthKey}-${String(getMonthDays(monthKey)).padStart(2, '0')}`;
}

function compareMonthKey(a: string, b: string) {
  return a.localeCompare(b);
}

function getMonthLabel(monthKey: string) {
  const month = Number(monthKey.slice(5, 7));
  return Number.isFinite(month) ? `${month}月` : monthKey;
}

function iterateMonths(startMonth: string, endMonth: string) {
  const months: string[] = [];
  let cursor = startMonth;
  while (cursor && compareMonthKey(cursor, endMonth) <= 0) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
    if (months.length > 36) break;
  }
  return months;
}

function buildManualSnapshotCalendarRange(startDate: string, endDate: string) {
  const fiveMonthStart = addMonths(toMonthKey(startDate), -1);
  const fiveMonthEnd = addMonths(fiveMonthStart, 4);
  const cycleEndMonth = toMonthKey(endDate);
  return {
    startMonth: fiveMonthStart,
    endMonth: compareMonthKey(fiveMonthEnd, cycleEndMonth) >= 0 ? fiveMonthEnd : cycleEndMonth,
  };
}

function splitDateRangeByMonth(startDate: string, endDate: string) {
  const startMonth = toMonthKey(startDate);
  const endMonth = toMonthKey(endDate);
  return iterateMonths(startMonth, endMonth)
    .map(month => {
      const partStart = month === startMonth ? startDate : getMonthFirstDate(month);
      const partEnd = month === endMonth ? endDate : getMonthLastDate(month);
      const days = diffDaysInclusive(partStart, partEnd);
      return { month, start_date: partStart, end_date: partEnd, days };
    })
    .filter(part => part.days > 0);
}

function buildFiveMonthParts(startDate: string) {
  const startMonth = addMonths(toMonthKey(startDate), -1);
  return Array.from({ length: 5 }).map((_, index) => {
    const month = addMonths(startMonth, index);
    return {
      month,
      start_date: getMonthFirstDate(month),
      end_date: getMonthLastDate(month),
      days: getMonthDays(month),
    };
  });
}

function positiveInteger(value: any, fieldName: string) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${fieldName}必须大于0`);
  }
  return Math.round(num);
}

function nonNegativeInteger(value: any, fieldName: string) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${fieldName}不能小于0`);
  }
  return Math.round(num);
}

function optionalNonNegativeInteger(value: any, fieldName: string) {
  if (!hasValue(value)) return null;
  return nonNegativeInteger(value, fieldName);
}

function resolveShippingBufferDays(value: any) {
  const normalized = optionalNonNegativeInteger(value, '缓冲天数');
  return normalized === null ? DEFAULT_SHIPPING_BUFFER_DAYS : normalized;
}

function positiveNumber(value: any, fieldName: string, fallback?: number) {
  const raw = hasValue(value) ? value : fallback;
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error(`${fieldName}必须大于0`);
  }
  return num;
}

function optionalPositiveInteger(value: any, fieldName: string) {
  if (!hasValue(value)) return null;
  return positiveInteger(value, fieldName);
}

function pickOptionalPositiveIntegerCandidate(...values: any[]) {
  for (const value of values) {
    if (!hasValue(value)) continue;
    const num = Number(value);
    if (!Number.isFinite(num)) return value;
    const rounded = Math.round(num);
    if (rounded > 0) return rounded;
  }
  return null;
}

function normalizeNullableText(value: any) {
  const text = normalizeText(value);
  return text || null;
}

function cloneJson(value: any) {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch (error: any) {
    return {
      _snapshot_error: 'JSON序列化失败',
      message: error?.message || String(error),
    };
  }
}

function pickFirst(...values: any[]) {
  for (const value of values) {
    if (hasValue(value)) return value;
  }
  return null;
}

function resolveAlgorithm(key: any) {
  const normalized = normalizeText(key) || 'daily_avg';
  const option = ALGORITHM_MAP.get(normalized);
  if (!option) {
    throw new Error('算法类型不合法');
  }
  return option;
}

function applyVolatilityToCoefficient(rawCoefficient: number, volatilityCoefficient: number) {
  return round2((rawCoefficient - 1) * volatilityCoefficient + 1);
}

function normalizeCoefficient(value: any, fallback = 1) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return num;
}

function resolveManualMonthCoefficient(input: {
  month: string;
  days: number;
  algorithm: { key: string; id: number; label: string; engineKey?: string; engineLabel?: string };
  dailyAvgSales: number;
  volatilityCoefficient: number;
  calendarCoefficients?: any;
}) {
  const calendarData = input.calendarCoefficients?.calendar_data || {};
  const monthSource = calendarData?.[input.month] || {};
  const algorithmKey = input.algorithm.engineKey || input.algorithm.key;
  let rawCoefficient = 1;
  let alpha: number | null = null;
  let filledSalesCoefficient: number | null = null;
  let keywordCoefficient: number | null = null;
  let sourceText = '中性兜底';
  let reasonText = '未获取到历史日历系数，按人工历史补全中性系数 1.00 记录。';
  let fallbackReason: string | null = 'missing_calendar_coefficients';
  let alphaSource = '';
  let alphaReason = '';
  let hasData = false;

  if (algorithmKey === 'daily_avg') {
    sourceText = '日均单量';
    reasonText = '日均单量算法固定系数为 1.00。';
    fallbackReason = null;
    hasData = true;
  } else if (algorithmKey === 'history') {
    const sales = monthSource?.sales || {};
    if (sales.status === 'ok' && Number.isFinite(Number(sales.coefficient))) {
      rawCoefficient = normalizeCoefficient(sales.coefficient, 1);
      sourceText = '历史销量';
      reasonText = `历史销量系数 ${formatSnapshotNumber(rawCoefficient)}，来源月份 ${sales.ref_month || '-'}`;
      fallbackReason = null;
      hasData = true;
    } else {
      reasonText = `历史销量缺失，按中性系数 1.00 记录。`;
    }
  } else if (algorithmKey === 'trend') {
    const keywords = monthSource?.keywords || {};
    if (keywords.status === 'ok' && Number.isFinite(Number(keywords.coefficient))) {
      rawCoefficient = normalizeCoefficient(keywords.coefficient, 1);
      sourceText = '搜索词趋势';
      reasonText = `搜索趋势系数 ${formatSnapshotNumber(rawCoefficient)}，来源月份 ${keywords.ref_month || '-'}`;
      fallbackReason = null;
      hasData = true;
    } else {
      reasonText = `搜索趋势缺失，按中性系数 1.00 记录。`;
    }
  } else if (algorithmKey === 'combined') {
    const combined = monthSource?.combined || {};
    if (combined && Number.isFinite(Number(combined.coefficient))) {
      rawCoefficient = normalizeCoefficient(combined.coefficient, 1);
      alpha = Number.isFinite(Number(combined.alpha)) ? Number(combined.alpha) : 0.7;
      filledSalesCoefficient = normalizeCoefficient(combined.filled_sales_coefficient, 1);
      keywordCoefficient = normalizeCoefficient(combined.keyword_coefficient, 1);
      alphaSource = normalizeText(combined.alpha_source);
      alphaReason = normalizeText(combined.alpha_reason);
      sourceText = '综合走势';
      reasonText = normalizeText(combined.alpha_reason_text) ||
        `综合走势原始系数 ${formatSnapshotNumber(rawCoefficient)}。`;
      fallbackReason = null;
      hasData = true;
    } else {
      alpha = 0.7;
      filledSalesCoefficient = 1;
      keywordCoefficient = 1;
      reasonText = '综合走势缺失，按销量系数 1.00、搜索系数 1.00、α 0.70 生成中性复盘。';
    }
  }

  const adjustedCoefficient =
    algorithmKey === 'daily_avg' ? 1 : applyVolatilityToCoefficient(rawCoefficient, input.volatilityCoefficient);
  const dailyNeed = round2(input.dailyAvgSales * adjustedCoefficient);
  const subtotal = Math.round(dailyNeed * input.days);
  const alphaText =
    algorithmKey === 'combined'
      ? formatSnapshotNumber(alpha ?? 0.7, 2)
      : algorithmKey === 'daily_avg'
        ? '日均'
        : '-';
  const formulaText =
    algorithmKey === 'combined'
      ? `${formatSnapshotNumber(alpha ?? 0.7)} × ${formatSnapshotNumber(filledSalesCoefficient ?? 1)} + ${formatSnapshotNumber(1 - (alpha ?? 0.7))} × ${formatSnapshotNumber(keywordCoefficient ?? 1)} = 原始 ${formatSnapshotNumber(rawCoefficient)} → 波动 ${formatSnapshotNumber(input.volatilityCoefficient)} → 最终 ${formatSnapshotNumber(adjustedCoefficient)}`
      : `原始 ${formatSnapshotNumber(rawCoefficient)} → 波动 ${formatSnapshotNumber(input.volatilityCoefficient)} → 最终 ${formatSnapshotNumber(adjustedCoefficient)}`;

  return {
    key: `manual-${input.month}`,
    month: input.month,
    monthKey: input.month,
    label: getMonthLabel(input.month),
    days: input.days,
    hasData,
    alphaText,
    reasonText,
    sourceText,
    formulaText,
    subtotalText: formatSnapshotPlainNumber(subtotal),
    dailyNeedText: formatSnapshotPlainNumber(dailyNeed),
    subtotalValue: subtotal,
    subtotal,
    dailyNeed,
    daily_need: dailyNeed,
    coefficient: adjustedCoefficient,
    raw_coefficient: rawCoefficient,
    rawCoefficient,
    adjusted_coefficient: adjustedCoefficient,
    adjustedCoefficient,
    rawCombinedCoeffText: formatSnapshotNumber(rawCoefficient),
    rawCoefficientText: formatSnapshotNumber(rawCoefficient),
    combinedCoeffText: formatSnapshotNumber(adjustedCoefficient),
    adjustedCoefficientText: formatSnapshotNumber(adjustedCoefficient),
    volatilityCoefficientText: formatSnapshotNumber(input.volatilityCoefficient),
    volatility_coefficient: input.volatilityCoefficient,
    algoUsed: input.algorithm.id,
    algo_used_name: input.algorithm.label,
    fallback_reason: fallbackReason,
    alpha,
    manual_alpha: alpha,
    system_alpha: alpha,
    alpha_source: alphaSource,
    alpha_reason: alphaReason,
    filled_sales_coefficient: filledSalesCoefficient,
    keyword_coefficient: keywordCoefficient,
    salesCoeffText: filledSalesCoefficient === null ? '-' : formatSnapshotNumber(filledSalesCoefficient),
    searchCoeffText: keywordCoefficient === null ? '-' : formatSnapshotNumber(keywordCoefficient),
    combinedTooltipLines: [
      reasonText,
      `日均 ${formatSnapshotPlainNumber(input.dailyAvgSales)} × 最终系数 ${formatSnapshotNumber(adjustedCoefficient)} × ${input.days}天 = ${formatSnapshotPlainNumber(subtotal)}`,
    ],
  };
}

function buildManualCoefficientRowsForParts(input: {
  parts: Array<{ month: string; start_date: string; end_date: string; days: number }>;
  algorithm: { key: string; id: number; label: string; engineKey?: string; engineLabel?: string };
  dailyAvgSales: number;
  volatilityCoefficient: number;
  calendarCoefficients?: any;
}) {
  return input.parts.map(part => ({
    ...resolveManualMonthCoefficient({
      month: part.month,
      days: part.days,
      algorithm: input.algorithm,
      dailyAvgSales: input.dailyAvgSales,
      volatilityCoefficient: input.volatilityCoefficient,
      calendarCoefficients: input.calendarCoefficients,
    }),
    startDate: part.start_date,
    endDate: part.end_date,
    start_date: part.start_date,
    end_date: part.end_date,
  }));
}

function buildManualMonthlyCoefficientMap(rows: any[]) {
  return Object.fromEntries(
    rows.map(row => [
      row.month,
      {
        month: row.month,
        days: row.days,
        coefficient: row.coefficient,
        raw_coefficient: row.raw_coefficient,
        adjusted_coefficient: row.adjusted_coefficient,
        volatility_coefficient: row.volatility_coefficient,
        alpha: row.alpha,
        manual_alpha: row.manual_alpha,
        system_alpha: row.system_alpha,
        filled_sales_coefficient: row.filled_sales_coefficient,
        keyword_coefficient: row.keyword_coefficient,
        fallback_reason: row.fallback_reason,
        reasonText: row.reasonText,
        sourceText: row.sourceText,
      },
    ])
  );
}

function buildManualSegmentAlphaDetail(row: any) {
  if (!row?.active) return null;
  const demandRows = Array.isArray(row.demand_breakdown) ? row.demand_breakdown : [];
  const totalDays = demandRows.reduce((sum, item) => sum + (Number(item.days) || 0), 0);
  const alphaValues = demandRows
    .map(item => Number(item.alpha ?? item.manual_alpha ?? item.system_alpha))
    .filter(value => Number.isFinite(value));
  const value = alphaValues.length
    ? round2(alphaValues.reduce((sum, value) => sum + value, 0) / alphaValues.length)
    : null;
  return {
    mode: row.alpha_mode || 'system',
    value,
    details: demandRows.map(item => ({
      days: item.days,
      alpha: item.alpha,
      month: item.month,
      source: item.alpha_source || item.sourceText || MANUAL_SNAPSHOT_SOURCE,
      isNoData: Boolean(item.fallback_reason),
      userAlpha: item.manual_alpha,
      reasonText: item.reasonText,
      userRemark: null,
      systemAlpha: item.system_alpha,
      displayAlpha: item.alphaText,
    })),
    allNoData: demandRows.every(item => Boolean(item.fallback_reason)),
    modeLabel: '系统',
    totalDays,
    valueText: value === null ? '日均' : formatSnapshotNumber(value),
    displayText: alphaValues.length ? alphaValues.map(item => formatSnapshotNumber(item)).join('|') : '日均',
    formulaText: demandRows
      .map(item => `${item.days}×${item.alphaText || formatSnapshotNumber(item.coefficient)}`)
      .join(' + '),
    hasUserAlpha: alphaValues.length > 0,
    nextModeLabel: '用户',
    uniqueRemarks: [],
  };
}

function resolveShippingProfile(key: any) {
  const normalized = normalizeText(key) || 'default';
  return (SHIPPING_PROFILES as any)[normalized] || SHIPPING_PROFILES.default;
}

function resolveShippingProfileByMarketplace(...values: any[]) {
  const text = values.map(value => normalizeText(value)).filter(Boolean).join(' ').toLowerCase();
  if (/英国|uk|united kingdom|gb|great britain/.test(text)) return SHIPPING_PROFILES.uk;
  if (/德国|de|germany|deutschland/.test(text)) return SHIPPING_PROFILES.de;
  return SHIPPING_PROFILES.default;
}

function buildManualLinkShippingProfiles() {
  return Object.values(SHIPPING_PROFILES).map(profile => ({
    key: profile.key,
    label: profile.label,
  }));
}

function buildManualLinkShippingOptions(profileKey: any = 'default') {
  const profile = resolveShippingProfile(profileKey);
  const selectedKeys = new Set(profile.selectedMethods);
  return DEFAULT_SHIPPING_METHODS
    .filter(item => selectedKeys.has(item.key))
    .map(item => ({
      ...item,
      days: profile.methodDays[item.key] ?? item.days,
    }));
}

function buildManualLinkAlgorithmOptions() {
  return ALGORITHM_OPTIONS.map(item => ({ ...item }));
}

function toDateOnlyLoose(value: any) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = normalizeText(value);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : '';
}

function diffLooseDays(startValue: any, endValue: any) {
  const startText = toDateOnlyLoose(startValue);
  const endText = toDateOnlyLoose(endValue);
  if (!startText || !endText) return 0;
  const [sy, sm, sd] = startText.split('-').map(Number);
  const [ey, em, ed] = endText.split('-').map(Number);
  const start = Date.UTC(sy, sm - 1, sd);
  const end = Date.UTC(ey, em - 1, ed);
  const diff = Math.floor((end - start) / 86400000);
  return Number.isFinite(diff) ? diff : 0;
}

function addLooseDays(dateValue: any, days: number) {
  const dateText = toDateOnlyLoose(dateValue);
  if (!dateText) return '';
  const [year, month, day] = dateText.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Math.round(Number(days) || 0));
  return date.toISOString().slice(0, 10);
}

function diffLooseDaysInclusive(startValue: any, endValue: any) {
  const diff = diffLooseDays(startValue, endValue);
  if (!toDateOnlyLoose(startValue) || !toDateOnlyLoose(endValue)) return 0;
  return Math.max(0, diff + 1);
}

function compactSourceValue(value: any) {
  if (!hasValue(value)) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().replace('T', ' ').slice(0, 19);
  }
  return normalizeText(value).replace('T', ' ').slice(0, 19);
}

function firstPositiveWithSource(items: Array<{ value: any; source: string; key?: string }>) {
  for (const item of items) {
    const value = Number(item.value);
    if (Number.isFinite(value) && value > 0) {
      return {
        value: Math.round(value),
        source: item.source,
        key: item.key || '',
      };
    }
  }
  return {
    value: 0,
    source: '',
    key: '',
  };
}

function firstNumberWithSource(items: Array<{ value: any; source: string; label: string }>) {
  for (const item of items) {
    const value = Number(item.value);
    if (Number.isFinite(value) && value > 0) {
      return {
        value,
        source: item.source,
        label: item.label,
      };
    }
  }
  return {
    value: null,
    source: '',
    label: '',
  };
}

function assertDateWithinCycle(date: string, startDate: string, endDate: string, fieldName: string) {
  if (date < startDate || date > endDate) {
    throw new Error(`${fieldName}必须在销售周期内`);
  }
}

function buildDateRangeText(startDate: string, endDate: string) {
  return `${startDate}~${endDate}`;
}

function normalizeArrayParam(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map(item => normalizeText(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => normalizeText(item))
      .filter(Boolean);
  }
  return hasValue(value) ? [normalizeText(value)] : [];
}

function normalizeManualLinkWorkStatus(value: any): ManualLinkWorkStatus {
  return normalizeText(value) === 'shelved' ? 'shelved' : 'current';
}

function normalizePositiveIntegerList(value: any) {
  const rawList = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      rawList
        .map(item => Number(item))
        .filter(item => Number.isFinite(item) && item > 0)
    )
  );
}

function createManualLinkShelfBatchId() {
  return `manual_link_shelf_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function selectedCandidateListingId(row: ManualLinkCandidateInput) {
  const classification = classifyManualLinkCandidate(row);
  if (classification.match_status === 'auto_item_first_msku') {
    return Number(row.item_candidate_listing_id) || null;
  }
  if (classification.match_status === 'auto_plan_local_sku') {
    return Number(row.plan_sku_candidate_listing_id) || null;
  }
  if (classification.match_status === 'auto_plan_msku') {
    return Number(row.plan_msku_candidate_listing_id) || null;
  }
  return null;
}

export function classifyManualLinkCandidate(input: ManualLinkCandidateInput): {
  match_status: ManualLinkMatchStatus;
  blocked_reason: string | null;
  suggested_listing_id: number | null;
} {
  if (input.has_plan_sn === false) {
    return {
      match_status: 'blocked',
      blocked_reason: '采购单明细缺少采购计划号',
      suggested_listing_id: null,
    };
  }

  if (!input.has_purchase_plan) {
    return {
      match_status: 'blocked',
      blocked_reason: '本地采购计划不存在',
      suggested_listing_id: null,
    };
  }

  if (Number(input.item_candidate_listing_id) > 0) {
    return {
      match_status: 'auto_item_first_msku',
      blocked_reason: null,
      suggested_listing_id: Number(input.item_candidate_listing_id),
    };
  }

  if (Number(input.plan_sku_candidate_listing_id) > 0) {
    return {
      match_status: 'auto_plan_local_sku',
      blocked_reason: null,
      suggested_listing_id: Number(input.plan_sku_candidate_listing_id),
    };
  }

  if (Number(input.plan_msku_candidate_listing_id) > 0) {
    return {
      match_status: 'auto_plan_msku',
      blocked_reason: null,
      suggested_listing_id: Number(input.plan_msku_candidate_listing_id),
    };
  }

  return {
    match_status: 'manual_required',
    blocked_reason: null,
    suggested_listing_id: null,
  };
}

export function buildManualHistoryAnalysisPayload(input: ManualHistoryPayloadInput) {
  const quantityPlan = positiveInteger(input.quantity_plan, '计划采购量');
  const expectedSalesQty = positiveInteger(input.expected_sales_qty, '预计销量');
  const startDate = normalizeDateOnly(input.cycle_start_date);
  const endDate = normalizeDateOnly(input.cycle_end_date);
  const totalDays = diffDaysInclusive(startDate, endDate);
  const remarkText = normalizeText(input.manual_remark);
  if (!remarkText) {
    throw new Error('人工备注不能为空');
  }

  const dailyAvg = round2(expectedSalesQty / totalDays);
  const payload = {
    source: 'purchase_order_manual_link',
    start_date: startDate,
    end_date: endDate,
    startDate,
    endDate,
    total_days: totalDays,
    days: totalDays,
    expected_sales_qty: expectedSalesQty,
    system_suggested_qty: expectedSalesQty,
    actual_purchase_qty: quantityPlan,
    final_replenishment_qty: quantityPlan,
    totalQty: quantityPlan,
    finalQty: quantityPlan,
    dailyAvg,
    base_daily_avg_sales: dailyAvg,
    user_selected_algo_id: 'manual_history_link',
    user_selected_algo_name: MANUAL_ALGO_NAME,
    remark_text: remarkText,
    summary: `${MANUAL_ALGO_NAME}: ${startDate} 至 ${endDate}, 预计销量 ${expectedSalesQty}, 采购量 ${quantityPlan}`,
    formula: `预计销量 ${expectedSalesQty} / ${totalDays} 天 = 日均 ${dailyAvg}; 最终采购量 ${quantityPlan}`,
    breakdown: [
      {
        label: MANUAL_ALGO_NAME,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        expected_sales_qty: expectedSalesQty,
        quantity_plan: quantityPlan,
        dailyAvg,
      },
    ],
  };

  return {
    expected_sales: payload,
    remark: JSON.stringify(payload),
    manual_remark: remarkText,
  };
}

export function buildManualReplenishmentSnapshotPayload(input: ManualReplenishmentSnapshotBuildInput) {
  const orderItem = input.orderItem || {};
  const purchaseOrder = input.purchaseOrder || {};
  const purchasePlan = input.purchasePlan || {};
  const listing = input.listing || {};
  const draft = input.draft || {};
  const currentUser = input.currentUser || { userId: null, username: '', nickname: '' };
  const snapshotSource = normalizeText(input.snapshotSource) || MANUAL_SNAPSHOT_SOURCE;
  const snapshotLabel = normalizeText(input.snapshotLabel) || MANUAL_SNAPSHOT_LABEL;
  const algorithm = resolveAlgorithm(draft.algorithm_key);
  const startDate = normalizeDateOnly(draft.cycle_start_date);
  const endDate = normalizeDateOnly(draft.cycle_end_date);
  const totalDays = diffDaysInclusive(startDate, endDate);
  const calendarCoefficients = input.calendarCoefficients || null;
  const dailyAvgSales = positiveNumber(draft.daily_avg_sales, '日均销量');
  const targetStockDays = positiveInteger(
    pickFirst(draft.target_stock_days, DEFAULT_TARGET_STOCK_DAYS),
    '目标库存天数'
  );
  const volatilityCoefficient = positiveNumber(
    draft.volatility_coefficient,
    '波动系数',
    DEFAULT_VOLATILITY_COEFFICIENT
  );
  const manualCoefficient = positiveNumber(
    draft.manual_coefficient,
    '人工系数',
    DEFAULT_MANUAL_COEFFICIENT
  );
  const finalPurchaseQty = positiveInteger(draft.final_purchase_qty, '最终采购量');
  const purchaseQtyLimit = firstPositiveWithSource([
    { value: orderItem.quantity_plan, source: '采购单明细', key: 'quantity_plan' },
    { value: orderItem.quantity_real, source: '采购单明细', key: 'quantity_real' },
    { value: purchasePlan.quantity_plan, source: '采购计划', key: 'quantity_plan' },
    { value: purchaseOrder.quantity_total, source: '采购单主表', key: 'quantity_total' },
    { value: purchaseOrder.quantity, source: '采购单主表', key: 'quantity' },
  ]);
  if (purchaseQtyLimit.value > 0 && finalPurchaseQty > purchaseQtyLimit.value) {
    throw new Error('最终采购量不能大于采购单数量');
  }
  const systemSuggestedQty = positiveInteger(
    pickFirst(draft.system_suggested_qty, finalPurchaseQty),
    '系统建议量'
  );
  const actualPurchaseQtyBeforeBox = positiveInteger(
    pickFirst(draft.actual_purchase_qty_before_box, finalPurchaseQty),
    '装箱前实际采购量'
  );
  const boxPcs = optionalPositiveInteger(draft.box_pcs, '装箱数');
  const manualRemark = normalizeText(draft.manual_remark);
  if (!manualRemark) {
    throw new Error('人工备注不能为空');
  }
  const draftProfile = draft.shipping_profile || {};
  const shippingBufferDays = resolveShippingBufferDays(draftProfile.buffer_days);
  const shippingProfile = resolveShippingProfile(
    draftProfile.profile_key ||
      resolveShippingProfileByMarketplace(
        purchasePlan.marketplace,
        listing.marketplace,
        orderItem.plan_marketplace
      ).key
  );
  const selectedShippingMethods = buildManualLinkShippingOptions(shippingProfile.key);

  const rawSegments = Array.isArray(draft.shipping_segments) ? draft.shipping_segments : [];
  if (!rawSegments.length) {
    throw new Error('至少需要一个运输分段');
  }

  const shippingRows = rawSegments.map((segment, index) => {
    const methodKey = normalizeText(segment.method_key);
    const method = SHIPPING_METHOD_MAP.get(methodKey);
    if (!method) {
      throw new Error(`运输方式不合法: ${methodKey || index + 1}`);
    }

    const active = segment.active !== false;
    const inactiveDaysToArrive = Number(segment.days_to_arrive);
    const daysToArrive = active
      ? optionalPositiveInteger(segment.days_to_arrive, `${method.label}运输天数`) || method.days
      : Number.isFinite(inactiveDaysToArrive) && inactiveDaysToArrive > 0
        ? Math.round(inactiveDaysToArrive)
        : method.days;
    if (!active) {
      const calculationTrace = cloneJson(segment.calculation_trace || null);
      return {
        method_key: method.key,
        method_label: normalizeText(segment.method_label) || method.label,
        icon: method.icon,
        color: method.color,
        days_to_arrive: daysToArrive,
        active: false,
        start_date: null,
        end_date: null,
        period_label: '',
        period_days: 0,
        manual_alpha: segment.manual_alpha ?? null,
        alpha_mode: normalizeText(segment.alpha_mode) || 'system',
        alpha_tooltip: cloneJson(segment.monthly_coefficients || null),
        system_suggested_qty: 0,
        purchase_plan_deducted_qty: 0,
        after_purchase_plan_qty: 0,
        local_pending_delivery_deducted_qty: 0,
        after_local_deductions_qty: 0,
        final_qty: 0,
        is_manual: false,
        is_redistributed: false,
        manual_snapshot: null,
        redistribution_effect: null,
        shortage_label: '',
        shortage_ranges: [],
        shortage_formula_rows: [],
        expected_demand: 0,
        covered_qty: 0,
        arrival_qty: 0,
        inbound_usage_qty: 0,
        final_covered: false,
        final_covered_text: '',
        demand_breakdown: [],
        monthly_coefficients: cloneJson(segment.monthly_coefficients || null),
        inventory_usage: null,
        inventory_usage_summary: null,
        inventory_usage_formula: '',
        inventory_usage_sources: null,
        pre_arrival_shortage: null,
        calculation_trace: calculationTrace,
        raw_calc_result: {
          active: false,
          algoUsed: algorithm.id,
          algo_used_name: algorithm.label,
          calculation_trace: calculationTrace,
        },
      };
    }

    const segStart = normalizeDateOnly(segment.start_date);
    const segEnd = normalizeDateOnly(segment.end_date);
    assertDateWithinCycle(segStart, startDate, endDate, `${method.label}开始日期`);
    assertDateWithinCycle(segEnd, startDate, endDate, `${method.label}结束日期`);
    const periodDays = diffDaysInclusive(segStart, segEnd);
    const finalQty = active ? positiveInteger(segment.final_qty, `${method.label}发货量`) : 0;
    const suggestedQty = nonNegativeInteger(
      pickFirst(segment.system_suggested_qty, finalQty),
      `${method.label}建议量`
    );
    const purchasePlanDeductedQty = nonNegativeInteger(
      pickFirst(segment.purchase_plan_deducted_qty, 0),
      `${method.label}采购计划抵扣`
    );
    const localPendingDeliveryDeductedQty = nonNegativeInteger(
      pickFirst(segment.local_pending_delivery_deducted_qty, 0),
      `${method.label}待交付抵扣`
    );
    const coefficient = positiveNumber(segment.coefficient, `${method.label}系数`, 1);
    const rawCoefficient = positiveNumber(segment.raw_coefficient, `${method.label}原始系数`, coefficient);
    const adjustedCoefficient = positiveNumber(
      segment.adjusted_coefficient,
      `${method.label}波动后系数`,
      coefficient
    );
    const calculationTrace = cloneJson(segment.calculation_trace || null);
    const segmentCoefficientRows = buildManualCoefficientRowsForParts({
      parts: splitDateRangeByMonth(segStart, segEnd),
      algorithm,
      dailyAvgSales,
      volatilityCoefficient,
      calendarCoefficients,
    });
    const monthlyCoefficients = buildManualMonthlyCoefficientMap(segmentCoefficientRows);
    const demandBreakdown = segmentCoefficientRows.map(row => ({
      ...row,
      shipping_method: method.key,
      shipping_label: normalizeText(segment.method_label) || method.label,
    }));
    const expectedDemand = demandBreakdown.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);

    return {
      method_key: method.key,
      method_label: normalizeText(segment.method_label) || method.label,
      icon: method.icon,
      color: method.color,
      days_to_arrive: daysToArrive,
      active,
      start_date: segStart,
      end_date: segEnd,
      period_label: buildDateRangeText(segStart, segEnd),
      period_days: Number(segment.period_days) > 0 ? Number(segment.period_days) : periodDays,
      manual_alpha: segment.manual_alpha ?? null,
      alpha_mode: normalizeText(segment.alpha_mode) || 'system',
      alpha_tooltip: cloneJson(monthlyCoefficients),
      system_suggested_qty: suggestedQty,
      purchase_plan_deducted_qty: purchasePlanDeductedQty,
      after_purchase_plan_qty: Math.max(0, suggestedQty - purchasePlanDeductedQty),
      local_pending_delivery_deducted_qty: localPendingDeliveryDeductedQty,
      after_local_deductions_qty: Math.max(
        0,
        suggestedQty - purchasePlanDeductedQty - localPendingDeliveryDeductedQty
      ),
      final_qty: finalQty,
      is_manual: true,
      is_redistributed: false,
      manual_snapshot: null,
      redistribution_effect: null,
      shortage_label: `${segStart}~${segEnd}`,
      shortage_ranges: [],
      shortage_formula_rows: [],
      expected_demand: expectedDemand,
      covered_qty: 0,
      arrival_qty: 0,
      inbound_usage_qty: 0,
      final_covered: false,
      final_covered_text: '',
      demand_breakdown: demandBreakdown,
      monthly_coefficients: cloneJson(monthlyCoefficients),
      inventory_usage: null,
      inventory_usage_summary: null,
      inventory_usage_formula: '',
      inventory_usage_sources: null,
      pre_arrival_shortage: null,
      calculation_trace: calculationTrace,
      raw_calc_result: {
        startDate: segStart,
        endDate: segEnd,
        days: periodDays,
        coefficient: adjustedCoefficient,
        raw_coefficient: rawCoefficient,
        adjusted_coefficient: adjustedCoefficient,
        volatility_coefficient: volatilityCoefficient,
        dailyNeed: demandBreakdown[0]?.dailyNeed ?? round2(dailyAvgSales * adjustedCoefficient),
        subtotal: expectedDemand,
        algoUsed: algorithm.id,
        algo_used_name: algorithm.label,
        monthlyCoefficients,
        monthly_coefficients: monthlyCoefficients,
        demand_breakdown: demandBreakdown,
        manual_formula: normalizeText(segment.formula),
        calculation_trace: calculationTrace,
      },
    };
  });

  const activeShippingRows = shippingRows.filter(row => row.active);
  const shippingTotalQty = activeShippingRows.reduce((sum, row) => sum + row.final_qty, 0);
  if (activeShippingRows.length === 0) {
    throw new Error('至少需要启用一个运输分段');
  }
  if (shippingTotalQty !== finalPurchaseQty) {
    throw new Error('启用运输分段数量合计必须等于最终采购量');
  }

  const breakdown = activeShippingRows.flatMap(row =>
    (row.demand_breakdown || []).map((item: any) => ({
      ...item,
      startDate: item.startDate,
      endDate: item.endDate,
      start_date: item.startDate,
      end_date: item.endDate,
      days: item.days,
      shipping_method: row.method_key,
      shipping_label: row.method_label,
    }))
  );
  const fiveMonthRows = buildManualCoefficientRowsForParts({
    parts: buildFiveMonthParts(startDate),
    algorithm,
    dailyAvgSales,
    volatilityCoefficient,
    calendarCoefficients,
  }).map((row, index) => ({
    ...row,
    key: `five-manual-${index}-${row.month}`,
    isCurrentMonth: row.month === toMonthKey(new Date().toISOString().slice(0, 10)),
  }));
  const windowCalculationRows = buildManualCoefficientRowsForParts({
    parts: splitDateRangeByMonth(startDate, endDate),
    algorithm,
    dailyAvgSales,
    volatilityCoefficient,
    calendarCoefficients,
  }).map(row => ({
    days: row.days,
    month: row.month,
    algoUsed: algorithm.id,
    subtotal: row.subtotal,
    monthName: `${row.month.slice(0, 4)}年${Number(row.month.slice(5, 7))}月`,
    coefficient: row.coefficient,
    daily_sales: row.dailyNeed,
    algo_used_name: algorithm.label,
    fallback_reason: row.fallback_reason,
    raw_coefficient: row.raw_coefficient,
    adjusted_coefficient: row.adjusted_coefficient,
    volatility_coefficient: row.volatility_coefficient,
    alpha: row.alpha,
    filled_sales_coefficient: row.filled_sales_coefficient,
    keyword_coefficient: row.keyword_coefficient,
    reasonText: row.reasonText,
  }));
  const windowCalculation = {
    algorithm_key: algorithm.key,
    algorithm_name: algorithm.label,
    engine_key: algorithm.engineKey || algorithm.key,
    engine_name: algorithm.engineLabel || algorithm.label,
    rows: cloneJson(windowCalculationRows),
    segments: cloneJson(windowCalculationRows),
    base_month: calendarCoefficients?.base_month || '',
    total_window_qty: windowCalculationRows.reduce((sum, row) => sum + (Number(row.subtotal) || 0), 0),
    source: calendarCoefficients?.calendar_data ? 'analysis_calendar_coefficients' : snapshotSource,
    summary: calendarCoefficients?.calendar_data
      ? `${snapshotLabel}已按日历系数生成系数复盘`
      : `${snapshotLabel}未获取到日历系数，按中性系数生成可追溯复盘`,
  };
  const actualShippingBreakdown = activeShippingRows.map(row => ({
    shipping_method: row.method_key,
    shipping_label: row.method_label,
    original_suggested_qty: row.system_suggested_qty,
    purchase_plan_deducted_qty: row.purchase_plan_deducted_qty,
    local_pending_delivery_deducted_qty: row.local_pending_delivery_deducted_qty,
    actual_qty: row.final_qty,
  }));
  const manualShippingQuantities = Object.fromEntries(
    activeShippingRows.map(row => [row.method_key, row.final_qty])
  );
  const dailyAvgByFinalQty = totalDays > 0 ? round2(finalPurchaseQty / totalDays) : 0;
  const warehouseWid = draft.warehouse_resolution_locked
    ? Number(draft.warehouse_wid) || null
    : Number(pickFirst(draft.warehouse_wid, purchasePlan.wid, orderItem.wid)) || null;
  const warehouseName = draft.warehouse_resolution_locked
    ? normalizeText(draft.warehouse_name)
    : normalizeText(pickFirst(draft.warehouse_name, purchasePlan.warehouse_name, orderItem.ware_house_name)) || '';
  const productName =
    normalizeText(pickFirst(listing.item_name, listing.local_name, purchasePlan.product_name, orderItem.product_name)) ||
    '';
  const imageUrl = normalizeText(pickFirst(listing.image_url, purchasePlan.pic_url, orderItem.plan_pic_url));
  const shop = normalizeText(pickFirst(listing.shop, listing.seller_name, purchasePlan.seller_name));
  const formula =
    `系统建议 ${systemSuggestedQty}；装箱前实际采购 ${actualPurchaseQtyBeforeBox} × 人工系数 ${round2(
      manualCoefficient
    )}；运输分段 ${activeShippingRows
      .map(row => `${row.method_label}${row.final_qty}`)
      .join(' + ')} = 最终采购量 ${finalPurchaseQty}`;
  const summary = `采购 ${finalPurchaseQty} 个，销售时间 ${startDate} 至 ${endDate}，计划日均 ${dailyAvgByFinalQty} 单`;
  const segmentText = activeShippingRows
    .map(row => `${row.method_label}${row.days_to_arrive}天${row.final_qty}件`)
    .join(' | ');
  const remarkText = [
    `${startDate}至${endDate}(${totalDays}天)`,
    `基础日均${round2(dailyAvgSales)}`,
    `波动系数${round2(volatilityCoefficient)}`,
    `人工系数${round2(manualCoefficient)}`,
    segmentText,
    `实际采购${finalPurchaseQty}件`,
    boxPcs ? `装箱${boxPcs}` : '未设置装箱数',
    manualRemark,
  ]
    .filter(Boolean)
    .join(' | ');

  const expectedSales = {
    version: 6,
    source: snapshotSource,
    source_label: snapshotLabel,
    remark_text: remarkText,
    summary,
    formula,
    algorithm_suggested_qty: systemSuggestedQty,
    system_suggested_qty: systemSuggestedQty,
    manual_adjust_delta: systemSuggestedQty - finalPurchaseQty,
    pending_delivery_qty: 0,
    local_pending_delivery_qty: 0,
    lingxing_pending_delivery_qty: 0,
    purchase_plan_qty: 0,
    total_purchase_plan_qty: 0,
    local_purchase_plan_qty: 0,
    lingxing_purchase_plan_qty: 0,
    purchase_plan_deducted_qty: 0,
    purchase_plan_excess_qty: 0,
    local_pending_delivery_deducted_qty: 0,
    local_pending_delivery_excess_qty: 0,
    after_purchase_plan_qty: systemSuggestedQty,
    after_local_deductions_qty: systemSuggestedQty,
    lingxing_final_deducted_qty: 0,
    lingxing_final_excess_qty: 0,
    actual_purchase_raw_qty: actualPurchaseQtyBeforeBox,
    actual_purchase_base_qty: actualPurchaseQtyBeforeBox,
    actual_purchase_qty_before_box: actualPurchaseQtyBeforeBox,
    actual_purchase_qty: finalPurchaseQty,
    box_pcs: boxPcs,
    box_count: boxPcs ? Math.ceil(finalPurchaseQty / boxPcs) : null,
    box_adjusted_purchase_qty: finalPurchaseQty,
    box_adjustment_delta: finalPurchaseQty - actualPurchaseQtyBeforeBox,
    box_adjustment_formula: boxPcs
      ? `按装箱数 ${boxPcs} 记录历史最终采购量 ${finalPurchaseQty}`
      : '未设置有效装箱数',
    actual_shipping_total: shippingTotalQty,
    actual_shipping_breakdown: actualShippingBreakdown,
    shipping_adjust_mode: normalizeText(draft.shipping_adjust_mode) || DEFAULT_SHIPPING_ADJUST_MODE,
    shipping_adjust_mode_label: '独立调整',
    manual_shipping_quantities: manualShippingQuantities,
    shipping_redistribution_effects: {},
    shipping_adjustment_log: [
      {
        type: snapshotSource,
        text: `${snapshotLabel}运输分段`,
      },
    ],
    shipping_adjustment_summary: `${snapshotLabel}运输分段`,
    product_purchase_remark_original: '',
    product_purchase_remark: manualRemark,
    product_purchase_remark_changed: true,
    warehouse_wid: warehouseWid,
    warehouse_name: warehouseName,
    artificial_coefficient: manualCoefficient,
    volatility_coefficient: volatilityCoefficient,
    final_replenishment_qty: finalPurchaseQty,
    base_daily_avg_sales: dailyAvgSales,
    user_selected_algo_id: algorithm.id,
    user_selected_algo_key: algorithm.key,
    user_selected_algo_name: algorithm.label,
    custom_alpha: null,
    alpha_by_method: undefined,
    start_date: startDate,
    end_date: endDate,
    total_days: totalDays,
    manualCoefficient: manualCoefficient,
    systemQty: systemSuggestedQty,
    actualPurchaseQty: finalPurchaseQty,
    actualPurchaseQtyBeforeBox: actualPurchaseQtyBeforeBox,
    boxAdjustedPurchaseQty: finalPurchaseQty,
    finalQty: finalPurchaseQty,
    totalQty: finalPurchaseQty,
    startDate,
    endDate,
    days: totalDays,
    dailyAvg: dailyAvgSales,
    userSelectedAlgo: algorithm.id,
    breakdown,
    window_calculation: windowCalculation,
  };

  const identity = {
    store_id: Number(listing.store_id) || null,
    asin: normalizeText(listing.asin),
    msku: normalizeText(listing.msku),
    marketplace: normalizeText(listing.marketplace),
    product_code: normalizeText(listing.product_code),
    local_sku: normalizeText(listing.local_sku),
    listing_id: Number(listing.id) || null,
    source_store_id: Number(pickFirst(orderItem.sid, purchasePlan.sid, listing.store_id)) || null,
    source_asin: normalizeText(listing.asin),
    source_msku: normalizeText(pickFirst(orderItem.first_msku, listing.msku)),
    source_local_sku: normalizeText(pickFirst(purchasePlan.sku, orderItem.sku, listing.local_sku)),
  };
  const reconstructionContext =
    draft.reconstruction_context && typeof draft.reconstruction_context === 'object'
      ? draft.reconstruction_context
      : {};
  const quickFields = {
    store_id: identity.store_id,
    asin: identity.asin,
    msku: identity.msku,
    marketplace: identity.marketplace,
    product_code: identity.product_code,
    local_sku: identity.local_sku,
    algorithm_key: algorithm.key,
    algorithm_name: algorithm.label,
    cycle_start_date: startDate,
    cycle_end_date: endDate,
    daily_avg_sales: dailyAvgSales,
    target_stock_days: targetStockDays,
    volatility_coefficient: volatilityCoefficient,
    system_suggested_qty: systemSuggestedQty,
    actual_purchase_qty: actualPurchaseQtyBeforeBox,
    final_purchase_qty: finalPurchaseQty,
    warehouse_wid: warehouseWid,
    warehouse_name: warehouseName,
    adjust_mode: expectedSales.shipping_adjust_mode,
    box_pcs: boxPcs,
    total_days: totalDays,
    shipping_buffer_days: shippingBufferDays,
  };
  const reconstruction = {
    ...cloneJson(reconstructionContext),
    source: snapshotSource,
    source_label: snapshotLabel,
    confidence: normalizeText(reconstructionContext.confidence) || 'manual_confirmed',
    order_item_id: Number(orderItem.id) || null,
    order_sn: normalizeText(pickFirst(orderItem.order_sn, purchaseOrder.order_sn)),
    plan_sn: normalizeText(pickFirst(orderItem.plan_sn, purchasePlan.plan_sn)),
    ppg_sn: normalizeText(purchasePlan.ppg_sn),
    sources: cloneJson(reconstructionContext.sources || []),
    recommended_shipping_method: normalizeText(reconstructionContext.recommended_shipping_method),
    recommended_shipping_reason: normalizeText(reconstructionContext.recommended_shipping_reason),
    recommended_daily_avg_source: normalizeText(reconstructionContext.recommended_daily_avg_source),
    filled_by_user_id: currentUser.userId,
    filled_by_username: currentUser.username,
    filled_by_nickname: currentUser.nickname,
  };
  const summaryJson = {
    remark_text: expectedSales.remark_text,
    summary: expectedSales.summary,
    formula: expectedSales.formula,
    system_suggested_qty: systemSuggestedQty,
    actual_purchase_qty_before_box: actualPurchaseQtyBeforeBox,
    final_purchase_qty: finalPurchaseQty,
    actual_shipping_total: shippingTotalQty,
    active_shipping_count: activeShippingRows.length,
  };
  const inputJson = {
    identity,
    reconstruction,
    product: {
      item_name: productName,
      image_url: imageUrl,
      shop,
      fnsku: normalizeText(pickFirst(listing.fnsku, purchasePlan.fnsku, orderItem.fnsku)),
      cross_store: false,
      target_listing: cloneJson(listing),
    },
    algorithm: {
      key: algorithm.key,
      id: algorithm.id,
      name: algorithm.label,
      engine_key: algorithm.engineKey || algorithm.key,
      engine_name: algorithm.engineLabel || algorithm.label,
    },
    period: {
      global_range: [startDate, endDate],
      item_range: [startDate, endDate],
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
    },
    daily_avg_sales: dailyAvgSales,
    target_stock_days: targetStockDays,
    volatility_coefficient: volatilityCoefficient,
    warehouse: {
      wid: warehouseWid,
      name: warehouseName,
    },
    shipping_profile: {
      profile_key: shippingProfile.key,
      profile_label: normalizeText(draftProfile.profile_label) || shippingProfile.label,
      buffer_days: shippingBufferDays,
      selected_methods: activeShippingRows.map(row => row.method_key),
      inactive_methods: shippingRows.filter(row => !row.active).map(row => row.method_key),
      methods: selectedShippingMethods.map(method => {
        const row = shippingRows.find(item => item.method_key === method.key);
        return {
          key: method.key,
          label: method.label,
          days: row?.days_to_arrive || method.days,
          color: method.color,
          icon: method.icon,
          active: Boolean(row?.active),
        };
      }),
      pref_record_id: draftProfile.pref_record_id || null,
    },
  };
  const calculationJson = {
    cycle: {
      start_date: startDate,
      end_date: endDate,
      total_days: totalDays,
      demand_qty: systemSuggestedQty,
      detail_html: formula,
      breakdown: cloneJson(breakdown),
    },
    system_suggested_qty: systemSuggestedQty,
    system_formula_text: formula,
    system_formula_html: formula,
    actual_purchase_qty_before_box: actualPurchaseQtyBeforeBox,
    actual_purchase_formula_text: formula,
    actual_purchase_formula_html: formula,
    final_purchase_qty: finalPurchaseQty,
    manual_coefficient: manualCoefficient,
    deductions: {
      purchase_plan_qty: 0,
      total_purchase_plan_qty: 0,
      local_purchase_plan_qty: 0,
      lingxing_purchase_plan_qty: 0,
      purchase_plan_deducted_qty: 0,
      local_pending_delivery_qty: 0,
      lingxing_pending_delivery_qty: 0,
      local_pending_delivery_deducted_qty: 0,
      lingxing_final_deducted_qty: 0,
    },
    box_adjustment: {
      box_pcs: boxPcs,
      box_count: expectedSales.box_count,
      adjusted_qty: finalPurchaseQty,
      delta: expectedSales.box_adjustment_delta,
      summary: expectedSales.box_adjustment_formula,
      formula_html: expectedSales.box_adjustment_formula,
      raw_result: {
        hasValidBox: Boolean(boxPcs),
        boxPcs,
        boxes: expectedSales.box_count,
        adjustedQty: finalPurchaseQty,
        delta: expectedSales.box_adjustment_delta,
      },
    },
  };
  const shippingJson = {
    total_qty: shippingTotalQty,
    actual_shipping_breakdown: actualShippingBreakdown,
    segments: cloneJson(shippingRows),
  };
  const adjustmentJson = {
    mode: expectedSales.shipping_adjust_mode,
    mode_label: expectedSales.shipping_adjust_mode_label,
    mode_source: 'manual',
    user_changed_mode: true,
    manual_quantities: manualShippingQuantities,
    redistribution_effects: {},
    adjustment_groups: {},
    adjustment_log: expectedSales.shipping_adjustment_log,
    adjustment_summary: expectedSales.shipping_adjustment_summary,
  };
  const coefficientJson = {
    manual_coefficient: manualCoefficient,
    volatility_coefficient: volatilityCoefficient,
    volatility_formula: '(原始系数 - 1) × 波动系数 + 1',
    custom_alpha: expectedSales.custom_alpha,
    alpha_by_method: null,
    window_calculation: expectedSales.window_calculation,
    five_month_rows: cloneJson(fiveMonthRows),
    segment_alpha_details: Object.fromEntries(
      shippingRows.map(row => [
        row.method_key,
        buildManualSegmentAlphaDetail(row),
      ])
    ),
  };
  const inventoryJson = {
    fba_valid: Number(draft.inventory?.fba_valid) || 0,
    fba_reserved: Number(draft.inventory?.fba_reserved) || 0,
    fba_valid_list: [],
    inbound_qty: Number(draft.inventory?.inbound_qty) || 0,
    fba_shipping_list: [],
    local_valid: Number(draft.inventory?.local_valid) || 0,
    local_valid_detail_list: [],
    local_purchase_plan: {
      total: Number(draft.inventory?.local_purchase_plan) || 0,
      details: [],
    },
    local_pending_delivery: {
      total: Number(draft.inventory?.local_pending_delivery) || 0,
      details: [],
    },
    lingxing_purchase_plan: {
      total: Number(draft.inventory?.lingxing_purchase_plan) || 0,
      details: [],
    },
    lingxing_pending_delivery: {
      total: Number(draft.inventory?.lingxing_pending_delivery) || 0,
      details: [],
    },
    pre_arrival_shortage: null,
    segment_inventory_usage: Object.fromEntries(shippingRows.map(row => [row.method_key, null])),
  };
  const remarkJson = {
    manual_replenish_remark: manualRemark,
    product_purchase_remark: {
      before: '',
      after: manualRemark,
      changed: true,
    },
    generated_remark_text: remarkText,
    legacy_remark_data: cloneJson(expectedSales),
  };
  const uiSnapshotJson = {
    daily_sales_tooltip: {
      daily_avg_sales: dailyAvgSales,
      source: snapshotLabel,
    },
    cycle_demand_detail_html: formula,
    system_formula_detail_html: formula,
    actual_purchase_formula_html: formula,
    box_adjustment_formula_html: expectedSales.box_adjustment_formula,
    system_formula_text: formula,
    actual_purchase_formula_text: formula,
    algo_panel_title: algorithm.label,
    segment_cards: shippingRows.map(row => ({
      method_key: row.method_key,
      method_label: row.method_label,
      active: row.active,
      date_range: `${row.start_date || ''}~${row.end_date || ''}`,
      final_qty: row.final_qty,
      system_suggested_qty: row.system_suggested_qty,
      shortage_label: row.shortage_label,
      inventory_usage_formula: row.inventory_usage_formula,
    })),
  };
  const snapshot = {
    snapshot_version: 1,
    snapshot_source: snapshotSource,
    created_at: new Date().toISOString(),
    identity,
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
  };

  return {
    analysisData: {
      store_id: identity.store_id,
      asin: identity.asin,
      marketplace: identity.marketplace,
      msku: identity.msku,
      local_sku: identity.local_sku,
      product_code: identity.product_code,
      fnsku: normalizeText(pickFirst(listing.fnsku, purchasePlan.fnsku, orderItem.fnsku)),
      expected_sales: expectedSales,
      remark: JSON.stringify(expectedSales),
      manual_remark: manualRemark,
    },
    snapshot: {
      ...snapshot,
      full_snapshot_json: cloneJson({
        ...snapshot,
        reconstruction,
        raw_calc_result_by_method: Object.fromEntries(
          shippingRows.map(row => [row.method_key, row.raw_calc_result])
        ),
        raw_shipping_quantities: manualShippingQuantities,
        raw_manual_state: {
          manual_shipping_quantities: manualShippingQuantities,
          manual_shipping_groups: {},
          shipping_redistribution_effects: {},
          shipping_adjustment_groups: {},
        },
      }),
    },
    normalizedDraft: {
      algorithm_key: algorithm.key,
      algorithm_name: algorithm.label,
      daily_avg_sales: dailyAvgSales,
      target_stock_days: targetStockDays,
      volatility_coefficient: volatilityCoefficient,
      manual_coefficient: manualCoefficient,
      cycle_start_date: startDate,
      cycle_end_date: endDate,
      system_suggested_qty: systemSuggestedQty,
      actual_purchase_qty_before_box: actualPurchaseQtyBeforeBox,
      final_purchase_qty: finalPurchaseQty,
      box_pcs: boxPcs,
      warehouse_wid: warehouseWid,
      warehouse_name: warehouseName,
      shipping_adjust_mode: expectedSales.shipping_adjust_mode,
      manual_remark: manualRemark,
      shipping_segments: shippingRows,
      reconstruction_context: reconstruction,
    },
  };
}

@Provide()
export class AppBsrPurchaseOrderManualLinkService extends BaseService {
  @InjectEntityModel(AppAmzBsrPurchaseOrderItemSyncLingxingEntity)
  orderItemRepo: Repository<AppAmzBsrPurchaseOrderItemSyncLingxingEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderManualLinkShelfEntity)
  manualLinkShelfRepo: Repository<AppAmzBsrPurchaseOrderManualLinkShelfEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderManualLinkShelfLogEntity)
  manualLinkShelfLogRepo: Repository<AppAmzBsrPurchaseOrderManualLinkShelfLogEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderSyncLingxingEntity)
  orderRepo: Repository<AppAmzBsrPurchaseOrderSyncLingxingEntity>;

  @InjectEntityModel(AppAmzBsrPurchasePlanLingxingEntity)
  purchasePlanRepo: Repository<AppAmzBsrPurchasePlanLingxingEntity>;

  @InjectEntityModel(AppAmzBsrProductListingLingxingEntity)
  listingRepo: Repository<AppAmzBsrProductListingLingxingEntity>;

  @InjectEntityModel(AppAmzBsrAnalysisRecordLingxingEntity)
  analysisRecordRepo: Repository<AppAmzBsrAnalysisRecordLingxingEntity>;

  @InjectEntityModel(AppAmzBsrBatchReplenishSnapshotEntity)
  batchSnapshotRepo: Repository<AppAmzBsrBatchReplenishSnapshotEntity>;

  @Inject()
  analysisCustomService: AppAnalysisCustomService;

  @Inject()
  ctx: Context;

  async page(param: ManualLinkPageParam = {}) {
    const page = Math.max(Number(param.page) || 1, 1);
    const size = Math.min(Math.max(Number(param.size) || 20, 1), 200);
    const requestedStatuses = normalizeArrayParam(param.match_status);
    const hasStatusFilter = requestedStatuses.length > 0;

    if (hasStatusFilter) {
      const rows = await this.queryManualLinkRows(param);
      const mapped = await this.mapRows(rows);
      const filtered = mapped.filter(row => requestedStatuses.includes(row.match_status));
      return {
        list: filtered.slice((page - 1) * size, page * size),
        pagination: {
          page,
          size,
          total: filtered.length,
        },
      };
    }

    const total = await this.countManualLinkRows(param);
    const rows = await this.queryManualLinkRows(param, page, size);
    return {
      list: await this.mapRows(rows),
      pagination: {
        page,
        size,
        total,
      },
    };
  }

  async stats(param: ManualLinkPageParam = {}) {
    const rows = await this.queryManualLinkRows(param);
    const orderSns = new Set<string>();
    const counts: Record<ManualLinkMatchStatus, number> = {
      auto_item_first_msku: 0,
      auto_plan_local_sku: 0,
      auto_plan_msku: 0,
      manual_required: 0,
      blocked: 0,
    };

    for (const row of rows) {
      const classification = this.classifyRow(row);
      counts[classification.match_status] += 1;
      if (row.order_sn) {
        orderSns.add(row.order_sn);
      }
    }

    const autoCandidate =
      counts.auto_item_first_msku + counts.auto_plan_local_sku + counts.auto_plan_msku;
    return {
      total_unlinked: rows.length,
      total_orders: orderSns.size,
      pending_linkable: autoCandidate + counts.manual_required,
      auto_candidate: autoCandidate,
      manual_required: counts.manual_required,
      blocked: counts.blocked,
      by_match_status: counts,
      default_purchase_order_statuses: DEFAULT_PURCHASE_ORDER_STATUSES,
    };
  }

  async shelfPreview(param: ManualLinkPageParam = {}) {
    const base = this.buildBaseQuery(param);
    const rows = await this.orderItemRepo.query(
      `
        SELECT
          COUNT(*) AS total,
          COUNT(DISTINCT o.order_sn) AS total_orders
        ${base.sql}
      `,
      base.params
    );
    const first = rows?.[0] || {};
    return {
      work_status: normalizeManualLinkWorkStatus(param.work_status),
      total: Number(first.total) || 0,
      total_orders: Number(first.total_orders) || 0,
    };
  }

  async shelveItems(param: any = {}) {
    const orderItemIds = normalizePositiveIntegerList(
      param.order_item_ids || param.order_item_id
    );
    if (!orderItemIds.length) {
      throw new Error('请选择需要搁置的采购单产品明细');
    }
    const items = await this.loadManualLinkShelfSourceItemsByIds(orderItemIds);
    return this.updateManualLinkShelfState(items, true, param.remark);
  }

  async unshelveItems(param: any = {}) {
    const orderItemIds = normalizePositiveIntegerList(
      param.order_item_ids || param.order_item_id
    );
    if (!orderItemIds.length) {
      throw new Error('请选择需要恢复的采购单产品明细');
    }
    const items = await this.loadManualLinkShelfSourceItemsByIds(orderItemIds);
    return this.updateManualLinkShelfState(items, false, param.remark);
  }

  async shelveByFilter(param: ManualLinkPageParam = {}) {
    const items = await this.queryManualLinkShelfTargetItems({
      ...param,
      work_status: 'current',
    });
    if (!items.length) {
      throw new Error('当前筛选下没有可搁置的采购单产品明细');
    }
    return this.updateManualLinkShelfState(items, true, (param as any).remark);
  }

  async unshelveByFilter(param: ManualLinkPageParam = {}) {
    const items = await this.queryManualLinkShelfTargetItems({
      ...param,
      work_status: 'shelved',
    });
    if (!items.length) {
      throw new Error('当前筛选下没有可恢复的采购单产品明细');
    }
    return this.updateManualLinkShelfState(items, false, (param as any).remark);
  }

  async completedPage(param: ManualLinkCompletedPageParam = {}) {
    const page = Math.max(Number(param.page) || 1, 1);
    const size = Math.min(Math.max(Number(param.size) || 20, 1), 200);
    const total = await this.countCompletedRows(param);
    const rows = await this.queryCompletedRows(param, page, size);
    return {
      list: rows.map(row => this.mapCompletedRow(row)),
      pagination: {
        page,
        size,
        total,
      },
    };
  }

  async completedStats(param: ManualLinkCompletedPageParam = {}) {
    const base = this.buildCompletedBaseQuery(param);
    const rows = await this.batchSnapshotRepo.query(
      `
        SELECT
          COUNT(DISTINCT completed.snapshot_id) AS total_completed,
          COUNT(DISTINCT NULLIF(linked_order_stats.order_sn, '')) AS total_orders,
          COUNT(DISTINCT COALESCE(CAST(completed.created_by AS CHAR), completed.created_by_name)) AS total_operators,
          MAX(COALESCE(completed.snapshot_update_time, completed.snapshot_create_time)) AS latest_completed_time
        FROM (
          SELECT DISTINCT
            s.id AS snapshot_id,
            s.analysis_record_id,
            s.created_by,
            s.created_by_name,
            s.\`createTime\` AS snapshot_create_time,
            s.\`updateTime\` AS snapshot_update_time
          ${base.sql}
        ) completed
        LEFT JOIN app_amz_bsr_purchase_order_item_sync_lingxing linked_order_stats
          ON linked_order_stats.analysis_record_id = completed.analysis_record_id
          AND linked_order_stats.analysis_record_id IS NOT NULL
          AND linked_order_stats.analysis_record_id > 0
      `,
      base.params
    );
    const first = rows?.[0] || {};
    return {
      total_completed: Number(first.total_completed) || 0,
      total_orders: Number(first.total_orders) || 0,
      total_operators: Number(first.total_operators) || 0,
      latest_completed_time: first.latest_completed_time || null,
    };
  }

  async searchListings(param: any = {}) {
    const page = Math.max(Number(param.page) || 1, 1);
    const size = Math.min(Math.max(Number(param.size) || 20, 1), 50);
    const keyword = normalizeText(param.keyWord || param.keyword);
    const qb = this.listingRepo.createQueryBuilder('l');

    if (keyword) {
      qb.andWhere(
        new Brackets(qb => {
          qb.where('l.asin LIKE :keyword', { keyword: `%${keyword}%` })
            .orWhere('l.msku LIKE :keyword', { keyword: `%${keyword}%` })
            .orWhere('l.local_sku LIKE :keyword', { keyword: `%${keyword}%` })
            .orWhere('l.product_code LIKE :keyword', { keyword: `%${keyword}%` })
            .orWhere('l.item_name LIKE :keyword', { keyword: `%${keyword}%` })
            .orWhere('l.local_name LIKE :keyword', { keyword: `%${keyword}%` })
            .orWhere('l.seller_name LIKE :keyword', { keyword: `%${keyword}%` })
            .orWhere('l.shop LIKE :keyword', { keyword: `%${keyword}%` });
        })
      );
    }

    const storeIds = normalizeArrayParam(param.store_id || param.sid);
    if (storeIds.length > 0) {
      qb.andWhere('l.store_id IN (:...storeIds)', { storeIds });
    }

    const marketplaces = normalizeArrayParam(param.marketplace);
    if (marketplaces.length > 0) {
      qb.andWhere('l.marketplace IN (:...marketplaces)', { marketplaces });
    }

    const shops = normalizeArrayParam(param.shop || param.seller_name);
    if (shops.length > 0) {
      qb.andWhere('(l.shop IN (:...shops) OR l.seller_name IN (:...shops))', { shops });
    }

    if (!keyword && storeIds.length === 0 && marketplaces.length === 0 && shops.length === 0) {
      return {
        list: [],
        pagination: { page, size, total: 0 },
      };
    }

    qb.select([
      'l.id',
      'l.store_id',
      'l.shop',
      'l.asin',
      'l.marketplace',
      'l.msku',
      'l.local_sku',
      'l.product_code',
      'l.item_name',
      'l.local_name',
      'l.seller_name',
      'l.image_url',
      'l.fnsku',
      'l.average_seven_volume',
      'l.average_fourteen_volume',
      'l.average_thirty_volume',
      'l.afn_fulfillable_quantity',
      'l.afn_inbound_working_quantity',
      'l.afn_inbound_shipped_quantity',
      'l.afn_inbound_receiving_quantity',
      'l.reserved_customerorders',
      'l.reserved_fc_processing',
      'l.reserved_fc_transfers',
      'l.status',
      'l.status_text',
    ]);
    qb.orderBy('l.id', 'DESC').skip((page - 1) * size).take(size);

    const [list, total] = await qb.getManyAndCount();
    return {
      list: list.map(item => this.mapListing(item)),
      pagination: {
        page,
        size,
        total,
      },
    };
  }

  async prepare(param: any = {}) {
    const orderItemId = positiveInteger(param.order_item_id, '采购单明细ID');
    const item = await this.orderItemRepo.findOne({ where: { id: orderItemId } });
    if (!item) {
      throw new Error('采购单明细不存在');
    }

    const planSn = normalizeText(item.plan_sn);
    const [order, purchasePlan, analysisRecord] = await Promise.all([
      this.orderRepo.findOne({ where: { order_sn: item.order_sn } }),
      planSn ? this.purchasePlanRepo.findOne({ where: { plan_sn: planSn } }) : Promise.resolve(null),
      planSn
        ? this.analysisRecordRepo.findOne({
            where: { plan_sn: planSn, status: 1 },
            order: { id: 'DESC' },
          })
        : Promise.resolve(null),
    ]);
    const listingId = Number(param.listing_id) || 0;
    const listing = listingId ? await this.listingRepo.findOne({ where: { id: listingId } }) : null;
    const snapshot = analysisRecord
      ? await this.batchSnapshotRepo.findOne({
          where: { analysis_record_id: Number(analysisRecord.id) },
        })
      : null;
    const historySnapshot = await this.findLatestCompatibleSnapshot(listing, snapshot);
    const warehouseSuggestions = this.buildWarehouseSuggestions(item, purchasePlan, order);
    const defaults = this.buildPrepareDefaults({
      item,
      order,
      purchasePlan,
      listing,
      historySnapshot,
      warehouseSuggestions,
    });

    return {
      order_item: this.mapOrderItemForPrepare(item),
      purchase_order: order
        ? {
            order_sn: order.order_sn,
            status: order.status,
            status_text: order.status_text,
            supplier_name: order.supplier_name,
            warehouse_name: (order as any).ware_house_name,
            order_time: order.order_time,
            create_time_remote: (order as any).create_time_remote,
            logistics_info: (order as any).logistics_info || [],
          }
        : null,
      purchase_plan: purchasePlan
        ? {
            id: purchasePlan.id,
            plan_sn: purchasePlan.plan_sn,
            ppg_sn: purchasePlan.ppg_sn,
            sku: purchasePlan.sku,
            product_name: purchasePlan.product_name,
            pic_url: purchasePlan.pic_url,
            fnsku: purchasePlan.fnsku,
            msku: purchasePlan.msku,
            sid: purchasePlan.sid,
            seller_name: purchasePlan.seller_name,
            marketplace: purchasePlan.marketplace,
            quantity_plan: Number(purchasePlan.quantity_plan) || 0,
            wid: purchasePlan.wid,
            warehouse_name: purchasePlan.warehouse_name,
            cg_box_pcs: purchasePlan.cg_box_pcs,
            analysis_record_id: purchasePlan.analysis_record_id || null,
          }
        : null,
      listing: listing ? this.mapListing(listing) : null,
      existing_analysis: analysisRecord
        ? {
            id: analysisRecord.id,
            plan_sn: analysisRecord.plan_sn,
            status: analysisRecord.status,
            has_snapshot: Boolean(snapshot),
            snapshot_source: snapshot?.snapshot_source || '',
            snapshot_label: this.getSnapshotSourceLabel(snapshot?.snapshot_source),
            snapshot_protected: snapshot?.snapshot_source === 'batch_replenish',
          }
        : null,
      defaults: {
        ...defaults,
      },
      options: {
        algorithms: buildManualLinkAlgorithmOptions(),
        shipping_profiles: buildManualLinkShippingProfiles(),
        shipping_methods: buildManualLinkShippingOptions(defaults.recommended_shipping_profile_key),
        warehouses: warehouseSuggestions,
      },
    };
  }

  private async findLatestCompatibleSnapshot(
    listing: AppAmzBsrProductListingLingxingEntity | null,
    currentSnapshot?: AppAmzBsrBatchReplenishSnapshotEntity | null
  ) {
    if (currentSnapshot?.shipping_json?.segments?.length) {
      return currentSnapshot;
    }
    if (!listing) {
      return null;
    }

    const storeId = Number((listing as any).store_id) || null;
    const asin = normalizeText((listing as any).asin);
    const marketplace = normalizeText((listing as any).marketplace);
    const msku = normalizeText((listing as any).msku);
    const localSku = normalizeText((listing as any).local_sku);
    const where: any[] = [];
    if (storeId && asin && marketplace && msku) {
      where.push({ store_id: storeId, asin, marketplace, msku });
    }
    if (storeId && asin && marketplace && localSku) {
      where.push({ store_id: storeId, asin, marketplace, local_sku: localSku });
    }
    if (where.length === 0) {
      return null;
    }

    return await this.batchSnapshotRepo.findOne({
      where,
      order: { id: 'DESC' },
    } as any);
  }

  private buildPrepareDefaults(input: {
    item: AppAmzBsrPurchaseOrderItemSyncLingxingEntity;
    order: AppAmzBsrPurchaseOrderSyncLingxingEntity | null;
    purchasePlan: AppAmzBsrPurchasePlanLingxingEntity | null;
    listing: AppAmzBsrProductListingLingxingEntity | null;
    historySnapshot: AppAmzBsrBatchReplenishSnapshotEntity | null;
    warehouseSuggestions: Array<{ wid: number | null; name: string; source: string }>;
  }) {
    const { item, order, purchasePlan, listing, historySnapshot, warehouseSuggestions } = input;
    const sourceRows: Array<{
      key: string;
      label: string;
      source: string;
      value?: any;
      confidence?: string;
    }> = [];
    const addSource = (row: {
      key: string;
      label: string;
      source: string;
      value?: any;
      confidence?: string;
    }) => sourceRows.push(row);

    const snapshotDefaults = this.extractSnapshotPrepareDefaults(historySnapshot);
    const shippingProfile = resolveShippingProfileByMarketplace(
      purchasePlan?.marketplace,
      (listing as any)?.marketplace,
      (item as any)?.plan_marketplace
    );
    const hasHistoryShippingBuffer = snapshotDefaults.shipping_buffer_days !== null && snapshotDefaults.shipping_buffer_days !== undefined;
    const shippingBufferDays = hasHistoryShippingBuffer
      ? Number(snapshotDefaults.shipping_buffer_days)
      : DEFAULT_SHIPPING_BUFFER_DAYS;
    const planStart = this.resolvePlanStartDate(item, order, purchasePlan);
    const planStartDate = planStart.value;
    const quantity = firstPositiveWithSource([
      { value: item.quantity_plan, source: '采购单明细', key: 'quantity_plan' },
      { value: (item as any).quantity_real, source: '采购单明细', key: 'quantity_real' },
      { value: purchasePlan?.quantity_plan, source: '采购计划', key: 'quantity_plan' },
    ]);
    const currentPurchaseQty = Number(quantity.value) || 0;
    const historySnapshotQty = this.resolveHistorySnapshotQty(snapshotDefaults);
    const baseQty = currentPurchaseQty || historySnapshotQty || 0;
    if (quantity.value) {
      addSource({
        key: 'quantity',
        label: quantity.key === 'quantity_real' ? '实际采购量' : '计划采购量',
        source: quantity.source,
        value: quantity.value,
        confidence: 'high',
      });
    }
    if (historySnapshotQty) {
      addSource({
        key: 'history_snapshot_qty',
        label: '历史快照采购量',
        source: '历史快照',
        value: historySnapshotQty,
        confidence: 'medium',
      });
    }

    const boxPcs = firstPositiveWithSource([
      { value: purchasePlan?.cg_box_pcs, source: '采购计划', key: 'cg_box_pcs' },
      { value: (item as any).quantity_per_case, source: '采购单明细', key: 'quantity_per_case' },
    ]);
    if (boxPcs.value) {
      addSource({
        key: 'box_pcs',
        label: '装箱数',
        source: boxPcs.source,
        value: boxPcs.value,
        confidence: 'high',
      });
    }

    const dailyAvg = this.resolveDailyAvgDefault(listing, snapshotDefaults);
    if (dailyAvg.value) {
      addSource({
        key: 'daily_avg_sales',
        label: '日均销量',
        source: dailyAvg.source,
        value: dailyAvg.value,
        confidence: dailyAvg.source === '历史快照' ? 'high' : 'medium',
      });
    }

    const shippingRecommendation = this.resolveShippingRecommendation(
      item,
      order,
      purchasePlan,
      snapshotDefaults.shipping_segments
    );
    if (shippingRecommendation.method_key) {
      addSource({
        key: 'shipping_method',
        label: '运输方式建议',
        source: shippingRecommendation.source,
        value: shippingRecommendation.method_label,
        confidence: shippingRecommendation.confidence,
      });
    }
    addSource({
      key: 'shipping_buffer_days',
      label: '缓冲天数',
      source: hasHistoryShippingBuffer ? '历史快照' : '系统默认',
      value: shippingBufferDays,
      confidence: hasHistoryShippingBuffer ? 'high' : 'low',
    });

    const warehouse = warehouseSuggestions[0] || { wid: null, name: '', source: '' };
    if (warehouse.name || warehouse.wid) {
      addSource({
        key: 'warehouse',
        label: '采购仓库',
        source: this.formatWarehouseSource(warehouse.source),
        value: warehouse.name || warehouse.wid,
        confidence: 'high',
      });
    }

    const hasHistorySegments = snapshotDefaults.shipping_segments.some(segment => segment.active);
    const shouldScaleHistorySegments =
      hasHistorySegments &&
      currentPurchaseQty > 0 &&
      historySnapshotQty > 0 &&
      currentPurchaseQty !== historySnapshotQty;
    const preparedShippingSegments = hasHistorySegments
      ? shouldScaleHistorySegments
        ? this.scalePrepareShippingSegments(snapshotDefaults.shipping_segments, currentPurchaseQty)
        : snapshotDefaults.shipping_segments
      : this.buildEmptyPrepareShippingSegments(shippingRecommendation.method_key, shippingProfile.key);
    const quantityReconstructionMode = hasHistorySegments
      ? shouldScaleHistorySegments
        ? 'history_snapshot_scaled'
        : currentPurchaseQty > 0
          ? 'history_snapshot_same_qty'
          : 'history_snapshot_fallback'
      : currentPurchaseQty > 0
        ? 'current_purchase_order'
        : 'manual_required';
    const quantityMismatchText = shouldScaleHistorySegments
      ? `当前采购单 ${currentPurchaseQty}，历史快照 ${historySnapshotQty}，运输分段已按比例折算`
      : '';
    if (shouldScaleHistorySegments) {
      addSource({
        key: 'quantity_scale',
        label: '分段数量折算',
        source: '历史快照折算',
        value: `${historySnapshotQty} -> ${currentPurchaseQty}`,
        confidence: 'medium',
      });
    }

    const fieldReferences = this.buildPrepareFieldReferences({
      snapshotDefaults,
      sourceRows,
      dailyAvg,
      quantity,
      currentPurchaseQty,
      historySnapshotQty,
      baseQty,
      boxPcs,
      warehouse,
      shippingRecommendation,
      preparedShippingSegments,
      hasHistorySegments,
      shouldScaleHistorySegments,
      quantityMismatchText,
      shippingBufferDays,
      hasHistoryShippingBuffer,
      planStart,
    });

    return {
      algorithm_key: snapshotDefaults.algorithm_key || 'daily_avg',
      daily_avg_sales: dailyAvg.value,
      cycle_start_date: snapshotDefaults.cycle_start_date || '',
      cycle_end_date: snapshotDefaults.cycle_end_date || '',
      plan_start_date: planStartDate,
      current_purchase_qty: currentPurchaseQty || null,
      history_snapshot_qty: historySnapshotQty || null,
      quantity_reconstruction_mode: quantityReconstructionMode,
      quantity_mismatch_text: quantityMismatchText,
      final_purchase_qty: baseQty || null,
      actual_purchase_qty_before_box:
        currentPurchaseQty || snapshotDefaults.actual_purchase_qty_before_box || baseQty || null,
      system_suggested_qty: shouldScaleHistorySegments
        ? baseQty || null
        : snapshotDefaults.system_suggested_qty || baseQty || null,
      box_pcs: snapshotDefaults.box_pcs || boxPcs.value || null,
      target_stock_days: snapshotDefaults.target_stock_days || DEFAULT_TARGET_STOCK_DAYS,
      volatility_coefficient:
        snapshotDefaults.volatility_coefficient || DEFAULT_VOLATILITY_COEFFICIENT,
      manual_coefficient: snapshotDefaults.manual_coefficient || DEFAULT_MANUAL_COEFFICIENT,
      warehouse_wid: snapshotDefaults.warehouse_wid || warehouse.wid || null,
      warehouse_name: snapshotDefaults.warehouse_name || warehouse.name || '',
      shipping_adjust_mode: snapshotDefaults.shipping_adjust_mode || DEFAULT_SHIPPING_ADJUST_MODE,
      reconstruction_confidence: hasHistorySegments
        ? 'history_snapshot'
        : shippingRecommendation.method_key || dailyAvg.value
          ? 'system_suggested'
          : 'manual_required',
      reconstruction_sources: sourceRows,
      field_references: fieldReferences,
      recommended_shipping_method: shippingRecommendation.method_key,
      recommended_shipping_label: shippingRecommendation.method_label,
      recommended_shipping_reason: shippingRecommendation.reason,
      recommended_shipping_profile_key: shippingProfile.key,
      recommended_shipping_profile_label: shippingProfile.label,
      shipping_buffer_days: shippingBufferDays,
      recommended_daily_avg_source: dailyAvg.label,
      inventory: this.buildPrepareInventory(listing),
      shipping_segments: this.attachPrepareShippingCalculationTrace(preparedShippingSegments, {
        planStartDate,
        shippingBufferDays,
        dailyAvgSales: Number(dailyAvg.value) || 0,
        volatilityCoefficient: snapshotDefaults.volatility_coefficient || DEFAULT_VOLATILITY_COEFFICIENT,
        manualCoefficient: snapshotDefaults.manual_coefficient || DEFAULT_MANUAL_COEFFICIENT,
        targetStockDays: snapshotDefaults.target_stock_days || DEFAULT_TARGET_STOCK_DAYS,
      }),
    };
  }

  private buildPrepareFieldReferences(input: {
    snapshotDefaults: any;
    sourceRows: Array<{ key: string; label: string; source: string; value?: any; confidence?: string }>;
    dailyAvg: { value: any; source: string; label: string; source_label?: string; table_name?: string; field_name?: string; source_record_id?: number | string | null };
    quantity: { value: number; source: string; key: string };
    currentPurchaseQty: number;
    historySnapshotQty: number;
    baseQty: number;
    boxPcs: { value: number; source: string; key: string };
    warehouse: { wid: number | null; name: string; source: string };
    shippingRecommendation: { method_key: string; method_label: string; source: string; confidence: string; reason: string };
    preparedShippingSegments: any[];
    hasHistorySegments: boolean;
    shouldScaleHistorySegments: boolean;
    quantityMismatchText: string;
    shippingBufferDays: number;
    hasHistoryShippingBuffer: boolean;
    planStart: {
      value: string;
      source_label: string;
      table_name?: string;
      field_name?: string;
      source_record_id?: number | string | null;
      priority_trace: any[];
    };
  }): PrepareFieldReference[] {
    const {
      snapshotDefaults,
      dailyAvg,
      quantity,
      currentPurchaseQty,
      historySnapshotQty,
      baseQty,
      boxPcs,
      warehouse,
      shippingRecommendation,
      preparedShippingSegments,
      hasHistorySegments,
      shouldScaleHistorySegments,
      quantityMismatchText,
      shippingBufferDays,
      hasHistoryShippingBuffer,
      planStart,
    } = input;

    const algorithmSource = snapshotDefaults.algorithm_key ? '历史快照' : '系统默认';
    const cycleValue =
      snapshotDefaults.cycle_start_date && snapshotDefaults.cycle_end_date
        ? `${snapshotDefaults.cycle_start_date} ~ ${snapshotDefaults.cycle_end_date}`
        : '';
    const cycleSource = cycleValue ? '历史快照' : '人工填写';
    const quantitySource =
      currentPurchaseQty > 0
        ? quantity.source || '当前采购单'
        : historySnapshotQty > 0
          ? '历史快照'
          : '人工填写';
    const shippingSource = shouldScaleHistorySegments
      ? '历史快照折算'
      : hasHistorySegments
        ? '历史快照'
        : shippingRecommendation.source || '人工填写';
    const shippingConfidence = shouldScaleHistorySegments
      ? 'medium'
      : hasHistorySegments
        ? 'high'
        : shippingRecommendation.confidence || 'low';
    const activeSegmentQty = this.sumPrepareShippingSegmentQty(preparedShippingSegments);
    const warehouseSource = warehouse?.name || warehouse?.wid ? this.formatWarehouseSource(warehouse.source) : '人工选择';

    return [
      {
        key: 'algorithm_key',
        label: '算法',
        value: snapshotDefaults.algorithm_key || 'daily_avg',
        source: algorithmSource,
        confidence: snapshotDefaults.algorithm_key ? 'high' : 'low',
        required: true,
        write_target: 'snapshot_draft.algorithm_key',
        help_text: snapshotDefaults.algorithm_key
          ? '沿用历史快照保存的算法类型，提交前仍需人工确认。'
          : '没有历史算法时默认日均销量，提交前必须人工确认。',
      },
      {
        key: 'plan_start_date',
        label: '计划开始',
        value: planStart.value,
        source: planStart.source_label || '人工填写',
        source_label: planStart.source_label || '人工填写',
        table_name: planStart.table_name,
        field_name: planStart.field_name,
        source_record_id: planStart.source_record_id ?? null,
        priority_trace: planStart.priority_trace,
        confidence: planStart.value ? 'high' : 'manual_required',
        required: true,
        write_target: 'snapshot_draft.plan_start_date',
        help_text: planStart.value
          ? '推算运输分段预计到达和覆盖周期的基准日期。'
          : '没有可用单据时间，必须人工确认计划开始时间。',
      },
      {
        key: 'cycle_range',
        label: '销售周期',
        value: cycleValue,
        source: cycleSource,
        confidence: cycleValue ? 'high' : 'manual_required',
        required: true,
        write_target: 'snapshot_draft.cycle_start_date / cycle_end_date',
        help_text: cycleValue
          ? '来自历史快照的销售周期，可作为还原依据。'
          : '没有可复用周期，必须人工填写销售开始和结束日期。',
      },
      {
        key: 'daily_avg_sales',
        label: '日均销量',
        value: dailyAvg.value,
        source: dailyAvg.source || '人工填写',
        source_label: dailyAvg.source_label || dailyAvg.source || '人工填写',
        table_name: dailyAvg.table_name,
        field_name: dailyAvg.field_name,
        source_record_id: dailyAvg.source_record_id ?? null,
        confidence: dailyAvg.source === '历史快照' ? 'high' : dailyAvg.value ? 'medium' : 'manual_required',
        required: true,
        write_target: 'snapshot_draft.daily_avg_sales',
        help_text: dailyAvg.label || '没有可用日均销量参考，必须人工填写。',
      },
      {
        key: 'system_suggested_qty',
        label: '系统建议量',
        value: shouldScaleHistorySegments
          ? baseQty || null
          : snapshotDefaults.system_suggested_qty || baseQty || null,
        source: snapshotDefaults.system_suggested_qty && !shouldScaleHistorySegments ? '历史快照' : quantitySource,
        confidence: shouldScaleHistorySegments ? 'medium' : currentPurchaseQty ? 'high' : 'manual_required',
        required: true,
        write_target: 'snapshot_draft.system_suggested_qty',
        help_text: shouldScaleHistorySegments
          ? '历史快照数量与当前采购单不同，系统建议量已按当前采购单数量重置。'
          : '用于还原批量补货时的系统建议结果。',
      },
      {
        key: 'actual_purchase_qty_before_box',
        label: '装箱前采购量',
        value: currentPurchaseQty || snapshotDefaults.actual_purchase_qty_before_box || baseQty || null,
        source: currentPurchaseQty ? quantitySource : snapshotDefaults.actual_purchase_qty_before_box ? '历史快照' : '人工填写',
        confidence: currentPurchaseQty ? 'high' : 'manual_required',
        required: true,
        write_target: 'snapshot_draft.actual_purchase_qty_before_box',
        help_text: '当前采购单数量优先，避免历史快照数量覆盖当前采购事实。',
      },
      {
        key: 'final_purchase_qty',
        label: '最终采购量',
        value: baseQty || null,
        source: quantitySource,
        confidence: currentPurchaseQty ? 'high' : historySnapshotQty ? 'medium' : 'manual_required',
        required: true,
        write_target: 'snapshot_draft.final_purchase_qty',
        help_text: quantityMismatchText || '最终写入快照的采购量，默认优先取当前采购单数量。',
      },
      {
        key: 'target_stock_days',
        label: '目标库存天数',
        value: snapshotDefaults.target_stock_days || DEFAULT_TARGET_STOCK_DAYS,
        source: snapshotDefaults.target_stock_days ? '历史快照' : '系统默认',
        confidence: snapshotDefaults.target_stock_days ? 'high' : 'low',
        required: true,
        write_target: 'snapshot_draft.target_stock_days',
        help_text: '用于还原补货测算目标库存天数。',
      },
      {
        key: 'volatility_coefficient',
        label: '波动系数',
        value: snapshotDefaults.volatility_coefficient || DEFAULT_VOLATILITY_COEFFICIENT,
        source: snapshotDefaults.volatility_coefficient ? '历史快照' : '系统默认',
        confidence: snapshotDefaults.volatility_coefficient ? 'high' : 'low',
        required: true,
        write_target: 'snapshot_draft.volatility_coefficient',
        help_text: '用于还原批量补货里的销量波动修正。',
      },
      {
        key: 'manual_coefficient',
        label: '人工系数',
        value: snapshotDefaults.manual_coefficient || DEFAULT_MANUAL_COEFFICIENT,
        source: snapshotDefaults.manual_coefficient ? '历史快照' : '系统默认',
        confidence: snapshotDefaults.manual_coefficient ? 'high' : 'low',
        required: true,
        write_target: 'snapshot_draft.manual_coefficient',
        help_text: '用于还原人工调整倍率。',
      },
      {
        key: 'box_pcs',
        label: '装箱数',
        value: snapshotDefaults.box_pcs || boxPcs.value || null,
        source: snapshotDefaults.box_pcs ? '历史快照' : boxPcs.source || '人工填写',
        confidence: snapshotDefaults.box_pcs || boxPcs.value ? 'high' : 'manual_required',
        required: false,
        write_target: 'snapshot_draft.box_pcs',
        help_text: '装箱数影响批量补货界面的装箱调整展示。',
      },
      {
        key: 'warehouse',
        label: '采购仓库',
        value: snapshotDefaults.warehouse_name || warehouse.name || warehouse.wid || '',
        source: snapshotDefaults.warehouse_name || snapshotDefaults.warehouse_wid ? '历史快照' : warehouseSource,
        confidence: snapshotDefaults.warehouse_name || warehouse.name || warehouse.wid ? 'high' : 'manual_required',
        required: true,
        write_target: 'snapshot_draft.warehouse_wid / warehouse_name',
        help_text: '这里是推荐仓库来源，前端仍需从真实仓库列表中确认选择。',
        is_recommendation: true,
      },
      {
        key: 'shipping_buffer_days',
        label: '缓冲天数',
        value: shippingBufferDays,
        source: hasHistoryShippingBuffer ? '历史快照' : '系统默认',
        confidence: hasHistoryShippingBuffer ? 'high' : 'low',
        required: true,
        write_target: 'snapshot_draft.shipping_profile.buffer_days',
        help_text: hasHistoryShippingBuffer
          ? '来自历史补货快照保存的缓冲天数，提交前可按当前采购单重新确认。'
          : `没有历史缓冲天数时默认 ${DEFAULT_SHIPPING_BUFFER_DAYS} 天，与批量补货默认配置一致。`,
      },
      {
        key: 'shipping_segments',
        label: '运输分段',
        value: activeSegmentQty || null,
        source: shippingSource,
        confidence: shippingConfidence,
        required: true,
        write_target: 'snapshot_draft.shipping_segments',
        help_text: hasHistorySegments
          ? quantityMismatchText || '沿用历史快照运输分段，提交前必须确认周期和数量。'
          : shippingRecommendation.reason || '没有历史分段，系统只给出运输方式建议，必须人工分配数量和周期。',
      },
      {
        key: 'manual_remark',
        label: '人工备注',
        value: '',
        source: '人工填写',
        confidence: 'manual_required',
        required: true,
        write_target: 'snapshot_draft.manual_remark',
        help_text: '必须记录历史补全原因、依据或人工确认说明。',
      },
    ];
  }

  private extractSnapshotPrepareDefaults(snapshot: AppAmzBsrBatchReplenishSnapshotEntity | null) {
    const quick = (snapshot as any)?.quick_fields || {};
    const input = (snapshot as any)?.input_json || {};
    const calculation = (snapshot as any)?.calculation_json || {};
    const shipping = (snapshot as any)?.shipping_json || {};
    const expected = (snapshot as any)?.full_snapshot_json?.expected_sales || {};
    const fullInput = (snapshot as any)?.full_snapshot_json?.input_json || {};
    const algorithmKey = normalizeText(
      pickFirst(
        (snapshot as any)?.algorithm_key,
        quick.algorithm_key,
        input.algorithm?.key,
        expected.user_selected_algo_key
      )
    );
    return {
      algorithm_key: algorithmKey,
      daily_avg_sales:
        Number(
          pickFirst(
            (snapshot as any)?.daily_avg_sales,
            quick.daily_avg_sales,
            input.daily_avg_sales,
            expected.base_daily_avg_sales
          )
        ) || null,
      cycle_start_date: normalizeText(
        pickFirst((snapshot as any)?.cycle_start_date, quick.cycle_start_date, calculation.cycle?.start_date)
      ),
      cycle_end_date: normalizeText(
        pickFirst((snapshot as any)?.cycle_end_date, quick.cycle_end_date, calculation.cycle?.end_date)
      ),
      target_stock_days:
        Number(pickFirst((snapshot as any)?.target_stock_days, quick.target_stock_days, input.target_stock_days)) ||
        null,
      volatility_coefficient:
        Number(
          pickFirst(
            (snapshot as any)?.volatility_coefficient,
            quick.volatility_coefficient,
            input.volatility_coefficient
          )
        ) || null,
      manual_coefficient: Number(input.manual_coefficient || expected.artificial_coefficient) || null,
      system_suggested_qty:
        Number(
          pickFirst(
            (snapshot as any)?.system_suggested_qty,
            quick.system_suggested_qty,
            calculation.system_suggested_qty,
            expected.system_suggested_qty
          )
        ) || null,
      actual_purchase_qty_before_box:
        Number(
          pickFirst(
            (snapshot as any)?.actual_purchase_qty,
            quick.actual_purchase_qty,
            calculation.actual_purchase_qty_before_box,
            expected.actual_purchase_qty_before_box
          )
        ) || null,
      final_purchase_qty:
        Number(
          pickFirst(
            (snapshot as any)?.final_purchase_qty,
            quick.final_purchase_qty,
            calculation.final_purchase_qty,
            expected.final_replenishment_qty
          )
        ) || null,
      box_pcs:
        Number(
          pickFirst(
            (snapshot as any)?.box_pcs,
            quick.box_pcs,
            calculation.box_adjustment?.box_pcs,
            expected.box_pcs
          )
        ) || null,
      warehouse_wid:
        Number(pickFirst((snapshot as any)?.warehouse_wid, quick.warehouse_wid, input.warehouse?.wid)) || null,
      warehouse_name: normalizeText(
        pickFirst((snapshot as any)?.warehouse_name, quick.warehouse_name, input.warehouse?.name)
      ),
      shipping_adjust_mode: normalizeText(
        pickFirst((snapshot as any)?.adjust_mode, quick.adjust_mode, (snapshot as any)?.adjustment_json?.mode)
      ),
      shipping_buffer_days: optionalNonNegativeInteger(
        pickFirst(quick.shipping_buffer_days, input.shipping_profile?.buffer_days, fullInput.shipping_profile?.buffer_days),
        '缓冲天数'
      ),
      shipping_segments: this.normalizePrepareShippingSegments(shipping.segments || []),
    };
  }

  private resolveDailyAvgDefault(
    listing: AppAmzBsrProductListingLingxingEntity | null,
    snapshotDefaults: { daily_avg_sales?: number | null }
  ) {
    const listingCandidates = [
      {
        value: (listing as any)?.average_thirty_volume,
        field_name: 'average_thirty_volume',
        label: '店铺商品 30天平均销量',
      },
      {
        value: (listing as any)?.average_fourteen_volume,
        field_name: 'average_fourteen_volume',
        label: '店铺商品 14天平均销量',
      },
      {
        value: (listing as any)?.average_seven_volume,
        field_name: 'average_seven_volume',
        label: '店铺商品 7天平均销量',
      },
    ];
    for (const candidate of listingCandidates) {
      const value = Number(candidate.value);
      if (Number.isFinite(value) && value > 0) {
        return {
          value,
          source: '店铺商品',
          source_label: '店铺商品表',
          table_name: 'app_amz_bsr_product_Listing_Lingxing',
          field_name: candidate.field_name,
          source_record_id: Number((listing as any)?.id) || null,
          label: candidate.label,
        };
      }
    }
    if (Number(snapshotDefaults.daily_avg_sales) > 0) {
      return {
        value: Number(snapshotDefaults.daily_avg_sales),
        source: '历史快照',
        source_label: '历史快照',
        table_name: 'app_amz_bsr_batch_replenish_snapshot',
        field_name: 'daily_avg_sales',
        source_record_id: null,
        label: '历史快照日均销量',
      };
    }
    return { value: null, source: '', source_label: '', table_name: '', field_name: '', source_record_id: null, label: '' };
  }

  private buildPrepareInventory(listing: AppAmzBsrProductListingLingxingEntity | null) {
    return {
      fba_valid: Number((listing as any)?.afn_fulfillable_quantity) || 0,
      fba_reserved:
        (Number((listing as any)?.reserved_customerorders) || 0) +
        (Number((listing as any)?.reserved_fc_processing) || 0) +
        (Number((listing as any)?.reserved_fc_transfers) || 0),
      inbound_qty:
        (Number((listing as any)?.afn_inbound_working_quantity) || 0) +
        (Number((listing as any)?.afn_inbound_shipped_quantity) || 0) +
        (Number((listing as any)?.afn_inbound_receiving_quantity) || 0),
      local_valid: 0,
      local_purchase_plan: 0,
      local_pending_delivery: 0,
      lingxing_purchase_plan: 0,
      lingxing_pending_delivery: 0,
    };
  }

  private normalizePrepareShippingSegments(rawSegments: any[]) {
    const rawMap = new Map<string, any>();
    for (const segment of Array.isArray(rawSegments) ? rawSegments : []) {
      const key = normalizeText(segment?.method_key);
      if (key) {
        rawMap.set(key, segment || {});
      }
    }
    return DEFAULT_SHIPPING_METHODS.map(method => {
      const raw = rawMap.get(method.key) || {};
      const active = Boolean(raw.active);
      const startDate = normalizeText(raw.start_date || raw.startDate);
      const endDate = normalizeText(raw.end_date || raw.endDate);
      return {
        method_key: method.key,
        method_label: normalizeText(raw.method_label || raw.shipping_label) || method.label,
        days_to_arrive: Number(raw.days_to_arrive || raw.days) || method.days,
        color: normalizeText(raw.color) || method.color,
        icon: normalizeText(raw.icon) || method.icon,
        active,
        start_date: active ? startDate : '',
        end_date: active ? endDate : '',
        period_days: active ? Number(raw.period_days || raw.days) || 0 : 0,
        system_suggested_qty: active ? Number(raw.system_suggested_qty || raw.original_suggested_qty) || 0 : 0,
        purchase_plan_deducted_qty: active ? Number(raw.purchase_plan_deducted_qty) || 0 : 0,
        local_pending_delivery_deducted_qty: active ? Number(raw.local_pending_delivery_deducted_qty) || 0 : 0,
        final_qty: active ? Number(raw.final_qty || raw.actual_qty) || 0 : 0,
        coefficient: Number(raw.coefficient || raw.adjusted_coefficient) || 1,
        raw_coefficient: Number(raw.raw_coefficient) || Number(raw.coefficient) || 1,
        adjusted_coefficient: Number(raw.adjusted_coefficient) || Number(raw.coefficient) || 1,
        manual_alpha: raw.manual_alpha ?? null,
        alpha_mode: normalizeText(raw.alpha_mode) || 'system',
        monthly_coefficients: cloneJson(raw.monthly_coefficients || null),
        source: active ? '历史快照' : '',
        allocation_status: active ? 'history_snapshot' : 'inactive',
        source_confidence: active ? 'high' : '',
        help_text: active ? '来自最近一次批量补货快照，提交前仍需人工确认。' : '未启用该运输方式。',
      };
    });
  }

  private resolveHistorySnapshotQty(snapshotDefaults: any) {
    const explicitQty = Number(snapshotDefaults?.final_purchase_qty) || 0;
    if (explicitQty > 0) return explicitQty;
    return this.sumPrepareShippingSegmentQty(snapshotDefaults?.shipping_segments || []);
  }

  private sumPrepareShippingSegmentQty(segments: any[]) {
    return (Array.isArray(segments) ? segments : [])
      .filter(segment => segment?.active)
      .reduce((sum, segment) => sum + (Number(segment.final_qty) || 0), 0);
  }

  private scalePrepareShippingSegments(segments: any[], targetQty: number) {
    const activeSegments = (Array.isArray(segments) ? segments : []).filter(segment => segment?.active);
    const sourceTotal = this.sumPrepareShippingSegmentQty(activeSegments);
    if (!targetQty || !sourceTotal || !activeSegments.length) {
      return segments;
    }

    let remainingQty = Math.round(targetQty);
    let activeIndex = 0;
    return segments.map(segment => {
      if (!segment?.active) return segment;

      const isLastActive = activeIndex === activeSegments.length - 1;
      activeIndex += 1;
      const sourceQty = Number(segment.final_qty) || Number(segment.system_suggested_qty) || 0;
      const scaledQty = isLastActive
        ? remainingQty
        : Math.max(0, Math.round((sourceQty / sourceTotal) * targetQty));
      remainingQty -= scaledQty;

      return {
        ...segment,
        system_suggested_qty: scaledQty,
        final_qty: scaledQty,
        source: '历史快照折算',
        allocation_status: 'history_snapshot_scaled',
        source_confidence: 'medium',
        help_text: `历史快照数量 ${sourceQty} 已按当前采购单数量折算为 ${scaledQty}。`,
        scaled_from_qty: sourceQty,
      };
    });
  }

  private resolvePlanStartDate(
    item: AppAmzBsrPurchaseOrderItemSyncLingxingEntity,
    order: AppAmzBsrPurchaseOrderSyncLingxingEntity | null,
    purchasePlan: AppAmzBsrPurchasePlanLingxingEntity | null
  ) {
    const candidates = [
      {
        source_label: '采购计划表',
        table_name: 'app_amz_bsr_purchase_plan_lingxing',
        field_name: 'create_time_remote',
        source_record_id: (purchasePlan as any)?.id || null,
        value: (purchasePlan as any)?.create_time_remote,
      },
      {
        source_label: '采购计划表',
        table_name: 'app_amz_bsr_purchase_plan_lingxing',
        field_name: 'create_time',
        source_record_id: (purchasePlan as any)?.id || null,
        value: (purchasePlan as any)?.create_time,
      },
      {
        source_label: '采购单明细',
        table_name: 'app_amz_bsr_purchase_order_item_sync_lingxing',
        field_name: 'plan_create_time',
        source_record_id: (item as any)?.id || null,
        value: (item as any)?.plan_create_time,
      },
      {
        source_label: '采购单主表',
        table_name: 'app_amz_bsr_purchase_order_sync_lingxing',
        field_name: 'order_time',
        source_record_id: (order as any)?.id || (order as any)?.order_sn || null,
        value: (order as any)?.order_time,
      },
      {
        source_label: '采购单主表',
        table_name: 'app_amz_bsr_purchase_order_sync_lingxing',
        field_name: 'create_time_remote',
        source_record_id: (order as any)?.id || (order as any)?.order_sn || null,
        value: (order as any)?.create_time_remote,
      },
    ];
    const usedIndex = candidates.findIndex(candidate => Boolean(toDateOnlyLoose(candidate.value)));
    const used = usedIndex >= 0 ? candidates[usedIndex] : null;
    const priorityTrace = candidates.map((candidate, index) => ({
      source_label: candidate.source_label,
      table_name: candidate.table_name,
      field_name: candidate.field_name,
      source_record_id: candidate.source_record_id,
      value: compactSourceValue(candidate.value),
      normalized_value: toDateOnlyLoose(candidate.value),
      used: index === usedIndex,
    }));

    return {
      value: used ? toDateOnlyLoose(used.value) : '',
      source_label: used?.source_label || '人工填写',
      table_name: used?.table_name || '',
      field_name: used?.field_name || '',
      source_record_id: used?.source_record_id || null,
      priority_trace: priorityTrace,
    };
  }

  private buildEmptyPrepareShippingSegments(recommendedMethodKey: string, shippingProfileKey = 'default') {
    return buildManualLinkShippingOptions(shippingProfileKey).map(method => ({
      method_key: method.key,
      method_label: method.label,
      days_to_arrive: method.days,
      color: method.color,
      icon: method.icon,
      active: true,
      start_date: '',
      end_date: '',
      period_days: 0,
      system_suggested_qty: 0,
      purchase_plan_deducted_qty: 0,
      local_pending_delivery_deducted_qty: 0,
      final_qty: 0,
      coefficient: 1,
      raw_coefficient: 1,
      adjusted_coefficient: 1,
      manual_alpha: null,
      alpha_mode: 'system',
      monthly_coefficients: null,
      recommended: method.key === recommendedMethodKey,
      source: method.key === recommendedMethodKey ? '系统推测' : '系统默认',
      allocation_status: 'manual_required',
      source_confidence: method.key === recommendedMethodKey ? 'low' : 'manual_required',
      help_text: method.key === recommendedMethodKey
        ? '系统建议该运输方式；默认启用全部方式，提交前需按覆盖区间推算或人工确认。'
        : '没有历史分段时默认启用，提交前需按覆盖区间推算或人工确认。',
    }));
  }

  private attachPrepareShippingCalculationTrace(
    segments: any[],
    options: {
      planStartDate: string;
      shippingBufferDays: number;
      dailyAvgSales: number;
      volatilityCoefficient: number;
      manualCoefficient: number;
      targetStockDays: number;
    }
  ) {
    const rows = (Array.isArray(segments) ? segments : []).map((segment, index) => ({
      segment,
      index,
      active: segment?.active !== false,
      days: Number(segment?.days_to_arrive) || Number(SHIPPING_METHOD_MAP.get(segment?.method_key)?.days) || 0,
    }));
    const activeRows = rows
      .filter(row => row.active)
      .sort((a, b) => a.days - b.days || a.index - b.index);
    const traceByKey = new Map<string, any>();

    activeRows.forEach((row, index) => {
      const segment = row.segment || {};
      const method = SHIPPING_METHOD_MAP.get(segment.method_key) || {
        key: segment.method_key,
        label: segment.method_label || segment.method_key,
        icon: segment.icon || '',
        color: segment.color || '',
        days: row.days,
      };
      const next = activeRows[index + 1];
      const nextMethod = next
        ? SHIPPING_METHOD_MAP.get(next.segment?.method_key) || {
            label: next.segment?.method_label || next.segment?.method_key,
          }
        : null;
      const arrivalDate = addLooseDays(options.planStartDate, options.shippingBufferDays + row.days);
      const nextArrivalDate = next
        ? addLooseDays(options.planStartDate, options.shippingBufferDays + next.days)
        : '';
      const coverageStartDate = normalizeText(segment.start_date) || arrivalDate;
      const coverageEndDate =
        normalizeText(segment.end_date) ||
        (nextArrivalDate
          ? addLooseDays(nextArrivalDate, -1)
          : addLooseDays(arrivalDate, Math.max(1, Number(options.targetStockDays) || 1) - 1));
      const coverageDays = diffLooseDaysInclusive(coverageStartDate, coverageEndDate);
      const rawSuggestedQty = round2(
        (Number(options.dailyAvgSales) || 0) *
          coverageDays *
          (Number(options.volatilityCoefficient) || 1) *
          (Number(options.manualCoefficient) || 1)
      );
      const suggestedQty = Math.max(0, Math.round(rawSuggestedQty));

      traceByKey.set(segment.method_key, {
        plan_start_date: options.planStartDate,
        buffer_days: options.shippingBufferDays,
        days_to_arrive: row.days,
        arrival_date: arrivalDate,
        coverage_start_date: coverageStartDate,
        coverage_end_date: coverageEndDate,
        coverage_days: coverageDays,
        daily_avg_sales: Number(options.dailyAvgSales) || 0,
        volatility_coefficient: Number(options.volatilityCoefficient) || 1,
        manual_coefficient: Number(options.manualCoefficient) || 1,
        raw_suggested_qty: rawSuggestedQty,
        suggested_qty: suggestedQty,
        final_qty: Number(segment.final_qty) || 0,
        lines: [
          `计划开始 ${options.planStartDate || '-'} + 缓冲 ${options.shippingBufferDays} 天 + ${method.label} ${row.days} 天 = ${arrivalDate || '-'}`,
          next
            ? `本段到达日 ${arrivalDate || '-'} 到下一个方式${nextMethod?.label || ''}到达日前一天 ${coverageEndDate || '-'}，共 ${coverageDays} 天`
            : `本段到达日 ${arrivalDate || '-'} 到目标库存周期结束 ${coverageEndDate || '-'}，共 ${coverageDays} 天`,
          `日均 ${Number(options.dailyAvgSales) || 0} × ${coverageDays} 天 × 波动系数 ${Number(options.volatilityCoefficient) || 1} × 人工系数 ${Number(options.manualCoefficient) || 1} = ${rawSuggestedQty}，取整 ${suggestedQty}`,
        ],
      });
    });

    return rows.map(row => {
      const segment = row.segment || {};
      const method = SHIPPING_METHOD_MAP.get(segment.method_key);
      return {
        ...segment,
        icon: segment.icon || method?.icon || '',
        color: segment.color || method?.color || '',
        calculation_trace: traceByKey.get(segment.method_key) || {
          active: false,
          lines: ['该运输方式未启用，不参与覆盖周期和建议数量推算。'],
        },
      };
    });
  }

  private resolveShippingRecommendation(
    item: AppAmzBsrPurchaseOrderItemSyncLingxingEntity,
    order: AppAmzBsrPurchaseOrderSyncLingxingEntity | null,
    purchasePlan: AppAmzBsrPurchasePlanLingxingEntity | null,
    preparedSegments: any[]
  ) {
    const activeHistory = preparedSegments.find(segment => segment.active);
    if (activeHistory) {
      return {
        method_key: activeHistory.method_key,
        method_label: activeHistory.method_label,
        source: '历史快照',
        confidence: 'high',
        reason: `历史快照已保存 ${activeHistory.method_label} 等运输分段，按历史现场带出`,
      };
    }

    const logistics = this.extractLogisticsSummary(order);
    const startDate = pickFirst((order as any)?.order_time, (order as any)?.create_time_remote, (purchasePlan as any)?.create_time_remote);
    const endDate = pickFirst((item as any)?.expect_arrive_time, (purchasePlan as any)?.expect_arrive_time);
    const leadDays = diffLooseDays(startDate, endDate);
    let nearestMethod = null as any;
    if (leadDays > 0) {
      nearestMethod = DEFAULT_SHIPPING_METHODS.reduce((best, method) => {
        if (!best) return method;
        return Math.abs(method.days - leadDays) < Math.abs(best.days - leadDays) ? method : best;
      }, null as any);
    }

    const logisticsLooksExpress =
      logistics.text && /快递|快运|速运|顺丰|跨越|圆通|中通|申通|韵达|邮政/.test(logistics.text);
    if (logisticsLooksExpress) {
      const express = SHIPPING_METHOD_MAP.get('express');
      return {
        method_key: express.key,
        method_label: express.label,
        source: '系统推测',
        confidence: 'low',
        reason: `采购单物流 ${logistics.text} 只表示历史物流信息，不等同于FBA分段；系统暂建议 ${express.label}`,
      };
    }
    if (nearestMethod) {
      return {
        method_key: nearestMethod.key,
        method_label: nearestMethod.label,
        source: '系统推测',
        confidence: 'low',
        reason: `下单到预计到货约 ${leadDays} 天，最接近 ${nearestMethod.label}${nearestMethod.days} 天，仅作建议`,
      };
    }

    return {
      method_key: '',
      method_label: '',
      source: '',
      confidence: '',
      reason: '',
    };
  }

  private extractLogisticsSummary(order: AppAmzBsrPurchaseOrderSyncLingxingEntity | null) {
    const raw = (order as any)?.logistics_info;
    const list = Array.isArray(raw) ? raw : [];
    const text = list
      .map(item =>
        [item?.logistics_company, item?.logistics_order_no]
          .map(value => normalizeText(value))
          .filter(Boolean)
          .join('/')
      )
      .filter(Boolean)
      .join('；');
    return { list, text };
  }

  private formatWarehouseSource(source: string) {
    if (source === 'purchase_plan') return '采购计划';
    if (source === 'purchase_order_item') return '采购单明细';
    if (source === 'purchase_order') return '采购单';
    return '采购计划快照';
  }

  async complete(param: any = {}) {
    const orderItemId = positiveInteger(param.order_item_id, '采购单明细ID');
    const listingId = positiveInteger(param.listing_id, '店铺商品ID');
    const currentUser = this.getCurrentAdminUser();
    const now = new Date();

    return await this.orderItemRepo.manager.transaction(async manager => {
      const itemRepo = manager.getRepository(AppAmzBsrPurchaseOrderItemSyncLingxingEntity);
      const orderRepo = manager.getRepository(AppAmzBsrPurchaseOrderSyncLingxingEntity);
      const planRepo = manager.getRepository(AppAmzBsrPurchasePlanLingxingEntity);
      const listingRepo = manager.getRepository(AppAmzBsrProductListingLingxingEntity);
      const analysisRepo = manager.getRepository(AppAmzBsrAnalysisRecordLingxingEntity);

      const item = await itemRepo.findOne({ where: { id: orderItemId } });
      if (!item) {
        throw new Error('采购单明细不存在');
      }

      const planSn = normalizeText(item.plan_sn);
      if (!planSn) {
        throw new Error('采购单明细缺少采购计划号，无法补全');
      }

      const order = await orderRepo.findOne({ where: { order_sn: item.order_sn } });
      if (!order) {
        throw new Error('采购单主表不存在');
      }
      if (!DEFAULT_PURCHASE_ORDER_STATUSES.includes(Number(order.status))) {
        throw new Error('只允许补全待到货或已完成采购单');
      }

      const purchasePlan = await planRepo.findOne({ where: { plan_sn: planSn } });
      if (!purchasePlan) {
        throw new Error('本地采购计划不存在，无法补全');
      }

      let linkedValidRecord: AppAmzBsrAnalysisRecordLingxingEntity | null = null;
      if (Number(item.analysis_record_id) > 0) {
        linkedValidRecord = await analysisRepo.findOne({
          where: { id: Number(item.analysis_record_id), status: 1 },
        });
        const linkedPlanSn = normalizeText(linkedValidRecord?.plan_sn);
        if (linkedPlanSn && linkedPlanSn !== planSn) {
          throw new Error('该采购单明细已关联其他采购计划的有效分析记录，不能重复补全');
        }
      }

      const listing = await listingRepo.findOne({ where: { id: listingId } });
      if (!listing) {
        throw new Error('店铺商品不存在');
      }
      if (!normalizeText(listing.asin)) {
        throw new Error('店铺商品缺少 ASIN，无法创建分析记录');
      }
      if (!normalizeText(listing.local_sku)) {
        throw new Error('店铺商品缺少本地SKU，无法创建分析记录');
      }

      const snapshotDraft = this.buildCompleteSnapshotDraft(param, item, purchasePlan);
      const calendarCoefficients = await this.loadManualSnapshotCalendarCoefficients(
        snapshotDraft,
        listing,
        purchasePlan
      );
      const manualPayload = buildManualReplenishmentSnapshotPayload({
        orderItem: item,
        purchaseOrder: order,
        purchasePlan,
        listing,
        draft: snapshotDraft,
        calendarCoefficients,
        currentUser,
      });
      const payload = manualPayload.analysisData;

      let analysisRecord = await analysisRepo.findOne({
        where: { plan_sn: planSn, status: 1 },
        order: { id: 'DESC' },
      });
      const snapshotRepo = manager.getRepository(AppAmzBsrBatchReplenishSnapshotEntity);
      let existingSnapshot: AppAmzBsrBatchReplenishSnapshotEntity | null = null;
      if (!analysisRecord && linkedValidRecord && !normalizeText(linkedValidRecord.plan_sn)) {
        linkedValidRecord.plan_sn = planSn;
        linkedValidRecord.ppg_sn = normalizeText(linkedValidRecord.ppg_sn) || normalizeText(purchasePlan.ppg_sn);
        linkedValidRecord.quantity_plan =
          Number(linkedValidRecord.quantity_plan) || payload.expected_sales.final_replenishment_qty;
        analysisRecord = await analysisRepo.save(linkedValidRecord);
      }
      const reused = Boolean(analysisRecord);

      if (!analysisRecord) {
        analysisRecord = analysisRepo.create({
          store_id: Number(listing.store_id) || Number((purchasePlan as any).sid) || Number(item.sid) || 0,
          asin: normalizeText(listing.asin),
          marketplace:
            normalizeText(listing.marketplace) ||
            normalizeText(purchasePlan.marketplace) ||
            normalizeText(item.plan_marketplace),
          msku: normalizeText(listing.msku) || normalizeText(item.first_msku),
          local_sku:
            normalizeText(listing.local_sku) ||
            normalizeText(purchasePlan.sku) ||
            normalizeText(item.sku),
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
        analysisRecord = await analysisRepo.save(analysisRecord);
      } else {
        existingSnapshot = await snapshotRepo.findOne({
          where: { analysis_record_id: Number(analysisRecord.id) },
          order: { id: 'DESC' },
        });
        if (existingSnapshot?.snapshot_source !== 'batch_replenish') {
          analysisRecord.store_id = Number(listing.store_id) || Number((purchasePlan as any).sid) || Number(item.sid) || 0;
          analysisRecord.asin = normalizeText(listing.asin);
          analysisRecord.marketplace =
            normalizeText(listing.marketplace) ||
            normalizeText(purchasePlan.marketplace) ||
            normalizeText(item.plan_marketplace);
          analysisRecord.msku = normalizeText(listing.msku) || normalizeText(item.first_msku);
          analysisRecord.local_sku = normalizeText(listing.local_sku);
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
          analysisRecord = await analysisRepo.save(analysisRecord);
        }
      }

      const snapshotResult = await this.saveManualReplenishmentSnapshot(snapshotRepo, {
        existingSnapshot,
        analysisRecordId: Number(analysisRecord.id),
        planSn,
        ppgSn: normalizeText(purchasePlan.ppg_sn),
        snapshot: manualPayload.snapshot,
        payload,
        currentUser,
      });

      await manager.query(
        `
          UPDATE app_amz_bsr_purchase_plan_lingxing
          SET analysis_record_id = ?
          WHERE plan_sn = ?
        `,
        [analysisRecord.id, planSn]
      );

      const updateResult = await manager.query(
        `
          UPDATE app_amz_bsr_purchase_order_item_sync_lingxing i
          SET i.analysis_record_id = ?, i.is_analysis_missing = 0
          WHERE i.plan_sn = ?
            AND (
              i.analysis_record_id IS NULL
              OR i.analysis_record_id = 0
              OR i.is_analysis_missing = 1
              OR NOT EXISTS (
                SELECT 1
                FROM app_amz_bsr_analysis_record_lingxing ar
                WHERE ar.id = i.analysis_record_id
                  AND ar.status = 1
              )
            )
        `,
        [analysisRecord.id, planSn]
      );

      return {
        analysis_record_id: analysisRecord.id,
        plan_sn: planSn,
        reused,
        snapshot: snapshotResult,
        updated_order_item_count: updateResult?.affectedRows || updateResult?.[0]?.affectedRows || 0,
      };
    });
  }

  private async loadManualSnapshotCalendarCoefficients(
    draft: ManualReplenishmentSnapshotDraftInput,
    listing: any,
    purchasePlan: any
  ) {
    try {
      const startDate = normalizeDateOnly(draft.cycle_start_date);
      const endDate = normalizeDateOnly(draft.cycle_end_date);
      const range = buildManualSnapshotCalendarRange(startDate, endDate);
      const productCode = normalizeText(
        pickFirst(listing?.product_code, (purchasePlan as any)?.product_code)
      );
      const marketplace = normalizeText(
        pickFirst(listing?.marketplace, purchasePlan?.marketplace)
      );
      if (!productCode || !marketplace || !this.analysisCustomService?.getCalendarCoefficients) {
        return null;
      }

      return await this.analysisCustomService.getCalendarCoefficients(
        productCode,
        marketplace,
        range.startMonth,
        range.endMonth,
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

  private buildCompleteSnapshotDraft(
    param: any,
    item: AppAmzBsrPurchaseOrderItemSyncLingxingEntity,
    purchasePlan: AppAmzBsrPurchasePlanLingxingEntity
  ): ManualReplenishmentSnapshotDraftInput {
    const draft =
      param.snapshot_draft && typeof param.snapshot_draft === 'object'
        ? { ...param.snapshot_draft }
        : null;
    if (draft) {
      const fallbackQty =
        Number(draft.final_purchase_qty) ||
        Number(param.quantity_plan) ||
        Number(item.quantity_plan) ||
        Number(purchasePlan.quantity_plan) ||
        0;
      const hasDraftBoxPcs = Object.prototype.hasOwnProperty.call(draft, 'box_pcs');
      const boxPcs = hasDraftBoxPcs
        ? pickOptionalPositiveIntegerCandidate(draft.box_pcs)
        : pickOptionalPositiveIntegerCandidate(purchasePlan.cg_box_pcs, (item as any).quantity_per_case);
      return {
        ...draft,
        final_purchase_qty: draft.final_purchase_qty ?? fallbackQty,
        actual_purchase_qty_before_box:
          draft.actual_purchase_qty_before_box ?? draft.final_purchase_qty ?? fallbackQty,
        system_suggested_qty: draft.system_suggested_qty ?? draft.final_purchase_qty ?? fallbackQty,
        warehouse_wid: draft.warehouse_wid ?? purchasePlan.wid ?? item.wid,
        warehouse_name: draft.warehouse_name ?? purchasePlan.warehouse_name ?? item.ware_house_name,
        box_pcs: boxPcs,
      };
    }

    const quantityPlan =
      Number(param.quantity_plan) ||
      Number(item.quantity_plan) ||
      Number(purchasePlan.quantity_plan) ||
      0;
    const startDate = normalizeDateOnly(param.cycle_start_date);
    const endDate = normalizeDateOnly(param.cycle_end_date);
    const expectedSalesQty = positiveInteger(param.expected_sales_qty, '预计销量');
    return {
      algorithm_key: 'daily_avg',
      daily_avg_sales: round4(expectedSalesQty / diffDaysInclusive(startDate, endDate)),
      target_stock_days: DEFAULT_TARGET_STOCK_DAYS,
      volatility_coefficient: DEFAULT_VOLATILITY_COEFFICIENT,
      manual_coefficient: DEFAULT_MANUAL_COEFFICIENT,
      cycle_start_date: startDate,
      cycle_end_date: endDate,
      system_suggested_qty: expectedSalesQty,
      actual_purchase_qty_before_box: quantityPlan,
      final_purchase_qty: quantityPlan,
      box_pcs: pickOptionalPositiveIntegerCandidate(
        purchasePlan.cg_box_pcs,
        (item as any).quantity_per_case
      ),
      warehouse_wid: purchasePlan.wid || item.wid || null,
      warehouse_name: purchasePlan.warehouse_name || item.ware_house_name || '',
      shipping_adjust_mode: DEFAULT_SHIPPING_ADJUST_MODE,
      manual_remark: param.manual_remark,
      shipping_segments: [
        {
          method_key: 'express',
          active: true,
          start_date: startDate,
          end_date: endDate,
          period_days: diffDaysInclusive(startDate, endDate),
          system_suggested_qty: expectedSalesQty,
          final_qty: quantityPlan,
          coefficient: 1,
        },
      ],
    };
  }

  private async saveManualReplenishmentSnapshot(
    snapshotRepo: Repository<AppAmzBsrBatchReplenishSnapshotEntity>,
    options: {
      existingSnapshot?: AppAmzBsrBatchReplenishSnapshotEntity | null;
      analysisRecordId: number;
      planSn: string;
      ppgSn: string;
      snapshot: any;
      payload: any;
      currentUser: { userId: number | null; username: string; nickname: string };
    }
  ) {
    let entity =
      options.existingSnapshot ||
      (await snapshotRepo.findOne({
        where: { analysis_record_id: options.analysisRecordId },
        order: { id: 'DESC' },
      }));
    if (entity?.snapshot_source === 'batch_replenish') {
      return {
        saved: false,
        skipped: true,
        protected: true,
        id: entity.id,
        source: entity.snapshot_source,
        message: '已存在批量补货快照，未覆盖',
      };
    }

    const snapshot = options.snapshot || {};
    const identity = snapshot.identity || {};
    const quick = snapshot.quick_fields || {};
    const expectedSales = options.payload?.expected_sales || {};
    if (!entity) {
      entity = snapshotRepo.create();
    }

    entity.analysis_record_id = options.analysisRecordId;
    entity.plan_sn = normalizeNullableText(options.planSn);
    entity.ppg_sn = normalizeNullableText(options.ppgSn);
    entity.store_id = Number(pickFirst(identity.store_id, quick.store_id, options.payload?.store_id)) || null;
    entity.asin = normalizeNullableText(pickFirst(identity.asin, quick.asin, options.payload?.asin));
    entity.msku = normalizeNullableText(pickFirst(identity.msku, quick.msku, options.payload?.msku));
    entity.marketplace = normalizeNullableText(
      pickFirst(identity.marketplace, quick.marketplace, options.payload?.marketplace)
    );
    entity.product_code = normalizeNullableText(
      pickFirst(identity.product_code, quick.product_code, options.payload?.product_code)
    );
    entity.local_sku = normalizeNullableText(
      pickFirst(identity.local_sku, quick.local_sku, options.payload?.local_sku)
    );
    entity.snapshot_version = Number(snapshot.snapshot_version) || 1;
    entity.snapshot_source = normalizeText(snapshot.snapshot_source) || MANUAL_SNAPSHOT_SOURCE;
    entity.algorithm_key = normalizeNullableText(
      pickFirst(quick.algorithm_key, snapshot.input_json?.algorithm?.key, expectedSales.user_selected_algo_key)
    );
    entity.algorithm_name = normalizeNullableText(
      pickFirst(quick.algorithm_name, snapshot.input_json?.algorithm?.name, expectedSales.user_selected_algo_name)
    );
    entity.cycle_start_date = normalizeNullableText(
      pickFirst(quick.cycle_start_date, snapshot.calculation_json?.cycle?.start_date, expectedSales.start_date)
    );
    entity.cycle_end_date = normalizeNullableText(
      pickFirst(quick.cycle_end_date, snapshot.calculation_json?.cycle?.end_date, expectedSales.end_date)
    );
    entity.daily_avg_sales = Number(
      pickFirst(quick.daily_avg_sales, snapshot.input_json?.daily_avg_sales, expectedSales.base_daily_avg_sales)
    ) || null;
    entity.target_stock_days =
      Number(pickFirst(quick.target_stock_days, snapshot.input_json?.target_stock_days)) || null;
    entity.volatility_coefficient =
      Number(
        pickFirst(
          quick.volatility_coefficient,
          snapshot.input_json?.volatility_coefficient,
          snapshot.coefficient_json?.volatility_coefficient,
          expectedSales.volatility_coefficient
        )
      ) || null;
    entity.system_suggested_qty =
      Number(
        pickFirst(
          quick.system_suggested_qty,
          snapshot.calculation_json?.system_suggested_qty,
          expectedSales.system_suggested_qty
        )
      ) || null;
    entity.actual_purchase_qty =
      Number(
        pickFirst(
          quick.actual_purchase_qty,
          snapshot.calculation_json?.actual_purchase_qty_before_box,
          expectedSales.actual_purchase_qty_before_box
        )
      ) || null;
    entity.final_purchase_qty =
      Number(
        pickFirst(
          quick.final_purchase_qty,
          snapshot.calculation_json?.final_purchase_qty,
          expectedSales.final_replenishment_qty
        )
      ) || null;
    entity.warehouse_wid = Number(pickFirst(quick.warehouse_wid, snapshot.input_json?.warehouse?.wid)) || null;
    entity.warehouse_name = normalizeNullableText(
      pickFirst(quick.warehouse_name, snapshot.input_json?.warehouse?.name)
    );
    entity.adjust_mode = normalizeNullableText(pickFirst(quick.adjust_mode, snapshot.adjustment_json?.mode));
    entity.box_pcs =
      Number(pickFirst(quick.box_pcs, snapshot.calculation_json?.box_adjustment?.box_pcs, expectedSales.box_pcs)) ||
      null;
    entity.summary_json = cloneJson(snapshot.summary_json || null);
    entity.input_json = cloneJson(snapshot.input_json || null);
    entity.calculation_json = cloneJson(snapshot.calculation_json || null);
    entity.shipping_json = cloneJson(snapshot.shipping_json || null);
    entity.adjustment_json = cloneJson(snapshot.adjustment_json || null);
    entity.coefficient_json = cloneJson(snapshot.coefficient_json || null);
    entity.inventory_json = cloneJson(snapshot.inventory_json || null);
    entity.remark_json = cloneJson(snapshot.remark_json || null);
    entity.ui_snapshot_json = cloneJson(snapshot.ui_snapshot_json || null);
    entity.full_snapshot_json = cloneJson(snapshot.full_snapshot_json || snapshot);
    entity.created_by = options.currentUser.userId;
    entity.created_by_name = normalizeText(options.currentUser.nickname || options.currentUser.username);

    const saved = await snapshotRepo.save(entity);
    return {
      saved: true,
      skipped: false,
      protected: false,
      id: saved.id,
      source: saved.snapshot_source,
      message: '人工历史补全快照已保存',
    };
  }

  private buildWarehouseSuggestions(
    item: AppAmzBsrPurchaseOrderItemSyncLingxingEntity,
    purchasePlan: AppAmzBsrPurchasePlanLingxingEntity | null,
    order?: AppAmzBsrPurchaseOrderSyncLingxingEntity | null
  ) {
    const result: Array<{ wid: number; name: string; source: string }> = [];
    const add = (wid: any, name: any, source: string) => {
      const id = Number(wid) || 0;
      const text = normalizeText(name);
      if (!id && !text) return;
      if (result.some(row => row.wid === id && row.name === text)) return;
      result.push({ wid: id || null, name: text, source });
    };
    add(purchasePlan?.wid, purchasePlan?.warehouse_name, 'purchase_plan');
    add(item.wid, item.ware_house_name, 'purchase_order_item');
    add((order as any)?.wid, (order as any)?.ware_house_name, 'purchase_order');
    add(null, item.plan_warehouse_name, 'purchase_order_plan_snapshot');
    return result;
  }

  private mapOrderItemForPrepare(item: AppAmzBsrPurchaseOrderItemSyncLingxingEntity) {
    return {
      id: item.id,
      order_sn: item.order_sn,
      item_id: item.item_id,
      plan_sn: item.plan_sn,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      fnsku: item.fnsku,
      msku: item.msku,
      first_msku: item.first_msku,
      sid: item.sid,
      wid: item.wid,
      ware_house_name: item.ware_house_name,
      quantity_plan: Number(item.quantity_plan) || 0,
      quantity_real: Number(item.quantity_real) || 0,
      quantity_entry: Number(item.quantity_entry) || 0,
      quantity_receive: Number(item.quantity_receive) || 0,
      expect_arrive_time: item.expect_arrive_time,
      analysis_record_id: item.analysis_record_id || null,
      is_analysis_missing: Number(item.is_analysis_missing) || 0,
    };
  }

  private getSnapshotSourceLabel(source: any) {
    const text = normalizeText(source);
    if (text === 'batch_replenish') return '批量补货生成';
    if (text === MANUAL_SNAPSHOT_SOURCE) return MANUAL_SNAPSHOT_LABEL;
    if (text === 'ui_batch_ship_test') return '批量发货测试';
    return text ? text : '暂无快照';
  }

  private async countCompletedRows(param: ManualLinkCompletedPageParam) {
    const base = this.buildCompletedBaseQuery(param);
    const rows = await this.batchSnapshotRepo.query(
      `
        SELECT COUNT(*) AS total
        ${base.sql}
      `,
      base.params
    );
    return Number(rows?.[0]?.total) || 0;
  }

  private async queryCompletedRows(param: ManualLinkCompletedPageParam, page: number, size: number) {
    const base = this.buildCompletedBaseQuery(param);
    const rows = await this.batchSnapshotRepo.query(
      `
        SELECT
          s.id AS snapshot_id,
          s.analysis_record_id,
          s.plan_sn,
          s.ppg_sn,
          s.store_id,
          s.asin,
          s.msku,
          s.marketplace,
          s.product_code,
          s.local_sku,
          s.snapshot_source,
          s.algorithm_key,
          s.algorithm_name,
          s.cycle_start_date,
          s.cycle_end_date,
          s.daily_avg_sales,
          s.target_stock_days,
          s.volatility_coefficient,
          s.system_suggested_qty,
          s.actual_purchase_qty,
          s.final_purchase_qty,
          s.warehouse_wid,
          s.warehouse_name,
          s.adjust_mode,
          s.box_pcs,
          s.calculation_json,
          s.shipping_json,
          s.coefficient_json,
          s.inventory_json,
          s.remark_json,
          s.created_by,
          s.created_by_name,
          s.\`createTime\` AS snapshot_create_time,
          s.\`updateTime\` AS snapshot_update_time,
          ar.staged_by_user_id,
          ar.staged_by_username,
          ar.staged_by_nickname,
          ar.staged_time,
          ar.purchase_plan_created_by_user_id,
          ar.purchase_plan_created_by_username,
          ar.purchase_plan_created_by_nickname,
          ar.purchase_plan_created_time,
          item_agg.linked_order_item_count,
          item_agg.linked_order_count,
          item_agg.order_sns,
          i.id AS representative_order_item_id,
          i.order_sn AS representative_order_sn,
          i.product_name AS order_item_product_name,
          i.sku AS order_item_sku,
          i.fnsku AS order_item_fnsku,
          i.first_msku AS order_item_first_msku,
          i.plan_pic_url AS order_item_pic_url,
          o.status AS order_status,
          o.status_text AS order_status_text,
          o.status_shipped_text AS arrival_status_text,
          o.order_time,
          pp.id AS purchase_plan_id,
          pp.product_name AS purchase_plan_product_name,
          pp.pic_url AS purchase_plan_pic_url,
          pp.seller_name AS purchase_plan_seller_name,
          pp.marketplace AS purchase_plan_marketplace,
          pp.quantity_plan AS purchase_plan_quantity_plan,
          pp.warehouse_name AS purchase_plan_warehouse_name,
          pp.status_text AS purchase_plan_status_text
        ${base.sql}
        ORDER BY COALESCE(s.\`updateTime\`, s.\`createTime\`) DESC, s.id DESC
        LIMIT ? OFFSET ?
      `,
      [...base.params, size, (page - 1) * size]
    );
    return rows;
  }

  private buildCompletedBaseQuery(param: ManualLinkCompletedPageParam = {}): ManualLinkBaseQueryResult {
    const conditions: string[] = ['s.snapshot_source = ?'];
    const params: any[] = [MANUAL_SNAPSHOT_SOURCE];

    const keyword = normalizeText(param.keyWord || param.keyword);
    if (keyword) {
      const like = `%${keyword}%`;
      conditions.push(`(
        s.plan_sn LIKE ?
        OR s.ppg_sn LIKE ?
        OR s.asin LIKE ?
        OR s.msku LIKE ?
        OR s.local_sku LIKE ?
        OR s.product_code LIKE ?
        OR s.created_by_name LIKE ?
        OR ar.purchase_plan_created_by_username LIKE ?
        OR ar.purchase_plan_created_by_nickname LIKE ?
        OR item_agg.order_sns LIKE ?
        OR i.product_name LIKE ?
        OR i.sku LIKE ?
        OR i.first_msku LIKE ?
        OR pp.product_name LIKE ?
        OR pp.seller_name LIKE ?
      )`);
      params.push(
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like
      );
    }

    this.addInCondition(conditions, params, 's.plan_sn', param.plan_sn);
    const orderSns = normalizeArrayParam(param.order_sn);
    if (orderSns.length > 0) {
      conditions.push(`(${orderSns.map(() => 'item_agg.order_sns LIKE ?').join(' OR ')})`);
      params.push(...orderSns.map(orderSn => `%${orderSn}%`));
    }
    this.addInCondition(conditions, params, 's.marketplace', param.marketplace);
    this.addInCondition(conditions, params, 's.store_id', param.store_id);
    this.addInCondition(conditions, params, 'pp.seller_name', param.seller_name);
    this.addInCondition(conditions, params, 's.created_by', param.created_by);
    this.addInCondition(conditions, params, 's.created_by_name', param.created_by_name);

    return {
      sql: `
        FROM app_amz_bsr_batch_replenish_snapshot s
        LEFT JOIN app_amz_bsr_analysis_record_lingxing ar
          ON ar.id = s.analysis_record_id
        LEFT JOIN (
          SELECT
            analysis_record_id,
            MIN(id) AS representative_order_item_id,
            COUNT(*) AS linked_order_item_count,
            COUNT(DISTINCT order_sn) AS linked_order_count,
            GROUP_CONCAT(DISTINCT order_sn ORDER BY order_sn SEPARATOR ', ') AS order_sns
          FROM app_amz_bsr_purchase_order_item_sync_lingxing
          WHERE analysis_record_id IS NOT NULL
            AND analysis_record_id > 0
          GROUP BY analysis_record_id
        ) item_agg
          ON item_agg.analysis_record_id = s.analysis_record_id
        LEFT JOIN app_amz_bsr_purchase_order_item_sync_lingxing i
          ON i.id = item_agg.representative_order_item_id
        LEFT JOIN app_amz_bsr_purchase_order_sync_lingxing o
          ON o.order_sn = i.order_sn
        LEFT JOIN app_amz_bsr_purchase_plan_lingxing pp
          ON pp.plan_sn = s.plan_sn
        WHERE ${conditions.join(' AND ')}
      `,
      params,
    };
  }

  private mapCompletedRow(row: any) {
    const quality = this.getCompletedSnapshotQuality(row);
    return {
      snapshot_id: row.snapshot_id,
      analysis_record_id: row.analysis_record_id || null,
      plan_sn: row.plan_sn || '',
      ppg_sn: row.ppg_sn || '',
      snapshot_source: row.snapshot_source || '',
      snapshot_label: this.getSnapshotSourceLabel(row.snapshot_source),
      snapshot_quality: quality,
      completed_time: row.snapshot_update_time || row.snapshot_create_time || null,
      created_by: row.created_by || null,
      created_by_name:
        row.created_by_name ||
        row.purchase_plan_created_by_nickname ||
        row.purchase_plan_created_by_username ||
        row.staged_by_nickname ||
        row.staged_by_username ||
        '',
      linked_order_item_count: Number(row.linked_order_item_count) || 0,
      linked_order_count: Number(row.linked_order_count) || 0,
      order_sns: normalizeText(row.order_sns)
        .split(',')
        .map(item => item.trim())
        .filter(Boolean),
      representative_order_sn: row.representative_order_sn || '',
      purchase_order: {
        order_sn: row.representative_order_sn || '',
        status: row.order_status || null,
        status_text: row.order_status_text || '',
        arrival_status_text: row.arrival_status_text || '',
        order_time: row.order_time || null,
      },
      order_item: {
        id: row.representative_order_item_id || null,
        product_name: row.order_item_product_name || row.purchase_plan_product_name || '',
        sku: row.order_item_sku || '',
        fnsku: row.order_item_fnsku || '',
        first_msku: row.order_item_first_msku || '',
        image_url: row.order_item_pic_url || row.purchase_plan_pic_url || '',
      },
      purchase_plan: {
        id: row.purchase_plan_id || null,
        plan_sn: row.plan_sn || '',
        ppg_sn: row.ppg_sn || '',
        product_name: row.purchase_plan_product_name || '',
        pic_url: row.purchase_plan_pic_url || '',
        seller_name: row.purchase_plan_seller_name || '',
        marketplace: row.purchase_plan_marketplace || row.marketplace || '',
        quantity_plan: Number(row.purchase_plan_quantity_plan) || 0,
        warehouse_name: row.purchase_plan_warehouse_name || '',
        status_text: row.purchase_plan_status_text || '',
      },
      listing: {
        store_id: row.store_id || null,
        asin: row.asin || '',
        msku: row.msku || '',
        marketplace: row.marketplace || '',
        product_code: row.product_code || '',
        local_sku: row.local_sku || '',
      },
      replenish: {
        algorithm_key: row.algorithm_key || '',
        algorithm_name: row.algorithm_name || '',
        cycle_start_date: row.cycle_start_date || '',
        cycle_end_date: row.cycle_end_date || '',
        daily_avg_sales: Number(row.daily_avg_sales) || 0,
        target_stock_days: Number(row.target_stock_days) || 0,
        volatility_coefficient: Number(row.volatility_coefficient) || 0,
        system_suggested_qty: Number(row.system_suggested_qty) || 0,
        actual_purchase_qty: Number(row.actual_purchase_qty) || 0,
        final_purchase_qty: Number(row.final_purchase_qty) || 0,
        warehouse_wid: row.warehouse_wid || null,
        warehouse_name: row.warehouse_name || row.purchase_plan_warehouse_name || '',
        box_pcs: Number(row.box_pcs) || null,
      },
    };
  }

  private getCompletedSnapshotQuality(row: any) {
    const missingSections: string[] = [];
    if (!this.isMeaningfulCompletedSnapshotSection('calculation_json', row.calculation_json)) {
      missingSections.push('calculation_json');
    }
    if (!this.isMeaningfulCompletedSnapshotSection('shipping_json', row.shipping_json)) {
      missingSections.push('shipping_json');
    }
    if (!this.isMeaningfulCompletedSnapshotSection('coefficient_json', row.coefficient_json)) {
      missingSections.push('coefficient_json');
    }
    if (!this.isMeaningfulCompletedSnapshotSection('inventory_json', row.inventory_json)) {
      missingSections.push('inventory_json');
    }
    const complete = missingSections.length === 0;
    return {
      trace_level: complete ? 'full_record' : 'legacy_snapshot',
      snapshot_label: complete ? '完整记录' : '旧版快照',
      missing_sections: missingSections,
      restorable: complete,
    };
  }

  private isMeaningfulCompletedSnapshotSection(key: string, value: any) {
    const parsed = this.parseCompletedSnapshotJson(value);
    if (key === 'shipping_json') {
      return this.hasNonEmptyCompletedSnapshotArray(parsed?.segments) ||
        this.hasNonEmptyCompletedSnapshotArray(parsed?.actual_shipping_breakdown) ||
        this.hasNonEmptyCompletedSnapshotArray(parsed?.shipping_segments);
    }
    if (key === 'coefficient_json') {
      return this.hasNonEmptyCompletedSnapshotArray(parsed?.five_month_rows) ||
        this.isMeaningfulCompletedSnapshotValue(parsed?.segment_alpha_details) ||
        this.isMeaningfulCompletedSnapshotValue(parsed?.window_calculation);
    }
    if (key === 'calculation_json') {
      return this.isMeaningfulCompletedSnapshotValue(parsed);
    }
    if (key === 'inventory_json') {
      return Boolean(parsed && typeof parsed === 'object' && Object.keys(parsed).some(
        key => parsed[key] !== undefined && parsed[key] !== null
      ));
    }
    return this.isMeaningfulCompletedSnapshotValue(parsed);
  }

  private isMeaningfulCompletedSnapshotValue(value: any): boolean {
    const parsed = this.parseCompletedSnapshotJson(value);
    if (Array.isArray(parsed)) return parsed.length > 0;
    if (parsed && typeof parsed === 'object') {
      return Object.keys(parsed).some(key => this.isMeaningfulCompletedSnapshotValue(parsed[key]));
    }
    return parsed !== undefined && parsed !== null && parsed !== '';
  }

  private hasNonEmptyCompletedSnapshotArray(value: any) {
    const parsed = this.parseCompletedSnapshotJson(value);
    return Array.isArray(parsed) && parsed.length > 0;
  }

  private parseCompletedSnapshotJson(value: any) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  private async countManualLinkRows(param: ManualLinkPageParam) {
    const base = this.buildBaseQuery(param);
    const rows = await this.orderItemRepo.query(
      `
        SELECT COUNT(*) AS total
        ${base.sql}
      `,
      base.params
    );
    return Number(rows?.[0]?.total) || 0;
  }

  private async queryManualLinkRows(param: ManualLinkPageParam, page?: number, size?: number) {
    const base = this.buildBaseQuery(param);
    const limitSql = page && size ? 'LIMIT ? OFFSET ?' : '';
    const params = [...base.params];
    if (page && size) {
      params.push(size, (page - 1) * size);
    }

    const rows = await this.orderItemRepo.query(
      `
        SELECT
          i.id AS order_item_id,
          i.order_sn,
          i.item_id,
          i.plan_sn,
          i.product_id,
          i.product_name,
          i.sku,
          i.fnsku,
          i.msku,
          i.first_msku,
          i.sid,
          i.wid,
          i.ware_house_name,
          i.quantity_plan,
          i.quantity_real,
          i.quantity_entry,
          i.quantity_receive,
          i.quantity_per_case,
          i.expect_arrive_time,
          i.analysis_record_id,
          i.is_analysis_missing,
          i.plan_pic_url,
          i.plan_creator_name,
          i.plan_create_time,
          i.plan_supplier_name,
          i.plan_warehouse_name,
          i.plan_seller_name,
          i.plan_marketplace,
          o.status AS order_status,
          o.status_text AS order_status_text,
          o.status_shipped AS arrival_status,
          o.status_shipped_text AS arrival_status_text,
          o.wid AS order_wid,
          o.custom_order_sn AS order_custom_order_sn,
          o.pay_status_text AS order_pay_status_text,
          o.supplier_name AS order_supplier_name,
          o.ware_house_name AS order_warehouse_name,
          o.quantity_total AS order_quantity,
          o.quantity_real AS order_quantity_real,
          o.quantity_entry AS order_quantity_entry,
          o.quantity_receive AS order_quantity_receive,
          o.create_time_remote AS order_create_time_remote,
          o.order_time,
          o.update_time_remote AS order_update_time_remote,
          pp.id AS purchase_plan_id,
          pp.ppg_sn AS purchase_plan_ppg_sn,
          pp.sku AS purchase_plan_local_sku,
          pp.product_name AS purchase_plan_product_name,
          pp.pic_url AS purchase_plan_pic_url,
          pp.fnsku AS purchase_plan_fnsku,
          pp.msku AS purchase_plan_msku,
          pp.sid AS purchase_plan_sid,
          pp.seller_name AS purchase_plan_seller_name,
          pp.marketplace AS purchase_plan_marketplace,
          pp.quantity_plan AS purchase_plan_quantity_plan,
          pp.wid AS purchase_plan_wid,
          pp.warehouse_name AS purchase_plan_warehouse_name,
          pp.cg_box_pcs AS purchase_plan_cg_box_pcs,
          pp.supplier_name AS purchase_plan_supplier_name,
          pp.expect_arrive_time AS purchase_plan_expect_arrive_time,
          pp.status AS purchase_plan_status,
          pp.status_text AS purchase_plan_status_text,
          pp.analysis_record_id AS purchase_plan_analysis_record_id,
          pp.create_time_remote AS purchase_plan_create_time_remote,
          pp.update_time_remote AS purchase_plan_update_time_remote,
          manual_link_shelf.id AS manual_link_shelf_id,
          manual_link_shelf.shelved AS manual_link_shelf_shelved,
          manual_link_shelf.shelved_remark AS manual_link_shelf_remark,
          manual_link_shelf.shelved_by_user_id AS manual_link_shelf_by_user_id,
          manual_link_shelf.shelved_by_username AS manual_link_shelf_by_username,
          manual_link_shelf.shelved_by_nickname AS manual_link_shelf_by_nickname,
          manual_link_shelf.shelved_time AS manual_link_shelf_time
        ${base.sql}
        ORDER BY o.create_time_remote DESC, i.id DESC
        ${limitSql}
      `,
      params
    );
    await this.attachCandidateListingIds(rows);
    return rows;
  }

  private buildBaseQuery(param: ManualLinkPageParam = {}): ManualLinkBaseQueryResult {
    const includeNoPlanBlocked = param.include_no_plan_blocked === true;
    const workStatus = normalizeManualLinkWorkStatus(param.work_status);
    const conditions: string[] = [
      '(i.is_delete IS NULL OR i.is_delete = 0)',
      '(o.is_deleted_remote IS NULL OR o.is_deleted_remote = 0)',
      includeNoPlanBlocked
        ? `(
          i.plan_sn IS NULL
          OR i.plan_sn = ''
          OR i.analysis_record_id IS NULL
          OR i.analysis_record_id = 0
          OR i.is_analysis_missing = 1
          OR ar.id IS NULL
        )`
        : `(
          i.analysis_record_id IS NULL
          OR i.analysis_record_id = 0
          OR i.is_analysis_missing = 1
          OR ar.id IS NULL
        )`,
    ];
    const params: any[] = [];
    const statuses = this.normalizePurchaseOrderStatuses(param);
    if (statuses.length > 0) {
      conditions.push(`o.status IN (${statuses.map(() => '?').join(', ')})`);
      params.push(...statuses);
    }

    if (!includeNoPlanBlocked) {
      conditions.push("i.plan_sn IS NOT NULL AND i.plan_sn != ''");
    }

    const keyword = normalizeText(param.keyWord || param.keyword);
    if (keyword) {
      const like = `%${keyword}%`;
      conditions.push(`(
        o.order_sn LIKE ?
        OR i.plan_sn LIKE ?
        OR i.product_name LIKE ?
        OR i.sku LIKE ?
        OR i.first_msku LIKE ?
        OR pp.sku LIKE ?
        OR pp.ppg_sn LIKE ?
        OR pp.seller_name LIKE ?
      )`);
      params.push(like, like, like, like, like, like, like, like);
    }

    this.addInCondition(conditions, params, 'o.order_sn', param.order_sn);
    this.addInCondition(conditions, params, 'i.id', param.order_item_id);
    this.addInCondition(conditions, params, 'i.plan_sn', param.plan_sn);
    this.addInCondition(conditions, params, 'COALESCE(pp.marketplace, i.plan_marketplace)', param.marketplace);
    this.addInCondition(conditions, params, 'COALESCE(pp.sid, i.sid)', param.store_id);
    this.addInCondition(conditions, params, 'COALESCE(pp.seller_name, i.plan_seller_name)', param.seller_name);

    if (workStatus === 'shelved') {
      conditions.push('manual_link_shelf.shelved = 1');
    } else {
      conditions.push('(manual_link_shelf.shelved IS NULL OR manual_link_shelf.shelved = 0)');
    }

    return {
      sql: `
        FROM app_amz_bsr_purchase_order_item_sync_lingxing i
        INNER JOIN app_amz_bsr_purchase_order_sync_lingxing o
          ON o.order_sn = i.order_sn
        LEFT JOIN app_amz_bsr_purchase_order_manual_link_shelf manual_link_shelf
          ON manual_link_shelf.order_item_id = i.id
        LEFT JOIN app_amz_bsr_analysis_record_lingxing ar
          ON ar.id = i.analysis_record_id
          AND ar.status = 1
        LEFT JOIN app_amz_bsr_purchase_plan_lingxing pp
          ON pp.plan_sn = i.plan_sn
        WHERE ${conditions.join(' AND ')}
      `,
      params,
    };
  }

  private async loadManualLinkShelfSourceItemsByIds(orderItemIds: number[]) {
    const idSet = new Set(orderItemIds);
    const result: any[] = [];
    for (const chunk of this.chunkList(orderItemIds, 500)) {
      const rows = await this.orderItemRepo.find({
        where: { id: In(chunk) } as any,
      });
      result.push(...rows);
    }
    return result.filter(item => idSet.has(Number((item as any).id)));
  }

  private async queryManualLinkShelfTargetItems(param: ManualLinkPageParam) {
    const base = this.buildBaseQuery(param);
    return await this.orderItemRepo.query(
      `
        SELECT
          i.id AS order_item_id,
          i.order_sn,
          i.item_id,
          i.plan_sn,
          i.relation_purchase_plan,
          i.product_name,
          i.sku
        ${base.sql}
        ORDER BY o.create_time_remote DESC, i.id DESC
      `,
      base.params
    );
  }

  private async updateManualLinkShelfState(
    sourceItems: any[],
    shelved: boolean,
    inputRemark?: any
  ) {
    const orderItemIds = Array.from(
      new Set(
        sourceItems
          .map(item => Number(item.order_item_id || item.id))
          .filter(id => Number.isFinite(id) && id > 0)
      )
    );
    if (!orderItemIds.length) {
      throw new Error(shelved ? '没有可搁置的采购单产品明细' : '没有可恢复的采购单产品明细');
    }

    const existingMap = new Map<number, AppAmzBsrPurchaseOrderManualLinkShelfEntity>();
    for (const chunk of this.chunkList(orderItemIds, 500)) {
      const rows = await this.manualLinkShelfRepo.find({
        where: { order_item_id: In(chunk) } as any,
      });
      for (const row of rows) {
        existingMap.set(Number(row.order_item_id), row);
      }
    }

    const user = this.getCurrentAdminUser();
    const now = new Date();
    const remark =
      normalizeText(inputRemark) ||
      (shelved ? '历史数据，暂不处理' : '恢复到待处理列表');
    const batchId = createManualLinkShelfBatchId();
    const result = {
      total: orderItemIds.length,
      success_count: 0,
      failed_count: 0,
      batch_id: batchId,
      items: [] as any[],
    };

    for (const source of sourceItems) {
      const orderItemId = Number(source.order_item_id || source.id) || 0;
      if (!orderItemId) {
        continue;
      }

      try {
        const existing = existingMap.get(orderItemId) || null;
        const beforeShelved = Number(existing?.shelved) || 0;
        if (!existing && !shelved) {
          result.success_count += 1;
          result.items.push({
            order_item_id: orderItemId,
            success: true,
            changed: false,
            shelved: 0,
          });
          continue;
        }

        const shelf: AppAmzBsrPurchaseOrderManualLinkShelfEntity =
          existing ||
          (this.manualLinkShelfRepo.create({
            order_item_id: orderItemId,
          }) as AppAmzBsrPurchaseOrderManualLinkShelfEntity);
        shelf.order_item_id = orderItemId;
        shelf.order_sn = normalizeText(source.order_sn);
        shelf.item_id = normalizeText(source.item_id);
        shelf.plan_sn = normalizeText(source.plan_sn);
        shelf.linked_plan_sns = this.normalizeManualLinkShelfPlanSns(source);
        shelf.product_name = normalizeText(source.product_name);
        shelf.sku = normalizeText(source.sku);
        shelf.shelved = shelved ? 1 : 0;
        if (shelved) {
          shelf.shelved_remark = remark;
          shelf.shelved_by_user_id = user.userId;
          shelf.shelved_by_username = user.username;
          shelf.shelved_by_nickname = user.nickname;
          shelf.shelved_time = now;
        }

        const saved = (await this.manualLinkShelfRepo.save(
          shelf
        )) as AppAmzBsrPurchaseOrderManualLinkShelfEntity;
        await this.manualLinkShelfLogRepo.save(
          this.manualLinkShelfLogRepo.create({
            shelf_id: Number(saved.id) || null,
            batch_id: batchId,
            order_item_id: orderItemId,
            order_sn: shelf.order_sn,
            item_id: shelf.item_id,
            plan_sn: shelf.plan_sn,
            action_type: shelved ? 'shelf' : 'unshelf',
            before_shelved: beforeShelved,
            after_shelved: shelved ? 1 : 0,
            operator_user_id: user.userId,
            operator_username: user.username,
            operator_nickname: user.nickname,
            remark,
          } as any)
        );

        result.success_count += 1;
        result.items.push({
          order_item_id: orderItemId,
          order_sn: shelf.order_sn,
          item_id: shelf.item_id,
          success: true,
          changed: beforeShelved !== (shelved ? 1 : 0),
          shelved: shelved ? 1 : 0,
        });
      } catch (e: any) {
        result.failed_count += 1;
        result.items.push({
          order_item_id: orderItemId,
          success: false,
          error: e?.message || (shelved ? '搁置失败' : '恢复失败'),
        });
      }
    }

    return result;
  }

  private normalizeManualLinkShelfPlanSns(source: any) {
    return Array.from(
      new Set(
        [
          normalizeText(source.plan_sn),
          ...this.parseJsonStringArray(
            source.relation_purchase_plan || source.linked_plan_sns
          ),
        ].filter(Boolean)
      )
    );
  }

  private chunkList<T>(list: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < list.length; index += size) {
      chunks.push(list.slice(index, index + size));
    }
    return chunks;
  }

  private async mapRows(rows: any[]) {
    const candidateIds = [
      ...new Set(
        rows
          .map(row => selectedCandidateListingId({
            has_plan_sn: Boolean(normalizeText(row.plan_sn)),
            has_purchase_plan: Boolean(row.purchase_plan_id),
            item_candidate_listing_id: row.item_candidate_listing_id,
            plan_sku_candidate_listing_id: row.plan_sku_candidate_listing_id,
            plan_msku_candidate_listing_id: row.plan_msku_candidate_listing_id,
          }))
          .filter(id => Number(id) > 0)
      ),
    ] as number[];
    const listings = candidateIds.length
      ? await this.listingRepo.find({ where: { id: In(candidateIds) } })
      : [];
    const listingMap = new Map(listings.map(item => [Number(item.id), this.mapListing(item)]));

    return rows.map(row => {
      const classification = this.classifyRow(row);
      const suggestedListingId = classification.suggested_listing_id;
      return {
        order_group_key: row.order_sn,
        order_item_id: Number(row.order_item_id),
        order_sn: row.order_sn,
        plan_sn: row.plan_sn || '',
        match_status: classification.match_status,
        blocked_reason: classification.blocked_reason,
        suggested_listing_id: suggestedListingId,
        suggested_listing: suggestedListingId ? listingMap.get(suggestedListingId) || null : null,
        item: {
          item_id: row.item_id,
          product_id: row.product_id,
          product_name: row.product_name,
          sku: row.sku,
          fnsku: row.fnsku,
          msku: row.msku,
          first_msku: row.first_msku,
          sid: row.sid,
          wid: row.wid,
          ware_house_name: row.ware_house_name,
          quantity_plan: Number(row.quantity_plan) || 0,
          quantity_real: Number(row.quantity_real) || 0,
          quantity_entry: Number(row.quantity_entry) || 0,
          quantity_receive: Number(row.quantity_receive) || 0,
          quantity_per_case: Number(row.quantity_per_case) || 0,
          expect_arrive_time: row.expect_arrive_time,
          analysis_record_id: row.analysis_record_id || null,
          is_analysis_missing: Number(row.is_analysis_missing) || 0,
          plan_pic_url: row.plan_pic_url,
          plan_creator_name: row.plan_creator_name,
          plan_create_time: row.plan_create_time,
          plan_supplier_name: row.plan_supplier_name,
          plan_warehouse_name: row.plan_warehouse_name,
          plan_seller_name: row.plan_seller_name,
          plan_marketplace: row.plan_marketplace,
        },
        purchase_order: {
          order_sn: row.order_sn,
          status: row.order_status,
          status_text: row.order_status_text,
          arrival_status: row.arrival_status,
          arrival_status_text: row.arrival_status_text,
          wid: row.order_wid || null,
          custom_order_sn: row.order_custom_order_sn,
          pay_status_text: row.order_pay_status_text,
          supplier_name: row.order_supplier_name,
          warehouse_name: row.order_warehouse_name,
          quantity: Number(row.order_quantity) || 0,
          quantity_real: Number(row.order_quantity_real) || 0,
          quantity_entry: Number(row.order_quantity_entry) || 0,
          quantity_receive: Number(row.order_quantity_receive) || 0,
          create_time_remote: row.order_create_time_remote,
          order_time: row.order_time,
          update_time_remote: row.order_update_time_remote,
        },
        purchase_plan: row.purchase_plan_id
          ? {
              id: Number(row.purchase_plan_id),
              plan_sn: row.plan_sn,
              ppg_sn: row.purchase_plan_ppg_sn,
              sku: row.purchase_plan_local_sku,
              product_name: row.purchase_plan_product_name,
              pic_url: row.purchase_plan_pic_url,
              fnsku: row.purchase_plan_fnsku,
              msku: row.purchase_plan_msku,
              sid: row.purchase_plan_sid,
              seller_name: row.purchase_plan_seller_name,
              marketplace: row.purchase_plan_marketplace,
              quantity_plan: Number(row.purchase_plan_quantity_plan) || 0,
              wid: row.purchase_plan_wid || null,
              warehouse_name: row.purchase_plan_warehouse_name,
              cg_box_pcs: Number(row.purchase_plan_cg_box_pcs) || 0,
              supplier_name: row.purchase_plan_supplier_name,
              expect_arrive_time: row.purchase_plan_expect_arrive_time,
              status: row.purchase_plan_status,
              status_text: row.purchase_plan_status_text,
              analysis_record_id: row.purchase_plan_analysis_record_id || null,
              create_time_remote: row.purchase_plan_create_time_remote,
              update_time_remote: row.purchase_plan_update_time_remote,
            }
          : null,
        candidate_sources: {
          item_first_msku_listing_id: row.item_candidate_listing_id || null,
          plan_local_sku_listing_id: row.plan_sku_candidate_listing_id || null,
          plan_msku_listing_id: row.plan_msku_candidate_listing_id || null,
        },
        manual_link_shelf: row.manual_link_shelf_id
          ? {
              id: Number(row.manual_link_shelf_id),
              shelved: Number(row.manual_link_shelf_shelved) || 0,
              shelved_remark: row.manual_link_shelf_remark || '',
              shelved_by_user_id: row.manual_link_shelf_by_user_id || null,
              shelved_by_username: row.manual_link_shelf_by_username || '',
              shelved_by_nickname: row.manual_link_shelf_by_nickname || '',
              shelved_time: row.manual_link_shelf_time || null,
            }
          : {
              id: null,
              shelved: 0,
              shelved_remark: '',
              shelved_by_user_id: null,
              shelved_by_username: '',
              shelved_by_nickname: '',
              shelved_time: null,
            },
      };
    });
  }

  private async attachCandidateListingIds(rows: any[]) {
    if (!rows.length) {
      return;
    }

    const storeMskuMap = new Map<string, Set<string>>();
    const storeLocalSkuMap = new Map<string, Set<string>>();
    const rowPlanMskus = new Map<any, string[]>();

    for (const row of rows) {
      const itemStoreId = normalizeText(row.sid);
      const firstMsku = normalizeText(row.first_msku);
      if (itemStoreId && firstMsku) {
        this.addStoreValue(storeMskuMap, itemStoreId, firstMsku);
      }

      const planStoreId = normalizeText(row.purchase_plan_sid || row.sid);
      const planLocalSku = normalizeText(row.purchase_plan_local_sku);
      if (planStoreId && planLocalSku) {
        this.addStoreValue(storeLocalSkuMap, planStoreId, planLocalSku);
      }

      const planMskus = this.parseJsonStringArray(row.purchase_plan_msku);
      rowPlanMskus.set(row.order_item_id, planMskus);
      for (const msku of planMskus) {
        if (planStoreId && msku) {
          this.addStoreValue(storeMskuMap, planStoreId, msku);
        }
      }
    }

    const mskuListingMap = await this.queryListingIdMap('msku', storeMskuMap);
    const localSkuListingMap = await this.queryListingIdMap('local_sku', storeLocalSkuMap);

    for (const row of rows) {
      const itemStoreId = normalizeText(row.sid);
      const firstMsku = normalizeText(row.first_msku);
      row.item_candidate_listing_id =
        itemStoreId && firstMsku ? mskuListingMap.get(this.buildStoreValueKey(itemStoreId, firstMsku)) || null : null;

      const planStoreId = normalizeText(row.purchase_plan_sid || row.sid);
      const planLocalSku = normalizeText(row.purchase_plan_local_sku);
      row.plan_sku_candidate_listing_id =
        planStoreId && planLocalSku
          ? localSkuListingMap.get(this.buildStoreValueKey(planStoreId, planLocalSku)) || null
          : null;

      row.plan_msku_candidate_listing_id = null;
      for (const msku of rowPlanMskus.get(row.order_item_id) || []) {
        const listingId = mskuListingMap.get(this.buildStoreValueKey(planStoreId, msku));
        if (listingId) {
          row.plan_msku_candidate_listing_id = listingId;
          break;
        }
      }
    }
  }

  private async queryListingIdMap(field: 'msku' | 'local_sku', storeValues: Map<string, Set<string>>) {
    const result = new Map<string, number>();
    for (const [storeId, valueSet] of storeValues) {
      const values = [...valueSet].filter(Boolean);
      for (let index = 0; index < values.length; index += 1000) {
        const chunk = values.slice(index, index + 1000);
        if (!chunk.length) continue;
        const placeholders = chunk.map(() => '?').join(', ');
        const rows = await this.listingRepo.query(
          `
            SELECT MAX(id) AS id, store_id, ${field} AS matched_value
            FROM app_amz_bsr_product_listing_lingxing
            WHERE store_id = ?
              AND ${field} IN (${placeholders})
            GROUP BY store_id, ${field}
          `,
          [storeId, ...chunk]
        );
        for (const row of rows) {
          const key = this.buildStoreValueKey(row.store_id, row.matched_value);
          const id = Number(row.id) || 0;
          if (key && id) {
            result.set(key, id);
          }
        }
      }
    }
    return result;
  }

  private addStoreValue(map: Map<string, Set<string>>, storeId: any, value: any) {
    const key = normalizeText(storeId);
    const text = normalizeText(value);
    if (!key || !text) {
      return;
    }
    if (!map.has(key)) {
      map.set(key, new Set<string>());
    }
    map.get(key).add(text);
  }

  private buildStoreValueKey(storeId: any, value: any) {
    const store = normalizeText(storeId);
    const text = normalizeText(value);
    return store && text ? `${store}|${text}` : '';
  }

  private parseJsonStringArray(value: any) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value ?? []);
    try {
      const parsed = JSON.parse(raw || '[]');
      if (Array.isArray(parsed)) {
        return parsed.map(item => normalizeText(item)).filter(Boolean);
      }
      return hasValue(parsed) ? [normalizeText(parsed)] : [];
    } catch {
      return hasValue(value) ? [normalizeText(value)] : [];
    }
  }

  private classifyRow(row: any) {
    return classifyManualLinkCandidate({
      has_plan_sn: Boolean(normalizeText(row.plan_sn)),
      has_purchase_plan: Boolean(row.purchase_plan_id),
      item_candidate_listing_id: row.item_candidate_listing_id,
      plan_sku_candidate_listing_id: row.plan_sku_candidate_listing_id,
      plan_msku_candidate_listing_id: row.plan_msku_candidate_listing_id,
    });
  }

  private mapListing(item: AppAmzBsrProductListingLingxingEntity) {
    return {
      id: item.id,
      store_id: item.store_id,
      shop: item.shop,
      asin: item.asin,
      marketplace: item.marketplace,
      msku: item.msku,
      local_sku: item.local_sku,
      product_code: item.product_code,
      item_name: item.item_name,
      local_name: item.local_name,
      seller_name: item.seller_name,
      image_url: item.image_url,
      fnsku: item.fnsku,
      average_seven_volume: (item as any).average_seven_volume,
      average_fourteen_volume: (item as any).average_fourteen_volume,
      average_thirty_volume: (item as any).average_thirty_volume,
      afn_fulfillable_quantity: (item as any).afn_fulfillable_quantity,
      afn_inbound_working_quantity: (item as any).afn_inbound_working_quantity,
      afn_inbound_shipped_quantity: (item as any).afn_inbound_shipped_quantity,
      afn_inbound_receiving_quantity: (item as any).afn_inbound_receiving_quantity,
      reserved_customerorders: (item as any).reserved_customerorders,
      reserved_fc_processing: (item as any).reserved_fc_processing,
      reserved_fc_transfers: (item as any).reserved_fc_transfers,
      status: item.status,
      status_text: item.status_text,
    };
  }

  private normalizePurchaseOrderStatuses(param: ManualLinkPageParam) {
    if (normalizeText(param.status_scope).toLowerCase() === 'all') {
      return [];
    }

    const raw = param.purchase_order_statuses ?? param.statuses;
    const values = normalizeArrayParam(raw)
      .map(item => Number(item))
      .filter(item => Number.isFinite(item));
    return values.length > 0 ? [...new Set(values)] : DEFAULT_PURCHASE_ORDER_STATUSES;
  }

  private addInCondition(conditions: string[], params: any[], field: string, value: any) {
    const list = normalizeArrayParam(value);
    if (list.length === 0) {
      return;
    }
    conditions.push(`${field} IN (${list.map(() => '?').join(', ')})`);
    params.push(...list);
  }

  private getCurrentAdminUser() {
    const admin = (this.ctx as any)?.admin || (this.baseCtx as any)?.admin || {};
    const username = normalizeText(admin.username);
    return {
      userId: Number(admin.userId) || null,
      username,
      nickname: normalizeText(admin.nickName || admin.name || username),
    };
  }
}
