export interface NormalizePurchaserDecisionInput {
  purchaserNum?: unknown;
  is_generate: number;
  procurement?: string | null;
  reject_reason?: string | null;
}

function stringifyPurchaserNum(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value || {});
}

export function normalizePurchaserDecisionUpdate(input: NormalizePurchaserDecisionInput) {
  const status = Number(input.is_generate);
  const rejectReason = String(input.reject_reason || '').trim();

  if (status === 0 && !rejectReason) {
    throw new Error('不做理由不能为空');
  }

  return {
    purchaserNum: stringifyPurchaserNum(input.purchaserNum),
    is_generate: status,
    procurement: input.procurement || '',
    reject_reason: status === 0 ? rejectReason : '',
  };
}
