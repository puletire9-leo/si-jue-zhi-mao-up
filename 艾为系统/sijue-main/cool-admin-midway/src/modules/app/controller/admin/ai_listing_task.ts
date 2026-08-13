import { BaseController, CoolController } from '@cool-midway/core';
import { Body, Get, Inject, Param, Post, Query } from '@midwayjs/decorator';
import {
  AiListingTaskEntity,
  AI_LISTING_TASK_TYPE,
} from '../../entity/ai_listing_task';
import { AiListingTaskService } from '../../service/ai_listing_task';
import { ReferenceCompetitorAsinsByCountryInput } from '../../service/ai_listing_task_policy';
import { BaiduTranslateService } from '../../service/baidu_translate';

@CoolController({
  api: [],
  entity: AiListingTaskEntity,
})
export class AdminAiListingTaskController extends BaseController {
  @Inject()
  aiListingTaskService: AiListingTaskService;

  @Inject()
  baiduTranslateService: BaiduTranslateService;

  @Post('/run')
  async run(
    @Body('task_type') taskType: string,
    @Body('target_candidate_id') targetCandidateId: number,
    @Body('target_amazon_account_id') targetAmazonAccountId?: string,
    @Body('target_variant_ids') targetVariantIds?: string[],
    @Body('country_code') countryCode?: string,
    @Body('target_msku') targetMsku?: string,
    @Body('reference_source_type') referenceSourceType?: string,
    @Body('manual_reference_bullets') manualReferenceBullets?: string[],
    @Body('manual_reference_notes') manualReferenceNotes?: string,
    @Body('manual_reference_title') manualReferenceTitle?: string
  ) {
    const result = await this.aiListingTaskService.createAndDispatch({
      task_type: taskType as any,
      target_candidate_id: Number(targetCandidateId),
      target_amazon_account_id: targetAmazonAccountId,
      target_variant_ids: Array.isArray(targetVariantIds)
        ? targetVariantIds
        : [],
      country_code: String(countryCode || 'uk')
        .trim()
        .toLowerCase(),
      target_msku: targetMsku,
      reference_source_type: referenceSourceType as any,
      manual_reference_bullets: Array.isArray(manualReferenceBullets)
        ? manualReferenceBullets
        : [],
      manual_reference_notes: String(manualReferenceNotes || '').trim(),
      manual_reference_title: String(manualReferenceTitle || '').trim(),
      action: 'run',
    });
    return this.ok({
      reused: result.reused,
      taskId: result.task.id,
      status: result.task.status,
      task_type: result.task.task_type,
    });
  }

  @Get('/latest')
  async latest(
    @Query('task_type') taskType: string,
    @Query('target_candidate_id') targetCandidateId: number,
    @Query('target_amazon_account_id') targetAmazonAccountId?: string,
    @Query('target_variant_id') targetVariantId?: string
  ) {
    const resolvedTaskType = (taskType ||
      AI_LISTING_TASK_TYPE.SIMPLE_VARIANT) as any;
    const row = await this.aiListingTaskService.getLatestByTarget({
      task_type: resolvedTaskType,
      target_candidate_id: Number(targetCandidateId),
      target_amazon_account_id: targetAmazonAccountId,
      target_variant_id: targetVariantId,
    });
    return this.ok(row || null);
  }

  @Get('/createMetaBySku')
  async createMetaBySku(@Query('sku') sku: string) {
    const data = await this.aiListingTaskService.getCreateMetaBySku(sku);
    return this.ok(data);
  }

  @Get('/page')
  async page(
    @Query('page') page = 1,
    @Query('size') size = 20,
    @Query('keyword') keyword?: string,
    @Query('statusGroup')
    statusGroup?: 'all' | 'running' | 'done' | 'failed' | 'cancelled',
    @Query('phase') phase?: string,
    @Query('accountId') accountId?: string,
    @Query('applicantId') applicantId?: string
  ) {
    const data = await this.aiListingTaskService.page({
      page: Number(page),
      size: Number(size),
      keyword,
      statusGroup,
      phase: phase ? String(phase).trim() : undefined,
      accountId: String(accountId || '').trim() || undefined,
      applicantId: String(applicantId || '').trim() || undefined,
    });
    return this.ok(data);
  }

