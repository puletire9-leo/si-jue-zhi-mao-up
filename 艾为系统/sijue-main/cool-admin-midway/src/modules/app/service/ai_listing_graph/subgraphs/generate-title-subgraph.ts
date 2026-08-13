import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ListingKeywordItem } from '../state';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { containsDisallowedTargetScript } from '../language-guard';
import { findMissingPhrases } from '../keyword-phrase-match';

const TitleSubgraphAnnotation = Annotation.Root({
  language: Annotation<string>({ reducer: (_, right) => right }),
  product_summary: Annotation<string>({ reducer: (_, right) => right }),
  product_args: Annotation<string>({ reducer: (_, right) => right }),
  keywords: Annotation<ListingKeywordItem[]>({ reducer: (_, right) => right }),
  search_stats: Annotation<Record<string, any>[]>({ reducer: (_, right) => right }),
  tail_product_arg: Annotation<string>({ reducer: (_, right) => right }),
  frequency_weight: Annotation<number>({ reducer: (_, right) => right }),
  random_score: Annotation<number>({ reducer: (_, right) => right }),
  competitor_titles: Annotation<string[]>({ reducer: (_, right) => right }),
  title_extend_phrases: Annotation<string[]>({ reducer: (_, right) => right }),
  manual_reference_title: Annotation<string>({ reducer: (_, right) => right }),
  reserved_title_suffix_length: Annotation<number>({ reducer: (_, right) => right }),
  llm: Annotation<ChatOpenAI>({ reducer: (_, right) => right }),
  long_tail_phrases: Annotation<Record<string, any>[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  title_words: Annotation<{
    main_word: string[];
    core_words: string[];
    long_tail_phrases: string[];
    alternative: string[];
    modifier: string[];
    scene: string[];
    char_count: number;
  }>({
    reducer: (_, right) => right,
    default: () => ({
      main_word: [],
      core_words: [],
      long_tail_phrases: [],
      alternative: [],
      modifier: [],
      scene: [],
      char_count: 0,
    }),
  }),
  title: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  retry_count: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0,
  }),
  extend_count: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0,
  }),
});

export type TitleSubgraphInput = {
  language: string;
  product_summary: string;
  product_args: string;
  keywords: ListingKeywordItem[];
  search_stats: Record<string, any>[];
  tail_product_arg: string;
  frequency_weight: number;
  random_score: number;
  competitor_titles: string[];
  title_extend_phrases?: string[];
  manual_reference_title?: string;
  reserved_title_suffix_length: number;
  llm: ChatOpenAI;
};

function getMaxTitleLength(_state: typeof TitleSubgraphAnnotation.State) {
  return 200;
}

const MAX_TITLE_EXTEND_ATTEMPTS = 2;

const TITLE_TOKEN_LIMIT = 2;
const TITLE_TOKEN_STOPWORDS = new Set([
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
  'with',
  'without',
]);

function normalizeTitleToken(token: string) {
  return String(token || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[-_]+/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N}\s]+/gu, ' ')
    .trim();
}

function getTitleTokens(phrase: string) {
  return normalizeTitleToken(phrase)
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token && !TITLE_TOKEN_STOPWORDS.has(token));
}

function addTitleTokens(tokenCounts: Map<string, number>, phrase: string) {
  for (const token of getTitleTokens(phrase)) {
    tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
  }
}

function wouldExceedTitleTokenLimit(
  tokenCounts: Map<string, number>,
  phrase: string,
  limit = TITLE_TOKEN_LIMIT
) {
  const nextCounts = new Map<string, number>();
  for (const token of getTitleTokens(phrase)) {
    nextCounts.set(token, (nextCounts.get(token) || 0) + 1);
  }
  for (const [token, count] of nextCounts.entries()) {
    if ((tokenCounts.get(token) || 0) + count > limit) return true;
  }
  return false;
}

