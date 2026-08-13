import { createHash } from 'crypto';

export const AUTO_REPLENISH_REMARK_START = '【自动补全V1】';
export const AUTO_REPLENISH_REMARK_END = '【/自动补全V1】';

export type AutoReplenishAlgorithmKey = 'daily_avg' | 'history' | 'trend' | 'combined' | 'operator_intent';
export type AutoReplenishShippingProfileKey = 'default' | 'uk' | 'de';
export type AutoReplenishShippingMethodKey =
  | 'express'
  | 'air'
  | 'air_slow'
  | 'truck'
  | 'rail'
  | 'sea';

export const AUTO_REPLENISH_ALGORITHMS = [
  { key: 'daily_avg', label: '日均销量' },
  { key: 'history', label: '历史销量' },
  { key: 'trend', label: '搜索词趋势' },
  { key: 'combined', label: '综合走势' },
  { key: 'operator_intent', label: '运营意向' },
] as const;

export const AUTO_REPLENISH_SHIPPING_METHODS = [
  { key: 'express', label: '快递', days: 5, icon: '🚚', color: '#FF6B9D' },
  { key: 'air', label: '空快', days: 8, icon: '✈️', color: '#409EFF' },
  { key: 'air_slow', label: '空慢', days: 10, icon: '✈️', color: '#67B8FF' },
  { key: 'truck', label: '卡车', days: 30, icon: '🚛', color: '#67C23A' },
  { key: 'rail', label: '铁路', days: 35, icon: '🚂', color: '#E6A23C' },
  { key: 'sea', label: '海运', days: 60, icon: '🚢', color: '#F56C6C' },
] as const;

export const AUTO_REPLENISH_SHIPPING_PROFILES: Record<
  AutoReplenishShippingProfileKey,
  {
    key: AutoReplenishShippingProfileKey;
    label: string;
    methodDays: Partial<Record<AutoReplenishShippingMethodKey, number>>;
    selectedMethods: AutoReplenishShippingMethodKey[];
  }
> = {
  default: {
    key: 'default',
    label: '默认',
    methodDays: { express: 5, air: 8, air_slow: 10, truck: 30, rail: 35, sea: 60 },
    selectedMethods: ['express', 'air', 'air_slow', 'truck', 'rail', 'sea'],
  },
  uk: {
    key: 'uk',
    label: '英国',
    methodDays: { express: 5, air: 9, air_slow: 14, truck: 28, sea: 52 },
    selectedMethods: ['express', 'air', 'air_slow', 'truck', 'sea'],
  },
  de: {
    key: 'de',
    label: '德国',
    methodDays: { express: 5, air: 16, air_slow: 20, truck: 30, sea: 56 },
    selectedMethods: ['express', 'air', 'air_slow', 'truck', 'sea'],
  },
};

export interface PurchasePlanAutoReplenishConfig {
  algorithm_key?: AutoReplenishAlgorithmKey;
  plan_start_date?: string;
  shipping_buffer_days?: number;
  warehouse_name?: string;
  shipping_profile_key?: AutoReplenishShippingProfileKey;
  shipping_allocations: Partial<Record<AutoReplenishShippingMethodKey, number>>;
  manual_remark?: string;
}

export interface PurchasePlanAutoReplenishParseResult {
  matched: boolean;
  valid: boolean;
  version: 'v1' | '';
  raw_block: string;
  remark_hash: string;
  config: PurchasePlanAutoReplenishConfig;
  errors: string[];
}

const ALGORITHM_LABEL_MAP: Record<string, AutoReplenishAlgorithmKey> = {
  日均销量: 'daily_avg',
  日均单量: 'daily_avg',
  历史销量: 'history',
  搜索词趋势: 'trend',
  综合走势: 'combined',
  运营意向: 'operator_intent',
  运营意图: 'operator_intent',
  daily_avg: 'daily_avg',
  history: 'history',
  trend: 'trend',
  combined: 'combined',
  operator_intent: 'operator_intent',
};

