import { BaseService } from '@cool-midway/core';
import { Provide } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AppSellerspriteApiLogEntity } from '../entity/sellersprite_api_log';
import { AppSifApiLogEntity } from '../entity/sif_api_log';
import { AppBaiduTranslateApiLogEntity } from '../entity/baidu_translate_api_log';
import { AppOxylabsApiLogEntity } from '../entity/oxylabs_api_log';

/**
 * API用量统计服务
 */
@Provide()
export class AppApiUsageService extends BaseService {
	@InjectEntityModel(AppSellerspriteApiLogEntity)
	sellerspriteLogRepo: Repository<AppSellerspriteApiLogEntity>;

	@InjectEntityModel(AppSifApiLogEntity)
	sifLogRepo: Repository<AppSifApiLogEntity>;

	@InjectEntityModel(AppBaiduTranslateApiLogEntity)
	baiduLogRepo: Repository<AppBaiduTranslateApiLogEntity>;

	@InjectEntityModel(AppOxylabsApiLogEntity)
	oxylabsLogRepo: Repository<AppOxylabsApiLogEntity>;

	/**
	 * 获取总览数据
	 */
	async getOverview() {
		const today = new Date().toISOString().split('T')[0];

		// 卖家精灵统计
		const sellerspriteTotal = await this.sellerspriteLogRepo.count();
		const sellerspriteToday = await this.sellerspriteLogRepo.count({
			where: { call_date: today }
		});

		// SIF统计
		const sifTotal = await this.sifLogRepo.count();
		const sifToday = await this.sifLogRepo.count({
			where: { call_date: today }
		});

		// 百度翻译统计
		const baiduTotal = await this.baiduLogRepo.count();
		const baiduToday = await this.baiduLogRepo.count({
			where: { call_date: today }
		});

		// Oxylabs统计
		const oxylabsTotal = await this.oxylabsLogRepo.count();
		const oxylabsToday = await this.oxylabsLogRepo.count({
			where: { call_date: today }
		});

		return {
			sellersprite: {
				totalCalls: sellerspriteTotal,
				todayCalls: sellerspriteToday
			},
			sif: {
				totalCalls: sifTotal,
				todayCalls: sifToday
			},
			baidu: {
				totalCalls: baiduTotal,
				todayCalls: baiduToday
			},
			oxylabs: {
				totalCalls: oxylabsTotal,
				todayCalls: oxylabsToday
			}
		};
	}

	/**
	 * 获取卖家精灵日志
	 */
	async getSellerspriteLogs(options?: any) {
		const { limit = 100, offset = 0, ...filters } = options || {};

		const queryBuilder = this.sellerspriteLogRepo.createQueryBuilder('log');

		// 添加过滤条件
		if (filters.call_date) {
			queryBuilder.andWhere('log.call_date = :call_date', { call_date: filters.call_date });
		}
		if (filters.api_path) {
			queryBuilder.andWhere('log.api_path LIKE :api_path', { api_path: `%${filters.api_path}%` });
		}
		if (filters.country) {
			queryBuilder.andWhere('log.country = :country', { country: filters.country });
		}
		if (filters.is_success !== undefined) {
			queryBuilder.andWhere('log.is_success = :is_success', { is_success: filters.is_success });
		}

		queryBuilder.orderBy('log.createTime', 'DESC');
		queryBuilder.limit(limit);
		queryBuilder.offset(offset);

		const [items, total] = await queryBuilder.getManyAndCount();

		return {
			items,
			total,
			limit,
			offset
		};
	}

	/**
	 * 获取SIF日志
	 */
	async getSifLogs(options?: any) {
		const { limit = 100, offset = 0, ...filters } = options || {};

		const queryBuilder = this.sifLogRepo.createQueryBuilder('log');

		// 添加过滤条件
		if (filters.call_date) {
			queryBuilder.andWhere('log.call_date = :call_date', { call_date: filters.call_date });
		}
		if (filters.api_path) {
			queryBuilder.andWhere('log.api_path LIKE :api_path', { api_path: `%${filters.api_path}%` });
		}
		if (filters.country) {
			queryBuilder.andWhere('log.country = :country', { country: filters.country });
		}
		if (filters.is_success !== undefined) {
			queryBuilder.andWhere('log.is_success = :is_success', { is_success: filters.is_success });
		}

		queryBuilder.orderBy('log.createTime', 'DESC');
		queryBuilder.limit(limit);
		queryBuilder.offset(offset);

		const [items, total] = await queryBuilder.getManyAndCount();

		return {
			items,
			total,
			limit,
			offset
		};
	}

