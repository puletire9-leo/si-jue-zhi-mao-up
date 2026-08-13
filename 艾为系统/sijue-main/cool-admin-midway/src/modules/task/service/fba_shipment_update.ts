import { Inject, Logger, Provide, TaskLocal, CommonSchedule, Config } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { ILogger } from '@midwayjs/logger';
import { AppAmzBsrRestockingCenterLingxingService } from '../../app/service/bsr_restocking_center_lingxing';

/**
 * FBA 货件状态更新定时任务
 * 每 30 分钟自动从数据库收集在途货件并更新状态
 */
@Provide()
export class TaskFbaShipmentUpdateService extends BaseService implements CommonSchedule {
  @Logger()
  logger: ILogger;

  @Inject()
  restockingService: AppAmzBsrRestockingCenterLingxingService;

  @Config('lingxing.crawlerTasksEnabled')
  lingxingCrawlerTasksEnabled: boolean;

  /**
   * 每 30 分钟自动执行
   */
  @TaskLocal('0 */30 * * * *')
  async exec() {
    if (this.lingxingCrawlerTasksEnabled === false) {
      this.logger.info('FBA 货件状态更新定时任务已关闭(lingxing.crawlerTasksEnabled=false)，跳过执行');
      return;
    }
    this.logger.info('开始执行 FBA 货件状态更新定时任务(每30分钟)');
    try {
      const result = await this.restockingService.collectAndUpdateAllFbaShipments();
      this.logger.info(`FBA 货件状态更新完成: ${JSON.stringify(result)}`);
    } catch (error) {
      this.logger.error('FBA 货件状态更新失败:', error);
    }
  }

  /**
   * 供手动调用的统一入口
   */
  async process() {
    this.logger.info('手动触发 FBA 货件状态更新');
    try {
      const result = await this.restockingService.collectAndUpdateAllFbaShipments();
      this.logger.info(`FBA 货件状态更新完成: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error('FBA 货件状态更新失败:', error);
      throw error;
    }
  }
}
