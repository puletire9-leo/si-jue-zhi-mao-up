import { ChatPromptTemplate } from '@langchain/core/prompts';
import { getLlmByUser } from '../llm';
import { ListingGeneratorState } from '../state';
import { containsDisallowedTargetScript } from '../language-guard';
import {
  buildFactCatalogForPrompt,
  BulletPlanFact,
  createReferenceFacts,
  finalizeBulletPlans,
} from '../bullet-plan';

export const BULLET_POINT_COUNT = 5;

export function buildBulletPlanValidationFeedback(
  rows: Array<{
    title?: string;
    scope?: string;
    fact_ids?: string[];
  }>,
  language: string,
  expectedCount: number
) {
  const reasons: string[] = [];
  if (rows.length !== expectedCount) {
    reasons.push(`卖点数量必须为 ${expectedCount} 条，当前为 ${rows.length} 条`);
  }
  rows.forEach((row, idx) => {
    const title = String(row?.title || '').trim();
    const scope = String(row?.scope || '').trim();
    const factIds = Array.isArray(row?.fact_ids) ? row.fact_ids : [];
    if (!title) reasons.push(`第 ${idx + 1} 条缺少 title`);
    if (!scope) reasons.push(`第 ${idx + 1} 条缺少 scope`);
    if (!factIds.length) reasons.push(`第 ${idx + 1} 条缺少 fact_ids`);
    if (title && containsDisallowedTargetScript(title, language)) {
      reasons.push(`第 ${idx + 1} 条 title 必须使用 ${language}，不要输出中文/日文/韩文`);
    }
    if (scope && containsDisallowedTargetScript(scope, language)) {
      reasons.push(`第 ${idx + 1} 条 scope 必须使用 ${language}`);
    }
  });
  return reasons;
}

async function invokeBulletPlanChainWithRetry(args: {
  chain: any;
  product_summary: string;
  fact_catalog: string;
  language: string;
  expectedCount?: number;
}) {
  const expectedCount = Number(args.expectedCount || BULLET_POINT_COUNT);
  let feedback = '';
  let lastRows: any[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = (await args.chain.invoke({
      product_summary: args.product_summary || '',
      fact_catalog: feedback
        ? `${args.fact_catalog}\n\n上次输出不合规，请严格修正：\n${feedback}`
        : args.fact_catalog,
      language: args.language,
    } as any)) as any;
    const rows = Array.isArray(res?.bullet_titles) ? res.bullet_titles : [];
    lastRows = rows;
    const reasons = buildBulletPlanValidationFeedback(
      rows,
      args.language,
      expectedCount
    );
    if (!reasons.length) {
      return rows;
    }
    feedback = reasons.join('\n');
  }
  return lastRows;
}

export function validateInput(state: ListingGeneratorState) {
  if (!state.username) throw new Error('username is required');
  if (!state.language) throw new Error('language is required');
  if (!Array.isArray(state.keywords) || !state.keywords.length) {
    throw new Error('必须存在关键词列表');
  }
  const sorted = [...state.keywords].sort((a, b) => {
    const rank = (t: string) =>
      t === '核心大词' ? 3 : t === '核心词' ? 2 : t === '长尾词' ? 1 : 0;
    if (rank(b.type) !== rank(a.type)) return rank(b.type) - rank(a.type);
    return Number(b.search_volume || 0) - Number(a.search_volume || 0);
  });
  let coreCount = 0;
  for (const kw of sorted) {
    if (kw.type === '核心词') {
      coreCount += 1;
        if (coreCount > 2) kw.type = '长尾词';
    }
  }
  const main = sorted.filter(k => k.type === '核心大词');
  const core = sorted.filter(k => k.type === '核心词');
  const tail = sorted.filter(k => k.type === '长尾词');
  if (main.length !== 1) throw new Error('必须存在且只有一个核心大词');
  if (!core.length) throw new Error('必须存在核心词');
  if (!tail.length) throw new Error('必须存在长尾词');
  if (
    main
      .concat(core)
      .some(
        k =>
          /[^\p{L}\p{M}\p{N}\s-]/u.test(String(k.keyword || '')) ||
          String(k.keyword || '').length > 70
      )
  ) {
    throw new Error('核心词和核心大词不包-和空格以外的标点符号，且长度小于70个字符');
  }
  if (
    main.concat(core).reduce((sum, k) => sum + String(k.keyword || '').length, 0) >
    180
  ) {
    throw new Error('核心词和核心大词总长度不超过 180 个字符');
  }
  if (state.duplicate_num == null || state.duplicate_num < 1 || state.duplicate_num > 20) {
    throw new Error('重复数量必须在1到20之间');
  }
  return { keywords: sorted };
}

