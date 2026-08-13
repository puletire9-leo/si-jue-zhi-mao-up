import {
  AI_LISTING_PREFLIGHT_MIN_KEYWORDS,
  validateAiListingPreflight,
} from '../ai_listing_preflight';

describe('ai listing preflight', () => {
  const baseInput = {
    ukKeywordCount: AI_LISTING_PREFLIGHT_MIN_KEYWORDS,
    deKeywordCount: AI_LISTING_PREFLIGHT_MIN_KEYWORDS,
    ukCompetitorCount: 1,
    deCompetitorCount: 1,
    variantIds: ['v1'],
    variants: [{ id: 'v1', name: '红色', description: '红色款描述' }],
    referenceSourceType: 'competitor' as const,
    manualReferenceBullets: [],
  };

  it('passes full mode when all prerequisites are met', () => {
    expect(validateAiListingPreflight(baseInput, { mode: 'full' })).toEqual({
      ok: true,
    });
  });

  it('passes full mode when only en required and de is insufficient', () => {
    expect(
      validateAiListingPreflight(
        {
          ...baseInput,
          ukKeywordCount: AI_LISTING_PREFLIGHT_MIN_KEYWORDS,
          deKeywordCount: 0,
          deCompetitorCount: 0,
        },
        { mode: 'full', requiredLanguages: ['en'] }
      )
    ).toEqual({ ok: true });
  });

  it('passes full mode when only de required and uk is insufficient', () => {
    expect(
      validateAiListingPreflight(
        {
          ...baseInput,
          ukKeywordCount: 0,
          ukCompetitorCount: 0,
          deKeywordCount: AI_LISTING_PREFLIGHT_MIN_KEYWORDS,
        },
        { mode: 'full', requiredLanguages: ['de'] }
      )
    ).toEqual({ ok: true });
  });

  it('fails full mode when uk/de keywords or competitors are insufficient', () => {
    const result = validateAiListingPreflight(
      {
        ...baseInput,
        ukKeywordCount: 12,
        deKeywordCount: 29,
        ukCompetitorCount: 0,
        deCompetitorCount: 0,
      },
      { mode: 'full' }
    );
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.message).toContain('前置校验失败');
      expect(result.message).toContain('英国关键词 12/>= 30');
      expect(result.message).toContain('德国关键词 29/>= 30');
      expect(result.message).toContain('英国竞品 0 条');
      expect(result.message).toContain('德国竞品 0 条');
    }
  });

  it('passes full mode with force_low_keywords when uk/de counts are at least 3', () => {
    expect(
      validateAiListingPreflight(
        {
          ...baseInput,
          ukKeywordCount: 3,
          deKeywordCount: 10,
        },
        { mode: 'full', forceLowKeywords: true }
      )
    ).toEqual({ ok: true });
  });

  it('fails full mode with force_low_keywords when keyword count is below 3', () => {
    const result = validateAiListingPreflight(
      {
        ...baseInput,
        ukKeywordCount: 3,
        deKeywordCount: 2,
      },
      { mode: 'full', forceLowKeywords: true }
    );
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.message).toContain('德国关键词 2/>= 3');
    }
  });

  it('skips keyword and competitor checks in delta mode', () => {
    const result = validateAiListingPreflight(
      {
        ...baseInput,
        ukKeywordCount: 0,
        deKeywordCount: 0,
        ukCompetitorCount: 0,
        deCompetitorCount: 0,
      },
      { mode: 'delta' }
    );
    expect(result).toEqual({ ok: true });
  });

  it('passes manual bullet mode without competitors when five bullets are provided', () => {
    expect(
      validateAiListingPreflight(
        {
          ...baseInput,
          ukCompetitorCount: 0,
          deCompetitorCount: 0,
          referenceSourceType: 'manual_bullets',
          manualReferenceBullets: ['卖点1', '卖点2', '卖点3', '卖点4', '卖点5'],
        },
        { mode: 'full' }
      )
    ).toEqual({ ok: true });
  });

  it('fails manual bullet mode when keywords are insufficient', () => {
    const result = validateAiListingPreflight(
      {
        ...baseInput,
        ukKeywordCount: 0,
        deKeywordCount: 0,
        ukCompetitorCount: 0,
        deCompetitorCount: 0,
        referenceSourceType: 'manual_bullets',
        manualReferenceBullets: ['卖点1', '卖点2', '卖点3', '卖点4', '卖点5'],
      },
      { mode: 'full' }
    );
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.message).toContain('英国关键词 0/>= 30');
      expect(result.message).toContain('德国关键词 0/>= 30');
      expect(result.message).not.toContain('竞品');
    }
  });

  it('fails manual bullet mode when a bullet is missing', () => {
    const result = validateAiListingPreflight(
      {
        ...baseInput,
        ukCompetitorCount: 0,
        deCompetitorCount: 0,
        referenceSourceType: 'manual_bullets',
        manualReferenceBullets: ['卖点1', '卖点2', '', '卖点4', '卖点5'],
      },
      { mode: 'full' }
    );
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.message).toContain('人工卖点第 3 条为空');
    }
  });

  it('fails when variant name or description is missing', () => {
    const result = validateAiListingPreflight(
      {
        ...baseInput,
        variantIds: ['v1', 'v2'],
        variants: [
          { id: 'v1', name: '', description: '有描述' },
          { id: 'v2', name: '蓝色', description: '   ' },
        ],
      },
      { mode: 'delta' }
    );
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.message).toContain('缺少名称');
      expect(result.message).toContain('缺少描述');
    }
  });
});
