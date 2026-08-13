import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzPricingTaskEntity } from '../../entity/pricing_task';
import { AppAmzPricingTaskService } from '../../service/pricing_task';
import { Body, Inject, Post } from '@midwayjs/decorator';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzPricingTaskEntity,
  service: AppAmzPricingTaskService,
  pageQueryOp: {
    keyWordLikeFields: ['task_name', 'asin', 'msku', 'seller_name'],
  }
})
export class AdminAppAmzPricingTaskController extends BaseController {
  @Inject()
  pricingTaskService: AppAmzPricingTaskService;

  /**
   * 启动任务
   */
  @Post('/start')
  async start(@Body() body: { id: number }) {
    return await this.pricingTaskService.start(body);
  }

  /**
   * 暂停任务
   */
  @Post('/pause')
  async pause(@Body() body: { id: number }) {
    return await this.pricingTaskService.pause(body);
  }

  /**
   * 继续任务
   */
  @Post('/resume')
  async resume(@Body() body: { id: number }) {
    return await this.pricingTaskService.resume(body);
  }

  /**
   * 取消任务
   */
  @Post('/cancel')
  async cancel(@Body() body: { id: number }) {
    return await this.pricingTaskService.cancel(body);
  }

  /**
   * 批量启动任务
   */
  @Post('/batchStart')
  async batchStart(@Body() body: { ids: number[] }) {
    return await this.pricingTaskService.batchStart(body);
  }

  /**
   * 批量暂停任务
   */
  @Post('/batchPause')
  async batchPause(@Body() body: { ids: number[] }) {
    return await this.pricingTaskService.batchPause(body);
  }

  /**
   * 批量取消任务
   */
  @Post('/batchCancel')
  async batchCancel(@Body() body: { ids: number[] }) {
    return await this.pricingTaskService.batchCancel(body);
  }
}