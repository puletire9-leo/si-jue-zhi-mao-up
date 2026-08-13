import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { formatBulletPoint } from '../bullet-point-format';
import { findMissingPhrases, textContainsAllPhrases } from '../keyword-phrase-match';
import { containsForbiddenFactLeak } from '../bullet-plan';

const BulletPointSubgraphAnnotation = Annotation.Root({
  bullet_point_title: Annotation<string>({ reducer: (_, right) => right }),
  bullet_point_scope: Annotation<string>({ reducer: (_, right) => right }),
  core_keywords: Annotation<string[]>({ reducer: (_, right) => right }),
  language: Annotation<string>({ reducer: (_, right) => right }),
  product_summary: Annotation<string>({ reducer: (_, right) => right }),
  allowed_facts: Annotation<string[]>({ reducer: (_, right) => right }),
  forbidden_facts: Annotation<string[]>({ reducer: (_, right) => right }),
  key_parameters: Annotation<string>({ reducer: (_, right) => right }),
  llm: Annotation<ChatOpenAI>({ reducer: (_, right) => right }),
  bullet_point: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  retry_count: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0,
  }),
});

export type BulletPointSubgraphInput = {
  bullet_point_title: string;
  bullet_point_scope: string;
  core_keywords: string[];
  language: string;
  product_summary: string;
  allowed_facts: string[];
  forbidden_facts: string[];
  key_parameters: string;
  llm: ChatOpenAI;
};

export function pickBestBulletPoint(
  rows: string[],
  coreKeywords: string[],
  title: string,
  allowedFacts: string[],
  forbiddenFacts: string[]
) {
  const phrases = (coreKeywords || []).map(k => String(k || '').trim()).filter(Boolean);
  let selected = '';
  let bestScore = -1;
  for (const row of rows || []) {
    const bullet = String(row || '');
    if (!bullet.trim()) continue;
    const merged = `【${title}】${bullet}`;
    const hasAllPhrases = textContainsAllPhrases(bullet, phrases);
    const hasForbiddenLeak = containsForbiddenFactLeak(
      bullet,
      forbiddenFacts,
      allowedFacts
    );
    const idealLength = merged.length > 300 && merged.length < 500;
    let score = 0;
    if (!hasForbiddenLeak) score += 8;
    if (hasAllPhrases) score += 4;
    if (idealLength) score += 2;
    if (bullet.length >= 80) score += 1;
    if (score > bestScore) {
      bestScore = score;
      selected = bullet;
    }
    if (!hasForbiddenLeak && hasAllPhrases && idealLength) break;
  }
  return selected;
}

async function generateBulletPoint(state: typeof BulletPointSubgraphAnnotation.State) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `你是一个亚马逊SEO专家，帮我写一个卖点描述，
我们的产品介绍如下：
{product_summary}
当前卖点标题：{title}
当前卖点允许展开的主题：{scope}
请严格只围绕这个主题，用{language}生成5条卖点详情候选，每条350个字符左右。
你可以以一个营销大师的视角，从买家角度出发去介绍这个特点，但只能使用允许的事实。
在每条卖点中要求
1.第一个句子以 {core_keyword0} 为主语，
2.第二个句子以 {core_keyword1} 为主语
3.尽量参考允许事实，不要描述的过于空泛，请尽量描述具体信息。
4.禁止写入其他卖点的功能、材质、场景、人群、配件、包装、规格或赠品信息。
5.如果某信息没有出现在允许事实中，就不要提。`,
    ],
    [
      'human',
      `允许使用的事实：
{allowed_facts}

禁止混入的其他卖点事实：
{forbidden_facts}

产品的一些参考参数如下，如果需要描述相关细节，请参考这些参数
{key_parameters}`,
    ],
  ]);
  const chain = prompt.pipe(
    state.llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          bullet_points: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['bullet_points'],
      },
      {
        name: 'bullet_points_output',
        method: 'functionCalling',
      } as any
    )
  );
  let candidate = '';
  try {
    const result = (await chain.invoke({
      title: state.bullet_point_title,
      scope: state.bullet_point_scope,
      product_summary: state.product_summary,
      core_keyword0: state.core_keywords[0] || '',
      core_keyword1: state.core_keywords[1] || '',
      allowed_facts: (state.allowed_facts || []).join('\n'),
      forbidden_facts: (state.forbidden_facts || []).join('\n'),
      key_parameters: state.key_parameters || '',
      language: state.language,
    } as any)) as any;
    candidate = pickBestBulletPoint(
      result?.bullet_points || [],
      state.core_keywords || [],
      state.bullet_point_title || '',
      state.allowed_facts || [],
      state.forbidden_facts || []
    );
  } catch {
    candidate = '';
  }
  return {
    bullet_point: candidate,
  };
}

