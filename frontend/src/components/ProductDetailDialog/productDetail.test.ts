import { describe, expect, it } from "vitest";

import {
  cleanDetailValue,
  formatDetailInteger,
  formatDetailMoney,
  getDetailUnits,
  getDetailVariantCount,
  getDetailWeight,
  hasDetailValue,
  isPositiveDetailFlag,
} from "./productDetail";

describe("product detail normalization", () => {
  it("uses marketplace currency instead of a hard-coded symbol", () => {
    expect(formatDetailMoney(79.99, "UK")).toBe("£79.99");
    expect(formatDetailMoney(79.99, "DE")).toBe("€79.99");
    expect(formatDetailMoney(79.99, "US")).toBe("$79.99");
    expect(formatDetailMoney(-1, "UK")).toBe("—");
    expect(formatDetailMoney(-1, "UK", undefined, true)).toBe("-£1.00");
  });

  it("formats ranks exactly and recognizes false marker fields", () => {
    expect(formatDetailInteger(90144)).toBe("90,144");
    expect(isPositiveDetailFlag("N")).toBe(false);
    expect(isPositiveDetailFlag("0")).toBe(false);
    expect(isPositiveDetailFlag("Best Seller")).toBe(true);
  });

  it("keeps numeric zero while removing textual null values", () => {
    expect(hasDetailValue(0)).toBe(true);
    expect(cleanDetailValue(" null ")).toBeNull();
    expect(cleanDetailValue("undefined")).toBeNull();
  });

  it("prefers the real competitor fields and falls back to legacy aliases", () => {
    expect(getDetailUnits({ units: 0, salesVolume: 18 })).toBe(0);
    expect(getDetailUnits({ salesVolume: 18 })).toBe(18);
    expect(getDetailVariantCount({ variantCount: 6, variations: 2 })).toBe(6);
  });

  it("does not render textual null as a product weight", () => {
    expect(getDetailWeight({ weight: "null" })).toBe("—");
    expect(getDetailWeight({ weightG: 350, weight: "0.77 pounds" })).toBe(
      "350g / 0.77 pounds",
    );
  });
});
