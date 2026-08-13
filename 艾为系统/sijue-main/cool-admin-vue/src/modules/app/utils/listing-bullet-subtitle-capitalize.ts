/** 卖点行常见格式：【副标题】正文 */
const BULLET_SUBTITLE_PREFIX_RE = /^(【[^】]*】)([\s\S]*)$/;
const FIRST_LATIN_LETTER_RE = /[A-Za-zÀ-ÖØ-öø-ÿ]/;

/** 将 【副标题】 之后正文的第一个拉丁字母改为大写 */
export function capitalizeBulletBodyAfterSubtitle(text: string): string {
	const raw = String(text ?? "");
	const m = raw.match(BULLET_SUBTITLE_PREFIX_RE);
	if (!m) return raw;
	const prefix = m[1];
	const body = m[2];
	const idx = body.search(FIRST_LATIN_LETTER_RE);
	if (idx < 0) return raw;
	const ch = body[idx];
	if (ch === ch.toUpperCase()) return raw;
	return prefix + body.slice(0, idx) + ch.toUpperCase() + body.slice(idx + 1);
}

export function isBulletCopyFieldLabel(fieldLabel: string) {
	return String(fieldLabel || "").trim().startsWith("卖点");
}
