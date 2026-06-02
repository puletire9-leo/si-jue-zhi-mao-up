# 阶段三：知识层 — 向量化存储与 RAG 检索

> 复用 SuperMew 的向量化流水线和 Milvus 基础设施，将分析报告转化为可检索的长期知识。

---

## 1. 从分析报告到知识库的数据流

```
ProductAnalysisReport (JSON)
    │
    ├─ PostgreSQL: product_analysis 表（结构化存储，支持精确查询）
    │
    └─ 文本格式化 → 分块 → 向量化 → Milvus（语义检索）
         │
         ├─ 稠密向量: BAAI/bge-m3 (1024维, 余弦归一化)
         ├─ 稀疏向量: BM25 (中文单字 + 英文单词分词)
         └─ 元数据: asin, marketplace, week_tag, grade, tags, analysis_version
```

---

## 2. 分析报告分块策略

分析报告 → 可检索文本块的转换：

```python
# 新建: agentic rag V2/SuperMew/backend/product_analysis_indexer.py

"""产品分析报告索引器 — 将分析报告向量化并写入 Milvus"""

import json
from typing import List, Dict
from datetime import datetime

from document_loader import DocumentLoader
from embedding import embedding_service
from milvus_client import milvus_manager
from milvus_writer import milvus_writer


def _format_analysis_for_search(report: dict) -> str:
    """
    将分析报告 JSON 格式化为适合 RAG 检索的自然语言文本。
    合并 product_analysis_reports 和 product_click_logs 的标记信息。
    """
    parts = []

    # 标题
    parts.append(f"产品分析报告：{report.get('asin', 'N/A')}")
    parts.append(f"站点：{report.get('marketplace', 'N/A')}")
    parts.append(f"生成时间：{report.get('generated_at', 'N/A')}")

    # 摘要
    parts.append(f"\n## 摘要\n{report.get('summary', '')}")

    # 关键指标
    metrics = report.get('key_metrics', {})
    if metrics:
        parts.append(f"\n## 关键指标")
        parts.append(f"- 售价：{metrics.get('price', 'N/A')}")
        parts.append(f"- 月销量：{metrics.get('monthly_sales', 'N/A')} 件")
        parts.append(f"- BSR排名：#{metrics.get('bsr_rank', 'N/A')}")
        parts.append(f"- 评分：{metrics.get('rating', 'N/A')} 星")
        parts.append(f"- 等级：{metrics.get('grade', 'N/A')}")
        parts.append(f"- 上架天数：{metrics.get('listing_days', 'N/A')}")

    # 评分详情
    score_detail = report.get('score_breakdown', {})
    if score_detail:
        parts.append(f"\n## 系统评分：{score_detail.get('total_score', 'N/A')} 分（{score_detail.get('grade', 'N/A')}）")
        for d in score_detail.get('dimensions', []):
            parts.append(f"- {d.get('name')}：{d.get('score')}/{d.get('maxScore')}（权重 {d.get('weight')}%）")

    # 优势
    strengths = report.get('strengths', [])
    if strengths:
        parts.append(f"\n## 优势")
        for s in strengths:
            parts.append(f"- {s}")

    # 劣势
    weaknesses = report.get('weaknesses', [])
    if weaknesses:
        parts.append(f"\n## 劣势")
        for w in weaknesses:
            parts.append(f"- {w}")

    # 风险
    risks = report.get('risks', [])
    if risks:
        parts.append(f"\n## 风险")
        for r in risks:
            parts.append(
                f"- [{r.get('severity', 'N/A')}] {r.get('description', '')} "
                f"（概率：{r.get('probability', 'N/A')}）"
            )

    # 建议
    rec = report.get('recommendation', {})
    if rec:
        parts.append(f"\n## 建议")
        parts.append(f"- 操作：{rec.get('action', 'N/A')}")
        parts.append(f"- 理由：{rec.get('reason', 'N/A')}")
        if rec.get('entry_strategy'):
            parts.append(f"- 切入策略：{rec.get('entry_strategy')}")
        if rec.get('watch_metrics'):
            parts.append(f"- 关注指标：{', '.join(rec.get('watch_metrics', []))}")

    # 标签
    tags = report.get('tags', [])
    if tags:
        parts.append(f"\n## 标签\n{', '.join(tags)}")

    return "\n".join(parts)


def _build_milvus_metadata(report: dict, chunk: dict, chunk_id: str) -> dict:
    """构建 Milvus 记录的元数据字段"""
    return {
        "text": chunk.get("text", ""),
        "filename": f"product_analysis_{report.get('asin')}_{report.get('week_tag', 'unknown')}",
        "file_type": "product_analysis",
        "file_path": "",
        "page_number": 0,
        "chunk_id": chunk_id,
        "parent_chunk_id": chunk.get("parent_chunk_id", ""),
        "root_chunk_id": chunk.get("root_chunk_id", ""),
        "chunk_level": chunk.get("chunk_level", 3),
        "chunk_idx": chunk.get("chunk_idx", 0),
    }


def index_product_analysis(report: dict) -> dict:
    """
    将一份产品分析报告索引到 Milvus。
    
    步骤：
    1. 格式化为自然语言文本
    2. 使用 DocumentLoader 三级滑动窗口分块（复用现有分块逻辑）
    3. 仅叶子层（L3）向量化
    4. 稠密+稀疏向量写入 Milvus
    
    Args:
        report: generate_product_analysis 的输出
    
    Returns:
        dict: { indexed_chunks, milvus_ids, filename }
    """
    asin = report.get("asin", "unknown")
    week = report.get("week_tag", datetime.utcnow().strftime("%Y-W%V"))
    filename = f"product_analysis_{asin}_{week}"
    
    # 1. 格式化
    text = _format_analysis_for_search(report)
    
    # 2. 手动分块（使用 DocumentLoader 的三级策略）
    #    分析报告是单页文本，作为 page_number=1 处理
    loader = DocumentLoader(chunk_size=500, chunk_overlap=50)
    
    base_doc = {
        "filename": filename,
        "file_path": "",
        "file_type": "product_analysis",
        "page_number": 1,
    }
    
    chunks = loader._split_page_to_three_levels(
        text=text,
        base_doc=base_doc,
        page_global_chunk_idx=0,
    )
    
    # 3. 仅叶子层（L3）向量化 + 写入 Milvus
    leaf_chunks = [c for c in chunks if c.get("chunk_level") == 3]
    
    if not leaf_chunks:
        return {"indexed_chunks": 0, "milvus_ids": [], "filename": filename}
    
    leaf_texts = [c["text"] for c in leaf_chunks]
    
    # 4. 向量化（复用现有 EmbeddingService）
    dense_embeddings, sparse_embeddings = embedding_service.get_all_embeddings(leaf_texts)
    
    # 5. 构建写入数据
    milvus_data = []
    for i, chunk in enumerate(leaf_chunks):
        record = _build_milvus_metadata(report, chunk, chunk.get("chunk_id", f"{filename}::l3::{i}"))
        record["dense_embedding"] = dense_embeddings[i]
        record["sparse_embedding"] = sparse_embeddings[i]
        milvus_data.append(record)
    
    # 6. 批量写入 Milvus（复用现有 MilvusWriter）
    result = milvus_writer.write_documents(milvus_data)
    
    # 7. 增量更新 BM25 状态（复用现有逻辑）
    embedding_service.increment_add_documents(leaf_texts)
    
    return {
        "indexed_chunks": len(leaf_chunks),
        "total_chunks": len(chunks),
        "milvus_ids": result.get("ids", []),
        "filename": filename,
    }


def delete_product_analysis(asin: str, week_tag: str = None) -> int:
    """
    从 Milvus 删除某产品的分析记录。
    删除所有版本（同一 asin 下的所有周分析），或指定周的版本。
    
    Args:
        asin: 产品 ASIN
        week_tag: 可选，指定删除某周的分析
    
    Returns:
        int: 删除的记录数
    """
    if week_tag:
        filter_expr = f'filename like "product_analysis_{asin}_{week_tag}%"'
    else:
        filter_expr = f'filename like "product_analysis_{asin}_%"'
    
    # 先查后删——获取文本以同步 BM25
    existing = milvus_manager.query(filter_expr=filter_expr, output_fields=["text", "filename"])
    
    if existing:
        texts = [item.get("text", "") for item in existing if item.get("text")]
        if texts:
            embedding_service.increment_remove_documents(texts)
    
    result = milvus_manager.delete(filter_expr=filter_expr)
    return result.get("delete_count", 0) if isinstance(result, dict) else 0
```

