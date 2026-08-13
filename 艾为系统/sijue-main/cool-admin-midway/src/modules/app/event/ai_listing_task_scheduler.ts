import { CoolEvent, Event } from '@cool-midway/core';
import { Inject } from '@midwayjs/core';
import { AiListingTaskSchedulerService } from '../service/ai_listing_task_scheduler';

@CoolEvent()
export class AiListingTaskSchedulerEvent {
  @Inject()
  aiListingTaskSchedulerService: AiListingTaskSchedulerService;

  @Event('onServerReady')
  async onServerReady() {
    await this.aiListingTaskSchedulerService.onServerReady();
  }
}
