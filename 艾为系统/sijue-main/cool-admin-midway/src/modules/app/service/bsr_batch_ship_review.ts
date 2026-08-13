import { Inject, Provide } from '@midwayjs/decorator';
import { BaseService } from '@cool-midway/core';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import dayjs = require('dayjs');
import { AppAmzBsrBatchShipReviewEntity } from '../entity/bsr_batch_ship_review';
import { AppAmzBsrBatchShipReviewVersionEntity } from '../entity/bsr_batch_ship_review_version';
import { AppAmzBsrBatchShipReviewProductEntity } from '../entity/bsr_batch_ship_review_product';
import { AppAmzBsrBatchShipReviewSegmentEntity } from '../entity/bsr_batch_ship_review_segment';
import { AppAmzBsrBatchShipReviewAllocationEntity } from '../entity/bsr_batch_ship_review_allocation';
import { AppAmzBsrBatchShipReviewLogEntity } from '../entity/bsr_batch_ship_review_log';

type ReviewSaveParams = {
  review_no?: string;
  reviewNo?: string;
  source_page?: any;
  sourcePage?: any;
  input_snapshot?: any;
  inputSnapshot?: any;
  workbench_snapshot?: any;
  workbenchSnapshot?: any;
  submit_payload?: any;
  submitPayload?: any;
  ui_state?: any;
  uiState?: any;
  remark?: string;
};

type ReviewPageParams = {
  page?: number;
  size?: number;
  keyword?: string;
  status?: string;
  statuses?: string[];
  statusList?: string[];
  only_mine?: boolean;
  onlyMine?: boolean;
  date_range?: string[];
  dateRange?: string[];
};

type ReviewPageFilterState = {
  keyword: string;
  status: string;
  statuses: string[];
  onlyMine: boolean;
  dateRange: {
    start: string;
    end: string;
  };
};

type ReviewIdentityParams = {
  review_no?: string;
  reviewNo?: string;
  id?: number;
  remark?: string;
};

type SaveReviewVersionResult = {
  review: AppAmzBsrBatchShipReviewEntity;
  version: AppAmzBsrBatchShipReviewVersionEntity;
  summary: any;
};

type ReviewRepositorySet = {
  reviewRepo: Repository<AppAmzBsrBatchShipReviewEntity>;
  versionRepo: Repository<AppAmzBsrBatchShipReviewVersionEntity>;
  productRepo: Repository<AppAmzBsrBatchShipReviewProductEntity>;
  segmentRepo: Repository<AppAmzBsrBatchShipReviewSegmentEntity>;
  allocationRepo: Repository<AppAmzBsrBatchShipReviewAllocationEntity>;
  logRepo: Repository<AppAmzBsrBatchShipReviewLogEntity>;
};

@Provide()
export class AppAmzBsrBatchShipReviewService extends BaseService {
  @InjectEntityModel(AppAmzBsrBatchShipReviewEntity)
  reviewRepo: Repository<AppAmzBsrBatchShipReviewEntity>;

  @InjectEntityModel(AppAmzBsrBatchShipReviewVersionEntity)
  versionRepo: Repository<AppAmzBsrBatchShipReviewVersionEntity>;

  @InjectEntityModel(AppAmzBsrBatchShipReviewProductEntity)
  productRepo: Repository<AppAmzBsrBatchShipReviewProductEntity>;

  @InjectEntityModel(AppAmzBsrBatchShipReviewSegmentEntity)
  segmentRepo: Repository<AppAmzBsrBatchShipReviewSegmentEntity>;

  @InjectEntityModel(AppAmzBsrBatchShipReviewAllocationEntity)
  allocationRepo: Repository<AppAmzBsrBatchShipReviewAllocationEntity>;

  @InjectEntityModel(AppAmzBsrBatchShipReviewLogEntity)
  logRepo: Repository<AppAmzBsrBatchShipReviewLogEntity>;

  @Inject()
  appAmzBsrBatchShipService: any;

  async saveDraft(params: ReviewSaveParams) {
    const result = await this.saveReviewVersion(
      params,
      'draft',
      'draft',
      'save_draft'
    );
    return this.buildSaveResult(result);
  }

  async submitForReview(params: ReviewSaveParams) {
    const result = await this.saveReviewVersion(
      params,
      'pending_review',
      'submit_review',
      'submit_review'
    );
    return this.buildSaveResult(result);
  }

  async page(params: ReviewPageParams = {}) {
    const page = Math.max(this.toInt(params.page) || 1, 1);
    const size = Math.min(Math.max(this.toInt(params.size) || 20, 1), 100);
    const keyword = this.normalizeText(params.keyword);
    const status = this.normalizeText(params.status);
    const statuses = this.normalizeStatusList(
      params.statuses ?? params.statusList
    );
    const onlyMine = Boolean(params.only_mine ?? params.onlyMine);
    const dateRange = this.normalizeDateRange(
      params.date_range ?? params.dateRange
    );
    const filters = { keyword, status, statuses, onlyMine, dateRange };
    const statusCounts = await this.countReviewStatuses(filters);
    const qb = this.createReviewPageQuery(filters, true);

    if (!qb) return this.buildEmptyPage(page, size, statusCounts);

    const total = await qb.getCount();
    if (total <= 0) return this.buildEmptyPage(page, size, statusCounts);
    const list = await qb
      .orderBy('review.id', 'DESC')
      .skip((page - 1) * size)
      .take(size)
      .getMany();
    const productPreviewMap = await this.buildPageProductPreviewMap(list);

    return {
      pagination: { page, size, total },
      list: list.map(row => this.buildPageRow(row, productPreviewMap)),
      status_counts: statusCounts,
    };
  }

  async detail(params: ReviewIdentityParams = {}) {
    const review = await this.getReviewOrFail(params);
    const version = review.current_version_id
      ? await this.versionRepo.findOneBy({
          id: review.current_version_id,
        } as any)
      : null;
    const versionId = version?.id || 0;
    const [products, segments, allocations, logs] = await Promise.all([
      versionId
        ? this.productRepo.find({
            where: { version_id: versionId } as any,
            order: { product_line_no: 'ASC' } as any,
          })
        : [],
      versionId
        ? this.segmentRepo.find({
            where: { version_id: versionId } as any,
            order: { product_line_no: 'ASC', segment_line_no: 'ASC' } as any,
          })
        : [],
      versionId
        ? this.allocationRepo.find({
            where: { version_id: versionId } as any,
            order: {
              product_line_no: 'ASC',
              segment_line_no: 'ASC',
              allocation_line_no: 'ASC',
            } as any,
          })
        : [],
      this.logRepo.find({
        where: { review_no: review.review_no } as any,
        order: { id: 'ASC' } as any,
      }),
    ]);

    return {
      review,
      current_version: version,
      summary: review.summary_json || {},
      products: this.hydrateProductRowsFromSnapshots(products, version),
      segments,
      allocations,
      logs,
      execution: {
        batch_no: review.executed_batch_no || '',
        result: review.execute_result_json || null,
        error: review.execute_error || '',
      },
    };
  }

  async restorePayload(params: ReviewIdentityParams = {}) {
    const review = await this.getReviewOrFail(params);
    if (!review.current_version_id) throw new Error('审核单没有可还原版本');
    const version = await this.versionRepo.findOneBy({
      id: review.current_version_id,
    } as any);
    if (!version) throw new Error('审核单当前版本不存在');
    return {
      review_no: review.review_no,
      status: review.status,
      version_id: version.id,
      version_no: version.version_no,
      source_page: review.source_page_json || null,
      input_snapshot: version.input_snapshot_json || null,
      workbench_snapshot: version.workbench_snapshot_json || null,
      submit_payload: version.submit_payload_json || null,
      ui_state: version.ui_state_json || null,
      summary: version.summary_json || review.summary_json || {},
    };
  }

