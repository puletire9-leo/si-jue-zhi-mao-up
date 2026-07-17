import { describe, expect, it, vi } from "vitest";

vi.mock("vue-router", async (importOriginal) => importOriginal());

import router from "./index";

describe("router", () => {
  it("registers the lingxing import path exactly once", () => {
    const matches = router
      .getRoutes()
      .filter((route) => route.path === "/lingxing/import");

    expect(matches).toHaveLength(1);
  });
});
