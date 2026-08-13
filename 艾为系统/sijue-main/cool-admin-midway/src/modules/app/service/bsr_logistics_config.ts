import { BaseService } from '@cool-midway/core';
import { Inject, Provide } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import { BaseSysParamEntity } from '../../base/entity/sys/param';
import { BaseSysParamService } from '../../base/service/sys/param';
import { AppAmzBsrLogisticsCarrierPhoneRuleEntity } from '../entity/bsr_logistics_carrier_phone_rule';
import { AppAmzBsrLogisticsContactEntity } from '../entity/bsr_logistics_contact';
import { AppAmzBsrLogisticsPhoneMatchAttemptEntity } from '../entity/bsr_logistics_phone_match_attempt';
import { AppAmzBsrLogisticsQueryLogEntity } from '../entity/bsr_logistics_query_log';
import { AppAmzBsrLogisticsWarehouseEntity } from '../entity/bsr_logistics_warehouse';
import { AppAmzBsrLogisticsWarehouseContactEntity } from '../entity/bsr_logistics_warehouse_contact';
import { AppAmzBsrPurchaseOrderLogisticsPackageEntity } from '../entity/bsr_purchase_order_logistics_package';
import {
  buildKuaidi100ConfigForEdit,
  KUAIDI100_CONFIG_KEY,
  mergeKuaidi100ConfigForSave,
  normalizeKuaidi100ConfigForRuntime,
} from '../utils/kuaidi100/kuaidi100Config';
import {
  canQueryLogisticsPackage,
  maskContactPhoneForViewer,
  resolvePhoneStatus,
} from '../utils/logistics/purchaseOrderLogisticsRules';
import { AppAmzBsrPurchaseOrderLogisticsService } from './bsr_purchase_order_logistics';
import { AppAmzBsrPurchaseOrderSyncLingxingService } from './bsr_purchase_order_sync_lingxing';

const WORKBENCH_SCOPES = [
  'all',
  'pending_mapping',
  'recognized_pending_query',
  'in_transit',
  'delivering',
  'signed',
  'logistics_exception',
  'identify_failed',
  'phone_required',
  'no_result',
  'manual_required',
  'ignored_disabled',
];
const MAX_MANUAL_BATCH_QUERY_PACKAGES = 100;

