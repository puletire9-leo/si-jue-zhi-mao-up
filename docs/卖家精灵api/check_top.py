import json

s = json.load(open(r'E:\项目\si-jue-zhi-mao-up\docs\卖家精灵api\api_response_raw.json', 'r', encoding='utf-8'))
a = json.load(open(r'E:\项目\si-jue-zhi-mao-up\docs\卖家精灵api\api_response_asins.json', 'r', encoding='utf-8'))

print("=== Top-level keys ===")
print("Store mode:", list(s.keys()))
print("ASIN mode :", list(a.keys()))

print()
print("=== Data-level keys ===")
print("Store mode:", list(s['data'].keys()))
print("ASIN mode :", list(a['data'].keys()))

print()
print("=== Store data (non-items) ===")
for k, v in s['data'].items():
    if k == 'items':
        print(f"  items: {len(v)} products")
    else:
        print(f"  {k}: {v}")

print()
print("=== ASIN data (non-items) ===")
for k, v in a['data'].items():
    if k == 'items':
        print(f"  items: {len(v)} products")
    else:
        print(f"  {k}: {v}")

print()
print("=== Per-item field count ===")
if s['data']['items']:
    print(f"Store item fields ({len(s['data']['items'][0])}):", sorted(s['data']['items'][0].keys()))
if a['data']['items']:
    print(f"ASIN  item fields ({len(a['data']['items'][0])}):", sorted(a['data']['items'][0].keys()))

# Check if store query returns seller-level info not in items
print()
print("=== Extra data in store query? ===")
store_only_keys = set(s['data'].keys()) - set(a['data'].keys())
asin_only_keys = set(a['data'].keys()) - set(s['data'].keys())
print("Store-only data keys:", store_only_keys if store_only_keys else "NONE")
print("ASIN-only data keys:", asin_only_keys if asin_only_keys else "NONE")
