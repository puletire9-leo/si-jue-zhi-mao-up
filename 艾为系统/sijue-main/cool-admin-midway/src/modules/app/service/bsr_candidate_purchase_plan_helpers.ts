import { buildProductSetSupplierQuotes } from './bsr_candidate_lingxing_quotes';

export type CandidatePurchasePlanIdentity = {
  type: number;
  lingxing_sku: string;
  store_id?: string | number | null;
  purchaser_record_id?: string | number | null;
};

export type CandidatePurchasePlanPurchaserSource = {
  id?: string | number | null;
  selected_variant_id?: string | number | null;
  seller_account_id?: string | number | null;
  account_name?: string | null;
  purchaserNum?: unknown;
};

export type CandidateRegularPurchasePlanSource = {
  purchaserRecordId: string;
  variantId: string;
  lingxingSku: string;
  variantName: string;
  storeId: string;
  accountName: string;
  ukNum: number;
  deNum: number;
  totalQty: number;
  groupProportions: unknown;
};

export type CandidateSamplePurchasePlanSource = {
  variantId: string;
  lingxingSku: string;
  variantName: string;
};

export type CandidateFactoryLinkInfo = {
  id?: string | null;
  name?: string | null;
  productSKU?: string | number | null;
  supplierSKU?: string | number | null;
  product_name?: string | null;
  user_input?: string | null;
  price?: number | string | null;
  isFirst?: boolean;
};

export type CandidateFactoryLinkLookupValue =
  | CandidateFactoryLinkInfo
  | CandidateFactoryLinkInfo[];

export type CandidateFactoryLinkSkuMetadataUpdate = {
  id: string;
  product_sku?: string;
  supplier_sku?: string;
  product_name?: string;
};

export type CandidatePurchasePlanApiItemOptions = {
  sku: string;
  quantity_plan: number;
  cg_uid?: string | number | null;
  remark?: string | null;
  supplierQuotes?: any[];
};
export type CandidateProductSetSizeSource = {
  length?: unknown;
  width?: unknown;
  height?: unknown;
  actual_weight?: unknown;
};

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeNumericText(value: unknown): number | string {
  const text = normalizeText(value);
  if (!text) return '';

  const numeric = Number(text);
  return Number.isFinite(numeric) && String(numeric) === text ? numeric : text;
}


function toPositiveNumber(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 0;
}

