import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzPricingRealtimeRuleEntity } from '../../entity/pricing_realtime_rule';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzPricingRealtimeRuleEntity,
  pageQueryOp: {
    keyWordLikeFields: ['rule_name', 'description'],
  }
})
export class AdminAppAmzPricingRealtimeRuleController extends BaseController {
}
