import { Annotation, END, START, StateGraph } from '@langchain/langgraph';

type KeywordResearchSubgraphInput = {
  taskId: number;
  initialContext?: Record<string, any>;
  selectCompetitors: () => Promise<Record<string, any>>;
  runGoResearch: (competitorPick: Record<string, any>) => Promise<Record<string, any>>;
  selectKeywords: (goResearch: Record<string, any>) => Promise<Record<string, any>>;
  extractVariantMarkers: (
    keywordSelection: Record<string, any>,
    competitorPick: Record<string, any>
  ) => Promise<Record<string, any>>;
};

const KeywordResearchSubgraphState = Annotation.Root({
  taskId: Annotation<number>({ reducer: (_, right) => right }),
  context: Annotation<Record<string, any>>({
    reducer: (_, right) => right,
    default: () => ({}),
  }),
  competitorPick: Annotation<Record<string, any>>({
    reducer: (_, right) => right,
    default: () => ({}),
  }),
  goResearch: Annotation<Record<string, any>>({
    reducer: (_, right) => right,
    default: () => ({}),
  }),
  keywordSelection: Annotation<Record<string, any>>({
    reducer: (_, right) => right,
    default: () => ({}),
  }),
  variantMarker: Annotation<Record<string, any>>({
    reducer: (_, right) => right,
    default: () => ({}),
  }),
  selectCompetitors: Annotation<KeywordResearchSubgraphInput['selectCompetitors']>({
    reducer: (_, right) => right,
  }),
  runGoResearch: Annotation<KeywordResearchSubgraphInput['runGoResearch']>({
    reducer: (_, right) => right,
  }),
  selectKeywords: Annotation<KeywordResearchSubgraphInput['selectKeywords']>({
    reducer: (_, right) => right,
  }),
  extractVariantMarkers: Annotation<KeywordResearchSubgraphInput['extractVariantMarkers']>({
    reducer: (_, right) => right,
  }),
});

function mergeStage(context: Record<string, any>, key: string, result: Record<string, any>) {
  return {
    ...(context || {}),
    keyword_stage: {
      ...((context || {}).keyword_stage || {}),
      [key]: result,
    },
  };
}

function buildKeywordResearchSubgraph() {
  return new StateGraph(KeywordResearchSubgraphState)
    .addNode('competitor_pick', async state => {
      const result = await state.selectCompetitors();
      return {
        competitorPick: result,
        context: mergeStage(state.context, 'competitor_pick', result),
      };
    })
    .addNode('go_research', async state => {
      const result = await state.runGoResearch(state.competitorPick || {});
      return {
        goResearch: result,
        context: mergeStage(state.context, 'go_research', result),
      };
    })
    .addNode('keyword_selection', async state => {
      const result = await state.selectKeywords(state.goResearch || {});
      return {
        keywordSelection: result,
        context: mergeStage(state.context, 'keyword_selection', result),
      };
    })
    .addNode('variant_marker', async state => {
      const result = await state.extractVariantMarkers(
        state.keywordSelection || {},
        state.competitorPick || {}
      );
      return {
        variantMarker: result,
        context: mergeStage(state.context, 'variant_marker', result),
      };
    })
    .addEdge(START, 'competitor_pick')
    .addEdge('competitor_pick', 'go_research')
    .addEdge('go_research', 'keyword_selection')
    .addEdge('keyword_selection', 'variant_marker')
    .addEdge('variant_marker', END)
    .compile();
}

export async function invokeKeywordResearchSubgraph(input: KeywordResearchSubgraphInput) {
  const graph = buildKeywordResearchSubgraph();
  const result = await graph.invoke({
    taskId: input.taskId,
    context: input.initialContext || {},
    selectCompetitors: input.selectCompetitors,
    runGoResearch: input.runGoResearch,
    selectKeywords: input.selectKeywords,
    extractVariantMarkers: input.extractVariantMarkers,
  });
  return {
    competitorPick: result.competitorPick || {},
    goResearch: result.goResearch || {},
    keywordSelection: result.keywordSelection || {},
    variantMarker: result.variantMarker || {},
    context: result.context || {},
  };
}

