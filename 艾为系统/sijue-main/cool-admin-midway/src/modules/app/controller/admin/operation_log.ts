import {CoolController, BaseController} from '@cool-midway/core';
import {AppOperationLogEntity} from "../../entity/operation_log";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppOperationLogEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'via',
      'description',
    ],
    fieldEq: [
      'type',
    ],
  }
})
@updateWithoutAmendingCreateTime
export class AdminAppOperationLogController extends BaseController {
}
