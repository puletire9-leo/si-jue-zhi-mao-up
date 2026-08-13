import dayjs = require('dayjs');
import {
  AUTO_REPLENISH_SHIPPING_METHODS,
  AUTO_REPLENISH_SHIPPING_PROFILES,
  AutoReplenishShippingMethodKey,
  AutoReplenishShippingProfileKey,
} from './purchase_plan_remark_parser';

export interface ReplenishmentShippingCalculationInput {
  planStartDate: string;
  bufferDays: number;
  profileKey: AutoReplenishShippingProfileKey;
  allocations: Partial<Record<AutoReplenishShippingMethodKey, number>>;
  dailyAvgSales: number;
  targetStockDays: number;
  volatilityCoefficient: number;
  manualCoefficient: number;
  coefficientByMethod?: Partial<Record<AutoReplenishShippingMethodKey, number>>;
  source?: string;
  sourceLabel?: string;
}

export interface ReplenishmentShippingSegmentResult {
  method_key: AutoReplenishShippingMethodKey;
  method_label: string;
  days_to_arrive: number;
  active: true;
  start_date: string;
  end_date: string;
  period_days: number;
  system_suggested_qty: number;
  final_qty: number;
  coefficient: number;
  raw_coefficient: number;
  adjusted_coefficient: number;
  calculation_trace: any;
}

function normalizeDate(value: any) {
  const date = dayjs(value);
  return date.isValid() ? date.format('YYYY-MM-DD') : '';
}

function addDays(value: string, days: number) {
  return dayjs(value).add(days, 'day').format('YYYY-MM-DD');
}

function diffDaysInclusive(startDate: string, endDate: string) {
  return Math.max(1, dayjs(endDate).diff(dayjs(startDate), 'day') + 1);
}

export function getReplenishmentShippingProfile(profileKey: any) {
  const normalized = String(profileKey || '').trim() as AutoReplenishShippingProfileKey;
  return AUTO_REPLENISH_SHIPPING_PROFILES[normalized] || AUTO_REPLENISH_SHIPPING_PROFILES.default;
}

export function calculateReplenishmentShippingSegments(
  input: ReplenishmentShippingCalculationInput
) {
  const planStartDate = normalizeDate(input.planStartDate);
  if (!planStartDate) {
    throw new Error('缺少有效计划开始时间，无法推算运输分段');
  }
  const profile = getReplenishmentShippingProfile(input.profileKey);
  const bufferDays = Number.isInteger(Number(input.bufferDays)) && Number(input.bufferDays) >= 0
    ? Number(input.bufferDays)
    : 0;
  const targetStockDays = Math.max(1, Math.round(Number(input.targetStockDays) || 20));
  const dailyAvgSales = Math.max(0, Number(input.dailyAvgSales) || 0);
  const volatilityCoefficient = Number(input.volatilityCoefficient) || 1;
  const manualCoefficient = Number(input.manualCoefficient) || 1;
  const source = input.source || 'shipping_calculator';
  const sourceLabel = input.sourceLabel || '系统推算';

  const activeRows = profile.selectedMethods
    .map((methodKey, index) => {
      const finalQty = Number(input.allocations?.[methodKey]) || 0;
      if (finalQty <= 0) return null;
      const method = AUTO_REPLENISH_SHIPPING_METHODS.find(item => item.key === methodKey);
      const daysToArrive = Number(profile.methodDays[methodKey] ?? method?.days ?? 0);
      return {
        index,
        methodKey,
        method,
        finalQty,
        daysToArrive,
        arrivalDate: addDays(planStartDate, bufferDays + daysToArrive),
      };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.daysToArrive - b.daysToArrive || a.index - b.index) as Array<any>;

  if (!activeRows.length) {
    throw new Error('发货分配至少需要一个大于0的运输方式数量');
  }

  const segments: ReplenishmentShippingSegmentResult[] = activeRows.map((row, index) => {
    const next = activeRows[index + 1];
    const startDate = row.arrivalDate;
    const endDate = next
      ? addDays(next.arrivalDate, -1)
      : addDays(startDate, targetStockDays - 1);
    const periodDays = diffDaysInclusive(startDate, endDate);
    const coefficient = Number(input.coefficientByMethod?.[row.methodKey]) || 1;
    const rawSuggestedQty =
      dailyAvgSales * periodDays * coefficient * volatilityCoefficient * manualCoefficient;
    const suggestedQty = Math.max(0, Math.round(rawSuggestedQty));
    const label = row.method?.label || row.methodKey;

    return {
      method_key: row.methodKey,
      method_label: label,
      days_to_arrive: row.daysToArrive,
      active: true,
      start_date: startDate,
      end_date: endDate,
      period_days: periodDays,
      system_suggested_qty: suggestedQty,
      final_qty: row.finalQty,
      coefficient,
      raw_coefficient: coefficient,
      adjusted_coefficient: coefficient,
      calculation_trace: {
        source,
        source_label: sourceLabel,
        plan_start_date: planStartDate,
        buffer_days: bufferDays,
        days_to_arrive: row.daysToArrive,
        arrival_date: startDate,
        coverage_start_date: startDate,
        coverage_end_date: endDate,
        coverage_days: periodDays,
        daily_avg_sales: dailyAvgSales,
        volatility_coefficient: volatilityCoefficient,
        manual_coefficient: manualCoefficient,
        raw_suggested_qty: Number(rawSuggestedQty.toFixed(4)),
        suggested_qty: suggestedQty,
        final_qty: row.finalQty,
        quantity_difference: row.finalQty - suggestedQty,
        lines: [
          `计划开始 ${planStartDate} + 缓冲 ${bufferDays} 天 + ${label} ${row.daysToArrive} 天 = 预计到达 ${startDate}`,
          next
            ? `本段从 ${startDate} 覆盖到下一个运输方式到达日前一天 ${endDate}，共 ${periodDays} 天`
            : `最后一段从 ${startDate} 按目标库存 ${targetStockDays} 天覆盖到 ${endDate}`,
          `系统建议：日均 ${dailyAvgSales} × ${periodDays} 天 × 系数 ${coefficient} × 波动 ${volatilityCoefficient} × 人工 ${manualCoefficient} = ${rawSuggestedQty.toFixed(4)}，取整 ${suggestedQty}`,
          `运营备注指定数量 ${row.finalQty}，系统不改写该数量`,
        ],
      },
    };
  });

  return {
    profile,
    cycle_start_date: segments[0].start_date,
    cycle_end_date: segments[segments.length - 1].end_date,
    segments,
  };
}