function selectTitleWords(state: typeof TitleSubgraphAnnotation.State) {
  const keywords = state.keywords || [];
  const productArgs = state.product_args || '';
  const tailArg = state.tail_product_arg || '';
  const result = {
    main_word: keywords.filter(k => k.type === '核心大词').map(k => k.keyword),
    core_words: keywords
      .filter(k => k.type === '核心词')
      .map(k => k.keyword)
      .slice(0, 2),
    long_tail_phrases: [] as string[],
    alternative: [] as string[],
    modifier: [] as string[],
    scene: [] as string[],
    char_count: 0,
  };
  const updateCharCount = (words: string[]) => {
    const paramLength = ` - ${productArgs}, `.length + `, ${tailArg}`.length;
    return words.join(',').length + paramLength;
  };
  result.char_count = updateCharCount([...result.main_word, ...result.core_words]);
  const tokenCounts = new Map<string, number>();
  for (const word of [...result.main_word, ...result.core_words]) {
    addTitleTokens(tokenCounts, word);
  }
  const longTailPhrases = [...(state.search_stats || [])].filter(
    phrase => phrase.source_type === 'long tail'
  );
  if (longTailPhrases.length) {
    const maxVolume = Math.max(...longTailPhrases.map(x => Number(x.search_volume || 0)), 1);
    const maxFreq = Math.max(...longTailPhrases.map(x => Number(x.frequency || 0)), 1);
    for (const phrase of longTailPhrases) {
      const searchWeight = 1 - Number(state.frequency_weight || 0.7);
      phrase.score =
        (Number(phrase.search_volume || 0) / maxVolume) * searchWeight +
        (Number(phrase.frequency || 0) / maxFreq) * Number(state.frequency_weight || 0.7) +
        Math.random() * Number(state.random_score || 0);
    }
    longTailPhrases.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  }
  for (const word of longTailPhrases) {
    const wordStr = String(word.word || '');
    if (!wordStr) continue;
    if (wouldExceedTitleTokenLimit(tokenCounts, wordStr)) continue;
    const maxTitleLength = getMaxTitleLength(state);
    const maxBodyLength = Math.max(40, maxTitleLength - 10);
    if (result.char_count + wordStr.length <= maxBodyLength) {
      result.long_tail_phrases.push(wordStr);
      addTitleTokens(tokenCounts, wordStr);
      const type = String(word.type || '');
      if (type === 'alternative') result.alternative.push(wordStr);
      else if (type === 'modifier') result.modifier.push(wordStr);
      else if (type === 'scene') result.scene.push(wordStr);
      result.char_count = updateCharCount([
        ...result.main_word,
        ...result.core_words,
        ...result.long_tail_phrases,
      ]);
    }
  }
  return {
    title_words: result,
    long_tail_phrases: longTailPhrases,
  };
}

/** 与 aimazon-seo generate_title_subgraph.py CreateTitle human_template（jinja2）渲染逻辑一致 */
function buildCreateTitleHumanPrompt(input: {
  product_summary: string;
  core_words1: string;
  core_words2: string | null;
  modifier_words1: string;
  modifier_words2: string;
  scene_words: string;
  other_long_tail_phrases: string;
}) {
  const lines = [
    `我们卖的产品是：${input.product_summary}`,
    '',
    '请分步骤思考',
    `第一步：使用 主语: ${input.core_words1}, 修饰语: ${input.modifier_words1} 这几个词组合成第一个短句，组合修饰语的时候考虑一下顺序怎么组合合理`,
  ];
  if (input.core_words2) {
    lines.push(
      `下一步：使用 主语: ${input.core_words2}, 修饰语: ${input.modifier_words2} 这几个词组合成第二个短句，组合修饰语的时候考虑一下顺序怎么组合合理`
    );
  }
  if (input.scene_words) {
    lines.push(
      `下一步：压缩以下几个场景词成为一个场景短句: ${input.scene_words} ，压缩后不要出现重复单词`
    );
  }
  if (input.other_long_tail_phrases) {
    lines.push(
      `下一步：压缩以下几个词形成一个短句: ${input.other_long_tail_phrases} ，压缩后不要出现重复单词`
    );
  }
  lines.push('最后：将上述几个小句子组合在一起，以,分割');
  lines.push('请直接返回最终答案');
  return lines.join('\n');
}

/** 与 aimazon-seo generate_title_subgraph.py ExtendTitle human_template（jinja2）渲染逻辑一致 */
function buildExtendTitleHumanPrompt(input: {
  title: string;
  competitor_titles: string;
  title_extend_phrases: string;
  manual_reference_title?: string;
}) {
  const lines = ['', '原标题是：', input.title, ''];
  if (input.manual_reference_title) {
    lines.push(
      '参考标题（可能为中文、英文或混合语言，请理解其整体表述风格与卖点重心后再扩写）：',
      input.manual_reference_title,
      ''
    );
  }
  if (input.competitor_titles) {
    lines.push('竞品标题是：', input.competitor_titles, '');
  }
  if (input.title_extend_phrases) {
    lines.push('可参考的人工卖点短语是：', input.title_extend_phrases, '');
  }
  lines.push('请列出你认为可以加在我标题后面的十条短语');
  return lines.join('\n');
}

