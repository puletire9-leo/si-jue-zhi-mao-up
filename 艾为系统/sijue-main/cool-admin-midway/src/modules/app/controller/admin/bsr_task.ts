import {CoolController, BaseController} from '@cool-midway/core';
import {Body, Inject, Post} from '@midwayjs/core';
import {AppAmzBsrTaskEntity} from '../../entity/bsr_task';
import {AppAmzBsrTaskService} from '../../service/bsr_task';
import {appConfig} from "../../../../appConfig";
import {InjectEntityModel} from "@midwayjs/typeorm";
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import { Provide } from "@midwayjs/decorator";
import { In, Repository } from "typeorm";
import {Context} from "@midwayjs/koa";

@CoolController({
  api: ['add', 'delete', 'update', 'info', 'list', 'page'],
  entity: AppAmzBsrTaskEntity,
  pageQueryOp: {
      keyWordLikeFields: [
        'remark',
          'bsr_link',
          'category',
      ],
      fieldEq: ['status','marketplace', 'delivery_type'],
      where: async (ctx: Context) => {
          let { username, roleIds } = ctx.admin;
          let whereOptions = [];
          if (username!== 'admin') {
              // 权限ID到marketplace集合的映射
              const roleMarketplaceMap = {
                  12: ['美国'],
                  13: ['英国'],
                  14: ['德国']
              };
              let allMarketplaces = [];
              roleIds.forEach(roleId => {
                  if (roleMarketplaceMap[roleId]) {
                      allMarketplaces = allMarketplaces.concat(roleMarketplaceMap[roleId]);
                  }
              });
              if (allMarketplaces.length > 0) {
                  let placeholders = allMarketplaces.map(() => '?').join(',');
                  if (roleIds.length === 2 && roleIds.includes(12) && roleIds.includes(13)) {
                      let orPlaceholders = allMarketplaces.map((_, index) => `marketplace =?`).join(' OR ');
                      whereOptions.push([`(${orPlaceholders})`, allMarketplaces]);
                  } else {
                      whereOptions.push([`marketplace IN (${placeholders})`, allMarketplaces]);
                  }
              }
          }
          return whereOptions;
      }
  }
})


@Provide()
@updateWithoutAmendingCreateTime
export class AdminAppAmzBsrTaskController extends BaseController {
  @Inject()
  AppAmzBsrTaskService: AppAmzBsrTaskService;

  @InjectEntityModel(AppAmzBsrTaskEntity)
  bsrTaskRepo: Repository<AppAmzBsrTaskEntity>;

  @Inject()
  ctx: Context;
  
  async add() {
    // @ts-ignore
    const body: AppAmzBsrTaskEntity = this.baseCtx.request?.body;

    if (!body.bsr_link?.trim()) {
      return this.fail('榜单链接为空，添加任务失败');
    }

    let tasks = body.bsr_link
      .split('\n')
      .filter(link => link.trim())
      // .filter(link => link.startsWith('http') && link.indexOf('amazon') > 0)
      .map(link => {
        let task = new AppAmzBsrTaskEntity();
        Object.assign(task, body);
        task.bsr_link = link.trim();
        task.marketplace = appConfig.SITE_CODE.BR.zh;
        for (const site in appConfig.AMAZON_I18N.MAIN) {
          if (link.indexOf(appConfig.AMAZON_I18N.MAIN[site]) >= 0) {
            task.marketplace = appConfig.SITE_CODE[site]?.zh;
          }
        }

        return task;
      });

    return this.ok(await this.service.add(tasks));
  }

  @Post('/set_all_status_pending')
  async set_all_status_pending() {
      // let roleIds = this.ctx.admin.roleIds
      // const roleMarketplaceMap = {12: ['美国'],13: ['英国'],14: ['德国']};
      // let allMarketplaces = [];
      // console.log(this.ctx.admin.roleIds);
      // roleIds.forEach(roleId => {
      //   if (roleMarketplaceMap[roleId]) {
      //       allMarketplaces = allMarketplaces.concat(roleMarketplaceMap[roleId]);
      //       console.log(allMarketplaces);
      //   }
    //  });
      await this.bsrTaskRepo.update({}, {status: appConfig.BSR_TASK_STATUS.CREATED.value});
      return this.ok('执行完毕。');
  }

  @Post("/deleteByIds")
  async deleteByIds(@Body() { ids }: { ids: number[] }) {
    await this.AppAmzBsrTaskService.deleteByIds(ids); 
  }
}
