type LingxingStepPriceInput = {
  moq?: number;
  price_with_tax?: number | string | null;
};

type LingxingQuoteInput = {
  currency?: string;
  is_tax?: number;
  tax_rate?: string;
  step_prices?: LingxingStepPriceInput[];
};

type LingxingSupplierQuoteInput = {
  supplier_id: string | number;
  erp_supplier_id?: string | number | null;
  supplier_product_url?: unknown;
  is_primary?: number;
  quotes?: LingxingQuoteInput[];
};

function normalizeSupplierProductUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 20);
}

export function buildProductSetSupplierQuotes(
  supplierQuotes: LingxingSupplierQuoteInput[]
) {
  const requestedPrimaryIndex = supplierQuotes.findIndex(
    q => Number(q.is_primary) === 1
  );
  const primaryIndex = requestedPrimaryIndex >= 0 ? requestedPrimaryIndex : 0;

  return supplierQuotes.map((q, index) => {
    const firstQuote = q.quotes?.[0] || {};
    const firstStepPrice = firstQuote.step_prices?.[0] || {};
    const price = Number(firstStepPrice.price_with_tax) || 0;

    return {
      supplier_id: q.supplier_id,
      ...(q.erp_supplier_id ? { erp_supplier_id: q.erp_supplier_id } : {}),
      supplier_product_url: normalizeSupplierProductUrls(q.supplier_product_url),
      is_primary: index === primaryIndex ? 1 : 0,
      quotes: [
        {
          currency: firstQuote.currency || 'CNY',
          is_tax: firstQuote.is_tax ?? 0,
          tax_rate: firstQuote.tax_rate || '0',
          step_prices: [
            {
              moq: firstStepPrice.moq || 1,
              price_with_tax: price,
            },
          ],
        },
      ],
    };
  });
}
