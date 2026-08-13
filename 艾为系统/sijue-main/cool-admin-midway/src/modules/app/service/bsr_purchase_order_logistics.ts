import { BaseService } from '@cool-midway/core';
import { Inject, Provide } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import axios from 'axios';
import { createHash } from 'crypto';
import * as dayjs from 'dayjs';
import { In, Repository } from 'typeorm';
import { BaseSysParamService } from '../../base/service/sys/param';
import { AppAmzBsrLogisticsCarrierPhoneRuleEntity } from '../entity/bsr_logistics_carrier_phone_rule';
import { AppAmzBsrLogisticsContactEntity } from '../entity/bsr_logistics_contact';
import { AppAmzBsrLogisticsExceptionRuleEntity } from '../entity/bsr_logistics_exception_rule';
import { AppAmzBsrLogisticsPhoneMatchAttemptEntity } from '../entity/bsr_logistics_phone_match_attempt';
import { AppAmzBsrLogisticsQueryLogEntity } from '../entity/bsr_logistics_query_log';
import { AppAmzBsrLogisticsWarehouseContactEntity } from '../entity/bsr_logistics_warehouse_contact';
import { AppAmzBsrPurchaseOrderItemSyncLingxingEntity } from '../entity/bsr_purchase_order_item_sync_lingxing';
import { AppAmzBsrPurchaseOrderLogisticsPackageEntity } from '../entity/bsr_purchase_order_logistics_package';
import { AppAmzBsrPurchaseOrderSyncLingxingEntity } from '../entity/bsr_purchase_order_sync_lingxing';
import {
  KUAIDI100_CONFIG_KEY,
  Kuaidi100Config,
  normalizeKuaidi100ConfigForRuntime,
} from '../utils/kuaidi100/kuaidi100Config';
import { normalizeKuaidi100AutoNumberResult } from '../utils/kuaidi100/kuaidi100AutoNumber';
import {
  canQueryLogisticsPackage,
  deriveOrderLogisticsStatus,
  maskContactPhoneForViewer,
  normalizeCompanyName,
  normalizeKuaidi100PackageStatus,
  parseLogisticsTime,
  PURCHASE_ORDER_LOGISTICS_STATUS_TEXT,
  resolvePhoneStatus,
} from '../utils/logistics/purchaseOrderLogisticsRules';

type AdminUserSnapshot = {
  userId: number | null;
  username: string;
  nickname: string;
};

type LogisticsSourceItem = {
  trackingNo: string;
  sourcePolId: string;
  rawCompanyName: string;
  rawItem: any;
  exceptionRule: AppAmzBsrLogisticsExceptionRuleEntity | null;
};

type LogisticsSourceGroup = {
  trackingNo: string;
  sources: LogisticsSourceItem[];
};

type WarehouseSnapshot = {
  warehouse_wid: number | null;
  warehouse_name: string;
};

type AutoRefreshOrderPackagesOptions = {
  autoQueryIntervalMinutes?: number;
  maxPackages?: number;
  now?: Date;
};

type AutoRefreshOrderPackagesResult = {
  orderCount: number;
  packageCount: number;
  queriedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
};

type ScheduledRefreshUnsignedPackagesResult = {
  matchedPackageCount: number;
  scannedPackageCount: number;
  targetPackageCount: number;
  processedPackageCount: number;
  realQueryCount: number;
  skippedCount: number;
  cooldownCount: number;
  excludedCount: number;
  errorCount: number;
  reasons: Record<string, number>;
  errors: string[];
  limits: {
    maxPackagesPerRun: number;
    scanPageSize: number;
    autoQueryIntervalMinutes: number;
    dailyMaxPollQueries: number;
    failureCooldownMinutes: number;
    delayMs: number;
  };
  todayPollQueryCountBefore: number;
  todayPollQueryCountAfter: number;
};

type OrderLogisticsQuerySummary = {
  real_query_count: number;
  skipped_count: number;
  error_count: number;
  reasons: Record<string, number>;
};

type OrderLogisticsOverviewResult = {
  order_sn: string;
  query: boolean;
  include_packages: boolean;
  logistics_status: string;
  logistics_status_text: string;
  logistics_status_reason: string;
  package_count: number;
  signed_count: number;
  unsigned_count: number;
  logistics_pkg_count: number;
  logistics_signed_count: number;
  logistics_unsigned_count: number;
  can_query: boolean;
  query_hint: string;
  query_summary: OrderLogisticsQuerySummary;
  packages: any[];
};

type PackageUnifiedQueryAvailability = {
  allowed: boolean;
  reason: string;
  hint: string;
  next_query_after?: Date | null;
};

const DEFAULT_QUERY_INTERVAL_MINUTES = 45;
const DEFAULT_AUTO_QUERY_INTERVAL_MINUTES = 120;
const DEFAULT_AUTO_REFRESH_MAX_PACKAGES = 20;
const MAX_WAREHOUSE_PHONE_ATTEMPTS_PER_QUERY = 3;
const SCHEDULED_LOGISTICS_REFRESH_OPTIONS = {
  maxPackagesPerRun: 0,
  scanPageSize: 500,
  autoQueryIntervalMinutes: 120,
  dailyMaxPollQueries: 1000,
  failureCooldownMinutes: 60,
  delayMs: 500,
};
const STALE_PACKAGE_REMARK = '采购单主表已移除该运单';

