import { Provide, Inject } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { In, Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { AppAmzBsrBatchShipEntity } from '../entity/bsr_batch_ship';
import { AppAmzBsrBatchShipDetailEntity } from '../entity/bsr_batch_ship_detail';
import { AppAmzBsrPurchaseOrderSyncLingxingService } from './bsr_purchase_order_sync_lingxing';
import { AppBsrPurchasePlanProductViewService } from './bsr_purchase_plan_product_view';

type BatchShipSubmitRecord = {
  itemKey?: string;
  asin?: string;
  msku?: string;
  fnsku?: string;
  storeId?: number;
  store_id?: number;
  sid?: number;
  productName?: string;
  productImg?: string;
  productCode?: string;
  product_code?: string;
  marketplace?: string;
  listingId?: number;
  listing_id?: number;
  shippingMethod: string;
  shippingLabel?: string;
  shipQty: number;
  systemSuggestQty?: number;
  manualAdjusted?: boolean;
  warehouse: number | string;
  warehouseName?: string;
  packageType: number;
  planShipDate: string;
  remark?: string;
  batchRemark?: string;
  algoLabel?: string;
  dateRange?: string[];
  orderDetails: Array<{
    order_sn?: string;
    plan_sn?: string;
    ship_qty?: number;
    actual_shippable_qty?: number;
  }>;
};

type BatchShipDetailDraft = {
  record: BatchShipSubmitRecord;
  purchasePlanSn: string;
  purchaseOrderSn: string;
  shipQty: number;
};

type RequestGroup = {
  key: string;
  methodKey: string;
  remark: string;
  detailIds: number[];
  product_list: any[];
};

type BatchShipSubmitParams = {
  records: BatchShipSubmitRecord[];
  planned_snapshot?: any;
  client_submit_token?: string;
};

type BatchShipProductHistoryParams = {
  store_id?: number;
  storeId?: number;
  listing_id?: number;
  listingId?: number;
  asin?: string;
  msku?: string;
  fnsku?: string;
  product_code?: string;
  productCode?: string;
  size?: number;
};

type BatchShipHistoryPageParams = {
  page?: number;
  size?: number;
  keyword?: string;
  status?: string;
  method_key?: string;
  methodKey?: string;
  only_mine?: boolean;
  onlyMine?: boolean;
  date_range?: string[];
  dateRange?: string[];
};

type BatchShipHistoryDetailParams = {
  batch_no?: string;
  batchNo?: string;
  id?: number;
};

@Provide()
export class AppAmzBsrBatchShipService extends BaseService {
  @InjectEntityModel(AppAmzBsrBatchShipEntity)
  batchRepo: Repository<AppAmzBsrBatchShipEntity>;

  @InjectEntityModel(AppAmzBsrBatchShipDetailEntity)
  detailRepo: Repository<AppAmzBsrBatchShipDetailEntity>;

  @Inject()
  purchaseOrderService: AppAmzBsrPurchaseOrderSyncLingxingService;

  @Inject()
  purchasePlanProductViewService: AppBsrPurchasePlanProductViewService;

  async submit(params: BatchShipSubmitParams) {
    const clientSubmitToken = this.normalizeText(params?.client_submit_token);
    if (clientSubmitToken) {
      const existingBatch = await this.batchRepo.findOne({
        where: { client_submit_token: clientSubmitToken } as any
      });
      if (existingBatch) {
        return this.buildBatchSubmitResult(existingBatch, [], true);
      }
    }

    const records = Array.isArray(params?.records) ? params.records : [];
    if (!records.length) throw new Error('请提供批量发货记录');

    const detailDrafts = this.expandRecordsToDetailDrafts(records);
    if (!detailDrafts.length) throw new Error('没有可提交的采购单发货明细');
    this.validateSubmitDetails(detailDrafts);
    await this.revalidateCurrentShippableQty(detailDrafts);

    const batch = await this.createBatch(records, detailDrafts, params?.planned_snapshot, clientSubmitToken);
    const savedDetails = await this.createDetails(batch, detailDrafts);
    const requestGroups = this.buildRequestGroups(savedDetails);
    const submitResults = [];

    for (let index = 0; index < requestGroups.length; index += 1) {
      await this.waitBeforeLingxingRequest(index);
      const group = requestGroups[index];
      const result = await this.submitSingleGroup(group);
      submitResults.push(result);
    }

    return this.finishBatch(batch, submitResults);
  }

  async retryFailed(params: { batch_no?: string }) {
    const batchNo = this.normalizeText(params?.batch_no);
    if (!batchNo) throw new Error('缺少批量发货批次号');

    const batch = await this.batchRepo.findOne({ where: { batch_no: batchNo } as any });
    if (!batch) throw new Error(`批量发货批次不存在：${batchNo}`);

    const failedDetails = await this.detailRepo.find({
      where: { batch_no: batchNo, status: 'failed' } as any
    });
    if (!failedDetails.length) {
      return this.buildBatchSubmitResult(batch, [], false);
    }
    await this.revalidateCurrentShippableQty(
      failedDetails.map(detail => ({
        record: this.buildRecordFromSavedDetail(detail),
        purchasePlanSn: detail.purchase_plan_sn || '',
        purchaseOrderSn: detail.purchase_order_sn || '',
        shipQty: detail.ship_qty || 0
      }))
    );

    const retryTime = new Date();
    await this.detailRepo.save(
      failedDetails.map(detail => ({
        ...detail,
        status: 'pending',
        error_message: null,
        response_json: null,
        retry_count: (detail.retry_count || 0) + 1,
        last_retry_time: retryTime
      }))
    );

    const pendingDetails = await this.detailRepo.find({
      where: { batch_no: batchNo, status: 'pending' } as any
    });
    const requestGroups = this.buildRequestGroups(pendingDetails);
    const submitResults = [];
    for (let index = 0; index < requestGroups.length; index += 1) {
      await this.waitBeforeLingxingRequest(index);
      const result = await this.submitSingleGroup(requestGroups[index]);
      submitResults.push(result);
    }

    return this.finishBatch(batch, submitResults);
  }

  async productHistory(params: BatchShipProductHistoryParams = {}) {
    const where = this.buildProductHistoryWhere(params);
    if (!where.length) {
      return {
        summary: this.buildEmptyProductHistorySummary(),
        batches: [],
      };
    }

    const size = Math.min(Math.max(this.toInt(params.size) || 20, 1), 50);
    const details = await this.detailRepo.find({
      where: where as any,
      order: { id: 'DESC' } as any,
      take: Math.max(size * 30, 200),
    });
    if (!details.length) {
      return {
        summary: this.buildEmptyProductHistorySummary(),
        batches: [],
      };
    }

    const batchNos = Array.from(new Set(details.map(detail => detail.batch_no).filter(Boolean)));
    const batches = batchNos.length
      ? await this.batchRepo.find({
        where: { batch_no: In(batchNos) } as any,
      })
      : [];
    const batchMap = new Map(batches.map(batch => [batch.batch_no, batch]));
    const selectedBatchNos = batchNos.slice(0, size);
    const selectedBatchNoSet = new Set(selectedBatchNos);
    const selectedDetails = details.filter(detail => selectedBatchNoSet.has(detail.batch_no));
    const groupedBatches = this.buildProductHistoryBatches(selectedBatchNos, selectedDetails, batchMap);

    return {
      summary: this.buildProductHistorySummary(groupedBatches),
      batches: groupedBatches,
    };
  }

  async batchHistoryPage(params: BatchShipHistoryPageParams = {}) {
    const page = Math.max(this.toInt(params.page) || 1, 1);
    const size = Math.min(Math.max(this.toInt(params.size) || 20, 1), 100);
    const keyword = this.normalizeText(params.keyword);
    const status = this.normalizeText(params.status);
    const methodKey = this.normalizeText(params.method_key ?? params.methodKey);
    const onlyMine = Boolean(params.only_mine ?? params.onlyMine);
    const dateRange = this.normalizeDateRange(params.date_range ?? params.dateRange);
    const methodBatchNos = methodKey ? await this.findBatchNosByMethod(methodKey) : null;

    if (methodKey && methodBatchNos && methodBatchNos.length === 0) {
      return this.buildEmptyBatchHistoryPage(page, size);
    }

    const keywordDetailBatchNos = keyword ? await this.findBatchNosByDetailKeyword(keyword) : [];
    const qb = this.batchRepo.createQueryBuilder('batch');

    if (status) {
      qb.andWhere('batch.status = :status', { status });
    }
    if (methodBatchNos) {
      qb.andWhere('batch.batch_no IN (:...methodBatchNos)', { methodBatchNos });
    }
    if (onlyMine) {
      const creator = this.getCurrentAdminUser();
      if (creator.userId && creator.username) {
        qb.andWhere(
          '(batch.created_by_user_id = :creatorUserId OR batch.created_by_username = :creatorUsername)',
          { creatorUserId: creator.userId, creatorUsername: creator.username }
        );
      } else if (creator.userId) {
        qb.andWhere('batch.created_by_user_id = :creatorUserId', { creatorUserId: creator.userId });
      } else if (creator.username) {
        qb.andWhere('batch.created_by_username = :creatorUsername', { creatorUsername: creator.username });
      } else {
        return this.buildEmptyBatchHistoryPage(page, size);
      }
    }
    if (dateRange.start) {
      qb.andWhere('batch.createTime >= :startTime', { startTime: `${dateRange.start} 00:00:00` });
    }
    if (dateRange.end) {
      qb.andWhere('batch.createTime <= :endTime', { endTime: `${dateRange.end} 23:59:59` });
    }
    if (keyword) {
      const kw = `%${keyword}%`;
      if (keywordDetailBatchNos.length) {
        qb.andWhere(
          [
            '(',
            'batch.batch_no LIKE :kw',
            'OR batch.created_by_username LIKE :kw',
            'OR batch.created_by_nickname LIKE :kw',
            'OR batch.batch_no IN (:...keywordDetailBatchNos)',
            ')'
          ].join(' '),
          { kw, keywordDetailBatchNos }
        );
      } else {
        qb.andWhere(
          [
            '(',
            'batch.batch_no LIKE :kw',
            'OR batch.created_by_username LIKE :kw',
            'OR batch.created_by_nickname LIKE :kw',
            ')'
          ].join(' '),
          { kw }
        );
      }
    }

    const total = await qb.getCount();
    if (total <= 0) {
      return this.buildEmptyBatchHistoryPage(page, size);
    }

    const batches = await qb
      .orderBy('batch.id', 'DESC')
      .skip((page - 1) * size)
      .take(size)
      .getMany();
    const batchNos = batches.map(batch => batch.batch_no).filter(Boolean);
    const details = batchNos.length
      ? await this.detailRepo.find({
        where: { batch_no: In(batchNos) } as any,
        order: { id: 'ASC' } as any,
      })
      : [];
    const detailMap = this.groupDetailsByBatchNo(details);

    return {
      pagination: {
        page,
        size,
        total,
      },
      list: batches.map(batch => this.buildBatchHistoryPageRow(batch, detailMap.get(batch.batch_no) || [])),
    };
  }

  async batchHistoryDetail(params: BatchShipHistoryDetailParams = {}) {
    const batchNo = this.normalizeText(params.batch_no ?? params.batchNo);
    const id = this.toNullableInt(params.id);
    if (!batchNo && !id) {
      throw new Error('缺少批量发货批次号');
    }

    const batch = batchNo
      ? await this.batchRepo.findOne({ where: { batch_no: batchNo } as any })
      : await this.batchRepo.findOne({ where: { id } as any });
    if (!batch) {
      throw new Error(`批量发货批次不存在：${batchNo || id}`);
    }

    const details = await this.detailRepo.find({
      where: { batch_no: batch.batch_no } as any,
      order: { method_key: 'ASC', warehouse_id: 'ASC', packing_type: 'ASC', shipment_time: 'ASC', id: 'ASC' } as any,
    });

    return {
      batch,
      summary: this.buildBatchHistorySummary(batch, details),
      method_groups: this.buildWarehouseSummary(details),
      products: this.buildBatchHistoryProducts(details),
      failed_items: details.filter(detail => detail.status === 'failed'),
      local_sync_failed_items: details.filter(detail => detail.local_sync_status === 'failed'),
    };
  }

  private buildEmptyBatchHistoryPage(page = 1, size = 20) {
    return {
      pagination: {
        page,
        size,
        total: 0,
      },
      list: [],
    };
  }

  private buildBatchHistoryPageRow(
    batch: AppAmzBsrBatchShipEntity,
    details: AppAmzBsrBatchShipDetailEntity[]
  ) {
    const summary = this.buildBatchHistorySummary(batch, details);
    return {
      id: batch.id,
      batch_no: batch.batch_no,
      status: batch.status,
      planned_total_qty: summary.planned_qty,
      success_total_qty: summary.success_qty,
      failed_total_qty: summary.failed_qty,
      local_sync_failed_qty: summary.local_sync_failed_qty,
      product_count: summary.product_count,
      method_count: summary.method_count,
      purchase_plan_count: summary.purchase_plan_count,
      purchase_order_count: summary.purchase_order_count,
      lingxing_seq_count: summary.lingxing_seq_count,
      lingxing_seq_summary: this.buildLingxingSeqSummary(details),
      retryable_count: summary.retryable_count,
      retryable_qty: summary.retryable_qty,
      created_by_user_id: batch.created_by_user_id,
      created_by_username: batch.created_by_username || '',
      created_by_nickname: batch.created_by_nickname || '',
      create_time: (batch as any).createTime || null,
      finished_time: batch.finished_time || null,
      method_summary: summary.method_summary,
      product_preview: this.buildBatchHistoryProductPreview(details),
    };
  }

  private buildLingxingSeqSummary(details: AppAmzBsrBatchShipDetailEntity[]) {
    const seqMap = new Map<string, any>();
    for (const detail of details || []) {
      const seq = this.normalizeText(detail.lingxing_seq);
      if (!seq) continue;
      if (!seqMap.has(seq)) {
        seqMap.set(seq, {
          seq,
          method_key: detail.method_key || '',
          method_label: detail.method_label || detail.method_key || '',
          planned_qty: 0,
          success_qty: 0,
          failed_qty: 0,
          purchase_order_sns: new Set<string>(),
        });
      }
      const row = seqMap.get(seq);
      row.planned_qty += detail.ship_qty || 0;
      if (detail.status === 'success') row.success_qty += detail.ship_qty || 0;
      if (detail.status === 'failed') row.failed_qty += detail.ship_qty || 0;
      if (detail.purchase_order_sn) row.purchase_order_sns.add(detail.purchase_order_sn);
    }

    return Array.from(seqMap.values()).map(row => ({
      seq: row.seq,
      method_key: row.method_key,
      method_label: row.method_label,
      planned_qty: row.planned_qty,
      success_qty: row.success_qty,
      failed_qty: row.failed_qty,
      purchase_order_count: row.purchase_order_sns.size,
    }));
  }

  private buildBatchHistorySummary(
    batch: AppAmzBsrBatchShipEntity,
    details: AppAmzBsrBatchShipDetailEntity[]
  ) {
    const plannedQty = details.length
      ? details.reduce((sum, detail) => sum + (detail.ship_qty || 0), 0)
      : (batch.planned_total_qty || 0);
    const successQty = details.length
      ? details
        .filter(detail => detail.status === 'success')
        .reduce((sum, detail) => sum + (detail.ship_qty || 0), 0)
      : (batch.success_total_qty || 0);
    const failedQty = details.length
      ? details
        .filter(detail => detail.status === 'failed')
        .reduce((sum, detail) => sum + (detail.ship_qty || 0), 0)
      : (batch.failed_total_qty || 0);
    const localSyncFailedQty = details
      .filter(detail => detail.local_sync_status === 'failed')
      .reduce((sum, detail) => sum + (detail.ship_qty || 0), 0);
    const productKeys = new Set(
      details.map(detail => detail.msku || detail.asin || detail.product_name || detail.id).filter(Boolean)
    );
    const methodKeys = new Set(details.map(detail => detail.method_key || 'unknown'));
    const purchasePlanSns = new Set(details.map(detail => detail.purchase_plan_sn).filter(Boolean));
    const purchaseOrderSns = new Set(details.map(detail => detail.purchase_order_sn).filter(Boolean));
    const lingxingSeqs = new Set(details.map(detail => detail.lingxing_seq).filter(Boolean));
    const retryableDetails = details.filter(detail => detail.status === 'failed');

    return {
      planned_qty: plannedQty,
      success_qty: successQty,
      failed_qty: failedQty,
      local_sync_failed_qty: localSyncFailedQty,
      product_count: productKeys.size || batch.product_count || 0,
      method_count: methodKeys.size || batch.method_count || 0,
      purchase_plan_count: purchasePlanSns.size,
      purchase_order_count: purchaseOrderSns.size,
      lingxing_seq_count: lingxingSeqs.size,
      retryable_count: retryableDetails.length,
      retryable_qty: retryableDetails.reduce((sum, detail) => sum + (detail.ship_qty || 0), 0),
      method_summary: details.length
        ? this.buildMethodSummaryFromDetails(details)
        : (Array.isArray(batch.method_summary_json) ? batch.method_summary_json : []),
    };
  }

  private buildBatchHistoryProductPreview(details: AppAmzBsrBatchShipDetailEntity[]) {
    const products = this.buildBatchHistoryProducts(details);
    return {
      total: products.length,
      list: products.slice(0, 5).map(product => ({
        product_name: product.product_name,
        product_img: product.product_img,
        msku: product.msku,
        fnsku: product.fnsku,
        asin: product.asin,
        planned_qty: product.planned_qty,
        success_qty: product.success_qty,
        failed_qty: product.failed_qty,
        method_count: product.method_count,
      })),
    };
  }

  private buildBatchHistoryProducts(details: AppAmzBsrBatchShipDetailEntity[]) {
    const productMap = new Map<string, any>();
    for (const detail of details) {
      const productKey = detail.msku || detail.asin || detail.product_name || `detail_${detail.id}`;
      if (!productMap.has(productKey)) {
        productMap.set(productKey, {
          product_key: productKey,
          product_name: detail.product_name || '',
          product_img: detail.product_img || '',
          msku: detail.msku || '',
          fnsku: detail.fnsku || '',
          asin: detail.asin || '',
          store_id: detail.store_id || null,
          marketplace: detail.marketplace || '',
          planned_qty: 0,
          success_qty: 0,
          failed_qty: 0,
          local_sync_failed_qty: 0,
          methods: new Map<string, any>(),
          purchase_plan_sns: new Set<string>(),
          purchase_order_sns: new Set<string>(),
        });
      }
      const product = productMap.get(productKey);
      product.planned_qty += detail.ship_qty || 0;
      if (detail.status === 'success') product.success_qty += detail.ship_qty || 0;
      if (detail.status === 'failed') product.failed_qty += detail.ship_qty || 0;
      if (detail.local_sync_status === 'failed') product.local_sync_failed_qty += detail.ship_qty || 0;
      if (detail.purchase_plan_sn) product.purchase_plan_sns.add(detail.purchase_plan_sn);
      if (detail.purchase_order_sn) product.purchase_order_sns.add(detail.purchase_order_sn);

      const methodKey = detail.method_key || 'unknown';
      if (!product.methods.has(methodKey)) {
        product.methods.set(methodKey, {
          method_key: methodKey,
          method_label: detail.method_label || methodKey,
          planned_qty: 0,
          success_qty: 0,
          failed_qty: 0,
          allocations: [],
        });
      }
      const method = product.methods.get(methodKey);
      method.planned_qty += detail.ship_qty || 0;
      if (detail.status === 'success') method.success_qty += detail.ship_qty || 0;
      if (detail.status === 'failed') method.failed_qty += detail.ship_qty || 0;
      method.allocations.push({
        purchase_plan_sn: detail.purchase_plan_sn || '',
        purchase_order_sn: detail.purchase_order_sn || '',
        qty: detail.ship_qty || 0,
        status: detail.status || '',
        lingxing_seq: detail.lingxing_seq || '',
        local_sync_status: detail.local_sync_status || '',
        local_sync_error: detail.local_sync_error || '',
        error_message: detail.error_message || '',
      });
    }

    return Array.from(productMap.values()).map(product => ({
      ...product,
      method_count: product.methods.size,
      methods: Array.from(product.methods.values()),
      purchase_plan_sns: Array.from(product.purchase_plan_sns),
      purchase_order_sns: Array.from(product.purchase_order_sns),
    }));
  }

  private groupDetailsByBatchNo(details: AppAmzBsrBatchShipDetailEntity[]) {
    const map = new Map<string, AppAmzBsrBatchShipDetailEntity[]>();
    for (const detail of details) {
      const batchNo = detail.batch_no || '';
      if (!batchNo) continue;
      if (!map.has(batchNo)) map.set(batchNo, []);
      map.get(batchNo).push(detail);
    }
    return map;
  }

  private async findBatchNosByMethod(methodKey: string) {
    const rows = await this.detailRepo
      .createQueryBuilder('detail')
      .select('DISTINCT detail.batch_no', 'batch_no')
      .where('detail.method_key = :methodKey', { methodKey })
      .andWhere('detail.batch_no IS NOT NULL')
      .take(2000)
      .getRawMany();
    return rows.map(row => this.normalizeText(row.batch_no)).filter(Boolean);
  }

  private async findBatchNosByDetailKeyword(keyword: string) {
    const kw = `%${keyword}%`;
    const rows = await this.detailRepo
      .createQueryBuilder('detail')
      .select('DISTINCT detail.batch_no', 'batch_no')
      .where(
        [
          '(',
          'detail.batch_no LIKE :kw',
          'OR detail.product_name LIKE :kw',
          'OR detail.msku LIKE :kw',
          'OR detail.fnsku LIKE :kw',
          'OR detail.asin LIKE :kw',
          'OR detail.purchase_plan_sn LIKE :kw',
          'OR detail.purchase_order_sn LIKE :kw',
          'OR detail.lingxing_seq LIKE :kw',
          'OR detail.warehouse_name LIKE :kw',
          ')'
        ].join(' '),
        { kw }
      )
      .andWhere('detail.batch_no IS NOT NULL')
      .take(2000)
      .getRawMany();
    return rows.map(row => this.normalizeText(row.batch_no)).filter(Boolean);
  }

  private normalizeDateRange(value: any) {
    const list = Array.isArray(value) ? value : [];
    return {
      start: this.normalizeText(list[0]),
      end: this.normalizeText(list[1]),
    };
  }

  private buildProductHistoryWhere(params: BatchShipProductHistoryParams) {
    const storeId = this.toNullableInt(params.store_id ?? params.storeId);
    const listingId = this.toNullableInt(params.listing_id ?? params.listingId);
    const asin = this.normalizeText(params.asin);
    const msku = this.normalizeText(params.msku);
    const fnsku = this.normalizeText(params.fnsku);
    const productCode = this.normalizeText(params.product_code ?? params.productCode);
    const candidates: any[] = [];

    if (listingId) candidates.push({ listing_id: listingId });
    if (storeId && asin && msku) candidates.push({ store_id: storeId, asin, msku });
    if (!listingId && !(storeId && asin && msku)) {
      if (storeId && msku) candidates.push({ store_id: storeId, msku });
      if (asin && msku) candidates.push({ asin, msku });
      if (msku && fnsku) candidates.push({ msku, fnsku });
      if (productCode && msku) candidates.push({ product_code: productCode, msku });
      if (!storeId && !asin && msku) candidates.push({ msku });
      if (!msku && asin) candidates.push({ asin });
      if (!msku && !asin && fnsku) candidates.push({ fnsku });
    }

    const seen = new Set<string>();
    return candidates.filter(candidate => {
      const key = JSON.stringify(candidate);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private buildEmptyProductHistorySummary() {
    return {
      batch_count: 0,
      planned_qty: 0,
      success_qty: 0,
      failed_qty: 0,
      local_sync_failed_qty: 0,
      method_summary: [],
    };
  }

  private buildProductHistoryBatches(
    batchNos: string[],
    details: AppAmzBsrBatchShipDetailEntity[],
    batchMap: Map<string, AppAmzBsrBatchShipEntity>
  ) {
    const detailsByBatch = new Map<string, AppAmzBsrBatchShipDetailEntity[]>();
    for (const detail of details) {
      if (!detailsByBatch.has(detail.batch_no)) detailsByBatch.set(detail.batch_no, []);
      detailsByBatch.get(detail.batch_no).push(detail);
    }

    return batchNos.map(batchNo => {
      const rows = detailsByBatch.get(batchNo) || [];
      const batch = batchMap.get(batchNo) as any;
      const methodGroups = this.buildProductHistoryMethodGroups(rows);
      const plannedQty = rows.reduce((sum, detail) => sum + (detail.ship_qty || 0), 0);
      const successQty = rows
        .filter(detail => detail.status === 'success')
        .reduce((sum, detail) => sum + (detail.ship_qty || 0), 0);
      const failedQty = rows
        .filter(detail => detail.status === 'failed')
        .reduce((sum, detail) => sum + (detail.ship_qty || 0), 0);
      const localSyncFailedQty = rows
        .filter(detail => detail.local_sync_status === 'failed')
        .reduce((sum, detail) => sum + (detail.ship_qty || 0), 0);

      return {
        batch_no: batchNo,
        status: batch?.status || this.deriveBatchStatus(successQty, failedQty),
        planned_qty: plannedQty,
        success_qty: successQty,
        failed_qty: failedQty,
        local_sync_failed_qty: localSyncFailedQty,
        created_by_username: batch?.created_by_username || '',
        created_by_nickname: batch?.created_by_nickname || '',
        create_time: batch?.createTime || null,
        finished_time: batch?.finished_time || null,
        method_groups: methodGroups,
      };
    });
  }

  private buildProductHistoryMethodGroups(details: AppAmzBsrBatchShipDetailEntity[]) {
    const groupMap = new Map<string, any>();
    for (const detail of details) {
      const groupKey = [
        detail.method_key || '',
        detail.warehouse_id || 0,
        detail.packing_type || 0,
        detail.shipment_time || '',
      ].join('|');
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          group_key: groupKey,
          method_key: detail.method_key || '',
          method_label: detail.method_label || detail.method_key || '',
          warehouse_id: detail.warehouse_id || null,
          warehouse_name: detail.warehouse_name || '',
          packing_type: detail.packing_type || null,
          shipment_time: detail.shipment_time || '',
          planned_qty: 0,
          success_qty: 0,
          failed_qty: 0,
          local_sync_failed_qty: 0,
          seqs: new Set<string>(),
          allocations: [],
        });
      }
      const group = groupMap.get(groupKey);
      group.planned_qty += detail.ship_qty || 0;
      if (detail.status === 'success') group.success_qty += detail.ship_qty || 0;
      if (detail.status === 'failed') group.failed_qty += detail.ship_qty || 0;
      if (detail.local_sync_status === 'failed') group.local_sync_failed_qty += detail.ship_qty || 0;
      if (detail.lingxing_seq) group.seqs.add(detail.lingxing_seq);
      group.allocations.push({
        id: detail.id,
        purchase_plan_sn: detail.purchase_plan_sn || '',
        purchase_order_sn: detail.purchase_order_sn || '',
        ship_qty: detail.ship_qty || 0,
        status: detail.status || '',
        lingxing_seq: detail.lingxing_seq || '',
        lingxing_order_sns: detail.lingxing_order_sns_json || [],
        local_sync_status: detail.local_sync_status || '',
        local_sync_error: detail.local_sync_error || '',
        error_message: detail.error_message || '',
        detail_remark: detail.detail_remark || '',
      });
    }

    return Array.from(groupMap.values()).map(group => ({
      ...group,
      seqs: Array.from(group.seqs),
    }));
  }

  private buildProductHistorySummary(batches: any[]) {
    const methodMap = new Map<string, any>();
    const summary = batches.reduce(
      (acc, batch) => {
        acc.planned_qty += batch.planned_qty || 0;
        acc.success_qty += batch.success_qty || 0;
        acc.failed_qty += batch.failed_qty || 0;
        acc.local_sync_failed_qty += batch.local_sync_failed_qty || 0;
        for (const group of batch.method_groups || []) {
          const key = group.method_key || 'unknown';
          if (!methodMap.has(key)) {
            methodMap.set(key, {
              method_key: key,
              method_label: group.method_label || key,
              planned_qty: 0,
              success_qty: 0,
              failed_qty: 0,
            });
          }
          const method = methodMap.get(key);
          method.planned_qty += group.planned_qty || 0;
          method.success_qty += group.success_qty || 0;
          method.failed_qty += group.failed_qty || 0;
        }
        return acc;
      },
      {
        batch_count: batches.length,
        planned_qty: 0,
        success_qty: 0,
        failed_qty: 0,
        local_sync_failed_qty: 0,
      }
    );

    return {
      ...summary,
      method_summary: Array.from(methodMap.values()),
    };
  }

  private deriveBatchStatus(successQty: number, failedQty: number) {
    if (failedQty <= 0) return 'success';
    return successQty > 0 ? 'partial_failed' : 'failed';
  }

  private expandRecordsToDetailDrafts(records: BatchShipSubmitRecord[]) {
    const details: BatchShipDetailDraft[] = [];
    for (const record of records) {
      const orderDetails = Array.isArray(record.orderDetails) ? record.orderDetails : [];
      for (const order of orderDetails) {
        const shipQty = this.toInt(order?.ship_qty);
        if (shipQty <= 0) continue;
        details.push({
          record,
          purchasePlanSn: this.normalizeText(order?.plan_sn),
          purchaseOrderSn: this.normalizeText(order?.order_sn),
          shipQty
        });
      }
    }
    return details;
  }

  private validateSubmitDetails(details: BatchShipDetailDraft[]) {
    for (const detail of details) {
      const record = detail.record;
      const productText = record.productName || record.msku || record.asin || '产品';
      if (!this.toNullableInt(record.sid ?? record.storeId ?? record.store_id)) {
        throw new Error(`${productText} 缺少店铺ID，不能创建领星发货计划`);
      }
      if (!this.normalizeText(record.msku)) {
        throw new Error(`${productText} 缺少MSKU，不能创建领星发货计划`);
      }
      if (!this.normalizeText(record.fnsku)) {
        throw new Error(`${productText} 缺少FNSKU，不能创建领星发货计划`);
      }
      if (!this.toNullableInt(record.warehouse)) {
        throw new Error(`${productText} 缺少发货仓库，不能创建领星发货计划`);
      }
      if (!this.toNullableInt(record.packageType)) {
        throw new Error(`${productText} 缺少包装类型，不能创建领星发货计划`);
      }
      if (!this.normalizeText(record.planShipDate)) {
        throw new Error(`${productText} 缺少发货时间，不能创建领星发货计划`);
      }
      if (!detail.purchasePlanSn) {
        throw new Error(`${productText} 缺少采购计划号，不能保存仓库建议关联`);
      }
      if (!detail.purchaseOrderSn) {
        throw new Error(`${productText} 缺少采购单号，不能保存仓库建议关联`);
      }
    }
  }

  private async revalidateCurrentShippableQty(details: BatchShipDetailDraft[]) {
    if (!this.purchasePlanProductViewService?.purchaseOrderFlowBatch) return;

    const recordMap = new Map<BatchShipSubmitRecord, BatchShipDetailDraft[]>();
    details.forEach(detail => {
      if (!recordMap.has(detail.record)) recordMap.set(detail.record, []);
      recordMap.get(detail.record).push(detail);
    });

    const requestRows = Array.from(recordMap.entries()).map(([record, recordDetails], index) => {
      const productText = record.productName || record.msku || record.asin || '产品';
      const storeId = this.toNullableInt(record.sid ?? record.storeId ?? record.store_id);
      if (!storeId || !this.normalizeText(record.marketplace) || !this.normalizeText(record.asin) || !this.normalizeText(record.msku)) {
        throw new Error(`${productText} 缺少产品身份信息，无法刷新采购单当前可发量`);
      }
      const clientKey = `batch_ship_${index}`;
      return {
        clientKey,
        productText,
        details: recordDetails,
        item: {
          clientKey,
          store_id: storeId,
          marketplace: this.normalizeText(record.marketplace),
          asin: this.normalizeText(record.asin),
          msku: this.normalizeText(record.msku),
          product_code: this.normalizeText(record.productCode ?? record.product_code),
          orders: recordDetails.map(detail => ({
            purchase_order_sn: detail.purchaseOrderSn
          }))
        }
      };
    });

    const items = requestRows.map(row => row.item);
    const flowResult = await this.purchasePlanProductViewService.purchaseOrderFlowBatch({
      items,
      preserve_order_traces: true
    });
    const currentQtyMap = new Map<string, number>();

    for (const [rowIndex, row] of (flowResult?.list || []).entries()) {
      const clientKey =
        this.normalizeText(row?.clientKey || row?.client_key || row?.row_key) ||
        requestRows[rowIndex]?.clientKey ||
        '';
      for (const trace of row?.traces || []) {
        if (trace?.error) continue;
        const qty = this.toInt(trace?.flow?.summary?.actual_shippable_qty);
        const orderSns = this.uniqueTexts([
          ...(Array.isArray(trace?.linked_order_sns) ? trace.linked_order_sns : []),
          trace?.flow?.details?.purchase_order?.order_sn,
          trace?.flow?.summary?.purchase_order_sn
        ]);
        orderSns.forEach(orderSn => currentQtyMap.set(`${clientKey}__${orderSn}`, qty));
      }
    }

    const submitQtyMap = new Map<string, { qty: number; productText: string; orderSn: string }>();
    for (const row of requestRows) {
      for (const detail of row.details) {
        const key = `${row.clientKey}__${detail.purchaseOrderSn}`;
        const current = submitQtyMap.get(key) || {
          qty: 0,
          productText: row.productText,
          orderSn: detail.purchaseOrderSn
        };
        current.qty += detail.shipQty;
        submitQtyMap.set(key, current);
      }
    }

    for (const [key, submit] of submitQtyMap.entries()) {
      if (!currentQtyMap.has(key)) {
        throw new Error(`${submit.productText} 采购单 ${submit.orderSn} 当前可发量刷新失败，请重新打开批量发货弹窗`);
      }
      const currentQty = currentQtyMap.get(key) || 0;
      if (submit.qty > currentQty) {
        throw new Error(`${submit.productText} 采购单 ${submit.orderSn} 当前实际可发 ${currentQty}，本次提交 ${submit.qty}，请刷新后重新分配`);
      }
    }
  }

  private async createBatch(
    records: BatchShipSubmitRecord[],
    details: BatchShipDetailDraft[],
    plannedSnapshot: any,
    clientSubmitToken = ''
  ) {
    const creator = this.getCurrentAdminUser();
    const entity = new AppAmzBsrBatchShipEntity();
    entity.batch_no = await this.generateBatchNo();
    entity.status = 'submitting';
    entity.client_submit_token = clientSubmitToken || null;
    entity.planned_total_qty = details.reduce((sum, detail) => sum + detail.shipQty, 0);
    entity.success_total_qty = 0;
    entity.failed_total_qty = 0;
    entity.product_count = new Set(records.map(record => this.buildProductKey(record))).size;
    entity.method_count = new Set(records.map(record => this.normalizeText(record.shippingMethod))).size;
    entity.method_summary_json = this.buildMethodSummary(records, details, 'planned');
    entity.final_advice_json = null;
    entity.planned_snapshot_json = plannedSnapshot || {
      records: records.map(record => ({
        itemKey: record.itemKey,
        asin: record.asin,
        msku: record.msku,
        fnsku: record.fnsku,
        shippingMethod: record.shippingMethod,
        shipQty: record.shipQty,
        systemSuggestQty: record.systemSuggestQty,
        manualAdjusted: record.manualAdjusted,
        orderDetails: record.orderDetails
      }))
    };
    entity.created_by_user_id = creator.userId;
    entity.created_by_username = creator.username;
    entity.created_by_nickname = creator.nickname;
    return this.batchRepo.save(entity);
  }

  private async createDetails(batch: AppAmzBsrBatchShipEntity, drafts: BatchShipDetailDraft[]) {
    const entities = drafts.map(draft => {
      const record = draft.record;
      const entity = new AppAmzBsrBatchShipDetailEntity();
      entity.batch_id = batch.id;
      entity.batch_no = batch.batch_no;
      entity.method_key = this.normalizeText(record.shippingMethod);
      entity.method_label = this.normalizeText(record.shippingLabel);
      entity.warehouse_id = this.toNullableInt(record.warehouse);
      entity.warehouse_name = this.normalizeText(record.warehouseName);
      entity.packing_type = this.toNullableInt(record.packageType);
      entity.shipment_time = this.normalizeText(record.planShipDate);
      entity.store_id = this.toNullableInt(record.sid ?? record.storeId ?? record.store_id);
      entity.asin = this.normalizeText(record.asin);
      entity.marketplace = this.normalizeText(record.marketplace);
      entity.msku = this.normalizeText(record.msku);
      entity.fnsku = this.normalizeText(record.fnsku);
      entity.product_name = this.normalizeText(record.productName);
      entity.product_img = this.normalizeText(record.productImg);
      entity.product_code = this.normalizeText(record.productCode ?? record.product_code);
      entity.listing_id = this.toNullableInt(record.listingId ?? record.listing_id);
      entity.purchase_plan_sn = draft.purchasePlanSn;
      entity.purchase_order_sn = draft.purchaseOrderSn;
      entity.ship_qty = draft.shipQty;
      entity.system_suggest_qty = this.toInt(record.systemSuggestQty);
      entity.manual_adjusted = record.manualAdjusted ? 1 : 0;
      entity.status = 'pending';
      entity.detail_remark = this.normalizeText(record.remark);
      entity.batch_remark = this.normalizeText(record.batchRemark);
      entity.snapshot_json = {
        itemKey: record.itemKey,
        algoLabel: record.algoLabel,
        dateRange: record.dateRange,
        totalRecordQty: record.shipQty,
        systemSuggestQty: record.systemSuggestQty,
        manualAdjusted: record.manualAdjusted
      };
      return entity;
    });
    return this.detailRepo.save(entities);
  }

  private buildRequestGroups(details: AppAmzBsrBatchShipDetailEntity[]) {
    const groupMap = new Map<string, {
      methodKey: string;
      remark: string;
      details: AppAmzBsrBatchShipDetailEntity[];
    }>();

    for (const detail of details) {
      const key = [
        detail.method_key,
        detail.warehouse_id || 0,
        detail.packing_type || 0,
        detail.shipment_time || '',
        detail.purchase_plan_sn || '',
        detail.purchase_order_sn || ''
      ].join('|');
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          methodKey: detail.method_key,
          remark: detail.batch_remark || '',
          details: []
        });
      }
      groupMap.get(key).details.push(detail);
    }

    return Array.from(groupMap.entries()).map(([key, group]) => {
      const productMap = new Map<string, any>();
      const productDetailIds = new Map<string, number[]>();

      for (const detail of group.details) {
        const productKey = [
          detail.store_id || 0,
          detail.msku || '',
          detail.fnsku || '',
          detail.purchase_plan_sn || '',
          detail.purchase_order_sn || ''
        ].join('|');
        if (!productMap.has(productKey)) {
          productMap.set(productKey, {
            sid: detail.store_id || 0,
            packing_type: detail.packing_type || 1,
            shipment_time: detail.shipment_time || '',
            msku: detail.msku || '',
            fnsku: detail.fnsku || '',
            shipment_plan_quantity: 0,
            wid: detail.warehouse_id || 0,
            remark: detail.detail_remark || '',
            purchase_plan_sn: detail.purchase_plan_sn || '',
            purchase_order_sn: detail.purchase_order_sn || ''
          });
          productDetailIds.set(productKey, []);
        }
        productMap.get(productKey).shipment_plan_quantity += detail.ship_qty || 0;
        productDetailIds.get(productKey).push(detail.id);
      }

      return {
        key,
        methodKey: group.methodKey,
        remark: group.remark,
        detailIds: Array.from(productDetailIds.values()).flat(),
        product_list: Array.from(productMap.values())
      } as RequestGroup;
    });
  }

  private async submitSingleGroup(group: RequestGroup) {
    const requestPayload = {
      groups: [
        {
          methodKey: group.methodKey,
          remark: group.remark,
          product_list: group.product_list
        }
      ]
    };

    await this.detailRepo.update(
      { id: In(group.detailIds) },
      { request_payload_json: requestPayload.groups[0] } as any
    );

    try {
      const result = await this.purchaseOrderService.createShipmentPlan(requestPayload);
      const first = Array.isArray(result) ? result[0] : null;
      if (first?.success) {
        const localSyncStatus =
          first.local_sync_success === true
            ? 'success'
            : first.local_sync_success === false
              ? 'failed'
              : 'skipped';
        await this.detailRepo.update(
          { id: In(group.detailIds) },
          {
            status: 'success',
            lingxing_seq: first.seq || '',
            lingxing_order_sns_json: first.order_sn || [],
            local_sync_status: localSyncStatus,
            local_sync_error: first.local_sync_error || null,
            response_json: first,
            error_message: null
          } as any
        );
      } else {
        await this.detailRepo.update(
          { id: In(group.detailIds) },
          {
            status: 'failed',
            local_sync_status: null,
            local_sync_error: null,
            response_json: first || result,
            error_message: first?.error || '领星发货计划创建失败'
          } as any
        );
      }
      return {
        request_key: group.key,
        methodKey: group.methodKey,
        detail_ids: group.detailIds,
        ...(first || { success: false, error: '领星未返回结果' })
      };
    } catch (error: any) {
      const message = error?.message || '领星发货计划创建异常';
      await this.detailRepo.update(
        { id: In(group.detailIds) },
        {
          status: 'failed',
          local_sync_status: null,
          local_sync_error: null,
          response_json: { error: message },
          error_message: message
        } as any
      );
      return {
        request_key: group.key,
        methodKey: group.methodKey,
        detail_ids: group.detailIds,
        success: false,
        error: message
      };
    }
  }

  private async finishBatch(batch: AppAmzBsrBatchShipEntity, submitResults: any[] = []) {
    const details = await this.detailRepo.find({
      where: { batch_no: batch.batch_no }
    });
    const successTotal = details
      .filter(detail => detail.status === 'success')
      .reduce((sum, detail) => sum + (detail.ship_qty || 0), 0);
    const failedTotal = details
      .filter(detail => detail.status === 'failed')
      .reduce((sum, detail) => sum + (detail.ship_qty || 0), 0);
    const status = failedTotal === 0
      ? 'success'
      : successTotal > 0
        ? 'partial_failed'
        : 'failed';
    const warehouseSummary = this.buildWarehouseSummary(details);

    await this.batchRepo.update(batch.id, {
      status,
      success_total_qty: successTotal,
      failed_total_qty: failedTotal,
      method_summary_json: this.buildMethodSummaryFromDetails(details),
      final_advice_json: warehouseSummary,
      finished_time: new Date()
    });

    const savedBatch = await this.batchRepo.findOneBy({ id: batch.id });
    return this.buildBatchSubmitResult(savedBatch || batch, submitResults, false, details);
  }

  private async buildBatchSubmitResult(
    batch: AppAmzBsrBatchShipEntity,
    submitResults: any[] = [],
    duplicated = false,
    loadedDetails?: AppAmzBsrBatchShipDetailEntity[]
  ) {
    const details = loadedDetails || await this.detailRepo.find({
      where: { batch_no: batch.batch_no }
    });
    const warehouseSummary = this.buildWarehouseSummary(details);
    return {
      duplicated,
      batch_no: batch.batch_no,
      batch,
      warehouse_summary: warehouseSummary,
      failed_items: details.filter(detail => detail.status === 'failed'),
      local_sync_failed_items: details.filter(detail => detail.local_sync_status === 'failed'),
      submit_results: submitResults
    };
  }

  private buildWarehouseSummary(details: AppAmzBsrBatchShipDetailEntity[]) {
    const methodMap = new Map<string, any>();
    for (const detail of details) {
      const methodKey = detail.method_key || 'unknown';
      if (!methodMap.has(methodKey)) {
        methodMap.set(methodKey, {
          method_key: methodKey,
          method_label: detail.method_label || methodKey,
          planned_qty: 0,
          success_qty: 0,
          failed_qty: 0,
          local_sync_failed_qty: 0,
          products: {},
          seqs: new Set<string>(),
          detail_rows: []
        });
      }
      const method = methodMap.get(methodKey);
      method.detail_rows.push(detail);
      method.planned_qty += detail.ship_qty || 0;
      if (detail.status === 'success') method.success_qty += detail.ship_qty || 0;
      if (detail.status === 'failed') method.failed_qty += detail.ship_qty || 0;
      if (detail.local_sync_status === 'failed') {
        method.local_sync_failed_qty += detail.ship_qty || 0;
      }
      if (detail.lingxing_seq) method.seqs.add(detail.lingxing_seq);

      const productKey = detail.msku || detail.asin || detail.product_name || `detail_${detail.id}`;
      if (!method.products[productKey]) {
        method.products[productKey] = {
          msku: detail.msku,
          fnsku: detail.fnsku,
          asin: detail.asin,
          product_name: detail.product_name,
          success_qty: 0,
          failed_qty: 0,
          local_sync_failed_qty: 0,
          allocations: []
        };
      }
      const product = method.products[productKey];
      if (detail.status === 'success') product.success_qty += detail.ship_qty || 0;
      if (detail.status === 'failed') product.failed_qty += detail.ship_qty || 0;
      if (detail.local_sync_status === 'failed') product.local_sync_failed_qty += detail.ship_qty || 0;
      product.allocations.push({
        purchase_plan_sn: detail.purchase_plan_sn,
        purchase_order_sn: detail.purchase_order_sn,
        qty: detail.ship_qty,
        status: detail.status,
        lingxing_seq: detail.lingxing_seq,
        local_sync_status: detail.local_sync_status,
        local_sync_error: detail.local_sync_error,
        error_message: detail.error_message
      });
    }

    return Array.from(methodMap.values()).map(method => {
      const { detail_rows: detailRows, ...summary } = method;
      return {
        ...summary,
        seqs: Array.from(method.seqs),
        products: Object.values(method.products),
        execution_groups: this.buildWarehouseExecutionGroups(detailRows),
        warehouse_text: `${method.method_label}计划 ${method.planned_qty} 件，成功 ${method.success_qty} 件，失败 ${method.failed_qty} 件${method.local_sync_failed_qty ? `，本地同步失败 ${method.local_sync_failed_qty} 件` : ''}`
      };
    });
  }

  private buildWarehouseExecutionGroups(details: AppAmzBsrBatchShipDetailEntity[]) {
    const groupMap = new Map<string, any>();
    for (const detail of details) {
      const groupKey = [
        detail.warehouse_id || 0,
        detail.packing_type || 0,
        detail.shipment_time || ''
      ].join('|');
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, {
          group_key: groupKey,
          warehouse_id: detail.warehouse_id || null,
          warehouse_name: detail.warehouse_name || '',
          packing_type: detail.packing_type || null,
          shipment_time: detail.shipment_time || '',
          batch_remark: detail.batch_remark || '',
          planned_qty: 0,
          success_qty: 0,
          failed_qty: 0,
          local_sync_failed_qty: 0,
          seqs: new Set<string>(),
          products: new Map<string, any>()
        });
      }
      const group = groupMap.get(groupKey);
      group.planned_qty += detail.ship_qty || 0;
      if (detail.status === 'success') group.success_qty += detail.ship_qty || 0;
      if (detail.status === 'failed') group.failed_qty += detail.ship_qty || 0;
      if (detail.local_sync_status === 'failed') {
        group.local_sync_failed_qty += detail.ship_qty || 0;
      }
      if (detail.lingxing_seq) group.seqs.add(detail.lingxing_seq);

      const productKey = detail.msku || detail.asin || detail.product_name || `detail_${detail.id}`;
      if (!group.products.has(productKey)) {
        group.products.set(productKey, {
          msku: detail.msku,
          fnsku: detail.fnsku,
          asin: detail.asin,
          product_name: detail.product_name,
          product_img: detail.product_img,
          detail_remark: detail.detail_remark,
          planned_qty: 0,
          success_qty: 0,
          failed_qty: 0,
          allocations: []
        });
      }
      const product = group.products.get(productKey);
      product.planned_qty += detail.ship_qty || 0;
      if (detail.status === 'success') product.success_qty += detail.ship_qty || 0;
      if (detail.status === 'failed') product.failed_qty += detail.ship_qty || 0;
      product.allocations.push({
        purchase_plan_sn: detail.purchase_plan_sn,
        purchase_order_sn: detail.purchase_order_sn,
        qty: detail.ship_qty,
        status: detail.status,
        lingxing_seq: detail.lingxing_seq,
        local_sync_status: detail.local_sync_status,
        local_sync_error: detail.local_sync_error,
        error_message: detail.error_message
      });
    }

    return Array.from(groupMap.values()).map(group => ({
      ...group,
      seqs: Array.from(group.seqs),
      products: Array.from(group.products.values())
    }));
  }

  private buildMethodSummary(records: BatchShipSubmitRecord[], details: BatchShipDetailDraft[], status: string) {
    const map = new Map<string, any>();
    for (const detail of details) {
      const methodKey = this.normalizeText(detail.record.shippingMethod) || 'unknown';
      if (!map.has(methodKey)) {
        map.set(methodKey, {
          method_key: methodKey,
          method_label: detail.record.shippingLabel || methodKey,
          status,
          planned_qty: 0,
          product_count: 0
        });
      }
      map.get(methodKey).planned_qty += detail.shipQty;
    }
    for (const record of records) {
      const methodKey = this.normalizeText(record.shippingMethod) || 'unknown';
      if (map.has(methodKey)) {
        map.get(methodKey).product_count += 1;
      }
    }
    return Array.from(map.values());
  }

  private buildMethodSummaryFromDetails(details: AppAmzBsrBatchShipDetailEntity[]) {
    const map = new Map<string, any>();
    for (const detail of details) {
      const methodKey = detail.method_key || 'unknown';
      if (!map.has(methodKey)) {
        map.set(methodKey, {
          method_key: methodKey,
          method_label: detail.method_label || methodKey,
          planned_qty: 0,
          success_qty: 0,
          failed_qty: 0,
          product_count: new Set<string>()
        });
      }
      const row = map.get(methodKey);
      row.planned_qty += detail.ship_qty || 0;
      if (detail.status === 'success') row.success_qty += detail.ship_qty || 0;
      if (detail.status === 'failed') row.failed_qty += detail.ship_qty || 0;
      row.product_count.add(detail.msku || detail.asin || detail.product_name || detail.id);
    }
    return Array.from(map.values()).map(row => ({
      ...row,
      product_count: row.product_count.size
    }));
  }

  private async generateBatchNo() {
    return `BSHIP${dayjs().format('YYMMDDHHmmssSSS')}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;
  }

  private async waitBeforeLingxingRequest(index: number) {
    if (index <= 0) return;
    await new Promise(resolve => setTimeout(resolve, 550));
  }

  private getCurrentAdminUser() {
    const admin = (this.baseCtx as any)?.admin || {};
    const username = this.normalizeText(admin.username);
    return {
      userId: Number(admin.userId) || null,
      username,
      nickname: this.normalizeText(admin.nickName || admin.name || username)
    };
  }

  private buildProductKey(record: BatchShipSubmitRecord) {
    return [
      record.storeId || record.store_id || record.sid || 0,
      record.asin || '',
      record.msku || '',
      record.fnsku || ''
    ].join('|');
  }

  private buildRecordFromSavedDetail(detail: AppAmzBsrBatchShipDetailEntity): BatchShipSubmitRecord {
    return {
      itemKey: `${detail.batch_no}_${detail.id}`,
      asin: detail.asin || '',
      marketplace: detail.marketplace || '',
      msku: detail.msku || '',
      fnsku: detail.fnsku || '',
      storeId: detail.store_id,
      productName: detail.product_name || '',
      productImg: detail.product_img || '',
      productCode: detail.product_code || '',
      listingId: detail.listing_id,
      shippingMethod: detail.method_key || '',
      shippingLabel: detail.method_label || '',
      shipQty: detail.ship_qty || 0,
      systemSuggestQty: detail.system_suggest_qty || 0,
      manualAdjusted: Boolean(detail.manual_adjusted),
      warehouse: detail.warehouse_id || '',
      warehouseName: detail.warehouse_name || '',
      packageType: detail.packing_type || 1,
      planShipDate: String(detail.shipment_time || ''),
      remark: detail.detail_remark || '',
      batchRemark: detail.batch_remark || '',
      orderDetails: [
        {
          order_sn: detail.purchase_order_sn || '',
          plan_sn: detail.purchase_plan_sn || '',
          ship_qty: detail.ship_qty || 0
        }
      ]
    };
  }

  private toInt(value: any) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
  }

  private toNullableInt(value: any) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.round(num) : null;
  }

  private normalizeText(value: any) {
    return String(value ?? '').trim();
  }

  private uniqueTexts(values: any[]) {
    const result: string[] = [];
    const seen = new Set<string>();
    for (const value of values || []) {
      const text = this.normalizeText(value);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      result.push(text);
    }
    return result;
  }
}
