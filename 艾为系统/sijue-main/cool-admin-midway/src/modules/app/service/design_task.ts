import { Inject, Provide } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository, In } from 'typeorm';
import { DesignTaskEntity } from '../entity/design_task';
import {
  DesignTaskPictureCopy,
  DesignTaskPictureEntity,
  normalizeDesignTaskPictureCopies,
  normalizeDesignTaskPictureRemarkDoc,
} from '../entity/design_task_picture';
import { DesignUploadTaskEntity } from '../entity/design_upload_task';
import { DesignUploadTaskPictureEntity } from '../entity/design_upload_task_picture';
import { AppAmzBsrCandidatePurchaserEntity } from '../entity/bsr_candidate_purchaser';
import { AppAmzMskuEntity } from '../entity/msku';
import { AppAmzBsrCandidateEntity } from '../entity/bsr_candidate';
import { AppAmzSellerEntity } from '../entity/seller';
import { AppAmzBsrCandidateCompetitorEntity } from '../entity/bsr_candidate_competitor';
import { TaskInfoEntity } from '../../task/entity/info';
import { TaskInfoService } from '../../task/service/info';
import { OxylabsService } from './OxylabsService';
import { DesignTaskAiService } from './DesignTaskAiService';
import { DesignJobSchedulerService } from './design_job_scheduler';
import { ListingDingTalkNotifyService } from './listing_dingtalk_notify';
import { Config } from '@midwayjs/decorator';
import { Context } from '@midwayjs/koa';
import { BaseSysRoleEntity } from '../../base/entity/sys/role';
import {
  buildMskuLookup,
  findMskuEntityByFlexibleKey,
  mskuKeysEquivalent,
} from '../utils/msku_key';

type DesignJobObserver = {
  log: (
    level: 'info' | 'warn' | 'error',
    step: string,
    message: string,
    context?: Record<string, any>
  ) => Promise<void> | void;
};

/**
 * 美工任务 & 图需 自动生成 / 同步
 */
@Provide()
export class DesignTaskService {
  @InjectEntityModel(DesignTaskEntity)
  designTaskRepo: Repository<DesignTaskEntity>;

  @InjectEntityModel(DesignTaskPictureEntity)
  pictureRepo: Repository<DesignTaskPictureEntity>;

  @InjectEntityModel(DesignUploadTaskEntity)
  uploadTaskRepo: Repository<DesignUploadTaskEntity>;

  @InjectEntityModel(DesignUploadTaskPictureEntity)
  uploadTaskPictureRepo: Repository<DesignUploadTaskPictureEntity>;

  @InjectEntityModel(AppAmzBsrCandidatePurchaserEntity)
  purchaserRepo: Repository<AppAmzBsrCandidatePurchaserEntity>;

  @InjectEntityModel(AppAmzMskuEntity)
  mskuRepo: Repository<AppAmzMskuEntity>;

  @InjectEntityModel(AppAmzBsrCandidateEntity)
  candidateRepo: Repository<AppAmzBsrCandidateEntity>;

  @InjectEntityModel(AppAmzSellerEntity)
  sellerRepo: Repository<AppAmzSellerEntity>;

  @InjectEntityModel(TaskInfoEntity)
  taskInfoRepo: Repository<TaskInfoEntity>;

