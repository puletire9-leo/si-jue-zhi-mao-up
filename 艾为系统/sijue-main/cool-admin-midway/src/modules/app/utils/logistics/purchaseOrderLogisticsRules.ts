import * as dayjs from 'dayjs';

export const PURCHASE_ORDER_LOGISTICS_STATUS_TEXT: Record<string, string> = {
  confirmed: '已确认收货',
  signed: '全部签收',
  partial_signed: '部分签收',
  partial_overtime_unsigned: '部分签收超时',
  in_transit: '在途',
  overtime_unsigned: '超时未签收',
  logistics_exception: '轨迹异常',
  pending_mapping: '待自动识别',
  identify_failed: '识别失败',
  phone_required: '缺少手机号',
  manual_required: '需人工判断',
  logistics_abnormal: '无物流异常',
  no_logistics: '暂无物流',
};

const KUAIDI100_EXCEPTION_STATES = new Set(['2', '4', '6', '7', '13', '14']);
const KUAIDI100_DELIVERING_STATES = new Set(['5']);
const KUAIDI100_IN_TRANSIT_STATES = new Set(['0', '1', '8', '10', '11', '12']);

export interface LogisticsPackageLike {
  id?: number;
  tracking_no?: string;
  query_mode?: string;
  company_code?: string;
  company_name?: string;
  raw_company_name?: string;
  status?: string;
  identify_status?: string;
  is_signed?: number | boolean;
  phone_required?: number | boolean;
  contact_phone?: string;
  next_query_after?: Date | string | null;
  manual_confirmed?: number | boolean;
}

export interface OrderLike {
  order_sn?: string;
  logistics_confirmed?: number | boolean;
  logistics_confirmed_time?: Date | string | null;
  create_time_remote?: Date | string | null;
  order_time?: Date | string | null;
}

export interface OrderLogisticsStatusResult {
  logistics_status: string;
  logistics_status_text: string;
  logistics_status_reason: string;
  logistics_pkg_count: number;
  logistics_signed_count: number;
  logistics_unsigned_count: number;
}