  async withdraw(params: ReviewIdentityParams = {}) {
    const review = await this.getReviewOrFail(params);
    this.assertStatus(review, ['pending_review'], '只有待审核单可以撤回');
    return this.transitionReview(
      review,
      'draft',
      'withdraw',
      params.remark || '撤回送审'
    );
  }

  async approve(params: ReviewIdentityParams = {}) {
    const review = await this.getReviewOrFail(params);
    this.assertStatus(review, ['pending_review'], '只有待审核单可以审核通过');
    const operator = this.getCurrentAdminUser();
    review.status = 'approved';
    review.reviewed_by_user_id = operator.userId;
    review.reviewed_by_username = operator.username;
    review.reviewed_by_nickname = operator.nickname;
    review.reviewed_time = new Date();
    review.review_remark = this.normalizeText(params.remark);
    const saved = await this.reviewRepo.save(review);
    await this.createLog(
      saved.review_no,
      saved.current_version_id,
      'approve',
      'pending_review',
      'approved',
      params.remark
    );
    return { review_no: saved.review_no, status: saved.status, review: saved };
  }

  async reject(params: ReviewIdentityParams = {}) {
    const review = await this.getReviewOrFail(params);
    this.assertStatus(review, ['pending_review'], '只有待审核单可以驳回');
    const operator = this.getCurrentAdminUser();
    review.status = 'rejected';
    review.reviewed_by_user_id = operator.userId;
    review.reviewed_by_username = operator.username;
    review.reviewed_by_nickname = operator.nickname;
    review.reviewed_time = new Date();
    review.review_remark = this.normalizeText(params.remark);
    const saved = await this.reviewRepo.save(review);
    await this.createLog(
      saved.review_no,
      saved.current_version_id,
      'reject',
      'pending_review',
      'rejected',
      params.remark
    );
    return { review_no: saved.review_no, status: saved.status, review: saved };
  }

  async execute(params: ReviewIdentityParams = {}) {
    const review = await this.getReviewOrFail(params);
    this.assertStatus(
      review,
      ['approved', 'execute_failed', 'execute_partial_failed'],
      '只有已审核或发送失败的审核单可以发送'
    );
    const version = review.current_version_id
      ? await this.versionRepo.findOneBy({
          id: review.current_version_id,
        } as any)
      : null;
    const submitPayload = version?.submit_payload_json;
    if (!submitPayload?.records?.length) {
      throw new Error('审核单缺少可发送的发货计划payload');
    }

    const previousStatus = review.status;
    const operator = this.getCurrentAdminUser();
    review.status = 'executing';
    review.executed_by_user_id = operator.userId;
    review.executed_by_username = operator.username;
    review.executed_by_nickname = operator.nickname;
    review.executed_time = new Date();
    review.execute_error = null;
    await this.reviewRepo.save(review);
    await this.createLog(
      review.review_no,
      review.current_version_id,
      'execute',
      previousStatus,
      'executing',
      params.remark
    );

    try {
      const result: any = review.executed_batch_no
        ? await this.appAmzBsrBatchShipService.retryFailed({
            batch_no: review.executed_batch_no,
          })
        : await this.appAmzBsrBatchShipService.submit(submitPayload);
      const batch: any = result?.batch || {};
      const finalStatus = this.mapExecuteStatus(
        batch?.status || result?.status
      );
      review.status = finalStatus;
      review.executed_batch_no =
        result?.batch_no || batch?.batch_no || review.executed_batch_no || '';
      review.execute_result_json = result || null;
      review.execute_error = null;
      await this.reviewRepo.save(review);
      await this.patchAllocationExecution(review, result);
      await this.createLog(
        review.review_no,
        review.current_version_id,
        'execute',
        'executing',
        finalStatus,
        '发送完成',
        result
      );
      return {
        review_no: review.review_no,
        status: review.status,
        executed_batch_no: review.executed_batch_no,
        result,
      };
    } catch (error: any) {
      const message = error?.message || '批量发货审核单发送失败';
      review.status = 'execute_failed';
      review.execute_error = message;
      review.execute_result_json = { error: message };
      await this.reviewRepo.save(review);
      await this.createLog(
        review.review_no,
        review.current_version_id,
        'execute',
        'executing',
        'execute_failed',
        message
      );
      throw error;
    }
  }

  private async saveReviewVersion(
    params: ReviewSaveParams,
    targetStatus: string,
    saveType: string,
    action: string
  ): Promise<SaveReviewVersionResult> {
    const manager = this.reviewRepo.manager as EntityManager;
    if (manager?.transaction) {
      return manager.transaction(transactionManager =>
        this.saveReviewVersionInRepos(
          params,
          targetStatus,
          saveType,
          action,
          this.getReviewRepositorySet(transactionManager)
        )
      );
    }
    return this.saveReviewVersionInRepos(
      params,
      targetStatus,
      saveType,
      action,
      this.getReviewRepositorySet()
    );
  }

  private async saveReviewVersionInRepos(
    params: ReviewSaveParams,
    targetStatus: string,
    saveType: string,
    action: string,
    repos: ReviewRepositorySet
  ): Promise<SaveReviewVersionResult> {
    const normalized = this.normalizeSaveParams(params);
    const existingReviewNo = this.normalizeText(
      params.review_no ?? params.reviewNo
    );
    const review = existingReviewNo
      ? await this.getReviewOrFailFromRepo(repos.reviewRepo, {
          review_no: existingReviewNo,
        })
      : new AppAmzBsrBatchShipReviewEntity();
    const previousStatus = review.status || '';

    if (review.id) {
      this.assertStatus(
        review,
        ['draft', 'rejected'],
        '只有草稿或已驳回审核单可以继续保存'
      );
    } else {
      review.review_no = await this.generateReviewNo();
    }

    const versionNo = await this.getNextVersionNo(
      review.review_no,
      repos.versionRepo
    );
    const summary = this.buildSummary(normalized.submitPayload);
    const operator = this.getCurrentAdminUser();
    const version = new AppAmzBsrBatchShipReviewVersionEntity();
    version.review_no = review.review_no;
    version.version_no = versionNo;
    version.save_type = saveType;
    version.input_snapshot_json = normalized.inputSnapshot;
    version.workbench_snapshot_json = normalized.workbenchSnapshot;
    version.submit_payload_json = normalized.submitPayload;
    version.ui_state_json = normalized.uiState;
    version.summary_json = summary;
    version.created_by_user_id = operator.userId;
    version.created_by_username = operator.username;
    version.created_by_nickname = operator.nickname;
    const savedVersion = await repos.versionRepo.save(version);

    if (!review.created_by_user_id && !review.created_by_username) {
      review.created_by_user_id = operator.userId;
      review.created_by_username = operator.username;
      review.created_by_nickname = operator.nickname;
    }

    review.status = targetStatus;
    review.current_version_id = savedVersion.id;
    review.client_submit_token = this.normalizeText(
      normalized.submitPayload.client_submit_token
    );
    review.total_ship_qty = summary.total_ship_qty;
    review.product_count = summary.product_count;
    review.segment_count = summary.segment_count;
    review.order_count = summary.order_count;
    review.method_count = summary.method_count;
    review.warehouse_count = summary.warehouse_count;
    review.keyword_text = summary.keyword_text;
    review.summary_json = summary;
    review.source_page_json = normalized.sourcePage;
    review.execute_error = null;
    if (targetStatus === 'pending_review') {
      review.submitted_by_user_id = operator.userId;
      review.submitted_by_username = operator.username;
      review.submitted_by_nickname = operator.nickname;
      review.submitted_time = new Date();
      review.reviewed_by_user_id = null;
      review.reviewed_by_username = null;
      review.reviewed_by_nickname = null;
      review.reviewed_time = null;
      review.review_remark = null;
    }
    const savedReview = await repos.reviewRepo.save(review);
    await this.saveSnapshotRows(
      savedReview,
      savedVersion,
      normalized.submitPayload,
      normalized.inputSnapshot,
      normalized.workbenchSnapshot,
      repos
    );
    await this.createLog(
      savedReview.review_no,
      savedVersion.id,
      action,
      previousStatus || null,
      targetStatus,
      normalized.remark,
      summary,
      repos.logRepo
    );

    return {
      review: savedReview,
      version: savedVersion,
      summary,
    };
  }

