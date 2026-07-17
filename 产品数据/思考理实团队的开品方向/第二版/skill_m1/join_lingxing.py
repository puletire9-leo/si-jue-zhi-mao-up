"""M1 摸底 · Step 2:拼接对接表 SKU 到 dev-mysql 的 lingxing_local_product。

产出:
  duijie_with_lingxing.csv  — 对接表 157 条 + 领星图 URL + 领星侧采购价 + 匹配状态
  join_diagnostics.md       — 匹配率、采购价偏差分布、缺失原因清单
"""
from __future__ import annotations

import csv
import io
import subprocess
import sys
from pathlib import Path
from collections import Counter
from statistics import median

SRC = Path("F:/项目/si-jue-zhi-mao-up/analysis/skill_m1/duijie_06_30.csv")
DST = Path("F:/项目/si-jue-zhi-mao-up/analysis/skill_m1/duijie_with_lingxing.csv")
DIAG = Path("F:/项目/si-jue-zhi-mao-up/analysis/skill_m1/join_diagnostics.md")


def read_duijie() -> list[dict]:
    with SRC.open("r", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def query_lingxing(skus: list[str]) -> dict[str, dict]:
    """一次性拉出所有 sku 在领星表的记录。"""
    # SKU 列表转 SQL IN 子句
    quoted = ",".join(f"'{s}'" for s in skus if s)
    sql = (
        f"USE sijuelishi_dev; "
        f"SELECT sku, product_developer, pic_url, cg_price, status_text, open_status, "
        f"lx_create_time, lx_update_time "
        f"FROM lingxing_local_product WHERE sku IN ({quoted});"
    )
    cmd = [
        "docker", "exec", "dev-mysql", "mysql", "-uroot", "-proot",
        "--default-character-set=utf8mb4", "-B", "-e", sql,
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=60)
    if result.returncode != 0:
        print(f"mysql err: {result.stderr.decode('utf-8', 'replace')}", file=sys.stderr)
        sys.exit(1)
    text = result.stdout.decode("utf-8", "replace")
    reader = csv.DictReader(io.StringIO(text), delimiter="\t")
    out: dict[str, dict] = {}
    for row in reader:
        out[row["sku"]] = row
    return out


def to_float(v) -> float | None:
    if v in (None, "", "NULL"):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def main() -> int:
    duijie = read_duijie()
    skus = [r["SKU"] for r in duijie]
    lx = query_lingxing(skus)

    # 汇总匹配
    matched = 0
    dev_mismatch = 0
    price_diffs: list[float] = []
    unmatched_rows: list[dict] = []

    for r in duijie:
        sku = r["SKU"]
        lxr = lx.get(sku)
        if lxr:
            matched += 1
            r["lx_pic_url"] = lxr.get("pic_url") or ""
            r["lx_developer"] = lxr.get("product_developer") or ""
            r["lx_cg_price"] = lxr.get("cg_price") or ""
            r["lx_status_text"] = lxr.get("status_text") or ""
            r["lx_open_status"] = lxr.get("open_status") or ""
            # 采购价偏差
            dj = to_float(r.get("采购价¥"))
            lxp = to_float(lxr.get("cg_price"))
            if dj is not None and lxp is not None and dj > 0:
                diff_ratio = (lxp - dj) / dj
                r["采购价偏差率"] = f"{diff_ratio:.4f}"
                price_diffs.append(diff_ratio)
            else:
                r["采购价偏差率"] = ""
            # 开发人一致性
            if r.get("开发") and lxr.get("product_developer") and r["开发"] != lxr["product_developer"]:
                dev_mismatch += 1
        else:
            r["lx_pic_url"] = r["lx_developer"] = r["lx_cg_price"] = ""
            r["lx_status_text"] = r["lx_open_status"] = r["采购价偏差率"] = ""
            unmatched_rows.append(r)

    # 写扩展 CSV
    fields = list(duijie[0].keys())
    with DST.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(duijie)

    # 写诊断报告
    lines: list[str] = []
    lines.append("# M1 · Step 2 数据拼接诊断报告\n")
    lines.append(f"- 对接表 SKU: **{len(duijie)}**")
    lines.append(f"- 命中领星表: **{matched} ({matched/len(duijie):.1%})**")
    lines.append(f"- 未命中: **{len(unmatched_rows)}**")
    lines.append(f"- 开发人不一致: **{dev_mismatch}** 条(对接表 vs 领星)")
    lines.append("")
    # 采购价偏差分布
    if price_diffs:
        exact = sum(1 for d in price_diffs if abs(d) < 0.001)
        within_5 = sum(1 for d in price_diffs if abs(d) <= 0.05)
        within_20 = sum(1 for d in price_diffs if abs(d) <= 0.20)
        lines.append("## 采购价偏差(领星 vs 对接表)")
        lines.append("")
        lines.append(f"- 有效对比样本: {len(price_diffs)}")
        lines.append(f"- 完全一致(<0.1%): {exact} ({exact/len(price_diffs):.1%})")
        lines.append(f"- 偏差 ≤ 5%: {within_5} ({within_5/len(price_diffs):.1%})")
        lines.append(f"- 偏差 ≤ 20%: {within_20} ({within_20/len(price_diffs):.1%})")
        lines.append(f"- 偏差中位数: {median(price_diffs):.4f}")
        lines.append(f"- 偏差极值: min={min(price_diffs):.4f} / max={max(price_diffs):.4f}")
        lines.append("")
    # 未命中样本
    if unmatched_rows:
        lines.append("## 未命中 SKU 明细")
        lines.append("")
        lines.append("| SKU | 开发 | 站点 | 产品名称 |")
        lines.append("|---|---|---|---|")
        for r in unmatched_rows[:30]:
            name = (r.get("产品名称") or "")[:40]
            lines.append(f"| {r['SKU']} | {r.get('开发','')} | {r.get('站点','')} | {name} |")
        if len(unmatched_rows) > 30:
            lines.append(f"\n> 另有 {len(unmatched_rows)-30} 条未列出。")
        lines.append("")

    # 有图的样本预览
    with_pic = [r for r in duijie if r.get("lx_pic_url")]
    lines.append("## 领星图片覆盖")
    lines.append("")
    lines.append(f"- 命中后有图: **{len(with_pic)}/{matched} ({len(with_pic)/matched:.1%})**" if matched else "无")
    lines.append("")
    lines.append("## 关键结论")
    lines.append("")
    if matched / len(duijie) >= 0.9:
        lines.append("- 匹配率 ≥ 90%,可以直接进入聚类阶段。")
    elif matched / len(duijie) >= 0.7:
        lines.append("- 匹配率一般,聚类可用,但需要关注未命中的 SKU 是否有共同特征。")
    else:
        lines.append("- 匹配率偏低,建议排查 SKU 命名规范或数据同步问题。")

    DIAG.write_text("\n".join(lines), encoding="utf-8")

    print(f"[join] matched={matched}/{len(duijie)} unmatched={len(unmatched_rows)}")
    print(f"[join] with_pic={len(with_pic)}/{matched}" if matched else "[join] no matched")
    print(f"[join] dev_mismatch={dev_mismatch}")
    print(f"[join] CSV → {DST}")
    print(f"[join] Diag → {DIAG}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