const SHIPPING_PROFILE_LABEL_MAP: Record<string, AutoReplenishShippingProfileKey> = {
  默认: 'default',
  default: 'default',
  英国: 'uk',
  uk: 'uk',
  UK: 'uk',
  德国: 'de',
  de: 'de',
  DE: 'de',
};

const SHIPPING_METHOD_LABEL_MAP: Record<string, AutoReplenishShippingMethodKey> = {
  快递: 'express',
  express: 'express',
  空快: 'air',
  air: 'air',
  空慢: 'air_slow',
  air_slow: 'air_slow',
  卡车: 'truck',
  truck: 'truck',
  铁路: 'rail',
  rail: 'rail',
  海运: 'sea',
  sea: 'sea',
};

const PROFILE_METHODS: Record<AutoReplenishShippingProfileKey, AutoReplenishShippingMethodKey[]> =
  Object.fromEntries(
    Object.entries(AUTO_REPLENISH_SHIPPING_PROFILES).map(([key, profile]) => [
      key,
      profile.selectedMethods,
    ])
  ) as Record<AutoReplenishShippingProfileKey, AutoReplenishShippingMethodKey[]>;

export function getAutoReplenishRemarkMetadata() {
  return {
    algorithms: AUTO_REPLENISH_ALGORITHMS.map(item => ({ ...item })),
    shipping_methods: AUTO_REPLENISH_SHIPPING_METHODS.map(item => ({ ...item })),
    shipping_profiles: Object.values(AUTO_REPLENISH_SHIPPING_PROFILES).map(profile => ({
      key: profile.key,
      label: profile.label,
      methods: [...profile.selectedMethods],
      method_days: { ...profile.methodDays },
    })),
  };
}

function normalizeText(value: any) {
  return String(value ?? '').trim();
}

function normalizeAsciiKey(value: any) {
  return normalizeText(value).replace(/\s+/g, '');
}

function emptyResult(): PurchasePlanAutoReplenishParseResult {
  return {
    matched: false,
    valid: false,
    version: '',
    raw_block: '',
    remark_hash: '',
    config: {
      shipping_allocations: {},
    },
    errors: [],
  };
}

function findRemarkBlock(remark: string) {
  const startIndex = remark.indexOf(AUTO_REPLENISH_REMARK_START);
  if (startIndex < 0) return null;
  const contentStart = startIndex + AUTO_REPLENISH_REMARK_START.length;
  const endIndex = remark.indexOf(AUTO_REPLENISH_REMARK_END, contentStart);
  if (endIndex < 0) {
    return {
      rawBlock: remark.slice(contentStart),
      missingEnd: true,
    };
  }
  return {
    rawBlock: remark.slice(contentStart, endIndex),
    missingEnd: false,
  };
}

function splitFirstKeyValue(part: string) {
  const match = part.match(/^([^=：:]+)[=：:](.*)$/);
  if (!match) {
    return null;
  }
  return {
    key: normalizeAsciiKey(match[1]),
    value: normalizeText(match[2]),
  };
}

function parsePositiveInteger(value: string, label: string, errors: string[]) {
  const numberValue = Number(normalizeText(value));
  if (!Number.isInteger(numberValue) || numberValue < 0) {
    errors.push(`${label}必须是非负整数`);
    return null;
  }
  return numberValue;
}

function parseDateOnly(value: string, errors: string[]) {
  const text = normalizeText(value);
  if (!text) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    errors.push('计划开始必须是 yyyy-mm-dd 格式');
    return '';
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    errors.push('计划开始不是有效日期');
    return '';
  }
  return text;
}

function parseShippingAllocationText(
  value: string,
  allocations: Partial<Record<AutoReplenishShippingMethodKey, number>>,
  errors: string[]
) {
  const parts = normalizeText(value)
    .split(/[，,、]/)
    .map(item => item.trim())
    .filter(Boolean);

  for (const part of parts) {
    const pair = splitFirstKeyValue(part);
    if (!pair) {
      errors.push(`发货分配格式不正确: ${part}`);
      continue;
    }
    const methodKey = SHIPPING_METHOD_LABEL_MAP[pair.key];
    if (!methodKey) {
      errors.push(`不支持的运输方式: ${pair.key}`);
      continue;
    }
    const qty = parsePositiveInteger(pair.value, `${pair.key}发货数量`, errors);
    if (qty !== null) {
      allocations[methodKey] = qty;
    }
  }
}

