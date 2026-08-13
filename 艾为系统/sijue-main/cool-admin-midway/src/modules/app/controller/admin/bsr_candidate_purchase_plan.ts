import { CoolController, BaseController } from '@cool-midway/core';
import { Body, Post } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import { AppAmzBsrCandidateEntity } from '../../entity/bsr_candidate';
import { AppAmzBsrCandidatePurchasePlanEntity } from '../../entity/bsr_candidate_purchase_plan';
import { AppAmzBsrPurchaseOrderItemSyncLingxingEntity } from '../../entity/bsr_purchase_order_item_sync_lingxing';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrCandidatePurchasePlanEntity,
  pageQueryOp: {
    keyWordLikeFields: ['candidate_id','asin','plan_sn','marketplace','sku','ppg_sn','lingxing_sku'],
    fieldEq: ['type','candidate_id','asin','plan_sn','marketplace','sku','ppg_sn','lingxing_sku'],
  },
})
export class AdminAppAmzBsrCandidatePurchasePlanController extends BaseController {
  @InjectEntityModel(AppAmzBsrCandidatePurchasePlanEntity)
  purchasePlanRepo: Repository<AppAmzBsrCandidatePurchasePlanEntity>;

  @InjectEntityModel(AppAmzBsrCandidateEntity)
  candidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderItemSyncLingxingEntity)
  orderItemRepo: Repository<AppAmzBsrPurchaseOrderItemSyncLingxingEntity>;

  @Post('/samplePage', { summary: '样品采购计划分页' })
  async samplePage(@Body() body: any) {
    const params = body || {};
    const page = Math.max(Number(params.page || params.currentPage || 1), 1);
    const size = Math.min(Math.max(Number(params.size || params.pageSize || 20), 1), 200);
    const sampleStatus = this.normalizeSampleStatusFilter(params.sampleStatus);
    const orderExistsSql = `EXISTS (SELECT 1 FROM app_amz_bsr_purchase_order_item_sync_lingxing order_item WHERE order_item.plan_sn = plan.plan_sn)`;
    const qb = this.purchasePlanRepo
      .createQueryBuilder('plan')
      .where('plan.type = :type', { type: 2 });

    this.applySamplePageKeyword(qb, params.keyWord || params.keyword);
    this.applySamplePageFieldFilters(qb, params);

    if (sampleStatus === 3) {
      qb.andWhere('plan.sample_status = :completedStatus', { completedStatus: 3 });
    } else if (sampleStatus === 2) {
      qb.andWhere(
        `(plan.sample_status IS NULL OR plan.sample_status <> :completedStatus) AND ${orderExistsSql}`,
        { completedStatus: 3 }
      );
    } else if (sampleStatus === 1) {
      qb.andWhere(
        `(plan.sample_status IS NULL OR plan.sample_status <> :completedStatus) AND NOT ${orderExistsSql}`,
        { completedStatus: 3 }
      );
    }

    const sortFields: Record<string, string> = {
      candidate_id: 'plan.candidate_id',
      sku: 'plan.sku',
      plan_sn: 'plan.plan_sn',
      quantity_plan: 'plan.quantity_plan',
      createTime: 'plan.createTime',
    };
    const orderField = sortFields[String(params.order || '')] || 'plan.createTime';
    const orderDirection = String(params.sort || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const [list, total] = await qb
      .orderBy(orderField, orderDirection)
      .skip((page - 1) * size)
      .take(size)
      .getManyAndCount();

    return this.ok({
      list,
      pagination: { page, size, total },
    });
  }

  @Post('/candidateImages', { summary: '批量获取样品采购计划图片' })
  async candidateImages(@Body('candidateIds') candidateIds: Array<number | string>) {
    const ids = Array.from(
      new Set(
        (Array.isArray(candidateIds) ? candidateIds : [])
          .map(id => Number(id))
          .filter(id => Number.isFinite(id) && id > 0)
      )
    );

    if (!ids.length) {
      return this.ok({});
    }

    const rows = await this.candidateRepo.find({
      select: ['id', 'image_url', 'aliyun_img'] as any,
      where: { id: In(ids) } as any,
    });
    const imageMap = rows.reduce<Record<number, string>>((map, row) => {
      const imageUrl = String(row.aliyun_img || row.image_url || '').trim();
      if (imageUrl) map[row.id] = imageUrl;
      return map;
    }, {});

    return this.ok(imageMap);
  }

  @Post('/markSampleCompleted', { summary: '标记样品采购已完成' })
  async markSampleCompleted(@Body('id') id: number) {
    const planId = Number(id);
    if (!Number.isFinite(planId) || planId <= 0) {
      return this.fail('缺少采购计划ID');
    }

    const plan = await this.purchasePlanRepo.findOne({ where: { id: planId } as any });
    if (!plan) {
      return this.fail('采购计划不存在');
    }
    if (Number(plan.type) !== 2) {
      return this.fail('只能标记样品采购计划');
    }
    if (!String(plan.plan_sn || '').trim()) {
      return this.fail('采购计划编号为空，无法确认是否已采购');
    }

    const orderItemCount = await this.orderItemRepo.count({
      where: { plan_sn: plan.plan_sn } as any,
    });
    if (!orderItemCount) {
      return this.fail('生成采购单后才能标记已完成');
    }

    const admin = (this as any).baseCtx?.admin || {};
    const operatorId = Number(admin.userId || admin.id || 0) || null;
    const operatorName = String(admin.name || admin.username || admin.nickName || '').trim();
    const completedTime = new Date();

    await this.purchasePlanRepo.update(
      { id: planId } as any,
      {
        sample_status: 3,
        sample_completed_time: completedTime,
        sample_completed_by: operatorId,
        sample_completed_by_name: operatorName || null,
      } as any
    );

    return this.ok({
      id: planId,
      sample_status: 3,
      sample_completed_time: completedTime,
      sample_completed_by: operatorId,
      sample_completed_by_name: operatorName || null,
    });
  }

  private normalizeSampleStatusFilter(value: any): 1 | 2 | 3 | undefined {
    const raw = String(value || '').trim();
    if (['1', 'ordered', '已下单'].includes(raw)) return 1;
    if (['2', 'purchased', '已采购'].includes(raw)) return 2;
    if (['3', 'completed', '已完成'].includes(raw)) return 3;
    return undefined;
  }

  private applySamplePageKeyword(qb: any, value: any) {
    const keyWord = String(value || '').trim();
    if (!keyWord) return;

    qb.andWhere(
      `(${[
        'CAST(plan.candidate_id AS CHAR) LIKE :keyWord',
        'plan.asin LIKE :keyWord',
        'plan.plan_sn LIKE :keyWord',
        'plan.marketplace LIKE :keyWord',
        'plan.sku LIKE :keyWord',
        'plan.ppg_sn LIKE :keyWord',
        'plan.lingxing_sku LIKE :keyWord',
      ].join(' OR ')})`,
      { keyWord: `%${keyWord}%` }
    );
  }

  private applySamplePageFieldFilters(qb: any, params: any) {
    const fieldMap: Record<string, string> = {
      candidate_id: 'plan.candidate_id',
      asin: 'plan.asin',
      plan_sn: 'plan.plan_sn',
      marketplace: 'plan.marketplace',
      sku: 'plan.sku',
      ppg_sn: 'plan.ppg_sn',
      lingxing_sku: 'plan.lingxing_sku',
    };

    for (const [field, column] of Object.entries(fieldMap)) {
      const value = params?.[field];
      if (value === undefined || value === null || value === '') continue;
      qb.andWhere(`${column} = :${field}`, { [field]: field === 'candidate_id' ? Number(value) : value });
    }
  }
}