async function createTitle(state: typeof TitleSubgraphAnnotation.State) {
  const t = state.title_words;
  const coreWords = [...(t.core_words || [])].slice(0, 2);
  const modifierWords = [...(t.modifier || [])];
  coreWords.sort(() => Math.random() - 0.5);
  modifierWords.sort(() => Math.random() - 0.5);
  const modifierWords1: string[] = [];
  const modifierWords2: string[] = [];
  const modifierLimit = coreWords.length * 2;
  const otherLongTailPhrases = [...(t.alternative || []), ...modifierWords.slice(modifierLimit)];
  for (let i = 0; i < modifierWords.slice(0, modifierLimit).length; i++) {
    const m = modifierWords[i];
    const idx = i % Math.max(coreWords.length, 1);
    if (idx === 0) modifierWords1.push(m);
    else modifierWords2.push(m);
  }
  const sceneWords = (t.scene || []).join(',');
  const humanPrompt = buildCreateTitleHumanPrompt({
    product_summary: state.product_summary || '',
    core_words1: coreWords[0],
    core_words2: coreWords.length > 1 ? coreWords[1] : null,
    modifier_words1: modifierWords1.join(','),
    modifier_words2: modifierWords2.join(','),
    scene_words: sceneWords,
    other_long_tail_phrases: otherLongTailPhrases.join(','),
  });
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      '你是一个亚马逊SEO专家。请根据提供的 {language} 词（组）组合出一个商品标题\n        ',
    ],
    ['human', humanPrompt],
  ]);
  const chain = prompt.pipe(
    (state as any).llm.withStructuredOutput(
      {
        type: 'object',
        properties: { title: { type: 'string' } },
        required: ['title'],
      },
      {
        name: 'create_title_output',
        method: 'functionCalling',
      } as any
    )
  );
  const res = (await chain.invoke({
    language: state.language,
  } as any)) as any;
  const combineFinalTitle = (
    mainTitle: string,
    subtitle: string,
    productArgs: string,
    tailProductArg: string
  ) => {
    let finalTitle = `${mainTitle} - ${subtitle}`;
    if (productArgs) finalTitle = `${mainTitle} - ${productArgs}, ${subtitle}`;
    if (tailProductArg) finalTitle += `, ${tailProductArg}`;
    return finalTitle;
  };
  const upperFirstLetter = (title: string) => {
    const prepositions = new Set([
      'an',
      'a',
      'the',
      'at',
      'in',
      'on',
      'to',
      'for',
      'by',
      'with',
      'of',
      'from',
      'and',
      'or',
    ]);
    return title
      .split(' ')
      .map(w => (prepositions.has(w.toLowerCase()) ? w.toLowerCase() : `${w.charAt(0).toUpperCase()}${w.slice(1)}`))
      .join(' ');
  };
  const finalTitle = upperFirstLetter(
    combineFinalTitle(
      t.main_word[0] || '',
      String(res.title || ''),
      state.product_args || '',
      state.tail_product_arg || ''
    )
  );
  return {
    title: finalTitle,
    retry_count: (state.retry_count || 0) + 1,
  };
}

