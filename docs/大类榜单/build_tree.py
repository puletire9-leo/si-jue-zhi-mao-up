# -*- coding: utf-8 -*-
"""
从 competitor_products (source=新品榜) 导出的 TSV 构建类目树。
- 按国家(marketplace)分树
- 层级 = node_label_path 用 ':' 拆分的完整路径 (3~8 级)
- 每个节点商品数 = 去重 ASIN 数 (含子孙, 用集合并集保证父节点计数准确)
输入: _tree_raw.tsv  列: marketplace, asin, bsr_id, node_id_path, node_label_path
输出: tree_<country>.json
"""
import csv, json, sys
from pathlib import Path

BASE = Path(__file__).parent
SRC = BASE / "_tree_raw.tsv"

csv.field_size_limit(10_000_000)

# 树节点: 每个节点持有一个 asin 集合(仅落在该精确路径上的直接 asin)
# 结构: nodes[country] -> dict(key=label元组) -> {"label", "node_id", "children":set(labels), "asins":set()}
class Node:
    __slots__ = ("label", "node_id", "bsr_id", "children", "asins")
    def __init__(self, label):
        self.label = label
        self.node_id = None
        self.bsr_id = None
        self.children = {}      # label -> Node
        self.asins = set()      # 直接挂在此路径末端的 asin

roots = {}   # country -> Node(虚拟根)

def get_root(country):
    if country not in roots:
        roots[country] = Node("__ROOT__")
    return roots[country]

row_count = 0
skipped = 0
with open(SRC, encoding="utf-8", newline="") as f:
    reader = csv.reader(f, delimiter="\t")
    for row in reader:
        if len(row) < 5:
            skipped += 1
            continue
        country, asin, bsr_id, id_path, label_path = row[0], row[1], row[2], row[3], row[4]
        if not label_path or label_path == "NULL":
            skipped += 1
            continue
        labels = [x.strip() for x in label_path.split(":") if x.strip()]
        ids = id_path.split(":") if id_path and id_path != "NULL" else []
        if not labels:
            skipped += 1
            continue
        node = get_root(country)
        for i, lab in enumerate(labels):
            if lab not in node.children:
                node.children[lab] = Node(lab)
            node = node.children[lab]
            # 记录该级的 node_id (取路径对应位)
            if i < len(ids) and node.node_id is None:
                node.node_id = ids[i]
            if i == 0 and node.bsr_id is None:
                node.bsr_id = bsr_id
        node.asins.add(asin)   # 只挂在最深已知节点
        row_count += 1

def collect_asins(node):
    """返回该节点子树的去重 asin 集合(含自身直接 asin + 所有子孙)"""
    s = set(node.asins)
    for c in node.children.values():
        s |= collect_asins(c)
    return s

def to_dict(node, depth):
    asins = collect_asins(node)
    d = {
        "label": node.label,
        "node_id": node.node_id,
        "level": depth,
        "product_count": len(asins),   # 去重 asin
        "direct_count": len(node.asins),
    }
    if depth == 1 and node.bsr_id:
        d["bsr_id"] = node.bsr_id
    if node.children:
        d["children"] = [
            to_dict(c, depth + 1)
            for c in sorted(node.children.values(),
                            key=lambda n: len(collect_asins(n)), reverse=True)
        ]
    return d

summary = {}
for country, root in roots.items():
    tree = {
        "country": country,
        "source": "新品榜",
        "total_products": len(collect_asins(root)),
        "top_categories": len(root.children),
        "children": [
            to_dict(c, 1)
            for c in sorted(root.children.values(),
                            key=lambda n: len(collect_asins(n)), reverse=True)
        ],
    }
    out = BASE / f"tree_{country}.json"
    out.write_text(json.dumps(tree, ensure_ascii=False, indent=2), encoding="utf-8")
    summary[country] = {
        "file": out.name,
        "total_products(去重ASIN)": tree["total_products"],
        "大类数": tree["top_categories"],
    }

print(f"处理行数={row_count} 跳过={skipped}")
print(json.dumps(summary, ensure_ascii=False, indent=2))
