import {CoolController, BaseController} from '@cool-midway/core';
import {AppAmzBsrCandidatePurchaserEntity} from "../../entity/bsr_candidate_purchaser";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrCandidatePurchaserEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'selectedVariant',
      'candidate_id',
      'purchaser',
      'id',
    ],
    fieldEq: [
      'selectedVariant',
      'candidate_id',
      'purchaser',
      'id',
    ],
  }
})
@updateWithoutAmendingCreateTime
export class AdminAppAmzBsrCandidatePurchaserController extends BaseController {
}
