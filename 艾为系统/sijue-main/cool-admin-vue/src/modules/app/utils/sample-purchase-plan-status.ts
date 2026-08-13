export type SamplePurchasePlanStatus = "ordered" | "purchased" | "completed";

export interface SamplePurchasePlanOrderBrief {
	order_sn: string;
	status?: number | null;
	status_text?: string;
	status_shipped?: number | null;
	status_shipped_text?: string;
}

export interface SamplePurchasePlanItem {
	id: number;
	candidate_id?: number;
	plan_sn: string;
	lingxing_sku?: string;
	sample_status?: number;
	status: SamplePurchasePlanStatus;
	status_text: string;
	orders?: SamplePurchasePlanOrderBrief[];
}

export function getSamplePlanStatusTagType(
	status?: SamplePurchasePlanStatus | string | null
): "success" | "info" | "warning" | "danger" | "primary" {
	if (status === "completed") return "success";
	if (status === "purchased") return "warning";
	return "info";
}

export function formatSamplePlanTagTooltip(plan: SamplePurchasePlanItem): string {
	const lines = [plan.status_text];
	if (plan.plan_sn) lines.push(`计划：${plan.plan_sn}`);
	if (plan.lingxing_sku) lines.push(`SKU：${plan.lingxing_sku}`);
	for (const order of plan.orders ?? []) {
		lines.push([order.order_sn, order.status_text, order.status_shipped_text].filter(Boolean).join(" · "));
	}
	return lines.join("\n");
}

export function resolveSamplePlanStatusFromRow(row: {
	sample_status?: number | null;
	orders?: SamplePurchasePlanOrderBrief[] | null;
}): { status: SamplePurchasePlanStatus; status_text: string } {
	if (Number(row.sample_status) === 3) {
		return { status: "completed", status_text: "已完成" };
	}
	if ((row.orders ?? []).length > 0) {
		return { status: "purchased", status_text: "已采购" };
	}
	return { status: "ordered", status_text: "已下单" };
}