export function shouldSkipSummary(state: ListingGeneratorState) {
  return state.product_summary ? 'extract_words' : 'generate_summary';
}

export async function generateSummary(state: ListingGeneratorState) {
  const llm = getLlmByUser(state.username);
  const referenceSourceType =
    state.reference_source_type === 'manual_bullets'
      ? 'manual_bullets'
      : 'competitor';
  const systemTemplate = `你是一个专业的亚马逊产品文案专家。
请根据提供的主关键词和竞品信息，提炼出这个产品的核心梗概。
梗概应该包含：
1. 这是什么产品（本质功能）
2. 主要用途
3. 核心优势
4. 目标用户群体
请用简洁的{language}回答，控制在200字以内。`;
  const humanTemplate = `主关键词：{main_keyword}

参考模式：{reference_source_type}

人工参考卖点：
{reference_bullet_points}

竞品标题：
{competitor_titles}

竞品卖点：
{competitor_bullet_points}`;
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemTemplate],
    ['human', humanTemplate],
  ]);
  const chain = prompt.pipe(llm);
  const bulletPoints = (state.competitor_bullet_points || []).flat();
  const mainKeyword =
    state.keywords.find(kw => kw.type === '核心大词')?.keyword || '';
  const res = await chain.invoke({
    main_keyword: mainKeyword,
    reference_source_type: referenceSourceType,
    reference_bullet_points: (state.reference_bullet_points || []).join('\n'),
    competitor_titles: (state.competitor_titles || []).join('\n'),
    competitor_bullet_points: bulletPoints.join('\n'),
    language: state.language || 'English',
  } as any);
  return { product_summary: String((res as any)?.content || '').trim() };
}

type TitleMaterialType = 'alternative' | 'modifier' | 'scene' | 'discard';

type NgramCandidate = {
  word: string;
  ngram: 1 | 2 | 3;
  frequency: number;
  search_volume: number;
  sources: string[];
  source_volumes: Array<{ source: string; volume: number }>;
  source_type: 'long tail';
  source_types: ['long tail'];
};

const HARD_STOPWORDS = new Set([
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
  'of',
  'on',
  'or',
  'the',
  'to',
]);

const TRAILING_CONNECTORS = new Set([
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'without',
]);

const normalizeMaterialPhrase = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeMaterialPhrase = (value: string) =>
  normalizeMaterialPhrase(value).split(/\s+/).filter(Boolean);

const shouldDropOneGram = (word: string) => {
  if (!word || word.length < 2) return true;
  if (HARD_STOPWORDS.has(word)) return true;
  if (/^\d+$/.test(word)) return true;
  return false;
};

const shouldDropMultiGram = (tokens: string[]) => {
  if (tokens.length < 2) return true;
  const last = tokens[tokens.length - 1];
  if (TRAILING_CONNECTORS.has(last)) return true;
  return tokens.every(t => HARD_STOPWORDS.has(t));
};

