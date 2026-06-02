# 阶段二：分析层 — Agent 自动化产品分析

> 需要新建。当产品被标记后，Agent 自动拉取多维数据，通过 LLM 生成结构化分析报告。

---

## 1. 架构位置

```
Java 后端 (数据源)              Python Agent (SuperMew 扩展)
─────────────────────          ─────────────────────────────
CompetitorProduct 表    ──HTTP──▶  analyze_product ASIN 工具
ScoringService 评分      ──HTTP──▶  get_product_score 工具
ProductClickLogService  ──HTTP──▶  get_selection_stats 工具
                                    │
                                    ▼
                              LLM (豆包/火山引擎)
                                    │
                                    ▼
                              ProductAnalysisReport
```

**为什么不放在 Java 后端？** LLM 调用、Prompt 管理、流式输出这些能力 Python 生态（LangChain）比 Java 成熟得多。Java 专注于数据查询性能，Python 专注于 AI 编排。

---

## 2. Python Agent 工具设计

### 2.1 新增文件

```
agentic rag V2\SuperMew\backend\
├── product_tools.py          # 🆕 产品分析专用工具
├── product_analysis_model.py # 🆕 分析报告数据模型
└── agent.py                  # 🔧 修改：注册新工具
```

### 2.2 product_tools.py — 完整实现

