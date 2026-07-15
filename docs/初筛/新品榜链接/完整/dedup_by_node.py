#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
站内去重：按子类榜单 node id 对 us/uk/de.md 各自去重，保留首条。

去重口径（与用户确认）：
  - 子类 node id = URL 中 /new-releases/{slug}/{node_id}/ 的 {node_id}。
  - 同一文件内同一 node id 出现多次（ref 父类段不同、名称相同）视为重复，只保留首次出现的那一行。
  - 三站各自独立去重，不跨站合并（US/UK/DE 的 node 体系不完全重合）。
  - 无效行（无 http URL、URL 解析不出 node id）原样保留并单列统计，避免误删异常数据。

输出两套：
  - ./去重/{us,uk,de}.md          原始格式（名称\tURL），去重后
  - ./去重/纯链接_{us,uk,de}.txt   每行一个 URL，无名称无表头

输入：./{us,uk,de}.md
输出：./去重/{us,uk,de}.md + ./去重/纯链接_{us,uk,de}.txt + ./去重/_去重报告.md
"""
import re
from pathlib import Path

NODE_RE = re.compile(r"/new-releases/[^/]+/(\d+)/")

SITES = ["us", "uk", "de"]
HERE = Path(__file__).resolve().parent
OUT_DIR = HERE / "去重"


def main():
    OUT_DIR.mkdir(exist_ok=True)
    report = ["# 新品榜链接站内去重报告（按子类 node id）\n",
              "> 口径：URL 中 /new-releases/{slug}/{node_id}/ 的 node_id；同文件内同 id 只留首条；三站独立。\n"]
    for site in SITES:
        src = HERE / f"{site}.md"
        if not src.exists():
            report.append(f"\n## {site.upper()}：源不存在，跳过\n")
            continue
        raw_lines = src.read_text(encoding="utf-8", errors="replace").splitlines()

        seen = set()
        kept, dropped_dup, no_node = [], 0, []
        header = None
        for idx, line in enumerate(raw_lines):
            if idx == 0 and not re.search(r"https?://", line):
                # 首行表头（不含 URL），保留并跳过去重统计
                header = line
                continue
            if not line.strip():
                continue
            m = NODE_RE.search(line)
            if not m:
                no_node.append(line)
                kept.append(line)  # 解析不出 node id 的行原样保留，避免误删
                continue
            node_id = m.group(1)
            if node_id in seen:
                dropped_dup += 1
                continue
            seen.add(node_id)
            kept.append(line)

        out_lines = []
        if header is not None:
            out_lines.append(header)
        out_lines.extend(kept)
        (OUT_DIR / f"{site}.md").write_text("\n".join(out_lines) + "\n", encoding="utf-8")

        # 纯链接版：每行一个 URL，无名称无表头
        pure_urls = []
        for ln in kept:
            parts = ln.split("\t")
            url = parts[-1].strip()
            if url.startswith("http"):
                pure_urls.append(url)
        (OUT_DIR / f"纯链接_{site}.txt").write_text("\n".join(pure_urls) + "\n", encoding="utf-8")

        total_url = sum(1 for ln in raw_lines if re.search(r"https?://", ln))
        uniq = len(seen)
        report.append(
            f"\n## {site.upper()}：总 URL 行 {total_url} → 去重后 {uniq}（剔除重复 {dropped_dup}）\n"
        )
        report.append(f"- 解析不出 node id 的行：{len(no_node)}（已原样保留）\n")
        if no_node[:3]:
            report.append("- 样例：\n")
            for s in no_node[:3]:
                report.append(f"  - `{s[:120]}`\n")
        print(f"=== {site.upper()}: URL 行 {total_url} -> 去重 {uniq} (剔除 {dropped_dup}, 无node {len(no_node)}) ===")

    (OUT_DIR / "_去重报告.md").write_text("".join(report), encoding="utf-8")
    print("\n完成。输出目录：", OUT_DIR)


if __name__ == "__main__":
    main()
