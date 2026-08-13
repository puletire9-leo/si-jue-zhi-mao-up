import {
  BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY,
  BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY_EXHAUSTED,
  buildExistingCompetitorRefreshPatch,
  resolveImageRetryAfterLowCompetitors,
} from '../bsr_candidate_workflow_helpers';

describe('bsr_candidate_workflow_helpers', () => {
  it('uses the next product image and jumps through 3-1 when UK has fewer than four competitors', () => {
    expect(
      resolveImageRetryAfterLowCompetitors({
        candidate: {
          image_url: 'https://img.example/main.jpg',
          image_url2: 'https://img.example/second.jpg',
          image_url3: 'https://img.example/third.jpg',
          aliyun_img: 'https://img.example/main.jpg',
        },
        countryCounts: { '英国': 3, '德国': 5 },
      })
    ).toEqual({
      shouldRetry: true,
      status: BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY,
      nextImageUrl: 'https://img.example/second.jpg',
      missingCountries: ['英国'],
    });
  });

  it('stays in 3-2 when competitors are missing and all available images have been tried', () => {
    expect(
      resolveImageRetryAfterLowCompetitors({
        candidate: {
          image_url: 'https://img.example/main.jpg',
          image_url2: 'https://img.example/second.jpg',
          aliyun_img: 'https://img.example/second.jpg',
        },
        countryCounts: { '英国': 2, '德国': 1 },
      })
    ).toEqual({
      shouldRetry: false,
      status: BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY_EXHAUSTED,
      nextImageUrl: null,
      missingCountries: ['英国', '德国'],
    });
  });

  it('continues the normal workflow when both UK and DE have at least four competitors', () => {
    expect(
      resolveImageRetryAfterLowCompetitors({
        candidate: {
          image_url: 'https://img.example/main.jpg',
          image_url2: 'https://img.example/second.jpg',
          aliyun_img: 'https://img.example/main.jpg',
        },
        countryCounts: { '英国': 4, '德国': 4 },
      })
    ).toEqual({
      shouldRetry: false,
      status: 3,
      nextImageUrl: null,
      missingCountries: [],
    });
  });

  it('clears stale scores when an image retry refreshes an existing competitor', () => {
    const now = new Date('2026-06-09T08:00:00.000Z');

    expect(
      buildExistingCompetitorRefreshPatch({
        rawPrice: '19.99',
        imageUrl: 'https://img.example/competitor.jpg',
        resetScores: true,
        now,
      })
    ).toEqual({
      price: '19.99',
      image_url: 'https://img.example/competitor.jpg',
      updateTime: now,
      similarity_score: null,
      title_hit_score: null,
      title_keywords: null,
      status: 3,
      inventory_status: '0',
    });
  });

  it('keeps score fields untouched on a normal competitor refresh', () => {
    const now = new Date('2026-06-09T08:00:00.000Z');

    expect(
      buildExistingCompetitorRefreshPatch({
        rawPrice: '19.99',
        imageUrl: 'https://img.example/competitor.jpg',
        resetScores: false,
        now,
      })
    ).toEqual({
      price: '19.99',
      image_url: 'https://img.example/competitor.jpg',
      updateTime: now,
    });
  });
});
