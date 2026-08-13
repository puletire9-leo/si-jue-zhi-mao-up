import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzPricingExecutionHistoryEntity } from '../../entity/pricing_execution_history';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzPricingExecutionHistoryEntity,
  pageQueryOp: {
    keyWordLikeFields: ['asin', 'msku', 'seller_name', 'trigger_reason'],
  }
})
export class AdminAppAmzPricingExecutionHistoryController extends BaseController {
}