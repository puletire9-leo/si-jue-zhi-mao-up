import {
  BSR_CANDIDATE_STATUS_RESERVED,
  buildReserveNotifyMessage,
  collectReserveImageUrls,
  normalizeReserveOperatorMobiles,
  shouldAutoReleaseReservedCandidate,
} from '../bsr_candidate_reserve_helpers';

describe('bsr_candidate_reserve_helpers', () => {
  it('uses status 7 for reserve candidates', () => {
    expect(BSR_CANDIDATE_STATUS_RESERVED).toBe(7);
  });

  it('keeps legacy reserve mobile parser exported for stale build contexts', () => {
    expect(
      normalizeReserveOperatorMobiles(' 13800138000, 13900139000，13800138000 ')
    ).toEqual(['13800138000', '13900139000']);
  });

  it('collects public variant images before candidate fallback images', () => {
    const images = collectReserveImageUrls(
      {
        image_url: 'https://example.com/main.jpg',
        aliyun_img: 'https://example.com/aliyun.jpg',
        variant_Combination: [
          { image_url: 'https://example.com/json-a.jpg' },
          { image_url: 'data:image/png;base64,abc' },
        ],
      },
      [
        { image_url: 'https://example.com/variant-a.jpg' },
        { image_url: 'https://example.com/variant-a.jpg' },
        { image_url: 'https://example.com/variant-b.png' },
      ],
      4
    );

    expect(images).toEqual([
      'https://example.com/variant-a.jpg',
      'https://example.com/variant-b.png',
      'https://example.com/json-a.jpg',
      'https://example.com/main.jpg',
    ]);
  });

  it('releases only after 24 hours from reserved_at', () => {
    const now = new Date('2026-06-08T12:00:00.000Z');
    expect(
      shouldAutoReleaseReservedCandidate('2026-06-07T11:59:59.000Z', now)
    ).toBe(true);
    expect(
      shouldAutoReleaseReservedCandidate('2026-06-07T12:00:01.000Z', now)
    ).toBe(false);
    expect(shouldAutoReleaseReservedCandidate(null, now)).toBe(false);
  });

  it('explains why reserve DingTalk notice was not sent', () => {
    expect(
      buildReserveNotifyMessage({
        notified: false,
        operatorProfileCount: 0,
        operatorPhoneCount: 0,
        operatorUserIds: [],
        dingtalkEnabled: true,
      })
    ).toContain('未找到运营角色用户');

    expect(
      buildReserveNotifyMessage({
        notified: false,
        operatorProfileCount: 2,
        operatorPhoneCount: 0,
        operatorUserIds: [],
        dingtalkEnabled: true,
      })
    ).toContain('运营用户未填写手机号');

    expect(
      buildReserveNotifyMessage({
        notified: false,
        operatorProfileCount: 1,
        operatorPhoneCount: 1,
        operatorUserIds: [],
        dingtalkEnabled: true,
      })
    ).toContain('运营用户手机号未匹配到钉钉用户');

    expect(
      buildReserveNotifyMessage({
        notified: false,
        operatorProfileCount: 1,
        operatorPhoneCount: 1,
        operatorUserIds: ['manager123'],
        dingtalkEnabled: false,
      })
    ).toContain('钉钉应用未配置或已禁用');
  });
});
