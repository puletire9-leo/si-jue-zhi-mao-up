import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseSysUserEntity } from '../../entity/sys/user';
import { BaseSysPermsService } from './perms';
import * as _ from 'lodash';
import { BaseSysUserRoleEntity } from '../../entity/sys/user_role';
import { BaseSysRoleEntity } from '../../entity/sys/role';
import * as md5 from 'md5';
import { BaseSysDepartmentEntity } from '../../entity/sys/department';
import { CacheManager } from '@midwayjs/cache';

/**
 * 系统用户
 */
@Provide()
export class BaseSysUserService extends BaseService {
  @InjectEntityModel(BaseSysUserEntity)
  baseSysUserEntity: Repository<BaseSysUserEntity>;

  @InjectEntityModel(BaseSysUserRoleEntity)
  baseSysUserRoleEntity: Repository<BaseSysUserRoleEntity>;

  @InjectEntityModel(BaseSysRoleEntity)
  baseSysRoleEntity: Repository<BaseSysRoleEntity>;

  @InjectEntityModel(BaseSysDepartmentEntity)
  baseSysDepartmentEntity: Repository<BaseSysDepartmentEntity>;

  @Inject()
  cacheManager: CacheManager;

  @Inject()
  baseSysPermsService: BaseSysPermsService;

  @Inject()
  ctx;

  /**
   * 分页查询
   * @param query
   */
  async page(query) {
    const { id, keyWord, status, departmentIds = [], onlyUnassigned } =
      query;
    const idList =
      Array.isArray(id)
        ? id
        : typeof id === 'string' && id.includes(',')
        ? id
            .split(',')
            .map(item => item.trim())
            .filter(item => item !== '')
        : null;
    const hasIdList = Array.isArray(idList) && idList.length > 0;
    const hasId = (id || id === 0) && !hasIdList;
    const permsDepartmentArr = await this.baseSysPermsService.departmentIds(
      this.ctx.admin.userId
    ); // 部门权限
    const sql = `
        SELECT
            a.id,a.name,a.nickName,a.headImg,a.email,a.remark,a.status,a.createTime,a.updateTime,a.username,a.phone,a.departmentId,
            a.operation_country_scope,
            a.sidList, /* 因业务逻辑需要，查询该自行添加的字段 */
            b.name as "departmentName"
        FROM
            base_sys_user a
            LEFT JOIN base_sys_department b on a.departmentId = b.id
        WHERE 1 = 1
            ${this.setSql(onlyUnassigned, 'and a.departmentId IS NULL', [])}
            ${this.setSql(
              !onlyUnassigned && !_.isEmpty(departmentIds),
              'and a.departmentId in (?)',
              [departmentIds]
            )}
            ${this.setSql(hasIdList, 'and a.id in (?)', [idList])}
            ${this.setSql(hasId, 'and a.id = ?', [id])}
            ${this.setSql(status, 'and a.status = ?', [status])}
            ${this.setSql(keyWord, 'and (a.name LIKE ? or a.username LIKE ?)', [
              `%${keyWord}%`,
              `%${keyWord}%`,
            ])}
            ${this.setSql(true, 'and a.username != ?', ['admin'])}
            ${this.setSql(
              this.ctx.admin.username !== 'admin',
              'and a.departmentId in (?)',
              [!_.isEmpty(permsDepartmentArr) ? permsDepartmentArr : [null]]
            )} `;
    const result = await this.sqlRenderPage(sql, query);
    // 匹配角色
    if (!_.isEmpty(result.list)) {
      const userIds = result.list.map(e => e.id);
      const roles = await this.nativeQuery(
        'SELECT b.name, a.userId FROM base_sys_user_role a LEFT JOIN base_sys_role b ON a.roleId = b.id WHERE a.userId in (?) ',
        [userIds]
      );
      result.list.forEach(e => {
        e['roleName'] = roles
          .filter(role => role.userId == e.id)
          .map(role => role.name)
          .join(',');
      });
    }
    return result;
  }

  /**
   * 移动部门
   * @param departmentId
   * @param userIds
   */
  async move(departmentId, userIds) {
    await this.baseSysUserEntity.update({ id: In(userIds) }, { departmentId });
  }

