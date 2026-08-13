import {
  buildLingxingSellerMap,
  normalizeLingxingListingOpenApiItem,
  normalizeLingxingRestockingOpenApiItem,
  normalizeLingxingSourceListItem,
} from '../lingxingOpenApiMapper';

describe('lingxingOpenApiMapper', () => {
  const sellerMap = buildLingxingSellerMap([
    {
      sid: 1001,
      name: 'UK Shop',
      account_name: 'UK Account',
      country: 'UK',
      region: 'EU',
      marketplace_id: 'A1F83G8C2ARO7P',
    },
  ]);

  it('normalizes Listing OpenAPI rows to the crawler listing shape', () => {
    const row = normalizeLingxingListingOpenApiItem(
      {
        sid: 1001,
        seller_sku: 'MSKU-001',
        fnsku: 'FNSKU-001',
        asin: 'B001',
        item_name: 'Test listing',
        local_sku: 'LOCAL-001',
        local_name: '100001_Test',
        marketplace: 'UK',
        listing_price: '19.99',
        price: '21.99',
        seller_brand: 'Brand From API',
        seller_rank: 12345,
        review_num: 88,
        last_star: 4.6,
        open_date_display: '2025-01-02 03:04:05',
      },
      sellerMap
    );

    expect(row.store_id).toBe(1001);
    expect(row.msku).toBe('MSKU-001');
    expect(row.seller_name).toBe('UK Shop');
    expect(row.shop).toBe('UK Account');
    expect(row.marketplace_id).toBe('A1F83G8C2ARO7P');
    expect(row.product_brand_text).toBe('Brand From API');
    expect(row.listing_price).toBe('19.99');
    expect(row.list_price).toBe('19.99');
    expect(row.fba_fee).toBeNull();
    expect(row.referral_fee).toBeNull();
    expect(row.rank).toBe(12345);
    expect(row.reviews_num).toBe(88);
    expect(row.stars).toBe(4.6);
    expect(row.open_date_time).toBe('2025-01-02 03:04:05');
  });

  it('normalizes restocking summary rows to the crawler restocking shape', () => {
    const row = normalizeLingxingRestockingOpenApiItem(
      {
        basic_info: {
          hash_id: 'hash-001',
          data_type: 1,
          node_type: 1,
          sid: 1001,
          asin: 'B001',
          msku_fnsku_list: [{ msku: 'MSKU-001', fnsku: 'FNSKU-001' }],
          listing_opentime_list: ['2025-01-02 03:04:05'],
          sync_time: '2026-06-04 10:00:00',
        },
        amazon_quantity_info: {
          amazon_quantity_valid: 5,
          amazon_quantity_shipping: 7,
          amazon_quantity_shipping_plan: 2,
        },
        scm_quantity_info: {
          sc_quantity_local_valid: 3,
          sc_quantity_purchase_shipping: 4,
          sc_quantity_purchase_plan: 6,
        },
        sales_info: {
          sales_avg_3: 1.23,
          sales_avg_7: 2.34,
          sales_avg_14: 3.45,
          sales_avg_30: 4.56,
          sales_total_3: 4,
          sales_total_7: 16,
          sales_total_14: 48,
          sales_total_30: 137,
        },
        suggest_info: {
          quantity_sug_purchase: 9,
          sug_date_purchase: '2026-06-10',
        },
        item_list: [],
      },
      sellerMap
    );

    expect(row.basicInfo.hashId).toBe('hash-001');
    expect(row.basicInfo.relationListing).toEqual([{ msku: 'MSKU-001', fnsku: 'FNSKU-001' }]);
    expect(row.displayInfo.asin).toBe('B001');
    expect(row.displayInfo.storeList).toEqual(['UK Shop']);
    expect(row.displayInfo.marketplaceList).toEqual(['UK', 'EU']);
    expect(row.displayInfo.listingOpenTimeList).toEqual(['2025-01-02 03:04:05']);
    expect(row.amazonQuantityInfo.amazonQuantityValid).toBe(5);
    expect(row.amazonQuantityInfo.amazonQuantityShipping).toBe(7);
    expect(row.scmQuantityInfo.scQuantityLocalValid).toBe(3);
    expect(row.scmQuantityInfo.scQuantityPurchaseShipping).toBe(4);
    expect(row.scmQuantityInfo.scQuantityPurchasePlan).toBe(6);
    expect(row.salesInfo.salesAvg3).toBe(1.23);
    expect(row.salesInfo.salesAvg7).toBe(2.34);
    expect(row.salesInfo.salesAvg14).toBe(3.45);
    expect(row.salesInfo.salesAvg30).toBe(4.56);
    expect(row.salesInfo.salesTotal3).toBe(4);
    expect(row.salesInfo.salesTotal7).toBe(16);
    expect(row.salesInfo.salesTotal14).toBe(48);
    expect(row.salesInfo.salesTotal30).toBe(137);
    expect(row.suggestInfo.quantitySugPurchase).toBe(9);
  });

  it('normalizes SourceList rows to existing detail list rows', () => {
    const fbaShipping = normalizeLingxingSourceListItem({
      type: 2,
      quantity: 12,
      expect_arrive_time: '2026-06-12',
      remark: { shipment_id: 'FBA17ABC' },
    });
    const localValid = normalizeLingxingSourceListItem({
      type: 3,
      quantity: 8,
      remark: { warehouse_name: 'Local WH', sku: 'LOCAL-001', fnsku: 'FNSKU-001' },
    });
    const purchasePlan = normalizeLingxingSourceListItem({
      type: 6,
      quantity: 4,
      remark: { plan_sn: 'PP-001', msku: 'MSKU-001' },
    });

    expect(fbaShipping.orderType).toBe(2);
    expect(fbaShipping.orderSn).toBe('FBA17ABC');
    expect(fbaShipping.shippingOrderSn).toBe('FBA17ABC');
    expect(fbaShipping.expectArriveDate).toBe('2026-06-12');
    expect(localValid.warehouseName).toBe('Local WH');
    expect(localValid.sku).toBe('LOCAL-001');
    expect(purchasePlan.orderSn).toBe('PP-001');
    expect(purchasePlan.msku).toBe('MSKU-001');
  });
});
