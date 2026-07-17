export type ProductDetailRecord = Record<string, unknown>;

const EMPTY_TEXT_VALUES = new Set(["", "null", "undefined", "nan"]);

export function cleanDetailValue(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return EMPTY_TEXT_VALUES.has(trimmed.toLowerCase()) ? null : trimmed;
}

export function hasDetailValue(value: unknown): boolean {
  const cleaned = cleanDetailValue(value);
  return cleaned !== null && cleaned !== undefined;
}

export function firstDetailValue(
  product: ProductDetailRecord | null | undefined,
  ...keys: string[]
): unknown {
  if (!product) return null;
  for (const key of keys) {
    const value = cleanDetailValue(product[key]);
    if (value !== null && value !== undefined) return value;
  }
  return null;
}

export function detailNumber(value: unknown): number | null {
  const cleaned = cleanDetailValue(value);
  if (cleaned === null || cleaned === undefined) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeDetailMarketplace(value: unknown): string {
  const raw = String(cleanDetailValue(value) ?? "").toUpperCase();
  const map: Record<string, string> = {
    GB: "UK",
    "UNITED KINGDOM": "UK",
    英国: "UK",
    GER: "DE",
    GERMANY: "DE",
    德国: "DE",
    USA: "US",
    "UNITED STATES": "US",
    美国: "US",
  };
  return map[raw] || raw;
}

const MARKETPLACE_CURRENCY: Record<string, string> = {
  UK: "GBP",
  DE: "EUR",
  FR: "EUR",
  IT: "EUR",
  ES: "EUR",
  US: "USD",
  CA: "CAD",
  JP: "JPY",
};

export function formatDetailMoney(
  value: unknown,
  marketplace: unknown,
  rawSymbol?: unknown,
  allowNegative = false,
): string {
  const number = detailNumber(value);
  if (number === null || (!allowNegative && number < 0)) return "—";

  const normalizedMarketplace = normalizeDetailMarketplace(marketplace);
  const currency = MARKETPLACE_CURRENCY[normalizedMarketplace];
  if (currency) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "JPY" ? 0 : 2,
      maximumFractionDigits: currency === "JPY" ? 0 : 2,
    }).format(number);
  }

  const symbol = String(cleanDetailValue(rawSymbol) ?? "");
  return `${symbol}${number.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
}

export function formatDetailInteger(value: unknown): string {
  const number = detailNumber(value);
  if (number === null) return "—";
  return Math.trunc(number).toLocaleString("zh-CN");
}

export function isPositiveDetailFlag(value: unknown): boolean {
  const cleaned = cleanDetailValue(value);
  if (cleaned === null || cleaned === undefined) return false;
  if (typeof cleaned === "boolean") return cleaned;
  if (typeof cleaned === "number") return cleaned > 0;
  const normalized = String(cleaned).trim().toLowerCase();
  return !new Set([
    "0",
    "false",
    "no",
    "n",
    "none",
    "null",
    "-",
    "否",
    "无",
  ]).has(normalized);
}

export function formatDetailNumber(value: unknown): string {
  const number = detailNumber(value);
  if (number === null) return "—";
  if (Math.abs(number) >= 10000) {
    return `${(number / 10000).toFixed(number % 10000 === 0 ? 0 : 1)}万`;
  }
  return number.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

export function formatDetailPercent(value: unknown): string {
  const number = detailNumber(value);
  if (number === null) return "—";
  return `${number.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}%`;
}

export function detailText(value: unknown, suffix = ""): string {
  const cleaned = cleanDetailValue(value);
  if (cleaned === null || cleaned === undefined) return "—";
  return `${String(cleaned)}${suffix}`;
}

export function getDetailUnits(product: ProductDetailRecord): unknown {
  return firstDetailValue(product, "units", "salesVolume");
}

export function getDetailVariantCount(product: ProductDetailRecord): number {
  return (
    detailNumber(firstDetailValue(product, "variantCount", "variations")) ?? 0
  );
}

export function getDetailWeight(product: ProductDetailRecord): string {
  const weightG = detailNumber(firstDetailValue(product, "weightG", "weight_g"));
  const weight = cleanDetailValue(product.weight);
  if (weightG !== null && weight !== null && weight !== undefined) {
    return `${weightG.toLocaleString("zh-CN")}g / ${String(weight)}`;
  }
  if (weightG !== null) return `${weightG.toLocaleString("zh-CN")}g`;
  return detailText(weight);
}
