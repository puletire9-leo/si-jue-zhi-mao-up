import { BaseService } from '@cool-midway/core';
import { Inject, Provide } from '@midwayjs/decorator';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity } from '../entity/bsr_purchase_order_fulfillment_adjustment';
import { AppAmzBsrPurchaseOrderFulfillmentAdjustmentLogEntity } from '../entity/bsr_purchase_order_fulfillment_adjustment_log';

export const FULFILLMENT_ADJUSTMENT_STATUS = {
  NONE: 0,
  PENDING: 1,
  PROCESSED: 2,
} as const;

export const FULFILLMENT_DOCUMENT_STATUS = {
  PENDING: 0,
  PROCESSING: 1,
  PENDING_CONFIRM: 2,
  CONFIRMED: 3,
} as const;

export type FulfillmentStatus =
  | 'pending_purchase'
  | 'shippable'
  | 'logistics_exception'
  | 'exception_pending'
  | 'normal_completed'
  | 'exception_completed'
  | 'manual_completed'
  | 'unready';

export type FulfillmentGroupStatus =
  | 'shippable'
  | 'completed'
  | 'exception_completed'
  | 'abnormal';

const FULFILLMENT_GROUP_STATUS_TEXT: Record<FulfillmentGroupStatus, string> = {
  shippable: '可发货',
  completed: '完成',
  exception_completed: '异常完成',
  abnormal: '异常',
};

const FULFILLMENT_GROUP_STATUS_VALUES = new Set<string>([
  'shippable',
  'completed',
  'exception_completed',
  'abnormal',
]);

interface FulfillmentSummaryInput {
  purchase_order_status?: any;
  quantity_real_sum?: any;
  quantity_entry_sum?: any;
  actual_shipment_qty_sum?: any;
  defective_qty?: any;
  defective_status?: any;
  short_shipped_qty?: any;
  short_shipped_status?: any;
  manual_completed?: any;
  logistics_status?: any;
}

interface FulfillmentAdjustmentIdentity {
  store_id: any;
  marketplace: any;
  asin: any;
  msku: any;
  product_code: any;
  purchase_order_sn: any;
}

interface SaveFulfillmentAdjustmentInput extends FulfillmentAdjustmentIdentity {
  primary_plan_sn?: string;
  linked_plan_sns?: string[];
  defective_qty?: any;
  defective_remark?: string;
  short_shipped_qty?: any;
  short_shipped_remark?: string;
}

interface ProcessFulfillmentAdjustmentInput
  extends FulfillmentAdjustmentIdentity {
  field_group: 'defective' | 'short_shipped';
  remark: string;
  primary_plan_sn?: string;
  linked_plan_sns?: string[];
  defective_qty?: any;
  defective_remark?: string;
  short_shipped_qty?: any;
  short_shipped_remark?: string;
}

interface AssignFulfillmentAdjustmentInput
  extends FulfillmentAdjustmentIdentity {
  adjustment_id?: any;
  assigned_to_user_id?: any;
  assigned_to_username?: string;
  assigned_to_nickname?: string;
  remark?: string;
}

interface ConfirmFulfillmentAdjustmentInput
  extends FulfillmentAdjustmentIdentity {
  adjustment_id?: any;
  confirm_remark: string;
}

interface PageFulfillmentAdjustmentInput {
  page?: any;
  size?: any;
  keyWord?: string;
  marketplace?: string;
  seller_name?: string;
  document_status?: any;
  exception_type?: 'defective' | 'short_shipped' | '';
}

type ProductViewWorkStatus = 'current' | 'shelved';

interface ManualFulfillmentInput extends FulfillmentAdjustmentIdentity {
  remark?: string;
  primary_plan_sn?: string;
  linked_plan_sns?: string[];
}

interface BatchManualFulfillmentInput {
  items?: ManualFulfillmentInput[];
  remark?: string;
}

function toNumber(value: any) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function toIntegerQty(value: any) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.trunc(num);
}

function normalizeText(value: any) {
  return String(value ?? '').trim();
}

function normalizePurchaseOrderStatusList(value: any) {
  const rawValues = Array.isArray(value)
    ? value
    : String(value ?? '').split(',');

  return rawValues
    .map(item => String(item ?? '').trim())
    .filter(Boolean)
    .map(item => Number(item))
    .filter(item => Number.isFinite(item));
}

function normalizeProductViewWorkStatus(value: any): ProductViewWorkStatus {
  return normalizeText(value) === 'shelved' ? 'shelved' : 'current';
}

export function buildFulfillmentAdjustmentKey(
  item: FulfillmentAdjustmentIdentity
) {
  return [
    Number(item.store_id) || 0,
    normalizeText(item.marketplace),
    normalizeText(item.asin),
    normalizeText(item.msku),
    normalizeText(item.product_code),
    normalizeText(item.purchase_order_sn),
  ].join('|');
}

export function validateFulfillmentAdjustmentInput(input: {
  quantity_real_sum?: any;
  quantity_entry_sum?: any;
  actual_shipment_qty_sum?: any;
  defective_qty?: any;
  short_shipped_qty?: any;
}) {
  const quantityReal = toIntegerQty(
    input.quantity_real_sum ?? input.quantity_entry_sum
  );
  const actualShipmentQty = toIntegerQty(input.actual_shipment_qty_sum);
  const defectiveQty = toIntegerQty(input.defective_qty);
  const shortShippedQty = toIntegerQty(input.short_shipped_qty);
  const estimatedShippableQty = quantityReal - actualShipmentQty;
  const adjustableQty = Math.max(estimatedShippableQty, 0);

  if (defectiveQty < 0 || shortShippedQty < 0) {
    return { valid: false, message: '残次品和商家少发数量不能小于0' };
  }

  if (defectiveQty !== Number(input.defective_qty || 0)) {
    return { valid: false, message: '残次品数量必须是整数' };
  }

  if (shortShippedQty !== Number(input.short_shipped_qty || 0)) {
    return { valid: false, message: '商家少发数量必须是整数' };
  }

  if (defectiveQty + shortShippedQty > adjustableQty) {
    return {
      valid: false,
      message: `残次品和商家少发合计不能超过预计可发 ${adjustableQty}`,
    };
  }

  return { valid: true, message: '' };
}

export function getFulfillmentGroupStatus(
  fulfillmentStatus: any
): FulfillmentGroupStatus {
  const status = normalizeText(fulfillmentStatus);
  if (status === 'shippable') return 'shippable';
  if (status === 'normal_completed' || status === 'manual_completed') {
    return 'completed';
  }
  if (status === 'exception_completed') return 'exception_completed';
  return 'abnormal';
}

export function getFulfillmentGroupStatusText(status: any) {
  const groupStatus = getFulfillmentGroupStatus(status);
  return FULFILLMENT_GROUP_STATUS_TEXT[groupStatus];
}

function isFulfillmentGroupStatus(status: string) {
  return FULFILLMENT_GROUP_STATUS_VALUES.has(status);
}

function isFulfillmentStatusMatched(summary: any, targetStatus: string) {
  const target = normalizeText(targetStatus);
  if (!target) return true;
  if (isFulfillmentGroupStatus(target)) {
    const groupStatus =
      normalizeText(summary?.fulfillment_group_status) ||
      getFulfillmentGroupStatus(summary?.fulfillment_status);
    return groupStatus === target;
  }
  return normalizeText(summary?.fulfillment_status) === target;
}

