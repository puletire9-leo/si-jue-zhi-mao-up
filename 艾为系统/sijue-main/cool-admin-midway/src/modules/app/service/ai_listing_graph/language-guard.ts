const CJK_TEXT_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;

const CJK_LANGUAGE_HINT_RE =
  /\b(?:chinese|mandarin|cantonese|japanese|korean)\b|中文|汉语|漢語|日语|日文|日本語|韩语|韓語|한국어/iu;

export function targetLanguageDisallowsCjk(language: string): boolean {
  const normalized = String(language || '').trim();
  if (!normalized) return true;
  return !CJK_LANGUAGE_HINT_RE.test(normalized);
}

export function containsDisallowedTargetScript(
  text: string,
  language: string
): boolean {
  if (!targetLanguageDisallowsCjk(language)) return false;
  return CJK_TEXT_RE.test(String(text || ''));
}

export function pickCustomerFacingProductName(
  productName: string,
  produceName: string,
  language: string
): string {
  const customerFacing = String(productName || '').trim();
  if (customerFacing) return customerFacing;
  const internalName = String(produceName || '').trim();
  if (!internalName) return '';
  if (containsDisallowedTargetScript(internalName, language)) return '';
  return internalName;
}
