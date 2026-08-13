import { CoolEvent, Event } from '@cool-midway/core';
import { Inject } from '@midwayjs/core';
import { ListingDingTalkNotifyService } from '../service/listing_dingtalk_notify';

@CoolEvent()
export class DingTalkStartupEvent {
  @Inject()
  listingDingTalkNotifyService: ListingDingTalkNotifyService;

  @Event('onServerReady')
  async onServerReady() {
    // 不 await：避免钉钉网络拖慢/影响服务就绪；失败仅打日志
    void this.listingDingTalkNotifyService.notifyServerStarted();
  }
}
