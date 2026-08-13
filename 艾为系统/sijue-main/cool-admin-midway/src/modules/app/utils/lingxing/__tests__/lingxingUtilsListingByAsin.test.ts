import { LingXingUtils } from '../lingxingUtils';

describe('LingXingUtils.requestLingXingListingByAsin', () => {
  it('requests every crawler listing page by asin and filters non-matching rows', async () => {
    const utils: any = new LingXingUtils();
    utils.getLingxingDataFetchMode = jest.fn(async () => 1);
    utils.getListing = jest.fn()
      .mockResolvedValueOnce(JSON.stringify({
        code: 1,
        data: {
          total: 201,
          list: [
            { asin: 'B000TEST', is_delete: 0, msku: 'MSKU-1' },
            { asin: 'B000OTHER', is_delete: 0 },
            { asin: 'B000TEST', is_delete: 1 },
          ],
        },
      }))
      .mockResolvedValueOnce(JSON.stringify({
        code: 1,
        data: {
          total: 201,
          list: [
            { asin: 'B000TEST', is_delete: 0, msku: 'MSKU-2' },
          ],
        },
      }));

    const result = await utils.requestLingXingListingByAsin(' b000test ');

    expect(utils.getListing).toHaveBeenCalledWith(expect.objectContaining({
      offset: 0,
      search_field: 'asin',
      search_value: 'B000TEST',
      length: 200,
      status: '',
      is_delete: 0,
    }));
    expect(utils.getListing).toHaveBeenCalledWith(expect.objectContaining({
      offset: 200,
      search_value: 'B000TEST',
    }));
    expect(result).toEqual([
      { asin: 'B000TEST', is_delete: 0, msku: 'MSKU-1' },
      { asin: 'B000TEST', is_delete: 0, msku: 'MSKU-2' },
    ]);
  });
});