export function computeFulfillmentSummary(input: FulfillmentSummaryInput) {
  const quantityReal = toIntegerQty(input.quantity_real_sum);
  const quantityEntry = toIntegerQty(input.quantity_entry_sum);
  const actualShipmentQty = toIntegerQty(input.actual_shipment_qty_sum);
  const defectiveQty = toIntegerQty(input.defective_qty);
  const shortShippedQty = toIntegerQty(input.short_shipped_qty);
  const defectiveStatus = Number(input.defective_status) || 0;
  const shortShippedStatus = Number(input.short_shipped_status) || 0;
  const manualCompleted = Number(input.manual_completed) === 1;
  const purchaseOrderStatus = Number(input.purchase_order_status);
  const logisticsStatus = normalizeText(input.logistics_status);
  const estimatedShippableQty = quantityReal - actualShipmentQty;
  const exceptionQty = defectiveQty + shortShippedQty;
  const actualShippableQty = estimatedShippableQty - exceptionQty;
  const isAllowedPurchaseOrderStatus =
    purchaseOrderStatus === 2 || purchaseOrderStatus === 9;
  const isLogisticsReady =
    logisticsStatus === 'signed' ||
    logisticsStatus === 'confirmed' ||
    logisticsStatus === 'in_transit' ||
    logisticsStatus === 'partial_signed';
  const isLogisticsException =
    logisticsStatus === 'logistics_abnormal' ||
    logisticsStatus === 'logistics_exception' ||
    logisticsStatus === 'overtime_unsigned' ||
    logisticsStatus === 'partial_overtime_unsigned' ||
    logisticsStatus === 'pending_mapping' ||
    logisticsStatus === 'phone_required' ||
    logisticsStatus === 'manual_required';
  const hasPendingException =
    (defectiveQty > 0 &&
      defectiveStatus !== FULFILLMENT_ADJUSTMENT_STATUS.PROCESSED) ||
    (shortShippedQty > 0 &&
      shortShippedStatus !== FULFILLMENT_ADJUSTMENT_STATUS.PROCESSED);

  let fulfillmentStatus: FulfillmentStatus = 'unready';
  let fulfillmentStatusText = '未就绪';

  if (manualCompleted) {
    fulfillmentStatus = 'manual_completed';
    fulfillmentStatusText = '人工完成';
  } else if (hasPendingException) {
    fulfillmentStatus = 'exception_pending';
    fulfillmentStatusText = '异常待处理';
  } else if (
    isAllowedPurchaseOrderStatus &&
    exceptionQty > 0 &&
    actualShippableQty <= 0
  ) {
    fulfillmentStatus = 'exception_completed';
    fulfillmentStatusText = '异常完成';
  } else if (isAllowedPurchaseOrderStatus && actualShippableQty <= 0) {
    fulfillmentStatus = 'normal_completed';
    fulfillmentStatusText = '正常完成';
  } else if (
    isAllowedPurchaseOrderStatus &&
    isLogisticsReady &&
    actualShippableQty > 0
  ) {
    fulfillmentStatus = 'shippable';
    fulfillmentStatusText = '可发货';
  } else if (
    isAllowedPurchaseOrderStatus &&
    isLogisticsException &&
    actualShippableQty > 0
  ) {
    fulfillmentStatus = 'logistics_exception';
    fulfillmentStatusText = '物流异常';
  }

  const fulfillmentGroupStatus = getFulfillmentGroupStatus(fulfillmentStatus);

  return {
    quantity_real_sum: quantityReal,
    quantity_entry_sum: quantityEntry,
    actual_shipment_qty_sum: actualShipmentQty,
    estimated_shippable_qty: estimatedShippableQty,
    defective_qty: defectiveQty,
    defective_status: defectiveStatus,
    short_shipped_qty: shortShippedQty,
    short_shipped_status: shortShippedStatus,
    logistics_status: logisticsStatus,
    exception_qty: exceptionQty,
    actual_shippable_qty: manualCompleted ? 0 : actualShippableQty,
    fulfillment_status: fulfillmentStatus,
    fulfillment_status_text: fulfillmentStatusText,
    fulfillment_group_status: fulfillmentGroupStatus,
    fulfillment_group_status_text:
      FULFILLMENT_GROUP_STATUS_TEXT[fulfillmentGroupStatus],
  };
}

function getDefaultAdjustmentPayload() {
  return {
    id: null,
    defective_qty: 0,
    defective_status: FULFILLMENT_ADJUSTMENT_STATUS.NONE,
    defective_remark: '',
    defective_processed_by_user_id: null,
    defective_processed_by_username: '',
    defective_processed_time: null,
    defective_process_remark: '',
    short_shipped_qty: 0,
    short_shipped_status: FULFILLMENT_ADJUSTMENT_STATUS.NONE,
    short_shipped_remark: '',
    short_shipped_processed_by_user_id: null,
    short_shipped_processed_by_username: '',
    short_shipped_processed_time: null,
    short_shipped_process_remark: '',
    document_status: FULFILLMENT_DOCUMENT_STATUS.PENDING,
    assigned_to_user_id: null,
    assigned_to_username: '',
    assigned_to_nickname: '',
    assigned_time: null,
    confirmed_by_user_id: null,
    confirmed_by_username: '',
    confirmed_by_nickname: '',
    confirmed_time: null,
    confirm_remark: '',
    manual_completed: 0,
    manual_completed_remark: '',
    manual_completed_by_user_id: null,
    manual_completed_by_username: '',
    manual_completed_time: null,
    shelved: 0,
    shelved_remark: '',
    shelved_by_user_id: null,
    shelved_by_username: '',
    shelved_by_nickname: '',
    shelved_time: null,
    updated_by_user_id: null,
    updated_by_username: '',
    updateTime: null,
  };
}

function serializeAdjustment(
  adjustment?: AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity | null
) {
  if (!adjustment) return getDefaultAdjustmentPayload();

  return {
    id: adjustment.id,
    defective_qty: Number(adjustment.defective_qty) || 0,
    defective_status: Number(adjustment.defective_status) || 0,
    defective_remark: adjustment.defective_remark || '',
    defective_processed_by_user_id:
      adjustment.defective_processed_by_user_id || null,
    defective_processed_by_username:
      adjustment.defective_processed_by_username || '',
    defective_processed_by_nickname:
      (adjustment as any).defective_processed_by_nickname || '',
    defective_processed_time: adjustment.defective_processed_time || null,
    defective_process_remark:
      (adjustment as any).defective_process_remark || '',
    short_shipped_qty: Number(adjustment.short_shipped_qty) || 0,
    short_shipped_status: Number(adjustment.short_shipped_status) || 0,
    short_shipped_remark: adjustment.short_shipped_remark || '',
    short_shipped_processed_by_user_id:
      adjustment.short_shipped_processed_by_user_id || null,
    short_shipped_processed_by_username:
      adjustment.short_shipped_processed_by_username || '',
    short_shipped_processed_by_nickname:
      (adjustment as any).short_shipped_processed_by_nickname || '',
    short_shipped_processed_time:
      adjustment.short_shipped_processed_time || null,
    short_shipped_process_remark:
      (adjustment as any).short_shipped_process_remark || '',
    document_status:
      Number((adjustment as any).document_status) ||
      FULFILLMENT_DOCUMENT_STATUS.PENDING,
    assigned_to_user_id: (adjustment as any).assigned_to_user_id || null,
    assigned_to_username: (adjustment as any).assigned_to_username || '',
    assigned_to_nickname: (adjustment as any).assigned_to_nickname || '',
    assigned_time: (adjustment as any).assigned_time || null,
    confirmed_by_user_id: (adjustment as any).confirmed_by_user_id || null,
    confirmed_by_username: (adjustment as any).confirmed_by_username || '',
    confirmed_by_nickname: (adjustment as any).confirmed_by_nickname || '',
    confirmed_time: (adjustment as any).confirmed_time || null,
    confirm_remark: (adjustment as any).confirm_remark || '',
    manual_completed: Number((adjustment as any).manual_completed) || 0,
    manual_completed_remark: (adjustment as any).manual_completed_remark || '',
    manual_completed_by_user_id:
      (adjustment as any).manual_completed_by_user_id || null,
    manual_completed_by_username:
      (adjustment as any).manual_completed_by_username || '',
    manual_completed_time: (adjustment as any).manual_completed_time || null,
    shelved: Number((adjustment as any).shelved) || 0,
    shelved_remark: (adjustment as any).shelved_remark || '',
    shelved_by_user_id: (adjustment as any).shelved_by_user_id || null,
    shelved_by_username: (adjustment as any).shelved_by_username || '',
    shelved_by_nickname: (adjustment as any).shelved_by_nickname || '',
    shelved_time: (adjustment as any).shelved_time || null,
    updated_by_user_id: adjustment.updated_by_user_id || null,
    updated_by_username: adjustment.updated_by_username || '',
    updateTime: (adjustment as any).updateTime || null,
  };
}