async function extendTitle(state: typeof TitleSubgraphAnnotation.State) {
  const competitorTitles = (state.competitor_titles || []).join('\n');
  const titleExtendPhrases = (state.title_extend_phrases || []).join('\n');
  const manualReferenceTitle = String(state.manual_reference_title || '').trim();
  const humanPrompt = buildExtendTitleHumanPrompt({
    title: state.title || '',
    competitor_titles: competitorTitles,
    title_extend_phrases: titleExtendPhrases,
    manual_reference_title: manualReferenceTitle,
  });
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `你是一个亚马逊SEO专家。请用 {language} 撰写短语，仅输出 {language}，禁止中文或其它语言。
输入里可能有竞品标题、人工卖点短语，以及一条参考标题（可能是中文、英文或混合语言）。
请先理解参考标题的整体意思与表述风格，再为原标题扩写，列出可加在标题后面的十条简短短语。`,
    ],
    ['human', humanPrompt],
  ]);
  const chain = prompt.pipe(
    (state as any).llm.withStructuredOutput(
      {
        type: 'object',
        properties: { extend_titles: { type: 'array', items: { type: 'string' } } },
        required: ['extend_titles'],
      },
      {
        name: 'extend_title_output',
        method: 'functionCalling',
      } as any
    )
  );
  const res = (await chain.invoke({
    language: state.language || 'English',
  } as any)) as any;
  let title = state.title || '';
  const tokenCounts = new Map<string, number>();
  addTitleTokens(tokenCounts, title);
  const maxTitleLength = getMaxTitleLength(state);
  const language = state.language || 'English';
  for (const t of res.extend_titles || []) {
    const phrase = String(t || '').trim();
    if (!phrase) continue;
    if (containsDisallowedTargetScript(phrase, language)) continue;
    if (wouldExceedTitleTokenLimit(tokenCounts, phrase)) continue;
    if (title.length + phrase.length + 2 > maxTitleLength) continue;
    title = `${title}, ${phrase}`;
    addTitleTokens(tokenCounts, phrase);
  }
  return {
    title,
    extend_count: (state.extend_count || 0) + 1,
  };
}

function shortenTitle(state: typeof TitleSubgraphAnnotation.State) {
  const maxTitleLength = getMaxTitleLength(state);
  const words = String(state.title || '').split(' ');
  const trimmed: string[] = [];
  for (let i = 0; i < words.length; i++) {
    trimmed.push(words[i]);
    if (trimmed.join(' ').length > maxTitleLength) break;
  }
  return { title: trimmed.join(' ').slice(0, maxTitleLength) };
}

function getRequiredTitlePhrases(state: typeof TitleSubgraphAnnotation.State) {
  return [
    ...(state.title_words.main_word || []),
    ...(state.title_words.core_words || []),
  ]
    .map(p => String(p || '').trim())
    .filter(Boolean);
}

function shouldRouteToExtendTitle(
  state: typeof TitleSubgraphAnnotation.State,
  minTitleLength: number,
  finalTitle: string
) {
  return (
    finalTitle.length < minTitleLength &&
    (state.extend_count || 0) < MAX_TITLE_EXTEND_ATTEMPTS
  );
}

function validateTitle(state: typeof TitleSubgraphAnnotation.State) {
  const maxTitleLength = getMaxTitleLength(state);
  const minTitleLength = Math.max(120, maxTitleLength - 25);
  const finalTitle = String(state.title || '');
  if ((state.retry_count || 0) > 3) {
    if (shouldRouteToExtendTitle(state, minTitleLength, finalTitle)) {
      return 'extend_title';
    }
    return END;
  }
  const missingPhrases = findMissingPhrases(finalTitle, getRequiredTitlePhrases(state));
  if (missingPhrases.length > 0) return 'create_title';
  if (finalTitle.length > maxTitleLength) return 'shorten_title';
  if (shouldRouteToExtendTitle(state, minTitleLength, finalTitle)) {
    return 'extend_title';
  }
  return END;
}

export function buildGenerateTitleSubgraph() {
  return new StateGraph(TitleSubgraphAnnotation)
    .addNode('select_title_words', selectTitleWords)
    .addNode('create_title', createTitle)
    .addNode('extend_title', extendTitle)
    .addNode('shorten_title', shortenTitle)
    .addEdge(START, 'select_title_words')
    .addEdge('select_title_words', 'create_title')
    .addConditionalEdges('create_title', validateTitle, [
      'create_title',
      'extend_title',
      'shorten_title',
      END,
    ])
    .addConditionalEdges('extend_title', validateTitle, [
      'create_title',
      'extend_title',
      'shorten_title',
      END,
    ])
    .addConditionalEdges('shorten_title', validateTitle, [
      'create_title',
      'extend_title',
      'shorten_title',
      END,
    ])
    .compile();
}

export async function invokeGenerateTitleSubgraph(input: TitleSubgraphInput) {
  const graph = buildGenerateTitleSubgraph();
  const res = await graph.invoke({
    ...input,
    retry_count: 0,
    extend_count: 0,
  });
  return {
    title: res.title || '',
    retry_count: Number(res.retry_count || 0),
    title_words: res.title_words,
    long_tail_phrases: (res as any).long_tail_phrases || [],
  };
}
