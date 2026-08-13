export type LingxingSellerContext = {
  sid?: number | string;
  name?: string;
  account_name?: string;
  country?: string;
  region?: string;
  marketplace_id?: string;
};

export type LingxingSellerMap = Map<string, LingxingSellerContext>;

const isPlainObject = (value: any): value is Record<string, any> =>
  Object.prototype.toString.call(value) === '[object Object]';

const snakeToCamel = (key: string) =>
  key.replace(/_([a-zA-Z0-9])/g, (_match, letter: string) => letter.toUpperCase());

const deepCamelize = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(item => deepCamelize(item));
  }
  if (!isPlainObject(value)) {
    return value;
  }

  return Object.entries(value).reduce((result, [key, item]) => {
    result[snakeToCamel(key)] = deepCamelize(item);
    return result;
  }, {} as Record<string, any>);
};

const parseMaybeJson = (value: any) => {
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const asArray = (value: any): any[] => {
  if (value === null || value === undefined || value === '') {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const unique = (values: any[]) => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const text = value === null || value === undefined ? '' : String(value).trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
};

const toNumber = (value: any, fallback = 0) => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getSeller = (sellerMap?: LingxingSellerMap, sid?: any) => {
  if (!sellerMap || sid === null || sid === undefined || sid === '') {
    return undefined;
  }
  return sellerMap.get(String(sid));
};

const getSellerDisplayName = (seller?: LingxingSellerContext, fallback?: any) =>
  (seller?.name || seller?.account_name || fallback || '').toString().trim();

export const buildLingxingSellerMap = (
  sellers: Array<Record<string, any>> = []
): LingxingSellerMap => {
  const map: LingxingSellerMap = new Map();
  for (const seller of sellers) {
    if (seller?.sid === null || seller?.sid === undefined || seller?.sid === '') {
      continue;
    }
    map.set(String(seller.sid), seller as LingxingSellerContext);
  }
  return map;
};

export const normalizeLingxingListingOpenApiItem = (
  item: Record<string, any>,
  sellerMap?: LingxingSellerMap
): Record<string, any> => {
  const sid = item.sid ?? item.store_id;
  const seller = getSeller(sellerMap, sid);
  const listingPrice = item.listing_price ?? item.listPrice ?? null;
  const principals = asArray(item.principal_info ?? item.principal_list);
  const principalNames = unique(
    principals.map(principal => principal?.realname ?? principal?.name ?? principal?.principal_realname)
  );
  const principalUids = unique(
    principals.map(principal => principal?.uid ?? principal?.user_id ?? principal?.id)
  );
  const sellerName = getSellerDisplayName(seller, item.seller_name ?? item.shop ?? sid);

  return {
    ...item,
    store_id: toNumber(sid, 0),
    msku: item.msku ?? item.seller_sku ?? item.sellerSku ?? '',
    asin: item.asin ?? '',
    fnsku: item.fnsku ?? '',
    item_name: item.item_name ?? item.itemName ?? '',
    local_sku: item.local_sku ?? item.localSku ?? '',
    local_name: item.local_name ?? item.localName ?? '',
    marketplace: item.marketplace ?? seller?.country ?? seller?.region ?? '',
    marketplace_id: item.marketplace_id ?? seller?.marketplace_id ?? '',
    seller_name: sellerName,
    shop: item.shop ?? seller?.account_name ?? sellerName,
    seller_brand: item.seller_brand ?? '',
    product_brand_text: item.product_brand_text ?? item.seller_brand ?? '',
    seller_category: item.seller_category_new ?? item.seller_category ?? item.category_text ?? [],
    rank: item.rank ?? item.seller_rank ?? 0,
    reviews_num: item.reviews_num ?? item.review_num ?? 0,
    stars: item.stars ?? item.last_star ?? 0,
    listing_price: listingPrice,
    list_price: listingPrice,
    fba_fee: null,
    referral_fee: null,
    fba_fee_currency_code: '',
    referral_fee_currency_code: '',
    fba_fee_currency_icon: '',
    referral_fee_currency_icon: '',
    open_date_time: item.open_date_time ?? item.open_date_display ?? item.open_date ?? '',
    principal_list: item.principal_list ?? principals,
    principal_realname: item.principal_realname ?? principalNames.join(','),
    principal_uids: item.principal_uids ?? principalUids,
  };
};

const buildRelationListing = (basicInfo: Record<string, any>) => {
  if (Array.isArray(basicInfo.relationListing) && basicInfo.relationListing.length > 0) {
    return basicInfo.relationListing;
  }

  const source = asArray(basicInfo.mskuFnskuList);
  return source
    .map(item => ({
      msku: item?.msku ?? item?.sellerSku ?? item?.seller_sku ?? '',
      fnsku: item?.fnsku ?? '',
    }))
    .filter(item => item.msku || item.fnsku);
};

export const normalizeLingxingRestockingOpenApiItem = (
  item: Record<string, any>,
  sellerMap?: LingxingSellerMap
): Record<string, any> => {
  const basicInfo = deepCamelize(item.basic_info ?? item.basicInfo ?? {});
  const displayInfo = deepCamelize(item.display_info ?? item.displayInfo ?? {});
  const amazonQuantityInfo = deepCamelize(item.amazon_quantity_info ?? item.amazonQuantityInfo ?? {});
  const scmQuantityInfo = deepCamelize(item.scm_quantity_info ?? item.scmQuantityInfo ?? {});
  const stockQuantityInfo = deepCamelize(item.stock_quantity_info ?? item.stockQuantityInfo ?? {});
  const salesInfo = deepCamelize(item.sales_info ?? item.salesInfo ?? {});
  const suggestInfo = deepCamelize(item.suggest_info ?? item.suggestInfo ?? {});
  const extInfo = deepCamelize(item.ext_info ?? item.extInfo ?? {});
  const sid = basicInfo.sid ?? item.sid;
  const seller = getSeller(sellerMap, sid);
  const sellerName = getSellerDisplayName(seller, displayInfo.storeName ?? sid);
  const asin = basicInfo.asin ?? displayInfo.asin ?? item.asin ?? '';
  const listingOpenTimeList =
    displayInfo.listingOpenTimeList ??
    basicInfo.listingOpenTimeList ??
    basicInfo.listingOpentimeList ??
    [];
  const relationListing = buildRelationListing(basicInfo);
  const itemList = asArray(item.item_list ?? item.itemList).map(child =>
    normalizeLingxingRestockingOpenApiItem(child, sellerMap)
  );

  return {
    ...item,
    basicInfo: {
      ...basicInfo,
      hashId: basicInfo.hashId ?? item.hash_id ?? '',
      dataType: toNumber(basicInfo.dataType, 0),
      nodeType: toNumber(basicInfo.nodeType, 0),
      relationListing,
      syncTime: basicInfo.syncTime ?? item.sync_time ?? '',
    },
    displayInfo: {
      ...displayInfo,
      asin,
      asinList: displayInfo.asinList ?? (asin ? [asin] : []),
      parentAsinList: displayInfo.parentAsinList ?? asArray(basicInfo.parentAsinList),
      itemName: displayInfo.itemName ?? item.item_name ?? '',
      smallImageUrl: displayInfo.smallImageUrl ?? item.small_image_url ?? '',
      storeList: displayInfo.storeList ?? unique([sellerName]),
      marketplaceList: displayInfo.marketplaceList ?? unique([item.marketplace, seller?.country, seller?.region]),
      listingOpenTimeList: asArray(listingOpenTimeList),
      productList: displayInfo.productList ?? [],
      brandList: displayInfo.brandList ?? [],
      categoryList: displayInfo.categoryList ?? [],
      listingPrincipal: displayInfo.listingPrincipal ?? [],
      tagList: displayInfo.tagList ?? [],
    },
    amazonQuantityInfo,
    scmQuantityInfo,
    stockQuantityInfo,
    salesInfo,
    suggestInfo,
    extInfo,
    itemList,
  };
};

export const normalizeLingxingSourceListItem = (
  item: Record<string, any>
): Record<string, any> => {
  const remark = deepCamelize(parseMaybeJson(item.remark) || {});
  const row = deepCamelize(item || {});
  const orderSn =
    row.orderSn ??
    remark.shipmentId ??
    remark.purchaseOrderSn ??
    remark.planSn ??
    remark.overseasOrderNo ??
    remark.qcSn ??
    '';
  const type = toNumber(row.type ?? row.orderType, 0);

  return {
    ...row,
    ...remark,
    orderType: type,
    orderSn,
    quantity: toNumber(row.quantity, 0),
    quantitySecond: toNumber(row.quantitySecond, 0),
    expectArriveDate: row.expectArriveDate ?? row.expectArriveTime ?? '',
    amazonSaleDate: row.amazonSaleDate ?? '',
    fnsku: row.fnsku ?? remark.fnsku ?? '',
    msku: row.msku ?? remark.msku ?? '',
    sku: row.sku ?? remark.sku ?? '',
    warehouseName: row.warehouseName ?? remark.warehouseName ?? '',
    afnFulfillableQuantity: toNumber(row.afnFulfillableQuantity ?? remark.afnFulfillableQuantity, 0),
    reservedFcTransfers: toNumber(row.reservedFcTransfers ?? remark.reservedFcTransfers, 0),
    reservedFcProcessing: toNumber(row.reservedFcProcessing ?? remark.reservedFcProcessing, 0),
    shippingOrderSn: row.shippingOrderSn ?? remark.shipmentId ?? orderSn,
    logisticsChannelName: row.logisticsChannelName ?? remark.logisticsName ?? '',
    shipmentTime: row.shipmentTime ?? row.deliverTime ?? remark.deliverTime ?? '',
    shippingMethod: row.shippingMethod ?? '',
    shipment_status: row.shipment_status ?? row.shipmentStatus ?? null,
  };
};