  private getReviewRepositorySet(manager?: EntityManager): ReviewRepositorySet {
    if (!manager) {
      return {
        reviewRepo: this.reviewRepo,
        versionRepo: this.versionRepo,
        productRepo: this.productRepo,
        segmentRepo: this.segmentRepo,
        allocationRepo: this.allocationRepo,
        logRepo: this.logRepo,
      };
    }
    return {
      reviewRepo: manager.getRepository(AppAmzBsrBatchShipReviewEntity),
      versionRepo: manager.getRepository(AppAmzBsrBatchShipReviewVersionEntity),
      productRepo: manager.getRepository(AppAmzBsrBatchShipReviewProductEntity),
      segmentRepo: manager.getRepository(AppAmzBsrBatchShipReviewSegmentEntity),
      allocationRepo: manager.getRepository(
        AppAmzBsrBatchShipReviewAllocationEntity
      ),
      logRepo: manager.getRepository(AppAmzBsrBatchShipReviewLogEntity),
    };
  }

  private normalizeSaveParams(params: ReviewSaveParams) {
    const submitPayload = this.sanitizePayload(
      params.submit_payload ?? params.submitPayload
    );
    if (
      !submitPayload?.records ||
      !Array.isArray(submitPayload.records) ||
      submitPayload.records.length === 0
    ) {
      throw new Error('请提供可保存的批量发货记录');
    }
    this.assertCompleteSubmitPayload(submitPayload);
    this.assertSubmitPayloadRecordAllocations(submitPayload);
    return {
      sourcePage: this.sanitizePayload(
        params.source_page ?? params.sourcePage ?? null
      ),
      inputSnapshot: this.sanitizePayload(
        params.input_snapshot ?? params.inputSnapshot ?? null
      ),
      workbenchSnapshot: this.sanitizePayload(
        params.workbench_snapshot ?? params.workbenchSnapshot ?? null
      ),
      submitPayload,
      uiState: this.sanitizePayload(params.ui_state ?? params.uiState ?? null),
      remark: this.normalizeText(params.remark),
    };
  }

  private assertSubmitPayloadRecordAllocations(submitPayload: any) {
    const records = Array.isArray(submitPayload?.records)
      ? submitPayload.records
      : [];
    records.forEach((record: any, index: number) => {
      const shipQty = this.toInt(record.shipQty ?? record.ship_qty);
      const orderDetails = Array.isArray(record.orderDetails)
        ? record.orderDetails
        : Array.isArray(record.order_details)
        ? record.order_details
        : [];
      const allocationTotal = orderDetails.reduce(
        (sum: number, order: any) =>
          sum + this.toInt(order?.ship_qty ?? order?.shipQty),
        0
      );
      if (shipQty !== allocationTotal) {
        const productText =
          this.normalizeText(record.msku) ||
          this.normalizeText(record.asin) ||
          this.normalizeText(record.productName ?? record.product_name) ||
          `第 ${index + 1} 条记录`;
        const methodText =
          this.normalizeText(record.shippingLabel ?? record.method_label) ||
          this.normalizeText(record.shippingMethod ?? record.method_key) ||
          '运输段';
        throw new Error(
          `${productText} / ${methodText} 发货量 ${shipQty} 与采购单明细合计 ${allocationTotal} 不一致，请重新保存审核单`
        );
      }
    });
  }

  private assertCompleteSubmitPayload(submitPayload: any) {
    const records = Array.isArray(submitPayload?.records)
      ? submitPayload.records
      : [];
    records.forEach((record: any, index: number) => {
      const recordText = this.getSubmitRecordDisplayText(record, index);
      if (!this.hasFilledValue(record.warehouse ?? record.warehouse_id)) {
        throw new Error(`${recordText} 缺少发货仓库`);
      }
      if (!this.hasFilledValue(record.packageType ?? record.packing_type)) {
        throw new Error(`${recordText} 缺少包装类型`);
      }
      const planShipDate = this.normalizeText(
        record.planShipDate ?? record.plan_ship_date
      );
      if (!planShipDate) {
        throw new Error(`${recordText} 缺少计划发货日期`);
      }
      if (!this.isValidDateText(planShipDate)) {
        throw new Error(`${recordText} 计划发货日期格式不正确`);
      }
      const orderDetails = Array.isArray(record.orderDetails)
        ? record.orderDetails
        : Array.isArray(record.order_details)
        ? record.order_details
        : [];
      if (
        !orderDetails.some(
          (order: any) => this.toInt(order?.ship_qty ?? order?.shipQty) > 0
        )
      ) {
        throw new Error(`${recordText} 缺少采购单发货明细`);
      }
    });
  }

  private getSubmitRecordDisplayText(record: any, index: number) {
    const productText =
      this.normalizeText(record.msku) ||
      this.normalizeText(record.asin) ||
      this.normalizeText(record.productName ?? record.product_name) ||
      `第 ${index + 1} 条记录`;
    const methodText =
      this.normalizeText(record.shippingLabel ?? record.method_label) ||
      this.normalizeText(record.shippingMethod ?? record.method_key) ||
      '运输段';
    return `${productText} / ${methodText}`;
  }

  private sanitizePayload(value: any): any {
    if (Array.isArray(value))
      return value.map(item => this.sanitizePayload(item));
    if (value && typeof value === 'object') {
      const result: any = {};
      for (const [key, item] of Object.entries(value)) {
        const normalizedKey = key.toLowerCase();
        if (
          normalizedKey === 'authorization' ||
          normalizedKey === 'token' ||
          normalizedKey === 'refreshtoken' ||
          normalizedKey === 'cookie' ||
          normalizedKey === 'headers'
        ) {
          continue;
        }
        result[key] = this.sanitizePayload(item);
      }
      return result;
    }
    return value;
  }

