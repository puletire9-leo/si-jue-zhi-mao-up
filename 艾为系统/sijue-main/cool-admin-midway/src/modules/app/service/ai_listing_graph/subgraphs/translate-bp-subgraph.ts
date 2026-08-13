import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { normalizeBulletPointCapitalization } from '../bullet-point-format';
import { textContainsAllPhrases } from '../keyword-phrase-match';

const TranslateBpStateAnnotation = Annotation.Root({
  bullet_point: Annotation<string>({ reducer: (_, right) => right }),
  keywords: Annotation<string[]>({ reducer: (_, right) => right }),
  language: Annotation<string>({ reducer: (_, right) => right }),
  retry_count: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0,
  }),
  translated_bullet_point: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  llm: Annotation<ChatOpenAI>({ reducer: (_, right) => right }),
});

export type TranslateBpSubgraphInput = {
  bullet_point: string;
  keywords: string[];
  language: string;
  llm: ChatOpenAI;
};

function pickBest(points: string[], keywords: string[]) {
  let current = '';
  const phrases = (keywords || []).map(k => String(k || '').trim()).filter(Boolean);
  for (const p of points || []) {
    current = p;
    if (!textContainsAllPhrases(p, phrases)) continue;
    if (p.length > 300 && p.length < 500) break;
  }
  return current;
}

async function translateBulletPoint(state: typeof TranslateBpStateAnnotation.State) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      '你是一个亚马逊SEO专家，把下面一个亚马逊Listing标题翻译成 {language}，要求包含关键词 {keywords}，长度约350，保持【标题】详情格式',
    ],
    ['human', '原文：{bullet_point}'],
  ]);
  const chain = prompt.pipe(
    state.llm.withStructuredOutput(
      {
        type: 'object',
        properties: { translated_bullet_point: { type: 'string' } },
        required: ['translated_bullet_point'],
      },
      {
        name: 'translated_bullet_point',
        method: 'functionCalling',
      } as any
    )
  );
  try {
    const result = (await chain.invoke({
      bullet_point: state.bullet_point,
      keywords: state.keywords,
      language: state.language,
    } as any)) as any;
    return { translated_bullet_point: String(result.translated_bullet_point || '') };
  } catch {
    return { translated_bullet_point: '' };
  }
}

async function shortenText(state: typeof TranslateBpStateAnnotation.State) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'human',
      '帮我用 {language} 提炼卖点文案：{bullet_point}。要求长度约350且必须包含关键词 {keywords}，保持【标题】详情格式',
    ],
  ]);
  const chain = prompt.pipe(
    state.llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          translated_bullet_points: { type: 'array', items: { type: 'string' } },
        },
        required: ['translated_bullet_points'],
      },
      {
        name: 'translated_bullet_points',
        method: 'functionCalling',
      } as any
    )
  );
  try {
    const result = (await chain.invoke({
      bullet_point: state.translated_bullet_point,
      language: state.language,
      keywords: state.keywords,
    } as any)) as any;
    return {
      translated_bullet_point: pickBest(result.translated_bullet_points || [], state.keywords),
    };
  } catch {
    return { translated_bullet_point: '' };
  }
}

async function extendText(state: typeof TranslateBpStateAnnotation.State) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'human',
      '帮我用 {language} 扩写卖点文案：{bullet_point}。要求长度在300-500并必须包含关键词 {keywords}，保持【标题】详情格式',
    ],
  ]);
  const chain = prompt.pipe(
    state.llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          translated_bullet_points: { type: 'array', items: { type: 'string' } },
        },
        required: ['translated_bullet_points'],
      },
      {
        name: 'translated_bullet_points',
        method: 'functionCalling',
      } as any
    )
  );
  try {
    const result = (await chain.invoke({
      bullet_point: state.translated_bullet_point,
      language: state.language,
      keywords: state.keywords,
    } as any)) as any;
    return {
      translated_bullet_point: pickBest(result.translated_bullet_points || [], state.keywords),
    };
  } catch {
    return { translated_bullet_point: '' };
  }
}

function combineResult(state: typeof TranslateBpStateAnnotation.State) {
  return {
    retry_count: (state.retry_count || 0) + 1,
    translated_bullet_point: state.translated_bullet_point || '',
  };
}

function validateBulletPoint(state: typeof TranslateBpStateAnnotation.State) {
  const bp = state.translated_bullet_point || '';
  if ((state.retry_count || 0) > 3) return 'final_output';
  if (!bp) return 'translate_bullet_point';
  if (bp.length < 300) return 'extend_text';
  if (bp.length > 500) return 'shorten_text';
  return 'final_output';
}

function finalOutput(state: typeof TranslateBpStateAnnotation.State) {
  return {
    translated_bullet_point: normalizeBulletPointCapitalization(
      state.translated_bullet_point || ''
    ),
  };
}

export function buildTranslateBpSubgraph() {
  return new StateGraph(TranslateBpStateAnnotation)
    .addNode('translate_bullet_point', translateBulletPoint)
    .addNode('shorten_text', shortenText)
    .addNode('extend_text', extendText)
    .addNode('combine_result', combineResult)
    .addNode('final_output', finalOutput)
    .addEdge(START, 'translate_bullet_point')
    .addEdge('translate_bullet_point', 'combine_result')
    .addEdge('shorten_text', 'combine_result')
    .addEdge('extend_text', 'combine_result')
    .addConditionalEdges('combine_result', validateBulletPoint, [
      'translate_bullet_point',
      'shorten_text',
      'extend_text',
      'final_output',
    ])
    .addEdge('final_output', END)
    .compile();
}

export async function invokeTranslateBpSubgraph(input: TranslateBpSubgraphInput) {
  const graph = buildTranslateBpSubgraph();
  return graph.invoke({
    ...input,
    retry_count: 0,
  });
}

