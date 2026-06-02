import subprocess, json

asins = []
with open(r'e:\项目\si-jue-zhi-mao-up\scripts\八爪鱼新品榜asin\榜单抓数据处理\德国\40asin.md', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line.startswith('B0') and len(line) == 10:
            asins.append(line)

# Test variation=N
for var in ['N', 'Y']:
    body = json.dumps({
        "marketplace": "UK", "month": "202605",
        "variation": var, "size": 100, "page": 1,
        "asins": asins
    })
    cmd = ['docker', 'exec', 'java-product', 'curl', '-s', '-X', 'POST',
           'https://api.sellersprite.com/v1/product/competitor-lookup',
           '-H', 'Content-Type: application/json',
           '-H', 'secret-key: d03bb00611a44f9ca30bf58205ac0f00',
           '-d', body]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    data = json.loads(result.stdout)
    total = data.get('data', {}).get('total', '?')
    items = data.get('data', {}).get('items', [])
    print(f'variation={var}: total={total}, items={len(items)}')
