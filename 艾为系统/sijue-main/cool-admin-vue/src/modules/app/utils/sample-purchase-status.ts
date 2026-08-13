export interface SamplePurchaseOrderBrief {
	order_sn: string;
	status?: number | null;
	status_text?: string;
	status_shipped?: number | null;
	status_shipped_text?: string;
}

export interface SamplePurchaseSummary {
	candidate_id?: number;
	plan_count: number;
	po_count: number;
	has_plan: boolean;
	has_po: boolean;
	status: string;
	status_text: string;
	orders?: SamplePurchaseOrderBrief[];
}

export function getSamplePurchaseTagType(
	status?: string | null
): "success" | "info" | "warning" | "danger" | "primary" {
	if (status === "all_arrived") return "success";
	if (status === "pending" || status === "plan_no_po") return "warning";
	if (status === "partial" || status === "mixed") return "warning";
	return "info";
}

export function formatSamplePurchaseTooltip(summary: SamplePurchaseSummary): string {
	const lines: string[] = [summary.status_text];
	if (summary.has_plan) {
		let meta = `计划 ${summary.plan_count}`;
		if (summary.has_po) meta += ` · PO ${summary.po_count}单`;
		else meta += " · 未下PO";
		lines.push(meta);
	}
	for (const o of summary.orders ?? []) {
		lines.push([o.order_sn, o.status_text, o.status_shipped_text].filter(Boolean).join(" · "));
	}
	return lines.join("\n");
}