  @InjectEntityModel(AppAmzBsrCandidateCompetitorEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrCandidateCompetitorEntity>;

  @Inject()
  taskInfoService: TaskInfoService;

  @Inject()
  oxylabsService: OxylabsService;

  @Inject()
  designTaskAiService: DesignTaskAiService;

  @Inject()
  designJobSchedulerService: DesignJobSchedulerService;

  @Inject()
  listingDingTalkNotifyService: ListingDingTalkNotifyService;

  @Inject()
  ctx: Context;

  @InjectEntityModel(BaseSysRoleEntity)
  baseSysRoleRepo: Repository<BaseSysRoleEntity>;

  @Config('designTaskAi')
  designTaskAiConfig: { apiKey?: string };

  private buildCopiesFromAiCaptions(captions: Array<Record<string, any>>): DesignTaskPictureCopy[] {
    return (
      normalizeDesignTaskPictureCopies(
        captions.map((cap) => ({
          raw_text: cap.rawText ?? cap.raw_text ?? '',
          raw_after_rephrase: cap.rawAfterRephrase ?? cap.raw_after_rephrase ?? '',
          role: cap.role ?? '',
          zh: cap.zh ?? '',
          uk: cap.uk ?? '',
          de: cap.de ?? '',
          fr: cap.fr ?? '',
          it: cap.it ?? '',
          es: cap.es ?? '',
        }))
      ) ?? []
    );
  }

  /** 当前操作人名字（用于时间线展示），兼容 admin 上不同字段命名 */
  private getCurrentOperatorName(): string | null {
    const admin: any = (this as any).ctx?.admin;
    if (!admin) return null;
    const name =
      admin.name ||
      admin.nickname ||
      admin.nickName ||
      admin.username ||
      admin.userName ||
      admin.account ||
      admin.realName;
    return name ? String(name) : null;
  }

  /** 时间线 item 结构 */
  private buildStatusRemark(status: number): string {
    const map: Record<number, string> = {
      101: '待选参考图',
      102: 'AI生成图需中',
      103: '待审核',
      201: '待摄影领取',
      202: '拍摄中',
      301: '待美工领取',
      302: '美工做图中',
      401: '待上传',
      402: '完成部分上传',
      500: '已完成',
      509: '已关闭',
    };
    return map[status] ?? `状态${status}`;
  }

  /** 历史脏数据：失败时误留在 102，时间线末条含「AI 图需生成失败」 */
  private isStuckRequirementAiFailedTask(
    task: Pick<DesignTaskEntity, 'status' | 'timeline'>
  ): boolean {
    if (Number(task.status) !== 102) return false;
    const list = Array.isArray(task.timeline) ? task.timeline : [];
    const last = list[list.length - 1];
    if (!last) return false;
    return String(last.remark || '').includes('AI 图需生成失败');
  }

  /** 将误留在 102 的失败任务修到 103（不追加时间线，避免重复记录） */
  async repairStuckRequirementAiFailedTasks(
    taskIds: number[]
  ): Promise<Set<number>> {
    const repaired = new Set<number>();
    const ids = [...new Set(taskIds.map(id => Number(id)).filter(id => id > 0))];
    if (!ids.length) return repaired;
    const tasks = await this.designTaskRepo.find({
      where: { id: In(ids) } as any,
      select: ['id', 'status', 'timeline'],
    });
    for (const task of tasks) {
      if (!this.isStuckRequirementAiFailedTask(task)) continue;
      task.status = 103;
      await this.designTaskRepo.save(task);
      repaired.add(Number(task.id));
    }
    return repaired;
  }

  /** 关闭图需任务：仅当状态为 101/102/103 时可关闭，流转到已关闭(509) */
  async closeRequirementTask(taskId: number): Promise<{ ok: boolean; message?: string }> {
    const id = Number(taskId);
    if (!id) return { ok: false, message: 'taskId 无效' };
    const task = await this.designTaskRepo.findOne({ where: { id } });
    if (!task) return { ok: false, message: '任务不存在' };
    const s = Number(task.status);
    if (s !== 101 && s !== 102 && s !== 103) {
      return { ok: false, message: '当前状态不允许关闭' };
    }
    await this.updateStatusWithTimeline(task, 509, '关闭图需任务');
    return { ok: true };
  }

  /** 重新打开图需任务：仅当状态为 509（已关闭）时可重新打开，流转回 101（待选参考图） */
  async reopenRequirementTask(taskId: number): Promise<{ ok: boolean; message?: string }> {
    const id = Number(taskId);
    if (!id) return { ok: false, message: 'taskId 无效' };
    const task = await this.designTaskRepo.findOne({ where: { id } });
    if (!task) return { ok: false, message: '任务不存在' };
    if (Number(task.status) !== 509) return { ok: false, message: '当前状态不允许重新打开' };
    await this.updateStatusWithTimeline(task, 101, '重新打开图需任务');
    return { ok: true };
  }

  /**
   * 统一入口：修改任务状态 + 追加一条 timeline 记录
   * 后续所有涉及状态流转的地方都应该走这个函数。
   */
  private async updateStatusWithTimeline(
    task: DesignTaskEntity,
    newStatus: number,
    extraRemark?: string,
  ): Promise<DesignTaskEntity> {
    const now = new Date().toISOString();
    const list: any[] = Array.isArray(task.timeline) ? task.timeline : [];

    const baseRemark = this.buildStatusRemark(newStatus);
    const operator = this.getCurrentOperatorName();
    list.push({
      time: now,
      status: newStatus,
      remark: extraRemark ? `${baseRemark}：${extraRemark}` : baseRemark,
      ...(operator ? { operator } : {}),
    });

    task.status = newStatus;
    task.timeline = list;
    return await this.designTaskRepo.save(task);
  }

  async markRequirementReviewed(taskId: number): Promise<{ ok: boolean; message?: string }> {
    const id = Number(taskId);
    if (!id) return { ok: false, message: 'taskId 无效' };
    const task = await this.designTaskRepo.findOne({ where: { id } });
    if (!task) return { ok: false, message: '任务不存在' };
    if (Number(task.status) !== 103) return { ok: false, message: '当前状态不允许审核完成' };
    await this.updateStatusWithTimeline(task, 201, '审核图需完成');
    return { ok: true };
  }

  async shootTake(
    taskId: number,
    user: { userId?: string | number; username?: string } = {},
  ): Promise<{ ok: boolean; message?: string }> {
    const id = Number(taskId);
    if (!id) return { ok: false, message: 'taskId 无效' };
    const task = await this.designTaskRepo.findOne({ where: { id } });
    if (!task) return { ok: false, message: '任务不存在' };
    if (Number(task.status) !== 201) return { ok: false, message: '当前状态不允许领取' };

    task.shooter_id = user.userId != null ? String(user.userId) : null;
    task.shooter_name = user.username ?? null;
    await this.updateStatusWithTimeline(task, 202, '摄影领取任务');
    return { ok: true };
  }

  async shootCancel(
    taskId: number,
    user: { userId?: string | number } = {},
  ): Promise<{ ok: boolean; message?: string }> {
    const id = Number(taskId);
    if (!id) return { ok: false, message: 'taskId 无效' };
    const task = await this.designTaskRepo.findOne({ where: { id } });
    if (!task) return { ok: false, message: '任务不存在' };
    if (Number(task.status) !== 202) return { ok: false, message: '当前状态不允许取消领取' };
    if (task.shooter_id && user.userId != null && task.shooter_id !== String(user.userId)) {
      return { ok: false, message: '仅领取人可取消' };
    }

    task.shooter_id = null;
    task.shooter_name = null;
    await this.updateStatusWithTimeline(task, 201, '摄影取消领取');
    return { ok: true };
  }

  async shootComplete(
    taskId: number,
    user: { userId?: string | number } = {},
  ): Promise<{ ok: boolean; message?: string }> {
    const id = Number(taskId);
    if (!id) return { ok: false, message: 'taskId 无效' };
    const task = await this.designTaskRepo.findOne({ where: { id } });
    if (!task) return { ok: false, message: '任务不存在' };
    if (Number(task.status) !== 202) return { ok: false, message: '当前状态不允许完成拍摄' };
    if (task.shooter_id && user.userId != null && task.shooter_id !== String(user.userId)) {
      return { ok: false, message: '仅领取人可完成' };
    }
    if (!task.photographer_upload_path || !task.photographer_upload_path.trim()) {
      return { ok: false, message: '请先填写摄影上传路径' };
    }

    await this.updateStatusWithTimeline(task, 301, '拍摄完成');
    return { ok: true };
  }

  async designTake(
    taskId: number,
    user: { userId?: string | number; username?: string } = {},
  ): Promise<{ ok: boolean; message?: string }> {
    const id = Number(taskId);
    if (!id) return { ok: false, message: 'taskId 无效' };
    const task = await this.designTaskRepo.findOne({ where: { id } });
    if (!task) return { ok: false, message: '任务不存在' };
    if (Number(task.status) !== 301) return { ok: false, message: '当前状态不允许领取' };

    task.designer_id = user.userId != null ? String(user.userId) : null;
    task.designer_name = user.username ?? null;
    await this.updateStatusWithTimeline(task, 302, '美工领取任务');
    return { ok: true };
  }

  async designCancel(
    taskId: number,
    user: { userId?: string | number } = {},
  ): Promise<{ ok: boolean; message?: string }> {
    const id = Number(taskId);
    if (!id) return { ok: false, message: 'taskId 无效' };
    const task = await this.designTaskRepo.findOne({ where: { id } });
    if (!task) return { ok: false, message: '任务不存在' };
    if (Number(task.status) !== 302) return { ok: false, message: '当前状态不允许取消领取' };
    if (task.designer_id && user.userId != null && task.designer_id !== String(user.userId)) {
      return { ok: false, message: '仅领取人可取消' };
    }

    task.designer_id = null;
    task.designer_name = null;
    await this.updateStatusWithTimeline(task, 301, '美工取消领取');
    return { ok: true };
  }

  async designComplete(
    taskId: number,
    user: { userId?: string | number } = {},
  ): Promise<{ ok: boolean; message?: string }> {
    const id = Number(taskId);
    if (!id) return { ok: false, message: 'taskId 无效' };
    const task = await this.designTaskRepo.findOne({ where: { id } });
    if (!task) return { ok: false, message: '任务不存在' };
    if (Number(task.status) !== 302) return { ok: false, message: '当前状态不允许完成做图' };
    if (task.designer_id && user.userId != null && task.designer_id !== String(user.userId)) {
      return { ok: false, message: '仅领取人可完成' };
    }
    if (!task.designer_upload_path || !task.designer_upload_path.trim()) {
      return { ok: false, message: '请先填写美工上传路径' };
    }

    await this.updateStatusWithTimeline(task, 401, '做图完成');
    await this.createUploadTasksForDesignTask(task.id);
    return { ok: true };
  }

  /**
   * 美工任务进入 401 后：按主图 MSKU 列表落表 design_upload_task，并写入该 MSKU 需上传的图片位（主图/变体共用/店铺共用/公用）
   */
  async createUploadTasksForDesignTask(designTaskId: number): Promise<void> {
    const task = await this.designTaskRepo.findOne({ where: { id: designTaskId }, select: ['id', 'candidate_id'] });
    if (!task) return;
    const pictures = await this.pictureRepo.find({
      where: { task_id: designTaskId },
      select: ['id', 'task_id', 'label', 'type', 'msku', 'seller_account_id', 'variant_id', 'reference_image'],
    });
    const mainMskus = Array.from(
      new Set(pictures.filter(p => p.type === '主图' && p.msku).map(p => p.msku as string)),
    );
    if (mainMskus.length === 0) return;

    const candidateId = task.candidate_id;
    const mskuRows = await this.mskuRepo.find({
      where: { candidate_id: String(candidateId), msku: In(mainMskus) },
      select: ['msku', 'selected_variant_id', 'seller_account_id'],
    });
    const mskuMap = new Map(mskuRows.map(r => [r.msku, r]));

    for (const msku of mainMskus) {
      const mainPic = pictures.find(p => p.type === '主图' && mskuKeysEquivalent(p.msku, msku));
      const listImage = mainPic?.reference_image ?? '';
      const row = this.uploadTaskRepo.create({
        design_task_id: designTaskId,
        msku,
        status: 401,
        list_image: listImage || '',
        timeline: [],
      });
      const saved = await this.uploadTaskRepo.save(row);
      const mrow = mskuMap.get(msku);
      const variantId = mrow?.selected_variant_id ?? null;
      const sellerAccountId = mrow?.seller_account_id ?? null;

      const pictureIds = new Set<number>();
      for (const p of pictures) {
        if (p.type === '主图' && mskuKeysEquivalent(p.msku, msku)) {
          pictureIds.add(p.id);
          continue;
        }
        if (p.variant_id === variantId && !p.msku && !p.seller_account_id) {
          pictureIds.add(p.id);
          continue;
        }
        if (p.seller_account_id === sellerAccountId && !p.msku && !p.variant_id) {
          pictureIds.add(p.id);
          continue;
        }
        if (!p.msku && !p.variant_id && !p.seller_account_id) {
          pictureIds.add(p.id);
        }
      }
      for (const pid of pictureIds) {
        await this.uploadTaskPictureRepo.insert({
          upload_task_id: saved.id,
          picture_id: pid,
          uploaded: 0,
        });
      }
    }
  }

  async getTimeline(id: number) {
    const row = await this.designTaskRepo.findOne({
      where: { id: Number(id) },
      select: ['id', 'timeline', 'updateTime'],
    });
    if (!row) throw new Error('图需任务不存在');
    return {
      id: Number(row.id),
      timeline: Array.isArray(row.timeline) ? row.timeline : [],
      updateTime: row.updateTime,
    };
  }

  async pageUploadTasks(params: {
    keyword?: string;
    page?: number;
    size?: number;
  }): Promise<{ list: any[]; pagination: { total: number; page: number; size: number } }> {
    const page = Math.max(1, Number(params?.page) || 1);
    const size = Math.min(100, Math.max(1, Number(params?.size) || 20));
    const keyword = (params?.keyword ?? '').trim();

    const qb = this.uploadTaskRepo
      .createQueryBuilder('ut')
      .leftJoin(DesignTaskEntity, 't', 't.id = ut.design_task_id')
      .leftJoin(AppAmzBsrCandidateEntity, 'c', 'c.id = t.candidate_id')
      .leftJoin(
        AppAmzMskuEntity,
        'm',
        "m.msku COLLATE utf8mb4_unicode_ci = ut.msku AND m.candidate_id COLLATE utf8mb4_unicode_ci = CONVERT(t.candidate_id, CHAR)",
      )
      // 仅展示未完成的上传任务（排除已完成 500）
      .where('ut.status != :doneStatus', { doneStatus: 500 })
      .select([
        'ut.id',
        'ut.design_task_id',
        'ut.msku',
        'ut.status',
        'ut.list_image',
        'ut.createTime',
        'ut.updateTime',
        'c.sku',
        'c.produce_name',
        'm.account_name',
        'm.selected_variant',
        'm.submitter_name',
      ])
      .orderBy('ut.updateTime', 'DESC');

    if (keyword) {
      const kw = `%${keyword}%`;
      qb.andWhere(
        '(ut.msku LIKE :kw OR c.sku LIKE :kw OR c.produce_name LIKE :kw OR m.account_name LIKE :kw OR m.submitter_name LIKE :kw OR m.selected_variant LIKE :kw)',
        { kw },
      );
    }

    // 角色维度过滤：运营只看自己提交的 MSKU；助理 / manager（以及其他角色）看全部
    const admin: any = (this as any).ctx?.admin;
    const currentUserId = admin?.userId;
    const roleIds: number[] = Array.isArray(admin?.roleIds) ? admin.roleIds : [];

    if (currentUserId != null && roleIds.length > 0) {
      const roles = await this.baseSysRoleRepo.find({
        where: { id: In(roleIds) },
        select: ['name', 'label'],
      });
      const roleText = roles
        .map(r => `${r.name || ''}|${r.label || ''}`)
        .join('|')
        .toLowerCase();

      const hasOperator =
        roleText.includes('运营') || roleText.includes('operator');
      const hasAssistantOrManager =
        roleText.includes('助理') ||
        roleText.includes('assistant') ||
        roleText.includes('manager');

      // 如果既是运营又是助理/manager，则按助理/manager 逻辑：不过滤
      if (hasOperator && !hasAssistantOrManager) {
        qb.andWhere('m.submitter_user_id = :submitterUserId', {
          submitterUserId: String(currentUserId),
        });
      }
    }

    const total = await qb.getCount();
    qb.offset((page - 1) * size).limit(size);
    const rawList = await qb.getRawMany();

    const uploadTaskIds = rawList.map((r: any) => r.ut_id).filter((id: any) => !!id);
    const progressMap = new Map<number, { total: number; uploaded: number }>();
    if (uploadTaskIds.length > 0) {
      const pics = await this.uploadTaskPictureRepo.find({
        where: { upload_task_id: In(uploadTaskIds) },
        select: ['upload_task_id', 'uploaded'],
      });
      for (const p of pics) {
        let stat = progressMap.get(p.upload_task_id);
        if (!stat) {
          stat = { total: 0, uploaded: 0 };
          progressMap.set(p.upload_task_id, stat);
        }
        stat.total += 1;
        if (p.uploaded) stat.uploaded += 1;
      }
    }

    const statusText: Record<number, string> = { 401: '待上传', 500: '已完成' };
    const list = rawList.map((r: any) => {
      const uid = r.ut_id;
      const prog = progressMap.get(uid) ?? { total: 0, uploaded: 0 };
      return {
        id: uid,
        design_task_id: r.ut_design_task_id,
        msku: r.ut_msku ?? '',
        sku: r.c_sku ?? '',
        product_name: r.c_produce_name ?? '',
        variant_name: r.m_selected_variant ?? '',
        list_image: r.ut_list_image ?? '',
        shop: r.m_account_name ?? '',
        submitter: r.m_submitter_name ?? '',
        status: r.ut_status,
        statusText: statusText[r.ut_status] ?? '待上传',
        progress: prog.total > 0 ? `${prog.uploaded}/${prog.total}` : '0/0',
        createTime: r.ut_createTime,
        updateTime: r.ut_updateTime,
      };
    });

    return {
      list,
      pagination: { total, page, size },
    };
  }

  /**
   * 单个上传任务详情：基础信息 + 上传检查表
   */
  async getUploadTaskDetail(uploadTaskId: number): Promise<{
    basic?: {
      id: number;
      productName: string;
      sku: string;
      variantName: string;
      status: string;
      photographerUploadPath: string;
      designerUploadPath: string;
      submitter: string;
      msku: string;
      shop: string;
      finalAccount: string;
      mainImage: string;
    };
    checklist: Array<{
      pictureId: number;
      code: string;
      completed: boolean;
      referenceImage: string;
      type: string;
      requirements: string;
    }>;
    shops?: Array<{ id: string; name: string }>;
  }> {
    const id = Number(uploadTaskId);
    if (!id) return { checklist: [] };
    const uploadTask = await this.uploadTaskRepo.findOne({ where: { id } });
    if (!uploadTask) return { checklist: [] };

    const task = await this.designTaskRepo.findOne({
      where: { id: uploadTask.design_task_id },
      select: ['id', 'candidate_id', 'status', 'photographer_upload_path', 'designer_upload_path', 'main_image'],
    });
    if (!task) {
      return { checklist: [] };
    }

    const candidate =
      (await this.candidateRepo.findOne({
        where: { id: task.candidate_id },
        select: ['id', 'sku', 'produce_name', 'image_url'],
      })) ?? null;

    const mskuRow =
      (await findMskuEntityByFlexibleKey(this.mskuRepo, uploadTask.msku, [
        'msku',
        'seller_account_id',
        'account_name',
        'submitter_name',
        'selected_variant',
      ])) ?? null;

    const statusTextMap: Record<number, string> = {
      401: '待上传',
      500: '已完成',
    };
    const statusText = statusTextMap[task.status] ?? '待上传';

    const mainImage =
      (task.main_image && task.main_image.trim()) ||
      (candidate?.image_url && String(candidate.image_url).trim()) ||
      (uploadTask.list_image && uploadTask.list_image.trim()) ||
      '';

    const basic = {
      id: uploadTask.id,
      productName: candidate?.produce_name ?? '',
      sku: candidate?.sku ?? '',
      variantName: mskuRow?.selected_variant ?? '',
      status: statusText,
      photographerUploadPath: task.photographer_upload_path ?? '',
      designerUploadPath: task.designer_upload_path ?? '',
      submitter: mskuRow?.submitter_name ?? '',
      msku: uploadTask.msku,
      shop: mskuRow?.account_name ?? '',
      finalAccount: uploadTask.final_account ?? '',
      mainImage,
    };

    // 上传检查表：该上传任务下需要上传的所有图片位（按 label 排序）
    const uploadPics = await this.uploadTaskPictureRepo.find({
      where: { upload_task_id: uploadTask.id },
      select: ['picture_id', 'uploaded'],
    });
    if (!uploadPics.length) {
      return { basic, checklist: [] };
    }
    const pictureIds = Array.from(new Set(uploadPics.map(p => p.picture_id)));
    const pictures = await this.pictureRepo.find({
      where: { id: In(pictureIds) },
      select: ['id', 'label', 'reference_image', 'type', 'requirements'],
      order: { label: 'ASC', id: 'ASC' },
    });
    const picMap = new Map(pictures.map(p => [p.id, p]));
    const checklist = uploadPics
      .map(p => {
        const pic = picMap.get(p.picture_id);
        if (!pic) return null;
        return {
          pictureId: p.picture_id,
          code: pic.label,
          completed: !!p.uploaded,
          referenceImage: pic.reference_image ?? '',
          type: pic.type ?? '',
          requirements: pic.requirements ?? '',
        };
      })
      .filter(Boolean) as Array<{
      pictureId: number;
      code: string;
      completed: boolean;
      referenceImage: string;
      type: string;
      requirements: string;
    }>;

    // 按编号排序（字符串排序已在查询中按 label 处理，这里再保险一次）
    checklist.sort((a, b) => a.code.localeCompare(b.code, 'zh-CN'));

    // 所有店铺账号列表（下拉用）
    const accounts = await this.sellerRepo
      .createQueryBuilder('s')
      .select('s.seller_account_id', 'seller_account_id')
      .addSelect('s.account_name', 'account_name')
      .where('s.seller_account_id IS NOT NULL AND s.seller_account_id != :empty', { empty: '' })
      .groupBy('s.seller_account_id')
      .addGroupBy('s.account_name')
      .orderBy('s.account_name', 'ASC')
      .getRawMany();
    const shops = accounts.map((a: { seller_account_id: string; account_name: string }) => ({
      id: String(a.seller_account_id),
      name: a.account_name || String(a.seller_account_id),
    }));

    return { basic, checklist, shops };
  }

  /**
   * 内容工作台用：按 (candidateId, msku) 取该 MSKU 的"上传相关信息"
   * - 优先：找到 design_task → 取上传路径；若已有 design_upload_task 则附带 checklist
   * - 没 design_task：返回空 basic
   * - 有 design_task 但还没 design_upload_task：返回 paths，checklist 取 design_task_picture（图需阶段）
   */
  async getMskuUploadInfo(
    candidateId: number,
    msku: string
  ): Promise<{
    hasDesignTask: boolean;
    hasUploadTask: boolean;
    basic: {
      photographerUploadPath: string;
      designerUploadPath: string;
      designTaskId: number | null;
      uploadTaskId: number | null;
      msku: string;
      status: string;
    };
    checklist: Array<{
      pictureId: number;
      code: string;
      completed: boolean;
      referenceImage: string;
      type: string;
      requirements: string;
    }>;
  }> {
    const cid = Number(candidateId);
    const mskuStr = String(msku || '').trim();
    const empty = {
      hasDesignTask: false,
      hasUploadTask: false,
      basic: {
        photographerUploadPath: '',
        designerUploadPath: '',
        designTaskId: null,
        uploadTaskId: null,
        msku: mskuStr,
        status: '',
      },
      checklist: [],
    };
    if (!cid || !mskuStr) return empty;

    // 1. 找 design_task（一个 candidate 一个）
    const task = await this.designTaskRepo.findOne({
      where: { candidate_id: cid },
      select: [
        'id',
        'candidate_id',
        'status',
        'photographer_upload_path',
        'designer_upload_path',
      ],
    });
    if (!task) return empty;

    const statusTextMap: Record<number, string> = {
      101: '待选参考图',
      102: 'AI生成图需中',
      103: '待审核',
      201: '待摄影领取',
      202: '拍摄中',
      301: '待美工领取',
      302: '美工做图中',
      401: '待上传',
      500: '已完成',
    };

    const basic = {
      photographerUploadPath: task.photographer_upload_path ?? '',
      designerUploadPath: task.designer_upload_path ?? '',
      designTaskId: task.id,
      uploadTaskId: null as number | null,
      msku: mskuStr,
      status: statusTextMap[task.status] ?? String(task.status),
    };

    // 2. 找 design_upload_task（只在 401 之后才有）
    const uploadTasks = await this.uploadTaskRepo.find({
      where: { design_task_id: task.id },
      select: ['id', 'msku'],
    });
    const uploadTask = uploadTasks.find((ut) => mskuKeysEquivalent(ut.msku, mskuStr));

    if (uploadTask) {
      basic.uploadTaskId = uploadTask.id;
      // 复用 upload_task_picture 的 checklist
      const uploadPics = await this.uploadTaskPictureRepo.find({
        where: { upload_task_id: uploadTask.id },
        select: ['picture_id', 'uploaded'],
      });
      if (!uploadPics.length) {
        return {
          hasDesignTask: true,
          hasUploadTask: true,
          basic,
          checklist: [],
        };
      }
      const pictureIds = Array.from(new Set(uploadPics.map(p => p.picture_id)));
      const pictures = await this.pictureRepo.find({
        where: { id: In(pictureIds) },
        select: ['id', 'label', 'reference_image', 'type', 'requirements'],
        order: { label: 'ASC', id: 'ASC' },
      });
      const picMap = new Map(pictures.map(p => [p.id, p]));
      const checklist = uploadPics
        .map(p => {
          const pic = picMap.get(p.picture_id);
          if (!pic) return null;
          return {
            pictureId: p.picture_id,
            code: pic.label,
            completed: !!p.uploaded,
            referenceImage: pic.reference_image ?? '',
            type: pic.type ?? '',
            requirements: pic.requirements ?? '',
          };
        })
        .filter(Boolean) as Array<{
        pictureId: number;
        code: string;
        completed: boolean;
        referenceImage: string;
        type: string;
        requirements: string;
      }>;
      checklist.sort((a, b) => a.code.localeCompare(b.code, 'zh-CN'));
      return { hasDesignTask: true, hasUploadTask: true, basic, checklist };
    }

    // 3. 还没 design_upload_task（401 之前）：保持和 /uploadTaskDetail 一致的口径，
    //    不返回 checklist；前端可据此显示"图需阶段，未生成上传任务"
    return {
      hasDesignTask: true,
      hasUploadTask: false,
      basic,
      checklist: [],
    };
  }

  /**
   * 保存上传任务详情：最终上传店铺 + 上传检查表勾选
   */
  async saveUploadTaskDetail(payload: {
    id: number;
    finalAccount?: string;
    items?: Array<{ pictureId?: number; code?: string; completed: boolean }>;
  }): Promise<{ ok: boolean; message?: string }> {
    const id = Number(payload?.id);
    if (!id) return { ok: false, message: 'id 无效' };
    const uploadTask = await this.uploadTaskRepo.findOne({ where: { id } });
    if (!uploadTask) return { ok: false, message: '上传任务不存在' };
    const designTaskId = uploadTask.design_task_id;

    const patch: Partial<DesignUploadTaskEntity> = {};
    if (payload.finalAccount !== undefined) {
      patch.final_account = (payload.finalAccount || '').trim();
    }
    if (Object.keys(patch).length > 0) {
      await this.uploadTaskRepo.update(id, patch);
    }

    const items = Array.isArray(payload?.items) ? payload.items : [];
    if (items.length > 0) {
      const rows = await this.uploadTaskPictureRepo.find({
        where: { upload_task_id: id },
        select: ['id', 'picture_id'],
      });
      if (rows.length > 0) {
        const pictureIds = Array.from(new Set(rows.map(r => r.picture_id)));
        const pictures = await this.pictureRepo.find({
          where: { id: In(pictureIds) },
          select: ['id', 'label'],
        });
        const labelToPid = new Map(pictures.map(p => [p.label, p.id]));

        // 统一用字符串键，避免 bigint 在 JS 中 number/string 不一致导致匹配失败
        const byPid = new Map<string, boolean>();
        items.forEach(it => {
          let pid = Number(it.pictureId);
          if (!pid && it.code) {
            pid = Number(labelToPid.get(String(it.code).trim()) || 0);
          }
          if (!pid) return;
          byPid.set(String(pid), !!it.completed);
        });

        for (const row of rows) {
          const flag = byPid.get(String(row.picture_id));
          if (flag === undefined) continue;
          await this.uploadTaskPictureRepo.update(row.id, { uploaded: flag ? 1 : 0 });
        }

        // 计算当前上传任务的完成度：全部完成则标记为 500
        const stat = rows.reduce(
          (acc, row) => {
            const flag = byPid.get(String(row.picture_id));
            if (flag === true) acc.uploaded += 1;
            acc.total += 1;
            return acc;
          },
          { total: 0, uploaded: 0 },
        );
        if (stat.total > 0 && stat.uploaded === stat.total) {
          await this.uploadTaskRepo.update(id, { status: 500 });
        }
      }
    }

    // 根据该美工任务下所有上传任务的状态，更新美工任务状态与时间线
    if (designTaskId) {
      const task = await this.designTaskRepo.findOne({ where: { id: designTaskId } });
      if (task) {
        const allUploads = await this.uploadTaskRepo.find({
          where: { design_task_id: designTaskId },
          select: ['id', 'status'],
        });
        const hasUploads = allUploads.length > 0;
        const allDone = hasUploads && allUploads.every(u => u.status === 500);
        if (allDone) {
          await this.updateStatusWithTimeline(task, 500, '上传任务全部完成');
        } else if (hasUploads) {
          await this.updateStatusWithTimeline(task, 402, '完成部分上传');
        }
      }
    }

    return { ok: true };
  }

  /**
   * 将任务状态标记为「AI生成图需中」（102），用于选图 AI 生成图需入口
   */
  async markRequirementAiGenerating(taskId: number, extraRemark?: string): Promise<void> {
    const id = Number(taskId);
    if (!id) return;
    const task = await this.designTaskRepo.findOne({ where: { id } });
    if (!task) return;
    await this.updateStatusWithTimeline(task, 102, extraRemark ?? '选图AI生成图需');
  }

  /**
   * 通过任务系统触发 AI 生成图需（异步 once 任务），内部会调用 aiGenerate（有 key 用 LLM，无 key 用 mock）
   */
  async enqueueMockAiGenerate(payload: { taskId: number } & Record<string, any>): Promise<number | null> {
    if (this.designJobSchedulerService.isEnabled()) {
      const jobId = await this.designJobSchedulerService.enqueueAiGenerate({
        taskId: Number(payload?.taskId),
        mode: payload?.mode === 'delta' ? 'delta' : 'all',
      });
      return Number(jobId) || null;
    }
    const params = payload ?? { taskId: payload?.taskId };
    const taskInfo = this.taskInfoRepo.create({
      name: `AI图需生成-${params.taskId}`,
      taskType: 0,
      cron: '',
      status: 0,
      type: 1,
      service: '',
      remark: 'AI 生成图需',
      data: JSON.stringify(params),
    });
    const saved = await this.taskInfoRepo.save(taskInfo);
    const paramsWithId = { ...params, aiTaskId: Number(saved.id) };
    const service = `designTaskService.aiGenerate(${JSON.stringify(paramsWithId)})`;
    await this.taskInfoRepo.update(saved.id, {
      service,
      data: JSON.stringify(paramsWithId),
      status: 1,
      startDate: new Date(),
    });
    await this.taskInfoService.once(saved.id);
    return Number(saved.id) || null;
  }

  /**
   * 通过任务系统触发：为指定 candidate 异步补全竞品图片（image_url + img1..img6）
   * 不做重试，有几张给几张
   */
  async enqueueEnrichCompetitorImages(payload: { candidateId: number } & Record<string, any>): Promise<number | null> {
    if (this.designJobSchedulerService.isEnabled()) {
      const jobId = await this.designJobSchedulerService.enqueueEnrichCompetitorImages({
        candidateId: payload?.candidateId != null ? Number(payload.candidateId) : undefined,
        taskId: payload?.taskId != null ? Number(payload.taskId) : undefined,
      });
      return Number(jobId) || null;
    }
    const params = payload ?? { candidateId: payload?.candidateId };
    const taskInfo = this.taskInfoRepo.create({
      name: `补全竞品图片-${params.candidateId}`,
      taskType: 0,
      cron: '',
      status: 0,
      type: 1,
      service: '',
      remark: '为美工任务补全竞品图片',
      data: JSON.stringify(params),
    });
    const saved = await this.taskInfoRepo.save(taskInfo);
    const service = `designTaskService.enrichCompetitorImages(${JSON.stringify(params)})`;
    await this.taskInfoRepo.update(saved.id, {
      service,
      data: JSON.stringify(params),
      status: 1,
      startDate: new Date(),
    });
    // 通过队列异步执行（@cool-midway/task + redis）
    await this.taskInfoService.once(saved.id);
    return Number(saved.id) || null;
  }

  /**
   * AI 生成图需：对每张图调用视觉大模型生成图需描述 + 多语文案，写入 requirements 与 caption；有 API key 用 LLM，无则 mock
   */
  /** 队列/任务失败时通知（不抛错） */
  async notifyDesignRequirementAiFailed(taskId: number, reason: string): Promise<void> {
    const id = Number(taskId);
    if (!id) return;
    const task = await this.designTaskRepo.findOne({ where: { id } });
    const candidateId = Number(task?.candidate_id || 0);
    const candidate = candidateId
      ? await this.candidateRepo.findOne({
          where: { id: candidateId },
          select: ['id', 'produce_name', 'sku'],
        })
      : null;
    const productName =
      String(candidate?.produce_name || '').trim() ||
      String(candidate?.sku || '').trim() ||
      (candidateId ? `选品#${candidateId}` : '选品');
    void this.listingDingTalkNotifyService.notifyDesignRequirementAiFailed({
      designTaskId: id,
      candidateId,
      productName,
      reason: String(reason || '').trim() || '未知错误',
    });
  }

  private summarizeDesignRequirementPictureFailures(
    pictures: DesignTaskPictureEntity[]
  ): string | null {
    if (!pictures.length) return '无图片位，无法生成图需';
    const failed = pictures.filter(p =>
      /^\[生成失败/.test(String(p.requirements || '').trim())
    );
    if (!failed.length) return null;
    if (failed.length < pictures.length) return null;
    const lines = failed.slice(0, 5).map(p => {
      const req = String(p.requirements || '').trim();
      const m = req.match(/^\[生成失败:([^\]]+)\]\s*(.*)$/);
      const label = String(p.label || p.id || '').trim();
      if (m) return `${label}: [${m[1]}] ${m[2] || ''}`.trim();
      return `${label}: ${req}`;
    });
    const more = failed.length > 5 ? ` 等共 ${failed.length} 个图片位失败` : '';
    return `${lines.join('；')}${more}`;
  }

  async aiGenerate(
    payload: { taskId: number; aiTaskId?: number; mode?: 'all' | 'delta' },
    observer?: DesignJobObserver
  ) {
    const id = Number(payload?.taskId);
    if (!id) {
      void this.notifyDesignRequirementAiFailed(0, 'taskId 无效');
      return { ok: false, message: 'taskId 无效' };
    }
    await observer?.log('info', 'init', '开始执行 AI 图需生成', { taskId: id, mode: payload?.mode || 'all' });

    let task: DesignTaskEntity | null = null;
    try {
      task = await this.designTaskRepo.findOne({ where: { id } });
      if (!task) {
        void this.notifyDesignRequirementAiFailed(id, '任务不存在');
        return { ok: false, message: '任务不存在' };
      }

    const pictures = await this.pictureRepo.find({ where: { task_id: id } });
    await observer?.log('info', 'load_pictures', '读取图片位完成', { total: pictures.length });
    const hasApiKey = !!(this.designTaskAiConfig?.apiKey || process.env.OPENAI_API_KEY);
    const mode: 'all' | 'delta' = (payload as any)?.mode === 'delta' ? 'delta' : 'all';

    // 按图片并发生成图需与文案；mode=delta 时仅对尚无图需的图片生成
    await Promise.all(
      pictures.map(async (p) => {
        await observer?.log('info', 'picture_start', '开始处理图片位', { pictureId: p.id, label: p.label, mode });
        const hasRequirement = !!(p.requirements && String(p.requirements).trim());
        if (mode === 'delta' && hasRequirement) {
          await observer?.log('info', 'picture_skip', 'delta 模式跳过已有图需的图片位', { pictureId: p.id, label: p.label });
          return;
        }
        if (hasApiKey && (p.reference_image || '').trim()) {
          try {
            const result = await this.designTaskAiService.generateImageRequirement({
              referenceImageUrl: p.reference_image,
              productDescription: p.variant_desc ?? undefined,
              label: p.label,
              type: p.type ?? '',
            });
            await this.pictureRepo.update(p.id, {
              requirements: result.requirement,
              copies: this.buildCopiesFromAiCaptions(result.captions),
            });
            await observer?.log('info', 'picture_done', '图片位处理完成', {
              pictureId: p.id,
              label: p.label,
              captionCount: result.captions.length,
            });
          } catch (e: any) {
            const msg = e?.message || String(e);
            const sourceMatch = /^\[([A-Z0-9_]+)\]\s*/.exec(msg);
            const errorSource = sourceMatch?.[1] || 'UNKNOWN';
            const cleanMsg = msg.replace(/^\[[A-Z0-9_]+\]\s*/, '').trim();
            console.error(
              `[AI_REQUIREMENT_ERROR] source=${errorSource} taskId=${id} pictureId=${p.id} label=${p.label} msg=${cleanMsg}`,
            );
            await this.pictureRepo.update(p.id, {
              requirements: `[生成失败:${errorSource}] ${cleanMsg}`.slice(0, 2000),
              copies: null,
            });
            await observer?.log('error', 'picture_error', '图片位处理失败', {
              pictureId: p.id,
              label: p.label,
              source: errorSource,
              message: cleanMsg,
            });
          }
        } else {
          // 无 API key 或无参考图：mock 行为
          const requirement = `AI图需：${p.label} ${p.type || ''}`.trim();
          await this.pictureRepo.update(p.id, {
            requirements: requirement,
            copies: [{ zh: `AI文案：${p.label}` }],
          });
          await observer?.log('warn', 'picture_mock', '使用 mock 图需生成（无 API key 或无参考图）', {
            pictureId: p.id,
            label: p.label,
            hasApiKey,
            hasReferenceImage: !!(p.reference_image || '').trim(),
          });
        }
      }),
    );

    const picturesAfter = await this.pictureRepo.find({ where: { task_id: id } });
    const failReason = this.summarizeDesignRequirementPictureFailures(picturesAfter);
    if (failReason) {
      // 失败进 103，保留各图片位 requirements 中的失败信息供审核查看
      await this.updateStatusWithTimeline(task, 103, 'AI 图需生成失败');
      await observer?.log('error', 'all_pictures_failed', '全部图片位生成失败', {
        taskId: id,
        reason: failReason,
      });
      const candidate = await this.candidateRepo.findOne({
        where: { id: Number(task.candidate_id) },
        select: ['id', 'produce_name', 'sku'],
      });
      const productName =
        String(candidate?.produce_name || '').trim() ||
        String(candidate?.sku || '').trim() ||
        `选品#${task.candidate_id}`;
      void this.listingDingTalkNotifyService.notifyDesignRequirementAiFailed({
        designTaskId: id,
        candidateId: Number(task.candidate_id),
        productName,
        reason: failReason,
      });
      if (payload?.aiTaskId) {
        await this.taskInfoRepo.update(Number(payload.aiTaskId), {
          status: 0,
          endDate: new Date(),
          nextRunTime: null,
        });
      }
      return { ok: false, message: failReason };
    }

    await this.updateStatusWithTimeline(task, 103, 'AI 图需已生成');
    await observer?.log('info', 'status_updated', '任务状态更新为待审核', { taskId: id, status: 103 });

    const candidate = await this.candidateRepo.findOne({
      where: { id: Number(task.candidate_id) },
      select: ['id', 'produce_name', 'sku'],
    });
    const productName =
      String(candidate?.produce_name || '').trim() ||
      String(candidate?.sku || '').trim() ||
      `选品#${task.candidate_id}`;
    void this.listingDingTalkNotifyService.notifyDesignRequirementAiDone({
      designTaskId: id,
      candidateId: Number(task.candidate_id),
      productName,
    });

    if (payload?.aiTaskId) {
      await this.taskInfoRepo.update(Number(payload.aiTaskId), {
        status: 0,
        endDate: new Date(),
        nextRunTime: null,
      });
    }
    await observer?.log('info', 'finish', 'AI 图需生成完成', { taskId: id });
    return { ok: true };
    } catch (e: any) {
      const message = e?.message || String(e);
      await observer?.log('error', 'job_failed', 'AI 图需生成异常', { taskId: id, message });
      if (task) {
        await this.updateStatusWithTimeline(task, 103, 'AI 图需生成失败').catch(() => undefined);
      }
      // 异常由 design_job_scheduler 统一发失败通知，避免重复
      throw e;
    }
  }

  /**
   * mock AI 生成图需（仅用于兼容旧任务或测试），实际队列已改为调用 aiGenerate
   */
  async mockAiGenerate(payload: { taskId: number; aiTaskId?: number }) {
    return this.aiGenerate(payload);
  }

  /**
   * 实际执行：为某个选品(candidateId)下前 5 个 status=2 的竞品补全图片字段
   * - 排序与 getReferenceImages（AI 生成图需竞品列表）一致：Main_monthly_sales 降序，再 id 升序
   * - 仅处理这 5 条，其余竞品由用户在弹窗里点「获取参考图」手动拉取
   * - 若某条竞品已有 image_url 和 img1..img6，则跳过
   * - 否则调用 OxylabsService.getProductImages 补齐可用的图片
   */
  async enrichCompetitorImages(
    payload: { candidateId?: number; taskId?: number },
    observer?: DesignJobObserver
  ) {
    const candidateIdFromPayload = payload?.candidateId != null ? Number(payload.candidateId) : NaN;
    let candidateId = !isNaN(candidateIdFromPayload) ? candidateIdFromPayload : NaN;
    await observer?.log('info', 'init', '开始补全竞品图片', {
      candidateId: payload?.candidateId ?? null,
      taskId: payload?.taskId ?? null,
    });

    // 允许通过 taskId 反查 candidateId，方便以后扩展
    if (isNaN(candidateId) && payload?.taskId != null) {
      const taskId = Number(payload.taskId);
      if (!isNaN(taskId)) {
        const task = await this.designTaskRepo.findOne({
          where: { id: taskId },
          select: ['candidate_id'],
        });
        if (task?.candidate_id != null) {
          candidateId = Number(task.candidate_id);
        }
      }
    }

    if (isNaN(candidateId) || !candidateId) {
      await observer?.log('error', 'invalid_candidate', 'candidateId 无效，任务结束');
      return { ok: false, message: 'candidateId 无效' };
    }

    const competitors = await this.bsrCandidateCompetitorRepo
      .createQueryBuilder('c')
      .where('c.candidate_id = :candidateId', { candidateId })
      .andWhere('c.status = :status', { status: 2 })
      .orderBy('COALESCE(c.Main_monthly_sales, 0)', 'DESC')
      .addOrderBy('c.id', 'ASC')
      .take(5)
      .select([
        'c.id',
        'c.asin_competitor',
        'c.marketplace',
        'c.image_url',
        'c.img1',
        'c.img2',
        'c.img3',
        'c.img4',
        'c.img5',
        'c.img6',
      ])
      .getMany();

    if (!competitors.length) {
      await observer?.log('info', 'empty', '无竞品数据，无需补图', { candidateId });
      return { ok: true, message: '无竞品数据，无需补图' };
    }
    await observer?.log('info', 'load_competitors', '加载待补图竞品完成', { count: competitors.length, candidateId });

    for (const comp of competitors) {
      // 简单判断：主图 + 6 张图都存在则跳过
      const hasAllImages =
        !!comp.image_url &&
        !!comp.img1 &&
        !!comp.img2 &&
        !!comp.img3 &&
        !!comp.img4 &&
        !!comp.img5 &&
        !!comp.img6;

      if (hasAllImages) continue;
      if (!comp.asin_competitor || !comp.marketplace) continue;
      await observer?.log('info', 'competitor_start', '开始补全单个竞品图片', {
        competitorId: comp.id,
        asin: comp.asin_competitor,
        marketplace: comp.marketplace,
      });

      const images = await this.oxylabsService.getProductImages(
        comp.marketplace,
        comp.asin_competitor,
        'designTask.enrichCompetitorImages',
      );

      if (!images || !images.length) continue;

      const patch: Partial<AppAmzBsrCandidateCompetitorEntity> = {};

      // 主图为空时，用 images[0] 补
      if (!comp.image_url && images[0]) {
        patch.image_url = images[0];
      }

      const extra = images.slice(1, 7);
      const keys: Array<keyof AppAmzBsrCandidateCompetitorEntity> = [
        'img1',
        'img2',
        'img3',
        'img4',
        'img5',
        'img6',
      ];

      keys.forEach((key, idx) => {
        const current = (comp as any)[key];
        const incoming = extra[idx];
        if (!current && incoming) {
          (patch as any)[key] = incoming;
        }
      });

      if (Object.keys(patch).length > 0) {
        await this.bsrCandidateCompetitorRepo.update(comp.id, patch);
        await observer?.log('info', 'competitor_updated', '竞品图片已更新', {
          competitorId: comp.id,
          patchKeys: Object.keys(patch),
        });
      }
    }

    await observer?.log('info', 'finish', '补全竞品图片完成', { candidateId });
    return { ok: true };
  }

  /** 选品关联的 status=2 竞品的参考图列表，供 AI 生成图需弹窗使用。每条 7 个图位：image_url + img1..img6；含 marketplace 供前端拼亚马逊链接 */
  async getReferenceImages(taskId: number): Promise<{ list: Array<{ competitorId: number; asin: string; marketplace: string; monthlySales: number; images: string[] }> }> {
    const id = Number(taskId);
    if (!id) return { list: [] };
    const task = await this.designTaskRepo.findOne({ where: { id }, select: ['candidate_id'] });
    if (!task?.candidate_id) return { list: [] };
    const competitors = await this.bsrCandidateCompetitorRepo
      .createQueryBuilder('c')
      .where('c.candidate_id = :candidateId', { candidateId: task.candidate_id })
      .andWhere('c.status = :status', { status: 2 })
      .orderBy('COALESCE(c.Main_monthly_sales, 0)', 'DESC')
      .addOrderBy('c.id', 'ASC')
      .select([
        'c.id',
        'c.asin_competitor',
        'c.marketplace',
        'c.Main_monthly_sales',
        'c.image_url',
        'c.img1',
        'c.img2',
        'c.img3',
        'c.img4',
        'c.img5',
        'c.img6',
      ])
      .getMany();
    const list = competitors.map((c) => {
      const raw = [
        (c as any).image_url,
        (c as any).img1,
        (c as any).img2,
        (c as any).img3,
        (c as any).img4,
        (c as any).img5,
        (c as any).img6,
      ];
      const images = raw.map((v) => (v && String(v).trim()) || '');
      return {
        competitorId: c.id,
        asin: (c.asin_competitor && String(c.asin_competitor).trim()) || '',
        marketplace: (c.marketplace && String(c.marketplace).trim()) || '',
        monthlySales: Number((c as any).Main_monthly_sales || 0),
        images,
      };
    });
    return { list };
  }

  /** 同步拉取单个竞品的参考图并落库，返回该竞品当前 7 张图（供前端合并后重排） */
  async fetchCompetitorReferenceImages(competitorId: number): Promise<{
    ok: boolean;
    message?: string;
    competitorId?: number;
    asin?: string;
    images?: string[];
  }> {
    const id = Number(competitorId);
    if (!id) return { ok: false, message: 'competitorId 无效' };
    const comp = await this.bsrCandidateCompetitorRepo.findOne({
      where: { id },
      select: ['id', 'asin_competitor', 'marketplace', 'image_url', 'img1', 'img2', 'img3', 'img4', 'img5', 'img6'],
    });
    if (!comp) return { ok: false, message: '竞品不存在' };
    if (!comp.asin_competitor || !comp.marketplace) return { ok: false, message: 'ASIN 或站点缺失' };
    const hasAll =
      !!comp.image_url &&
      !!comp.img1 &&
      !!comp.img2 &&
      !!comp.img3 &&
      !!comp.img4 &&
      !!comp.img5 &&
      !!comp.img6;
    if (hasAll) {
      const images = [
        comp.image_url!,
        comp.img1!,
        comp.img2!,
        comp.img3!,
        comp.img4!,
        comp.img5!,
        comp.img6!,
      ];
      return { ok: true, competitorId: comp.id, asin: comp.asin_competitor, images };
    }
    const images = await this.oxylabsService.getProductImages(
      comp.marketplace,
      comp.asin_competitor,
      'designTask.fetchCompetitorReferenceImages',
    );
    if (!images || !images.length) {
      const existing = [
        comp.image_url || '',
        comp.img1 || '',
        comp.img2 || '',
        comp.img3 || '',
        comp.img4 || '',
        comp.img5 || '',
        comp.img6 || '',
      ];
      return { ok: true, competitorId: comp.id, asin: comp.asin_competitor, images: existing };
    }
    const patch: Partial<AppAmzBsrCandidateCompetitorEntity> = {};
    if (!comp.image_url && images[0]) patch.image_url = images[0];
    const extra = images.slice(1, 7);
    const keys: Array<keyof AppAmzBsrCandidateCompetitorEntity> = ['img1', 'img2', 'img3', 'img4', 'img5', 'img6'];
    keys.forEach((key, idx) => {
      const current = (comp as any)[key];
      const incoming = extra[idx];
      if (!current && incoming) (patch as any)[key] = incoming;
    });
    if (Object.keys(patch).length > 0) {
      await this.bsrCandidateCompetitorRepo.update(comp.id, patch);
    }
    const out = [
      patch.image_url ?? comp.image_url ?? '',
      (patch as any).img1 ?? comp.img1 ?? '',
      (patch as any).img2 ?? comp.img2 ?? '',
      (patch as any).img3 ?? comp.img3 ?? '',
      (patch as any).img4 ?? comp.img4 ?? '',
      (patch as any).img5 ?? comp.img5 ?? '',
      (patch as any).img6 ?? comp.img6 ?? '',
    ];
    return { ok: true, competitorId: comp.id, asin: comp.asin_competitor, images: out };
  }

  /**
   * 同步指定选品的美工任务及图片位（根据当前“做/不做”采购记录 + MSKU 数据）
   * 规则：
   * - 1 个选品（candidate_id）对应 1 个 design_task（若不存在则创建，状态默认为 101）
   * - 主图：每个“做”的 MSKU 一条，label 为 1-1, 2-1, 3-1...
   * - 尺寸图：每个“做”的变体一条，label 为 1-2, 2-2...
   * - 配件图：每个“做”的变体一条，label 为 1-3, 2-3...
   * - 场景图：每个“做”的店铺账号(seller_account_id)一条，label 为 1-4, 2-4...
   * - 公共位：1-5, 1-6, 1-7 三条，不区分类型
   *
   * 仅对结构字段做增删改：label/type/msku/seller_account_id/variant_id/variant_desc，
   * 不覆盖人工编辑的 reference_image / requirements / reviewed 等字段。
   */
  /**
   * 选品下已有 MSKU 列表，供前端主图挂载下拉（变体名-账号名）
   */
  async getMskusForCandidate(candidateId: number): Promise<
    Array<{
      msku: string;
      variant_id: string | null;
      seller_account_id: string;
      variant_name: string;
      account_name: string;
      submitter_name: string | null;
    }>
  > {
    const rows = await this.mskuRepo.find({
      where: { candidate_id: String(candidateId) },
      select: ['msku', 'selected_variant_id', 'seller_account_id', 'selected_variant', 'account_name', 'submitter_name'],
      order: { msku: 'ASC' },
    });
    return rows.map(r => ({
      msku: r.msku,
      variant_id: r.selected_variant_id ?? null,
      seller_account_id: r.seller_account_id ?? '',
      variant_name: r.selected_variant ?? '',
      account_name: r.account_name ?? '',
      submitter_name: r.submitter_name ?? null,
    }));
  }

  /**
   * 同步图需图片位（根据采购数据生成）。
   * 返回值：skipped 为 true 表示因任务状态非 101 未做同步（且未传 force）。
   * @param options.force 为 true 时：先将任务状态重置为 101（待选参考图），再执行同步（选图页「强行同步」用）
   */
  async syncForCandidate(
    candidateId: number,
    options?: { force?: boolean },
  ): Promise<{ skipped: boolean }> {
    const force = options?.force === true;
    const existing = await this.designTaskRepo.findOne({
      where: { candidate_id: candidateId },
      select: ['id', 'status'],
    });
    if (existing && existing.status !== 101) {
      if (!force) return { skipped: true };
      await this.updateStatusWithTimeline(existing, 101, '强制重置为待选参考图');
    }

    // 找到或创建 design_task
    let task = await this.designTaskRepo.findOne({ where: { candidate_id: candidateId } });
    if (!task) {
      task = this.designTaskRepo.create({
        candidate_id: candidateId,
        designer_upload_path: '',
        photographer_upload_path: '',
        main_image: '',
        timeline: [],
        status: 101,
      });
      task = await this.designTaskRepo.save(task);
      // 创建时也算一次状态变更，写入 timeline
      task = await this.updateStatusWithTimeline(task, 101, '自动生成图需任务');

      // 仅在首次创建美工任务时，异步触发一次竞品图片补齐任务
      await this.enqueueEnrichCompetitorImages({ candidateId });
    }

    const taskId = task.id;

    // 仅考虑 is_generate=2 的采购记录（“做”的）
    const purchasers = await this.purchaserRepo.find({
      where: {
        candidate_id: String(candidateId),
        is_generate: 2 as any,
      },
      select: ['seller_account_id', 'account_name', 'selected_variant_id', 'selectedVariant', 'msku'],
      order: { id: 'ASC' },
    });

    // 没有任何人选择采购任何变体时：删除该选品下已有图需任务及全部图片位（含公共位 1-5/1-6/1-7），不再保留
    if (purchasers.length === 0) {
      const task = await this.designTaskRepo.findOne({ where: { candidate_id: candidateId } });
      if (task) {
        await this.pictureRepo.delete({ task_id: task.id });
        await this.designTaskRepo.remove(task);
      }
      return { skipped: false };
    }

    // 读取变体描述（从选品的 variant_Combination JSON 中取）
    const candidate = await this.candidateRepo.findOne({
      where: { id: candidateId },
      select: ['variant_Combination'],
    });
    let variantCombination: any[] = [];
    try {
      const raw: any = (candidate as any)?.variant_Combination;
      variantCombination = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw || [];
    } catch {
      variantCombination = [];
    }
    const normalizeDesc = (val: any): string | null => {
      const s = typeof val === 'string' ? val.trim() : '';
      return s ? s : null;
    };
    const variantDescMap = new Map<string, string | null>();
    variantCombination.forEach(v => {
      if (v?.id) variantDescMap.set(v.id, normalizeDesc(v.description));
    });

    // 计算 MSKU / 变体 / 店铺集合
    const mskuList = Array.from(
      new Set(
        purchasers
          .map((p) => p.msku)
          .filter((v): v is string => !!v)
      ),
    );

    const variantIds = Array.from(
      new Set(
        purchasers
          .map((p) => p.selected_variant_id)
          .filter((v): v is string => !!v)
      ),
    );
    // 选做第一条变体（用于公共位等无具体关联时的冗余描述）
    const firstSelectedVariantId = variantIds[0] ?? null;
    const firstVariantDesc =
      firstSelectedVariantId !== null
        ? (variantDescMap.get(firstSelectedVariantId) ?? null)
        : variantCombination.length
          ? normalizeDesc(variantCombination[0]?.description)
          : null;

    const sellerAccountIds = Array.from(
      new Set(
        purchasers
          .map((p) => p.seller_account_id)
          .filter((v): v is string => !!v)
      ),
    );

    // 建立 MSKU -> purchaser 和 seller_account_id -> purchaser 的映射，用于获取 submitter
    const mskuToPurchaser = new Map<string, AppAmzBsrCandidatePurchaserEntity>();
    const accountToPurchaser = new Map<string, AppAmzBsrCandidatePurchaserEntity>();
    const variantToPurchaser = new Map<string, AppAmzBsrCandidatePurchaserEntity>();

    purchasers.forEach(p => {
      if (p.msku) mskuToPurchaser.set(p.msku, p);
      if (p.seller_account_id) accountToPurchaser.set(p.seller_account_id, p);
      if (p.selected_variant_id) variantToPurchaser.set(p.selected_variant_id, p);
    });

    type Spec = {
      label: string;
      type: string;
      msku: string | null;
      seller_account_id: string | null;
      variant_id: string | null;
      variant_desc: string | null;
      submitter: string | null;
    };

    const desired = new Map<string, Spec>();

    // 主图：按 MSKU 排序，1-1, 2-1, ...
    // 需要附加 msku, seller_account_id, variant_id, submitter
    mskuList.forEach((msku, idx) => {
      const label = `${idx + 1}-1`;
      const p = mskuToPurchaser.get(msku);
      const variantId = p?.selected_variant_id || null;
      const variantDesc = variantId ? (variantDescMap.get(variantId) ?? null) : firstVariantDesc;
      desired.set(label, {
        label,
        type: '主图',
        msku,
        seller_account_id: p?.seller_account_id || null,
        variant_id: variantId,
        variant_desc: variantDesc,
        submitter: p?.purchaser || null,
      });
    });

    // 尺寸图 / 配件图：按变体 id 排序，1-2, 2-2... / 1-3, 2-3...
    // 这两类图只跟变体相关，不记录提交人
    variantIds.forEach((vid, idx) => {
      const n = idx + 1;
      const variantDesc = variantDescMap.get(vid) ?? null;
      const sizeLabel = `${n}-2`;
      const accessoryLabel = `${n}-3`;
      desired.set(sizeLabel, {
        label: sizeLabel,
        type: '尺寸图',
        msku: null,
        seller_account_id: null,
        variant_id: vid,
        variant_desc: variantDesc,
        submitter: null,
      });
      desired.set(accessoryLabel, {
        label: accessoryLabel,
        type: '配件图',
        msku: null,
        seller_account_id: null,
        variant_id: vid,
        variant_desc: variantDesc,
        submitter: null,
      });
    });

    // 场景图：按店铺账号 seller_account_id 排序，1-4, 2-4...
    sellerAccountIds.forEach((aid, idx) => {
      const label = `${idx + 1}-4`;
      const p = accountToPurchaser.get(aid);
      desired.set(label, {
        label,
        type: '场景图',
        msku: null,
        seller_account_id: aid,
        variant_id: null,
        variant_desc: firstVariantDesc,
        submitter: p?.purchaser || null,
      });
    });

    // 公共位：1-5, 1-6, 1-7（不区分类型）
    ['1-5', '1-6', '1-7'].forEach((label) => {
      if (!desired.has(label)) {
        desired.set(label, {
          label,
          type: '',
          msku: null,
          seller_account_id: null,
          variant_id: null,
          variant_desc: firstVariantDesc,
          submitter: null,
        });
      }
    });

    // 读取当前已存在图片位
    const existingPics = await this.pictureRepo.find({ where: { task_id: taskId } });
    const desiredLabels = new Set(desired.keys());

    // 删除多余的图片位（label 不在期望集合中）
    for (const pic of existingPics) {
      if (!desiredLabels.has(pic.label)) {
        await this.pictureRepo.delete(pic.id);
      }
    }

    // 重新加载一遍现有（避免上面 delete 之后数组陈旧）
    const current = await this.pictureRepo.find({ where: { task_id: taskId } });
    const currentByLabel = new Map(current.map((p) => [p.label, p]));

    // 新增或更新需要的图片位
    for (const [label, spec] of desired.entries()) {
      const row = currentByLabel.get(label);
      if (!row) {
        // 新增时，填充所有字段包括 submitter
        const toCreate = this.pictureRepo.create({
          task_id: taskId,
          label: spec.label,
          type: spec.type,
          msku: spec.msku,
          seller_account_id: spec.seller_account_id,
          variant_id: spec.variant_id,
          variant_desc: spec.variant_desc,
          submitter: spec.submitter,
          reference_image: '',
          requirements: null,
          reviewed: 0,
          photographed: 0,
          design_done: 0,
        });
        await this.pictureRepo.save(toCreate);
      } else {
        // 更新时，只更新结构字段，submitter 只在第一次（即为空时）填充
        const patch: Partial<DesignTaskPictureEntity> = {};
        if (row.type !== spec.type) patch.type = spec.type;
        if (row.msku !== spec.msku) patch.msku = spec.msku;
        if (row.seller_account_id !== spec.seller_account_id) patch.seller_account_id = spec.seller_account_id;
        if (row.variant_id !== spec.variant_id) {
          patch.variant_id = spec.variant_id;
          patch.variant_desc = spec.variant_desc;
        }
        if (!row.variant_desc && spec.variant_desc) {
          patch.variant_desc = spec.variant_desc;
        }
        // submitter 只在第一次填充（即现有值为空时）
        if (!row.submitter && spec.submitter) {
          patch.submitter = spec.submitter;
        }
        if (Object.keys(patch).length > 0) {
          await this.pictureRepo.update(row.id, patch);
        }
      }
    }
    return { skipped: false };
  }

  /**
   * 选图页保存图片位：仅主图必选已有 MSKU；其余类型挂载（变体/账号）均为可选，未填表示挂载全部。
   */
  async saveRequirementSlots(data: {
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
      /** 运营补充说明 { text?, images? } */
      remark_doc?: unknown;
    }>;
  }): Promise<{ ok: true } | { ok: false; message: string }> {
    const taskId = Number(data?.taskId);
    const slots = Array.isArray(data?.slots) ? data.slots : [];
    if (!taskId) return { ok: false, message: 'taskId 无效' };
    const task = await this.designTaskRepo.findOne({ where: { id: taskId }, select: ['id', 'candidate_id'] });
    if (!task) return { ok: false, message: '任务不存在' };
    const candidateId = task.candidate_id;

    const mskuList = await this.getMskusForCandidate(candidateId);
    const mskuLookup = buildMskuLookup(mskuList);

    const existingPictures = await this.pictureRepo.find({
      where: { task_id: taskId },
      select: ['id', 'label', 'msku', 'reference_image'],
    });
    const existingByLabel = new Map(existingPictures.map(p => [String(p.label || '').trim(), p]));
    const keepLabels = new Set<string>();

    for (const slot of slots) {
      const label = (slot.label || '').trim();
      if (!label) continue;
      if (keepLabels.has(label)) return { ok: false, message: `编号 ${label} 重复` };
      keepLabels.add(label);

      const type = (slot.type || '').trim();
      const reference_image = (slot.reference_image ?? '').trim() || '';
      const variant_desc = (slot.description ?? '').trim() || null;
      const remark_doc = normalizeDesignTaskPictureRemarkDoc(slot.remark_doc);
      const existingRow = existingByLabel.get(label);
      const refChanged = existingRow && (existingRow.reference_image || '') !== reference_image;

      // 主图：必选已有 MSKU
      if (type === '主图') {
        const mskuInput = String(slot.msku ?? '').trim();
        if (!mskuInput) return { ok: false, message: `图片位 ${label}（主图）请选择挂载的 MSKU` };
        const mrow = mskuLookup.resolve(mskuInput);
        if (!mrow) return { ok: false, message: `图片位 ${label}（主图）请选择该选品下已有的 MSKU` };
        const msku = mrow.msku;
        if (existingRow) {
          await this.pictureRepo.update(existingRow.id, {
            type,
            reference_image,
            variant_desc,
            msku,
            seller_account_id: mrow.seller_account_id || null,
            variant_id: mrow.variant_id || null,
            remark_doc,
            ...(refChanged ? { requirements: '' } : {}),
          });
        } else {
          await this.pictureRepo.insert({
            task_id: taskId,
            label,
            type,
            reference_image,
            variant_desc,
            msku,
            seller_account_id: mrow.seller_account_id || null,
            variant_id: mrow.variant_id || null,
            submitter: mrow.submitter_name ?? null,
            requirements: '',
            remark_doc,
            reviewed: 0,
            photographed: 0,
            design_done: 0,
          });
        }
        continue;
      }

      // 非主图：挂载均为可选，可填变体、账号或两者都不填（表示挂载全部）
      const variant_id = (slot.variant_id ?? '').trim() || null;
      const seller_account_id = (slot.seller_account_id ?? '').trim() || null;
      if (existingRow) {
        await this.pictureRepo.update(existingRow.id, {
          type,
          reference_image,
          variant_desc,
          msku: null,
          seller_account_id,
          variant_id,
          remark_doc,
          ...(refChanged ? { requirements: '' } : {}),
        });
      } else {
        await this.pictureRepo.insert({
          task_id: taskId,
          label,
          type,
          reference_image,
          variant_desc,
          msku: null,
          seller_account_id,
          variant_id,
          requirements: '',
          remark_doc,
          reviewed: 0,
          photographed: 0,
          design_done: 0,
        });
      }
    }

    const existingPictures2 = await this.pictureRepo.find({ where: { task_id: taskId }, select: ['id', 'label'] });
    const toRemove = existingPictures2.filter(p => !keepLabels.has(p.label));
    if (toRemove.length > 0) {
      const toRemoveIds = toRemove.map(p => p.id);
      await this.pictureRepo.delete({ id: In(toRemoveIds) });
    }
    return { ok: true };
  }