```python
"""产品分析工具集 — Agent 可调用这些工具获取产品数据并生成分析报告"""

import os
import json
import httpx
from typing import Optional
from datetime import datetime
from dotenv import load_dotenv

from langchain_core.tools import tool
from langchain.chat_models import init_chat_model

load_dotenv()

# Java 后端地址
JAVA_PRODUCT_URL = os.getenv("JAVA_PRODUCT_URL", "http://java-product:8002")

# 分析专用 LLM（可配置不同于对话模型）
ANALYSIS_MODEL = os.getenv("ANALYSIS_MODEL", os.getenv("MODEL"))
API_KEY = os.getenv("ARK_API_KEY")
BASE_URL = os.getenv("BASE_URL")

_analysis_model = None

def _get_analysis_model():
    global _analysis_model
    if _analysis_model is None:
        _analysis_model = init_chat_model(
            model=ANALYSIS_MODEL,
            model_provider="openai",
            api_key=API_KEY,
            base_url=BASE_URL,
            temperature=0.3,
        )
    return _analysis_model


# ==================== 数据获取工具 ====================

@tool("get_product_data")
def get_product_data(asin: str, marketplace: str = "UK") -> dict:
    """
    获取单个产品的全维度数据。
    从 Java 后端 competitor_products 表查询，返回 20+ 维度原始数据。
    
    Args:
        asin: 产品 ASIN
        marketplace: 站点 (UK/DE/US)
    
    Returns:
        dict: 包含 title, price, units, bsr, ratings, fulfillment,
              weight, listingDays, score, grade 等字段的产品数据
    """
    try:
        resp = httpx.get(
            f"{JAVA_PRODUCT_URL}/api/v1/competitor/{asin}/detail",
            params={"marketplace": marketplace},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") == 200:
            return data.get("data", {})
        return {"error": data.get("message", "Unknown error")}
    except Exception as e:
        return {"error": f"Failed to fetch product data: {str(e)}"}


@tool("get_product_history")
def get_product_history(asin: str, marketplace: str = "UK") -> dict:
    """
    获取产品的历史月度数据，用于趋势分析。
    
    Args:
        asin: 产品 ASIN
        marketplace: 站点
    
    Returns:
        dict: { "months": [ {month, units, bsr, price, revenue, ...} ] }
    """
    try:
        resp = httpx.get(
            f"{JAVA_PRODUCT_URL}/api/v1/competitor/{asin}/history",
            params={"marketplace": marketplace},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") == 200:
            return data.get("data", {})
        return {"error": data.get("message", "Unknown error")}
    except Exception as e:
        return {"error": f"Failed to fetch history: {str(e)}"}


@tool("get_product_score")
def get_product_score(asin: str) -> dict:
    """
    获取产品评分详情，包括各维度得分和最终等级。
    
    Args:
        asin: 产品 ASIN
    
    Returns:
        dict: { score, grade, dimensions: [{key, displayName, weight, score}] }
    """
    try:
        resp = httpx.get(
            f"{JAVA_PRODUCT_URL}/api/v1/scoring/product-score",
            params={"asin": asin},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") == 200:
            return data.get("data", {})
        return {"error": "Score not found"}
    except Exception as e:
        return {"error": f"Failed to fetch score: {str(e)}"}


@tool("get_selection_info")
def get_selection_info(asin: str) -> dict:
    """
    获取某产品被哪些开发者标记为"选中"。
    
    Args:
        asin: 产品 ASIN
    
    Returns:
        dict: { selected_by: [{userId, userName}], selected_count, first_selected_at }
    """
    try:
        resp = httpx.get(
            f"{JAVA_PRODUCT_URL}/api/v1/click-logs/product-selection-info",
            params={"asin": asin},
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") == 200:
            return data.get("data", {})
        return {"selected_by": [], "selected_count": 0}
    except Exception as e:
        return {"error": f"Failed to fetch selection info: {str(e)}"}


# ==================== 分析工具 ====================

PRODUCT_ANALYSIS_PROMPT = """你是一位资深的亚马逊跨境电商选品分析师。请根据以下产品数据，生成一份专业的产品分析报告。

## 产品数据

{context}

## 分析要求

请按以下结构生成分析报告，用中文输出：

### 1. 产品摘要
- 一句话概括产品定位和价值
- 关键数据速览（价格、月销、BSR、评分等级）

### 2. 销量与市场表现
- 销量趋势（对比历史数据）
- 增长率分析（与同品类平均对比）
- BSR 走势解读

### 3. 竞争格局
- 卖家数量与变化趋势
- 评分与评价分析
- 品牌集中度判断

### 4. 运营分析
- 配送方式（FBA/FBM）与成本
- 产品重量与物流
- 上架天数与生命周期阶段

### 5. 评分解读
- 各维度得分及含义
- 加分项与扣分项

### 6. 风险评估
- 识别 2-3 个主要风险点
- 每个风险的影响程度和概率

### 7. 建议
- 是否适合跟进
- 如果是，建议的切入策略
- 需关注的指标

## 输出格式

请以 JSON 格式输出，方便程序处理：

```json
{{
  "summary": "一句话概述",
  "key_metrics": {{
    "price": 0,
    "monthly_sales": 0,
    "bsr_rank": 0,
    "rating": 0,
    "grade": "A",
    "listing_days": 0
  }},
  "score_breakdown": {{
    "total_score": 85,
    "grade": "A",
    "dimensions": [
      {{"name": "上架天数", "score": 90, "maxScore": 100, "weight": 25}},
      {{"name": "销量", "score": 80, "maxScore": 100, "weight": 35}},
      {{"name": "BSR排名", "score": 85, "maxScore": 100, "weight": 25}},
      {{"name": "价格", "score": 80, "maxScore": 100, "weight": 15}}
    ]
  }},
  "strengths": ["优势1", "优势2", "优势3"],
  "weaknesses": ["劣势1", "劣势2"],
  "risks": [
    {{"description": "风险描述", "severity": "high/medium/low", "probability": "high/medium/low"}}
  ],
  "recommendation": {{
    "action": "follow/observe/skip",
    "reason": "判断依据",
    "watch_metrics": ["需关注的指标"],
    "entry_strategy": "切入建议（若follow）"
  }},
  "tags": ["标签1", "标签2", "标签3"],
  "confidence": 0.85
}}
```

请严格按照 JSON 格式输出，不要包含额外文字。
"""


def build_analysis_context(product_data: dict, history: dict, score: dict, selection: dict) -> str:
    """将分散的数据源组装为 LLM 输入的上下文文本"""
    context_parts = []

    # 基础信息
    context_parts.append(f"""
## 基础信息
- 标题: {product_data.get('title', 'N/A')}
- ASIN: {product_data.get('asin', 'N/A')}
- 品牌: {product_data.get('brand', 'N/A')}
- 站点: {product_data.get('marketplace', 'N/A')}
- 类目: {product_data.get('nodeLabelPath', 'N/A')}
""")

    # 核心指标
    context_parts.append(f"""
## 核心指标
- 售价: {product_data.get('symbol', '')} {product_data.get('price', 'N/A')}
- Prime价: {product_data.get('primePrice', 'N/A')}
- 月销量: {product_data.get('units', 0)} 件
- 月销售额: {product_data.get('revenue', 'N/A')}
- 销量增长率: {product_data.get('unitsGr', 'N/A')}%
""")

    # BSR
    context_parts.append(f"""
## BSR 排名
- 当前 BSR: #{product_data.get('bsr', 'N/A')}
- 变化率: {product_data.get('bsrCr', 'N/A')}%
- 波动: {product_data.get('bsrCv', 'N/A')}
- 子类目: {product_data.get('bsrId', 'N/A')}
""")

    # 评分与评价
    context_parts.append(f"""
## 评分与评价
- 星评: {product_data.get('rating', 'N/A')}
- 评价数: {product_data.get('ratings', 0)}
- 评价增长率: {product_data.get('ratingsRate', 'N/A')}%
""")

    # 卖家与配送
    context_parts.append(f"""
## 卖家与配送
- 卖家: {product_data.get('sellerName', 'N/A')} ({product_data.get('sellerNation', 'N/A')})
- 卖家数: {product_data.get('sellers', 1)}
- 配送: {product_data.get('fulfillment', 'N/A')}
- 重量: {product_data.get('weight', 'N/A')}
- 尺寸: {product_data.get('dimension', 'N/A')}
- FBA费用: {product_data.get('fba', 'N/A')}
""")

    # 上架信息
    available_date = product_data.get('availableDate')
    listing_info = f"- 上架天数: {product_data.get('listingDays', 'N/A')}"
    if available_date:
        from datetime import datetime
        dt = datetime.fromtimestamp(available_date / 1000)
        listing_info += f"\n- 上架日期: {dt.strftime('%Y-%m-%d')}"
    context_parts.append(f"""
## 上架信息
{listing_info}
""")

    # 评分
    if score and 'grade' in score:
        context_parts.append(f"""
## 系统评分
- 综合评分: {score.get('score', 'N/A')} 分
- 等级: {score.get('grade', 'N/A')}
""")

    # 历史趋势
    if history and 'months' in history and len(history['months']) > 1:
        months_data = history['months']
        context_parts.append(f"""
## 历史趋势（共 {len(months_data)} 个月数据）
""")
        for m in months_data[-6:]:  # 最近 6 个月
            context_parts.append(
                f"- {m.get('month')}: 销量 {m.get('units', 0)}, "
                f"BSR #{m.get('bsr', 'N/A')}, 售价 {m.get('price', 'N/A')}"
            )

    # 标记信息
    if selection:
        context_parts.append(f"""
## 开发者关注
- 被 {selection.get('selected_count', 0)} 位开发者标记为选中
""")

    return "\n".join(context_parts)


@tool("generate_product_analysis")
def generate_product_analysis(asin: str, marketplace: str = "UK") -> dict:
    """
    综合生成产品分析报告。调用数据获取工具后，由 LLM 生成结构化分析。
    这是 Agent 的主要分析入口。
    
    Args:
        asin: 产品 ASIN
        marketplace: 站点
    
    Returns:
        dict: 完整分析报告 JSON
    """
    # 1. 收集数据
    product_data = get_product_data(asin, marketplace)
    if "error" in product_data:
        return {"error": product_data["error"]}
    
    history = get_product_history(asin, marketplace)
    score = get_product_score(asin)
    selection = get_selection_info(asin)
    
    # 2. 组装上下文
    context = build_analysis_context(product_data, history, score, selection)
    
    # 3. LLM 生成分析
    model = _get_analysis_model()
    prompt = PRODUCT_ANALYSIS_PROMPT.format(context=context)
    
    try:
        response = model.invoke(prompt)
        # 解析 JSON
        content = response.content if hasattr(response, 'content') else str(response)
        # 提取 JSON 块（可能被 markdown 包裹）
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        
        analysis = json.loads(content.strip())
        analysis["asin"] = asin
        analysis["marketplace"] = marketplace
        analysis["generated_at"] = datetime.utcnow().isoformat()
        analysis["data_sources"] = {
            "product_data": "competitor_products table",
            "history": f"{len(history.get('months', []))} months" if history else "N/A",
            "score": score.get("grade", "N/A") if score else "N/A",
            "selection": f"{selection.get('selected_count', 0)} developers" if selection else "0",
        }
        return analysis
    except json.JSONDecodeError as e:
        return {"error": f"JSON parse failed: {str(e)}", "raw_content": content}
    except Exception as e:
        return {"error": f"Analysis generation failed: {str(e)}"}


@tool("batch_analyze_products")
def batch_analyze_products(asin_list: list[str], marketplace: str = "UK") -> dict:
    """
    批量分析多个产品。对列表中的每个 ASIN 依次调用单产品分析。
    
    Args:
        asin_list: ASIN 列表
        marketplace: 站点
    
    Returns:
        dict: { results: [...], summary: {...} }
    """
    results = []
    for asin in asin_list:
        analysis = generate_product_analysis(asin, marketplace)
        results.append(analysis)
    
    # 生成批量总结
    if len(results) > 1:
        summary_context = "\n".join([
            f"- {r.get('asin', '?')}: {r.get('summary', 'N/A')} [{r.get('recommendation', {}).get('action', '?')}]"
            for r in results if "error" not in r
        ])
        model = _get_analysis_model()
        summary_prompt = f"""以下是 {len(results)} 个产品的分析摘要，请用 3-5 句话概括这批产品的共同特点：\n\n{summary_context}"""
        summary_response = model.invoke(summary_prompt)
        batch_summary = summary_response.content if hasattr(summary_response, 'content') else str(summary_response)
    else:
        batch_summary = results[0].get("summary", "") if results else ""
    
    return {
        "results": results,
        "batch_summary": batch_summary,
        "total": len(results),
        "succeeded": sum(1 for r in results if "error" not in r),
        "failed": sum(1 for r in results if "error" in r),
    }
```