---

## 3. Milvus 集合设计

复用 SuperMew 现有的 `embeddings_collection`，通过 `file_type = "product_analysis"` 区分产品分析报告与普通文档。

```python
# milvus_client.py 中已有的 schema（直接复用，无需新建集合）

# 已有字段：
#   id (INT64, PK, auto_id)           — 自增主键
#   dense_embedding (FLOAT_VECTOR, 1024) — 稠密向量 (bge-m3)
#   sparse_embedding (SPARSE_FLOAT_VECTOR) — 稀疏向量 (BM25)
#   text (VARCHAR, 2000)              — 文本内容
#   filename (VARCHAR, 255)           — 产品分析用: "product_analysis_{asin}_{week}"
#   file_type (VARCHAR, 50)           — "product_analysis" 区分类型
#   file_path (VARCHAR, 1024)
#   page_number (INT64)
#   chunk_idx (INT64)
#   chunk_id (VARCHAR, 512)           — 格式: "{filename}::p1::l3::{idx}"
#   parent_chunk_id (VARCHAR, 512)    — 父块 ID，自动合并用
#   root_chunk_id (VARCHAR, 512)      — 根块 ID
#   chunk_level (INT64)               — 1/2/3
```

### 产品分析专用过滤示例

```python
# 只检索产品分析报告
filter_expr = 'file_type == "product_analysis"'

# 只检索某产品的分析
filter_expr = 'file_type == "product_analysis" and filename like "product_analysis_B0DJVXKRB7_%"'

# 只检索 S 级或 A 级产品
filter_expr = 'file_type == "product_analysis" and (filename like "%_S_%" or filename like "%_A_%")'

# 检索最近 4 周的分析
filter_expr = 'file_type == "product_analysis" and filename like "%2026-W2%"'
```

