import { normalizeLingxingLocalNameWithProductCode } from '../bsr_product_listing_lingxing_local_name';

describe('normalizeLingxingLocalNameWithProductCode', () => {
  it('replaces a numeric hyphen prefix with the normalized underscore prefix', () => {
    expect(
      normalizeLingxingLocalNameWithProductCode(
        '2720',
        '2720-脚踝按摩器 新款黄盒 手腕足部按摩器_灰色充电2个装'
      )
    ).toBe('2720_脚踝按摩器 新款黄盒 手腕足部按摩器_灰色充电2个装');
  });

  it('replaces an existing numeric underscore prefix', () => {
    expect(
      normalizeLingxingLocalNameWithProductCode('2720', '15_脚踝按摩器')
    ).toBe('2720_脚踝按摩器');
  });

  it('prepends the product code when there is no numeric prefix', () => {
    expect(
      normalizeLingxingLocalNameWithProductCode('2720', '脚踝按摩器')
    ).toBe('2720_脚踝按摩器');
  });
});
