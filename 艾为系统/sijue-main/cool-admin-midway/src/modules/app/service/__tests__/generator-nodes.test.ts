import { ReadableStream } from 'node:stream/web';

(globalThis as any).ReadableStream = (globalThis as any).ReadableStream || ReadableStream;

const {
  analyzeSearchVolume,
  buildBulletPlanValidationFeedback,
  buildLongTailNgramCandidates,
  validateDescriptionRoute,
} = require('../ai_listing_graph/nodes/generator-nodes');

describe('generator nodes', () => {
  it('builds 1-3 gram candidates from long-tail keywords only', () => {
    const candidates = buildLongTailNgramCandidates([
      { type: '核心大词', keyword: 'squishy cubes', search_volume: 1000 },
      { type: '核心词', keyword: 'stress ball', search_volume: 900 },
      { type: '长尾词', keyword: 'squishy cubes for kids', search_volume: 100 },
      { type: '长尾词', keyword: 'soft squishy cubes', search_volume: 50 },
    ]);

    expect(candidates.find(x => x.word === 'squishy')).toEqual(
      expect.objectContaining({
        ngram: 1,
        frequency: 2,
        search_volume: 150,
      })
    );
    expect(candidates.find(x => x.word === 'squishy cubes')).toEqual(
      expect.objectContaining({
        ngram: 2,
        frequency: 2,
        search_volume: 150,
      })
    );
    expect(candidates.some(x => x.word === 'stress ball')).toBe(false);
    expect(candidates.some(x => x.word === 'for')).toBe(false);
    expect(candidates.some(x => x.word === 'cubes for')).toBe(false);
  });

  it('does not double count search volume for repeated ngrams in one source', () => {
    const candidates = buildLongTailNgramCandidates([
      { type: '长尾词', keyword: 'squishy squishy cubes', search_volume: 100 },
    ]);

    expect(candidates.find(x => x.word === 'squishy')).toEqual(
      expect.objectContaining({
        frequency: 1,
        search_volume: 100,
      })
    );
  });

  it('absorbs modifier and scene substrings within the same type', () => {
    const result = analyzeSearchVolume({
      keywords: [
        { type: '长尾词', keyword: 'stress relief toy', search_volume: 100 },
        { type: '长尾词', keyword: 'relief toy', search_volume: 10 },
        { type: '长尾词', keyword: 'toy for kids', search_volume: 50 },
        { type: '长尾词', keyword: 'kids toy', search_volume: 20 },
      ],
      words_dict: [
        {
          source: 'stress relief toy',
          source_volumes: [{ source: 'stress relief toy', volume: 100 }],
          source_type: 'long tail',
          ngram: 2,
          words: [{ word: 'stress relief', type: 'modifier' }],
        },
        {
          source: 'relief toy',
          source_volumes: [{ source: 'relief toy', volume: 10 }],
          source_type: 'long tail',
          ngram: 1,
          words: [{ word: 'relief', type: 'modifier' }],
        },
        {
          source: 'toy for kids',
          source_volumes: [{ source: 'toy for kids', volume: 50 }],
          source_type: 'long tail',
          ngram: 2,
          words: [{ word: 'for kids', type: 'scene' }],
        },
        {
          source: 'kids toy',
          source_volumes: [{ source: 'kids toy', volume: 20 }],
          source_type: 'long tail',
          ngram: 1,
          words: [{ word: 'kids', type: 'scene' }],
        },
      ],
    } as any);

    expect(result.search_stats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          word: 'stress relief',
          type: 'modifier',
          search_volume: 110,
          frequency: 2,
        }),
        expect.objectContaining({
          word: 'for kids',
          type: 'scene',
          search_volume: 70,
          frequency: 2,
        }),
      ])
    );
    expect(result.search_stats.some(x => x.word === 'relief')).toBe(false);
    expect(result.search_stats.some(x => x.word === 'kids')).toBe(false);
  });

  it('keeps only top five 2-3 gram alternatives by score', () => {
    const result = analyzeSearchVolume({
      words_dict: Array.from({ length: 6 }, (_, idx) => ({
        source: `source ${idx}`,
        source_volumes: [{ source: `source ${idx}`, volume: 10 + idx }],
        source_type: 'long tail',
        ngram: 2,
        frequency: 1,
        words: [{ word: `alternative ${idx}`, type: 'alternative' }],
      })),
      frequency_weight: 0,
    } as any);

    const alternatives = result.search_stats.filter(x => x.type === 'alternative');
    expect(alternatives).toHaveLength(5);
    expect(alternatives[0]).toEqual(
      expect.objectContaining({
        word: 'alternative 5',
        search_volume: 15,
      })
    );
  });

  it('retries description when English output contains Chinese text', () => {
    expect(
      validateDescriptionRoute({
        language: 'English',
        description_retry_count: 0,
        description:
          'These squishies are soft and quiet for desks and travel.\nFuzz Ball Fidget Stress Toy (ERP: 新款毛球解压玩具) comes as one individually packed unit.',
        input: {
          variant_facts: [{ name: 'Blue', description: '7 x 6 cm' }],
        },
      } as any)
    ).toBe('retry');
  });

  it('flags bullet plan titles that violate target language', () => {
    expect(
      buildBulletPlanValidationFeedback(
        [
          {
            title: '动态海浪投影',
            scope: 'dynamic water ripple projection',
            fact_ids: ['competitor_1_1'],
          },
        ],
        'English',
        1
      )
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('title 必须使用 English'),
      ])
    );
  });
});
