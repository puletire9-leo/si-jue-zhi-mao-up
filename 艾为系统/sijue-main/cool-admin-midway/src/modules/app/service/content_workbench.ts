import { Inject, Provide } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import { ContentWorkItemEntity } from '../entity/content_work_item';
import { ContentWorkItemTaskLinkEntity } from '../entity/content_work_item_task_link';
import { AppAmzBsrCandidateEntity } from '../entity/bsr_candidate';
import { AppAmzMskuEntity } from '../entity/msku';
import { AiListingTaskEntity } from '../entity/ai_listing_task';
import { DesignTaskEntity } from '../entity/design_task';
import { AppAmzBsrCandidatePurchaserEntity } from '../entity/bsr_candidate_purchaser';
import { AiListingTaskService } from './ai_listing_task';
import { DesignTaskService } from './design_task';
import { isAiListingReviewClosedStage } from './ai_listing_task_status';
import { MSKU_MAX_LENGTH } from './msku';
import {
  buildMskuLookup,
  findMskuEntityByFlexibleKey,
  mskuKeysEquivalent,
  normalizeMskuKey,
} from '../utils/msku_key';

type TaskDomain = 'ai' | 'design';

const SELLER_SKU_PATTERN = /^[A-Za-z0-9-]+$/;

@Provide()
export class ContentWorkbenchService {
  @InjectEntityModel(ContentWorkItemEntity)
  workItemRepo: Repository<ContentWorkItemEntity>;

  @InjectEntityModel(ContentWorkItemTaskLinkEntity)
  workItemTaskLinkRepo: Repository<ContentWorkItemTaskLinkEntity>;

  @InjectEntityModel(AppAmzBsrCandidateEntity)
  candidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @InjectEntityModel(AppAmzMskuEntity)
  mskuRepo: Repository<AppAmzMskuEntity>;

  @InjectEntityModel(AiListingTaskEntity)
  aiTaskRepo: Repository<AiListingTaskEntity>;

  @InjectEntityModel(DesignTaskEntity)
  designTaskRepo: Repository<DesignTaskEntity>;

  @InjectEntityModel(AppAmzBsrCandidatePurchaserEntity)
  purchaserRepo: Repository<AppAmzBsrCandidatePurchaserEntity>;

  @Inject()
  aiListingTaskService: AiListingTaskService;

  @Inject()
  designTaskService: DesignTaskService;

  private normalizeCountryCode(countryCode?: string) {
    return String(countryCode || 'uk').trim().toLowerCase() || 'uk';
  }

