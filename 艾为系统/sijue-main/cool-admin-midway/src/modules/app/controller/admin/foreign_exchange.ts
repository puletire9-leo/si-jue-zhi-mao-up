import {CoolController, BaseController} from '@cool-midway/core';
import updateWithoutAmendingCreateTime from "../../mixin/updateWithoutAmendingCreateTime";
import {Context} from "@midwayjs/koa";
import {Configuration, App, Inject, Get} from '@midwayjs/decorator';
import {Body, Post} from "@midwayjs/decorator";
import { get } from 'http';
import {AppAmzFXService} from "../../service/foreign_exchange";
import { post } from '../../utils/lingxing/openapi-node-sdk/request';

@CoolController()
@updateWithoutAmendingCreateTime
export class AdminAppAmzForeignExchangeController extends BaseController {

  @Inject()
  ctx: Context;

  @Inject()
  appAmzFXService:AppAmzFXService
  
    @Post('/getExchangeRate')
    async syncExchangeRate() {
        const data = await this.appAmzFXService.getExchangeRate();
        return data;  // 返回 data 给前端
    }
  
}
