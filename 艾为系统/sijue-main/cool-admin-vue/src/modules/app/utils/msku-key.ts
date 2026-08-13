export function normalizeMskuKey(msku: string | null | undefined): string {
	return String(msku ?? "").trim();
}

export function mskuKeysEquivalent(
	a: string | null | undefined,
	b: string | null | undefined
): boolean {
	const ta = normalizeMskuKey(a);
	const tb = normalizeMskuKey(b);
	return !!ta && ta === tb;
}

export type MskuKeyedRow = { msku: string };

export function findMskuRow<T extends MskuKeyedRow>(
	rows: T[] | null | undefined,
	input: string | null | undefined
): T | undefined {
	const list = Array.isArray(rows) ? rows : [];
	const raw = String(input ?? "");
	if (!raw) return undefined;
	const exact = list.find((x) => x.msku === raw);
	if (exact) return exact;
	const trimmed = normalizeMskuKey(raw);
	if (!trimmed) return undefined;
	return list.find((x) => normalizeMskuKey(x.msku) === trimmed);
}

export function formatMskuMountLabel(
	row: { variant_name?: string; account_name?: string; selected_variant?: string } | undefined,
	fallbackMsku: string
): string {
	if (!row) return fallbackMsku;
	const variant = String(row.variant_name ?? row.selected_variant ?? "").trim() || "-";
	const account = String(row.account_name ?? "").trim() || "-";
	return `${variant}-${account}`;
}

export function getMskuDisplayLabel(
	mskus: MskuKeyedRow[] | null | undefined,
	msku: string | null | undefined,
	row?: { variant_name?: string; account_name?: string; selected_variant?: string }
): string {
	const code = String(msku ?? "");
	if (!code.trim()) return "";
	const matched =
		row && mskuKeysEquivalent(row.msku, code)
			? row
			: findMskuRow(
					mskus as Array<
						MskuKeyedRow & {
							variant_name?: string;
							account_name?: string;
							selected_variant?: string;
						}
					>,
					code
				);
	return formatMskuMountLabel(matched, code);
}
