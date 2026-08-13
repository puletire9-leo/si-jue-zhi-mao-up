import { END, START, StateGraph } from '@langchain/langgraph';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { getLlmByUser } from './llm';
import { TranslatorGraphInput, TranslatorGraphStateAnnotation } from './state';
import { invokeTranslateTitleSubgraph } from './subgraphs/translate-title-subgraph';
import { invokeTranslateBpSubgraph } from './subgraphs/translate-bp-subgraph';
import {
  collectAllowedKeywordsFromList,
  runListingCopyChecks,
} from './listing-copy-checker';

type TranslatorOptions = {
  enabled?: boolean;
};

async function translateTitle(state: typeof TranslatorGraphStateAnnotation.State) {
  const llm = getLlmByUser(state.input.username);
  const res = await invokeTranslateTitleSubgraph({
    language: state.input.language,
    title: state.input.title,
    keywords: state.input.keywords || [],
    llm,
  });
  return { translated_title: String((res as any).translated_title || '') };
}

async function translateBulletPoints(state: typeof TranslatorGraphStateAnnotation.State) {
  const llm = getLlmByUser(state.input.username);
  const translated: string[] = [];
  for (let idx = 0; idx < 5; idx++) {
    const res = await invokeTranslateBpSubgraph({
      bullet_point: String((state.input.bullet_points || [])[idx] || ''),
      keywords: state.input.keywords || [],
      language: state.input.language,
      llm,
    });
    translated.push(String((res as any).translated_bullet_point || ''));
  }
  return { translated_bullet_points: translated };
}

async function translateDescription(state: typeof TranslatorGraphStateAnnotation.State) {
  const llm = getLlmByUser(state.input.username);
  const prompt = ChatPromptTemplate.fromMessages([
    ['system', '你是一个亚马逊SEO专家，把下面一个亚马逊Listing标题翻译成 {language}，要求与原文意思一致'],
    ['human', '原文：{description}'],
  ]);
  const chain = prompt.pipe(
    llm.withStructuredOutput(
      {
        type: 'object',
        properties: { translated_description: { type: 'string' } },
        required: ['translated_description'],
      },
      {
        name: 'translated_description',
        method: 'functionCalling',
      } as any
    )
  );
  const res = (await chain.invoke({
    description: state.input.description,
    language: state.input.language,
  } as any)) as any;
  return { translated_description: String(res.translated_description || '') };
}

async function translateChecker(state: typeof TranslatorGraphStateAnnotation.State) {
  const llm = getLlmByUser(state.input.username);
  const input = state.input;
  const reviewText = [
    state.translated_title,
    ...(state.translated_bullet_points || []),
    state.translated_description,
  ]
    .filter(Boolean)
    .join('\n');
  const allowedKeywords =
    (input.allowed_keywords || []).map((k) => String(k || '').trim()).filter(Boolean).length > 0
      ? (input.allowed_keywords || []).map((k) => String(k || '').trim()).filter(Boolean)
      : collectAllowedKeywordsFromList(input.keywords as string[]);
  return runListingCopyChecks(llm, {
    language: input.language || 'English',
    productSummary: String(input.product_summary || input.description || '').trim(),
    productName: String(input.product_name || '').trim(),
    produceName: String(input.produce_name || '').trim(),
    keyParameters: String(input.key_parameters || '').trim(),
    packageInfo: String(input.package_info || '').trim(),
    variantFacts: (input.variant_facts || []).map((v) => ({
      name: String(v?.name || '').trim(),
      description: String(v?.description || '').trim(),
    })),
    allowedKeywords,
    reviewText,
  });
}

export function buildTranslatorGraph() {
  return new StateGraph(TranslatorGraphStateAnnotation)
    .addNode('translate_title', translateTitle)
    .addNode('translate_bullet_points', translateBulletPoints)
    .addNode('translate_description', translateDescription)
    .addNode('translate_checker', translateChecker)
    .addEdge(START, 'translate_title')
    .addEdge('translate_title', 'translate_bullet_points')
    .addEdge('translate_bullet_points', 'translate_description')
    .addEdge('translate_description', 'translate_checker')
    .addEdge('translate_checker', END)
    .compile();
}

export async function invokeTranslatorGraph(
  input: TranslatorGraphInput,
  options: TranslatorOptions = {}
): Promise<{ enabled: false; reason: string } | { enabled: true; output: any; rawState: any }> {
  if (!options.enabled) {
    return {
      enabled: false,
      reason: 'translator graph is disabled in V1',
    };
  }
  const graph = buildTranslatorGraph();
  const result = await graph.invoke({ input });
  return {
    enabled: true,
    output: {
      translated_title: result.translated_title || '',
      translated_bullet_points: result.translated_bullet_points || [],
      translated_description: result.translated_description || '',
      brand_names: result.brand_names || [],
      irrelevant_words: result.irrelevant_words || [],
      potential_risk_words: result.potential_risk_words || [],
    },
    rawState: result,
  };
}