	/**
	 * 获取百度翻译日志
	 */
	async getBaiduLogs(options?: any) {
		const { limit = 100, offset = 0, ...filters } = options || {};

		const queryBuilder = this.baiduLogRepo.createQueryBuilder('log');

		// 添加过滤条件
		if (filters.call_date) {
			queryBuilder.andWhere('log.call_date = :call_date', { call_date: filters.call_date });
		}
		if (filters.api_path) {
			queryBuilder.andWhere('log.api_path LIKE :api_path', { api_path: `%${filters.api_path}%` });
		}
		if (filters.is_success !== undefined) {
			queryBuilder.andWhere('log.is_success = :is_success', { is_success: filters.is_success });
		}

		queryBuilder.orderBy('log.createTime', 'DESC');
		queryBuilder.limit(limit);
		queryBuilder.offset(offset);

		const [items, total] = await queryBuilder.getManyAndCount();

		return {
			items,
			total,
			limit,
			offset
		};
	}

	/**
	 * 获取Oxylabs日志
	 */
	async getOxylabsLogs(options?: any) {
		const { limit = 100, offset = 0, ...filters } = options || {};

		const queryBuilder = this.oxylabsLogRepo.createQueryBuilder('log');

		// 添加过滤条件
		if (filters.call_date) {
			queryBuilder.andWhere('log.call_date = :call_date', { call_date: filters.call_date });
		}
		if (filters.api_path) {
			queryBuilder.andWhere('log.api_path LIKE :api_path', { api_path: `%${filters.api_path}%` });
		}
		if (filters.country) {
			queryBuilder.andWhere('log.country = :country', { country: filters.country });
		}
		if (filters.is_success !== undefined) {
			queryBuilder.andWhere('log.is_success = :is_success', { is_success: filters.is_success });
		}

		queryBuilder.orderBy('log.createTime', 'DESC');
		queryBuilder.limit(limit);
		queryBuilder.offset(offset);

		const [items, total] = await queryBuilder.getManyAndCount();

		return {
			items,
			total,
			limit,
			offset
		};
	}

	/**
	 * 获取API调用统计（按日期分组）
	 */
	async getApiCallStatsByDate(apiType: string, startDate: string, endDate: string) {
		let repo: Repository<any>;

		switch (apiType) {
			case 'sellersprite':
				repo = this.sellerspriteLogRepo;
				break;
			case 'sif':
				repo = this.sifLogRepo;
				break;
			case 'baidu':
				repo = this.baiduLogRepo;
				break;
			case 'oxylabs':
				repo = this.oxylabsLogRepo;
				break;
			default:
				throw new Error('Invalid API type');
		}

		const result = await repo
			.createQueryBuilder('log')
			.select('log.call_date', 'date')
			.addSelect('COUNT(*)', 'count')
			.addSelect('SUM(log.credit_count)', 'totalCredits')
			.addSelect('SUM(CASE WHEN log.is_success = 1 THEN 1 ELSE 0 END)', 'successCount')
			.addSelect('SUM(CASE WHEN log.is_success = 0 THEN 1 ELSE 0 END)', 'failCount')
			.where('log.call_date >= :startDate', { startDate })
			.andWhere('log.call_date <= :endDate', { endDate })
			.groupBy('log.call_date')
			.orderBy('log.call_date', 'DESC')
			.getRawMany();

		return result;
	}

	/**
	 * 获取API调用统计（按接口路径分组）
	 */
	async getApiCallStatsByPath(apiType: string, startDate?: string, endDate?: string) {
		let repo: Repository<any>;

		switch (apiType) {
			case 'sellersprite':
				repo = this.sellerspriteLogRepo;
				break;
			case 'sif':
				repo = this.sifLogRepo;
				break;
			case 'baidu':
				repo = this.baiduLogRepo;
				break;
			case 'oxylabs':
				repo = this.oxylabsLogRepo;
				break;
			default:
				throw new Error('Invalid API type');
		}

		const queryBuilder = repo.createQueryBuilder('log');

		queryBuilder
			.select('log.api_path', 'apiPath')
			.addSelect('COUNT(*)', 'count')
			.addSelect('SUM(log.credit_count)', 'totalCredits')
			.addSelect('AVG(log.duration_ms)', 'avgDuration');

		if (startDate && endDate) {
			queryBuilder.where('log.call_date >= :startDate', { startDate });
			queryBuilder.andWhere('log.call_date <= :endDate', { endDate });
		}

		const result = await queryBuilder.groupBy('log.api_path').orderBy('count', 'DESC').getRawMany();

			return result;
		}
		

