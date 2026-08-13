import {Provide} from '@midwayjs/decorator';
import {BaseService} from '@cool-midway/core';
import {InjectEntityModel} from '@midwayjs/typeorm';
import {Repository} from 'typeorm';
import {AppAmzBsrCandidateCustomizeeEntity} from "../entity/bsr_candidate_customize";

@Provide()
export class AppAmzBsrCandidateCustomizeService extends BaseService {
  @InjectEntityModel(AppAmzBsrCandidateCustomizeeEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrCandidateCustomizeeEntity>;

}

