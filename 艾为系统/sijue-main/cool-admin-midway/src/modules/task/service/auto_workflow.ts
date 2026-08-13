import { Inject, Logger, Provide, Config } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { ILogger } from '@midwayjs/logger';
import { AppAmzBsrCandidateService } from '../../app/service/bsr_candidate';

/**
 * BSR 选品自动流水线服务。
 * 不再使用代码内置 @TaskLocal 固定频率执行，请在系统任务中配置 service 调用。
 */
@Provide()
export class TaskAutoCandidateWorkflowService extends BaseService {
  @Logger()
  logger: ILogger;

  @Inject()
  bsrCandidateService: AppAmzBsrCandidateService;

  @Config('workflow.autoCandidate.enabled')
  autoCandidateWorkflowEnabled: boolean;

  async process() {
    if (this.autoCandidateWorkflowEnabled === false) {
      this.logger.info('选品全自动流水线已关闭 workflow.autoCandidate.enabled=false，跳过执行');
      return '选品全自动流水线已关闭';
    }

    this.logger.info('开始执行选品全自动流水线轮询任务');
    try {
      const result = await this.bsrCandidateService.autoProcessCandidateWorkflow();
      this.logger.info(`选品全自动流水线执行完毕: ${result}`);
      return result;
    } catch (error) {
      this.logger.error('选品全自动流水线执行失败:', error);
      throw error;
    }
  }
}
