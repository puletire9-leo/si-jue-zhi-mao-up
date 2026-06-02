import subprocess, os

result = subprocess.run([
    'docker', 'exec', 'dev-mysql', 'mysql', '-usijue', '-psijue123456', 'sijuelishi_dev',
    '-N', '-e',
    'SELECT asin FROM asin_import_results WHERE task_id=(SELECT MAX(id) FROM asin_import_tasks WHERE task_status="DONE") AND status="PASS" ORDER BY id;'
], capture_output=True, text=True)

asins = [line.strip() for line in result.stdout.strip().split('\n') if line.strip()]

lines = [f'# 最新一批请求的 ASIN', '', f'## 共 {len(asins)} 个', '', '## 列表', '']
for a in asins:
    lines.append(a)

path = r'e:\项目\si-jue-zhi-mao-up\scripts\八爪鱼新品榜asin\榜单抓数据处理\英国\200asi.md'
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print(f'Written {len(asins)} ASINs')
