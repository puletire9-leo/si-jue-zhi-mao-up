export const meta = {
  name: 'deepseek-optimization',
  description: 'DeepSeek AI prompt optimization across 3 files',
  phases: [
    { title: 'batch_runner', detail: 'DEFAULT_CONCURRENCY 3→500 + actual_concurrency' },
    { title: 'ai_analyzer', detail: 'retry + thinking + compress + carrier_summary' },
    { title: 'save_results', detail: 'element_saturation + carrier_detail + ai_keywords' },
  ],
}

phase('batch_runner')
const br = await agent(`Modify F:/项目/si-jue-zhi-mao-up/selection-agent-v2/batch_runner.py:

1. Change DEFAULT_CONCURRENCY = 3 to DEFAULT_CONCURRENCY = 500
2. In run_batch(), before ThreadPoolExecutor, add:
   actual_concurrency = min(concurrency, len(analyses))
   logger.info(f"  实际并发: {actual_concurrency} (请求:{concurrency}, 小类:{len(analyses)})")
3. Change ThreadPoolExecutor(max_workers=concurrency) to ThreadPoolExecutor(max_workers=actual_concurrency)
4. Pass batch_id to ai_analyze() call: ai_result = ai_analyze(analysis, batch_id=batch_id)

Make minimal, precise edits. Do NOT change anything else.`,
  { label: 'batch_runner', phase: 'batch_runner' })

phase('ai_analyzer')
const aa = await agent(`Modify F:/项目/si-jue-zhi-mao-up/selection-agent-v2/tools/selection/ai_analyzer.py:

### 1a. httpx 连接池 (第34-43行 _get_client)
Replace the _get_client function body with:
  import httpx  (add at top with other imports)
  _client = OpenAI(
      api_key=os.environ["DEEPSEEK_API_KEY"],
      base_url="https://api.deepseek.com",
      http_client=httpx.Client(limits=httpx.Limits(max_connections=200, max_keepalive_connections=50)),
  )

### 1b. 重试逻辑 (第348-370行 ai_analyze)
Restructure ai_analyze() to add retry loop:

def ai_analyze(analysis, model="deepseek-v4-flash", batch_id="", max_retries=3):
    client = _get_client()
    prompt = build_analysis_prompt(analysis)
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=32768,
                reasoning_effort="medium",
                extra_body={
                    "thinking": {"type": "enabled"},
                    "user_id": batch_id.replace("/", "_") if batch_id else "",
                },
            )
            raw = response.choices[0].message.content or ""
            logger.info(f"  AI返回: {len(raw)} chars, {response.usage.total_tokens if response.usage else '?'} tokens")
            result = parse_ai_response(raw)
            result.sub_category = analysis.node_name
            result.bsr_id = analysis.bsr_id
            return result
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"  AI分析失败(已重试{max_retries}次) [{analysis.node_name}]: {e}")
                return None
            wait = min(2 ** (attempt + 1), 30)
            logger.warning(f"  AI调用失败(第{attempt+1}次)，{wait}s后重试 [{analysis.node_name}]: {e}")
            _time.sleep(wait)
    return None

### 1c. 删 should_disable_thinking 函数 (第325-328行)
Delete the should_disable_thinking() function entirely.
Remove DEEPSEEK_DISABLE_THINKING env var reference.
Delete temperature=0.3 from the API call.
Delete the old extra_body with thinking disabled.

### 2a. 压缩商品输入 (build_analysis_prompt)
Replace products_json line with:
    products_compact = [
        {"asin": p["asin"], "title": p["title"], "price": p["price"], "signals": p["signals"]}
        for p in ctx["products"]
    ]
    products_json = json.dumps(products_compact, ensure_ascii=False, indent=2)

### 2b. 更新 System Prompt 字段行
Line about fields: change to "- 字段: asin, title, price, signals[]\\n- 统计上下文(priceBand/qualityBenchmark/reviewMoats/sellerStats)已聚合，无需逐品看数值"

### 2c. 精简 System Prompt 重复表述
Merge the two "don't recalculate" messages into one.

### 3b. carrier_summary 简化
In SYSTEM_PROMPT, change carrier_detail section (### 4.) to:
"### 4. carrier_summary (注意：不再是 carrier_detail)
仅输出载体名称列表，数值统计由脚本后处理。
格式: ["Poster", "Shelf Sign", "Wall Art"]"

### Also add import for _time at the top

Make minimal, precise edits. Keep ALL other code unchanged.`,
  { label: 'ai_analyzer', phase: 'ai_analyzer' })

