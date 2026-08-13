import { Body, Inject, Post, Provide } from '@midwayjs/decorator';
import { BaseController, CoolController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { AppAmzBsrBatchShipReviewEntity } from '../../entity/bsr_batch_ship_review';
import { AppAmzBsrBatchShipReviewService } from '../../service/bsr_batch_ship_review';

/**
 * 批量发货审核单控制器。
 *
 * 审核单只负责保存、还原、审核；审核后发送仍复用旧批量发货执行链路。
 */
@Provide()
@CoolController({
  api: ['info', 'list'],
  entity: AppAmzBsrBatchShipReviewEntity,
  service: AppAmzBsrBatchShipReviewService,
  pageQueryOp: {
    fieldEq: ['status', 'review_no', 'executed_batch_no'],
    keyWordLikeFields: [
      'review_no',
      'executed_batch_no',
      'keyword_text',
      'created_by_username',
      'created_by_nickname',
      'submitted_by_username',
      'submitted_by_nickname',
    ],
    addOrderBy: { id: 'DESC' },
  },
})
export class AdminAppBsrBatchShipReviewController extends BaseController {
  @Inject()
  reviewService: AppAmzBsrBatchShipReviewService;

  @Inject()
  ctx: Context;

  @Post('/saveDraft', { summary: '保存批量发货审核草稿' })
  async saveDraft(@Body() body: any) {
    if (!this.hasSubmitPayload(body)) {
      return this.fail('请提供批量发货保存数据');
    }
    const result = await this.reviewService.saveDraft(body || {});
    return this.ok(result);
  }

  @Post('/submitForReview', { summary: '提交批量发货审核' })
  async submitForReview(@Body() body: any) {
    if (!this.hasSubmitPayload(body)) {
      return this.fail('请提供批量发货送审数据');
    }
    const result = await this.reviewService.submitForReview(body || {});
    return this.ok(result);
  }

  @Post('/page', { summary: '查询批量发货审核单分页' })
  async page() {
    const body = (this.ctx.request as any).body;
    const result = await this.reviewService.page(body || {});
    return this.ok(result);
  }

  @Post('/detail', { summary: '查询批量发货审核单详情' })
  async detail(@Body() body: any) {
    if (!this.hasReviewIdentity(body)) {
      return this.fail('缺少批量发货审核单号');
    }
    const result = await this.reviewService.detail(body || {});
    return this.ok(result);
  }

  @Post('/restorePayload', { summary: '查询批量发货审核单还原数据' })
  async restorePayload(@Body() body: any) {
    if (!this.hasReviewIdentity(body)) {
      return this.fail('缺少批量发货审核单号');
    }
    const result = await this.reviewService.restorePayload(body || {});
    return this.ok(result);
  }

  @Post('/withdraw', { summary: '撤回批量发货审核单' })
  async withdraw(@Body() body: any) {
    if (!this.hasReviewIdentity(body)) {
      return this.fail('缺少批量发货审核单号');
    }
    const result = await this.reviewService.withdraw(body || {});
    return this.ok(result);
  }

  @Post('/approve', { summary: '审核通过批量发货审核单' })
  async approve(@Body() body: any) {
    if (!this.hasReviewIdentity(body)) {
      return this.fail('缺少批量发货审核单号');
    }
    const result = await this.reviewService.approve(body || {});
    return this.ok(result);
  }

  @Post('/reject', { summary: '驳回批量发货审核单' })
  async reject(@Body() body: any) {
    if (!this.hasReviewIdentity(body)) {
      return this.fail('缺少批量发货审核单号');
    }
    const result = await this.reviewService.reject(body || {});
    return this.ok(result);
  }

  @Post('/execute', { summary: '发送已审核批量发货计划' })
  async execute(@Body() body: any) {
    if (!this.hasReviewIdentity(body)) {
      return this.fail('缺少批量发货审核单号');
    }
    const result = await this.reviewService.execute(body || {});
    return this.ok(result);
  }

  private hasReviewIdentity(body: any) {
    return Boolean(body?.review_no || body?.reviewNo || body?.id);
  }

  private hasSubmitPayload(body: any) {
    const payload = body?.submit_payload || body?.submitPayload;
    return Array.isArray(payload?.records) && payload.records.length > 0;
  }
}
