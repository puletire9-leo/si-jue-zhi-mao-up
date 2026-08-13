export const AI_LISTING_PREFLIGHT_MIN_KEYWORDS = 30;
/** 强制提交时：英/德关键词数量下限（>= 该值即满足） */
export const AI_LISTING_PREFLIGHT_FORCE_KEYWORD_MIN = 3;

export type AiListingPreflightVariantRow = {
  id: string;
  name: string;
  description: string | null;
};

export type AiListingPreflightInput = {
  ukKeywordCount: number;
  deKeywordCount: number;
  ukCompetitorCount: number;
  deCompetitorCount: number;
  variantIds: string[];
  variants: AiListingPreflightVariantRow[];
  referenceSourceType?: 'manual_bullets' | 'competitor';
  manualReferenceBullets?: string[];
};

export type AiListingPreflightSuccess = { ok: true };
export type AiListingPreflightFailure = {
  ok: false;
  message: string;
  details: Record<string, any>;
};

export type AiListingPreflightResult =
  | AiListingPreflightSuccess
  | AiListingPreflightFailure;

function keywordCountPasses(
  count: number,
  options: { forceLowKeywords?: boolean }
): boolean {
  if (options.forceLowKeywords) {
    return count >= AI_LISTING_PREFLIGHT_FORCE_KEYWORD_MIN;
  }
  return count >= AI_LISTING_PREFLIGHT_MIN_KEYWORDS;
}

function keywordRequirementLabel(options: { forceLowKeywords?: boolean }): string {
  if (options.forceLowKeywords) {
    return `>= ${AI_LISTING_PREFLIGHT_FORCE_KEYWORD_MIN}`;
  }
  return `>= ${AI_LISTING_PREFLIGHT_MIN_KEYWORDS}`;
}

export type AiListingPreflightLang = 'en' | 'de';

export function validateAiListingPreflight(
  input: AiListingPreflightInput,
  options: {
    mode: 'full' | 'delta';
    forceLowKeywords?: boolean;
    /** full 模式下需校验的市场；空数组表示跳过关键词/竞品（如 delta 由调用方传 mode） */
    requiredLanguages?: AiListingPreflightLang[];
  }
): AiListingPreflightResult {
  const issues: string[] = [];
  const forceLowKeywords = Boolean(options.forceLowKeywords);
  const kwReq = keywordRequirementLabel({ forceLowKeywords });
  const required = Array.isArray(options.requiredLanguages)
    ? options.requiredLanguages
    : (['en', 'de'] as AiListingPreflightLang[]);

  if (options.mode === 'full' && required.length) {
    const referenceSourceType =
      input.referenceSourceType === 'manual_bullets'
        ? 'manual_bullets'
        : 'competitor';
    if (required.includes('en')) {
      if (!keywordCountPasses(input.ukKeywordCount, { forceLowKeywords })) {
        issues.push(`英国关键词 ${input.ukKeywordCount}/${kwReq}`);
      }
      if (
        referenceSourceType === 'competitor' &&
        input.ukCompetitorCount < 1
      ) {
        issues.push(`英国竞品 ${input.ukCompetitorCount} 条`);
      }
    }
    if (required.includes('de')) {
      if (!keywordCountPasses(input.deKeywordCount, { forceLowKeywords })) {
        issues.push(`德国关键词 ${input.deKeywordCount}/${kwReq}`);
      }
      if (
        referenceSourceType === 'competitor' &&
        input.deCompetitorCount < 1
      ) {
        issues.push(`德国竞品 ${input.deCompetitorCount} 条`);
      }
    }
    if (referenceSourceType === 'manual_bullets') {
      const bullets = Array.isArray(input.manualReferenceBullets)
        ? input.manualReferenceBullets.map(x => String(x || '').trim())
        : [];
      if (bullets.length !== 5) {
        issues.push('人工卖点必须提供 5 条');
      } else {
        bullets.forEach((item, index) => {
          if (!item) issues.push(`人工卖点第 ${index + 1} 条为空`);
        });
      }
    }
  }

  const variantIds = (input.variantIds || [])
    .map(id => String(id || '').trim())
    .filter(Boolean);
  if (!variantIds.length) {
    issues.push('未指定变体');
  }

  const variantById = new Map(
    (input.variants || []).map(row => [String(row.id || '').trim(), row])
  );
  for (const variantId of variantIds) {
    const row = variantById.get(variantId);
    if (!row) {
      issues.push(`变体 ${variantId} 不存在或已删除`);
      continue;
    }
    const displayName = String(row.name || '').trim() || variantId;
    if (!String(row.name || '').trim()) {
      issues.push(`变体「${displayName}」缺少名称`);
    }
    if (!String(row.description || '').trim()) {
      issues.push(`变体「${displayName}」缺少描述`);
    }
  }

  if (!issues.length) {
    return { ok: true as const };
  }

  return {
    ok: false as const,
    message: `前置校验失败：${issues.join('；')}`,
    details: {
      mode: options.mode,
      force_low_keywords: forceLowKeywords,
      required_languages: required,
      issues,
      uk_keyword_count: input.ukKeywordCount,
      de_keyword_count: input.deKeywordCount,
      uk_competitor_count: input.ukCompetitorCount,
      de_competitor_count: input.deCompetitorCount,
      variant_ids: variantIds,
      reference_source_type:
        input.referenceSourceType === 'manual_bullets'
          ? 'manual_bullets'
          : 'competitor',
      manual_reference_bullets: input.manualReferenceBullets || [],
    },
  };
}
