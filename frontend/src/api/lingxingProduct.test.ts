import { beforeEach, describe, expect, it, vi } from "vitest";

const requestMock = vi.hoisted(() => vi.fn());

vi.mock("@/utils/request", () => ({
  default: requestMock,
}));

import { lingxingProductApi } from "./lingxingProduct";

describe("lingxingProductApi", () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  it("rejects business errors instead of silently returning undefined", async () => {
    requestMock.mockResolvedValue({
      code: 500,
      message: "overview failed",
      data: null,
    });

    await expect(lingxingProductApi.getOverview()).rejects.toThrow(
      "overview failed",
    );
  });

  it("sends credentials in the JSON request body", async () => {
    requestMock.mockResolvedValue({ code: 200, message: "ok", data: null });

    await lingxingProductApi.updateCredentials({
      appId: "app-id",
      appSecret: "secret-value",
    });

    expect(requestMock).toHaveBeenCalledWith({
      url: "/api/v1/modules/lingxing/credentials",
      method: "post",
      data: { appId: "app-id", appSecret: "secret-value" },
    });
  });

  it("updates a baseline with only the five editable fields", async () => {
    const updated = { asin: "B000TEST" };
    requestMock.mockResolvedValue({ code: 200, message: "ok", data: updated });

    await lingxingProductApi.updateBaseline("B000TEST", {
      developer: "蒋舒",
      listingTags: "绿标",
      modelStartMonth: "2026-07",
      modelStartBasis: "FBA 首次可售",
      analysisStatus: "正常",
    });

    expect(requestMock).toHaveBeenCalledWith({
      url: "/api/v1/modules/lingxing/baseline/B000TEST",
      method: "post",
      data: {
        developer: "蒋舒",
        listingTags: "绿标",
        modelStartMonth: "2026-07",
        modelStartBasis: "FBA 首次可售",
        analysisStatus: "正常",
      },
    });
  });
});
