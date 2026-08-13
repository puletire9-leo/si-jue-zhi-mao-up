import { AppAmzBsrCandidateService } from '../bsr_candidate';

describe('bsr candidate purchaser timeout workflow', () => {
  it('does not sync design tasks when pending purchasers expire', async () => {
    const service: any = new AppAmzBsrCandidateService();
    const entityManager = {
      find: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: 10,
            candidate_id: '99',
            purchaser: 'buyer-a',
            country_enabled: JSON.stringify({ uk: true, de: false }),
            decision_assigned_at: new Date('2026-06-01T00:00:00+08:00'),
          },
        ])
        .mockResolvedValueOnce([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    service.bsrCandidateRepo = {
      manager: {
        transaction: async (callback: any) => callback(entityManager),
      },
    };
    service.designTaskService = {
      syncForCandidate: jest.fn(),
    };

    const result = await service.autoExpirePendingPurchaserDecisions(
      new Date('2026-06-10T00:00:00+08:00')
    );

    expect(result).toEqual({
      expiredCount: 1,
      releasedCount: 0,
      releasedPurchasers: [],
    });
    expect(service.designTaskService.syncForCandidate).not.toHaveBeenCalled();
  });

  it('exposes a scheduler-friendly purchaser decision timeout workflow service', async () => {
    const service: any = new AppAmzBsrCandidateService();
    service.autoRemindPendingPurchaserDecisions = jest.fn().mockResolvedValue({
      remindedCount: 2,
      skippedCount: 1,
    });
    service.autoExpirePendingPurchaserDecisions = jest.fn().mockResolvedValue({
      expiredCount: 3,
      releasedCount: 2,
      releasedPurchasers: ['buyer-b', 'buyer-c'],
    });

    await expect(service.runPurchaserDecisionTimeoutWorkflow()).resolves.toEqual({
      remindedCount: 2,
      skippedReminderCount: 1,
      expiredCount: 3,
      releasedCount: 2,
      releasedPurchasers: ['buyer-b', 'buyer-c'],
    });
  });
});
