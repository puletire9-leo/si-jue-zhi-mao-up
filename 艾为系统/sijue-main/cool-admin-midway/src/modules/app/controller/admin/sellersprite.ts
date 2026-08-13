import { Provide, Inject, Controller, Post } from '@midwayjs/decorator';
import { BaseController } from '@cool-midway/core';
import { SellerspriteTool } from '../../utils/maijiajingling/SellerspriteUtil';

/**
 * 卖家精灵相关接口
 */
@Provide()
@Controller('/admin/app/sellersprite')
export class SellerspriteController extends BaseController {
  @Inject()
  sellerspriteTool: SellerspriteTool;

  @Post('/autoFetchCookie')
  async autoFetchCookie() {
    try {
      const cookie = await this.sellerspriteTool.autoLoginAndRefreshCookie();
      return this.ok(cookie);
    } catch (e) {
      return this.fail(e.message);
    }
  }
}