  private async saveSnapshotRows(
    review: AppAmzBsrBatchShipReviewEntity,
    version: AppAmzBsrBatchShipReviewVersionEntity,
    submitPayload: any,
    inputSnapshot: any = null,
    workbenchSnapshot: any = null,
    repos: ReviewRepositorySet = this.getReviewRepositorySet()
  ) {
    const records = Array.isArray(submitPayload?.records)
      ? submitPayload.records
      : [];
    const productRows: AppAmzBsrBatchShipReviewProductEntity[] = [];
    const segmentRows: AppAmzBsrBatchShipReviewSegmentEntity[] = [];
    const allocationRows: AppAmzBsrBatchShipReviewAllocationEntity[] = [];
    const productLineMap = new Map<string, number>();
    const productSnapshotIndex = this.buildProductSnapshotIndex(
      inputSnapshot,
      workbenchSnapshot
    );

    records.forEach((record: any, recordIndex: number) => {
      const productKey = this.buildProductKey(record);
      const snapshot = this.findProductSnapshot(record, productSnapshotIndex);
      if (!productLineMap.has(productKey)) {
        const productLineNo = productLineMap.size + 1;
        productLineMap.set(productKey, productLineNo);
        const product = new AppAmzBsrBatchShipReviewProductEntity();
        product.review_no = review.review_no;
        product.version_id = version.id;
        product.product_line_no = productLineNo;
        product.item_key = this.normalizeText(record.itemKey);
        product.row_key = this.normalizeText(record.row_key ?? record.rowKey);
        product.store_id = this.toNullableInt(
          record.sid ?? record.storeId ?? record.store_id
        );
        product.listing_id = this.toNullableInt(
          record.listingId ?? record.listing_id
        );
        product.asin = this.normalizeText(record.asin);
        product.marketplace = this.normalizeText(record.marketplace);
        product.msku = this.normalizeText(record.msku);
        product.fnsku = this.normalizeText(record.fnsku);
        product.product_code = this.normalizeText(
          record.productCode ?? record.product_code
        );
        product.product_name = this.normalizeText(
          record.productName ?? record.product_name
        );
        product.product_img = this.normalizeText(
          record.productImg ?? record.product_img
        );
        product.seller_name = this.pickText(
          record,
          snapshot,
          'sellerName',
          'seller_name',
          'shop',
          'storeName',
          'store_name'
        );
        product.daily_avg_sales = this.pickNullableNumber(
          record,
          snapshot,
          'daily_avg_sales',
          'dailyAvgSales'
        );
        product.target_stock_days = this.pickNullableInt(
          record,
          snapshot,
          'target_stock_days',
          'targetStockDays',
          'effective_target_stock_days',
          'current_target_stock_days'
        );
        product.volatility_coefficient = this.pickNullableNumber(
          record,
          snapshot,
          'volatility_coefficient',
          'volatilityCoefficient'
        );
        product.fba_qty = this.pickNullableInt(
          record,
          snapshot,
          'fba_qty',
          'fbaQty'
        );
        product.reserved_qty = this.pickNullableInt(
          record,
          snapshot,
          'reserved_qty',
          'reservedQty',
          'fba_reserved_qty',
          'fbaReservedQty'
        );
        product.in_transit_qty = this.pickNullableInt(
          record,
          snapshot,
          'in_transit_qty',
          'inTransitQty'
        );
        product.local_qty = this.pickNullableInt(
          record,
          snapshot,
          'local_qty',
          'localQty'
        );
        product.actual_shippable_qty = this.pickNullableInt(
          record,
          snapshot,
          'actual_shippable_qty',
          'actualShippableQty'
        );
        product.purchase_plan_qty = this.pickNullableInt(
          record,
          snapshot,
          'purchase_plan_qty',
          'purchasePlanQty'
        );
        product.pending_delivery_qty = this.pickNullableInt(
          record,
          snapshot,
          'pending_delivery_qty',
          'pendingDeliveryQty'
        );
        product.ship_qty = 0;
        product.product_snapshot_json = snapshot
          ? { ...snapshot, submit_record: record }
          : record;
        productRows.push(product);
      }

      const productLineNo = productLineMap.get(productKey) || 1;
      const product = productRows.find(
        row => row.product_line_no === productLineNo
      );
      if (product)
        product.ship_qty += this.toInt(record.shipQty ?? record.ship_qty);

      const segmentLineNo = recordIndex + 1;
      const segment = new AppAmzBsrBatchShipReviewSegmentEntity();
      segment.review_no = review.review_no;
      segment.version_id = version.id;
      segment.product_line_no = productLineNo;
      segment.segment_line_no = segmentLineNo;
      segment.item_key = this.normalizeText(record.itemKey);
      segment.method_key = this.normalizeText(
        record.shippingMethod ?? record.method_key
      );
      segment.method_label = this.normalizeText(
        record.shippingLabel ?? record.method_label
      );
      segment.method_icon = this.normalizeText(
        record.shippingIcon ?? record.method_icon
      );
      segment.method_color = this.normalizeText(
        record.shippingColor ?? record.method_color
      );
      segment.date_range_json = Array.isArray(record.dateRange)
        ? record.dateRange
        : record.date_range;
      segment.arrival_range_text = this.normalizeText(
        record.arrivalRangeText ?? record.arrival_range_text
      );
      segment.ship_qty = this.toInt(record.shipQty ?? record.ship_qty);
      segment.system_suggest_qty = this.toInt(
        record.systemSuggestQty ?? record.system_suggest_qty
      );
      segment.manual_adjusted =
        record.manualAdjusted ?? record.manual_adjusted ? 1 : 0;
      segment.manual_input_qty = this.toNullableInt(
        record.manualInputQty ?? record.manual_input_qty ?? record.shipQty
      );
      segment.gap_qty = this.toNullableInt(record.gapQty ?? record.gap_qty);
      segment.remaining_gap_qty = this.toNullableInt(
        record.remainingGapQty ?? record.remaining_gap_qty
      );
      segment.warehouse_id = this.toNullableInt(
        record.warehouse ?? record.warehouse_id
      );
      segment.warehouse_name = this.normalizeText(
        record.warehouseName ?? record.warehouse_name
      );
      segment.warehouse_snapshot_json =
        record.warehouseSnapshot ?? record.warehouse_snapshot ?? null;
      segment.packing_type = this.toNullableInt(
        record.packageType ?? record.packing_type
      );
      segment.packing_type_label = this.getPackingTypeLabel(
        segment.packing_type
      );
      segment.plan_ship_date = this.toNullableDateText(
        record.planShipDate ?? record.plan_ship_date
      ) as any;
      segment.detail_remark = this.normalizeText(
        record.remark ?? record.detail_remark
      );
      segment.batch_remark = this.normalizeText(
        record.batchRemark ?? record.batch_remark
      );
      segment.algo_label = this.normalizeText(
        record.algoLabel ?? record.algo_label
      );
      segment.calculation_json =
        record.calculation_json ?? record.calculationSnapshot ?? null;
      segment.segment_snapshot_json = record;
      segmentRows.push(segment);

      const orderDetails = Array.isArray(record.orderDetails)
        ? record.orderDetails
        : [];
      orderDetails
        .filter(
          (order: any) => this.toInt(order?.ship_qty ?? order?.shipQty) > 0
        )
        .forEach((order: any, orderIndex: number) => {
          const allocation = new AppAmzBsrBatchShipReviewAllocationEntity();
          allocation.review_no = review.review_no;
          allocation.version_id = version.id;
          allocation.product_line_no = productLineNo;
          allocation.segment_line_no = segmentLineNo;
          allocation.allocation_line_no = orderIndex + 1;
          allocation.purchase_plan_sn = this.normalizeText(
            order.plan_sn ?? order.purchase_plan_sn
          );
          allocation.purchase_order_sn = this.normalizeText(
            order.order_sn ?? order.purchase_order_sn
          );
          allocation.analysis_record_id = this.toNullableInt(
            order.analysis_record_id ?? order.analysisRecordId
          );
          allocation.linked_plan_sns_json = Array.isArray(order.linked_plan_sns)
            ? order.linked_plan_sns
            : [];
          allocation.linked_analysis_record_ids_json = Array.isArray(
            order.linked_analysis_record_ids
          )
            ? order.linked_analysis_record_ids
            : [];
          allocation.ship_qty = this.toInt(order.ship_qty ?? order.shipQty);
          allocation.actual_shippable_qty = this.toNullableInt(
            order.actual_shippable_qty ?? order.actualShippableQty
          );
          allocation.estimated_shippable_qty = this.toNullableInt(
            order.estimated_shippable_qty ?? order.estimatedShippableQty
          );
          allocation.order_status_text = this.normalizeText(
            order.status_text ?? order.order_status_text
          );
          allocation.supplier_name = this.normalizeText(order.supplier_name);
          allocation.order_time = this.normalizeText(order.order_time);
          allocation.logistics_status_text = this.normalizeText(
            order.logistics_status_text
          );
          allocation.logistics_status_reason = this.normalizeText(
            order.logistics_status_reason
          );
          allocation.allocation_snapshot_json = order;
          allocation.execute_status = 'pending';
          allocationRows.push(allocation);
        });
    });

    if (productRows.length) await repos.productRepo.save(productRows);
    if (segmentRows.length) await repos.segmentRepo.save(segmentRows);
    if (allocationRows.length) await repos.allocationRepo.save(allocationRows);
  }

