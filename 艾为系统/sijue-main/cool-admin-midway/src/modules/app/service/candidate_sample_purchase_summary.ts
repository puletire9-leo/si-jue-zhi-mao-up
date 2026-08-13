import { Provide } from '@midwayjs/decorator';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import { AppAmzBsrCandidatePurchasePlanEntity } from '../entity/bsr_candidate_purchase_plan';

export type SamplePurchaseSummaryStatus =
  | 'no_plan'
  | 'plan_no_po'
  | 'pending'
  | 'partial'
  | 'all_arrived'
  | 'mixed';

export interface SamplePurchaseOrderBrief {
  order_sn: string;
  status: number | null;
  status_text: string;
  status_shipped: number | null;
  status_shipped_text: string;
}

export interface SamplePurchaseSummary {
  candidate_id: number;
  plan_count: number;
  po_count: number;
  has_plan: boolean;
  has_po: boolean;
  status: SamplePurchaseSummaryStatus;
  status_text: string;
  orders: SamplePurchaseOrderBrief[];
}

export type SamplePurchasePlanStatus = 'ordered' | 'purchased' | 'completed';

export interface SamplePurchasePlanItem {
  id: number;
  candidate_id: number;
  plan_sn: string;
  lingxing_sku: string;
  sample_status: number;
  status: SamplePurchasePlanStatus;
  status_text: string;
  orders: SamplePurchaseOrderBrief[];
}

const SAMPLE_TYPE = 2;

@Provide()
export class CandidateSamplePurchaseSummaryService {
  @InjectEntityModel(AppAmzBsrCandidatePurchasePlanEntity)
  candidatePurchasePlanRepo: Repository<AppAmzBsrCandidatePurchasePlanEntity>;

  /**
   * 批量查询选品样品采购（cpp.type=2 → plan_sn → PO）
   */
  async getSummaryMapByCandidateIds(
    candidateIds: number[]
  ): Promise<Map<number, SamplePurchaseSummary>> {
    const map = new Map<number, SamplePurchaseSummary>();
    const ids = [...new Set(candidateIds.map(id => Number(id)).filter(id => id > 0))];
    if (ids.length === 0) return map;

    for (const id of ids) {
      map.set(id, this.emptySummary(id));
    }

    const sql = `
      SELECT
        cpp.candidate_id AS candidate_id,
        cpp.plan_sn AS plan_sn,
        o.order_sn AS order_sn,
        o.status AS po_status,
        o.status_text AS po_status_text,
        o.status_shipped AS status_shipped,
        o.status_shipped_text AS status_shipped_text
      FROM app_amz_bsr_candidate_purchase_plan cpp
      LEFT JOIN app_amz_bsr_purchase_order_item_sync_lingxing i
        ON i.plan_sn COLLATE utf8mb4_unicode_ci = cpp.plan_sn COLLATE utf8mb4_unicode_ci
      LEFT JOIN app_amz_bsr_purchase_order_sync_lingxing o
        ON o.order_sn COLLATE utf8mb4_unicode_ci = i.order_sn COLLATE utf8mb4_unicode_ci
        AND o.status NOT IN (-1, 124)
      WHERE cpp.candidate_id IN (${ids.map(() => '?').join(',')})
        AND cpp.type = ?
        AND cpp.plan_sn IS NOT NULL
        AND TRIM(cpp.plan_sn) != ''
    `;

    const rows: any[] = await this.candidatePurchasePlanRepo.manager.query(sql, [
      ...ids,
      SAMPLE_TYPE,
    ]);

    const bucket = new Map<number, { plans: Set<string>; orders: Map<string, SamplePurchaseOrderBrief> }>();
    for (const id of ids) {
      bucket.set(id, { plans: new Set(), orders: new Map() });
    }

    for (const row of rows) {
      const cid = Number(row.candidate_id);
      if (!cid || !bucket.has(cid)) continue;
      const b = bucket.get(cid)!;
      const planSn = String(row.plan_sn || '').trim();
      if (planSn) b.plans.add(planSn);
      const orderSn = String(row.order_sn || '').trim();
      if (orderSn && !b.orders.has(orderSn)) {
        b.orders.set(orderSn, {
          order_sn: orderSn,
          status: row.po_status != null ? Number(row.po_status) : null,
          status_text: String(row.po_status_text || '').trim(),
          status_shipped: row.status_shipped != null ? Number(row.status_shipped) : null,
          status_shipped_text: String(row.status_shipped_text || '').trim(),
        });
      }
    }

    for (const [cid, b] of bucket.entries()) {
      map.set(cid, this.buildSummary(cid, b.plans.size, [...b.orders.values()]));
    }

    return map;
  }

