import {
  capitalizeFirstWord,
  formatBulletPoint,
  normalizeBulletPointCapitalization,
} from '../ai_listing_graph/bullet-point-format';

describe('bullet-point-format', () => {
  it('capitalizes the first letter of the body', () => {
    expect(capitalizeFirstWord('this mask helps')).toBe('This mask helps');
    expect(capitalizeFirstWord('This mask helps')).toBe('This mask helps');
  });

  it('skips leading punctuation before the first letter', () => {
    expect(capitalizeFirstWord('"this mask helps"')).toBe('"This mask helps"');
  });

  it('formats bullet point with subtitle prefix', () => {
    expect(formatBulletPoint('Easy Setup', 'you can install in minutes')).toBe(
      '【Easy Setup】You can install in minutes'
    );
  });

  it('normalizes full bullet point strings', () => {
    expect(
      normalizeBulletPointCapitalization('【Premium Quality】crafted with care')
    ).toBe('【Premium Quality】Crafted with care');
  });
});
