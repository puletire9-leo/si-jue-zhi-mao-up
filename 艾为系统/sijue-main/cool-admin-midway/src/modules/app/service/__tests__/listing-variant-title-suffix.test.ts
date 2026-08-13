import {
  assertVariantTitleSuffixRoundTrip,
  extractVariantTitleSuffix,
} from '../listing-variant-title-suffix';

describe('listing-variant-title-suffix', () => {
  const base = 'Product Title';

  it('extracts suffix with nested parentheses', () => {
    const full = `${base}(Red (Large))`;
    expect(extractVariantTitleSuffix(full, base)).toBe('Red (Large)');
  });

  it('round-trip passes for common parenthesis patterns', () => {
    for (const suffix of ['Red (Large)', '(XL)', 'Set (3 Pack)']) {
      expect(() =>
        assertVariantTitleSuffixRoundTrip(base, suffix, '德语')
      ).not.toThrow();
    }
  });
});
