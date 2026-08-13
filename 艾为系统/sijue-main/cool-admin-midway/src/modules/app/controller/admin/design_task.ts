import { CoolController, BaseController } from '@cool-midway/core';
import { Inject, Get, Query, Post, Body } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In } from 'typeorm';
import { Context } from '@midwayjs/koa';
import { DesignTaskEntity } from '../../entity/design_task';
import {
  DesignTaskPictureEntity,
  normalizeDesignTaskPictureCopies,
  normalizeDesignTaskPictureRemarkDoc,
} from '../../entity/design_task_picture';
import { AppAmzBsrCandidateEntity } from '../../entity/bsr_candidate';
import { AppAmzBsrCandidateVariantEntity } from '../../entity/bsr_candidate_variant';
import { AppAmzBsrCandidateFactoryLinkEntity } from '../../entity/bsr_candidate_factory_link';
import { AppAmzBsrCandidatePurchaserEntity } from '../../entity/bsr_candidate_purchaser';
import { AppAmzSellerEntity } from '../../entity/seller';
import { DesignTaskService } from '../../service/design_task';
import { BaiduTranslateService } from '../../service/baidu_translate';
import { CandidateSamplePurchaseSummaryService } from '../../service/candidate_sample_purchase_summary';

@CoolController({
  api: [], // 自定义接口，不用内置 page
  entity: DesignTaskEntity,
})
export class AdminDesignTaskController extends BaseController {
  @Inject()
  designTaskService: DesignTaskService;

  @Inject()
  baiduTranslateService: BaiduTranslateService;

  @Inject()
  candidateSamplePurchaseSummaryService: CandidateSamplePurchaseSummaryService;
  @InjectEntityModel(DesignTaskEntity)
  taskRepo: Repository<DesignTaskEntity>;

  @InjectEntityModel(DesignTaskPictureEntity)
  pictureRepo: Repository<DesignTaskPictureEntity>;

  @InjectEntityModel(AppAmzBsrCandidateEntity)
  candidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @InjectEntityModel(AppAmzBsrCandidateVariantEntity)
  variantRepo: Repository<AppAmzBsrCandidateVariantEntity>;

  @InjectEntityModel(AppAmzBsrCandidateFactoryLinkEntity)
  factoryLinkRepo: Repository<AppAmzBsrCandidateFactoryLinkEntity>;

  @InjectEntityModel(AppAmzBsrCandidatePurchaserEntity)
  purchaserRepo: Repository<AppAmzBsrCandidatePurchaserEntity>;

  @InjectEntityModel(AppAmzSellerEntity)
  sellerRepo: Repository<AppAmzSellerEntity>;

  @Inject()
  ctx: Context;

