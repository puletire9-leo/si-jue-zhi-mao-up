export const BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_DONE = 3;
export const BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY = 31;
export const BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY_EXHAUSTED = 32;

const MIN_UK_DE_COMPETITORS = 4;
const REQUIRED_IMAGE_RETRY_COUNTRIES = ['英国', '德国'];
const CANDIDATE_IMAGE_FIELDS = [
  'image_url',
  'image_url2',
  'image_url3',
  'image_url4',
  'image_url5',
  'image_url6',
] as const;

type CandidateImageField = (typeof CANDIDATE_IMAGE_FIELDS)[number];

export type CandidateImageRetryCandidate = Partial<
  Record<CandidateImageField | 'aliyun_img', string | null | undefined>
>;

export type CandidateImageRetryDecision = {
  shouldRetry: boolean;
  status:
    | typeof BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_DONE
    | typeof BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY
    | typeof BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY_EXHAUSTED;
  nextImageUrl: string | null;
  missingCountries: string[];
};

export function resolveImageRetryAfterLowCompetitors({
  candidate,
  countryCounts,
}: {
  candidate: CandidateImageRetryCandidate;
  countryCounts: Record<string, number | string | null | undefined>;
}): CandidateImageRetryDecision {
  const missingCountries = REQUIRED_IMAGE_RETRY_COUNTRIES.filter(
    country => Number(countryCounts[country] || 0) < MIN_UK_DE_COMPETITORS
  );

  if (missingCountries.length === 0) {
    return {
      shouldRetry: false,
      status: BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_DONE,
      nextImageUrl: null,
      missingCountries,
    };
  }

  const imageUrls = CANDIDATE_IMAGE_FIELDS
    .map(field => normalizeImageUrl(candidate[field]))
    .filter((url): url is string => Boolean(url));
  const uniqueImageUrls = Array.from(new Set(imageUrls));
  const currentImageUrl = normalizeImageUrl(candidate.aliyun_img) || uniqueImageUrls[0] || '';
  const currentIndex = uniqueImageUrls.findIndex(url => url === currentImageUrl);
  const nextImageUrl = uniqueImageUrls[currentIndex >= 0 ? currentIndex + 1 : 1] || null;

  if (nextImageUrl) {
    return {
      shouldRetry: true,
      status: BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY,
      nextImageUrl,
      missingCountries,
    };
  }

  return {
    shouldRetry: false,
    status: BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_RETRY_EXHAUSTED,
    nextImageUrl: null,
    missingCountries,
  };
}

export function buildExistingCompetitorRefreshPatch({
  rawPrice,
  imageUrl,
  resetScores,
  now = new Date(),
}: {
  rawPrice: string;
  imageUrl: string | null | undefined;
  resetScores: boolean;
  now?: Date;
}) {
  const patch: Record<string, any> = {
    price: rawPrice,
    image_url: imageUrl,
    updateTime: now,
  };

  if (resetScores) {
    Object.assign(patch, {
      similarity_score: null,
      title_hit_score: null,
      title_keywords: null,
      status: BSR_CANDIDATE_COMPETITOR_STATUS_IMAGE_DONE,
      inventory_status: '0',
    });
  }

  return patch;
}

function normalizeImageUrl(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}