  /**
   * cool-admin-vue BaseService.page() 默认 POST；若仅有 @Get('/page')，请求会落到
   * BaseController.page() 走通用实体分页，导致一页条数与业务接口不一致。
   */
  @Post('/page')
  async pagePost(
    @Body('page') page = 1,
    @Body('size') size = 20,
    @Body('keyword') keyword?: string,
    @Body('statusGroup')
    statusGroup?: 'all' | 'running' | 'done' | 'failed' | 'cancelled',
    @Body('phase') phase?: string,
    @Body('accountId') accountId?: string,
    @Body('applicantId') applicantId?: string
  ) {
    const data = await this.aiListingTaskService.page({
      page: Number(page),
      size: Number(size),
      keyword,
      statusGroup,
      phase: phase ? String(phase).trim() : undefined,
      accountId: String(accountId || '').trim() || undefined,
      applicantId: String(applicantId || '').trim() || undefined,
    });
    return this.ok(data);
  }

  @Get('/filters')
  async filters() {
    const data = await this.aiListingTaskService.listFilters();
    return this.ok(data);
  }

  @Get('/:id/status')
  async status(@Param('id') id: number) {
    const row = await this.aiListingTaskService.getStatus(Number(id));
    return this.ok(row);
  }

  @Get('/:id/preflightParams')
  async preflightParams(@Param('id') id: number) {
    const data = await this.aiListingTaskService.getPreflightParams(Number(id));
    return this.ok(data);
  }

  // EPS 兼容 query 版，前端可直接 request 这个路径
  @Get('/preflightParams')
  async preflightParamsByQuery(@Query('id') id: number) {
    const data = await this.aiListingTaskService.getPreflightParams(Number(id));
    return this.ok(data);
  }

  @Post('/preflightVariants')
  async updatePreflightVariants(
    @Body('id') id: number,
    @Body('variants')
    variants?: Array<{ id?: string; name?: string; description?: string }>
  ) {
    const data = await this.aiListingTaskService.updatePreflightVariants(
      Number(id),
      Array.isArray(variants) ? variants : []
    );
    return this.ok(data);
  }

  @Post('/preflightReference')
  async updatePreflightReference(
    @Body('id') id: number,
    @Body('reference_source_type') referenceSourceType?: string,
    @Body('manual_reference_bullets') manualReferenceBullets?: string[],
    @Body('manual_reference_notes') manualReferenceNotes?: string,
    @Body('manual_reference_title') manualReferenceTitle?: string,
    @Body('reference_competitor_asins')
    referenceCompetitorAsins?: ReferenceCompetitorAsinsByCountryInput
  ) {
    const data = await this.aiListingTaskService.updatePreflightReferenceInput(
      Number(id),
      {
        reference_source_type: referenceSourceType as any,
        manual_reference_bullets: Array.isArray(manualReferenceBullets)
          ? manualReferenceBullets
          : undefined,
        manual_reference_notes: String(manualReferenceNotes || '').trim(),
        manual_reference_title: String(manualReferenceTitle || '').trim(),
        reference_competitor_asins: referenceCompetitorAsins,
      }
    );
    return this.ok(data);
  }

  @Post('/preflightCompetitor')
  async addPreflightCompetitor(
    @Body('id') id: number,
    @Body('country_code') countryCode: string,
    @Body('asin') asin: string
  ) {
    const data = await this.aiListingTaskService.addPreflightCompetitorByAsin(
      Number(id),
      String(countryCode || ''),
      String(asin || '')
    );
    return this.ok(data);
  }

  @Post('/preflightCompetitorRefresh')
  async refreshPreflightCompetitor(
    @Body('id') id: number,
    @Body('competitor_id') competitorId: number
  ) {
    const data = await this.aiListingTaskService.refreshPreflightCompetitorData(
      Number(id),
      Number(competitorId)
    );
    return this.ok(data);
  }