function snapshotAdjustment(
  adjustment?: AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity | null
) {
  if (!adjustment) return null;
  return {
    defective_qty: Number(adjustment.defective_qty) || 0,
    defective_status: Number(adjustment.defective_status) || 0,
    defective_remark: adjustment.defective_remark || '',
    defective_process_remark:
      (adjustment as any).defective_process_remark || '',
    defective_processed_by_user_id:
      (adjustment as any).defective_processed_by_user_id || null,
    defective_processed_by_username:
      (adjustment as any).defective_processed_by_username || '',
    defective_processed_by_nickname:
      (adjustment as any).defective_processed_by_nickname || '',
    defective_processed_time:
      (adjustment as any).defective_processed_time || null,
    short_shipped_qty: Number(adjustment.short_shipped_qty) || 0,
    short_shipped_status: Number(adjustment.short_shipped_status) || 0,
    short_shipped_remark: adjustment.short_shipped_remark || '',
    short_shipped_process_remark:
      (adjustment as any).short_shipped_process_remark || '',
    short_shipped_processed_by_user_id:
      (adjustment as any).short_shipped_processed_by_user_id || null,
    short_shipped_processed_by_username:
      (adjustment as any).short_shipped_processed_by_username || '',
    short_shipped_processed_by_nickname:
      (adjustment as any).short_shipped_processed_by_nickname || '',
    short_shipped_processed_time:
      (adjustment as any).short_shipped_processed_time || null,
    document_status:
      Number((adjustment as any).document_status) ||
      FULFILLMENT_DOCUMENT_STATUS.PENDING,
    assigned_to_user_id: (adjustment as any).assigned_to_user_id || null,
    assigned_to_username: (adjustment as any).assigned_to_username || '',
    assigned_to_nickname: (adjustment as any).assigned_to_nickname || '',
    assigned_time: (adjustment as any).assigned_time || null,
    confirmed_by_user_id: (adjustment as any).confirmed_by_user_id || null,
    confirmed_by_username: (adjustment as any).confirmed_by_username || '',
    confirmed_by_nickname: (adjustment as any).confirmed_by_nickname || '',
    confirmed_time: (adjustment as any).confirmed_time || null,
    confirm_remark: (adjustment as any).confirm_remark || '',
    manual_completed: Number((adjustment as any).manual_completed) || 0,
    manual_completed_remark: (adjustment as any).manual_completed_remark || '',
    manual_completed_by_user_id:
      (adjustment as any).manual_completed_by_user_id || null,
    manual_completed_by_username:
      (adjustment as any).manual_completed_by_username || '',
    manual_completed_time: (adjustment as any).manual_completed_time || null,
    shelved: Number((adjustment as any).shelved) || 0,
    shelved_remark: (adjustment as any).shelved_remark || '',
    shelved_by_user_id: (adjustment as any).shelved_by_user_id || null,
    shelved_by_username: (adjustment as any).shelved_by_username || '',
    shelved_by_nickname: (adjustment as any).shelved_by_nickname || '',
    shelved_time: (adjustment as any).shelved_time || null,
  };
}

function isSameAdjustmentSnapshot(before: any, after: any) {
  const fields = [
    'defective_qty',
    'defective_status',
    'defective_remark',
    'defective_process_remark',
    'defective_processed_by_user_id',
    'defective_processed_by_username',
    'defective_processed_by_nickname',
    'defective_processed_time',
    'short_shipped_qty',
    'short_shipped_status',
    'short_shipped_remark',
    'short_shipped_process_remark',
    'short_shipped_processed_by_user_id',
    'short_shipped_processed_by_username',
    'short_shipped_processed_by_nickname',
    'short_shipped_processed_time',
    'document_status',
    'assigned_to_user_id',
    'assigned_to_username',
    'assigned_to_nickname',
    'assigned_time',
    'confirmed_by_user_id',
    'confirmed_by_username',
    'confirmed_by_nickname',
    'confirmed_time',
    'confirm_remark',
    'manual_completed',
    'manual_completed_remark',
    'manual_completed_by_user_id',
    'manual_completed_by_username',
    'manual_completed_time',
    'shelved',
    'shelved_remark',
    'shelved_by_user_id',
    'shelved_by_username',
    'shelved_by_nickname',
    'shelved_time',
  ];
  return fields.every(field => {
    const beforeValue = before?.[field] ?? '';
    const afterValue = after?.[field] ?? '';
    return String(beforeValue) === String(afterValue);
  });
}

@Provide()
export class AppAmzBsrPurchaseOrderFulfillmentAdjustmentService extends BaseService {
  @InjectEntityModel(AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity)
  adjustmentRepo: Repository<AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity>;

  @InjectEntityModel(AppAmzBsrPurchaseOrderFulfillmentAdjustmentLogEntity)
  logRepo: Repository<AppAmzBsrPurchaseOrderFulfillmentAdjustmentLogEntity>;

  @Inject()
  ctx: Context;

  async applyToProductViewList(list: any[]) {
    const keys = this.collectProductViewAdjustmentKeys(list);
    const adjustmentMap = await this.queryAdjustmentMap(keys);
    const latestLogMap = await this.queryLatestLogMap(
      Array.from(adjustmentMap.values())
        .map(adjustment => Number(adjustment?.id) || 0)
        .filter(Boolean)
    );

    for (const row of list || []) {
      const product = row?.product || {};
      for (const plan of row?.plans || []) {
        for (const order of plan?.purchase_orders || []) {
          const adjustment = adjustmentMap.get(
            buildFulfillmentAdjustmentKey({
              ...product,
              purchase_order_sn: order.order_sn,
            })
          );
          this.applyAdjustmentToOrder(
            order,
            adjustment,
            adjustment?.id ? latestLogMap.get(Number(adjustment.id)) : null
          );
        }
      }

      row.recommended_purchase_order_sn = this.getRecommendedPurchaseOrderSn(
        row,
        ''
      );
      row.recommended_purchase_order_sn_by_status = {
        pending_purchase: '',
        shippable: this.getRecommendedPurchaseOrderSn(row, 'shippable'),
        completed: this.getRecommendedPurchaseOrderSn(row, 'completed'),
        exception_completed: this.getRecommendedPurchaseOrderSn(
          row,
          'exception_completed'
        ),
        abnormal: this.getRecommendedPurchaseOrderSn(row, 'abnormal'),
        logistics_exception: this.getRecommendedPurchaseOrderSn(
          row,
          'logistics_exception'
        ),
        exception_pending: this.getRecommendedPurchaseOrderSn(
          row,
          'exception_pending'
        ),
        normal_completed: this.getRecommendedPurchaseOrderSn(
          row,
          'normal_completed'
        ),
        manual_completed: this.getRecommendedPurchaseOrderSn(
          row,
          'manual_completed'
        ),
        unready: this.getRecommendedPurchaseOrderSn(row, 'unready'),
      };
    }

    return list;
  }

  filterProductViewListByStatus(list: any[], status: string) {
    return this.filterProductViewList(list, { fulfillmentStatus: status });
  }

  filterProductViewList(
    list: any[],
    filters: {
      fulfillmentStatus?: string;
      logisticsStatus?: string;
      purchaseOrderStatuses?: any[];
      workStatus?: string;
    }
  ) {
    const targetStatus = normalizeText(filters.fulfillmentStatus);
    const targetLogisticsStatus = normalizeText(filters.logisticsStatus);
    const targetWorkStatus = normalizeProductViewWorkStatus(filters.workStatus);
    const targetPurchaseOrderStatuses = normalizePurchaseOrderStatusList(
      filters.purchaseOrderStatuses
    );
    if (
      !targetStatus &&
      !targetLogisticsStatus &&
      !targetPurchaseOrderStatuses.length &&
      targetWorkStatus !== 'shelved'
    ) {
      return (list || []).filter(row => {
        const recommended = this.getRecommendedPurchaseOrderSn(
          row,
          '',
          '',
          [],
          targetWorkStatus
        );
        if (recommended) {
          row.recommended_purchase_order_sn = recommended;
          return true;
        }
        return targetWorkStatus === 'current' && this.isPendingPurchaseProduct(row);
      });
    }

    return (list || [])
      .filter(row => {
        if (targetStatus === 'pending_purchase') {
          if (
            targetWorkStatus === 'shelved' ||
            targetLogisticsStatus ||
            targetPurchaseOrderStatuses.length
          ) {
            return false;
          }
          row.recommended_purchase_order_sn = '';
          return this.isPendingPurchaseProduct(row);
        }

        const recommended = this.getRecommendedPurchaseOrderSn(
          row,
          targetStatus,
          targetLogisticsStatus,
          targetPurchaseOrderStatuses,
          targetWorkStatus
        );
        if (recommended) {
          row.recommended_purchase_order_sn = recommended;
          return true;
        }
        return false;
      })
      .sort((a, b) => {
        return (
          this.getRecommendedOrderScore(
            b,
            targetStatus,
            targetLogisticsStatus,
            targetPurchaseOrderStatuses,
            targetWorkStatus
          ) -
          this.getRecommendedOrderScore(
            a,
            targetStatus,
            targetLogisticsStatus,
            targetPurchaseOrderStatuses,
            targetWorkStatus
          )
        );
      });
  }

