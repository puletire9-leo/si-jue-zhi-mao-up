import { Config, Inject, Provide } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { Context } from '@midwayjs/koa';
import {
  AiListingTaskEntity,
  AI_LISTING_TASK_TYPE,
  AiListingTaskType,
} from '../entity/ai_listing_task';
import {
  AI_LISTING_ACTIVE_STATUS,
  AI_LISTING_TASK_STATUS,
  isAiListingReviewTerminalStage,
  stageByStatus,
} from './ai_listing_task_status';
import { AiListingTaskSchedulerService } from './ai_listing_task_scheduler';
import { KeywordResearchGoClientService } from './keyword_research_go_client';
import { LangGraphClientService } from './langgraph_client';
import { AppAmzBsrCandidateEntity } from '../entity/bsr_candidate';
import { AppAmzSellerEntity } from '../entity/seller';
import { BaseSysUserEntity } from '../../base/entity/sys/user';
import { AppAmzListingKeywordEntity } from '../entity/keyword';
import { AppAmzBsrCandidateVariantEntity } from '../entity/bsr_candidate_variant';
import { AppAmzBsrCandidatePurchaserEntity } from '../entity/bsr_candidate_purchaser';
import { AppAmzBsrCandidateCompetitorEntity } from '../entity/bsr_candidate_competitor';
import {
  AiListingLang,
  AiListingLanguageStatus,
  AiListingReferenceSourceType,
  AiListingTaskCreatePayload,
  buildAiListingTaskIdempotencyKey,
  buildAiListingTaskTargetKey,
  buildInitialLanguageStatus,
  defaultRequestedLanguagesForLegacy,
  ensureAiListingTaskPayloadValid,
  normalizeManualReferenceBullets,
  normalizeOnlyLanguages,
  normalizeReferenceCompetitorAsins,
  normalizeReferenceCompetitorAsinsByCountry,
  normalizeReferenceSourceType,
  normalizeRequestedLanguages,
  ReferenceCompetitorAsinsByCountry,
  ReferenceCompetitorAsinsByCountryInput,
  resolveRequiredLanguagesFromPurchaseRows,
  shouldRetry,
  validateReferenceCompetitorSelectionForLanguages,
} from './ai_listing_task_policy';
import { OxylabsService } from './OxylabsService';
import { getLlmByUser } from './ai_listing_graph/llm';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import {
  BaseCopyInputContract,
  TaskInputContract,
  TaskOutputContract,
} from './ai_listing_graph/state';
import {
  validateAiListingPreflight,
  AI_LISTING_PREFLIGHT_MIN_KEYWORDS,
} from './ai_listing_preflight';
import { ListingDingTalkNotifyService } from './listing_dingtalk_notify';
import {
  canonicalKeywordKey,
  findChosenIndicesSubsumedBy,
  getKeywordSearchVolume,
  isKeywordSubsetOfAny,
  isSameKeywordVariant,
  keywordLookupKey,
  mergeKeywordSearchVolume,
} from './ai_listing_graph/keyword-phrase-match';
import { assertMasterTitleLength } from './listing-title-char-limit';
import {
  assertVariantTitleSuffixRoundTrip,
  extractVariantTitleSuffix,
} from './listing-variant-title-suffix';

@Provide()
export class AiListingTaskService {
  @InjectEntityModel(AiListingTaskEntity)
  aiListingTaskRepo: Repository<AiListingTaskEntity>;

  @InjectEntityModel(AppAmzBsrCandidateEntity)
  candidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @InjectEntityModel(AppAmzSellerEntity)
  sellerRepo: Repository<AppAmzSellerEntity>;

  @InjectEntityModel(BaseSysUserEntity)
  baseSysUserRepo: Repository<BaseSysUserEntity>;

  @InjectEntityModel(AppAmzListingKeywordEntity)
  keywordRepo: Repository<AppAmzListingKeywordEntity>;

  @InjectEntityModel(AppAmzBsrCandidateVariantEntity)
  variantRepo: Repository<AppAmzBsrCandidateVariantEntity>;

  @InjectEntityModel(AppAmzBsrCandidatePurchaserEntity)
  purchaserRepo: Repository<AppAmzBsrCandidatePurchaserEntity>;

  @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
  competitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;

  @Inject()
  aiListingTaskSchedulerService: AiListingTaskSchedulerService;

  @Inject()
  keywordResearchGoClientService: KeywordResearchGoClientService;

  @Inject()
  oxylabsService: OxylabsService;

  @Inject()
  langGraphClientService: LangGraphClientService;

  @Inject()
  ctx: Context;

  @Inject()
  listingDingTalkNotifyService: ListingDingTalkNotifyService;

  @Config('aiListingTask')
  aiListingTaskConfig: {
    maxAttempts?: number;
    backoffMs?: number[];
    /** delta 任务：主任务未成功时，再次检查前的间隔（毫秒），默认 60s，建议 30s～5min */
    deltaWaitRootPollMs?: number;
  };

  @Config('keywordResearchGo')
  keywordResearchGoConfig: {
    pollIntervalMs?: number;
  };

  @Config('langgraph')
  langgraphConfig: {
    pollIntervalMs?: number;
  };

  private getOperatorId(): string {
    return this.ctx?.admin?.userId != null
      ? String(this.ctx.admin.userId)
      : 'system';
  }

