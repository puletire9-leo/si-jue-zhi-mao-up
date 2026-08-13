export interface Kuaidi100AutoNumberCandidate {
  lengthPre?: number;
  comCode: string;
  name: string;
}

export interface Kuaidi100AutoNumberResult {
  success: boolean;
  company_code: string;
  company_name: string;
  candidates: Kuaidi100AutoNumberCandidate[];
  return_code: string;
  message: string;
}

export function normalizeKuaidi100AutoNumberResult(response: any): Kuaidi100AutoNumberResult {
  if (Array.isArray(response)) {
    const candidates = response
      .map(item => ({
        lengthPre: Number(item?.lengthPre) || undefined,
        comCode: normalizeText(item?.comCode).toLowerCase(),
        name: normalizeText(item?.name),
      }))
      .filter(item => item.comCode && item.name);
    const first = candidates[0];
    if (first) {
      return {
        success: true,
        company_code: first.comCode,
        company_name: first.name,
        candidates,
        return_code: '200',
        message: 'ok',
      };
    }
    return buildFailure('NO_CANDIDATE', '未识别到快递公司', []);
  }

  return buildFailure(
    normalizeText(response?.returnCode || response?.status || 'UNKNOWN'),
    normalizeText(response?.message || '智能识别失败'),
    []
  );
}

function buildFailure(
  returnCode: string,
  message: string,
  candidates: Kuaidi100AutoNumberCandidate[]
): Kuaidi100AutoNumberResult {
  return {
    success: false,
    company_code: '',
    company_name: '',
    candidates,
    return_code: returnCode || 'UNKNOWN',
    message: message || '智能识别失败',
  };
}

function normalizeText(value: any) {
  return value === undefined || value === null ? '' : String(value).trim();
}
