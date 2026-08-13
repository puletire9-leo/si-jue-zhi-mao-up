import {BaseService} from '@cool-midway/core';
import {Provide} from '@midwayjs/decorator';
import {InjectEntityModel} from '@midwayjs/typeorm';
import {In, Repository} from 'typeorm';
import {BaseSysRoleEntity} from "../../base/entity/sys/role";
import {BaseSysUserEntity} from "../../base/entity/sys/user";


@Provide()
export class AppAnyService extends BaseService {
  @InjectEntityModel(BaseSysRoleEntity)
  baseSysRoleRepo: Repository<BaseSysRoleEntity>;

  @InjectEntityModel(BaseSysUserEntity)
  baseSysUserRepo: Repository<BaseSysUserEntity>;

  async getSidsByRoles(roleIds: number[]) {
    let roles = await this.baseSysRoleRepo.findBy({id: In(roleIds || [])});

    let sids = [];
    roles.forEach(role => {
      sids = sids.concat(role.sidList ?? []);
    });
    sids = Array.from(new Set(sids));

    return sids;
  }

  async getSidsByUserId(userId: number) {
    let user = await this.baseSysUserRepo.findOneBy({id: userId});
    return user?.sidList || [];
  }
}
