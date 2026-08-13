const normalizeText = (value: unknown): string => String(value ?? "").trim();

export function getBatchReplenishLocalProductName(item: any): string {
	return normalizeText(item?.local_name);
}

export function getBatchReplenishLocalProductSku(item: any): string {
	return normalizeText(item?.local_sku);
}

export function hasBatchReplenishLocalProductInfo(item: any): boolean {
	return Boolean(
		getBatchReplenishLocalProductName(item) ||
			getBatchReplenishLocalProductSku(item)
	);
}

export function getBatchReplenishLocalProductTooltip(item: any): string {
	const name = getBatchReplenishLocalProductName(item);
	const sku = getBatchReplenishLocalProductSku(item);
	const rows: string[] = [];

	if (name) rows.push(`品名：${name}`);
	if (sku) rows.push(`SKU：${sku}`);

	return rows.join("\n");
}