  /**
   * 图需详情表「修改图需」保存：编号 / 类型 / 挂载 / 提交人，规则与 saveRequirementSlots 一致。
   */
  async buildPictureDetailMetaPatch(
    pictureId: number,
    body: {
      label?: string;
      type?: string;
      msku?: string | null;
      variant_id?: string | null;
      seller_account_id?: string | null;
      submitter?: string | null;
    },
  ): Promise<
    { ok: true; patch: Partial<DesignTaskPictureEntity> } | { ok: false; message: string }
  > {
    const pid = Number(pictureId);
    if (!pid) return { ok: false, message: 'pictureId 无效' };
    const picture = await this.pictureRepo.findOne({ where: { id: pid } });
    if (!picture) return { ok: false, message: '图片位不存在' };
    const task = await this.designTaskRepo.findOne({
      where: { id: picture.task_id },
      select: ['id', 'candidate_id'],
    });
    if (!task) return { ok: false, message: '任务不存在' };

    let label = body.label !== undefined ? (body.label || '').trim() : picture.label;
    let type = body.type !== undefined ? (body.type || '').trim() : picture.type;
    if (/^\d+-1$/.test(label)) type = '主图';

    if (!label || !/^\d+-\d+$/.test(label)) {
      return { ok: false, message: '编号格式须为如 4-1' };
    }

    const siblings = await this.pictureRepo.find({
      where: { task_id: picture.task_id },
      select: ['id', 'label'],
    });
    const dup = siblings.find(p => p.label === label && Number(p.id) !== pid);
    if (dup) return { ok: false, message: `编号 ${label} 已存在` };

    const candidateId = task.candidate_id;
    const mskuList = await this.getMskusForCandidate(candidateId);
    const mskuLookup = buildMskuLookup(mskuList);

    const patch: Partial<DesignTaskPictureEntity> = { label, type };

    if (body.submitter !== undefined) {
      const s = (body.submitter || '').trim();
      patch.submitter = s || null;
    }

    if (type === '主图') {
      const mskuInput =
        body.msku !== undefined && body.msku != null
          ? String(body.msku).trim()
          : String(picture.msku || '').trim();
      if (!mskuInput) {
        return { ok: false, message: `图片位 ${label}（主图）请选择挂载的 MSKU` };
      }
      const mrow = mskuLookup.resolve(mskuInput);
      if (!mrow) {
        return { ok: false, message: `图片位 ${label}（主图）请选择该选品下已有的 MSKU` };
      }
      patch.msku = mrow.msku;
      patch.seller_account_id = mrow.seller_account_id || null;
      patch.variant_id = mrow.variant_id || null;
    } else {
      const variant_id =
        body.variant_id !== undefined
          ? (body.variant_id || '').trim() || null
          : picture.variant_id;
      const seller_account_id =
        body.seller_account_id !== undefined
          ? (body.seller_account_id || '').trim() || null
          : picture.seller_account_id;
      patch.msku = null;
      patch.variant_id = variant_id;
      patch.seller_account_id = seller_account_id;
    }

    return { ok: true, patch };
  }