---

## 4. RAG 检索集成

### 4.1 新增产品知识检索工具

```python
# 扩展 product_tools.py

import os
from tools import emit_rag_step
from rag_pipeline import run_rag_graph
from milvus_client import milvus_manager

PRODUCT_FILTER = 'file_type == "product_analysis"'


@tool("search_product_knowledge")
def search_product_knowledge(query: str, top_k: int = 5) -> str:
    """
    在已分析的产品知识库中搜索。
    使用混合检索（稠密语义 + 稀疏关键词 + Jina Rerank）。
    
    适用场景：
    - "有哪些厨房收纳产品被评为 A 级以上？"
    - "最近有没有遇到卖家数增长过快的产品？"
    - "FBM 配送的产品中哪些销量比较好？"
    
    Args:
        query: 自然语言查询
        top_k: 返回结果数量
    
    Returns:
        str: 格式化的检索结果
    """
    emit_rag_step("🔍", "正在检索产品知识库...", f"查询: {query[:80]}")
    
    # 1. 向量化查询
    dense_embedding = embedding_service.get_embeddings([query])[0]
    sparse_embedding = embedding_service.get_sparse_embedding(query)
    
    # 2. 混合检索（复用现有 milvus 的 hybrid_retrieve）
    results = milvus_manager.hybrid_retrieve(
        dense_embedding=dense_embedding,
        sparse_embedding=sparse_embedding,
        top_k=top_k * 2,  # 多取一些给 rerank
        filter_expr=PRODUCT_FILTER,
    )
    
    # 3. 可选：Jina Rerank 精排（复用 rag_utils._rerank_documents）
    from rag_utils import _rerank_documents
    reranked = _rerank_documents(query, results) if results else results
    
    # 4. 自动合并父级上下文（复用 rag_utils._auto_merge_documents）
    from rag_utils import _auto_merge_documents
    merged = _auto_merge_documents(reranked)
    
    emit_rag_step("✅", f"产品知识检索完成，找到 {len(merged)} 个相关分析", "")
    
    if not merged:
        return "未在产品分析知识库中找到相关内容。"
    
    # 5. 格式化输出
    formatted = []
    for i, doc in enumerate(merged, 1):
        source = doc.get("filename", "Unknown")
        text = doc.get("text", "")
        formatted.append(f"[{i}] {source}:\n{text}")
    
    return "检索到的产品分析：\n\n" + "\n\n---\n\n".join(formatted)
```

### 4.2 Agent 集成

```python
# agent.py — 进一步扩展

from product_tools import search_product_knowledge  # 🆕

agent = create_agent(
    model=model,
    tools=[
        get_current_weather,
        search_knowledge_base,           # 通用文档知识库
        search_product_knowledge,        # 🆕 产品分析知识库（向量检索）
        get_product_data,                # 单产品实时数据
        get_product_history,             # 历史趋势
        generate_product_analysis,       # 单产品综合评估
        batch_analyze_products,          # 批量分析
    ],
    system_prompt=(
        "You are a helpful e-commerce product analysis assistant.\n"
        "When the user asks about previously analyzed products or general product "
        "knowledge/trends (e.g. 'which kitchen products have A grade?'), "
        "use search_product_knowledge to find relevant analyses.\n"
        "When the user asks about a specific new product, use get_product_data "
        "and generate_product_analysis.\n"
        "Do not call the same tool repeatedly in one turn.\n"
        "Always provide your analysis in Chinese."
    ),
)
```

