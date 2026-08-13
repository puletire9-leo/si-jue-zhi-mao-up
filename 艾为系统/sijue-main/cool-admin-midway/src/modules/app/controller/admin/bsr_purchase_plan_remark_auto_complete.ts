import { BaseController, CoolController } from '@cool-midway/core';
import { Body, Inject, Post } from '@midwayjs/core';
import { AppBsrPurchasePlanRemarkAutoCompleteService } from '../../service/bsr_purchase_plan_remark_auto_complete';

/**
 * 采购计划备注自动补全调试接口。
 * 只做解析和草稿预览，不写 analysis_record / snapshot。
 */
@CoolController('/admin/app/bsr_purchase_plan_remark_auto_complete')
export class AdminAppBsrPurchasePlanRemarkAutoCompleteController extends BaseController {
  @Inject()
  remarkAutoCompleteService: AppBsrPurchasePlanRemarkAutoCompleteService;

  @Post('/preview')
  async preview(@Body() body: any) {
    try {
      const result = await this.remarkAutoCompleteService.preview(body || {});
      return this.ok(result);
    } catch (e: any) {
      return this.fail(e?.message || '备注解析预览失败');
    }
  }

  @Post('/searchPlans')
  async searchPlans(@Body() body: any) {
    try {
      const result = await this.remarkAutoCompleteService.searchPlans(body || {});
      return this.ok(result);
    } catch (e: any) {
      return this.fail(e?.message || '采购计划搜索失败');
    }
  }

  @Post('/searchOrders')
  async searchOrders(@Body() body: any) {
    try {
      const result = await this.remarkAutoCompleteService.searchOrders(body || {});
      return this.ok(result);
    } catch (e: any) {
      return this.fail(e?.message || '采购单搜索失败');
    }
  }

  @Post('/orderContext')
  async orderContext(@Body() body: any) {
    try {
      const result = await this.remarkAutoCompleteService.orderContext(body || {});
      return this.ok(result);
    } catch (e: any) {
      return this.fail(e?.message || '采购单上下文读取失败');
    }
  }

  @Post('/statusPage')
  async statusPage(@Body() body: any) {
    try {
      const result = await this.remarkAutoCompleteService.statusPage(body || {});
      return this.ok(result);
    } catch (e: any) {
      return this.fail(e?.message || '自动补全状态查询失败');
    }
  }

  @Post('/statusStats')
  async statusStats(@Body() body: any) {
    try {
      const result = await this.remarkAutoCompleteService.statusStats(body || {});
      return this.ok(result);
    } catch (e: any) {
      return this.fail(e?.message || '自动补全状态统计失败');
    }
  }

  @Post('/statusDetail')
  async statusDetail(@Body() body: any) {
    try {
      const result = await this.remarkAutoCompleteService.statusDetail(body || {});
      return this.ok(result);
    } catch (e: any) {
      return this.fail(e?.message || '自动补全详情查询失败');
    }
  }
}
