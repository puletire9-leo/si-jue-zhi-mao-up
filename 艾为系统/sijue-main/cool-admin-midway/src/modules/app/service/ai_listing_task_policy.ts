import {
  AI_LISTING_TASK_TYPE,
  AiListingTaskType,
} from '../entity/ai_listing_task';

export type AiListingLang = 'en' | 'de';
export type AiListingReferenceSourceType = 'manual_bullets' | 'competitor';

export type AiListingLanguageStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'skipped';

export type AiListingTaskCreatePayload = {
  task_type: AiListingTaskType;
  target_candidate_id: number;
  target_amazon_account_id?: string;
  target_variant_ids?: string[];
  country_code?: string;
  requested_languages?: AiListingLang[];
  target_msku?: string;
  task_mode?: 'full' | 'delta';
  action?: string;
  reference_source_type?: AiListingReferenceSourceType;
  manual_reference_bullets?: string[];
  manual_reference_notes?: string;
  manual_reference_title?: string;
  reference_competitor_asins?: ReferenceCompetitorAsinsByCountryInput;
};

export function normalizeReferenceSourceType(
  raw?: unknown
): AiListingReferenceSourceType {
  return String(raw || '').trim().toLowerCase() === 'manual_bullets'
    ? 'manual_bullets'
    : 'competitor';
}

export function normalizeManualReferenceBullets(raw?: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .slice(0, 5)
    .map(item => String(item || '').trim());
}

export function normalizeCompetitorAsin(raw?: unknown): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** 参考竞品 ASIN 列表，最多 4 条，去重保序 */
export function normalizeReferenceCompetitorAsins(raw?: unknown): string[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: string[] = [];
  for (const item of list) {
    const asin = normalizeCompetitorAsin(item);
    if (asin.length !== 10) continue;
    if (!out.includes(asin)) out.push(asin);
    if (out.length >= 4) break;
  }
  return out;
}

export type ReferenceCompetitorAsinsByCountry = {
  uk: string[];
  de: string[];
};

/** HTTP/API 入参：各站点 ASIN 列表可选，由 normalize 补齐 */
export type ReferenceCompetitorAsinsByCountryInput =
  Partial<ReferenceCompetitorAsinsByCountry>;

export function normalizeReferenceCompetitorAsinsByCountry(
  raw?: unknown
): ReferenceCompetitorAsinsByCountry {
  const obj =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    uk: normalizeReferenceCompetitorAsins(obj.uk),
    de: normalizeReferenceCompetitorAsins(obj.de),
  };
}

export function validateReferenceCompetitorSelectionForLanguages(
  selection: ReferenceCompetitorAsinsByCountry,
  requiredLanguages: AiListingLang[]
): string[] {
  const issues: string[] = [];
  for (const lang of requiredLanguages) {
    const label = lang === 'de' ? '德国' : '英国';
    const count = lang === 'de' ? selection.de.length : selection.uk.length;
    if (count > 4) {
      issues.push(`${label}参考竞品已选 ${count} 条（最多 4 条）`);
    }
  }
  return issues;
}

/** 任务语言：仅保留显式传入的 en/de */
export function normalizeRequestedLanguages(raw?: unknown): AiListingLang[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: AiListingLang[] = [];
  for (const item of list) {
    const key = String(item || '')
      .trim()
      .toLowerCase();
    if (key === 'en' || key === 'uk') {
      if (!out.includes('en')) out.push('en');
    } else if (key === 'de') {
      if (!out.includes('de')) out.push('de');
    }
  }
  return out;
}

/** 仅跑指定语言（如补德文 only_languages: ['de']），不自动追加英文 */
export function normalizeOnlyLanguages(raw?: unknown): AiListingLang[] {
  const list = Array.isArray(raw) ? raw : [];
  const out: AiListingLang[] = [];
  for (const item of list) {
    const key = String(item || '')
      .trim()
      .toLowerCase();
    if (key === 'en' || key === 'uk') {
      if (!out.includes('en')) out.push('en');
    } else if (key === 'de') {
      if (!out.includes('de')) out.push('de');
    }
  }
  return out;
}

/** 缺字段的老任务：保持历史双语行为 */
export function defaultRequestedLanguagesForLegacy(): AiListingLang[] {
  return ['en', 'de'];
}

export function buildInitialLanguageStatus(
  requested: AiListingLang[]
): Record<AiListingLang, AiListingLanguageStatus> {
  const normalized = normalizeRequestedLanguages(requested);
  return {
    en: normalized.includes('en') ? 'pending' : 'skipped',
    de: normalized.includes('de') ? 'pending' : 'skipped',
  };
}

export function resolveDispatchRequestedLanguagesFromPurchaserItems(
  purchasers: Array<{
    is_generate?: number;
    seller_account_id?: string;
    selectedVariantId?: string;
    purchaserNum?: any;
  }>,
  accountId: string,
  variantIds: string[]
): AiListingLang[] {
  const langs: AiListingLang[] = [];
  const account = String(accountId || '').trim();
  if (!account) return langs;
  const variantSet = new Set(
    (variantIds || []).map(id => String(id || '').trim()).filter(Boolean)
  );
  let hasEn = false;
  let hasDe = false;
  for (const item of purchasers || []) {
    if (Number(item?.is_generate) !== 2) continue;
    if (String(item?.seller_account_id || '').trim() !== account) continue;
    const vid = String(item?.selectedVariantId || '').trim();
    if (variantSet.size && vid && !variantSet.has(vid)) continue;
    let raw = item.purchaserNum;
    try {
      if (typeof raw === 'string') raw = JSON.parse(raw || '{}');
    } catch {
      raw = {};
    }
    if (Number((raw as any)?.uk || 0) > 0) hasEn = true;
    if (Number((raw as any)?.de || 0) > 0) hasDe = true;
  }
  if (hasEn && !langs.includes('en')) langs.push('en');
  if (hasDe && !langs.includes('de')) langs.push('de');
  return langs;
}