  /**
   * 获得个人信息
   */
  async person() {
    const info = await this.baseSysUserEntity.findOneBy({
      id: this.ctx.admin?.userId,
    });
    delete info?.password;
    if (info) {
      const roleIdList = Array.isArray(this.ctx.admin?.roleIds)
        ? this.ctx.admin.roleIds.map(id => Number(id))
        : [];
      info.roleIdList = roleIdList;
      if (roleIdList.length > 0) {
        const roles = await this.baseSysRoleEntity.find({
          where: { id: In(roleIdList) },
          select: ['id', 'name', 'label'],
        });
        const roleNames = roles
          .map(role => String(role.name || '').trim())
          .filter(Boolean);
        const roleLabels = roles
          .map(role => String(role.label || '').trim())
          .filter(Boolean);
        const roleValues = [...roleNames, ...roleLabels];
        (info as any).roleName = roleNames.join(',');
        (info as any).roleLabels = roleLabels;
        (info as any).isDeveloper =
          roleValues.some(value => value === '开发' || value.toLowerCase() === 'developer');
      }
    }
    return info;
  }

  /**
   * 更新用户角色关系
   * @param user
   */
  async updateUserRole(user) {
    if (_.isEmpty(user.roleIdList)) {
      return;
    }
    if (user.username === 'admin') {
      throw new CoolCommException('非法操作~');
    }
    await this.baseSysUserRoleEntity.delete({ userId: user.id });
    if (user.roleIdList) {
      for (const roleId of user.roleIdList) {
        await this.baseSysUserRoleEntity.save({ userId: user.id, roleId });
      }
    }
    await this.baseSysPermsService.refreshPerms(user.id);
  }

  /**
   * 新增
   * @param param
   */
  async add(param) {
    const exists = await this.baseSysUserEntity.findOneBy({
      username: param.username,
    });
    if (!_.isEmpty(exists)) {
      throw new CoolCommException('用户名已经存在~');
    }
    param.password = md5(param.password);
    await this.baseSysUserEntity.save(param);
    await this.updateUserRole(param);
    return param.id;
  }

  /**
   * 根据ID获得信息
   * @param id
   */
  public async info(id) {
    const info = await this.baseSysUserEntity.findOneBy({ id });
    const userRoles = await this.nativeQuery(
      'select a.roleId from base_sys_user_role a where a.userId = ?',
      [id]
    );
    const department = await this.baseSysDepartmentEntity.findOneBy({
      id: info.departmentId,
    });
    if (info) {
      delete info.password;
      if (userRoles) {
        info.roleIdList = userRoles.map(e => {
          return parseInt(e.roleId);
        });
      }
    }
    delete info.password;
    if (department) {
      info.departmentName = department.name;
    }
    return info;
  }

  /**
   * 修改个人信息
   * @param param
   */
  public async personUpdate(param) {
    param.id = this.ctx.admin.userId;
    if (!_.isEmpty(param.password)) {
      param.password = md5(param.password);
      const oldPassword = md5(param.oldPassword);
      const userInfo = await this.baseSysUserEntity.findOneBy({ id: param.id });
      if (!userInfo) {
        throw new CoolCommException('用户不存在');
      }
      if (oldPassword !== userInfo.password) {
        throw new CoolCommException('原密码错误');
      }
      param.passwordV = userInfo.passwordV + 1;
      await this.cacheManager.set(
        `admin:passwordVersion:${param.id}`,
        param.passwordV
      );
    } else {
      delete param.password;
    }
    await this.baseSysUserEntity.save(param);
  }

  /**
   * 修改
   * @param param 数据
   */
  async update(param) {
    try {
      console.log("11111111111");
      if (param.id && param.username === 'admin') {
        throw new CoolCommException('非法操作~');
      }
      if (!_.isEmpty(param.password)) {
        param.password = md5(param.password);
        const userInfo = await this.baseSysUserEntity.findOneBy({ id: param.id });
        if (!userInfo) {
          throw new CoolCommException('用户不存在');
        }
        param.passwordV = userInfo.passwordV + 1;
        await this.cacheManager.set(
          `admin:passwordVersion:${param.id}`,
          param.passwordV
        );
      } else {
        delete param.password;
      }
      if (param.status === 0) {
        await this.forbidden(param.id);
      }
      await this.baseSysUserEntity.save(param);
      await this.updateUserRole(param);
    } catch (err) {
      console.error("Error in update:", err);  // 打印详细的错误信息
      throw new CoolCommException('更新失败，参数错误或者手机号已存在');
    }
    
  }

  /**
   * 禁用用户
   * @param userId
   */
  async forbidden(userId) {
    await this.cacheManager.del(`admin:token:${userId}`);
  }
}
