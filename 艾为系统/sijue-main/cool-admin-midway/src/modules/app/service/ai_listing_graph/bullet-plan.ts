export type BulletPlanFact = {
  id: string;
  source_type: 'manual' | 'competitor';
  source_index: number;
  competitor_index: number | null;
  text: string;
  normalized_text: string;
  tokens: string[];
};

export type BulletPlanItem = {
  title: string;
  scope: string;
  fact_ids: string[];
  forbidden_fact_ids: string[];
  key_words: string[];
  ref: string[];
  forbidden_refs: string[];
};

const FACT_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'our',
  'that',
  'the',
  'their',
  'this',
  'to',
  'with',
  'your',
]);

export function normalizeFactText(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9\s-]+/gi, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeFactText(value: string) {
  return normalizeFactText(value)
    .split(/\s+/)
    .filter(token => token && !FACT_STOPWORDS.has(token) && token.length >= 3);
}

export function createReferenceFacts(input: {
  reference_source_type?: 'manual_bullets' | 'competitor' | null;
  reference_bullet_points?: string[] | null;
  competitor_bullet_points?: string[][] | null;
}) {
  if (input.reference_source_type === 'manual_bullets') {
    return (input.reference_bullet_points || [])
      .map((text, idx) => String(text || '').trim())
      .filter(Boolean)
      .map((text, idx) => ({
        id: `manual_${idx + 1}`,
        source_type: 'manual' as const,
        source_index: idx,
        competitor_index: null,
        text,
        normalized_text: normalizeFactText(text),
        tokens: tokenizeFactText(text),
      }));
  }
  const facts: BulletPlanFact[] = [];
  for (const [competitorIdx, rows] of (input.competitor_bullet_points || []).entries()) {
    for (const [rowIdx, raw] of (rows || []).entries()) {
      const text = String(raw || '').trim();
      if (!text) continue;
      facts.push({
        id: `competitor_${competitorIdx + 1}_${rowIdx + 1}`,
        source_type: 'competitor',
        source_index: rowIdx,
        competitor_index: competitorIdx,
        text,
        normalized_text: normalizeFactText(text),
        tokens: tokenizeFactText(text),
      });
    }
  }
  return facts;
}

export function buildFactCatalogForPrompt(facts: BulletPlanFact[]) {
  return facts
    .map(fact => {
      const sourceLabel =
        fact.source_type === 'manual'
          ? `人工卖点${fact.source_index + 1}`
          : `竞品${Number(fact.competitor_index || 0) + 1}-卖点${fact.source_index + 1}`;
      return `${fact.id} | ${sourceLabel}\n${fact.text}`;
    })
    .join('\n\n');
}

function uniqStrings(values: string[]) {
  return Array.from(new Set(values.map(x => String(x || '').trim()).filter(Boolean)));
}

export function finalizeBulletPlans(rawPlans: any[], facts: BulletPlanFact[]) {
  const validFactIds = new Set(facts.map(fact => fact.id));
  const sanitized = rawPlans
    .map((row: any) => ({
      title: String(row?.title || '').trim(),
      scope: String(row?.scope || '').trim(),
      fact_ids: uniqStrings(
        Array.isArray(row?.fact_ids) ? row.fact_ids.map((id: any) => String(id || '').trim()) : []
      ).filter(id => validFactIds.has(id)),
      key_words: [],
      forbidden_fact_ids: [] as string[],
      ref: [] as string[],
      forbidden_refs: [] as string[],
    }))
    .filter((row: BulletPlanItem) => row.title && row.scope && row.fact_ids.length);

  const plannedFactIds = uniqStrings(sanitized.flatMap(plan => plan.fact_ids));
  for (const plan of sanitized) {
    plan.forbidden_fact_ids = plannedFactIds.filter(id => !plan.fact_ids.includes(id));
    plan.ref = resolveFactTexts(plan.fact_ids, facts);
    plan.forbidden_refs = resolveFactTexts(plan.forbidden_fact_ids, facts);
  }
  return sanitized;
}

export function resolveFactTexts(factIds: string[], facts: BulletPlanFact[]) {
  const factMap = new Map(facts.map(fact => [fact.id, fact.text]));
  return uniqStrings(factIds.map(id => factMap.get(id) || ''));
}

function hasEnoughTokenOverlap(candidateTokens: string[], factTokens: string[]) {
  if (!candidateTokens.length || !factTokens.length) return false;
  const candidateSet = new Set(candidateTokens);
  let hit = 0;
  for (const token of factTokens) {
    if (candidateSet.has(token)) hit += 1;
  }
  return hit >= Math.min(3, factTokens.length);
}

export function containsForbiddenFactLeak(
  text: string,
  forbiddenFacts: string[],
  allowedFacts: string[] = []
) {
  const normalized = normalizeFactText(text);
  if (!normalized) return false;
  const allowedNormalized = new Set(
    allowedFacts.map(item => normalizeFactText(item)).filter(Boolean)
  );
  const candidateTokens = tokenizeFactText(text);
  for (const fact of forbiddenFacts || []) {
    const normalizedFact = normalizeFactText(fact);
    if (!normalizedFact || allowedNormalized.has(normalizedFact)) continue;
    const factTokens = tokenizeFactText(fact);
    if (normalized.includes(normalizedFact) && normalizedFact.split(/\s+/).length >= 3) {
      return true;
    }
    if (normalizedFact.length >= 18 && normalized.includes(normalizedFact)) {
      return true;
    }
    if (hasEnoughTokenOverlap(candidateTokens, factTokens)) {
      return true;
    }
  }
  return false;
}