export function buildLongTailNgramCandidates(
  keywords: Array<{ type: string; keyword: string; search_volume?: number }>
): NgramCandidate[] {
  const candidateMap = new Map<
    string,
    {
      word: string;
      ngram: 1 | 2 | 3;
      sources: Map<string, number>;
    }
  >();

  for (const kw of keywords.filter(k => k.type === '长尾词')) {
    const source = String(kw.keyword || '').trim();
    const tokens = tokenizeMaterialPhrase(source);
    if (!source || !tokens.length) continue;
    const volume = Number(kw.search_volume || 0);
    const seenInSource = new Set<string>();

    for (const ngram of [1, 2, 3] as const) {
      for (let i = 0; i <= tokens.length - ngram; i++) {
        const gramTokens = tokens.slice(i, i + ngram);
        const word = gramTokens.join(' ');
        if (ngram === 1 && shouldDropOneGram(word)) continue;
        if (ngram > 1 && shouldDropMultiGram(gramTokens)) continue;
        const key = `${ngram}:${word}`;
        if (seenInSource.has(key)) continue;
        seenInSource.add(key);
        if (!candidateMap.has(key)) {
          candidateMap.set(key, { word, ngram, sources: new Map() });
        }
        candidateMap.get(key)!.sources.set(source, volume);
      }
    }
  }

  return Array.from(candidateMap.values())
    .map(item => {
      const sourceVolumes = Array.from(item.sources.entries()).map(
        ([source, volume]) => ({ source, volume })
      );
      return {
        word: item.word,
        ngram: item.ngram,
        frequency: sourceVolumes.length,
        search_volume: sourceVolumes.reduce((sum, x) => sum + Number(x.volume || 0), 0),
        sources: sourceVolumes.map(x => x.source),
        source_volumes: sourceVolumes,
        source_type: 'long tail' as const,
        source_types: ['long tail'] as ['long tail'],
      };
    })
    .filter(candidate => candidate.ngram === 1 || candidate.frequency >= 2)
    .sort((a, b) => {
      if (a.ngram !== b.ngram) return a.ngram - b.ngram;
      if (b.frequency !== a.frequency) return b.frequency - a.frequency;
      return b.search_volume - a.search_volume;
    });
}

export async function extractWords(state: ListingGeneratorState) {
  const llm = getLlmByUser(state.username);
  const candidates = buildLongTailNgramCandidates(state.keywords || []);
  if (!candidates.length) return { words_dict: [] };

  const systemTemplate = `你是 Amazon SEO 标题素材分类器。程序已经从长尾关键词中完成 1-3 gram 拆词，你不要拆词、不要合并、不要创造新词。
你的任务是判断每个候选词适合放在标题素材池的哪一类。

分类只能是：
- alternative: 产品本体、产品叫法、可作为标题主语的短语。通常是 2-3 gram，例如 squishy cubes, fidget toys, stress ball。
- modifier: 属性、材质、规格、功能、卖点，例如 squishy, soft, silicone, stress relief, non toxic, mini。
- scene: 人群、使用场景、送礼场景，例如 kids, for kids, classroom, office, party favors, birthday gifts。
- discard: 太泛、残缺、不自然、品牌词、竞品词、错误品类、或单独放进标题没有价值。

规则：
1. 必须覆盖每个输入 index，每个 index 只返回一次。
2. 不要新增词。
3. 不要拆分词。
4. 不要合并词。
5. normalized_word 只能做大小写、单复数、连字符/空格的轻微规范化，不能改写成新短语。
6. 对 1-gram 候选，只有明确属性/材质/规格/人群/场景才保留；泛品类碎片如 toy, toys, cube, cubes, ball, balls, set, pack 应 discard。
7. 对 2/3-gram 候选，完整产品叫法归 alternative；属性功能短语归 modifier；人群/场景/送礼归 scene。`;
  const humanTemplate = `产品梗概：
{product_summary}

语言：
{language}

候选词：
{candidates}

请返回 JSON：
{{
  "items": [
    {{
      "index": 0,
      "type": "alternative | modifier | scene | discard",
      "normalized_word": "candidate 的轻微规范化版本",
      "reason": "简短理由"
    }}
  ]
}}`;
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', systemTemplate],
    ['human', humanTemplate],
  ]);
  const chain = prompt.pipe(
    llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                index: { type: 'integer' },
                type: {
                  type: 'string',
                  enum: ['alternative', 'modifier', 'scene', 'discard'],
                },
                normalized_word: { type: 'string' },
                reason: { type: 'string' },
              },
              required: ['index', 'type'],
            },
          },
        },
        required: ['items'],
      },
      {
        name: 'title_material_classification',
        method: 'functionCalling',
      } as any
    )
  );

  const rows: any[] = [];
  const validTypes = new Set<TitleMaterialType>([
    'alternative',
    'modifier',
    'scene',
    'discard',
  ]);
  const chunkSize = 100;
  for (let offset = 0; offset < candidates.length; offset += chunkSize) {
    const chunk = candidates.slice(offset, offset + chunkSize);
    const candidateLines = chunk
      .map(
        (candidate, idx) =>
          `[${idx}] word: ${candidate.word}\nngram: ${candidate.ngram}\nfrequency: ${candidate.frequency}\nsearch_volume: ${candidate.search_volume}\nsources: ${candidate.sources.slice(0, 5).join(' | ')}`
      )
      .join('\n\n');
    let items: any[] = [];
    let feedback = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await chain.invoke({
        product_summary: state.product_summary || '',
        language: state.language || 'English',
        candidates: feedback
          ? `${candidateLines}\n\n上次输出不合规，请修正：\n${feedback}`
          : candidateLines,
      } as any);
      const rawItems = Array.isArray((res as any)?.items) ? (res as any).items : [];
      const seen = new Set<number>();
      const invalidReasons: string[] = [];
      items = [];
      for (const item of rawItems) {
        const index = Number(item?.index);
        const type = String(item?.type || '') as TitleMaterialType;
        if (!Number.isInteger(index) || index < 0 || index >= chunk.length) {
          invalidReasons.push(`非法 index: ${String(item?.index ?? '')}`);
          continue;
        }
        if (seen.has(index)) {
          invalidReasons.push(`重复 index: ${index}`);
          continue;
        }
        if (!validTypes.has(type)) {
          invalidReasons.push(`非法 type: ${String(item?.type ?? '')}`);
          continue;
        }
        seen.add(index);
        items.push(item);
      }
      if (seen.size !== chunk.length) {
        const missed = chunk
          .map((_, idx) => idx)
          .filter(idx => !seen.has(idx))
          .map(idx => `[${idx}] ${chunk[idx].word}`);
        invalidReasons.push(`缺少 index: ${missed.join(' | ')}`);
      }
      if (!invalidReasons.length) break;
      feedback = invalidReasons.join('\n');
    }

    for (const item of items) {
      const candidate = chunk[Number(item.index)];
      if (!candidate) continue;
      const type = String(item.type || '') as TitleMaterialType;
      if (type === 'discard') continue;
      if (candidate.ngram === 1 && !['modifier', 'scene'].includes(type)) continue;
      const normalizedWord = normalizeMaterialPhrase(
        String(item.normalized_word || candidate.word)
      );
      const word = normalizedWord || candidate.word;
      rows.push({
        source: candidate.sources[0] || word,
        sources: candidate.sources,
        source_volumes: candidate.source_volumes,
        source_type: 'long tail',
        source_types: ['long tail'],
        ngram: candidate.ngram,
        frequency: candidate.frequency,
        search_volume: candidate.search_volume,
        words: [{ word, type }],
      });
    }
  }
  return { words_dict: rows };
}

