import { AppAmzBsrProductListingLingxingEntity } from '../../entity/bsr_product_Listing_Lingxing';
import { AppAmzBsrRestockingCenterLingxingEntity } from '../../entity/bsr_restocking_center_lingxing';
import { AppAmzBsrProductListingLingxingService } from '../bsr_product_Listing_Lingxing';
import { ListingStatus } from '../../utils/lingxing/lingxingUtils';

describe('AppAmzBsrProductListingLingxingService.syncListingDataByAsin', () => {
  function createListing(msku: string, price: number) {
    const parsed = new AppAmzBsrProductListingLingxingEntity();
    Object.assign(parsed, {
      asin: 'B000TEST',
      marketplace: 'UK',
      seller_name: 'Store A',
      msku,
      status: ListingStatus.ON_SALE,
      listing_price: price,
      rank: [99],
      small_rank: [9],
      stars: [4.5],
      reviews_num: [10],
    });
    return parsed;
  }

  function createService() {
    const rawItems = [
      { asin: 'B000TEST', marketplace: 'UK', seller_name: 'Store A', msku: 'MSKU-1', is_delete: 0 },
      { asin: 'B000TEST', marketplace: 'UK', seller_name: 'Store A', msku: 'MSKU-2', is_delete: 0 },
    ];
    const parsedItems = [createListing('MSKU-1', 12.5), createListing('MSKU-2', 13.5)];
    const existing = Object.assign(new AppAmzBsrProductListingLingxingEntity(), {
      id: 123,
      asin: 'B000TEST',
      marketplace: 'UK',
      seller_name: 'Store A',
      msku: 'MSKU-1',
      rule_nearly_30_days: 'nearly',
      rule_history_month: '2026-06',
      listing_price_history: [11],
      rank: [88],
      small_rank: [8],
      stars: [4.4],
      reviews_num: [9],
    });

    const manager = {
      find: jest.fn(async (entityClass, options) => {
        if (entityClass === AppAmzBsrRestockingCenterLingxingEntity) {
          return [];
        }
        if (options?.where?.msku === 'MSKU-1') {
          return [existing];
        }
        return [];
      }),
      save: jest.fn(async value => value),
    };
    const queryRunner = {
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      manager,
    };
    const repo = {
      manager: {
        connection: {
          createQueryRunner: jest.fn(() => queryRunner),
        },
      },
    };
    const lingXingUtils = {
      requestLingXingListingByAsin: jest.fn(async () => rawItems),
      parseListingData: jest.fn(() => parsedItems.shift()),
      updateInventoryStatus: jest.fn(),
    };

    const service: any = new AppAmzBsrProductListingLingxingService();
    service.bsrProductListingLingxingRepo = repo;
    service.lingXingUtils = lingXingUtils;
    return { service, lingXingUtils, manager, queryRunner };
  }

  it('fetches all Lingxing listings by asin and saves every matching local row', async () => {
    const { service, lingXingUtils, manager, queryRunner } = createService();

    const result = await service.syncListingDataByAsin(' b000test ');

    expect(lingXingUtils.requestLingXingListingByAsin).toHaveBeenCalledWith('B000TEST');
    expect(manager.save).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ id: 123, msku: 'MSKU-1', listing_price_history: [12.5, 11] }),
      expect.objectContaining({ msku: 'MSKU-2', listing_price_history: [13.5] }),
    ]));
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
    expect(result).toMatchObject({
      success: true,
      asin: 'B000TEST',
      fetched: 2,
      saved: 2,
      ids: [123],
    });
    expect(result.listings).toHaveLength(2);
  });
});
