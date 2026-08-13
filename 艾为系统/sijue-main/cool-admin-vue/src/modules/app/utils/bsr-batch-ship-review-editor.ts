export type ReviewEditorWarehouseOption = {
	value: string;
	label: string;
	group: string;
	raw?: any;
};

export type ReviewEditorAllocation = {
	id: string;
	allocationLineNo: number;
	purchasePlanSn: string;
	purchaseOrderSn: string;
	analysisRecordId: number | null;
	linkedPlanSns: any[];
	linkedAnalysisRecordIds: any[];
	shipQty: number;
	actualShippableQty: number | null;
	estimatedShippableQty: number | null;
	orderStatusText: string;
	supplierName: string;
	orderTime: string;
	logisticsStatusText: string;
	logisticsStatusReason: string;
	snapshot: any;
};

export type ReviewEditorSegment = {
	id: string;
	productLineNo: number;
	segmentLineNo: number;
	itemKey: string;
	methodKey: string;
	methodLabel: string;
	methodIcon: string;
	methodColor: string;
	dateRange: any[];
	arrivalRangeText: string;
	shipQty: number;
	systemSuggestQty: number;
	manualAdjusted: boolean;
	manualInputQty: number | null;
	gapQty: number | null;
	remainingGapQty: number | null;
	warehouse: string;
	warehouseName: string;
	packageType: number | null;
	packageTypeLabel: string;
	planShipDate: string;
	detailRemark: string;
	batchRemark: string;
	algoLabel: string;
	calculation: any;
	snapshot: any;
	allocations: ReviewEditorAllocation[];
};

export type ReviewEditorProduct = {
	id: string;
	productLineNo: number;
	itemKey: string;
	rowKey: string;
	storeId: string;
	listingId: string;
	asin: string;
	marketplace: string;
	msku: string;
	fnsku: string;
	productCode: string;
	productName: string;
	productImg: string;
	sellerName: string;
	dailyAvgSales: number | null;
	targetStockDays: number | null;
	volatilityCoefficient: number | null;
	fbaQty: number | null;
	reservedQty: number | null;
	inTransitQty: number | null;
	localQty: number | null;
	actualShippableQty: number | null;
	purchasePlanQty: number | null;
	pendingDeliveryQty: number | null;
	shipQty: number;
	snapshot: any;
	segments: ReviewEditorSegment[];
	allocationPool: ReviewEditorAllocation[];
};

export type ReviewEditorModel = {
	reviewNo: string;
	status: string;
	versionNo: number | null;
	clientSubmitToken: string;
	sourcePage: any;
	inputSnapshot: any;
	workbenchSnapshot: any;
	submitPayload: any;
	uiState: any;
	summary: any;
	warehouseOptions: ReviewEditorWarehouseOption[];
	products: ReviewEditorProduct[];
};

export type ReviewEditorValidationIssue = {
	type: "warning" | "error";
	message: string;
	title?: string;
	description?: string;
};

export type ReviewEditorProductBalanceState = {
	shipQty: number;
	allocationTotal: number;
	diff: number;
	severity: "success" | "warning";
	badgeText: string;
	title: string;
	description: string;
	fieldHint: string;
};

export const REVIEW_EDITOR_PACKAGE_TYPE_OPTIONS = [
	{ value: 1, label: "混装商品" },
	{ value: 2, label: "原厂包装商品" }
];

const WAREHOUSE_GROUP_LABELS: Record<string, string> = {
	local: "本地仓",
	overseas: "海外仓",
	awd: "AWD仓"
};

function clonePlain<T>(value: T): T {
	if (value === null || value === undefined) return value;
	return JSON.parse(JSON.stringify(value));
}

function normalizeText(value: any) {
	if (value === null || value === undefined) return "";
	return String(value);
}

function normalizeNumber(value: any) {
	const num = Number(value);
	return Number.isFinite(num) ? num : 0;
}

function normalizeNullableNumber(value: any) {
	if (value === "" || value === null || value === undefined) return null;
	const num = Number(value);
	return Number.isFinite(num) ? num : null;
}

function normalizeInt(value: any) {
	return Math.max(0, Math.round(normalizeNumber(value)));
}

