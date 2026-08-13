import { Body, Inject, Post, Provide } from '@midwayjs/decorator';
import { BaseController, CoolController } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { AppErrorLogEntity } from '../../entity/error_log';
import { AppErrorLogService } from '../../service/error_log';

@Provide()
@CoolController({
  api: ['delete', 'update', 'info', 'list', 'page'],
  entity: AppErrorLogEntity,
  service: AppErrorLogService,
  pageQueryOp: {
    fieldEq: ['source', 'level', 'module', 'statusCode', 'handledStatus', 'traceId', 'userId'],
    keyWordLikeFields: ['message', 'url', 'userName', 'traceId', 'module'],
    addOrderBy: { createTime: 'DESC' },
  },
})
export class AdminAppErrorLogController extends BaseController {
  @Inject()
  ctx: Context;

  @Inject()
  errorLogService: AppErrorLogService;

  @Post('/markHandled', { summary: 'mark error logs handled or ignored' })
  async markHandled(@Body() body: any) {
    const admin = this.ctx.admin || {};
    const result = await this.errorLogService.markHandled({
      ids: Array.isArray(body?.ids) ? body.ids : [body?.id],
      handledStatus: Number(body?.handledStatus),
      handledRemark: body?.handledRemark,
      handledUserId: admin.userId,
      handledUserName: admin.username || admin.name,
    });
    return this.ok(result);
  }

  @Post('/stats', { summary: 'error log stats' })
  async stats() {
    return this.ok(await this.errorLogService.stats());
  }

  @Post('/clearHandled', { summary: 'clear handled error logs' })
  async clearHandled() {
    return this.ok(await this.errorLogService.clearHandled());
  }
}
