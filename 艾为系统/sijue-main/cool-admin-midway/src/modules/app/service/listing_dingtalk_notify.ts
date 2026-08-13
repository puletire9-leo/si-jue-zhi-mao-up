import { Config, Inject, Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { ILogger } from '@midwayjs/logger';
import { DingTalkNotifyService } from './dingtalk_notify';
import { ListingNotifyTargetsService } from './listing_notify_targets_service';
import {
  AiListingCopyDoneNotifyContext,
  AiListingCopyFailedNotifyContext,
  DesignRequirementAiDoneNotifyContext,
  DesignRequirementAiFailedNotifyContext,
} from './listing_notify_targets';

type DingTalkConfig = {
  adminBaseUrl?: string;
  notifyOnStartup?: boolean;
  debugSendResult?: boolean;
  testMobile?: string;
};

/**
 * 钉钉 Listing 相关通知。方法内部 catch 所有错误且不应向外抛；
 * 调用方请使用 void 触发，不要 await，以免 HTTP 阻塞主流程。
 */
@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class ListingDingTalkNotifyService {
  @Inject()
  dingTalkNotifyService: DingTalkNotifyService;

  @Inject()
  listingNotifyTargetsService: ListingNotifyTargetsService;

  @Config('dingtalk')
  dingtalkConfig: DingTalkConfig;

  @Inject()
  logger: ILogger;

  private truncateReason(reason: string, maxLen = 480): string {
    const s = String(reason || '').trim() || '未知错误';
    return s.length <= maxLen ? s : `${s.slice(0, maxLen)}…`;
  }

  /**
   * 通知接收人 userid 列表。
   * 优先级：DINGTALK_TEST_USERID > DINGTALK_TEST_MOBILE / dingtalk.testMobile（查 getbymobile）
   * 注意：个人资料里的「钉钉号」(如 d00b8l5) ≠ userid，不能当 userid 用。
   */
  private async resolveNotifyUserIds(
    _ctx?: DesignRequirementAiDoneNotifyContext | AiListingCopyDoneNotifyContext
  ): Promise<string[]> {
    const fromUserId = String(process.env.DINGTALK_TEST_USERID || '')
      .split(/[,，\s]+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (fromUserId.length) return fromUserId;

    const mobile = String(
      process.env.DINGTALK_TEST_MOBILE || this.dingtalkConfig?.testMobile || ''
    ).trim();
    if (mobile) {
      try {
        const uid = await this.dingTalkNotifyService.getUserIdByMobile(mobile);
        if (uid) {
          this.logger.info('[ListingDingTalk] resolved userid by mobile', { mobile, userid: uid });
          return [uid];
        }
        this.logger.warn('[ListingDingTalk] getbymobile returned empty userid', { mobile });
      } catch (e: any) {
        this.logger.error('[ListingDingTalk] getbymobile failed:', e?.message || e);
      }
    }

    this.logger.warn(
      '[ListingDingTalk] 未配置有效通知人：请设置 DINGTALK_TEST_USERID（真实 userid）或 DINGTALK_TEST_MOBILE（手机号）'
    );
    return [];
  }

  /** 服务启动完成 → 工作通知（默认关闭，需 dingtalk.notifyOnStartup=true） */
  async notifyServerStarted(): Promise<void> {
    if (this.dingtalkConfig?.notifyOnStartup !== true) return;
    try {
      const userIds = await this.resolveNotifyUserIds();
      const env = process.env.NODE_ENV || 'development';
      const at = new Date().toLocaleString('zh-CN', { hour12: false });
      const taskId = await this.dingTalkNotifyService.sendWorkNotice({
        userIds,
        title: '服务已启动',
        markdownText: `### cool-admin 后端已启动\n\n- 环境：${env}\n- 时间：${at}`,
      });
      this.dingTalkNotifyService.scheduleDebugSendResult(taskId);
      this.logger.info('[ListingDingTalk] server started notice sent', { userIds, env, taskId });
    } catch (e: any) {
      this.logger.error('[ListingDingTalk] notifyServerStarted failed:', e?.message || e);
    }
  }

  /** AI 图需 / AI 文案：助理 + 该选品「做」提交人 → 钉钉 userid */
  private async resolveListingTaskNotifyUserIds(candidateId: number): Promise<string[]> {
    return this.listingNotifyTargetsService.resolveListingTaskNotifyUserIds(
      Number(candidateId)
    );
  }

  /** AI 图需生成完成 → 工作通知 */
  async notifyDesignRequirementAiDone(
    ctx: DesignRequirementAiDoneNotifyContext
  ): Promise<void> {
    try {
      const userIds = await this.resolveListingTaskNotifyUserIds(ctx.candidateId);
      const name = String(ctx.productName || '选品').trim() || '选品';
      const base = String(this.dingtalkConfig?.adminBaseUrl || '').replace(/\/$/, '');
      const detailPath = `/app/design-task/detail?id=${ctx.designTaskId}`;
      const linkLine = base
        ? `\n\n[进入网站审核](${base}/#${detailPath})`
        : '\n\n请进入网站审核（美工任务详情）。';

      const taskId = await this.dingTalkNotifyService.sendWorkNotice({
        userIds,
        title: '图需生成完成',
        markdownText: `### ${name}的图需已经生成完成，请进入网站审核。${linkLine}`,
      });
      this.dingTalkNotifyService.scheduleDebugSendResult(taskId);
      this.logger.info('[ListingDingTalk] design requirement ai done sent', {
        designTaskId: ctx.designTaskId,
        candidateId: ctx.candidateId,
        userIds,
        taskId,
      });
    } catch (e: any) {
      this.logger.error(
        '[ListingDingTalk] notifyDesignRequirementAiDone failed:',
        e?.message || e
      );
    }
  }

  /** AI 文案任务生成完成 → 工作通知 */
  async notifyAiListingCopyDone(ctx: AiListingCopyDoneNotifyContext): Promise<void> {
    try {
      const userIds = await this.resolveListingTaskNotifyUserIds(ctx.candidateId);
      const name = String(ctx.productName || '选品').trim() || '选品';
      const n = Math.max(1, Number(ctx.variantCount || 1));
      const base = String(this.dingtalkConfig?.adminBaseUrl || '').replace(/\/$/, '');
      const detailPath = `/app/listing-ai-copy-task/detail?id=${ctx.aiListingTaskId}`;
      const linkLine = base
        ? `\n\n[进入网站审核](${base}/#${detailPath})`
        : '\n\n请进入网站审核（AI 文案任务详情）。';

      const taskId = await this.dingTalkNotifyService.sendWorkNotice({
        userIds,
        title: 'AI文案生成完成',
        markdownText: `### ${name}的${n}个变体的文案已生成完成，请进入网站审核。${linkLine}`,
      });
      this.dingTalkNotifyService.scheduleDebugSendResult(taskId);
      this.logger.info('[ListingDingTalk] ai listing copy done sent', {
        aiListingTaskId: ctx.aiListingTaskId,
        candidateId: ctx.candidateId,
        variantCount: n,
        userIds,
        taskId,
      });
    } catch (e: any) {
      this.logger.error('[ListingDingTalk] notifyAiListingCopyDone failed:', e?.message || e);
    }
  }

  /** AI 图需生成失败 → 工作通知 */
  async notifyDesignRequirementAiFailed(
    ctx: DesignRequirementAiFailedNotifyContext
  ): Promise<void> {
    try {
      const userIds = await this.resolveListingTaskNotifyUserIds(ctx.candidateId);
      const name = String(ctx.productName || '选品').trim() || '选品';
      const reason = this.truncateReason(ctx.reason);
      const base = String(this.dingtalkConfig?.adminBaseUrl || '').replace(/\/$/, '');
      const detailPath = `/app/design-task/detail?id=${ctx.designTaskId}`;
      const linkLine = base
        ? `\n\n[查看任务](${base}/#${detailPath})`
        : '\n\n请进入网站查看美工任务详情。';

      const taskId = await this.dingTalkNotifyService.sendWorkNotice({
        userIds,
        title: '图需生成失败',
        markdownText: `### ${name}的图需生成失败\n\n**原因：** ${reason}${linkLine}`,
      });
      this.dingTalkNotifyService.scheduleDebugSendResult(taskId);
      this.logger.info('[ListingDingTalk] design requirement ai failed sent', {
        designTaskId: ctx.designTaskId,
        userIds,
        taskId,
      });
    } catch (e: any) {
      this.logger.error(
        '[ListingDingTalk] notifyDesignRequirementAiFailed failed:',
        e?.message || e
      );
    }
  }

  /** AI 文案任务生成失败 → 工作通知 */
  async notifyAiListingCopyFailed(ctx: AiListingCopyFailedNotifyContext): Promise<void> {
    try {
      const userIds = await this.resolveListingTaskNotifyUserIds(ctx.candidateId);
      const name = String(ctx.productName || '选品').trim() || '选品';
      const n = Math.max(1, Number(ctx.variantCount || 1));
      const reason = this.truncateReason(ctx.reason);
      const base = String(this.dingtalkConfig?.adminBaseUrl || '').replace(/\/$/, '');
      const detailPath = `/app/listing-ai-copy-task/detail?id=${ctx.aiListingTaskId}`;
      const linkLine = base
        ? `\n\n[查看任务](${base}/#${detailPath})`
        : '\n\n请进入网站查看 AI 文案任务详情。';

      const taskId = await this.dingTalkNotifyService.sendWorkNotice({
        userIds,
        title: 'AI文案生成失败',
        markdownText: `### ${name}的${n}个变体文案生成失败\n\n**原因：** ${reason}${linkLine}`,
      });
      this.dingTalkNotifyService.scheduleDebugSendResult(taskId);
      this.logger.info('[ListingDingTalk] ai listing copy failed sent', {
        aiListingTaskId: ctx.aiListingTaskId,
        variantCount: n,
        userIds,
        taskId,
      });
    } catch (e: any) {
      this.logger.error('[ListingDingTalk] notifyAiListingCopyFailed failed:', e?.message || e);
    }
  }
}