### 2.3 在 agent.py 中注册新工具

```python
# agent.py 修改：注册产品分析工具

from product_tools import (
    get_product_data,
    get_product_history,
    get_product_score,
    get_selection_info,
    generate_product_analysis,
    batch_analyze_products,
)

agent = create_agent(
    model=model,
    tools=[
        get_current_weather,
        search_knowledge_base,       # 已有：知识库检索
        get_product_data,             # 🆕 产品数据
        get_product_history,          # 🆕 历史趋势
        get_product_score,            # 🆕 评分详情
        get_selection_info,           # 🆕 标记信息
        generate_product_analysis,    # 🆕 综合产品分析
        batch_analyze_products,       # 🆕 批量分析
    ],
    system_prompt=(
        "You are a helpful e-commerce analysis assistant. "
        "Use search_knowledge_base for document/knowledge questions. "
        "Use get_product_data/get_product_history for specific product queries. "
        "Use generate_product_analysis for comprehensive product evaluation. "
        "Use batch_analyze_products when the user wants to analyze multiple products. "
        "Once you call search_knowledge_base and receive its result, "
        "you MUST immediately produce the Final Answer. "
        "Do not call the same tool repeatedly in one turn. "
        "Always provide your analysis in Chinese."
    ),
)
```

---

## 3. Java 后端补充接口

