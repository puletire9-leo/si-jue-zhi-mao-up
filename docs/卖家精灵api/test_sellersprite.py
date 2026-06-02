"""
卖家精灵 API 测试程序
直接调用卖家精灵 API，不经过 Java 后端，保存返回数据。
用法: python test_sellersprite.py
"""
import json, time, sys, os
import urllib.request
from datetime import datetime

# ============================================================
# 配置
# ============================================================
API_URL = "https://api.sellersprite.com/v1/product/competitor-lookup"
SECRET_KEY = "d03bb00611a44f9ca30bf58205ac0f00"
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================================
# 查询参数（按需修改）
# ============================================================
REQUEST = {
    "marketplace": "UK",
    "asins": [
        "B0GQH3G8QR","B0GS5MYG8T","B0GSJST7S7","B0GS9828SZ","B0GS25KZK8",
        "B0GS23TZW3","B0GMQ6F777","B0GS5VJ623","B0GJZ67453","B0GG9LT6DB",
        "B0GJZ8Q63Q","B0GJZMQ47Y","B0GFDR8B3H","B0GFDPMQHT","B0GFD9KGZ1",
        "B0GDTB5ZFN","B0GDQCDK87"
    ],
    "page": 1,
    "size": 100,
    "order": {
        "field": "available_date",
        "desc": True
    }
}

# ============================================================
# 调用 API
# ============================================================
body = json.dumps(REQUEST, ensure_ascii=False).encode("utf-8")
req = urllib.request.Request(API_URL, data=body, headers={
    "secret-key": SECRET_KEY,
    "Content-Type": "application/json",
})

print(f"[{datetime.now()}] 调用卖家精灵 API...")
print(f"  Marketplace: {REQUEST['marketplace']}")
print(f"  Mode: ASIN批量查询")
print(f"  ASINs: {len(REQUEST.get('asins', []))} 个")
print()

start = time.time()

try:
    with urllib.request.urlopen(req, timeout=120) as resp:
        elapsed = time.time() - start
        raw = resp.read().decode("utf-8")
        data = json.loads(raw)
except Exception as e:
    elapsed = time.time() - start
    print(f"[FAIL] 请求失败 ({elapsed:.1f}s)")
    print(f"  错误: {e}")
    sys.exit(1)

code = data.get("code", "")
msg = data.get("message", "")
items = data.get("data", {}).get("items", [])
count = len(items)

print(f"[OK] code={code} msg={msg}")
print(f"  耗时: {elapsed:.1f}s")
print(f"  返回: {count} 条")
print()

# ============================================================
# 保存原始 JSON
# ============================================================
json_path = os.path.join(OUT_DIR, "api_response_asins.json")
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print(f"[SAVE] 原始 JSON → {json_path}")

# ============================================================
# 生成 Markdown 报告
# ============================================================
md = f"""# 卖家精灵 API 查询结果

> 查询时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
> API: `POST {API_URL}`
> 参数: marketplace={REQUEST['marketplace']}, asins=17个, size={REQUEST['size']}
> 响应: code={code}, message={msg}
> 耗时: {elapsed:.1f}s
> 返回数据: {count} 条

---

## 产品列表

"""

if count > 0:
    # 动态收集字段
    all_keys = set()
    for item in items:
        all_keys.update(k for k in item.keys() if not k.startswith("_"))
    # 关键字段优先
    priority = ["asin","title","brand","sellerName","sellerId","price","bsr","rating",
                "ratings","revenue","units","availableDate","fulfillment","lqs",
                "variations","weight","dimension","sellerNation","sellers"]
    cols = [c for c in priority if c in all_keys]
    other = sorted(all_keys - set(cols))
    cols += other

    md += "| # | " + " | ".join(cols) + " |\n"
    md += "|---|" + "|".join(["--" for _ in cols]) + "|\n"

    for i, item in enumerate(items, 1):
        vals = []
        for c in cols:
            v = item.get(c, "")
            if v is None:
                v = "-"
            elif c == "availableDate" and isinstance(v, (int, float)) and v > 0:
                from datetime import datetime as dt
                v = dt.fromtimestamp(v / 1000).strftime("%Y-%m-%d")
            elif isinstance(v, (int, float)):
                v = str(v)
            elif isinstance(v, (dict, list)):
                v = json.dumps(v, ensure_ascii=False)
            elif isinstance(v, str) and len(v) > 50:
                v = v[:47] + "..."
            vals.append(v)
        md += f"| {i} | " + " | ".join(vals) + " |\n"
else:
    md += "*(无数据)*\n"

md += f"""

---

## 原始 API 响应

完整 JSON: `{os.path.basename(json_path)}`

<details>
<summary>点击展开</summary>

```json
{json.dumps(data, ensure_ascii=False, indent=2)[:5000]}
```
</details>

---

## 请求详情

```json
{json.dumps({"url": API_URL, "headers": {"secret-key": SECRET_KEY[:8] + "***", "Content-Type": "application/json"}, "body": REQUEST}, ensure_ascii=False, indent=2)}
```
"""

md_path = os.path.join(OUT_DIR, "api_response_asins.md")
with open(md_path, "w", encoding="utf-8") as f:
    f.write(md)
print(f"[SAVE] Markdown → {md_path}")

print(f"\n[DONE] {count} 条产品已保存")