function normalizePackageType(value: any) {
	const num = Number(value);
	return num === 1 || num === 2 ? num : null;
}

export function getReviewEditorPackageTypeLabel(value: any) {
	return (
		REVIEW_EDITOR_PACKAGE_TYPE_OPTIONS.find((item) => item.value === Number(value))?.label ||
		"包装未填写"
	);
}

function buildProductKey(record: any, index: number) {
	return (
		normalizeText(record.itemKey) ||
		[
			record.storeId ?? record.store_id ?? record.sid,
			record.asin,
			record.marketplace,
			record.msku,
			record.fnsku
		]
			.map(normalizeText)
			.join("|") ||
		`product_${index + 1}`
	);
}

function warehouseValue(value: any) {
	if (value === "" || value === null || value === undefined) return "";
	return String(value);
}

function payloadWarehouseValue(value: any) {
	const text = warehouseValue(value);
	if (!text) return "";
	const num = Number(text);
	return Number.isFinite(num) && String(num) === text ? num : text;
}

function pushWarehouseOption(
	options: ReviewEditorWarehouseOption[],
	seen: Set<string>,
	value: any,
	label: any,
	group = "已保存仓库",
	raw?: any
) {
	const normalizedValue = warehouseValue(value);
	if (!normalizedValue || seen.has(normalizedValue)) return;
	seen.add(normalizedValue);
	options.push({
		value: normalizedValue,
		label: normalizeText(label) || normalizedValue,
		group,
		raw
	});
}

function collectWarehouseOptions(workbenchSnapshot: any, records: any[]) {
	const options: ReviewEditorWarehouseOption[] = [];
	const seen = new Set<string>();
	const warehouseList = workbenchSnapshot?.warehouseList || {};

	Object.entries(WAREHOUSE_GROUP_LABELS).forEach(([key, groupLabel]) => {
		const rows = Array.isArray(warehouseList?.[key]) ? warehouseList[key] : [];
		rows.forEach((row: any) => {
			pushWarehouseOption(
				options,
				seen,
				row?.wid ?? row?.id ?? row?.warehouse_id ?? row?.value,
				row?.name ?? row?.warehouse_name ?? row?.label,
				groupLabel,
				row
			);
		});
	});

	records.forEach((record) => {
		pushWarehouseOption(
			options,
			seen,
			record.warehouse ?? record.warehouse_id,
			record.warehouseName ?? record.warehouse_name,
			"已保存仓库"
		);
	});

	return options;
}

function resolveWarehouseName(model: ReviewEditorModel, value: any, fallback = "") {
	const normalizedValue = warehouseValue(value);
	return (
		model.warehouseOptions.find((item) => item.value === normalizedValue)?.label ||
		fallback ||
		normalizedValue
	);
}

function buildAllocation(record: any, order: any, orderIndex: number): ReviewEditorAllocation {
	const shipQty = normalizeInt(order.ship_qty ?? order.shipQty);
	const purchaseOrderSn = normalizeText(order.order_sn ?? order.purchase_order_sn);
	return {
		id:
			normalizeText(order.id) ||
			`${normalizeText(record.itemKey)}_${normalizeText(record.shippingMethod)}_${purchaseOrderSn}_${orderIndex}`,
		allocationLineNo: orderIndex + 1,
		purchasePlanSn: normalizeText(order.plan_sn ?? order.purchase_plan_sn),
		purchaseOrderSn,
		analysisRecordId: normalizeNullableNumber(
			order.analysis_record_id ?? order.analysisRecordId
		),
		linkedPlanSns: Array.isArray(order.linked_plan_sns)
			? clonePlain(order.linked_plan_sns)
			: [],
		linkedAnalysisRecordIds: Array.isArray(order.linked_analysis_record_ids)
			? clonePlain(order.linked_analysis_record_ids)
			: [],
		shipQty,
		actualShippableQty: normalizeNullableNumber(
			order.actual_shippable_qty ?? order.actualShippableQty
		),
		estimatedShippableQty: normalizeNullableNumber(
			order.estimated_shippable_qty ?? order.estimatedShippableQty
		),
		orderStatusText: normalizeText(order.status_text ?? order.order_status_text),
		supplierName: normalizeText(order.supplier_name),
		orderTime: normalizeText(order.order_time),
		logisticsStatusText: normalizeText(order.logistics_status_text),
		logisticsStatusReason: normalizeText(order.logistics_status_reason),
		snapshot: clonePlain(order)
	};
}

