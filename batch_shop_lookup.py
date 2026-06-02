"""
按店铺名批量查询卖家精灵 API → 保存原始 JSON
用法: python batch_shop_lookup.py [输入文件] [保存目录]
默认: 产品数据/邓总店铺/1.md → 产品数据/邓总店铺/保存数据/
"""
import json, sys, io, time, os, urllib.request, urllib.error

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

API_URL = "https://api.sellersprite.com/v1/product/competitor-lookup"
SECRET_KEY = "d03bb00611a44f9ca30bf58205ac0f00"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_INPUT = os.path.join(SCRIPT_DIR, "产品数据", "邓总店铺", "1.md")
DEFAULT_OUTPUT = os.path.join(SCRIPT_DIR, "产品数据", "邓总店铺", "保存数据")
PAGE_SIZE = 100
REQUEST_DELAY = 2.0       # 每个店铺间隔（秒）
PAGE_DELAY = 0.5          # 分页间隔（秒）
MAX_RETRIES = 3           # 限流重试次数
RETRY_BASE_WAIT = 3       # 重试基础等待（秒）


def call_api(shop_name, marketplace, page=1, size=PAGE_SIZE):
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
    took_ms = int((time.time() - start) * 1000)
    return data, took_ms


def is_rate_limited(data, took_ms):
    """检测是否被限流：total > 0 但 items 为空，或响应时间 < 200ms"""
    total = data.get("data", {}).get("total", 0)
    items = data.get("data", {}).get("items", [])
    if total > 0 and not items:
        return True
    if total == 0 and took_ms < 200:
        return True  # 可能是限流返回的假空
    return False


def fetch_all_pages(shop_name, marketplace):
    all_items = []
    page = 1
    while True:
        for retry in range(MAX_RETRIES):
            data, took_ms = call_api(shop_name, marketplace, page=page)
            total = data.get("data", {}).get("total", 0)
            items = data.get("data", {}).get("items", [])

            if is_rate_limited(data, took_ms) and retry < MAX_RETRIES - 1:
                wait = RETRY_BASE_WAIT * (retry + 1)
                print(f"    page={page} 疑似限流 (total={total}, items={len(items)}, {took_ms}ms)，等待 {wait}s 重试...")
                time.sleep(wait)
                continue

            print(f"    page={page}: total={total}, got={len(items)}, {took_ms}ms")
            break
        else:
            print(f"    page={page}: 重试耗尽，跳过")
            break

        if not items:
            break
        all_items.extend(items)
        if len(all_items) >= total:
            break
        page += 1
        time.sleep(PAGE_DELAY)

    return all_items


def read_shop_list(filepath):
    shops = []
    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) >= 2:
                shops.append((parts[0].strip(), parts[1].strip()))
    return shops


def main():
    input_file = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_INPUT
    output_dir = sys.argv[2] if len(sys.argv) > 2 else DEFAULT_OUTPUT
    os.makedirs(output_dir, exist_ok=True)

    shops = read_shop_list(input_file)
    print(f"输入: {input_file}")
    print(f"输出: {output_dir}")
    print(f"共 {len(shops)} 个店铺\n")

    stats = {"有数据": [], "无数据": [], "跳过": []}

    for i, (marketplace, seller_name) in enumerate(shops, 1):
        print(f"[{i}/{len(shops)}] {marketplace} - {seller_name}")

        safe_name = seller_name.replace("/", "_").replace("\\", "_").replace(" ", "_")
        filename = f"{marketplace}_{safe_name}.json"
        filepath = os.path.join(output_dir, filename)

        if os.path.exists(filepath):
            print(f"    已存在，跳过")
            stats["跳过"].append(f"{marketplace} {seller_name}")
            continue

        try:
            items = fetch_all_pages(seller_name, marketplace)
            print(f"    结果: {len(items)} 条")

            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(items, f, ensure_ascii=False, indent=2)

            if items:
                stats["有数据"].append(f"{marketplace} {seller_name}: {len(items)}条")
            else:
                stats["无数据"].append(f"{marketplace} {seller_name}")
        except Exception as e:
            print(f"    失败: {e}")
            stats["无数据"].append(f"{marketplace} {seller_name} (错误)")

        if i < len(shops):
            time.sleep(REQUEST_DELAY)

    print(f"\n{'='*40}")
    print(f"有数据: {len(stats['有数据'])} 个")
    print(f"无数据: {len(stats['无数据'])} 个")
    print(f"跳过:   {len(stats['跳过'])} 个")
    if stats["无数据"]:
        print("\n无数据店铺:")
        for s in stats["无数据"]:
            print(f"  {s}")
    print("\n--- 完成 ---")


if __name__ == "__main__":
    main()
