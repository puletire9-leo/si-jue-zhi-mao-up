import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzPricingProductTagEntity } from '../../entity/pricing_product_tag';

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzPricingProductTagEntity,
  pageQueryOp: {
    keyWordLikeFields: ['asin', 'msku', 'seller_name'],
  }
})
export class AdminAppAmzPricingProductTagController extends BaseController {
}