function buildProduct(record: any, productLineNo: number, index: number): ReviewEditorProduct {
	return {
		id: buildProductKey(record, index),
		productLineNo,
		itemKey: normalizeText(record.itemKey),
		rowKey: normalizeText(record.row_key ?? record.rowKey),
		storeId: normalizeText(record.storeId ?? record.store_id ?? record.sid),
		listingId: normalizeText(record.listingId ?? record.listing_id),
		asin: normalizeText(record.asin),
		marketplace: normalizeText(record.marketplace),
		msku: normalizeText(record.msku),
		fnsku: normalizeText(record.fnsku),
		productCode: normalizeText(record.productCode ?? record.product_code),
		productName: normalizeText(record.productName ?? record.product_name),
		productImg: normalizeText(record.productImg ?? record.product_img),
		sellerName: normalizeText(record.sellerName ?? record.seller_name),
		dailyAvgSales: normalizeNullableNumber(record.daily_avg_sales ?? record.dailyAvgSales),
		targetStockDays: normalizeNullableNumber(
			record.target_stock_days ?? record.targetStockDays
		),
		volatilityCoefficient: normalizeNullableNumber(
			record.volatility_coefficient ?? record.volatilityCoefficient
		),
		fbaQty: normalizeNullableNumber(record.fba_qty ?? record.fbaQty),
		reservedQty: normalizeNullableNumber(record.reserved_qty ?? record.reservedQty),
		inTransitQty: normalizeNullableNumber(record.in_transit_qty ?? record.inTransitQty),
		localQty: normalizeNullableNumber(record.local_qty ?? record.localQty),
		actualShippableQty: normalizeNullableNumber(
			record.actual_shippable_qty ?? record.actualShippableQty
		),
		purchasePlanQty: normalizeNullableNumber(
			record.purchase_plan_qty ?? record.purchasePlanQty
		),
		pendingDeliveryQty: normalizeNullableNumber(
			record.pending_delivery_qty ?? record.pendingDeliveryQty
		),
		shipQty: 0,
		snapshot: clonePlain(record),
		segments: [],
		allocationPool: []
	};
}

function buildSegment(record: any, productLineNo: number, segmentLineNo: number) {
	const packageType = normalizePackageType(record.packageType ?? record.packing_type);
	const shipQty = normalizeInt(record.shipQty ?? record.ship_qty);
	const orderDetails = Array.isArray(record.orderDetails) ? record.orderDetails : [];
	return {
		id: `${productLineNo}_${segmentLineNo}_${normalizeText(record.shippingMethod ?? record.method_key)}`,
		productLineNo,
		segmentLineNo,
		itemKey: normalizeText(record.itemKey),
		methodKey: normalizeText(record.shippingMethod ?? record.method_key),
		methodLabel: normalizeText(record.shippingLabel ?? record.method_label),
		methodIcon: normalizeText(record.shippingIcon ?? record.method_icon),
		methodColor: normalizeText(record.shippingColor ?? record.method_color),
		dateRange: Array.isArray(record.dateRange)
			? clonePlain(record.dateRange)
			: Array.isArray(record.date_range)
				? clonePlain(record.date_range)
				: [],
		arrivalRangeText: normalizeText(record.arrivalRangeText ?? record.arrival_range_text),
		shipQty,
		systemSuggestQty: normalizeInt(record.systemSuggestQty ?? record.system_suggest_qty),
		manualAdjusted: Boolean(record.manualAdjusted ?? record.manual_adjusted),
		manualInputQty: normalizeNullableNumber(
			record.manualInputQty ?? record.manual_input_qty ?? record.shipQty
		),
		gapQty: normalizeNullableNumber(record.gapQty ?? record.gap_qty),
		remainingGapQty: normalizeNullableNumber(
			record.remainingGapQty ?? record.remaining_gap_qty
		),
		warehouse: warehouseValue(record.warehouse ?? record.warehouse_id),
		warehouseName: normalizeText(record.warehouseName ?? record.warehouse_name),
		packageType,
		packageTypeLabel: getReviewEditorPackageTypeLabel(packageType),
		planShipDate: normalizeText(record.planShipDate ?? record.plan_ship_date),
		detailRemark: normalizeText(record.remark ?? record.detail_remark),
		batchRemark: normalizeText(record.batchRemark ?? record.batch_remark),
		algoLabel: normalizeText(record.algoLabel ?? record.algo_label),
		calculation: clonePlain(record.calculation_json ?? record.calculationSnapshot ?? null),
		snapshot: clonePlain(record),
		allocations: orderDetails
			.filter((order: any) => normalizeInt(order?.ship_qty ?? order?.shipQty) > 0)
			.map((order: any, orderIndex: number) => buildAllocation(record, order, orderIndex))
	} as ReviewEditorSegment;
}

