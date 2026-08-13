import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzBsrPriceRuleEntity } from '../../entity/bsr_price_rule';
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrPriceRuleEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'trigger_strategy',
      'system_action'
    ],
  }
})
@updateWithoutAmendingCreateTime
export class AdminAppAmzBsrPriceRuleController extends BaseController {
}
