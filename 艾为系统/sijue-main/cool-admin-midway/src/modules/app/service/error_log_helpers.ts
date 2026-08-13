const SENSITIVE_KEYWORDS = [
  'password',
  'passwd',
  'pwd',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'set-cookie',
  'secret',
  'app_secret',
  'appsecret',
  'private_key',
  'credential',
  'session',
  'signature',
  'sign',
];

const DEFAULT_MAX_TEXT_LENGTH = 8000;
const DEFAULT_MAX_STRING_LENGTH = 2000;
const DEFAULT_MAX_ARRAY_LENGTH = 50;
const DEFAULT_MAX_OBJECT_KEYS = 100;
const DEFAULT_MAX_DEPTH = 6;

export interface SanitizeOptions {
  maxDepth?: number;
  maxStringLength?: number;
  maxArrayLength?: number;
  maxObjectKeys?: number;
}

function isPlainObject(value: any) {
  return Object.prototype.toString.call(value) === '[object Object]';
}

function shouldRedactKey(key: string) {
  const normalized = String(key || '').toLowerCase();
  return SENSITIVE_KEYWORDS.some(item => normalized.includes(item));
}

export function toLimitedText(value: any, maxLength = DEFAULT_MAX_TEXT_LENGTH): string {
  const text =
    value instanceof Error
      ? value.stack || value.message || String(value)
      : typeof value === 'string'
        ? value
        : (() => {
            try {
              return JSON.stringify(value);
            } catch {
              return String(value);
            }
          })();

  if (!text) return '';
  if (text.length <= maxLength) return text;
  const suffix = '...[truncated]';
  if (maxLength <= suffix.length) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - suffix.length)}${suffix}`;
}

export function normalizeErrorMessage(error: any, fallback = 'Unknown error') {
  if (!error) return fallback;
  if (typeof error === 'string') return toLimitedText(error, 1000);
  if (error.message) return toLimitedText(error.message, 1000);
  return toLimitedText(error, 1000) || fallback;
}

export function sanitizeForErrorLog(value: any, options: SanitizeOptions = {}) {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const maxStringLength = options.maxStringLength ?? DEFAULT_MAX_STRING_LENGTH;
  const maxArrayLength = options.maxArrayLength ?? DEFAULT_MAX_ARRAY_LENGTH;
  const maxObjectKeys = options.maxObjectKeys ?? DEFAULT_MAX_OBJECT_KEYS;
  const seen = new WeakSet<object>();

  const sanitize = (input: any, depth: number, key = ''): any => {
    if (shouldRedactKey(key)) return '[redacted]';
    if (input === null || input === undefined) return input;
    if (typeof input === 'string') return toLimitedText(input, maxStringLength);
    if (typeof input === 'number' || typeof input === 'boolean') return input;
    if (typeof input === 'bigint') return input.toString();
    if (input instanceof Date) return input.toISOString();
    if (input instanceof Error) {
      return {
        name: input.name,
        message: toLimitedText(input.message, 1000),
        stack: toLimitedText(input.stack || '', DEFAULT_MAX_TEXT_LENGTH),
      };
    }
    if (Buffer.isBuffer(input)) return `[buffer ${input.length} bytes]`;
    if (typeof input === 'function') return `[function ${input.name || 'anonymous'}]`;

    if (typeof input === 'object') {
      if (seen.has(input)) return '[circular]';
      if (depth >= maxDepth) return '[max-depth]';
      seen.add(input);

      if (Array.isArray(input)) {
        const rows = input.slice(0, maxArrayLength).map(item => sanitize(item, depth + 1));
        if (input.length > maxArrayLength) {
          rows.push(`[truncated ${input.length - maxArrayLength} items]`);
        }
        return rows;
      }

      if (!isPlainObject(input)) {
        return toLimitedText(input, maxStringLength);
      }

      const output: Record<string, any> = {};
      const keys = Object.keys(input);
      keys.slice(0, maxObjectKeys).forEach(itemKey => {
        output[itemKey] = sanitize(input[itemKey], depth + 1, itemKey);
      });
      if (keys.length > maxObjectKeys) {
        output.__truncatedKeys = keys.length - maxObjectKeys;
      }
      return output;
    }

    return toLimitedText(input, maxStringLength);
  };

  return sanitize(value, 0);
}

export function inferModuleFromUrl(url: string) {
  const cleanUrl = String(url || '').split('?')[0];
  const parts = cleanUrl.split('/').filter(Boolean);
  const appIndex = parts.findIndex(item => item === 'app');
  if (appIndex >= 0 && parts[appIndex + 1]) {
    return parts[appIndex + 1];
  }
  const adminIndex = parts.findIndex(item => item === 'admin');
  if (adminIndex >= 0 && parts[adminIndex + 1]) {
    return parts[adminIndex + 1];
  }
  return parts[0] || '';
}