export function createReviewEditorModel(payload: any): ReviewEditorModel {
	const submitPayload = clonePlain(payload?.submit_payload || {});
	const records = Array.isArray(submitPayload.records) ? submitPayload.records : [];
	const workbenchSnapshot = clonePlain(payload?.workbench_snapshot || {});
	const productMap = new Map<string, ReviewEditorProduct>();
	const products: ReviewEditorProduct[] = [];

	records.forEach((record: any, recordIndex: number) => {
		const productKey = buildProductKey(record, recordIndex);
		let product = productMap.get(productKey);
		if (!product) {
			product = buildProduct(record, products.length + 1, recordIndex);
			productMap.set(productKey, product);
			products.push(product);
		}
		const segment = buildSegment(record, product.productLineNo, product.segments.length + 1);
		product.segments.push(segment);
		product.shipQty += segment.shipQty;
	});
	products.forEach((product) => {
		product.shipQty = getReviewEditorProductShipQty(product);
		product.allocationPool = buildProductAllocationPool(product);
	});

	return {
		reviewNo: normalizeText(payload?.review_no || payload?.reviewNo),
		status: normalizeText(payload?.status),
		versionNo: normalizeNullableNumber(payload?.version_no ?? payload?.versionNo),
		clientSubmitToken:
			normalizeText(submitPayload.client_submit_token) ||
			normalizeText(workbenchSnapshot.shipPlanSubmitToken) ||
			`batch_ship_review_edit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
		sourcePage: clonePlain(payload?.source_page || null),
		inputSnapshot: clonePlain(payload?.input_snapshot || null),
		workbenchSnapshot,
		submitPayload,
		uiState: clonePlain(payload?.ui_state || null),
		summary: clonePlain(payload?.summary || {}),
		warehouseOptions: collectWarehouseOptions(workbenchSnapshot, records),
		products
	};
}

export function getReviewEditorSegmentAllocationTotal(segment: ReviewEditorSegment) {
	return segment.allocations.reduce(
		(sum, allocation) => sum + normalizeInt(allocation.shipQty),
		0
	);
}

export function getReviewEditorProductShipQty(product: ReviewEditorProduct) {
	return product.segments.reduce((sum, segment) => sum + normalizeInt(segment.shipQty), 0);
}

export function getReviewEditorProductAllocationTotal(product: ReviewEditorProduct) {
	return product.allocationPool.reduce(
		(sum, allocation) => sum + normalizeInt(allocation.shipQty),
		0
	);
}

export function getReviewEditorAllocationMax(allocation: ReviewEditorAllocation) {
	const value = Number(allocation.actualShippableQty ?? allocation.estimatedShippableQty ?? 0);
	return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

function buildAllocationKey(allocation: ReviewEditorAllocation) {
	return (
		[allocation.purchasePlanSn, allocation.purchaseOrderSn, allocation.analysisRecordId ?? ""]
			.map(normalizeText)
			.join("|") || allocation.id
	);
}

function mergeUniqueValues(values: any[] = [], additions: any[] = []) {
	return Array.from(new Set([...values, ...additions].map(normalizeText).filter(Boolean)));
}

function buildProductAllocationPool(product: ReviewEditorProduct) {
	const map = new Map<string, ReviewEditorAllocation>();
	product.segments.forEach((segment) => {
		segment.allocations.forEach((allocation) => {
			const qty = normalizeInt(allocation.shipQty);
			if (qty <= 0) return;
			const key = buildAllocationKey(allocation);
			const existing = map.get(key);
			if (existing) {
				existing.shipQty += qty;
				existing.linkedPlanSns = mergeUniqueValues(
					existing.linkedPlanSns,
					allocation.linkedPlanSns
				);
				existing.linkedAnalysisRecordIds = mergeUniqueValues(
					existing.linkedAnalysisRecordIds,
					allocation.linkedAnalysisRecordIds
				);
				if (existing.actualShippableQty === null) {
					existing.actualShippableQty = allocation.actualShippableQty;
				}
				if (existing.estimatedShippableQty === null) {
					existing.estimatedShippableQty = allocation.estimatedShippableQty;
				}
				return;
			}
			map.set(key, {
				...clonePlain(allocation),
				id: `pool_${product.productLineNo}_${map.size + 1}_${allocation.purchaseOrderSn || allocation.id}`,
				allocationLineNo: map.size + 1,
				shipQty: qty
			});
		});
	});
	return Array.from(map.values()).map((allocation, index) => ({
		...allocation,
		allocationLineNo: index + 1
	}));
}

function getProductLabel(product: ReviewEditorProduct) {
	return product.msku || product.asin || product.productName || "产品";
}

export function getReviewEditorProductBalanceState(
	product: ReviewEditorProduct
): ReviewEditorProductBalanceState {
	const label = getProductLabel(product);
	const shipQty = getReviewEditorProductShipQty(product);
	const allocationTotal = getReviewEditorProductAllocationTotal(product);
	const diff = shipQty - allocationTotal;
	const absDiff = Math.abs(diff);

	if (diff > 0) {
		return {
			shipQty,
			allocationTotal,
			diff,
			severity: "warning",
			badgeText: `差额 +${absDiff}`,
			title: `数量待配平：${label} 还差 ${absDiff} 件`,
			description: `运输方式合计 ${shipQty}，采购单货源池 ${allocationTotal}。请增加货源池 ${absDiff} 件，或减少运输方式发货 ${absDiff} 件。`,
			fieldHint: `计入产品发货合计。当前发货比货源多 ${absDiff} 件。`
		};
	}

	if (diff < 0) {
		return {
			shipQty,
			allocationTotal,
			diff,
			severity: "warning",
			badgeText: `差额 -${absDiff}`,
			title: `数量待配平：${label} 货源多 ${absDiff} 件`,
			description: `运输方式合计 ${shipQty}，采购单货源池 ${allocationTotal}。请减少货源池 ${absDiff} 件，或增加运输方式发货 ${absDiff} 件。`,
			fieldHint: `计入产品发货合计。当前货源比发货多 ${absDiff} 件。`
		};
	}

	return {
		shipQty,
		allocationTotal,
		diff,
		severity: "success",
		badgeText: "已配平",
		title: `数量已配平：${label}`,
		description: `运输方式合计 ${shipQty}，采购单货源池 ${allocationTotal}。`,
		fieldHint: "已配平：产品发货与采购单货源一致。"
	};
}

function collectProductAllocationIssues(product: ReviewEditorProduct) {
	const issues: ReviewEditorValidationIssue[] = [];
	const label = getProductLabel(product);
	const balanceState = getReviewEditorProductBalanceState(product);
	if (!product.allocationPool.length) {
		issues.push({
			type: "warning",
			message: `${label} 缺少采购单货源池`,
			title: `数量待配平：${label} 缺少采购单货源池`,
			description: "请先在采购单货源池里填写当前产品可用的采购单数量。"
		});
	}
	if (balanceState.diff !== 0) {
		issues.push({
			type: "warning",
			message: `${balanceState.title}。${balanceState.description}`,
			title: balanceState.title,
			description: balanceState.description
		});
	}
	product.allocationPool.forEach((allocation) => {
		const qty = normalizeInt(allocation.shipQty);
		const max = getReviewEditorAllocationMax(allocation);
		if (max !== null && qty > max) {
			issues.push({
				type: "error",
				message: `${label} / ${allocation.purchaseOrderSn || "采购单"} 实际可发 ${max}，本次分配 ${qty}`,
				title: `${label} 采购单分配超出实际可发`,
				description: `${allocation.purchaseOrderSn || "采购单"} 实际可发 ${max}，本次分配 ${qty}，请调低本次使用数量。`
			});
		}
	});
	return issues;
}

export function validateReviewEditorIssues(model: ReviewEditorModel) {
	const issues: ReviewEditorValidationIssue[] = [];
	if (!model.products.length) {
		issues.push({
			type: "error",
			message: "审核单缺少可编辑的产品记录"
		});
		return issues;
	}

	model.products.forEach((product) => {
		if (!product.segments.length) {
			issues.push({
				type: "error",
				message: `${product.msku || product.asin || "产品"} 缺少运输段`
			});
		}
		product.segments.forEach((segment) => {
			const label = `${product.msku || product.asin || "产品"} / ${segment.methodLabel || segment.methodKey || "运输段"}`;
			const shipQty = normalizeInt(segment.shipQty);
			if (shipQty <= 0) {
				issues.push({ type: "error", message: `${label} 发货数量必须大于 0` });
			}
			if (!segment.warehouse) {
				issues.push({ type: "error", message: `${label} 未选择仓库` });
			}
			if (!segment.packageType) {
				issues.push({ type: "error", message: `${label} 未选择包装类型` });
			}
			if (!segment.planShipDate) {
				issues.push({ type: "error", message: `${label} 未选择计划发货日期` });
			}
		});
		issues.push(...collectProductAllocationIssues(product));
	});

	return issues;
}

export function validateReviewEditorModel(model: ReviewEditorModel) {
	return validateReviewEditorIssues(model).map((issue) => issue.message);
}

function buildAllocationPayload(allocation: ReviewEditorAllocation) {
	const base = clonePlain(allocation.snapshot || {});
	return {
		...base,
		plan_sn: allocation.purchasePlanSn,
		purchase_plan_sn: allocation.purchasePlanSn,
		order_sn: allocation.purchaseOrderSn,
		purchase_order_sn: allocation.purchaseOrderSn,
		analysis_record_id: allocation.analysisRecordId,
		linked_plan_sns: clonePlain(allocation.linkedPlanSns || []),
		linked_analysis_record_ids: clonePlain(allocation.linkedAnalysisRecordIds || []),
		status_text: allocation.orderStatusText,
		supplier_name: allocation.supplierName,
		order_time: allocation.orderTime,
		logistics_status_text: allocation.logisticsStatusText,
		logistics_status_reason: allocation.logisticsStatusReason,
		actual_shippable_qty: allocation.actualShippableQty,
		estimated_shippable_qty: allocation.estimatedShippableQty,
		ship_qty: normalizeInt(allocation.shipQty)
	};
}

function buildSegmentPayload(
	model: ReviewEditorModel,
	product: ReviewEditorProduct,
	segment: ReviewEditorSegment,
	allocations: ReviewEditorAllocation[] = segment.allocations
) {
	const base = clonePlain(segment.snapshot || product.snapshot || {});
	const packageType = normalizePackageType(segment.packageType);
	const warehouseName = resolveWarehouseName(model, segment.warehouse, segment.warehouseName);
	return {
		...base,
		itemKey: product.itemKey || segment.itemKey || base.itemKey,
		row_key: product.rowKey || base.row_key || base.rowKey || "",
		asin: product.asin,
		marketplace: product.marketplace,
		msku: product.msku,
		fnsku: product.fnsku,
		storeId: product.storeId || base.storeId || base.store_id || "",
		productName: product.productName,
		productImg: product.productImg,
		productCode: product.productCode,
		listingId: product.listingId,
		shippingMethod: segment.methodKey,
		shippingLabel: segment.methodLabel,
		shippingIcon: segment.methodIcon,
		shippingColor: segment.methodColor,
		shipQty: normalizeInt(segment.shipQty),
		systemSuggestQty: normalizeInt(segment.systemSuggestQty),
		manualAdjusted: true,
		manualInputQty: normalizeInt(segment.shipQty),
		warehouse: payloadWarehouseValue(segment.warehouse),
		warehouseName,
		packageType,
		planShipDate: segment.planShipDate,
		remark: segment.detailRemark,
		batchRemark: segment.batchRemark,
		algoLabel: segment.algoLabel,
		dateRange: clonePlain(segment.dateRange || []),
		orderDetails: allocations
			.filter((allocation) => normalizeInt(allocation.shipQty) > 0)
			.map(buildAllocationPayload)
	};
}

function distributeProductAllocations(product: ReviewEditorProduct) {
	const rows = product.allocationPool.map((allocation) => ({
		allocation: clonePlain(allocation),
		remainingQty: normalizeInt(allocation.shipQty)
	}));
	const segmentAllocationMap = new Map<string, ReviewEditorAllocation[]>();
	let rowIndex = 0;

	product.segments.forEach((segment) => {
		let neededQty = normalizeInt(segment.shipQty);
		const allocations: ReviewEditorAllocation[] = [];
		while (neededQty > 0 && rowIndex < rows.length) {
			const row = rows[rowIndex];
			if (row.remainingQty <= 0) {
				rowIndex += 1;
				continue;
			}
			const takeQty = Math.min(neededQty, row.remainingQty);
			allocations.push({
				...clonePlain(row.allocation),
				id: `${row.allocation.id}_auto_${segment.segmentLineNo}_${allocations.length + 1}`,
				allocationLineNo: allocations.length + 1,
				shipQty: takeQty
			});
			row.remainingQty -= takeQty;
			neededQty -= takeQty;
			if (row.remainingQty <= 0) {
				rowIndex += 1;
			}
		}
		segmentAllocationMap.set(segment.id, allocations);
	});

	return segmentAllocationMap;
}

export function buildReviewEditorSubmitPayload(model: ReviewEditorModel) {
	const records = model.products.flatMap((product) => {
		const segmentAllocationMap = distributeProductAllocations(product);
		return product.segments.map((segment) =>
			buildSegmentPayload(model, product, segment, segmentAllocationMap.get(segment.id) || [])
		);
	});
	const totalShipQty = records.reduce((sum, record) => sum + normalizeInt(record.shipQty), 0);
	return {
		...clonePlain(model.submitPayload || {}),
		client_submit_token: model.clientSubmitToken,
		planned_snapshot: {
			...(clonePlain(model.submitPayload?.planned_snapshot || {}) as any),
			reviewEditorSummary: {
				totalShipQty,
				productCount: model.products.length,
				segmentCount: records.length
			},
			updatedAt: new Date().toISOString()
		},
		records
	};
}

function buildReviewEditorWorkbenchSnapshot(model: ReviewEditorModel, submitPayload: any) {
	const workbench = clonePlain(model.workbenchSnapshot || {});
	const products = model.products.map((product) => ({
		...clonePlain(product),
		shipQty: getReviewEditorProductShipQty(product)
	}));
	return {
		...workbench,
		reviewNo: model.reviewNo,
		capturedAt: new Date().toISOString(),
		shipPlanSubmitToken: model.clientSubmitToken,
		shipPlanDialog: {
			...(workbench.shipPlanDialog || {}),
			visible: false,
			records: clonePlain(submitPayload.records || [])
		},
		reviewEditor: {
			products,
			warehouseOptions: clonePlain(model.warehouseOptions),
			updatedAt: new Date().toISOString()
		}
	};
}

export function buildReviewEditorSaveRequest(
	model: ReviewEditorModel,
	saveType: "draft" | "submit"
) {
	const submitPayload = buildReviewEditorSubmitPayload(model);
	return {
		review_no: model.reviewNo,
		source_page: {
			...(clonePlain(model.sourcePage || {}) as any),
			page: "bsr_batch_ship_review_detail",
			component: "BsrBatchShipReviewSnapshotEditor",
			editSource: "review_detail_editor",
			editedAt: new Date().toISOString()
		},
		input_snapshot: clonePlain(model.inputSnapshot || null),
		workbench_snapshot: buildReviewEditorWorkbenchSnapshot(model, submitPayload),
		submit_payload: submitPayload,
		ui_state: {
			...(clonePlain(model.uiState || {}) as any),
			activeStep: "review_detail_editor",
			editorMode: saveType
		},
		remark: saveType === "submit" ? "详情编辑后重新提交审核" : "详情编辑保存草稿"
	};
}
