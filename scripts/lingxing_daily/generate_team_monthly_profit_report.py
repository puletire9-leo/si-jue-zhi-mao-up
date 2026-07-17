"""Generate a Chinese monthly profit report for the team Lingxing SKU scope."""

from __future__ import annotations

import csv
import os
from collections import defaultdict
from datetime import date
from decimal import Decimal
from pathlib import Path

import pymysql


ROOT = Path(__file__).resolve().parents[2]
MONTHLY_DIR = ROOT / "\u4ea7\u54c1\u6570\u636e" / "\u9886\u661f\u6570\u636eapi" / "\u9886\u661f25\u5e74\u523026\u5e746\u6708\u6240\u6709\u6570\u636e\uff0c\u4ee5\u6bcf\u6708\u6570\u636e"
OUTPUT_DIR = MONTHLY_DIR / "\u5386\u53f2SKU\u4e0a\u67b6\u57fa\u7840\u6570\u636e_2025-04\u81f32026-06" / "05_\u8d22\u52a1\u5229\u6da6\u5468\u5ea6\u56de\u8865"
SCOPE_FILE = OUTPUT_DIR / "\u56e2\u961f\u76ee\u6807SKU\u5e97\u94fa\u8303\u56f4_2025-04\u81f32026-06.csv"
SECRETS_FILE = ROOT / "config" / "secrets" / "dev.env"

MONTH_START = date.fromisoformat(os.getenv("PROFIT_REPORT_START", "2026-06-01"))
MONTH_END = date.fromisoformat(os.getenv("PROFIT_REPORT_END", "2026-06-30"))
PREFIX_PATTERN = r"^(225|252|253|254|265|255|256|258|259|260|257|261|262|263|630|264|266)[0-9]+$"
TEAM_MEMBERS = {"\u848b\u8212", "\u9648\u6768", "\u5b8b\u51e4\u8389", "\u5218\u6dfc", "\u9f99\u68a6\u4e34", "\u5468\u6c81\u4eea", "\u5f20\u5b50\u8f69", "\u9ec4\u96e8\u73ca"}
FALLBACK_OWNER = {
    "225": "\u848b\u8212", "252": "\u848b\u8212", "253": "\u848b\u8212", "254": "\u848b\u8212", "265": "\u848b\u8212",
    "255": "\u9648\u6768", "256": "\u5b8b\u51e4\u8389", "258": "\u5b8b\u51e4\u8389", "259": "\u5b8b\u51e4\u8389",
    "257": "\u5218\u6dfc", "261": "\u5218\u6dfc", "262": "\u9f99\u68a6\u4e34", "263": "\u5468\u6c81\u4eea",
    "264": "\u5f20\u5b50\u8f69", "266": "\u9ec4\u96e8\u73ca", "630": "\u5468\u6c81\u4eea",
    "260": "\u5b8b\u51e4\u8389/\u9ec4\u96e8\u73ca\uff08\u5171\u4eab\u524d\u7f00\uff09",
}


def secret_value(key: str) -> str:
    if value := os.getenv(key):
        return value
    for line in SECRETS_FILE.read_text(encoding="utf-8").splitlines():
        if line.startswith(f"{key}="):
            return line.split("=", 1)[1]
    raise RuntimeError(f"Missing {key}")


def scope_sids() -> list[str]:
    with SCOPE_FILE.open(encoding="utf-8-sig", newline="") as source:
        return sorted({row["SID"] for row in csv.DictReader(source) if row["SID"] and row["SID\u6620\u5c04\u72b6\u6001"] == "\u5df2\u6620\u5c04"})


def number(value: Decimal | int | None) -> Decimal:
    return Decimal(value or 0)


def format_amount(value: Decimal) -> str:
    return f"{value:,.2f}"


