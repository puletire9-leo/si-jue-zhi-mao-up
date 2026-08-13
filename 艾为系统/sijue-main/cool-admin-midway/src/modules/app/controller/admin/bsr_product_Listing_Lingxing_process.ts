import { CoolController, BaseController } from '@cool-midway/core';
import { AppAmzBsrProductListingLingxingProcessEntity } from "../../entity/bsr_product_Listing_Lingxing_process";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrProductListingLingxingProcessEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'mergeId','msku','asin','shop','item_name','product_code','image_state','local_name'
    ],
    fieldEq: [
      'mergeId','msku','asin','shop','item_name','local_name','status','marketplace','product_code','image_state','in_transit_type'
    ],
  },
})
@updateWithoutAmendingCreateTime
export class AdminBsrProductListingLingxingProcessController extends BaseController {

}