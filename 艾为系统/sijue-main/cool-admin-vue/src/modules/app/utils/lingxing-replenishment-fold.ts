export type LingxingSummaryMetrics = {
	getDailyAvgSales: (row: any) => number;
	getFbaInventoryQuantity: (row: any) => number;
	getFbaReservedQuantity: (row: any) => number;
	getInTransitQuantity: (row: any) => number;
	getLocalQuantity: (row: any) => number;
};

export function isLingxingParentAggregate(row: any): boolean {
	return row?._isParentAggregate === true;
}

export function getLingxingListingRowKey(row: any): string {
	if (row?._selectionKey) return String(row._selectionKey);
	if (isLingxingParentAggregate(row)) return `parent:${String(row?._groupKey || "")}`;
	if (row?.id != null) return `listing:${String(row.id)}`;

	return [
		"listing",
		String(row?.asin || ""),
		String(row?.msku || ""),
		String(row?.marketplace || ""),
		String(row?.store_id ?? row?.seller_name ?? row?.shop ?? "")
	].join(":");
}

export function getLingxingRealRows(rows: any[]): any[] {
	const result: any[] = [];
	for (const row of Array.isArray(rows) ? rows : []) {
		if (isLingxingParentAggregate(row)) {
			result.push(...getLingxingRealRows(row?._children || []));
		} else {
			result.push(row);
		}
	}
	return result;
}

export function refreshLingxingParentSummaries(
	rows: any[],
	metrics: LingxingSummaryMetrics
): any[] {
	for (const row of Array.isArray(rows) ? rows : []) {
		if (!isLingxingParentAggregate(row)) continue;
		const children = getLingxingRealRows(row?._children || []);
		let representativeChild: any;
		let representativeDailyAvgSales = Number.NEGATIVE_INFINITY;
		row.dailyAvgSales = children.reduce((sum, child) => {
			const dailyAvgSales = Number(metrics.getDailyAvgSales(child)) || 0;
			if (!representativeChild || dailyAvgSales > representativeDailyAvgSales) {
				representativeChild = child;
				representativeDailyAvgSales = dailyAvgSales;
			}
			return sum + dailyAvgSales;
		}, 0);
		row.image_url = representativeChild?.image_url || "";
		row.image_url_display = representativeChild?.image_url_display || "";
		row._summaryInventory = {
			fba: children.reduce(
				(sum, child) => sum + (Number(metrics.getFbaInventoryQuantity(child)) || 0),
				0
			),
			fbaReserved: children.reduce(
				(sum, child) => sum + (Number(metrics.getFbaReservedQuantity(child)) || 0),
				0
			),
			inTransit: children.reduce(
				(sum, child) => sum + (Number(metrics.getInTransitQuantity(child)) || 0),
				0
			),
			local: children.reduce(
				(sum, child) => sum + (Number(metrics.getLocalQuantity(child)) || 0),
				0
			)
		};
	}
	return rows;
}

export function flattenExpandedLingxingRows(rows: any[], expandedKeys: Set<string>): any[] {
	const result: any[] = [];
	for (const row of Array.isArray(rows) ? rows : []) {
		result.push(row);
		if (isLingxingParentAggregate(row) && expandedKeys.has(String(row?._groupKey || ""))) {
			result.push(...(row?._children || []));
		}
	}
	return result;
}

export function isLingxingRowSelected(selectedRows: Map<string, any>, row: any): boolean {
	if (isLingxingParentAggregate(row)) {
		const children = getLingxingRealRows(row?._children || []);
		return (
			children.length > 0 &&
			children.every((child) => selectedRows.has(getLingxingListingRowKey(child)))
		);
	}
	return selectedRows.has(getLingxingListingRowKey(row));
}

export function updateLingxingSelectionStore(
	selectedRows: Map<string, any>,
	visibleRows: any[],
	selectedVisibleRows: any[],
	previousVisibleSelectionKeys: Set<string>
): Set<string> {
	const selectedVisibleKeys = new Set(
		(Array.isArray(selectedVisibleRows) ? selectedVisibleRows : []).map(
			getLingxingListingRowKey
		)
	);
	const toggledParentGroups = new Set<string>();

	for (const row of Array.isArray(visibleRows) ? visibleRows : []) {
		if (!isLingxingParentAggregate(row)) continue;
		const key = getLingxingListingRowKey(row);
		const wasSelected = previousVisibleSelectionKeys.has(key);
		const isSelected = selectedVisibleKeys.has(key);
		if (wasSelected === isSelected) continue;

		toggledParentGroups.add(String(row?._groupKey || ""));
		for (const child of getLingxingRealRows(row?._children || [])) {
			const childKey = getLingxingListingRowKey(child);
			if (isSelected) selectedRows.set(childKey, child);
			else selectedRows.delete(childKey);
		}
	}

	for (const row of Array.isArray(visibleRows) ? visibleRows : []) {
		if (isLingxingParentAggregate(row)) continue;
		if (row?._isChildRow && toggledParentGroups.has(String(row?._groupKey || ""))) continue;
		const key = getLingxingListingRowKey(row);
		if (selectedVisibleKeys.has(key)) selectedRows.set(key, row);
		else selectedRows.delete(key);
	}

	return selectedVisibleKeys;
}

export function getSelectedLingxingRealRows(selectedRows: Map<string, any>): any[] {
	return Array.from(selectedRows.values());
}