  /**
   * 图需详情：新增单个图片位（规则与 saveRequirementSlots 中单条 insert 一致，不影响其他位）
   */
  async createPictureSlot(data: {
    taskId: number;
    label: string;
    type: string;
    msku?: string;
    variant_id?: string;
    seller_account_id?: string;
  }): Promise<
    | {
        ok: true;
        pictureId: number;
        label: string;
        type: string;
        msku: string | null;
        variant_id: string | null;
        seller_account_id: string | null;
        reference_image: string;
      }
    | { ok: false; message: string }
  > {
    const taskId = Number(data?.taskId);
    let type = (data?.type || '').trim();
    const label = (data?.label || '').trim();
    if (!taskId) return { ok: false, message: 'taskId 无效' };
    if (!label) return { ok: false, message: '请填写编号' };
    if (!/^\d+-\d+$/.test(label)) {
      return { ok: false, message: '编号格式须为如 4-1' };
    }
    if (/^\d+-1$/.test(label)) type = '主图';

    const task = await this.designTaskRepo.findOne({ where: { id: taskId }, select: ['id', 'candidate_id'] });
    if (!task) return { ok: false, message: '任务不存在' };

    const dup = await this.pictureRepo.findOne({ where: { task_id: taskId, label }, select: ['id'] });
    if (dup) return { ok: false, message: `编号 ${label} 已存在` };

    const candidateId = task.candidate_id;
    const mskuList = await this.getMskusForCandidate(candidateId);
    const mskuLookup = buildMskuLookup(mskuList);

    const reference_image = '';
    const variant_desc = null as string | null;
    const remark_doc = null;

    if (type === '主图') {
      const mskuInput = String(data.msku ?? '').trim();
      if (!mskuInput) return { ok: false, message: `图片位 ${label}（主图）请选择挂载的 MSKU` };
      const mrow = mskuLookup.resolve(mskuInput);
      if (!mrow) return { ok: false, message: `图片位 ${label}（主图）请选择该选品下已有的 MSKU` };
      const msku = mrow.msku;
      const insertRes = await this.pictureRepo.insert({
        task_id: taskId,
        label,
        type,
        reference_image,
        variant_desc,
        msku,
        seller_account_id: mrow.seller_account_id || null,
        variant_id: mrow.variant_id || null,
        submitter: mrow.submitter_name ?? null,
        requirements: '',
        remark_doc,
        reviewed: 0,
        photographed: 0,
        design_done: 0,
      });
      const pictureId = Number(insertRes.identifiers[0].id);
      return {
        ok: true,
        pictureId,
        label,
        type,
        msku,
        variant_id: mrow.variant_id || null,
        seller_account_id: mrow.seller_account_id || null,
        reference_image,
      };
    }

    const variant_id = (data.variant_id ?? '').trim() || null;
    const seller_account_id = (data.seller_account_id ?? '').trim() || null;
    const insertRes = await this.pictureRepo.insert({
      task_id: taskId,
      label,
      type,
      reference_image,
      variant_desc,
      msku: null,
      seller_account_id,
      variant_id,
      requirements: '',
      remark_doc,
      reviewed: 0,
      photographed: 0,
      design_done: 0,
    });
    const pictureId = Number(insertRes.identifiers[0].id);
    return {
      ok: true,
      pictureId,
      label,
      type,
      msku: null,
      variant_id,
      seller_account_id,
      reference_image,
    };
  }
}

