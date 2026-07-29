import { describe, it, expect } from "vitest";
import { mergeSelectionResults } from "./mergeSelection";

describe("mergeSelectionResults", () => {
  it("按 score 降序合并两源,店铺无 score 回退 units", () => {
    const news = [{ asin: "A1", score: 90, dataSource: "new" as const }];
    const shops = [
      { asin: "S1", units: 100, dataSource: "shop" as const },
      { asin: "S2", units: 50, dataSource: "shop" as const },
    ];
    const out = mergeSelectionResults(news, shops, {
      sortField: "score",
      sortOrder: "desc",
    });
    expect(out.map((x) => x.asin)).toEqual(["S1", "A1", "S2"]);
  });

  it("跨源同 ASIN 去重,保留排序键更优者并合并来源", () => {
    const news = [{ asin: "X", score: 30, dataSource: "new" as const }];
    const shops = [{ asin: "X", units: 80, dataSource: "shop" as const }];
    const out = mergeSelectionResults(news, shops, {
      sortField: "salesVolume",
      sortOrder: "desc",
    });
    expect(out).toHaveLength(1);
    expect(out[0].asin).toBe("X");
    // units 80 > (new 无 units=−∞),保留 shop 条
    expect(out[0].dataSource).toBe("shop");
    expect(out[0].mergedSources).toEqual(
      expect.arrayContaining(["new", "shop"]),
    );
  });

  it("升序排序方向正确", () => {
    const news = [{ asin: "A", price: 10, dataSource: "new" as const }];
    const shops = [{ asin: "B", price: 5, dataSource: "shop" as const }];
    const out = mergeSelectionResults(news, shops, {
      sortField: "price",
      sortOrder: "asc",
    });
    expect(out.map((x) => x.asin)).toEqual(["B", "A"]);
  });

  it("无 asin 的条目不参与去重,原样保留", () => {
    const news = [{ parentAsin: "", score: 1, dataSource: "new" as const }];
    const shops = [{ parentAsin: "", score: 2, dataSource: "shop" as const }];
    const out = mergeSelectionResults(news, shops, {
      sortField: "score",
      sortOrder: "desc",
    });
    expect(out).toHaveLength(2);
  });

  it("空源返回空", () => {
    expect(
      mergeSelectionResults([], [], { sortField: "score", sortOrder: "desc" }),
    ).toEqual([]);
  });
});