  private parseCsvQuery(input?: string | string[]) {
    const raw = Array.isArray(input) ? input.join(',') : String(input || '');
    return Array.from(
      new Set(
        raw
          .split(',')
          .map(s => String(s || '').trim())
          .filter(Boolean)
      )
    );
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

  /** 选品维度：汇总全部采购记录 uk/de，>0 则需对应语言 */
  private resolveRequiredLanguagesByCandidateSums(
    sums?: { uk: number; de: number }
  ): Array<'en' | 'de'> {
    const langs: Array<'en' | 'de'> = [];
    if (Number(sums?.uk || 0) > 0) langs.push('en');
    if (Number(sums?.de || 0) > 0) langs.push('de');
    return langs;
  }

  /** 按关联选品 createTime 过滤：1-6 月 / year 今年 / all 或不传为全部 */
  private applyCandidateCreatedWithinFilter(qb: any, within?: string) {
    const raw = String(within || '').trim();
    if (!raw || raw === 'all') return;

    const now = new Date();
    let startDate: Date | null = null;

    if (raw === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      const months = Number(raw);
      if (Number.isFinite(months) && months >= 1 && months <= 6) {
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - months);
      }
    }

    if (!startDate) return;

    const pad = (n: number) => String(n).padStart(2, '0');
    const formatted = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())} 00:00:00`;
    qb.andWhere('c.createTime >= :candidateCreatedSince', {
      candidateCreatedSince: formatted,
    });
  }

  private applySceneConditions(qb: any, scene = 'all') {
    switch (scene) {
      case 'requirement':
        qb.andWhere('t.status IN (:...s)', { s: [101, 102, 103] });
        break;
      case 'shoot_mine':
        qb.andWhere('t.status = :s', { s: 202 });
        if (this.ctx?.admin?.userId != null) {
          qb.andWhere('t.shooter_id = :uid', { uid: String(this.ctx.admin.userId) });
        } else {
          qb.andWhere('1=0');
        }
        break;
      case 'shoot_pool':
        qb.andWhere('t.status = :s', { s: 201 });
        break;
      case 'design_mine':
        qb.andWhere('t.status = :s', { s: 302 });
        if (this.ctx?.admin?.userId != null) {
          qb.andWhere('t.designer_id = :uid', { uid: String(this.ctx.admin.userId) });
        } else {
          qb.andWhere('1=0');
        }
        break;
      case 'design_pool':
        qb.andWhere('t.status = :s', { s: 301 });
        break;
      case 'shoot':
        qb.andWhere('t.status IN (:...s)', { s: [201, 202] });
        break;
      case 'design':
        qb.andWhere('t.status IN (:...s)', { s: [301, 302] });
        break;
      case 'finished':
        qb.andWhere('t.status IN (:...s)', { s: [401, 500] });
        break;
      case 'closed':
        qb.andWhere('t.status = :s', { s: 509 });
        break;
      case 'all':
      default:
        break;
    }
  }

  /**
   * 场景分页：
   * - design-requirement-list: scene=requirement → 101/102/103
   * - shoot-task: scene=shoot_mine(202)/shoot_pool(201)
   * - design-task: scene=design_mine(302)/design_pool(301)
   * - design-task-all: scene=all|requirement|shoot|design|finished|closed
   *
   * 支持 keyword 模糊搜索 SKU / 产品名 / ASIN。
   * 排序：状态倒序（大在前），同状态按创建时间正序（早在前）。
   */
  @Get('/pageByScene')
  async pageByScene(
    @Query('scene') scene = 'all',
    @Query('keyword') keyword?: string,
    @Query('shop') shop?: string,
    @Query('submitter') submitter?: string,
    @Query('candidateCreatedWithin') candidateCreatedWithin?: string,
    @Query('page') page = 1,
    @Query('size') size = 20,
  ) {
    const qb = this.taskRepo
      .createQueryBuilder('t')
      .leftJoin(AppAmzBsrCandidateEntity, 'c', 'c.id = t.candidate_id')
      .select([
        't.id',
        't.candidate_id',
        't.status',
        't.designer_upload_path',
        't.photographer_upload_path',
        't.ai_task_id',
        't.main_image',
        't.createTime',
        't.updateTime',
        'c.id',
        'c.asin',
        'c.sku',
        'c.produce_name',
        'c.marketplace',
        'c.image_url',
        'c.aliyun_img',
      ])
      .orderBy('t.status', 'DESC')
      .addOrderBy('t.createTime', 'ASC');
    this.applySceneConditions(qb, scene);
    this.applyCandidateCreatedWithinFilter(qb, candidateCreatedWithin);

    if (keyword && keyword.trim()) {
      const kw = `%${keyword.trim()}%`;
      qb.andWhere(
        '(c.sku LIKE :kw OR c.produce_name LIKE :kw OR c.asin LIKE :kw)',
        { kw },
      );
    }

    const selectedShops = this.parseCsvQuery(shop);
    const selectedSubmitters = this.parseCsvQuery(submitter);
    if (selectedShops.length || selectedSubmitters.length) {
      const purchaserQb = this.purchaserRepo
        .createQueryBuilder('p')
        .select('p.candidate_id', 'candidate_id')
        .where('p.is_generate = :isGenerate', { isGenerate: 2 });

      if (selectedShops.length) {
        purchaserQb.andWhere(
          "TRIM(COALESCE(NULLIF(p.account_name, ''), p.seller_account_id)) IN (:...shops)",
          { shops: selectedShops }
        );
      }
      if (selectedSubmitters.length) {
        purchaserQb.andWhere("TRIM(COALESCE(p.purchaser, '')) IN (:...submitters)", {
          submitters: selectedSubmitters,
        });
      }

      const matched = await purchaserQb.getRawMany();
      const matchedCandidateIds = Array.from(
        new Set(
          matched
            .map((x: any) => Number(x.candidate_id || 0))
            .filter((id: number) => id > 0)
        )
      );
      if (!matchedCandidateIds.length) {
        qb.andWhere('1=0');
      } else {
        qb.andWhere('t.candidate_id IN (:...candidateIds)', {
          candidateIds: matchedCandidateIds,
        });
      }
    }

    const pageNum = Number(page) || 1;
    const pageSize = Number(size) || 20;

    const total = await qb.getCount();
    qb.offset((pageNum - 1) * pageSize).limit(pageSize);
    const rawList = await qb.getRawMany();

    // 计算每个任务在“当前这一步”的分项进度：
    // - 1** 使用 reviewed
    // - 2** 使用 photographed
    // - 3** 使用 design_done（4**/5** 暂时不算）
    const taskIds = rawList.map((raw: any) => raw.t_id).filter((id: any) => !!id);
    const pictureStatMap = new Map<
      number,
      { total: number; reviewed: number; photographed: number; designDone: number }
    >();
    if (taskIds.length > 0) {
      const pictures = await this.pictureRepo.find({
        where: { task_id: In(taskIds) },
      });
      for (const pic of pictures) {
        const tid = pic.task_id;
        let stat = pictureStatMap.get(tid);
        if (!stat) {
          stat = { total: 0, reviewed: 0, photographed: 0, designDone: 0 };
          pictureStatMap.set(tid, stat);
        }
        stat.total += 1;
        if (pic.reviewed) stat.reviewed += 1;
        if (pic.photographed) stat.photographed += 1;
        if (pic.design_done) stat.designDone += 1;
      }
    }

    const candidateIds = Array.from(
      new Set(
        rawList
          .map((raw: any) => Number(raw.t_candidate_id || 0))
          .filter((id: number) => id > 0)
      )
    );
    const candidateShopMap = new Map<number, string[]>();
    const candidateSubmitterMap = new Map<number, string[]>();
    if (candidateIds.length > 0) {
      const purchasers = await this.purchaserRepo.find({
        where: {
          candidate_id: In(candidateIds.map(String)),
          // 仅聚合采购决策为“做”的记录
          is_generate: 2 as any,
        } as any,
        select: [
          'candidate_id',
          'purchaser',
          'account_name',
          'seller_account_id',
        ] as any,
      } as any);

      for (const row of purchasers) {
        const candidateId = Number(row?.candidate_id || 0);
        if (!candidateId) continue;

        const shop = String(row?.account_name || row?.seller_account_id || '').trim();
        if (shop) {
          if (!candidateShopMap.has(candidateId)) {
            candidateShopMap.set(candidateId, []);
          }
          const shops = candidateShopMap.get(candidateId)!;
          if (!shops.includes(shop)) shops.push(shop);
        }

        const submitter = String(row?.purchaser || '').trim();
        if (submitter) {
          if (!candidateSubmitterMap.has(candidateId)) {
            candidateSubmitterMap.set(candidateId, []);
          }
          const submitters = candidateSubmitterMap.get(candidateId)!;
          if (!submitters.includes(submitter)) submitters.push(submitter);
        }
      }
    }

    const candidatePurchaseSumMap = new Map<number, { uk: number; de: number }>();
    if (candidateIds.length > 0) {
      const purchasersForLang = await this.purchaserRepo.find({
        where: { candidate_id: In(candidateIds.map(String)) } as any,
        select: ['candidate_id', 'purchaserNum'],
      });
      for (const row of purchasersForLang) {
        const candidateId = Number(row?.candidate_id || 0);
        if (!candidateId) continue;
        const { uk, de } = this.parsePurchaserNumUkDe(row.purchaserNum);
        const prev = candidatePurchaseSumMap.get(candidateId) || { uk: 0, de: 0 };
        prev.uk += uk;
        prev.de += de;
        candidatePurchaseSumMap.set(candidateId, prev);
      }
    }

    const list = rawList.map((raw: any) => {
      const id = raw.t_id as number;
      const status = Number(raw.t_status);
      const stat = pictureStatMap.get(id) ?? {
        total: 0,
        reviewed: 0,
        photographed: 0,
        designDone: 0,
      };

      let stepTotal = stat.total;
      let stepDone = 0;
      if (status >= 100 && status < 200) {
        stepDone = stat.reviewed;
      } else if (status >= 200 && status < 300) {
        stepDone = stat.photographed;
      } else if (status >= 300 && status < 400) {
        stepDone = stat.designDone;
      }

      const candidateId = Number(raw.t_candidate_id || 0);
      const sellerNames = candidateShopMap.get(candidateId) || [];
      const submitters = candidateSubmitterMap.get(candidateId) || [];

      return {
        id,
        candidate_id: raw.t_candidate_id,
        status,
        designer_upload_path: raw.t_designer_upload_path,
        photographer_upload_path: raw.t_photographer_upload_path,
        ai_task_id: raw.t_ai_task_id,
        main_image: raw.t_main_image,
        createTime: raw.t_createTime,
        updateTime: raw.t_updateTime,
        sku: raw.c_sku,
        produce_name: raw.c_produce_name,
        asin: raw.c_asin,
        marketplace: raw.c_marketplace,
        image_url: String(raw.c_aliyun_img || raw.c_image_url || '').trim(),
        shop_list: sellerNames,
        submitter_list: submitters,
        shop: sellerNames.join(' / '),
        submitter: submitters.join(' / '),
        step_total: stepTotal,
        step_done: stepDone,
        required_languages: this.resolveRequiredLanguagesByCandidateSums(
          candidatePurchaseSumMap.get(candidateId)
        ),
      };
    });

    if (scene === 'requirement' && list.length > 0) {
      const stuckIds = list
        .filter((row: any) => Number(row.status) === 102)
        .map((row: any) => Number(row.id))
        .filter((id: number) => id > 0);
      if (stuckIds.length) {
        const repaired = await this.designTaskService.repairStuckRequirementAiFailedTasks(
          stuckIds
        );
        for (const row of list as any[]) {
          if (repaired.has(Number(row.id))) row.status = 103;
        }
      }
    }

    const shootScenes = new Set(['shoot_mine', 'shoot_pool']);
    if (shootScenes.has(scene) && list.length > 0) {
      const candidateIds = list
        .map((row: any) => Number(row.candidate_id))
        .filter((id: number) => id > 0);
      const samplePlansMap =
        await this.candidateSamplePurchaseSummaryService.getSamplePlansMapByCandidateIds(
          candidateIds
        );
      for (const row of list as any[]) {
        const cid = Number(row.candidate_id);
        row.sample_purchase_plans = samplePlansMap.get(cid) ?? [];
      }
    }

    return this.ok({
      list,
      pagination: {
        page: pageNum,
        size: pageSize,
        total,
      },
    });
  }

  @Get('/timeline')
  async timelineByQuery(@Query('id') id: number) {
    const data = await this.designTaskService.getTimeline(Number(id));
    return this.ok(data);
  }

  @Post('/timeline')
  async timelineByBody(@Body('id') id: number) {
    const data = await this.designTaskService.getTimeline(Number(id));
    return this.ok(data);
  }

  @Get('/pageBySceneFilters')
  async pageBySceneFilters(
    @Query('scene') scene = 'requirement',
    @Query('candidateCreatedWithin') candidateCreatedWithin?: string,
  ) {
    const taskQb = this.taskRepo
      .createQueryBuilder('t')
      .leftJoin(AppAmzBsrCandidateEntity, 'c', 'c.id = t.candidate_id')
      .select('DISTINCT t.candidate_id', 'candidate_id');
    this.applySceneConditions(taskQb, scene);
    this.applyCandidateCreatedWithinFilter(taskQb, candidateCreatedWithin);

    const taskRows = await taskQb.getRawMany();
    const candidateIds = Array.from(
      new Set(
        taskRows
          .map((row: any) => Number(row.candidate_id || 0))
          .filter((id: number) => id > 0)
      )
    );
    if (!candidateIds.length) {
      return this.ok({ shops: [], submitters: [] });
    }

    const purchasers = await this.purchaserRepo.find({
      where: {
        candidate_id: In(candidateIds.map(String)),
        is_generate: 2 as any,
      } as any,
      select: ['account_name', 'seller_account_id', 'purchaser'] as any,
    } as any);

    const shops = Array.from(
      new Set(
        purchasers
          .map(row => String(row?.account_name || row?.seller_account_id || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'zh-CN'));

    const submitters = Array.from(
      new Set(
        purchasers
          .map(row => String(row?.purchaser || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'zh-CN'));

    return this.ok({ shops, submitters });
  }

  /**
   * 选品样品采购汇总（状态链制图-摄影阶段展示）
   */
  @Get('/samplePurchaseSummary')
  async samplePurchaseSummary(@Query('candidateId') candidateId?: string) {
    const cid = Number(candidateId);
    if (!cid) {
      return this.ok(null);
    }
    const map =
      await this.candidateSamplePurchaseSummaryService.getSummaryMapByCandidateIds([cid]);
    return this.ok(map.get(cid) ?? null);
  }

  /**
   * 任务详情：主任务 + 图片位列表
   */
  @Get('/detail')
  async detail(@Query('id') id: number) {
    const taskId = Number(id);
    if (!taskId) {
      return this.ok({});
    }

    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      return this.ok({});
    }

    const candidate = await this.candidateRepo.findOne({
      where: { id: task.candidate_id },
      select: ['id', 'asin', 'sku', 'produce_name', 'marketplace', 'image_url'],
    });

    const pictures = await this.pictureRepo.find({
      where: { task_id: taskId },
      order: { label: 'ASC', id: 'ASC' },
    });

    const picturesWithCopies = pictures.map(p => {
      const copies = normalizeDesignTaskPictureCopies(p.copies) ?? [];
      return {
        ...p,
        copies: copies.length ? copies : [{}],
      };
    });

    // 其他信息：按选品 id 拉全量变体、工厂链接、采购记录；变体/账号仅返回已有 MSKU 的（挂载下拉用）
    const cid = task.candidate_id;
    const [variants, factoryLinks, purchasers, mskus] = await Promise.all([
      this.variantRepo.find({
        where: { candidate_id: cid },
        order: { sort_order: 'ASC', createTime: 'ASC' },
      }),
      this.factoryLinkRepo.find({
        where: { candidate_id: cid },
        order: { sort_order: 'ASC', createTime: 'ASC' },
      }),
      this.purchaserRepo.find({
        where: { candidate_id: String(cid) },
      }),
      this.designTaskService.getMskusForCandidate(cid),
    ]);

    const variantIdsWithMsku = new Set(mskus.map((m: { variant_id?: string | null }) => m.variant_id).filter(Boolean));
    const sellersFromMskus = new Map<string, string>();
    mskus.forEach((m: { seller_account_id: string; account_name?: string }) => {
      const sid = (m.seller_account_id ?? '').trim();
      if (sid && !sellersFromMskus.has(sid)) sellersFromMskus.set(sid, m.account_name ?? '');
    });
    const sellers: Array<{ seller_account_id: string; account_name: string }> = Array.from(sellersFromMskus.entries()).map(
      ([seller_account_id, account_name]) => ({ seller_account_id, account_name: account_name || seller_account_id }),
    );

    const variantsForFront = variants
      .filter(v => variantIdsWithMsku.has(v.id))
      .map(v => {
        const gp = v.group_proportions || {};
        return {
          variantsid: v.id,
          name: v.name ?? '',
          imageUrl: '',
          group_proportions: gp,
          description: v.description ?? '',
        };
      });

    const factoryLinksForFront = factoryLinks.map(f => ({
      id: f.id,
      type: f.type ?? 'main',
      name: f.name ?? '',
      price: f.price ?? 0,
      link: f.user_input ?? '',
      linkDescription: f.user_input_description ?? '',
    }));

    const purchasesForFront = purchasers.map(p => {
      let uk = 0;
      let de = 0;
      try {
        const raw = typeof p.purchaserNum === 'string' ? JSON.parse(p.purchaserNum || '{}') : (p.purchaserNum || {});
        uk = Number(raw.uk) || 0;
        de = Number(raw.de) || 0;
      } catch {
        // ignore
      }
      const total = uk + de;
      const status = p.is_generate === 2 ? '已确认' : p.is_generate === 3 ? '已取消' : '待决策';
      return {
        uk,
        de,
        status,
        opinion: p.procurement ?? '',
        variantId: p.selected_variant_id ?? undefined,
        seller_account_id: p.seller_account_id ?? '',
        msku: p.msku ?? '',
        total,
        submitter: p.purchaser ?? '',
      };
    });

    return this.ok({
      task,
      candidate: candidate ?? undefined,
      pictures: picturesWithCopies,
      variants: variantsForFront,
      factoryLinks: factoryLinksForFront,
      purchases: purchasesForFront,
      sellers,
      mskus,
    });
  }

  /**
   * 标记单个图片位在当前步骤的完成状态：
   * - 1** → reviewed
   * - 2** → photographed
   * - 3** → design_done
   * 4xx / 5xx 暂不处理
   */
  @Post('/markStepDone')
  async markStepDone(
    @Body('pictureId') pictureId: number,
    @Body('done') done: boolean,
  ) {
    const picId = Number(pictureId);
    if (!picId) {
      return this.ok({});
    }

    const picture = await this.pictureRepo.findOne({ where: { id: picId } });
    if (!picture) {
      return this.ok({});
    }

    const task = await this.taskRepo.findOne({ where: { id: picture.task_id } });
    if (!task) {
      return this.ok({});
    }

    const status = Number(task.status);
    let col: 'reviewed' | 'photographed' | 'design_done' | null = null;
    if (status >= 100 && status < 200) {
      col = 'reviewed';
    } else if (status >= 200 && status < 300) {
      col = 'photographed';
    } else if (status >= 300 && status < 400) {
      col = 'design_done';
    }

    if (!col) {
      // 当前状态不支持分项操作，直接返回
      return this.ok({});
    }

    const patch: any = {};
    patch[col] = done ? 1 : 0;
    await this.pictureRepo.update(picId, patch);

    // 返回当前任务在该步骤的最新进度
    const total = await this.pictureRepo.count({ where: { task_id: picture.task_id } });
    const whereDone: any = { task_id: picture.task_id };
    whereDone[col] = 1;
    const stepDone = await this.pictureRepo.count({ where: whereDone });

    return this.ok({
      step_total: total,
      step_done: stepDone,
    });
  }

  /**
   * 一键标记当前任务下所有图片位在当前步骤的完成状态（同上：1xx→reviewed, 2xx→photographed, 3xx→design_done）
   */
  @Post('/markAllStepDone')
  async markAllStepDone(
    @Body('taskId') taskId: number,
    @Body('done') done: boolean,
  ) {
    const tid = Number(taskId);
    if (!tid) {
      return this.ok({ step_total: 0, step_done: 0 });
    }

    const task = await this.taskRepo.findOne({ where: { id: tid } });
    if (!task) {
      return this.ok({ step_total: 0, step_done: 0 });
    }

    const status = Number(task.status);
    let col: 'reviewed' | 'photographed' | 'design_done' | null = null;
    if (status >= 100 && status < 200) {
      col = 'reviewed';
    } else if (status >= 200 && status < 300) {
      col = 'photographed';
    } else if (status >= 300 && status < 400) {
      col = 'design_done';
    }

    if (!col) {
      const total = await this.pictureRepo.count({ where: { task_id: tid } });
      return this.ok({ step_total: total, step_done: 0 });
    }

    const patch: any = {};
    patch[col] = done ? 1 : 0;
    await this.pictureRepo.update({ task_id: tid }, patch);

    const total = await this.pictureRepo.count({ where: { task_id: tid } });
    const whereDone: any = { task_id: tid };
    whereDone[col] = 1;
    const stepDone = await this.pictureRepo.count({ where: whereDone });

    return this.ok({
      step_total: total,
      step_done: stepDone,
    });
  }

  /**
   * 批量更新图需和多语言文案
   */
  @Post('/batchUpdateRequirements')
  async batchUpdateRequirements(
    @Body()
    data: {
      updates: Array<{
        pictureId: number;
        requirements?: string;
        reference_image?: string;
        remark_doc?: unknown;
        label?: string;
        type?: string;
        msku?: string | null;
        variant_id?: string | null;
        seller_account_id?: string | null;
        submitter?: string | null;
        /** 多条文案，与前端 copies 一一对应；传则整组覆盖该 picture 下所有 caption */
        captions?: Array<{
          raw_text?: string;
          raw_after_rephrase?: string;
          role?: string;
          zh?: string;
          uk?: string;
          de?: string;
          fr?: string;
          it?: string;
          es?: string;
        }>;
      }>;
    },
  ) {
    const updates = data?.updates ?? [];
    if (!Array.isArray(updates) || updates.length === 0) {
      return this.ok({ message: '没有需要更新的数据' });
    }

    for (const item of updates) {
      const {
        pictureId,
        requirements,
        reference_image,
        remark_doc,
        captions,
        label,
        type,
        msku,
        variant_id,
        seller_account_id,
        submitter,
      } = item;
      if (!pictureId) continue;

      const patch: Partial<DesignTaskPictureEntity> = {};
      if (requirements !== undefined) patch.requirements = requirements || '';
      if (reference_image !== undefined) patch.reference_image = reference_image || '';
      if (remark_doc !== undefined) {
        patch.remark_doc = normalizeDesignTaskPictureRemarkDoc(remark_doc);
      }
      if (captions && Array.isArray(captions)) {
        patch.copies = normalizeDesignTaskPictureCopies(captions);
      }
      const hasMeta =
        label !== undefined ||
        type !== undefined ||
        msku !== undefined ||
        variant_id !== undefined ||
        seller_account_id !== undefined ||
        submitter !== undefined;
      if (hasMeta) {
        const meta = await this.designTaskService.buildPictureDetailMetaPatch(pictureId, {
          label,
          type,
          msku,
          variant_id,
          seller_account_id,
          submitter,
        });
        if (meta.ok === false) {
          return this.fail(meta.message);
        }
        Object.assign(patch, meta.patch);
      }
      if (Object.keys(patch).length > 0) {
        await this.pictureRepo.update(pictureId, patch);
      }
    }

    return this.ok({ message: '批量更新成功' });
  }

  /**
   * 中文案 → 英/德/法/意/西（qwen-mt-flash @ 智增增 OpenAI 兼容端点）
   */
  @Post('/translateFromZh')
  async translateFromZh(@Body() body: { text?: string }) {
    try {
      const out = await this.baiduTranslateService.translateZhToListingLocales(body?.text ?? '');
      return this.ok(out);
    } catch (e: any) {
      return this.fail(e?.message || '翻译失败');
    }
  }

  /**
   * 批量更新图片位的变体描述（冗余字段）
   */
  @Post('/batchUpdateVariantDesc')
  async batchUpdateVariantDesc(
    @Body()
    data: {
      updates: Array<{
        pictureId: number;
        variantDesc: string;
      }>;
    },
  ) {
    const updates = data?.updates ?? [];
    if (!Array.isArray(updates) || updates.length === 0) {
      return this.ok({ message: '没有需要更新的数据' });
    }

    for (const item of updates) {
      const { pictureId, variantDesc } = item;
      if (!pictureId) continue;
      await this.pictureRepo.update(pictureId, {
        variant_desc: (variantDesc || '').trim(),
      });
    }

    return this.ok({ message: '批量更新成功' });
  }

  /**
   * 编辑图需页保存：按 slots 全量覆盖该任务的图片位；仅主图必选 MSKU，其余类型挂载（变体/账号）均为可选
   */
  /**
   * 图需详情：新增单个图片位（编号/类型/挂载由前端填写，与选图页保存规则一致）
   */
  @Post('/createPictureSlot')
  async createPictureSlot(
    @Body()
    body: {
      taskId: number;
      label: string;
      type: string;
      msku?: string;
      variant_id?: string;
      seller_account_id?: string;
    },
  ) {
    const r = await this.designTaskService.createPictureSlot(body);
    if (r.ok === false) return this.fail(r.message);
    return this.ok(r);
  }

  @Post('/saveRequirementSlots')
  async saveRequirementSlots(
    @Body()
    data: {
      taskId: number;
      slots: Array<{
        pictureId?: number;
        label: string;
        type: string;
        reference_image?: string;
        description?: string;
        msku?: string;
        variant_id?: string;
        seller_account_id?: string;
        remark_doc?: unknown;
      }>;
    },
  ) {
    const result = await this.designTaskService.saveRequirementSlots(data);
    if (result.ok === false) return this.fail(result.message);
    return this.ok({ message: '保存成功' });
  }

  /**
   * 获取该任务对应选品下 status=2 的竞品参考图列表（7 张图/条），供 AI 生成图需弹窗展示与排序
   */
  @Get('/getReferenceImages')
  async getReferenceImages(@Query('taskId') taskId: number) {
    const result = await this.designTaskService.getReferenceImages(Number(taskId));
    return this.ok(result);
  }

  /**
   * 上传任务列表分页（按 MSKU 拆分的上传任务）
   */
  @Get('/pageUploadTasks')
  async pageUploadTasks(
    @Query('keyword') keyword?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    const result = await this.designTaskService.pageUploadTasks({ keyword, page, size });
    return this.ok(result);
  }

  /**
   * 上传任务详情（按 MSKU 拆分的单条上传任务）
   */
  @Get('/uploadTaskDetail')
  async uploadTaskDetail(@Query('id') id: number) {
    const result = await this.designTaskService.getUploadTaskDetail(Number(id));
    return this.ok(result);
  }

  /**
   * 内容工作台用：按 candidate_id + msku 查该 MSKU 的上传相关信息
   * （上传路径、checklist），不依赖 design_upload_task 必须存在
   */
  @Get('/mskuUploadInfo')
  async mskuUploadInfo(
    @Query('candidateId') candidateId: number,
    @Query('msku') msku: string,
  ) {
    const result = await this.designTaskService.getMskuUploadInfo(
      Number(candidateId),
      String(msku || ''),
    );
    return this.ok(result);
  }

  /**
   * 保存上传任务详情（最终上传店铺 + 上传检查表）
   */
  @Post('/saveUploadTaskDetail')
  async saveUploadTaskDetail(
    @Body()
    body: {
      id: number;
      finalAccount?: string;
      items?: Array<{ pictureId?: number; code?: string; completed: boolean }>;
    },
  ) {
    const result = await this.designTaskService.saveUploadTaskDetail(body);
    if (!result.ok) return this.fail(result.message || '保存失败');
    return this.ok({ message: '保存成功' });
  }

  /**
   * 同步拉取单个竞品参考图并落库，返回该竞品当前 7 张图
   */
  @Post('/fetchCompetitorReferenceImages')
  async fetchCompetitorReferenceImages(@Body() payload: { competitorId: number }) {
    const result = await this.designTaskService.fetchCompetitorReferenceImages(Number(payload?.competitorId));
    if (!result.ok) return this.fail(result.message || '获取失败');
    return this.ok(result);
  }

  /**
   * 选图 AI 生成图需：保存完成后，将任务状态切到 102（AI生成图需中）
   */
  @Post('/markRequirementAiGenerating')
  async markRequirementAiGenerating(@Body() payload: { taskId: number; mode?: 'all' | 'delta' }) {
    const id = Number(payload?.taskId);
    if (!id) return this.ok({ message: 'taskId 无效' });
    const mode: 'all' | 'delta' = (payload?.mode === 'delta' ? 'delta' : 'all');
    const remark = mode === 'delta' ? '选图AI差量生成图需' : undefined;
    await this.designTaskService.markRequirementAiGenerating(id, remark);
    // 通过任务系统异步生成，payload 中携带 mode 供后续处理
    const dispatchId = await this.designTaskService.enqueueMockAiGenerate(payload);
    if (dispatchId) {
      await this.taskRepo.update(id, { ai_task_id: Number(dispatchId) || null });
    }
    return this.ok({ message: '状态已更新为 AI生成图需中' });
  }

  /**
   * 审核图需完成：103 -> 201
   */
  @Post('/markRequirementReviewed')
  async markRequirementReviewed(@Body('taskId') taskId: number) {
    const result = await this.designTaskService.markRequirementReviewed(Number(taskId));
    if (!result.ok) return this.fail(result.message || '操作失败');
    return this.ok({ message: '已进入待摄影领取' });
  }

  /**
   * 关闭图需任务：101/102/103 -> 509（已关闭）
   */
  @Post('/design/close')
  async closeRequirementTask(@Body('taskId') taskId: number) {
    const result = await this.designTaskService.closeRequirementTask(Number(taskId));
    if (!result.ok) return this.fail(result.message || '操作失败');
    return this.ok({ message: '已关闭' });
  }

  /**
   * 重新打开图需任务：509 -> 101
   */
  @Post('/design/reopen')
  async reopenRequirementTask(@Body('taskId') taskId: number) {
    const result = await this.designTaskService.reopenRequirementTask(Number(taskId));
    if (!result.ok) return this.fail(result.message || '操作失败');
    return this.ok({ message: '已重新打开' });
  }

  /**
   * 摄影领取：201 -> 202
   */
  @Post('/shoot/take')
  async shootTake(@Body('taskId') taskId: number) {
    const admin = this.ctx?.admin ?? {};
    const result = await this.designTaskService.shootTake(Number(taskId), {
      userId: admin.userId,
      username: admin.username ?? admin.name,
    });
    if (!result.ok) return this.fail(result.message || '领取失败');
    return this.ok({ message: '已领取' });
  }

  /**
   * 摄影取消领取：202 -> 201
   */
  @Post('/shoot/cancel')
  async shootCancel(@Body('taskId') taskId: number) {
    const admin = this.ctx?.admin ?? {};
    const result = await this.designTaskService.shootCancel(Number(taskId), {
      userId: admin.userId,
    });
    if (!result.ok) return this.fail(result.message || '取消失败');
    return this.ok({ message: '已取消领取' });
  }

  /**
   * 摄影完成：202 -> 301（要求摄影上传路径已填写）
   */
  @Post('/shoot/complete')
  async shootComplete(@Body('taskId') taskId: number) {
    const admin = this.ctx?.admin ?? {};
    const result = await this.designTaskService.shootComplete(Number(taskId), {
      userId: admin.userId,
    });
    if (!result.ok) return this.fail(result.message || '完成失败');
    return this.ok({ message: '已进入待美工领取' });
  }

  /**
   * 美工领取：301 -> 302
   */
  @Post('/design/take')
  async designTake(@Body('taskId') taskId: number) {
    const admin = this.ctx?.admin ?? {};
    const result = await this.designTaskService.designTake(Number(taskId), {
      userId: admin.userId,
      username: admin.username ?? admin.name,
    });
    if (!result.ok) return this.fail(result.message || '领取失败');
    return this.ok({ message: '已领取' });
  }

  /**
   * 美工取消领取：302 -> 301
   */
  @Post('/design/cancel')
  async designCancel(@Body('taskId') taskId: number) {
    const admin = this.ctx?.admin ?? {};
    const result = await this.designTaskService.designCancel(Number(taskId), {
      userId: admin.userId,
    });
    if (!result.ok) return this.fail(result.message || '取消失败');
    return this.ok({ message: '已取消领取' });
  }

  /**
   * 美工完成：302 -> 401（要求美工上传路径已填写）
   */
  @Post('/design/complete')
  async designComplete(@Body('taskId') taskId: number) {
    const admin = this.ctx?.admin ?? {};
    const result = await this.designTaskService.designComplete(Number(taskId), {
      userId: admin.userId,
    });
    if (!result.ok) return this.fail(result.message || '完成失败');
    return this.ok({ message: '已进入待上传' });
  }

  /**
   * 更新上传路径（摄影/美工）
   */
  @Post('/updateUploadPaths')
  async updateUploadPaths(
    @Body()
    body: { taskId: number; photographer_upload_path?: string; designer_upload_path?: string },
  ) {
    const id = Number(body?.taskId);
    if (!id) return this.fail('taskId 无效');
    const patch: Partial<DesignTaskEntity> = {};
    if (body.photographer_upload_path !== undefined) {
      patch.photographer_upload_path = body.photographer_upload_path || '';
    }
    if (body.designer_upload_path !== undefined) {
      patch.designer_upload_path = body.designer_upload_path || '';
    }
    if (Object.keys(patch).length === 0) return this.ok({ message: '无更新' });
    await this.taskRepo.update(id, patch);
    return this.ok({ message: '已保存' });
  }

  /**
   * 显式同步图需图片位（根据采购数据生成）。
   * force=true 时先重置任务为待选参考图再同步（选图页「强行同步」；BSR 做/不做不传 force，仍受状态限制）。
   */
  @Post('/syncForCandidate')
  async syncForCandidate(
    @Body('candidateId') candidateId: number,
    @Body('force') force?: boolean,
  ) {
    const cid = Number(candidateId);
    if (!cid) return this.ok({ message: 'candidateId 无效' });
    const { skipped } = await this.designTaskService.syncForCandidate(cid, {
      force: force === true,
    });
    return this.ok({ message: '同步完成', designTaskSyncSkipped: skipped });
  }
}
