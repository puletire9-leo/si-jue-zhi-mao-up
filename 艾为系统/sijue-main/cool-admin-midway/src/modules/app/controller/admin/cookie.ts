import {CoolController, BaseController, CoolUrlTag, TagTypes, CoolTag} from '@cool-midway/core';
import {AppAmzCookieEntity} from '../../entity/cookie';
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzCookieEntity,
  pageQueryOp: {
    keyWordLikeFields: ['site', 'email', 'username', 'remark'],
    fieldEq: ['isValid'],
  }
})
@updateWithoutAmendingCreateTime
export class AppAmzCookiesController extends BaseController {
}
