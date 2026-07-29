/**
 * 「按天分组」批次下拉的统一格式化工具——全系统各批次下拉共用。
 *
 * 历史上各下拉（新品榜 / 精品榜 / 店铺选品 / 候选池）各写一套 label 逻辑，
 * 且按 ISO 周聚合导致同一周多次导入被合并。此工具把批次统一收口到
 * 「单天导入日期」粒度：
 *   - 普通批次下拉：`7/22（批次总数 1509）`
 *   - 店铺相关下拉：`7/22 · 1691店 / 2190品`
 *
 * 新增下拉一律复用此工具，禁止另写格式化逻辑。
 */

export interface DayBatchLike {
  /** 批次值：单天日期 yyyy-MM-dd（也兼容 yyyyMMdd / 旧 ISO 周 2026-Www）。 */
  value?: string;
  /** 兼容旧字段名。 */
  week?: string;
  count?: number;
  startDate?: string;
  endDate?: string;
  sellerCount?: number | null;
  productCount?: number | null;
  /** 兜底展示文本。 */
  label?: string;
}

/** 把日期串（yyyy-MM-dd / yyyyMMdd / ISO 周）转成 M/D。识别失败返回空串。 */
export function toMonthDay(value?: string | null): string {
  if (!value) return "";
  const v = String(value).trim();

  // yyyy-MM-dd
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${Number(m[2])}/${Number(m[3])}`;

  // yyyyMMdd
  m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${Number(m[2])}/${Number(m[3])}`;

  // ISO 周 yyyy-Www → 该周周一
  m = v.match(/^(\d{4})-W(\d{1,2})$/);
  if (m) {
    const year = Number(m[1]);
    const week = Number(m[2]);
    if (week >= 1 && week <= 53) {
      const januaryFourth = new Date(Date.UTC(year, 0, 4));
      const januaryFourthWeekday = januaryFourth.getUTCDay() || 7;
      const weekStart = new Date(
        Date.UTC(year, 0, 4 - januaryFourthWeekday + 1 + (week - 1) * 7),
      );
      return `${weekStart.getUTCMonth() + 1}/${weekStart.getUTCDate()}`;
    }
  }

  // 通用 Date 兜底
  const date = new Date(v);
  if (!Number.isNaN(date.getTime())) {
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  return "";
}

/** 取批次项的主值（value 优先，回退 week）。 */
export function batchValue(item: DayBatchLike): string {
  return String(item.value ?? item.week ?? "").trim();
}

/**
 * 普通批次下拉 label：`7/22（批次总数 1509）`。
 * 单天时只显示一个 M/D；若起止不同（旧数据/跨天）则显示范围 `7/20-7/22`。
 */
export function formatDayBatchLabel(item: DayBatchLike): string {
  const self = toMonthDay(batchValue(item));
  const start = toMonthDay(item.startDate) || self;
  const end = toMonthDay(item.endDate) || self;
  let range: string;
  if (start && end) {
    range = start === end ? start : `${start}-${end}`;
  } else {
    range = self || item.label || batchValue(item);
  }
  return `${range}（批次总数 ${item.count ?? 0}）`;
}

/**
 * 店铺相关下拉 label：`7/22 · 1691店 / 2190品`。
 * 缺店/品计数时退回普通格式。
 */
export function formatShopBatchLabel(item: DayBatchLike): string {
  const self = toMonthDay(batchValue(item)) || item.label || batchValue(item) || "-";
  if (item.sellerCount == null && item.productCount == null) {
    return formatDayBatchLabel(item);
  }
  return `${self} · ${item.sellerCount ?? 0}店 / ${item.productCount ?? 0}品`;
}
