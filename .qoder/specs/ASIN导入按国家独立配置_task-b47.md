# DeepSeek AI 选品分析 Prompt 优化

## Context

当前 AI 选品分析太慢（每个小类 60-130 秒，89 小类 × 3 并发 ≈ 45 分钟）。
通过全并发 + 精简输入/输出 + 启用 thinking 模式，目标缩短到 ~2-3 分钟。

**关键决策**:
- **模型**: `deepseek-v4-flash`（便宜，并发限制 2500）
- **thinking**: 启用，`reasoning_effort="medium"`（API 映射为 high）
- **并发**: 上限 500，实际 min(89, 500) = 89 全并发

---

## 当前 Prompt 完整结构

**文件**: `selection-agent-v2/tools/selection/ai_analyzer.py`

- **System Prompt** (第104-164行): ~2000 字符，要求 10 个 JSON 输出节
- **User Prompt** (`build_analysis_prompt`): 40 商品 × 14 字段 → ~6000-8000 tokens 输入
- **API 调用**: `max_tokens=32768`, `temperature=0.3`, thinking 已禁用（`DEEPSEEK_DISABLE_THINKING=1`）
- **并发**: `batch_runner.py` 默认 3 线程

## 慢的 3 个原因

| 原因 | 当前值 | 影响 |
|------|--------|------|
| 输入太大 | 40 商品 × 14 字段 | ~6000 tokens，但 AI 只需 title 提取语义 |
| 输出太大 | 10 个 JSON 节 | ~12000 tokens，其中 carrier_detail/element_saturation 是纯数值聚合 |
| 并发太低 | 3 线程 | 89/3 × 90s ≈ 45 分钟 |

## 关键依赖确认（不能随便砍的）

| AI 输出字段 | 谁在用 | 能否砍掉 |
|-------------|--------|----------|
| `carrier_detail` | 前端 `ModelSummaryBar.vue` + `ProductLineModel.vue` 读 `modelData.carrierDetail`；MD 报告第4节 | **不能从 AI 删**，但可让 AI 只输出载体名称列表，脚本后处理补充统计字段 |
| `element_saturation` | 前端两个组件读 `modelData.elementSaturation`；MD 报告第6节 | **可从 AI 删** — 频率计数+阈值判定脚本能做，insight 用模板生成 |
| `good_products.keywords_en/cn` | DB `product_line_elements.ai_keywords`（save_results.py 第442行）| **可从 AI 删** — DB 改为从 `search_keywords` 或 `recommended_combos` 聚合，或留空 |
| `good_products.carriers` | 脚本后处理 carrier_detail 依赖此字段 | **必须保留** |
| `proven_elements.carriers` | 前端展示 + 脚本 carrier_detail 后处理的数据来源 | **必须保留** |

---

## Task 1: 全并发 + 重试（风险最低，收益最直接）

**文件**: `selection-agent-v2/batch_runner.py` + `selection-agent-v2/tools/selection/ai_analyzer.py`

### DeepSeek 限速与隔离规则（来自官方文档）

| 模型 | 并发限制 | 说明 |
|------|---------|------|
| deepseek-v4-pro | 500 | 按账号粒度，与 API Key 无关 |
| deepseek-v4-flash | 2500 | 按账号粒度，与 API Key 无关 |

- 超过并发限制 → HTTP 429
- `user_id` 参数可实现 KVCache/调度/内容安全隔离（OpenAI SDK 通过 `extra_body={"user_id": "xxx"}` 传入）
- 请求保活：非流式请求等待期间持续返回空行，**10 分钟未开始推理则断开**（我们的请求 60-130s 开始推理，不受影响）
- OpenAI SDK 自动处理 keep-alive 空行，无需额外代码

### 1a. 并发 3 → 全量并行（自动取 min(小类数, 500)）

当前模型 `deepseek-v4-flash`（2500 并发），89 小类全并发不会触发 429。
设置 `DEFAULT_CONCURRENCY = 500` 作为上限，实际运行时自动取 `min(analyses数, 500)`：

