import subprocess, json

# Read ASINs
asins = []
with open(r'e:\项目\si-jue-zhi-mao-up\scripts\八爪鱼新品榜asin\榜单抓数据处理\德国\40asin.md', 'r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if line.startswith('B0') and len(line) == 10:
            asins.append(line)

print(f'ASINs: {len(asins)}')

# Build request body
body = json.dumps({
    "marketplace": "UK",
    "month": "202605",
    "variation": "Y",
    "size": 100,
    "page": 1,
    "asins": asins
})

print(f'Body length: {len(body)} chars')
print(f'Body (first 200): {body[:200]}')

# Call seller sprite API directly
cmd = ['docker', 'exec', 'java-product', 'curl', '-s', '-X', 'POST',
       'https://api.sellersprite.com/v1/product/competitor-lookup',
       '-H', 'Content-Type: application/json',
       '-H', 'secret-key: d03bb00611a44f9ca30bf58205ac0f00',
       '-d', body]

print('Calling API...')
result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
print(f'stdout length: {len(result.stdout)}')
print(f'stderr: {result.stderr[:200] if result.stderr else "none"}')

if result.stdout:
    try:
        data = json.loads(result.stdout)
        print(f'code: {data.get("code")}')
        resp_data = data.get('data', {})
        print(f'total: {resp_data.get("total", "?")}')
        items = resp_data.get('items', [])
        print(f'items count: {len(items)}')
        for i in items[:5]:
            print(f'  {i.get("asin")}: {i.get("title", "")[:60]}')
        # Save full response
        with open(r'e:\项目\si-jue-zhi-mao-up\scripts\api_response.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f'Saved full response to api_response.json')
    except json.JSONDecodeError as e:
        print(f'JSON parse error: {e}')
        print(f'Raw: {result.stdout[:500]}')
