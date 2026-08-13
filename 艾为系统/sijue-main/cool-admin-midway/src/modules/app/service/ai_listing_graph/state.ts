import { Annotation } from '@langchain/langgraph';
import { BulletPlanFact, BulletPlanItem } from './bullet-plan';

export type ListingKeywordItem = {
  type: string;
  keyword: string;
  search_volume: number;
  image_relevance_score?: number | null;
  title_relevance_score?: number | null;
  total_relevance_score?: number | null;
  traffic_score?: number | null;
};

export type TaskInputContract = {
  task_id: number;
  candidate_id: number;
  amazon_account_id: string | null;
  country_code: string;
  variant_ids: string[];
};

export type KeywordResearchOutputContract = {
  competitor_pick: NonNullable<KeywordResearchStageResult['competitor_pick']>;
  go_research: NonNullable<KeywordResearchStageResult['go_research']>;
  keyword_selection: NonNullable<KeywordResearchStageResult['keyword_selection']>;
  variant_marker: NonNullable<KeywordResearchStageResult['variant_marker']>;
};

export type BaseCopyInputContract = {
  language: string;
  product_args: string;
  keywords: ListingKeywordItem[];
  reference_source_type?: 'manual_bullets' | 'competitor';
  reference_bullet_points?: string[];
  manual_reference_title?: string;
  title_extend_phrases?: string[];
  competitor_titles: string[];
  competitor_bullet_points: string[][];
};

export type TaskOutputContract = {
  base_copy_result_by_language: {
    en: Record<string, any> | null;
    de: Record<string, any> | null;
  };
  variant_titles_by_language: {
    en: Record<string, string>;
    de: Record<string, string>;
  };
  summary_metrics?: {
    keywords_count: number;
    competitor_count: number;
    marker_count: number;
  };
};

export type KeywordResearchStageResult = {
  competitor_pick?: {
    top4?: Array<Record<string, any>>;
    chosen_best?: Record<string, any> | null;
  };
  go_research?: {
    go_task_id?: string;
    status?: string;
    result?: Record<string, any>;
  };
  keyword_selection?: {
    invalid_keywords: Array<{ keyword: string; reason: string }>;
    selected: {
      main_keyword: string | null;
      core_keywords: string[];
      long_tail_keywords: string[];
    };
    normalized_keywords: ListingKeywordItem[];
  };
  variant_marker?: {
    markers: Array<{ variant_id: string; marker: string; reason: string }>;
  };
};

export type ListingGeneratorVariantFact = {
  name: string;
  description: string;
};

export type ListingGeneratorInput = {
  username: string;
  language: string;
  product_summary?: string | null;
  product_name?: string | null;
  produce_name?: string | null;
  product_args?: string | null;
  key_parameters?: string | null;
  package_info?: string | null;
  variant_facts?: ListingGeneratorVariantFact[] | null;
  allowed_keywords?: string[] | null;
  duplicate_num: number;
  keywords: ListingKeywordItem[];
  reference_source_type?: 'manual_bullets' | 'competitor' | null;
  reference_bullet_points?: string[] | null;
  manual_reference_title?: string | null;
  title_extend_phrases?: string[] | null;
  competitor_titles?: string[] | null;
  competitor_bullet_points?: string[][] | null;
  tail_product_args?: string[] | null;
  bullet_points_title?: string[] | null;
  reserved_title_suffix_length?: number | null;
};

export type ListingGeneratorOutput = {
  title: Record<string, any> | null;
  title_more_freq: Record<string, any> | null;
  title_less_freq: Record<string, any> | null;
  title_words: Record<string, any> | null;
  long_tail_phrases: Record<string, any>[];
  bullet_titles: { bullet_titles: BulletPlanItem[] } | null;
  bullet_points: Record<string, any>[];
  description: string | null;
  duplicate_titles: string[];
  duplicate_bullet_points: string[][];
  brand_names: Record<string, any>[];
  irrelevant_words: Record<string, any>[];
  potential_risk_words: Record<string, any>[];
};

