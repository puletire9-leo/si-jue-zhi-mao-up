"""保存品线模型为 MD 文件"""
import sys, json, logging, pymysql, urllib.request
sys.path.insert(0, '/app')
logging.basicConfig(level=logging.WARNING)

from tools.selection.preprocess import preprocess_sub_category
from tools.selection.ai_analyzer import ai_analyze

url = 'http://java-product:8002/api/v1/product-line/aggregated-data?marketplace=UK&month=202605'
batch = json.loads(urllib.request.urlopen(url, timeout=30).read())['data']
conn = pymysql.connect(host='mysql', port=3306, user='sijue', password='sijue123456', database='sijuelishi_dev')
sub = batch['productLines'][0]['subCategories'][0]
a = preprocess_sub_category(conn, 'UK', '202605',
    node_id=int(sub['nodeId']), node_name=sub['nodeName'],
    node_full_path=sub['nodeFullPath'], bsr_id='kitchen')
r = ai_analyze(a)

if not r:
    print('FAILED')
    conn.close()
    exit(1)

ctx = a.to_ai_context()
kw = r.search_keywords

md = f"""# {sub['nodeName']} — 品线模型

> **品线**: {ctx['bsrId']} | **站点**: UK | **路径**: {ctx['nodeFullPath']}
> **分析时间**: {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}
> **数据**: {a.stats['raw']}品 → 去重{a.stats['total']}品 → 采样{len(a.sampled_products)}品

---

## 1. 品类健康度: {r.overall_health}

{r.health_reason}

## 2. 质量基准

| 指标 | 值 | 说明 |
|------|-----|------|
| BSR 中位数 | {ctx['qualityBenchmark']['bsr_p50']:,} | 50%好品在此之下 |
| BSR P90 | {ctx['qualityBenchmark']['bsr_p90']:,} | 90%好品在此之下 |
| 评分下限 | {ctx['qualityBenchmark']['rating_min']} | 好品最低评分 |
| 重量中位数 | {ctx['qualityBenchmark']['weight_g_median']}g | 轻小件基准 |
| 重量上限 | {ctx['qualityBenchmark']['weight_g_max']}g | 超过不推荐 |
| FBA 中位数 | £{ctx['qualityBenchmark']['fba_median']} | FBA成本基准 |
| 上架天数中位数 | {ctx['qualityBenchmark']['listing_days_median']}天 | 参考上架时长 |

## 3. 价格带

- 范围: £{ctx['priceBand']['min']} - £{ctx['priceBand']['max']}
- 均价: £{ctx['priceBand']['avg']}
- 甜点区: £{ctx['priceBand']['sweet_spot_min']}-£{ctx['priceBand']['sweet_spot_max']} ({ctx['priceBand']['sweet_spot_ratio']:.0%}产品在此区间)

## 4. 载体画像

| 载体 | 数量 | 均价 | 重量 | FBA | 变体 | 策略 | 轻小件 |
|------|------|------|------|-----|------|------|--------|
"""

for cd in r.carrier_detail:
    md += f"| {cd.get('name','')} | {cd.get('count','')} | £{cd.get('avg_price','')} | {cd.get('avg_weight_g','')}g | £{cd.get('avg_fba','')} | {cd.get('avg_variants','')} | {cd.get('variant_strategy','')} | {cd.get('lightweight','')} |\n"

md += f"""
## 5. 已验证元素 ({len(r.proven_elements)})

"""

for e in r.proven_elements:
    md += f"### {e.name} (×{e.frequency})\n"
    md += f"> {e.insight}\n\n"
    md += f"- 载体: {', '.join(e.carriers)}\n"
    md += f"- 信号: {', '.join(e.signal_tags)}\n\n"

md += f"""## 6. 元素饱和度 ({len(r.element_saturation)})

| 元素 | 频次 | 饱和度 | 策略建议 |
|------|------|--------|----------|
"""

for es in r.element_saturation:
    md += f"| {es.get('element','')} | ×{es.get('frequency','')} | {es.get('saturation','')} | {es.get('insight','')} |\n"

md += f"""
## 7. 新兴元素 ({len(r.emerging_elements)})

"""

for ee in r.emerging_elements:
    md += f"- **{ee.get('element','')}** [{ee.get('signal','')}] — {ee.get('opportunity','')} (ASIN: {ee.get('asin','')})\n"

md += f"""
## 8. 推荐组合 ({len(r.recommended_combos)})

"""

for i, rc in enumerate(r.recommended_combos, 1):
    heat_icon = "🔥" if rc.heat == "已验证" else "⭐" if rc.heat == "新兴" else "👀"
    md += f"### {i}. {heat_icon} [{rc.heat}] {' + '.join(rc.elements)} × {' + '.join(rc.carriers)}\n"
    md += f"> {rc.reason}\n\n"
    md += f"- 场景: {', '.join(rc.scenes)}\n"
    md += f"- 英文搜索: `{'`, `'.join(rc.keywords_en)}`\n"
    md += f"- 中文搜索: {' / '.join(rc.keywords_cn)}\n\n"

md += f"""## 9. 搜索关键词

### Amazon 英文搜索词
"""

for k in kw.get('en', [])[:15]:
    md += f"- `{k}`\n"

md += f"""
### 中文搜索词
"""

for k in kw.get('cn', []):
    md += f"- {k}\n"

md += f"""
## 10. 价格空白

"""

for pg in r.price_gaps:
    md += f"- **{pg.get('range','')}**: {pg.get('opportunity','')}\n"

md += f"""
## 11. 轻小件总结

{r.lightweight_summary}

## 12. 好品清单 ({len(r.good_products)})

| ASIN | 元素 | 载体 | 场景 | EN 关键词 | CN 关键词 | 轻小 |
|------|------|------|------|-----------|-----------|------|
"""

for g in r.good_products[:20]:
    md += f"| {g.asin} | {', '.join(g.elements[:3])} | {', '.join(g.carriers[:2])} | {', '.join(g.scenes[:2])} | {', '.join(g.keywords_en[:2])} | {', '.join(g.keywords_cn[:2])} | {g.lightweight} |\n"

md += f"""
---

> 郑总选品模型 v3 | AI 分析完成
"""

# Save
out_path = f"/app/zheng_model_v1/UK/{ctx['bsrId']}/{sub['nodeName'].replace(' ','_').replace('&','and')}.md"
import os
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, 'w') as f:
    f.write(md)
print(f'Saved: {out_path}')
print(f'Size: {len(md)} chars')
conn.close()
