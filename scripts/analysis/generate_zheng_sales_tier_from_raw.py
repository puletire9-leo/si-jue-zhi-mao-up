from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
RAW_BASE = ROOT / "产品数据" / "邓总店铺" / "sellersprite_raw"
MARKETPLACES = ["UK", "DE"]
TIER_ORDER = ["A", "B", "C", "D", "UNKNOWN"]


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def sales_tier(units: Any) -> str:
    if units is None or units == "":
        return "UNKNOWN"
    try:
        value = float(units)
    except (TypeError, ValueError):
        return "UNKNOWN"
    if value >= 100:
        return "A"
    if value >= 50:
        return "B"
    if value >= 15:
        return "C"
    return "D"


def category_list(value: Any) -> str:
    if not isinstance(value, list):
        return ""
    labels = []
    for item in value:
        if isinstance(item, dict):
            label = item.get("label")
            rank = item.get("rank")
            if label:
                labels.append(f"{label}:{rank}" if rank is not None else str(label))
    return "; ".join(labels)


def parent_key(item: dict[str, Any]) -> str:
    return str(item.get("parent") or item.get("parentAsin") or item.get("asin") or "").strip()


def asin_url(marketplace: str, asin: str) -> str:
    domain = "www.amazon.co.uk" if marketplace == "UK" else "www.amazon.de"
    return f"https://{domain}/dp/{asin}" if asin else ""


