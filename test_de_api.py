"""
直接调用卖家精灵 API — 参数与 Java 后端完全一致，仅 marketplace 不同
"""
import json, sys, io, time, urllib.request, urllib.error

# 解决 Windows GBK 编码问题
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API_URL = "https://api.sellersprite.com/v1/product/competitor-lookup"
SECRET_KEY = "d03bb00611a44f9ca30bf58205ac0f00"

ASINS = [
    "B0GVH1B8ZH", "B0GSQ5T2QF", "B0GV2JKSTR", "B0GTZBDFNV",
    "B0GWJ52HRG", "B0GT8TQZDV", "B0GT9QMS9L", "B0GWJS48GK",
    "B0DG9F7JVJ", "B0GZ2P48J2", "B0GVYHNVW3", "B0GW3DNM1G",
    "B0GS2H6KVZ", "B0H25YTF8C", "B0GXLHBM9Z", "B0GX6L5KBS",
    "B0GVQ9JRB6", "B0GY4HDM4N", "B0H1YT9HVX", "B0GVL53QLC",
    "B0GWKTPNR7", "B0GK69F9H3", "B0GSFCTJ75", "B0GYMMN8RC",
    "B0GXN472Z1", "B0GJKSYT3W", "B0GYFBW177", "B0GYDRMZYW",
    "B0GV1W6BV1", "B0GTYPVMTH", "B0GXWTLLW2", "B0H1C968PH",
    "B0H1C37YHL", "B0GV9LD6MY", "B0GFDWWJWT", "B0GVGD7PFR",
    "B0GXB6BWDC", "B0GRBZL3KN",
]


def call_api(marketplace):
    """参数与 AsinImportService 完全一致：variation=N, size=100"""
    body_obj = {
        "marketplace": marketplace,
        "brand": None,
        "sellerName": None,
        "asins": ASINS,
        "nodeIdPath": None,
        "nodeIdPathEqual": None,
        "keyword": None,
        "matchType": None,
        "variation": "N",
        "page": 1,
        "size": 100,
        "orderField": None,
        "orderDesc": True,
    }
    body = json.dumps(body_obj, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        API_URL,
        data=body,
        headers={
            "secret-key": SECRET_KEY,
            "Content-Type": "application/json",
        },
        method="POST",
    )

    start = time.time()
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            elapsed = int((time.time() - start) * 1000)
            return data, elapsed
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        elapsed = int((time.time() - start) * 1000)
        return {"error": True, "status": e.code, "body": err_body}, elapsed


def show_items(data, label, count=5):
    items = data.get("data", {}).get("items", [])
    if not items:
        print(f"  {label}: 无数据")
        return
    print(f"  {label}: 共 {len(items)} 条, 展示前 {min(count, len(items))} 条:")
    print(f"  {'ASIN':<14} {'price':>10} {'currency':>8}  title")
    print(f"  {'-'*14} {'-'*10} {'-'*8}  {'-'*50}")
    for item in items[:count]:
        asin = item.get("asin", "-") or "-"
        price = item.get("price", "-")
        currency = item.get("currency", "-") or "-"
        title = (item.get("title") or "")[:60]
        print(f"  {asin:<14} {str(price):>10} {str(currency):>8}  {title}")


# ===== 只请求 DE =====
print(f"请求 {len(ASINS)} 个 ASIN（参数与 Java 后端一致，仅 marketplace=DE）...")
de_data, de_ms = call_api("DE")
print(f"耗时: {de_ms}ms")

if de_data.get("error"):
    print(f"ERROR: {de_data}")
else:
    code = de_data.get("code", "?")
    total = de_data.get("data", {}).get("total", 0)
    items = de_data.get("data", {}).get("items", [])
    print(f"code={code}, total={total}, items={len(items)}")

    # 保存
    with open("产品数据/de-raw-response.json", "w", encoding="utf-8") as f:
        json.dump(de_data, f, ensure_ascii=False, indent=2)
    print("已保存: 产品数据/de-raw-response.json")

    # 展示
    show_items(de_data, "DE")

    # 货币分布
    currencies = {}
    for item in items:
        c = str(item.get("currency", "?"))
        p = item.get("price")
        currencies[c] = currencies.get(c, [])
        currencies[c].append(p)
    print(f"\n货币分布:")
    for c, prices in sorted(currencies.items()):
        print(f"  {c}: {len(prices)} 条, 范围 {min(prices)} ~ {max(prices)}")

    # 所有字段名
    all_fields = set()
    for item in items:
        all_fields.update(item.keys())
    print(f"\n字段 ({len(all_fields)}): {sorted(all_fields)}")

print("\n--- 完成 ---")