```python
# batch_runner.py
DEFAULT_CONCURRENCY = 500  # 原来 3，现在 500（deepseek-v4-pro 上限）

# run_batch() 中自动裁剪
actual_concurrency = min(concurrency, len(analyses))
logger.info(f"  实际并发: {actual_concurrency} (请求:{concurrency}, 小类:{len(analyses)})")
with ThreadPoolExecutor(max_workers=actual_concurrency) as executor:
    ...
```

**扩大 httpx 连接池**（ai_analyzer.py `_get_client()`）：
```python
import httpx
_client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url="https://api.deepseek.com",
    http_client=httpx.Client(limits=httpx.Limits(max_connections=200, max_keepalive_connections=50)),
)
```
OpenAI SDK 默认 `max_connections=100`，89 并发刚好够但无余量。扩到 200 留出重试空间。

**保存安全性确认**（89 并发同时写不会出问题）：
- **DB 连接**: 每线程独立 `pymysql.connect()`，MySQL `max_connections` 默认 151，89 < 151 ✅
- **文件写入**: 每小类独立路径 `{bsr_id}/{node_name}.md/.json`，无冲突 ✅
- **httpx 连接池**: 扩到 200 > 89，充足 ✅
- **请求保活**: 非流式请求 10 分钟超时，我们 60-130s 内完成，不受影响 ✅
- **DB executemany**: `ON DUPLICATE KEY UPDATE` + 独立连接独立事务 ✅

### 1b. AI 调用加指数退避重试（防御 429 + 网络抖动）

虽然 89 并发远低于 2500 限制，但重试仍然必要（网络超时、服务端 503 等）：

```python
import time as _time
from openai import RateLimitError

def ai_analyze(analysis, model="deepseek-v4-flash", max_retries=3):
    client = _get_client()
    prompt = build_analysis_prompt(analysis)
    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(...)
            break
        except RateLimitError as e:
            # 429: 优先读取 Retry-After header
            retry_after = getattr(e, 'headers', {}).get('retry-after')
            wait = int(retry_after) if retry_after else min(2 ** (attempt + 1), 30)
            if attempt == max_retries - 1:
                logger.error(f"  AI限流(已重试{max_retries}次): {e}")
                return None
            logger.warning(f"  AI限流429，{wait}s后重试(第{attempt+1}次)")
            _time.sleep(wait)
        except Exception as e:
            if attempt == max_retries - 1:
                logger.error(f"  AI分析失败(已重试{max_retries}次): {e}")
                return None
            wait = min(2 ** (attempt + 1), 30)  # 2s, 4s, 8s（上限30s）
            logger.warning(f"  AI调用失败(第{attempt+1}次)，{wait}s后重试: {e}")
            _time.sleep(wait)
```

### 1c. 启用 thinking 模式 + 删除 temperature

**当前状态** (ai_analyzer.py 第 326-358 行):
- thinking 已禁用: `DEEPSEEK_DISABLE_THINKING=1` → `extra_body={"thinking": {"type": "disabled"}}`
- `should_disable_thinking()` 函数（第 326-328 行）
- `temperature=0.3`（thinking 禁用时有效）

**改为**（thinking 启用 + medium 强度）:
```python
# 删除 should_disable_thinking() 函数（第 326-328 行）和环境变量 DEEPSEEK_DISABLE_THINKING
# 直接启用 thinking

response = client.chat.completions.create(
    model=model,  # deepseek-v4-flash
    messages=[...],
    # ⚠️ 删除 temperature=0.3 — thinking 模式下 temperature 不生效（不报错但忽略）
    max_tokens=32768,  # ⚠️ 保持 32768，等跑一次验证 thinking tokens 消耗后再调
    reasoning_effort="medium",  # API 会将 medium 映射为 high
    extra_body={
        "thinking": {"type": "enabled"},
        "user_id": batch_id.replace("/", "_"),  # 可选：批次隔离
    },
)
# ⚠️ thinking 模式下 reasoning_content 在 response.choices[0].message.reasoning_content
# 我们只需要 .content（最终回答），reasoning_content 无需保存
```

