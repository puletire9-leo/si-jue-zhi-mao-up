"""抽取每个 ASIN 的月度销售序列。

从 `lingxing_product_performance` 按 (asin, currency_code, year_month) 聚合。

产出:
  分析基础数据/ASIN_月度销售.csv         全量月度序列
  分析基础数据/ASIN_月度诊断.md          汇总统计

用法:
  python build_asin_monthly.py [--asin B0GWL7ZYBV,B0FWR7QJ12,...]
  不加 --asin 参数则抽取候选池 63 条

候选池口径:
  最新月(2026-06)销量 > 20 & tacos < 10% & 累计利润 > 0
"""
from __future__ import annotations

import argparse
import csv
import io
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

V3_ROOT = Path(__file__).resolve().parent.parent
BASE_DATA = V3_ROOT / "分析基础数据"
LIFECYCLE = V3_ROOT.parent / "第二版" / "理实开品经验" / "data" / "sku_full_lifecycle.csv"

OUT_CSV = BASE_DATA / "ASIN_月度销售.csv"
OUT_DIAG = BASE_DATA / "ASIN_月度诊断.md"


def run_mysql(sql: str) -> list[dict]:
    cmd = [
        "docker", "exec", "dev-mysql", "mysql", "-uroot", "-proot",
        "--default-character-set=utf8mb4", "-B", "-e", sql,
    ]
    r = subprocess.run(cmd, capture_output=True, timeout=180)
    if r.returncode != 0:
        print(f"[mysql err] {r.stderr.decode('utf-8','replace')}", file=sys.stderr)
        return []
    reader = csv.DictReader(io.StringIO(r.stdout.decode("utf-8", "replace")), delimiter="\t")
    return list(reader)


