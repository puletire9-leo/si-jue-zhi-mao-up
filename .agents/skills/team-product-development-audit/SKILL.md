---
name: team-product-development-audit
description: Audit product-development datasets and marketplace candidates against the team's accumulated product-direction, scenario, differentiation-method, and historical evidence library. Use when reviewing product titles, new-release lists, ASIN/SKU candidates, monthly development batches, or mixed sales/listing/profit datasets to decide which products deserve deeper image, cost, listing, or profitability review and to explain the evidence, source, risks, and next step.
---

# Team Product Development Audit

## Start from the authoritative entry

Work from the repository root. Read these files in order:

1. `产品数据/思考理实团队的开品方向/第一版/持续更新团队开品skll集合/01_AI审核入口/00_AI第一层开品审核入口.md`
2. `产品数据/思考理实团队的开品方向/第一版/持续更新团队开品skll集合/01_AI审核入口/01_AI第一层审核输出模板.md`
3. Load only the relevant direction, scene, or method references listed below.

Do not treat conversation memory or old analysis files as evidence when the generated library disagrees with them.

## Select references progressively

- Product type or title matching: read `持续更新团队开品skll集合/02_商品方向知识卡/00_商品方向知识卡.md`.
- Season, festival, use scenario, or audience: read `持续更新团队开品skll集合/03_核心开发Skill/01_跨产品场景Skill.md`.
- Bundle, specification, theme, fitment, audience, or replacement method: read `持续更新团队开品skll集合/03_核心开发Skill/02_开发方法Skill.md`.
- Ambiguous boundaries: read `持续更新团队开品skll集合/03_核心开发Skill/00_Skill定义与边界.md`.
- Combined historical patterns: read `持续更新团队开品skll集合/04_组合打法案例/00_组合打法案例.md`.
- Developer-specific history: read the matching file under `持续更新团队开品skll集合/05_证据演化/02_开发人画像/`.
- Exact historical evidence: search `第一层开发skll提取/06_数据处理底表/00_开发Skill证据账本.csv` by title, product body, Skill ID, developer, or month.
- Exact past title analysis: search `第一层开发skll提取/05_逐标题分析基础/00_商品标题分析总索引.csv`.

All relative paths above start under:

`产品数据/思考理实团队的开品方向/第一版/`

## Audit workflow

1. Validate the supplied data source and state its file, table, time range, site/currency, row count, and required fields.
2. Separate the evidence layers:
   - First layer: what the developer created.
   - Second layer: whether it reached Amazon, primarily by first observed FBA availability.
   - Third layer: sales, profit, retention, elimination, and payback.
3. Normalize SKU/ASIN/title records without losing the original title. Exclude supplier labels, GPSR labels, packaging-only records, pure codes, and titles whose product body cannot be identified from formal Skill evidence.
4. Match each real product to exactly one dominant product-direction Skill. Allow multiple scenario and development-method Skills only when the title or data supports them.
5. Retrieve historical examples and explain whether the team repeatedly demonstrated this capability or only tried it occasionally.
6. Apply practical AI review:
   - First remove compliance, IP/brand, liquid/chemical, dangerous, high-fitment, high-return, or unverifiable candidates.
   - Prefer candidates the team already knows how to develop and differentiate.
   - Among those, prioritize young products with visible demand, clear function or theme, manageable weight/price, and a concrete next validation step.
7. Output a short ordered decision list: `优先审核`, `有条件观察`, `暂缓/淘汰`.

## Required explanation for every recommended product

State:

1. Why it deserves the next review.
2. Where the supporting data came from.
3. Which title/data facts and historical Skill evidence support the judgment.
4. The largest unresolved risk.
5. The next verification action, such as image comparison, cost calculation, IP check, FBA/listing confirmation, or financial validation.

Do not hide the decision inside a large scorecard. Use concrete product names, SKU/ASIN, observed figures, and evidence links when available.

## Evidence boundaries

- First-layer Skill evidence proves repeated development behavior, not sales or profitability.
- Do not say a product is successful until second- and third-layer data support it.
- Do not count color, size, quantity variants, or combination components as independent product schemes.
- Do not create a new Skill for a synonym or one unusual product. Compare it with the nearest existing Skill and place unresolved candidates in the pending area.
- Keep truly insufficient titles in review; never invent a product body to force 100% classification.

## Maintaining the evidence library

For monthly learning work, use:

- `analysis/build_title_skill_trial.py --month YYYY-MM`
- `analysis/build_four_layer_skill_library.py`

Run the title-analysis tests and four-layer-library tests before rebuilding. A month may enter formal Skill evidence only after the generated quality audit passes and low-confidence rows remain excluded.