/** 采购行 uk/de 汇总为需生成语言；指定店铺时仅统计 seller_account_id 匹配且非空的行 */
export function resolveRequiredLanguagesFromPurchaseRows(
  rows: Array<{
    seller_account_id?: string | null;
    uk?: number;
    de?: number;
  }>,
  sellerAccountId?: string
): AiListingLang[] {
  const accountId = String(sellerAccountId || '').trim();
  let needEn = false;
  let needDe = false;
  for (const row of rows || []) {
    if (accountId) {
      const sid = String(row.seller_account_id || '').trim();
      if (!sid || sid !== accountId) continue;
    }
    if (Number(row.uk || 0) > 0) needEn = true;
    if (Number(row.de || 0) > 0) needDe = true;
  }
  const langs: AiListingLang[] = [];
  if (needEn) langs.push('en');
  if (needDe) langs.push('de');
  return langs;
}

export function ensureAiListingTaskPayloadValid(
  payload: AiListingTaskCreatePayload
) {
  if (!payload?.target_candidate_id)
    throw new Error('target_candidate_id 必填');
  if (!payload?.task_type) throw new Error('task_type 必填');
  if (payload.task_type !== AI_LISTING_TASK_TYPE.SIMPLE_VARIANT) {
    throw new Error('complex_variant 暂未开放');
  }
  if (!payload.target_amazon_account_id)
    throw new Error('simple_variant 必须传 target_amazon_account_id');
  if (!Array.isArray(payload.target_variant_ids))
    throw new Error('simple_variant 必须传 target_variant_ids');
  const validVariantIds = payload.target_variant_ids
    .map(id => String(id || '').trim())
    .filter(Boolean);
  if (!validVariantIds.length)
    throw new Error('simple_variant 至少选择一个变体');
  const countryCode = String(payload.country_code || 'uk').trim().toLowerCase();
  if (!countryCode) throw new Error('country_code 不能为空');
  if (countryCode !== 'uk') {
    throw new Error(`country_code=${countryCode} 暂不支持，当前仅支持 uk`);
  }
  if (payload.requested_languages != null) {
    const langs = normalizeRequestedLanguages(payload.requested_languages);
    if (!langs.length) {
      throw new Error('requested_languages 至少选择一种语言');
    }
  }
  const referenceSourceType = normalizeReferenceSourceType(
    payload.reference_source_type
  );
  if (referenceSourceType === 'manual_bullets') {
    const bullets = normalizeManualReferenceBullets(
      payload.manual_reference_bullets
    );
    if (bullets.length !== 5) {
      throw new Error('manual_reference_bullets 必须传 5 条');
    }
  }
}

export function buildAiListingTaskTargetKey(
  payload: AiListingTaskCreatePayload
): string {
  if (payload.task_type === AI_LISTING_TASK_TYPE.SIMPLE_VARIANT) {
    return `simple|candidate:${payload.target_candidate_id}|account:${payload.target_amazon_account_id}|country:${String(
      payload.country_code || 'uk'
    )
      .trim()
      .toLowerCase()}`;
  }
  return `complex|candidate:${payload.target_candidate_id}|msku:${
    payload.target_msku || ''
  }`;
}

export function buildAiListingTaskIdempotencyKey(
  payload: AiListingTaskCreatePayload
): string {
  const action = payload.action || 'run';
  const referenceSourceType = normalizeReferenceSourceType(
    payload.reference_source_type
  );
  const manualBulletsKey =
    referenceSourceType === 'manual_bullets'
      ? normalizeManualReferenceBullets(payload.manual_reference_bullets)
          .map(x => x.replace(/[|]/g, '/'))
          .join('|')
      : '';
  const sourceKey =
    referenceSourceType === 'manual_bullets'
      ? `manual:${manualBulletsKey}`
      : 'competitor';
  if (payload.task_type === AI_LISTING_TASK_TYPE.SIMPLE_VARIANT) {
    const countryCode = String(payload.country_code || 'uk').trim().toLowerCase();
    const groupKey = `simple|candidate:${payload.target_candidate_id}|account:${payload.target_amazon_account_id}|country:${countryCode}`;
    const taskMode = payload.task_mode === 'delta' ? 'delta' : 'full';
    if (taskMode === 'full') {
      return `aiListing|simple_variant|full|${groupKey}|${sourceKey}|${action}`;
    }
    const variants = (payload.target_variant_ids || [])
      .map(id => String(id || '').trim())
      .filter(Boolean)
      .sort()
      .join(',');
    return `aiListing|simple_variant|delta|${groupKey}|${variants}|${sourceKey}|${action}`;
  }
  return `aiListing|complex_variant|${payload.target_candidate_id}|${
    payload.target_msku || ''
  }|${action}`;
}

export function shouldRetry(
  currentAttempt: number,
  maxAttempts: number
): boolean {
  return Number(currentAttempt) < Number(maxAttempts);
}