**DeepSeek thinking 模式要点**:
- `reasoning_effort="medium"` → API 内部映射为 `high`（low/medium → high）
- thinking 模式下 **temperature、top_p、presence_penalty、frequency_penalty 不生效**
- 思维链通过 `reasoning_content` 返回，我们只读 `content` 即可
- 单轮对话（无工具调用），`reasoning_content` 无需回传

### 1d. 可选：user_id 批次隔离
（已合并到 1c 的 `extra_body` 中）

**预计效果**: 89 小类全并发，单次 AI 耗时取决于 thinking 开销（可能略增但质量更好） → 总耗时 **2-5 分钟**（vs 原来 45 分钟）

---

## Task 2: 压缩商品输入字段（风险低）

**文件**: `ai_analyzer.py` 的 `build_analysis_prompt()` + `SYSTEM_PROMPT`

### 2a. 商品字段从 14 → 4
当前 `to_ai_context()` 每个商品传 14 字段，AI 真正需要的只有：
- `asin` — 标识
- `title` — 提取元素/载体/场景的唯一来源
- `signals` — 辅助判断好品
- `price` — 辅助 is_good 判断（保留，成本极低）

其余 10 个字段（units, bsr, rating, ratings, listingDays, brand, sellerName, weightG, fba, variations）已在 stats/priceBand/qualityBenchmark 中聚合，AI 不需要逐品看。

```python
products_compact = [
    {"asin": p["asin"], "title": p["title"], "price": p["price"], "signals": p["signals"]}
    for p in ctx["products"]
]
products_json = json.dumps(products_compact, ensure_ascii=False, indent=2)
```

### 2b. 更新 System Prompt 字段说明行
第 112 行：
```
- 字段: asin, title, price, units, bsr, rating, ratings, listingDays, weightG(克), fba(£), variations, signals[]
```
改为：
```
- 字段: asin, title, price, signals[]
- 统计上下文(priceBand/qualityBenchmark/reviewMoats/sellerStats)已聚合，无需逐品看数值
```

### 2c. 精简 System Prompt 重复表述
第 107 行和第 113 行都在说"不要重算"，合并为一条：
```
## 核心原则
脚本已预计算好 priceBand, qualityBenchmark, reviewMoats, sellerStats — 直接引用，不要重算。
你的价值：从标题提取元素/载体/场景、推断语义、发现跨品模式、生成搜索词。
```

**预计效果**: 输入从 ~6000 tokens 降到 ~2500 tokens

---

## Task 3: 精简 AI 输出 — 砍 element_saturation + 简化 carrier_detail

**文件**: `ai_analyzer.py` (SYSTEM_PROMPT) + `save_results.py` (后处理)

### 3a. 从 AI prompt 中删除 element_saturation（节8）

**删除 System Prompt 第 149-151 行**:
```
### 8. element_saturation
引用脚本预计算的频次，你判断饱和度等级和含义。
每个: element, frequency, saturation(high≥5/medium2-4/low1), insight(一句话策略建议)
```

**在 save_results.py 新增后处理函数** `compute_element_saturation(ai_result)`：
```python
def compute_element_saturation(ai_result: AIResult) -> list[dict]:
    """从 proven_elements 生成 element_saturation（脚本后处理）"""
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
```

**调用时机**: 在 `save_sub_category_results()` 中，AI 返回结果后、生成 JSON/MD 前调用，将结果写回 `ai_result.element_saturation`。

### 3b. 简化 carrier_detail — AI 只输出载体名，脚本补统计

**修改 System Prompt 第 131-133 行**，从要求 9 个字段简化为 1 个（只输出载体名称，数量和统计脚本计算更准确）：
```
### 4. carrier_summary (注意：不再是 carrier_detail)
仅输出载体名称列表，数值统计由脚本后处理。
格式: ["Poster", "Shelf Sign", "Wall Art"]
```

