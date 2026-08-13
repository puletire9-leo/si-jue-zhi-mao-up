/**
 * 核心词/关键词短语匹配：统一归一化后做子串包含判断（兼容 red-light / Red Light 等写法）。
 */
export function normalizeListingText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 校验 text 是否包含 phrase（归一化后的连续子串） */
export function textContainsPhrase(text: string, phrase: string): boolean {
  const normalizedPhrase = normalizeListingText(phrase);
  if (!normalizedPhrase) return true;
  const normalizedText = normalizeListingText(text);
  return normalizedText.includes(normalizedPhrase);
}

/** 返回 text 中未覆盖的必需短语列表 */
export function findMissingPhrases(text: string, phrases: string[]): string[] {
  const required = (phrases || [])
    .map(p => String(p || '').trim())
    .filter(Boolean);
  return required.filter(phrase => !textContainsPhrase(text, phrase));
}

export function textContainsAllPhrases(text: string, phrases: string[]): boolean {
  return findMissingPhrases(text, phrases).length === 0;
}

/** AI 常返回 `A / B` 合并项，拆成多个候选 */
export function expandMergedKeywordTerms(term: string): string[] {
  const raw = String(term || '').trim();
  if (!raw) return [];
  const parts = raw
    .split(/\s*(?:\/|\|)\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts.length ? parts : [raw]) {
    const key = normalizeListingText(part);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(part);
  }
  return unique;
}

/** 选词/搜索量 lookup：归一化标点与大小写，保留词序 */
export function keywordLookupKey(value: string): string {
  return normalizeListingText(value);
}

/**
 * 选词去重签名：词袋排序（处理 red-light / red light / therapy red-light）。
 * 不合并 token 集合不同的写法（如 white board vs whiteboard）。
 */
export function canonicalKeywordKey(value: string): string {
  const normalized = normalizeListingText(value);
  if (!normalized) return '';
  return normalized.split(' ').filter(Boolean).sort().join(' ');
}

export function mergeKeywordSearchVolume(
  map: Record<string, number>,
  keyword: string,
  volume: number
) {
  const vol = Math.max(0, Number(volume) || 0);
  const lookup = keywordLookupKey(keyword);
  const canonical = canonicalKeywordKey(keyword);
  if (lookup) map[lookup] = Math.max(map[lookup] || 0, vol);
  if (canonical) map[canonical] = Math.max(map[canonical] || 0, vol);
}

export function getKeywordSearchVolume(
  map: Record<string, number>,
  keyword: string
): number {
  const lookup = keywordLookupKey(keyword);
  const canonical = canonicalKeywordKey(keyword);
  return Math.max(
    lookup ? Number(map[lookup] || 0) : 0,
    canonical ? Number(map[canonical] || 0) : 0
  );
}

export function keywordTokenSet(value: string): Set<string> {
  const normalized = normalizeListingText(value);
  if (!normalized) return new Set();
  return new Set(normalized.split(' ').filter(Boolean));
}

/** inner 的全部 token 是否都出现在 outer 中（词袋包含，与语序无关） */
export function isKeywordTokenSubset(inner: string, outer: string): boolean {
  const innerSet = keywordTokenSet(inner);
  const outerSet = keywordTokenSet(outer);
  if (!innerSet.size) return true;
  if (innerSet.size > outerSet.size) return false;
  for (const token of innerSet) {
    if (!outerSet.has(token)) return false;
  }
  return true;
}

/**
 * 选词去重：canonical 相同，或一方 token 集为另一方真子集。
 * 不合并 token 集合无包含关系的词（如 white board vs whiteboard）。
 */
export function keywordsOverlapForSelection(a: string, b: string): boolean {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right) return false;
  const leftCanonical = canonicalKeywordKey(left);
  const rightCanonical = canonicalKeywordKey(right);
  if (leftCanonical && leftCanonical === rightCanonical) return true;
  return isKeywordTokenSubset(left, right) || isKeywordTokenSubset(right, left);
}

export function isKeywordSubsetOfAny(candidate: string, chosen: string[]): boolean {
  const kw = String(candidate || '').trim();
  if (!kw) return false;
  return (chosen || []).some(existing => isKeywordTokenSubset(kw, existing));
}

/** 与已选核心词「同一写法/语序无关的同一词袋」，用于长尾去重（不含真子集） */
export function isSameKeywordVariant(a: string, b: string): boolean {
  const left = String(a || '').trim();
  const right = String(b || '').trim();
  if (!left || !right) return false;
  if (left.toLowerCase() === right.toLowerCase()) return true;
  const leftCanonical = canonicalKeywordKey(left);
  const rightCanonical = canonicalKeywordKey(right);
  return Boolean(leftCanonical && leftCanonical === rightCanonical);
}

export function findChosenIndicesSubsumedBy(
  candidate: string,
  chosen: string[]
): number[] {
  const kw = String(candidate || '').trim();
  if (!kw) return [];
  const indices: number[] = [];
  (chosen || []).forEach((existing, index) => {
    const phrase = String(existing || '').trim();
    if (!phrase) return;
    if (
      isKeywordTokenSubset(phrase, kw) &&
      canonicalKeywordKey(phrase) !== canonicalKeywordKey(kw)
    ) {
      indices.push(index);
    }
  });
  return indices;
}
