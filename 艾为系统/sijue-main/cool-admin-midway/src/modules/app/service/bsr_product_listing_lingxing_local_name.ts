export interface NumberedLingxingLocalName {
  code: string;
  rest: string;
  separator: '_' | '-';
}

export function parseNumberedLingxingLocalName(
  localName: string
): NumberedLingxingLocalName | null {
  const match = String(localName || '').trim().match(/^(\d{1,4})([_-])(.+)$/);
  if (!match) return null;

  return {
    code: match[1],
    separator: match[2] as '_' | '-',
    rest: match[3],
  };
}

export function normalizeLingxingLocalNameWithProductCode(
  productCode: string,
  localName: string
): string {
  const normalizedProductCode = String(productCode || '').trim();
  const originalName = String(localName || '').trim();
  const parsed = parseNumberedLingxingLocalName(originalName);
  const nameBody = parsed ? parsed.rest : originalName;

  return `${normalizedProductCode}_${nameBody || ''}`;
}
