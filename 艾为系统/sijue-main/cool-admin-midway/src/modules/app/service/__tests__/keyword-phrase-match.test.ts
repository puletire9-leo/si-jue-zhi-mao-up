import {
  canonicalKeywordKey,
  findMissingPhrases,
  isKeywordTokenSubset,
  isSameKeywordVariant,
  keywordsOverlapForSelection,
  normalizeListingText,
  textContainsPhrase,
} from '../ai_listing_graph/keyword-phrase-match';

describe('keyword-phrase-match', () => {
  it('normalizes hyphens and casing', () => {
    expect(normalizeListingText('Red-light Therapy')).toBe('red light therapy');
  });

  it('matches phrase across hyphen variants', () => {
    const title =
      'Red Light Therapy - Red-light Therapy, Infrared LED Light Therapy with Heat';
    expect(textContainsPhrase(title, 'red-light therapy')).toBe(true);
    expect(textContainsPhrase(title, 'led light therapy')).toBe(true);
    expect(textContainsPhrase(title, 'red light therapy')).toBe(true);
  });

  it('reports missing phrases', () => {
    const title = 'Red Light Therapy - LED mask';
    expect(findMissingPhrases(title, ['red light therapy', 'led light therapy'])).toEqual([
      'led light therapy',
    ]);
  });

  it('canonical key merges hyphen and word order variants', () => {
    expect(canonicalKeywordKey('red-light therapy')).toBe('light red therapy');
    expect(canonicalKeywordKey('red light therapy')).toBe('light red therapy');
    expect(canonicalKeywordKey('therapy red-light')).toBe('light red therapy');
  });

  it('canonical key does not merge compound vs spaced phrases', () => {
    expect(canonicalKeywordKey('white board')).toBe('board white');
    expect(canonicalKeywordKey('whiteboard')).toBe('whiteboard');
    expect(canonicalKeywordKey('white board')).not.toBe(canonicalKeywordKey('whiteboard'));
  });

  it('token subset treats dry-erase white board as containing white board', () => {
    expect(isKeywordTokenSubset('white board', 'dry-ease white board')).toBe(true);
    expect(isKeywordTokenSubset('dry-ease white board', 'white board')).toBe(false);
    expect(keywordsOverlapForSelection('white board', 'dry-ease white board')).toBe(true);
  });

  it('token subset does not merge white board with whiteboard', () => {
    expect(isKeywordTokenSubset('whiteboard', 'dry-ease white board')).toBe(false);
    expect(isKeywordTokenSubset('white board', 'whiteboard')).toBe(false);
    expect(keywordsOverlapForSelection('whiteboard', 'dry-ease white board')).toBe(false);
  });

  it('same variant detects canonical dup but not subset-only relation', () => {
    expect(isSameKeywordVariant('red-light therapy', 'red light therapy')).toBe(true);
    expect(isSameKeywordVariant('white board', 'dry-ease white board')).toBe(false);
  });
});
