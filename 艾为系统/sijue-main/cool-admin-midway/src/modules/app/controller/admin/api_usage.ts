import { BaseController, CoolController } from '@cool-midway/core';
import { Get, Inject } from '@midwayjs/decorator';
import { AppApiUsageService } from '../../service/api_usage';
import { Context } from "@midwayjs/koa";

/**
 * API用量统计控制器
 */
@CoolController({
	api: ['add', 'delete', 'update', 'info', 'list'],
	entity: null,
	service: AppApiUsageService
})
export class AppApiUsageController extends BaseController {
	@Inject()
	apiUsageService: AppApiUsageService;

	@Inject()
	ctx: Context;
	/**
	 * 获取总览数据
	 */
	@Get('/getOverview')
	async getOverview() {
		const result = await this.apiUsageService.getOverview();
		return this.ok(result);
	}

	/**
	 * 获取卖家精灵日志
	 */
	@Get('/getSellerspriteLogs')
	async getSellerspriteLogs() {
		const options = this.ctx.query;
		const result = await this.apiUsageService.getSellerspriteLogs(options);
		return this.ok(result);
	}

	/**
	 * 获取SIF日志
	 */
	@Get('/getSifLogs')
	async getSifLogs() {
		const options = this.ctx.query;
		const result = await this.apiUsageService.getSifLogs(options);
		return this.ok(result);
	}

	/**
	 * 获取百度翻译日志
	 */
	@Get('/getBaiduLogs')
	async getBaiduLogs() {
		const options = this.ctx.query;
		const result = await this.apiUsageService.getBaiduLogs(options);
		return this.ok(result);
	}

	/**
	 * 获取Oxylabs日志
	 */
	@Get('/getOxylabsLogs')
	async getOxylabsLogs() {
		const options = this.ctx.query;
		const result = await this.apiUsageService.getOxylabsLogs(options);
		return this.ok(result);
	}

	/**
	 * 获取API调用统计（按日期分组）
	 */
	@Get('/getApiCallStatsByDate')
	async getApiCallStatsByDate() {
		const { apiType, startDate, endDate } = this.ctx.query;
		const result = await this.apiUsageService.getApiCallStatsByDate(
			typeof apiType === 'string' ? apiType : apiType?.[0] || '',
			typeof startDate === 'string' ? startDate : startDate?.[0] || '',
			typeof endDate === 'string' ? endDate : endDate?.[0] || ''
		);
		return this.ok(result);
	}

	/**
	 * 获取API调用统计（按接口路径分组）
	 */
	@Get('/getApiCallStatsByPath')
	async getApiCallStatsByPath() {
		const { apiType, startDate, endDate } = this.ctx.query;
		const result = await this.apiUsageService.getApiCallStatsByPath(
			typeof apiType === 'string' ? apiType : apiType?.[0] || '',
			typeof startDate === 'string' ? startDate : startDate?.[0] || '',
			typeof endDate === 'string' ? endDate : endDate?.[0] || ''
		);
		return this.ok(result);
	}

	/**
	 * 卖家精灵调用统计（分组聚合）
	 */
	@Get('/getSellerspriteCallStats')
	async getSellerspriteCallStats() {
		const options = this.ctx.query;
		const result = await this.apiUsageService.getSellerspriteCallStats(options);
		return this.ok(result);
	}

	/**
	 * 卖家精灵分组详情（展开明细，带分页）
	 */
	@Get('/getSellerspriteDetailLogs')
	async getSellerspriteDetailLogs() {
		const options = this.ctx.query;
		const result = await this.apiUsageService.getSellerspriteDetailLogs(options);
		return this.ok(result);
	}

	/**
	 * SIF调用统计（分组聚合）
	 */
	@Get('/getSifCallStats')
	async getSifCallStats() {
		const options = this.ctx.query;
		const result = await this.apiUsageService.getSifCallStats(options);
		return this.ok(result);
	}

	/**
	 * SIF分组详情（展开明细，带分页）
	 */
	@Get('/getSifDetailLogs')
	async getSifDetailLogs() {
		const options = this.ctx.query;
		const result = await this.apiUsageService.getSifDetailLogs(options);
		return this.ok(result);
	}
}
