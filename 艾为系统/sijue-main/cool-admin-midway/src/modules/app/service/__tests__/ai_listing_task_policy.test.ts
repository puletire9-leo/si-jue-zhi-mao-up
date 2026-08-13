import {
  buildAiListingTaskIdempotencyKey,
  buildAiListingTaskTargetKey,
  buildInitialLanguageStatus,
  ensureAiListingTaskPayloadValid,
  normalizeOnlyLanguages,
  normalizeRequestedLanguages,
  resolveDispatchRequestedLanguagesFromPurchaserItems,
  resolveRequiredLanguagesFromPurchaseRows,
  shouldRetry,
  validateReferenceCompetitorSelectionForLanguages,
} from '../ai_listing_task_policy';
import { AI_LISTING_TASK_TYPE } from '../../entity/ai_listing_task';
import {
  AI_LISTING_TASK_STATUS,
  isTransitionAllowed,
  stageByStatus,
} from '../ai_listing_task_status';

describe('ai listing task policy', () => {
  it('builds target key and idempotency key for simple variant', () => {
    const payload = {
      task_type: AI_LISTING_TASK_TYPE.SIMPLE_VARIANT,
      target_candidate_id: 123,
      target_amazon_account_id: '55',
      target_variant_ids: ['v2', 'v1'],
      country_code: 'uk',
      action: 'run',
    };
    expect(buildAiListingTaskTargetKey(payload)).toBe(
      'simple|candidate:123|account:55|country:uk'
    );
    expect(buildAiListingTaskIdempotencyKey(payload)).toBe(
      'aiListing|simple_variant|full|simple|candidate:123|account:55|country:uk|competitor|run'
    );
    expect(
      buildAiListingTaskIdempotencyKey({
        ...payload,
        task_mode: 'delta',
      })
    ).toBe(
      'aiListing|simple_variant|delta|simple|candidate:123|account:55|country:uk|v1,v2|competitor|run'
    );
    expect(
      buildAiListingTaskIdempotencyKey({
        ...payload,
        reference_source_type: 'manual_bullets',
        manual_reference_bullets: ['a', 'b', 'c', 'd', 'e'],
      })
    ).toBe(
      'aiListing|simple_variant|full|simple|candidate:123|account:55|country:uk|manual:a|b|c|d|e|run'
    );
  });

  it('rejects unsupported complex variant in current phase', () => {
    expect(() =>
      ensureAiListingTaskPayloadValid({
        task_type: AI_LISTING_TASK_TYPE.COMPLEX_VARIANT,
        target_candidate_id: 1,
        target_msku: 'A-1',
      })
    ).toThrow('complex_variant 暂未开放');
  });

  it('checks retry rule and transition guards', () => {
    expect(shouldRetry(1, 3)).toBe(true);
    expect(shouldRetry(3, 3)).toBe(false);
    expect(
      isTransitionAllowed(
        AI_LISTING_TASK_STATUS.QUEUED,
        AI_LISTING_TASK_STATUS.FAILED
      )
    ).toBe(true);
    expect(
      isTransitionAllowed(
        AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING,
        AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RETRYING
      )
    ).toBe(true);
    expect(
      isTransitionAllowed(
        AI_LISTING_TASK_STATUS.SUCCEEDED,
        AI_LISTING_TASK_STATUS.KEYWORD_SCORING_RUNNING
      )
    ).toBe(true);
  });

  it('normalizes only_languages without forcing en', () => {
    expect(normalizeOnlyLanguages(['de'])).toEqual(['de']);
    expect(normalizeOnlyLanguages(['en', 'de'])).toEqual(['en', 'de']);
  });

  it('normalizes requested languages without forcing en', () => {
    expect(normalizeRequestedLanguages(['de'])).toEqual(['de']);
    expect(normalizeRequestedLanguages(['en'])).toEqual(['en']);
    expect(normalizeRequestedLanguages([])).toEqual([]);
    expect(buildInitialLanguageStatus(['en'])).toEqual({
      en: 'pending',
      de: 'skipped',
    });
  });

  it('validates manual bullet payloads', () => {
    expect(() =>
      ensureAiListingTaskPayloadValid({
        task_type: AI_LISTING_TASK_TYPE.SIMPLE_VARIANT,
        target_candidate_id: 1,
        target_amazon_account_id: 'acc',
        target_variant_ids: ['v1'],
        country_code: 'uk',
        reference_source_type: 'manual_bullets',
        manual_reference_bullets: ['1', '2', '3'],
      })
    ).toThrow('manual_reference_bullets 必须传 5 条');
  });

  it('allows empty competitor selection and only rejects counts above four', () => {
    expect(
      validateReferenceCompetitorSelectionForLanguages(
        { uk: [], de: [] },
        ['en', 'de']
      )
    ).toEqual([]);
    expect(
      validateReferenceCompetitorSelectionForLanguages(
        { uk: ['A', 'B', 'C', 'D', 'E'], de: [] } as any,
        ['en']
      )
    ).toEqual(['英国参考竞品已选 5 条（最多 4 条）']);
  });

  it('ignores purchaser rows with empty seller_account_id when scoped to a shop', () => {
    const rows = [
      { seller_account_id: null, uk: 200, de: 400 },
      { seller_account_id: '', uk: 250, de: 250 },
      { seller_account_id: '6837', uk: 1, de: 0 },
    ];
    expect(resolveRequiredLanguagesFromPurchaseRows(rows, '6837')).toEqual([
      'en',
    ]);
    expect(resolveRequiredLanguagesFromPurchaseRows(rows)).toEqual([
      'en',
      'de',
    ]);
  });

  it('resolves dispatch languages from purchaser rows', () => {
    const purchasers = [
      {
        is_generate: 2,
        seller_account_id: 'acc1',
        selectedVariantId: 'v1',
        purchaserNum: { uk: 10, de: 0 },
      },
      {
        is_generate: 2,
        seller_account_id: 'acc1',
        selectedVariantId: 'v2',
        purchaserNum: { uk: 0, de: 3 },
      },
    ];
    expect(
      resolveDispatchRequestedLanguagesFromPurchaserItems(
        purchasers,
        'acc1',
        ['v1']
      )
    ).toEqual(['en']);
    expect(
      resolveDispatchRequestedLanguagesFromPurchaserItems(
        purchasers,
        'acc1',
        ['v2']
      )
    ).toEqual(['de']);
    expect(
      resolveDispatchRequestedLanguagesFromPurchaserItems(
        [
          {
            is_generate: 2,
            seller_account_id: 'acc2',
            selectedVariantId: 'v9',
            purchaserNum: { uk: 0, de: 0 },
          },
        ],
        'acc2',
        ['v9']
      )
    ).toEqual([]);
  });

  it('maps status to stage names', () => {
    expect(stageByStatus(AI_LISTING_TASK_STATUS.QUEUED)).toBe('queued');
    expect(stageByStatus(AI_LISTING_TASK_STATUS.LANGGRAPH_RUNNING)).toBe(
      'langgraph_running'
    );
    expect(stageByStatus(AI_LISTING_TASK_STATUS.SUCCEEDED)).toBe('succeeded');
    expect(stageByStatus(AI_LISTING_TASK_STATUS.FAILED)).toBe('failed');
  });
});
