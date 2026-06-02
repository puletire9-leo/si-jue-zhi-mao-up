"""卖家精灵 competitor-lookup API 测试 — 单次最多 40 ASIN"""
import requests, json, os

ASINS = [
    "B0GHPP6CDQ","B0GTRGVP55","B0GQVFHCVT","B0GJKRX2PV","B0GQ4WC3SF",
    "B0GK7GPWD6","B0GM1B5J97","B0GK7Z5RRY","B0GWMJ2KL3","B0GJ61KFN3",
    "B0GMG575RQ","B0GLF5R331","B0FPCQZTPD","B0GLM9VKZX","B0GMGBF9YQ",
    "B0GYS8SPK5","B0GSBQ4954","B0GFF18FSJ","B0GQZ7JW7X","B0GR51W4KQ",
    "B0GRFVV9GV","B0G963WGTH","B0GCBNL5KG","B0FF9Z82C5","B0GVFVDYCK",
    "B0GQBC5CB8","B0GKPJC73M","B0GSS4C7XV","B0DHXP1T1B","B0GS7RFJBQ",
    "B0GQXW27HD","B0GXGK8677","B0GYRQQ98H","B0GLNJLG69","B0GR52FQZR",
    "B0GJDBLNVR","B0GSQDF6QW","B0GGBD37H5","B0GJDMHC48","B0GS9Q6X9T",
]

SECRET_KEY = "d03bb00611a44f9ca30bf58205ac0f00"
API_URL = "https://api.sellersprite.com/v1/product/competitor-lookup"
OUT_MD = r"e:\项目\si-jue-zhi-mao-up\scripts\八爪鱼新品榜asin\榜单抓数据处理\英国\测试结果.md"

print(f"Request: marketplace=UK, asins={len(ASINS)}个 (仅此1参数)")
r = requests.post(API_URL, json={"marketplace": "UK", "asins": ASINS}, headers={
    "secret-key": SECRET_KEY, "Content-Type": "application/json"
}, timeout=30)

resp = json.loads(r.text)
code = resp.get("code")
d = resp.get("data", {})
total = d.get("total", 0)
items = d.get("items", [])
pages = d.get("pages", 0)
print(f"code={code}, total={total}, pages={pages}, items={len(items)}")

# Build markdown
lines = []
lines.append("# 卖家精灵 API 测试结果")
lines.append("")
lines.append("## 请求")
lines.append("")
lines.append("- URL: `POST https://api.sellersprite.com/v1/product/competitor-lookup`")
lines.append("- marketplace: UK")
lines.append(f"- asins: {len(ASINS)}个")
lines.append("- 无其他参数")
lines.append("")
lines.append("## 响应摘要")
lines.append("")
lines.append(f"- code: {code}")
lines.append(f"- total: {total}")
lines.append(f"- pages: {pages}")
lines.append(f"- page: {d.get('page', '-')}")
lines.append(f"- size: {d.get('size', '-')}")
lines.append(f"- items: {len(items)}条")
lines.append("")
lines.append("## 返回列表")
lines.append("")

for i, item in enumerate(items):
    lines.append(f"### {i+1}. {item.get('asin')}")
    lines.append("")
    lines.append("| 字段 | 值 |")
    lines.append("|------|-----|")
    for key in sorted(item.keys()):
        val = item.get(key)
        if val is None:
            val = '-'
        else:
            val = str(val).replace('|', '/').replace('\n', ' ').replace('\r', ' ')
            if len(val) > 300:
                val = val[:300] + '...'
        lines.append(f"| {key} | {val} |")
    lines.append("")

md = '\n'.join(lines)
os.makedirs(os.path.dirname(OUT_MD), exist_ok=True)
with open(OUT_MD, 'w', encoding='utf-8') as f:
    f.write(md)

# Also save raw JSON
json_path = os.path.join(os.path.dirname(OUT_MD), '测试结果_完整响应.json')
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(resp, f, ensure_ascii=False, indent=2)

print(f"Markdown: {OUT_MD}")
print(f"JSON: {json_path}")
print("Done.")