**在 save_results.py 新增后处理函数** `compute_carrier_detail(ai_result, analysis)`：
```python
def compute_carrier_detail(ai_result: AIResult, analysis: SubCategoryAnalysis) -> list[dict]:
    """从 AI 的 carrier_summary + 脚本预处理数据生成完整 carrier_detail"""
    # 构建 ASIN → ProductRow 索引
    product_map = {p.asin: p for p in analysis.sampled_products}

    # 收集所有载体名称（从好品 + 已验证元素双重来源）
    carrier_names: set[str] = set()
    # 来源1: good_products.carriers（每个好品的载体标签）
    for gp in ai_result.good_products:
        carrier_names.update(gp.carriers)
    # 来源2: proven_elements.carriers（已验证元素聚合的载体，兜底 is_good=false 的商品）
    for pe in ai_result.proven_elements:
        carrier_names.update(pe.carriers)
    # 来源3: AI 直接输出的 carrier_summary（如果有）
    carrier_names.update(
        name for cd in ai_result.carrier_detail
        if isinstance(cd, dict) and cd.get('name')
        else ([cd] if isinstance(cd, str) else [])
    )

    # 按载体名分组商品
    carrier_map: dict[str, list] = defaultdict(list)
    for gp in ai_result.good_products:
        for name in gp.carriers:
            p = product_map.get(gp.asin)
            if p:
                carrier_map[name].append(p)

    result = []
    for name in carrier_names:
        products = carrier_map.get(name, [])
        if not products:
            # 只有来源2/3但无具体商品 → 最小记录
            result.append({"name": name, "count": 0, "avg_price": 0, "avg_weight_g": 0,
                           "avg_fba": 0, "avg_variants": 0, "variant_strategy": "未知",
                           "lightweight": "?", "lightweight_reason": "无对应好品数据"})
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
```

**调用时机**: 同 3a，在 `save_sub_category_results()` 中 AI 返回后调用。

### 3c. 处理 good_products.keywords_en/cn 砍掉后的 DB 影响

**方案**: 从 `good_products` 中删除 `keywords_en`/`keywords_cn` 字段要求。
**DB 侧** (save_results.py 第 442 行): `ai_keywords` 改为从 `recommended_combos` 聚合：
```python
# 聚合所有 combos 的关键词作为该品类的搜索词池
all_kw_en = set()
all_kw_cn = set()
for rc in ai_result.recommended_combos:
    all_kw_en.update(rc.keywords_en)
    all_kw_cn.update(rc.keywords_cn)
# 写入时，如果 gp 本身没有 keywords，用聚合池
kw_data = {"en": gp.keywords_en or list(all_kw_en)[:5], "cn": gp.keywords_cn or list(all_kw_cn)[:3]}
```

**注意**: `goodProducts` 在模型 JSON 中仍有 `keywordsEn`/`keywordsCn`（第315-316行），前端如果读了会显示空数组 — 但前端 `ProductLineModel.vue` 的 goodProducts 展示可能不依赖这两个字段，需验证。

### 3d. 精简 price_gaps + lightweight_summary（不合并，只要求 AI 输出 1-2 条）

这部分 token 成本很小（总共 <500 tokens），合并成新的 strategy_notes 格式会增加解析出错面 → **不合并**。

**System Prompt 修改** — 限制每节只输出最重要的 1-2 条：
```
### 9. price_gaps
基于脚本预计算的 priceBand，判断是否存在价格空白。只输出最重要的1-2条。
格式: [{range, opportunity}]

### 10. lightweight_summary
基于商品列表中实际重量+FBA数据，一句话总结轻小件特征。
```
这样 AI 输出节数从 10 → 9（只去掉了 element_saturation），但单节内容大幅精简。

**预计效果**: 输出从 ~12000 tokens 降到 ~6000-7000 tokens

---

## Task 4: max_tokens 调优（延迟—跑完验证后再改）

**暂不修改**。保持 `max_tokens=32768`。

thinking 模式下推理 tokens 可能很高（8000+）。等 Task 1-3 完成后先跑一次 `--limit 3`，查看 `response.usage` 的实际 tokens 消耗：
- 如果 `total_tokens < 20000` → 降到 `24576`
- 如果 `total_tokens < 15000` → 降到 `16384`
- 否则保持 `32768`

**文件**: `ai_analyzer.py` — 一行改动，但移到验证后

---

## 优化前后对比

