"""补齐 sku_full_lifecycle.csv 的 L2/L3 详细字段。

从 dev-mysql 的 lingxing_product_performance 拉:
- 亚马逊真实标题 item_name
- parent_asin
- 首月销量(FBA 首现月对应周汇总)
- 最新月(2026-06)销量/销售额
- 最新月仍在卖 flag
- 累计广告花费 / 累计出单率

用法:
  python enrich_amazon_data.py

输入: data/sku_full_lifecycle.csv
输出: data/sku_full_lifecycle.csv (原地写入,追加列)
      data/enrich_diagnostics.md
"""
from __future__ import annotations

import csv
import io
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

SKILL_ROOT = Path(__file__).resolve().parent.parent
DATA = SKILL_ROOT / "data"
LIFECYCLE_CSV = DATA / "sku_full_lifecycle.csv"
DIAG = DATA / "enrich_diagnostics.md"

# 最新月边界(可配置)
LATEST_MONTH_START = "2026-06-01"
LATEST_MONTH_END = "2026-07-01"


def run_mysql(sql: str) -> list[dict]:
    cmd = [
        "docker", "exec", "dev-mysql", "mysql", "-uroot", "-proot",
        "--default-character-set=utf8mb4", "-B", "-e", sql,
    ]
    r = subprocess.run(cmd, capture_output=True, timeout=180)
    if r.returncode != 0:
        print(f"[enrich] mysql err: {r.stderr.decode('utf-8','replace')}", file=sys.stderr)
        return []
    reader = csv.DictReader(io.StringIO(r.stdout.decode("utf-8", "replace")), delimiter="\t")
    return list(reader)


