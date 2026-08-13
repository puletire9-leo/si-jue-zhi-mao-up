import { BaseService } from '@cool-midway/core';
import { Inject, Provide } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Context } from '@midwayjs/koa';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { AppErrorLogEntity } from '../entity/error_log';
import {
  inferModuleFromUrl,
  normalizeErrorMessage,
  sanitizeForErrorLog,
  toLimitedText,
} from './error_log_helpers';

export interface AppErrorLogRecordPayload {
  source?: 'backend' | 'frontend' | 'task' | 'third_party' | string;
  level?: 'error' | 'warn' | string;
  module?: string;
  message?: string;
  stack?: string;
  url?: string;
  method?: string;
  statusCode?: number;
  traceId?: string;
  userId?: number;
  userName?: string;
  ip?: string;
  userAgent?: string;
  requestParams?: any;
  responseBody?: any;
  extra?: any;
}

function normalizePositiveNumber(value: any) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function requestParamsFromContext(ctx: Context) {
  const method = String(ctx.method || '').toUpperCase();
  if (method === 'GET') return ctx.request.query || {};
  return ctx.request.body || {};
}

function userNameFromAdmin(admin: any) {
  return admin?.username || admin?.name || admin?.nickName || admin?.nickname || '';
}

@Provide()
export class AppErrorLogService extends BaseService {
  @InjectEntityModel(AppErrorLogEntity)
  errorLogRepo: Repository<AppErrorLogEntity>;

  @Inject()
  ctx: Context;

  async record(payload: AppErrorLogRecordPayload = {}) {
    try {
      const url = toLimitedText(payload.url || '', 1000);
      const log = this.errorLogRepo.create({
        source: toLimitedText(payload.source || 'backend', 32),
        level: toLimitedText(payload.level || 'error', 16),
        module: toLimitedText(payload.module || inferModuleFromUrl(url), 100),
        message: toLimitedText(payload.message || 'Unknown error', 1000),
        stack: toLimitedText(payload.stack || '', 8000),
        url,
        method: toLimitedText(String(payload.method || '').toUpperCase(), 16),
        statusCode: normalizePositiveNumber(payload.statusCode),
        traceId: toLimitedText(payload.traceId || randomUUID(), 80),
        userId: normalizePositiveNumber(payload.userId),
        userName: toLimitedText(payload.userName || '', 100),
        ip: toLimitedText(payload.ip || '', 100),
        userAgent: toLimitedText(payload.userAgent || '', 500),
        requestParams: sanitizeForErrorLog(payload.requestParams ?? null),
        responseBody: sanitizeForErrorLog(payload.responseBody ?? null),
        extra: sanitizeForErrorLog(payload.extra ?? null),
        handledStatus: 0,
      });

      return await this.errorLogRepo.save(log);
    } catch (err) {
      console.warn('[AppErrorLogService] record failed:', err?.message || err);
      return null;
    }
  }

  async recordFromContext(
    ctx: Context,
    error: any,
    overrides: Partial<AppErrorLogRecordPayload> = {}
  ) {
    const statusCode =
      overrides.statusCode ||
      error?.status ||
      error?.statusCode ||
      ctx.status ||
      500;
    const traceId =
      (ctx.get && (ctx.get('x-request-id') || ctx.get('x-trace-id'))) ||
      overrides.traceId ||
      randomUUID();

    return await this.record({
      source: 'backend',
      level: Number(statusCode) >= 500 ? 'error' : 'warn',
      module: inferModuleFromUrl(ctx.url),
      message: normalizeErrorMessage(error),
      stack: toLimitedText(error?.stack || '', 8000),
      url: ctx.url,
      method: ctx.method,
      statusCode,
      traceId,
      userId: ctx.admin?.userId,
      userName: userNameFromAdmin(ctx.admin),
      ip: ctx.ip || ctx.get?.('x-forwarded-for') || '',
      userAgent: ctx.get?.('user-agent') || '',
      requestParams: requestParamsFromContext(ctx),
      extra: {
        name: error?.name,
        code: error?.code,
      },
      ...overrides,
    });
  }

  async markHandled(params: {
    ids: number[];
    handledStatus: number;
    handledRemark?: string;
    handledUserId?: number;
    handledUserName?: string;
  }) {
    const ids = Array.isArray(params.ids)
      ? params.ids.map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0)
      : [];
    if (!ids.length) return { affected: 0 };

    const handledStatus = [1, 2].includes(Number(params.handledStatus))
      ? Number(params.handledStatus)
      : 1;
    const result = await this.errorLogRepo.update(
      { id: In(ids) },
      {
        handledStatus,
        handledRemark: toLimitedText(params.handledRemark || '', 4000),
        handledUserId: params.handledUserId || null,
        handledUserName: toLimitedText(params.handledUserName || '', 100),
        handledTime: new Date(),
      }
    );

    return { affected: result.affected || 0 };
  }

  async stats() {
    const [total, pending, handled, ignored] = await Promise.all([
      this.errorLogRepo.count(),
      this.errorLogRepo.count({ where: { handledStatus: 0 } }),
      this.errorLogRepo.count({ where: { handledStatus: 1 } }),
      this.errorLogRepo.count({ where: { handledStatus: 2 } }),
    ]);
    return { total, pending, handled, ignored };
  }

  async clearHandled() {
    const result = await this.errorLogRepo.delete({ handledStatus: In([1, 2]) });
    return { affected: result.affected || 0 };
  }
}
