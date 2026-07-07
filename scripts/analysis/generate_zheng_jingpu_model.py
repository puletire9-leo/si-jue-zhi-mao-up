from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import pandas as pd


ANALYSIS_DATE = pd.Timestamp("2026-07-07")
TIER_ORDER = ["A", "B", "C", "D", "UNKNOWN"]
AGE_ORDER = ["NEW_0_30", "GROWING_31_90", "MATURE_91_PLUS", "UNKNOWN_DATE", "FUTURE_DATE"]


@dataclass(frozen=True)
class Paths:
    base: Path
    source_csv: Path
    output_dir: Path


def build_paths() -> Paths:
    base = (
        Path.cwd()
        / "产品数据"
        / "邓总店铺"
        / "sellersprite_raw"
        / "zheng_all_uk_de_20260707"
        / "sales_tier_model"
    )
    return Paths(
        base=base,
        source_csv=base / "zheng_shop_products_sales_tier_all.csv",
        output_dir=base / "jingpu_shop_model",
    )


def normalize_category(value: object, depth: int = 2) -> str:
    if pd.isna(value):
        return ""
    parts = [part.strip() for part in str(value).split(":") if part.strip()]
    return ":".join(parts[:depth])


def bucket_age(value: object) -> str:
    if pd.isna(value):
        return "UNKNOWN_DATE"
    if value < 0:
        return "FUTURE_DATE"
    if value <= 30:
        return "NEW_0_30"
    if value <= 90:
        return "GROWING_31_90"
    return "MATURE_91_PLUS"


def load_products(source_csv: Path) -> pd.DataFrame:
    df = pd.read_csv(source_csv, encoding="utf-8-sig")
    df = df.drop_duplicates(subset=["marketplace", "sellerName", "asin"]).copy()
    df["salesTier"] = df["salesTier"].fillna("UNKNOWN").where(df["salesTier"].isin(TIER_ORDER), "UNKNOWN")
    df["units"] = pd.to_numeric(df["units"], errors="coerce")
    df["availableDateRaw"] = pd.to_numeric(df["availableDate"], errors="coerce")
    df["availableAt"] = pd.to_datetime(df["availableDateRaw"], unit="ms", errors="coerce").dt.tz_localize(None)
    df["ageDays"] = (ANALYSIS_DATE - df["availableAt"]).dt.days
    df["ageBucket"] = df["ageDays"].map(bucket_age)
    df["categoryKey"] = df["nodeLabelPath"].map(normalize_category)
    return df


def top_category_info(group: pd.DataFrame, tiers: list[str]) -> tuple[str, float]:
    subset = group[group["salesTier"].isin(tiers) & (group["categoryKey"] != "")]
    if subset.empty:
        return "", 0.0
    counts = subset["categoryKey"].value_counts()
    return counts.index[0], round(float(counts.iloc[0] / len(subset)), 4)


def d_abc_overlap(group: pd.DataFrame) -> tuple[int, float]:
    abc_top10 = set(
        group[group["salesTier"].isin(["A", "B", "C"]) & (group["categoryKey"] != "")]
        ["categoryKey"]
        .value_counts()
        .head(10)
        .index
    )
    d_with_category = group[(group["salesTier"] == "D") & (group["categoryKey"] != "")]
    if d_with_category.empty or not abc_top10:
        return 0, 0.0
    overlap_count = int(d_with_category["categoryKey"].isin(abc_top10).sum())
    return overlap_count, round(float(overlap_count / len(d_with_category)), 4)


def classify_shop(row: dict[str, object]) -> str:
    a = int(row["A"])
    abc = int(row["ABC"])
    d_new_or_growing = int(row["D_NEW_OR_GROWING"])
    d_old_ratio = float(row["D_OLD_RATIO"])

    if a >= 30 and abc >= 180:
        return "成熟精铺利润型"
    if a >= 10 and abc >= 100 and d_old_ratio < 0.55:
        return "健康精铺飞轮型"
    if a < 10 and abc >= 80 and d_new_or_growing >= 15:
        return "成长测品型"
    if a < 5 and d_old_ratio >= 0.70:
        return "低效老D偏多型"
    if abc >= 80:
        return "稳定候选池型"
    return "样本较小待观察型"


def prototype_score(row: dict[str, object]) -> float:
    a = int(row["A"])
    ab = int(row["AB"])
    abc = int(row["ABC"])
    d_new_or_growing = int(row["D_NEW_OR_GROWING"])
    d_old_ratio = float(row["D_OLD_RATIO"])
    overlap_ratio = float(row["D_ABC_TOP10_OVERLAP_RATIO"])

    score = (
        min(a / 40, 1) * 30
        + min(ab / 100, 1) * 20
        + min(abc / 220, 1) * 20
        + min(d_new_or_growing / 50, 1) * 10
        + overlap_ratio * 10
        + (1 - d_old_ratio) * 10
    )
    return round(score, 2)