async function shortenText(state: typeof BulletPointSubgraphAnnotation.State) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'human',
      `你是一个亚马逊SEO专家，帮我用{language} 提炼卖点文案：
{bullet_point}
当前卖点范围：{scope}
生成5条，每条满足如下几个要求：
1. 每条卖点为 300-500 个字符
2. 每条卖点必须维持原意
3. 每条卖点必须包含 {core_keyword0} 和 {core_keyword1}
 4. 不得引入范围外的新事实
允许事实：
{allowed_facts}
禁止混入事实：
{forbidden_facts}`,
    ],
  ]);
  const chain = prompt.pipe(
    state.llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          bullet_points: { type: 'array', items: { type: 'string' } },
        },
        required: ['bullet_points'],
      },
      {
        name: 'bullet_points_output',
        method: 'functionCalling',
      } as any
    )
  );
  try {
    const result = (await chain.invoke({
      bullet_point: state.bullet_point,
      scope: state.bullet_point_scope,
      language: state.language,
      core_keyword0: state.core_keywords[0] || '',
      core_keyword1: state.core_keywords[1] || '',
      allowed_facts: (state.allowed_facts || []).join('\n'),
      forbidden_facts: (state.forbidden_facts || []).join('\n'),
    } as any)) as any;
    return {
      bullet_point: pickBestBulletPoint(
        result?.bullet_points || [],
        state.core_keywords || [],
        state.bullet_point_title || '',
        state.allowed_facts || [],
        state.forbidden_facts || []
      ),
    };
  } catch {
    return { bullet_point: '' };
  }
}

async function extendText(state: typeof BulletPointSubgraphAnnotation.State) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'human',
      `你是一个亚马逊SEO专家，帮我用{language} 扩写卖点文案：
{bullet_point}
当前卖点范围：{scope}
生成5条，每条满足如下几个要求：
1. 每条卖点为 300-500 个字符
2. 每条卖点必须维持原意
3. 每条卖点必须包含 {core_keyword0} 和 {core_keyword1}
 4. 不得引入范围外的新事实
允许事实：
{allowed_facts}
禁止混入事实：
{forbidden_facts}`,
    ],
  ]);
  const chain = prompt.pipe(
    state.llm.withStructuredOutput(
      {
        type: 'object',
        properties: {
          bullet_points: { type: 'array', items: { type: 'string' } },
        },
        required: ['bullet_points'],
      },
      {
        name: 'bullet_points_output',
        method: 'functionCalling',
      } as any
    )
  );
  try {
    const result = (await chain.invoke({
      bullet_point: state.bullet_point,
      scope: state.bullet_point_scope,
      language: state.language,
      core_keyword0: state.core_keywords[0] || '',
      core_keyword1: state.core_keywords[1] || '',
      allowed_facts: (state.allowed_facts || []).join('\n'),
      forbidden_facts: (state.forbidden_facts || []).join('\n'),
    } as any)) as any;
    return {
      bullet_point: pickBestBulletPoint(
        result?.bullet_points || [],
        state.core_keywords || [],
        state.bullet_point_title || '',
        state.allowed_facts || [],
        state.forbidden_facts || []
      ),
    };
  } catch {
    return { bullet_point: '' };
  }
}

function combineResult(state: typeof BulletPointSubgraphAnnotation.State) {
  return {
    retry_count: (state.retry_count || 0) + 1,
    bullet_point: formatBulletPoint(
      state.bullet_point_title || '',
      state.bullet_point || ''
    ),
  };
}

function finalOutput(state: typeof BulletPointSubgraphAnnotation.State) {
  const formatted = String(state.bullet_point || '').trim();
  const titlePrefix = `【${state.bullet_point_title || ''}】`;
  if (!formatted || formatted === titlePrefix) {
    return { bullet_point: '' };
  }
  return { bullet_point: formatted };
}

function getBulletPointBody(state: typeof BulletPointSubgraphAnnotation.State) {
  const bp = String(state.bullet_point || '');
  const titlePrefix = `【${state.bullet_point_title || ''}】`;
  return bp.startsWith(titlePrefix) ? bp.slice(titlePrefix.length) : bp;
}

function validateBulletPoint(state: typeof BulletPointSubgraphAnnotation.State) {
  if ((state.retry_count || 0) > 3) return 'final_output';
  const bp = state.bullet_point || '';
  if (!bp || bp === `【${state.bullet_point_title}】`) return 'generate_bullet_point';
  const phrases = (state.core_keywords || []).map(k => String(k || '').trim()).filter(Boolean);
  if (findMissingPhrases(getBulletPointBody(state), phrases).length > 0) {
    return 'generate_bullet_point';
  }
  if (
    containsForbiddenFactLeak(
      getBulletPointBody(state),
      state.forbidden_facts || [],
      state.allowed_facts || []
    )
  ) {
    return 'generate_bullet_point';
  }
  if (bp.length < 300) return 'extend_text';
  if (bp.length > 500) return 'shorten_text';
  return 'final_output';
}

export function buildGenerateBpSubgraph() {
  return new StateGraph(BulletPointSubgraphAnnotation)
    .addNode('generate_bullet_point', generateBulletPoint)
    .addNode('shorten_text', shortenText)
    .addNode('extend_text', extendText)
    .addNode('combine_result', combineResult)
    .addNode('final_output', finalOutput)
    .addEdge(START, 'generate_bullet_point')
    .addEdge('generate_bullet_point', 'combine_result')
    .addEdge('shorten_text', 'combine_result')
    .addEdge('extend_text', 'combine_result')
    .addConditionalEdges('combine_result', validateBulletPoint, [
      'generate_bullet_point',
      'shorten_text',
      'extend_text',
      'final_output',
    ])
    .addEdge('final_output', END)
    .compile();
}

export async function invokeGenerateBpSubgraph(input: BulletPointSubgraphInput) {
  const graph = buildGenerateBpSubgraph();
  const res = await graph.invoke({
    ...input,
    retry_count: 0,
  });
  return {
    bullet_point: res.bullet_point || '',
    retry_count: Number(res.retry_count || 0),
  };
}