@Provide()
export class AppAmzBsrPurchaseOrderLogisticsService extends BaseService {
  @InjectEntityModel(AppAmzBsrPurchaseOrderSyncLingxingEntity)
  orderRepo: Repository<AppAmzBsrPurchaseOrderSyncLingxingEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderLogisticsPackageEntity)
  packageRepo: Repository<AppAmzBsrPurchaseOrderLogisticsPackageEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderItemSyncLingxingEntity)
  orderItemRepo: Repository<AppAmzBsrPurchaseOrderItemSyncLingxingEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsExceptionRuleEntity)
  exceptionRuleRepo: Repository<AppAmzBsrLogisticsExceptionRuleEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsCarrierPhoneRuleEntity)
  carrierPhoneRuleRepo: Repository<AppAmzBsrLogisticsCarrierPhoneRuleEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsWarehouseContactEntity)
  warehouseContactRepo: Repository<AppAmzBsrLogisticsWarehouseContactEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsPhoneMatchAttemptEntity)
  phoneMatchAttemptRepo: Repository<AppAmzBsrLogisticsPhoneMatchAttemptEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsQueryLogEntity)
  queryLogRepo: Repository<AppAmzBsrLogisticsQueryLogEntity>;

  @Inject()
  baseSysParamService: BaseSysParamService;

  async getOrderPackages(orderSn: string) {
    const overview = await this.getOrderLogisticsOverview({
      order_sn: orderSn,
      query: false,
      include_packages: true,
    });
    return overview.packages;
  }

  async queryOrderPackages(orderSn: string) {
    const overview = await this.getOrderLogisticsOverview({
      order_sn: orderSn,
      query: true,
      include_packages: true,
    });
    return overview.packages;
  }

  async getOrderLogisticsOverview(body: any = {}): Promise<OrderLogisticsOverviewResult> {
    const orderSn = this.normalizeText(body?.order_sn || body?.orderSn);
    if (!orderSn) throw new Error('采购单号不能为空');

    const shouldQuery = this.toBoolean(body?.query);
    const includePackages = body?.include_packages !== false && body?.includePackages !== false;
    const querySummary = this.createOrderLogisticsQuerySummary();

    await this.refreshPackagesFromOrder(orderSn);
    const order = await this.orderRepo.findOne({ where: { order_sn: orderSn } });
    if (!order) throw new Error('采购单不存在');

    const packages = await this.getPackagesByOrderSn(orderSn);
    await this.refreshRuntimePackageStatus(packages);

    if (shouldQuery) {
      if (Number(order.logistics_confirmed) === 1) {
        if (packages.length > 0) {
          querySummary.skipped_count += packages.length;
          this.addOrderLogisticsQuerySummaryReason(
            querySummary,
            '采购单已人工确认收货，不再查询快递100',
            packages.length
          );
        }
      } else {
        for (const pkg of packages) {
          try {
            await this.queryPackageWithKuaidi100(pkg);
            const attemptCount = Number((pkg as any).__query_attempt_count) || 0;
            if (attemptCount > 0) {
              querySummary.real_query_count += attemptCount;
            } else {
              querySummary.skipped_count += 1;
              this.addOrderLogisticsQuerySummaryReason(
                querySummary,
                this.getOrderOverviewPostQuerySkipReason(pkg)
              );
            }
          } catch (e: any) {
            querySummary.error_count += 1;
            querySummary.skipped_count += 1;
            this.addOrderLogisticsQuerySummaryReason(
              querySummary,
              `查询失败：${e?.message || e}`
            );
          }
        }
        await this.refreshRuntimePackageStatus(packages);
      }
    }

    const orderStatus = deriveOrderLogisticsStatus({
      order,
      packages,
    });
    const queryAvailability = this.resolveOrderOverviewQueryAvailability(order, packages);

    return {
      order_sn: orderSn,
      query: shouldQuery,
      include_packages: includePackages,
      logistics_status: orderStatus.logistics_status,
      logistics_status_text: orderStatus.logistics_status_text,
      logistics_status_reason: orderStatus.logistics_status_reason,
      package_count: orderStatus.logistics_pkg_count,
      signed_count: orderStatus.logistics_signed_count,
      unsigned_count: orderStatus.logistics_unsigned_count,
      logistics_pkg_count: orderStatus.logistics_pkg_count,
      logistics_signed_count: orderStatus.logistics_signed_count,
      logistics_unsigned_count: orderStatus.logistics_unsigned_count,
      can_query: queryAvailability.allowed,
      query_hint: queryAvailability.hint,
      query_summary: querySummary,
      packages: includePackages ? this.serializePackagesForCurrentUser(packages) : [],
    };
  }

  async queryPackage(packageId: number) {
    let pkg = await this.packageRepo.findOne({ where: { id: Number(packageId) } });
    if (!pkg) throw new Error('物流包裹不存在');

    const orderSn = this.normalizeText(pkg.order_sn);
    if (orderSn) {
      await this.refreshPackagesFromOrder(orderSn);
      pkg = (await this.packageRepo.findOne({ where: { id: Number(packageId) } })) || pkg;
    }

    await this.queryPackageWithKuaidi100(pkg);
    return this.serializePackageForCurrentUser(pkg);
  }

  async autoRefreshOrderPackages(
    orderSns: string[] | string,
    options: AutoRefreshOrderPackagesOptions = {}
  ): Promise<AutoRefreshOrderPackagesResult> {
    const normalizedOrderSns = Array.from(
      new Set(
        (Array.isArray(orderSns) ? orderSns : [orderSns])
          .map(orderSn => this.normalizeText(orderSn))
          .filter(Boolean)
      )
    );
    const result: AutoRefreshOrderPackagesResult = {
      orderCount: normalizedOrderSns.length,
      packageCount: 0,
      queriedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
    };
    if (normalizedOrderSns.length === 0) return result;

    for (const orderSn of normalizedOrderSns) {
      try {
        await this.refreshPackagesFromOrder(orderSn);
      } catch (e: any) {
        result.errorCount += 1;
        result.errors.push(`${orderSn}: ${e?.message || e}`);
      }
    }

    const orders = await this.orderRepo.find({
      where: { order_sn: In(normalizedOrderSns) },
    });
    const manualConfirmedOrderSns = new Set(
      orders
        .filter(order => Number(order.logistics_confirmed) === 1)
        .map(order => this.normalizeText(order.order_sn))
    );
    const packages = await this.packageRepo.find({
      where: { order_sn: In(normalizedOrderSns) },
    });
    await this.refreshRuntimePackageStatus(packages);
    result.packageCount = packages.length;

    const now = options.now || new Date();
    const autoQueryIntervalMinutes =
      Number(options.autoQueryIntervalMinutes) || DEFAULT_AUTO_QUERY_INTERVAL_MINUTES;
    const maxPackages = Math.max(
      0,
      Number(options.maxPackages) || DEFAULT_AUTO_REFRESH_MAX_PACKAGES
    );

    for (const pkg of packages) {
      if (result.queriedCount >= maxPackages) {
        result.skippedCount += 1;
        continue;
      }

      if (
        !this.shouldAutoRefreshPackage(
          pkg,
          manualConfirmedOrderSns,
          now,
          autoQueryIntervalMinutes
        )
      ) {
        result.skippedCount += 1;
        continue;
      }

      try {
        await this.queryPackageWithKuaidi100(pkg);
        result.queriedCount += 1;
      } catch (e: any) {
        result.errorCount += 1;
        result.errors.push(`${pkg.order_sn}/${pkg.tracking_no}: ${e?.message || e}`);
      }
    }

    return result;
  }

  async scheduledRefreshUnsignedPackages(): Promise<ScheduledRefreshUnsignedPackagesResult> {
    const options = SCHEDULED_LOGISTICS_REFRESH_OPTIONS;
    const now = new Date();
    const queryDate = dayjs(now).format('YYYY-MM-DD');
    const todayPollQueryCountBefore = await this.countTodayPollQueries(queryDate);
    const reasons: Record<string, number> = {};
    const errors: string[] = [];
    const result: ScheduledRefreshUnsignedPackagesResult = {
      matchedPackageCount: 0,
      scannedPackageCount: 0,
      targetPackageCount: 0,
      processedPackageCount: 0,
      realQueryCount: 0,
      skippedCount: 0,
      cooldownCount: 0,
      excludedCount: 0,
      errorCount: 0,
      reasons,
      errors,
      limits: { ...options },
      todayPollQueryCountBefore,
      todayPollQueryCountAfter: todayPollQueryCountBefore,
    };

    if (todayPollQueryCountBefore >= options.dailyMaxPollQueries) {
      this.addScheduledSkipReason(reasons, '今日真实查询次数已超过统计上限');
    }

    const packages = await this.collectScheduledRefreshTargetPackages(
      now,
      result,
      reasons,
      options
    );
    result.matchedPackageCount = result.targetPackageCount;
    if (!packages.length) {
      result.todayPollQueryCountAfter = await this.countTodayPollQueries(
        queryDate
      );
      result.errors = errors.slice(0, 20);
      return result;
    }

    for (const pkg of packages) {
      result.processedPackageCount += 1;

      try {
        await this.queryPackageWithKuaidi100(pkg);
        const attemptCount = Number((pkg as any).__query_attempt_count) || 0;
        if (attemptCount > 0) {
          result.realQueryCount += attemptCount;
          await this.applyScheduledRecoverableFailureCooldownIfNeeded(
            pkg,
            now,
            options.failureCooldownMinutes
          );
        } else {
          result.skippedCount += 1;
          const reason = this.getScheduledPostQuerySkipReason(pkg);
          await this.applyScheduledRecoverableFailureCooldownIfNeeded(
            pkg,
            now,
            options.failureCooldownMinutes
          );
          this.addScheduledSkipReason(reasons, reason);
        }
      } catch (e: any) {
        result.errorCount += 1;
        result.skippedCount += 1;
        const message =
          this.normalizeText(pkg.order_sn) +
          '/' +
          this.normalizeText(pkg.tracking_no) +
          ': ' +
          (e?.message || e);
        errors.push(message);
        await this.applyScheduledFailureCooldown(
          pkg,
          now,
          options.failureCooldownMinutes
        );
        this.addScheduledSkipReason(reasons, '查询失败：' + (e?.message || e));
      }

      if (options.delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delayMs));
      }
    }

    result.todayPollQueryCountAfter = await this.countTodayPollQueries(
      queryDate
    );
    result.errors = errors.slice(0, 20);
    return result;
  }

  private async collectScheduledRefreshTargetPackages(
    now: Date,
    result: ScheduledRefreshUnsignedPackagesResult,
    reasons: Record<string, number>,
    options: typeof SCHEDULED_LOGISTICS_REFRESH_OPTIONS
  ) {
    const targets: AppAmzBsrPurchaseOrderLogisticsPackageEntity[] = [];
    const pageSize = Math.max(Number(options.scanPageSize) || 500, 1);
    let lastId = 0;

    while (true) {
      const packages = await this.packageRepo
        .createQueryBuilder('p')
        .where('p.id > :lastId', { lastId })
        .orderBy('p.id', 'ASC')
        .limit(pageSize)
        .getMany();

      if (!packages.length) break;

      result.scannedPackageCount += packages.length;
      lastId = Math.max(...packages.map(pkg => Number(pkg.id) || 0));

      await this.refreshRuntimePackageStatus(packages);
      const manualConfirmedOrderSns = await this.getManualConfirmedOrderSns(
        packages
      );

      for (const pkg of packages) {
        const blockReason = this.getScheduledRefreshSelectionBlockReason(
          pkg,
          manualConfirmedOrderSns,
          now,
          options.autoQueryIntervalMinutes
        );

        if (blockReason) {
          result.skippedCount += 1;
          if (this.isScheduledCooldownReason(blockReason)) {
            result.cooldownCount += 1;
          } else {
            result.excludedCount += 1;
          }
          this.addScheduledSkipReason(reasons, blockReason);
          continue;
        }

        targets.push(pkg);
        result.targetPackageCount += 1;
      }

      if (packages.length < pageSize) break;
    }

    return targets;
  }

  private async getManualConfirmedOrderSns(
    packages: AppAmzBsrPurchaseOrderLogisticsPackageEntity[]
  ) {
    const orderSns = Array.from(
      new Set(
        packages.map(pkg => this.normalizeText(pkg.order_sn)).filter(Boolean)
      )
    );
    if (!orderSns.length) return new Set<string>();

    const orders = await this.orderRepo.find({
      where: { order_sn: In(orderSns) },
    });
    return new Set(
      orders
        .filter(order => Number(order.logistics_confirmed) === 1)
        .map(order => this.normalizeText(order.order_sn))
    );
  }

  private getScheduledRefreshSelectionBlockReason(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    manualConfirmedOrderSns: Set<string>,
    now: Date,
    autoQueryIntervalMinutes: number
  ) {
    if (manualConfirmedOrderSns.has(this.normalizeText(pkg.order_sn))) {
      return '订单已人工确认收货';
    }
    if (Number(pkg.manual_confirmed) === 1) {
      return '包裹已人工确认收货';
    }
    if (Number(pkg.is_signed) === 1 || pkg.status === 'signed') {
      return '已签收';
    }

    const queryMode = this.normalizeText(pkg.query_mode);
    if (queryMode !== 'kuaidi100') {
      return this.getScheduledQueryModeBlockReason(queryMode);
    }
    if (!this.normalizeText(pkg.tracking_no)) return '缺少运单号';

    const failureCooldownReason =
      this.getScheduledRecoverableFailureCooldownReason(pkg, now);
    if (failureCooldownReason) return failureCooldownReason;

    if (
      this.normalizeText(pkg.phone_status) === 'missing' ||
      this.normalizeText(pkg.phone_status) === 'invalid'
    ) {
      if (
        this.normalizeText(pkg.phone_status) === 'missing' &&
        Number((pkg as any).warehouse_wid) > 0
      ) {
        return '';
      }
      return this.normalizeText(pkg.phone_status) === 'invalid'
        ? '手机号格式无效'
        : '缺少手机号';
    }

    if (this.isScheduledRecoverableFailure(pkg)) return '';

    const lastQueryTime = parseLogisticsTime(pkg.last_query_time);
    if (!lastQueryTime) return '';

    return dayjs(now).diff(dayjs(lastQueryTime), 'minute') >=
      autoQueryIntervalMinutes
      ? ''
      : autoQueryIntervalMinutes + '分钟冷却中';
  }

  private getScheduledQueryModeBlockReason(queryMode: string) {
    const reasonMap: Record<string, string> = {
      manual_required: '需人工判断物流',
      ignored: '已忽略',
      disabled: '已停用',
    };
    return reasonMap[queryMode] || '查询方式为' + (queryMode || '空');
  }

  private isScheduledCooldownReason(reason: string) {
    return this.normalizeText(reason).includes('冷却中');
  }

  private getScheduledRecoverableFailureCooldownReason(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    now: Date
  ) {
    if (!this.isScheduledRecoverableFailure(pkg)) return '';
    const nextQueryAfter = parseLogisticsTime(pkg.next_query_after);
    if (nextQueryAfter && now.getTime() < nextQueryAfter.getTime()) {
      return '1小时冷却中';
    }
    return '';
  }

  private isScheduledRecoverableFailure(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity
  ) {
    if (
      this.normalizeText(pkg.identify_status) === 'failed' &&
      !this.normalizeText(pkg.company_code)
    ) {
      return true;
    }
    const lastErrorCode = this.normalizeText(pkg.last_error_code);
    return (
      Boolean(lastErrorCode) && !this.isKuaidi100PhoneVerifyError(lastErrorCode)
    );
  }

  private async applyScheduledRecoverableFailureCooldownIfNeeded(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    now: Date,
    cooldownMinutes: number
  ) {
    if (!this.isScheduledRecoverableFailure(pkg)) return;
    await this.applyScheduledFailureCooldown(pkg, now, cooldownMinutes);
  }

  private async applyScheduledFailureCooldown(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    now: Date,
    cooldownMinutes: number
  ) {
    pkg.next_query_after = dayjs(now)
      .add(Math.max(Number(cooldownMinutes) || 60, 1), 'minute')
      .toDate();
    try {
      await this.packageRepo.save(pkg);
    } catch (_) {}
  }

  async identifyPackage(packageId: number, options: { force?: boolean } = {}) {
    const pkg = await this.packageRepo.findOne({ where: { id: Number(packageId) } });
    if (!pkg) throw new Error('物流包裹不存在');
    await this.applyExceptionRuleToPackage(pkg);
    if (pkg.query_mode !== 'kuaidi100') {
      await this.packageRepo.save(pkg);
      return this.serializePackageForCurrentUser(pkg);
    }
    const config = await this.getKuaidi100Config();
    await this.identifyPackageWithKuaidi100(pkg, config, Boolean(options.force));
    this.applyPackageBlockers(pkg);
    await this.packageRepo.save(pkg);
    return this.serializePackageForCurrentUser(pkg);
  }

  async updatePackagePhone(body: any) {
    const orderSn = this.normalizeText(body?.order_sn);
    const packageId = Number(body?.package_id || body?.id || 0);
    const contactPhone = this.normalizeText(body?.contact_phone);
    const applyToOrder = Boolean(body?.apply_to_order);
    if (!contactPhone) throw new Error('请填写手机号');

    await this.refreshPackagesFromOrder(orderSn);
    const user = this.getCurrentAdminUser();
    const now = new Date();
    let packages: AppAmzBsrPurchaseOrderLogisticsPackageEntity[] = [];

    if (applyToOrder) {
      if (!orderSn) throw new Error('采购单号不能为空');
      packages = await this.packageRepo.find({
        where: { order_sn: orderSn, phone_required: 1 },
      });
    } else {
      const pkg = await this.packageRepo.findOne({ where: { id: packageId } });
      if (!pkg) throw new Error('物流包裹不存在');
      packages = [pkg];
    }

    for (const pkg of packages) {
      const wasPhoneBlocked =
        pkg.status === 'phone_required' || this.isKuaidi100PhoneVerifyError(pkg.last_error_code);
      pkg.contact_phone = contactPhone;
      pkg.phone_source = 'manual';
      pkg.warehouse_contact_binding_id = null;
      pkg.phone_status = resolvePhoneStatus(pkg.phone_required, contactPhone);
      pkg.contact_phone_created_by_user_id = user.userId;
      pkg.contact_phone_created_by_username = user.username;
      pkg.contact_phone_created_time = now;
      if (wasPhoneBlocked) {
        pkg.last_error_code = null;
        pkg.last_error_message = null;
        pkg.provider_message = null;
        pkg.next_query_after = null;
      }
      if (pkg.query_mode === 'kuaidi100' && pkg.status === 'phone_required') {
        pkg.status = pkg.phone_status === 'ok' ? 'in_transit' : 'phone_required';
      }
    }
    if (packages.length > 0) await this.packageRepo.save(packages);
    return {
      updated: packages.length,
      packages: this.serializePackagesForCurrentUser(packages),
    };
  }

  async updatePackageCompany(body: any = {}) {
    const packageId = Number(body?.package_id || body?.id || 0);
    const companyCode = this.normalizeText(body?.company_code).toLowerCase();
    const companyName = this.normalizeText(body?.company_name);
    if (!packageId) throw new Error('物流包裹不能为空');
    if (!companyCode) throw new Error('快递100编码不能为空');
    const pkg = await this.packageRepo.findOne({ where: { id: packageId } });
    if (!pkg) throw new Error('物流包裹不存在');

    pkg.query_mode = 'kuaidi100';
    pkg.company_code = companyCode;
    pkg.company_name = companyName || companyCode;
    pkg.company_code_source = 'manual';
    pkg.identify_status = 'success';
    pkg.identify_time = new Date();
    pkg.identify_error_code = null;
    pkg.identify_error_message = null;
    pkg.phone_required = (await this.isCarrierPhoneRequired(companyCode)) ? 1 : 0;
    pkg.phone_status = resolvePhoneStatus(pkg.phone_required, pkg.contact_phone);
    this.applyPackageBlockers(pkg);
    await this.packageRepo.save(pkg);
    return this.serializePackageForCurrentUser(pkg);
  }

  async listExceptionRules(query: any = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const size = Math.min(Math.max(Number(query.size) || 50, 1), 200);
    const keyWord = this.normalizeText(query.keyWord);
    const qb = this.exceptionRuleRepo.createQueryBuilder('r');
    if (keyWord) {
      qb.andWhere('(r.raw_company_name LIKE :kw OR r.normalized_name LIKE :kw)', {
        kw: `%${keyWord}%`,
      });
    }
    qb.orderBy('r.updateTime', 'DESC').skip((page - 1) * size).take(size);
    const [list, total] = await qb.getManyAndCount();
    return { list, pagination: { page, size, total } };
  }

  async saveExceptionRule(body: any = {}) {
    const rawCompanyName = this.normalizeText(body.raw_company_name);
    if (!rawCompanyName) throw new Error('原始物流公司不能为空');
    const queryMode = this.normalizeExceptionQueryMode(body.query_mode || 'manual_required');
    let rule = await this.exceptionRuleRepo.findOne({ where: { raw_company_name: rawCompanyName } });
    if (!rule) {
      rule = this.exceptionRuleRepo.create({ raw_company_name: rawCompanyName });
    }
    rule.normalized_name = normalizeCompanyName(rawCompanyName);
    rule.query_mode = queryMode;
    rule.enabled = body.enabled === undefined ? 1 : Number(body.enabled) === 1 ? 1 : 0;
    rule.remark = this.normalizeText(body.remark);
    await this.exceptionRuleRepo.save(rule);

    const packages = await this.packageRepo.find({ where: { raw_company_name: rawCompanyName } });
    for (const pkg of packages) {
      if (rule.enabled === 1) {
        this.applyExceptionRuleToPackageEntity(pkg, rule);
      } else {
        await this.restorePackageToKuaidi100(pkg);
      }
    }
    if (packages.length > 0) await this.packageRepo.save(packages);
    return { rule, affected_packages: packages.length };
  }

  async markPackageMode(body: any) {
    const packageId = Number(body?.package_id || body?.id || 0);
    const queryMode = this.normalizeQueryMode(body?.query_mode);
    const pkg = await this.packageRepo.findOne({ where: { id: packageId } });
    if (!pkg) throw new Error('物流包裹不存在');

    pkg.remark = this.normalizeText(body?.remark);
    if (queryMode === 'kuaidi100') {
      await this.restorePackageToKuaidi100(pkg);
      pkg.remark = this.normalizeText(body?.remark);
    } else {
      pkg.query_mode = queryMode;
      if (queryMode === 'manual_required') pkg.status = 'manual_required';
      if (queryMode === 'ignored' || queryMode === 'disabled') pkg.status = queryMode;
    }
    await this.packageRepo.save(pkg);
    return this.serializePackageForCurrentUser(pkg);
  }

  async getQueryStats(query: any = {}) {
    const startDate =
      this.normalizeText(query.startDate) || dayjs().subtract(30, 'day').format('YYYY-MM-DD');
    const endDate = this.normalizeText(query.endDate) || dayjs().format('YYYY-MM-DD');

    const base = this.queryLogRepo
      .createQueryBuilder('l')
      .where('l.query_date >= :startDate AND l.query_date <= :endDate', {
        startDate,
        endDate,
      });

    const daily = await base
      .clone()
      .select('l.query_date', 'query_date')
      .addSelect('COUNT(*)', 'total')
      .addSelect('SUM(CASE WHEN l.success = 1 THEN 1 ELSE 0 END)', 'success')
      .addSelect('SUM(CASE WHEN l.success = 0 THEN 1 ELSE 0 END)', 'failed')
      .groupBy('l.query_date')
      .orderBy('l.query_date', 'DESC')
      .getRawMany();

    const byUser = await base
      .clone()
      .select('COALESCE(l.created_by_username, "")', 'username')
      .addSelect('l.created_by_user_id', 'user_id')
      .addSelect('COUNT(*)', 'total')
      .groupBy('l.created_by_user_id')
      .addGroupBy('l.created_by_username')
      .orderBy('total', 'DESC')
      .limit(50)
      .getRawMany();

    const byCarrier = await base
      .clone()
      .select('COALESCE(l.company_code, "")', 'company_code')
      .addSelect('COUNT(*)', 'total')
      .groupBy('l.company_code')
      .orderBy('total', 'DESC')
      .limit(50)
      .getRawMany();

    const failureReasons = await base
      .clone()
      .select('COALESCE(l.return_code, "")', 'return_code')
      .addSelect('COALESCE(l.message, "")', 'message')
      .addSelect('COUNT(*)', 'total')
      .andWhere('l.success = 0')
      .groupBy('l.return_code')
      .addGroupBy('l.message')
      .orderBy('total', 'DESC')
      .limit(50)
      .getRawMany();

    return { startDate, endDate, daily, byUser, byCarrier, failureReasons };
  }

  async attachStatusesToOrders(orders: any[], options: { overtimeDays?: number } = {}) {
    if (!Array.isArray(orders) || orders.length === 0) return orders;
    const orderSns = orders.map(order => this.normalizeText(order?.order_sn)).filter(Boolean);
    for (const orderSn of orderSns) {
      await this.refreshPackagesFromOrder(orderSn);
    }

    const packages = await this.packageRepo.find({ where: { order_sn: In(orderSns) } });
    await this.refreshRuntimePackageStatus(packages);
    const grouped = new Map<string, AppAmzBsrPurchaseOrderLogisticsPackageEntity[]>();
    for (const pkg of packages) {
      if (!grouped.has(pkg.order_sn)) grouped.set(pkg.order_sn, []);
      grouped.get(pkg.order_sn).push(pkg);
    }

    for (const order of orders) {
      const orderPackages = grouped.get(order.order_sn) || [];
      const status = deriveOrderLogisticsStatus({
        order,
        packages: orderPackages,
        overtimeDays: Number(options.overtimeDays) || 7,
      });
      Object.assign(order, status);
      (order as any).logistics_packages = this.serializePackagesForCurrentUser(orderPackages);
      (order as any).logistics_last_sync_time = this.getLatestQueryTime(orderPackages);
    }
    return orders;
  }

  applyOrderStatusFilter(
    qb: any,
    logisticsStatus: string,
    overtimeDays: number = 7,
    orderAlias: string = 'o'
  ) {
    const status = this.normalizeText(logisticsStatus);
    if (!status) return;
    const pkgTable = 'app_amz_bsr_purchase_order_logistics_package';
    const pkgAlias = 'lp';
    const validPkg = `${pkgAlias}.order_sn = ${orderAlias}.order_sn AND ${pkgAlias}.query_mode NOT IN ('ignored', 'disabled', 'manual_required') AND ${pkgAlias}.tracking_no IS NOT NULL AND ${pkgAlias}.tracking_no != ''`;
    const signedPkg = `${validPkg} AND ${pkgAlias}.is_signed = 1`;
    const unsignedPkg = `${validPkg} AND (${pkgAlias}.is_signed IS NULL OR ${pkgAlias}.is_signed != 1)`;

    switch (status) {
      case 'confirmed':
        qb.andWhere(`${orderAlias}.logistics_confirmed = 1`);
        break;
      case 'logistics_exception':
        qb.andWhere(
          `EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${pkgAlias}.order_sn = ${orderAlias}.order_sn AND ${pkgAlias}.status = 'logistics_exception')`
        ).andWhere(`(${orderAlias}.logistics_confirmed IS NULL OR ${orderAlias}.logistics_confirmed != 1)`);
        break;
      case 'pending_mapping':
        qb.andWhere(
          `EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${pkgAlias}.order_sn = ${orderAlias}.order_sn AND ${pkgAlias}.query_mode = 'kuaidi100' AND (${pkgAlias}.company_code IS NULL OR ${pkgAlias}.company_code = ''))`
        ).andWhere(`(${orderAlias}.logistics_confirmed IS NULL OR ${orderAlias}.logistics_confirmed != 1)`);
        break;
      case 'phone_required':
        qb.andWhere(
          `EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${pkgAlias}.order_sn = ${orderAlias}.order_sn AND ${pkgAlias}.query_mode = 'kuaidi100' AND ${pkgAlias}.phone_required = 1 AND (${pkgAlias}.contact_phone IS NULL OR ${pkgAlias}.contact_phone = '' OR ${pkgAlias}.phone_status IN ('missing', 'invalid')))`
        ).andWhere(`(${orderAlias}.logistics_confirmed IS NULL OR ${orderAlias}.logistics_confirmed != 1)`);
        break;
      case 'manual_required':
        qb.andWhere(
          `EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${pkgAlias}.order_sn = ${orderAlias}.order_sn AND ${pkgAlias}.query_mode = 'manual_required')`
        ).andWhere(`(${orderAlias}.logistics_confirmed IS NULL OR ${orderAlias}.logistics_confirmed != 1)`);
        break;
      case 'signed':
        qb.andWhere(`EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${validPkg})`)
          .andWhere(`NOT EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${unsignedPkg})`)
          .andWhere(`(${orderAlias}.logistics_confirmed IS NULL OR ${orderAlias}.logistics_confirmed != 1)`);
        break;
      case 'partial_signed':
        qb.andWhere(`EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${signedPkg})`)
          .andWhere(`EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${unsignedPkg})`)
          .andWhere(`DATEDIFF(NOW(), ${orderAlias}.create_time_remote) <= :logisticsOvertimeDays`, {
            logisticsOvertimeDays: overtimeDays,
          })
          .andWhere(`(${orderAlias}.logistics_confirmed IS NULL OR ${orderAlias}.logistics_confirmed != 1)`);
        break;
      case 'partial_overtime_unsigned':
        qb.andWhere(`EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${signedPkg})`)
          .andWhere(`EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${unsignedPkg})`)
          .andWhere(`DATEDIFF(NOW(), ${orderAlias}.create_time_remote) > :logisticsOvertimeDays`, {
            logisticsOvertimeDays: overtimeDays,
          })
          .andWhere(`(${orderAlias}.logistics_confirmed IS NULL OR ${orderAlias}.logistics_confirmed != 1)`);
        break;
      case 'overtime_unsigned':
        qb.andWhere(`EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${validPkg})`)
          .andWhere(`NOT EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${signedPkg})`)
          .andWhere(`DATEDIFF(NOW(), ${orderAlias}.create_time_remote) > :logisticsOvertimeDays`, {
            logisticsOvertimeDays: overtimeDays,
          })
          .andWhere(`(${orderAlias}.logistics_confirmed IS NULL OR ${orderAlias}.logistics_confirmed != 1)`);
        break;
      case 'in_transit':
        qb.andWhere(`EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${validPkg})`)
          .andWhere(`NOT EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${signedPkg})`)
          .andWhere(`DATEDIFF(NOW(), ${orderAlias}.create_time_remote) <= :logisticsOvertimeDays`, {
            logisticsOvertimeDays: overtimeDays,
          })
          .andWhere(`(${orderAlias}.logistics_confirmed IS NULL OR ${orderAlias}.logistics_confirmed != 1)`);
        break;
      case 'logistics_abnormal':
        qb.andWhere(`NOT EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${validPkg})`)
          .andWhere(`DATEDIFF(NOW(), ${orderAlias}.create_time_remote) > 3`)
          .andWhere(`(${orderAlias}.logistics_confirmed IS NULL OR ${orderAlias}.logistics_confirmed != 1)`);
        break;
      case 'no_logistics':
        qb.andWhere(`NOT EXISTS (SELECT 1 FROM ${pkgTable} ${pkgAlias} WHERE ${validPkg})`)
          .andWhere(`DATEDIFF(NOW(), ${orderAlias}.create_time_remote) <= 3`)
          .andWhere(`(${orderAlias}.logistics_confirmed IS NULL OR ${orderAlias}.logistics_confirmed != 1)`);
        break;
    }
  }

  async refreshPackagesFromOrder(orderSn: string) {
    const normalizedOrderSn = this.normalizeText(orderSn);
    if (!normalizedOrderSn) throw new Error('采购单号不能为空');

    const order = await this.orderRepo.findOne({ where: { order_sn: normalizedOrderSn } });
    if (!order) throw new Error('采购单不存在');

    const warehouseSnapshot = await this.resolveOrderWarehouseSnapshot(order);
    const existing = await this.packageRepo.find({ where: { order_sn: normalizedOrderSn } });
    const existingMap = new Map(existing.map(pkg => [this.normalizeText(pkg.tracking_no), pkg]));
    const sourceGroups = await this.buildLogisticsSourceGroups(
      this.parseLogisticsInfo(order.logistics_info)
    );
    if (sourceGroups.length === 0) {
      const changed = this.disableStalePackages(existing, new Set());
      if (changed.length > 0) await this.packageRepo.save(changed);
      return;
    }
    const toSave: AppAmzBsrPurchaseOrderLogisticsPackageEntity[] = [];
    const activeTrackingNos = new Set<string>();

    for (const group of sourceGroups) {
      const trackingNo = group.trackingNo;
      activeTrackingNos.add(trackingNo);
      let pkg = existingMap.get(trackingNo);
      if (!pkg) {
        pkg = this.packageRepo.create({
          order_sn: normalizedOrderSn,
          tracking_no: trackingNo,
          provider: 'kuaidi100',
          query_mode: 'kuaidi100',
          status: 'pending_mapping',
          is_signed: 0,
          phone_required: 0,
          phone_status: 'not_required',
        });
        existingMap.set(trackingNo, pkg);
      }

      const primarySource = this.pickPrimaryLogisticsSource(group.sources, pkg);
      const hasQueryableSource = group.sources.some(source => !source.exceptionRule);
      pkg.source_pol_id = primarySource?.sourcePolId || '';
      pkg.raw_company_name = primarySource?.rawCompanyName || '';
      pkg.source_items_json = this.buildSourceItemsJson(group.sources);
      pkg.warehouse_wid = warehouseSnapshot.warehouse_wid;
      pkg.warehouse_name = warehouseSnapshot.warehouse_name;

      if (hasQueryableSource) {
        await this.applyQueryableSourceToPackageEntity(pkg);
      } else if (primarySource?.exceptionRule) {
        this.applyExceptionRuleToPackageEntity(pkg, primarySource.exceptionRule);
      }
      toSave.push(pkg);
    }
    toSave.push(...this.disableStalePackages(existing, activeTrackingNos));

    if (toSave.length > 0) await this.packageRepo.save(toSave);
  }

  private async resolveOrderWarehouseSnapshot(
    order: AppAmzBsrPurchaseOrderSyncLingxingEntity
  ): Promise<WarehouseSnapshot> {
    const orderWid = Number((order as any)?.wid) || null;
    const orderWarehouseName = this.normalizeText((order as any)?.ware_house_name);
    if (orderWid && orderWarehouseName) {
      return {
        warehouse_wid: orderWid,
        warehouse_name: orderWarehouseName,
      };
    }

    const item = await this.orderItemRepo
      .createQueryBuilder('i')
      .where('i.order_sn = :orderSn', { orderSn: this.normalizeText(order.order_sn) })
      .andWhere('(i.is_delete IS NULL OR i.is_delete = 0)')
      .andWhere(
        '((i.wid IS NOT NULL AND i.wid != 0) OR (i.ware_house_name IS NOT NULL AND i.ware_house_name != ""))'
      )
      .orderBy('i.id', 'ASC')
      .getOne();

    return {
      warehouse_wid: orderWid || Number((item as any)?.wid) || null,
      warehouse_name: orderWarehouseName || this.normalizeText((item as any)?.ware_house_name),
    };
  }

  private async buildLogisticsSourceGroups(rawItems: any[]): Promise<LogisticsSourceGroup[]> {
    const groupMap = new Map<string, LogisticsSourceGroup>();
    for (const item of rawItems) {
      const source = await this.buildLogisticsSourceItem(item);
      if (!source) continue;
      if (!groupMap.has(source.trackingNo)) {
        groupMap.set(source.trackingNo, {
          trackingNo: source.trackingNo,
          sources: [],
        });
      }
      groupMap.get(source.trackingNo).sources.push(source);
    }
    return Array.from(groupMap.values());
  }

  private async buildLogisticsSourceItem(item: any): Promise<LogisticsSourceItem | null> {
    const trackingNo = this.normalizeText(
      item?.logistics_order_no || item?.tracking_no || item?.num || item?.nu
    );
    if (!trackingNo) return null;

    const rawCompanyName = this.normalizeText(
      item?.logistics_company || item?.raw_company_name || item?.company_name
    );
    const exceptionRule = await this.findExceptionRule(rawCompanyName);

    return {
      trackingNo,
      sourcePolId: this.normalizeText(item?.pol_id || item?.source_pol_id),
      rawCompanyName,
      rawItem: item || null,
      exceptionRule,
    };
  }

  private pickPrimaryLogisticsSource(
    sources: LogisticsSourceItem[],
    existingPkg?: AppAmzBsrPurchaseOrderLogisticsPackageEntity
  ) {
    const existingRawCompanyName = this.normalizeText(existingPkg?.raw_company_name);
    if (existingRawCompanyName) {
      const stableSource = sources.find(
        source =>
          !source.exceptionRule &&
          this.normalizeText(source.rawCompanyName) === existingRawCompanyName
      );
      if (stableSource) return stableSource;
    }
    return sources.find(source => !source.exceptionRule) || sources[0] || null;
  }

  private buildSourceItemsJson(sources: LogisticsSourceItem[]) {
    return sources.map((source, index) => ({
      index: index + 1,
      pol_id: source.sourcePolId || '',
      source_pol_id: source.sourcePolId || '',
      logistics_company: source.rawCompanyName || '',
      raw_company_name: source.rawCompanyName || '',
      logistics_order_no: source.trackingNo,
      tracking_no: source.trackingNo,
      query_mode: source.exceptionRule?.query_mode || 'kuaidi100',
      is_exception_source: Boolean(source.exceptionRule),
      raw_item: source.rawItem || null,
    }));
  }

  private async applyQueryableSourceToPackageEntity(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity
  ) {
    pkg.query_mode = 'kuaidi100';
    pkg.provider = 'kuaidi100';
    if (pkg.remark === STALE_PACKAGE_REMARK) {
      pkg.remark = '';
    }
    if (Number(pkg.manual_confirmed) === 1 || Number(pkg.is_signed) === 1 || pkg.status === 'signed') {
      pkg.status = 'signed';
      pkg.is_signed = 1;
      return;
    }
    if (!this.normalizeText(pkg.company_code)) {
      pkg.identify_status = pkg.identify_status || 'pending';
      pkg.status = pkg.identify_status === 'failed' ? 'identify_failed' : 'pending_mapping';
      pkg.phone_required = 0;
      pkg.phone_status = 'not_required';
      return;
    }
    pkg.phone_required = (await this.isCarrierPhoneRequired(pkg.company_code)) ? 1 : 0;
    pkg.phone_status = resolvePhoneStatus(pkg.phone_required, pkg.contact_phone);
    this.applyPackageBlockers(pkg);
  }

  private shouldAutoRefreshPackage(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    manualConfirmedOrderSns: Set<string>,
    now: Date,
    autoQueryIntervalMinutes: number
  ) {
    return !this.getAutoRefreshBlockReason(
      pkg,
      manualConfirmedOrderSns,
      now,
      autoQueryIntervalMinutes
    );
  }

  private getAutoRefreshBlockReason(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    manualConfirmedOrderSns: Set<string>,
    now: Date,
    autoQueryIntervalMinutes: number
  ) {
    if (manualConfirmedOrderSns.has(this.normalizeText(pkg.order_sn))) return '订单已人工确认收货';
    if (pkg.query_mode !== 'kuaidi100') return `查询方式为${pkg.query_mode || '空'}`;
    if (!this.normalizeText(pkg.tracking_no)) return '缺少运单号';
    if (Number(pkg.manual_confirmed) === 1 || Number(pkg.is_signed) === 1 || pkg.status === 'signed') {
      return '已签收';
    }
    if (
      this.normalizeText(pkg.identify_status) === 'failed' &&
      !this.normalizeText(pkg.company_code)
    ) {
      return '智能识别失败';
    }
    if (
      this.normalizeText(pkg.phone_status) === 'missing' ||
      this.normalizeText(pkg.phone_status) === 'invalid'
    ) {
      if (
        this.normalizeText(pkg.phone_status) === 'missing' &&
        Number((pkg as any).warehouse_wid) > 0
      ) {
        return '';
      }
      return this.normalizeText(pkg.phone_status) === 'invalid' ? '手机号格式无效' : '缺少手机号';
    }

    const lastQueryTime = parseLogisticsTime(pkg.last_query_time);
    if (!lastQueryTime) return '';

    return dayjs(now).diff(dayjs(lastQueryTime), 'minute') >= autoQueryIntervalMinutes
      ? ''
      : `${autoQueryIntervalMinutes}分钟冷却中`;
  }

  private buildScheduledUnsignedPackageQuery() {
    return this.packageRepo
      .createQueryBuilder('p')
      .leftJoin(
        'app_amz_bsr_purchase_order_sync_lingxing',
        'o',
        'o.order_sn = p.order_sn'
      )
      .where("p.query_mode = 'kuaidi100'")
      .andWhere('p.tracking_no IS NOT NULL AND p.tracking_no != ""')
      .andWhere('(p.manual_confirmed IS NULL OR p.manual_confirmed != 1)')
      .andWhere('(p.is_signed IS NULL OR p.is_signed != 1)')
      .andWhere("(p.status IS NULL OR p.status NOT IN ('signed', 'manual_required', 'ignored', 'disabled'))")
      .andWhere("(p.status != 'phone_required' OR (p.warehouse_wid IS NOT NULL AND p.warehouse_wid != 0))")
      .andWhere('(o.logistics_confirmed IS NULL OR o.logistics_confirmed != 1)')
      .andWhere("(p.identify_status IS NULL OR p.identify_status != 'failed' OR (p.company_code IS NOT NULL AND p.company_code != ''))");
  }

  private async countTodayPollQueries(queryDate: string) {
    return this.queryLogRepo.count({
      where: {
        provider: 'kuaidi100_poll',
        query_date: queryDate,
      },
    });
  }

  private addScheduledSkipReason(reasons: Record<string, number>, reason: string) {
    const key = this.normalizeText(reason) || '未知原因';
    reasons[key] = (reasons[key] || 0) + 1;
  }

  private getScheduledPostQuerySkipReason(pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity) {
    const canQuery = canQueryLogisticsPackage(pkg);
    const reasonMap: Record<string, string> = {
      signed: '已签收',
      cooldown: '45分钟冷却中',
      phone_required: '缺少手机号',
      phone_invalid: '手机号格式无效',
      pending_mapping: '待自动识别',
      identify_failed: '智能识别失败',
      manual_required: '需人工判断物流',
      ignored: '已忽略',
      disabled: '已停用',
      missing_tracking_no: '缺少运单号',
    };
    return reasonMap[canQuery.reason] || canQuery.reason || '未触发真实查询';
  }

  private toBoolean(value: any) {
    if (value === true || value === 1) return true;
    const text = this.normalizeText(value).toLowerCase();
    return text === 'true' || text === '1' || text === 'yes';
  }

  private createOrderLogisticsQuerySummary(): OrderLogisticsQuerySummary {
    return {
      real_query_count: 0,
      skipped_count: 0,
      error_count: 0,
      reasons: {},
    };
  }

  private addOrderLogisticsQuerySummaryReason(
    summary: OrderLogisticsQuerySummary,
    reason: string,
    count = 1
  ) {
    const normalizedCount = Math.max(Number(count) || 0, 0);
    if (normalizedCount <= 0) return;
    const key = this.normalizeText(reason) || '未知原因';
    summary.reasons[key] = (summary.reasons[key] || 0) + normalizedCount;
  }

  private getOrderOverviewPostQuerySkipReason(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity
  ) {
    return this.getScheduledPostQuerySkipReason(pkg);
  }

  private resolveOrderOverviewQueryAvailability(
    order: AppAmzBsrPurchaseOrderSyncLingxingEntity,
    packages: AppAmzBsrPurchaseOrderLogisticsPackageEntity[]
  ) {
    if (Number(order?.logistics_confirmed) === 1) {
      return {
        allowed: false,
        hint: '采购单已人工确认收货，不再查询快递100',
      };
    }
    if (!packages.length) {
      return {
        allowed: false,
        hint: '暂无物流包裹',
      };
    }

    const reasons: string[] = [];
    for (const pkg of packages) {
      const result = this.resolvePackageUnifiedQueryAvailability(pkg);
      if (result.allowed) {
        return {
          allowed: true,
          hint: result.hint,
        };
      }
      reasons.push(result.hint);
    }

    return {
      allowed: false,
      hint: reasons[0] || '当前没有可查询的物流包裹',
    };
  }

  private resolvePackageUnifiedQueryAvailability(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity
  ): PackageUnifiedQueryAvailability {
    const queryMode = this.normalizeText(pkg?.query_mode);
    if (queryMode !== 'kuaidi100') {
      return {
        allowed: false,
        reason: queryMode || 'query_mode_required',
        hint: this.getQueryModeBlockHint(queryMode),
      };
    }
    if (!this.normalizeText(pkg?.tracking_no)) {
      return {
        allowed: false,
        reason: 'missing_tracking_no',
        hint: '缺少运单号',
      };
    }
    if (
      Number(pkg?.manual_confirmed) === 1 ||
      Number(pkg?.is_signed) === 1 ||
      this.normalizeText(pkg?.status) === 'signed'
    ) {
      return {
        allowed: false,
        reason: 'signed',
        hint: '已签收，不再查询快递100',
      };
    }

    const nextQueryAfter = parseLogisticsTime(pkg?.next_query_after);
    if (
      !this.isKuaidi100PhoneVerifyError(pkg?.last_error_code) &&
      nextQueryAfter &&
      Date.now() < nextQueryAfter.getTime()
    ) {
      return {
        allowed: false,
        reason: 'cooldown',
        hint: `冷却中，下次可查：${dayjs(nextQueryAfter).format('YYYY-MM-DD HH:mm:ss')}`,
        next_query_after: nextQueryAfter,
      };
    }

    if (!this.normalizeText(pkg?.company_code)) {
      return {
        allowed: true,
        reason: 'ok',
        hint: '可查询；会先自动识别快递公司，再查询物流',
      };
    }

    const phoneStatus = resolvePhoneStatus(pkg?.phone_required, pkg?.contact_phone);
    if (phoneStatus === 'invalid') {
      return {
        allowed: false,
        reason: 'phone_invalid',
        hint: '手机号格式无效，请先修改手机号',
      };
    }
    if (phoneStatus === 'missing') {
      if (Number(pkg?.warehouse_wid) > 0) {
        return {
          allowed: true,
          reason: 'ok',
          hint: '可查询；需要手机号时会自动按采购仓库联系人优先级尝试',
        };
      }
      return {
        allowed: false,
        reason: 'missing_warehouse',
        hint: '缺少采购仓库，无法自动匹配手机号',
      };
    }

    return {
      allowed: true,
      reason: 'ok',
      hint: '可查询；按快递100规则查询物流',
    };
  }

  private getQueryModeBlockHint(queryMode: string) {
    const reasonMap: Record<string, string> = {
      manual_required: '需人工判断物流，不查快递100',
      ignored: '已忽略，不参与物流查询',
      disabled: '已停用，不参与物流查询',
    };
    return reasonMap[queryMode] || '当前包裹未启用快递100查询';
  }

  private async queryPackageWithKuaidi100(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    options: { maxQueryAttempts?: number } = {}
  ) {
    this.resetRuntimeQueryAttemptSummary(pkg);
    await this.applyExceptionRuleToPackage(pkg);
    this.applyPackageBlockers(pkg);
    if (pkg.query_mode !== 'kuaidi100') {
      await this.packageRepo.save(pkg);
      return pkg;
    }

    const config = await this.getKuaidi100Config();
    if (pkg.query_mode === 'kuaidi100' && !this.normalizeText(pkg.company_code)) {
      await this.identifyPackageWithKuaidi100(pkg, config, false);
    }
    this.applyPackageBlockers(pkg);
    if (this.shouldTryWarehouseContactPhone(pkg)) {
      const canAttemptWithWarehousePhone = canQueryLogisticsPackage({
        ...pkg,
        phone_required: 0,
        contact_phone: '',
      });
      if (!canAttemptWithWarehousePhone.allowed) {
        await this.packageRepo.save(pkg);
        return pkg;
      }
      await this.queryWithWarehouseContactPhones(pkg, config, options.maxQueryAttempts);
      return pkg;
    }

    const canQuery = canQueryLogisticsPackage(pkg);
    if (!canQuery.allowed) {
      await this.packageRepo.save(pkg);
      return pkg;
    }
    if (options.maxQueryAttempts !== undefined && Number(options.maxQueryAttempts) <= 0) {
      await this.packageRepo.save(pkg);
      return pkg;
    }
    await this.executeKuaidi100PollQuery(pkg, config);
    return pkg;
  }

  private async queryWithWarehouseContactPhones(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    config: Kuaidi100Config,
    maxAttempts?: number
  ) {
    let attemptedCount = 0;
    const attemptLimit =
      maxAttempts === undefined
        ? MAX_WAREHOUSE_PHONE_ATTEMPTS_PER_QUERY
        : Math.min(MAX_WAREHOUSE_PHONE_ATTEMPTS_PER_QUERY, Math.max(Number(maxAttempts) || 0, 0));
    if (attemptLimit <= 0) {
      await this.packageRepo.save(pkg);
      return;
    }
    while (attemptedCount < attemptLimit) {
      const phoneCandidate = await this.prepareWarehouseContactPhoneCandidate(pkg);
      this.applyPackageBlockers(pkg);
      if (!phoneCandidate) {
        await this.packageRepo.save(pkg);
        return;
      }

      const canQuery = canQueryLogisticsPackage(pkg);
      if (!canQuery.allowed) {
        await this.packageRepo.save(pkg);
        return;
      }

      attemptedCount += 1;
      const result = await this.executeKuaidi100PollQuery(pkg, config);
      await this.recordWarehousePhoneMatchAttempt(
        pkg,
        phoneCandidate,
        result.success,
        result.returnCode,
        result.message,
        result.queryLogId
      );

      if (result.success) return;

      if (!this.isKuaidi100PhoneVerifyError(result.returnCode)) {
        await this.packageRepo.save(pkg);
        return;
      }
      await this.clearFailedWarehousePhoneCandidate(pkg, phoneCandidate);
    }

    pkg.contact_phone = null;
    pkg.phone_source = null;
    pkg.warehouse_contact_binding_id = null;
    pkg.phone_status = 'missing';
    pkg.status = 'phone_required';
    pkg.last_error_code = '408';
    pkg.last_error_message = `本次已尝试 ${attemptedCount} 个仓库联系人，手机号均未匹配，请人工填写手机号`;
    pkg.provider_message = pkg.last_error_message;
    pkg.next_query_after = null;
    await this.packageRepo.save(pkg);
  }

  private async executeKuaidi100PollQuery(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    config: Kuaidi100Config
  ) {
    const now = new Date();
    const startedAt = Date.now();
    const user = this.getCurrentAdminUser();
    let responseBody: any = null;
    let success = false;
    let returnCode = '';
    let message = '';

    try {
      const param = this.buildKuaidi100Param(pkg, config);
      const paramStr = JSON.stringify(param);
      const sign = this.signKuaidi100(paramStr, config);
      const form = new URLSearchParams();
      form.append('customer', this.normalizeText(config.customer));
      form.append('sign', sign);
      if (this.normalizeText(config.signType).toUpperCase() !== 'MD5') {
        form.append('signType', this.normalizeText(config.signType).toUpperCase());
      }
      form.append('param', paramStr);

      const res = await axios.post(
        config.queryUrl || 'https://poll.kuaidi100.com/poll/query.do',
        form.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: Number(config.timeoutMs) || 15000,
        }
      );
      responseBody = res.data;
      success = String(responseBody?.status || '') === '200';
      returnCode = this.normalizeText(responseBody?.returnCode || responseBody?.status);
      message = this.normalizeText(responseBody?.message);
      if (success) {
        this.applyKuaidi100Response(pkg, responseBody, now, config, true);
      } else if (this.isKuaidi100PhoneVerifyError(returnCode)) {
        this.applyKuaidi100PhoneVerifyError(pkg, returnCode, message, responseBody);
      } else {
        this.applyKuaidi100Error(
          pkg,
          returnCode || 'UNKNOWN',
          message || '快递100查询失败',
          now,
          config
        );
      }
    } catch (e: any) {
      responseBody = e?.response?.data || null;
      returnCode = this.normalizeText(responseBody?.returnCode || e?.code || 'REQUEST_ERROR');
      message = this.normalizeText(responseBody?.message || e?.message || '请求快递100失败');
      if (this.isKuaidi100PhoneVerifyError(returnCode)) {
        this.applyKuaidi100PhoneVerifyError(pkg, returnCode, message, responseBody);
      } else {
        this.applyKuaidi100Error(pkg, returnCode, message, now, config);
      }
    }

    await this.packageRepo.save(pkg);
    const queryLog = await this.queryLogRepo.save(
      this.queryLogRepo.create({
        provider: 'kuaidi100_poll',
        order_sn: pkg.order_sn,
        package_id: pkg.id,
        tracking_no: pkg.tracking_no,
        company_code: pkg.company_code,
        success: success ? 1 : 0,
        provider_status: this.normalizeText(responseBody?.status),
        provider_state: this.normalizeText(responseBody?.state),
        return_code: returnCode,
        message,
        duration_ms: Date.now() - startedAt,
        query_date: dayjs().format('YYYY-MM-DD'),
        created_by_user_id: user.userId,
        created_by_username: user.username,
      })
    );
    this.appendRuntimeQueryAttemptSummary(pkg, {
      success,
      returnCode,
      message,
    });
    return {
      success,
      returnCode,
      message,
      queryLogId: queryLog.id,
      time: now,
    };
  }

  private applyKuaidi100PhoneVerifyError(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    code: string,
    message: string,
    responseBody: any
  ) {
    pkg.query_count = Number(pkg.query_count) + 1;
    pkg.error_count = Number(pkg.error_count) + 1;
    pkg.provider_status = this.normalizeText(responseBody?.status);
    pkg.provider_state = this.normalizeText(responseBody?.state);
    pkg.provider_message = message || '手机号校验不通过';
    pkg.raw_response_json = responseBody;
    pkg.last_error_code = code || '408';
    pkg.last_error_message = message || '手机号校验不通过';
    pkg.next_query_after = null;
    pkg.phone_status = this.normalizeText(pkg.contact_phone) ? 'invalid' : 'missing';
    pkg.status = 'phone_required';
  }

  private isKuaidi100PhoneVerifyError(returnCode: string) {
    return this.normalizeText(returnCode) === '408';
  }

  private resetRuntimeQueryAttemptSummary(pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity) {
    (pkg as any).__query_attempt_count = 0;
    (pkg as any).__phone_match_attempts = [];
  }

  private appendRuntimeQueryAttemptSummary(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    attempt: { success: boolean; returnCode: string; message: string }
  ) {
    (pkg as any).__query_attempt_count = Number((pkg as any).__query_attempt_count) + 1;
    const attempts = Array.isArray((pkg as any).__phone_match_attempts)
      ? (pkg as any).__phone_match_attempts
      : [];
    attempts.push({
      success: attempt.success ? 1 : 0,
      return_code: attempt.returnCode,
      message: attempt.message,
    });
    (pkg as any).__phone_match_attempts = attempts;
  }

  private shouldTryWarehouseContactPhone(pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity) {
    return (
      Number(pkg.phone_required) === 1 &&
      !this.normalizeText(pkg.contact_phone) &&
      Number(pkg.warehouse_wid) > 0
    );
  }

  private async prepareWarehouseContactPhoneCandidate(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity
  ): Promise<(AppAmzBsrLogisticsWarehouseContactEntity & { contact_phone?: string; contact_name?: string }) | null> {
    if (Number(pkg.phone_required) !== 1) return null;
    if (this.normalizeText(pkg.contact_phone)) return null;
    if (!Number(pkg.warehouse_wid)) {
      pkg.phone_status = 'missing';
      pkg.status = 'phone_required';
      pkg.last_error_message = '缺少采购仓库，无法自动匹配手机号';
      return null;
    }

    const contacts = await this.warehouseContactRepo
      .createQueryBuilder('wc')
      .leftJoin(AppAmzBsrLogisticsContactEntity, 'c', 'c.id = wc.contact_id')
      .select([
        'wc.id AS id',
        'wc.warehouse_wid AS warehouse_wid',
        'wc.contact_id AS contact_id',
        'wc.priority AS priority',
        'wc.enabled AS enabled',
        'wc.remark AS remark',
        'c.contact_name AS contact_name',
        'c.contact_phone AS contact_phone',
      ])
      .where('wc.warehouse_wid = :warehouseWid', { warehouseWid: Number(pkg.warehouse_wid) })
      .andWhere('wc.enabled = 1')
      .andWhere('c.enabled = 1')
      .orderBy('wc.priority', 'ASC')
      .addOrderBy('wc.id', 'ASC')
      .getRawMany();
    const validContacts = contacts.filter(
      (contact: any) => resolvePhoneStatus(1, contact.contact_phone) === 'ok'
    );
    if (!validContacts.length) {
      pkg.phone_status = 'missing';
      pkg.status = 'phone_required';
      pkg.last_error_message = '当前采购仓库未配置可用联系人手机号';
      return null;
    }

    const failedRows = await this.phoneMatchAttemptRepo.find({
      where: { package_id: Number(pkg.id), success: 0, return_code: '408' },
      select: ['warehouse_contact_binding_id', 'contact_phone'],
    });
    const failedContactKeys = new Set(
      failedRows
        .map(row => {
          const bindingId = Number(row.warehouse_contact_binding_id) || 0;
          const phone = this.normalizeText(row.contact_phone);
          return bindingId && phone ? `${bindingId}:${phone}` : '';
        })
        .filter(Boolean)
    );
    const candidate = validContacts.find((contact: any) => {
      const bindingId = Number(contact.id) || 0;
      const phone = this.normalizeText(contact.contact_phone);
      return !failedContactKeys.has(`${bindingId}:${phone}`);
    });
    if (!candidate) {
      pkg.phone_status = 'missing';
      pkg.status = 'phone_required';
      pkg.last_error_message = '该仓库联系人手机号已全部尝试失败，请人工填写手机号';
      return null;
    }

    pkg.contact_phone = this.normalizeText(candidate.contact_phone);
    pkg.phone_source = 'warehouse_contact';
    pkg.warehouse_contact_binding_id = Number(candidate.id);
    pkg.phone_status = resolvePhoneStatus(pkg.phone_required, pkg.contact_phone);
    if (pkg.phone_status === 'ok') {
      pkg.status = 'in_transit';
    }
    return candidate;
  }

  private async recordWarehousePhoneMatchAttempt(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    contact: AppAmzBsrLogisticsWarehouseContactEntity & { contact_phone?: string },
    success: boolean,
    returnCode: string,
    message: string,
    queryLogId: number
  ) {
    await this.phoneMatchAttemptRepo.save(
      this.phoneMatchAttemptRepo.create({
        package_id: Number(pkg.id),
        order_sn: pkg.order_sn,
        tracking_no: pkg.tracking_no,
        warehouse_wid: Number(pkg.warehouse_wid) || null,
        warehouse_contact_binding_id: Number(contact.id),
        contact_id: Number(contact.contact_id) || null,
        contact_phone: this.normalizeText(contact.contact_phone),
        company_code: pkg.company_code,
        success: success ? 1 : 0,
        return_code: returnCode,
        message: message || (success ? '手机号匹配成功' : '手机号匹配失败'),
        query_log_id: queryLogId || null,
      })
    );
  }

  private async clearFailedWarehousePhoneCandidate(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    contact: AppAmzBsrLogisticsWarehouseContactEntity
  ) {
    if (
      this.normalizeText(pkg.phone_source) !== 'warehouse_contact' ||
      Number(pkg.warehouse_contact_binding_id) !== Number(contact.id)
    ) {
      return;
    }
    pkg.contact_phone = null;
    pkg.phone_source = null;
    pkg.warehouse_contact_binding_id = null;
    pkg.phone_status = 'missing';
    pkg.status = 'phone_required';
    await this.packageRepo.save(pkg);
  }

  private async identifyPackageWithKuaidi100(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    config: Kuaidi100Config,
    force = false
  ) {
    if (!config.autoIdentifyEnabled) return pkg;
    if (!force && this.normalizeText(pkg.company_code)) return pkg;

    const now = new Date();
    const startedAt = Date.now();
    const user = this.getCurrentAdminUser();
    let responseBody: any = null;
    let result = normalizeKuaidi100AutoNumberResult([]);

    if (!this.normalizeText(pkg.tracking_no)) {
      await this.applyKuaidi100AutoNumberResult(pkg, {
        success: false,
        company_code: '',
        company_name: '',
        candidates: [],
        return_code: 'MISSING_TRACKING_NO',
        message: '缺少运单号',
      });
      return pkg;
    }

    try {
      const res = await axios.get(
        config.autoNumberUrl || 'http://www.kuaidi100.com/autonumber/auto',
        {
          params: {
            num: this.normalizeText(pkg.tracking_no),
            key: this.normalizeText(config.key),
          },
          timeout: Number(config.autoIdentifyTimeoutMs) || 10000,
        }
      );
      responseBody = res.data;
      result = normalizeKuaidi100AutoNumberResult(responseBody);
      await this.applyKuaidi100AutoNumberResult(pkg, result);
    } catch (e: any) {
      responseBody = e?.response?.data || null;
      result = {
        success: false,
        company_code: '',
        company_name: '',
        candidates: [],
        return_code: this.normalizeText(responseBody?.returnCode || e?.code || 'REQUEST_ERROR'),
        message: this.normalizeText(responseBody?.message || e?.message || '智能识别请求失败'),
      };
      await this.applyKuaidi100AutoNumberResult(pkg, result);
    } finally {
      await this.queryLogRepo.save(
        this.queryLogRepo.create({
          provider: 'kuaidi100_autonumber',
          order_sn: pkg.order_sn,
          package_id: pkg.id,
          tracking_no: pkg.tracking_no,
          company_code: result.company_code || pkg.company_code,
          success: result.success ? 1 : 0,
          provider_status: result.return_code,
          provider_state: null,
          return_code: result.return_code,
          message: result.message,
          duration_ms: Date.now() - startedAt,
          query_date: dayjs().format('YYYY-MM-DD'),
          created_by_user_id: user.userId,
          created_by_username: user.username,
        })
      );
    }

    return pkg;
  }

  private async applyKuaidi100AutoNumberResult(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    result: {
      success: boolean;
      company_code: string;
      company_name: string;
      candidates: any[];
      return_code: string;
      message: string;
    }
  ) {
    pkg.identify_time = new Date();
    pkg.identify_candidates_json = result.candidates || [];
    if (result.success) {
      pkg.identify_status = 'success';
      pkg.identify_error_code = null;
      pkg.identify_error_message = null;
      pkg.company_code = this.normalizeText(result.company_code).toLowerCase();
      pkg.company_name = this.normalizeText(result.company_name);
      pkg.company_code_source = 'autonumber';
      pkg.phone_required = (await this.isCarrierPhoneRequired(pkg.company_code)) ? 1 : 0;
      pkg.phone_status = resolvePhoneStatus(pkg.phone_required, pkg.contact_phone);
      if (pkg.phone_status === 'missing' || pkg.phone_status === 'invalid') {
        pkg.status = 'phone_required';
      } else if (!pkg.status || ['pending_mapping', 'identify_failed', 'phone_required'].includes(pkg.status)) {
        pkg.status = 'in_transit';
      }
      return;
    }

    pkg.identify_status = 'failed';
    pkg.identify_error_code = this.normalizeText(result.return_code);
    pkg.identify_error_message = this.normalizeText(result.message);
    pkg.company_code = null;
    pkg.company_name = null;
    pkg.company_code_source = null;
    pkg.phone_required = 0;
    pkg.phone_status = 'not_required';
    pkg.status = 'identify_failed';
  }

  private applyKuaidi100Response(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    responseBody: any,
    now: Date,
    config: Kuaidi100Config,
    success: boolean
  ) {
    pkg.last_query_time = now;
    pkg.next_query_after = dayjs(now)
      .add(this.getQueryIntervalMinutes(config), 'minute')
      .toDate();
    pkg.query_count = Number(pkg.query_count) + 1;
    pkg.provider_status = this.normalizeText(responseBody?.status);
    pkg.provider_state = this.normalizeText(responseBody?.state);
    pkg.provider_message = this.normalizeText(responseBody?.message);
    pkg.raw_response_json = responseBody;

    if (!success) {
      this.applyKuaidi100Error(
        pkg,
        this.normalizeText(responseBody?.returnCode || responseBody?.status || 'UNKNOWN'),
        this.normalizeText(responseBody?.message || '快递100查询失败'),
        now,
        config,
        false
      );
      return;
    }

    const normalized = normalizeKuaidi100PackageStatus(responseBody);
    pkg.status = normalized.status;
    pkg.is_signed = normalized.is_signed;
    pkg.sign_time = normalized.sign_time;
    pkg.first_trace_time = normalized.first_trace_time;
    pkg.latest_trace_time = normalized.latest_trace_time;
    pkg.trace_json = Array.isArray(responseBody?.data) ? responseBody.data : [];
    pkg.last_error_code = null;
    pkg.last_error_message = null;
  }

  private applyKuaidi100Error(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    code: string,
    message: string,
    now: Date,
    config: Kuaidi100Config,
    increaseCounter = true
  ) {
    pkg.last_query_time = now;
    pkg.next_query_after = dayjs(now)
      .add(this.getQueryIntervalMinutes(config), 'minute')
      .toDate();
    if (increaseCounter) {
      pkg.query_count = Number(pkg.query_count) + 1;
      pkg.error_count = Number(pkg.error_count) + 1;
    } else {
      pkg.error_count = Number(pkg.error_count) + 1;
    }
    pkg.last_error_code = code;
    pkg.last_error_message = message;
    pkg.provider_message = message;
    if (code === '500') {
      pkg.status = 'no_result';
    }
  }

  private buildKuaidi100Param(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    config: Kuaidi100Config
  ) {
    const param: any = {
      com: this.normalizeText(pkg.company_code).toLowerCase(),
      num: this.normalizeText(pkg.tracking_no),
      resultv2: this.normalizeText(config.resultv2 || '4'),
      show: this.normalizeText(config.show || '0'),
      order: this.normalizeText(config.order || 'desc'),
      lang: this.normalizeText(config.lang || 'zh'),
    };
    if (Number(pkg.phone_required) === 1) {
      param.phone = this.normalizeText(pkg.contact_phone);
    }
    if (config.needCourierInfo === true) {
      param.needCourierInfo = true;
    }
    return param;
  }

  private signKuaidi100(paramStr: string, config: Kuaidi100Config) {
    const signType = this.normalizeText(config.signType || 'MD5').toUpperCase();
    const raw = `${paramStr}${this.normalizeText(config.key)}${this.normalizeText(config.customer)}`;
    if (signType === 'SHA256') {
      return createHash('sha256').update(raw, 'utf8').digest('hex').toUpperCase();
    }
    if (signType !== 'MD5') {
      throw new Error(`暂不支持快递100签名算法: ${signType}`);
    }
    return createHash('md5').update(raw, 'utf8').digest('hex').toUpperCase();
  }

  private async getKuaidi100Config(): Promise<Kuaidi100Config> {
    const config = normalizeKuaidi100ConfigForRuntime(
      (await this.baseSysParamService.dataByKey(KUAIDI100_CONFIG_KEY)) || {}
    );
    if (!config.enabled) throw new Error('快递100配置未启用');
    if (!this.normalizeText(config.customer) || !this.normalizeText(config.key)) {
      throw new Error('快递100配置缺少 customer 或 key');
    }
    return config;
  }

  private async isCarrierPhoneRequired(companyCode: string): Promise<boolean> {
    const code = this.normalizeText(companyCode).toLowerCase();
    if (!code) return false;
    const rule = await this.carrierPhoneRuleRepo.findOne({
      where: { company_code: code, enabled: 1 },
    });
    return Number(rule?.need_phone) === 1;
  }

  private async refreshRuntimePackageStatus(
    packages: AppAmzBsrPurchaseOrderLogisticsPackageEntity[]
  ) {
    const changed: AppAmzBsrPurchaseOrderLogisticsPackageEntity[] = [];
    for (const pkg of packages) {
      const before = JSON.stringify({
        status: pkg.status,
        phone_status: pkg.phone_status,
        phone_required: pkg.phone_required,
      });
      this.applyPackageBlockers(pkg);
      const after = JSON.stringify({
        status: pkg.status,
        phone_status: pkg.phone_status,
        phone_required: pkg.phone_required,
      });
      if (before !== after) changed.push(pkg);
    }
    if (changed.length > 0) await this.packageRepo.save(changed);
  }

  private applyPackageBlockers(pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity) {
    pkg.phone_status = resolvePhoneStatus(pkg.phone_required, pkg.contact_phone);
    if (Number(pkg.manual_confirmed) === 1) {
      pkg.status = 'signed';
      pkg.is_signed = 1;
      if (!pkg.sign_time) pkg.sign_time = pkg.manual_confirmed_time || new Date();
      return;
    }
    if (pkg.query_mode === 'manual_required') {
      pkg.status = 'manual_required';
      return;
    }
    if (pkg.query_mode === 'ignored' || pkg.query_mode === 'disabled') {
      pkg.status = pkg.query_mode;
      return;
    }
    if (pkg.query_mode !== 'kuaidi100') return;
    if (!this.normalizeText(pkg.company_code)) {
      pkg.status = pkg.identify_status === 'failed' ? 'identify_failed' : 'pending_mapping';
      return;
    }
    if (Number(pkg.phone_required) === 1 && this.isKuaidi100PhoneVerifyError(pkg.last_error_code)) {
      pkg.status = 'phone_required';
      return;
    }
    if (pkg.phone_status === 'missing' || pkg.phone_status === 'invalid') {
      pkg.status = 'phone_required';
      return;
    }
    if (!pkg.status || ['pending_mapping', 'phone_required', 'manual_required'].includes(pkg.status)) {
      pkg.status = 'in_transit';
    }
  }

  private async applyExceptionRuleToPackage(pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity) {
    const rule = await this.findExceptionRule(pkg.raw_company_name);
    if (rule) {
      this.applyExceptionRuleToPackageEntity(pkg, rule);
    }
  }

  private applyExceptionRuleToPackageEntity(
    pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity,
    rule: AppAmzBsrLogisticsExceptionRuleEntity
  ) {
    pkg.query_mode = rule.query_mode;
    pkg.company_code = null;
    pkg.company_name = null;
    pkg.company_code_source = null;
    pkg.phone_required = 0;
    pkg.phone_status = 'not_required';
    pkg.status = rule.query_mode;
  }

  private async restorePackageToKuaidi100(pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity) {
    pkg.query_mode = 'kuaidi100';
    pkg.provider = 'kuaidi100';
    pkg.remark = pkg.remark === STALE_PACKAGE_REMARK ? '' : pkg.remark;
    if (!this.normalizeText(pkg.company_code)) {
      pkg.identify_status = 'pending';
      pkg.identify_error_code = null;
      pkg.identify_error_message = null;
      pkg.phone_required = 0;
      pkg.phone_status = 'not_required';
      pkg.status = 'pending_mapping';
      return;
    }
    pkg.phone_required = (await this.isCarrierPhoneRequired(pkg.company_code)) ? 1 : 0;
    pkg.phone_status = resolvePhoneStatus(pkg.phone_required, pkg.contact_phone);
    this.applyPackageBlockers(pkg);
  }

  private disableStalePackages(
    packages: AppAmzBsrPurchaseOrderLogisticsPackageEntity[],
    activeTrackingNos: Set<string>
  ) {
    const changed: AppAmzBsrPurchaseOrderLogisticsPackageEntity[] = [];
    for (const pkg of packages) {
      const trackingNo = this.normalizeText(pkg.tracking_no);
      if (!trackingNo || activeTrackingNos.has(trackingNo)) continue;
      if (pkg.query_mode === 'disabled' && pkg.status === 'disabled' && pkg.remark === STALE_PACKAGE_REMARK) {
        continue;
      }
      pkg.query_mode = 'disabled';
      pkg.status = 'disabled';
      pkg.phone_required = 0;
      pkg.phone_status = 'not_required';
      pkg.remark = STALE_PACKAGE_REMARK;
      changed.push(pkg);
    }
    return changed;
  }

  private async findExceptionRule(rawCompanyName: string) {
    const raw = this.normalizeText(rawCompanyName);
    if (!raw) return null;
    return await this.exceptionRuleRepo.findOne({
      where: [
        { raw_company_name: raw, enabled: 1 },
        { normalized_name: normalizeCompanyName(raw), enabled: 1 },
      ],
      order: { updateTime: 'DESC' },
    });
  }

  private async getPackagesByOrderSn(orderSn: string) {
    return await this.packageRepo.find({
      where: { order_sn: this.normalizeText(orderSn) },
      order: { id: 'ASC' },
    });
  }

  private parseLogisticsInfo(value: any): any[] {
    if (Array.isArray(value)) return value;
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private serializePackagesForCurrentUser(
    packages: AppAmzBsrPurchaseOrderLogisticsPackageEntity[]
  ) {
    return packages.map(pkg => this.serializePackageForCurrentUser(pkg));
  }

  private serializePackageForCurrentUser(pkg: AppAmzBsrPurchaseOrderLogisticsPackageEntity) {
    if (!pkg) return null;
    const user = this.getCurrentAdminUser();
    const queryAvailability = this.resolvePackageUnifiedQueryAvailability(pkg);
    const contactPhone = maskContactPhoneForViewer(
      pkg.contact_phone,
      pkg.contact_phone_created_by_user_id,
      user.userId
    );
    const traceInfo = this.toLegacyTraceInfo(pkg.trace_json);
    const nextQueryAfter = this.isKuaidi100PhoneVerifyError(pkg.last_error_code)
      ? null
      : pkg.next_query_after;

    return {
      ...pkg,
      next_query_after: nextQueryAfter,
      contact_phone: contactPhone,
      contact_phone_masked: contactPhone,
      can_view_contact_phone:
        Boolean(pkg.contact_phone) &&
        Number(pkg.contact_phone_created_by_user_id) === Number(user.userId),
      logistics_order_no: pkg.tracking_no,
      logistics_company: pkg.raw_company_name || pkg.company_name,
      status_text: this.getPackageStatusText(pkg.status),
      trace_info_json: traceInfo,
      raw_response_json: pkg.raw_response_json,
      last_sync_time: pkg.last_query_time,
      latest_trace_text: traceInfo[0]?.remark || '',
      can_query: queryAvailability.allowed,
      query_block_reason: queryAvailability.reason,
      query_hint: queryAvailability.hint,
      warehouse_phone_attempt_enabled:
        queryAvailability.allowed &&
        Number(pkg.phone_required) === 1 &&
        !this.normalizeText(pkg.contact_phone) &&
        Number(pkg.warehouse_wid) > 0,
      query_attempt_count: Number((pkg as any).__query_attempt_count) || 0,
      phone_match_attempts: Array.isArray((pkg as any).__phone_match_attempts)
        ? (pkg as any).__phone_match_attempts
        : [],
    };
  }

  private toLegacyTraceInfo(traceJson: any) {
    const traces = Array.isArray(traceJson) ? traceJson : [];
    return traces.map(trace => ({
      ...trace,
      accept_time: trace.time || trace.ftime || trace.accept_time,
      remark: trace.context || trace.remark || '',
    }));
  }

  private getPackageStatusText(status: string) {
    const map: Record<string, string> = {
      ...PURCHASE_ORDER_LOGISTICS_STATUS_TEXT,
      delivering: '派件中',
      no_result: '暂无轨迹',
      ignored: '已忽略',
      disabled: '已停用',
    };
    return map[status] || status || '未知';
  }

  private getLatestQueryTime(packages: AppAmzBsrPurchaseOrderLogisticsPackageEntity[]) {
    const times = packages
      .map(pkg => parseLogisticsTime(pkg.last_query_time))
      .filter(Boolean)
      .map(date => date.getTime());
    if (times.length === 0) return null;
    return new Date(Math.max(...times));
  }

  private getQueryIntervalMinutes(config: Kuaidi100Config) {
    return Number(config?.minQueryIntervalMinutes) || DEFAULT_QUERY_INTERVAL_MINUTES;
  }

  private normalizeQueryMode(value: any) {
    const mode = this.normalizeText(value);
    if (['kuaidi100', 'manual_required', 'ignored', 'disabled'].includes(mode)) {
      return mode;
    }
    throw new Error('query_mode 不合法');
  }

  private normalizeExceptionQueryMode(value: any) {
    const mode = this.normalizeText(value);
    if (['manual_required', 'ignored', 'disabled'].includes(mode)) {
      return mode;
    }
    throw new Error('例外规则 query_mode 不合法');
  }

  private normalizeText(value: any) {
    return String(value ?? '').trim();
  }

  private getCurrentAdminUser(): AdminUserSnapshot {
    const admin = (this.baseCtx as any)?.admin || {};
    const username = this.normalizeText(admin.username);
    return {
      userId: Number(admin.userId) || null,
      username,
      nickname: this.normalizeText(admin.nickName || admin.name || username),
    };
  }
}
