import { END, START, StateGraph } from '@langchain/langgraph';
import { ListingGeneratorInput, ListingGeneratorOutput, ListingGeneratorStateAnnotation } from './state';
import { invokeGenerateTitleSubgraph } from './subgraphs/generate-title-subgraph';
import { invokeGenerateBpSubgraph } from './subgraphs/generate-bp-subgraph';
import { getLlmByUser } from './llm';
import {
  BULLET_POINT_COUNT,
  analyzeSearchVolume,
  batchGenerateRoute,
  doNothing,
  extractWords,
  gatherBulletPointsTitle,
  generateBulletPointTitle,
  generateBulletPointTitleFromUserInput,
  generateSummary,
  shouldSkipBulletPoints,
  shouldSkipSummary,
  validateDescriptionRoute,
  validateInput,
} from './nodes/generator-nodes';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { formatBulletPoint } from './bullet-point-format';
import { textContainsAllPhrases } from './keyword-phrase-match';
import { containsForbiddenFactLeak } from './bullet-plan';
import {
  collectAllowedKeywordsFromList,
  runListingCopyChecks,
} from './listing-copy-checker';
import { pickCustomerFacingProductName } from './language-guard';

function hydrateInput(state: typeof ListingGeneratorStateAnnotation.State) {
  const input = state.input;
  const referenceSourceType: 'manual_bullets' | 'competitor' =
    input.reference_source_type === 'manual_bullets'
      ? 'manual_bullets'
      : 'competitor';
  return {
    username: input.username,
    language: input.language,
    keywords: input.keywords,
    reference_source_type: referenceSourceType,
    reference_bullet_points: input.reference_bullet_points || [],
    manual_reference_title: String(input.manual_reference_title || '').trim(),
    title_extend_phrases: input.title_extend_phrases || [],
    competitor_titles: input.competitor_titles || [],
    competitor_bullet_points: input.competitor_bullet_points || [],
    product_summary: input.product_summary || '',
    product_args: input.product_args || '',
    key_parameters: input.key_parameters || '',
    package_info: input.package_info || '',
    duplicate_num: Number(input.duplicate_num || 1),
    tail_product_args: input.tail_product_args || [],
    bullet_points_title: input.bullet_points_title || [],
    reserved_title_suffix_length: Number(input.reserved_title_suffix_length || 0),
  };
}

async function generateTitle(state: typeof ListingGeneratorStateAnnotation.State) {
  const llm = getLlmByUser(state.username);
  const res = await invokeGenerateTitleSubgraph({
    language: state.language || 'English',
    product_summary: state.product_summary || '',
    product_args: state.product_args || '',
    keywords: state.keywords || [],
    search_stats: state.search_stats || [],
    tail_product_arg: (state.tail_product_args || [])[0] || '',
    frequency_weight: 0.7,
    competitor_titles: state.competitor_titles || [],
    title_extend_phrases: state.title_extend_phrases || [],
    manual_reference_title: String(state.manual_reference_title || '').trim(),
    reserved_title_suffix_length: Number(state.reserved_title_suffix_length || 0),
    random_score: 0,
    llm,
  });
  return {
    title: { title: res.title, retry_count: res.retry_count || 0 },
    title_words: res.title_words || {},
    long_tail_phrases: res.long_tail_phrases || [],
  };
}

async function generateBulletPointByIndex(state: typeof ListingGeneratorStateAnnotation.State, idx: number) {
  const llm = getLlmByUser(state.username);
  const bulletTitle = ((state.bullet_titles as any)?.bullet_titles || [])[idx] || {};
  const result = await invokeGenerateBpSubgraph({
    bullet_point_title: String(bulletTitle.title || ''),
    bullet_point_scope: String(bulletTitle.scope || ''),
    core_keywords: Array.isArray(bulletTitle.key_words) ? bulletTitle.key_words : [],
    language: state.language || 'English',
    product_summary: state.product_summary || '',
    allowed_facts: Array.isArray(bulletTitle.ref) ? bulletTitle.ref : [],
    forbidden_facts: Array.isArray(bulletTitle.forbidden_refs) ? bulletTitle.forbidden_refs : [],
    key_parameters: state.key_parameters || '',
    llm,
  });
  return { [`bullet_point_${idx}`]: { bullet_point: result.bullet_point, retry_count: result.retry_count || 0 } };
}