  async saveAdjustment(params: SaveFulfillmentAdjustmentInput) {
    const identity = this.normalizeIdentity(params);
    const source = await this.querySourceSnapshot(identity);
    const defectiveQty = toIntegerQty(params.defective_qty);
    const shortShippedQty = toIntegerQty(params.short_shipped_qty);
    const validation = validateFulfillmentAdjustmentInput({
      quantity_real_sum: source.quantity_real_sum,
      quantity_entry_sum: source.quantity_entry_sum,
      actual_shipment_qty_sum: source.actual_shipment_qty_sum,
      defective_qty: defectiveQty,
      short_shipped_qty: shortShippedQty,
    });

    if (!validation.valid) {
      throw new Error(validation.message);
    }

    let adjustment = await this.findAdjustment(identity);
    if (adjustment) {
      this.assertSourceEditable(adjustment);
    }
    const before = snapshotAdjustment(adjustment);
    const user = this.getCurrentUser();
    const isCreate = !adjustment;

    if (!adjustment) {
      adjustment = this.adjustmentRepo.create({
        ...identity,
        created_by_user_id: user.userId,
        created_by_username: user.username,
      });
    }

    adjustment.primary_plan_sn =
      normalizeText(params.primary_plan_sn) || source.primary_plan_sn || '';
    adjustment.linked_plan_sns = this.normalizePlanSns(
      params.linked_plan_sns || source.linked_plan_sns
    );
    this.applyQuantityChange(adjustment, 'defective', defectiveQty);
    this.applyQuantityChange(adjustment, 'short_shipped', shortShippedQty);
    adjustment.defective_remark = normalizeText(params.defective_remark);
    adjustment.short_shipped_remark = normalizeText(
      params.short_shipped_remark
    );
    adjustment.updated_by_user_id = user.userId;
    adjustment.updated_by_username = user.username;
    this.normalizeDocumentStatus(adjustment);

    const saved = await this.adjustmentRepo.save(adjustment);
    const after = snapshotAdjustment(saved);
    if (isCreate || !isSameAdjustmentSnapshot(before, after)) {
      await this.writeLog(saved.id, {
        action_type: isCreate ? 'create' : 'update',
        field_group: 'general',
        before_json: before,
        after_json: after,
        remark: '保存履约调整',
      });
    }

    return this.buildSaveResponse(saved, source);
  }

  async processAdjustment(params: ProcessFulfillmentAdjustmentInput) {
    const identity = this.normalizeIdentity(params);
    const fieldGroup = params.field_group;
    if (fieldGroup !== 'defective' && fieldGroup !== 'short_shipped') {
      throw new Error('处理类型必须是 defective 或 short_shipped');
    }

    const remark = normalizeText(params.remark);
    if (!remark) {
      throw new Error('处理备注不能为空');
    }

    if (
      params.defective_qty !== undefined ||
      params.short_shipped_qty !== undefined
    ) {
      await this.saveAdjustment({
        ...identity,
        primary_plan_sn: params.primary_plan_sn,
        linked_plan_sns: params.linked_plan_sns,
        defective_qty: params.defective_qty,
        defective_remark: params.defective_remark,
        short_shipped_qty: params.short_shipped_qty,
        short_shipped_remark: params.short_shipped_remark,
      });
    }

    const adjustment = await this.findAdjustment(identity);
    if (!adjustment) {
      throw new Error('履约调整记录不存在');
    }
    this.assertNotConfirmed(adjustment);

    const qty =
      fieldGroup === 'defective'
        ? Number(adjustment.defective_qty) || 0
        : Number(adjustment.short_shipped_qty) || 0;
    if (qty <= 0) {
      throw new Error('没有需要处理的异常数量');
    }

    const before = snapshotAdjustment(adjustment);
    const user = this.getCurrentUser();
    const now = new Date();

    if (!(adjustment as any).assigned_to_user_id) {
      (adjustment as any).assigned_to_user_id = user.userId;
      (adjustment as any).assigned_to_username = user.username;
      (adjustment as any).assigned_to_nickname = user.nickname;
      (adjustment as any).assigned_time = now;
    }

    if (fieldGroup === 'defective') {
      adjustment.defective_status = FULFILLMENT_ADJUSTMENT_STATUS.PROCESSED;
      (adjustment as any).defective_process_remark = remark;
      adjustment.defective_processed_by_user_id = user.userId;
      adjustment.defective_processed_by_username = user.username;
      (adjustment as any).defective_processed_by_nickname = user.nickname;
      adjustment.defective_processed_time = now;
    } else {
      adjustment.short_shipped_status = FULFILLMENT_ADJUSTMENT_STATUS.PROCESSED;
      (adjustment as any).short_shipped_process_remark = remark;
      adjustment.short_shipped_processed_by_user_id = user.userId;
      adjustment.short_shipped_processed_by_username = user.username;
      (adjustment as any).short_shipped_processed_by_nickname = user.nickname;
      adjustment.short_shipped_processed_time = now;
    }

    adjustment.updated_by_user_id = user.userId;
    adjustment.updated_by_username = user.username;
    this.normalizeDocumentStatus(adjustment);

    const saved = await this.adjustmentRepo.save(adjustment);
    await this.writeLog(saved.id, {
      action_type: 'process',
      field_group: fieldGroup,
      before_json: before,
      after_json: snapshotAdjustment(saved),
      remark,
    });

    const source = await this.querySourceSnapshot(identity);
    return this.buildSaveResponse(saved, source);
  }

  async manualComplete(params: ManualFulfillmentInput) {
    const identity = this.normalizeIdentity(params);
    const source = await this.querySourceSnapshot(identity);
    const remark = normalizeText(params.remark);
    if (!remark) {
      throw new Error('人工完成原因不能为空');
    }

    let adjustment = await this.findAdjustment(identity);
    if (adjustment) {
      this.assertSourceEditable(adjustment);
    }
    const before = snapshotAdjustment(adjustment);
    const user = this.getCurrentUser();
    const now = new Date();

    if (!adjustment) {
      adjustment = this.adjustmentRepo.create({
        ...identity,
        created_by_user_id: user.userId,
        created_by_username: user.username,
      });
    }

    adjustment.primary_plan_sn =
      normalizeText(params.primary_plan_sn) || source.primary_plan_sn || '';
    adjustment.linked_plan_sns = this.normalizePlanSns(
      params.linked_plan_sns || source.linked_plan_sns
    );
    adjustment.manual_completed = 1;
    adjustment.manual_completed_remark = remark;
    adjustment.manual_completed_by_user_id = user.userId;
    adjustment.manual_completed_by_username = user.username;
    adjustment.manual_completed_time = now;
    adjustment.updated_by_user_id = user.userId;
    adjustment.updated_by_username = user.username;
    this.normalizeDocumentStatus(adjustment);

    const saved = await this.adjustmentRepo.save(adjustment);
    await this.writeLog(saved.id, {
      action_type: 'manual_complete',
      field_group: 'manual_completed',
      before_json: before,
      after_json: snapshotAdjustment(saved),
      remark,
    });

    return this.buildSaveResponse(saved, source);
  }

  async manualReopen(params: ManualFulfillmentInput) {
    const identity = this.normalizeIdentity(params);
    const source = await this.querySourceSnapshot(identity);
    const adjustment = await this.findAdjustment(identity);
    if (!adjustment) {
      throw new Error('履约调整记录不存在');
    }
    this.assertSourceEditable(adjustment);

    if (Number(adjustment.manual_completed) !== 1) {
      return this.buildSaveResponse(adjustment, source);
    }

    const before = snapshotAdjustment(adjustment);
    const user = this.getCurrentUser();
    const remark = normalizeText(params.remark) || '恢复可发';

    adjustment.manual_completed = 0;
    adjustment.manual_completed_remark = '';
    adjustment.manual_completed_by_user_id = null;
    adjustment.manual_completed_by_username = '';
    adjustment.manual_completed_time = null;
    adjustment.updated_by_user_id = user.userId;
    adjustment.updated_by_username = user.username;

    const saved = await this.adjustmentRepo.save(adjustment);
    await this.writeLog(saved.id, {
      action_type: 'manual_reopen',
      field_group: 'manual_completed',
      before_json: before,
      after_json: snapshotAdjustment(saved),
      remark,
    });

    return this.buildSaveResponse(saved, source);
  }

  async shelveFulfillment(params: BatchManualFulfillmentInput) {
    return this.updateShelfState(params, true);
  }

  async unshelveFulfillment(params: BatchManualFulfillmentInput) {
    return this.updateShelfState(params, false);
  }

