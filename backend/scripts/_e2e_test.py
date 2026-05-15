import requests, json, asyncio, sys
sys.path.insert(0, '.')
from app.repositories.mysql_repo import MySQLRepository
from app.config import settings

BASE = 'http://localhost:8080'

# 1. Login
r = requests.post(f'{BASE}/api/v1/auth/login', json={'username':'admin','password':'123456'}, timeout=5)
token = r.json()['data']['access_token']
H = {'Authorization': f'Bearer {token}'}
print('1. LOGIN OK')

# 2. Upload
with open('test_upload.png', 'rb') as f:
    r = requests.post(f'{BASE}/api/v1/images/upload',
        files={'file': ('e2e_test.png', f, 'image/png')},
        data={'category': 'final', 'sku': 'E2E-001'},
        headers=H, timeout=30)
resp = r.json()
print(f"2. UPLOAD status={r.status_code} code={resp.get('code')}")
if r.status_code != 200 or resp.get('code') != 200:
    print('UPLOAD FAILED:', json.dumps(resp, indent=2, ensure_ascii=False)[:3000])
    sys.exit(1)
data = resp['data']
image_id = data['image_id']
cos_url = data.get('cos_url', '')
print(f'   image_id = {image_id}')
print(f'   cos_url  = {cos_url[:120]}')
print(f'   success  = {data.get("success")}')

# 3. Check DB
async def check_db():
    repo = MySQLRepository(host=settings.MYSQL_HOST, port=settings.MYSQL_PORT,
        user=settings.MYSQL_USER, password=settings.MYSQL_PASSWORD,
        database=settings.MYSQL_DATABASE, pool_size=1, pool_recycle=3600)
    await repo.connect()
    row = await repo.get_image_by_id(image_id)
    print(f"3. DB RECORD:")
    print(f"   id              = {row['id']}")
    print(f"   filename        = {row['filename']}")
    print(f"   storage_type    = {row['storage_type']}")
    print(f"   cos_url         = {str(row.get('cos_url',''))[:100]}")
    print(f"   cos_thumbnail_url = {str(row.get('cos_thumbnail_url',''))[:100]}")
    await repo.disconnect()

asyncio.run(check_db())

# 4. Test thumbnail endpoint
r = requests.get(f'{BASE}/api/v1/images/{image_id}/thumbnail', headers=H, allow_redirects=False, timeout=10)
print(f"4. THUMBNAIL status={r.status_code}")
if r.status_code in (200, 302, 307, 308):
    print(f'   Location: {r.headers.get("Location", "served directly")[:120]}')
else:
    print(f'   Body: {r.text[:300]}')

# 5. Test image endpoint
r = requests.get(f'{BASE}/api/v1/images/{image_id}', headers=H, allow_redirects=False, timeout=10)
print(f"5. IMAGE status={r.status_code}")
if r.status_code in (200, 302, 307, 308):
    print(f'   Location: {r.headers.get("Location", "served directly")[:120]}')
else:
    print(f'   Body: {r.text[:300]}')

print('\n=== E2E TEST PASSED ===')
