import { CoolEvent, Event } from '@cool-midway/core';
import { Inject } from '@midwayjs/core';
import { DesignJobSchedulerService } from '../service/design_job_scheduler';

@CoolEvent()
export class DesignJobSchedulerEvent {
  @Inject()
  designJobSchedulerService: DesignJobSchedulerService;

  @Event('onServerReady')
  async onServerReady() {
    await this.designJobSchedulerService.onServerReady();
  }
}