export function analyzeSearchVolume(state: ListingGeneratorState) {
  const extractedWords = state.words_dict || [];
  const phraseMap = new Map<string, any>();
  for (const wordInfo of extractedWords) {
    const words = wordInfo?.words || [];
    for (const wd of words) {
      const word = normalizeMaterialPhrase(String(wd?.word || ''));
      const type = String(wd?.type || '');
      if (!word || !['alternative', 'modifier', 'scene'].includes(type)) continue;
      const key = `${type}:${word}`;
      if (!phraseMap.has(key)) {
        phraseMap.set(key, {
          word,
          source_type: 'long tail',
          source_types: ['long tail'],
          type,
          ngram: Number(wordInfo?.ngram || word.split(/\s+/).length),
          sources: [] as string[],
          source_volumes: new Map<string, number>(),
        });
      }
      const phrase = phraseMap.get(key);
      phrase.ngram = Math.max(
        Number(phrase.ngram || 1),
        Number(wordInfo?.ngram || word.split(/\s+/).length)
      );
      const sourceVolumes = Array.isArray(wordInfo?.source_volumes)
        ? wordInfo.source_volumes
        : [];
      if (sourceVolumes.length) {
        for (const sourceVolume of sourceVolumes) {
          const source = String(sourceVolume?.source || '');
          if (!source) continue;
          if (!phrase.source_volumes.has(source)) {
            phrase.source_volumes.set(source, Number(sourceVolume?.volume || 0));
          }
        }
      } else {
        const source = String(wordInfo?.source || '');
        if (source && !phrase.source_volumes.has(source)) {
          phrase.source_volumes.set(source, Number(wordInfo?.search_volume || 0));
        }
      }
    }
  }
  const phraseList = Array.from(phraseMap.values()).map(phrase => {
    const sourceVolumes = Array.from(phrase.source_volumes.entries()).map(
      ([source, volume]) => ({ source, volume })
    );
    return {
      ...phrase,
      frequency: sourceVolumes.length || Number(phrase.frequency || 1),
      search_volume: sourceVolumes.reduce((sum, x) => sum + Number(x.volume || 0), 0),
      sources: sourceVolumes.map(x => x.source),
      source_volumes: sourceVolumes,
    };
  });

  // 修饰词/场景词做同类型父子吸收；替换词不吸收，避免丢掉更宽泛的产品叫法。
  const absorptionList = phraseList.filter(phrase =>
    ['modifier', 'scene'].includes(String(phrase.type || ''))
  );
  absorptionList.sort(
    (a, b) => String(b.word || '').length - String(a.word || '').length
  );
  const toRemove = new Set<any>();
  for (let i = 0; i < absorptionList.length; i++) {
    const parent = absorptionList[i];
    if (toRemove.has(parent)) continue;
    const parentText = normalizeMaterialPhrase(String(parent.word || ''));
    if (!parentText) continue;
    for (let j = i + 1; j < absorptionList.length; j++) {
      const child = absorptionList[j];
      if (toRemove.has(child)) continue;
      if (String(parent.type || '') !== String(child.type || '')) continue;
      const childText = normalizeMaterialPhrase(String(child.word || ''));
      if (!childText || parentText === childText || !parentText.includes(childText)) {
        continue;
      }
      const parentSourceVolumes = new Map(
        (parent.source_volumes || []).map((x: any) => [
          String(x.source || ''),
          Number(x.volume || 0),
        ])
      );
      for (const sourceVolume of child.source_volumes || []) {
        const source = String(sourceVolume?.source || '');
        if (!source || parentSourceVolumes.has(source)) continue;
        parentSourceVolumes.set(source, Number(sourceVolume?.volume || 0));
      }
      const mergedSourceVolumes = Array.from(parentSourceVolumes.entries()).map(
        ([source, volume]) => ({ source, volume })
      );
      parent.source_volumes = mergedSourceVolumes;
      parent.sources = mergedSourceVolumes.map(x => x.source);
      parent.frequency = mergedSourceVolumes.length;
      parent.search_volume = mergedSourceVolumes.reduce(
        (sum, x) => sum + Number(x.volume || 0),
        0
      );
      toRemove.add(child);
    }
  }

  const merged = phraseList.filter(phrase => !toRemove.has(phrase));
  const maxVolume = Math.max(...merged.map(x => Number(x.search_volume || 0)), 1);
  const maxFreq = Math.max(...merged.map(x => Number(x.frequency || 0)), 1);
  const frequencyWeight = Number((state as any).frequency_weight ?? 0.7);
  const searchWeight = 1 - frequencyWeight;
  for (const phrase of merged) {
    phrase.score =
      (Number(phrase.search_volume || 0) / maxVolume) * searchWeight +
      (Number(phrase.frequency || 0) / maxFreq) * frequencyWeight;
  }
  const sortByScore = (a: any, b: any) => {
    if (Number(b.score || 0) !== Number(a.score || 0)) {
      return Number(b.score || 0) - Number(a.score || 0);
    }
    return Number(b.search_volume || 0) - Number(a.search_volume || 0);
  };
  const alternatives = merged
    .filter(phrase => String(phrase.type || '') === 'alternative')
    .filter(phrase => Number(phrase.ngram || 1) >= 2 && Number(phrase.ngram || 1) <= 3)
    .sort(sortByScore)
    .slice(0, 5);
  const modifiers = merged
    .filter(phrase => String(phrase.type || '') === 'modifier')
    .sort(sortByScore);
  const scenes = merged
    .filter(phrase => String(phrase.type || '') === 'scene')
    .sort(sortByScore);
  return { search_stats: [...alternatives, ...modifiers, ...scenes] };
}

