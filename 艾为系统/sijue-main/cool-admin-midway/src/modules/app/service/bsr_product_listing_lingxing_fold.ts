function normalizeGroupPart(value: any): string {
  return String(value ?? '').trim();
}

function getListingStoreKey(row: any): string {
  return normalizeGroupPart(
    row?.store_id ?? row?.seller_name ?? row?.shop ?? row?.store_name
  );
}

function getListingSelectionKey(row: any): string {
  const id = normalizeGroupPart(row?.id);
  if (id) return `listing:${id}`;

  return [
    'listing',
    normalizeGroupPart(row?.asin),
    normalizeGroupPart(row?.msku),
    normalizeGroupPart(row?.marketplace),
    getListingStoreKey(row),
  ].join(':');
}

export function buildLingxingParentGroupKey(row: any): string | null {
  const parentAsin = normalizeGroupPart(row?.parent_asin);
  if (!parentAsin) return null;

  return [
    parentAsin,
    normalizeGroupPart(row?.marketplace),
    getListingStoreKey(row),
  ].join('::');
}

function decorateListingRow(row: any, groupKey?: string, isChildRow = false): any {
  return {
    ...row,
    _selectionKey: getListingSelectionKey(row),
    _groupKey: groupKey,
    _isParentAggregate: false,
    _isChildRow: isChildRow,
  };
}

export function foldLingxingListingRows(rows: any[]): any[] {
  const source = Array.isArray(rows) ? rows : [];
  const groupedRows = new Map<string, any[]>();

  for (const row of source) {
    const groupKey = buildLingxingParentGroupKey(row);
    if (!groupKey) continue;
    const children = groupedRows.get(groupKey) || [];
    children.push(row);
    groupedRows.set(groupKey, children);
  }

  const emittedGroups = new Set<string>();
  const result: any[] = [];

  for (const row of source) {
    const groupKey = buildLingxingParentGroupKey(row);
    if (!groupKey) {
      result.push(decorateListingRow(row));
      continue;
    }
    if (emittedGroups.has(groupKey)) continue;

    emittedGroups.add(groupKey);
    const children = groupedRows.get(groupKey) || [];
    if (children.length <= 1) {
      result.push(decorateListingRow(row));
      continue;
    }

    const decoratedChildren = children.map(child =>
      decorateListingRow(child, groupKey, true)
    );
    const parentAsin = normalizeGroupPart(row?.parent_asin);
    result.push({
      asin: parentAsin,
      parent_asin: parentAsin,
      marketplace: row?.marketplace,
      store_id: row?.store_id,
      seller_name: row?.seller_name,
      shop: row?.shop,
      _selectionKey: `parent:${groupKey}`,
      _groupKey: groupKey,
      _isParentAggregate: true,
      _isChildRow: false,
      _children: decoratedChildren,
    });
  }

  return result;
}

export function paginateLingxingTopLevelRows(rows: any[], page: number, size: number) {
  const source = Array.isArray(rows) ? rows : [];
  const normalizedSize = Math.max(1, Number(size) || 20);
  const normalizedPage = Math.max(1, Number(page) || 1);
  const start = (normalizedPage - 1) * normalizedSize;

  return {
    list: source.slice(start, start + normalizedSize),
    pagination: {
      page: normalizedPage,
      size: normalizedSize,
      total: source.length,
    },
  };
}