function validateProfileMethods(
  profile: AutoReplenishShippingProfileKey | undefined,
  allocations: Partial<Record<AutoReplenishShippingMethodKey, number>>,
  errors: string[]
) {
  const profileKey = profile || 'default';
  const allowed = new Set(PROFILE_METHODS[profileKey] || PROFILE_METHODS.default);
  for (const methodKey of Object.keys(allocations) as AutoReplenishShippingMethodKey[]) {
    if (!allowed.has(methodKey)) {
      const label = Object.entries(SHIPPING_METHOD_LABEL_MAP).find(([, key]) => key === methodKey)?.[0] || methodKey;
      const profileLabel = profileKey === 'uk' ? '英国' : profileKey === 'de' ? '德国' : '默认';
      errors.push(`${profileLabel}配置不支持${label}`);
    }
  }
}

export function parsePurchasePlanAutoReplenishRemark(
  remark: any
): PurchasePlanAutoReplenishParseResult {
  const text = normalizeText(remark);
  const block = findRemarkBlock(text);
  if (!block) {
    return emptyResult();
  }

  const errors: string[] = [];
  if (block.missingEnd) {
    errors.push(`缺少结束标记 ${AUTO_REPLENISH_REMARK_END}`);
  }

  const rawBlock = block.rawBlock.trim();
  const config: PurchasePlanAutoReplenishConfig = {
    shipping_allocations: {},
  };

  const segments = rawBlock
    .split(/[；;\n\r]+/)
    .map(item => item.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const pair = splitFirstKeyValue(segment);
    if (!pair) {
      errors.push(`无法识别的配置项: ${segment}`);
      continue;
    }

    const { key, value } = pair;
    if (key === '算法' || key === '计算方式') {
      const algorithm = ALGORITHM_LABEL_MAP[normalizeText(value)];
      if (!algorithm) {
        errors.push(`算法不支持: ${value}`);
      } else {
        config.algorithm_key = algorithm;
      }
      continue;
    }

    if (key === '计划开始' || key === '起算日') {
      const date = parseDateOnly(value, errors);
      if (date) config.plan_start_date = date;
      continue;
    }

    if (key === '缓冲天数' || key === '缓冲') {
      const days = parsePositiveInteger(value, '缓冲天数', errors);
      if (days !== null) config.shipping_buffer_days = days;
      continue;
    }

    if (key === '采购仓库' || key === '仓库') {
      config.warehouse_name = normalizeText(value);
      continue;
    }

    if (key === '运输配置') {
      const profile = SHIPPING_PROFILE_LABEL_MAP[normalizeText(value)];
      if (!profile) {
        errors.push(`运输配置不支持: ${value}`);
      } else {
        config.shipping_profile_key = profile;
      }
      continue;
    }

    if (key === '发货分配' || key === '运输' || key === '运输方式') {
      parseShippingAllocationText(value, config.shipping_allocations, errors);
      continue;
    }

    const shippingMethod = SHIPPING_METHOD_LABEL_MAP[key];
    if (shippingMethod) {
      const qty = parsePositiveInteger(value, `${key}发货数量`, errors);
      if (qty !== null) {
        config.shipping_allocations[shippingMethod] = qty;
      }
      continue;
    }

    if (key === '人工备注' || key === '备注') {
      config.manual_remark = normalizeText(value);
      continue;
    }

    errors.push(`不支持的配置项: ${key}`);
  }

  validateProfileMethods(config.shipping_profile_key, config.shipping_allocations, errors);

  if (!config.algorithm_key) {
    errors.push('缺少算法');
  }
  if (Object.keys(config.shipping_allocations).length === 0) {
    errors.push('缺少发货分配');
  }

  return {
    matched: true,
    valid: errors.length === 0,
    version: 'v1',
    raw_block: rawBlock,
    remark_hash: createHash('sha256').update(rawBlock).digest('hex'),
    config,
    errors,
  };
}
