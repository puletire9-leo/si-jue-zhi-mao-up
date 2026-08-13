export type ShelfSelectionAction = "shelve" | "unshelve";

export type ShelfSelectionOrder = {
	key: string;
	orderSn: string;
	row: any;
	order: any;
	identity: any;
	actionable: boolean;
	currentMatched: boolean;
	selected: boolean;
	disabledReason: string;
};

export type ShelfSelectionGroup = {
	productKey: string;
	row: any;
	product: any;
	orders: ShelfSelectionOrder[];
	currentMatchedCount: number;
	actionableCount: number;
	selectedCount: number;
};

export type BuildShelfSelectionGroupsOptions = {
	getRowKey: (row: any, index: number) => string;
	getProduct: (row: any) => any;
	getOrders: (row: any) => any[];
	buildIdentity: (row: any, order: any) => any;
	isOrderActionable: (row: any, order: any) => boolean;
	isOrderCurrentMatched: (row: any, order: any) => boolean;
	getDisabledReason?: (row: any, order: any) => string;
	getOrderSn?: (order: any) => string;
};

function normalizeText(value: any) {
	return String(value ?? "").trim();
}

function buildOrderKey(identity: any, fallback: string) {
	return (
		[
			identity?.store_id,
			identity?.marketplace,
			identity?.asin,
			identity?.msku,
			identity?.product_code,
			identity?.purchase_order_sn
		]
			.map(normalizeText)
			.join("|") || fallback
	);
}

export function buildShelfSelectionGroups(
	rows: any[],
	options: BuildShelfSelectionGroupsOptions
): ShelfSelectionGroup[] {
	return (Array.isArray(rows) ? rows : [])
		.map((row, rowIndex) => {
			const productKey = normalizeText(options.getRowKey(row, rowIndex)) || String(rowIndex);
			const orderMap = new Map<string, ShelfSelectionOrder>();

			(options.getOrders(row) || []).forEach((order: any, orderIndex: number) => {
				const orderSn = normalizeText(
					options.getOrderSn ? options.getOrderSn(order) : order?.order_sn
				);
				if (!orderSn) return;

				const identity = options.buildIdentity(row, order);
				const key = buildOrderKey(identity, `${productKey}|${orderSn}|${orderIndex}`);
				if (orderMap.has(key)) return;

				const actionable = Boolean(options.isOrderActionable(row, order));
				const currentMatched = actionable && Boolean(options.isOrderCurrentMatched(row, order));
				orderMap.set(key, {
					key,
					orderSn,
					row,
					order,
					identity,
					actionable,
					currentMatched,
					selected: currentMatched,
					disabledReason: actionable
						? ""
						: normalizeText(options.getDisabledReason?.(row, order))
				});
			});

			const orders = Array.from(orderMap.values());
			const currentMatchedCount = orders.filter(order => order.currentMatched).length;
			const actionableCount = orders.filter(order => order.actionable).length;
			const selectedCount = orders.filter(order => order.actionable && order.selected).length;

			return {
				productKey,
				row,
				product: options.getProduct(row),
				orders,
				currentMatchedCount,
				actionableCount,
				selectedCount
			};
		})
		.filter(group => group.orders.length > 0);
}

export function getSelectedShelfSelectionItems(groups: ShelfSelectionGroup[]) {
	const itemMap = new Map<string, any>();

	(Array.isArray(groups) ? groups : []).forEach(group => {
		group.orders.forEach(order => {
			if (!order.actionable || !order.selected) return;
			itemMap.set(order.key, order.identity);
		});
	});

	return Array.from(itemMap.values());
}

export function getShelfSelectionGroupSelectedCount(group: ShelfSelectionGroup) {
	return (group?.orders || []).filter(order => order.actionable && order.selected).length;
}

export function getShelfSelectionStats(groups: ShelfSelectionGroup[]) {
	const stats = {
		selectedCount: 0,
		selectedProductCount: 0,
		currentMatchedCount: 0,
		currentMatchedSelectedCount: 0,
		currentMatchedUnselectedCount: 0,
		selectedOutsideCurrentCount: 0,
		actionableCount: 0
	};

	(Array.isArray(groups) ? groups : []).forEach(group => {
		let hasSelectedOrder = false;

		(group?.orders || []).forEach(order => {
			if (order.actionable) stats.actionableCount += 1;
			if (order.currentMatched) stats.currentMatchedCount += 1;

			if (!order.actionable || !order.selected) {
				if (order.currentMatched) stats.currentMatchedUnselectedCount += 1;
				return;
			}

			stats.selectedCount += 1;
			hasSelectedOrder = true;

			if (order.currentMatched) {
				stats.currentMatchedSelectedCount += 1;
			} else {
				stats.selectedOutsideCurrentCount += 1;
			}
		});

		if (hasSelectedOrder) stats.selectedProductCount += 1;
	});

	return stats;
}

export function isShelfSelectionOrderVisible(order: ShelfSelectionOrder, showAll: boolean) {
	if (showAll) return true;
	return Boolean(order?.currentMatched || (order?.actionable && order?.selected));
}