function collectBulletBodiesForDescription(
  state: typeof ListingGeneratorStateAnnotation.State
): string {
  const lines: string[] = [];
  for (let i = 0; i < BULLET_POINT_COUNT; i++) {
    const text = String((state as any)[`bullet_point_${i}`]?.bullet_point || '').trim();
    if (text) lines.push(`${i + 1}. ${text}`);
  }
  return lines.join('\n\n');
}

function buildDescriptionProductFacts(
  state: typeof ListingGeneratorStateAnnotation.State
): string {
  const input = state.input;
  const language = state.language || 'English';
  const referenceName = pickCustomerFacingProductName(
    String(input.product_name || '').trim(),
    String(input.produce_name || '').trim(),
    language
  );
  const lines: string[] = [
  ];
  if (referenceName) lines.push(`Reference product name: ${referenceName}`);
  const productSummary = String(state.product_summary || input.product_summary || '').trim();
  if (productSummary) lines.push(`Product summary:\n${productSummary}`);
  const keyParameters = String(state.key_parameters || input.key_parameters || '').trim();
  if (keyParameters) lines.push(`Key parameters:\n${keyParameters}`);
  const packageInfo = String(state.package_info || input.package_info || '').trim();
  if (packageInfo) lines.push(`Package information:\n${packageInfo}`);
  const variantFacts = (input.variant_facts || [])
    .map(v => {
      const name = String(v?.name || '').trim();
      const description = String(v?.description || '').trim();
      if (!name && !description) return '';
      return `- ${name}${description ? `: ${description}` : ''}`;
    })
    .filter(Boolean);
  if (variantFacts.length) {
    lines.push(
      `Variant source facts (may require translation; extract meaning only, never quote raw source wording):\n${variantFacts.join(
        '\n'
      )}`
    );
  }
  const productArgs = String(state.product_args || input.product_args || '').trim();
  if (productArgs) {
    lines.push(
      `Additional source facts (may require translation; extract meaning only, never quote raw source wording):\n${productArgs}`
    );
  }
  return lines.filter(Boolean).join('\n\n');
}

function buildDescriptionVariantFacts(
  state: typeof ListingGeneratorStateAnnotation.State
): string {
  const rows = (state.input.variant_facts || [])
    .map(v => {
      const name = String(v?.name || '').trim();
      const description = String(v?.description || '').trim();
      if (!name && !description) return '';
      return `- ${name}${description ? `: ${description}` : ''}`;
    })
    .filter(Boolean);
  return rows.join('\n');
}

function hasDescriptionDetailFacts(
  state: typeof ListingGeneratorStateAnnotation.State
): boolean {
  const input = state.input;
  const hasParameterFacts = Boolean(
    String(state.key_parameters || input.key_parameters || '').trim() ||
      String(state.package_info || input.package_info || '').trim() ||
      String(state.product_args || input.product_args || '').trim()
  );
  const hasVariantFacts = (input.variant_facts || []).some(v =>
    Boolean(String(v?.name || '').trim() || String(v?.description || '').trim())
  );
  return hasParameterFacts || hasVariantFacts;
}

