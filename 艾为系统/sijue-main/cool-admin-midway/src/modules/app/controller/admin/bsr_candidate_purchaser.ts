import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzBsrCandidatePurchaserEntity } from '../../entity/bsr_candidate_purchaser';
import { AppAmzBsrCandidateEntity } from '../../entity/bsr_candidate';
import { AppAmzBsrCandidateVariantEntity } from '../../entity/bsr_candidate_variant';
import updateWithoutAmendingCreateTime from '../../mixin/updateWithoutAmendingCreateTime';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In } from 'typeorm';
import { Inject, Post, Body } from '@midwayjs/decorator';
import { AppAmzMskuService } from '../../service/msku';
import { AppAmzBsrCandidateService } from '../../service/bsr_candidate';
import { DesignTaskService } from '../../service/design_task';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrCandidatePurchaserEntity,
  pageQueryOp: {
    keyWordLikeFields: ['candidate_id'],
    fieldEq: ['candidate_id'],
  },
})
@updateWithoutAmendingCreateTime
export class AdminBsrCandidatePurchaserController extends BaseController {
  @InjectEntityModel(AppAmzBsrCandidatePurchaserEntity)
  purchaserRepo: Repository<AppAmzBsrCandidatePurchaserEntity>;

  @InjectEntityModel(AppAmzBsrCandidateEntity)
  candidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @InjectEntityModel(AppAmzBsrCandidateVariantEntity)
  variantRepo: Repository<AppAmzBsrCandidateVariantEntity>;

  @Inject()
  mskuService: AppAmzMskuService;

  @Inject()
  appAmzBsrCandidateService: AppAmzBsrCandidateService;

  @Inject()
  designTaskService: DesignTaskService;

  /**
   * 删除采购记录后同步图需，避免图需页仍展示已删变体/MSKU 对应的图位
   */
  async delete() {
    const { ids } = (this as any).baseCtx?.request?.body ?? {};
    const idList = Array.isArray(ids) ? ids : ids != null ? [ids] : [];
    const candidateIds = new Set<string>();
    if (idList.length > 0) {
      const rows = await this.purchaserRepo.find({
        where: { id: In(idList as any) },
        select: ['candidate_id'],
      });
      rows.forEach(r => {
        if (r.candidate_id) candidateIds.add(r.candidate_id);
      });
    }
    const result: any = await this.service.delete(ids);
    let designTaskSyncSkipped = false;
    for (const cid of candidateIds) {
      const num = parseInt(cid, 10);
      if (!Number.isNaN(num)) {
        const syncResult = await this.designTaskService.syncForCandidate(num);
        if (syncResult.skipped) designTaskSyncSkipped = true;
      }
    }
    const payload =
      result && typeof result === 'object'
        ? { ...(result as Record<string, any>) }
        : { result };
    return this.ok({ ...payload, designTaskSyncSkipped });
  }

  /**
   * 更新时：若该采购记录已是「做」(is_generate=2) 且变更了店铺或变体，则重算并写回 msku，避免关联错乱。
   * 支持 selectedVariantId：写入 selected_variant_id，并按 id 解析变体名写回 selectedVariant（冗余）。
   */
  async update() {
    const body: any = (this.baseCtx.request as any).body;
    if (Number(body?.is_generate) === 1) {
      body.decision_assigned_at = new Date();
      body.decision_reminded_at = null;
    }
    if (body?.selectedVariantId !== undefined) {
      body.selected_variant_id = body.selectedVariantId;
      const variant = await this.variantRepo.findOne({ where: { id: body.selectedVariantId }, select: ['name'] });
      body.selectedVariant = variant?.name ?? ''; // 始终用变体 name 回写冗余字段
    }
    if (body?.id != null) {
      const row = await this.purchaserRepo.findOne({
        where: { id: body.id },
        select: ['id', 'candidate_id', 'seller_account_id', 'account_name', 'selectedVariant', 'selected_variant_id', 'is_generate'],
      });
      const hasAccountOrVariantChange =
        body.seller_account_id !== undefined || body.account_name !== undefined ||
        body.selectedVariant !== undefined || body.selectedVariantId !== undefined;
      if (row?.is_generate === 2 && hasAccountOrVariantChange && row.candidate_id) {
        const candidate = await this.candidateRepo.findOne({
          where: { id: parseInt(row.candidate_id, 10) },
          select: ['produce_name'],
        });
        const sellerAccountId = body.seller_account_id ?? row.seller_account_id;
        const accountName = body.account_name ?? row.account_name;
        let variantName = body.selectedVariant ?? row.selectedVariant;
        if (body.selectedVariantId ?? row.selected_variant_id) {
          const vid = body.selected_variant_id ?? body.selectedVariantId ?? row.selected_variant_id;
          const v = await this.variantRepo.findOne({ where: { id: vid }, select: ['name'] });
          if (v?.name) variantName = v.name;
        }
        if (sellerAccountId && variantName && candidate?.produce_name != null) {
          const vid = body.selected_variant_id ?? body.selectedVariantId ?? row.selected_variant_id;
          const admin = this.baseCtx?.admin as { userId?: string; username?: string } | undefined;
          body.msku = await this.mskuService.getOrCreateMsku({
            candidate_id: row.candidate_id,
            candidate_name: candidate.produce_name,
            seller_account_id: sellerAccountId,
            account_name: accountName || '',
            selected_variant: variantName,
            selected_variant_id: vid ?? null,
            submitter_user_id: admin?.userId ?? null,
            submitter_name: admin?.username ?? null,
          });
        }
      }
    }
    return this.ok(await this.service.update(body));
  }

  /**
   * 批量更新采购记录并同步图需
   */
  @Post('/batchUpdateAndSync')
  async batchUpdateAndSync(
    @Body('candidateId') candidateId: number,
    @Body('purchasers') purchasers: any[],
  ) {
    const result = await this.appAmzBsrCandidateService.updatePurchasersAndSync({
      id: Number(candidateId),
      purchasers,
    });
    return this.ok({
      message: '更新成功',
      designTaskSyncSkipped: result?.designTaskSyncSkipped ?? false,
      opportunityReleased: result?.opportunityReleased ?? false,
      releasedPurchaser: result?.releasedPurchaser,
      releasedCountries: result?.releasedCountries ?? [],
    });
  }
}