export function shouldSkipBulletPoints(state: ListingGeneratorState) {
  const list = state.bullet_points_title || [];
  if (list.length === BULLET_POINT_COUNT && String(list[0] || '').trim()) {
    return 'generate_bullet_point_title_from_user_input';
  }
  return 'generate_bullet_point_title';
}

function withBulletPlanKeywords(
  bulletPlans: Array<{
    title: string;
    scope: string;
    fact_ids: string[];
    forbidden_fact_ids: string[];
    ref: string[];
    forbidden_refs: string[];
    key_words: string[];
  }>,
  state: ListingGeneratorState
) {
  const core = state.keywords
    .filter(kw => kw.type === '核心词')
    .map(kw => kw.keyword);
  const main = state.keywords
    .filter(kw => kw.type === '核心大词')
    .map(kw => kw.keyword);
  const randomSample = (arr: string[], n: number) => {
    const pool = [...arr];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, Math.max(0, n));
  };
  for (let i = 0; i < bulletPlans.length; i++) {
    bulletPlans[i].key_words = [];
    if (i < 2) {
      bulletPlans[i].key_words =
        core.length >= 1 ? [...main, ...randomSample(core, 1)] : [...main];
    } else {
      bulletPlans[i].key_words =
        core.length >= 2 ? randomSample(core, 2) : [...main, ...core];
    }
  }
  return bulletPlans;
}

