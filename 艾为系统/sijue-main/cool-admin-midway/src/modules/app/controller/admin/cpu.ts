import {CoolController, BaseController} from '@cool-midway/core';
import {AppCpuEntity} from '../../entity/cpu';
import {Get, Inject, Query} from '@midwayjs/decorator';
import {AppCpuService} from '../../service/cpu';
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";


@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppCpuEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'name',
      'brand',
    ],
  }
})
@updateWithoutAmendingCreateTime
export class AdminAppCpuController extends BaseController {
  @Inject()
  appCpuService: AppCpuService;

  @Get('/test_api')
  async test(@Query('message') message: string) {
    return {data: this.appCpuService.testLogic(message)};
  }
}