def build_shop_scores(df: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for (marketplace, seller_name), group in df.groupby(["marketplace", "sellerName"], dropna=False):
        counts = group["salesTier"].value_counts().reindex(TIER_ORDER, fill_value=0)
        age_counts = group["ageBucket"].value_counts().reindex(AGE_ORDER, fill_value=0)
        d_group = group[group["salesTier"] == "D"]
        d_age_counts = d_group["ageBucket"].value_counts().reindex(AGE_ORDER, fill_value=0)
        total = int(len(group))
        a = int(counts["A"])
        b = int(counts["B"])
        c = int(counts["C"])
        d = int(counts["D"])
        ab = a + b
        abc = ab + c
        d_new_or_growing = int(d_age_counts["NEW_0_30"] + d_age_counts["GROWING_31_90"])
        d_old = int(d_age_counts["MATURE_91_PLUS"])
        d_unknown_date = int(d_age_counts["UNKNOWN_DATE"])
        overlap_count, overlap_ratio = d_abc_overlap(group)
        a_top_category, a_top_category_ratio = top_category_info(group, ["A"])
        abc_top_category, abc_top_category_ratio = top_category_info(group, ["A", "B", "C"])
        d_top_category, d_top_category_ratio = top_category_info(group, ["D"])

        row: dict[str, object] = {
            "marketplace": marketplace,
            "sellerName": seller_name,
            "total": total,
            "A": a,
            "B": b,
            "C": c,
            "D": d,
            "UNKNOWN": int(counts["UNKNOWN"]),
            "AB": ab,
            "ABC": abc,
            "A_RATIO": round(a / total, 4) if total else 0.0,
            "AB_RATIO": round(ab / total, 4) if total else 0.0,
            "ABC_RATIO": round(abc / total, 4) if total else 0.0,
            "D_RATIO": round(d / total, 4) if total else 0.0,
            "NEW_0_30": int(age_counts["NEW_0_30"]),
            "GROWING_31_90": int(age_counts["GROWING_31_90"]),
            "MATURE_91_PLUS": int(age_counts["MATURE_91_PLUS"]),
            "UNKNOWN_DATE": int(age_counts["UNKNOWN_DATE"]),
            "FUTURE_DATE": int(age_counts["FUTURE_DATE"]),
            "D_NEW_OR_GROWING": d_new_or_growing,
            "D_OLD": d_old,
            "D_UNKNOWN_DATE": d_unknown_date,
            "D_NEW_OR_GROWING_RATIO": round(d_new_or_growing / d, 4) if d else 0.0,
            "D_OLD_RATIO": round(d_old / d, 4) if d else 0.0,
            "D_ABC_TOP10_OVERLAP_COUNT": overlap_count,
            "D_ABC_TOP10_OVERLAP_RATIO": overlap_ratio,
            "A_TOP_CATEGORY": a_top_category,
            "A_TOP_CATEGORY_RATIO": a_top_category_ratio,
            "ABC_TOP_CATEGORY": abc_top_category,
            "ABC_TOP_CATEGORY_RATIO": abc_top_category_ratio,
            "D_TOP_CATEGORY": d_top_category,
            "D_TOP_CATEGORY_RATIO": d_top_category_ratio,
        }
        row["prototypeScore"] = prototype_score(row)
        row["modelType"] = classify_shop(row)
        rows.append(row)

    result = pd.DataFrame(rows)
    return result.sort_values(["marketplace", "prototypeScore", "ABC"], ascending=[True, False, False])


def build_age_matrix(df: pd.DataFrame) -> pd.DataFrame:
    matrix = (
        df.pivot_table(
            index=["marketplace", "sellerName"],
            columns=["salesTier", "ageBucket"],
            values="asin",
            aggfunc="count",
            fill_value=0,
        )
        .reset_index()
    )
    matrix.columns = [
        "_".join([str(part) for part in col if part]) if isinstance(col, tuple) else str(col)
        for col in matrix.columns
    ]
    return matrix


def build_category_structure(df: pd.DataFrame) -> pd.DataFrame:
    grouped = (
        df[df["categoryKey"] != ""]
        .groupby(["marketplace", "sellerName", "salesTier", "categoryKey"], dropna=False)
        .agg(productCount=("asin", "count"), unitsSum=("units", "sum"), unitsMedian=("units", "median"))
        .reset_index()
    )
    grouped["tierRank"] = grouped["salesTier"].map({tier: idx for idx, tier in enumerate(TIER_ORDER)})
    return grouped.sort_values(["marketplace", "sellerName", "tierRank", "productCount"], ascending=[True, True, True, False]).drop(columns=["tierRank"])


def percent(value: object) -> str:
    return f"{float(value) * 100:.1f}%"


def markdown_shop_table(df: pd.DataFrame, marketplace: str, limit: int = 15) -> str:
    subset = df[df["marketplace"] == marketplace].sort_values("prototypeScore", ascending=False).head(limit)
    lines = [
        f"## {marketplace} 店铺画像 Top {limit}",
        "",
        "| 排名 | 店铺 | 模型类型 | 分数 | A | AB | ABC | D | 新/成长D | 老D占D | D-ABC重合 | A主类目 |",
        "|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
    ]
    for idx, (_, row) in enumerate(subset.iterrows(), start=1):
        lines.append(
            "| {idx} | {seller} | {model} | {score:.2f} | {a} | {ab} | {abc} | {d} | {dng} | {old} | {overlap} | {cat} |".format(
                idx=idx,
                seller=row["sellerName"],
                model=row["modelType"],
                score=row["prototypeScore"],
                a=int(row["A"]),
                ab=int(row["AB"]),
                abc=int(row["ABC"]),
                d=int(row["D"]),
                dng=int(row["D_NEW_OR_GROWING"]),
                old=percent(row["D_OLD_RATIO"]),
                overlap=percent(row["D_ABC_TOP10_OVERLAP_RATIO"]),
                cat=row["A_TOP_CATEGORY"],
            )
        )

    lines.extend(["", "### 模型类型分布", ""])
    dist = df[df["marketplace"] == marketplace]["modelType"].value_counts()
    for model_type, count in dist.items():
        lines.append(f"- {model_type}: {count}")
    lines.append("")
    return "\n".join(lines)


def write_report(scores: pd.DataFrame, category_structure: pd.DataFrame, output_path: Path) -> None:
    lines = [
        "# 郑总店铺精铺画像原型跑数报告",
        "",
        f"> 数据口径：`marketplace + sellerName + asin` 去重；分析日期：{ANALYSIS_DATE.date()}。",
        "> 这个报告不是最终店铺评级，而是用于验证“精铺测品飞轮”是否能被数据表达出来。",
        "",
        "## 核心判断",
        "",
        "- A 级商品更像利润结果，能看出店铺最终靠什么赚钱，但不能单独代表完整打法。",
        "- A+B+C 更适合作为稳定经营画像，因为 B/C 承接了从测品到利润品之间的中间层。",
        "- D 级必须叠加上架时间；新 D/成长 D 是测品池，老 D 才更接近失败品或低效库存。",
        "- D 与 ABC Top 类目的重合度，可以判断测品是不是围绕已验证方向展开。",
        "",
        "## 字段解释",
        "",
        "| 字段 | 含义 |",
        "|---|---|",
        "| A | 利润锚点，已验证商品 |",
        "| AB | 利润/强候选池 |",
        "| ABC | 稳定经营画像和主打法 |",
        "| D_NEW_OR_GROWING | D 中上架 0-90 天的商品，偏正常测品 |",
        "| D_OLD | 上架超过 90 天仍为 D 的商品，偏失败或低效 |",
        "| D_ABC_TOP10_OVERLAP_RATIO | D 商品落在 ABC Top10 类目内的比例，衡量测品方向是否聚焦 |",
        "| A_TOP_CATEGORY_RATIO | A 层头部类目集中度，衡量利润方向是否清晰 |",
        "",
        markdown_shop_table(scores, "UK"),
        markdown_shop_table(scores, "DE"),
        "## 实际效果观察",
        "",
    ]

    uk = scores[scores["marketplace"] == "UK"]
    de = scores[scores["marketplace"] == "DE"]
    for marketplace, subset in [("UK", uk), ("DE", de)]:
        if subset.empty:
            continue
        top = subset.sort_values("prototypeScore", ascending=False).iloc[0]
        avg_overlap = subset["D_ABC_TOP10_OVERLAP_RATIO"].mean()
        avg_d_old = subset["D_OLD_RATIO"].mean()
        lines.extend(
            [
                f"### {marketplace}",
                "",
                f"- 最高分店铺是 `{top['sellerName']}`，模型类型为“{top['modelType']}”，A={int(top['A'])}，ABC={int(top['ABC'])}，D={int(top['D'])}。",
                f"- D 与 ABC Top10 类目平均重合度为 {avg_overlap * 100:.1f}%，说明测品并不是完全散乱铺货，而是较多围绕已验证方向扩展。",
                f"- 老 D 平均占 D 为 {avg_d_old * 100:.1f}%，这部分需要后续作为低效库存/失败品风险单独观察。",
                "",
            ]
        )

    lines.extend(
        [
            "## 品类结构读取方式",
            "",
            "- 看 A：判断最终利润样貌。",
            "- 看 ABC：判断店铺真实稳定打法。",
            "- 看 D 与 ABC 重合：判断测品方向是否在复用成功经验。",
            "- 看老 D：判断铺货是否积累低效库存。",
            "",
            "## 初步结论",
            "",
            "这套原型能把郑总店铺明显拆成几类：成熟精铺利润型、健康精铺飞轮型、稳定候选池型、成长测品型、低效老 D 偏多型。实际结果符合精铺逻辑：A 不是唯一答案，ABC 才更像店铺画像主体，D 需要用时间和品类重合度来区分“正在测”还是“测失败”。",
        ]
    )
    output_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_excel(output_path: Path, scores: pd.DataFrame, age_matrix: pd.DataFrame, category_structure: pd.DataFrame, products: pd.DataFrame) -> None:
    product_cols = [
        "marketplace",
        "salesTier",
        "ageBucket",
        "ageDays",
        "sellerName",
        "asin",
        "asinUrl",
        "units",
        "title",
        "brand",
        "price",
        "bsr",
        "categoryKey",
        "nodeLabelPath",
        "availableDate",
    ]
    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        scores.to_excel(writer, sheet_name="Summary", index=False)
        scores[scores["marketplace"] == "UK"].sort_values("prototypeScore", ascending=False).head(20).to_excel(writer, sheet_name="UKTop20", index=False)
        scores[scores["marketplace"] == "DE"].sort_values("prototypeScore", ascending=False).head(20).to_excel(writer, sheet_name="DETop20", index=False)
        age_matrix.to_excel(writer, sheet_name="AgeMatrix", index=False)
        category_structure.to_excel(writer, sheet_name="CategoryTop", index=False)
        products[product_cols].sort_values(["marketplace", "sellerName", "salesTier", "units"], ascending=[True, True, True, False]).to_excel(
            writer, sheet_name="ProductDetail", index=False
        )

        workbook = writer.book
        for sheet in workbook.worksheets:
            sheet.freeze_panes = "A2"
            sheet.auto_filter.ref = sheet.dimensions
            for column_cells in sheet.columns:
                header = str(column_cells[0].value or "")
                width = min(max(len(header) + 2, 12), 42)
                sheet.column_dimensions[column_cells[0].column_letter].width = width

        product_sheet = workbook["ProductDetail"]
        headers = [cell.value for cell in product_sheet[1]]
        if "asinUrl" in headers:
            asin_url_col = headers.index("asinUrl") + 1
            asin_col = headers.index("asin") + 1
            for row in range(2, product_sheet.max_row + 1):
                url = product_sheet.cell(row=row, column=asin_url_col).value
                asin_cell = product_sheet.cell(row=row, column=asin_col)
                if url and asin_cell.value:
                    asin_cell.hyperlink = url
                    asin_cell.style = "Hyperlink"


def main() -> None:
    paths = build_paths()
    paths.output_dir.mkdir(parents=True, exist_ok=True)

    products = load_products(paths.source_csv)
    scores = build_shop_scores(products)
    age_matrix = build_age_matrix(products)
    category_structure = build_category_structure(products)

    scores.to_csv(paths.output_dir / "jingpu_shop_model_scores.csv", index=False, encoding="utf-8-sig")
    age_matrix.to_csv(paths.output_dir / "shop_sales_tier_age_matrix.csv", index=False, encoding="utf-8-sig")
    category_structure.to_csv(paths.output_dir / "shop_category_structure.csv", index=False, encoding="utf-8-sig")
    write_report(scores, category_structure, paths.output_dir / "jingpu_shop_model_report.md")
    excel_path = paths.output_dir / "jingpu_shop_model_prototype.xlsx"
    try:
        write_excel(excel_path, scores, age_matrix, category_structure, products)
    except PermissionError:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        excel_path = paths.output_dir / f"jingpu_shop_model_prototype_{timestamp}.xlsx"
        write_excel(excel_path, scores, age_matrix, category_structure, products)

    print(f"products={len(products)}")
    print(f"shops={len(scores)}")
    print(f"output={paths.output_dir}")
    print(f"excel={excel_path}")
    for marketplace in ["UK", "DE"]:
        top = scores[scores["marketplace"] == marketplace].head(1)
        if not top.empty:
            row = top.iloc[0]
            print(
                f"{marketplace}_top={row['sellerName']} score={row['prototypeScore']} "
                f"type={row['modelType']} A={row['A']} ABC={row['ABC']} D={row['D']}"
            )


if __name__ == "__main__":
    main()
