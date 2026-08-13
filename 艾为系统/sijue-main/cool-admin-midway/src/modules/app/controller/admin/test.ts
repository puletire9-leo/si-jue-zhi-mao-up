import {BaseController, CoolController} from '@cool-midway/core';
import {InjectEntityModel} from "@midwayjs/typeorm";
import {Repository} from "typeorm";
import {App, Controller, Get, Inject} from "@midwayjs/decorator";
import {Application, Context} from "@midwayjs/koa";
import {CacheManager} from "@midwayjs/cache";
import {BaseSysParamEntity} from "../../../base/entity/sys/param";
import {AppAnyService} from '../../service/any';
import {BaseSysRoleService} from '../../../base/service/sys/role';
import {DictTypeEntity} from "../../../dict/entity/type";
import {appConfig} from "../../../../appConfig";

import {TacticRunner} from "../../biz_logic/TacticRunner";

@CoolController({})
export class OpenTestController extends BaseController {
  @App()
  app: Application;

  @Inject()
  ctx: Context;

  @Inject()
  cacheManager: CacheManager;

  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;

  @InjectEntityModel(DictTypeEntity)
  DictTypeRepo: Repository<DictTypeEntity>;

  @Inject()
  baseSysRoleService: BaseSysRoleService;

  @Inject()
  appAnyService: AppAnyService;

  @Inject()
  tacticRunner: TacticRunner;

  @Get('/testP1')
  async testP1() {
    await this.tacticRunner.executeTacticPriceP1();
    return this.ok('P1 strategy executed manually.');
  }

  @Get('/getSysParams')
  async getSysParams() {
    const param_appSecret = await this.baseSysParamRepo.find({where: {keyName: 'appSecret'}});
    console.log(param_appSecret);

    return this.ok(param_appSecret);
  }

  @Get('/getRoleSellerList')
  async getRoleSellerList() {
    const {userId, roleIds} = this.ctx.admin;


    let sids = await this.appAnyService.getSidsByRoles(roleIds);
    return this.ok(sids);
  }

  @Get('/getAppConfig')
  async getAppConfig() {
    return this.ok(appConfig);
  }
}
