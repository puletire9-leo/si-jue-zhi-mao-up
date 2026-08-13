import {
  MSKU_MAX_LENGTH,
  MSKU_SELLER_ABBR_MAX_LEN,
  AppAmzMskuService,
} from '../msku';

describe('MSKU code length budget', () => {
  it('seller abbr is capped at 12', () => {
    expect(MSKU_SELLER_ABBR_MAX_LEN).toBe(12);
  });

  it('base code with worst-case suffix stays within 40', () => {
    const svc = new AppAmzMskuService();
    const code = svc.generateMskuCode(
      '超长店铺名称'.repeat(20),
      '产品名称也很长',
      '变体名称同样很长'
    );
    expect(code.length).toBeLessThanOrEqual(33);
    expect(`${code}-99`.length).toBeLessThanOrEqual(MSKU_MAX_LENGTH);
  });
});
