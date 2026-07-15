import { competitorApi, type SelectionCsvRowRef } from "@/api/competitor";
import type { SelectionQueryPlan } from "./queryPlan";
import { resolveSelectionQueryPlan } from "./queryRuntime";

const EXPORT_PAGE_SIZE = 100;
const EXPORT_CONCURRENCY = 4;
const MAX_EXPORT_ROWS = 10_000;

interface AllResultsCsvInput {
  plan: SelectionQueryPlan | null;
  total: number;
  marketplace: string;
  onProgress?: (loaded: number, total: number) => void;
}

function safeDatabaseId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return String(value);
  }
  return undefined;
}

function firstText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function rowRef(product: Record<string, any>): SelectionCsvRowRef | null {
  const asin = firstText(product.asin);
  if (!asin) return null;
  const snapshot = product.ruleSnapshot as Record<string, unknown> | undefined;
  return {
    id: safeDatabaseId(product.id),
    asin,
    snapshotKey: firstText(
      product.effectiveWeekTag,
      product.createdWeek,
      product.batchDate,
      product.batchCode,
      product.weekTag,
      snapshot?.effectiveWeekTag,
      snapshot?.createdWeek,
      snapshot?.batchDate,
    ),
  };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

interface PagedRecordsCsvInput<T extends object> {
  total: number;
  filenamePrefix: string;
  loadPage: (page: number, size: number) => Promise<T[]>;
  onProgress?: (loaded: number, total: number) => void;
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (text && "=+-@".includes(text[0])) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

/** 复用统一选品的分页遍历、数量上限和浏览器下载行为，导出完整记录字段。 */
export async function downloadPagedRecordsCsv<T extends object>(
  input: PagedRecordsCsvInput<T>,
) {
  if (input.total <= 0) throw new Error("当前筛选没有可导出的商品");
  if (input.total > MAX_EXPORT_ROWS) {
    throw new Error(`单次最多导出 ${MAX_EXPORT_ROWS} 条，请先缩小筛选范围`);
  }

  const pageCount = Math.ceil(input.total / EXPORT_PAGE_SIZE);
  const rows: T[] = [];
  for (let start = 1; start <= pageCount; start += EXPORT_CONCURRENCY) {
    const pages = Array.from(
      { length: Math.min(EXPORT_CONCURRENCY, pageCount - start + 1) },
      (_, index) => start + index,
    );
    const responses = await Promise.all(
      pages.map((page) => input.loadPage(page, EXPORT_PAGE_SIZE)),
    );
    responses.forEach((records) => rows.push(...records));
    input.onProgress?.(Math.min(rows.length, input.total), input.total);
  }

  const columns: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row).forEach((column) => {
      if (!seen.has(column)) {
        seen.add(column);
        columns.push(column);
      }
    });
  });
  if (!columns.length) throw new Error("当前筛选没有可导出的字段");

  const lines = [
    columns.map(csvValue).join(","),
    ...rows.map((row) => {
      const record = row as Record<string, unknown>;
      return columns.map((column) => csvValue(record[column])).join(",");
    }),
  ];
  const blob = new Blob(["\uFEFF", lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const filename = `${input.filenamePrefix}_${timestamp()}.csv`;
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  return { count: rows.length, filename };
}

function pagedPlan(
  plan: SelectionQueryPlan,
  page: number,
): SelectionQueryPlan {
  return {
    ...plan,
    params: {
      ...plan.params,
      page,
      size: EXPORT_PAGE_SIZE,
    },
  } as SelectionQueryPlan;
}

async function loadAllResultRows(input: AllResultsCsvInput) {
  if (!input.plan) throw new Error("当前筛选查询来源尚未就绪");
  if (input.total <= 0) throw new Error("当前筛选没有可导出的商品");
  if (input.total > MAX_EXPORT_ROWS) {
    throw new Error(`单次最多导出 ${MAX_EXPORT_ROWS} 条，请先缩小筛选范围`);
  }

  const pageCount = Math.ceil(input.total / EXPORT_PAGE_SIZE);
  const products: Record<string, any>[] = [];
  for (let start = 1; start <= pageCount; start += EXPORT_CONCURRENCY) {
    const pages = Array.from(
      { length: Math.min(EXPORT_CONCURRENCY, pageCount - start + 1) },
      (_, index) => start + index,
    );
    const responses = await Promise.all(
      pages.map((page) => resolveSelectionQueryPlan(pagedPlan(input.plan!, page))),
    );
    for (const response of responses) {
      products.push(...response.result.list);
    }
    input.onProgress?.(Math.min(products.length, input.total), input.total);
  }
  return products;
}

export async function downloadAllResultsCsv(input: AllResultsCsvInput) {
  if (!input.plan) throw new Error("当前筛选查询来源尚未就绪");
  const products = await loadAllResultRows(input);
  const rows = products
    .map(rowRef)
    .filter((row): row is SelectionCsvRowRef => !!row);
  if (rows.length === 0) throw new Error("当前筛选没有有效 ASIN 可导出");

  const blob = await competitorApi.exportSelectionCsv({
    source: input.plan.targetSource,
    marketplace: input.marketplace,
    rows,
  });
  const filename = `selection_all_${input.plan.targetSource}_${input.marketplace}_${timestamp()}.csv`;
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
  return { count: rows.length, filename };
}