		/**
		 * 卖家精灵调用统计（按 caller + call_location 聚合），前端分组展示用
		 */
		/**
		 * SIF调用统计（按 caller + call_date + api_path + country 聚合）
		 */
		async getSifCallStats(options?: any) {
			const { startDate, endDate, caller } = options || {};
			const qb = this.sifLogRepo.createQueryBuilder('log');
			qb.select('log.caller', 'caller')
				.addSelect('log.call_date', 'call_date')
				.addSelect('log.api_path', 'api_path')
				.addSelect('log.country', 'country')
				.addSelect('COUNT(*)', 'call_count')
				.addSelect('SUM(log.credit_count)', 'total_credits')
				.addSelect('SUM(log.keyword_count)', 'total_keywords')
				.addSelect('SUM(log.asin_count)', 'total_asins')
				.addSelect('ROUND(AVG(log.duration_ms), 0)', 'avg_duration')
				.addSelect('SUM(CASE WHEN log.is_success = 1 THEN 1 ELSE 0 END)', 'success_count')
				.addSelect('SUM(CASE WHEN log.is_success = 0 THEN 1 ELSE 0 END)', 'fail_count');

			if (startDate) qb.andWhere('log.call_date >= :startDate', { startDate });
			if (endDate) qb.andWhere('log.call_date <= :endDate', { endDate });
			if (caller) qb.andWhere('log.caller = :caller', { caller });

			return qb.groupBy('log.caller').addGroupBy('log.call_date')
				.addGroupBy('log.api_path').addGroupBy('log.country')
				.orderBy('log.call_date', 'DESC').addOrderBy('call_count', 'DESC')
				.getRawMany();
		}

		/**
		 * SIF分组详情（点击展开时用，带分页）
		 */
		async getSifDetailLogs(options?: any) {
			const { call_date, caller, api_path, country, page = 1, pageSize = 50 } = options || {};
			const qb = this.sifLogRepo.createQueryBuilder('log');
			if (call_date) qb.andWhere('log.call_date = :call_date', { call_date });
			if (caller) qb.andWhere('log.caller = :caller', { caller });
			if (api_path) qb.andWhere('log.api_path = :api_path', { api_path });
			if (country) qb.andWhere('log.country = :country', { country });

			qb.orderBy('log.createTime', 'DESC').skip((page - 1) * pageSize).take(pageSize);
			const [items, total] = await qb.getManyAndCount();
			return { items, total, page, pageSize };
		}

		async getSellerspriteCallStats(options?: any) {
			const { startDate, endDate, caller, call_location } = options || {};
			const qb = this.sellerspriteLogRepo.createQueryBuilder('log');
			qb.select('log.caller', 'caller')
				.addSelect('log.call_location', 'call_location')
				.addSelect('log.call_date', 'call_date')
				.addSelect('log.api_path', 'api_path')
				.addSelect('log.country', 'country')
				.addSelect('COUNT(*)', 'call_count')
				.addSelect('SUM(log.credit_count)', 'total_credits')
				.addSelect('ROUND(AVG(log.duration_ms), 0)', 'avg_duration')
				.addSelect('SUM(CASE WHEN log.is_success = 1 THEN 1 ELSE 0 END)', 'success_count')
				.addSelect('SUM(CASE WHEN log.is_success = 0 THEN 1 ELSE 0 END)', 'fail_count');

			if (startDate) qb.andWhere('log.call_date >= :startDate', { startDate });
			if (endDate) qb.andWhere('log.call_date <= :endDate', { endDate });
			if (caller) qb.andWhere('log.caller LIKE :caller', { caller  });
			if (call_location) qb.andWhere('log.call_location LIKE :call_location', { call_location  });

			return qb.groupBy('log.caller').addGroupBy('log.call_location').addGroupBy('log.call_date')
				.addGroupBy('log.api_path').addGroupBy('log.country')
				.orderBy('log.call_date', 'DESC').addOrderBy('call_count', 'DESC')
				.getRawMany();
		}

		/**
		 * 分组详情（点击展开时用，带分页）
		 */
		async getSellerspriteDetailLogs(options?: any) {
			const { call_date, caller, call_location, api_path, country, page = 1, pageSize = 50 } = options || {};
			const qb = this.sellerspriteLogRepo.createQueryBuilder('log');
			if (call_date) qb.andWhere('log.call_date = :call_date', { call_date });
			if (caller) qb.andWhere('log.caller = :caller', { caller });
			if (call_location) qb.andWhere('log.call_location = :call_location', { call_location });
			if (api_path) qb.andWhere('log.api_path = :api_path', { api_path });
			if (country) qb.andWhere('log.country = :country', { country });

			qb.orderBy('log.createTime', 'DESC').skip((page - 1) * pageSize).take(pageSize);
			const [items, total] = await qb.getManyAndCount();
			return { items, total, page, pageSize };
		}
	}

