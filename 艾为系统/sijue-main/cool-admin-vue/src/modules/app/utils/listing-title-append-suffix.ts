/** 在原标题与后缀之间插入一个逗号；后缀末尾不再追加逗号 */
export function appendCommaTitleSuffix(base: string, suffix: string): string {
	const b = String(base ?? "").trim();
	let s = String(suffix ?? "").trim();
	s = s.replace(/^,+/, "").replace(/,+$/, "");
	if (!s) return b;
	if (!b) return s;
	const baseClean = b.replace(/,+\s*$/, "");
	if (!baseClean) return s;
	if (baseClean === s || baseClean.endsWith(`,${s}`)) return baseClean;
	return `${baseClean},${s}`;
}
