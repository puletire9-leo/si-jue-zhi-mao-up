import {Provide} from '@midwayjs/decorator';
import {BaseService} from '@cool-midway/core';
import {InjectEntityModel} from '@midwayjs/typeorm';
import {Repository} from 'typeorm';
import {AppAmzBsrCandidateCompetitorCustomizeEntity} from "../entity/bsr_candidate_competitor_customize";

@Provide()
export class AppAmzBsrCandidateCompetitorCustomizeService extends BaseService {
  @InjectEntityModel(AppAmzBsrCandidateCompetitorCustomizeEntity)
  bsrCandidateCompetitorRepo: Repository<AppAmzBsrCandidateCompetitorCustomizeEntity>;

}

