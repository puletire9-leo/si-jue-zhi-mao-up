import { AppAmzBsrProductListingLingxingService } from '../bsr_product_Listing_Lingxing';

function createService(listings: any[], order: string[] = []) {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(listings),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    save: jest.fn(async (entity: any) => {
      order.push('save');
      return entity;
    }),
  };
  const lingXingUtils = {
    syncProductNameToLingXing: jest.fn(async () => {
      order.push('sync');
      return true;
    }),
  };
  const service: any = new AppAmzBsrProductListingLingxingService();
  service.bsrProductListingLingxingRepo = repo;
  service.lingXingUtils = lingXingUtils;

  return { service, repo, lingXingUtils };
}

describe('repairHyphenProductCodeLocalNames', () => {
  it('previews hyphen-prefixed local names without syncing or saving', async () => {
    const { service, repo, lingXingUtils } = createService([
      {
        id: 1,
        msku: 'MSKU-1',
        product_code: '2720',
        local_name: '2720-脚踝按摩器 新款黄盒 手腕足部按摩器_灰色充电2个装',
      },
    ]);

    const result = await service.repairHyphenProductCodeLocalNames({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: 1,
      status: 'preview',
      oldLocalName: '2720-脚踝按摩器 新款黄盒 手腕足部按摩器_灰色充电2个装',
      newLocalName: '2720_脚踝按摩器 新款黄盒 手腕足部按摩器_灰色充电2个装',
    });
    expect(lingXingUtils.syncProductNameToLingXing).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('syncs Lingxing before saving the normalized local name locally', async () => {
    const order: string[] = [];
    const listing = {
      id: 1,
      msku: 'MSKU-1',
      product_code: '',
      local_name: '2720-脚踝按摩器',
    };
    const { service, repo, lingXingUtils } = createService([listing], order);

    const result = await service.repairHyphenProductCodeLocalNames({ dryRun: false });

    expect(order).toEqual(['sync', 'save']);
    expect(lingXingUtils.syncProductNameToLingXing).toHaveBeenCalledWith(
      'MSKU-1',
      '2720_脚踝按摩器'
    );
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        product_code: '2720',
        local_name: '2720_脚踝按摩器',
      })
    );
    expect(result).toMatchObject({
      dryRun: false,
      total: 1,
      synced: 1,
      failed: 0,
    });
  });
});