分析层需要 Java 提供两个新接口：

### 3.1 产品详情接口

```java
// CompetitorController.java 新增

@GetMapping("/{asin}/detail")
@Operation(summary = "获取单个产品全维度详情")
public Result<CompetitorProductResponse> getProductDetail(
        @PathVariable String asin,
        @RequestParam(defaultValue = "UK") String marketplace) {
    CompetitorProduct product = competitorService.getDetail(asin, marketplace);
    return Result.success(CompetitorProductResponse.from(product));
}
```

### 3.2 产品评分接口

```java
// ScoringController.java 新增

@GetMapping("/product-score")
@Operation(summary = "获取单个产品评分详情")
public Result<Map<String, Object>> getProductScore(@RequestParam String asin) {
    CompetitorProduct product = productMapper.selectOne(
        new LambdaQueryWrapper<CompetitorProduct>()
            .eq(CompetitorProduct::getAsin, asin)
            .orderByDesc(CompetitorProduct::getCreatedAt)
            .last("LIMIT 1")
    );
    if (product == null) return Result.error("Product not found");

    Map<String, Object> result = new HashMap<>();
    result.put("score", product.getScore());
    result.put("grade", product.getGrade());
    result.put("weekTag", product.getWeekTag());
    // ... 返回各维度得分
    return Result.success(result);
}
```

