import { Body, Inject, Post, Provide } from '@midwayjs/decorator';
import { CoolController, BaseController } from '@cool-midway/core';
import { BaseSysUserRoleEntity } from '../../../entity/sys/user_role';

/**
 * 系统用户
 */
@Provide()
@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: BaseSysUserRoleEntity,
  pageQueryOp: {
    keyWordLikeFields: [
      'roleId'
    ],
    fieldEq: [
      'roleId'
    ],
  },
})
export class BaseSysUserRoleController extends BaseController {}