export function normalizeCompanyName(value: any): string {
  return String(value ?? '')
    .trim()
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function shouldRequirePhone(companyCode: string, needPhone?: any): boolean {
  if (needPhone !== undefined && needPhone !== null && needPhone !== '') {
    return Number(needPhone) === 1 || needPhone === true;
  }
  return false;
}

export function resolvePhoneStatus(phoneRequired: any, contactPhone: any): string {
  if (!(Number(phoneRequired) === 1 || phoneRequired === true)) {
    return 'not_required';
  }
  const phone = String(contactPhone ?? '').trim();
  if (!phone) return 'missing';
  return isLikelyContactPhone(phone) ? 'ok' : 'invalid';
}

export function isLikelyContactPhone(value: string): boolean {
  const cleaned = String(value || '').replace(/\s+/g, '');
  return /^[0-9\-]{4,30}$/.test(cleaned);
}

export function maskContactPhoneForViewer(
  phone: any,
  creatorUserId: any,
  currentUserId: any
): string {
  const value = String(phone ?? '').trim();
  if (!value) return '';
  if (
    creatorUserId !== undefined &&
    creatorUserId !== null &&
    currentUserId !== undefined &&
    currentUserId !== null &&
    Number(creatorUserId) === Number(currentUserId)
  ) {
    return value;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length >= 7) {
    return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
  }
  return `${value.slice(0, 1)}****`;
}

export function normalizeKuaidi100PackageStatus(response: any) {
  const state = String(response?.state ?? '');
  const ischeck = String(response?.ischeck ?? '');
  const traces = Array.isArray(response?.data) ? response.data : [];
  const latestTrace = traces[0] || null;
  const firstTrace = traces.length ? traces[traces.length - 1] : null;
  const latestTraceTime = parseLogisticsTime(
    latestTrace?.time || latestTrace?.ftime || latestTrace?.accept_time
  );
  const firstTraceTime = parseLogisticsTime(
    firstTrace?.time || firstTrace?.ftime || firstTrace?.accept_time
  );

  if (state === '3' || ischeck === '1') {
    return {
      status: 'signed',
      status_text: '全部签收',
      is_signed: 1,
      sign_time: latestTraceTime,
      first_trace_time: firstTraceTime,
      latest_trace_time: latestTraceTime,
    };
  }

  if (KUAIDI100_EXCEPTION_STATES.has(state)) {
    return {
      status: 'logistics_exception',
      status_text: '物流异常',
      is_signed: 0,
      sign_time: null,
      first_trace_time: firstTraceTime,
      latest_trace_time: latestTraceTime,
    };
  }

  if (KUAIDI100_DELIVERING_STATES.has(state)) {
    return {
      status: 'delivering',
      status_text: '派件中',
      is_signed: 0,
      sign_time: null,
      first_trace_time: firstTraceTime,
      latest_trace_time: latestTraceTime,
    };
  }

  if (KUAIDI100_IN_TRANSIT_STATES.has(state) || traces.length > 0) {
    return {
      status: 'in_transit',
      status_text: '在途',
      is_signed: 0,
      sign_time: null,
      first_trace_time: firstTraceTime,
      latest_trace_time: latestTraceTime,
    };
  }

  return {
    status: 'no_result',
    status_text: '暂无轨迹',
    is_signed: 0,
    sign_time: null,
    first_trace_time: null,
    latest_trace_time: null,
  };
}

export function canQueryLogisticsPackage(
  pkg: LogisticsPackageLike,
  now: Date = new Date()
): { allowed: boolean; reason: string; next_query_after?: Date | null } {
  const queryMode = String(pkg?.query_mode || '').trim();
  if (queryMode !== 'kuaidi100') {
    return { allowed: false, reason: queryMode || 'query_mode_required' };
  }
  if (!String(pkg?.tracking_no || '').trim()) {
    return { allowed: false, reason: 'missing_tracking_no' };
  }
  if (isPackageSigned(pkg)) {
    return { allowed: false, reason: 'signed' };
  }
  if (String(pkg?.identify_status || '').trim() === 'failed' && !String(pkg?.company_code || '').trim()) {
    return { allowed: false, reason: 'identify_failed' };
  }
  if (!String(pkg?.company_code || '').trim()) {
    return { allowed: false, reason: 'pending_mapping' };
  }
  const explicitPhoneStatus = String((pkg as any)?.phone_status || '').trim();
  const phoneStatus =
    Number(pkg?.phone_required) === 1 &&
    (explicitPhoneStatus === 'missing' || explicitPhoneStatus === 'invalid')
      ? explicitPhoneStatus
      : resolvePhoneStatus(pkg?.phone_required, pkg?.contact_phone);
  if (phoneStatus === 'missing') {
    return { allowed: false, reason: 'phone_required' };
  }
  if (phoneStatus === 'invalid') {
    return { allowed: false, reason: 'phone_invalid' };
  }

  const lastErrorCode = String((pkg as any)?.last_error_code || '').trim();
  const nextQueryAfter = parseLogisticsTime(pkg?.next_query_after);
  if (lastErrorCode !== '408' && nextQueryAfter && now.getTime() < nextQueryAfter.getTime()) {
    return { allowed: false, reason: 'cooldown', next_query_after: nextQueryAfter };
  }

  return { allowed: true, reason: 'ok', next_query_after: nextQueryAfter };
}

export function deriveOrderLogisticsStatus(input: {
  order: OrderLike;
  packages: LogisticsPackageLike[];
  now?: Date;
  overtimeDays?: number;
  noLogisticsDays?: number;
}): OrderLogisticsStatusResult {
  const order = input.order || {};
  const now = dayjs(input.now || new Date());
  const overtimeDays = Number(input.overtimeDays) || 7;
  const noLogisticsDays = Number(input.noLogisticsDays) || 3;
  const packages = Array.isArray(input.packages) ? input.packages : [];
  const effectivePackages = packages.filter(pkg => {
    const mode = String(pkg?.query_mode || '').trim();
    return mode !== 'ignored' && mode !== 'disabled';
  });
  const validPackages = effectivePackages.filter(pkg => {
    const mode = String(pkg?.query_mode || '').trim();
    return mode !== 'manual_required' && Boolean(String(pkg?.tracking_no || '').trim());
  });
  const signedCount = validPackages.filter(pkg => isPackageSigned(pkg)).length;
  const pkgCount = validPackages.length;
  const daysSinceCreate = getDaysSinceCreate(order, now);

  if (Number(order.logistics_confirmed) === 1 || order.logistics_confirmed === true) {
    return buildOrderStatus(
      'confirmed',
      '人工确认收货' +
        (order.logistics_confirmed_time
          ? `（${dayjs(order.logistics_confirmed_time).format('MM-DD HH:mm')}）`
          : ''),
      pkgCount,
      signedCount
    );
  }

  if (effectivePackages.some(pkg => String(pkg.status || '') === 'logistics_exception')) {
    return buildOrderStatus('logistics_exception', '存在异常物流包裹', pkgCount, signedCount);
  }

  if (
    effectivePackages.some(pkg => {
      const mode = String(pkg.query_mode || '').trim();
      return mode === 'kuaidi100' && !String(pkg.company_code || '').trim();
    })
  ) {
    return buildOrderStatus('pending_mapping', '存在未自动识别快递公司的包裹', pkgCount, signedCount);
  }

  if (
    effectivePackages.some(
      pkg =>
        String(pkg.query_mode || '').trim() === 'kuaidi100' &&
        ['missing', 'invalid'].includes(resolvePhoneStatus(pkg.phone_required, pkg.contact_phone))
    )
  ) {
    return buildOrderStatus('phone_required', '存在需要手机号但未填写或无效的包裹', pkgCount, signedCount);
  }

  if (effectivePackages.some(pkg => String(pkg.query_mode || '').trim() === 'manual_required')) {
    return buildOrderStatus('manual_required', '存在需人工判断的物流包裹', pkgCount, signedCount);
  }

  if (pkgCount > 0 && signedCount === pkgCount) {
    return buildOrderStatus('signed', `${signedCount}/${pkgCount}个包裹已签收`, pkgCount, signedCount);
  }

  if (pkgCount > 0 && signedCount > 0) {
    const status = daysSinceCreate > overtimeDays ? 'partial_overtime_unsigned' : 'partial_signed';
    return buildOrderStatus(
      status,
      `${signedCount}/${pkgCount}个包裹已签收，已创建${daysSinceCreate}天`,
      pkgCount,
      signedCount
    );
  }

  if (pkgCount > 0) {
    const status = daysSinceCreate > overtimeDays ? 'overtime_unsigned' : 'in_transit';
    return buildOrderStatus(
      status,
      `${pkgCount}个包裹未签收，已创建${daysSinceCreate}天`,
      pkgCount,
      signedCount
    );
  }

  if (daysSinceCreate > noLogisticsDays) {
    return buildOrderStatus(
      'logistics_abnormal',
      `已创建${daysSinceCreate}天，仍无有效物流包裹`,
      0,
      0
    );
  }

  return buildOrderStatus(
    'no_logistics',
    `已创建${daysSinceCreate}天，暂未录入有效物流`,
    0,
    0
  );
}

export function parseLogisticsTime(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toDate() : null;
}

function isPackageSigned(pkg: LogisticsPackageLike): boolean {
  return (
    Number(pkg.is_signed) === 1 ||
    pkg.is_signed === true ||
    String(pkg.status || '').trim() === 'signed'
  );
}

function getDaysSinceCreate(order: OrderLike, now: dayjs.Dayjs): number {
  const baseTime = order.create_time_remote || order.order_time;
  if (!baseTime) return 999;
  const parsed = dayjs(baseTime);
  if (!parsed.isValid()) return 999;
  return now.diff(parsed, 'day');
}

function buildOrderStatus(
  status: string,
  reason: string,
  pkgCount: number,
  signedCount: number
): OrderLogisticsStatusResult {
  return {
    logistics_status: status,
    logistics_status_text: PURCHASE_ORDER_LOGISTICS_STATUS_TEXT[status] || status,
    logistics_status_reason: reason,
    logistics_pkg_count: pkgCount,
    logistics_signed_count: signedCount,
    logistics_unsigned_count: Math.max(pkgCount - signedCount, 0),
  };
}