  /**
   * 批量查询选品样品采购计划明细（与选品采购计划页状态规则一致）
   */
  async getSamplePlansMapByCandidateIds(
    candidateIds: number[]
  ): Promise<Map<number, SamplePurchasePlanItem[]>> {
    const map = new Map<number, SamplePurchasePlanItem[]>();
    const ids = [...new Set(candidateIds.map(id => Number(id)).filter(id => id > 0))];
    if (ids.length === 0) return map;

    for (const id of ids) {
      map.set(id, []);
    }

    const planRows: any[] = await this.candidatePurchasePlanRepo.manager.query(
      `
      SELECT
        cpp.id AS id,
        cpp.candidate_id AS candidate_id,
        cpp.plan_sn AS plan_sn,
        cpp.lingxing_sku AS lingxing_sku,
        cpp.sample_status AS sample_status
      FROM app_amz_bsr_candidate_purchase_plan cpp
      WHERE cpp.candidate_id IN (${ids.map(() => '?').join(',')})
        AND cpp.type = ?
        AND cpp.plan_sn IS NOT NULL
        AND TRIM(cpp.plan_sn) <> ''
      ORDER BY cpp.id ASC
    `,
      [...ids, SAMPLE_TYPE]
    );

    const planSnSet = new Set<string>();
    for (const row of planRows) {
      const planSn = String(row.plan_sn || '').trim();
      if (planSn) planSnSet.add(planSn);
    }

    const ordersByPlanSn = await this.getOrdersByPlanSnMap([...planSnSet]);

    for (const row of planRows) {
      const candidateId = Number(row.candidate_id);
      if (!candidateId || !map.has(candidateId)) continue;

      const planSn = String(row.plan_sn || '').trim();
      const orders = ordersByPlanSn.get(planSn) || [];
      const sampleStatus = Number(row.sample_status) || 0;
      const statusInfo = this.resolveSamplePlanStatus(sampleStatus, orders);

      map.get(candidateId)!.push({
        id: Number(row.id) || 0,
        candidate_id: candidateId,
        plan_sn: planSn,
        lingxing_sku: String(row.lingxing_sku || '').trim(),
        sample_status: sampleStatus,
        status: statusInfo.status,
        status_text: statusInfo.status_text,
        orders,
      });
    }

    return map;
  }

  private resolveSamplePlanStatus(
    sampleStatus: number,
    orders: SamplePurchaseOrderBrief[]
  ): { status: SamplePurchasePlanStatus; status_text: string } {
    if (sampleStatus === 3) {
      return { status: 'completed', status_text: '已完成' };
    }
    if (orders.length > 0) {
      return { status: 'purchased', status_text: '已采购' };
    }
    return { status: 'ordered', status_text: '已下单' };
  }

  private async getOrdersByPlanSnMap(planSns: string[]) {
    const map = new Map<string, SamplePurchaseOrderBrief[]>();
    const sns = [...new Set(planSns.map(sn => String(sn || '').trim()).filter(Boolean))];
    if (!sns.length) return map;

    const sql = `
      SELECT
        i.plan_sn AS plan_sn,
        o.order_sn AS order_sn,
        o.status AS po_status,
        o.status_text AS po_status_text,
        o.status_shipped AS status_shipped,
        o.status_shipped_text AS status_shipped_text
      FROM app_amz_bsr_purchase_order_item_sync_lingxing i
      INNER JOIN app_amz_bsr_purchase_order_sync_lingxing o
        ON o.order_sn COLLATE utf8mb4_unicode_ci = i.order_sn COLLATE utf8mb4_unicode_ci
        AND o.status NOT IN (-1, 124)
      WHERE i.plan_sn IN (${sns.map(() => '?').join(',')})
    `;

    const rows: any[] = await this.candidatePurchasePlanRepo.manager.query(sql, sns);
    const seen = new Map<string, Set<string>>();

    for (const row of rows) {
      const planSn = String(row.plan_sn || '').trim();
      const orderSn = String(row.order_sn || '').trim();
      if (!planSn || !orderSn) continue;

      if (!seen.has(planSn)) seen.set(planSn, new Set());
      if (seen.get(planSn)!.has(orderSn)) continue;
      seen.get(planSn)!.add(orderSn);

      if (!map.has(planSn)) map.set(planSn, []);
      map.get(planSn)!.push({
        order_sn: orderSn,
        status: row.po_status != null ? Number(row.po_status) : null,
        status_text: String(row.po_status_text || '').trim(),
        status_shipped: row.status_shipped != null ? Number(row.status_shipped) : null,
        status_shipped_text: String(row.status_shipped_text || '').trim(),
      });
    }

    return map;
  }

  private emptySummary(candidateId: number): SamplePurchaseSummary {
    return this.buildSummary(candidateId, 0, []);
  }

  private buildSummary(
    candidateId: number,
    planCount: number,
    orders: SamplePurchaseOrderBrief[]
  ): SamplePurchaseSummary {
    const poCount = orders.length;
    const hasPlan = planCount > 0;
    const hasPo = poCount > 0;

    let status: SamplePurchaseSummaryStatus = 'no_plan';
    let statusText = '未建样品计划';

    if (hasPlan && !hasPo) {
      status = 'plan_no_po';
      statusText = '未下采购单';
    } else if (hasPo) {
      const shipped = orders.map(o => o.status_shipped);
      const allArrived = shipped.every(s => s === 3);
      const anyPartial = shipped.some(s => s === 2);
      const allPending = shipped.every(s => s === 1);

      if (allArrived) {
        status = 'all_arrived';
        statusText = '已全部到货';
      } else if (anyPartial) {
        status = 'partial';
        statusText = '部分到货';
      } else if (allPending) {
        status = 'pending';
        statusText = '待到货';
      } else {
        status = 'mixed';
        statusText = '部分到货';
      }
    }

    return {
      candidate_id: candidateId,
      plan_count: planCount,
      po_count: poCount,
      has_plan: hasPlan,
      has_po: hasPo,
      status,
      status_text: statusText,
      orders,
    };
  }
}
