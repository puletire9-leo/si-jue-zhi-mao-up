import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzPricingTriggerRuleEntity } from '../../entity/pricing_trigger_rule';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzPricingTriggerRuleEntity,
  pageQueryOp: {
    keyWordLikeFields: ['rule_name', 'description', 'matched_strategy'],
  }
})
export class AdminAppAmzPricingTriggerRuleController extends BaseController {
}