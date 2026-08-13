import {
  shouldPersistLingxingListing,
  shouldRunLingxingListingBusinessFlow,
} from '../bsr_product_listing_lingxing_sync_policy';
import { LingXingUtils, ListingStatus } from '../../utils/lingxing/lingxingUtils';

describe('bsr_product_listing_lingxing_sync_policy', () => {
  it('persists every Lingxing listing whose is_delete is not 1', () => {
    expect(shouldPersistLingxingListing({ is_delete: 0, status: 0, local_name: '' })).toBe(true);
    expect(shouldPersistLingxingListing({ is_delete: '0', status: 2, local_name: '' })).toBe(true);
    expect(shouldPersistLingxingListing({ isDelete: 0, status: 3, local_name: null })).toBe(true);
    expect(shouldPersistLingxingListing({ status: 0 })).toBe(true);
    expect(shouldPersistLingxingListing({ is_delete: 1, status: 1 })).toBe(false);
    expect(shouldPersistLingxingListing({ isDelete: '1', status: 0 })).toBe(false);
  });


  it('parses non-deleted raw listings even without product code or local name', () => {
    const utils = new LingXingUtils();
    const entity = utils.parseListingData({
      id: 123,
      store_id: 456,
      msku: 'amz-test-sku',
      asin: 'B000TEST',
      item_name: 'Office Product Sample',
      status: ListingStatus.STOP_SALE,
      is_delete: 0,
      local_name: '',
      marketplace: '英国',
      seller_name: 'Test Store',
    });

    expect(entity).not.toBeNull();
    expect(entity.msku).toBe('amz-test-sku');
    expect(entity.local_name).toBe('');
    expect(entity.product_code).toBeNull();
    expect(entity.status).toBe(ListingStatus.STOP_SALE);
  });

  it('runs downstream Lingxing listing business flow only for on-sale rows', () => {
    expect(shouldRunLingxingListingBusinessFlow({ status: ListingStatus.ON_SALE })).toBe(true);
    expect(shouldRunLingxingListingBusinessFlow({ status: ListingStatus.STOP_SALE })).toBe(false);
    expect(shouldRunLingxingListingBusinessFlow({ status: ListingStatus.DELETED })).toBe(false);
    expect(shouldRunLingxingListingBusinessFlow({ status: ListingStatus.ABNORMAL_OFFLINE })).toBe(false);
  });
});

