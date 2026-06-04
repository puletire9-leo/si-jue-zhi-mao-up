"""
按店铺名查询卖家精灵 API → 存入 dev MySQL deng_zong_shop 表
"""
import json, sys, io, time, urllib.request, urllib.error
import pymysql

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API_URL = "https://api.sellersprite.com/v1/product/competitor-lookup"
SECRET_KEY = "d03bb00611a44f9ca30bf58205ac0f00"
SHOP_NAME = "CLX-UK"
MARKETPLACE = "UK"
DB = dict(host="127.0.0.1", port=3307, user="sijue", password="sijue123456",
          database="sijuelishi_dev", charset="utf8mb4")

COLS = [
    "marketplace","asin","month","title","brand","brand_url","image_url",
    "parent_asin","sku","node_id","node_id_path","node_label_path","symbol",
    "units","units_gr","amz_unit","amz_sales","amz_unit_date","revenue",
    "bsr_id","bsr","bsr_cr","bsr_cv","ratings","rating","ratings_rate",
    "ratings_cv","rating_delta","price","prime_price","profit","fba",
    "delivery_price","seller_name","seller_id","seller_nation","sellers",
    "fulfillment","variations","weight","dimension","dimensions_type",
    "pkg_dimensions","pkg_dimension_type","pkg_weight","lqs","available_date",
    "best_seller","amazon_choice","new_release","ebc","video",
    "product_url","similar_url","source",
]

API_MAP = [
    "marketplace","asin","month","title","brand","brandUrl","imageUrl",
    "parent","sku","nodeId","nodeIdPath","nodeLabelPath","symbol",
    "units","unitsGr","amzUnit","amzSales","amzUnitDate","revenue",
    "bsrId","bsr","bsrCr","bsrCv","ratings","rating","ratingsRate",
    "ratingsCv","ratingDelta","price","primePrice","profit","fba",
    "deliveryPrice","sellerName","sellerId","sellerNation","sellers",
    "fulfillment","variations","weight","dimension","dimensionsType",
    "pkgDimensions","pkgDimensionType","pkgWeight","lqs","availableDate",
    "badge.bestSeller","badge.amazonChoice","badge.newRelease","badge.ebc","badge.video",
    "productUrl","similarUrl","source",
]


def get_nested(item, key):
    if '.' in key:
        parts = key.split('.', 1)
        return get_nested(item.get(parts[0], {}), parts[1])
    return item.get(key)


def safe_val(val, max_len=None):
    if val is None or val == -1.0:
        return None
    s = str(val)
    s = s.replace('%', '%%')
    if max_len and len(s) > max_len:
        s = s[:max_len]
    return s


def build_row(item, month):
    row = []
    for api_key in API_MAP:
        v = get_nested(item, api_key)
        if api_key == "month":
            v = month
        elif api_key == "marketplace":
            v = item.get("marketplace", MARKETPLACE)
        elif api_key == "parent":
            v = item.get("parent", item.get("parentAsin"))
        row.append(safe_val(v))
    return tuple(row)


def call_api(shop_name, marketplace, page=1, size=100):
    body = json.dumps({
        "marketplace": marketplace, "brand": None, "sellerName": shop_name,
        "asins": [], "nodeIdPath": None, "nodeIdPathEqual": None,
        "keyword": None, "matchType": None, "variation": "N",
        "page": page, "size": size, "orderField": None, "orderDesc": True,
    }, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(API_URL, data=body, headers={
        "secret-key": SECRET_KEY, "Content-Type": "application/json",
    }, method="POST")
    start = time.time()
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return data, int((time.time() - start) * 1000)


def insert_items(items, month):
    conn = pymysql.connect(**DB)
    try:
        with conn.cursor() as cur:
            placeholders = ", ".join(["%s"] * len(COLS))
            sql = f"INSERT INTO deng_zong_shop ({', '.join(COLS)}) VALUES ({placeholders})"
            ok = 0
            for item in items:
                try:
                    cur.execute(sql, build_row(item, month))
                    ok += 1
                except Exception as e:
                    print(f"  [WARN] {item.get('asin','?')}: {e}")
            conn.commit()
            return ok
    finally:
        conn.close()


# ===== 主流程 =====
print(f"=== 查询店铺: {SHOP_NAME} (marketplace={MARKETPLACE}) ===\n")
all_items, page = [], 1
while True:
    print(f"请求第 {page} 页...")
    data, ms = call_api(SHOP_NAME, MARKETPLACE, page=page, size=100)
    print(f"  耗时: {ms}ms")
    if data.get("error"):
        print(f"  ERROR: {data}"); break
    total = data.get("data", {}).get("total", 0)
    items = data.get("data", {}).get("items", [])
    print(f"  total={total}, 本页={len(items)} 条")
    if not items: break
    all_items.extend(items)
    if len(all_items) >= total: break
    page += 1
    time.sleep(0.3)

print(f"\n总共获取: {len(all_items)} 条")
if all_items:
    with open("产品数据/shop-clx-uk-raw.json", "w", encoding="utf-8") as f:
        json.dump(all_items, f, ensure_ascii=False, indent=2)
    month = time.strftime("%Y%m")
    count = insert_items(all_items, month)
    print(f"已插入: {count} 条 → deng_zong_shop 表")
    print(f"\n前5条:")
    for item in all_items[:5]:
        print(f"  {item.get('asin',''):<14} price={item.get('price','')} bsr={item.get('bsr','')} units={item.get('units','')}")
print("\n--- 完成 ---")