export async function generateBulletPointTitle(state: ListingGeneratorState) {
  const llm = getLlmByUser(state.username);
  const facts = createReferenceFacts({
    reference_source_type: state.reference_source_type,
    reference_bullet_points: state.reference_bullet_points,
    competitor_bullet_points: state.competitor_bullet_points,
  });
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `你是一个亚马逊营销专家。请基于事实池先规划 5 个彼此独立的卖点，再返回卖点计划。
要求：
- 每个卖点标题一般为几个单词的短语，不要超过 6 个单词
- title 和 scope 必须使用 {language} 输出
- 每个卖点只能围绕一个清晰主题；不要把不同事实拼成一个卖点
- 5 个卖点之间不要复用同一个核心事实，尽量做到事实边界清晰
- scope 字段要说明本卖点允许展开的唯一主题，必须具体
- fact_ids 只能从我提供的事实池里选择；每条至少 1 个，最多 2 个
- 不要编造事实，不要引用事实池之外的信息
- 返回值中的 key_words 请直接返回空列表`,
    ],
    [
      'human',
      '产品概览：{product_summary}\n事实池：\n{fact_catalog}',
    ],
  ]);
  const chain = prompt.pipe(
    llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          bullet_titles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                scope: { type: 'string' },
                fact_ids: { type: 'array', items: { type: 'string' } },
                key_words: { type: 'array', items: { type: 'string' } },
              },
              required: ['title', 'scope', 'fact_ids'],
            },
          },
        },
        required: ['bullet_titles'],
      },
      {
        name: 'bullet_titles',
        method: 'functionCalling',
      } as any
    )
  );
  const rows = await invokeBulletPlanChainWithRetry({
    chain,
    product_summary: state.product_summary || '',
    fact_catalog: buildFactCatalogForPrompt(facts),
    language: state.language || 'English',
    expectedCount: BULLET_POINT_COUNT,
  });
  const bulletPlans = withBulletPlanKeywords(
    finalizeBulletPlans(rows, facts),
    state
  );
  return { bullet_titles: { bullet_titles: bulletPlans, facts } };
}

