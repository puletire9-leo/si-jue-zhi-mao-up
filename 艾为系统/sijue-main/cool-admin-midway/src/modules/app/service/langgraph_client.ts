import { Logger, Provide } from '@midwayjs/decorator';
import { ILogger } from '@midwayjs/logger';
import { Annotation, END, START, StateGraph } from '@langchain/langgraph';
import {
  invokeGeneratorGraph,
} from './ai_listing_graph/generator-graph';
import { invokeKeywordResearchSubgraph } from './ai_listing_graph/subgraphs/keyword-research-subgraph';
import {
  invokeTranslatorGraph,
} from './ai_listing_graph/translator-graph';
import {
  ListingGeneratorInput,
  TaskOutputContract,
  TranslatorGraphInput,
} from './ai_listing_graph/state';

type InvokeInput = {
  taskId: number;
  initialFlowContext: Record<string, any>;
  runKeywordResearch: () => Promise<any>;
  runBaseCopyGeneration: (keywordResult: any) => Promise<any>;
  runVariantMaterialization: (baseCopyResult: any) => Promise<any>;
  trace?: {
    runName?: string;
    tags?: string[];
    metadata?: Record<string, any>;
  };
};

const AIListingGraphState = Annotation.Root({
  taskId: Annotation<number>({
    reducer: (_, right) => right,
  }),
  flowContext: Annotation<Record<string, any>>({
    reducer: (_, right) => right,
  }),
  keywordResult: Annotation<any>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  baseCopyResult: Annotation<any>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  variantResult: Annotation<any>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  runKeywordResearch: Annotation<InvokeInput['runKeywordResearch']>({
    reducer: (_, right) => right,
  }),
  runBaseCopyGeneration: Annotation<InvokeInput['runBaseCopyGeneration']>({
    reducer: (_, right) => right,
  }),
  runVariantMaterialization: Annotation<InvokeInput['runVariantMaterialization']>({
    reducer: (_, right) => right,
  }),
});

@Provide()
export class LangGraphClientService {
  @Logger()
  logger: ILogger;

  private buildTaskGraph() {
    return new StateGraph(AIListingGraphState)
      .addNode('keyword_research', async state => {
        const keywordResult = await state.runKeywordResearch();
        const prev = state.flowContext || {};
        const flowContext = {
          ...prev,
          intermediate: {
            ...(prev.intermediate || {}),
            keyword_research: {
              status: 'done',
              output: keywordResult,
            },
          },
          keyword_stage: {
            status: 'done',
            result: keywordResult,
          },
        };
        return { keywordResult, flowContext };
      })
      .addNode('base_copy_generation', async state => {
        const baseCopyResult = await state.runBaseCopyGeneration(
          state.keywordResult
        );
        const prev = state.flowContext || {};
        const flowContext = {
          ...prev,
          intermediate: {
            ...(prev.intermediate || {}),
            base_copy_generation: {
              status: 'done',
              input_summary: {
                keyword_count: Array.isArray(state.keywordResult?.normalized_keywords)
                  ? state.keywordResult.normalized_keywords.length
                  : 0,
              },
              output: baseCopyResult,
            },
          },
          base_copy_stage: {
            status: 'done',
            result: baseCopyResult,
          },
        };
        return { baseCopyResult, flowContext };
      })
      .addNode('variant_materialization', async state => {
        const variantResult = await state.runVariantMaterialization(
          state.baseCopyResult
        );
        const baseCopyByLang =
          state.baseCopyResult &&
          typeof (state.baseCopyResult as any).languages === 'object'
            ? ((state.baseCopyResult as any).languages as Record<string, any>)
            : null;
        const enBaseCopy = baseCopyByLang?.en || state.baseCopyResult || {};
        const variantByLang =
          variantResult && typeof (variantResult as any).languages === 'object'
            ? ((variantResult as any).languages as Record<string, any>)
            : null;
        const prev = state.flowContext || {};
        const output: TaskOutputContract = {
          base_copy_result_by_language: {
            en: (baseCopyByLang?.en || enBaseCopy || null) as any,
            de: (baseCopyByLang?.de || null) as any,
          },
          variant_titles_by_language: {
            en: (variantByLang?.en || (variantResult || {}))?.variant_titles || {},
            de: variantByLang?.de?.variant_titles || {},
          },
          summary_metrics: {
            keywords_count: Array.isArray(state.keywordResult?.normalized_keywords)
              ? state.keywordResult.normalized_keywords.length
              : 0,
            competitor_count: Array.isArray(enBaseCopy?.generator_input?.competitor_titles)
              ? enBaseCopy.generator_input.competitor_titles.length
              : 0,
            marker_count: Array.isArray(state.keywordResult?.keyword_stage?.variant_marker?.markers)
              ? state.keywordResult.keyword_stage.variant_marker.markers.length
              : 0,
          },
        };
        const flowContext = {
          ...prev,
          intermediate: {
            ...(prev.intermediate || {}),
            variant_materialization: {
              status: 'done',
              output: variantResult,
            },
          },
          output,
          variant_materialize_stage: {
            status: 'done',
            result: variantResult,
          },
        };
        return { variantResult, flowContext };
      })
      .addEdge(START, 'keyword_research')
      .addEdge('keyword_research', 'base_copy_generation')
      .addEdge('base_copy_generation', 'variant_materialization')
      .addEdge('variant_materialization', END)
      .compile();
  }