  private getBackoffMs(attempt: number): number {
    const list = this.aiListingTaskConfig?.backoffMs || [5_000, 15_000, 45_000];
    return Number(
      list[Math.max(0, Math.min(attempt - 1, list.length - 1))] || 5_000
    );
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private toLogSnippet(payload: any, maxLength = 4000) {
    try {
      const text = JSON.stringify(payload);
      if (!text) return '';
      if (text.length <= maxLength) return text;
      return `${text.slice(0, maxLength)}...<truncated>`;
    } catch {
      return String(payload || '');
    }
  }

  private normalizeKeywordLookupKey(text: string) {
    return keywordLookupKey(text);
  }

  private resolveCountryCode(value?: string) {
    const code = String(value || 'uk')
      .trim()
      .toLowerCase();
    return code || 'uk';
  }

  private countryCodeToKeywordMarketplace(countryCode?: string) {
    const code = this.resolveCountryCode(countryCode);
    if (code === 'de') return '德国';
    return '英国';
  }

  private countryCodeToGoMarketplace(countryCode?: string) {
    const code = this.resolveCountryCode(countryCode);
    if (code === 'de') return '德国';
    return '英国';
  }

  private countryCodeToGeneratorLanguage(countryCode?: string) {
    const code = this.resolveCountryCode(countryCode);
    if (code === 'de') return 'German';
    return 'English';
  }

  private getTaskCountryCode(task: AiListingTaskEntity) {
    const countryCode = (task.flow_context as any)?.input?.country_code;
    return this.resolveCountryCode(countryCode);
  }

  private getTaskFlowContext(task: AiListingTaskEntity): Record<string, any> {
    return ((task.flow_context || {}) as Record<string, any>) || {};
  }

  private resolveReferenceSourceTypeFromInput(
    input: Record<string, any>
  ): AiListingReferenceSourceType {
    return normalizeReferenceSourceType(input?.reference_source_type);
  }

  private resolveReferenceSourceTypeFromTask(
    task: AiListingTaskEntity
  ): AiListingReferenceSourceType {
    const input = this.getTaskFlowContext(task).input || {};
    return this.resolveReferenceSourceTypeFromInput(input);
  }

  private getManualReferenceBulletsFromInput(input: Record<string, any>) {
    return normalizeManualReferenceBullets(input?.manual_reference_bullets);
  }

  private getManualReferenceBulletsFromTask(task: AiListingTaskEntity) {
    return this.getManualReferenceBulletsFromInput(
      this.getTaskFlowContext(task).input || {}
    );
  }

  private getManualReferenceNotesFromInput(input: Record<string, any>) {
    return String(input?.manual_reference_notes || '').trim();
  }

  private getManualReferenceTitleFromInput(input: Record<string, any>) {
    return String(input?.manual_reference_title || '').trim();
  }

  private getManualReferenceTitleFromTask(task: AiListingTaskEntity) {
    return this.getManualReferenceTitleFromInput(
      this.getTaskFlowContext(task).input || {}
    );
  }

  private getReferenceCompetitorAsinsFromTask(
    task: AiListingTaskEntity
  ): ReferenceCompetitorAsinsByCountry {
    const input = this.getTaskFlowContext(task).input || {};
    return normalizeReferenceCompetitorAsinsByCountry(
      input.reference_competitor_asins
    );
  }

  resolveRequestedLanguagesFromTask(task: AiListingTaskEntity): AiListingLang[] {
    const input = this.getTaskFlowContext(task).input || {};
    const raw = input.requested_languages;
    if (raw == null) return defaultRequestedLanguagesForLegacy();
    return normalizeRequestedLanguages(raw);
  }

  /** preflight 关键词/竞品校验范围（delta 返回 []） */
  resolvePreflightRequiredLanguages(task: AiListingTaskEntity): AiListingLang[] {
    if (String((task as any).task_mode || 'full') === 'delta') {
      return [];
    }
    const flow = this.getTaskFlowContext(task);
    const onlyRaw = flow.only_languages;
    if (Array.isArray(onlyRaw) && onlyRaw.length) {
      return normalizeOnlyLanguages(onlyRaw);
    }
    return this.resolveRequestedLanguagesFromTask(task);
  }

  private buildPreflightRetryRemark(
    task: AiListingTaskEntity,
    forceLowKeywords: boolean
  ): string {
    const scope = this.resolvePreflightRequiredLanguages(task);
    const scopeLabel =
      scope.length === 2
        ? '英/德'
        : scope.includes('de')
          ? '德'
          : scope.includes('en')
            ? '英'
            : '';
    if (forceLowKeywords && scopeLabel) {
      return `手动重试任务（强制：${scopeLabel}关键词各>=3），从关键词阶段重新开始`;
    }
    if (forceLowKeywords) {
      return '手动重试任务（强制低关键词门槛），从关键词阶段重新开始';
    }
    return '手动重试任务，从关键词阶段重新开始';
  }

  private getTaskLanguageStatus(
    task: AiListingTaskEntity
  ): Record<AiListingLang, AiListingLanguageStatus> {
    const flow = this.getTaskFlowContext(task);
    const stored = flow.language_status || {};
    const requested = this.resolveRequestedLanguagesFromTask(task);
    const base = buildInitialLanguageStatus(requested);
    return {
      en: (stored.en as AiListingLanguageStatus) || base.en,
      de: (stored.de as AiListingLanguageStatus) || base.de,
    };
  }

  hasLanggraphCopyForLang(
    task: AiListingTaskEntity,
    lang: AiListingLang
  ): boolean {
    const lg = (task.langgraph_result || {}) as Record<string, any>;
    const lane = lg[lang];
    const base = lane?.base_copy;
    if (!base) return false;
    if (typeof base === 'string') return Boolean(String(base).trim());
    if (typeof base === 'object' && !Array.isArray(base)) {
      const title = String((base as any).title || '').trim();
      if (title) return true;
      const bullets = (base as any).bullet_points ?? (base as any).bullets;
      if (Array.isArray(bullets)) {
        return bullets.some((b: any) => {
          const text =
            typeof b === 'string'
              ? b
              : String(b?.bullet_point ?? b?.text ?? '').trim();
          return Boolean(String(text || '').trim());
        });
      }
    }
    return false;
  }

  buildTaskLanguageActionFlags(task: AiListingTaskEntity) {
    const requested = this.resolveRequestedLanguagesFromTask(task);
    const languageStatus = this.getTaskLanguageStatus(task);
    const generatedLanguages = (['en', 'de'] as const).filter(lang =>
      this.hasLanggraphCopyForLang(task, lang)
    );
    const enDone = this.hasLanggraphCopyForLang(task, 'en');
    const deDone = this.hasLanggraphCopyForLang(task, 'de');
    const isFull = String((task as any).task_mode || 'full') === 'full';
    const active = AI_LISTING_ACTIVE_STATUS.has(Number(task.status));
    const deRunning = languageStatus.de === 'running';
    const canTriggerDe =
      isFull &&
      enDone &&
      !deDone &&
      !active &&
      !deRunning;
    return {
      requested_languages: requested,
      generated_languages: generatedLanguages,
      language_status: languageStatus,
      can_trigger_de: canTriggerDe,
    };
  }

  private attachTaskLanguageMeta(task: AiListingTaskEntity) {
    return Object.assign({}, task, this.buildTaskLanguageActionFlags(task));
  }

  private laneCountryCodeForLang(lang: AiListingLang): string {
    return lang === 'de' ? 'de' : 'uk';
  }

  private resolveLanesToRun(task: AiListingTaskEntity): Array<{
    langKey: AiListingLang;
    countryCode: string;
  }> {
    const flow = this.getTaskFlowContext(task);
    const onlyRaw = flow.only_languages;
    const langs =
      Array.isArray(onlyRaw) && onlyRaw.length
        ? normalizeOnlyLanguages(onlyRaw)
        : this.resolveRequestedLanguagesFromTask(task);
    return langs.map(lang => ({
      langKey: lang,
      countryCode: this.laneCountryCodeForLang(lang),
    }));
  }

  private mergeLanggraphResultByLang(
    existing: Record<string, any> | null | undefined,
    patch: Record<AiListingLang, Record<string, any> | null>
  ) {
    const prev = (existing || {}) as Record<string, any>;
    return {
      ...prev,
      default_lang: prev.default_lang || 'en',
      en: patch.en != null ? patch.en : prev.en ?? null,
      de: patch.de != null ? patch.de : prev.de ?? null,
    };
  }

  private getTaskInputContract(task: AiListingTaskEntity): TaskInputContract {
    const input = ((task.flow_context || {}) as any)?.input || {};
    return {
      task_id: Number(task.id),
      candidate_id: Number(input.candidate_id || task.target_candidate_id),
      amazon_account_id:
        input.amazon_account_id != null
          ? String(input.amazon_account_id)
          : task.target_amazon_account_id,
      country_code: this.getTaskCountryCode(task),
      variant_ids: Array.isArray(input.variant_ids)
        ? input.variant_ids.map((x: any) => String(x))
        : Array.isArray(task.target_variant_ids)
        ? task.target_variant_ids.map(x => String(x))
        : [],
    };
  }

  private async stageReport(
    report:
      | ((message: string, extra?: Record<string, any>) => Promise<void> | void)
      | undefined,
    event: string,
    payload: {
      input_summary?: Record<string, any>;
      output_summary?: Record<string, any>;
      counts?: Record<string, any>;
      extra?: Record<string, any>;
    } = {}
  ) {
    await report?.(event, {
      event,
      ...(payload.input_summary
        ? { input_summary: payload.input_summary }
        : {}),
      ...(payload.output_summary
        ? { output_summary: payload.output_summary }
        : {}),
      ...(payload.counts ? { counts: payload.counts } : {}),
      ...(payload.extra ? payload.extra : {}),
    });
  }

  private normalizeCompetitorBulletPoints(raw: any): string[] {
    if (Array.isArray(raw)) {
      return raw
        .map(x => String(x || '').trim())
        .filter(Boolean)
        .slice(0, 5);
    }
    const text = String(raw || '').trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map(x => String(x || '').trim())
          .filter(Boolean)
          .slice(0, 5);
      }
    } catch {}
    const normalized = text.replace(/\r/g, '\n');
    const splitByLine = normalized
      .split('\n')
      .map(x => x.replace(/^\s*(?:[-•]|\d+[.)])\s*/, '').trim())
      .filter(Boolean);
    if (splitByLine.length > 1) return splitByLine.slice(0, 5);
    const splitByBullet = normalized
      .split(/(?:\s+|^)(?:[-•]|\d+[.)])\s+/)
      .map(x => x.trim())
      .filter(Boolean);
    if (splitByBullet.length > 1) return splitByBullet.slice(0, 5);
    return [normalized];
  }

  private async loadVariantFactsForTask(task: AiListingTaskEntity) {
    const variantIds = Array.isArray(task.target_variant_ids)
      ? task.target_variant_ids
          .map(id => String(id || '').trim())
          .filter(Boolean)
      : [];
    if (!variantIds.length || !task.target_candidate_id) return [];
    const variants = await this.variantRepo.find({
      where: { candidate_id: Number(task.target_candidate_id) } as any,
      select: ['id', 'name', 'description'] as any,
      take: 50,
    } as any);
    return (variants || [])
      .filter((v: any) => variantIds.includes(String(v.id)))
      .map((v: any) => ({
        name: String(v.name || '').trim(),
        description: String(v.description || '').trim(),
      }))
      .filter(
        (v: { name: string; description: string }) => v.name || v.description
      );
  }

  private buildBaseCopyInputContract(args: {
    task: AiListingTaskEntity;
    normalizedKeywords: any[];
    competitorTop4: any[];
    longestMarker: string;
  }): BaseCopyInputContract {
    const { task, normalizedKeywords, competitorTop4, longestMarker } = args;
    const referenceSourceType = this.resolveReferenceSourceTypeFromTask(task);
    const manualReferenceBullets = this.getManualReferenceBulletsFromTask(task);
    const manualReferenceTitle = this.getManualReferenceTitleFromTask(task);
    const titleExtendPhrases =
      referenceSourceType === 'manual_bullets'
        ? manualReferenceBullets.filter(Boolean)
        : [];
    return {
      language: this.countryCodeToGeneratorLanguage(
        this.getTaskCountryCode(task)
      ),
      product_args: '',
      reference_source_type: referenceSourceType,
      reference_bullet_points:
        referenceSourceType === 'manual_bullets'
          ? manualReferenceBullets.filter(Boolean)
          : [],
      manual_reference_title:
        referenceSourceType === 'manual_bullets' ? manualReferenceTitle : '',
      title_extend_phrases: titleExtendPhrases,
      keywords: (normalizedKeywords || []).map(item => ({
        type: String(item?.type || '核心词'),
        keyword: String(item?.keyword || ''),
        search_volume: Number(item?.search_volume || 0),
        image_relevance_score:
          item?.image_relevance_score != null
            ? Number(item.image_relevance_score)
            : item?.score1 != null
            ? Number(item.score1)
            : undefined,
        title_relevance_score:
          item?.title_relevance_score != null
            ? Number(item.title_relevance_score)
            : item?.score2 != null
            ? Number(item.score2)
            : undefined,
        total_relevance_score:
          item?.total_relevance_score != null
            ? Number(item.total_relevance_score)
            : item?.total_score != null
            ? Number(item.total_score)
            : undefined,
        traffic_score:
          item?.traffic_score != null
            ? Number(item.traffic_score)
            : item?.total_relevance_score != null
            ? Number(item.total_relevance_score)
            : item?.total_score != null
            ? Number(item.total_score)
            : undefined,
      })),
      competitor_titles: (competitorTop4 || [])
        .map((x: any) => String(x?.title || '').trim())
        .filter(Boolean),
      competitor_bullet_points: (competitorTop4 || []).map((x: any) =>
        this.normalizeCompetitorBulletPoints(x?.bullet_points)
      ),
    };
  }

  private buildQueueDebugPayload(
    task: AiListingTaskEntity,
    stage: 'keyword_scoring' | 'langgraph' | 'persist' | 'generate',
    triggerSource: string
  ) {
    return {
      taskId: task.id,
      taskType: task.task_type,
      taskMode: (task as any).task_mode || 'full',
      countryCode: this.getTaskCountryCode(task),
      candidateId: task.target_candidate_id,
      amazonAccountId: task.target_amazon_account_id,
      variantIds: task.target_variant_ids || [],
      groupKey: (task as any).group_key || task.target_key || '',
      rootTaskId: (task as any).root_task_id ?? null,
      mergeIntoTaskId: (task as any).merge_into_task_id ?? null,
      stage,
      triggerSource,
      triggeredBy: task.triggered_by || this.getOperatorId(),
    };
  }

  async appendAiListingTimeline(
    task: AiListingTaskEntity,
    event: {
      status?: number;
      stage?: string;
      remark: string;
      extra?: Record<string, any>;
    }
  ) {
    const timeline = Array.isArray(task.timeline) ? task.timeline : [];
    timeline.push({
      time: new Date().toISOString(),
      status: event.status ?? task.status,
      stage: event.stage || stageByStatus(event.status ?? task.status),
      operator: this.getOperatorId(),
      remark: event.remark,
      ...(event.extra ? { extra: event.extra } : {}),
    });
    task.timeline = timeline;
  }

  async transition(
    taskId: number,
    toStatus: number,
    patch: Partial<AiListingTaskEntity> & {
      remark?: string;
      extra?: Record<string, any>;
    } = {}
  ): Promise<AiListingTaskEntity> {
    const task = await this.aiListingTaskRepo.findOne({
      where: { id: Number(taskId) },
    });
    if (!task) throw new Error('任务不存在');

    task.status = toStatus;
    task.stage = stageByStatus(toStatus);
    if (patch.stage !== undefined && patch.stage !== null) {
      task.stage = String(patch.stage);
    }
    if (patch.progress_percent != null) {
      task.progress_percent = Math.max(
        0,
        Math.min(100, Number(patch.progress_percent))
      );
    }
    if (patch.next_retry_at !== undefined)
      task.next_retry_at = patch.next_retry_at as any;
    if (patch.last_error_code !== undefined)
      task.last_error_code = patch.last_error_code as any;
    if (patch.last_error_message !== undefined)
      task.last_error_message = patch.last_error_message as any;
    if (patch.failed_stage !== undefined)
      task.failed_stage = patch.failed_stage as any;
    if (patch.started_at !== undefined)
      task.started_at = patch.started_at as any;
    if (patch.finished_at !== undefined)
      task.finished_at = patch.finished_at as any;
    if (patch.go_task_id !== undefined)
      task.go_task_id = patch.go_task_id as any;
    if (patch.langgraph_run_id !== undefined)
      task.langgraph_run_id = patch.langgraph_run_id as any;
    if (patch.keyword_result !== undefined)
      task.keyword_result = patch.keyword_result as any;
    if (patch.langgraph_result !== undefined)
      task.langgraph_result = patch.langgraph_result as any;
    if ((patch as any).flow_context !== undefined)
      task.flow_context = (patch as any).flow_context;
    if (patch.score_attempt !== undefined)
      task.score_attempt = Number(patch.score_attempt || 0);
    if (patch.lang_attempt !== undefined)
      task.lang_attempt = Number(patch.lang_attempt || 0);

    await this.appendAiListingTimeline(task, {
      status: toStatus,
      stage: task.stage,
      remark: patch.remark || `流转至 ${toStatus}`,
      extra: patch.extra,
    });
    const saved = await this.aiListingTaskRepo.save(task);

    if (
      toStatus === AI_LISTING_TASK_STATUS.SUCCEEDED &&
      String(saved.stage || '').trim() === 'awaiting_review'
    ) {
      void this.notifyAiListingCopyDoneIfNeeded(saved).catch((e: any) => {
        console.error('[AiListingTask] notify copy done failed:', e?.message || e);
      });
    }

    if (toStatus === AI_LISTING_TASK_STATUS.FAILED) {
      void this.notifyAiListingCopyFailedIfNeeded(saved, patch).catch((e: any) => {
        console.error('[AiListingTask] notify copy failed:', e?.message || e);
      });
    }

    return saved;
  }

  private resolveAiListingFailureReason(
    task: AiListingTaskEntity,
    patch: { remark?: string; last_error_message?: string | null; last_error_code?: string | null }
  ): string {
    const parts = [
      patch.last_error_message,
      patch.remark,
      task.last_error_message,
      task.last_error_code ? `错误码 ${task.last_error_code}` : '',
      task.failed_stage ? `阶段 ${task.failed_stage}` : '',
    ]
      .map(s => String(s || '').trim())
      .filter(Boolean);
    return parts[0] || '未知错误';
  }

  private countAiListingVariants(task: AiListingTaskEntity): number {
    const ids = Array.isArray(task.target_variant_ids) ? task.target_variant_ids : [];
    const filtered = ids.map(x => String(x || '').trim()).filter(Boolean);
    if (filtered.length) return filtered.length;
    const lg = (task.langgraph_result || {}) as Record<string, any>;
    const keys = new Set<string>();
    for (const lang of ['en', 'de']) {
      const titles = lg[lang]?.variant_titles;
      if (titles && typeof titles === 'object') {
        Object.keys(titles).forEach(k => {
          if (String(k || '').trim()) keys.add(String(k).trim());
        });
      }
    }
    return keys.size || 1;
  }

  private async loadCandidateProductName(candidateId: number): Promise<string> {
    const candidate = await this.candidateRepo.findOne({
      where: { id: Number(candidateId) },
      select: ['id', 'produce_name', 'sku'],
    });
    return (
      String(candidate?.produce_name || '').trim() ||
      String(candidate?.sku || '').trim() ||
      `选品#${candidateId}`
    );
  }

  private async notifyAiListingCopyDoneIfNeeded(task: AiListingTaskEntity): Promise<void> {
    const flow = this.getTaskFlowContext(task);
    if (flow.notifications?.copy_done_sent) return;
    const requested = this.resolveRequestedLanguagesFromTask(task);
    const allRequestedReady = requested.every(lang =>
      this.hasLanggraphCopyForLang(task, lang)
    );
    if (!allRequestedReady) return;

    const productName = await this.loadCandidateProductName(Number(task.target_candidate_id));
    await this.listingDingTalkNotifyService.notifyAiListingCopyDone({
      aiListingTaskId: Number(task.id),
      candidateId: Number(task.target_candidate_id),
      productName,
      variantCount: this.countAiListingVariants(task),
    });

    const nextFlow = {
      ...flow,
      notifications: {
        ...(flow.notifications || {}),
        copy_done_sent: true,
      },
    };
    await this.aiListingTaskRepo.update(task.id, {
      flow_context: nextFlow,
    } as any);
  }

  private async notifyAiListingCopyFailedIfNeeded(
    task: AiListingTaskEntity,
    patch: {
      remark?: string;
      last_error_message?: string | null;
      last_error_code?: string | null;
    }
  ): Promise<void> {
    const productName = await this.loadCandidateProductName(Number(task.target_candidate_id));
    await this.listingDingTalkNotifyService.notifyAiListingCopyFailed({
      aiListingTaskId: Number(task.id),
      candidateId: Number(task.target_candidate_id),
      productName,
      variantCount: this.countAiListingVariants(task),
      reason: this.resolveAiListingFailureReason(task, patch),
    });
  }

  async createAndDispatch(
    payload: AiListingTaskCreatePayload,
    operatorId?: string
  ) {
    ensureAiListingTaskPayloadValid(payload);
    const targetKey = buildAiListingTaskTargetKey(payload);
    const idempotencyKey = buildAiListingTaskIdempotencyKey(payload);
    const taskMode = payload.task_mode === 'delta' ? 'delta' : 'full';
    const where = { idempotency_key: idempotencyKey };
    const existing = await this.aiListingTaskRepo.findOne({
      where,
      order: { id: 'DESC' },
    });
    if (existing && AI_LISTING_ACTIVE_STATUS.has(Number(existing.status))) {
      return { reused: true, task: existing };
    }

    const requestedLanguages = normalizeRequestedLanguages(
      payload.requested_languages ?? defaultRequestedLanguagesForLegacy()
    );
    const languageStatus = buildInitialLanguageStatus(requestedLanguages);
    const referenceSourceType = normalizeReferenceSourceType(
      payload.reference_source_type
    );
    const manualReferenceBullets = normalizeManualReferenceBullets(
      payload.manual_reference_bullets
    );
    const manualReferenceNotes = String(
      payload.manual_reference_notes || ''
    ).trim();
    const manualReferenceTitle = String(
      payload.manual_reference_title || ''
    ).trim();

    const row = this.aiListingTaskRepo.create({
      task_type: payload.task_type,
      target_candidate_id: Number(payload.target_candidate_id),
      target_amazon_account_id: payload.target_amazon_account_id || null,
      target_variant_ids: (payload.target_variant_ids || []).map(id =>
        String(id || '').trim()
      ),
      target_variant_id: null,
      target_variant_name: null,
      target_msku: payload.target_msku || null,
      target_key: targetKey,
      group_key: targetKey,
      task_mode: taskMode,
      root_task_id: null,
      merge_into_task_id: null,
      triggered_by: operatorId || this.getOperatorId(),
      idempotency_key: idempotencyKey,
      status: AI_LISTING_TASK_STATUS.QUEUED,
      stage: stageByStatus(AI_LISTING_TASK_STATUS.QUEUED),
      progress_percent: 0,
      timeline: [],
      score_attempt: 0,
      score_max_attempts: Math.max(
        1,
        Number(this.aiListingTaskConfig?.maxAttempts || 3)
      ),
      lang_attempt: 0,
      lang_max_attempts: Math.max(
        1,
        Number(this.aiListingTaskConfig?.maxAttempts || 3)
      ),
      started_at: new Date(),
      flow_context: {
        input: {
          candidate_id: Number(payload.target_candidate_id),
          amazon_account_id: payload.target_amazon_account_id || null,
          country_code: this.resolveCountryCode(payload.country_code),
          task_mode: taskMode,
          variant_ids: (payload.target_variant_ids || []).map(id =>
            String(id || '').trim()
          ),
          requested_languages: requestedLanguages,
          reference_source_type: referenceSourceType,
          manual_reference_bullets: manualReferenceBullets,
          manual_reference_notes: manualReferenceNotes,
          manual_reference_title: manualReferenceTitle,
        },
        language_status: languageStatus,
      },
    });
    await this.appendAiListingTimeline(row, {
      remark: '任务已创建并入队',
      status: AI_LISTING_TASK_STATUS.QUEUED,
      extra: {
        target_key: targetKey,
        task_mode: taskMode,
        requested_languages: requestedLanguages,
        reference_source_type: referenceSourceType,
      },
    });
    let saved = await this.aiListingTaskRepo.save(row);
    if (taskMode === 'full') {
      saved.root_task_id = saved.id;
      saved.merge_into_task_id = saved.id;
      saved = await this.aiListingTaskRepo.save(saved);
    }
    await this.aiListingTaskSchedulerService.enqueueAIListingGenerator(
      this.buildQueueDebugPayload(saved, 'generate', 'createAndDispatch')
    );
    return { reused: false, task: saved };
  }

  async createDemandMissingFailedTask(
    payload: AiListingTaskCreatePayload,
    options?: {
      operatorId?: string;
      remark?: string;
      last_error_message?: string;
      root_task_id?: number | null;
      merge_into_task_id?: number | null;
    }
  ) {
    const taskMode = payload.task_mode === 'delta' ? 'delta' : 'full';
    const targetKey = buildAiListingTaskTargetKey(payload);
    const idempotencyKey = buildAiListingTaskIdempotencyKey({
      ...payload,
      requested_languages: [],
    });
    const row = this.aiListingTaskRepo.create({
      task_type: payload.task_type,
      target_candidate_id: Number(payload.target_candidate_id),
      target_amazon_account_id: payload.target_amazon_account_id || null,
      target_variant_ids: (payload.target_variant_ids || []).map(id =>
        String(id || '').trim()
      ),
      target_variant_id: null,
      target_variant_name: null,
      target_msku: payload.target_msku || null,
      target_key: targetKey,
      group_key: targetKey,
      task_mode: taskMode,
      root_task_id:
        taskMode === 'delta' ? Number(options?.root_task_id || 0) || null : null,
      merge_into_task_id:
        taskMode === 'delta'
          ? Number(options?.merge_into_task_id || 0) || null
          : null,
      triggered_by: options?.operatorId || this.getOperatorId(),
      idempotency_key: idempotencyKey,
      status: AI_LISTING_TASK_STATUS.FAILED,
      stage: stageByStatus(AI_LISTING_TASK_STATUS.FAILED),
      progress_percent: 0,
      timeline: [],
      score_attempt: 0,
      score_max_attempts: Math.max(
        1,
        Number(this.aiListingTaskConfig?.maxAttempts || 3)
      ),
      lang_attempt: 0,
      lang_max_attempts: Math.max(
        1,
        Number(this.aiListingTaskConfig?.maxAttempts || 3)
      ),
      started_at: new Date(),
      finished_at: new Date(),
      last_error_code: 'PURCHASE_LANGUAGE_EMPTY',
      last_error_message:
        options?.last_error_message || '英德需求数均为0',
      failed_stage: 'dispatch',
      flow_context: {
        input: {
          candidate_id: Number(payload.target_candidate_id),
          amazon_account_id: payload.target_amazon_account_id || null,
          country_code: this.resolveCountryCode(payload.country_code),
          task_mode: taskMode,
          variant_ids: (payload.target_variant_ids || []).map(id =>
            String(id || '').trim()
          ),
          requested_languages: [],
          reference_source_type: 'competitor',
          manual_reference_bullets: [],
          manual_reference_notes: '',
          manual_reference_title: '',
        },
        language_status: buildInitialLanguageStatus([]),
      },
    });
    let saved = await this.aiListingTaskRepo.save(row);
    if (taskMode === 'full') {
      saved.root_task_id = saved.id;
      saved.merge_into_task_id = saved.id;
      saved = await this.aiListingTaskRepo.save(saved);
    }
    await this.appendAiListingTimeline(saved, {
      status: AI_LISTING_TASK_STATUS.FAILED,
      stage: stageByStatus(AI_LISTING_TASK_STATUS.FAILED),
      remark: options?.remark || '选做触发失败：英德需求数均为0',
      extra: {
        target_key: targetKey,
        task_mode: taskMode,
        requested_languages: [],
      },
    });
    return this.aiListingTaskRepo.save(saved);
  }

  private async getCoveredVariantIds(rootTask: AiListingTaskEntity) {
    const covered = new Set<string>();
    (rootTask.target_variant_ids || []).forEach(id => {
      const normalized = String(id || '').trim();
      if (normalized) covered.add(normalized);
    });
    const deltaTasks = await this.aiListingTaskRepo.find({
      where: {
        root_task_id: Number(rootTask.id),
        task_mode: 'delta' as any,
      } as any,
      order: { id: 'ASC' },
    });
    for (const task of deltaTasks) {
      (task.target_variant_ids || []).forEach(id => {
        const normalized = String(id || '').trim();
        if (normalized) covered.add(normalized);
      });
    }
    return covered;
  }

  private async mergeDeltaResultIntoRoot(task: AiListingTaskEntity) {
    const latestDeltaTask = await this.aiListingTaskRepo.findOne({
      where: { id: Number(task.id) },
    });
    if (!latestDeltaTask) return;
    if (String((latestDeltaTask as any).task_mode || 'full') !== 'delta')
      return;
    const mergeIntoTaskId = Number(
      (latestDeltaTask as any).merge_into_task_id || 0
    );
    if (!mergeIntoTaskId) return;
    const rootTask = await this.aiListingTaskRepo.findOne({
      where: { id: mergeIntoTaskId },
    });
    if (!rootTask) return;
    const rootVariantIds = new Set<string>(
      (rootTask.target_variant_ids || []).map(id => String(id || '').trim())
    );
    (latestDeltaTask.target_variant_ids || []).forEach(id => {
      const normalized = String(id || '').trim();
      if (normalized) rootVariantIds.add(normalized);
    });

    const rootLang = ((rootTask.langgraph_result || {}) as any) || {};
    const deltaLang = ((latestDeltaTask.langgraph_result || {}) as any) || {};
    const mergedLang = {
      ...rootLang,
      en: {
        ...(rootLang.en || {}),
        variant_titles: {
          ...((rootLang.en || {}).variant_titles || {}),
          ...((deltaLang.en || {}).variant_titles || {}),
        },
      },
      de: {
        ...(rootLang.de || {}),
        variant_titles: {
          ...((rootLang.de || {}).variant_titles || {}),
          ...((deltaLang.de || {}).variant_titles || {}),
        },
      },
      default_lang: rootLang.default_lang || deltaLang.default_lang || 'en',
    };

    // 把 delta 新生成的 markers 合并回主任务 flow_context.keyword_stage_by_lang，
    // 使后续 delta 在 extractVariantMarkersByAi 中能看到完整的兄弟变体 markers 作为参考。
    const rootFlowContext =
      ((rootTask.flow_context || {}) as Record<string, any>) || {};
    const deltaFlowContext =
      ((latestDeltaTask.flow_context || {}) as Record<string, any>) || {};
    const rootKeywordStageByLang = (rootFlowContext.keyword_stage_by_lang ||
      {}) as Record<string, any>;
    const deltaKeywordStageByLang = (deltaFlowContext.keyword_stage_by_lang ||
      {}) as Record<string, any>;
    const mergedKeywordStageByLang = { ...rootKeywordStageByLang } as Record<
      string,
      any
    >;
    for (const langKey of ['en', 'de'] as const) {
      const prev = rootKeywordStageByLang[langKey] || {};
      const next = deltaKeywordStageByLang[langKey] || {};
      const prevMarkers = Array.isArray(prev?.variant_marker?.markers)
        ? prev.variant_marker.markers
        : [];
      const nextMarkers = Array.isArray(next?.variant_marker?.markers)
        ? next.variant_marker.markers
        : [];
      if (!prevMarkers.length && !nextMarkers.length) continue;
      const dedup = new Map<string, any>();
      for (const m of [...prevMarkers, ...nextMarkers]) {
        const key = String(m?.variant_id || '').trim();
        if (!key) continue;
        dedup.set(key, m);
      }
      mergedKeywordStageByLang[langKey] = {
        ...prev,
        variant_marker: {
          ...(prev?.variant_marker || {}),
          markers: Array.from(dedup.values()),
        },
      };
    }
    const mergedRootFlowContext = {
      ...rootFlowContext,
      keyword_stage_by_lang: mergedKeywordStageByLang,
    };

    const timeline = Array.isArray(rootTask.timeline) ? rootTask.timeline : [];
    timeline.push({
      time: new Date().toISOString(),
      status: rootTask.status,
      stage: rootTask.stage,
      operator: this.getOperatorId(),
      remark: '增量变体结果已并入主任务',
      extra: {
        delta_task_id: latestDeltaTask.id,
        merged_variant_ids: latestDeltaTask.target_variant_ids || [],
      },
    });
    await this.aiListingTaskRepo.update(rootTask.id, {
      target_variant_ids: Array.from(rootVariantIds),
      langgraph_result: mergedLang,
      flow_context: mergedRootFlowContext,
      timeline,
    } as any);
  }

  async dispatchByPurchaserDecision(input: {
    candidate_id: number;
    amazon_account_id: string;
    variant_ids: string[];
    country_code?: string;
    requested_languages?: AiListingLang[];
    operator_id?: string;
  }) {
    const candidateId = Number(input.candidate_id);
    const amazonAccountId = String(input.amazon_account_id || '').trim();
    const variantIds = Array.from(
      new Set(
        (input.variant_ids || [])
          .map(id => String(id || '').trim())
          .filter(Boolean)
      )
    );
    if (!candidateId || !amazonAccountId || !variantIds.length) {
      return { skipped: true, reason: 'invalid_input' as const };
    }
    const countryCode = this.resolveCountryCode(input.country_code);
    const requestedLanguages = normalizeRequestedLanguages(
      input.requested_languages ?? ['en']
    );
    const fullPayload: AiListingTaskCreatePayload = {
      task_type: AI_LISTING_TASK_TYPE.SIMPLE_VARIANT,
      target_candidate_id: candidateId,
      target_amazon_account_id: amazonAccountId,
      country_code: countryCode,
      requested_languages: requestedLanguages,
      target_variant_ids: variantIds,
      task_mode: 'full',
      action: 'run',
    };
    const groupKey = buildAiListingTaskTargetKey(fullPayload);
    const rootTask = await this.aiListingTaskRepo
      .createQueryBuilder('t')
      .select([
        't.id',
        't.task_type',
        't.group_key',
        't.task_mode',
        't.target_variant_ids',
        't.status',
      ])
      .where('t.task_type = :taskType', {
        taskType: AI_LISTING_TASK_TYPE.SIMPLE_VARIANT,
      })
      .andWhere('t.group_key = :groupKey', { groupKey })
      .andWhere('t.task_mode = :taskMode', { taskMode: 'full' })
      .andWhere('t.status NOT IN (:...deadStatuses)', {
        deadStatuses: [
          AI_LISTING_TASK_STATUS.FAILED,
          AI_LISTING_TASK_STATUS.CANCELLED,
        ],
      })
      .orderBy('t.id', 'DESC')
      .limit(1)
      .getOne();
    if (!rootTask) {
      if (!requestedLanguages.length) {
        const failedTask = await this.createDemandMissingFailedTask(
          fullPayload,
          {
            operatorId: input.operator_id,
            remark: '选做触发失败：英德需求数均为0',
            last_error_message: '英德需求数均为0',
          }
        );
        return {
          skipped: false,
          mode: 'full' as const,
          taskId: failedTask.id,
          reused: false,
        };
      }
      const created = await this.createAndDispatch(
        fullPayload,
        input.operator_id
      );
      const createdTask = await this.loadTaskOrThrow(Number(created.task.id));
      await this.appendAiListingTimeline(createdTask, {
        remark: '选做触发：创建主任务(full)',
        extra: {
          dispatch_mode: 'full',
          group_key: groupKey,
          variant_ids: variantIds,
        },
      });
      await this.aiListingTaskRepo.save(createdTask);
      return {
        skipped: false,
        mode: 'full' as const,
        taskId: created.task.id,
        reused: created.reused,
      };
    }

    const covered = await this.getCoveredVariantIds(rootTask);
    const incrementVariants = variantIds.filter(id => !covered.has(id));
    if (!incrementVariants.length) {
      return {
        skipped: true,
        reason: 'no_increment_variants' as const,
        rootTaskId: rootTask.id,
      };
    }
    const deltaPayload: AiListingTaskCreatePayload = {
      task_type: AI_LISTING_TASK_TYPE.SIMPLE_VARIANT,
      target_candidate_id: candidateId,
      target_amazon_account_id: amazonAccountId,
      country_code: countryCode,
      requested_languages: requestedLanguages,
      target_variant_ids: incrementVariants,
      task_mode: 'delta',
      action: 'run',
    };
    if (!requestedLanguages.length) {
      const failedTask = await this.createDemandMissingFailedTask(deltaPayload, {
        operatorId: input.operator_id,
        remark: '选做触发失败：英德需求数均为0（追加任务）',
        last_error_message: '英德需求数均为0',
        root_task_id: Number(rootTask.id),
        merge_into_task_id: Number(rootTask.id),
      });
      return {
        skipped: false,
        mode: 'delta' as const,
        taskId: failedTask.id,
        reused: false,
      };
    }
    const delta = await this.createAndDispatch(deltaPayload, input.operator_id);
    await this.aiListingTaskRepo.update(delta.task.id, {
      root_task_id: Number(rootTask.id),
      merge_into_task_id: Number(rootTask.id),
    } as any);
    const deltaTask = await this.loadTaskOrThrow(Number(delta.task.id));
    await this.appendAiListingTimeline(deltaTask, {
      remark: '选做触发：创建追加任务(delta)',
      extra: {
        dispatch_mode: 'delta',
        group_key: groupKey,
        root_task_id: Number(rootTask.id),
        increment_variant_ids: incrementVariants,
      },
    });
    await this.aiListingTaskRepo.save(deltaTask);
    const refreshedRootTask = await this.loadTaskOrThrow(Number(rootTask.id));
    await this.appendAiListingTimeline(refreshedRootTask, {
      remark: '选做触发：接收到增量变体',
      extra: {
        source_delta_task_id: Number(delta.task.id),
        increment_variant_ids: incrementVariants,
      },
    });
    await this.aiListingTaskRepo.save(refreshedRootTask);
    return {
      skipped: false,
      mode: 'delta' as const,
      taskId: delta.task.id,
      reused: delta.reused,
      rootTaskId: rootTask.id,
      incrementVariants,
    };
  }

  private async loadTaskOrThrow(taskId: number): Promise<AiListingTaskEntity> {
    const task = await this.aiListingTaskRepo.findOne({
      where: { id: Number(taskId) },
    });
    if (!task) throw new Error('任务不存在');
    return task;
  }

  private async countCompetitorsForPreflight(
    candidateId: number,
    marketplace: string
  ): Promise<number> {
    return this.competitorRepo.count({
      where: {
        candidate_id: Number(candidateId),
        status: 2,
        marketplace,
      } as any,
    });
  }

  private async loadVariantsForPreflight(
    task: AiListingTaskEntity
  ): Promise<Array<{ id: string; name: string; description: string | null }>> {
    const variantIds = (task.target_variant_ids || [])
      .map(id => String(id || '').trim())
      .filter(Boolean);
    if (!variantIds.length) return [];
    const rows = await this.variantRepo.find({
      where: { id: In(variantIds) } as any,
      select: ['id', 'name', 'description', 'deleted_at'],
    });
    return rows
      .filter(row => !row.deleted_at)
      .map(row => ({
        id: String(row.id || '').trim(),
        name: String(row.name || ''),
        description: row.description ?? null,
      }));
  }

  private getPreflightForceLowKeywords(task: AiListingTaskEntity): boolean {
    return Boolean((task.flow_context as any)?.preflight?.force_low_keywords);
  }

  private async collectPreflightInput(
    task: AiListingTaskEntity,
    options: { mode: 'full' | 'delta' }
  ) {
    const variantIds = (task.target_variant_ids || [])
      .map(id => String(id || '').trim())
      .filter(Boolean);
    const variants = await this.loadVariantsForPreflight(task);
    const referenceSourceType = this.resolveReferenceSourceTypeFromTask(task);
    const manualReferenceBullets = this.getManualReferenceBulletsFromTask(task);

    if (options.mode === 'delta') {
      return {
        ukKeywordCount: 0,
        deKeywordCount: 0,
        ukCompetitorCount: 0,
        deCompetitorCount: 0,
        variantIds,
        variants,
        referenceSourceType,
        manualReferenceBullets,
      };
    }

    const candidate = await this.candidateRepo.findOne({
      where: { id: task.target_candidate_id },
      select: ['id', 'asin', 'sku'],
    });
    const asin = String(candidate?.asin || '').trim();
    const sku = String(candidate?.sku || '').trim();
    const amazonAccountId = String(task.target_amazon_account_id || '').trim();
    const keywordTake = AI_LISTING_PREFLIGHT_MIN_KEYWORDS;
    const required = this.resolvePreflightRequiredLanguages(task);
    const needEn = required.includes('en');
    const needDe = required.includes('de');

    const [ukKeywords, deKeywords, ukCompetitorCount, deCompetitorCount] =
      await Promise.all([
        needEn
          ? this.loadKeywordsForGoResearch({
              asin,
              countryCode: 'uk',
              sku,
              amazonAccountId,
              take: keywordTake,
            })
          : Promise.resolve([]),
        needDe
          ? this.loadKeywordsForGoResearch({
              asin,
              countryCode: 'de',
              sku,
              amazonAccountId,
              take: keywordTake,
            })
          : Promise.resolve([]),
        needEn
          ? this.countCompetitorsForPreflight(
              task.target_candidate_id,
              this.countryCodeToKeywordMarketplace('uk')
            )
          : Promise.resolve(0),
        needDe
          ? this.countCompetitorsForPreflight(
              task.target_candidate_id,
              this.countryCodeToKeywordMarketplace('de')
            )
          : Promise.resolve(0),
      ]);

    return {
      ukKeywordCount: ukKeywords.length,
      deKeywordCount: deKeywords.length,
      ukCompetitorCount,
      deCompetitorCount,
      variantIds,
      variants,
      referenceSourceType,
      manualReferenceBullets,
    };
  }

  async getPreflightParams(taskId: number) {
    const task = await this.loadTaskOrThrow(taskId);
    const mode =
      String((task as any).task_mode || 'full') === 'delta' ? 'delta' : 'full';
    const candidate = await this.candidateRepo.findOne({
      where: { id: task.target_candidate_id },
      select: ['id', 'asin', 'sku', 'produce_name', 'marketplace'] as any,
    } as any);
    const asin = String(candidate?.asin || '').trim();
    const sku = String(candidate?.sku || '').trim();
    const amazonAccountId = String(task.target_amazon_account_id || '').trim();
    const variantIds = Array.isArray(task.target_variant_ids)
      ? task.target_variant_ids
          .map(id => String(id || '').trim())
          .filter(Boolean)
      : [];

    const [
      preflightInput,
      ukKeywords,
      deKeywords,
      ukCompetitors,
      deCompetitors,
      variants,
      shopRequiredLanguages,
    ] = await Promise.all([
      this.collectPreflightInput(task, { mode: mode as any }),
      this.loadKeywordsForGoResearch({
        asin,
        countryCode: 'uk',
        sku,
        amazonAccountId,
        take: 500,
      }),
      this.loadKeywordsForGoResearch({
        asin,
        countryCode: 'de',
        sku,
        amazonAccountId,
        take: 500,
      }),
      this.competitorRepo.find({
        where: {
          candidate_id: Number(task.target_candidate_id),
          status: 2,
          marketplace: this.countryCodeToKeywordMarketplace('uk'),
        } as any,
        order: { Main_monthly_sales: 'DESC' as any, id: 'ASC' as any },
        take: 50,
      }),
      this.competitorRepo.find({
        where: {
          candidate_id: Number(task.target_candidate_id),
          status: 2,
          marketplace: this.countryCodeToKeywordMarketplace('de'),
        } as any,
        order: { Main_monthly_sales: 'DESC' as any, id: 'ASC' as any },
        take: 50,
      }),
      variantIds.length
        ? this.variantRepo.find({
            where: { id: In(variantIds) } as any,
            select: [
              'id',
              'candidate_id',
              'name',
              'description',
              'uk_title',
              'de_title',
              'image_url',
              'sku',
              'deleted_at',
            ] as any,
          } as any)
        : Promise.resolve([]),
      this.resolveShopRequiredLanguagesForTask(task),
    ]);
    const taskRequestedLanguages = this.resolvePreflightRequiredLanguages(task);
    const preflightScope =
      shopRequiredLanguages.length > 0
        ? shopRequiredLanguages
        : taskRequestedLanguages;
    const forceLowKeywords =
      mode === 'full' && this.getPreflightForceLowKeywords(task);
    const validation = validateAiListingPreflight(preflightInput, {
      mode: mode as any,
      forceLowKeywords,
      requiredLanguages: preflightScope,
    });
    const keywordDto = (row: any) => ({
      id: Number(row?.id || 0),
      value: String(row?.value || ''),
      value_cn: String(row?.value_cn || ''),
      keyword_type: String(row?.keyword_type || ''),
      marketplaces: String(row?.marketplaces || ''),
      asin: String(row?.asin || ''),
      task_asin: String(row?.task_asin || ''),
      seller_sku: String(row?.seller_sku || ''),
      search_volume_monthly: Number(
        row?.search_volume_monthly ?? row?.sif_search_volume_monthly ?? 0
      ),
      sif_search_volume_monthly: Number(row?.sif_search_volume_monthly || 0),
      sif_score: row?.sif_score != null ? Number(row.sif_score) : null,
      score1: row?.score1 != null ? Number(row.score1) : null,
      score2: row?.score2 != null ? Number(row.score2) : null,
      status: row?.status != null ? Number(row.status) : null,
    });
    const competitorDto = (row: any) => ({
      id: Number(row?.id || 0),
      asin: String(row?.asin_competitor || ''),
      marketplace: String(row?.marketplace || ''),
      title: String(row?.item_name || ''),
      image_url: String(row?.image_url || row?.img1 || ''),
      bullet_points: this.normalizeCompetitorBulletPoints(row?.bullet_points),
      monthly_sales: Number(row?.Main_monthly_sales || 0),
      price: String(row?.price || ''),
      review_num: row?.review_num != null ? Number(row.review_num) : null,
      last_star: row?.last_star != null ? Number(row.last_star) : null,
      bsr_rank: row?.bsr_rank != null ? Number(row.bsr_rank) : null,
    });
    const variantMap = new Map(
      (variants || []).map((row: any) => [String(row.id || '').trim(), row])
    );
    const flowInput = this.getTaskFlowContext(task).input || {};
    const referenceSourceType =
      preflightInput.referenceSourceType || 'competitor';
    const manualReferenceBullets =
      preflightInput.manualReferenceBullets ||
      this.getManualReferenceBulletsFromInput(flowInput);
    const manualReferenceNotes =
      this.getManualReferenceNotesFromInput(flowInput);
    const manualReferenceTitle =
      this.getManualReferenceTitleFromInput(flowInput);
    const referenceCompetitorAsins =
      this.getReferenceCompetitorAsinsFromTask(task);

    return {
      task: {
        id: task.id,
        mode,
        candidate_id: task.target_candidate_id,
        amazon_account_id: task.target_amazon_account_id || '',
        variant_ids: variantIds,
        reference_source_type: referenceSourceType,
      },
      candidate: {
        id: Number(candidate?.id || 0),
        asin,
        sku,
        produce_name: String(candidate?.produce_name || ''),
        marketplace: String(candidate?.marketplace || ''),
      },
      validation,
      /** 与列表「语言」列一致（店铺采购） */
      required_languages: shopRequiredLanguages,
      /** 任务 flow_context 已提交/将执行的语言范围 */
      task_requested_languages: taskRequestedLanguages,
      preflight_scope: preflightScope,
      preflight: {
        force_low_keywords: forceLowKeywords,
      },
      reference_input: {
        reference_source_type: referenceSourceType,
        manual_reference_bullets: manualReferenceBullets,
        manual_reference_notes: manualReferenceNotes,
        manual_reference_title: manualReferenceTitle,
        reference_competitor_asins: referenceCompetitorAsins,
      },
      details:
        validation.ok === false
          ? validation.details
          : {
              mode,
              force_low_keywords: forceLowKeywords,
              required_languages: preflightScope,
              issues: [],
              uk_keyword_count: preflightInput.ukKeywordCount,
              de_keyword_count: preflightInput.deKeywordCount,
              uk_competitor_count: preflightInput.ukCompetitorCount,
              de_competitor_count: preflightInput.deCompetitorCount,
              variant_ids: variantIds,
              reference_source_type: referenceSourceType,
              manual_reference_bullets: manualReferenceBullets,
            },
      keywords: {
        en: (ukKeywords || []).map(keywordDto),
        de: (deKeywords || []).map(keywordDto),
      },
      competitors: {
        uk: (ukCompetitors || []).map(competitorDto),
        de: (deCompetitors || []).map(competitorDto),
      },
      variants: variantIds.map(id => {
        const row: any = variantMap.get(id);
        return {
          id,
          exists: Boolean(row),
          deleted: Boolean(row?.deleted_at),
          name: String(row?.name || ''),
          description: String(row?.description || ''),
          uk_title: String(row?.uk_title || ''),
          de_title: String(row?.de_title || ''),
          image_url: String(row?.image_url || ''),
          sku: String(row?.sku || ''),
        };
      }),
    };
  }

  async updatePreflightVariants(
    taskId: number,
    variants: Array<{ id?: string; name?: string; description?: string }>
  ) {
    const task = await this.loadTaskOrThrow(taskId);
    const allowedIds = new Set(
      (Array.isArray(task.target_variant_ids) ? task.target_variant_ids : [])
        .map(id => String(id || '').trim())
        .filter(Boolean)
    );
    if (!allowedIds.size) throw new Error('当前任务未指定变体');

    const normalized = (variants || [])
      .map(row => ({
        id: String(row?.id || '').trim(),
        name: String(row?.name || '').trim(),
        description: String(row?.description || '').trim(),
      }))
      .filter(row => row.id);
    if (!normalized.length) throw new Error('没有可保存的变体数据');

    for (const row of normalized) {
      if (!allowedIds.has(row.id)) {
        throw new Error(`变体 ${row.id} 不属于当前任务`);
      }
      if (!row.name) throw new Error(`变体 ${row.id} 缺少名称`);
      if (!row.description) throw new Error(`变体 ${row.id} 缺少描述`);
    }

    const existing = await this.variantRepo.find({
      where: {
        id: In(normalized.map(row => row.id)),
        candidate_id: Number(task.target_candidate_id),
      } as any,
      select: ['id', 'deleted_at'] as any,
    } as any);
    const existingMap = new Map(
      (existing || []).map(row => [String(row.id || '').trim(), row])
    );
    for (const row of normalized) {
      const current: any = existingMap.get(row.id);
      if (!current) throw new Error(`变体 ${row.id} 不存在`);
      if (current.deleted_at) throw new Error(`变体 ${row.id} 已删除`);
    }

    await Promise.all(
      normalized.map(row =>
        this.variantRepo.update(
          { id: row.id, candidate_id: Number(task.target_candidate_id) } as any,
          {
            name: row.name,
            description: row.description,
          } as any
        )
      )
    );
    const refreshed = await this.loadTaskOrThrow(task.id);
    await this.appendAiListingTimeline(refreshed, {
      remark: '补充参数：更新变体名称/描述',
      extra: {
        variant_ids: normalized.map(row => row.id),
      },
    });
    await this.aiListingTaskRepo.save(refreshed);
    return this.getPreflightParams(task.id);
  }

  async updatePreflightReferenceInput(
    taskId: number,
    payload: {
      reference_source_type?: AiListingReferenceSourceType;
      manual_reference_bullets?: string[];
      manual_reference_notes?: string;
      manual_reference_title?: string;
      reference_competitor_asins?: ReferenceCompetitorAsinsByCountryInput;
    }
  ) {
    const task = await this.loadTaskOrThrow(taskId);
    const prevFlow = this.getTaskFlowContext(task);
    const prevInput = (prevFlow.input || {}) as Record<string, any>;
    const referenceSourceType = normalizeReferenceSourceType(
      payload.reference_source_type ?? prevInput.reference_source_type
    );
    const manualReferenceBullets =
      referenceSourceType === 'manual_bullets'
        ? normalizeManualReferenceBullets(
            payload.manual_reference_bullets ??
              prevInput.manual_reference_bullets
          )
        : [];
    const manualReferenceNotes = String(
      payload.manual_reference_notes ?? prevInput.manual_reference_notes ?? ''
    ).trim();
    const manualReferenceTitle = String(
      payload.manual_reference_title ?? prevInput.manual_reference_title ?? ''
    ).trim();
    const referenceCompetitorAsins = normalizeReferenceCompetitorAsinsByCountry(
      payload.reference_competitor_asins ?? prevInput.reference_competitor_asins
    );
    const flow_context = {
      ...prevFlow,
      input: {
        ...prevInput,
        reference_source_type: referenceSourceType,
        manual_reference_bullets: manualReferenceBullets,
        manual_reference_notes: manualReferenceNotes,
        manual_reference_title: manualReferenceTitle,
        reference_competitor_asins: referenceCompetitorAsins,
      },
    };
    await this.aiListingTaskRepo.update(taskId, { flow_context } as any);
    const refreshed = await this.loadTaskOrThrow(taskId);
    await this.appendAiListingTimeline(refreshed, {
      remark:
        referenceSourceType === 'manual_bullets'
          ? '补充参数：切换为人工卖点模式'
          : '补充参数：切换为竞品模式',
      extra: {
        reference_source_type: referenceSourceType,
        manual_bullet_count: manualReferenceBullets.filter(Boolean).length,
      },
    });
    await this.aiListingTaskRepo.save(refreshed);
    return this.getPreflightParams(taskId);
  }

  async addPreflightCompetitorByAsin(
    taskId: number,
    countryCode: string,
    asinInput: string
  ) {
    const task = await this.loadTaskOrThrow(taskId);
    const country = this.resolveCountryCode(countryCode);
    if (country !== 'uk' && country !== 'de') {
      throw new Error('仅支持英国(uk)或德国(de)站点');
    }
    const asin = String(asinInput || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!asin) throw new Error('请输入 ASIN');
    if (asin.length !== 10) {
      throw new Error('ASIN 格式不正确（应为 10 位字母数字）');
    }

    const candidate = await this.candidateRepo.findOne({
      where: { id: task.target_candidate_id },
      select: ['id', 'asin'] as any,
    } as any);
    if (!candidate?.id) throw new Error('选品不存在');

    const marketplace = this.countryCodeToKeywordMarketplace(country);
    const siteLabel = country === 'de' ? '德国' : '英国';

    const existing = await this.competitorRepo.findOne({
      where: {
        candidate_id: Number(task.target_candidate_id),
        asin_competitor: asin,
        marketplace,
      } as any,
    });
    if (existing?.id) {
      throw new Error(
        `${siteLabel}站竞品 ASIN ${asin} 已存在，请输入其他竞品 ASIN`
      );
    }

    let productInfo: Awaited<
      ReturnType<OxylabsService['getProductInfo']>
    >;
    try {
      productInfo = await this.oxylabsService.getProductInfo(
        marketplace,
        asin,
        'aiListing.preflight.addCompetitor'
      );
    } catch (err: any) {
      throw new Error(err?.message || '查询商品信息失败，请稍后重试');
    }

    const title = String(productInfo?.title || '').trim();
    const bullets = String(productInfo?.bullet_points || '').trim();
    if (!title && !bullets) {
      throw new Error(
        `${siteLabel}站未找到该 ASIN（${asin}），请再次确认 ASIN 是否正确且在该站点有在售商品`
      );
    }

    const payload: Partial<AppAmzBsrCandidateCompetitorEntity> = {
      candidate_id: Number(task.target_candidate_id),
      asin_candidate: String(candidate.asin || '').trim() || null,
      asin_competitor: asin,
      marketplace,
      item_name: title || null,
      bullet_points: bullets || null,
      image_url: productInfo?.image_url || null,
      price:
        productInfo?.price != null ? String(productInfo.price) : null,
      review_num:
        productInfo?.reviews != null ? Number(productInfo.reviews) : null,
      last_star:
        productInfo?.stars != null ? Number(productInfo.stars) : null,
      bsr_html: productInfo?.bsr_html || null,
      dispatches_from: productInfo?.dispatches_from || null,
      sold_by: productInfo?.sold_by || null,
      weight: productInfo?.weight || null,
      dimensions: productInfo?.dimensions || null,
      status: 2,
      spider_time: new Date(),
    };

    await this.competitorRepo.insert(payload as any);

    const refreshed = await this.loadTaskOrThrow(task.id);
    await this.appendAiListingTimeline(refreshed, {
      remark: `补充参数：${siteLabel}站添加竞品 ${asin}`,
      extra: { country_code: country, asin, action: 'inserted' },
    });
    await this.aiListingTaskRepo.save(refreshed);
    return this.getPreflightParams(task.id);
  }

  async refreshPreflightCompetitorData(taskId: number, competitorId: number) {
    const task = await this.loadTaskOrThrow(taskId);
    const competitor = await this.competitorRepo.findOne({
      where: { id: Number(competitorId) } as any,
    } as any);
    if (!competitor?.id) {
      throw new Error('竞品不存在');
    }
    if (Number(competitor.candidate_id) !== Number(task.target_candidate_id)) {
      throw new Error('竞品不属于当前选品');
    }

    const asin = String(competitor.asin_competitor || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '');
    if (!asin) {
      throw new Error('竞品 ASIN 缺失');
    }

    const marketplace = String(competitor.marketplace || '').trim();
    const siteLabel = marketplace === '德国' ? '德国' : '英国';
    const imageUrl = String(
      competitor.image_url || (competitor as any).img1 || ''
    ).trim();
    const bullets = this.normalizeCompetitorBulletPoints(competitor.bullet_points);
    const needsImage = !imageUrl;
    const needsBullets = bullets.length === 0;

    if (!needsImage && !needsBullets) {
      return {
        ...(await this.getPreflightParams(taskId)),
        supplement_result: {
          skipped: true,
          message: '主图与卖点均已存在',
        },
      };
    }

    let productInfo: Awaited<ReturnType<OxylabsService['getProductInfo']>>;
    try {
      productInfo = await this.oxylabsService.getProductInfo(
        marketplace,
        asin,
        'aiListing.preflight.refreshCompetitor'
      );
    } catch (err: any) {
      throw new Error(err?.message || '查询商品信息失败，请稍后重试');
    }

    const patch: Record<string, any> = { spider_time: new Date() };
    const updatedFields: string[] = [];
    const newTitle = String(productInfo?.title || '').trim();
    const newBullets = String(productInfo?.bullet_points || '').trim();
    const newImage = String(productInfo?.image_url || '').trim();

    if (needsImage && newImage) {
      patch.image_url = newImage;
      updatedFields.push('主图');
    }
    if (needsBullets && newBullets) {
      patch.bullet_points = newBullets;
      updatedFields.push('卖点');
    }
    if (!String(competitor.item_name || '').trim() && newTitle) {
      patch.item_name = newTitle;
      updatedFields.push('标题');
    }
    if (productInfo?.price != null && !String(competitor.price || '').trim()) {
      patch.price = String(productInfo.price);
    }
    if (productInfo?.reviews != null && competitor.review_num == null) {
      patch.review_num = Number(productInfo.reviews);
    }
    if (productInfo?.stars != null && competitor.last_star == null) {
      patch.last_star = Number(productInfo.stars);
    }

    if (!updatedFields.length) {
      throw new Error(
        `${siteLabel}站未能补充缺失的主图或卖点，请确认 ASIN 在该站点有在售商品`
      );
    }

    await this.competitorRepo.update(competitor.id, patch as any);

    const refreshed = await this.loadTaskOrThrow(task.id);
    await this.appendAiListingTimeline(refreshed, {
      remark: `补充参数：${siteLabel}站竞品 ${asin} 补全${updatedFields.join('、')}`,
      extra: {
        competitor_id: competitor.id,
        asin,
        updated_fields: updatedFields,
        action: 'supplement',
      },
    });
    await this.aiListingTaskRepo.save(refreshed);

    return {
      ...(await this.getPreflightParams(taskId)),
      supplement_result: {
        skipped: false,
        message: `已补充${updatedFields.join('、')}`,
        updated_fields: updatedFields,
      },
    };
  }

  /** @returns true 表示已失败并终止后续流水线 */
  private async ensurePreflightPassed(
    taskId: number,
    options: { mode: 'full' | 'delta' }
  ): Promise<boolean> {
    const task = await this.loadTaskOrThrow(taskId);
    if (
      task.status === AI_LISTING_TASK_STATUS.SUCCEEDED ||
      task.status === AI_LISTING_TASK_STATUS.CANCELLED
    ) {
      return true;
    }
    if (task.status === AI_LISTING_TASK_STATUS.FAILED) {
      return true;
    }

    const input = await this.collectPreflightInput(task, options);
    const preflightScope = this.resolvePreflightRequiredLanguages(task);
    const forceLowKeywords =
      options.mode === 'full' && this.getPreflightForceLowKeywords(task);
    const result = validateAiListingPreflight(input, {
      mode: options.mode,
      forceLowKeywords,
      requiredLanguages: preflightScope,
    });
    if (result.ok === false) {
      await this.transition(task.id, AI_LISTING_TASK_STATUS.FAILED, {
        remark: '前置校验失败',
        progress_percent: 100,
        finished_at: new Date(),
        failed_stage: 'preflight',
        last_error_code: 'PREFLIGHT_FAILED',
        last_error_message: result.message,
        extra: result.details,
      });
      return true;
    }
    return false;
  }

  private async runGoScoring(task: AiListingTaskEntity) {
    const candidate = await this.candidateRepo.findOne({
      where: { id: task.target_candidate_id },
    });
    const countryCode = this.getTaskCountryCode(task);
    const marketplace = this.countryCodeToGoMarketplace(countryCode);
    const asin = (candidate?.asin || '').trim();
    const imageTargetKey = asin || String(task.target_key || '').trim();
    const keywords = await this.loadKeywordsForGoResearch({
      asin,
      countryCode,
      sku: candidate?.sku || '',
      amazonAccountId: task.target_amazon_account_id || '',
      take: 400,
    });
    const submitPayload = {
      target_key: task.target_key,
      marketplace,
      reference_titles: [candidate?.item_name, candidate?.produce_name].filter(
        Boolean
      ) as string[],
      keywords: keywords.map(k => ({
        value: k.value,
        traffic_score: k.search_volume_monthly || undefined,
      })),
      options: {
        keyword_concurrency: 8,
        image_concurrency: 6,
      },
    };
    const submit = await this.keywordResearchGoClientService.submitTask(
      submitPayload
    );
    const goTaskId = submit.taskId;
    await this.aiListingTaskRepo.update(task.id, { go_task_id: goTaskId });

    const pollIntervalMs = Math.max(
      1_000,
      Number(this.keywordResearchGoConfig?.pollIntervalMs || 2_000)
    );
    for (;;) {
      const statusRes = await this.keywordResearchGoClientService.getTask(
        goTaskId
      );
      if (statusRes.status === 'finished') {
        return {
          goTaskId,
          result: await this.keywordResearchGoClientService.getTaskResult(
            goTaskId
          ),
        };
      }
      if (statusRes.status === 'failed') {
        throw new Error(statusRes.errorMessage || 'Go关键词评分任务失败');
      }
      await this.sleep(pollIntervalMs);
    }
  }

  private async loadKeywordsForGoResearch(input: {
    asin: string;
    countryCode?: string;
    sku?: string;
    amazonAccountId?: string;
    take?: number;
  }) {
    const asin = String(input.asin || '').trim();
    const countryCode = this.resolveCountryCode(input.countryCode);
    const marketplace = this.countryCodeToKeywordMarketplace(countryCode);
    const sku = String(input.sku || '').trim();
    const sid = Number(input.amazonAccountId || 0);
    const take = Math.max(1, Number(input.take || 400));

    // 对齐关键词管理的数据源：app_amz_listing_keyword
    // 主口径按 asin/task_asin + marketplaces；sid 仅作弱约束（不再硬卡）。
    const qb = this.keywordRepo.createQueryBuilder('k').where('1=1');
    if (asin) {
      qb.andWhere('(k.asin = :asin OR k.task_asin = :asin)', { asin });
    }
    if (marketplace) {
      qb.andWhere(
        "(k.marketplaces = :marketplace OR k.marketplaces IS NULL OR k.marketplaces = '')",
        {
          marketplace,
        }
      );
    }
    qb.orderBy('k.sif_score', 'DESC')
      .addOrderBy('k.search_volume_monthly', 'DESC')
      .addOrderBy('k.id', 'DESC')
      .take(take);
    let list = await qb.getMany();

    // fallback1: 如果 account 维度有数据，用 sid 再补一轮（非强制）
    if (!list.length && asin && sid > 0) {
      list = await this.keywordRepo.find({
        where: [
          { asin, sid },
          { task_asin: asin, sid },
        ] as any,
        take,
        order: { id: 'DESC' as any },
      });
    }

    // fallback2: 再按 sku/seller_sku 拉一次，防止 asin 口径缺失
    if (!list.length && sku) {
      list = await this.keywordRepo.find({
        where: [{ seller_sku: sku }] as any,
        take,
        order: { id: 'DESC' as any },
      });
    }
    return list;
  }

  /**
   * 按 parent_asin（空则 asin_competitor）在库内去重，每组保留销量最高一条，再取 Top N。
   */
  private async findTopCompetitorsDedupedByParent(args: {
    candidateId: number;
    marketplace: string;
    limit: number;
  }): Promise<AppAmzBsrCandidateCompetitorEntity[]> {
    const sql = `
      SELECT ranked.* FROM (
        SELECT
          comp.*,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(NULLIF(TRIM(comp.parent_asin), ''), comp.asin_competitor)
            ORDER BY CAST(IFNULL(comp.Main_monthly_sales, 0) AS UNSIGNED) DESC, comp.id ASC
          ) AS dedupe_rn
        FROM app_amz_bsr_candidate_competitor comp
        WHERE comp.candidate_id = ?
          AND comp.status = 2
          AND comp.marketplace = ?
      ) ranked
      WHERE ranked.dedupe_rn = 1
      ORDER BY CAST(IFNULL(ranked.Main_monthly_sales, 0) AS UNSIGNED) DESC, ranked.id ASC
      LIMIT ?
    `;
    return this.competitorRepo.query(sql, [
      args.candidateId,
      args.marketplace,
      args.limit,
    ]);
  }

  private async loadSelectedCompetitorsForResearch(
    task: AiListingTaskEntity,
    asins: string[],
    marketplace: string
  ): Promise<AppAmzBsrCandidateCompetitorEntity[]> {
    const list = normalizeReferenceCompetitorAsins(asins);
    if (!list.length) return [];
    const rows = await this.competitorRepo.find({
      where: {
        candidate_id: Number(task.target_candidate_id),
        status: 2,
        marketplace,
        asin_competitor: In(list),
      } as any,
    });
    const map = new Map(
      (rows || []).map(row => [
        String(row.asin_competitor || '')
          .trim()
          .toUpperCase(),
        row,
      ])
    );
    return list
      .map(asin => map.get(asin))
      .filter(Boolean) as AppAmzBsrCandidateCompetitorEntity[];
  }

  private async enrichCompetitorRowsForResearch(
    rows: AppAmzBsrCandidateCompetitorEntity[]
  ): Promise<Array<Record<string, any>>> {
    const top4: Array<Record<string, any>> = [];
    for (const row of rows || []) {
      let title = String((row as any).item_name || '').trim();
      let bullets = String((row as any).bullet_points || '').trim();
      if (!title || !bullets) {
        try {
          const productInfo = await this.oxylabsService.getProductInfo(
            String((row as any).marketplace || 'us'),
            String((row as any).asin_competitor || ''),
            'aiListing.keywordResearch.competitorFill'
          );
          title = title || String(productInfo?.title || '').trim();
          bullets = bullets || String(productInfo?.bullet_points || '').trim();
          const imageUrl = String(
            (row as any).image_url || productInfo?.image_url || ''
          ).trim();
          await this.competitorRepo.update((row as any).id, {
            item_name: title || (row as any).item_name || null,
            bullet_points: bullets || (row as any).bullet_points || null,
            ...(imageUrl ? { image_url: imageUrl } : {}),
          } as any);
        } catch {}
      }
      top4.push({
        id: (row as any).id,
        asin: String((row as any).asin_competitor || ''),
        marketplace: String((row as any).marketplace || ''),
        monthly_sales: Number((row as any).Main_monthly_sales || 0),
        title,
        bullet_points: bullets,
      });
    }
    return top4;
  }

  private pickChosenBestCompetitor(
    rows: Array<Record<string, any>>
  ): Record<string, any> | null {
    if (!rows.length) return null;
    return [...rows].sort((a, b) => {
      const salesDiff =
        Number(b.monthly_sales || 0) - Number(a.monthly_sales || 0);
      if (salesDiff !== 0) return salesDiff;
      return Number(a.id || 0) - Number(b.id || 0);
    })[0];
  }

  private async pickCompetitorsForKeywordResearch(task: AiListingTaskEntity) {
    if (this.resolveReferenceSourceTypeFromTask(task) === 'manual_bullets') {
      return {
        top4: [],
        chosen_best: null,
      };
    }
    const marketplace = this.countryCodeToKeywordMarketplace(
      this.getTaskCountryCode(task)
    );
    const selection = this.getReferenceCompetitorAsinsFromTask(task);
    const selectedAsins =
      marketplace === '德国' ? selection.de : selection.uk;
    const rows = selectedAsins.length
      ? await this.loadSelectedCompetitorsForResearch(
          task,
          selectedAsins,
          marketplace
        )
      : await this.findTopCompetitorsDedupedByParent({
          candidateId: Number(task.target_candidate_id),
          marketplace,
          limit: 4,
        });
    const top4 = await this.enrichCompetitorRowsForResearch(rows);
    return {
      top4,
      chosen_best: this.pickChosenBestCompetitor(top4),
    };
  }

  private async runGoResearchWithCompetitor(
    task: AiListingTaskEntity,
    competitorPick: Record<string, any>
  ) {
    const candidate = await this.candidateRepo.findOne({
      where: { id: task.target_candidate_id },
    });
    const countryCode = this.getTaskCountryCode(task);
    const marketplace = this.countryCodeToGoMarketplace(countryCode);
    const asin = (candidate?.asin || '').trim();
    const imageTargetKey = asin || String(task.target_key || '').trim();
    const keywords = await this.loadKeywordsForGoResearch({
      asin,
      countryCode,
      sku: candidate?.sku || '',
      amazonAccountId: task.target_amazon_account_id || '',
      take: 400,
    });
    const bestTitle =
      String(competitorPick?.chosen_best?.title || '').trim() ||
      String(candidate?.item_name || candidate?.produce_name || '').trim();
    const keywordSearchVolumeMap = keywords.reduce((acc, item: any) => {
      mergeKeywordSearchVolume(
        acc,
        String(item?.value || ''),
        item?.search_volume_monthly ??
          item?.sif_search_volume_monthly ??
          item?.search_volume ??
          0
      );
      return acc;
    }, {} as Record<string, number>);
    const submitPayload = {
      target_key: imageTargetKey,
      marketplace,
      reference_titles: [bestTitle].filter(Boolean) as string[],
      keywords: keywords.map(k => ({
        value: k.value,
        traffic_score:
          (k as any).search_volume_monthly ??
          (k as any).sif_search_volume_monthly ??
          undefined,
      })),
      options: {
        keyword_concurrency: 8,
        image_concurrency: 6,
      },
    };
    const submit = await this.keywordResearchGoClientService.submitTask(
      submitPayload
    );
    const goTaskId = submit.taskId;
    await this.aiListingTaskRepo.update(task.id, { go_task_id: goTaskId });
    const pollIntervalMs = Math.max(
      1_000,
      Number(this.keywordResearchGoConfig?.pollIntervalMs || 2_000)
    );
    for (;;) {
      const statusRes = await this.keywordResearchGoClientService.getTask(
        goTaskId
      );
      if (statusRes.status === 'finished') {
        return {
          go_task_id: goTaskId,
          status: statusRes.status,
          image_target_key: imageTargetKey,
          keyword_search_volume_map: keywordSearchVolumeMap,
          result: await this.keywordResearchGoClientService.getTaskResult(
            goTaskId
          ),
        };
      }
      if (statusRes.status === 'failed') {
        throw new Error(statusRes.errorMessage || 'Go关键词评分任务失败');
      }
      await this.sleep(pollIntervalMs);
    }
  }

  private async selectKeywordsByAi(
    task: AiListingTaskEntity,
    goResearch: Record<string, any>
  ) {
    const llm = getLlmByUser(this.getOperatorId());
    const candidate = await this.candidateRepo.findOne({
      where: { id: task.target_candidate_id },
      select: [
        'id',
        'item_name',
        'produce_name',
        'image_url',
        'image_url2',
        'image_url3',
        'image_url4',
        'image_url5',
        'image_url6',
      ],
    } as any);
    const variants = await this.variantRepo.find({
      where: { candidate_id: Number(task.target_candidate_id) } as any,
      select: ['id', 'name', 'description', 'uk_title', 'de_title'] as any,
      take: 50,
    } as any);
    const rawKeywords =
      goResearch?.result?.results ||
      goResearch?.result?.result?.keywords ||
      goResearch?.result?.keywords ||
      goResearch?.result?.data?.keywords ||
      [];
    const scored = (Array.isArray(rawKeywords) ? rawKeywords : [])
      .map((k: any) => {
        const imageScore =
          Number(k?.score1 ?? k?.image_relevance_score ?? 0) || 0;
        const titleScore =
          Number(k?.score2 ?? k?.title_relevance_score ?? 0) || 0;
        const totalScore =
          Number(
            k?.total_score ??
              k?.total_relevance_score ??
              k?.comprehensive_score ??
              k?.score ??
              k?.traffic_score ??
              k?.search_volume ??
              0
          ) || 0;
        return {
          keyword: String(k?.keyword || k?.value || '').trim(),
          image_relevance_score: imageScore,
          title_relevance_score: titleScore,
          total_relevance_score: totalScore,
          score: totalScore,
          raw: k,
        };
      })
      .filter((x: any) => x.keyword)
      .sort((a: any, b: any) => b.score - a.score);
    const dbSearchVolumeMap = (goResearch?.keyword_search_volume_map ||
      {}) as Record<string, number>;
    const scoredWithVolume = scored.map((x: any) => ({
      ...x,
      search_volume: Number(
        dbSearchVolumeMap[
          this.normalizeKeywordLookupKey(String(x?.keyword || ''))
        ] || 0
      ),
    }));
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        '你是电商选词审核专家。请判断关键词是否与产品不一致，给出理由。输出 invalid_keywords。',
      ],
      [
        'human',
        `产品标题: {productTitle}\n参考模式: {referenceSourceType}\n人工参考卖点: {manualReferenceBullets}\n竞品标题: {competitorTitles}\n变体信息: {variantSummary}\n关键词列表(已按分排序): {keywords}`,
      ],
    ]);
    const chain = prompt.pipe(
      llm.withStructuredOutput(
        {
          type: 'object',
          properties: {
            invalid_keywords: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  keyword: { type: 'string' },
                  reason: { type: 'string' },
                },
                required: ['keyword', 'reason'],
                additionalProperties: false,
              },
            },
          },
          required: ['invalid_keywords'],
          additionalProperties: false,
        } as any,
        {
          name: 'keyword_filtering',
          method: 'functionCalling',
        } as any
      )
    );
    const filterRes = (await chain.invoke({
      productTitle: String(
        candidate?.produce_name || candidate?.item_name || ''
      ),
      referenceSourceType: this.resolveReferenceSourceTypeFromTask(task),
      manualReferenceBullets: JSON.stringify(
        this.getManualReferenceBulletsFromTask(task)
      ),
      competitorTitles: JSON.stringify(
        (
          ((task.flow_context || {}) as any)?.keyword_stage?.competitor_pick
            ?.top4 || []
        ).map((x: any) => String(x?.title || '').trim())
      ),
      variantSummary: JSON.stringify(
        (variants || []).map((v: any) => ({
          id: v.id,
          name: v.name,
          description: v.description,
          uk_title: v.uk_title,
          de_title: v.de_title,
        }))
      ),
      keywords: JSON.stringify(
        scoredWithVolume.map((x: any) => ({
          keyword: x.keyword,
          search_volume: x.search_volume,
          image_relevance_score: x.image_relevance_score,
          title_relevance_score: x.title_relevance_score,
          total_relevance_score: x.total_relevance_score,
          score: x.score,
        }))
      ),
    } as any)) as any;
    const invalidMap = new Map<string, string>();
    for (const row of filterRes?.invalid_keywords || []) {
      const kw = String(row?.keyword || '').trim();
      if (!kw) continue;
      invalidMap.set(kw.toLowerCase(), String(row?.reason || ''));
    }
    const unfiltered = scoredWithVolume;
    const filtered = unfiltered.filter(
      (x: any) => !invalidMap.has(x.keyword.toLowerCase())
    );

    const pickCoreKeywords = (): { main: string | null; core: string[] } => {
      const chosen: string[] = [];
      const chosenLower = new Set<string>();
      const chosenCanonical = new Set<string>();
      const removeChosenAt = (indices: number[]) => {
        for (const index of [...indices].sort((a, b) => b - a)) {
          const removed = chosen[index];
          if (!removed) continue;
          chosen.splice(index, 1);
          chosenLower.delete(removed.toLowerCase());
          const removedCanonical = canonicalKeywordKey(removed);
          if (removedCanonical) chosenCanonical.delete(removedCanonical);
        }
      };
      const addFromPool = (pool: any[]) => {
        for (const item of pool) {
          if (chosen.length >= 3) break;
          const kw = String(item?.keyword || '').trim();
          if (!kw) continue;
          const lower = kw.toLowerCase();
          if (chosenLower.has(lower)) continue;
          const canonical = canonicalKeywordKey(kw);
          if (canonical && chosenCanonical.has(canonical)) continue;

          const subsumed = findChosenIndicesSubsumedBy(kw, chosen);
          if (subsumed.length) removeChosenAt(subsumed);
          if (isKeywordSubsetOfAny(kw, chosen)) continue;

          chosenLower.add(lower);
          if (canonical) chosenCanonical.add(canonical);
          chosen.push(kw);
        }
      };
      addFromPool(filtered);
      if (chosen.length < 3) {
        addFromPool(unfiltered);
      }
      return {
        main: chosen[0] || null,
        core: chosen.slice(1, 3),
      };
    };

    const { main, core } = pickCoreKeywords();
    const selectedCorePhrases = [main, ...core].filter(Boolean) as string[];
    // 长尾：只去掉与核心大词/核心词「完全相同或 canonical 相同」的项；
    // 被核心词真包含的较短低分词（如 white board ⊂ dry-ease white board）仍保留在长尾。
    const tail = unfiltered
      .map((x: any) => String(x.keyword || '').trim())
      .filter((kw: string) => {
        if (!kw) return false;
        return !selectedCorePhrases.some(selected =>
          isSameKeywordVariant(kw, selected)
        );
      });

    const normalized: any[] = [];
    const getSearchVolume = (kw: string) =>
      getKeywordSearchVolume(dbSearchVolumeMap, kw);
    const findScore = (kw: string) =>
      unfiltered.find(
        (x: any) =>
          String(x.keyword || '').toLowerCase() ===
          String(kw || '').toLowerCase()
      );
    if (main)
      normalized.push({
        type: '核心大词',
        keyword: main,
        search_volume: getSearchVolume(main),
        image_relevance_score: findScore(main)?.image_relevance_score ?? 0,
        title_relevance_score: findScore(main)?.title_relevance_score ?? 0,
        total_relevance_score: findScore(main)?.total_relevance_score ?? 0,
        traffic_score: findScore(main)?.total_relevance_score ?? 0,
      });
    for (const kw of core)
      normalized.push({
        type: '核心词',
        keyword: kw,
        search_volume: getSearchVolume(kw),
        image_relevance_score: findScore(kw)?.image_relevance_score ?? 0,
        title_relevance_score: findScore(kw)?.title_relevance_score ?? 0,
        total_relevance_score: findScore(kw)?.total_relevance_score ?? 0,
        traffic_score: findScore(kw)?.total_relevance_score ?? 0,
      });
    for (const kw of tail)
      normalized.push({
        type: '长尾词',
        keyword: kw,
        search_volume: getSearchVolume(kw),
        image_relevance_score: findScore(kw)?.image_relevance_score ?? 0,
        title_relevance_score: findScore(kw)?.title_relevance_score ?? 0,
        total_relevance_score: findScore(kw)?.total_relevance_score ?? 0,
        traffic_score: findScore(kw)?.total_relevance_score ?? 0,
      });
    return {
      invalid_keywords: Array.from(invalidMap.entries()).map(
        ([keyword, reason]) => ({
          keyword,
          reason,
        })
      ),
      selected: {
        main_keyword: main,
        core_keywords: core,
        long_tail_keywords: tail,
      },
      normalized_keywords: normalized,
    };
  }

  private async extractVariantMarkersByAi(
    task: AiListingTaskEntity,
    competitorPick: Record<string, any>,
    options?: {
      language?: 'English' | 'German';
      langKey?: 'en' | 'de';
      existingMarkers?: Array<{
        variant_id: string | number;
        marker: string;
        reason?: string;
      }>;
    }
  ) {
    const variantIds = Array.isArray(task.target_variant_ids)
      ? task.target_variant_ids.map(x => String(x))
      : [];
    const variants = await this.variantRepo.find({
      where: { candidate_id: Number(task.target_candidate_id) } as any,
      select: [
        'id',
        'name',
        'description',
        'uk_title',
        'de_title',
        'image_url',
      ] as any,
      take: 100,
    } as any);
    const selected = (variants || []).filter((v: any) =>
      variantIds.includes(String(v.id))
    );
    const candidate = await this.candidateRepo.findOne({
      where: { id: task.target_candidate_id },
      select: [
        'item_name',
        'produce_name',
        'image_url',
        'image_url2',
        'image_url3',
      ] as any,
    } as any);
    const existingMarkerSamples = (options?.existingMarkers || [])
      .filter(m => m && String(m.marker || '').trim())
      .map(m => {
        const v: any = (variants || []).find(
          (x: any) => String(x.id) === String(m.variant_id)
        );
        return {
          variant_id: String(m.variant_id),
          marker: String(m.marker || '').trim(),
          reason: String(m.reason || '').trim(),
          name: v?.name,
          description: v?.description,
        };
      });
    const llm = getLlmByUser(this.getOperatorId());
    const markerLanguage = options?.language || 'English';
    const markerLanguageHint = markerLanguage === 'German' ? '德文' : '英文';
    const reasonLanguageHint = markerLanguage === 'German' ? '德文' : '英文';
    const existingMarkerHint = existingMarkerSamples.length
      ? '兄弟变体已有的 marker 见下方，请严格保持同样的分类维度（例如：颜色 vs 尺寸 vs 香型 vs 包装规格 ……不要混维度），保持同样的用词粒度与风格，并尽量避免与已有 marker 重复或语义冲突。'
      : '';
    const prompt = ChatPromptTemplate.fromMessages([
      [
        'system',
        `你是电商变体归因专家。请为每个变体给一个用于标题结尾区分的概括词，并给出理由。硬性要求：marker 必须输出${markerLanguageHint}（1-3个${markerLanguageHint}词），reason 必须输出${reasonLanguageHint}。${existingMarkerHint}`,
      ],
      [
        'human',
        '参考模式: {referenceSourceType}\n人工参考卖点: {manualReferenceBullets}\n竞品标题: {competitorTitles}\n选品信息: {candidateInfo}\n兄弟变体已有 marker（参考分类口径，可能为空）: {existingMarkers}\n本次需要生成 marker 的变体信息: {variants}',
      ],
    ]);
    const chain = prompt.pipe(
      llm.withStructuredOutput(
        {
          type: 'object',
          properties: {
            markers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  variant_id: { type: 'string' },
                  marker: { type: 'string' },
                  reason: { type: 'string' },
                },
                required: ['variant_id', 'marker', 'reason'],
                additionalProperties: false,
              },
            },
          },
          required: ['markers'],
          additionalProperties: false,
        } as any,
        {
          name: 'variant_markers',
          method: 'functionCalling',
        } as any
      )
    );
    const res = (await chain.invoke({
      referenceSourceType: this.resolveReferenceSourceTypeFromTask(task),
      manualReferenceBullets: JSON.stringify(
        this.getManualReferenceBulletsFromTask(task)
      ),
      competitorTitles: JSON.stringify(
        (competitorPick?.top4 || []).map((x: any) => x.title)
      ),
      candidateInfo: JSON.stringify(candidate || {}),
      existingMarkers: JSON.stringify(existingMarkerSamples),
      variants: JSON.stringify(
        selected.map((v: any) => ({
          id: v.id,
          name: v.name,
          description: v.description,
          uk_title: v.uk_title,
          de_title: v.de_title,
          image_url: v.image_url,
        }))
      ),
    } as any)) as any;
    const normalizedMarkers = Array.isArray(res?.markers)
      ? res.markers.map((item: any) => ({
          variant_id: String(item?.variant_id || '').trim(),
          marker: String(item?.marker || '').trim(),
          reason: String(item?.reason || '').trim(),
        }))
      : [];
    return { markers: normalizedMarkers };
  }

  private async runBaseCopyGeneration(
    task: AiListingTaskEntity,
    report?: (
      message: string,
      extra?: Record<string, any>
    ) => Promise<void> | void,
    options?: {
      langKey?: 'en' | 'de';
      language?: 'English' | 'German';
    }
  ) {
    const countryCode = this.getTaskCountryCode(task);
    const candidate = await this.candidateRepo.findOne({
      where: { id: task.target_candidate_id },
      select: [
        'id',
        'sku',
        'asin',
        'item_name',
        'produce_name',
        'marketplace',
      ] as any,
    } as any);
    const variantFacts = await this.loadVariantFactsForTask(task);
    const keywordStage =
      ((task.flow_context || {}) as any)?.keyword_stage || {};
    const competitorTop4 = keywordStage?.competitor_pick?.top4 || [];
    let normalizedKeywords = Array.isArray(
      keywordStage?.keyword_selection?.normalized_keywords
    )
      ? keywordStage.keyword_selection.normalized_keywords
          .map((item: any) => ({
            keyword: String(item?.keyword || '').trim(),
            type: String(item?.type || '核心词').trim(),
            search_volume: Number(item?.search_volume || 0),
            image_relevance_score:
              item?.image_relevance_score != null
                ? Number(item.image_relevance_score)
                : item?.score1 != null
                ? Number(item.score1)
                : undefined,
            title_relevance_score:
              item?.title_relevance_score != null
                ? Number(item.title_relevance_score)
                : item?.score2 != null
                ? Number(item.score2)
                : undefined,
            total_relevance_score:
              item?.total_relevance_score != null
                ? Number(item.total_relevance_score)
                : item?.total_score != null
                ? Number(item.total_score)
                : undefined,
            traffic_score:
              item?.traffic_score != null
                ? Number(item.traffic_score)
                : item?.total_relevance_score != null
                ? Number(item.total_relevance_score)
                : item?.total_score != null
                ? Number(item.total_score)
                : undefined,
          }))
          .filter((k: any) => Boolean(k.keyword))
      : [];
    if (!normalizedKeywords.length) {
      const keywordResult = (task.keyword_result || {}) as Record<string, any>;
      const fallbackRaw =
        keywordResult?.normalized_keywords ||
        keywordResult?.result?.keywords ||
        keywordResult?.keywords ||
        keywordResult?.data?.keywords ||
        [];
      normalizedKeywords = Array.isArray(fallbackRaw)
        ? fallbackRaw
            .map((item: any) => ({
              keyword: String(item?.keyword || item?.value || '').trim(),
              type: String(item?.type || item?.tag || '核心词').trim(),
              search_volume:
                item?.search_volume != null
                  ? Number(item.search_volume)
                  : item?.search_volume_monthly != null
                  ? Number(item.search_volume_monthly)
                  : item?.sif_search_volume_monthly != null
                  ? Number(item.sif_search_volume_monthly)
                  : item?.traffic_score != null
                  ? Number(item.traffic_score)
                  : 0,
              image_relevance_score:
                item?.image_relevance_score != null
                  ? Number(item.image_relevance_score)
                  : item?.score1 != null
                  ? Number(item.score1)
                  : undefined,
              title_relevance_score:
                item?.title_relevance_score != null
                  ? Number(item.title_relevance_score)
                  : item?.score2 != null
                  ? Number(item.score2)
                  : undefined,
              total_relevance_score:
                item?.total_relevance_score != null
                  ? Number(item.total_relevance_score)
                  : item?.total_score != null
                  ? Number(item.total_score)
                  : undefined,
              traffic_score:
                item?.traffic_score != null
                  ? Number(item.traffic_score)
                  : item?.total_relevance_score != null
                  ? Number(item.total_relevance_score)
                  : item?.total_score != null
                  ? Number(item.total_score)
                  : undefined,
            }))
            .filter((k: any) => Boolean(k.keyword))
        : [];
    }
    const markers = Array.isArray(keywordStage?.variant_marker?.markers)
      ? keywordStage.variant_marker.markers
      : [];
    const longestMarker =
      markers
        .map((m: any) => String(m?.marker || '').trim())
        .filter(Boolean)
        .sort((a: string, b: string) => b.length - a.length)[0] || '';

    const baseInput = this.buildBaseCopyInputContract({
      task,
      normalizedKeywords,
      competitorTop4,
      longestMarker,
    });
    const targetLanguage = options?.language || baseInput.language || 'English';
    const langKey =
      options?.langKey || (targetLanguage === 'German' ? 'de' : 'en');
    const flowInput = ((task.flow_context || {}) as any)?.input || {};
    const referenceSourceType =
      baseInput.reference_source_type || 'competitor';
    const productSummary = String(
      flowInput?.product_summary ||
        flowInput?.productSummary ||
        (referenceSourceType === 'manual_bullets'
          ? ''
          : candidate?.produce_name || candidate?.item_name || '')
    ).trim();
    const keyParameters = String(
      flowInput?.key_parameters ||
        flowInput?.keyParameters ||
        flowInput?.product_args ||
        flowInput?.productArgs ||
        ''
    ).trim();
    const packageInfo = String(
      flowInput?.package_info || flowInput?.packageInfo || ''
    ).trim();
    const allowedKeywords = (normalizedKeywords || [])
      .map((item: any) => String(item?.keyword || '').trim())
      .filter(Boolean);
    const generatorInput = {
      username: this.getOperatorId(),
      language: targetLanguage,
      product_summary: productSummary,
      product_name: String(candidate?.item_name || '').trim(),
      produce_name: String(candidate?.produce_name || '').trim(),
      product_args: baseInput.product_args,
      key_parameters: keyParameters,
      package_info: packageInfo,
      variant_facts: variantFacts,
      allowed_keywords: allowedKeywords,
      duplicate_num: 1,
      keywords: baseInput.keywords,
      reference_source_type: referenceSourceType,
      reference_bullet_points: baseInput.reference_bullet_points || [],
      manual_reference_title: baseInput.manual_reference_title || '',
      title_extend_phrases: baseInput.title_extend_phrases || [],
      competitor_titles: baseInput.competitor_titles,
      competitor_bullet_points: baseInput.competitor_bullet_points,
      tail_product_args: [],
      bullet_points_title:
        referenceSourceType === 'manual_bullets'
          ? [...(baseInput.reference_bullet_points || [])]
          : [],
      reserved_title_suffix_length: 0,
    };
    await this.stageReport(report, `base_copy_input_probe_${langKey}`, {
      input_summary: {
        language: generatorInput.language,
        product_args: generatorInput.product_args,
      },
      counts: {
        keywords_count: (generatorInput.keywords || []).length,
        reference_source_type: referenceSourceType,
        reference_bullet_points_count: (
          generatorInput.reference_bullet_points || []
        ).length,
        competitor_titles_count: (generatorInput.competitor_titles || [])
          .length,
        competitor_bullet_points_shape: (
          generatorInput.competitor_bullet_points || []
        ).map((rows: any[]) => (Array.isArray(rows) ? rows.length : 0)),
      },
    });

    const graphResult =
      await this.langGraphClientService.invokeBaseCopyGenerator(
        generatorInput as any,
        {
          runName: 'AIListingBaseCopyGenerator',
          tags: ['ai-listing', 'base-copy-generator', `lang-${langKey}`],
          metadata: {
            task_id: task.id,
            candidate_id: task.target_candidate_id,
            sku: String(candidate?.sku || ''),
            asin: String(candidate?.asin || ''),
            country_code: countryCode,
            language: targetLanguage,
            language_key: langKey,
          },
        }
      );
    const output = { ...(graphResult.output || {}) } as Record<string, any>;
    if (output?.title && typeof output.title === 'object') {
      output.title = String((output.title as any)?.title || '').trim();
    } else {
      output.title = String(output?.title || '').trim();
    }
    return {
      ...output,
      graph_execution: {
        node_count: Object.keys(graphResult.rawState || {}).length,
        language: targetLanguage,
        language_key: langKey,
      },
      generator_input: generatorInput,
    };
  }

  private buildTaskWithCountry(
    task: AiListingTaskEntity,
    countryCode: string,
    flowContextPatch?: Record<string, any>
  ) {
    const flowContext = {
      ...((task.flow_context || {}) as Record<string, any>),
      ...(flowContextPatch || {}),
    };
    flowContext.input = {
      ...(flowContext.input || {}),
      country_code: this.resolveCountryCode(countryCode),
    };
    return {
      ...task,
      flow_context: flowContext,
    } as AiListingTaskEntity;
  }

  private async runLanguageGraphLane(args: {
    task: AiListingTaskEntity;
    langKey: 'en' | 'de';
    countryCode: string;
    report?: (
      message: string,
      extra?: Record<string, any>
    ) => Promise<void> | void;
    candidateForTrace?: {
      sku?: string;
      asin?: string;
      marketplace?: string;
    } | null;
  }) {
    const laneTask = this.buildTaskWithCountry(args.task, args.countryCode);
    const traceCountryCode = this.getTaskCountryCode(laneTask);
    let laneKeywordStage: Record<string, any> = {};
    const laneGraph = await this.langGraphClientService.invokeTaskGraph({
      taskId: laneTask.id,
      initialFlowContext: laneTask.flow_context || {},
      trace: {
        runName: `AIListingTaskGraph-${args.langKey.toUpperCase()}`,
        tags: ['ai-listing', 'task-graph', `lang-${args.langKey}`],
        metadata: {
          task_id: laneTask.id,
          candidate_id: laneTask.target_candidate_id,
          sku: String(args.candidateForTrace?.sku || ''),
          asin: String(args.candidateForTrace?.asin || ''),
          country_code: traceCountryCode,
          marketplace: String(args.candidateForTrace?.marketplace || ''),
          language_key: args.langKey,
        },
      },
      runKeywordResearch: async () => {
        await this.stageReport(
          args.report,
          `competitor_pick_started_${args.langKey}`
        );
        const keywordSubgraph =
          await this.langGraphClientService.invokeKeywordResearchSubgraph({
            taskId: laneTask.id,
            initialContext: laneTask.flow_context || {},
            selectCompetitors: async () => {
              const picked = await this.pickCompetitorsForKeywordResearch(
                laneTask
              );
              await this.stageReport(
                args.report,
                `competitor_pick_done_${args.langKey}`,
                {
                  output_summary: {
                    top4_asin: (picked.top4 || []).map((x: any) => x.asin),
                  },
                }
              );
              return picked;
            },
            runGoResearch: async competitorPick => {
              const goRes = await this.runGoResearchWithCompetitor(
                laneTask,
                competitorPick || {}
              );
              await this.stageReport(
                args.report,
                `go_research_done_${args.langKey}`,
                {
                  output_summary: {
                    go_task_id: goRes.go_task_id,
                  },
                }
              );
              return goRes;
            },
            selectKeywords: async goResearch => {
              const selected = await this.selectKeywordsByAi(
                laneTask,
                goResearch || {}
              );
              await this.stageReport(
                args.report,
                `keyword_selection_done_${args.langKey}`,
                {
                  counts: {
                    normalized_count: (selected?.normalized_keywords || [])
                      .length,
                    invalid_count: (selected?.invalid_keywords || []).length,
                  },
                }
              );
              return selected;
            },
            extractVariantMarkers: async (
              _keywordSelection,
              competitorPick
            ) => {
              return this.extractVariantMarkersByAi(
                laneTask,
                competitorPick || {},
                {
                  langKey: args.langKey,
                  language: args.langKey === 'de' ? 'German' : 'English',
                }
              );
            },
          });
        return {
          ...(keywordSubgraph?.keywordSelection || {}),
          keyword_stage: {
            competitor_pick: keywordSubgraph?.competitorPick || {},
            go_research: keywordSubgraph?.goResearch || {},
            keyword_selection: keywordSubgraph?.keywordSelection || {},
            variant_marker: keywordSubgraph?.variantMarker || {},
          },
        };
      },
      runBaseCopyGeneration: async keywordResult => {
        laneKeywordStage = (keywordResult?.keyword_stage || {}) as Record<
          string,
          any
        >;
        const laneTaskWithKeyword = this.buildTaskWithCountry(
          laneTask,
          args.countryCode,
          {
            keyword_stage: keywordResult?.keyword_stage || {},
          }
        );
        return this.runBaseCopyGeneration(laneTaskWithKeyword, args.report, {
          langKey: args.langKey,
          language: args.langKey === 'de' ? 'German' : 'English',
        });
      },
      runVariantMaterialization: async baseCopyResult => {
        const laneTaskWithKeyword = this.buildTaskWithCountry(
          laneTask,
          args.countryCode,
          {
            keyword_stage: laneKeywordStage,
          }
        );
        return this.materializeVariantCopies(
          laneTaskWithKeyword,
          (baseCopyResult || {}) as Record<string, any>
        );
      },
    });
    return laneGraph;
  }

  private async materializeVariantCopies(
    task: AiListingTaskEntity,
    baseCopy: Record<string, any>
  ) {
    const variantIds = Array.isArray(task.target_variant_ids)
      ? task.target_variant_ids.map(id => String(id))
      : [];
    const variants = variantIds.length
      ? await this.variantRepo.find({
          where: {
            candidate_id: Number(task.target_candidate_id),
          },
          select: ['id', 'name'],
        })
      : [];
    const variantNameMap = new Map<string, string>();
    for (const variant of variants || []) {
      variantNameMap.set(
        String(variant.id),
        String(variant.name || variant.id)
      );
    }
    const variantTitles: Record<string, string> = {};
    const markerRows =
      (((task.flow_context || {}) as any)?.keyword_stage?.variant_marker
        ?.markers as any[]) || [];
    const markerMap = new Map<string, string>();
    for (const row of markerRows) {
      const vid = String(row?.variant_id || '').trim();
      if (!vid) continue;
      markerMap.set(vid, String(row?.marker || '').trim());
    }
    const extractTitleText = (raw: any) => {
      if (typeof raw === 'string') return raw.trim();
      if (raw && typeof raw === 'object') {
        const t = String(raw?.title || '').trim();
        if (t) return t;
      }
      return '';
    };
    const rawBaseTitle = extractTitleText(baseCopy?.title);
    const suffixList = variantIds.map(id => {
      const suffix = markerMap.get(id) || variantNameMap.get(id) || id;
      return String(suffix || '').trim();
    });
    const normalizedBaseTitle = rawBaseTitle.trim();
    for (let idx = 0; idx < variantIds.length; idx++) {
      const variantId = variantIds[idx];
      const suffix = suffixList[idx] || variantId;
      variantTitles[variantId] = suffix
        ? `${normalizedBaseTitle}(${suffix})`
        : normalizedBaseTitle;
    }
    return {
      base_title: normalizedBaseTitle,
      variant_titles: variantTitles,
      bullet_points: Array.isArray(baseCopy?.bullet_points)
        ? baseCopy.bullet_points
        : [],
    };
  }

  private async runAIListingDeltaGenerator(
    taskId: number,
    report?: (
      message: string,
      extra?: Record<string, any>
    ) => Promise<void> | void
  ) {
    const task = await this.loadTaskOrThrow(taskId);
    if (String((task as any).task_mode || 'full') !== 'delta') return;
    if (
      task.status === AI_LISTING_TASK_STATUS.SUCCEEDED ||
      task.status === AI_LISTING_TASK_STATUS.CANCELLED
    )
      return;

    const mergeIntoTaskId = Number((task as any).merge_into_task_id || 0);
    if (!mergeIntoTaskId) {
      throw new Error('delta任务缺少 merge_into_task_id');
    }
    const rootTask = await this.loadTaskOrThrow(mergeIntoTaskId);
    const rootStatus = Number(rootTask.status || 0);

    if (
      rootStatus === AI_LISTING_TASK_STATUS.FAILED ||
      rootStatus === AI_LISTING_TASK_STATUS.CANCELLED
    ) {
      if (task.status === AI_LISTING_TASK_STATUS.QUEUED) {
        await this.transition(
          task.id,
          AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING,
          {
            remark: 'delta 检查主任务：主任务已失败/取消',
            progress_percent: 10,
            started_at: task.started_at || new Date(),
          }
        );
      }
      await this.transition(task.id, AI_LISTING_TASK_STATUS.FAILED, {
        remark: 'delta 中止：主任务未成功结束',
        progress_percent: 100,
        finished_at: new Date(),
        last_error_code: 'DELTA_ROOT_NOT_SUCCEEDED',
        last_error_message: `主任务状态=${rootStatus}，无法执行追加文案`,
      });
      return;
    }

    if (rootStatus !== AI_LISTING_TASK_STATUS.SUCCEEDED) {
      const pollMs = Math.max(
        30_000,
        Math.min(
          300_000,
          Number(this.aiListingTaskConfig?.deltaWaitRootPollMs ?? 60_000)
        )
      );
      await this.stageReport(report, 'delta_wait_root', {
        extra: {
          root_task_id: mergeIntoTaskId,
          root_status: rootStatus,
          reschedule_ms: pollMs,
        },
      });
      const waitRow = await this.loadTaskOrThrow(task.id);
      await this.appendAiListingTimeline(waitRow, {
        remark: 'delta 等待主任务成功后再执行（已延迟重试）',
        extra: {
          root_task_id: mergeIntoTaskId,
          root_status: rootStatus,
          reschedule_ms: pollMs,
        },
      });
      waitRow.next_retry_at = new Date(Date.now() + pollMs) as any;
      await this.aiListingTaskRepo.save(waitRow);
      try {
        // 兜底轮询：不传自定义 jobId，让 enqueue 使用内置 fallback 生成唯一 id（避免 BullMQ 拒绝含 : 的自定义 id）
        await this.aiListingTaskSchedulerService.enqueueAIListingGenerator(
          this.buildQueueDebugPayload(waitRow, 'generate', 'delta_wait_root'),
          { delayMs: pollMs }
        );
      } catch (e: any) {
        console.error(
          '[AiListingTask] delta wait-root enqueue failed:',
          e?.message || String(e)
        );
      }
      return;
    }

    if (await this.ensurePreflightPassed(task.id, { mode: 'delta' })) {
      return;
    }

    if (task.status !== AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING) {
      await this.transition(
        task.id,
        AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING,
        {
          remark: 'AIListingDeltaGenerator 启动（简化变体流水线）',
          progress_percent: 20,
          started_at: task.started_at || new Date(),
        }
      );
    }
    const latest = await this.loadTaskOrThrow(task.id);
    const rootNow = await this.loadTaskOrThrow(mergeIntoTaskId);
    const rootFlowContext =
      ((rootNow.flow_context || {}) as Record<string, any>) || {};
    const rootLanggraphResult =
      ((rootNow.langgraph_result || {}) as Record<string, any>) || {};
    try {
      await this.transition(task.id, AI_LISTING_TASK_STATUS.LANGGRAPH_RUNNING, {
        remark: 'delta任务生成变体选项',
        progress_percent: 70,
      });
      const lanes = [
        { langKey: 'en' as const, countryCode: 'uk' },
        { langKey: 'de' as const, countryCode: 'de' },
      ];
      const laneResults = await Promise.all(
        lanes.map(async lane => {
          const laneKeywordStage =
            (rootFlowContext?.keyword_stage_by_lang || {})[lane.langKey] ||
            rootFlowContext?.keyword_stage ||
            {};
          const competitorPick = (laneKeywordStage?.competitor_pick ||
            rootFlowContext?.keyword_stage?.competitor_pick ||
            {}) as Record<string, any>;
          // delta 简化链路仍执行一次 LLM marker 提取，确保 EN/DE 后缀语言正确。
          // 把主任务已生成的 marker 作为参考传给 LLM，避免 delta 新增变体的分类口径与主任务不一致。
          const rootExistingMarkers = Array.isArray(
            laneKeywordStage?.variant_marker?.markers
          )
            ? laneKeywordStage.variant_marker.markers
            : [];
          const variantMarker = await this.extractVariantMarkersByAi(
            this.buildTaskWithCountry(latest, lane.countryCode, {
              keyword_stage: laneKeywordStage,
            }),
            competitorPick,
            {
              langKey: lane.langKey,
              language: lane.langKey === 'de' ? 'German' : 'English',
              existingMarkers: rootExistingMarkers,
            }
          );
          await this.stageReport(
            report,
            `delta_variant_marker_done_${lane.langKey}`,
            {
              counts: {
                marker_count: Array.isArray(variantMarker?.markers)
                  ? variantMarker.markers.length
                  : 0,
              },
            }
          );
          const laneTask = this.buildTaskWithCountry(latest, lane.countryCode, {
            keyword_stage: {
              ...laneKeywordStage,
              variant_marker: variantMarker || {},
            },
          });
          const rootBaseCopy =
            rootLanggraphResult?.[lane.langKey]?.base_copy || null;
          const variantResult = await this.materializeVariantCopies(
            laneTask,
            rootBaseCopy || {}
          );
          await this.stageReport(
            report,
            `delta_variant_materialized_${lane.langKey}`,
            {
              counts: {
                variant_count: Object.keys(variantResult?.variant_titles || {})
                  .length,
              },
            }
          );
          return {
            variantResult,
            laneKeywordStage,
            variantMarker: variantMarker || { markers: [] },
          };
        })
      );
      const variantByLang = Object.fromEntries(
        lanes.map((lane, idx) => [
          lane.langKey,
          laneResults[idx]?.variantResult || {},
        ])
      ) as Record<'en' | 'de', Record<string, any>>;
      const newMarkersByLang = Object.fromEntries(
        lanes.map((lane, idx) => [
          lane.langKey,
          Array.isArray(laneResults[idx]?.variantMarker?.markers)
            ? laneResults[idx]!.variantMarker.markers
            : [],
        ])
      ) as Record<'en' | 'de', any[]>;
      const mergedKeywordStageByLang = {
        ...((rootFlowContext?.keyword_stage_by_lang || {}) as Record<
          string,
          any
        >),
      } as Record<string, any>;
      for (const lane of lanes) {
        const prev = mergedKeywordStageByLang[lane.langKey] || {};
        const prevMarkers = Array.isArray(prev?.variant_marker?.markers)
          ? prev.variant_marker.markers
          : [];
        const incoming = newMarkersByLang[lane.langKey] || [];
        const dedup = new Map<string, any>();
        for (const m of [...prevMarkers, ...incoming]) {
          const key = String(m?.variant_id || '').trim();
          if (!key) continue;
          dedup.set(key, m);
        }
        mergedKeywordStageByLang[lane.langKey] = {
          ...prev,
          variant_marker: {
            ...(prev?.variant_marker || {}),
            markers: Array.from(dedup.values()),
          },
        };
      }
      await this.transition(task.id, AI_LISTING_TASK_STATUS.SUCCEEDED, {
        remark: 'AIListingDeltaGenerator 执行完成，待 Studio 确认',
        stage: 'awaiting_review',
        progress_percent: 100,
        finished_at: new Date(),
        keyword_result: rootNow.keyword_result || {},
        langgraph_result: {
          en: {
            base_copy: rootLanggraphResult?.en?.base_copy || null,
            variant_titles: variantByLang.en?.variant_titles || {},
            flow_context: rootLanggraphResult?.en?.flow_context || {},
          },
          de: {
            base_copy: rootLanggraphResult?.de?.base_copy || null,
            variant_titles: variantByLang.de?.variant_titles || {},
            flow_context: rootLanggraphResult?.de?.flow_context || {},
          },
          default_lang: rootLanggraphResult?.default_lang || 'en',
        },
        flow_context: {
          ...((latest.flow_context || {}) as Record<string, any>),
          keyword_stage_by_lang: mergedKeywordStageByLang,
          flow_context_by_lang: rootFlowContext?.flow_context_by_lang || {},
          output: {
            base_copy_result_by_language:
              rootFlowContext?.output?.base_copy_result_by_language || {},
            variant_titles_by_language: {
              en: variantByLang.en?.variant_titles || {},
              de: variantByLang.de?.variant_titles || {},
            },
          } as TaskOutputContract,
        },
      } as any);
      await this.mergeDeltaResultIntoRoot(task);
    } catch (err: any) {
      await this.transition(task.id, AI_LISTING_TASK_STATUS.FAILED, {
        remark: 'AIListingDeltaGenerator 执行失败',
        progress_percent: 100,
        finished_at: new Date(),
        failed_stage: 'ai_listing_delta_generator',
        last_error_code: 'AI_LISTING_DELTA_GENERATOR_FAILED',
        last_error_message: err?.message || String(err),
      });
      throw err;
    }
  }

  async runAIListingGenerator(
    taskId: number,
    report?: (
      message: string,
      extra?: Record<string, any>
    ) => Promise<void> | void
  ) {
    const task = await this.loadTaskOrThrow(taskId);
    if (String((task as any).task_mode || 'full') === 'delta') {
      await this.runAIListingDeltaGenerator(taskId, report);
      return;
    }
    const countryCode = this.resolveCountryCode(this.getTaskCountryCode(task));
    await this.stageReport(report, 'country_context', {
      input_summary: this.getTaskInputContract(task),
      extra: {
        country_code: countryCode,
        keyword_marketplace: this.countryCodeToKeywordMarketplace(countryCode),
        go_marketplace: this.countryCodeToGoMarketplace(countryCode),
        lane_country_codes: {
          en: countryCode,
          de: 'de',
        },
      },
    });
    if (task.status === AI_LISTING_TASK_STATUS.CANCELLED) return;

    const lanesToRun = this.resolveLanesToRun(task);
    if (!lanesToRun.length) {
      await this.stageReport(report, 'no_lanes_to_run', {
        extra: { reason: 'empty_lane_scope' },
      });
      return;
    }

    if (await this.ensurePreflightPassed(task.id, { mode: 'full' })) {
      return;
    }

    if (task.status !== AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING) {
      await this.transition(
        task.id,
        AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING,
        {
          remark: 'AIListingGenerator 启动，进入关键词阶段',
          progress_percent: 10,
          started_at: task.started_at || new Date(),
        }
      );
    }
    const latest = await this.loadTaskOrThrow(task.id);
    const candidateForTrace = await this.candidateRepo.findOne({
      where: { id: latest.target_candidate_id },
      select: ['id', 'sku', 'asin', 'marketplace'] as any,
    } as any);

    const prevFlow = this.getTaskFlowContext(latest);
    const languageStatus = this.getTaskLanguageStatus(latest);
    for (const lane of lanesToRun) {
      languageStatus[lane.langKey] = 'running';
    }
    await this.aiListingTaskRepo.update(latest.id, {
      flow_context: {
        ...prevFlow,
        language_status: languageStatus,
      },
    } as any);

    try {
      await this.transition(
        latest.id,
        AI_LISTING_TASK_STATUS.LANGGRAPH_RUNNING,
        {
          remark:
            lanesToRun.length === 1
              ? `进入文案生成阶段（${lanesToRun[0].langKey}）`
              : '进入双语文案生成阶段',
          progress_percent: 50,
        }
      );
      const refreshed = await this.loadTaskOrThrow(latest.id);
      const prevKeyword = (refreshed.keyword_result || {}) as Record<string, any>;
      const prevLanggraph = (refreshed.langgraph_result || {}) as Record<
        string,
        any
      >;
      const prevFlowContext = this.getTaskFlowContext(refreshed);

      const resultByLang: Partial<Record<AiListingLang, any>> = {};
      const laneErrors: Array<{ lang: AiListingLang; message: string }> = [];

      for (const lane of lanesToRun) {
        try {
          resultByLang[lane.langKey] = await this.runLanguageGraphLane({
            task: refreshed,
            langKey: lane.langKey,
            countryCode: lane.countryCode,
            report,
            candidateForTrace,
          });
          languageStatus[lane.langKey] = 'succeeded';
        } catch (laneErr: any) {
          languageStatus[lane.langKey] = 'failed';
          laneErrors.push({
            lang: lane.langKey,
            message: laneErr?.message || String(laneErr),
          });
        }
      }

      const keywordByLang = {
        en:
          resultByLang.en?.keywordResult ??
          (prevKeyword.en || null),
        de:
          resultByLang.de?.keywordResult ??
          (prevKeyword.de || null),
      };
      const baseCopyByLang = {
        en:
          resultByLang.en?.baseCopyResult ??
          prevLanggraph?.en?.base_copy ??
          null,
        de:
          resultByLang.de?.baseCopyResult ??
          prevLanggraph?.de?.base_copy ??
          null,
      } as Record<AiListingLang, Record<string, any> | null>;
      const variantByLang = {
        en: resultByLang.en?.variantResult ||
          { variant_titles: prevLanggraph?.en?.variant_titles || {} },
        de: resultByLang.de?.variantResult ||
          { variant_titles: prevLanggraph?.de?.variant_titles || {} },
      };
      const flowContextByLang = {
        en:
          resultByLang.en?.flowContext ||
          prevLanggraph?.en?.flow_context ||
          {},
        de:
          resultByLang.de?.flowContext ||
          prevLanggraph?.de?.flow_context ||
          {},
      };
      const goTaskId =
        keywordByLang.en?.keyword_stage?.go_research?.go_task_id ||
        keywordByLang.de?.keyword_stage?.go_research?.go_task_id ||
        refreshed.go_task_id ||
        null;

      const enFailed = laneErrors.some(e => e.lang === 'en');
      const deFailed = laneErrors.some(e => e.lang === 'de');
      const requested = this.resolveRequestedLanguagesFromTask(refreshed);
      const requiresEn = requested.includes('en');
      const requiresDe = requested.includes('de');
      const enReady =
        this.hasLanggraphCopyForLang(
          {
            ...refreshed,
            langgraph_result: this.mergeLanggraphResultByLang(prevLanggraph, {
              en: {
                base_copy: baseCopyByLang.en,
                variant_titles: variantByLang.en?.variant_titles || {},
                flow_context: flowContextByLang.en,
              },
              de: prevLanggraph.de ?? null,
            }),
          } as AiListingTaskEntity,
          'en'
        ) || Boolean(baseCopyByLang.en);
      const deReady =
        this.hasLanggraphCopyForLang(
          {
            ...refreshed,
            langgraph_result: this.mergeLanggraphResultByLang(prevLanggraph, {
              en: prevLanggraph.en ?? null,
              de: {
                base_copy: baseCopyByLang.de,
                variant_titles: variantByLang.de?.variant_titles || {},
                flow_context: flowContextByLang.de,
              },
            }),
          } as AiListingTaskEntity,
          'de'
        ) || Boolean(baseCopyByLang.de);

      const nextFlowContext: Record<string, any> = {
        ...prevFlowContext,
        input: {
          ...(prevFlowContext.input || {}),
          requested_languages: Array.from(
            new Set([
              ...requested,
              ...lanesToRun.map(l => l.langKey),
            ])
          ),
        },
        language_status: languageStatus,
        keyword_stage_by_lang: {
          en: keywordByLang.en?.keyword_stage || {},
          de: keywordByLang.de?.keyword_stage || {},
        },
        flow_context_by_lang: flowContextByLang,
        output: {
          ...(prevFlowContext.output || {}),
          base_copy_result_by_language: {
            en: baseCopyByLang.en || null,
            de: baseCopyByLang.de || null,
          },
          variant_titles_by_language: {
            en: variantByLang.en?.variant_titles || {},
            de: variantByLang.de?.variant_titles || {},
          },
        } as TaskOutputContract,
      };
      delete nextFlowContext.only_languages;

      const mergedLanggraph = this.mergeLanggraphResultByLang(prevLanggraph, {
        en: resultByLang.en
          ? {
              base_copy: baseCopyByLang.en || null,
              variant_titles: variantByLang.en?.variant_titles || {},
              flow_context: flowContextByLang.en || {},
            }
          : null,
        de: resultByLang.de
          ? {
              base_copy: baseCopyByLang.de || null,
              variant_titles: variantByLang.de?.variant_titles || {},
              flow_context: flowContextByLang.de || {},
            }
          : null,
      });

      const requiredLaneFailure =
        (requiresEn && (enFailed || !enReady))
          ? 'en'
          : (requiresDe && (deFailed || !deReady))
            ? 'de'
            : null;
      const defaultLang: AiListingLang =
        requiresEn || enReady ? 'en' : 'de';

      if (requiredLaneFailure) {
        const firstErr =
          laneErrors.find(e => e.lang === requiredLaneFailure) || laneErrors[0];
        const defaultMessage =
          requiredLaneFailure === 'de' ? '德语文案生成失败' : '英文文案生成失败';
        await this.transition(task.id, AI_LISTING_TASK_STATUS.FAILED, {
          remark: 'AIListingGenerator 执行失败',
          progress_percent: 100,
          finished_at: new Date(),
          failed_stage: 'ai_listing_generator',
          last_error_code: 'AI_LISTING_GENERATOR_FAILED',
          last_error_message: firstErr?.message || defaultMessage,
          flow_context: nextFlowContext,
          keyword_result: {
            ...prevKeyword,
            en: keywordByLang.en || {},
            de: keywordByLang.de || {},
            default_lang: defaultLang,
          },
          langgraph_result: mergedLanggraph,
        } as any);
        throw new Error(firstErr?.message || defaultMessage);
      }

      const partialDeFailure =
        requiresEn &&
        requiresDe &&
        enReady &&
        deFailed &&
        lanesToRun.some(l => l.langKey === 'de');

      await this.transition(task.id, AI_LISTING_TASK_STATUS.SUCCEEDED, {
        remark: partialDeFailure
          ? '英文文案已生成，德文生成失败，可手动补触发'
          : 'AIListingGenerator 执行完成，待 Studio 确认',
        stage: 'awaiting_review',
        progress_percent: 100,
        finished_at: new Date(),
        go_task_id: goTaskId,
        flow_context: nextFlowContext,
        keyword_result: {
          ...prevKeyword,
          en: keywordByLang.en || {},
          de: keywordByLang.de || {},
          default_lang: defaultLang,
        },
        langgraph_result: mergedLanggraph,
        ...(partialDeFailure
          ? {
              last_error_message: laneErrors.find(e => e.lang === 'de')?.message,
            }
          : {
              last_error_code: null,
              last_error_message: null,
            }),
      } as any);
      await this.mergeDeltaResultIntoRoot(task);
      await this.scheduleDeltaTasksForRoot(Number(task.id));
      if (laneErrors.length && !partialDeFailure) {
        throw new Error(laneErrors[0]?.message || '文案生成失败');
      }
    } catch (err: any) {
      const current = await this.loadTaskOrThrow(task.id);
      if (Number(current.status) !== AI_LISTING_TASK_STATUS.FAILED) {
        await this.transition(task.id, AI_LISTING_TASK_STATUS.FAILED, {
          remark: 'AIListingGenerator 执行失败',
          progress_percent: 100,
          finished_at: new Date(),
          failed_stage: 'ai_listing_generator',
          last_error_code: 'AI_LISTING_GENERATOR_FAILED',
          last_error_message: err?.message || String(err),
        });
      }
      throw err;
    }
  }

  private async scheduleDeltaTasksForRoot(rootTaskId: number) {
    const rid = Number(rootTaskId);
    if (!rid) return;
    const pending = await this.aiListingTaskRepo.find({
      where: {
        merge_into_task_id: rid,
        task_mode: 'delta' as any,
      } as any,
      order: { id: 'ASC' },
    });
    for (const deltaTask of pending) {
      const status = Number(deltaTask.status || 0);
      if (
        status === AI_LISTING_TASK_STATUS.SUCCEEDED ||
        status === AI_LISTING_TASK_STATUS.FAILED ||
        status === AI_LISTING_TASK_STATUS.CANCELLED
      ) {
        continue;
      }
      await this.appendAiListingTimeline(deltaTask, {
        remark: '主任务已成功，立即唤醒 delta 任务',
        extra: {
          root_task_id: rid,
          delta_task_status: status,
        },
      });
      deltaTask.next_retry_at = null as any;
      await this.aiListingTaskRepo.save(deltaTask);
      try {
        // 主任务成功后立即唤醒：不传 jobId，使用 enqueue 内置 fallback（带时间戳的默认 id 历史上能被 BullMQ 接受）
        await this.aiListingTaskSchedulerService.enqueueAIListingGenerator(
          this.buildQueueDebugPayload(
            deltaTask,
            'generate',
            'root_succeeded_wake'
          )
        );
      } catch (e: any) {
        console.error(
          '[AiListingTask] root-success delta enqueue failed:',
          e?.message || String(e)
        );
      }
    }
  }

  async executeKeywordScoring(taskId: number) {
    const task = await this.loadTaskOrThrow(taskId);
    if (
      task.status >= AI_LISTING_TASK_STATUS.SUCCEEDED ||
      task.status >= AI_LISTING_TASK_STATUS.FAILED
    )
      return;

    if (task.status === AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RETRYING) {
      await this.transition(
        task.id,
        AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING,
        {
          remark: '关键词阶段重试中，重新执行',
          progress_percent: 12,
        }
      );
    } else if (
      task.status === AI_LISTING_TASK_STATUS.QUEUED ||
      task.status === AI_LISTING_TASK_STATUS.FAILED
    ) {
      await this.transition(
        task.id,
        AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING,
        {
          remark: '开始关键词调研和评分',
          progress_percent: 10,
        }
      );
    }

    const current = await this.loadTaskOrThrow(task.id);
    const nextAttempt = Number(current.score_attempt || 0) + 1;
    await this.aiListingTaskRepo.update(task.id, {
      score_attempt: nextAttempt,
      next_retry_at: null,
    });

    try {
      const scoreRes = await this.runGoScoring(current);
      await this.transition(
        task.id,
        AI_LISTING_TASK_STATUS.KEYWORD_SCORING_SUCCEEDED,
        {
          remark: '关键词调研评分完成',
          progress_percent: 45,
          go_task_id: scoreRes.goTaskId,
          keyword_result: scoreRes.result,
          last_error_code: null,
          last_error_message: null,
        }
      );
      const refreshed = await this.loadTaskOrThrow(task.id);
      await this.aiListingTaskSchedulerService.enqueueLangGraph(
        this.buildQueueDebugPayload(
          refreshed,
          'langgraph',
          'keyword_scoring_succeeded'
        )
      );
    } catch (err: any) {
      const message = err?.message || String(err);
      const latest = await this.loadTaskOrThrow(task.id);
      if (shouldRetry(latest.score_attempt, latest.score_max_attempts)) {
        const nextRetryAt = new Date(
          Date.now() + this.getBackoffMs(latest.score_attempt)
        );
        await this.transition(
          task.id,
          AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RETRYING,
          {
            remark: '关键词阶段失败，等待自动重试',
            progress_percent: 20,
            last_error_code: 'KEYWORD_SCORING_FAILED',
            last_error_message: message,
            failed_stage: 'keyword_scoring',
            next_retry_at: nextRetryAt,
            extra: {
              attempt: latest.score_attempt,
              max: latest.score_max_attempts,
            },
          }
        );
        const refreshed = await this.loadTaskOrThrow(task.id);
        await this.aiListingTaskSchedulerService.enqueueKeywordScoring(
          this.buildQueueDebugPayload(
            refreshed,
            'keyword_scoring',
            'keyword_scoring_retry'
          )
        );
        return;
      }
      await this.transition(task.id, AI_LISTING_TASK_STATUS.FAILED, {
        remark: '关键词阶段失败且达到重试上限',
        progress_percent: 100,
        last_error_code: 'KEYWORD_SCORING_FAILED',
        last_error_message: message,
        failed_stage: 'keyword_scoring',
        finished_at: new Date(),
      });
    }
  }

  private async runLangGraph(task: AiListingTaskEntity) {
    const runRes = await this.langGraphClientService.run({
      task_id: task.id,
      candidate_id: task.target_candidate_id,
      amazon_account_id: String(task.target_amazon_account_id || ''),
      go_keyword_result: task.keyword_result || null,
    });
    const runId = runRes.runId;
    await this.aiListingTaskRepo.update(task.id, { langgraph_run_id: runId });

    const pollIntervalMs = Math.max(
      1_000,
      Number(this.langgraphConfig?.pollIntervalMs || 2_000)
    );
    const deadline = Date.now() + 10 * 60 * 1000;
    for (;;) {
      const statusRes = await this.langGraphClientService.getRun(runId);
      if (statusRes.status === 'succeeded' || statusRes.status === 'finished') {
        return {
          runId,
          result: await this.langGraphClientService.getRunResult(runId),
        };
      }
      if (statusRes.status === 'failed') {
        throw new Error(
          (statusRes as any).errorMessage || 'LangGraph 运行失败'
        );
      }
      if (Date.now() > deadline) {
        throw new Error('LangGraph 运行轮询超时');
      }
      await this.sleep(pollIntervalMs);
    }
  }

  async executeLangGraph(taskId: number) {
    const task = await this.loadTaskOrThrow(taskId);
    if (
      task.status >= AI_LISTING_TASK_STATUS.SUCCEEDED ||
      task.status >= AI_LISTING_TASK_STATUS.FAILED
    )
      return;
    if (
      task.status !== AI_LISTING_TASK_STATUS.KEYWORD_SCORING_SUCCEEDED &&
      task.status !== AI_LISTING_TASK_STATUS.LANGGRAPH_RETRYING
    ) {
      return;
    }

    if (task.status === AI_LISTING_TASK_STATUS.LANGGRAPH_RETRYING) {
      await this.transition(task.id, AI_LISTING_TASK_STATUS.LANGGRAPH_RUNNING, {
        remark: 'LangGraph 阶段重试中，重新执行',
        progress_percent: 52,
      });
    } else {
      await this.transition(task.id, AI_LISTING_TASK_STATUS.LANGGRAPH_RUNNING, {
        remark: '开始 LangGraph 生成阶段',
        progress_percent: 50,
      });
    }

    const current = await this.loadTaskOrThrow(task.id);
    const nextAttempt = Number(current.lang_attempt || 0) + 1;
    await this.aiListingTaskRepo.update(task.id, {
      lang_attempt: nextAttempt,
      next_retry_at: null,
    });

    try {
      const langRes = await this.runLangGraph(current);
      await this.transition(
        task.id,
        AI_LISTING_TASK_STATUS.LANGGRAPH_SUCCEEDED,
        {
          remark: 'LangGraph 阶段完成',
          progress_percent: 80,
          langgraph_run_id: langRes.runId,
          langgraph_result: langRes.result,
          last_error_code: null,
          last_error_message: null,
        }
      );
      const refreshed = await this.loadTaskOrThrow(task.id);
      await this.aiListingTaskSchedulerService.enqueuePersist(
        this.buildQueueDebugPayload(refreshed, 'persist', 'langgraph_succeeded')
      );
    } catch (err: any) {
      const message = err?.message || String(err);
      const latest = await this.loadTaskOrThrow(task.id);
      if (shouldRetry(latest.lang_attempt, latest.lang_max_attempts)) {
        const nextRetryAt = new Date(
          Date.now() + this.getBackoffMs(latest.lang_attempt)
        );
        await this.transition(
          task.id,
          AI_LISTING_TASK_STATUS.LANGGRAPH_RETRYING,
          {
            remark: 'LangGraph 阶段失败，等待自动重试',
            progress_percent: 62,
            last_error_code: 'LANGGRAPH_FAILED',
            last_error_message: message,
            failed_stage: 'langgraph',
            next_retry_at: nextRetryAt,
            extra: {
              attempt: latest.lang_attempt,
              max: latest.lang_max_attempts,
            },
          }
        );
        const refreshed = await this.loadTaskOrThrow(task.id);
        await this.aiListingTaskSchedulerService.enqueueLangGraph(
          this.buildQueueDebugPayload(refreshed, 'langgraph', 'langgraph_retry')
        );
        return;
      }
      await this.transition(task.id, AI_LISTING_TASK_STATUS.FAILED, {
        remark: 'LangGraph 阶段失败且达到重试上限',
        progress_percent: 100,
        last_error_code: 'LANGGRAPH_FAILED',
        last_error_message: message,
        failed_stage: 'langgraph',
        finished_at: new Date(),
      });
    }
  }

  async executePersist(taskId: number) {
    const task = await this.loadTaskOrThrow(taskId);
    if (task.status !== AI_LISTING_TASK_STATUS.LANGGRAPH_SUCCEEDED) return;
    await this.transition(task.id, AI_LISTING_TASK_STATUS.PERSISTING, {
      remark: '持久化生成结果',
      progress_percent: 90,
    });

    await this.transition(task.id, AI_LISTING_TASK_STATUS.SUCCEEDED, {
      remark: '任务完成，待 Studio 确认',
      stage: 'awaiting_review',
      progress_percent: 100,
      finished_at: new Date(),
    });
  }

  async getLatestByTarget(params: {
    task_type: AiListingTaskType;
    target_candidate_id: number;
    target_amazon_account_id?: string;
    target_variant_id?: string;
  }) {
    return this.aiListingTaskRepo.findOne({
      where: {
        task_type: params.task_type,
        target_candidate_id: Number(params.target_candidate_id),
        target_amazon_account_id: params.target_amazon_account_id || null,
        ...(params.target_variant_id
          ? { target_variant_id: params.target_variant_id }
          : {}),
      },
      order: { id: 'DESC' },
    });
  }

  async getCreateMetaBySku(sku: string) {
    const normalizedSku = String(sku || '').trim();
    if (!normalizedSku) {
      throw new Error('sku 必填');
    }
    const candidate = await this.candidateRepo.findOne({
      where: { sku: normalizedSku },
      select: ['id', 'sku', 'produce_name', 'marketplace', 'asin'],
      order: { id: 'DESC' },
    });
    if (!candidate) {
      return null;
    }

    const candidateId = Number(candidate.id);
    const [variants, purchasers] = await Promise.all([
      this.variantRepo.find({
        where: { candidate_id: candidateId },
        select: ['id', 'name', 'deleted_at'],
        order: { updateTime: 'DESC' as any },
      }),
      this.purchaserRepo.find({
        where: { candidate_id: String(candidateId) },
        select: [
          'selected_variant_id',
          'selectedVariant',
          'seller_account_id',
          'account_name',
          'msku',
        ],
      }),
    ]);

    const variantMap = new Map<
      string,
      { id: string; name: string; msku?: string }
    >();
    for (const v of variants || []) {
      if (!v?.id || v?.deleted_at) continue;
      variantMap.set(String(v.id), {
        id: String(v.id),
        name: String(v.name || ''),
      });
    }
    for (const p of purchasers || []) {
      const vid = String(p.selected_variant_id || '').trim();
      if (!vid) continue;
      const name = String(p.selectedVariant || '').trim();
      if (!variantMap.has(vid)) {
        variantMap.set(vid, {
          id: vid,
          name: name || vid,
          msku: p.msku || undefined,
        });
      } else if (p.msku) {
        const curr = variantMap.get(vid)!;
        if (!curr.msku) curr.msku = p.msku;
      }
    }
    const accountMap = new Map<string, { id: string; name: string }>();
    for (const p of purchasers || []) {
      const aid = String(p.seller_account_id || '').trim();
      if (!aid) continue;
      if (!accountMap.has(aid)) {
        accountMap.set(aid, {
          id: aid,
          name: String(p.account_name || aid),
        });
      }
    }

    return {
      candidate: {
        id: candidateId,
        sku: candidate.sku,
        produce_name: candidate.produce_name,
        marketplace: candidate.marketplace,
        asin: candidate.asin,
      },
      variants: Array.from(variantMap.values()),
      accounts: Array.from(accountMap.values()),
    };
  }

  private parsePurchaserNumUkDe(purchaserNum: any): { uk: number; de: number } {
    try {
      const raw =
        typeof purchaserNum === 'string'
          ? JSON.parse(purchaserNum || '{}')
          : purchaserNum || {};
      return {
        uk: Number(raw.uk) || 0,
        de: Number(raw.de) || 0,
      };
    } catch {
      return { uk: 0, de: 0 };
    }
  }

  /** 店铺采购 uk/de：>0 表示需生成对应英语/德语文案 */
  resolveRequiredLanguagesFromPurchasers(
    rows: AppAmzBsrCandidatePurchaserEntity[],
    sellerAccountId?: string
  ): Array<'en' | 'de'> {
    const mapped = (rows || []).map(p => {
      const { uk, de } = this.parsePurchaserNumUkDe(p.purchaserNum);
      return {
        seller_account_id: p.seller_account_id,
        uk,
        de,
      };
    });
    return resolveRequiredLanguagesFromPurchaseRows(mapped, sellerAccountId);
  }

  /** 与列表页 required_languages 同源：按选品 + 任务店铺汇总采购 uk/de */
  private async resolveShopRequiredLanguagesForTask(
    task: AiListingTaskEntity
  ): Promise<Array<'en' | 'de'>> {
    const candidateId = Number(task.target_candidate_id || 0);
    if (!candidateId) return [];
    const purchasers = await this.purchaserRepo.find({
      where: { candidate_id: String(candidateId) } as any,
      select: ['candidate_id', 'seller_account_id', 'purchaserNum'],
    });
    return this.resolveRequiredLanguagesFromPurchasers(
      purchasers,
      String(task.target_amazon_account_id || '').trim()
    );
  }

  private async batchRequiredLanguagesByShop(
    keys: Array<{ candidateId: number; accountId: string }>
  ): Promise<Map<string, Array<'en' | 'de'>>> {
    const result = new Map<string, Array<'en' | 'de'>>();
    const uniqueKeys = new Map<string, { candidateId: number; accountId: string }>();
    for (const k of keys) {
      const candidateId = Number(k.candidateId || 0);
      if (!candidateId) continue;
      const accountId = String(k.accountId || '').trim();
      const mapKey = `${candidateId}|${accountId}`;
      if (!uniqueKeys.has(mapKey)) {
        uniqueKeys.set(mapKey, { candidateId, accountId });
      }
    }
    if (!uniqueKeys.size) return result;

    const candidateIds = Array.from(
      new Set(Array.from(uniqueKeys.values()).map(x => String(x.candidateId)))
    );
    const purchasers = await this.purchaserRepo.find({
      where: { candidate_id: In(candidateIds) } as any,
      select: ['candidate_id', 'seller_account_id', 'purchaserNum'],
    });
    const byCandidate = new Map<string, AppAmzBsrCandidatePurchaserEntity[]>();
    for (const p of purchasers) {
      const cid = String(p.candidate_id || '').trim();
      if (!cid) continue;
      const bucket = byCandidate.get(cid) || [];
      bucket.push(p);
      byCandidate.set(cid, bucket);
    }

    for (const [mapKey, { candidateId, accountId }] of uniqueKeys) {
      const rows = byCandidate.get(String(candidateId)) || [];
      result.set(
        mapKey,
        this.resolveRequiredLanguagesFromPurchasers(rows, accountId)
      );
    }
    return result;
  }

  private applyAiListingTaskPageFilters(
    qb: SelectQueryBuilder<AiListingTaskEntity>,
    input: {
      phase: string;
      statusGroup: 'all' | 'running' | 'done' | 'failed' | 'cancelled';
      keyword: string;
      accountId: string;
      applicantId: string;
    }
  ) {
    const { phase, statusGroup, keyword, accountId, applicantId } = input;
    if (phase === 'queued') {
      qb.andWhere('t.status = :stQueued', {
        stQueued: AI_LISTING_TASK_STATUS.QUEUED,
      });
    } else if (phase === 'params_running') {
      qb.andWhere('t.status >= :stPrLo AND t.status < :stPrHi', {
        stPrLo: 110,
        stPrHi: 200,
      });
    } else if (phase === 'copy_running') {
      qb.andWhere('t.status >= :stCrLo AND t.status < :stCrHi', {
        stCrLo: 200,
        stCrHi: 390,
      });
    } else if (phase === 'awaiting_review') {
      qb.andWhere('t.status = :stDone390', {
        stDone390: AI_LISTING_TASK_STATUS.SUCCEEDED,
      });
      qb.andWhere(
        '(t.stage IS NULL OR t.stage NOT IN (:...reviewTerminalStages))',
        {
          reviewTerminalStages: [
            'review_approved',
            'accepted',
            'review_closed',
          ],
        }
      );
    } else if (phase === 'done') {
      qb.andWhere('t.status = :stDone390b', {
        stDone390b: AI_LISTING_TASK_STATUS.SUCCEEDED,
      });
      qb.andWhere('t.stage IN (:...reviewApprovedStages)', {
        reviewApprovedStages: ['review_approved', 'accepted'],
      });
    } else if (phase === 'closed') {
      qb.andWhere('t.status = :stClosed390', {
        stClosed390: AI_LISTING_TASK_STATUS.SUCCEEDED,
      });
      qb.andWhere('t.stage = :reviewClosedStage', {
        reviewClosedStage: 'review_closed',
      });
    } else if (phase === 'failed') {
      qb.andWhere('t.status = :stFail', {
        stFail: AI_LISTING_TASK_STATUS.FAILED,
      });
    } else if (phase === 'cancelled') {
      qb.andWhere('t.status = :stCancelled', {
        stCancelled: AI_LISTING_TASK_STATUS.CANCELLED,
      });
    } else if (statusGroup === 'running') {
      qb.andWhere('t.status >= :s1 AND t.status < :s2', { s1: 100, s2: 390 });
    } else if (statusGroup === 'done') {
      qb.andWhere('t.status = :done', { done: 390 });
    } else if (statusGroup === 'failed') {
      qb.andWhere('t.status = :failed', { failed: 900 });
    } else if (statusGroup === 'cancelled') {
      qb.andWhere('t.status = :cancelled', { cancelled: 990 });
    }

    if (keyword) {
      const kw = `%${keyword}%`;
      qb.andWhere(
        '(c.sku LIKE :kw OR c.asin LIKE :kw OR c.produce_name LIKE :kw OR t.target_amazon_account_id LIKE :kw)',
        { kw }
      );
    }
    if (accountId) {
      qb.andWhere('t.target_amazon_account_id = :accountId', { accountId });
    }
    if (applicantId) {
      if (applicantId === 'system') {
        qb.andWhere("TRIM(COALESCE(t.triggered_by, '')) = 'system'");
      } else {
        qb.andWhere('t.triggered_by = :applicantId', { applicantId });
      }
    }
  }

  private buildAiListingTaskPageSelectFields() {
    return [
      't.id AS t_id',
      't.task_type AS t_task_type',
      't.target_candidate_id AS t_target_candidate_id',
      't.target_amazon_account_id AS t_target_amazon_account_id',
      't.triggered_by AS t_triggered_by',
      't.target_variant_ids AS t_target_variant_ids',
      't.target_msku AS t_target_msku',
      't.task_mode AS t_task_mode',
      't.root_task_id AS t_root_task_id',
      't.merge_into_task_id AS t_merge_into_task_id',
      't.status AS t_status',
      't.stage AS t_stage',
      't.progress_percent AS t_progress_percent',
      't.last_error_message AS t_last_error_message',
      't.failed_stage AS t_failed_stage',
      't.go_task_id AS t_go_task_id',
      't.langgraph_run_id AS t_langgraph_run_id',
      't.langgraph_result AS t_langgraph_result',
      't.flow_context AS t_flow_context',
      't.createTime AS t_createTime',
      't.updateTime AS t_updateTime',
      'c.sku AS c_sku',
      'c.asin AS c_asin',
      'c.produce_name AS c_produce_name',
      'c.marketplace AS c_marketplace',
      'c.image_url AS c_image_url',
      'c.aliyun_img AS c_aliyun_img',
    ];
  }

  async page(params: {
    page?: number;
    size?: number;
    keyword?: string;
    statusGroup?: 'all' | 'running' | 'done' | 'failed' | 'cancelled';
    /** 与 listing-ai-copy-task-list 阶段筛选一致；若提供则优先于 statusGroup 的职位条件 */
    phase?: string;
    accountId?: string;
    applicantId?: string;
  }) {
    const pageNum = Math.max(1, Number(params.page || 1));
    const pageSize = Math.max(1, Math.min(100, Number(params.size || 20)));
    const keyword = String(params.keyword || '').trim();
    const accountId = String(params.accountId || '').trim();
    const applicantId = String(params.applicantId || '').trim();
    const statusGroup = (params.statusGroup || 'all') as
      | 'all'
      | 'running'
      | 'done'
      | 'failed'
      | 'cancelled';
    const phase = String(params.phase || '').trim();
    const filterInput = {
      phase,
      statusGroup,
      keyword,
      accountId,
      applicantId,
    };

    const countQb = this.aiListingTaskRepo
      .createQueryBuilder('t')
      .leftJoin(AppAmzBsrCandidateEntity, 'c', 'c.id = t.target_candidate_id');
    this.applyAiListingTaskPageFilters(countQb, filterInput);
    const total = await countQb.getCount();

    const idQb = this.aiListingTaskRepo
      .createQueryBuilder('t')
      .leftJoin(AppAmzBsrCandidateEntity, 'c', 'c.id = t.target_candidate_id')
      .select('t.id', 't_id')
      .orderBy('t.id', 'DESC');
    this.applyAiListingTaskPageFilters(idQb, filterInput);
    idQb.offset((pageNum - 1) * pageSize).limit(pageSize);
    const idRows = await idQb.getRawMany();
    const pageIds = idRows
      .map((r: any) => Number(r.t_id))
      .filter((id: number) => Number.isFinite(id) && id > 0);

    let rawList: any[] = [];
    if (pageIds.length) {
      rawList = await this.aiListingTaskRepo
        .createQueryBuilder('t')
        .leftJoin(
          AppAmzBsrCandidateEntity,
          'c',
          'c.id = t.target_candidate_id'
        )
        .select(this.buildAiListingTaskPageSelectFields())
        .where('t.id IN (:...pageIds)', { pageIds })
        .orderBy('t.id', 'DESC')
        .getRawMany();
    }

    const variantIds = Array.from(
      new Set(
        rawList.flatMap((r: any) =>
          Array.isArray(r.t_target_variant_ids)
            ? r.t_target_variant_ids
                .map((id: any) => String(id || '').trim())
                .filter(Boolean)
            : []
        )
      )
    );
    const variants = variantIds.length
      ? await this.variantRepo.find({
          where: { id: In(variantIds) } as any,
          select: ['id', 'name'],
        })
      : [];
    const variantNameMap = new Map<string, string>();
    for (const v of variants) {
      variantNameMap.set(
        String(v.id || '').trim(),
        String(v.name || '').trim()
      );
    }

    const accountIds = Array.from(
      new Set(
        rawList
          .map((r: any) => String(r.t_target_amazon_account_id || '').trim())
          .filter(Boolean)
      )
    );
    const sellers = accountIds.length
      ? await this.sellerRepo.find({
          where: { seller_account_id: In(accountIds) },
          select: ['seller_account_id', 'account_name'],
        })
      : [];
    const sellerNameMap = new Map<string, string>();
    for (const s of sellers) {
      sellerNameMap.set(
        String(s.seller_account_id || '').trim(),
        String(s.account_name || '').trim()
      );
    }

    const triggeredUserIds = Array.from(
      new Set(
        rawList
          .map((r: any) => String(r.t_triggered_by || '').trim())
          .filter((x: string) => /^[0-9]+$/.test(x))
          .map((x: string) => Number(x))
          .filter((n: number) => Number.isFinite(n) && n > 0)
      )
    );
    const users = triggeredUserIds.length
      ? await this.baseSysUserRepo.find({
          where: { id: In(triggeredUserIds) },
          select: ['id', 'name', 'nickName', 'username'],
        })
      : [];
    const userNameMap = new Map<number, string>();
    for (const u of users) {
      const displayName = String(
        u.name || u.nickName || u.username || ''
      ).trim();
      if (!displayName) continue;
      userNameMap.set(Number(u.id), displayName);
    }
    const requiredLangMap = await this.batchRequiredLanguagesByShop(
      rawList.map((r: any) => ({
        candidateId: Number(r.t_target_candidate_id || 0),
        accountId: String(r.t_target_amazon_account_id || '').trim(),
      }))
    );

    const list = rawList.map((r: any) => {
      const status = Number(r.t_status || 0);
      const stage = String(r.t_stage || '')
        .trim()
        .toLowerCase();
      let phase: string;
      if (status === 390) {
        if (stage === 'review_approved' || stage === 'accepted') phase = 'done';
        else if (stage === 'review_closed') phase = 'closed';
        else phase = 'awaiting_review';
      } else if (status === 900) {
        phase = 'failed';
      } else if (status === 990) {
        phase = 'cancelled';
      } else if (status >= 200) {
        phase = 'copy_running';
      } else if (status >= 100) {
        phase = 'params_running';
      } else {
        phase = 'queued';
      }
      const tb = String(r.t_triggered_by || '').trim();
      const applicantName =
        tb === 'system'
          ? '系统'
          : /^[0-9]+$/.test(tb)
          ? userNameMap.get(Number(tb)) || ''
          : '';
      const candidateImageUrl = String(
        r.c_aliyun_img || r.c_image_url || ''
      ).trim();
      const candidateId = Number(r.t_target_candidate_id || 0);
      const amazonAccountId = String(r.t_target_amazon_account_id || '').trim();
      const requiredLanguages =
        requiredLangMap.get(`${candidateId}|${amazonAccountId}`) || [];
      const pageTask = {
        id: Number(r.t_id),
        task_mode: String(r.t_task_mode || 'full'),
        status: Number(r.t_status || 0),
        langgraph_result: r.t_langgraph_result,
        flow_context: r.t_flow_context,
      } as AiListingTaskEntity;
      const langFlags = this.buildTaskLanguageActionFlags(pageTask);
      return {
        id: Number(r.t_id),
        task_type: r.t_task_type,
        task_mode: String(r.t_task_mode || 'full'),
        root_task_id:
          r.t_root_task_id != null ? Number(r.t_root_task_id) : null,
        merge_into_task_id:
          r.t_merge_into_task_id != null
            ? Number(r.t_merge_into_task_id)
            : null,
        candidate_id: Number(r.t_target_candidate_id),
        amazon_account_id: r.t_target_amazon_account_id || '',
        variant_ids: Array.isArray(r.t_target_variant_ids)
          ? r.t_target_variant_ids
          : [],
        variant_names: Array.isArray(r.t_target_variant_ids)
          ? r.t_target_variant_ids
              .map(
                (id: any) => variantNameMap.get(String(id || '').trim()) || ''
              )
              .filter(Boolean)
          : [],
        variant_count: Array.isArray(r.t_target_variant_ids)
          ? r.t_target_variant_ids.length
          : 0,
        msku:
          r.t_target_msku ||
          (Array.isArray(r.t_target_variant_ids)
            ? `${r.t_target_variant_ids.length} variants`
            : ''),
        sku: r.c_sku || '',
        asin: r.c_asin || '',
        product_title: r.c_produce_name || '',
        account_name:
          sellerNameMap.get(
            String(r.t_target_amazon_account_id || '').trim()
          ) || '',
        applicant_name: applicantName,
        candidate_image_url: candidateImageUrl,
        triggered_by: tb,
        marketplace: r.c_marketplace || '',
        status,
        stage: r.t_stage || '',
        phase,
        progress_percent: Number(r.t_progress_percent || 0),
        error_message: r.t_last_error_message || '',
        failed_stage: r.t_failed_stage || '',
        go_task_id: r.t_go_task_id || '',
        langgraph_run_id: r.t_langgraph_run_id || '',
        required_languages: requiredLanguages,
        requested_languages: langFlags.requested_languages,
        generated_languages: langFlags.generated_languages,
        language_status: langFlags.language_status,
        can_trigger_de: langFlags.can_trigger_de,
        createTime: r.t_createTime,
        updateTime: r.t_updateTime,
      };
    });
    return {
      list,
      pagination: {
        page: pageNum,
        size: pageSize,
        total,
      },
    };
  }

  async listFilters() {
    const accountIds = Array.from(
      new Set(
        (
          await this.aiListingTaskRepo
            .createQueryBuilder('t')
            .select('DISTINCT t.target_amazon_account_id', 'target_amazon_account_id')
            .where("TRIM(COALESCE(t.target_amazon_account_id, '')) <> ''")
            .getRawMany()
        )
          .map(r => String(r.target_amazon_account_id || '').trim())
          .filter(Boolean)
      )
    );
    const sellers = accountIds.length
      ? await this.sellerRepo.find({
          where: { seller_account_id: In(accountIds) },
          select: ['seller_account_id', 'account_name'],
        })
      : [];
    const sellerNameMap = new Map<string, string>();
    for (const s of sellers) {
      const id = String(s.seller_account_id || '').trim();
      if (!id) continue;
      sellerNameMap.set(id, String(s.account_name || '').trim() || id);
    }

    const applicantIds = Array.from(
      new Set(
        (
          await this.aiListingTaskRepo
            .createQueryBuilder('t')
            .select('DISTINCT t.triggered_by', 'triggered_by')
            .where("TRIM(COALESCE(t.triggered_by, '')) <> ''")
            .getRawMany()
        )
          .map(r => String(r.triggered_by || '').trim())
          .filter(Boolean)
      )
    );
    const sysUserIds = applicantIds
      .filter(id => /^[0-9]+$/.test(id))
      .map(id => Number(id))
      .filter(id => id > 0);
    const users = sysUserIds.length
      ? await this.baseSysUserRepo.find({
          where: { id: In(sysUserIds) },
          select: ['id', 'name', 'nickName', 'username'],
        })
      : [];
    const userNameMap = new Map<string, string>();
    for (const u of users) {
      const id = String(u.id || '').trim();
      const label = String(u.name || u.nickName || u.username || '').trim();
      if (id && label) userNameMap.set(id, label);
    }

    const shops = accountIds
      .map(id => ({
        value: id,
        label: sellerNameMap.get(id) || id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));

    const applicants = applicantIds
      .map(id => ({
        value: id,
        label: id === 'system' ? '系统' : userNameMap.get(id) || id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'));

    return {
      shops,
      applicants,
    };
  }

  async getTimeline(id: number) {
    const row = await this.aiListingTaskRepo.findOne({
      where: { id: Number(id) },
      select: ['id', 'timeline', 'updateTime'],
    });
    if (!row) throw new Error('任务不存在');
    return {
      id: Number(row.id),
      timeline: Array.isArray(row.timeline) ? row.timeline : [],
      updateTime: row.updateTime,
    };
  }

  async getStatus(id: number) {
    const task = await this.loadTaskOrThrow(id);
    const aid = String(task.target_amazon_account_id ?? '').trim();
    let accountName = '';
    if (aid) {
      const seller = await this.sellerRepo.findOne({
        where: { seller_account_id: aid },
      });
      accountName = String(seller?.account_name ?? '').trim();
    }

    let candidateImageUrl = '';
    let candidateAsin = '';
    let candidateSku = '';
    let candidateMarketplace = '';
    let candidateProductTitle = '';
    if (task.target_candidate_id) {
      const cand = await this.candidateRepo.findOne({
        where: { id: task.target_candidate_id },
        select: [
          'image_url',
          'aliyun_img',
          'asin',
          'sku',
          'marketplace',
          'produce_name',
        ] as any,
      } as any);
      candidateImageUrl = String(
        cand?.aliyun_img || cand?.image_url || ''
      ).trim();
      candidateAsin = String(cand?.asin || '').trim();
      candidateSku = String(cand?.sku || '').trim();
      candidateMarketplace = String(cand?.marketplace || '').trim();
      candidateProductTitle = String(cand?.produce_name || '').trim();
    }

    const tb = String(task.triggered_by || '').trim();
    let applicantName = '';
    if (tb === 'system') {
      applicantName = '系统';
    } else if (/^[0-9]+$/.test(tb)) {
      const user = await this.baseSysUserRepo.findOne({
        where: { id: Number(tb) },
      });
      applicantName = String(
        user?.name || user?.nickName || user?.username || ''
      ).trim();
    }

    let requiredLanguages: Array<'en' | 'de'> = [];
    if (task.target_candidate_id) {
      const purchasers = await this.purchaserRepo.find({
        where: { candidate_id: String(task.target_candidate_id) } as any,
        select: ['candidate_id', 'seller_account_id', 'purchaserNum'],
      });
      requiredLanguages = this.resolveRequiredLanguagesFromPurchasers(
        purchasers,
        aid
      );
    }

    return this.attachTaskLanguageMeta(
      Object.assign({}, task, {
        account_name: accountName,
        candidate_image_url: candidateImageUrl,
        applicant_name: applicantName,
        asin: candidateAsin,
        sku: candidateSku,
        marketplace: candidateMarketplace,
        product_title: candidateProductTitle,
        required_languages: requiredLanguages,
      })
    );
  }

  async cancel(id: number) {
    const task = await this.loadTaskOrThrow(id);
    if (!AI_LISTING_ACTIVE_STATUS.has(task.status)) {
      throw new Error('仅运行中任务可取消');
    }
    return this.transition(id, AI_LISTING_TASK_STATUS.CANCELLED, {
      remark: '手动取消任务',
      progress_percent: 100,
      finished_at: new Date(),
    });
  }

  /** 与 LangGraph 落库一致：{ bullet_point, retry_count } */
  private normalizeReviewBullets(existing: any, bullets: string[]) {
    const lines = (bullets || []).map(b => String(b ?? '').trim()).slice(0, 5);
    while (lines.length < 5) lines.push('');
    const existingArr = Array.isArray(existing) ? existing : [];
    return lines.map((text, i) => {
      const prev = existingArr[i];
      const retry_count =
        prev && typeof prev === 'object' && !Array.isArray(prev)
          ? Number((prev as any).retry_count || 0)
          : 0;
      return { bullet_point: text, retry_count };
    });
  }

  private applyReviewTitleToBaseCopy(existing: any, title: string) {
    const t = String(title || '').trim();
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      return { ...existing, title: t };
    }
    return t;
  }

  private buildVariantTitlesFromReview(
    baseTitle: string,
    variantSuffixes: Record<string, string>,
    variantIds: string[],
    fallbackVariantTitles: Record<string, string> = {}
  ) {
    const normalizedBaseTitle = String(baseTitle || '').trim();
    assertMasterTitleLength(normalizedBaseTitle, '母版');
    const suffixList = variantIds.map(id => {
      if (Object.prototype.hasOwnProperty.call(variantSuffixes, id)) {
        const custom = String(variantSuffixes[id] ?? '').trim();
        const normalized = custom === '-' ? '' : custom;
        if (normalized) {
          assertVariantTitleSuffixRoundTrip(
            normalizedBaseTitle,
            normalized,
            '变体',
            id
          );
        }
        return normalized;
      }
      return extractVariantTitleSuffix(
        String(fallbackVariantTitles[id] || ''),
        normalizedBaseTitle
      );
    });
    const variantTitles: Record<string, string> = {};
    for (let idx = 0; idx < variantIds.length; idx++) {
      const variantId = variantIds[idx];
      const suffix = suffixList[idx] || '';
      variantTitles[variantId] = suffix
        ? `${normalizedBaseTitle}(${suffix})`
        : normalizedBaseTitle;
    }
    return variantTitles;
  }

  private patchLangReviewCopy(
    lane: Record<string, any>,
    patch: {
      title?: string;
      bullets?: string[];
      description?: string;
      variantSuffixes?: Record<string, string>;
      /** 内容工作台：直接写入完整变体标题 */
      variantFullTitles?: Record<string, string>;
      /** 内容工作台按变体保存卖点/描述时传入 */
      variantId?: string;
    },
    variantIds: string[]
  ) {
    const laneOut = { ...(lane || {}) };
    const baseCopyRaw = laneOut.base_copy;
    let baseCopy: Record<string, any> =
      baseCopyRaw &&
      typeof baseCopyRaw === 'object' &&
      !Array.isArray(baseCopyRaw)
        ? { ...(baseCopyRaw as Record<string, any>) }
        : { title: String(baseCopyRaw || '') };

    if (patch.title !== undefined) {
      const nextTitle = this.applyReviewTitleToBaseCopy(baseCopy, patch.title);
      baseCopy =
        typeof nextTitle === 'string'
          ? { ...(baseCopy as Record<string, any>), title: nextTitle }
          : (nextTitle as Record<string, any>);
    }
    const variantId = String(patch.variantId || '').trim();
    const useVariantScopedCopy =
      Boolean(variantId) &&
      (patch.bullets !== undefined || patch.description !== undefined);
    if (useVariantScopedCopy) {
      const variantCopyMap = {
        ...((laneOut.variant_copy || {}) as Record<string, any>),
      };
      const prev = (variantCopyMap[variantId] || {}) as Record<string, any>;
      const next: Record<string, any> = { ...prev };
      if (patch.description !== undefined) {
        next.description = String(patch.description || '').trim();
      }
      if (patch.bullets !== undefined) {
        next.bullet_points = this.normalizeReviewBullets(
          prev.bullet_points,
          patch.bullets
        );
      }
      variantCopyMap[variantId] = next;
      laneOut.variant_copy = variantCopyMap;
    } else {
      if (patch.description !== undefined) {
        baseCopy.description = String(patch.description || '').trim();
      }
      if (patch.bullets !== undefined) {
        baseCopy.bullet_points = this.normalizeReviewBullets(
          baseCopy.bullet_points,
          patch.bullets
        );
      }
    }
    laneOut.base_copy = baseCopy;

    const baseTitle = String(
      typeof baseCopy.title === 'string'
        ? baseCopy.title
        : (baseCopy.title as any)?.title || ''
    ).trim();
    const existingVt = (laneOut.variant_titles || {}) as Record<string, string>;
    const ids = variantIds.length
      ? variantIds
      : Array.from(
          new Set([
            ...Object.keys(existingVt),
            ...Object.keys(patch.variantSuffixes || {}),
            ...Object.keys(patch.variantFullTitles || {}),
          ])
        );
    const variantFullTitles = (patch.variantFullTitles || {}) as Record<
      string,
      string
    >;
    if (Object.keys(variantFullTitles).length) {
      const nextVt = { ...existingVt };
      for (const [id, full] of Object.entries(variantFullTitles)) {
        const key = String(id || '').trim();
        if (!key) continue;
        nextVt[key] = String(full ?? '').trim();
      }
      laneOut.variant_titles = nextVt;
    } else if (patch.title !== undefined || patch.variantSuffixes) {
      laneOut.variant_titles = this.buildVariantTitlesFromReview(
        baseTitle,
        patch.variantSuffixes || {},
        ids,
        existingVt
      );
    }
    return laneOut;
  }

  /**
   * 内容工作台编辑刊登文案：写入 langgraph_result，不要求任务仍处于待审核。
   */
  async saveStudioListingCopy(
    id: number,
    copy?: {
      en?: {
        title?: string;
        bullets?: string[];
        description?: string;
        variantSuffixes?: Record<string, string>;
        variantFullTitles?: Record<string, string>;
        variantId?: string;
      };
      de?: {
        title?: string;
        bullets?: string[];
        description?: string;
        variantSuffixes?: Record<string, string>;
        variantFullTitles?: Record<string, string>;
        variantId?: string;
      };
    }
  ) {
    if (!copy?.en && !copy?.de) {
      return this.loadTaskOrThrow(id);
    }
    if (copy?.en?.title !== undefined) {
      assertMasterTitleLength(copy.en.title, '英语');
    }
    if (copy?.de?.title !== undefined) {
      assertMasterTitleLength(copy.de.title, '德语');
    }
    await this.applyReviewCopyEdits(id, copy);
    return this.loadTaskOrThrow(id);
  }

  async applyReviewCopyEdits(
    id: number,
    copy?: {
      en?: {
        title?: string;
        bullets?: string[];
        description?: string;
        variantSuffixes?: Record<string, string>;
        variantFullTitles?: Record<string, string>;
        variantId?: string;
      };
      de?: {
        title?: string;
        bullets?: string[];
        description?: string;
        variantSuffixes?: Record<string, string>;
        variantFullTitles?: Record<string, string>;
        variantId?: string;
      };
    }
  ) {
    if (!copy?.en && !copy?.de) return;
    const task = await this.loadTaskOrThrow(id);
    const langgraph = {
      ...(((task.langgraph_result || {}) as Record<string, any>) || {}),
    };
    const variantIds = Array.isArray(task.target_variant_ids)
      ? task.target_variant_ids.map(v => String(v))
      : [];

    if (copy.en) {
      langgraph.en = this.patchLangReviewCopy(
        (langgraph.en || {}) as Record<string, any>,
        copy.en,
        variantIds
      );
    }
    if (copy.de) {
      langgraph.de = this.patchLangReviewCopy(
        (langgraph.de || {}) as Record<string, any>,
        copy.de,
        variantIds
      );
    }

    await this.aiListingTaskRepo.update(id, {
      langgraph_result: langgraph,
    } as any);
  }

  /** 人工审核页提交体：保存草稿与审核通过共用 */
  private async persistReviewSubmitPayload(
    id: number,
    copy?: {
      en?: {
        title?: string;
        bullets?: string[];
        description?: string;
        variantSuffixes?: Record<string, string>;
      };
      de?: {
        title?: string;
        bullets?: string[];
        description?: string;
        variantSuffixes?: Record<string, string>;
      };
    },
    warningWordIgnores?: {
      en?: Record<string, boolean>;
      de?: Record<string, boolean>;
    },
    extraRowPatch?: Record<string, any>
  ) {
    if (copy?.en?.title !== undefined) {
      assertMasterTitleLength(copy.en.title, '英语');
    }
    if (copy?.de?.title !== undefined) {
      assertMasterTitleLength(copy.de.title, '德语');
    }
    if (copy?.en || copy?.de) {
      await this.applyReviewCopyEdits(id, copy);
    }
    const task = await this.loadTaskOrThrow(id);
    const prevFlow = ((task.flow_context || {}) as Record<string, any>) || {};
    const flow_context = {
      ...prevFlow,
      review_warning_word_ignores:
        this.normalizeReviewWarningWordIgnores(warningWordIgnores),
    };
    await this.aiListingTaskRepo.update(id, {
      flow_context,
      ...(extraRowPatch || {}),
    } as any);
    return this.loadTaskOrThrow(id);
  }

  private assertTaskAwaitingHumanReview(
    task: AiListingTaskEntity,
    actionLabel: string
  ) {
    if (Number(task.status) !== AI_LISTING_TASK_STATUS.SUCCEEDED) {
      throw new Error(`仅待确认任务可${actionLabel}`);
    }
  }

  private assertTaskNotReviewApproved(
    task: AiListingTaskEntity,
    actionLabel: string
  ) {
    if (!isAiListingReviewTerminalStage(task.stage)) return;
    const stage = String(task.stage || '')
      .trim()
      .toLowerCase();
    if (stage === 'review_closed') {
      throw new Error(`任务已关闭，无法${actionLabel}`);
    }
    throw new Error(`任务已审核通过，无法${actionLabel}`);
  }

  /**
   * 人工关闭待确认任务：status 保持 390，stage=review_closed。
   * 与工作台「审核通过」一样视为文案完成，不阻塞后续任务。
   */
  async closeReview(id: number) {
    const task = await this.loadTaskOrThrow(id);
    this.assertTaskAwaitingHumanReview(task, '关闭');
    this.assertTaskNotReviewApproved(task, '关闭');
    const now = new Date();
    await this.aiListingTaskRepo.update(id, {
      stage: 'review_closed',
      progress_percent: 100,
      finished_at: now,
    } as any);
    const refreshed = await this.loadTaskOrThrow(id);
    await this.appendAiListingTimeline(refreshed, {
      status: AI_LISTING_TASK_STATUS.SUCCEEDED,
      stage: 'review_closed',
      remark: '人工关闭任务，跳过 Studio 确认',
    });
    return this.aiListingTaskRepo.save(refreshed);
  }

  private normalizeReviewWarningWordIgnores(
    raw?: Record<string, any> | null
  ): { en: Record<string, true>; de: Record<string, true> } {
    const out: { en: Record<string, true>; de: Record<string, true> } = {
      en: {},
      de: {},
    };
    if (!raw || typeof raw !== 'object') return out;
    for (const locale of ['en', 'de'] as const) {
      const block = raw[locale];
      if (!block || typeof block !== 'object') continue;
      for (const [key, val] of Object.entries(block)) {
        const k = String(key || '').trim();
        if (!k || !val) continue;
        out[locale][k] = true;
      }
    }
    return out;
  }

  /**
   * 保存人工审核草稿（文案 + 警告词忽略），不改变任务 stage。
   */
  async saveReviewDraft(
    id: number,
    copy?: {
      en?: {
        title?: string;
        bullets?: string[];
        description?: string;
        variantSuffixes?: Record<string, string>;
      };
      de?: {
        title?: string;
        bullets?: string[];
        description?: string;
        variantSuffixes?: Record<string, string>;
      };
    },
    warningWordIgnores?: {
      en?: Record<string, boolean>;
      de?: Record<string, boolean>;
    }
  ) {
    const task = await this.loadTaskOrThrow(id);
    this.assertTaskAwaitingHumanReview(task, '保存草稿');
    this.assertTaskNotReviewApproved(task, '保存草稿');
    const refreshed = await this.persistReviewSubmitPayload(
      id,
      copy,
      warningWordIgnores
    );
    await this.appendAiListingTimeline(refreshed, {
      status: AI_LISTING_TASK_STATUS.SUCCEEDED,
      stage: String(refreshed.stage || 'awaiting_review'),
      remark: '保存审核草稿',
    });
    return this.aiListingTaskRepo.save(refreshed);
  }

  async approve(
    id: number,
    copy?: {
      en?: {
        title?: string;
        bullets?: string[];
        description?: string;
        variantSuffixes?: Record<string, string>;
      };
      de?: {
        title?: string;
        bullets?: string[];
        description?: string;
        variantSuffixes?: Record<string, string>;
      };
    },
    warningWordIgnores?: {
      en?: Record<string, boolean>;
      de?: Record<string, boolean>;
    }
  ) {
    const task = await this.loadTaskOrThrow(id);
    this.assertTaskAwaitingHumanReview(task, '审核通过');
    this.assertTaskNotReviewApproved(task, '审核通过');
    const refreshed = await this.persistReviewSubmitPayload(
      id,
      copy,
      warningWordIgnores,
      {
        // 390 保持不变，使用 stage 区分“待确认/已完成”
        stage: 'review_approved',
        progress_percent: 100,
        finished_at: new Date(),
      }
    );
    await this.appendAiListingTimeline(refreshed, {
      status: AI_LISTING_TASK_STATUS.SUCCEEDED,
      stage: 'review_approved',
      remark: '人工审核通过，任务已完成',
    });
    return this.aiListingTaskRepo.save(refreshed);
  }

  async triggerDe(id: number, operatorId?: string) {
    const task = await this.loadTaskOrThrow(id);
    if (String((task as any).task_mode || 'full') !== 'full') {
      throw new Error('仅主任务支持补触发德国文案');
    }
    if (AI_LISTING_ACTIVE_STATUS.has(Number(task.status))) {
      throw new Error('任务运行中，请稍后再试');
    }
    if (!this.hasLanggraphCopyForLang(task, 'en')) {
      throw new Error('英文文案尚未生成，无法补触发德文');
    }
    if (this.hasLanggraphCopyForLang(task, 'de')) {
      return {
        skipped: true,
        reason: 'de_already_generated' as const,
        taskId: task.id,
        task: this.attachTaskLanguageMeta(task),
      };
    }

    const flow = this.getTaskFlowContext(task);
    const languageStatus = this.getTaskLanguageStatus(task);
    if (languageStatus.de === 'running') {
      return {
        skipped: true,
        reason: 'de_already_running' as const,
        taskId: task.id,
        task: this.attachTaskLanguageMeta(task),
      };
    }

    const requested = Array.from(
      new Set<AiListingLang>([
        ...this.resolveRequestedLanguagesFromTask(task),
        'de',
      ])
    );
    languageStatus.de = 'pending';

    const nextFlow = {
      ...flow,
      input: {
        ...(flow.input || {}),
        requested_languages: requested,
      },
      language_status: languageStatus,
      only_languages: ['de'],
      supplement_de: true,
    };

    const fromStatus = Number(task.status);
    if (fromStatus === AI_LISTING_TASK_STATUS.SUCCEEDED) {
      await this.transition(task.id, AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING, {
        remark: '手动补触发德国文案',
        stage: 'langgraph_running',
        progress_percent: 50,
        finished_at: null,
        failed_stage: null,
        last_error_code: null,
        last_error_message: null,
        flow_context: nextFlow,
        extra: { only_languages: ['de'], operator: operatorId || this.getOperatorId() },
      });
    } else {
      await this.aiListingTaskRepo.update(task.id, {
        flow_context: nextFlow,
        failed_stage: null,
        last_error_code: null,
        last_error_message: null,
      } as any);
      const mid = await this.loadTaskOrThrow(task.id);
      await this.appendAiListingTimeline(mid, {
        remark: '手动补触发德国文案（任务重入队）',
        extra: { only_languages: ['de'] },
      });
      await this.aiListingTaskRepo.save(mid);
      if (
        fromStatus === AI_LISTING_TASK_STATUS.FAILED ||
        fromStatus === AI_LISTING_TASK_STATUS.QUEUED
      ) {
        await this.transition(task.id, AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING, {
          remark: '手动补触发德国文案',
          progress_percent: 50,
          flow_context: nextFlow,
        });
      }
    }

    const refreshed = await this.loadTaskOrThrow(task.id);
    await this.aiListingTaskSchedulerService.enqueueAIListingGenerator(
      this.buildQueueDebugPayload(refreshed, 'generate', 'trigger_de')
    );
    return {
      skipped: false,
      taskId: refreshed.id,
      task: this.attachTaskLanguageMeta(refreshed),
    };
  }

  async retry(
    id: number,
    options?: {
      force_low_keywords?: boolean;
      requested_languages?: AiListingLang[];
      reference_source_type?: AiListingReferenceSourceType;
      manual_reference_bullets?: string[];
      manual_reference_notes?: string;
      manual_reference_title?: string;
      reference_competitor_asins?: ReferenceCompetitorAsinsByCountryInput;
    }
  ) {
    const task = await this.loadTaskOrThrow(id);
    const prevFlow = ((task.flow_context || {}) as Record<string, any>) || {};
    const forceLowKeywords = Boolean(options?.force_low_keywords);
    const {
      only_languages: _only,
      supplement_de: _sup,
      keyword_stage_by_lang: _ks,
      flow_context_by_lang: _fc,
      output: _out,
      ...flowRest
    } = prevFlow as Record<string, any>;
    const prevInput = (flowRest.input || {}) as Record<string, any>;
    let requestedLanguages = this.resolveRequestedLanguagesFromTask(task);
    if (Array.isArray(options?.requested_languages)) {
      requestedLanguages = normalizeRequestedLanguages(
        options.requested_languages
      );
      if (!requestedLanguages.length) {
        throw new Error('当前店铺未配置英/德采购，无法生成文案');
      }
    }
    const referenceSourceType = normalizeReferenceSourceType(
      options?.reference_source_type ?? prevInput.reference_source_type
    );
    const referenceCompetitorAsins = normalizeReferenceCompetitorAsinsByCountry(
      options?.reference_competitor_asins ?? prevInput.reference_competitor_asins
    );
    if (
      referenceSourceType === 'competitor' &&
      String((task as any).task_mode || 'full') !== 'delta'
    ) {
      const preflightScope = this.resolvePreflightRequiredLanguages({
        ...task,
        flow_context: {
          ...flowRest,
          input: {
            ...prevInput,
            requested_languages: requestedLanguages,
          },
        },
      } as AiListingTaskEntity);
      const selectionIssues = validateReferenceCompetitorSelectionForLanguages(
        referenceCompetitorAsins,
        preflightScope
      );
      if (selectionIssues.length) {
        throw new Error(selectionIssues.join('；'));
      }
    }
    const manualReferenceBullets =
      referenceSourceType === 'manual_bullets'
        ? normalizeManualReferenceBullets(
            options?.manual_reference_bullets ??
              prevInput.manual_reference_bullets
          )
        : [];
    const manualReferenceNotes = String(
      options?.manual_reference_notes ?? prevInput.manual_reference_notes ?? ''
    ).trim();
    const manualReferenceTitle = String(
      options?.manual_reference_title ?? prevInput.manual_reference_title ?? ''
    ).trim();
    const flow_context = {
      ...flowRest,
      input: {
        ...prevInput,
        requested_languages: requestedLanguages,
        reference_source_type: referenceSourceType,
        manual_reference_bullets: manualReferenceBullets,
        manual_reference_notes: manualReferenceNotes,
        manual_reference_title: manualReferenceTitle,
        reference_competitor_asins: referenceCompetitorAsins,
      },
      language_status: buildInitialLanguageStatus(requestedLanguages),
      preflight: {
        ...(prevFlow.preflight || {}),
        force_low_keywords: forceLowKeywords,
      },
    };
    await this.aiListingTaskRepo.update(id, {
      status: AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING,
      stage: stageByStatus(AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING),
      progress_percent: 10,
      failed_stage: null,
      last_error_code: null,
      last_error_message: null,
      next_retry_at: null,
      finished_at: null,
      go_task_id: null,
      langgraph_run_id: null,
      keyword_result: {} as any,
      langgraph_result: {} as any,
      flow_context,
    } as any);
    const refreshed = await this.loadTaskOrThrow(id);
    await this.appendAiListingTimeline(refreshed, {
      status: AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING,
      stage: stageByStatus(AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING),
      remark: this.buildPreflightRetryRemark(refreshed, forceLowKeywords),
      extra: {
        force_low_keywords: forceLowKeywords,
        requested_languages: requestedLanguages,
        reference_source_type: referenceSourceType,
      },
    });
    await this.aiListingTaskRepo.save(refreshed);
    await this.aiListingTaskSchedulerService.enqueueAIListingGenerator(
      this.buildQueueDebugPayload(refreshed, 'generate', 'manual_retry')
    );
    return refreshed;
  }
}
