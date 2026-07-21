const AMAZON_IMAGE_HOSTS = [
  "m.media-amazon.com",
  "images-na.ssl-images-amazon.com",
  "images-eu.ssl-images-amazon.com",
];

/** Remove Amazon CDN resize modifiers so visual search receives the original image. */
export function normalizeAmazonSourceImageUrl(imageUrl: string): string {
  const normalized = imageUrl.trim().replace(/\\_/g, "_");
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }
  if (!AMAZON_IMAGE_HOSTS.includes(parsed.hostname.toLowerCase())) {
    return normalized;
  }
  return normalized.replace(
    /\.(?:_[^/?#]*_|\*[^/?#]*\*)\.(jpe?g|png|webp)(?=([?#]|$))/i,
    ".$1",
  );
}

export function buildAmazonImageSearchUrl(
  imageUrl: string,
  marketplace: string,
): string {
  if (!/^https?:\/\//i.test(imageUrl.trim())) return "";
  const sourceImage = normalizeAmazonSourceImageUrl(imageUrl);
  const market = marketplace.trim().toUpperCase();
  const endpoint =
    market === "DE"
      ? "https://www.amazon.de/shopthelook?q="
      : market === "US"
        ? "https://www.amazon.com/shopthelook?q="
        : "https://www.amazon.co.uk/stylesnap?q=";
  return endpoint + encodeURIComponent(sourceImage);
}