def to_float(v):
    if v in (None, "", "NULL"):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def pick_candidate_asins() -> list[str]:
    """候选池口径:最新月>20 & tacos<10% & 利润>0"""
    if not LIFECYCLE.exists():
        raise FileNotFoundError(f"缺少 {LIFECYCLE}")
    asins = set()
    with LIFECYCLE.open("r", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            try:
                m6 = float(row.get("最新月销量") or 0)
                tacos = to_float(row.get("最新周tacos"))
                profit = float(row.get("总结算利润") or 0)
                if m6 > 20 and tacos is not None and tacos < 0.10 and profit > 0:
                    a = row.get("ASIN")
                    if a:
                        asins.add(a)
            except (ValueError, TypeError):
                pass
    return sorted(asins)


def _batched(items: list[str], size: int = 400):
    for i in range(0, len(items), size):
        yield items[i:i + size]


def fetch_monthly(asins: list[str]) -> list[dict]:
    """按 (asin, currency, ym) 聚合。"""
    if not asins:
        return []
    all_rows: list[dict] = []
    for i, batch in enumerate(_batched(asins, 400)):
        quoted = ",".join(f"'{a}'" for a in batch)
        # SUM(gross_profit) + 用 SUM(gp)/SUM(amt) 重算 gross_margin,tacos 同理
        sql = (
            "USE sijuelishi_dev; "
            "SELECT asin, currency_code, "
            "DATE_FORMAT(start_date, '%Y-%m') as ym, "
            "COUNT(*) as weeks, "
            "SUM(volume) as vol, "
            "SUM(order_items) as orders, "
            "SUM(amount) as amt, "
            "SUM(gross_profit) as gp, "
            "SUM(spend) as spend, "
            "SUM(sessions_total) as sessions, "
            "MAX(item_name) as item_name "
            f"FROM lingxing_product_performance WHERE asin IN ({quoted}) "
            "GROUP BY asin, currency_code, ym ORDER BY asin, currency_code, ym;"
        )
        rows = run_mysql(sql)
        all_rows.extend(rows)
        print(f"[batch {i+1}] asins={len(batch)}, rows={len(rows)}")
    return all_rows


def enrich(rows: list[dict]) -> list[dict]:
    """派生字段:gross_margin, tacos, single_profit, single_profit_rate。"""
    for r in rows:
        vol = to_float(r.get("vol")) or 0
        amt = to_float(r.get("amt")) or 0
        gp = to_float(r.get("gp")) or 0
        spend = to_float(r.get("spend")) or 0
        r["gross_margin"] = f"{gp/amt:.4f}" if amt else ""
        r["tacos"] = f"{spend/amt:.4f}" if amt else ""
        r["single_profit"] = f"{gp/vol:.4f}" if vol else ""
        r["single_price"] = f"{amt/vol:.4f}" if vol else ""
    return rows


def diagnostics(rows: list[dict], asins: list[str]) -> str:
    """月度诊断汇总。"""
    lines = ["# ASIN 月度销售诊断\n"]
    lines.append(f"- 请求 ASIN 数: {len(asins)}")
    lines.append(f"- 命中月度记录: {len(rows)}")

    # 按 ASIN 分组
    by_asin: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by_asin[r["asin"]].append(r)
    lines.append(f"- 有月度数据的 ASIN: {len(by_asin)}")
    lines.append(f"- 缺失的 ASIN: {len(asins) - len(by_asin)}\n")

    # 币种分布
    cur_c: dict[str, int] = defaultdict(int)
    for r in rows:
        cur_c[r["currency_code"]] += 1
    lines.append("## 币种分布(月记录数)")
    for c, n in sorted(cur_c.items(), key=lambda x: -x[1]):
        lines.append(f"- {c}: {n}")
    lines.append("")

    # 月份覆盖
    ym_c: dict[str, int] = defaultdict(int)
    for r in rows:
        if to_float(r.get("vol")) and to_float(r.get("vol")) > 0:
            ym_c[r["ym"]] += 1
    lines.append("## 月份覆盖(有销量的 ASIN 数)")
    for ym in sorted(ym_c.keys()):
        lines.append(f"- {ym}: {ym_c[ym]}")
    lines.append("")

    # 缺失 ASIN 列表
    missing = [a for a in asins if a not in by_asin]
    if missing:
        lines.append("## 缺失月度数据的 ASIN")
        for a in missing[:20]:
            lines.append(f"- {a}")
        if len(missing) > 20:
            lines.append(f"- ...还有 {len(missing)-20}")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--asin", help="逗号分隔 ASIN 列表;不填则用候选池 63 条")
    args = ap.parse_args()

    BASE_DATA.mkdir(parents=True, exist_ok=True)

    if args.asin:
        asins = [a.strip() for a in args.asin.split(",") if a.strip()]
    else:
        asins = pick_candidate_asins()
    print(f"[monthly] 待抽 {len(asins)} 个 ASIN")

    rows = fetch_monthly(asins)
    rows = enrich(rows)

    # 写 CSV(合并模式:保留已有 ASIN,新 ASIN 追加/覆盖)
    fields = ["asin", "currency_code", "ym", "weeks", "vol", "orders", "amt",
              "gp", "spend", "sessions", "gross_margin", "tacos",
              "single_profit", "single_price", "item_name"]
    existing: dict[tuple, dict] = {}
    if OUT_CSV.exists():
        with OUT_CSV.open("r", encoding="utf-8-sig") as f:
            for row in csv.DictReader(f):
                key = (row["asin"], row["currency_code"], row["ym"])
                existing[key] = row
        print(f"[monthly] 读入已有 {len(existing)} 行,合并本次 {len(rows)} 新行")
    for r in rows:
        key = (r["asin"], r["currency_code"], r["ym"])
        existing[key] = r
    merged = sorted(existing.values(), key=lambda x: (x["asin"], x["currency_code"], x["ym"]))
    if merged:
        with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
            w.writeheader()
            w.writerows(merged)
        print(f"[monthly] 合并写入 {OUT_CSV.name} 共 {len(merged)} 行")

    OUT_DIAG.write_text(diagnostics(rows, asins), encoding="utf-8")
    print(f"[monthly] 诊断 → {OUT_DIAG.name}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
