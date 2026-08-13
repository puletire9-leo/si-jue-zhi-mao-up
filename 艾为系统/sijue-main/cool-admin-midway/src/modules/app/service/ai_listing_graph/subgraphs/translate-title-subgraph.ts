import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import { textContainsAllPhrases } from '../keyword-phrase-match';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';

const TranslateTitleStateAnnotation = Annotation.Root({
  language: Annotation<string>({ reducer: (_, right) => right }),
  title: Annotation<string>({ reducer: (_, right) => right }),
  keywords: Annotation<string[]>({ reducer: (_, right) => right }),
  retry_count: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0,
  }),
  translated_title: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  llm: Annotation<ChatOpenAI>({ reducer: (_, right) => right }),
});

export type TranslateTitleSubgraphInput = {
  language: string;
  title: string;
  keywords: string[];
  llm: ChatOpenAI;
};

function trimTitle(title: string, keywords: string[]) {
  if (title.length <= 200) return title;
  const phrases = title.split(',').map(x => x.trim());
  const result = [...phrases];
  for (let i = phrases.length - 1; i > 0; i--) {
    if (result.join(', ').length <= 200) break;
    const phrase = phrases[i].toLowerCase();
    const hasKeyword = keywords.some(k => phrase.includes(k.toLowerCase()));
    if (!hasKeyword) result.splice(i, 1);
  }
  return result.join(', ');
}

async function translateTitle(state: typeof TranslateTitleStateAnnotation.State) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      '你是一个亚马逊SEO专家，把下面一个亚马逊Listing标题翻译成 {language}，要求必须包含关键词 {keywords} 且字符串长度在175到200之间',
    ],
    ['human', '原标题：{title}'],
  ]);
  const chain = prompt.pipe(
    state.llm.withStructuredOutput(
      {
        type: 'object',
        properties: { translated_title: { type: 'string' } },
        required: ['translated_title'],
      },
      {
        name: 'translate_title_output',
        method: 'functionCalling',
      } as any
    )
  );
  const res = (await chain.invoke({
    title: state.title,
    keywords: state.keywords.join(', '),
    language: state.language,
  } as any)) as any;
  return {
    translated_title: trimTitle(String(res.translated_title || ''), state.keywords || []),
    retry_count: (state.retry_count || 0) + 1,
  };
}

function validateTitleRouting(state: typeof TranslateTitleStateAnnotation.State) {
  if (!state.translated_title) return 'translate_title';
  if ((state.retry_count || 0) > 3) return END;
  if (state.translated_title.length > 200) return 'translate_title';
  const keywordPhrases = (state.keywords || []).map(k => String(k || '').trim()).filter(Boolean);
  if (!textContainsAllPhrases(state.translated_title, keywordPhrases)) {
    return 'translate_title';
  }
  return END;
}

export function buildTranslateTitleSubgraph() {
  return new StateGraph(TranslateTitleStateAnnotation)
    .addNode('translate_title', translateTitle)
    .addEdge(START, 'translate_title')
    .addConditionalEdges('translate_title', validateTitleRouting, [
      'translate_title',
      END,
    ])
    .compile();
}

export async function invokeTranslateTitleSubgraph(input: TranslateTitleSubgraphInput) {
  const graph = buildTranslateTitleSubgraph();
  return graph.invoke({
    ...input,
    retry_count: 0,
  });
}

