import { Config, Inject, Provide, Scope, ScopeEnum } from '@midwayjs/core';
import { ILogger } from '@midwayjs/logger';
import axios from 'axios';

export type DingTalkWorkNoticePayload = {
  userIds: string[];
  title: string;
  markdownText: string;
};

type DingTalkConfig = {
  enabled?: boolean;
  appKey?: string;
  appSecret?: string;
  agentId?: number | string;
  /** 管理后台根 URL，用于消息内跳转链接（可选） */
  adminBaseUrl?: string;
  /** 发送后 2s 拉取 getsendresult 并打日志（本地排查用） */
  debugSendResult?: boolean;
  /** 测试用手机号（解析为 userid，与 DINGTALK_TEST_MOBILE 二选一） */
  testMobile?: string;
};

export type DingTalkSendResultDetail = {
  taskId: number;
  invalid_user_id_list?: string[];
  forbidden_user_id_list?: string[];
  failed_user_id_list?: string[];
  read_user_id_list?: string[];
  unread_user_id_list?: string[];
  forbidden_list?: Array<{ userid?: string; code?: string; count?: number }>;
};

@Provide()
@Scope(ScopeEnum.Request, { allowDowngrade: true })
export class DingTalkNotifyService {
  @Config('dingtalk')
  dingtalkConfig: DingTalkConfig;

  @Inject()
  logger: ILogger;

  private accessToken: string | null = null;
  private accessTokenExpiresAt = 0;

  /** 手机号 → userid（缓存，避免同批通知重复调 getbymobile） */
  private mobileUserIdCache: {
    expiresAt: number;
    byMobile: Map<string, string | null>;
  } | null = null;

  isEnabled(): boolean {
    const c = this.dingtalkConfig || {};
    if (c.enabled === false) return false;
    return !!(c.appKey && c.appSecret && c.agentId);
  }