  private buildSummary(submitPayload: any) {
    const records = Array.isArray(submitPayload?.records)
      ? submitPayload.records
      : [];
    const productKeys = new Set<string>();
    const methodKeys = new Set<string>();
    const warehouseKeys = new Set<string>();
    const orderSns = new Set<string>();
    const planSns = new Set<string>();
    const keywordValues: string[] = [];
    let totalShipQty = 0;
    let allocationCount = 0;

    records.forEach((record: any) => {
      productKeys.add(this.buildProductKey(record));
      const methodKey = this.normalizeText(
        record.shippingMethod ?? record.method_key
      );
      if (methodKey) methodKeys.add(methodKey);
      const warehouseKey = this.normalizeText(
        record.warehouse ?? record.warehouse_id
      );
      if (warehouseKey) warehouseKeys.add(warehouseKey);
      const recordQty = this.toInt(record.shipQty ?? record.ship_qty);
      totalShipQty += recordQty;
      keywordValues.push(
        record.itemKey,
        record.asin,
        record.msku,
        record.fnsku,
        record.productCode,
        record.productName,
        record.marketplace,
        record.warehouseName
      );
      const orderDetails = Array.isArray(record.orderDetails)
        ? record.orderDetails
        : [];
      orderDetails
        .filter(
          (order: any) => this.toInt(order?.ship_qty ?? order?.shipQty) > 0
        )
        .forEach((order: any) => {
          allocationCount += 1;
          const orderSn = this.normalizeText(
            order.order_sn ?? order.purchase_order_sn
          );
          const planSn = this.normalizeText(
            order.plan_sn ?? order.purchase_plan_sn
          );
          if (orderSn) orderSns.add(orderSn);
          if (planSn) planSns.add(planSn);
          keywordValues.push(orderSn, planSn, order.supplier_name);
        });
    });

    const keywordText = this.uniqueTexts(keywordValues).join(' ');
    const methodSummary = this.buildMethodSummary(records);
    return {
      total_ship_qty: totalShipQty,
      product_count: productKeys.size,
      segment_count: records.length,
      order_count: orderSns.size || allocationCount,
      allocation_count: allocationCount,
      method_count: methodKeys.size,
      warehouse_count: warehouseKeys.size,
      purchase_plan_count: planSns.size,
      keyword_text: keywordText,
      method_summary: methodSummary,
      temp_save_summary:
        submitPayload?.planned_snapshot?.tempSaveSummary || null,
    };
  }

  private buildMethodSummary(records: any[]) {
    const map = new Map<string, any>();
    records.forEach(record => {
      const key =
        this.normalizeText(record.shippingMethod ?? record.method_key) ||
        'unknown';
      if (!map.has(key)) {
        map.set(key, {
          method_key: key,
          method_label:
            this.normalizeText(record.shippingLabel ?? record.method_label) ||
            key,
          planned_qty: 0,
          product_count: new Set<string>(),
        });
      }
      const row = map.get(key);
      row.planned_qty += this.toInt(record.shipQty ?? record.ship_qty);
      row.product_count.add(this.buildProductKey(record));
    });
    return Array.from(map.values()).map(row => ({
      ...row,
      product_count: row.product_count.size,
    }));
  }

  private async getNextVersionNo(
    reviewNo: string,
    versionRepo: Repository<AppAmzBsrBatchShipReviewVersionEntity> = this
      .versionRepo
  ) {
    const rows = await versionRepo.find({
      where: { review_no: reviewNo } as any,
      order: { version_no: 'DESC' } as any,
      take: 1,
    } as any);
    return (rows?.[0]?.version_no || 0) + 1;
  }

  private async getReviewOrFail(params: ReviewIdentityParams) {
    const reviewNo = this.normalizeText(params.review_no ?? params.reviewNo);
    const id = this.toNullableInt(params.id);
    const review = reviewNo
      ? await this.reviewRepo.findOne({ where: { review_no: reviewNo } as any })
      : id
      ? await this.reviewRepo.findOne({ where: { id } as any })
      : null;
    if (!review)
      throw new Error(`批量发货审核单不存在：${reviewNo || id || '-'}`);
    return review;
  }

  private async getReviewOrFailFromRepo(
    reviewRepo: Repository<AppAmzBsrBatchShipReviewEntity>,
    params: ReviewIdentityParams
  ) {
    const reviewNo = this.normalizeText(params.review_no ?? params.reviewNo);
    const id = this.toNullableInt(params.id);
    const review = reviewNo
      ? await reviewRepo.findOne({ where: { review_no: reviewNo } as any })
      : id
      ? await reviewRepo.findOne({ where: { id } as any })
      : null;
    if (!review)
      throw new Error(`批量发货审核单不存在：${reviewNo || id || '-'}`);
    return review;
  }

  private assertStatus(
    review: AppAmzBsrBatchShipReviewEntity,
    statuses: string[],
    message: string
  ) {
    if (!statuses.includes(review.status)) {
      throw new Error(`${message}，当前状态：${review.status || '-'}`);
    }
  }

  private async transitionReview(
    review: AppAmzBsrBatchShipReviewEntity,
    toStatus: string,
    action: string,
    remark = ''
  ) {
    const fromStatus = review.status;
    review.status = toStatus;
    const saved = await this.reviewRepo.save(review);
    await this.createLog(
      saved.review_no,
      saved.current_version_id,
      action,
      fromStatus,
      toStatus,
      remark
    );
    return {
      review_no: saved.review_no,
      status: saved.status,
      review: saved,
    };
  }

  private async createLog(
    reviewNo: string,
    versionId: number,
    action: string,
    fromStatus: string,
    toStatus: string,
    remark = '',
    snapshot: any = null,
    logRepo: Repository<AppAmzBsrBatchShipReviewLogEntity> = this.logRepo
  ) {
    const operator = this.getCurrentAdminUser();
    const log = new AppAmzBsrBatchShipReviewLogEntity();
    log.review_no = reviewNo;
    log.version_id = versionId || null;
    log.action = action;
    log.from_status = fromStatus || null;
    log.to_status = toStatus || null;
    log.operator_user_id = operator.userId;
    log.operator_username = operator.username;
    log.operator_nickname = operator.nickname;
    log.remark = this.normalizeText(remark);
    log.snapshot_json = snapshot;
    return logRepo.save(log);
  }

  private async patchAllocationExecution(
    review: AppAmzBsrBatchShipReviewEntity,
    result: any
  ) {
    if (!review.current_version_id) return;
    const batchNo = this.normalizeText(
      review.executed_batch_no || result?.batch_no || result?.batch?.batch_no
    );
    const details = this.collectExecutionDetails(result);
    if (!details.length) {
      if (!batchNo) return;
      await this.allocationRepo.update(
        { version_id: review.current_version_id } as any,
        {
          execute_status: this.getFallbackAllocationExecuteStatus(
            review.status
          ),
          executed_batch_no: batchNo,
          execute_error: review.execute_error || null,
        } as any
      );
      return;
    }

    const allocations = await this.allocationRepo.find({
      where: { version_id: review.current_version_id } as any,
      order: {
        product_line_no: 'ASC',
        segment_line_no: 'ASC',
        allocation_line_no: 'ASC',
      } as any,
    });
    const detailMap = this.buildExecutionDetailMap(details);

    for (const allocation of allocations) {
      const detail = this.takeExecutionDetailForAllocation(
        detailMap,
        allocation
      );
      const partial = detail
        ? this.buildAllocationExecutionPatch(detail, batchNo)
        : {
            execute_status: this.getFallbackAllocationExecuteStatus(
              review.status
            ),
            executed_batch_no: batchNo,
            execute_error: review.execute_error || null,
          };
      await this.allocationRepo.update({ id: allocation.id } as any, partial);
    }
  }