def load_lifecycle() -> list[dict]:
    with LIFECYCLE_CSV.open("r", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def to_float(v):
    if v in (None, "", "NULL"):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _batched(items: list[str], size: int = 400):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def enrich(rows: list[dict]) -> tuple[list[dict], dict]:
    """按 ASIN 从 product_performance 聚合。Windows CMDLINE 32KB 限制,分批查。"""
    asins = sorted({r["ASIN"] for r in rows if r.get("ASIN")})
    if not asins:
        return rows, {}
    print(f"[enrich] 待处理 unique ASIN: {len(asins)}")

    latest: dict[str, dict] = {}
    latest_month: dict[tuple, dict] = {}
    agg: dict[tuple, dict] = {}
    weekly: list[dict] = []

    for i, batch in enumerate(_batched(asins, 400)):
        quoted = ",".join(f"'{a}'" for a in batch)
        # 最新周(去掉 GROUP BY,让 JOIN 天然保留一行/asin)
        # 但同 asin 可能有多货币在同一周,取任一即可
        sql1 = (
            "USE sijuelishi_dev; "
            "SELECT p.asin, MAX(p.item_name) AS item_name, "
            "MAX(p.parent_asin) AS parent_asin, MAX(p.tacos) AS tacos, MAX(p.start_date) AS start_date "
            "FROM lingxing_product_performance p "
            "JOIN (SELECT asin, MAX(start_date) AS ms FROM lingxing_product_performance "
            f"WHERE asin IN ({quoted}) GROUP BY asin) t "
            "ON p.asin = t.asin AND p.start_date = t.ms "
            f"WHERE p.asin IN ({quoted}) GROUP BY p.asin;"
        )
        for r in run_mysql(sql1):
            latest[r["asin"]] = r

        # 最新月
        sql2 = (
            "USE sijuelishi_dev; "
            "SELECT asin, currency_code, SUM(volume) as vol, SUM(amount) as amt "
            f"FROM lingxing_product_performance WHERE asin IN ({quoted}) "
            f"AND start_date >= '{LATEST_MONTH_START}' AND start_date < '{LATEST_MONTH_END}' "
            "GROUP BY asin, currency_code;"
        )
        for r in run_mysql(sql2):
            latest_month[(r["asin"], r["currency_code"])] = r

        # 全期聚合
        sql3 = (
            "USE sijuelishi_dev; "
            "SELECT asin, currency_code, SUM(volume) as total_vol, "
            "SUM(amount) as total_amt, SUM(spend) as total_spend "
            f"FROM lingxing_product_performance WHERE asin IN ({quoted}) "
            "GROUP BY asin, currency_code;"
        )
        for r in run_mysql(sql3):
            agg[(r["asin"], r["currency_code"])] = r

        # 有销量的周明细(用于首月计算)
        sql4 = (
            "USE sijuelishi_dev; "
            "SELECT asin, currency_code, start_date, volume "
            f"FROM lingxing_product_performance WHERE asin IN ({quoted}) AND volume > 0;"
        )
        weekly.extend(run_mysql(sql4))

        print(f"[enrich] batch {i+1} 完成 (asins {len(batch)}, latest={len(latest)}, lm={len(latest_month)}, agg={len(agg)}, weekly rows so far={len(weekly)})")

    # 首月映射
    first_month_by_asin: dict[str, str] = {}
    for r in rows:
        a = r.get("ASIN")
        fm = r.get("首次观察到FBA可售月")
        if a and fm and a not in first_month_by_asin:
            first_month_by_asin[a] = fm

    # 本地聚合:asin+currency+first_month 的 volume
    first_month_vol: dict[tuple, int] = defaultdict(int)
    for w in weekly:
        a = w["asin"]
        cc = w["currency_code"]
        sd = w["start_date"]  # YYYY-MM-DD
        v = to_float(w["volume"]) or 0
        # start_date 归属月
        ym = sd[:7]  # YYYY-MM
        first_month_vol[(a, cc, ym)] += int(v)

    # 补齐 rows
    updated = 0
    for r in rows:
        asin = r.get("ASIN")
        cur = r.get("币种")
        if not asin:
            continue
        lat = latest.get(asin, {})
        r["亚马逊item_name"] = lat.get("item_name", "")
        r["parent_asin"] = lat.get("parent_asin", "")
        r["最新周tacos"] = lat.get("tacos", "")

        lm = latest_month.get((asin, cur), {})
        r["最新月销量"] = lm.get("vol", "0")
        r["最新月销售额"] = lm.get("amt", "0")
        r["最新月仍在卖"] = "1" if to_float(lm.get("vol")) and to_float(lm.get("vol")) > 0 else "0"

        agr = agg.get((asin, cur), {})
        r["累计销量"] = agr.get("total_vol", r.get("累计销量", ""))  # 覆盖
        r["累计广告花费"] = agr.get("total_spend", "")

        # 首月销量
        fm = first_month_by_asin.get(asin)
        if fm and cur:
            r["首月销量"] = first_month_vol.get((asin, cur, fm), 0)
        else:
            r["首月销量"] = ""

        updated += 1

    stats = {
        "asin_total": len(asins),
        "latest_hit": len(latest),
        "latest_month_hit": len(latest_month),
        "agg_hit": len(agg),
        "updated_rows": updated,
    }
    return rows, stats


def main() -> int:
    rows = load_lifecycle()
    print(f"[enrich] 读入 {len(rows)} 行")

    rows, stats = enrich(rows)

    # 追加新字段到 fieldnames
    if rows:
        base = list(rows[0].keys())
        new_fields = ["亚马逊item_name", "parent_asin", "最新周tacos",
                      "最新月销量", "最新月销售额", "最新月仍在卖",
                      "累计广告花费", "首月销量"]
        for f in new_fields:
            if f not in base:
                base.append(f)
        with LIFECYCLE_CSV.open("w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=base, extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)
        print(f"[enrich] 写回 {LIFECYCLE_CSV.name}")

    # 诊断
    have_title = sum(1 for r in rows if r.get("亚马逊item_name"))
    still_selling = sum(1 for r in rows if r.get("最新月仍在卖") == "1")
    have_first_month = sum(1 for r in rows if to_float(r.get("首月销量")) is not None and to_float(r.get("首月销量")) > 0)

    lines = [
        "# Data 补齐诊断\n",
        f"- 总记录: {len(rows)}",
        f"- 有 ASIN 的 unique 数: {stats['asin_total']}",
        f"- 补上亚马逊标题的记录: {have_title} ({have_title/len(rows):.1%})",
        f"- 最新月(2026-06)仍在卖: {still_selling}",
        f"- 有首月销量记录: {have_first_month}",
        "",
        "## 各聚合命中",
        f"- 最新周记录命中: {stats['latest_hit']}",
        f"- 最新月记录命中: {stats['latest_month_hit']}",
        f"- 全期聚合命中: {stats['agg_hit']}",
    ]
    DIAG.write_text("\n".join(lines), encoding="utf-8")
    print(f"[enrich] 诊断 → {DIAG.name}")
    print(f"[enrich] 有亚马逊标题 {have_title}/{len(rows)}  最新月仍在卖 {still_selling}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