  async invokeTaskGraph(input: InvokeInput) {
    const graph = this.buildTaskGraph();
    const result = await graph.invoke({
        taskId: input.taskId,
        flowContext: input.initialFlowContext || {},
        runKeywordResearch: input.runKeywordResearch,
        runBaseCopyGeneration: input.runBaseCopyGeneration,
        runVariantMaterialization: input.runVariantMaterialization,
      },
      {
        runName: input.trace?.runName || 'AIListingTaskGraph',
        tags: input.trace?.tags || [],
        metadata: input.trace?.metadata || {},
      } as any
    );
    return this.mapInvokeResultToTaskPatch(result);
  }

  async invokeBaseCopyGenerator(
    input: ListingGeneratorInput,
    trace?: {
      runName?: string;
      tags?: string[];
      metadata?: Record<string, any>;
    }
  ) {
    return invokeGeneratorGraph(input, trace);
  }

  async invokeKeywordResearchSubgraph(input: {
    taskId: number;
    initialContext?: Record<string, any>;
    selectCompetitors: () => Promise<Record<string, any>>;
    runGoResearch: (competitorPick: Record<string, any>) => Promise<Record<string, any>>;
    selectKeywords: (goResearch: Record<string, any>) => Promise<Record<string, any>>;
    extractVariantMarkers: (
      keywordSelection: Record<string, any>,
      competitorPick: Record<string, any>
    ) => Promise<Record<string, any>>;
  }) {
    return invokeKeywordResearchSubgraph(input);
  }

  async invokeTranslator(input: TranslatorGraphInput, enabled = false) {
    return invokeTranslatorGraph(input, { enabled });
  }

  // Backward-compatible stubs for legacy flow during refactor.
  async run(_payload: any): Promise<{ runId: string }> {
    return { runId: `local-${Date.now()}` };
  }

  async getRun(
    _runId: string
  ): Promise<{ status: string; errorMessage?: string; raw: any }> {
    return { status: 'succeeded', raw: {} };
  }

  async getRunResult(_runId: string): Promise<any> {
    return {};
  }

  private mapInvokeResultToTaskPatch(result: any) {
    return {
      keywordResult: result?.keywordResult || null,
      baseCopyResult: result?.baseCopyResult || null,
      variantResult: result?.variantResult || null,
      flowContext: result?.flowContext || {},
    };
  }
}