@Provide()
export class AppBsrLogisticsConfigService extends BaseService {
  @InjectEntityModel(BaseSysParamEntity)
  baseSysParamRepo: Repository<BaseSysParamEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderLogisticsPackageEntity)
  packageRepo: Repository<AppAmzBsrPurchaseOrderLogisticsPackageEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsQueryLogEntity)
  queryLogRepo: Repository<AppAmzBsrLogisticsQueryLogEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsWarehouseEntity)
  warehouseRepo: Repository<AppAmzBsrLogisticsWarehouseEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsWarehouseContactEntity)
  warehouseContactRepo: Repository<AppAmzBsrLogisticsWarehouseContactEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsContactEntity)
  contactRepo: Repository<AppAmzBsrLogisticsContactEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsCarrierPhoneRuleEntity)
  carrierPhoneRuleRepo: Repository<AppAmzBsrLogisticsCarrierPhoneRuleEntity>;

  @InjectEntityModel(AppAmzBsrLogisticsPhoneMatchAttemptEntity)
  phoneMatchAttemptRepo: Repository<AppAmzBsrLogisticsPhoneMatchAttemptEntity>;

  @Inject()
  baseSysParamService: BaseSysParamService;

  @Inject()
  purchaseOrderLogisticsService: AppAmzBsrPurchaseOrderLogisticsService;

  @Inject()
  purchaseOrderSyncLingxingService: AppAmzBsrPurchaseOrderSyncLingxingService;

  async getKuaidi100Config() {
    const config = await this.getRawKuaidi100Config();
    return {
      config: buildKuaidi100ConfigForEdit(config),
      options: this.getKuaidi100ConfigOptions(),
    };
  }

  async saveKuaidi100Config(payload: any = {}) {
    const existing = await this.getRawKuaidi100Config();
    const next = mergeKuaidi100ConfigForSave(existing, payload?.config || payload);
    const row = await this.baseSysParamRepo.findOneBy({ keyName: KUAIDI100_CONFIG_KEY });
    const data = JSON.stringify(next);

    if (row) {
      row.name = '快递100接口配置';
      row.data = data;
      row.dataType = 0;
      row.remark = '采购单物流快递100配置';
      await this.baseSysParamRepo.save(row);
    } else {
      await this.baseSysParamRepo.save(
        this.baseSysParamRepo.create({
          keyName: KUAIDI100_CONFIG_KEY,
          name: '快递100接口配置',
          data,
          dataType: 0,
          remark: '采购单物流快递100配置',
        })
      );
    }

    await this.baseSysParamService.modifyAfter();
    return this.getKuaidi100Config();
  }

  async getPackages(query: any = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const size = Math.min(Math.max(Number(query.size) || 20, 1), 100);
    const qb = this.packageRepo.createQueryBuilder('p');

    this.applyPackageFilters(qb, query);

    qb.select([
      'p.id',
      'p.createTime',
      'p.updateTime',
      'p.order_sn',
      'p.source_pol_id',
      'p.tracking_no',
      'p.raw_company_name',
      'p.source_items_json',
      'p.warehouse_wid',
      'p.warehouse_name',
      'p.company_code',
      'p.company_name',
      'p.company_code_source',
      'p.identify_status',
      'p.identify_time',
      'p.identify_error_code',
      'p.identify_error_message',
      'p.identify_candidates_json',
      'p.query_mode',
      'p.status',
      'p.provider',
      'p.provider_state',
      'p.provider_status',
      'p.provider_message',
      'p.is_signed',
      'p.sign_time',
      'p.first_trace_time',
      'p.latest_trace_time',
      'p.trace_json',
      'p.raw_response_json',
      'p.phone_required',
      'p.contact_phone',
      'p.phone_source',
      'p.warehouse_contact_binding_id',
      'p.phone_status',
      'p.contact_phone_created_by_user_id',
      'p.contact_phone_created_by_username',
      'p.contact_phone_created_time',
      'p.manual_confirmed',
      'p.manual_confirmed_time',
      'p.manual_confirmed_by_user_id',
      'p.manual_confirmed_by_username',
      'p.last_query_time',
      'p.next_query_after',
      'p.query_count',
      'p.error_count',
      'p.last_error_code',
      'p.last_error_message',
      'p.remark',
    ])
      .orderBy('p.updateTime', 'DESC')
      .skip((page - 1) * size)
      .take(size);

    const [packages, total] = await qb.getManyAndCount();
    const enrichedList = await this.enrichPackagesForWorkbench(packages);
    return {
      list: enrichedList,
      pagination: { page, size, total },
    };
  }

  async getPackageCounts(query: any = {}) {
    const counts: Record<string, number> = {};

    for (const scope of WORKBENCH_SCOPES) {
      const qb = this.packageRepo.createQueryBuilder('p');
      this.applyPackageFilters(qb, { ...query, scope, status: '' }, { includeScope: true });
      counts[scope] = await qb.getCount();
    }

    return { counts };
  }

  async identifyPackage(body: any = {}) {
    const packageId = Number(body?.package_id || body?.id || 0);
    if (!packageId) throw new Error('请选择一个物流包裹');
    const identified = await this.purchaseOrderLogisticsService.identifyPackage(packageId, {
      force: Boolean(body?.force),
    });
    const entity = await this.packageRepo.findOne({ where: { id: packageId } });
    if (!entity) return identified;
    return (await this.enrichPackagesForWorkbench([entity]))[0] || identified;
  }

  async getExceptionRules(query: any = {}) {
    const result = await this.purchaseOrderLogisticsService.listExceptionRules(query);
    const list = result?.list || [];
    if (!list.length) return result;

    const rawNames = list.map((item: any) => this.normalizeText(item.raw_company_name)).filter(Boolean);
    const counts = await this.packageRepo
      .createQueryBuilder('p')
      .select('p.raw_company_name', 'raw_company_name')
      .addSelect('COUNT(*)', 'package_count')
      .where('p.raw_company_name IN (:...rawNames)', { rawNames })
      .groupBy('p.raw_company_name')
      .getRawMany();
    const countMap = new Map(
      counts.map((row: any) => [String(row.raw_company_name), Number(row.package_count) || 0])
    );

    return {
      ...result,
      list: list.map((item: any) => ({
        ...item,
        affected_package_count: countMap.get(String(item.raw_company_name)) || 0,
      })),
    };
  }

  async saveExceptionRule(body: any = {}) {
    return this.purchaseOrderLogisticsService.saveExceptionRule(body);
  }

  async getRawCompanyOptions(query: any = {}) {
    const keyWord = this.normalizeText(query.keyWord);
    const size = Math.min(Math.max(Number(query.size) || 50, 1), 200);
    const qb = this.packageRepo
      .createQueryBuilder('p')
      .select('p.raw_company_name', 'raw_company_name')
      .addSelect('COUNT(*)', 'package_count')
      .where("p.raw_company_name IS NOT NULL AND p.raw_company_name != ''");
    if (keyWord) {
      qb.andWhere('p.raw_company_name LIKE :kw', { kw: `%${keyWord}%` });
    }
    const list = await qb
      .groupBy('p.raw_company_name')
      .orderBy('package_count', 'DESC')
      .limit(size)
      .getRawMany();
    return { list };
  }

  async testQueryPackage(body: any = {}) {
    const packageId = Number(body?.package_id || body?.id || 0);
    if (!packageId) throw new Error('请选择一个物流包裹');
    const queried = await this.purchaseOrderLogisticsService.queryPackage(packageId);
    const entity = await this.packageRepo.findOne({ where: { id: packageId } });
    if (!entity) return queried;
    const enriched = (await this.enrichPackagesForWorkbench([entity]))[0] || queried;
    return {
      ...enriched,
      query_attempt_count: Number(queried?.query_attempt_count) || 0,
      phone_match_attempts: Array.isArray(queried?.phone_match_attempts)
        ? queried.phone_match_attempts
        : [],
    };
  }

  async batchQueryPackages(body: any = {}) {
    const mode = this.normalizeText(body.mode || body.batch_mode || 'selected');
    const limit = Math.min(
      Math.max(Number(body.limit) || MAX_MANUAL_BATCH_QUERY_PACKAGES, 1),
      MAX_MANUAL_BATCH_QUERY_PACKAGES
    );
    const { ids, matchedCount } = await this.resolveBatchPackageIds(body, mode, limit);
    if (!ids.length) {
      return {
        list: [],
        errors: [],
        matched_count: matchedCount,
        processed_count: 0,
        limit,
        summary: {
          total: 0,
          real_query_count: 0,
          skipped_count: 0,
          error_count: 0,
          reasons: {},
        },
      };
    }

    const beforeRows = await this.packageRepo.find({
      where: { id: In(ids) },
      select: ['id', 'last_query_time'],
    });
    const beforeTimeMap = new Map(
      beforeRows.map(row => [Number(row.id), this.parseQueryTime(row.last_query_time)])
    );
    const list = [];
    const errors = [];
    const reasons: Record<string, number> = {};
    let realQueryCount = 0;
    let skippedCount = 0;

    for (const id of ids) {
      try {
        const row = await this.purchaseOrderLogisticsService.queryPackage(id);
        if (!row) {
          skippedCount += 1;
          reasons['物流包裹不存在'] = (reasons['物流包裹不存在'] || 0) + 1;
          continue;
        }
        list.push(row);
        const attemptCount = Number(row.query_attempt_count) || 0;
        if (attemptCount > 0) {
          realQueryCount += attemptCount;
        } else {
          const beforeTime = beforeTimeMap.get(Number(id)) || null;
          const afterTime = this.parseQueryTime(row.last_query_time || row.last_sync_time);
          if (afterTime && afterTime !== beforeTime) {
            realQueryCount += 1;
            continue;
          }
          skippedCount += 1;
          const reason = this.getBatchSkipReason(row);
          reasons[reason] = (reasons[reason] || 0) + 1;
        }
      } catch (e: any) {
        skippedCount += 1;
        const message = e?.message || '查询失败';
        errors.push({ package_id: id, message });
        reasons[`查询失败：${message}`] = (reasons[`查询失败：${message}`] || 0) + 1;
      }
    }

    return {
      list,
      errors,
      matched_count: matchedCount,
      processed_count: ids.length,
      limit,
      summary: {
        total: ids.length,
        real_query_count: realQueryCount,
        skipped_count: skippedCount,
        error_count: errors.length,
        reasons,
      },
    };
  }

  async updatePackagePhone(body: any = {}) {
    return this.purchaseOrderLogisticsService.updatePackagePhone(body);
  }

  async updatePackageCompany(body: any = {}) {
    return this.purchaseOrderLogisticsService.updatePackageCompany(body);
  }

  async getPackageQueryLogs(body: any = {}) {
    const packageId = Number(body?.package_id || body?.id || 0);
    if (!packageId) throw new Error('请选择一个物流包裹');
    const page = Math.max(Number(body.page) || 1, 1);
    const size = Math.min(Math.max(Number(body.size) || 50, 1), 100);
    const [list, total] = await this.queryLogRepo.findAndCount({
      where: { package_id: packageId },
      order: { createTime: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return { list, pagination: { page, size, total } };
  }

  async getQueryStats(query: any = {}) {
    return this.purchaseOrderLogisticsService.getQueryStats(query);
  }

  async syncWarehousesFromLingxing() {
    const grouped = await this.purchaseOrderSyncLingxingService.getWarehouseList();
    const typeDefs = [
      { key: 'local', warehouse_type: 'local', lingxing_type: 1 },
      { key: 'overseas', warehouse_type: 'overseas', lingxing_type: 3 },
      { key: 'awd', warehouse_type: 'awd', lingxing_type: 6 },
    ];
    const now = new Date();
    const seenWids = new Set<number>();
    let synced = 0;

    for (const def of typeDefs) {
      const list = Array.isArray(grouped?.[def.key]) ? grouped[def.key] : [];
      for (const item of list) {
        const wid = Number(item?.wid) || 0;
        const warehouseName = this.normalizeText(item?.name || item?.warehouse_name);
        if (!wid || !warehouseName) continue;
        seenWids.add(wid);
        let row = await this.warehouseRepo.findOne({ where: { wid } });
        if (!row) {
          row = this.warehouseRepo.create({ wid });
        }
        row.warehouse_name = warehouseName;
        row.warehouse_type = def.warehouse_type;
        row.lingxing_type = def.lingxing_type;
        row.cloud_status = 'active';
        row.last_seen_time = now;
        row.removed_time = null;
        row.raw_data = item?.raw_data || item;
        await this.warehouseRepo.save(row);
        synced += 1;
      }
    }

    let removed = 0;
    if (seenWids.size > 0) {
      const result = await this.warehouseRepo
        .createQueryBuilder()
        .update(AppAmzBsrLogisticsWarehouseEntity)
        .set({ cloud_status: 'removed', removed_time: now })
        .where('wid NOT IN (:...seenWids)', { seenWids: Array.from(seenWids) })
        .andWhere("cloud_status != 'removed'")
        .execute();
      removed = Number(result.affected) || 0;
    }

    return { synced, removed, total_seen: seenWids.size };
  }

  async getWarehouses(query: any = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const size = Math.min(Math.max(Number(query.size) || 20, 1), 100);
    const keyWord = this.normalizeText(query.keyWord);
    const cloudStatus = this.normalizeText(query.cloud_status);
    const warehouseType = this.normalizeText(query.warehouse_type);
    const contactStatus = this.normalizeText(query.contact_status);
    const qb = this.warehouseRepo.createQueryBuilder('w');
    qb.where('1 = 1');
    if (keyWord) {
      qb.andWhere('(w.warehouse_name LIKE :kw OR CAST(w.wid AS CHAR) LIKE :kw)', {
        kw: `%${keyWord}%`,
      });
    }
    if (cloudStatus) qb.andWhere('w.cloud_status = :cloudStatus', { cloudStatus });
    if (warehouseType) qb.andWhere('w.warehouse_type = :warehouseType', { warehouseType });
    const activeContactExists = `
      EXISTS (
        SELECT 1
        FROM app_amz_bsr_logistics_warehouse_contact wc
        JOIN app_amz_bsr_logistics_contact c ON c.id = wc.contact_id
        WHERE wc.warehouse_wid = w.wid
          AND wc.enabled = 1
          AND c.enabled = 1
      )
    `;
    if (contactStatus === 'has_contact') {
      qb.andWhere(activeContactExists);
    } else if (contactStatus === 'no_contact') {
      qb.andWhere(`NOT ${activeContactExists}`);
    }
    qb.orderBy("CASE WHEN w.cloud_status = 'removed' THEN 1 ELSE 0 END", 'ASC')
      .addOrderBy('w.warehouse_type', 'ASC')
      .addOrderBy('w.warehouse_name', 'ASC')
      .skip((page - 1) * size)
      .take(size);
    const [list, total] = await qb.getManyAndCount();
    const widList = list.map(row => Number(row.wid)).filter(Boolean);
    const contactCountMap = await this.queryWarehouseContactCountMap(widList);
    const contactSummaryMap = await this.queryWarehouseContactSummaryMap(widList);
    return {
      list: list.map(row => ({
        ...row,
        contact_count: contactCountMap.get(Number(row.wid)) || 0,
        contact_summary: contactSummaryMap.get(Number(row.wid)) || [],
      })),
      pagination: { page, size, total },
    };
  }

  async getWarehouseContacts(query: any = {}) {
    const warehouseWid = Number(query.warehouse_wid || query.wid || 0);
    if (!warehouseWid) throw new Error('请选择仓库');
    const list = await this.warehouseContactRepo
      .createQueryBuilder('wc')
      .leftJoin(AppAmzBsrLogisticsContactEntity, 'c', 'c.id = wc.contact_id')
      .select([
        'wc.id AS id',
        'wc.warehouse_wid AS warehouse_wid',
        'wc.contact_id AS contact_id',
        'wc.priority AS priority',
        'wc.enabled AS enabled',
        'wc.remark AS remark',
        'wc.createTime AS createTime',
        'wc.updateTime AS updateTime',
        'c.contact_name AS contact_name',
        'c.contact_phone AS contact_phone',
        'c.enabled AS contact_enabled',
        'c.remark AS contact_remark',
      ])
      .where('wc.warehouse_wid = :warehouseWid', { warehouseWid })
      .orderBy('wc.priority', 'ASC')
      .addOrderBy('wc.id', 'ASC')
      .getRawMany();
    return { list };
  }

  async saveWarehouseContact(body: any = {}) {
    const id = Number(body.id || 0);
    const warehouseWid = Number(body.warehouse_wid || body.wid || 0);
    if (!warehouseWid) throw new Error('请选择仓库');
    const contactId = await this.resolveContactIdForSave(body);

    let row = id ? await this.warehouseContactRepo.findOne({ where: { id } }) : null;
    if (!row) {
      row = await this.warehouseContactRepo.findOne({
        where: { warehouse_wid: warehouseWid, contact_id: contactId },
      });
    }
    if (!row) {
      row = this.warehouseContactRepo.create({ warehouse_wid: warehouseWid });
    }
    row.warehouse_wid = warehouseWid;
    row.contact_id = contactId;
    row.priority = Number(body.priority) || 100;
    row.enabled = body.enabled === undefined ? 1 : Number(body.enabled) === 1 ? 1 : 0;
    row.remark = this.normalizeText(body.remark);
    await this.warehouseContactRepo.save(row);
    return row;
  }

  async getContacts(query: any = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const size = Math.min(Math.max(Number(query.size) || 20, 1), 100);
    const keyWord = this.normalizeText(query.keyWord);
    const enabled = query.enabled === '' || query.enabled === undefined ? '' : Number(query.enabled);
    const qb = this.contactRepo.createQueryBuilder('c');
    qb.where('1 = 1');
    if (keyWord) {
      qb.andWhere('(c.contact_name LIKE :kw OR c.contact_phone LIKE :kw)', { kw: `%${keyWord}%` });
    }
    if (enabled === 0 || enabled === 1) qb.andWhere('c.enabled = :enabled', { enabled });
    qb.orderBy('c.enabled', 'DESC')
      .addOrderBy('c.updateTime', 'DESC')
      .skip((page - 1) * size)
      .take(size);
    const [list, total] = await qb.getManyAndCount();
    const contactIds = list.map(row => Number(row.id)).filter(Boolean);
    const warehouseSummaryMap = await this.queryContactWarehouseSummaryMap(contactIds);
    return {
      list: list.map(row => ({
        ...row,
        warehouse_count: warehouseSummaryMap.get(Number(row.id))?.count || 0,
        warehouse_summary: warehouseSummaryMap.get(Number(row.id))?.list || [],
      })),
      pagination: { page, size, total },
    };
  }

  async saveContact(body: any = {}) {
    const id = Number(body.id || 0);
    const contactPhone = this.normalizeText(body.contact_phone);
    if (!contactPhone) throw new Error('请填写联系人手机号');
    let row = id ? await this.contactRepo.findOne({ where: { id } }) : null;
    if (!row) {
      row = await this.contactRepo.findOne({ where: { contact_phone: contactPhone } });
    }
    if (!row) row = this.contactRepo.create();
    row.contact_name = this.normalizeText(body.contact_name);
    row.contact_phone = contactPhone;
    row.enabled = body.enabled === undefined ? 1 : Number(body.enabled) === 1 ? 1 : 0;
    row.remark = this.normalizeText(body.remark);
    return this.contactRepo.save(row);
  }

  async deleteContact(body: any = {}) {
    const id = Number(body.id || body.contact_id || 0);
    if (!id) throw new Error('请选择联系人');
    await this.contactRepo.update(id, { enabled: 0 });
    await this.warehouseContactRepo.update({ contact_id: id }, { enabled: 0 });
    return { disabled: 1 };
  }

  async getContactWarehouses(body: any = {}) {
    const contactId = Number(body.id || body.contact_id || 0);
    if (!contactId) throw new Error('请选择联系人');
    const list = await this.warehouseContactRepo
      .createQueryBuilder('wc')
      .leftJoin(AppAmzBsrLogisticsWarehouseEntity, 'w', 'w.wid = wc.warehouse_wid')
      .select([
        'wc.id AS id',
        'wc.warehouse_wid AS warehouse_wid',
        'wc.contact_id AS contact_id',
        'wc.priority AS priority',
        'wc.enabled AS enabled',
        'wc.remark AS remark',
        'w.warehouse_name AS warehouse_name',
        'w.warehouse_type AS warehouse_type',
        'w.cloud_status AS cloud_status',
      ])
      .where('wc.contact_id = :contactId', { contactId })
      .orderBy('w.warehouse_type', 'ASC')
      .addOrderBy('w.warehouse_name', 'ASC')
      .getRawMany();
    return { list };
  }

  async bindContactWarehouses(body: any = {}) {
    const contactId = Number(body.contact_id || body.id || 0);
    const warehouseWids: number[] = Array.from(
      new Set<number>(
        (Array.isArray(body.warehouse_wids) ? body.warehouse_wids : [])
          .map(Number)
          .filter((value: number) => Number.isFinite(value) && value > 0)
      )
    );
    if (!contactId) throw new Error('请选择联系人');
    if (!warehouseWids.length) throw new Error('请选择仓库');
    const contact = await this.contactRepo.findOne({ where: { id: contactId } });
    if (!contact) throw new Error('联系人不存在');
    let saved = 0;
    for (const warehouseWid of warehouseWids) {
      let row = await this.warehouseContactRepo.findOne({
        where: { warehouse_wid: warehouseWid, contact_id: contactId },
      });
      if (!row) {
        row = this.warehouseContactRepo.create({
          warehouse_wid: warehouseWid,
          contact_id: contactId,
        });
      }
      row.priority = Number(body.priority) || Number(row.priority) || 100;
      row.enabled = body.enabled === undefined ? Number(row.enabled ?? 1) || 1 : Number(body.enabled) === 1 ? 1 : 0;
      row.remark = this.normalizeText(body.remark || row.remark);
      await this.warehouseContactRepo.save(row);
      saved += 1;
    }
    return { saved };
  }

  async deleteWarehouseContact(body: any = {}) {
    const id = Number(body.id || body.contact_id || 0);
    if (!id) throw new Error('请选择联系人');
    await this.warehouseContactRepo.delete(id);
    return { deleted: 1 };
  }

  async getCarrierPhoneRules(query: any = {}) {
    const page = Math.max(Number(query.page) || 1, 1);
    const size = Math.min(Math.max(Number(query.size) || 50, 1), 200);
    const keyWord = this.normalizeText(query.keyWord);
    const qb = this.carrierPhoneRuleRepo.createQueryBuilder('r');
    qb.where('1 = 1');
    if (keyWord) {
      qb.andWhere('(r.company_code LIKE :kw OR r.company_name LIKE :kw)', { kw: `%${keyWord}%` });
    }
    qb.orderBy('r.enabled', 'DESC')
      .addOrderBy('r.need_phone', 'DESC')
      .addOrderBy('r.company_code', 'ASC')
      .skip((page - 1) * size)
      .take(size);
    const [list, total] = await qb.getManyAndCount();
    return { list, pagination: { page, size, total } };
  }

  async getCarrierPhoneRuleOptions(query: any = {}) {
    const keyWord = this.normalizeText(query.keyWord);
    const size = Math.min(Math.max(Number(query.size) || 80, 1), 200);
    const optionMap = new Map<string, any>();

    const ruleQb = this.carrierPhoneRuleRepo.createQueryBuilder('r');
    ruleQb.where('1 = 1');
    if (keyWord) {
      ruleQb.andWhere('(r.company_code LIKE :kw OR r.company_name LIKE :kw)', {
        kw: `%${keyWord}%`,
      });
    }
    const rules = await ruleQb
      .orderBy('r.enabled', 'DESC')
      .addOrderBy('r.need_phone', 'DESC')
      .addOrderBy('r.company_code', 'ASC')
      .take(size)
      .getMany();

    for (const rule of rules) {
      const companyCode = this.normalizeText(rule.company_code).toLowerCase();
      if (!companyCode) continue;
      optionMap.set(companyCode, {
        company_code: companyCode,
        company_name: this.normalizeText(rule.company_name) || companyCode,
        source: 'rule',
        package_count: 0,
        has_rule: true,
        need_phone: Number(rule.need_phone) === 1 ? 1 : 0,
        enabled: Number(rule.enabled) === 1 ? 1 : 0,
        rule_id: rule.id,
      });
    }

    const packageRows = await this.packageRepo
      .createQueryBuilder('p')
      .select('LOWER(p.company_code)', 'company_code')
      .addSelect(
        `SUBSTRING_INDEX(
          GROUP_CONCAT(COALESCE(p.company_name, '') ORDER BY p.updateTime DESC SEPARATOR '\n'),
          '\n',
          1
        )`,
        'company_name'
      )
      .addSelect('COUNT(*)', 'package_count')
      .addSelect('MAX(p.updateTime)', 'latest_seen_time')
      .where("p.company_code IS NOT NULL AND p.company_code != ''")
      .andWhere(
        keyWord
          ? '(p.company_code LIKE :kw OR p.company_name LIKE :kw OR p.raw_company_name LIKE :kw)'
          : '1 = 1',
        keyWord ? { kw: `%${keyWord}%` } : {}
      )
      .groupBy('LOWER(p.company_code)')
      .orderBy('package_count', 'DESC')
      .limit(size)
      .getRawMany();

    for (const row of packageRows) {
      const companyCode = this.normalizeText(row.company_code).toLowerCase();
      if (!companyCode) continue;
      const existing = optionMap.get(companyCode);
      if (existing) {
        existing.package_count = Number(row.package_count) || 0;
        existing.latest_seen_time = row.latest_seen_time || null;
        if (!existing.company_name || existing.company_name === companyCode) {
          existing.company_name = this.normalizeText(row.company_name) || companyCode;
        }
        continue;
      }
      optionMap.set(companyCode, {
        company_code: companyCode,
        company_name: this.normalizeText(row.company_name) || companyCode,
        source: 'package',
        package_count: Number(row.package_count) || 0,
        latest_seen_time: row.latest_seen_time || null,
        has_rule: false,
        need_phone: 0,
        enabled: 1,
        rule_id: null,
      });
    }

    const list = Array.from(optionMap.values())
      .sort((a, b) => {
        if (a.has_rule !== b.has_rule) return a.has_rule ? -1 : 1;
        return (Number(b.package_count) || 0) - (Number(a.package_count) || 0);
      })
      .slice(0, size);
    return { list };
  }

  async saveCarrierPhoneRule(body: any = {}) {
    const id = Number(body.id || 0);
    const companyCode = this.normalizeText(body.company_code).toLowerCase();
    if (!companyCode) throw new Error('请填写快递100编码');
    let row = id ? await this.carrierPhoneRuleRepo.findOne({ where: { id } }) : null;
    if (!row) {
      row =
        (await this.carrierPhoneRuleRepo.findOne({ where: { company_code: companyCode } })) ||
        this.carrierPhoneRuleRepo.create({ company_code: companyCode });
    }
    row.company_code = companyCode;
    row.company_name = this.normalizeText(body.company_name);
    row.need_phone = Number(body.need_phone) === 1 || body.need_phone === true ? 1 : 0;
    row.enabled = body.enabled === undefined ? 1 : Number(body.enabled) === 1 ? 1 : 0;
    row.remark = this.normalizeText(body.remark);
    await this.carrierPhoneRuleRepo.save(row);
    const affectedPackages = await this.applyCarrierPhoneRuleToPackages(row);
    return { rule: row, affected_packages: affectedPackages };
  }

  async getPhoneMatchAttempts(query: any = {}) {
    const packageId = Number(query.package_id || query.id || 0);
    if (!packageId) throw new Error('请选择物流包裹');
    const page = Math.max(Number(query.page) || 1, 1);
    const size = Math.min(Math.max(Number(query.size) || 50, 1), 100);
    const [list, total] = await this.phoneMatchAttemptRepo.findAndCount({
      where: { package_id: packageId },
      order: { createTime: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    const contactIds = Array.from(new Set(list.map(row => Number(row.contact_id)).filter(Boolean)));
    const contactMap = await this.queryContactMasterMap(contactIds);
    return {
      list: list.map(row => {
        const contact = contactMap.get(Number(row.contact_id));
        return {
          ...row,
          contact_name: contact?.contact_name || '',
          contact_phone_masked: maskContactPhoneForViewer(
            row.contact_phone || contact?.contact_phone,
            null,
            null
          ),
        };
      }),
      pagination: { page, size, total },
    };
  }

  async getDashboard(query: any = {}) {
    const [config, packages, stats] = await Promise.all([
      this.getKuaidi100Config(),
      this.getPackages({ page: 1, size: 10, keyWord: query.keyWord, scope: 'all' }),
      this.getQueryStats(query),
    ]);
    return { config, packages, stats };
  }

  private applyPackageFilters(qb: any, query: any, options: { includeScope?: boolean } = {}) {
    const scope = this.normalizeText(query.scope || query.package_scope || 'all');
    const status = this.normalizeText(query.status || query.package_status);
    const keyWord = this.normalizeText(query.keyWord);
    const orderSn = this.normalizeText(query.order_sn);
    const trackingNo = this.normalizeText(query.tracking_no);
    const rawCompanyName = this.normalizeText(query.raw_company_name);
    const companyCode = this.normalizeText(query.company_code);
    const queryMode = this.normalizeText(query.query_mode);

    qb.where('1 = 1');

    if (options.includeScope !== false) {
      this.applyScopeFilter(qb, scope, status);
    }
    if (orderSn) qb.andWhere('p.order_sn = :orderSn', { orderSn });
    if (trackingNo) qb.andWhere('p.tracking_no = :trackingNo', { trackingNo });
    if (rawCompanyName) qb.andWhere('p.raw_company_name = :rawCompanyName', { rawCompanyName });
    if (companyCode) qb.andWhere('p.company_code = :companyCode', { companyCode });
    if (queryMode) qb.andWhere('p.query_mode = :queryMode', { queryMode });
    if (keyWord) {
      qb.andWhere(
        '(p.order_sn LIKE :kw OR p.tracking_no LIKE :kw OR p.raw_company_name LIKE :kw OR p.company_code LIKE :kw OR p.company_name LIKE :kw)',
        { kw: `%${keyWord}%` }
      );
    }
  }

  private async enrichPackagesForWorkbench(
    packages: AppAmzBsrPurchaseOrderLogisticsPackageEntity[]
  ) {
    const rows = this.serializePackages(packages);
    const warehouseWids: number[] = Array.from(
      new Set(rows.map(row => Number(row.warehouse_wid)).filter(Boolean))
    );
    const packageIds = rows.map(row => Number(row.id)).filter(Boolean);
    const bindingIds: number[] = Array.from(
      new Set(rows.map(row => Number(row.warehouse_contact_binding_id)).filter(Boolean))
    );
    const contactCountMap = await this.queryWarehouseContactCountMap(warehouseWids);
    const matchedContactMap = await this.queryBindingContactMap(bindingIds);
    const latestAttemptMap = await this.queryLatestPhoneAttemptMap(packageIds);
    const failedPhoneAttemptCountMap = await this.queryWarehousePhoneFailedCountMap(packageIds);

    const orderSns: string[] = Array.from(
      new Set(rows.map(row => this.normalizeText(row.order_sn)).filter(Boolean))
    );
    if (!orderSns.length) {
      return rows.map(row =>
        this.attachPhoneMatchSummary(
          row,
          contactCountMap,
          matchedContactMap,
          latestAttemptMap,
          failedPhoneAttemptCountMap
        )
      );
    }

    const placeholders = orderSns.map(() => '?').join(',');
    const orderRows = await this.packageRepo.manager.query(
      `
        SELECT
          order_sn,
          status,
          status_text,
          status_shipped,
          status_shipped_text,
          supplier_name,
          ware_house_name,
          order_time,
          quantity_total,
          quantity_real,
          quantity_entry,
          quantity_receive
        FROM app_amz_bsr_purchase_order_sync_lingxing
        WHERE order_sn IN (${placeholders})
      `,
      orderSns
    );
    const orderMap = new Map(
      orderRows.map((row: any) => [this.normalizeText(row.order_sn), row])
    );

    const itemRows = await this.packageRepo.manager.query(
      `
        SELECT
          id,
          order_sn,
          item_id,
          plan_sn,
          relation_purchase_plan,
          product_name,
          sku,
          fnsku,
          msku,
          first_msku,
          quantity_plan,
          quantity_real,
          quantity_entry,
          quantity_receive,
          plan_pic_url,
          plan_supplier_name,
          plan_warehouse_name,
          plan_seller_name,
          plan_marketplace
        FROM app_amz_bsr_purchase_order_item_sync_lingxing
        WHERE order_sn IN (${placeholders})
          AND (is_delete IS NULL OR is_delete = 0)
        ORDER BY order_sn ASC, id ASC
      `,
      orderSns
    );

    const planSns: string[] = Array.from(
      new Set(
        itemRows
          .flatMap((item: any) => [
            this.normalizeText(item.plan_sn),
            ...this.parseJsonArray(item.relation_purchase_plan).map((value: any) => this.normalizeText(value)),
          ])
          .filter(Boolean)
      )
    );
    const planMap = await this.queryPlanSummaryMap(planSns);
    const itemMap = this.buildProductItemsByOrder(itemRows, planMap);

    return rows.map(row => {
      const orderSn = this.normalizeText(row.order_sn);
      const productItems = itemMap.get(orderSn) || [];
      const planSnList = Array.from(
        new Set(productItems.flatMap((item: any) => item.plan_sns || []).filter(Boolean))
      );
      return {
        ...this.attachPhoneMatchSummary(
          row,
          contactCountMap,
          matchedContactMap,
          latestAttemptMap,
          failedPhoneAttemptCountMap
        ),
        order_summary: this.buildOrderSummary(orderMap.get(orderSn)),
        product_items: productItems,
        product_count: productItems.length,
        plan_sns: planSnList,
        product_summary: this.buildProductSummary(productItems),
      };
    });
  }

  private async queryWarehouseContactCountMap(warehouseWids: number[]): Promise<Map<number, number>> {
    if (!warehouseWids.length) return new Map<number, number>();
    const rows = await this.warehouseContactRepo
      .createQueryBuilder('wc')
      .leftJoin(AppAmzBsrLogisticsContactEntity, 'c', 'c.id = wc.contact_id')
      .select('wc.warehouse_wid', 'warehouse_wid')
      .addSelect('COUNT(*)', 'contact_count')
      .where('wc.warehouse_wid IN (:...warehouseWids)', { warehouseWids })
      .andWhere('wc.enabled = 1')
      .andWhere('c.enabled = 1')
      .groupBy('wc.warehouse_wid')
      .getRawMany();
    return new Map<number, number>(
      rows.map((row: any) => [Number(row.warehouse_wid), Number(row.contact_count) || 0])
    );
  }

  private async queryWarehouseContactSummaryMap(warehouseWids: number[]): Promise<Map<number, any[]>> {
    if (!warehouseWids.length) return new Map<number, any[]>();
    const rows = await this.warehouseContactRepo
      .createQueryBuilder('wc')
      .leftJoin(AppAmzBsrLogisticsContactEntity, 'c', 'c.id = wc.contact_id')
      .select([
        'wc.warehouse_wid AS warehouse_wid',
        'wc.id AS binding_id',
        'wc.priority AS priority',
        'c.id AS contact_id',
        'c.contact_name AS contact_name',
        'c.contact_phone AS contact_phone',
      ])
      .where('wc.warehouse_wid IN (:...warehouseWids)', { warehouseWids })
      .andWhere('wc.enabled = 1')
      .andWhere('c.enabled = 1')
      .orderBy('wc.priority', 'ASC')
      .addOrderBy('wc.id', 'ASC')
      .getRawMany();
    const map = new Map<number, any[]>();
    for (const row of rows) {
      const warehouseWid = Number(row.warehouse_wid);
      if (!map.has(warehouseWid)) map.set(warehouseWid, []);
      map.get(warehouseWid)!.push({
        binding_id: Number(row.binding_id),
        contact_id: Number(row.contact_id),
        contact_name: row.contact_name || '',
        contact_phone: row.contact_phone || '',
        contact_phone_masked: maskContactPhoneForViewer(row.contact_phone || '', null, null),
        priority: Number(row.priority) || 100,
      });
    }
    return map;
  }

  private async queryBindingContactMap(bindingIds: number[]): Promise<Map<number, any>> {
    if (!bindingIds.length) return new Map<number, any>();
    const rows = await this.warehouseContactRepo
      .createQueryBuilder('wc')
      .leftJoin(AppAmzBsrLogisticsContactEntity, 'c', 'c.id = wc.contact_id')
      .select([
        'wc.id AS binding_id',
        'wc.contact_id AS contact_id',
        'c.contact_name AS contact_name',
        'c.contact_phone AS contact_phone',
      ])
      .where('wc.id IN (:...bindingIds)', { bindingIds })
      .getRawMany();
    return new Map<number, any>(rows.map((row: any) => [Number(row.binding_id), row]));
  }

  private async queryContactMasterMap(contactIds: number[]): Promise<Map<number, AppAmzBsrLogisticsContactEntity>> {
    if (!contactIds.length) return new Map<number, AppAmzBsrLogisticsContactEntity>();
    const contacts = await this.contactRepo.find({ where: { id: In(contactIds) } });
    return new Map(contacts.map(contact => [Number(contact.id), contact]));
  }

  private async queryContactWarehouseSummaryMap(
    contactIds: number[]
  ): Promise<Map<number, { count: number; list: any[] }>> {
    if (!contactIds.length) return new Map<number, { count: number; list: any[] }>();
    const rows = await this.warehouseContactRepo
      .createQueryBuilder('wc')
      .leftJoin(AppAmzBsrLogisticsWarehouseEntity, 'w', 'w.wid = wc.warehouse_wid')
      .select([
        'wc.contact_id AS contact_id',
        'wc.warehouse_wid AS warehouse_wid',
        'wc.enabled AS enabled',
        'w.warehouse_name AS warehouse_name',
        'w.warehouse_type AS warehouse_type',
        'w.cloud_status AS cloud_status',
      ])
      .where('wc.contact_id IN (:...contactIds)', { contactIds })
      .orderBy('w.warehouse_type', 'ASC')
      .addOrderBy('w.warehouse_name', 'ASC')
      .getRawMany();
    const map = new Map<number, { count: number; list: any[] }>();
    for (const row of rows) {
      const contactId = Number(row.contact_id);
      if (!map.has(contactId)) map.set(contactId, { count: 0, list: [] });
      const item = map.get(contactId);
      item!.count += Number(row.enabled) === 1 ? 1 : 0;
      if (item!.list.length < 5) {
        item!.list.push({
          warehouse_wid: Number(row.warehouse_wid),
          warehouse_name: row.warehouse_name || '',
          warehouse_type: row.warehouse_type || '',
          cloud_status: row.cloud_status || '',
          enabled: Number(row.enabled) || 0,
        });
      }
    }
    return map;
  }

  private async resolveContactIdForSave(body: any = {}) {
    const id = Number(body.contact_id || 0);
    if (id) {
      const contact = await this.contactRepo.findOne({ where: { id } });
      if (!contact) throw new Error('联系人不存在');
      return id;
    }
    const contactPhone = this.normalizeText(body.contact_phone);
    if (!contactPhone) throw new Error('请填写联系人手机号');
    let contact = await this.contactRepo.findOne({ where: { contact_phone: contactPhone } });
    if (!contact) {
      contact = this.contactRepo.create({
        contact_phone: contactPhone,
      });
    }
    contact.contact_name = this.normalizeText(body.contact_name || contact.contact_name);
    contact.contact_phone = contactPhone;
    contact.enabled = body.contact_enabled === undefined ? Number(contact.enabled ?? 1) || 1 : Number(body.contact_enabled) === 1 ? 1 : 0;
    contact.remark = this.normalizeText(body.contact_remark || contact.remark);
    const saved = await this.contactRepo.save(contact);
    return Number(saved.id);
  }

  private async queryLatestPhoneAttemptMap(
    packageIds: number[]
  ): Promise<Map<number, AppAmzBsrLogisticsPhoneMatchAttemptEntity>> {
    if (!packageIds.length) return new Map<number, AppAmzBsrLogisticsPhoneMatchAttemptEntity>();
    const attempts = await this.phoneMatchAttemptRepo.find({
      where: { package_id: In(packageIds) },
      order: { createTime: 'DESC' },
    });
    const map = new Map<number, AppAmzBsrLogisticsPhoneMatchAttemptEntity>();
    for (const attempt of attempts) {
      const packageId = Number(attempt.package_id);
      if (!map.has(packageId)) map.set(packageId, attempt);
    }
    return map;
  }

  private async queryWarehousePhoneFailedCountMap(packageIds: number[]): Promise<Map<number, number>> {
    if (!packageIds.length) return new Map<number, number>();
    const placeholders = packageIds.map(() => '?').join(',');
    const rows = await this.packageRepo.manager.query(
      `
        SELECT
          a.package_id,
          COUNT(DISTINCT a.warehouse_contact_binding_id) AS failed_count
        FROM app_amz_bsr_logistics_phone_match_attempt a
        JOIN app_amz_bsr_purchase_order_logistics_package p ON p.id = a.package_id
        JOIN app_amz_bsr_logistics_warehouse_contact wc
          ON wc.id = a.warehouse_contact_binding_id
          AND wc.warehouse_wid = p.warehouse_wid
          AND wc.enabled = 1
        JOIN app_amz_bsr_logistics_contact c
          ON c.id = wc.contact_id
          AND c.enabled = 1
          AND c.contact_phone = a.contact_phone
        WHERE a.package_id IN (${placeholders})
          AND a.success = 0
          AND a.return_code = '408'
          AND a.warehouse_contact_binding_id IS NOT NULL
        GROUP BY a.package_id
      `,
      packageIds
    );
    return new Map<number, number>(
      rows.map((row: any) => [Number(row.package_id), Number(row.failed_count) || 0])
    );
  }

  private async applyCarrierPhoneRuleToPackages(
    rule: AppAmzBsrLogisticsCarrierPhoneRuleEntity
  ) {
    const companyCode = this.normalizeText(rule.company_code).toLowerCase();
    if (!companyCode) return 0;
    const packages = await this.packageRepo.find({
      where: { company_code: companyCode, query_mode: 'kuaidi100' },
    });
    for (const pkg of packages) {
      if (Number(pkg.is_signed) === 1 || pkg.status === 'signed') continue;
      pkg.phone_required =
        Number(rule.enabled) === 1 && Number(rule.need_phone) === 1 ? 1 : 0;
      pkg.phone_status = resolvePhoneStatus(pkg.phone_required, pkg.contact_phone);
      if (Number(pkg.phone_required) !== 1) {
        if (pkg.status === 'phone_required') pkg.status = 'in_transit';
        if (String(pkg.last_error_code || '').trim() === '408') {
          pkg.last_error_code = null;
          pkg.last_error_message = null;
          pkg.provider_message = null;
          pkg.next_query_after = null;
        }
      } else if (pkg.phone_status === 'missing' || pkg.phone_status === 'invalid') {
        pkg.status = 'phone_required';
      }
    }
    if (packages.length > 0) await this.packageRepo.save(packages);
    return packages.length;
  }

  private attachPhoneMatchSummary(
    row: any,
    contactCountMap: Map<number, number>,
    matchedContactMap: Map<number, any>,
    latestAttemptMap: Map<number, AppAmzBsrLogisticsPhoneMatchAttemptEntity>,
    failedPhoneAttemptCountMap: Map<number, number>
  ) {
    const matchedContact = matchedContactMap.get(Number(row.warehouse_contact_binding_id));
    const latestAttempt = latestAttemptMap.get(Number(row.id));
    const warehouseContactCount = contactCountMap.get(Number(row.warehouse_wid)) || 0;
    const queryCapability = this.resolveWorkbenchQueryCapability(
      row,
      warehouseContactCount,
      failedPhoneAttemptCountMap.get(Number(row.id)) || 0
    );
    return {
      ...row,
      warehouse_contact_count: warehouseContactCount,
      matched_contact_name: matchedContact?.contact_name || '',
      matched_contact_phone_masked: maskContactPhoneForViewer(matchedContact?.contact_phone || '', null, null),
      latest_phone_match_message: latestAttempt?.message || '',
      latest_phone_match_success:
        latestAttempt?.success === undefined ? null : Number(latestAttempt.success),
      can_query: queryCapability.can_query,
      query_block_reason: queryCapability.query_block_reason,
      warehouse_phone_attempt_enabled: queryCapability.warehouse_phone_attempt_enabled,
    };
  }

  private resolveWorkbenchQueryCapability(
    row: any,
    warehouseContactCount: number,
    failedPhoneAttemptCount: number
  ) {
    const baseAllowed = row.can_query === true;
    const baseReason = this.normalizeText(row.query_block_reason);
    if (baseAllowed) {
      return {
        can_query: true,
        query_block_reason: baseReason || 'ok',
        warehouse_phone_attempt_enabled: false,
      };
    }

    if (baseReason === 'pending_mapping' || baseReason === 'identify_failed') {
      return {
        can_query: true,
        query_block_reason: 'ok',
        warehouse_phone_attempt_enabled: false,
      };
    }

    if (baseReason === 'phone_required') {
      if (!Number(row.warehouse_wid)) {
        return {
          can_query: false,
          query_block_reason: 'missing_warehouse',
          warehouse_phone_attempt_enabled: false,
        };
      }
      if (warehouseContactCount <= 0) {
        return {
          can_query: false,
          query_block_reason: 'warehouse_contact_required',
          warehouse_phone_attempt_enabled: false,
        };
      }
      if (failedPhoneAttemptCount >= warehouseContactCount) {
        return {
          can_query: false,
          query_block_reason: 'warehouse_contact_exhausted',
          warehouse_phone_attempt_enabled: false,
        };
      }
      const canAttemptWithWarehousePhone = canQueryLogisticsPackage({
        ...row,
        phone_required: 0,
        contact_phone: '',
      });
      return {
        can_query: canAttemptWithWarehousePhone.allowed,
        query_block_reason: canAttemptWithWarehousePhone.allowed
          ? 'ok'
          : canAttemptWithWarehousePhone.reason,
        warehouse_phone_attempt_enabled: canAttemptWithWarehousePhone.allowed,
      };
    }

    return {
      can_query: false,
      query_block_reason: baseReason,
      warehouse_phone_attempt_enabled: false,
    };
  }

  private async queryPlanSummaryMap(planSns: string[]): Promise<Map<string, any>> {
    if (!planSns.length) return new Map<string, any>();
    const placeholders = planSns.map(() => '?').join(',');
    const rows = await this.packageRepo.manager.query(
      `
        SELECT
          plan_sn,
          product_name,
          sku,
          fnsku,
          msku,
          pic_url,
          quantity_plan,
          supplier_name,
          warehouse_name,
          seller_name,
          marketplace
        FROM app_amz_bsr_purchase_plan_lingxing
        WHERE plan_sn IN (${placeholders})
      `,
      planSns
    );
    return new Map<string, any>(rows.map((row: any) => [this.normalizeText(row.plan_sn), row]));
  }

  private buildProductItemsByOrder(itemRows: any[], planMap: Map<string, any>) {
    const map = new Map<string, any[]>();
    for (const item of itemRows) {
      const orderSn = this.normalizeText(item.order_sn);
      if (!orderSn) continue;
      const planSns = Array.from(
        new Set([
          this.normalizeText(item.plan_sn),
          ...this.parseJsonArray(item.relation_purchase_plan).map((value: any) => this.normalizeText(value)),
        ].filter(Boolean))
      );
      const primaryPlan = planSns.map(planSn => planMap.get(planSn)).find(Boolean) || null;
      const mskuList = this.parseJsonArray(item.msku).map((value: any) => this.normalizeText(value)).filter(Boolean);
      const product = {
        id: item.id,
        item_id: item.item_id,
        order_sn: orderSn,
        plan_sn: planSns[0] || '',
        plan_sns: planSns,
        product_name: this.normalizeText(primaryPlan?.product_name) || this.normalizeText(item.product_name),
        sku: this.normalizeText(primaryPlan?.sku) || this.normalizeText(item.sku),
        fnsku: this.normalizeText(primaryPlan?.fnsku) || this.normalizeText(item.fnsku),
        msku: mskuList,
        msku_text: mskuList[0] || this.normalizeText(item.first_msku),
        image_url: this.normalizeText(primaryPlan?.pic_url) || this.normalizeText(item.plan_pic_url),
        quantity_plan: Number(item.quantity_plan) || 0,
        quantity_real: Number(item.quantity_real) || 0,
        quantity_entry: Number(item.quantity_entry) || 0,
        quantity_receive: Number(item.quantity_receive) || 0,
        supplier_name: this.normalizeText(primaryPlan?.supplier_name) || this.normalizeText(item.plan_supplier_name),
        warehouse_name: this.normalizeText(primaryPlan?.warehouse_name) || this.normalizeText(item.plan_warehouse_name),
        seller_name: this.normalizeText(primaryPlan?.seller_name) || this.normalizeText(item.plan_seller_name),
        marketplace: this.normalizeText(primaryPlan?.marketplace) || this.normalizeText(item.plan_marketplace),
      };
      if (!map.has(orderSn)) map.set(orderSn, []);
      map.get(orderSn).push(product);
    }
    return map;
  }

  private buildOrderSummary(order: any = {}) {
    return {
      status: order?.status ?? null,
      status_text: this.normalizeText(order?.status_text),
      status_shipped: order?.status_shipped ?? null,
      status_shipped_text: this.normalizeText(order?.status_shipped_text),
      supplier_name: this.normalizeText(order?.supplier_name),
      warehouse_name: this.normalizeText(order?.ware_house_name),
      order_time: order?.order_time || null,
      quantity_total: Number(order?.quantity_total) || 0,
      quantity_real: Number(order?.quantity_real) || 0,
      quantity_entry: Number(order?.quantity_entry) || 0,
      quantity_receive: Number(order?.quantity_receive) || 0,
    };
  }

  private buildProductSummary(items: any[]) {
    const primary = items[0] || {};
    return {
      image_url: primary.image_url || '',
      product_name: primary.product_name || '',
      sku: primary.sku || '',
      fnsku: primary.fnsku || '',
      msku_text: primary.msku_text || '',
      product_count: items.length,
      quantity_plan: items.reduce((sum, item) => sum + (Number(item.quantity_plan) || 0), 0),
      quantity_real: items.reduce((sum, item) => sum + (Number(item.quantity_real) || 0), 0),
      quantity_entry: items.reduce((sum, item) => sum + (Number(item.quantity_entry) || 0), 0),
      quantity_receive: items.reduce((sum, item) => sum + (Number(item.quantity_receive) || 0), 0),
    };
  }

  private async resolveBatchPackageIds(body: any, mode: string, limit: number) {
    if (mode === 'filter') {
      const filters = body.filters || {};
      const countQb = this.packageRepo.createQueryBuilder('p');
      this.applyPackageFilters(countQb, filters);
      const matchedCount = await countQb.getCount();

      const listQb = this.packageRepo.createQueryBuilder('p');
      this.applyPackageFilters(listQb, filters);
      const rows = await listQb
        .select(['p.id'])
        .orderBy('p.updateTime', 'DESC')
        .take(limit)
        .getMany();

      return {
        ids: rows.map(row => Number(row.id)).filter(Boolean),
        matchedCount,
      };
    }

    const ids: number[] = Array.from(
      new Set(
        (body.package_ids || body.ids || [])
          .map((id: any) => Number(id))
          .filter((id: number) => Number.isFinite(id) && id > 0)
      )
    );
    return {
      ids: ids.slice(0, limit),
      matchedCount: ids.length,
    };
  }

  private applyScopeFilter(qb: any, scope: string, status: string) {
    const target = status || scope;
    switch (target) {
      case '':
      case 'all':
        return;
      case 'recognized_pending_query':
        qb.andWhere("p.query_mode = 'kuaidi100'")
          .andWhere("p.company_code IS NOT NULL AND p.company_code != ''")
          .andWhere('p.last_query_time IS NULL')
          .andWhere("p.status NOT IN ('signed', 'phone_required', 'manual_required', 'ignored', 'disabled')");
        return;
      case 'ignored_disabled':
        qb.andWhere("(p.status IN ('ignored', 'disabled') OR p.query_mode IN ('ignored', 'disabled'))");
        return;
      default:
        qb.andWhere('p.status = :status', { status: target });
    }
  }

  private serializePackages(packages: AppAmzBsrPurchaseOrderLogisticsPackageEntity[]) {
    const userId = this.getCurrentAdminUserId();
    return packages.map(pkg => {
      const canQuery = canQueryLogisticsPackage(pkg);
      const canWarehousePhoneQuery =
        Number(pkg.phone_required) === 1 &&
        !this.normalizeText(pkg.contact_phone) &&
        Number(pkg.warehouse_wid) > 0
          ? canQueryLogisticsPackage({ ...pkg, phone_required: 0, contact_phone: '' })
          : null;
      const contactPhone = maskContactPhoneForViewer(
        pkg.contact_phone,
        pkg.contact_phone_created_by_user_id,
        userId
      );
      const traceInfo = this.toLegacyTraceInfo(pkg.trace_json);
      const nextQueryAfter = String(pkg.last_error_code || '').trim() === '408'
        ? null
        : pkg.next_query_after;
      return {
        ...pkg,
        next_query_after: nextQueryAfter,
        contact_phone: contactPhone,
        contact_phone_masked: contactPhone,
        can_view_contact_phone:
          Boolean(pkg.contact_phone) &&
          Number(pkg.contact_phone_created_by_user_id) === Number(userId),
        latest_trace_text: traceInfo[0]?.remark || '',
        trace_info_json: traceInfo,
        can_query: canQuery.allowed || Boolean(canWarehousePhoneQuery?.allowed),
        query_block_reason: canQuery.allowed
          ? canQuery.reason
          : canWarehousePhoneQuery?.reason || canQuery.reason,
        warehouse_phone_attempt_enabled: Boolean(canWarehousePhoneQuery?.allowed),
      };
    });
  }

  private toLegacyTraceInfo(traceJson: any) {
    const traces = Array.isArray(traceJson) ? traceJson : [];
    return traces.map(trace => ({
      ...trace,
      accept_time: trace.time || trace.ftime || trace.accept_time,
      remark: trace.context || trace.remark || '',
    }));
  }

  private async getRawKuaidi100Config() {
    const row = await this.baseSysParamRepo.findOneBy({ keyName: KUAIDI100_CONFIG_KEY });
    if (!row?.data) return normalizeKuaidi100ConfigForRuntime({});
    try {
      return normalizeKuaidi100ConfigForRuntime(JSON.parse(row.data));
    } catch {
      return normalizeKuaidi100ConfigForRuntime({});
    }
  }

  private getKuaidi100ConfigOptions() {
    return {
      env: [
        { label: '测试环境', value: 'test' },
        { label: '生产环境', value: 'prod' },
      ],
      signType: [
        { label: 'MD5', value: 'MD5' },
        { label: 'SHA256', value: 'SHA256' },
      ],
      resultv2: [
        { label: '基础轨迹状态', value: '1' },
        { label: '高级状态和路由信息', value: '4' },
        { label: '高级状态和预计到达', value: '8' },
      ],
      order: [
        { label: '最新在前', value: 'desc' },
        { label: '最早在前', value: 'asc' },
      ],
    };
  }

  private normalizeText(value: any) {
    return String(value ?? '').trim();
  }

  private parseJsonArray(value: any) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private parseQueryTime(value: any) {
    if (!value) return null;
    const time = value instanceof Date
      ? value.getTime()
      : Date.parse(String(value).replace(/-/g, '/'));
    return Number.isFinite(time) ? time : null;
  }

  private getBatchSkipReason(row: any) {
    const reason = this.normalizeText(row?.query_block_reason || row?.query_mode || row?.status);
    const nextQueryAfter =
      String(row?.last_error_code || '').trim() === '408' || !row?.next_query_after
        ? ''
        : `，下次可查：${row.next_query_after}`;
    const errorMessage = this.normalizeText(
      row?.last_error_message || row?.provider_message || row?.identify_error_message
    );
    const map: Record<string, string> = {
      cooldown: `冷却中${nextQueryAfter}`,
      phone_required: '缺少手机号',
      phone_invalid: '手机号无效',
      pending_mapping: '待自动识别',
      identify_failed: errorMessage ? `识别失败：${errorMessage}` : '识别失败',
      missing_warehouse: '采购单仓库未记录',
      warehouse_contact_required: '仓库未配置联系人手机号',
      warehouse_contact_exhausted: '仓库联系人手机号均未匹配',
      manual_required: '需人工判断物流，不查快递100',
      ignored: '已忽略',
      disabled: '已停用',
      signed: '已签收',
      missing_tracking_no: '缺少运单号',
      no_result: errorMessage ? `查询失败：${errorMessage}` : '查询失败',
    };
    return map[reason] || errorMessage || '未满足查询条件';
  }

  private getCurrentAdminUserId() {
    return Number((this.baseCtx as any)?.admin?.userId) || null;
  }
}
