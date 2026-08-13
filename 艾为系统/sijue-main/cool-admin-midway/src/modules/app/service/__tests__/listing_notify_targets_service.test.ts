import { isOperatorRole } from '../listing_notify_targets_service';

describe('listing_notify_targets_service', () => {
  it('matches operator roles using the same role text convention as candidate3 notifications', () => {
    expect(isOperatorRole({ name: '运营', label: '' })).toBe(true);
    expect(isOperatorRole({ name: 'UK运营', label: '' })).toBe(true);
    expect(isOperatorRole({ name: '', label: 'operator' })).toBe(true);

    expect(isOperatorRole({ name: '采购', label: 'purchaser' })).toBe(false);
    expect(isOperatorRole({ name: '助理', label: 'assistant' })).toBe(false);
  });
});
