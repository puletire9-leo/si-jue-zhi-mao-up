export const RESTORE_ARCHIVED_CANDIDATE_FLAGS = [
  '_restoreArchivedCandidate',
  'restoreArchivedCandidate',
  'restore_archived_candidate',
] as const;

export function normalizeCandidateAsin(value: any): string {
  return String(value ?? '').trim().toUpperCase();
}

export function normalizeCandidateMarketplace(value: any): string {
  return String(value ?? '').trim();
}

export function candidateIdentityKey(item: any): string {
  return `${normalizeCandidateMarketplace(item?.marketplace)}|${normalizeCandidateAsin(item?.asin)}`;
}

export function wantsArchivedCandidateRestore(item: any): boolean {
  return RESTORE_ARCHIVED_CANDIDATE_FLAGS.some(flag => item?.[flag] === true);
}

export function shouldRestoreArchivedCandidate(item: any, existingRecord: any): boolean {
  return Number(existingRecord?.status) === 5 && wantsArchivedCandidateRestore(item);
}

export function stripArchivedCandidateRestoreFlags<T extends Record<string, any>>(item: T): T {
  const cleanItem = { ...item };
  RESTORE_ARCHIVED_CANDIDATE_FLAGS.forEach(flag => {
    delete cleanItem[flag];
  });
  return cleanItem;
}
