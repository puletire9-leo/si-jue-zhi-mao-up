"""对比店铺查询 vs ASIN查询结果"""
import json
from datetime import datetime

store = json.load(open(r'E:\项目\si-jue-zhi-mao-up\docs\卖家精灵api\api_response_raw.json', 'r', encoding='utf-8'))
asins_m = json.load(open(r'E:\项目\si-jue-zhi-mao-up\docs\卖家精灵api\api_response_asins.json', 'r', encoding='utf-8'))

s = {i['asin']: i for i in store['data']['items']}
a = {i['asin']: i for i in asins_m['data']['items']}
shared = sorted(set(s) & set(a))

print("=" * 70)
print(f"店铺模式: {len(s)} ASIN, ASIN模式: {len(a)} ASIN, 共同: {len(shared)}")
print(f"仅在店铺中: {set(s) - set(a)}")
print(f"仅在ASIN中: {set(a) - set(s)}")
print()

print("=" * 70)
print("availableDate (上架时间) - 全部16个都不同!")
print("=" * 70)
for x in shared[:3]:
    sv = s[x]['availableDate']
    av = a[x]['availableDate']
    sd = datetime.fromtimestamp(sv / 1000).strftime('%Y-%m-%d')
    ad = datetime.fromtimestamp(av / 1000).strftime('%Y-%m-%d')
    diff_days = (av - sv) / 86400000
    print(f"  {x}: 店铺={sd}  ASIN={ad}  (相差 {diff_days:+.0f} 天)")
print("  ...")

def show_diff(field, label=None):
    header = label or field
    diffs = [(x, s[x].get(field), a[x].get(field)) for x in shared if s[x].get(field) != a[x].get(field)]
    if diffs:
        print()
        print(f"{header}: {len(diffs)}/{len(shared)} 不同")
        for asin, sv, av in diffs:
            print(f"  {asin}: 店铺={sv}  vs  ASIN={av}")

show_diff('bsr', 'BSR排名')
show_diff('price', '售价')
show_diff('revenue', '月销额')

print()
print("=" * 70)
print("一致性检查: 静态字段 (brand, title, imageUrl, dimension, weight...)")
print("=" * 70)
static_fields = ['brand', 'title', 'brandUrl', 'imageUrl', 'sku', 'dimension',
                 'weight', 'pkgDimensions', 'pkgWeight', 'fulfillment',
                 'sellerName', 'sellerId', 'sellerNation', 'lqs',
                 'parent', 'nodeId', 'nodeLabelPath', 'nodeIdPath', 'symbol']
same = 0
for f in static_fields:
    all_same = all(s[x].get(f) == a[x].get(f) for x in shared)
    if all_same:
        same += 1
    else:
        print(f"  [DIFF] {f}: 有不一致的")
print(f"  静态字段完全一致: {same}/{len(static_fields)}")

print()
print("=" * 70)
print("结论:")
print("  1. B0GS5MYG8T 在ASIN批量查询中不存在(可能下架或API差异)")
print("  2. availableDate 全部不同 (实时变化? API版本?)")
print("  3. BSR/price/revenue 有小幅波动 (正常实时数据)")
print("  4. 静态字段(item/brand/dimension等) 完全一致")
