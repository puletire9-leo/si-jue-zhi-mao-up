export const BSR_CANDIDATE_STATUS_PENDING_PROCESS = 6;
export const BSR_CANDIDATE_STATUS_SELECTED = 4;
export const BSR_CANDIDATE_STATUS_RESERVED = 7;
export const BSR_CANDIDATE_RESERVE_RELEASE_HOURS = 24;

/** @deprecated 预留通知已改为从运营角色用户表手机号取人；保留导出仅兼容旧测试/旧构建上下文。 */
export function normalizeReserveOperatorMobiles(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : String(value || '')
        .split(/[,，\s]+/)
        .filter(Boolean);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of raw) {
    const mobile = String(item || '')
      .trim()
      .replace(/\D/g, '');
    if (!mobile || seen.has(mobile)) continue;
    seen.add(mobile);
    result.push(mobile);
  }

  return result;
}

function parseJsonArray(value: unknown): any[] {
  let parsed = value;
  for (let index = 0; index < 2 && typeof parsed === 'string'; index++) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed) ? parsed : [];
}

export function isPublicHttpImageUrl(value: unknown): value is string {
  const url = String(value || '').trim();
  return (
    /^https?:\/\//i.test(url) &&
    !/^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::|\/|$)/i.test(url)
  );
}

export function collectReserveImageUrls(
  candidate: any,
  variants: Array<{ image_url?: string | null }> = [],
  limit = 8
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const push = (value: unknown) => {
    if (result.length >= limit || !isPublicHttpImageUrl(value)) return;
    const url = String(value).trim();
    if (seen.has(url)) return;
    seen.add(url);
    result.push(url);
  };

  variants.forEach(variant => push(variant?.image_url));
  parseJsonArray(candidate?.variant_Combination).forEach(variant =>
    push(variant?.image_url)
  );
  push(candidate?.image_url);
  push(candidate?.aliyun_img);

  return result;
}

export function buildReserveNotifyMessage(input: {
  notified: boolean;
  operatorProfileCount: number;
  operatorPhoneCount: number;
  operatorUserIds: string[];
  dingtalkEnabled: boolean;
  sendErrorMessage?: string;
}): string {
  if (input.notified) return '已进入预留并通知运营';

  const operatorProfileCount = Number(input.operatorProfileCount || 0);
  const operatorPhoneCount = Number(input.operatorPhoneCount || 0);
  const userIds = Array.isArray(input.operatorUserIds) ? input.operatorUserIds : [];
  const prefix = '已进入预留，运营通知未发出';

  if (operatorProfileCount <= 0) {
    return `${prefix}：未找到运营角色用户`;
  }
  if (!input.dingtalkEnabled) {
    return `${prefix}：钉钉应用未配置或已禁用`;
  }
  if (operatorPhoneCount <= 0) {
    return `${prefix}：运营用户未填写手机号`;
  }
  if (!userIds.length) {
    return `${prefix}：运营用户手机号未匹配到钉钉用户`;
  }
  if (input.sendErrorMessage) {
    return `${prefix}：${input.sendErrorMessage}`;
  }
  return prefix;
}

export function shouldAutoReleaseReservedCandidate(
  reservedAt: Date | string | null | undefined,
  now = new Date(),
  releaseHours = BSR_CANDIDATE_RESERVE_RELEASE_HOURS
): boolean {
  if (!reservedAt) return false;
  const reservedTime = new Date(reservedAt).getTime();
  if (!Number.isFinite(reservedTime)) return false;
  return now.getTime() - reservedTime >= releaseHours * 60 * 60 * 1000;
}
