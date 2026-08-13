import {Provide} from '@midwayjs/decorator';
import {BaseService} from '@cool-midway/core';
import {InjectEntityModel} from '@midwayjs/typeorm';
import {Repository} from 'typeorm';
import {AppAmzBsrProductListingLingxingProcessEntity} from "../entity/bsr_product_Listing_Lingxing_process";

@Provide()
export class AppAmzBsrRestockingCenterLingxingProcessService extends BaseService {
  @InjectEntityModel(AppAmzBsrProductListingLingxingProcessEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrProductListingLingxingProcessEntity>;

}

