import { describe, expect, it } from "vitest";
import {
  BASELINE_DEVELOPERS,
  BASELINE_STATUSES,
  buildMonthOptions,
  createLatestRequestGuard,
  normalizeBaselinePatch,
  statusTagType,
  tagVariant,
  validateBaselinePatch,
} from "./logic";

describe("lingxing baseline logic", () => {
  it("keeps pending elimination visually distinct from eliminated", () => {
    expect(tagVariant("待淘汰")).toBe("warning");
    expect(statusTagType("待淘汰")).toBe("warning");
    expect(statusTagType("淘汰")).toBe("danger");
  });

  it("builds month options from the supplied current month", () => {
    expect(buildMonthOptions(new Date(2026, 7, 1), 3)).toEqual([
      "2026-08",
      "2026-07",
      "2026-06",
    ]);
  });

  it("uses the documented eight-person development team", () => {
    expect(BASELINE_DEVELOPERS).toEqual([
      "蒋舒",
      "陈杨",
      "宋凤莉",
      "刘淼",
      "龙梦临",
      "周沁仪",
      "张子轩",
      "黄雨珊",
    ]);
  });

  it("rejects invalid model facts before submitting", () => {
    expect(
      validateBaselinePatch({
        developer: "于林",
        modelStartMonth: "2026-99",
        analysisStatus: "随便写",
      }),
    ).toEqual(["开发人不在团队名单中", "起算月格式不正确", "分析状态不合法"]);
  });

  it("accepts canonical editable values", () => {
    expect(
      validateBaselinePatch({
        developer: BASELINE_DEVELOPERS[0],
        modelStartMonth: "2026-07",
        analysisStatus: BASELINE_STATUSES[0],
      }),
    ).toEqual([]);
  });

  it("normalizes all five editable fields before submitting", () => {
    expect(
      normalizeBaselinePatch({
        developer: "  蒋舒  ",
        listingTags: "  绿标，待淘汰、绿标 ; ",
        modelStartMonth: " 2026-07 ",
        modelStartBasis: "  FBA 首次可售  ",
        analysisStatus: " 正常 ",
      }),
    ).toEqual({
      developer: "蒋舒",
      listingTags: "绿标,待淘汰",
      modelStartMonth: "2026-07",
      modelStartBasis: "FBA 首次可售",
      analysisStatus: "正常",
    });
  });

  it("validates editable text lengths", () => {
    expect(
      validateBaselinePatch({
        listingTags: "x".repeat(1001),
        modelStartBasis: "y".repeat(256),
      }),
    ).toEqual([
      "领星标签长度不能超过 1000 个字符",
      "起算依据长度不能超过 255 个字符",
    ]);
  });

  it("only treats the newest list request as current", () => {
    const guard = createLatestRequestGuard();
    const first = guard.begin();
    const second = guard.begin();

    expect(guard.isLatest(first)).toBe(false);
    expect(guard.isLatest(second)).toBe(true);
    expect(guard.finish(first)).toBe(false);
    expect(guard.finish(second)).toBe(true);
  });
});