  async getLogs(
    params: FulfillmentAdjustmentIdentity & { adjustment_id?: any }
  ) {
    let adjustmentId = Number(params.adjustment_id) || 0;
    if (!adjustmentId) {
      const adjustment = await this.findAdjustment(
        this.normalizeIdentity(params)
      );
      adjustmentId = Number(adjustment?.id) || 0;
    }

    if (!adjustmentId) return [];

    return this.logRepo.find({
      where: { adjustment_id: adjustmentId },
      order: { createTime: 'DESC' as any },
      take: 100,
    });
  }

  async pageDocuments(params: PageFulfillmentAdjustmentInput) {
    const page = Math.max(1, Number(params.page) || 1);
    const size = Math.min(100, Math.max(10, Number(params.size) || 20));
    const { whereSql, sqlParams } = this.buildWorkbenchWhere(params);
    const countRows = await this.adjustmentRepo.manager.query(
      `
        SELECT COUNT(*) AS total
        FROM app_amz_bsr_purchase_order_fulfillment_adjustment a
        LEFT JOIN app_amz_bsr_product_listing_lingxing l
          ON l.store_id = a.store_id
          AND l.marketplace = a.marketplace
          AND l.asin = a.asin
          AND COALESCE(l.msku, '') = a.msku
          AND COALESCE(l.product_code, '') = a.product_code
        ${whereSql}
      `,
      sqlParams
    );
    const total = Number(countRows?.[0]?.total) || 0;
    const rows = await this.adjustmentRepo.manager.query(
      `
        SELECT
          a.*,
          l.image_url,
          l.item_name,
          l.seller_name,
          l.shop,
          l.local_sku,
          l.fnsku,
          po.status AS purchase_order_status,
          po.status_text AS purchase_order_status_text,
          po.supplier_name,
          po.supplier_name AS purchase_order_supplier_name,
          po.ware_house_name AS warehouse_name,
          po.opt_realname AS purchase_order_operator_name,
          po.last_realname AS purchase_order_last_operator_name,
          po.auditor_realname AS purchase_order_auditor_name,
          po.create_time_remote AS purchase_order_time,
          po.order_time AS purchase_order_order_time,
          pl.creator_real_name AS purchase_plan_creator_name,
          pl.cg_opt_username AS purchase_plan_buyer_name,
          pl.pic_url AS purchase_plan_image_url,
          pl.create_time_remote AS purchase_plan_create_time,
          pl.supplier_name AS purchase_plan_supplier_name,
          pl.warehouse_name AS purchase_plan_warehouse_name,
          pl.status_text AS purchase_plan_status_text
        FROM app_amz_bsr_purchase_order_fulfillment_adjustment a
        LEFT JOIN app_amz_bsr_product_listing_lingxing l
          ON l.store_id = a.store_id
          AND l.marketplace = a.marketplace
          AND l.asin = a.asin
          AND COALESCE(l.msku, '') = a.msku
          AND COALESCE(l.product_code, '') = a.product_code
        LEFT JOIN app_amz_bsr_purchase_order_sync_lingxing po
          ON po.order_sn = a.purchase_order_sn
        LEFT JOIN app_amz_bsr_purchase_plan_lingxing pl
          ON pl.plan_sn = a.primary_plan_sn
        ${whereSql}
        ORDER BY a.updateTime DESC, a.id DESC
        LIMIT ? OFFSET ?
      `,
      [...sqlParams, size, (page - 1) * size]
    );

    return {
      list: await this.enrichWorkbenchRows(rows || []),
      pagination: { page, size, total },
    };
  }

  async documentSummary(params: PageFulfillmentAdjustmentInput) {
    const { whereSql, sqlParams } = this.buildWorkbenchWhere({
      ...params,
      document_status: undefined,
    });
    const rows = await this.adjustmentRepo.manager.query(
      `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN a.document_status = 0 THEN 1 ELSE 0 END) AS pending,
          SUM(CASE WHEN a.document_status = 1 THEN 1 ELSE 0 END) AS processing,
          SUM(CASE WHEN a.document_status = 2 THEN 1 ELSE 0 END) AS pending_confirm,
          SUM(CASE WHEN a.document_status = 3 THEN 1 ELSE 0 END) AS confirmed,
          SUM(CASE
            WHEN a.defective_qty > 0 AND a.defective_status <> 2 THEN a.defective_qty
            ELSE 0
          END) AS defective_pending_qty,
          SUM(CASE
            WHEN a.short_shipped_qty > 0 AND a.short_shipped_status <> 2 THEN a.short_shipped_qty
            ELSE 0
          END) AS short_shipped_pending_qty
        FROM app_amz_bsr_purchase_order_fulfillment_adjustment a
        LEFT JOIN app_amz_bsr_product_listing_lingxing l
          ON l.store_id = a.store_id
          AND l.marketplace = a.marketplace
          AND l.asin = a.asin
          AND COALESCE(l.msku, '') = a.msku
          AND COALESCE(l.product_code, '') = a.product_code
        ${whereSql}
      `,
      sqlParams
    );
    const row = rows?.[0] || {};
    return {
      total: Number(row.total) || 0,
      pending: Number(row.pending) || 0,
      processing: Number(row.processing) || 0,
      pending_confirm: Number(row.pending_confirm) || 0,
      confirmed: Number(row.confirmed) || 0,
      defective_pending_qty: Number(row.defective_pending_qty) || 0,
      short_shipped_pending_qty: Number(row.short_shipped_pending_qty) || 0,
    };
  }

  async assignDocument(params: AssignFulfillmentAdjustmentInput) {
    const adjustment = await this.findAdjustmentByParam(params);
    if (!adjustment) {
      throw new Error('履约调整记录不存在');
    }
    this.assertNotConfirmed(adjustment);

    const before = snapshotAdjustment(adjustment);
    const now = new Date();
    const user = this.getCurrentUser();
    (adjustment as any).assigned_to_user_id =
      Number(params.assigned_to_user_id) || user.userId;
    (adjustment as any).assigned_to_username =
      normalizeText(params.assigned_to_username) || user.username;
    (adjustment as any).assigned_to_nickname =
      normalizeText(params.assigned_to_nickname) || user.nickname;
    (adjustment as any).assigned_time = now;
    (adjustment as any).document_status =
      FULFILLMENT_DOCUMENT_STATUS.PROCESSING;
    adjustment.updated_by_user_id = user.userId;
    adjustment.updated_by_username = user.username;

    const saved = await this.adjustmentRepo.save(adjustment);
    await this.writeLog(saved.id, {
      action_type: 'assign',
      field_group: 'general',
      before_json: before,
      after_json: snapshotAdjustment(saved),
      remark: normalizeText(params.remark) || '指派履约异常处理人',
    });
    return serializeAdjustment(saved);
  }

  async confirmDocument(params: ConfirmFulfillmentAdjustmentInput) {
    const remark = normalizeText(params.confirm_remark);
    if (!remark) {
      throw new Error('确认备注不能为空');
    }

    const adjustment = await this.findAdjustmentByParam(params);
    if (!adjustment) {
      throw new Error('履约调整记录不存在');
    }
    this.assertNotConfirmed(adjustment);
    if (this.hasPendingException(adjustment)) {
      throw new Error('仍有未处理的残次品或商家少发，不能确认锁定');
    }

    const before = snapshotAdjustment(adjustment);
    const user = this.getCurrentUser();
    const now = new Date();
    (adjustment as any).document_status = FULFILLMENT_DOCUMENT_STATUS.CONFIRMED;
    (adjustment as any).confirmed_by_user_id = user.userId;
    (adjustment as any).confirmed_by_username = user.username;
    (adjustment as any).confirmed_by_nickname = user.nickname;
    (adjustment as any).confirmed_time = now;
    (adjustment as any).confirm_remark = remark;
    adjustment.updated_by_user_id = user.userId;
    adjustment.updated_by_username = user.username;

    const saved = await this.adjustmentRepo.save(adjustment);
    await this.writeLog(saved.id, {
      action_type: 'confirm',
      field_group: 'general',
      before_json: before,
      after_json: snapshotAdjustment(saved),
      remark,
    });
    return serializeAdjustment(saved);
  }