  /** @returns task_id（钉钉已受理异步任务）；null 表示未发出 */
  async sendWorkNotice(payload: DingTalkWorkNoticePayload): Promise<number | null> {
    const userIds = Array.from(
      new Set((payload.userIds || []).map(x => String(x || '').trim()).filter(Boolean))
    );
    if (!userIds.length) {
      this.logger.warn('[DingTalk] skip: empty userIds');
      return null;
    }
    if (!this.isEnabled()) {
      this.logger.warn('[DingTalk] skip: not configured or disabled');
      return null;
    }

    const accessToken = await this.getAccessToken();
    const agentId = Number(this.dingtalkConfig.agentId);
    const msg = {
      msgtype: 'markdown',
      markdown: {
        title: payload.title,
        text: payload.markdownText,
      },
    };

    // topapi 要求 x-www-form-urlencoded；JSON body 会导致 errcode=41 Invalid arguments:msg
    const form = new URLSearchParams();
    form.set('agent_id', String(agentId));
    form.set('userid_list', userIds.join(','));
    form.set('to_all_user', 'false');
    form.set('msg', JSON.stringify(msg));

    const { data } = await axios.post(
      'https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2',
      form.toString(),
      {
        params: { access_token: accessToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    if (Number(data?.errcode) !== 0) {
      throw new Error(
        `[DingTalk] asyncsend_v2 failed: errcode=${data?.errcode} errmsg=${data?.errmsg || ''}`
      );
    }

    const taskId = Number(data?.task_id || 0) || null;
    this.logger.info('[DingTalk] asyncsend_v2 accepted', {
      taskId,
      userIds,
      request_id: data?.request_id,
    });
    return taskId;
  }

  /** 查询工作通知投递结果（仅 24h 内 task；需 asyncsend 返回的 task_id） */
  async fetchSendResult(taskId: number): Promise<DingTalkSendResultDetail | null> {
    if (!taskId || !this.isEnabled()) return null;
    const accessToken = await this.getAccessToken();
    const agentId = Number(this.dingtalkConfig.agentId);
    const form = new URLSearchParams();
    form.set('agent_id', String(agentId));
    form.set('task_id', String(taskId));

    const { data } = await axios.post(
      'https://oapi.dingtalk.com/topapi/message/corpconversation/getsendresult',
      form.toString(),
      {
        params: { access_token: accessToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    if (Number(data?.errcode) !== 0) {
      throw new Error(
        `[DingTalk] getsendresult failed: errcode=${data?.errcode} errmsg=${data?.errmsg || ''}`
      );
    }

    const r = data?.send_result || {};
    return {
      taskId,
      invalid_user_id_list: r.invalid_user_id_list,
      forbidden_user_id_list: r.forbidden_user_id_list,
      failed_user_id_list: r.failed_user_id_list,
      read_user_id_list: r.read_user_id_list,
      unread_user_id_list: r.unread_user_id_list,
      forbidden_list: r.forbidden_list,
    };
  }

  /**
   * 根据手机号查 userid（需通讯录/手机号权限）。
   * 注意：个人资料里的「钉钉号」不是 userid。
   */
  async getUserIdByMobile(mobile: string): Promise<string | null> {
    const m = String(mobile || '').trim();
    if (!m || !this.isEnabled()) return null;
    const accessToken = await this.getAccessToken();
    const form = new URLSearchParams();
    form.set('mobile', m);

    const { data } = await axios.post(
      'https://oapi.dingtalk.com/topapi/v2/user/getbymobile',
      form.toString(),
      {
        params: { access_token: accessToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    if (Number(data?.errcode) !== 0) {
      throw new Error(
        `[DingTalk] getbymobile failed: errcode=${data?.errcode} errmsg=${data?.errmsg || ''}`
      );
    }
    const userid = String(data?.result?.userid || '').trim();
    return userid || null;
  }

  private normalizeStaffPhone(phone?: string | null): string {
    return String(phone || '')
      .trim()
      .replace(/\D/g, '');
  }

  private getMobileUserIdCache(): Map<string, string | null> {
    const ttlMs = 15 * 60 * 1000;
    const now = Date.now();
    if (this.mobileUserIdCache && now < this.mobileUserIdCache.expiresAt) {
      return this.mobileUserIdCache.byMobile;
    }
    const byMobile = new Map<string, string | null>();
    this.mobileUserIdCache = { expiresAt: now + ttlMs, byMobile };
    return byMobile;
  }

  private async resolveUserIdByMobileCached(mobile: string): Promise<string | null> {
    const cache = this.getMobileUserIdCache();
    if (cache.has(mobile)) {
      return cache.get(mobile) || null;
    }
    const uid = await this.getUserIdByMobile(mobile);
    cache.set(mobile, uid);
    return uid;
  }

  /**
   * 按系统用户表手机号在钉钉匹配 userid（getbymobile）；无手机号则跳过。
   */
  async resolveUserIdsByStaffProfiles(
    profiles: Array<{ name: string; phone?: string | null }>
  ): Promise<string[]> {
    if (!profiles.length || !this.isEnabled()) return [];

    const resolved = new Set<string>();

    for (const p of profiles) {
      const name = String(p.name || '').trim() || '(未命名)';
      const phone = this.normalizeStaffPhone(p.phone);
      if (!phone) {
        this.logger.warn('[DingTalk] 用户未填写手机号，跳过钉钉通知', { name });
        continue;
      }

      try {
        const uid = await this.resolveUserIdByMobileCached(phone);
        if (uid) {
          resolved.add(uid);
        } else {
          this.logger.warn('[DingTalk] 手机号未匹配到钉钉 userid', { name, phone });
        }
      } catch (e: any) {
        this.logger.warn('[DingTalk] getbymobile failed', {
          name,
          phone,
          message: e?.message || e,
        });
      }
    }

    return Array.from(resolved);
  }

  scheduleDebugSendResult(taskId: number | null): void {
    if (!taskId || !this.dingtalkConfig?.debugSendResult) return;
    setTimeout(() => {
      void this.fetchSendResult(taskId)
        .then(detail => {
          if (!detail) return;
          this.logger.info('[DingTalk] getsendresult', detail);
          if (detail.invalid_user_id_list?.length) {
            this.logger.warn('[DingTalk] invalid userid（账号不存在或写错）', detail.invalid_user_id_list);
          }
          if (detail.forbidden_user_id_list?.length) {
            this.logger.warn('[DingTalk] forbidden userid（流控/频控未发）', detail.forbidden_user_id_list);
          }
          if (detail.failed_user_id_list?.length) {
            this.logger.warn('[DingTalk] failed userid', detail.failed_user_id_list);
          }
        })
        .catch((e: any) => {
          this.logger.error('[DingTalk] getsendresult error:', e?.message || e);
        });
    }, 2000);
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && now < this.accessTokenExpiresAt - 60_000) {
      return this.accessToken;
    }
    const appKey = String(this.dingtalkConfig.appKey || '').trim();
    const appSecret = String(this.dingtalkConfig.appSecret || '').trim();
    const { data } = await axios.get('https://oapi.dingtalk.com/gettoken', {
      params: { appkey: appKey, appsecret: appSecret },
      timeout: 15000,
    });
    if (Number(data?.errcode) !== 0 || !data?.access_token) {
      throw new Error(
        `[DingTalk] gettoken failed: errcode=${data?.errcode} errmsg=${data?.errmsg || ''}`
      );
    }
    this.accessToken = String(data.access_token);
    const expiresIn = Math.max(60, Number(data.expires_in || 7200));
    this.accessTokenExpiresAt = now + expiresIn * 1000;
    return this.accessToken;
  }
}
