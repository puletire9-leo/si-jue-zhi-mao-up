import { BaseController, CoolController } from '@cool-midway/core';
import { Body, Inject, Post } from '@midwayjs/decorator';
import { AppAmzBsrPurchaseOrderLogisticsPackageEntity } from '../../entity/bsr_purchase_order_logistics_package';
import { AppBsrLogisticsConfigService } from '../../service/bsr_logistics_config';

/**
 * 物流工作台
 */
@CoolController({
  api: [],
  entity: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
})
export class AdminAppBsrLogisticsConfigController extends BaseController {
  @Inject()
  logisticsConfigService: AppBsrLogisticsConfigService;

  @Post('/kuaidi100Config', { summary: '获取快递100接口配置' })
  async kuaidi100Config() {
    return this.ok(await this.logisticsConfigService.getKuaidi100Config());
  }

  @Post('/saveKuaidi100Config', { summary: '保存快递100接口配置' })
  async saveKuaidi100Config(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.saveKuaidi100Config(body));
  }

  @Post('/dashboard', { summary: '物流工作台概览' })
  async dashboard(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getDashboard(body));
  }

  @Post('/packages', { summary: '采购物流包裹列表' })
  async packages(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getPackages(body));
  }

  @Post('/packageCounts', { summary: '采购物流包裹状态数量' })
  async packageCounts(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getPackageCounts(body));
  }

  @Post('/identifyPackage', { summary: '智能识别一个物流包裹' })
  async identifyPackage(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.identifyPackage(body));
  }

  @Post('/exceptionRules', { summary: '物流例外规则列表' })
  async exceptionRules(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getExceptionRules(body));
  }

  @Post('/saveExceptionRule', { summary: '保存物流例外规则' })
  async saveExceptionRule(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.saveExceptionRule(body));
  }

  @Post('/rawCompanyOptions', { summary: '系统原始物流公司选项' })
  async rawCompanyOptions(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getRawCompanyOptions(body));
  }

  @Post('/testQueryPackage', { summary: '测试查询一个物流包裹' })
  async testQueryPackage(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.testQueryPackage(body));
  }

  @Post('/batchQueryPackages', { summary: '批量手动查询物流包裹' })
  async batchQueryPackages(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.batchQueryPackages(body));
  }

  @Post('/updatePackagePhone', { summary: '填写/修改物流包裹手机号' })
  async updatePackagePhone(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.updatePackagePhone(body));
  }

  @Post('/updatePackageCompany', { summary: '人工修改包裹快递100编码' })
  async updatePackageCompany(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.updatePackageCompany(body));
  }

  @Post('/packageQueryLogs', { summary: '物流包裹调用日志' })
  async packageQueryLogs(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getPackageQueryLogs(body));
  }

  @Post('/queryStats', { summary: '快递100调用统计' })
  async queryStats(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getQueryStats(body));
  }

  @Post('/syncWarehousesFromLingxing', { summary: '从领星同步仓库快照' })
  async syncWarehousesFromLingxing() {
    return this.ok(await this.logisticsConfigService.syncWarehousesFromLingxing());
  }

  @Post('/warehouses', { summary: '本地物流仓库列表' })
  async warehouses(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getWarehouses(body));
  }

  @Post('/warehouseContacts', { summary: '仓库联系人列表' })
  async warehouseContacts(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getWarehouseContacts(body));
  }

  @Post('/contacts', { summary: '物流联系人列表' })
  async contacts(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getContacts(body));
  }

  @Post('/saveContact', { summary: '保存物流联系人' })
  async saveContact(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.saveContact(body));
  }

  @Post('/deleteContact', { summary: '停用物流联系人' })
  async deleteContact(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.deleteContact(body));
  }

  @Post('/contactWarehouses', { summary: '联系人绑定仓库列表' })
  async contactWarehouses(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getContactWarehouses(body));
  }

  @Post('/bindContactWarehouses', { summary: '联系人批量绑定仓库' })
  async bindContactWarehouses(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.bindContactWarehouses(body));
  }

  @Post('/saveWarehouseContact', { summary: '保存仓库联系人' })
  async saveWarehouseContact(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.saveWarehouseContact(body));
  }

  @Post('/deleteWarehouseContact', { summary: '删除仓库联系人' })
  async deleteWarehouseContact(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.deleteWarehouseContact(body));
  }

  @Post('/carrierPhoneRules', { summary: '快递手机号规则列表' })
  async carrierPhoneRules(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getCarrierPhoneRules(body));
  }

  @Post('/carrierPhoneRuleOptions', { summary: '快递手机号规则快递选项' })
  async carrierPhoneRuleOptions(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getCarrierPhoneRuleOptions(body));
  }

  @Post('/saveCarrierPhoneRule', { summary: '保存快递手机号规则' })
  async saveCarrierPhoneRule(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.saveCarrierPhoneRule(body));
  }

  @Post('/phoneMatchAttempts', { summary: '包裹手机号匹配尝试日志' })
  async phoneMatchAttempts(@Body() body: any) {
    return this.ok(await this.logisticsConfigService.getPhoneMatchAttempts(body));
  }

}