  private buildWorkbenchWhere(params: PageFulfillmentAdjustmentInput) {
    const where: string[] = [
      '(a.defective_qty > 0 OR a.short_shipped_qty > 0 OR a.manual_completed = 1)',
    ];
    const sqlParams: any[] = [];
    const keyWord = normalizeText(params.keyWord);
    if (keyWord) {
      const like = `%${keyWord}%`;
      where.push(`(
        a.purchase_order_sn LIKE ?
        OR a.primary_plan_sn LIKE ?
        OR a.asin LIKE ?
        OR a.msku LIKE ?
        OR a.product_code LIKE ?
        OR l.local_sku LIKE ?
        OR l.fnsku LIKE ?
        OR l.item_name LIKE ?
        OR l.seller_name LIKE ?
      )`);
      sqlParams.push(like, like, like, like, like, like, like, like, like);
    }

    const marketplace = normalizeText(params.marketplace);
    if (marketplace) {
      where.push('a.marketplace = ?');
      sqlParams.push(marketplace);
    }

    const sellerName = normalizeText(params.seller_name);
    if (sellerName) {
      where.push('(l.seller_name LIKE ? OR l.shop LIKE ?)');
      sqlParams.push(`%${sellerName}%`, `%${sellerName}%`);
    }

    const documentStatus = normalizeText(params.document_status);
    if (documentStatus !== '') {
      where.push('a.document_status = ?');
      sqlParams.push(Number(documentStatus) || 0);
    }

    if (params.exception_type === 'defective') {
      where.push('a.defective_qty > 0');
    } else if (params.exception_type === 'short_shipped') {
      where.push('a.short_shipped_qty > 0');
    }

    return {
      whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '',
      sqlParams,
    };
  }

  private async enrichWorkbenchRows(rows: any[]) {
    const result: any[] = [];
    for (const row of rows) {
      let source: any = {};
      try {
        source = await this.querySourceSnapshot(row);
      } catch (e) {
        source = {};
      }
      const serialized = serializeAdjustment(row as any);
      result.push({
        ...row,
        document_no: `FA-${row.id}`,
        linked_plan_sns: this.normalizeLinkedPlanSns(row.linked_plan_sns),
        adjustment: serialized,
        source,
        fulfillment_summary: computeFulfillmentSummary({
          purchase_order_status: row.purchase_order_status,
          quantity_real_sum: source.quantity_real_sum,
          quantity_entry_sum: source.quantity_entry_sum,
          actual_shipment_qty_sum: source.actual_shipment_qty_sum,
          defective_qty: serialized.defective_qty,
          defective_status: serialized.defective_status,
          short_shipped_qty: serialized.short_shipped_qty,
          short_shipped_status: serialized.short_shipped_status,
          manual_completed: serialized.manual_completed,
        }),
      });
    }
    return result;
  }

