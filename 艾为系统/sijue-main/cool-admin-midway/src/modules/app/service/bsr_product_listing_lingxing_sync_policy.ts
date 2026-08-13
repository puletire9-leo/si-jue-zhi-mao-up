export const isLingxingListingDeleted = (rawItem: Record<string, any>) => {
  const value = rawItem?.is_delete ?? rawItem?.isDelete;
  return String(value ?? '').trim() === '1';
};

export const shouldPersistLingxingListing = (rawItem: Record<string, any>) =>
  !isLingxingListingDeleted(rawItem);

export const shouldRunLingxingListingBusinessFlow = (listing: { status?: number }) =>
  Number(listing?.status) === 1;