| 维度 | 当前 | 优化后 |
|------|------|--------|
| thinking 模式 | disabled | enabled, reasoning_effort=medium |
| temperature | 0.3 | 删除（thinking 模式下不生效） |
| 输入 tokens | ~6000-8000 | ~2500-3500 |
| AI 输出节数 | 10 节 | **9 节**（只去掉 element_saturation，其他精简） |
| 输出 tokens | ~12000-15000 | ~6000-8000 |
| max_tokens | 32768 | **暂保持 32768**，跑完验证后按实际消耗调 |
| carrier_detail | AI 输出 9 个数值字段 | AI 只输出载体名，脚本后处理补齐 |
| element_saturation | AI 输出 | 脚本后处理（频率计数+阈值+模板 insight） |
| price_gaps | AI 自由输出 | AI 只输出 1-2 条最核心的 |
| 单次耗时 | 60-130 秒 | 待验证（thinking 有思维链开销，但全并发抵消） |
| 并发数 | 3 | 500（上限），实际 min(89, 500)=89 |
| 89 小类总耗时 | ~45 分钟 | **预计 ~2-5 分钟**（全并发） |
| httpx 连接池 | 默认 100 | 手动扩到 200 |
| 前/后端兼容性 | — | carrierDetail/elementSaturation 由脚本后处理补齐，JSON 格式不变 |

## 实施顺序（调整版）

| 步骤 | 内容 | 文件 | 类型 |
|------|------|------|------|
| 1a | 并发 3→500 + httpx 连接池扩到 200 | batch_runner.py + ai_analyzer.py | 小改 |
| 1b | AI 调用加重试（429 Retry-After 优先） | ai_analyzer.py | 小改 |
| 1c | 启用 thinking + 删 temperature + 删 `should_disable_thinking()` | ai_analyzer.py | 小改 |
| 2 | 压缩输入字段 14→4 + 精简 System Prompt | ai_analyzer.py | 中改 |
| 3a | element_saturation 后处理 | save_results.py | 新增函数 |
| 3b | carrier_detail 简化 + 三级 fallback | ai_analyzer.py + save_results.py | 大改 |
| 3c | DB ai_keywords 聚合 | save_results.py | 小改 |
| 4 | max_tokens 调优（先跑验证再决定） | ai_analyzer.py | 延迟 |

## 改动文件清单

| 文件 | 变更 |
|------|------|
| `selection-agent-v2/tools/selection/ai_analyzer.py` | **1a**: httpx 连接池 200; **1b**: 重试(429 Retry-After); **1c**: thinking启用+删temperature+删`should_disable_thinking()`; **2**: 压缩输入+更新 System Prompt; **3b**: carrier_summary 节改为仅载体名; **4**: 延迟 |
| `selection-agent-v2/tools/selection/save_results.py` | **3a**: 新增 `compute_element_saturation()`; **3b**: 新增 `compute_carrier_detail()`(三级 fallback); **3c**: 修改 DB ai_keywords 聚合逻辑; 修改 `save_sub_category_results()` 调用后处理函数 |
| `selection-agent-v2/batch_runner.py` | **1a**: DEFAULT_CONCURRENCY 3→500 + actual_concurrency; `_analyze_and_save` 传 batch_id 给 ai_analyze |

## 验证

1. `python batch_runner.py --dry-run` — 确认预处理正常
2. `python batch_runner.py --limit 3 --force` — 跑 3 个小类:
   - 确认 thinking 模式正常工作（`reasoning_content` 有值但不需保存）
   - 检查 AI 返回的 JSON 是否只有 9 个节（carrier_detail→载体名列表）
   - 检查 MD 报告是否正常生成（carrier_detail 和 element_saturation 由脚本填充）
   - 检查模型 JSON 文件结构是否与前端兼容（carrierDetail/elementSaturation 字段存在）
   - 检查 DB product_line_elements.ai_keywords 是否有值
   - 查看 `response.usage` 的 `total_tokens` 用于决定 Task 4 的 max_tokens
3. `python batch_runner.py --force` — 全量跑 89 小类，确认总耗时
4. 前端打开品线选品页 → 验证载体画像、元素饱和度、推荐组合正常展示
