export const PENDING_PURCHASER_TIMEOUT_BUSINESS_DAYS = 2;
export const SYSTEM_TIMEOUT_REJECT_REASON = '系统自动不做：超过2个工作日未处理';

type CountryEnabled = {
  uk: boolean;
  de: boolean;
};

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function moveWeekendToPreviousBusinessDay(date: Date): Date {
  let cursor = new Date(date.getTime());
  while (!isBusinessDay(cursor)) {
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

export function getPendingPurchaserTimeoutCutoff(
  now = new Date(),
  businessDays = PENDING_PURCHASER_TIMEOUT_BUSINESS_DAYS
): Date {
  let cursor = moveWeekendToPreviousBusinessDay(now);
  let remaining = businessDays;

  while (remaining > 0) {
    cursor = addDays(cursor, -1);
    if (isBusinessDay(cursor)) {
      remaining -= 1;
    }
  }

  return cursor;
}

export function getPendingPurchaserReminderCutoff(now = new Date()): Date {
  return getPendingPurchaserTimeoutCutoff(now, PENDING_PURCHASER_TIMEOUT_BUSINESS_DAYS - 1);
}

export function shouldExpirePendingPurchaser(
  assignedAt: Date | string | null | undefined,
  now = new Date(),
  businessDays = PENDING_PURCHASER_TIMEOUT_BUSINESS_DAYS
): boolean {
  if (!assignedAt) return false;
  const assignedDate = assignedAt instanceof Date ? assignedAt : new Date(assignedAt);
  if (Number.isNaN(assignedDate.getTime())) return false;
  return assignedDate.getTime() <= getPendingPurchaserTimeoutCutoff(now, businessDays).getTime();
}

export function shouldRemindPendingPurchaser(input: {
  assignedAt: Date | string | null | undefined;
  remindedAt?: Date | string | null | undefined;
  now?: Date;
}): boolean {
  if (input.remindedAt) return false;
  if (!input.assignedAt) return false;

  const now = input.now || new Date();
  const assignedDate = input.assignedAt instanceof Date ? input.assignedAt : new Date(input.assignedAt);
  if (Number.isNaN(assignedDate.getTime())) return false;
  if (shouldExpirePendingPurchaser(assignedDate, now)) return false;

  return assignedDate.getTime() <= getPendingPurchaserReminderCutoff(now).getTime();
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return fallback;
    if (['false', '0', 'no'].includes(normalized)) return false;
    if (['true', '1', 'yes'].includes(normalized)) return true;
  }
  return Boolean(value);
}

export function normalizeReleaseCountryEnabled(value: unknown): CountryEnabled {
  const parsed = parseJsonObject(value);
  const enabled = {
    uk: toBoolean(parsed.uk, true),
    de: toBoolean(parsed.de, true),
  };
  if (!enabled.uk && !enabled.de) {
    return { uk: true, de: true };
  }
  return enabled;
}

export function buildTimedOutPurchaserRejectUpdate() {
  return {
    is_generate: 0,
    reject_reason: SYSTEM_TIMEOUT_REJECT_REASON,
  };
}

export function buildPendingPurchaserReleaseUpdate(countryEnabled: unknown, assignedAt = new Date()) {
  return {
    is_generate: 1,
    reject_reason: '',
    country_enabled: JSON.stringify(normalizeReleaseCountryEnabled(countryEnabled)),
    decision_assigned_at: assignedAt,
    decision_reminded_at: null,
  };
}