  // EPS 会把 '/:id/status' 生成成 '/status' 方法，补 query 版兼容前端 service
  @Get('/status')
  async statusByQuery(@Query('id') id: number) {
    const row = await this.aiListingTaskService.getStatus(Number(id));
    return this.ok(row);
  }

  @Get('/:id/timeline')
  async timeline(@Param('id') id: number) {
    const data = await this.aiListingTaskService.getTimeline(Number(id));
    return this.ok(data);
  }

  @Get('/timeline')
  async timelineByQuery(@Query('id') id: number) {
    const data = await this.aiListingTaskService.getTimeline(Number(id));
    return this.ok(data);
  }

  @Post('/timeline')
  async timelineByBody(@Body('id') id: number) {
    const data = await this.aiListingTaskService.getTimeline(Number(id));
    return this.ok(data);
  }

  @Post('/:id/retry')
  async retry(
    @Param('id') id: number,
    @Body('force_low_keywords') forceLowKeywords?: boolean,
    @Body('requested_languages') requestedLanguages?: string[],
    @Body('reference_source_type') referenceSourceType?: string,
    @Body('manual_reference_bullets') manualReferenceBullets?: string[],
    @Body('manual_reference_notes') manualReferenceNotes?: string,
    @Body('manual_reference_title') manualReferenceTitle?: string,
    @Body('reference_competitor_asins')
    referenceCompetitorAsins?: ReferenceCompetitorAsinsByCountryInput
  ) {
    const langs = Array.isArray(requestedLanguages)
      ? (requestedLanguages as Array<'en' | 'de'>)
      : undefined;
    const row = await this.aiListingTaskService.retry(Number(id), {
      force_low_keywords: Boolean(forceLowKeywords),
      requested_languages: langs,
      reference_source_type: referenceSourceType as any,
      manual_reference_bullets: Array.isArray(manualReferenceBullets)
        ? manualReferenceBullets
        : [],
      manual_reference_notes: String(manualReferenceNotes || '').trim(),
      manual_reference_title: String(manualReferenceTitle || '').trim(),
      reference_competitor_asins: referenceCompetitorAsins,
    });
    return this.ok({
      taskId: row.id,
      status: row.status,
      force_low_keywords: Boolean(forceLowKeywords),
      requested_languages: langs,
    });
  }

  // EPS builder 会忽略 '/:id/retry' 这种路径，补一个 body 版以便前端 service 自动生成 retry 方法
  @Post('/retry')
  async retryByBody(
    @Body('id') id: number,
    @Body('force_low_keywords') forceLowKeywords?: boolean,
    @Body('requested_languages') requestedLanguages?: string[],
    @Body('reference_source_type') referenceSourceType?: string,
    @Body('manual_reference_bullets') manualReferenceBullets?: string[],
    @Body('manual_reference_notes') manualReferenceNotes?: string,
    @Body('manual_reference_title') manualReferenceTitle?: string,
    @Body('reference_competitor_asins')
    referenceCompetitorAsins?: ReferenceCompetitorAsinsByCountryInput
  ) {
    const langs = Array.isArray(requestedLanguages)
      ? (requestedLanguages as Array<'en' | 'de'>)
      : undefined;
    const row = await this.aiListingTaskService.retry(Number(id), {
      force_low_keywords: Boolean(forceLowKeywords),
      requested_languages: langs,
      reference_source_type: referenceSourceType as any,
      manual_reference_bullets: Array.isArray(manualReferenceBullets)
        ? manualReferenceBullets
        : [],
      manual_reference_notes: String(manualReferenceNotes || '').trim(),
      manual_reference_title: String(manualReferenceTitle || '').trim(),
      reference_competitor_asins: referenceCompetitorAsins,
    });
    return this.ok({
      taskId: row.id,
      status: row.status,
      force_low_keywords: Boolean(forceLowKeywords),
      requested_languages: langs,
    });
  }

  @Post('/:id/triggerDe')
  async triggerDe(@Param('id') id: number) {
    const result = await this.aiListingTaskService.triggerDe(Number(id));
    return this.ok(result);
  }