def main() -> None:
    sids = scope_sids()
    placeholders = ", ".join(["%s"] * len(sids))
    query = f"""
        WITH local_owner AS (
            SELECT sku, MAX(product_developer) AS developer
            FROM lingxing_local_product
            GROUP BY sku
        )
        SELECT
            p.local_sku, p.currency_code, p.asin, p.sid,
            p.total_sales_quantity, p.total_sales_amount, p.total_ads_cost,
            p.total_cost, p.gross_profit, owner.developer
        FROM lingxing_profit_asin p
        LEFT JOIN local_owner owner ON owner.sku = p.local_sku
        WHERE p.data_date BETWEEN %s AND %s
          AND p.sid IN ({placeholders})
          AND p.local_sku REGEXP %s
    """
    connection = pymysql.connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", "13338")),
        user=os.getenv("MYSQL_USERNAME", "sijue"),
        password=secret_value("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE", "sijuelishi_dev"),
        charset="utf8mb4",
    )
    try:
        with connection.cursor() as cursor:
            cursor.execute(query, [MONTH_START, MONTH_END, *sids, PREFIX_PATTERN])
            facts = cursor.fetchall()
    finally:
        connection.close()

    totals: dict[str, dict[str, Decimal | int | set[str]]] = defaultdict(lambda: {
        "facts": 0, "skus": set(), "asins": set(), "sales_qty": Decimal(0), "sales_amount": Decimal(0),
        "ads_cost": Decimal(0), "total_cost": Decimal(0), "settlement_adjustment": Decimal(0), "gross_profit": Decimal(0),
    })
    by_owner: dict[tuple[str, str], dict[str, Decimal | int | set[str]]] = defaultdict(lambda: {
        "facts": 0, "skus": set(), "sales_qty": Decimal(0), "sales_amount": Decimal(0),
        "ads_cost": Decimal(0), "total_cost": Decimal(0), "settlement_adjustment": Decimal(0), "gross_profit": Decimal(0),
    })
    by_sku: dict[tuple[str, str, str], dict[str, Decimal | int | set[str]]] = defaultdict(lambda: {
        "facts": 0, "asins": set(), "stores": set(), "sales_qty": Decimal(0), "sales_amount": Decimal(0),
        "ads_cost": Decimal(0), "total_cost": Decimal(0), "settlement_adjustment": Decimal(0), "gross_profit": Decimal(0),
    })

    for sku, currency, asin, sid, sales_qty, sales_amount, ads_cost, total_cost, gross_profit, developer in facts:
        sku = str(sku)
        currency = str(currency or "\u672a\u77e5\u5e01\u79cd")
        developer = developer if developer in TEAM_MEMBERS else FALLBACK_OWNER.get(sku[:3], "\u672a\u5339\u914d\u5f00\u53d1\u4eba")
        amounts = {
            "sales_qty": number(sales_qty), "sales_amount": number(sales_amount), "ads_cost": number(ads_cost),
            "total_cost": number(total_cost), "gross_profit": number(gross_profit),
        }
        amounts["settlement_adjustment"] = amounts["gross_profit"] - amounts["sales_amount"] - amounts["ads_cost"] - amounts["total_cost"]
        for bucket in (totals[currency], by_owner[(developer, currency)], by_sku[(developer, sku, currency)]):
            bucket["facts"] += 1
            for key, value in amounts.items():
                bucket[key] += value
        totals[currency]["skus"].add(sku)
        totals[currency]["asins"].add(str(asin or ""))
        by_owner[(developer, currency)]["skus"].add(sku)
        by_sku[(developer, sku, currency)]["asins"].add(str(asin or ""))
        by_sku[(developer, sku, currency)]["stores"].add(str(sid or ""))

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    suffix = MONTH_START.strftime("%Y\u5e74%m\u6708")
    report_path = OUTPUT_DIR / f"{suffix}\u56e2\u961fSKU\u8d22\u52a1\u5229\u6da6\u6c47\u603b.md"
    sku_path = OUTPUT_DIR / f"{suffix}\u56e2\u961fSKU\u8d22\u52a1\u5229\u6da6\u660e\u7ec6.csv"
    with sku_path.open("w", encoding="utf-8-sig", newline="") as destination:
        columns = ["\u5f00\u53d1\u4eba", "SKU", "\u5e01\u79cd", "\u8d22\u52a1\u65e5\u8bb0\u5f55\u6570", "ASIN\u6570", "\u5e97\u94fa\u6570", "\u9500\u91cf", "\u9500\u552e\u989d", "\u5e7f\u544a\u8d39", "\u603b\u6210\u672c", "\u9886\u661f\u5176\u4ed6\u7ed3\u7b97\u8c03\u6574\u9879", "\u6bdb\u5229\u6da6", "\u6c47\u603b\u6bdb\u5229\u7387"]
        writer = csv.DictWriter(destination, fieldnames=columns)
        writer.writeheader()
        for (developer, sku, currency), row in sorted(by_sku.items(), key=lambda item: (item[0][2], item[1]["gross_profit"])):
            sales_amount = row["sales_amount"]
            writer.writerow({
                "\u5f00\u53d1\u4eba": developer, "SKU": sku, "\u5e01\u79cd": currency, "\u8d22\u52a1\u65e5\u8bb0\u5f55\u6570": row["facts"],
                "ASIN\u6570": len(row["asins"] - {""}), "\u5e97\u94fa\u6570": len(row["stores"] - {""}),
                "\u9500\u91cf": row["sales_qty"], "\u9500\u552e\u989d": row["sales_amount"], "\u5e7f\u544a\u8d39": row["ads_cost"],
                "\u603b\u6210\u672c": row["total_cost"], "\u9886\u661f\u5176\u4ed6\u7ed3\u7b97\u8c03\u6574\u9879": row["settlement_adjustment"], "\u6bdb\u5229\u6da6": row["gross_profit"],
                "\u6c47\u603b\u6bdb\u5229\u7387": (row["gross_profit"] / sales_amount) if sales_amount else "",
            })

    lines = [
        f"# {MONTH_START.year}\u5e74{MONTH_START.month}\u6708\u56e2\u961f SKU \u8d22\u52a1\u5229\u6da6\u6c47\u603b",
        "",
        "## \u7edf\u8ba1\u8303\u56f4",
        "",
        f"- \u65e5\u671f\uff1a{MONTH_START} \u81f3 {MONTH_END}\uff08\u53cc\u95ed\u533a\u95f4\uff09",
        f"- \u5e97\u94fa\uff1a{len(sids)} \u4e2a\u56e2\u961f\u76ee\u6807\u5e97\u94fa\uff08SID \u6765\u81ea `\u56e2\u961f\u76ee\u6807SKU\u5e97\u94fa\u8303\u56f4_2025-04\u81f32026-06.csv`\uff09\u3002",
        "- SKU\uff1a\u53ea\u5305\u542b 8 \u4f4d\u5f00\u53d1\u4eba\u7684\u6709\u6548\u524d\u7f00\uff1a225\u3001252\u3001253\u3001254\u3001265\u3001255\u3001256\u3001258\u3001259\u3001260\u3001257\u3001261\u3001262\u3001263\u3001630\u3001264\u3001266\u3002",
        "- \u8d22\u52a1\u4e8b\u5b9e\uff1a\u6bcf\u884c\u4e3a `ASIN + \u5e97\u94faSID + \u65e5\u671f + \u5e01\u79cd`\uff0c\u91cd\u590d\u62c9\u53d6\u4f1a\u6309\u8be5\u4e1a\u52a1\u952e\u66f4\u65b0\uff0c\u4e0d\u91cd\u590d\u7d2f\u52a0\u3002",
        "",
        "## \u56e2\u961f\u6c47\u603b\uff08\u6309\u5e01\u79cd\uff09",
        "",
        "| \u5e01\u79cd | \u8d22\u52a1\u65e5\u8bb0\u5f55 | SKU\u6570 | ASIN\u6570 | \u9500\u91cf | \u9500\u552e\u989d | \u5e7f\u544a\u8d39 | \u603b\u6210\u672c | \u5176\u4ed6\u7ed3\u7b97\u8c03\u6574\u9879 | \u6bdb\u5229\u6da6 | \u6c47\u603b\u6bdb\u5229\u7387 |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for currency, row in sorted(totals.items()):
        margin = row["gross_profit"] / row["sales_amount"] if row["sales_amount"] else None
        lines.append(
            f"| {currency} | {row['facts']:,} | {len(row['skus']):,} | {len(row['asins'] - {''}):,} | "
            f"{format_amount(row['sales_qty'])} | {format_amount(row['sales_amount'])} | {format_amount(row['ads_cost'])} | "
            f"{format_amount(row['total_cost'])} | {format_amount(row['settlement_adjustment'])} | {format_amount(row['gross_profit'])} | "
            f"{margin:.2%} |" if margin is not None else
            f"| {currency} | {row['facts']:,} | {len(row['skus']):,} | {len(row['asins'] - {''}):,} | "
            f"{format_amount(row['sales_qty'])} | {format_amount(row['sales_amount'])} | {format_amount(row['ads_cost'])} | "
            f"{format_amount(row['total_cost'])} | {format_amount(row['settlement_adjustment'])} | {format_amount(row['gross_profit'])} | \u65e0\u6cd5\u8ba1\u7b97 |"
        )
    lines.extend([
        "",
        "## \u6309\u5f00\u53d1\u4eba\u6c47\u603b\uff08\u6309\u5e01\u79cd\uff09",
        "",
        "| \u5f00\u53d1\u4eba | \u5e01\u79cd | SKU\u6570 | \u9500\u91cf | \u9500\u552e\u989d | \u5e7f\u544a\u8d39 | \u603b\u6210\u672c | \u5176\u4ed6\u7ed3\u7b97\u8c03\u6574\u9879 | \u6bdb\u5229\u6da6 | \u6c47\u603b\u6bdb\u5229\u7387 |",
        "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ])
    for (developer, currency), row in sorted(by_owner.items(), key=lambda item: (item[0][1], item[1]["gross_profit"])):
        margin = row["gross_profit"] / row["sales_amount"] if row["sales_amount"] else None
        margin_text = f"{margin:.2%}" if margin is not None else "\u65e0\u6cd5\u8ba1\u7b97"
        lines.append(
            f"| {developer} | {currency} | {len(row['skus']):,} | {format_amount(row['sales_qty'])} | "
            f"{format_amount(row['sales_amount'])} | {format_amount(row['ads_cost'])} | {format_amount(row['total_cost'])} | "
            f"{format_amount(row['settlement_adjustment'])} | {format_amount(row['gross_profit'])} | {margin_text} |"
        )
    lines.extend([
        "",
        "## \u8ba1\u7b97\u8bf4\u660e",
        "",
        "- \u9500\u91cf = `SUM(total_sales_quantity)`\u3002",
        "- \u9500\u552e\u989d = `SUM(total_sales_amount)`\u3002",
        "- \u5e7f\u544a\u8d39 = `SUM(total_ads_cost)`\u3002",
        "- \u603b\u6210\u672c = `SUM(total_cost)`\uff1b\u5b83\u662f\u5546\u54c1\u6210\u672c\u53e3\u5f84\uff0c\u539f\u59cb\u5b57\u6bb5\u53ef\u62c6\u4e3a\u91c7\u8d2d\u6210\u672c `cgPrice` + \u5934\u7a0b `cgTransportCosts` + \u5176\u4ed6\u5546\u54c1\u6210\u672c `cgOtherCostsTotal`\u3002",
        "- \u9886\u661f\u5176\u4ed6\u7ed3\u7b97\u8c03\u6574\u9879 = `SUM(gross_profit) - SUM(total_sales_amount) - SUM(total_ads_cost) - SUM(total_cost)`\u3002\u5b83\u4f7f\u8868\u5185\u6b63\u597d\u6ee1\u8db3\uff1a\u9500\u552e\u989d + \u5e7f\u544a\u8d39 + \u603b\u6210\u672c + \u5176\u4ed6\u8c03\u6574 = \u9886\u661f\u7ed3\u7b97\u6bdb\u5229\u6da6\u3002",
        "- \u8be5\u8c03\u6574\u9879\u662f\u539f\u59cb API \u4e2d\u672a\u5355\u72ec\u843d\u5217\u7684\u7ed3\u7b97\u9879\u6c47\u5408\uff0c\u5305\u542b\u5e73\u53f0\u8d39\u3001FBA \u914d\u9001/\u4ed3\u50a8\u8d39\u3001\u9000\u6b3e\u53ca\u8d39\u7528\u9000\u8fd8\u3001\u7a0e\u8d39\u3001\u4fc3\u9500\u3001\u8d54\u507f\u3001\u5e93\u5b58\u8c03\u6574\u548c\u5206\u644a\u8d39\u7528\u7b49\u3002\u5b83\u4e0d\u662f\u53e6\u4e00\u7b14\u5355\u72ec\u6536\u8d39\uff0c\u4e0d\u5e94\u4e0e\u539f\u59cb\u660e\u7ec6\u5b57\u6bb5\u91cd\u590d\u6c42\u548c\u3002",
        "- \u6bdb\u5229\u6da6 = `SUM(gross_profit)`\uff1b\u76f4\u63a5\u91c7\u7528\u9886\u661f API \u7684\u5df2\u7ed3\u7b97\u6bdb\u5229\u6da6\uff0c\u4e0d\u7528\u9500\u552e\u989d\u51cf\u603b\u6210\u672c\u8fdb\u884c\u66ff\u4ee3\u91cd\u7b97\u3002",
        "- \u6c47\u603b\u6bdb\u5229\u7387 = `SUM(gross_profit) / SUM(total_sales_amount)`\uff0c\u4e0d\u5bf9\u6bcf\u4e2a SKU \u7684\u6bdb\u5229\u7387\u76f4\u63a5\u5e73\u5747\u3002",
        "- GBP \u4e0e EUR \u5206\u5f00\u4f1a\u8ba1\uff0c\u672a\u5f15\u5165\u6c47\u7387\uff0c\u56e0\u6b64\u672a\u8f6c\u6362\u6216\u76f8\u52a0\u3002",
        f"- \u5b8c\u6574 SKU \u6c47\u603b\u660e\u7ec6\u89c1 `{sku_path.name}`\u3002",
    ])
    report_path.write_text("\ufeff" + "\n".join(lines) + "\n", encoding="utf-8")
    print(f"facts={len(facts)} currencies={len(totals)} report={report_path} sku_detail={sku_path}")


if __name__ == "__main__":
    main()
