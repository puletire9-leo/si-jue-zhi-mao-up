import { Body, Controller, Inject, Post } from '@midwayjs/decorator';
import { BaseController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { AppErrorLogService } from '../../service/error_log';
import { normalizeErrorMessage, toLimitedText } from '../../service/error_log_helpers';

@Controller('/open/app/error_log')
export class OpenAppErrorLogController extends BaseController {
  @Inject()
  ctx: Context;

  @Inject()
  errorLogService: AppErrorLogService;

  @Post('/report')
  async report(@Body() body: any) {
    const saved = await this.errorLogService.record({
      source: body?.source || 'frontend',
      level: body?.level || 'error',
      module: body?.module,
      message: normalizeErrorMessage(body?.message || body?.error),
      stack: toLimitedText(body?.stack || '', 8000),
      url: body?.url,
      method: body?.method,
      statusCode: body?.statusCode,
      traceId: body?.traceId,
      userId: body?.userId,
      userName: body?.userName,
      ip: this.ctx.ip || this.ctx.get?.('x-forwarded-for') || '',
      userAgent: body?.userAgent || this.ctx.get?.('user-agent') || '',
      requestParams: body?.requestParams,
      responseBody: body?.responseBody,
      extra: body?.extra,
    });

    return this.ok({ id: saved?.id || null });
  }
}