function normalizeDescriptionParagraph(value: string): string {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/```[\s\S]*?```/g, match => match.replace(/```/g, ''))
    .split('\n')
    .map(line =>
      line
        .replace(/^\s*(?:[-•]|\d+[.)])\s*/, '')
        .replace(
          /^\s*(?:step\s*\d+|product\s*(?:description|overview|intro(?:duction)?)|description|details?|parameters?|packaging|parameter\s+and\s+packaging\s+details|produktbeschreibung|details?|produktdetails?)\s*[:：-]\s*/i,
          ''
        )
        .trim()
    )
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDescriptionSentenceTokens(value: string): string[] {
  return String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3);
}

function splitDescriptionSentences(value: string): string[] {
  return String(value || '')
    .split(/(?<=[.!?;])\s+|\n+/u)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function sentenceOverlapScore(left: string, right: string): number {
  const leftTokens = new Set(normalizeDescriptionSentenceTokens(left));
  const rightTokens = new Set(normalizeDescriptionSentenceTokens(right));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

function dedupeDescriptionDetails(intro: string, details: string): string {
  const introSentences = splitDescriptionSentences(intro);
  const detailSentences = splitDescriptionSentences(details);
  const kept = detailSentences.filter(sentence =>
    introSentences.every(introSentence => sentenceOverlapScore(sentence, introSentence) < 0.72)
  );
  return kept.join(' ').trim();
}

async function generateDescription(state: typeof ListingGeneratorStateAnnotation.State) {
  const llm = getLlmByUser(state.username);
  const bulletBodies = collectBulletBodiesForDescription(state);
  if (!bulletBodies.trim()) {
    throw new Error('卖点正文尚未生成，无法撰写产品描述');
  }
  const introPrompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `你是一个亚马逊商品文案编辑。请用 {language} 写第一段产品简介，面向真实买家介绍这个产品是什么、能做什么、适合什么使用场景。

硬性要求：
- 只输出 {language}，禁止混入中文或其他语言。
- 如果源材料里出现中文、ERP 内部命名或其他非 {language} 片段，只提炼其含义并用 {language} 重写，禁止直接照抄、音译或保留括号原文。
- 只根据「当前标题」和「卖点正文」总结，不得编造标题/卖点中没有出现的功能、材质、认证、配件或参数。
- 写成一段自然的人类可读描述，不要标题、标签、列表、Markdown、"Product Description:"、"Step 1:" 之类前缀。
- 语气专业、清楚、有购买引导，但不要关键词堆砌。
- 词数控制在 100-150 words。`,
    ],
    [
      'human',
      `当前标题：
{listing_title}

卖点正文：
{bullet_bodies}`,
    ],
  ]);
  const introChain = introPrompt.pipe(
    llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          product_intro: { type: 'string' },
        },
        required: ['product_intro'],
        additionalProperties: false,
      },
      {
        name: 'description_intro_output',
        method: 'functionCalling',
      } as any
    )
  );
  const introRes = (await introChain.invoke({
    listing_title: String((state.title as any)?.title || '').trim(),
    bullet_bodies: bulletBodies,
    language: state.language,
  } as any)) as any;

  const productIntro = normalizeDescriptionParagraph(introRes.product_intro || '');
  if (!hasDescriptionDetailFacts(state)) {
    return {
      description: productIntro,
      description_retry_count: Number(state.description_retry_count || 0) + 1,
    };
  }

  const detailPrompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `你是一个亚马逊商品信息编辑。请根据第一段产品简介、产品事实材料和变体描述，生成第二段参数/包装/变体详情信息。

硬性要求：
- 只输出 {language}，禁止混入中文或其他语言。
- 源材料可能包含中文、ERP 内部命名或原始备注。只能提炼其事实含义并用 {language} 重写，禁止直接引用、保留括号原文或复制中文片段；拿不准就跳过。
- 第二段只补充第一段没有说过的硬信息：关键参数、尺寸、重量、包装内容、规格、使用时长、充电方式、变体差异。
- 不要重复第一段已经出现的产品用途、核心功能、治疗原理、使用场景、舒适性卖点、效果描述或营销表述；宁可更短，也不要重写第一段。
- 只能使用「产品事实材料」和「变体描述」里明确出现的信息；没有明确资料时不要编造。
- 写成一段自然描述，不要标题、标签、列表、Markdown、"Details:"、"Parameters:" 之类前缀。
- 词数控制在 50-100 words。`,
    ],
    [
      'human',
      `第一段产品简介：
{product_intro}

产品事实材料：
{product_facts}

变体描述（重点参考）：
{variant_facts}`,
    ],
  ]);
  const detailChain = detailPrompt.pipe(
    llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          product_details: { type: 'string' },
        },
        required: ['product_details'],
        additionalProperties: false,
      },
      {
        name: 'description_details_output',
        method: 'functionCalling',
      } as any
    )
  );
  const detailRes = (await detailChain.invoke({
    product_intro: productIntro,
    product_facts: buildDescriptionProductFacts(state),
    variant_facts: buildDescriptionVariantFacts(state),
    language: state.language,
  } as any)) as any;
  const rawProductDetails = normalizeDescriptionParagraph(detailRes.product_details || '');
  const productDetails = dedupeDescriptionDetails(productIntro, rawProductDetails);
  const descriptionPart = [productIntro, productDetails].filter(Boolean).join('\n');
  return {
    description: descriptionPart.trim(),
    description_retry_count: Number(state.description_retry_count || 0) + 1,
  };
}

function descriptionRoute(state: typeof ListingGeneratorStateAnnotation.State) {
  return validateDescriptionRoute(state as any) === 'retry' ? 'generate_description' : 'collect_bullet_points';
}

function collectBulletPoints(state: typeof ListingGeneratorStateAnnotation.State) {
  const bulletPoints: Record<string, any>[] = [];
  for (let i = 0; i < BULLET_POINT_COUNT; i++) {
    const row = (state as any)[`bullet_point_${i}`];
    if (row) bulletPoints.push(row);
  }
  return { bullet_points: bulletPoints };
}

async function batchGenerateTitle(state: typeof ListingGeneratorStateAnnotation.State) {
  const llm = getLlmByUser(state.username);
  const duplicateNum = Number(state.duplicate_num || 1);
  const titles: string[] = [];
  for (let i = 1; i < duplicateNum; i++) {
    const res = await invokeGenerateTitleSubgraph({
      language: state.language,
      product_summary: state.product_summary || '',
      product_args: state.product_args || '',
      keywords: state.keywords || [],
      search_stats: state.search_stats || [],
      tail_product_arg: (state.tail_product_args || [])[i % Math.max((state.tail_product_args || []).length, 1)] || '',
      frequency_weight: 0.7,
      competitor_titles: state.competitor_titles || [],
      title_extend_phrases: state.title_extend_phrases || [],
      manual_reference_title: String(state.manual_reference_title || '').trim(),
      reserved_title_suffix_length: Number(state.reserved_title_suffix_length || 0),
      random_score: 0.5,
      llm,
    });
    titles.push(res.title);
  }
  return { duplicate_titles: [String((state.title as any)?.title || ''), ...titles] };
}

async function batchGenerateBulletPoint(state: typeof ListingGeneratorStateAnnotation.State) {
  const llm = getLlmByUser(state.username);
  const duplicateNum = Number(state.duplicate_num || 1) - 1;
  const duplicateBulletPoints = Array.from({ length: Math.max(duplicateNum, 0) }).map(() =>
    Array.from({ length: BULLET_POINT_COUNT }).map(() => '')
  );
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      '你是一个亚马逊写手，请用 {language} 基于我给出的卖点生成5条不同的卖点，所有卖点必须使用 {language}，不要使用其他语言。要求表达同样意思，并必须包括 {core_keyword0} 和 {core_keyword1}，长度在400字符左右。只能围绕当前 scope 和 allowed_facts 改写，不得混入 forbidden_facts 中的信息。',
    ],
    [
      'human',
      '当前卖点范围：{scope}\n允许事实：\n{allowed_facts}\n禁止混入事实：\n{forbidden_facts}\n原卖点 {original_bullet}',
    ],
  ]);
  const chain = prompt.pipe(
    llm.withStructuredOutput(
      {
        type: 'object',
        properties: { bullet_points: { type: 'array', items: { type: 'string' } } },
        required: ['bullet_points'],
      },
      {
        name: 'duplicate_bullet_output',
        method: 'functionCalling',
      } as any
    )
  );
  for (let i = 0; i < BULLET_POINT_COUNT; i++) {
    const valid: string[] = [];
    for (let k = 0; k < Math.max(duplicateNum * 2, 5); k++) {
      const title = String((((state.bullet_titles as any)?.bullet_titles || [])[i] || {}).title || '');
      const scope = String((((state.bullet_titles as any)?.bullet_titles || [])[i] || {}).scope || '');
      const detail = String(((state as any)[`bullet_point_${i}`]?.bullet_point || '')).replace(
        `【${title}】`,
        ''
      );
      const plan = (((state.bullet_titles as any)?.bullet_titles || [])[i] || {}) as any;
      const kw = (plan.key_words || []) as string[];
      const kwPhrases = kw.map(k => String(k || '').trim()).filter(Boolean);
      const allowedFacts = Array.isArray(plan.ref) ? plan.ref : [];
      const forbiddenFacts = Array.isArray(plan.forbidden_refs) ? plan.forbidden_refs : [];
      let generated: any = null;
      try {
        generated = await chain.invoke({
          core_keyword0: kwPhrases[0] || '',
          core_keyword1: kwPhrases[1] || '',
          original_bullet: detail,
          scope,
          allowed_facts: allowedFacts.join('\n'),
          forbidden_facts: forbiddenFacts.join('\n'),
          language: state.language || 'English',
        } as any);
      } catch {
        continue;
      }
      for (const bp of generated?.bullet_points || []) {
        const merged = formatBulletPoint(title, bp);
        if (merged.length < 300 || merged.length > 500) continue;
        if (!textContainsAllPhrases(bp, kwPhrases)) continue;
        if (containsForbiddenFactLeak(bp, forbiddenFacts, allowedFacts)) continue;
        valid.push(merged);
      }
      if (valid.length > duplicateNum) break;
    }
    if (valid.length < duplicateNum) {
      throw new Error('批量生成卖点失败，请重试或检查参数是否存在异常');
    }
    for (let j = 0; j < duplicateNum; j++) duplicateBulletPoints[j][i] = valid[j];
  }
  const original = [
    Array.from({ length: BULLET_POINT_COUNT }).map((_, i) =>
      String((state as any)[`bullet_point_${i}`]?.bullet_point || '')
    ),
  ];
  return { duplicate_bullet_points: [...original, ...duplicateBulletPoints] };
}

function collectReviewText(state: typeof ListingGeneratorStateAnnotation.State) {
  const chunks: string[] = [];
  chunks.push(String((state.title as any)?.title || ''));
  chunks.push(String((state.title_more_freq as any)?.title || ''));
  chunks.push(String((state.title_less_freq as any)?.title || ''));
  chunks.push(String(state.description || ''));
  for (let i = 0; i < BULLET_POINT_COUNT; i++) {
    chunks.push(String((state as any)[`bullet_point_${i}`]?.bullet_point || ''));
  }
  for (const d of state.duplicate_titles || []) chunks.push(d);
  for (const row of state.duplicate_bullet_points || []) {
    for (const cell of row || []) chunks.push(cell);
  }
  return chunks.filter(Boolean).join('\n');
}

async function checkBrandName(state: typeof ListingGeneratorStateAnnotation.State) {
  const llm = getLlmByUser(state.username);
  const input = state.input;
  const allowedKeywords =
    (input.allowed_keywords || []).map((k) => String(k || '').trim()).filter(Boolean).length > 0
      ? (input.allowed_keywords || []).map((k) => String(k || '').trim()).filter(Boolean)
      : collectAllowedKeywordsFromList(state.keywords);
  const checks = await runListingCopyChecks(llm, {
    language: state.language || 'English',
    productSummary: String(state.product_summary || input.product_summary || '').trim(),
    productName: String(input.product_name || '').trim(),
    produceName: String(input.produce_name || '').trim(),
    keyParameters: String(state.key_parameters || input.key_parameters || '').trim(),
    packageInfo: String(state.package_info || input.package_info || '').trim(),
    variantFacts: (input.variant_facts || []).map((v) => ({
      name: String(v?.name || '').trim(),
      description: String(v?.description || '').trim(),
    })),
    allowedKeywords,
    reviewText: collectReviewText(state),
  });
  return checks;
}

export function buildGeneratorGraph() {
  return new StateGraph(ListingGeneratorStateAnnotation)
    .addNode('hydrate_input', hydrateInput)
    .addNode('validate_input', validateInput)
    .addNode('generate_summary', generateSummary)
    .addNode('combine_all_results', doNothing)
    .addNode('combine_all_results2', doNothing)
    .addNode('extract_words', extractWords)
    .addNode('analyze_search_volume', analyzeSearchVolume)
    .addNode('generate_title', generateTitle)
    .addNode('generate_bullet_point_title', generateBulletPointTitle)
    .addNode('generate_bullet_point_title_from_user_input', generateBulletPointTitleFromUserInput)
    .addNode('gather_bullet_points_title', gatherBulletPointsTitle)
    .addNode('generate_bullet_point_0', state => generateBulletPointByIndex(state, 0))
    .addNode('generate_bullet_point_1', state => generateBulletPointByIndex(state, 1))
    .addNode('generate_bullet_point_2', state => generateBulletPointByIndex(state, 2))
    .addNode('generate_bullet_point_3', state => generateBulletPointByIndex(state, 3))
    .addNode('generate_bullet_point_4', state => generateBulletPointByIndex(state, 4))
    .addNode('generate_description', generateDescription)
    .addNode('collect_bullet_points', collectBulletPoints)
    .addNode('batch_generate_title', batchGenerateTitle)
    .addNode('batch_generate_bullet_point', batchGenerateBulletPoint)
    .addNode('check_brand_name', checkBrandName)
    .addEdge(START, 'hydrate_input')
    .addEdge('hydrate_input', 'validate_input')
    .addConditionalEdges('validate_input', shouldSkipSummary as any, ['generate_summary', 'extract_words'])
    .addEdge('generate_summary', 'extract_words')
    .addEdge('extract_words', 'analyze_search_volume')
    .addEdge('analyze_search_volume', 'generate_title')
    .addConditionalEdges('generate_title', shouldSkipBulletPoints as any, [
      'generate_bullet_point_title',
      'generate_bullet_point_title_from_user_input',
    ])
    .addEdge('generate_bullet_point_title', 'gather_bullet_points_title')
    .addEdge('generate_bullet_point_title_from_user_input', 'gather_bullet_points_title')
    .addEdge('gather_bullet_points_title', 'generate_bullet_point_0')
    .addEdge('gather_bullet_points_title', 'generate_bullet_point_1')
    .addEdge('gather_bullet_points_title', 'generate_bullet_point_2')
    .addEdge('gather_bullet_points_title', 'generate_bullet_point_3')
    .addEdge('gather_bullet_points_title', 'generate_bullet_point_4')
    .addEdge('generate_bullet_point_0', 'combine_all_results')
    .addEdge('generate_bullet_point_1', 'combine_all_results')
    .addEdge('generate_bullet_point_2', 'combine_all_results')
    .addEdge('generate_bullet_point_3', 'combine_all_results')
    .addEdge('generate_bullet_point_4', 'combine_all_results')
    .addEdge('combine_all_results', 'generate_description')
    .addConditionalEdges('generate_description', descriptionRoute as any, [
      'generate_description',
      'collect_bullet_points',
    ])
    .addConditionalEdges('collect_bullet_points', batchGenerateRoute as any, [
      'batch_generate_title',
      'batch_generate_bullet_point',
      'combine_all_results2',
    ])
    .addEdge('batch_generate_title', 'combine_all_results2')
    .addEdge('batch_generate_bullet_point', 'combine_all_results2')
    .addEdge('combine_all_results2', 'check_brand_name')
    .addEdge('check_brand_name', END)
    .compile();
}

export async function invokeGeneratorGraph(
  input: ListingGeneratorInput,
  trace?: {
    runName?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  }
) {
  const graph = buildGeneratorGraph();
  const result = await graph.invoke(
    { input },
    {
      runName: trace?.runName || 'AIListingBaseCopyGenerator',
      tags: trace?.tags || [],
      metadata: trace?.metadata || {},
    } as any
  );
  return {
    output: {
      title: result.title || null,
      title_more_freq: result.title_more_freq || null,
      title_less_freq: result.title_less_freq || null,
      title_words: result.title_words || null,
      long_tail_phrases: result.long_tail_phrases || [],
      bullet_titles: (result.bullet_titles as any)?.bullet_titles
        ? { bullet_titles: (result.bullet_titles as any).bullet_titles }
        : null,
      bullet_points: result.bullet_points || [],
      description: result.description || null,
      duplicate_titles: result.duplicate_titles || [],
      duplicate_bullet_points: result.duplicate_bullet_points || [],
      brand_names: result.brand_names || [],
      irrelevant_words: result.irrelevant_words || [],
      potential_risk_words: result.potential_risk_words || [],
    } as ListingGeneratorOutput,
    rawState: result,
  };
}
