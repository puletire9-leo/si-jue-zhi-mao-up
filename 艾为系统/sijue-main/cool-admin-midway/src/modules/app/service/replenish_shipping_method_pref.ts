export const REPLENISH_SHIPPING_METHOD_KEYS = [
  'express',
  'air',
  'air_slow',
  'truck',
  'rail',
  'sea',
] as const;

const SHIPPING_METHOD_KEY_SET = new Set<string>(REPLENISH_SHIPPING_METHOD_KEYS);

export type ReplenishShippingMethodKey =
  (typeof REPLENISH_SHIPPING_METHOD_KEYS)[number];

export type ShippingMethodPrefItem = {
  listing_id?: number | string | null;
  id?: number | string | null;
  product_code?: string | null;
  marketplace?: string | null;
  asin?: string | null;
  msku?: string | null;
  store_id?: number | string | null;
};

export type ShippingMethodPrefRecord = ShippingMethodPrefItem & {
  user_id: number;
  inactive_methods?: any;
};

export const normalizeInactiveShippingMethods = (value: any): string[] => {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const raw of list) {
    const key = String(raw || '').trim();
    if (!SHIPPING_METHOD_KEY_SET.has(key) || seen.has(key)) continue;
    seen.add(key);
    normalized.push(key);
  }

  return normalized;
};

export const normalizeShippingListingId = (item: ShippingMethodPrefItem) => {
  const num = Number(item?.listing_id ?? item?.id);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

export const buildShippingMethodNaturalWhere = (
  item: ShippingMethodPrefItem
) => ({
  product_code: String(item?.product_code || '').trim(),
  marketplace: String(item?.marketplace || '').trim(),
  asin: String(item?.asin || '').trim(),
  msku: String(item?.msku || '').trim(),
  store_id: Number(item?.store_id) || 0,
});

export const hasShippingMethodNaturalKey = (
  item: ShippingMethodPrefItem
) => {
  const key = buildShippingMethodNaturalWhere(item);
  return Boolean(
    key.product_code &&
      key.marketplace &&
      key.asin &&
      key.msku &&
      key.store_id > 0
  );
};

export const buildShippingMethodNaturalKey = (
  item: ShippingMethodPrefItem
) => {
  const key = buildShippingMethodNaturalWhere(item);
  return [
    key.product_code,
    key.marketplace,
    key.asin,
    key.msku,
    key.store_id,
  ].join('|');
};

export const resolveShippingMethodPrefMatch = <
  T extends ShippingMethodPrefRecord
>(
  item: ShippingMethodPrefItem,
  userId: number,
  records: T[]
): { record: T | null; matchedBy: 'listing_id' | 'natural_key' | '' } => {
  const listingId = normalizeShippingListingId(item);
  const scopedRecords = (records || []).filter(
    record => Number(record.user_id) === Number(userId)
  );

  if (listingId > 0) {
    const byListing = scopedRecords.find(
      record => normalizeShippingListingId(record) === listingId
    );
    if (byListing) return { record: byListing, matchedBy: 'listing_id' };
  }

  if (!hasShippingMethodNaturalKey(item)) {
    return { record: null, matchedBy: '' };
  }

  const naturalKey = buildShippingMethodNaturalKey(item);
  const byNatural = scopedRecords.find(
    record => buildShippingMethodNaturalKey(record) === naturalKey
  );

  return byNatural
    ? { record: byNatural, matchedBy: 'natural_key' }
    : { record: null, matchedBy: '' };
};