function formatLingxingNumber(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

export function buildCandidateProductSetSizeFields(size?: CandidateProductSetSizeSource | null) {
  const length = toPositiveNumber(size?.length);
  const width = toPositiveNumber(size?.width);
  const height = toPositiveNumber(size?.height);
  const actualWeightKg = toPositiveNumber(size?.actual_weight);
  const actualWeightG = actualWeightKg > 0 ? actualWeightKg * 1000 : 0;

  return {
    ...(length ? {
      cg_product_length: formatLingxingNumber(length),
      cg_package_length: formatLingxingNumber(length),
    } : {}),
    ...(width ? {
      cg_product_width: formatLingxingNumber(width),
      cg_package_width: formatLingxingNumber(width),
    } : {}),
    ...(height ? {
      cg_product_height: formatLingxingNumber(height),
      cg_package_height: formatLingxingNumber(height),
    } : {}),
    ...(actualWeightG ? {
      cg_product_net_weight: formatLingxingNumber(actualWeightG),
      cg_product_gross_weight: formatLingxingNumber(actualWeightG),
    } : {}),
  };
}
function pickPrimarySupplierQuote(supplierQuotes: any[] = []) {
  if (!Array.isArray(supplierQuotes) || supplierQuotes.length === 0) return null;
  return supplierQuotes.find(q => Number(q?.is_primary) === 1) || supplierQuotes[0] || null;
}

export function extractCandidateErpSupplierId(value: any): any {
  if (!value) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractCandidateErpSupplierId(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value !== 'object') return null;

  if (normalizeText(value.erp_supplier_id)) return value.erp_supplier_id;

  for (const item of Object.values(value)) {
    const found = extractCandidateErpSupplierId(item);
    if (found) return found;
  }
  return null;
}

export function pickCandidatePurchasePlanSupplierId(supplierQuotes: any[] = []) {
  const supplierQuote = pickPrimarySupplierQuote(supplierQuotes);
  if (!supplierQuote) return '';

  const erpSupplierId = normalizeNumericText(supplierQuote.erp_supplier_id);
  if (erpSupplierId) return erpSupplierId;

  return normalizeNumericText(supplierQuote.supplier_id);
}

export function buildCandidatePurchasePlanApiItem(options: CandidatePurchasePlanApiItemOptions) {
  const supplierId = pickCandidatePurchasePlanSupplierId(options.supplierQuotes);
  const cgUid = normalizeNumericText(options.cg_uid);
  const remark = normalizeText(options.remark);

  return {
    sku: options.sku,
    quantity_plan: options.quantity_plan,
    ...(cgUid ? { cg_uid: cgUid } : {}),
    ...(remark ? { remark } : {}),
    ...(supplierId ? { supplier_id: supplierId } : {}),
  };
}

export function buildCandidatePurchasePlanKey(plan: CandidatePurchasePlanIdentity): string {
  const keyParts = [
    Number(plan.type) || 0,
    normalizeText(plan.lingxing_sku),
    normalizeText(plan.store_id),
  ];
  if (Number(plan.type) === 1) {
    keyParts.push(normalizeText(plan.purchaser_record_id));
  }
  return keyParts.join('::');
}

export function hasExistingCandidatePurchasePlan(
  existingPlans: Array<CandidatePurchasePlanIdentity & { plan_sn?: unknown }>,
  target: CandidatePurchasePlanIdentity
): boolean {
  const targetKey = buildCandidatePurchasePlanKey(target);
  return existingPlans.some(plan => {
    return buildCandidatePurchasePlanKey(plan) === targetKey;
  });
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  let parsed = value;
  for (let index = 0; index < 2 && typeof parsed === 'string'; index++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function toNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getVariantInfo(
  variantMap: Map<unknown, any>,
  variantId: unknown
): any {
  if (!variantMap || !variantId) return null;
  const textId = normalizeText(variantId);
  return (
    variantMap.get(variantId) ||
    variantMap.get(textId) ||
    variantMap.get(Number(textId)) ||
    null
  );
}

export function buildCandidateRegularPurchasePlanSources(
  purchasers: CandidatePurchasePlanPurchaserSource[],
  variantMap: Map<unknown, any>,
  fallbackSku: string
): CandidateRegularPurchasePlanSource[] {
  return (Array.isArray(purchasers) ? purchasers : []).map(purchaser => {
    const variantId = normalizeText(purchaser.selected_variant_id);
    const variantRow = getVariantInfo(variantMap, variantId);
    const nums = parseJsonObject(purchaser.purchaserNum);
    const ukNum = toNumber(nums.uk);
    const deNum = toNumber(nums.de);
    return {
      purchaserRecordId: normalizeText(purchaser.id),
      variantId,
      lingxingSku: normalizeText(variantRow?.sku) || normalizeText(fallbackSku),
      variantName: normalizeText(variantRow?.name) || '默认',
      storeId: normalizeText(purchaser.seller_account_id),
      accountName: normalizeText(purchaser.account_name),
      ukNum,
      deNum,
      totalQty: ukNum + deNum,
      groupProportions: variantRow?.group_proportions || null,
    };
  });
}

export function buildCandidateSamplePurchasePlanSources(
  purchasers: CandidatePurchasePlanPurchaserSource[],
  variantMap: Map<unknown, any>,
  fallbackSku: string
): CandidateSamplePurchasePlanSource[] {
  const sources = new Map<string, CandidateSamplePurchasePlanSource>();
  for (const purchaser of Array.isArray(purchasers) ? purchasers : []) {
    const variantId = normalizeText(purchaser.selected_variant_id);
    if (!variantId) continue;
    const variantRow = getVariantInfo(variantMap, variantId);
    const lingxingSku = normalizeText(variantRow?.sku) || normalizeText(fallbackSku);
    if (!lingxingSku || sources.has(lingxingSku)) continue;
    sources.set(lingxingSku, {
      variantId,
      lingxingSku,
      variantName: normalizeText(variantRow?.name) || '默认',
    });
  }
  return Array.from(sources.values());
}

function parseGroupProportions(value: unknown): Record<string, number> {
  let parsed = value;
  for (let index = 0; index < 2 && typeof parsed === 'string'; index++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, number>)
    : {};
}

export function buildCandidatePlanSupplierQuotes(
  groupProportions: unknown,
  factoryLinkMap: Map<string, CandidateFactoryLinkLookupValue>
) {
  const proportions = parseGroupProportions(groupProportions);
  const supplierQuotes: any[] = [];
  const seenSupplierIds = new Set<string>();

  const appendLookupLinks = (value: CandidateFactoryLinkLookupValue | undefined) => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const resolveLinksForGroupKey = (groupKey: string) => {
    const directLinks = appendLookupLinks(factoryLinkMap.get(groupKey));
    const namedLinks = appendLookupLinks(factoryLinkMap.get(`name:${groupKey}`));
    const directNamedLinks = directLinks.flatMap(link =>
      appendLookupLinks(factoryLinkMap.get(`name:${normalizeText(link?.name)}`))
    );
    return [...directLinks, ...namedLinks, ...directNamedLinks];
  };

  const appendSupplierQuote = (linkInfo: CandidateFactoryLinkInfo | undefined) => {
    const supplierId = normalizeText(linkInfo?.supplierSKU);
    if (!linkInfo || !supplierId || seenSupplierIds.has(supplierId)) return;
    seenSupplierIds.add(supplierId);
    supplierQuotes.push({
      supplier_id: supplierId,
      supplier_product_url: [linkInfo.user_input],
      is_primary: linkInfo.isFirst ? 1 : 0,
      quotes: [
        {
          currency: 'CNY',
          is_tax: 0,
          tax_rate: '0',
          step_prices: [{ moq: 1, price_with_tax: Number(linkInfo.price) || 0 }],
        },
      ],
    });
  };

  for (const linkId of Object.keys(proportions)) {
    for (const linkInfo of resolveLinksForGroupKey(linkId)) {
      appendSupplierQuote(linkInfo);
    }
  }

  if (supplierQuotes.length === 0) {
    for (const value of factoryLinkMap.values()) {
      for (const linkInfo of appendLookupLinks(value)) {
        appendSupplierQuote(linkInfo);
      }
    }
  }

  return buildProductSetSupplierQuotes(supplierQuotes);
}

export function buildFactoryLinkSkuMetadataUpdates(factoryLinks: CandidateFactoryLinkInfo[]) {
  return (Array.isArray(factoryLinks) ? factoryLinks : [])
    .map(link => {
      const id = normalizeText(link?.id);
      const productSku = normalizeText(link?.productSKU);
      const supplierSku = normalizeText(link?.supplierSKU);
      const productName = normalizeText(link?.product_name);
      if (!id || (!productSku && !supplierSku && !productName)) return null;

      const update: CandidateFactoryLinkSkuMetadataUpdate = {
        id,
      };
      if (productSku) update.product_sku = productSku;
      if (supplierSku) update.supplier_sku = supplierSku;
      if (productName) update.product_name = productName;
      return update;
    })
    .filter((update): update is CandidateFactoryLinkSkuMetadataUpdate => Boolean(update));
}

function normalizePlanSn(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(item => normalizeText(item)).find(Boolean) || '';
  }
  return normalizeText(value);
}

function findCreatePurchasePlanData(value: any): any {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.find(item => {
      if (!item || typeof item !== 'object') return false;
      return normalizeText(item.ppg_sn) || normalizePlanSn(item.plan_sn);
    }) || null;
  }
  if (typeof value !== 'object') return null;
  if (normalizeText(value.ppg_sn) || normalizePlanSn(value.plan_sn)) return value;
  if (value.data !== undefined && value.data !== value) {
    return findCreatePurchasePlanData(value.data);
  }
  return null;
}

function pickFirstMeaningfulText(...values: unknown[]): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = pickFirstMeaningfulText(...value);
      if (nested) return nested;
      continue;
    }
    const text = normalizeText(value);
    if (text) return text;
  }
  return '';
}

function pickCreatePurchasePlanErrorText(value: any): string {
  if (!value) return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = pickCreatePurchasePlanErrorText(item);
      if (text) return text;
    }
    return '';
  }
  if (typeof value !== 'object') return '';

  return pickFirstMeaningfulText(
    value.error_details,
    value.errorDetail,
    value.message,
    value.msg,
    value.error
  );
}

export function parseCandidateCreatePurchasePlanResponse(rawResponse: any) {
  const apiData = findCreatePurchasePlanData(rawResponse);
  const ppgSn = normalizeText(apiData?.ppg_sn);
  const planSn = normalizePlanSn(apiData?.plan_sn);
  if (ppgSn || planSn) {
    return {
      ppg_sn: ppgSn,
      plan_sn: planSn,
    };
  }

  const directError = pickCreatePurchasePlanErrorText(rawResponse);
  const dataError = pickCreatePurchasePlanErrorText(rawResponse?.data);
  throw new Error(directError || dataError || 'API返回数据异常，缺少ppg_sn/plan_sn');
}
