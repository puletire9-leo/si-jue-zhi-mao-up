import {
  buildCandidateProductSetSizeFields,
  buildCandidatePurchasePlanApiItem,
  extractCandidateErpSupplierId,
  buildCandidateRegularPurchasePlanSources,
  buildCandidateSamplePurchasePlanSources,
  buildCandidatePlanSupplierQuotes,
  hasExistingCandidatePurchasePlan,
} from '../bsr_candidate_purchase_plan_helpers';

describe('bsr_candidate_purchase_plan_helpers', () => {
  it('does not let an existing sample plan block a regular purchase plan', () => {
    const existingPlans = [
      {
        type: 2,
        lingxing_sku: 'SKU-001',
        store_id: '',
        plan_sn: 'YP-001',
      },
    ];

    expect(
      hasExistingCandidatePurchasePlan(existingPlans, {
        type: 1,
        lingxing_sku: 'SKU-001',
        store_id: '4981',
      })
    ).toBe(false);
  });

  it('detects an existing regular plan only when type, sku, and store all match', () => {
    const existingPlans = [
      {
        type: 1,
        lingxing_sku: 'SKU-001',
        store_id: '4981',
        plan_sn: 'CG-001',
      },
    ];

    expect(
      hasExistingCandidatePurchasePlan(existingPlans, {
        type: 1,
        lingxing_sku: 'SKU-001',
        store_id: '4981',
      })
    ).toBe(true);
    expect(
      hasExistingCandidatePurchasePlan(existingPlans, {
        type: 1,
        lingxing_sku: 'SKU-001',
        store_id: '4982',
      })
    ).toBe(false);
  });

  it('separates regular plan identities by purchaser record', () => {
    const existingPlans = [
      {
        type: 1,
        lingxing_sku: 'SKU-001',
        store_id: '4981',
        purchaser_record_id: 101,
        plan_sn: 'CG-001',
      },
    ];

    expect(
      hasExistingCandidatePurchasePlan(existingPlans, {
        type: 1,
        lingxing_sku: 'SKU-001',
        store_id: '4981',
        purchaser_record_id: 101,
      })
    ).toBe(true);
    expect(
      hasExistingCandidatePurchasePlan(existingPlans, {
        type: 1,
        lingxing_sku: 'SKU-001',
        store_id: '4981',
        purchaser_record_id: 102,
      })
    ).toBe(false);
  });

  it('treats a matching saved plan without plan_sn as existing', () => {
    const existingPlans = [
      {
        type: 2,
        lingxing_sku: 'SKU-SAMPLE',
        store_id: '',
        plan_sn: '',
      },
    ];

    expect(
      hasExistingCandidatePurchasePlan(existingPlans, {
        type: 2,
        lingxing_sku: 'SKU-SAMPLE',
        store_id: '',
      })
    ).toBe(true);
  });

  it('builds regular purchase plan sources per purchaser record without merging quantities', () => {
    const variantMap = new Map<string, any>([
      ['10', { id: 10, sku: 'SKU-A', name: 'Variant A' }],
    ]);
    const purchasers = [
      {
        id: 101,
        selected_variant_id: 10,
        seller_account_id: 'STORE-1',
        account_name: 'Account 1',
        purchaserNum: { uk: 2, de: 3 },
      },
      {
        id: 102,
        selected_variant_id: 10,
        seller_account_id: 'STORE-1',
        account_name: 'Account 1',
        purchaserNum: JSON.stringify({ uk: 7, de: 0 }),
      },
    ];

    expect(
      buildCandidateRegularPurchasePlanSources(purchasers, variantMap, 'FALLBACK').map(source => ({
        purchaserRecordId: source.purchaserRecordId,
        lingxingSku: source.lingxingSku,
        storeId: source.storeId,
        ukNum: source.ukNum,
        deNum: source.deNum,
        totalQty: source.totalQty,
      }))
    ).toEqual([
      {
        purchaserRecordId: '101',
        lingxingSku: 'SKU-A',
        storeId: 'STORE-1',
        ukNum: 2,
        deNum: 3,
        totalQty: 5,
      },
      {
        purchaserRecordId: '102',
        lingxingSku: 'SKU-A',
        storeId: 'STORE-1',
        ukNum: 7,
        deNum: 0,
        totalQty: 7,
      },
    ]);
  });

  it('builds at most one sample purchase plan source per Lingxing SKU', () => {
    const variantMap = new Map<string, any>([
      ['10', { id: 10, sku: 'SKU-SAME', name: 'Variant A' }],
      ['11', { id: 11, sku: 'SKU-SAME', name: 'Variant B' }],
    ]);
    const purchasers = [
      { id: 101, selected_variant_id: 10 },
      { id: 102, selected_variant_id: 11 },
    ];

    expect(buildCandidateSamplePurchasePlanSources(purchasers, variantMap, 'FALLBACK')).toEqual([
      {
        variantId: '10',
        lingxingSku: 'SKU-SAME',
        variantName: 'Variant A',
      },
    ]);
  });

  it('maps saved candidate size data to Lingxing product set fields', () => {
    expect(buildCandidateProductSetSizeFields({
      length: '12.30',
      width: 8,
      height: '4.50',
      actual_weight: '0.75',
    })).toEqual({
      cg_product_length: '12.3',
      cg_product_width: '8',
      cg_product_height: '4.5',
      cg_product_net_weight: '750',
      cg_product_gross_weight: '750',
      cg_package_length: '12.3',
      cg_package_width: '8',
      cg_package_height: '4.5',
    });
  });
  it('falls back to the primary factory-link supplier when variant proportions are empty', () => {
    const factoryLinkMap = new Map<string, any>([
      [
        'link-main',
        {
          supplierSKU: 'A10001',
          user_input: 'https://detail.1688.com/offer/1.html',
          price: 3.25,
          isFirst: true,
        },
      ],
      [
        'link-pack',
        {
          supplierSKU: 'B10002',
          user_input: 'https://detail.1688.com/offer/2.html',
          price: 0.5,
          isFirst: false,
        },
      ],
    ]);

    const supplierQuotes = buildCandidatePlanSupplierQuotes({}, factoryLinkMap);

    expect(supplierQuotes).toHaveLength(2);
    expect(buildCandidatePurchasePlanApiItem({
      sku: 'SKU-001',
      quantity_plan: 10,
      supplierQuotes,
    })).toMatchObject({
      sku: 'SKU-001',
      quantity_plan: 10,
      supplier_id: 'A10001',
    });
  });

  it('allows creating a candidate purchase plan without supplier when no supplier exists', () => {
    expect(buildCandidatePurchasePlanApiItem({
      sku: 'SKU-001',
      quantity_plan: 10,
      supplierQuotes: [],
    })).toEqual({
      sku: 'SKU-001',
      quantity_plan: 10,
    });
  });

  it('binds created ERP supplier id to the purchase plan item', () => {
    expect(buildCandidatePurchasePlanApiItem({
      sku: 'SKU-001',
      quantity_plan: 10,
      supplierQuotes: [
        {
          supplier_id: 'A10001',
          erp_supplier_id: 88991,
          is_primary: 1,
        },
      ],
    })).toMatchObject({
      supplier_id: 88991,
    });
  });

  it('extracts nested Lingxing ERP supplier id from supplier edit responses', () => {
    expect(extractCandidateErpSupplierId({
      code: 0,
      data: [{ erp_supplier_id: 88991 }],
    })).toBe(88991);
  });
  it('builds normalized supplier quotes from variant factory-link proportions', () => {
    const factoryLinkMap = new Map<string, any>([
      [
        'link-main',
        {
          supplierSKU: 'A10001',
          user_input: 'https://detail.1688.com/offer/1.html',
          price: 3.25,
          isFirst: true,
        },
      ],
      [
        'link-pack',
        {
          supplierSKU: 'B10002',
          user_input: 'https://detail.1688.com/offer/2.html',
          price: 0.5,
          isFirst: false,
        },
      ],
    ]);

    expect(
      buildCandidatePlanSupplierQuotes(
        {
          'link-main': 1,
          'link-pack': 1,
        },
        factoryLinkMap
      )
    ).toEqual([
      {
        supplier_id: 'A10001',
        supplier_product_url: ['https://detail.1688.com/offer/1.html'],
        is_primary: 1,
        quotes: [
          {
            currency: 'CNY',
            is_tax: 0,
            tax_rate: '0',
            step_prices: [{ moq: 1, price_with_tax: 3.25 }],
          },
        ],
      },
      {
        supplier_id: 'B10002',
        supplier_product_url: ['https://detail.1688.com/offer/2.html'],
        is_primary: 0,
        quotes: [
          {
            currency: 'CNY',
            is_tax: 0,
            tax_rate: '0',
            step_prices: [{ moq: 1, price_with_tax: 0.5 }],
          },
        ],
      },
    ]);
  });
});
