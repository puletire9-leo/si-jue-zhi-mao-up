import { describe, expect, it } from "vitest";
import { getAllModules } from "./index";

describe("module registry", () => {
  it("does not expose the retired lingxing product-performance page", () => {
    expect(getAllModules().map((item) => item.id)).not.toContain(
      "lingxing-performance",
    );
  });
});
