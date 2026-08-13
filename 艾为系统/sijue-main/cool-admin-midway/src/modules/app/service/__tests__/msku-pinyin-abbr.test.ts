import { mskuPinyinAbbr, mskuSanitizeNameInput } from '../msku';

describe('mskuPinyinAbbr', () => {
  it('strips punctuation and parentheses before abbr', () => {
    expect(mskuSanitizeNameInput('红色(L码)')).toBe('红色L码');
    expect(mskuPinyinAbbr('红色(L码)', 5)).toBe(mskuPinyinAbbr('红色L码', 5));
    expect(mskuPinyinAbbr('商品【大号】', 5)).toMatch(/^[A-Z0-9]+$/);
    expect(mskuPinyinAbbr('商品【大号】', 5)).toBe(mskuPinyinAbbr('商品大号', 5));
  });

  it('keeps digits, strips other symbols', () => {
    expect(mskuSanitizeNameInput('M[【92橙色+3P香薰')).toBe('M92橙色3P香薰');
    expect(mskuPinyinAbbr('店铺-名称(测试)&100%', 12)).toBe(
      mskuPinyinAbbr('店铺名称100', 12)
    );
  });

  it('latin store name keeps digits', () => {
    expect(mskuPinyinAbbr('UK:9 FERGAL FLYNN LTD', 12)).toBe('UK9FERGALFLY');
  });
});
