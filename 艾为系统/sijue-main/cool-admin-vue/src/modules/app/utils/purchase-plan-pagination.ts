type PaginationLike = {
	page?: number;
	currentPage?: number;
	size?: number;
	pageSize?: number;
	total?: number;
};

export function getPagePagination(result: any, fallback: PaginationLike = {}) {
	const pagination = result?.pagination || {};

	return {
		page: Number(
			pagination.page ?? pagination.currentPage ?? fallback.page ?? fallback.currentPage ?? 1
		),
		size: Number(
			pagination.size ?? pagination.pageSize ?? fallback.size ?? fallback.pageSize ?? 20
		),
		total: Number(pagination.total ?? fallback.total ?? 0)
	};
}

export function getPlanSns(rows: any[] = []) {
	const seen = new Set<string>();
	const planSns: string[] = [];

	for (const row of rows) {
		const planSn = String(row?.plan_sn || "").trim();
		if (!planSn || seen.has(planSn)) continue;
		seen.add(planSn);
		planSns.push(planSn);
	}

	return planSns;
}