  private normalizeLinkedPlanSns(value: any) {
    if (Array.isArray(value)) return this.normalizePlanSns(value);
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return this.normalizePlanSns(parsed);
      } catch (e) {
        return this.normalizePlanSns(value.split(','));
      }
    }
    return [];
  }

  private async findAdjustmentByParam(
    params: Partial<FulfillmentAdjustmentIdentity> & { adjustment_id?: any }
  ) {
    const adjustmentId = Number(params.adjustment_id) || 0;
    if (adjustmentId) {
      return this.adjustmentRepo.findOne({
        where: { id: adjustmentId } as any,
      });
    }
    return this.findAdjustment(this.normalizeIdentity(params as any));
  }

  private assertNotConfirmed(
    adjustment: AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity
  ) {
    if (
      Number((adjustment as any).document_status) ===
      FULFILLMENT_DOCUMENT_STATUS.CONFIRMED
    ) {
      throw new Error('单据已确认锁定，不能修改');
    }
  }

  private assertSourceEditable(
    adjustment: AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity
  ) {
    this.assertNotConfirmed(adjustment);
  }

  private hasPendingException(
    adjustment: AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity
  ) {
    return (
      (Number(adjustment.defective_qty) > 0 &&
        Number(adjustment.defective_status) !==
          FULFILLMENT_ADJUSTMENT_STATUS.PROCESSED) ||
      (Number(adjustment.short_shipped_qty) > 0 &&
        Number(adjustment.short_shipped_status) !==
          FULFILLMENT_ADJUSTMENT_STATUS.PROCESSED)
    );
  }

  private normalizeDocumentStatus(
    adjustment: AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity
  ) {
    if (
      Number((adjustment as any).document_status) ===
      FULFILLMENT_DOCUMENT_STATUS.CONFIRMED
    ) {
      return;
    }

    const hasException =
      Number(adjustment.defective_qty) > 0 ||
      Number(adjustment.short_shipped_qty) > 0;
    if (!hasException && Number((adjustment as any).manual_completed) !== 1) {
      (adjustment as any).document_status = FULFILLMENT_DOCUMENT_STATUS.PENDING;
      return;
    }

    if (this.hasPendingException(adjustment)) {
      (adjustment as any).document_status = (adjustment as any)
        .assigned_to_user_id
        ? FULFILLMENT_DOCUMENT_STATUS.PROCESSING
        : FULFILLMENT_DOCUMENT_STATUS.PENDING;
      return;
    }

    (adjustment as any).document_status =
      FULFILLMENT_DOCUMENT_STATUS.PENDING_CONFIRM;
  }

  private collectProductViewAdjustmentKeys(list: any[]) {
    const map = new Map<string, FulfillmentAdjustmentIdentity>();

    for (const row of list || []) {
      const product = row?.product || {};
      for (const plan of row?.plans || []) {
        for (const order of plan?.purchase_orders || []) {
          if (!order?.order_sn) continue;
          const identity = this.normalizeIdentity({
            ...product,
            purchase_order_sn: order.order_sn,
          });
          map.set(buildFulfillmentAdjustmentKey(identity), identity);
        }
      }
    }

    return Array.from(map.values());
  }

  private async queryAdjustmentMap(keys: FulfillmentAdjustmentIdentity[]) {
    const result = new Map<
      string,
      AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity
    >();

    for (let i = 0; i < keys.length; i += 100) {
      const chunk = keys.slice(i, i + 100);
      if (chunk.length === 0) continue;

      const whereParts: string[] = [];
      const params: any[] = [];
      chunk.forEach(key => {
        const identity = this.normalizeIdentity(key);
        whereParts.push(`(
          store_id = ?
          AND marketplace = ?
          AND asin = ?
          AND msku = ?
          AND product_code = ?
          AND purchase_order_sn = ?
        )`);
        params.push(
          identity.store_id,
          identity.marketplace,
          identity.asin,
          identity.msku,
          identity.product_code,
          identity.purchase_order_sn
        );
      });

      const rows = await this.adjustmentRepo.manager.query(
        `
          SELECT *
          FROM app_amz_bsr_purchase_order_fulfillment_adjustment
          WHERE ${whereParts.join(' OR ')}
        `,
        params
      );

      rows.forEach(row => {
        const entity = new AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity();
        Object.assign(entity, row);
        result.set(buildFulfillmentAdjustmentKey(row as any), entity);
      });
    }

    return result;
  }

  private async queryLatestLogMap(adjustmentIds: number[]) {
    const result = new Map<number, any>();
    if (adjustmentIds.length === 0) return result;

    for (let i = 0; i < adjustmentIds.length; i += 100) {
      const chunk = adjustmentIds.slice(i, i + 100);
      const rows = await this.logRepo.manager.query(
        `
          SELECT l.*
          FROM app_amz_bsr_purchase_order_fulfillment_adjustment_log l
          INNER JOIN (
            SELECT adjustment_id, MAX(\`createTime\`) AS latest_time
            FROM app_amz_bsr_purchase_order_fulfillment_adjustment_log
            WHERE adjustment_id IN (${chunk.map(() => '?').join(',')})
            GROUP BY adjustment_id
          ) latest
            ON latest.adjustment_id = l.adjustment_id
            AND latest.latest_time = l.\`createTime\`
          ORDER BY l.\`createTime\` DESC, l.id DESC
        `,
        chunk
      );

      rows.forEach((row: any) => {
        const adjustmentId = Number(row.adjustment_id) || 0;
        if (adjustmentId && !result.has(adjustmentId)) {
          result.set(adjustmentId, row);
        }
      });
    }

    return result;
  }

  private applyAdjustmentToOrder(
    order: any,
    adjustment?: AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity | null,
    latestLog?: any
  ) {
    const serialized = serializeAdjustment(adjustment);
    const shipmentSummary = order?.shipment_summary || {};
    const fulfillmentSummary = computeFulfillmentSummary({
      purchase_order_status: order?.purchase_order_status,
      logistics_status: order?.logistics_status,
      quantity_real_sum: order?.quantity_real_sum,
      quantity_entry_sum: order?.quantity_entry_sum,
      actual_shipment_qty_sum: shipmentSummary.actual_shipment_qty_sum,
      defective_qty: serialized.defective_qty,
      defective_status: serialized.defective_status,
      short_shipped_qty: serialized.short_shipped_qty,
      short_shipped_status: serialized.short_shipped_status,
      manual_completed: serialized.manual_completed,
    });

    order.fulfillment_adjustment = serialized;
    order.fulfillment_latest_log = latestLog || null;
    order.fulfillment_summary = fulfillmentSummary;
    order.shipment_summary = {
      ...shipmentSummary,
      estimated_shippable_qty: fulfillmentSummary.estimated_shippable_qty,
      actual_shippable_qty: fulfillmentSummary.actual_shippable_qty,
      shippable_remaining_qty: fulfillmentSummary.estimated_shippable_qty,
    };
  }

  private getRecommendedPurchaseOrderSn(
    row: any,
    fulfillmentStatus: string,
    logisticsStatus = '',
    purchaseOrderStatuses: any[] = [],
    workStatus: ProductViewWorkStatus = 'current'
  ) {
    const targetLogisticsStatus = normalizeText(logisticsStatus);
    const targetWorkStatus = normalizeProductViewWorkStatus(workStatus);
    const targetPurchaseOrderStatuses = normalizePurchaseOrderStatusList(
      purchaseOrderStatuses
    );
    const candidates = this.getProductViewOrders(row).filter(order => {
      const hasPurchaseOrderStatusFilter =
        targetPurchaseOrderStatuses.length > 0;
      const orderPurchaseStatus = Number(order?.purchase_order_status);

      if (hasPurchaseOrderStatusFilter) {
        if (!targetPurchaseOrderStatuses.includes(orderPurchaseStatus))
          return false;
      } else if (!order?.is_calculated_order || order?.is_void_order) {
        return false;
      }

      if (!this.isOrderMatchedWorkStatus(order, targetWorkStatus)) {
        return false;
      }

      if (
        fulfillmentStatus &&
        !isFulfillmentStatusMatched(
          order?.fulfillment_summary,
          fulfillmentStatus
        )
      ) {
        return false;
      }
      if (
        targetLogisticsStatus &&
        normalizeText(order?.logistics_status) !== targetLogisticsStatus
      ) {
        return false;
      }
      return true;
    });

    if (candidates.length === 0) return '';

    candidates.sort((a, b) => {
      if (fulfillmentStatus === 'shippable') {
        return (
          toNumber(b.fulfillment_summary?.actual_shippable_qty) -
          toNumber(a.fulfillment_summary?.actual_shippable_qty)
        );
      }

      if (fulfillmentStatus === 'exception_pending') {
        return this.getPendingExceptionQty(b) - this.getPendingExceptionQty(a);
      }

      if (fulfillmentStatus === 'abnormal') {
        const pendingDiff =
          this.getPendingExceptionQty(b) - this.getPendingExceptionQty(a);
        if (pendingDiff !== 0) return pendingDiff;
      }

      const timeB = new Date(b.purchase_order_time || 0).getTime();
      const timeA = new Date(a.purchase_order_time || 0).getTime();
      return (
        timeB - timeA || String(b.order_sn).localeCompare(String(a.order_sn))
      );
    });

    return candidates[0]?.order_sn || '';
  }

  private getRecommendedOrderScore(
    row: any,
    fulfillmentStatus: string,
    logisticsStatus = '',
    purchaseOrderStatuses: any[] = [],
    workStatus: ProductViewWorkStatus = 'current'
  ) {
    if (normalizeText(fulfillmentStatus) === 'pending_purchase') {
      return new Date(row?.latest_plan_time || 0).getTime();
    }

    const orderSn = this.getRecommendedPurchaseOrderSn(
      row,
      fulfillmentStatus,
      logisticsStatus,
      purchaseOrderStatuses,
      workStatus
    );
    const order = this.getProductViewOrders(row).find(
      item => item.order_sn === orderSn
    );
    if (!order) return 0;

    if (fulfillmentStatus === 'exception_pending' || fulfillmentStatus === 'abnormal') {
      return this.getPendingExceptionQty(order);
    }

    if (fulfillmentStatus === 'shippable') {
      return toNumber(order.fulfillment_summary?.actual_shippable_qty);
    }

    return new Date(order.purchase_order_time || 0).getTime();
  }

  private getProductViewOrders(row: any) {
    const orderMap = new Map<string, any>();
    for (const plan of row?.plans || []) {
      for (const order of plan?.purchase_orders || []) {
        if (!order?.order_sn || orderMap.has(order.order_sn)) continue;
        orderMap.set(order.order_sn, order);
      }
    }
    return Array.from(orderMap.values());
  }

  private isOrderMatchedWorkStatus(
    order: any,
    workStatus: ProductViewWorkStatus
  ) {
    const shelved = Number(order?.fulfillment_adjustment?.shelved) === 1;
    return workStatus === 'shelved' ? shelved : !shelved;
  }

  private isPendingPurchaseProduct(row: any) {
    const planCount =
      Number(row?.summary?.purchase_plan_count) ||
      (Array.isArray(row?.plans) ? row.plans.length : 0);
    return planCount > 0 && this.getProductViewOrders(row).length === 0;
  }

  private getPendingExceptionQty(order: any) {
    const adjustment = order?.fulfillment_adjustment || {};
    let qty = 0;
    if (
      toNumber(adjustment.defective_qty) > 0 &&
      Number(adjustment.defective_status) !==
        FULFILLMENT_ADJUSTMENT_STATUS.PROCESSED
    ) {
      qty += toNumber(adjustment.defective_qty);
    }
    if (
      toNumber(adjustment.short_shipped_qty) > 0 &&
      Number(adjustment.short_shipped_status) !==
        FULFILLMENT_ADJUSTMENT_STATUS.PROCESSED
    ) {
      qty += toNumber(adjustment.short_shipped_qty);
    }
    return qty;
  }

  private async findAdjustment(identity: FulfillmentAdjustmentIdentity) {
    const normalized = this.normalizeIdentity(identity);
    return this.adjustmentRepo.findOne({
      where: {
        store_id: normalized.store_id,
        marketplace: normalized.marketplace,
        asin: normalized.asin,
        msku: normalized.msku,
        product_code: normalized.product_code,
        purchase_order_sn: normalized.purchase_order_sn,
      },
    });
  }

  private async querySourceSnapshot(identity: FulfillmentAdjustmentIdentity) {
    const normalized = this.normalizeIdentity(identity);
    const itemSql = `
      SELECT
        COALESCE(SUM(i.quantity_real), 0) AS quantity_real_sum,
        COALESCE(SUM(i.quantity_entry), 0) AS quantity_entry_sum,
        GROUP_CONCAT(DISTINCT ar.plan_sn ORDER BY ar.plan_sn SEPARATOR ',') AS linked_plan_sns
      FROM app_amz_bsr_purchase_order_item_sync_lingxing i
      LEFT JOIN app_amz_bsr_analysis_record_lingxing ar
        ON (
          (i.analysis_record_id IS NOT NULL AND ar.id = i.analysis_record_id)
          OR (i.analysis_record_id IS NULL AND ar.plan_sn = i.plan_sn)
        )
      LEFT JOIN app_amz_bsr_product_listing_lingxing l
        ON l.store_id = ar.store_id
        AND l.asin = ar.asin
        AND l.marketplace = ar.marketplace
        AND l.msku = ar.msku
      WHERE i.order_sn = ?
        AND ar.store_id = ?
        AND ar.marketplace = ?
        AND ar.asin = ?
        AND COALESCE(ar.msku, '') = ?
        AND COALESCE(l.product_code, '') = ?
    `;
    const itemRows = await this.adjustmentRepo.manager.query(itemSql, [
      normalized.purchase_order_sn,
      normalized.store_id,
      normalized.marketplace,
      normalized.asin,
      normalized.msku,
      normalized.product_code,
    ]);
    const item = itemRows?.[0] || {};
    const linkedPlanSns = this.normalizePlanSns(
      String(item.linked_plan_sns || '')
        .split(',')
        .filter(Boolean)
    );

    if (
      toNumber(item.quantity_real_sum) === 0 &&
      toNumber(item.quantity_entry_sum) === 0
    ) {
      throw new Error('未找到当前采购单对应的产品明细，无法保存履约调整');
    }

    let actualShipmentQty = 0;
    let shipmentPlanQty = 0;
    if (linkedPlanSns.length > 0) {
      const shipmentSql = `
        SELECT
          COALESCE(SUM(t.shipment_plan_quantity), 0) AS shipment_plan_qty_sum,
          COALESCE(SUM(t.actual_qty_sum), 0) AS actual_shipment_qty_sum
        FROM (
          SELECT
            sp.id,
            MAX(COALESCE(sp.shipment_plan_quantity, 0)) AS shipment_plan_quantity,
            SUM(COALESCE(sa.shipment_list_quantity, 0)) AS actual_qty_sum
          FROM app_amz_bsr_shipment_plan_lingxing sp
          LEFT JOIN app_amz_bsr_shipment_actual_lingxing sa
            ON sa.isp_id = sp.isp_id
          WHERE sp.purchase_order_sn = ?
            AND sp.purchase_plan_sn IN (${linkedPlanSns
              .map(() => '?')
              .join(',')})
            AND sp.purchase_plan_sn IS NOT NULL
            AND sp.purchase_plan_sn != ''
            AND sp.purchase_order_sn IS NOT NULL
            AND sp.purchase_order_sn != ''
          GROUP BY sp.id
        ) t
      `;
      const shipmentRows = await this.adjustmentRepo.manager.query(
        shipmentSql,
        [normalized.purchase_order_sn, ...linkedPlanSns]
      );
      shipmentPlanQty = toIntegerQty(shipmentRows?.[0]?.shipment_plan_qty_sum);
      actualShipmentQty = toIntegerQty(
        shipmentRows?.[0]?.actual_shipment_qty_sum
      );
    }

    const orderRows = await this.adjustmentRepo.manager.query(
      'SELECT status FROM app_amz_bsr_purchase_order_sync_lingxing WHERE order_sn = ? LIMIT 1',
      [normalized.purchase_order_sn]
    );

    return {
      quantity_real_sum: toIntegerQty(item.quantity_real_sum),
      quantity_entry_sum: toIntegerQty(item.quantity_entry_sum),
      shipment_plan_qty_sum: shipmentPlanQty,
      actual_shipment_qty_sum: actualShipmentQty,
      purchase_order_status: Number(orderRows?.[0]?.status) || null,
      linked_plan_sns: linkedPlanSns,
      primary_plan_sn: linkedPlanSns[0] || '',
    };
  }

  private applyQuantityChange(
    adjustment: AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity,
    fieldGroup: 'defective' | 'short_shipped',
    nextQty: number
  ) {
    const qtyField =
      `${fieldGroup}_qty` as keyof AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity;
    const statusField =
      `${fieldGroup}_status` as keyof AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity;
    const processedUserIdField =
      `${fieldGroup}_processed_by_user_id` as keyof AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity;
    const processedUsernameField =
      `${fieldGroup}_processed_by_username` as keyof AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity;
    const processedTimeField =
      `${fieldGroup}_processed_time` as keyof AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity;
    const processRemarkField =
      `${fieldGroup}_process_remark` as keyof AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity;
    const currentQty = Number(adjustment[qtyField]) || 0;
    const currentStatus = Number(adjustment[statusField]) || 0;

    (adjustment as any)[qtyField] = nextQty;
    if (nextQty <= 0) {
      (adjustment as any)[statusField] = FULFILLMENT_ADJUSTMENT_STATUS.NONE;
      (adjustment as any)[processedUserIdField] = null;
      (adjustment as any)[processedUsernameField] = null;
      (adjustment as any)[processedTimeField] = null;
      (adjustment as any)[processRemarkField] = '';
      return;
    }

    if (
      currentQty === nextQty &&
      currentStatus === FULFILLMENT_ADJUSTMENT_STATUS.PROCESSED
    ) {
      (adjustment as any)[statusField] =
        FULFILLMENT_ADJUSTMENT_STATUS.PROCESSED;
      return;
    }

    (adjustment as any)[statusField] = FULFILLMENT_ADJUSTMENT_STATUS.PENDING;
    (adjustment as any)[processedUserIdField] = null;
    (adjustment as any)[processedUsernameField] = null;
    (adjustment as any)[processedTimeField] = null;
    (adjustment as any)[processRemarkField] = '';
  }

  private buildSaveResponse(
    adjustment: AppAmzBsrPurchaseOrderFulfillmentAdjustmentEntity,
    source: any
  ) {
    const serialized = serializeAdjustment(adjustment);
    return {
      fulfillment_adjustment: serialized,
      fulfillment_summary: computeFulfillmentSummary({
        purchase_order_status: source.purchase_order_status,
        quantity_real_sum: source.quantity_real_sum,
        quantity_entry_sum: source.quantity_entry_sum,
        actual_shipment_qty_sum: source.actual_shipment_qty_sum,
        defective_qty: serialized.defective_qty,
        defective_status: serialized.defective_status,
        short_shipped_qty: serialized.short_shipped_qty,
        short_shipped_status: serialized.short_shipped_status,
        manual_completed: serialized.manual_completed,
      }),
    };
  }

  private async updateShelfState(
    params: BatchManualFulfillmentInput,
    shelved: boolean
  ) {
    const items = Array.isArray(params?.items) ? params.items : [];
    if (!items.length) {
      throw new Error(shelved ? '请选择需要搁置的数据' : '请选择需要恢复的数据');
    }

    const user = this.getCurrentUser();
    const now = new Date();
    const remark =
      normalizeText(params?.remark) ||
      (shelved ? '历史数据，暂不处理' : '恢复到当前工作台');
    const result = {
      total: items.length,
      success_count: 0,
      failed_count: 0,
      items: [] as any[],
    };

    for (const item of items) {
      const identity = this.normalizeIdentity(item);
      try {
        const source = await this.querySourceSnapshot(identity);
        let adjustment = await this.findAdjustment(identity);
        const before = snapshotAdjustment(adjustment);
        const isCreate = !adjustment;

        if (!adjustment) {
          adjustment = this.adjustmentRepo.create({
            ...identity,
            created_by_user_id: user.userId,
            created_by_username: user.username,
          });
        }

        adjustment.primary_plan_sn =
          normalizeText(item.primary_plan_sn) || source.primary_plan_sn || '';
        adjustment.linked_plan_sns = this.normalizePlanSns(
          item.linked_plan_sns || source.linked_plan_sns
        );
        adjustment.shelved = shelved ? 1 : 0;
        if (shelved) {
          adjustment.shelved_remark = remark;
          adjustment.shelved_by_user_id = user.userId;
          adjustment.shelved_by_username = user.username;
          adjustment.shelved_by_nickname = user.nickname;
          adjustment.shelved_time = now;
        }
        adjustment.updated_by_user_id = user.userId;
        adjustment.updated_by_username = user.username;

        const saved = await this.adjustmentRepo.save(adjustment);
        await this.writeLog(saved.id, {
          action_type: shelved ? 'shelf' : 'unshelf',
          field_group: 'shelved',
          before_json: before,
          after_json: snapshotAdjustment(saved),
          remark,
        });

        result.success_count += 1;
        result.items.push({
          purchase_order_sn: identity.purchase_order_sn,
          success: true,
          created: isCreate,
          shelved: shelved ? 1 : 0,
        });
      } catch (e: any) {
        result.failed_count += 1;
        result.items.push({
          purchase_order_sn: identity.purchase_order_sn,
          success: false,
          error: e?.message || (shelved ? '搁置失败' : '恢复失败'),
        });
      }
    }

    return result;
  }

  private async writeLog(
    adjustmentId: number,
    payload: {
      action_type: string;
      field_group: string;
      before_json: any;
      after_json: any;
      remark?: string;
    }
  ) {
    const user = this.getCurrentUser();
    await this.logRepo.save(
      this.logRepo.create({
        adjustment_id: adjustmentId,
        action_type: payload.action_type,
        field_group: payload.field_group,
        before_json: payload.before_json,
        after_json: payload.after_json,
        operator_user_id: user.userId,
        operator_username: user.username,
        operator_nickname: user.nickname,
        remark: payload.remark || '',
      })
    );
  }

  private normalizeIdentity(params: FulfillmentAdjustmentIdentity) {
    return {
      store_id: Number(params.store_id) || 0,
      marketplace: normalizeText(params.marketplace),
      asin: normalizeText(params.asin),
      msku: normalizeText(params.msku),
      product_code: normalizeText(params.product_code),
      purchase_order_sn: normalizeText(params.purchase_order_sn),
    };
  }

  private normalizePlanSns(value: any) {
    const rawList = Array.isArray(value) ? value : [];
    return Array.from(
      new Set(rawList.map(item => normalizeText(item)).filter(Boolean))
    );
  }

  private getCurrentUser() {
    const admin = (this.ctx as any)?.admin || {};
    const username = normalizeText(admin.username);
    return {
      userId: Number(admin.userId) || null,
      username,
      nickname: normalizeText(admin.nickName || admin.name || username),
    };
  }
}