### 3.3 标记信息查询

```java
// ProductClickLogController.java 新增

@GetMapping("/product-selection-info")
@Operation(summary = "获取某产品被哪些用户选中")
public Result<Map<String, Object>> productSelectionInfo(@RequestParam String asin) {
    List<String> asins = List.of(asin);
    Map<String, List<Map<String, Object>>> users = clickLogService.getSelectionUsers(asins);
    
    Map<String, Object> result = new HashMap<>();
    List<Map<String, Object>> selectedBy = users.getOrDefault(asin, List.of());
    result.put("selected_by", selectedBy);
    result.put("selected_count", selectedBy.size());
    return Result.success(result);
}
```

---

## 4. 分析触发机制

三种触发方式，适用于不同场景：

```
方式 A: 实时触发（WebSocket）
  ┌─────────┐  select   ┌──────────┐  WS通知   ┌───────────┐
  │ 前端标记  │─────────▶│ Java 后端 │─────────▶│ 前端展示    │
  └─────────┘           │ POST     │          │ "正在分析..."│
                        │ 分析任务  │          └───────────┘
                        └────┬─────┘
                             │ HTTP
                             ▼
                       ┌───────────┐
                       │ Python    │
                       │ Agent 分析 │
                       └───────────┘

方式 B: 定时批量（Celery Beat）
  ┌──────────────────────────────────────────────┐
  │ 每天 02:00 UTC                               │
  │                                             │
  │ 1. 查询 product_selection_snapshot           │
  │    WHERE analysis_version = 0               │
  │ 2. 按 marketplace 分组                       │
  │ 3. 批量调用 generate_product_analysis        │
  │ 4. 更新 analysis_version                     │
  │ 5. 分析报告入库 + 向量化 + Milvus              │
  └──────────────────────────────────────────────┘

方式 C: 对话触发（SuperMew Chat）
  用户在 SuperMew 对话中:
  "分析 B0XXXXX 这个产品"
  "分析一下最近一周标记的所有产品"
  → Agent 调用 generate_product_analysis / batch_analyze_products
  → 流式返回分析结果
```

### 定时任务实现（Celery Beat）

