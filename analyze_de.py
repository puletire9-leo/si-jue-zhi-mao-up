import json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open(r'E:\项目\si-jue-zhi-mao-up\产品数据\de-raw-response.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

items = data['data']['items']
print(f'共 {len(items)} 条\n')

# symbol distribution
symbols = {}
for item in items:
    s = item.get('symbol')
    p = item.get('price')
    key = str(s)
    if key not in symbols:
        symbols[key] = []
    symbols[key].append(p)
print('symbol 分布:')
for s, prices in sorted(symbols.items()):
    print(f'  {s}: {len(prices)} 条, price {min(prices):.2f} ~ {max(prices):.2f}')

print()
for item in items:
    asin = item['asin']
    price = item['price']
    symbol = item.get('symbol')
    currency = item.get('currency')
    print(f'  {asin}: price={price}, symbol={symbol!r}, currency={currency!r}, ratings={item["ratings"]}, sellerNation={item["sellerNation"]}')