---

## 5. 与 SuperMew 的组件复用关系

```
┌─────────────────────────────────────────────────────┐
│                  SuperMew 现有组件                      │
│                                                       │
│  ┌──────────────────────┐    ┌────────────────────┐  │
│  │ DocumentLoader        │    │ EmbeddingService    │  │
│  │ 三级滑动窗口分块       │    │ bge-m3 + BM25       │  │
│  │ _split_page_to_3...  │    │ get_all_embeddings │  │
│  └──────┬───────────────┘    └─────────┬──────────┘  │
│         │                              │              │
│         └──────────┬───────────────────┘              │
│                    ▼                                   │
│  ┌─────────────────────────────────────┐              │
│  │ MilvusManager / MilvusWriter         │              │
│  │ hybrid_retrieve (RRF 融合)           │              │
│  │ HNSW 稠密索引 + SPARSE_INVERTED 稀疏 │              │
│  └─────────────────────────────────────┘              │
│                    │                                   │
│  ┌─────────────────┴───────────────────┐              │
│  │ rag_pipeline (LangGraph 5节点)       │              │
│  │ 检索 → 评分 → 重写 → 扩展 → 聚合    │              │
│  └─────────────────────────────────────┘              │
│                    │                                   │
│  ┌─────────────────┴───────────────────┐              │
│  │ agent.py                             │              │
│  │ create_agent + SSE 流式输出           │              │
│  │ ConversationStorage 对话持久化        │              │
│  └─────────────────────────────────────┘              │
└───────────────────────────────────────────────────────┘

新增部分（本阶段）：
  ┌──────────────────────────────┐
  │ product_analysis_indexer.py  │  ← 格式化 + 分块 + 向量化 + 入库
  │ search_product_knowledge()   │  ← 产品知识专用检索工具
  │ product_analysis_model.py    │  ← PostgreSQL ORM 模型
  └──────────────────────────────┘

0 个新组件，100% 复用现有：
  ✅ DocumentLoader._split_page_to_three_levels()
  ✅ EmbeddingService.get_all_embeddings()
  ✅ MilvusManager.hybrid_retrieve()
  ✅ MilvusWriter.write_documents()
  ✅ rag_utils._rerank_documents()
  ✅ rag_utils._auto_merge_documents()
```

---

## 6. 检索示例

```
用户问题:
  "之前有没有分析过厨房收纳类的产品？它们整体表现怎么样？"

Agent 执行:
  1. search_product_knowledge("厨房收纳 产品分析 整体表现")
     → 混合检索: 稠密语义(厨房,收纳,整理,储物) + 稀疏关键词(收纳,产品,整理)
     → RRF 融合 60 条候选 → Jina Rerank 精排 Top 5
     → Auto-merge: 叶子块合并为父块
     → 结果: 3 个厨房收纳产品的分析报告

Agent 输出:
  "根据产品分析知识库，过去 4 周共有 3 款厨房收纳类产品被分析：

  1. B0DJVXKRB7 - 抽屉分隔板套装
     评级 A（85 分），月销 3,200，BSR #1,200
     建议跟进，但需关注卖家数增长趋势

  2. B0ABC12345 - 厨房水槽架
     评级 B（72 分），月销 1,800，BSR #3,500
     风险：FBM 配送成本高，利润率偏低

  3. B0XYZ67890 - 磁性刀架
     评级 A（88 分），月销 4,500，BSR #800
     S 级潜力，建议优先跟进

  整体来看，厨房收纳类产品市场需求旺盛，但竞争也在加剧。
  建议重点关注 BSR 排名高、上架时间短的新品。"
```

---

## 7. 知识入库时机

```
┌─────────────────────────────┐
│ 分析报告生成后即入库          │
│                             │
│ generate_product_analysis   │
│     → JSON 结果              │
│     → PostgreSQL 写入        │  (同步)
│     → index_product_analysis │  (异步, 后台任务)
│         → 文本格式化          │
│         → 三级分块            │
│         → 稠密+稀疏向量化     │
│         → Milvus 批量写入     │
│         → BM25 增量更新       │
└─────────────────────────────┘
```
