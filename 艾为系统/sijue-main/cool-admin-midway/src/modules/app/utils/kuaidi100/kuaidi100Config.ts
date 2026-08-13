export const KUAIDI100_CONFIG_KEY = 'kuaidi100_config';

export const KUAIDI100_SECRET_FIELDS = ['customer', 'key', 'secret', 'userid'] as const;

export type Kuaidi100SecretField = (typeof KUAIDI100_SECRET_FIELDS)[number];

export interface Kuaidi100Config {
  enabled: boolean;
  env: string;
  customer: string;
  key: string;
  secret: string;
  userid: string;
  queryUrl: string;
  autoNumberUrl: string;
  autoIdentifyEnabled: boolean;
  autoIdentifyTimeoutMs: number;
  signType: string;
  resultv2: string;
  show: string;
  order: string;
  lang: string;
  needCourierInfo: boolean;
  minQueryIntervalMinutes: number;
  timeoutMs: number;
}

export type Kuaidi100ConfigForEdit = Kuaidi100Config & {
  has_customer: boolean;
  has_key: boolean;
  has_secret: boolean;
  has_userid: boolean;
};

export const DEFAULT_KUAIDI100_CONFIG: Kuaidi100Config = {
  enabled: false,
  env: 'test',
  customer: '',
  key: '',
  secret: '',
  userid: '',
  queryUrl: 'https://poll.kuaidi100.com/poll/query.do',
  autoNumberUrl: 'http://www.kuaidi100.com/autonumber/auto',
  autoIdentifyEnabled: true,
  autoIdentifyTimeoutMs: 10000,
  signType: 'MD5',
  resultv2: '4',
  show: '0',
  order: 'desc',
  lang: 'zh',
  needCourierInfo: false,
  minQueryIntervalMinutes: 45,
  timeoutMs: 15000,
};

export function normalizeKuaidi100ConfigForRuntime(input: any = {}): Kuaidi100Config {
  const merged = { ...DEFAULT_KUAIDI100_CONFIG, ...(isPlainObject(input) ? input : {}) };
  return {
    enabled: toBoolean(merged.enabled),
    env: textOrDefault(merged.env, DEFAULT_KUAIDI100_CONFIG.env),
    customer: normalizeText(merged.customer),
    key: normalizeText(merged.key),
    secret: normalizeText(merged.secret),
    userid: normalizeText(merged.userid),
    queryUrl: textOrDefault(merged.queryUrl, DEFAULT_KUAIDI100_CONFIG.queryUrl),
    autoNumberUrl: textOrDefault(merged.autoNumberUrl, DEFAULT_KUAIDI100_CONFIG.autoNumberUrl),
    autoIdentifyEnabled:
      merged.autoIdentifyEnabled === undefined || merged.autoIdentifyEnabled === null
        ? DEFAULT_KUAIDI100_CONFIG.autoIdentifyEnabled
        : toBoolean(merged.autoIdentifyEnabled),
    autoIdentifyTimeoutMs: clampNumber(
      merged.autoIdentifyTimeoutMs,
      1000,
      60000,
      DEFAULT_KUAIDI100_CONFIG.autoIdentifyTimeoutMs
    ),
    signType: normalizeSignType(merged.signType),
    resultv2: normalizeOption(merged.resultv2, ['1', '4', '8'], DEFAULT_KUAIDI100_CONFIG.resultv2),
    show: normalizeOption(merged.show, ['0', '1', '2', '3'], DEFAULT_KUAIDI100_CONFIG.show),
    order: normalizeOption(merged.order, ['desc', 'asc'], DEFAULT_KUAIDI100_CONFIG.order),
    lang: normalizeOption(merged.lang, ['zh', 'en'], DEFAULT_KUAIDI100_CONFIG.lang),
    needCourierInfo: toBoolean(merged.needCourierInfo),
    minQueryIntervalMinutes: clampNumber(merged.minQueryIntervalMinutes, 45, 24 * 60, 45),
    timeoutMs: clampNumber(merged.timeoutMs, 1000, 60000, DEFAULT_KUAIDI100_CONFIG.timeoutMs),
  };
}

export function buildKuaidi100ConfigForEdit(input: any = {}): Kuaidi100ConfigForEdit {
  const config = normalizeKuaidi100ConfigForRuntime(input);
  return {
    ...config,
    customer: maskSecret(config.customer),
    key: maskSecret(config.key),
    secret: maskSecret(config.secret),
    userid: maskSecret(config.userid),
    has_customer: Boolean(config.customer),
    has_key: Boolean(config.key),
    has_secret: Boolean(config.secret),
    has_userid: Boolean(config.userid),
  };
}

export function mergeKuaidi100ConfigForSave(existing: any = {}, payload: any = {}): Kuaidi100Config {
  const current = normalizeKuaidi100ConfigForRuntime(existing);
  const next = normalizeKuaidi100ConfigForRuntime({ ...current, ...(isPlainObject(payload) ? payload : {}) });

  for (const field of KUAIDI100_SECRET_FIELDS) {
    const incoming = payload?.[field];
    if (shouldPreserveExistingSecret(incoming)) {
      next[field] = current[field];
    } else {
      next[field] = normalizeText(incoming);
    }
  }

  return next;
}

export function maskSecret(value: any): string {
  const text = normalizeText(value);
  if (!text) return '';
  if (text.length <= 8) return '****';
  return `${text.slice(0, 4)}****${text.slice(-4)}`;
}

export function shouldPreserveExistingSecret(value: any): boolean {
  if (value === undefined || value === null) return true;
  const text = normalizeText(value);
  return !text || text.includes('*');
}

function normalizeSignType(value: any) {
  const signType = normalizeText(value).toUpperCase();
  return normalizeOption(signType, ['MD5', 'SHA256'], DEFAULT_KUAIDI100_CONFIG.signType);
}

function normalizeOption(value: any, allowed: string[], fallback: string) {
  const text = normalizeText(value);
  return allowed.includes(text) ? text : fallback;
}

function textOrDefault(value: any, fallback: string) {
  return normalizeText(value) || fallback;
}

function normalizeText(value: any) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function toBoolean(value: any) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const text = normalizeText(value).toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(text);
}

function clampNumber(value: any, min: number, max: number, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(Math.max(Math.trunc(num), min), max);
}

function isPlainObject(value: any) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