```python
# 新建: agentic rag V2/SuperMew/backend/product_analysis_tasks.py

from celery import Celery
from celery.schedules import crontab
import httpx
import os
from product_tools import generate_product_analysis

celery_app = Celery(
    'product_analysis',
    broker=os.getenv('CELERY_BROKER_URL', 'redis://redis:6379/0'),
)

JAVA_PRODUCT_URL = os.getenv("JAVA_PRODUCT_URL", "http://java-product:8002")


@celery_app.task(name="analyze_new_selections")
def analyze_new_selections():
    """每日定时：分析前一天新标记的产品"""
    # 1. 从 Java 后端获取待分析产品列表
    resp = httpx.get(
        f"{JAVA_PRODUCT_URL}/api/v1/click-logs/pending-analysis",
        timeout=30,
    )
    data = resp.json()
    pending = data.get("data", [])
    
    if not pending:
        return {"status": "ok", "analyzed": 0, "message": "No pending products"}
    
    results = []
    for item in pending:
        asin = item["asin"]
        marketplace = item.get("marketplace", "UK")
        try:
            analysis = generate_product_analysis(asin, marketplace)
            # 保存到 PostgreSQL + 向量化 + Milvus (阶段三)
            save_analysis_report(analysis)
            # 标记已分析
            httpx.post(
                f"{JAVA_PRODUCT_URL}/api/v1/click-logs/mark-analyzed",
                json={"asin": asin, "analysis_version": 1},
            )
            results.append({"asin": asin, "status": "success"})
        except Exception as e:
            results.append({"asin": asin, "status": "error", "error": str(e)})
    
    return {
        "status": "ok",
        "analyzed": len([r for r in results if r["status"] == "success"]),
        "errors": len([r for r in results if r["status"] == "error"]),
    }


celery_app.conf.beat_schedule = {
    "analyze-new-selections": {
        "task": "analyze_new_selections",
        "schedule": crontab(hour=2, minute=0),  # 每天凌晨 2 点
    },
}
```

---

## 5. 分析报告数据模型

```python
# 新建: agentic rag V2/SuperMew/backend/product_analysis_model.py

from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, DateTime, Text, JSON, Float
from database import Base


class ProductAnalysisReport(Base):
    """产品分析报告 — PostgreSQL 持久化"""
    __tablename__ = "product_analysis"

    id = Column(Integer, primary_key=True, autoincrement=True)
    asin = Column(String(20), nullable=False, index=True)
    marketplace = Column(String(10), nullable=False, default="UK")
    
    # 报告内容
    analysis_json = Column(JSON, nullable=False, comment="完整分析报告 JSON")
    summary = Column(String(500), comment="一句话摘要")
    
    # 评级信息
    score = Column(Integer, comment="综合评分 0-100")
    grade = Column(String(2), comment="等级 S/A/B/C/D")
    recommendation_action = Column(String(20), comment="建议: follow/observe/skip")
    
    # 标签
    tags = Column(JSON, comment="标签列表")
    
    # 元数据
    week_tag = Column(String(10), index=True, comment="分析周期: 2026-W21")
    version = Column(Integer, default=1, comment="同一产品第几次分析")
    is_current = Column(Integer, default=1, comment="是否最新版本")
    
    # 数据来源
    data_month = Column(String(10), comment="数据月份: yyyyMM")
    confidence = Column(Float, comment="LLM 置信度")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

---

## 6. 对话示例

```
用户: 分析 B0DJVXKRB7 这个产品

Agent 思考链:
  1. call get_product_data("B0DJVXKRB7")     → 获取 20+ 维度数据
  2. call get_product_history("B0DJVXKRB7")   → 获取历史趋势
  3. call get_selection_info("B0DJVXKRB7")    → 已选中用户列表
  4. call generate_product_analysis(...)       → 综合生成报告

Agent 输出:
  ## B0DJVXKRB7 产品分析报告

  ### 产品摘要
  这是一款上架 45 天的厨房收纳产品，FBA 配送，BSR 排名 #1,200
  呈下降趋势，月销 3,200 件且环比增长 23%，系统评分 A 级（85 分）。
  已被 2 位开发者标记关注。

  ### 销量与市场表现
  ...

  ### 风险评估
  1. ⚠️ 高风险：卖家数增长至 15 家，同品类竞争加剧
  2. ⚠️ 中风险：FBA 费用偏高，产品重量 2.3kg 导致物流成本较大
  ...

  ### 建议
  ✅ 跟进 — 适合小批量试销，重点关注竞品价格变化和 FBA 费用波动。
```
