/** 卖点详情首词首字母大写（【副标题】后的正文段） */
export function capitalizeFirstWord(text: string): string {
  const raw = String(text || '');
  const idx = raw.search(/\p{L}/u);
  if (idx < 0) return raw;
  const ch = raw[idx];
  return raw.slice(0, idx) + ch.toLocaleUpperCase() + raw.slice(idx + 1);
}

export function formatBulletPoint(title: string, body: string): string {
  return `【${title}】${capitalizeFirstWord(body)}`;
}

const BULLET_TITLE_PREFIX_RE = /^【([^】]*)】([\s\S]*)/;

/** 规范化完整卖点字符串（含【副标题】前缀） */
export function normalizeBulletPointCapitalization(bulletPoint: string): string {
  const raw = String(bulletPoint || '');
  const match = raw.match(BULLET_TITLE_PREFIX_RE);
  if (!match) return capitalizeFirstWord(raw);
  const [, title, body] = match;
  return formatBulletPoint(title, body);
}