  private collectExecutionDetails(result: any) {
    const rows: any[] = [];
    for (const method of result?.warehouse_summary || []) {
      if (Array.isArray(method?.detail_rows)) rows.push(...method.detail_rows);
    }
    if (Array.isArray(result?.failed_items)) rows.push(...result.failed_items);
    if (Array.isArray(result?.local_sync_failed_items)) {
      rows.push(...result.local_sync_failed_items);
    }

    const seen = new Set<string>();
    return rows.filter(row => {
      const key = row?.id
        ? `id:${row.id}`
        : [
            row?.batch_no,
            row?.purchase_plan_sn,
            row?.purchase_order_sn,
            row?.ship_qty,
            row?.status,
            row?.local_sync_status,
          ].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private buildExecutionDetailMap(details: any[]) {
    const map = new Map<string, any[]>();
    details.forEach(detail => {
      for (const key of [
        this.buildAllocationMatchKey(
          detail.purchase_plan_sn,
          detail.purchase_order_sn,
          detail.ship_qty
        ),
        this.buildAllocationMatchKey(
          detail.purchase_plan_sn,
          detail.purchase_order_sn,
          ''
        ),
      ]) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(detail);
      }
    });
    return map;
  }

  private takeExecutionDetailForAllocation(
    detailMap: Map<string, any[]>,
    allocation: AppAmzBsrBatchShipReviewAllocationEntity
  ) {
    const exactKey = this.buildAllocationMatchKey(
      allocation.purchase_plan_sn,
      allocation.purchase_order_sn,
      allocation.ship_qty
    );
    const exactRows = detailMap.get(exactKey);
    if (exactRows?.length) {
      const detail = exactRows.shift();
      this.removeExecutionDetailFromMap(detailMap, detail);
      return detail;
    }

    const looseKey = this.buildAllocationMatchKey(
      allocation.purchase_plan_sn,
      allocation.purchase_order_sn,
      ''
    );
    const looseRows = detailMap.get(looseKey);
    if (looseRows?.length) {
      const detail = looseRows.shift();
      this.removeExecutionDetailFromMap(detailMap, detail);
      return detail;
    }
    return null;
  }

  private removeExecutionDetailFromMap(
    detailMap: Map<string, any[]>,
    detail: any
  ) {
    if (!detail) return;
    for (const rows of detailMap.values()) {
      const index = rows.indexOf(detail);
      if (index >= 0) rows.splice(index, 1);
    }
  }

  private buildAllocationMatchKey(planSn: any, orderSn: any, qty: any) {
    return [
      this.normalizeText(planSn),
      this.normalizeText(orderSn),
      qty === '' ? '' : this.toInt(qty),
    ].join('|');
  }

  private buildAllocationExecutionPatch(detail: any, fallbackBatchNo: string) {
    const localSyncFailed = detail.local_sync_status === 'failed';
    const failed = detail.status === 'failed' || localSyncFailed;
    return {
      execute_status: failed ? 'failed' : 'success',
      executed_batch_no:
        this.normalizeText(detail.batch_no) || fallbackBatchNo || '',
      executed_detail_id: this.toNullableInt(detail.id),
      lingxing_seq: this.normalizeText(detail.lingxing_seq),
      execute_error: failed
        ? this.normalizeText(detail.error_message || detail.local_sync_error)
        : null,
    };
  }

  private getFallbackAllocationExecuteStatus(reviewStatus: string) {
    if (reviewStatus === 'execute_success') return 'success';
    if (reviewStatus === 'execute_failed') return 'failed';
    return 'pending';
  }

  private mapExecuteStatus(batchStatus: string) {
    if (batchStatus === 'success') return 'execute_success';
    if (batchStatus === 'partial_failed') return 'execute_partial_failed';
    return 'execute_failed';
  }

  private buildSaveResult(result: SaveReviewVersionResult) {
    return {
      review_no: result.review.review_no,
      status: result.review.status,
      version_id: result.version.id,
      version_no: result.version.version_no,
      summary: result.summary,
      review: result.review,
    };
  }

  private buildPageRow(
    row: AppAmzBsrBatchShipReviewEntity,
    productPreviewMap: Map<number, any> = new Map()
  ) {
    const versionId = Number(row.current_version_id) || 0;
    return {
      id: row.id,
      review_no: row.review_no,
      status: row.status,
      current_version_id: row.current_version_id,
      client_submit_token: row.client_submit_token,
      executed_batch_no: row.executed_batch_no,
      total_ship_qty: row.total_ship_qty,
      product_count: row.product_count,
      segment_count: row.segment_count,
      order_count: row.order_count,
      method_count: row.method_count,
      warehouse_count: row.warehouse_count,
      keyword_text: row.keyword_text || '',
      summary: row.summary_json || {},
      created_by_user_id: row.created_by_user_id || null,
      created_by_username: row.created_by_username || '',
      created_by_nickname: row.created_by_nickname || '',
      submitted_by_username: row.submitted_by_username || '',
      submitted_by_nickname: row.submitted_by_nickname || '',
      submitted_time: row.submitted_time || null,
      reviewed_by_username: row.reviewed_by_username || '',
      reviewed_by_nickname: row.reviewed_by_nickname || '',
      reviewed_time: row.reviewed_time || null,
      review_remark: row.review_remark || '',
      executed_by_username: row.executed_by_username || '',
      executed_by_nickname: row.executed_by_nickname || '',
      executed_time: row.executed_time || null,
      execute_error: row.execute_error || '',
      product_preview: productPreviewMap.get(versionId) || {
        total: 0,
        hidden_count: 0,
        list: [],
      },
      createTime: (row as any).createTime || null,
      updateTime: (row as any).updateTime || null,
      create_time: (row as any).createTime || null,
      update_time: (row as any).updateTime || null,
    };
  }

  private async buildPageProductPreviewMap(
    rows: AppAmzBsrBatchShipReviewEntity[]
  ) {
    const versionIds = this.uniqueTexts(
      (rows || []).map(row => row.current_version_id)
    ).map(id => Number(id));
    const ids = versionIds.filter(id => Number.isFinite(id) && id > 0);
    const result = new Map<number, any>();
    ids.forEach(id => {
      result.set(id, { total: 0, hidden_count: 0, list: [] });
    });
    if (!ids.length) return result;

    const [versions, products, segments] = await Promise.all([
      this.versionRepo
        .createQueryBuilder('version')
        .where('version.id IN (:...ids)', { ids })
        .getMany(),
      this.productRepo
        .createQueryBuilder('product')
        .where('product.version_id IN (:...ids)', { ids })
        .orderBy('product.version_id', 'ASC')
        .addOrderBy('product.product_line_no', 'ASC')
        .getMany(),
      this.segmentRepo
        .createQueryBuilder('segment')
        .where('segment.version_id IN (:...ids)', { ids })
        .orderBy('segment.version_id', 'ASC')
        .addOrderBy('segment.product_line_no', 'ASC')
        .addOrderBy('segment.segment_line_no', 'ASC')
        .getMany(),
    ]);

    const versionMap = new Map<number, AppAmzBsrBatchShipReviewVersionEntity>();
    versions.forEach(version => versionMap.set(Number(version.id), version));

    const segmentsByProduct = new Map<
      string,
      AppAmzBsrBatchShipReviewSegmentEntity[]
    >();
    segments.forEach(segment => {
      const key = this.buildVersionProductLineKey(
        segment.version_id,
        segment.product_line_no
      );
      const list = segmentsByProduct.get(key) || [];
      list.push(segment);
      segmentsByProduct.set(key, list);
    });

    const productsByVersion = new Map<
      number,
      AppAmzBsrBatchShipReviewProductEntity[]
    >();
    products.forEach(product => {
      const versionId = Number(product.version_id) || 0;
      const list = productsByVersion.get(versionId) || [];
      list.push(product);
      productsByVersion.set(versionId, list);
    });

    const previewLimit = 12;
    productsByVersion.forEach((versionProducts, versionId) => {
      const version = versionMap.get(versionId) || null;
      const hydratedProducts = this.hydrateProductRowsFromSnapshots(
        versionProducts,
        version
      );
      const previewList = hydratedProducts
        .slice(0, previewLimit)
        .map(product =>
          this.buildProductPreviewRow(
            product,
            segmentsByProduct.get(
              this.buildVersionProductLineKey(
                product.version_id,
                product.product_line_no
              )
            ) || []
          )
        );
      result.set(versionId, {
        total: hydratedProducts.length,
        hidden_count: Math.max(hydratedProducts.length - previewList.length, 0),
        list: previewList,
      });
    });

    return result;
  }

  private buildVersionProductLineKey(versionId: any, productLineNo: any) {
    return `${this.toInt(versionId)}|${this.toInt(productLineNo)}`;
  }

  private buildProductPreviewRow(
    product: AppAmzBsrBatchShipReviewProductEntity,
    segments: AppAmzBsrBatchShipReviewSegmentEntity[]
  ) {
    const methodMap = new Map<string, any>();
    let segmentQty = 0;
    (segments || []).forEach(segment => {
      const methodKey = this.normalizeText(segment.method_key) || 'unknown';
      const qty = this.toInt(segment.ship_qty);
      segmentQty += qty;
      if (!methodMap.has(methodKey)) {
        methodMap.set(methodKey, {
          method_key: methodKey,
          method_label: this.normalizeText(segment.method_label) || methodKey,
          planned_qty: 0,
        });
      }
      methodMap.get(methodKey).planned_qty += qty;
    });
    const methodSummary = Array.from(methodMap.values());
    return {
      product_line_no: product.product_line_no,
      product_name: product.product_name || '',
      product_img: product.product_img || '',
      msku: product.msku || '',
      asin: product.asin || '',
      fnsku: product.fnsku || '',
      marketplace: product.marketplace || '',
      product_code: product.product_code || '',
      seller_name: product.seller_name || '',
      ship_qty: this.toInt(product.ship_qty) || segmentQty,
      method_count: methodSummary.length,
      segment_count: (segments || []).length,
      method_summary: methodSummary,
    };
  }

  private createReviewPageQuery(
    filters: ReviewPageFilterState,
    includeStatus = true
  ) {
    const qb = this.reviewRepo.createQueryBuilder('review');

    if (includeStatus && filters.status) {
      qb.andWhere('review.status = :status', { status: filters.status });
    } else if (includeStatus && filters.statuses.length) {
      qb.andWhere('review.status IN (:...statuses)', {
        statuses: filters.statuses,
      });
    }
    if (filters.keyword) {
      qb.andWhere(
        [
          '(',
          'review.review_no LIKE :kw',
          'OR review.executed_batch_no LIKE :kw',
          'OR review.keyword_text LIKE :kw',
          'OR review.created_by_username LIKE :kw',
          'OR review.created_by_nickname LIKE :kw',
          'OR review.submitted_by_username LIKE :kw',
          'OR review.submitted_by_nickname LIKE :kw',
          ')',
        ].join(' '),
        { kw: `%${filters.keyword}%` }
      );
    }
    if (filters.onlyMine) {
      const user = this.getCurrentAdminUser();
      if (user.userId) {
        qb.andWhere(
          [
            '(',
            'review.created_by_user_id = :userId',
            'OR review.submitted_by_user_id = :userId',
            ')',
          ].join(' '),
          { userId: user.userId }
        );
      } else if (user.username) {
        qb.andWhere(
          [
            '(',
            'review.created_by_username = :username',
            'OR review.submitted_by_username = :username',
            ')',
          ].join(' '),
          { username: user.username }
        );
      } else {
        return null;
      }
    }
    if (filters.dateRange.start) {
      qb.andWhere('review.createTime >= :startTime', {
        startTime: `${filters.dateRange.start} 00:00:00`,
      });
    }
    if (filters.dateRange.end) {
      qb.andWhere('review.createTime <= :endTime', {
        endTime: `${filters.dateRange.end} 23:59:59`,
      });
    }

    return qb;
  }

  private async countReviewStatuses(filters: ReviewPageFilterState) {
    const qb = this.createReviewPageQuery(filters, false);
    if (!qb) return this.buildEmptyStatusCounts();

    const rows = await qb
      .select('review.status', 'status')
      .addSelect('COUNT(1)', 'count')
      .groupBy('review.status')
      .getRawMany();

    const counts = this.buildEmptyStatusCounts();
    rows.forEach(row => {
      const status = this.normalizeText(row.status) || 'draft';
      const count = this.toInt(row.count);
      counts[status] = count;
      counts.all += count;
    });
    return counts;
  }

  private buildEmptyStatusCounts() {
    return {
      all: 0,
      draft: 0,
      pending_review: 0,
      rejected: 0,
      approved: 0,
      executing: 0,
      execute_success: 0,
      execute_partial_failed: 0,
      execute_failed: 0,
    } as Record<string, number>;
  }

  private buildEmptyPage(
    page = 1,
    size = 20,
    statusCounts = this.buildEmptyStatusCounts()
  ) {
    return {
      pagination: { page, size, total: 0 },
      list: [],
      status_counts: statusCounts,
    };
  }

  private normalizeDateRange(value: any) {
    const list = Array.isArray(value) ? value : [];
    return {
      start: this.normalizeText(list[0]),
      end: this.normalizeText(list[1]),
    };
  }

  private normalizeStatusList(value: any) {
    if (!Array.isArray(value)) return [];
    return this.uniqueTexts(value);
  }

  private hydrateProductRowsFromSnapshots(
    products: AppAmzBsrBatchShipReviewProductEntity[],
    version: AppAmzBsrBatchShipReviewVersionEntity | null
  ) {
    if (!products?.length || !version) return products || [];
    const index = this.buildProductSnapshotIndex(
      version.input_snapshot_json,
      version.workbench_snapshot_json
    );
    return products.map(product => {
      const snapshot =
        this.findProductSnapshot(product, index) ||
        this.parseJsonValue((product as any).product_snapshot_json);
      if (!snapshot) return product;
      const row: any = { ...product };
      this.fillProductMetricsFromSnapshot(row, snapshot);
      return row;
    });
  }

  private fillProductMetricsFromSnapshot(target: any, snapshot: any) {
    if (!snapshot) return target;
    if (!this.normalizeText(target.seller_name)) {
      target.seller_name = this.pickText(
        {},
        snapshot,
        'sellerName',
        'seller_name',
        'shop',
        'storeName',
        'store_name'
      );
    }
    this.fillMissingNumber(target, 'daily_avg_sales', snapshot, [
      'daily_avg_sales',
      'dailyAvgSales',
    ]);
    this.fillMissingInt(target, 'target_stock_days', snapshot, [
      'target_stock_days',
      'targetStockDays',
      'effective_target_stock_days',
      'current_target_stock_days',
    ]);
    this.fillMissingNumber(target, 'volatility_coefficient', snapshot, [
      'volatility_coefficient',
      'volatilityCoefficient',
    ]);
    this.fillMissingInt(target, 'fba_qty', snapshot, ['fba_qty', 'fbaQty']);
    this.fillMissingInt(target, 'reserved_qty', snapshot, [
      'reserved_qty',
      'reservedQty',
      'fba_reserved_qty',
      'fbaReservedQty',
    ]);
    this.fillMissingInt(target, 'in_transit_qty', snapshot, [
      'in_transit_qty',
      'inTransitQty',
    ]);
    this.fillMissingInt(target, 'local_qty', snapshot, [
      'local_qty',
      'localQty',
    ]);
    this.fillMissingInt(target, 'actual_shippable_qty', snapshot, [
      'actual_shippable_qty',
      'actualShippableQty',
    ]);
    if (!this.hasPresentValue(target.actual_shippable_qty)) {
      const shippableQty = this.sumSnapshotOrderQty(snapshot, [
        'actual_shippable_qty',
        'actualShippableQty',
      ]);
      if (shippableQty !== null) target.actual_shippable_qty = shippableQty;
    }
    this.fillMissingInt(target, 'purchase_plan_qty', snapshot, [
      'purchase_plan_qty',
      'purchasePlanQty',
    ]);
    this.fillMissingInt(target, 'pending_delivery_qty', snapshot, [
      'pending_delivery_qty',
      'pendingDeliveryQty',
    ]);
    return target;
  }

  private sumSnapshotOrderQty(snapshot: any, qtyKeys: string[]) {
    const orderLists = [
      snapshot?.shippableOrders,
      snapshot?.orderDetails,
      snapshot?.order_details,
    ].filter(item => Array.isArray(item));
    for (const orders of orderLists) {
      let total = 0;
      let hasQty = false;
      for (const order of orders) {
        for (const key of qtyKeys) {
          const value = this.toNullableInt(order?.[key]);
          if (value === null) continue;
          total += value;
          hasQty = true;
          break;
        }
      }
      if (hasQty) return total;
    }
    return null;
  }

  private fillMissingNumber(
    target: any,
    key: string,
    snapshot: any,
    keys: string[]
  ) {
    if (this.hasPresentValue(target[key])) return;
    target[key] = this.pickNullableNumber({}, snapshot, ...keys);
  }

  private fillMissingInt(
    target: any,
    key: string,
    snapshot: any,
    keys: string[]
  ) {
    if (this.hasPresentValue(target[key])) return;
    target[key] = this.pickNullableInt({}, snapshot, ...keys);
  }

  private buildProductSnapshotIndex(
    inputSnapshot: any,
    workbenchSnapshot: any
  ) {
    const index = new Map<string, any>();
    const input = this.parseJsonValue(inputSnapshot);
    const workbench = this.parseJsonValue(workbenchSnapshot);
    const addSnapshot = (snapshot: any) => {
      if (!snapshot || typeof snapshot !== 'object') return;
      this.getProductSnapshotKeys(snapshot).forEach(key => {
        if (key && !index.has(key)) index.set(key, snapshot);
      });
    };
    const addSnapshots = (items: any) => {
      if (!Array.isArray(items)) return;
      items.forEach(addSnapshot);
    };

    addSnapshots(input?.items);
    addSnapshots(workbench?.dialogItems);
    addSnapshots(workbench?.reviewEditor?.products);
    return index;
  }

  private findProductSnapshot(record: any, index: Map<string, any>) {
    for (const key of this.getProductSnapshotKeys(record)) {
      const snapshot = index.get(key);
      if (snapshot) return snapshot;
    }
    return null;
  }

  private getProductSnapshotKeys(record: any) {
    if (!record || typeof record !== 'object') return [];
    const values = [
      this.normalizeText(record.itemKey),
      this.normalizeText(record.row_key ?? record.rowKey),
      this.normalizeText(record.id),
      this.buildProductKey(record),
      [
        record.storeId ?? record.store_id ?? record.sid ?? '',
        record.asin ?? '',
        record.marketplace ?? '',
        record.msku ?? '',
        record.fnsku ?? '',
      ]
        .map(item => this.normalizeText(item))
        .join('|'),
      [
        record.asin ?? '',
        record.marketplace ?? '',
        record.msku ?? '',
        record.fnsku ?? '',
      ]
        .map(item => this.normalizeText(item))
        .join('|'),
    ];
    return this.uniqueTexts(values);
  }

  private pickText(primary: any, fallback: any, ...keys: string[]) {
    for (const source of [primary, fallback]) {
      for (const key of keys) {
        const text = this.normalizeText(source?.[key]);
        if (text) return text;
      }
    }
    return '';
  }

  private pickNullableNumber(primary: any, fallback: any, ...keys: string[]) {
    for (const source of [primary, fallback]) {
      for (const key of keys) {
        if (!this.hasPresentValue(source?.[key])) continue;
        const value = this.toNullableNumber(source[key]);
        if (value !== null) return value;
      }
    }
    return null;
  }

  private pickNullableInt(primary: any, fallback: any, ...keys: string[]) {
    for (const source of [primary, fallback]) {
      for (const key of keys) {
        if (!this.hasPresentValue(source?.[key])) continue;
        const value = this.toNullableInt(source[key]);
        if (value !== null) return value;
      }
    }
    return null;
  }

  private hasPresentValue(value: any) {
    return value !== undefined && value !== null && value !== '';
  }

  private async generateReviewNo() {
    return `BSRSHIPR${dayjs().format('YYMMDDHHmmssSSS')}${Math.floor(
      Math.random() * 1000
    )
      .toString()
      .padStart(3, '0')}`;
  }

  private getCurrentAdminUser() {
    const admin = (this.baseCtx as any)?.admin || {};
    const username = this.normalizeText(admin.username);
    return {
      userId: Number(admin.userId) || null,
      username,
      nickname: this.normalizeText(admin.nickName || admin.name || username),
    };
  }

  private buildProductKey(record: any) {
    return [
      record.storeId || record.store_id || record.sid || 0,
      record.asin || '',
      record.marketplace || '',
      record.msku || '',
      record.fnsku || '',
      record.productCode || record.product_code || '',
    ].join('|');
  }

  private getPackingTypeLabel(value: any) {
    const num = Number(value);
    if (num === 1) return '混装商品';
    if (num === 2) return '原厂包装商品';
    return '';
  }

  private toInt(value: any) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
  }

  private toNullableInt(value: any) {
    const num = Number(value);
    return Number.isFinite(num) ? Math.round(num) : null;
  }

  private toNullableNumber(value: any) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private toNullableDateText(value: any) {
    const text = this.normalizeText(value);
    return text || null;
  }

  private normalizeText(value: any) {
    return String(value ?? '').trim();
  }

  private hasFilledValue(value: any) {
    return (
      value !== null && value !== undefined && this.normalizeText(value) !== ''
    );
  }

  private isValidDateText(value: any) {
    const text = this.normalizeText(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return false;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  private parseJsonValue(value: any) {
    let parsed = value;
    for (let index = 0; index < 2; index++) {
      if (typeof parsed !== 'string') break;
      const text = parsed.trim();
      if (!text) return null;
      try {
        parsed = JSON.parse(text);
      } catch {
        return value;
      }
    }
    return parsed;
  }

  private uniqueTexts(values: any[]) {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values || []) {
      const text = this.normalizeText(value);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      result.push(text);
    }
    return result;
  }
}