  private normalizeSellerSkuInput(raw: unknown): string | null {
    if (raw === null || raw === undefined) return null;
    const v = String(raw).trim();
    if (!v) return null;
    if (v.length > MSKU_MAX_LENGTH) {
      throw new Error(`上架 SKU 不能超过 ${MSKU_MAX_LENGTH} 个字符`);
    }
    if (!SELLER_SKU_PATTERN.test(v)) {
      throw new Error('上架 SKU 仅支持字母、数字和连字符 -');
    }
    return v;
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

  /** MSKU 维度：该 MSKU 采购 uk/de > 0 即需对应语言文案 */
  private resolveRequiredLanguagesForMsku(
    purchasers: AppAmzBsrCandidatePurchaserEntity[],
    msku: string
  ): Array<'en' | 'de'> {
    const code = String(msku || '').trim();
    if (!code) return [];
    let needEn = false;
    let needDe = false;
    for (const p of purchasers) {
      if (!mskuKeysEquivalent(p.msku, code)) continue;
      const { uk, de } = this.parsePurchaserNumUkDe(p.purchaserNum);
      if (uk > 0) needEn = true;
      if (de > 0) needDe = true;
    }
    const langs: Array<'en' | 'de'> = [];
    if (needEn) langs.push('en');
    if (needDe) langs.push('de');
    return langs;
  }

  private mapAiStatus(task?: { status?: number; stage?: string | null }) {
    const code = Number(task?.status || 0);
    const stage = String(task?.stage || '')
      .trim()
      .toLowerCase();
    if (code === 390) {
      if (isAiListingReviewClosedStage(stage)) {
        return { status: 'done', stage: 'review_closed' };
      }
      if (stage === 'review_approved' || stage === 'accepted') {
        return { status: 'done', stage: 'review_approved' };
      }
      if (stage === 'awaiting_review') {
        return { status: 'awaiting_review', stage: 'awaiting_review' };
      }
      // 历史数据可能是 succeeded / langgraph_succeeded，语义仍为待运营确认
      return { status: 'awaiting_review', stage: 'awaiting_review' };
    }
    if (code === 900) return { status: 'failed', stage: 'ai_failed' };
    if (code === 990) return { status: 'cancelled', stage: 'ai_cancelled' };
    if (code >= 100 && code < 390)
      return { status: 'running', stage: 'ai_running' };
    return { status: 'pending', stage: 'ai_pending' };
  }

  private mapDesignStatus(status?: number) {
    const code = Number(status || 0);
    if (code === 500 || code === 401) return { status: 'done', stage: 'design_done' };
    if (code === 509) return { status: 'cancelled', stage: 'design_cancelled' };
    if (code <= 0) return { status: 'pending', stage: 'design_pending' };
    return { status: 'running', stage: 'design_running' };
  }

  private async findDesignTaskByCandidateId(candidateId?: number) {
    const cid = Number(candidateId || 0);
    if (!cid) return null;
    return this.designTaskRepo.findOne({
      where: { candidate_id: cid } as any,
      order: { id: 'DESC' },
    } as any);
  }

  private async getCurrentTaskStatusForWorkItem(workItem: ContentWorkItemEntity) {
    const [aiTask, designTask] = await Promise.all([
      workItem.current_ai_task_id
        ? this.aiTaskRepo.findOne({ where: { id: Number(workItem.current_ai_task_id) } })
        : null,
      workItem.current_design_task_id
        ? this.designTaskRepo.findOne({ where: { id: Number(workItem.current_design_task_id) } })
        : this.findDesignTaskByCandidateId(Number(workItem.candidate_id)),
    ]);
    return {
      ai: this.mapAiStatus(aiTask || undefined).status,
      design: this.mapDesignStatus(designTask?.status).status,
    };
  }

  private mergeAggregateStatus(parts: Array<{ status: string; stage: string }>) {
    if (parts.some(x => x.status === 'failed'))
      return { status: 'failed', stage: 'failed' };
    if (parts.some(x => x.status === 'blocked'))
      return { status: 'blocked', stage: 'blocked' };
    if (parts.some(x => x.status === 'cancelled') && !parts.some(x => x.status === 'running')) {
      return { status: 'cancelled', stage: 'cancelled' };
    }
    if (parts.every(x => x.status === 'done')) return { status: 'done', stage: 'done' };
    const awaitingReview = parts.find(x => x.status === 'awaiting_review');
    if (awaitingReview) {
      return { status: 'running', stage: awaitingReview.stage || 'awaiting_review' };
    }
    if (parts.some(x => x.status === 'running'))
      return { status: 'running', stage: parts.find(x => x.status === 'running')?.stage || 'running' };
    return { status: 'pending', stage: 'pending' };
  }

  async upsertFromPurchaserDecision(input: {
    candidate_id: number;
    msku: string;
    seller_account_id: string;
    country_code?: string;
    created_by?: string;
  }) {
    const candidateId = Number(input.candidate_id);
    const mskuInput = String(input.msku || '').trim();
    const sellerAccountId = String(input.seller_account_id || '').trim();
    if (!candidateId || !mskuInput || !sellerAccountId) return null;
    const countryCode = this.normalizeCountryCode(input.country_code);
    const mskuRow = await findMskuEntityByFlexibleKey(this.mskuRepo, mskuInput, ['msku']);
    const msku = mskuRow?.msku ?? String(input.msku || '');
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
      select: ['id', 'sku', 'produce_name', 'asin', 'marketplace', 'image_url', 'aliyun_img'],
    });
    const groupKey = `simple|candidate:${candidateId}|account:${sellerAccountId}|country:${countryCode}`;
    let row = await this.findWorkItemByFlexibleMsku({
      candidate_id: candidateId,
      msku,
      seller_account_id: sellerAccountId,
      country_code: countryCode,
    });
    const baseMeta = {
      candidate_name: candidate?.produce_name || '',
      asin: candidate?.asin || '',
      marketplace: candidate?.marketplace || '',
      image_url: candidate?.aliyun_img || candidate?.image_url || '',
    };
    if (!row) {
      row = this.workItemRepo.create({
        candidate_id: candidateId,
        sku: String(candidate?.sku || ''),
        msku,
        seller_account_id: sellerAccountId,
        country_code: countryCode,
        group_key: groupKey,
        status: 'running',
        stage: 'queued',
        created_by: input.created_by || null,
        meta: baseMeta,
      });
    } else {
      row.group_key = groupKey;
      row.meta = {
        ...(row.meta || {}),
        ...baseMeta,
      };
      if (!row.sku && candidate?.sku) row.sku = candidate.sku;
      if (!row.created_by && input.created_by) row.created_by = input.created_by;
    }
    return this.workItemRepo.save(row);
  }

  async bindTaskLink(input: {
    work_item_id: number;
    task_domain: TaskDomain;
    task_id: number;
    relation_type?: 'primary' | 'delta' | 'retry' | 'merged';
    set_current?: boolean;
  }) {
    const workItemId = Number(input.work_item_id);
    const taskId = Number(input.task_id);
    if (!workItemId || !taskId) return null;
    const taskDomain = input.task_domain;
    const setCurrent = input.set_current !== false;
    const relationType = input.relation_type || 'primary';
    if (setCurrent) {
      await this.workItemTaskLinkRepo.update(
        { work_item_id: workItemId, task_domain: taskDomain, is_current: 1 as any },
        { is_current: 0 as any, ended_at: new Date() }
      );
    }
    const existing = await this.workItemTaskLinkRepo.findOne({
      where: {
        work_item_id: workItemId,
        task_domain: taskDomain,
        task_id: taskId,
      },
      order: { id: 'DESC' },
    });
    const row =
      existing ||
      this.workItemTaskLinkRepo.create({
        work_item_id: workItemId,
        task_domain: taskDomain,
        task_id: taskId,
      });
    row.relation_type = relationType;
    row.is_current = setCurrent ? 1 : 0;
    if (!row.started_at) row.started_at = new Date();
    row.ended_at = setCurrent ? null : row.ended_at;
    await this.workItemTaskLinkRepo.save(row);
    await this.refreshWorkItemSnapshot(workItemId);
    return row;
  }

  async clearCurrentTaskLinks(
    workItemId: number,
    taskDomain: TaskDomain
  ) {
    const id = Number(workItemId);
    if (!id) return null;
    await this.workItemTaskLinkRepo.update(
      {
        work_item_id: id,
        task_domain: taskDomain,
        is_current: 1 as any,
      },
      { is_current: 0 as any, ended_at: new Date() }
    );
    if (taskDomain === 'ai') {
      await this.workItemRepo.update(id, { current_ai_task_id: null } as any);
    } else {
      await this.workItemRepo.update(id, { current_design_task_id: null } as any);
    }
    await this.refreshWorkItemSnapshot(id);
    return this.workItemRepo.findOne({ where: { id } });
  }

  async refreshWorkItemSnapshot(workItemId: number) {
    const workItem = await this.workItemRepo.findOne({ where: { id: workItemId } });
    if (!workItem) return null;
    const links = await this.workItemTaskLinkRepo.find({
      where: { work_item_id: workItemId, is_current: 1 as any },
    });
    const aiTaskId = Number(
      links.find(x => x.task_domain === 'ai')?.task_id ||
        workItem.current_ai_task_id ||
        0
    );
    const designTaskId = Number(
      links.find(x => x.task_domain === 'design')?.task_id ||
        workItem.current_design_task_id ||
        0
    );
    const [aiTask, designTask] = await Promise.all([
      aiTaskId ? this.aiTaskRepo.findOne({ where: { id: aiTaskId } }) : null,
      designTaskId
        ? this.designTaskRepo.findOne({ where: { id: designTaskId } })
        : this.findDesignTaskByCandidateId(Number(workItem.candidate_id)),
    ]);
    const aiStatus = aiTask
      ? this.mapAiStatus(aiTask)
      : { status: 'pending', stage: 'ai_pending' };
    const designStatus = designTask
      ? this.mapDesignStatus(designTask.status)
      : { status: 'pending', stage: 'design_pending' };
    let merged = this.mergeAggregateStatus([aiStatus, designStatus]);
    if (designTaskId && !designTask) {
      merged = { status: 'blocked', stage: 'design_missing' };
    }
    workItem.current_ai_task_id = aiTask ? aiTask.id : workItem.current_ai_task_id;
    workItem.current_design_task_id = designTask
      ? designTask.id
      : workItem.current_design_task_id;
    workItem.status = merged.status;
    workItem.stage = merged.stage;
    return this.workItemRepo.save(workItem);
  }

  async page(params: {
    page?: number;
    size?: number;
    keyword?: string;
    status?: string;
    candidateId?: number;
    /** done=图片上传已完成；todo=进行中（未标记上传完成） */
    uploadStatus?: 'done' | 'todo';
  }) {
    const pageNum = Math.max(1, Number(params.page || 1));
    const pageSize = Math.max(1, Math.min(500, Number(params.size || 20)));
    const keyword = String(params.keyword || '').trim();
    const status = String(params.status || '').trim();
    const candidateId = Number(params.candidateId || 0);
    const uploadStatus = String(params.uploadStatus || '').trim().toLowerCase();
    const qb = this.workItemRepo.createQueryBuilder('w');
    qb.orderBy('w.id', 'DESC');
    if (status) qb.andWhere('w.status = :status', { status });
    if (candidateId) qb.andWhere('w.candidate_id = :candidateId', { candidateId });
    if (uploadStatus === 'done' || uploadStatus === 'todo') {
      qb.andWhere('w.upload_status = :uploadStatus', { uploadStatus });
    }
    if (keyword) {
      const kw = `%${keyword}%`;
      qb.andWhere(
        '(w.sku LIKE :kw OR w.msku LIKE :kw OR w.seller_account_id LIKE :kw)',
        { kw }
      );
    }
    const total = await qb.getCount();
    const list = await qb.skip((pageNum - 1) * pageSize).take(pageSize).getMany();
    const aiTaskIds = Array.from(
      new Set(list.map(x => Number(x.current_ai_task_id || 0)).filter(Boolean))
    );
    const candidateIds = Array.from(
      new Set(list.map(x => Number(x.candidate_id || 0)).filter(Boolean))
    );
    const [aiTasks, designTasks] = await Promise.all([
      aiTaskIds.length
        ? this.aiTaskRepo.find({ where: { id: In(aiTaskIds) } })
        : Promise.resolve([] as AiListingTaskEntity[]),
      candidateIds.length
        ? this.designTaskRepo.find({
            where: { candidate_id: In(candidateIds as any) } as any,
            order: { id: 'DESC' },
          })
        : Promise.resolve([] as DesignTaskEntity[]),
    ]);
    const candidateIdStrings = Array.from(
      new Set(list.map(x => String(x.candidate_id || '')).filter(Boolean))
    );
    const mskuRows = candidateIds.length
      ? await this.mskuRepo.find({
          where: { candidate_id: In(candidateIdStrings) },
          select: [
            'msku',
            'seller_sku',
            'account_name',
            'selected_variant',
            'selected_variant_id',
            'submitter_name',
            'seller_account_id',
          ],
        })
      : [];
    const mskuLookup = buildMskuLookup(mskuRows);
    const purchasers = mskuRows.length
      ? await this.purchaserRepo.find({
          where: { candidate_id: In(candidateIds) } as any,
          select: ['msku', 'purchaserNum'],
        })
      : [];
    const aiMap = new Map(
      aiTasks.map((x): [number, AiListingTaskEntity] => [Number(x.id), x])
    );
    const designMap = new Map<number, DesignTaskEntity>();
    for (const row of designTasks) {
      const cid = Number((row as any).candidate_id || 0);
      if (!cid || designMap.has(cid)) continue;
      designMap.set(cid, row);
    }
    return {
      list: list.map(item => {
        const mskuInfo = mskuLookup.resolve(String(item.msku || ''));
        const aiTask = item.current_ai_task_id
          ? aiMap.get(Number(item.current_ai_task_id))
          : null;
        const designTask = designMap.get(Number(item.candidate_id || 0)) || null;
        const resolvedDesignTaskId = Number(
          item.current_design_task_id || designTask?.id || 0
        );
        return {
          id: item.id,
          candidate_id: item.candidate_id,
          sku: item.sku,
          msku: item.msku,
          seller_sku: mskuInfo?.seller_sku ?? null,
          seller_account_id: item.seller_account_id,
          seller_account_name:
            String(mskuInfo?.account_name || item?.meta?.account_name || ''),
          country_code: item.country_code,
          status: item.status,
          stage: item.stage,
          created_by: item.created_by || null,
          decision_owner:
            String(mskuInfo?.submitter_name || item?.created_by || ''),
          listing_status: item.listing_status || 'todo',
          listing_finished_at: item.listing_finished_at || null,
          upload_status: item.upload_status || 'todo',
          upload_finished_at: item.upload_finished_at || null,
          group_key: item.group_key,
          current_ai_task_id: item.current_ai_task_id,
          current_design_task_id: resolvedDesignTaskId || null,
          selected_variant_id: String(
            mskuInfo?.selected_variant_id ||
              item?.meta?.selected_variant_id ||
              ''
          ).trim(),
          meta: {
            ...(item.meta || {}),
            variant_name:
              String(item?.meta?.variant_name || mskuInfo?.selected_variant || ''),
            account_name:
              String(item?.meta?.account_name || mskuInfo?.account_name || ''),
            selected_variant_id: String(
              mskuInfo?.selected_variant_id ||
                item?.meta?.selected_variant_id ||
                ''
            ).trim(),
          },
          ai_task: aiTask
            ? {
                id: aiTask.id,
                status: aiTask.status,
                stage: aiTask.stage,
                task_mode: aiTask.task_mode,
                root_task_id: aiTask.root_task_id,
                merge_into_task_id: aiTask.merge_into_task_id,
                progress_percent: aiTask.progress_percent,
                updateTime: aiTask.updateTime,
              }
            : null,
          design_task: designTask
            ? {
                id: designTask.id,
                status: designTask.status,
                createTime: designTask.createTime,
                updateTime: designTask.updateTime,
              }
            : null,
          required_languages: this.resolveRequiredLanguagesForMsku(
            purchasers,
            String(item.msku || '')
          ),
          createTime: item.createTime,
          updateTime: item.updateTime,
        };
      }),
      pagination: {
        page: pageNum,
        size: pageSize,
        total,
      },
    };
  }

  async getTimeline(workItemId: number) {
    const id = Number(workItemId);
    if (!id) throw new Error('workItemId 无效');
    const workItem = await this.workItemRepo.findOne({
      where: { id },
      select: ['id', 'candidate_id', 'updateTime', 'msku', 'sku'],
    });
    if (!workItem) throw new Error('工作项不存在');
    const links = await this.workItemTaskLinkRepo.find({
      where: { work_item_id: id },
      order: { id: 'ASC' },
    });
    const aiTaskIds = links
      .filter(x => x.task_domain === 'ai')
      .map(x => Number(x.task_id))
      .filter(x => x > 0);
    const designTaskIds = links
      .filter(x => x.task_domain === 'design')
      .map(x => Number(x.task_id))
      .filter(x => x > 0);
    const fallbackDesignTask = await this.findDesignTaskByCandidateId(
      Number((workItem as any).candidate_id || 0)
    );
    const fallbackDesignTaskId = Number(fallbackDesignTask?.id || 0);
    if (
      fallbackDesignTaskId > 0 &&
      !links.some(
        x => x.task_domain === 'design' && Number(x.task_id || 0) === fallbackDesignTaskId
      )
    ) {
      designTaskIds.push(fallbackDesignTaskId);
    }
    const [aiTasks, designTasks] = await Promise.all([
      aiTaskIds.length
        ? this.aiTaskRepo.find({
            where: { id: In(aiTaskIds) },
            select: ['id', 'timeline', 'updateTime', 'status', 'stage'],
          })
        : Promise.resolve([] as AiListingTaskEntity[]),
      designTaskIds.length
        ? this.designTaskRepo.find({
            where: { id: In(designTaskIds) },
            select: ['id', 'timeline', 'updateTime', 'status'],
          })
        : Promise.resolve([] as DesignTaskEntity[]),
    ]);
    const timeline: Array<Record<string, any>> = [];
    for (const task of aiTasks) {
      const aiTimeline = Array.isArray(task.timeline) ? task.timeline : [];
      aiTimeline.forEach((event: any) =>
        timeline.push({
          at: event?.at || event?.time || task.updateTime,
          domain: 'ai',
          taskId: task.id,
          title: event?.remark || event?.stage || 'AI任务事件',
          operator: event?.operator || '',
        })
      );
    }
    for (const task of designTasks) {
      const designTimeline = Array.isArray(task.timeline) ? task.timeline : [];
      designTimeline.forEach((event: any) =>
        timeline.push({
          at: event?.time || task.updateTime,
          domain: 'design',
          taskId: task.id,
          title: event?.remark || event?.content || '图需任务事件',
          operator: event?.operator || event?.user || '',
        })
      );
    }
    timeline.sort((a, b) =>
      String(a.at || '').localeCompare(String(b.at || ''))
    );
    return {
      id,
      msku: workItem.msku,
      sku: workItem.sku,
      timeline,
      updateTime: workItem.updateTime,
    };
  }

  async detail(id: number) {
    const workItemId = Number(id);
    if (!workItemId) return null;
    const workItem = await this.workItemRepo.findOne({ where: { id: workItemId } });
    if (!workItem) return null;
    const links = await this.workItemTaskLinkRepo.find({
      where: { work_item_id: workItemId },
      order: { id: 'ASC' },
    });
    const aiTaskIds = links
      .filter(x => x.task_domain === 'ai')
      .map(x => Number(x.task_id));
    const designTaskIds = links
      .filter(x => x.task_domain === 'design')
      .map(x => Number(x.task_id));
    const fallbackDesignTask = await this.findDesignTaskByCandidateId(
      Number(workItem.candidate_id)
    );
    const fallbackDesignTaskId = Number(fallbackDesignTask?.id || 0);
    if (
      fallbackDesignTaskId > 0 &&
      !designTaskIds.includes(fallbackDesignTaskId)
    ) {
      designTaskIds.push(fallbackDesignTaskId);
    }
    const [aiTasks, designTasks] = await Promise.all([
      aiTaskIds.length
        ? this.aiTaskRepo.find({ where: { id: In(aiTaskIds) } })
        : Promise.resolve([] as AiListingTaskEntity[]),
      designTaskIds.length
        ? this.designTaskRepo.find({ where: { id: In(designTaskIds) } })
        : Promise.resolve([] as DesignTaskEntity[]),
    ]);
    const aiMap = new Map(
      aiTasks.map((x): [number, AiListingTaskEntity] => [Number(x.id), x])
    );
    const designMap = new Map(
      designTasks.map((x): [number, DesignTaskEntity] => [Number(x.id), x])
    );
    const nodes: Array<Record<string, any>> = [];
    const edges: Array<Record<string, any>> = [];
    const timeline: Array<Record<string, any>> = [];
    nodes.push({
      nodeId: `work:${workItem.id}`,
      domain: 'work_item',
      status: workItem.status,
      stage: workItem.stage,
      progress: 0,
    });
    for (const link of links) {
      if (link.task_domain === 'ai') {
        const task = aiMap.get(Number(link.task_id));
        if (!task) continue;
        nodes.push({
          nodeId: `ai:${task.id}`,
          domain: 'ai',
          taskId: task.id,
          status: this.mapAiStatus(task).status,
          stage: this.mapAiStatus(task).stage,
          progress: Number(task.progress_percent || 0),
          startedAt: task.started_at,
          finishedAt: task.finished_at,
          isCurrent: Number(link.is_current) === 1,
        });
        edges.push({
          from: `work:${workItem.id}`,
          to: `ai:${task.id}`,
          type: 'FS',
          condition: link.relation_type,
        });
        const aiTimeline = Array.isArray(task.timeline) ? task.timeline : [];
        aiTimeline.forEach((event: any) =>
          timeline.push({
            at: event?.time || task.updateTime,
            domain: 'ai',
            taskId: task.id,
            title: event?.remark || event?.stage || 'AI任务事件',
            operator: event?.operator || '',
            level: this.mapAiStatus(task).status,
          })
        );
      } else {
        const task = designMap.get(Number(link.task_id));
        if (!task) continue;
        nodes.push({
          nodeId: `design:${task.id}`,
          domain: 'design',
          taskId: task.id,
          status: this.mapDesignStatus(task.status).status,
          stage: String(task.status),
          createTime: task.createTime,
          progress: 0,
          isCurrent: Number(link.is_current) === 1,
        });
        edges.push({
          from: `work:${workItem.id}`,
          to: `design:${task.id}`,
          type: 'FS',
          condition: link.relation_type,
        });
        const designTimeline = Array.isArray(task.timeline) ? task.timeline : [];
        designTimeline.forEach((event: any) =>
          timeline.push({
            at: event?.time || task.updateTime,
            domain: 'design',
            taskId: task.id,
            title: event?.remark || '图需任务事件',
            operator: event?.operator || '',
            level: this.mapDesignStatus(task.status).status,
          })
        );
      }
    }
    if (fallbackDesignTask && !nodes.some(node => node.nodeId === `design:${fallbackDesignTask.id}`)) {
      nodes.push({
        nodeId: `design:${fallbackDesignTask.id}`,
        domain: 'design',
        taskId: fallbackDesignTask.id,
        status: this.mapDesignStatus(fallbackDesignTask.status).status,
        stage: String(fallbackDesignTask.status),
        createTime: fallbackDesignTask.createTime,
        progress: 0,
        isCurrent: true,
      });
      edges.push({
        from: `work:${workItem.id}`,
        to: `design:${fallbackDesignTask.id}`,
        type: 'FS',
        condition: 'candidate_fallback',
      });
      const designTimeline = Array.isArray(fallbackDesignTask.timeline)
        ? fallbackDesignTask.timeline
        : [];
      designTimeline.forEach((event: any) =>
        timeline.push({
          at: event?.time || fallbackDesignTask.updateTime,
          domain: 'design',
          taskId: fallbackDesignTask.id,
          title: event?.remark || '图需任务事件',
          operator: event?.operator || '',
          level: this.mapDesignStatus(fallbackDesignTask.status).status,
        })
      );
    }
    timeline.sort((a, b) =>
      String(a.at || '').localeCompare(String(b.at || ''))
    );
    return {
      work_item: workItem,
      links,
      graph: { nodes, edges },
      timeline,
    };
  }

  async skuView(candidateId: number) {
    const cid = Number(candidateId);
    if (!cid) return null;
    const rows = await this.workItemRepo.find({
      where: { candidate_id: cid },
      order: { id: 'DESC' },
    });
    const designTask = await this.findDesignTaskByCandidateId(cid);
    const counters = {
      total: rows.length,
      pending: rows.filter(x => x.status === 'pending').length,
      running: rows.filter(x => x.status === 'running').length,
      blocked: rows.filter(x => x.status === 'blocked').length,
      failed: rows.filter(x => x.status === 'failed').length,
      done: rows.filter(x => x.status === 'done').length,
      cancelled: rows.filter(x => x.status === 'cancelled').length,
    };
    return {
      candidate_id: cid,
      counters,
      items: rows.map(x => ({
        id: x.id,
        msku: x.msku,
        seller_account_id: x.seller_account_id,
        country_code: x.country_code,
        status: x.status,
        stage: x.stage,
        current_ai_task_id: x.current_ai_task_id,
        current_design_task_id: x.current_design_task_id || designTask?.id || null,
        updateTime: x.updateTime,
      })),
    };
  }

  async retry(input: { workItemId: number; domain: 'ai' | 'design' | 'all' }) {
    const workItem = await this.workItemRepo.findOne({
      where: { id: Number(input.workItemId) },
    });
    if (!workItem) throw new Error('工作项不存在');
    const domain = input.domain || 'all';
    const results: Record<string, any> = {};
    if (domain === 'ai' || domain === 'all') {
      if (workItem.current_ai_task_id) {
        const aiTask = await this.aiListingTaskService.retry(
          Number(workItem.current_ai_task_id)
        );
        results.ai = { taskId: aiTask.id, status: aiTask.status };
      } else {
        results.ai = { skipped: true, reason: 'no_current_ai_task' };
      }
    }
    if (domain === 'design' || domain === 'all') {
      const designSync = await this.designTaskService.syncForCandidate(
        Number(workItem.candidate_id),
        { force: true }
      );
      results.design = {
        candidateId: workItem.candidate_id,
        synced: !designSync.skipped,
        skipped: designSync.skipped,
      };
    }
    await this.refreshWorkItemSnapshot(workItem.id);
    return results;
  }

  async saveListingCopy(
    workItemId: number,
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
    const id = Number(workItemId);
    if (!id) throw new Error('workItemId 无效');
    const workItem = await this.workItemRepo.findOne({ where: { id } });
    if (!workItem) throw new Error('工作项不存在');
    const taskId = Number(workItem.current_ai_task_id || 0);
    if (!taskId) throw new Error('当前工作项无文案任务，无法保存');
    if (!copy?.en && !copy?.de) {
      throw new Error('无文案内容可保存');
    }
    const task = await this.aiListingTaskService.saveStudioListingCopy(
      taskId,
      copy
    );
    return { workItemId: id, taskId: task.id };
  }

  async markListingDone(
    workItemId: number,
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
    const id = Number(workItemId);
    if (!id) throw new Error('workItemId 无效');
    const workItem = await this.workItemRepo.findOne({ where: { id } });
    if (!workItem) throw new Error('工作项不存在');
    const current = await this.getCurrentTaskStatusForWorkItem(workItem);
    if (current.ai !== 'done') {
      throw new Error('文案节点未完成，不能标记刊登完成');
    }
    if (copy?.en || copy?.de) {
      await this.saveListingCopy(id, copy);
    }
    workItem.listing_status = 'done';
    workItem.listing_finished_at = new Date();
    return this.workItemRepo.save(workItem);
  }

  async markUploadDone(workItemId: number) {
    const id = Number(workItemId);
    if (!id) throw new Error('workItemId 无效');
    const workItem = await this.workItemRepo.findOne({ where: { id } });
    if (!workItem) throw new Error('工作项不存在');
    const current = await this.getCurrentTaskStatusForWorkItem(workItem);
    if ((workItem.listing_status || 'todo') !== 'done') {
      throw new Error('刊登节点未完成，不能标记图片上传完成');
    }
    if (current.design !== 'done') {
      throw new Error('制图节点未完成，不能标记图片上传完成');
    }
    workItem.upload_status = 'done';
    workItem.upload_finished_at = new Date();
    return this.workItemRepo.save(workItem);
  }

  /**
   * 内容工作台：仅更新主表上架 SKU，不改内部 msku。
   */
  async updateSellerSku(input: { msku: string; seller_sku?: string | null }) {
    const mskuInput = normalizeMskuKey(input.msku);
    if (!mskuInput) throw new Error('msku 无效');
    const sellerSku = this.normalizeSellerSkuInput(input.seller_sku);
    const row = await findMskuEntityByFlexibleKey(this.mskuRepo, mskuInput, ['msku']);
    if (!row) throw new Error('MSKU 不存在');
    const msku = row.msku;
    await this.mskuRepo.update({ msku }, { seller_sku: sellerSku });
    return { msku, seller_sku: sellerSku };
  }

  private async findWorkItemByFlexibleMsku(input: {
    candidate_id: number;
    msku: string;
    seller_account_id: string;
    country_code: string;
  }): Promise<ContentWorkItemEntity | null> {
    const trimmed = normalizeMskuKey(input.msku);
    const raw = String(input.msku || '');
    const codes = [raw, trimmed].filter((v, i, arr) => v && arr.indexOf(v) === i);
    for (const code of codes) {
      const row = await this.workItemRepo.findOne({
        where: {
          candidate_id: input.candidate_id,
          msku: code,
          seller_account_id: input.seller_account_id,
          country_code: input.country_code,
        },
        order: { id: 'DESC' },
      });
      if (row) return row;
    }
    if (!trimmed) return null;
    return this.workItemRepo
      .createQueryBuilder('w')
      .where('w.candidate_id = :candidateId', { candidateId: input.candidate_id })
      .andWhere('TRIM(w.msku) = :trimmed', { trimmed })
      .andWhere('w.seller_account_id = :sellerAccountId', {
        sellerAccountId: input.seller_account_id,
      })
      .andWhere('w.country_code = :countryCode', { countryCode: input.country_code })
      .orderBy('w.id', 'DESC')
      .getOne();
  }
}
