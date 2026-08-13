import { Middleware } from '@midwayjs/decorator';
import { IMiddleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';
import { AppErrorLogService } from '../service/error_log';

function shouldSkip(url: string) {
  return String(url || '').includes('/error_log/report');
}

@Middleware()
export class AppErrorLogMiddleware implements IMiddleware<Context, NextFunction> {
  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      try {
        await next();
      } catch (error) {
        if (!shouldSkip(ctx.url)) {
          const errorLogService = await ctx.requestContext.getAsync(AppErrorLogService);
          await errorLogService.recordFromContext(ctx, error);
        }
        throw error;
      }
    };
  }
}
