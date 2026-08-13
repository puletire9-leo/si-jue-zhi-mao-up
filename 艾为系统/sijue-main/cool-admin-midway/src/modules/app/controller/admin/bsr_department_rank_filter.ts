import {CoolController, BaseController} from '@cool-midway/core';
import {AppAmzDepartmentRankFilterEntity} from "../../entity/bsr_department_rank_filter";
import {InjectEntityModel} from "@midwayjs/typeorm";
import {Repository} from "typeorm";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzDepartmentRankFilterEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'department',
    ],
    fieldEq: [
      'marketplace',
    ],
  }
})
@updateWithoutAmendingCreateTime
export class AdminAppAmzDepartmentRankFilterController extends BaseController {
  @InjectEntityModel(AppAmzDepartmentRankFilterEntity)
  deptRankFilterRepo: Repository<AppAmzDepartmentRankFilterEntity>;
}