export const ListingGeneratorStateAnnotation = Annotation.Root({
  input: Annotation<ListingGeneratorInput>({
    reducer: (_, right) => right,
  }),
  username: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  language: Annotation<string>({
    reducer: (_, right) => right,
    default: () => 'English',
  }),
  keywords: Annotation<ListingKeywordItem[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  competitor_titles: Annotation<string[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  reference_source_type: Annotation<'manual_bullets' | 'competitor'>({
    reducer: (_, right) => right,
    default: () => 'competitor',
  }),
  reference_bullet_points: Annotation<string[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  manual_reference_title: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  title_extend_phrases: Annotation<string[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  competitor_bullet_points: Annotation<string[][]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  product_summary: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  product_args: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  key_parameters: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  package_info: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  duplicate_num: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 1,
  }),
  tail_product_args: Annotation<string[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  bullet_points_title: Annotation<string[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  reserved_title_suffix_length: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0,
  }),
  words_dict: Annotation<Record<string, any>[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  extracted_words: Annotation<{
    core_head_words: string[];
    core_words: string[];
    long_tail_words: string[];
  }>({
    reducer: (_, right) => right,
    default: () => ({
      core_head_words: [],
      core_words: [],
      long_tail_words: [],
    }),
  }),
  search_stats: Annotation<ListingKeywordItem[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  title_words: Annotation<Record<string, any>>({
    reducer: (_, right) => right,
    default: () => ({}),
  }),
  long_tail_phrases: Annotation<Record<string, any>[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  title: Annotation<Record<string, any> | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  title_more_freq: Annotation<Record<string, any> | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  title_less_freq: Annotation<Record<string, any> | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  bullet_titles: Annotation<{ bullet_titles: BulletPlanItem[]; facts: BulletPlanFact[] } | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  bullet_point_0: Annotation<Record<string, any> | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  bullet_point_1: Annotation<Record<string, any> | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  bullet_point_2: Annotation<Record<string, any> | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  bullet_point_3: Annotation<Record<string, any> | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  bullet_point_4: Annotation<Record<string, any> | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  bullet_point_5: Annotation<Record<string, any> | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  bullet_point_6: Annotation<Record<string, any> | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  bullet_point_7: Annotation<Record<string, any> | null>({
    reducer: (_, right) => right,
    default: () => null,
  }),
  bullet_points: Annotation<Record<string, any>[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  description: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  description_retry_count: Annotation<number>({
    reducer: (_, right) => right,
    default: () => 0,
  }),
  duplicate_titles: Annotation<string[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  duplicate_bullet_points: Annotation<string[][]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  brand_names: Annotation<Record<string, any>[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  irrelevant_words: Annotation<Record<string, any>[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  potential_risk_words: Annotation<Record<string, any>[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
});

export type ListingGeneratorState = typeof ListingGeneratorStateAnnotation.State;

export type TranslatorGraphInput = {
  username: string;
  language: string;
  keywords: string[];
  title: string;
  bullet_points: string[];
  description: string;
  product_summary?: string | null;
  product_name?: string | null;
  produce_name?: string | null;
  key_parameters?: string | null;
  package_info?: string | null;
  variant_facts?: ListingGeneratorVariantFact[] | null;
  allowed_keywords?: string[] | null;
};

export const TranslatorGraphStateAnnotation = Annotation.Root({
  input: Annotation<TranslatorGraphInput>({
    reducer: (_, right) => right,
  }),
  translated_title: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  translated_bullet_points: Annotation<string[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  translated_description: Annotation<string>({
    reducer: (_, right) => right,
    default: () => '',
  }),
  brand_names: Annotation<Record<string, any>[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  irrelevant_words: Annotation<Record<string, any>[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
  potential_risk_words: Annotation<Record<string, any>[]>({
    reducer: (_, right) => right,
    default: () => [],
  }),
});