def extract_items(run_dir: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    rows: list[dict[str, Any]] = []
    page_rows: list[dict[str, Any]] = []
    for marketplace in MARKETPLACES:
        market_dir = run_dir / marketplace
        if not market_dir.exists():
            continue
        for seller_dir in sorted(path for path in market_dir.iterdir() if path.is_dir()):
            for response_path in sorted(seller_dir.glob("response-page-*.json")):
                record = read_json(response_path)
                response = record.get("response") or {}
                data = response.get("data") or {}
                items = data.get("items") or []
                page_rows.append(
                    {
                        "marketplace": marketplace,
                        "sellerNameDir": seller_dir.name,
                        "responseFile": str(response_path.relative_to(run_dir)),
                        "httpStatus": record.get("httpStatus"),
                        "apiCode": response.get("code"),
                        "apiMessage": response.get("message"),
                        "apiTotal": data.get("total"),
                        "apiPages": data.get("pages"),
                        "apiPage": data.get("page"),
                        "items": len(items) if isinstance(items, list) else 0,
                        "elapsedMs": record.get("elapsedMs"),
                    }
                )
                if response.get("code") != "OK" or not isinstance(items, list):
                    continue
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    asin = str(item.get("asin") or "").strip()
                    seller_name = str(item.get("sellerName") or seller_dir.name).strip()
                    rows.append(
                        {
                            "marketplace": marketplace,
                            "salesTier": sales_tier(item.get("units")),
                            "sellerName": seller_name,
                            "sellerId": item.get("sellerId"),
                            "asin": asin,
                            "parentAsin": parent_key(item),
                            "asinUrl": asin_url(marketplace, asin),
                            "units": item.get("units"),
                            "title": item.get("title"),
                            "brand": item.get("brand"),
                            "price": item.get("price"),
                            "symbol": item.get("symbol"),
                            "bsrId": item.get("bsrId"),
                            "bsr": item.get("bsr"),
                            "nodeLabelPath": item.get("nodeLabelPath"),
                            "nodeIdPath": item.get("nodeIdPath"),
                            "bestSellerSubcategories": category_list(item.get("subcategories")),
                            "imageUrl": item.get("imageUrl"),
                            "availableDate": item.get("availableDate"),
                            "variations": item.get("variations"),
                            "sourceResponse": str(response_path.relative_to(run_dir)),
                        }
                    )
    return rows, page_rows


def build_quality(df: pd.DataFrame, page_df: pd.DataFrame) -> dict[str, Any]:
    if df.empty:
        return {}
    parent_groups = (
        df.groupby(["marketplace", "sellerName", "parentAsin"], dropna=False)["asin"]
        .nunique()
        .reset_index(name="asinCount")
    )
    duplicate_parent_groups = parent_groups[parent_groups["asinCount"] > 1]
    return {
        "tasks": int(page_df.groupby(["marketplace", "sellerNameDir"]).ngroups) if not page_df.empty else 0,
        "pagesFetched": int(len(page_df)),
        "errors": int((page_df["apiCode"] != "OK").sum()) if not page_df.empty else 0,
        "rows": int(len(df)),
        "rowsByMarketplace": {str(k): int(v) for k, v in df["marketplace"].value_counts().sort_index().items()},
        "uniqueAsins": int(df.drop_duplicates(["marketplace", "sellerName", "asin"]).shape[0]),
        "parentGroups": int(len(parent_groups)),
        "duplicateParentGroups": int(len(duplicate_parent_groups)),
        "duplicateParentRows": int(duplicate_parent_groups["asinCount"].sum()) if not duplicate_parent_groups.empty else 0,
        "maxAsinsInParentGroup": int(duplicate_parent_groups["asinCount"].max()) if not duplicate_parent_groups.empty else 0,
    }


def duplicate_parent_groups(df: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        df.groupby(["marketplace", "sellerName", "parentAsin"], dropna=False)
        .agg(
            asinCount=("asin", "nunique"),
            asins=("asin", lambda values: ";".join(sorted({str(value) for value in values if pd.notna(value)}))),
            units=("units", lambda values: ";".join(str(value) for value in values if pd.notna(value))),
            titles=("title", lambda values: " || ".join(str(value)[:120] for value in values if pd.notna(value))),
        )
        .reset_index()
    )
    return grouped[grouped["asinCount"] > 1].sort_values(["asinCount", "marketplace", "sellerName"], ascending=[False, True, True])


def write_report(output_dir: Path, quality: dict[str, Any], dist: pd.DataFrame) -> None:
    lines = [
        "# 郑总店铺干净版抓取质量报告",
        "",
        "## 汇总",
        "",
        f"- 任务数：{quality.get('tasks', 0)}",
        f"- 请求页数：{quality.get('pagesFetched', 0)}",
        f"- 错误数：{quality.get('errors', 0)}",
        f"- 商品行数：{quality.get('rows', 0)}",
        f"- 父 ASIN 组数：{quality.get('parentGroups', 0)}",
        f"- 重复父 ASIN 组数：{quality.get('duplicateParentGroups', 0)}",
        f"- 最大单父组 ASIN 数：{quality.get('maxAsinsInParentGroup', 0)}",
        "",
        "## 市场行数",
        "",
    ]
    for marketplace, count in quality.get("rowsByMarketplace", {}).items():
        lines.append(f"- {marketplace}: {count}")
    lines.extend(["", "## 销量等级分布", ""])
    if not dist.empty:
        pivot = dist.pivot_table(index="marketplace", columns="salesTier", values="count", aggfunc="sum", fill_value=0)
        pivot = pivot.reindex(columns=TIER_ORDER, fill_value=0)
        lines.append("| 市场 | A | B | C | D | UNKNOWN | 合计 |")
        lines.append("|---|---:|---:|---:|---:|---:|---:|")
        for marketplace, row in pivot.iterrows():
            total = int(row.sum())
            lines.append(
                f"| {marketplace} | {int(row['A'])} | {int(row['B'])} | {int(row['C'])} | {int(row['D'])} | {int(row['UNKNOWN'])} | {total} |"
            )
    output_dir.joinpath("clean_fetch_quality_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args()

    run_dir = RAW_BASE / args.run_id
    if not run_dir.exists():
        raise SystemExit(f"run not found: {run_dir}")

    output_dir = run_dir / "sales_tier_model"
    output_dir.mkdir(parents=True, exist_ok=True)

    rows, page_rows = extract_items(run_dir)
    df = pd.DataFrame(rows)
    page_df = pd.DataFrame(page_rows)
    if df.empty:
        raise SystemExit("no product rows found")

    df = df.drop_duplicates(subset=["marketplace", "sellerName", "asin"]).copy()
    dist = (
        df.groupby(["marketplace", "salesTier"], dropna=False)
        .size()
        .reset_index(name="count")
        .sort_values(["marketplace", "salesTier"])
    )
    seller_dist = (
        df.groupby(["marketplace", "sellerName", "salesTier"], dropna=False)
        .size()
        .unstack(fill_value=0)
        .reindex(columns=TIER_ORDER, fill_value=0)
        .reset_index()
    )
    seller_dist["total"] = seller_dist[TIER_ORDER].sum(axis=1)

    quality = build_quality(df, page_df)
    dup_parent_df = duplicate_parent_groups(df)

    df.to_csv(output_dir / "zheng_shop_products_sales_tier_all.csv", index=False, encoding="utf-8-sig")
    dist.to_csv(output_dir / "sales_tier_distribution.csv", index=False, encoding="utf-8-sig")
    seller_dist.to_csv(output_dir / "seller_sales_tier_distribution.csv", index=False, encoding="utf-8-sig")
    page_df.to_csv(output_dir / "fetch_pages.csv", index=False, encoding="utf-8-sig")
    dup_parent_df.to_csv(output_dir / "duplicate_parent_groups.csv", index=False, encoding="utf-8-sig")
    (output_dir / "quality_summary.json").write_text(json.dumps(quality, ensure_ascii=False, indent=2), encoding="utf-8")
    write_report(output_dir, quality, dist)

    print(f"run={args.run_id}")
    print(f"output={output_dir}")
    print(json.dumps(quality, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
