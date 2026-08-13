import {Provide, Query} from '@midwayjs/decorator';
import {BaseService} from '@cool-midway/core';
import {InjectEntityModel} from '@midwayjs/typeorm';
import {Repository} from 'typeorm';
import {AppAmzDepartmentRankFilterEntity} from "../entity/bsr_department_rank_filter";
import {appConfig} from "../../../appConfig";

@Provide()
export class AppAmzDepartmentRankFilterService extends BaseService {
  @InjectEntityModel(AppAmzDepartmentRankFilterEntity)
  deptRankFilterRepo: Repository<AppAmzDepartmentRankFilterEntity>;

  async getDepartmentRankFilters(marketplace: string) {
    marketplace = appConfig.normalize_marketplace_code(marketplace);
    return this.deptRankFilterRepo.find({where: {marketplace}});
  }
}
