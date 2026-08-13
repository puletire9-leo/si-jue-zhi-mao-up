/** 审核层：母版标题（不含变体后缀）字数上限 */
export const LISTING_MASTER_TITLE_MAX_LEN = 200;

export function masterTitleCharCount(title: unknown): number {
  return String(title ?? '').trim().length;
}

export function assertMasterTitleLength(title: unknown, langLabel: string): void {
  const len = masterTitleCharCount(title);
  if (len > LISTING_MASTER_TITLE_MAX_LEN) {
    throw new Error(
      `${langLabel}母版标题为 ${len} 字，超过 ${LISTING_MASTER_TITLE_MAX_LEN} 字上限，请手动缩减后保存`
    );
  }
}
