/**
 * 品线选品「全部」数据源合并工具——把新品榜(competitor)与店铺(shop_products)两源
 * 的当前页结果合并成一个统一列表。
 *
 * 设计约束(见方案「已知取舍」):
 * - 两源各查一页(相同 page/size),前端合并该页并按排序键归并。
 * - 同一 ASIN 跨源去重:保留排序键更优的一条,并标记 mergedSources。
 * - 跨页全局排序非严格精确(每源只出一页),在"默认看最新批次"场景足够。
 */

export type SelectionSourceTag = "new" | "shop";

export interface MergeableProduct extends Record<string, any> {
  asin?: string;
  parentAsin?: string;
  /** 归一后的来源标签,合并前由调用方打上。 */
  dataSource?: SelectionSourceTag;
}

/** 支持的排序键 → 取值函数。缺失字段回退到销量,保证店铺(无 score)也能排。 */
function sortValue(item: MergeableProduct, field: string): number {
  const pick = (...keys: string[]): number => {
    for (const k of keys) {
      const v = item[k];
      if (v != null && v !== "") {
        const n = Number(v);
        if (!Number.isNaN(n)) return n;
      }
    }
    return Number.NEGATIVE_INFINITY;
  };
  switch (field) {
    case "score":
      // 店铺无 score,回退 units,避免店铺商品全部沉底。
      return pick("score", "salesVolume", "units");
    case "salesVolume":
    case "units":
      return pick("salesVolume", "units");
    case "price":
      return pick("price");
    case "bsr":
      return pick("bsr");
    case "listingDate":
      return pick("listingDate", "availableDate");
    default:
      return pick("score", "salesVolume", "units");
  }
}

/** 去重主键:优先 asin,回退 parentAsin;都没有时用对象自身(不参与去重)。 */
function dedupKey(item: MergeableProduct): string {
  const asin = String(item.asin ?? "").trim();
  if (asin) return `asin:${asin}`;
  const parent = String(item.parentAsin ?? "").trim();
  if (parent) return `parent:${parent}`;
  return "";
}

export interface MergeOptions {
  sortField: string;
  sortOrder: "desc" | "asc";
}

/**
 * 合并两源当前页结果。
 * @param newList  新品榜(competitor)当前页,元素需已带 dataSource='new'
 * @param shopList 店铺当前页,元素需已带 dataSource='shop'
 */
export function mergeSelectionResults(
  newList: MergeableProduct[],
  shopList: MergeableProduct[],
  options: MergeOptions,
): MergeableProduct[] {
  const { sortField, sortOrder } = options;
  const dir = sortOrder === "asc" ? 1 : -1;

  const byKey = new Map<string, MergeableProduct>();
  const noKey: MergeableProduct[] = [];

  const consider = (item: MergeableProduct) => {
    const key = dedupKey(item);
    if (!key) {
      noKey.push(item);
      return;
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...item, mergedSources: [item.dataSource] });
      return;
    }
    // 跨源同 ASIN:保留排序键更优者,合并来源标记。
    const existingVal = sortValue(existing, sortField);
    const incomingVal = sortValue(item, sortField);
    const sources = Array.from(
      new Set([...(existing.mergedSources ?? []), item.dataSource]),
    );
    // 更优 = 按当前排序方向更靠前。
    const incomingBetter = dir === -1
      ? incomingVal > existingVal
      : incomingVal < existingVal;
    if (incomingBetter) {
      byKey.set(key, { ...item, mergedSources: sources });
    } else {
      existing.mergedSources = sources;
    }
  };

  newList.forEach(consider);
  shopList.forEach(consider);

  const merged = [...byKey.values(), ...noKey];
  merged.sort((a, b) => {
    const av = sortValue(a, sortField);
    const bv = sortValue(b, sortField);
    if (av === bv) return 0;
    return av < bv ? -dir : dir;
  });
  return merged;
}
