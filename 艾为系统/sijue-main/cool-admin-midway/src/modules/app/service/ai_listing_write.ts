import {Provide} from '@midwayjs/decorator';
import {BaseService} from '@cool-midway/core';
import {InjectEntityModel} from '@midwayjs/typeorm';
import {Repository} from 'typeorm';
import {AppAmzAiListingWriteEntity} from "../entity/ai_listing_write";

@Provide()
export class AppAmzAiListingWriteService extends BaseService {
  @InjectEntityModel(AppAmzAiListingWriteEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzAiListingWriteEntity>;

}