phase('save_results')
const sr = await agent(`Modify F:/项目/si-jue-zhi-mao-up/selection-agent-v2/tools/selection/save_results.py:

### 3a. 新增 compute_element_saturation 函数
Add this new function before save_sub_category_results():

def compute_element_saturation(ai_result) -> list[dict]:
    \"\"\"从 proven_elements 生成 element_saturation（脚本后处理）\"\"\"
    result = []
    for e in ai_result.proven_elements:
        freq = e.frequency
        sat = "high" if freq >= 5 else "medium" if freq >= 2 else "low"
        insight = (
            f"已跨{len(e.carriers)}种载体验证，可优先投入" if sat == "high"
            else f"出现在{freq}个商品中，值得持续观察" if sat == "medium"
            else f"仅{freq}次出现，待更多数据验证"
        )
        result.append({
            "element": e.name, "frequency": freq,
            "saturation": sat, "insight": insight
        })
    return result

### 3b. 新增 compute_carrier_detail 函数 (三级 fallback)
Add before save_sub_category_results():

def compute_carrier_detail(ai_result, analysis) -> list[dict]:
    \"\"\"从 AI carrier_summary + good_products.carriers + proven_elements.carriers 生成完整 carrier_detail\"\"\"
    from collections import defaultdict
    from .preprocess import _parse_weight_grams
    product_map = {p.asin: p for p in analysis.sampled_products}
    carrier_names = set()
    for gp in ai_result.good_products:
        carrier_names.update(gp.carriers)
    for pe in ai_result.proven_elements:
        carrier_names.update(pe.carriers)
    carrier_map = defaultdict(list)
    for gp in ai_result.good_products:
        for name in gp.carriers:
            p = product_map.get(gp.asin)
            if p:
                carrier_map[name].append(p)
    result = []
    for name in sorted(carrier_names):
        products = carrier_map.get(name, [])
        if not products:
            result.append({"name": name, "count": 0, "avg_price": 0, "avg_weight_g": 0, "avg_fba": 0, "avg_variants": 0, "variant_strategy": "未知", "lightweight": "?", "lightweight_reason": "无对应好品数据"})
            continue
        prices = [p.price for p in products if p.price and p.price > 0]
        weights = [_parse_weight_grams(p.pkg_weight) for p in products if p.pkg_weight]
        fbas = [p.fba_fee for p in products if p.fba_fee and p.fba_fee > 0]
        variants = [p.variations for p in products if p.variations]
        avg_var = sum(variants) / len(variants) if variants else 1
        strategy = "高变体裂变(10+)" if avg_var >= 10 else "中等(4-9)" if avg_var >= 4 else "低变体(1-3)"
        avg_w = sorted(weights)[len(weights)//2] if weights else 0
        is_light = avg_w < 500 and (sorted(fbas)[len(fbas)//2] if fbas else 0) < 3.5
        result.append({
            "name": name, "count": len(products),
            "avg_price": round(sum(prices)/len(prices), 2) if prices else 0,
            "avg_weight_g": round(avg_w, 1),
            "avg_fba": round(sorted(fbas)[len(fbas)//2], 2) if fbas else 0,
            "avg_variants": round(avg_var, 1),
            "variant_strategy": strategy,
            "lightweight": is_light,
            "lightweight_reason": f"中位重量{round(avg_w)}g" + ("，符合轻小件" if is_light else "，超出轻小件"),
        })
    return result

### 3c. 在 save_sub_category_results() 中调用后处理
After the AI result is received (after 'summary' dict is created but before return, or right at the beginning where ai_result is available), call both functions and write back:

if ai_result:
    ai_result.element_saturation = compute_element_saturation(ai_result)
    if analysis:
        ai_result.carrier_detail = compute_carrier_detail(ai_result, analysis)

Also modify the DB keywords logic (line ~442):
    # Aggregate keywords from recommended_combos as fallback
    all_kw_en = set()
    all_kw_cn = set()
    for rc in ai_result.recommended_combos:
        all_kw_en.update(rc.keywords_en)
        all_kw_cn.update(rc.keywords_cn)
    kw_data = {"en": gp.keywords_en or list(all_kw_en)[:5], "cn": gp.keywords_cn or list(all_kw_cn)[:3]}

Make minimal, precise edits. Keep ALL other code unchanged.`,
  { label: 'save_results', phase: 'save_results' })
