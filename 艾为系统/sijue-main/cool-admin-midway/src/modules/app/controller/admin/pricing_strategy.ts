import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzPricingStrategyEntity } from '../../entity/pricing_strategy';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzPricingStrategyEntity,
  pageQueryOp: {
    keyWordLikeFields: ['strategy_name', 'description'],
  }
})
export class AdminAppAmzPricingStrategyController extends BaseController {
}