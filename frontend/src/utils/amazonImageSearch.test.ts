import { describe, expect, it } from "vitest";
import {
  buildAmazonImageSearchUrl,
  normalizeAmazonSourceImageUrl,
} from "./amazonImageSearch";

describe("amazonImageSearch", () => {
  it("removes Amazon US200 modifiers", () => {
    expect(
      normalizeAmazonSourceImageUrl(
        "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL._AC_US200_.jpg",
      ),
    ).toBe(
      "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL.jpg",
    );
  });

  it("handles crawler star modifiers and escaped underscores", () => {
    expect(
      normalizeAmazonSourceImageUrl(
        "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL.*AC\\_US200*.jpg",
      ),
    ).toBe(
      "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL.jpg",
    );
  });

  it("builds an encoded UK StyleSnap URL", () => {
    const result = buildAmazonImageSearchUrl(
      "https://m.media-amazon.com/images/I/example._AC_SL1500_.jpg",
      "UK",
    );
    expect(result).toBe(
      "https://www.amazon.co.uk/stylesnap?q=https%3A%2F%2Fm.media-amazon.com%2Fimages%2FI%2Fexample.jpg",
    );
  });
});
