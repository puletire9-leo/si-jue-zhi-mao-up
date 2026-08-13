const {
  containsForbiddenFactLeak,
  createReferenceFacts,
  finalizeBulletPlans,
} = require('../ai_listing_graph/bullet-plan');

describe('bullet plan helpers', () => {
  it('builds competitor facts with stable ids', () => {
    const facts = createReferenceFacts({
      reference_source_type: 'competitor',
      competitor_bullet_points: [
        ['Soft silicone material', 'Quiet desk toy'],
        ['Giftable box packaging'],
      ],
    });

    expect(facts.map((fact: any) => fact.id)).toEqual([
      'competitor_1_1',
      'competitor_1_2',
      'competitor_2_1',
    ]);
  });

  it('computes forbidden fact ids and resolved refs for sibling plans', () => {
    const facts = createReferenceFacts({
      reference_source_type: 'competitor',
      competitor_bullet_points: [
        ['Soft silicone material', 'Quiet desk toy'],
        ['Giftable box packaging'],
      ],
    });

    const plans = finalizeBulletPlans(
      [
        {
          title: 'Soft Touch',
          scope: 'Focus on the soft silicone feel',
          fact_ids: ['competitor_1_1'],
        },
        {
          title: 'Desk Relief',
          scope: 'Focus on quiet desk use',
          fact_ids: ['competitor_1_2'],
        },
      ],
      facts
    );

    expect(plans[0]).toEqual(
      expect.objectContaining({
        ref: ['Soft silicone material'],
        forbidden_fact_ids: ['competitor_1_2'],
        forbidden_refs: ['Quiet desk toy'],
      })
    );
    expect(plans[1]).toEqual(
      expect.objectContaining({
        ref: ['Quiet desk toy'],
        forbidden_fact_ids: ['competitor_1_1'],
        forbidden_refs: ['Soft silicone material'],
      })
    );
  });

  it('detects forbidden fact leakage without blocking allowed facts', () => {
    expect(
      containsForbiddenFactLeak(
        'This desk toy stays quiet during office use and helps reduce fidget noise.',
        ['Quiet desk toy'],
        ['Soft silicone material']
      )
    ).toBe(true);

    expect(
      containsForbiddenFactLeak(
        'The soft silicone material feels smooth and resilient in your hand.',
        ['Quiet desk toy'],
        ['Soft silicone material']
      )
    ).toBe(false);
  });
});