export async function generateBulletPointTitleFromUserInput(
  state: ListingGeneratorState
) {
  const llm = getLlmByUser(state.username);
  const facts = createReferenceFacts({
    reference_source_type: 'manual_bullets',
    reference_bullet_points: state.bullet_points_title,
    competitor_bullet_points: [],
  });
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `你是一个亚马逊营销专家，请根据我提供的 5 个参考卖点事实和产品概述，用{language}生成 5 个卖点计划。
要求：
- 每个标题一般为几个单词的短语，不要超过 6 个单词
- title 和 scope 必须使用 {language}
- 必须严格按输入顺序一一对应：输入卖点1只生成输出卖点1，不能重排、合并或借用其他卖点的细节
- scope 字段要把该输入卖点允许展开的主题说明清楚
- fact_ids 只能填写当前这条输入卖点对应的 fact id
- 输入可能包含中文、英文或混合语言；你需要先理解含义，再输出{language}
- 不要照抄源语言碎片、内部备注或不自然的原文片段
- 返回值中的 key_words 请直接返回空列表`,
    ],
    ['human', '产品概览：{product_summary}\n参考事实池：\n{fact_catalog}'],
  ]);
  const chain = prompt.pipe(
    llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          bullet_titles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                scope: { type: 'string' },
                fact_ids: { type: 'array', items: { type: 'string' } },
                key_words: { type: 'array', items: { type: 'string' } },
              },
              required: ['title', 'scope', 'fact_ids'],
            },
          },
        },
        required: ['bullet_titles'],
      },
      {
        name: 'bullet_titles',
        method: 'functionCalling',
      } as any
    )
  );
  const rawPlans = await invokeBulletPlanChainWithRetry({
    chain,
    product_summary: state.product_summary || '',
    fact_catalog: buildFactCatalogForPrompt(facts),
    language: state.language || 'English',
    expectedCount: facts.length || BULLET_POINT_COUNT,
  });
  const alignedPlans = facts.map((fact, idx) => {
    const row = rawPlans[idx] || {};
    return {
      title: String(row?.title || '').trim(),
      scope: String(row?.scope || '').trim(),
      fact_ids: [fact.id],
    };
  });
  const bulletPlans = withBulletPlanKeywords(finalizeBulletPlans(alignedPlans, facts), state);
  return { bullet_titles: { bullet_titles: bulletPlans, facts } as any };
}

export function gatherBulletPointsTitle(state: ListingGeneratorState) {
  const facts = (((state.bullet_titles as any)?.facts || []) as BulletPlanFact[]) || [];
  const bulletTitles = (((state.bullet_titles as any)?.bullet_titles || []) as any[]) || [];
  return {
    bullet_titles: {
      bullet_titles: withBulletPlanKeywords(bulletTitles, state),
      facts,
    },
  };
}

function hasDescriptionDetailFactsForValidation(state: ListingGeneratorState) {
  const input = ((state as any).input || {}) as any;
  const hasParameterFacts = Boolean(
    String(state.key_parameters || input.key_parameters || '').trim() ||
      String(state.package_info || input.package_info || '').trim() ||
      String(state.product_args || input.product_args || '').trim()
  );
  const hasVariantFacts = (input.variant_facts || []).some((v: any) =>
    Boolean(String(v?.name || '').trim() || String(v?.description || '').trim())
  );
  return hasParameterFacts || hasVariantFacts;
}

export function validateDescriptionRoute(state: ListingGeneratorState) {
  const retryCount = state.description_retry_count || 0;
  const description = String(state.description || '').trim();
  const expectsDetailParagraph = hasDescriptionDetailFactsForValidation(state);
  const language = String(state.language || 'English');
  if (retryCount > 3) return 'next';
  if (!description) return 'retry';
  if (description.length > 2000) return 'retry';
  if (containsDisallowedTargetScript(description, language)) return 'retry';
  if (expectsDetailParagraph && !description.includes('\n')) return 'retry';
  const wordCount =
    description.match(/[\p{L}\p{M}\p{N}]+(?:[-'][\p{L}\p{M}\p{N}]+)*/gu)?.length || 0;
  if (expectsDetailParagraph) {
    if (wordCount < 120 || wordCount > 280) return 'retry';
  } else if (wordCount < 90 || wordCount > 180) {
    return 'retry';
  }
  if (
    /^\s*(?:step\s*\d+|product\s*(?:description|overview|intro(?:duction)?)|description|details?|parameters?|packaging|parameter\s+and\s+packaging\s+details|produktbeschreibung|produktdetails?)\s*[:：-]/i.test(
      description
    )
  ) {
    return 'retry';
  }
  return 'next';
}

export function batchGenerateRoute(state: ListingGeneratorState) {
  if (Number(state.duplicate_num || 1) > 1) {
    return ['batch_generate_title', 'batch_generate_bullet_point'];
  }
  return 'combine_all_results2';
}

export function doNothing() {
  return {};
}