  @Post('/triggerDe')
  async triggerDeByBody(@Body('id') id: number) {
    const result = await this.aiListingTaskService.triggerDe(Number(id));
    return this.ok(result);
  }

  @Post('/:id/cancel')
  async cancel(@Param('id') id: number) {
    const row = await this.aiListingTaskService.cancel(Number(id));
    return this.ok({
      taskId: row.id,
      status: row.status,
    });
  }

  @Post('/cancel')
  async cancelByBody(@Body('id') id: number) {
    const row = await this.aiListingTaskService.cancel(Number(id));
    return this.ok({
      taskId: row.id,
      status: row.status,
    });
  }

  @Post('/:id/closeReview')
  async closeReview(@Param('id') id: number) {
    const row = await this.aiListingTaskService.closeReview(Number(id));
    return this.ok({
      taskId: row.id,
      status: row.status,
      stage: row.stage,
    });
  }

  @Post('/closeReview')
  async closeReviewByBody(@Body('id') id: number) {
    const row = await this.aiListingTaskService.closeReview(Number(id));
    return this.ok({
      taskId: row.id,
      status: row.status,
      stage: row.stage,
    });
  }

  @Post('/:id/saveReviewDraft')
  async saveReviewDraft(
    @Param('id') id: number,
    @Body('copy') copy?: Record<string, any>,
    @Body('warningWordIgnores') warningWordIgnores?: Record<string, any>
  ) {
    const row = await this.aiListingTaskService.saveReviewDraft(
      Number(id),
      copy,
      warningWordIgnores
    );
    return this.ok({
      taskId: row.id,
      status: row.status,
      stage: row.stage,
    });
  }

  @Post('/saveReviewDraft')
  async saveReviewDraftByBody(
    @Body('id') id: number,
    @Body('copy') copy?: Record<string, any>,
    @Body('warningWordIgnores') warningWordIgnores?: Record<string, any>
  ) {
    const row = await this.aiListingTaskService.saveReviewDraft(
      Number(id),
      copy,
      warningWordIgnores
    );
    return this.ok({
      taskId: row.id,
      status: row.status,
      stage: row.stage,
    });
  }

  @Post('/:id/approve')
  async approve(
    @Param('id') id: number,
    @Body('copy') copy?: Record<string, any>,
    @Body('warningWordIgnores') warningWordIgnores?: Record<string, any>
  ) {
    const row = await this.aiListingTaskService.approve(
      Number(id),
      copy,
      warningWordIgnores
    );
    return this.ok({
      taskId: row.id,
      status: row.status,
      stage: row.stage,
    });
  }

  @Post('/approve')
  async approveByBody(
    @Body('id') id: number,
    @Body('copy') copy?: Record<string, any>,
    @Body('warningWordIgnores') warningWordIgnores?: Record<string, any>
  ) {
    const row = await this.aiListingTaskService.approve(
      Number(id),
      copy,
      warningWordIgnores
    );
    return this.ok({
      taskId: row.id,
      status: row.status,
      stage: row.stage,
    });
  }

  /**
   * 英/德等文案 → 简体中文（百度翻译，服务端持钥）
   */
  /** 英文后缀 → 德文（百度翻译，供常用后缀库等使用） */
  @Post('/translateEnToDe')
  async translateEnToDe(@Body('text') text?: string) {
    try {
      const translated = await this.baiduTranslateService.translateToDe(
        String(text || '')
      );
      return this.ok({ text: translated });
    } catch (e: any) {
      return this.fail(e?.message || '翻译失败');
    }
  }

  @Post('/translateToZhBatch')
  async translateToZhBatch(
    @Body()
    body: {
      items?: Array<{ key?: string; text?: string; from?: string }>;
    }
  ) {
    const items = Array.isArray(body?.items) ? body.items : [];
    try {
      const map = await this.baiduTranslateService.translateUnknownToZhBatch(
        items
      );
      return this.ok({ map });
    } catch (e: any) {
      return this.fail(e?.message || '翻译失败');
    }
  }
}
