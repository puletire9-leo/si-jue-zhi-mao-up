"""Selection toolset — register 5 selection tools for AIAgent.

Registered tools:
- sel_fetch_product_line: Fetch product line data from Java aggregated-data API
- sel_preprocess: Preprocess a sub-category (dedup, sample, tag signals)
- sel_analyze: Full AI analysis for a node (preprocess + AI call)
- sel_load_model: Load cached model JSON for a node
- sel_save_model: Save analysis results to DB + files
"""

import json as _json
import logging
import os
from pathlib import Path
from typing import Any

import httpx
import pymysql

from tools.registry import registry, tool_error, tool_result
from tools.selection import preprocess, ai_analyzer, save_results

logger = logging.getLogger(__name__)

_TOOLSET = "selection"

DB_CONFIG = {
    "host": os.environ.get("MYSQL_HOST", "mysql"),
    "port": int(os.environ.get("MYSQL_PORT", "3306")),
    "user": os.environ.get("MYSQL_USER", "sijue"),
    "password": os.environ.get("MYSQL_PASSWORD", ""),
    "database": os.environ.get("MYSQL_DATABASE", "sijuelishi_dev"),
    "charset": "utf8mb4",
}


def _get_db():
    return pymysql.connect(**DB_CONFIG)


def _check_selection_env():
    return bool(os.environ.get("DEEPSEEK_API_KEY"))

def _check_mysql_env():
    """Only check MySQL — no API key needed. For tools that read cache/DB only."""
    return bool(os.environ.get("MYSQL_HOST") or os.environ.get("MYSQL_USER"))


def _handle_fetch_product_line(args: dict[str, Any], **kwargs: Any) -> str:
    marketplace = args.get("marketplace", "UK")
    month = args.get("month", "")
    java_url = os.environ.get(
        "JAVA_AGGREGATED_URL",
        "http://java-backend:8080/api/v1/product-line/aggregated-data",
    )
    try:
        resp = httpx.get(java_url, params={"marketplace": marketplace, "month": month}, timeout=30)
        resp.raise_for_status()
        return tool_result(resp.json().get("data", {}))
    except Exception as e:
        return tool_error(f"Failed to fetch product line: {e}")


def _handle_preprocess(args: dict[str, Any], **kwargs: Any) -> str:
    marketplace = args.get("marketplace", "UK")
    month = args.get("month", "")
    node_id = int(args["node_id"])
    node_name = args.get("node_name", "")
    node_full_path = args.get("node_full_path", "")
    bsr_id = args.get("bsr_id", "")
    conn = _get_db()
    try:
        analysis = preprocess.preprocess_sub_category(
            conn, marketplace, month, node_id,
            node_name=node_name, node_full_path=node_full_path, bsr_id=bsr_id,
        )
        if analysis is None:
            return tool_error("Sub-category has <10 products, skipped")
        return tool_result({
            "node_id": analysis.node_id,
            "node_name": analysis.node_name,
            "bsr_id": analysis.bsr_id,
            "stats": analysis.stats,
            "signal_distribution": analysis.signal_distribution,
        })
    except Exception as e:
        return tool_error(f"Preprocess failed: {e}")
    finally:
        conn.close()


def _handle_analyze(args: dict[str, Any], **kwargs: Any) -> str:
    marketplace = args.get("marketplace", "UK")
    month = args.get("month", "")
    node_id = int(args["node_id"])
    node_name = args.get("node_name", "")
    node_full_path = args.get("node_full_path", "")
    bsr_id = args.get("bsr_id", "")
    model = args.get("model", "deepseek-v4-flash")
    batch_id = args.get("batch_id", "")

    conn = _get_db()
    try:
        analysis = preprocess.preprocess_sub_category(
            conn, marketplace, month, node_id,
            node_name=node_name, node_full_path=node_full_path, bsr_id=bsr_id,
        )
        if analysis is None:
            return tool_error("Sub-category has <10 products, skipped")

        result = ai_analyzer.ai_analyze(analysis, model=model)
        if result is None:
            return tool_error("AI analysis failed after retries")

        # Save to DB if batch_id provided (avoids duplicate AI in sel_save_model)
        if batch_id:
            save_results.save_sub_category_results(
                conn, analysis, result, marketplace, month, batch_id,
            )

        model_json = save_results.generate_model_json(analysis, result)
        return tool_result({
            "node_id": node_id,
            "node_name": node_name,
            "overall_health": result.overall_health,
            "filter_rules": getattr(result, "filter_rules", []),
            "model": model_json,
            "saved": bool(batch_id),
        })
    except Exception as e:
        return tool_error(f"Analysis failed: {e}")
    finally:
        conn.close()


def _handle_load_model(args: dict[str, Any], **kwargs: Any) -> str:
    marketplace = args.get("marketplace", "UK")
    node_id = int(args["node_id"])
    bsr_id = args.get("bsr_id", "")
    base_dir = os.environ.get("MODEL_BASE_DIR", "/app/zheng_model_v1")

    try:
        if bsr_id:
            file_path = Path(base_dir) / marketplace / bsr_id / "by_node_id" / f"{node_id}.json"
        else:
            file_path = None
            base = Path(base_dir) / marketplace
            if base.exists():
                for bsr_dir in base.iterdir():
                    candidate = bsr_dir / "by_node_id" / f"{node_id}.json"
                    if candidate.exists():
                        file_path = candidate
                        break

        if file_path and file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                data = _json.load(f)
            return tool_result({"cached": True, "model": data})
        return tool_result({"cached": False})
    except Exception as e:
        return tool_error(f"Load model failed: {e}")


def _handle_save_model(args: dict[str, Any], **kwargs: Any) -> str:
    marketplace = args.get("marketplace", "UK")
    month = args.get("month", "")
    node_id = int(args["node_id"])
    batch_id = args.get("batch_id", "")
    node_name = args.get("node_name", "")
    node_full_path = args.get("node_full_path", "")
    bsr_id = args.get("bsr_id", "")
    analysis_json = args.get("analysis_json")
    result_json = args.get("result_json")

    conn = _get_db()
    try:
        if analysis_json and result_json:
            analysis = _json.loads(analysis_json)
            result = _json.loads(result_json)
            if not isinstance(analysis, SubCategoryAnalysis):
                analysis = preprocess.preprocess_sub_category(
                    conn, marketplace, month, node_id,
                    node_name=node_name, node_full_path=node_full_path, bsr_id=bsr_id,
                )
                result = ai_analyzer.ai_analyze(analysis) if analysis else None
        else:
            analysis = preprocess.preprocess_sub_category(
                conn, marketplace, month, node_id,
                node_name=node_name, node_full_path=node_full_path, bsr_id=bsr_id,
            )
            result = ai_analyzer.ai_analyze(analysis) if analysis else None

        if analysis is None:
            return tool_error("Sub-category has <10 products, skipped")
        if result is None:
            return tool_error("AI analysis failed after retries")

        summary = save_results.save_sub_category_results(
            conn, analysis, result, marketplace, month, batch_id,
        )
        return tool_result({
            "node_name": summary["node_name"],
            "node_id": summary["node_id"],
            "md_path": summary.get("md_path", ""),
            "db_rows": summary.get("db_rows", 0),
        })
    except Exception as e:
        return tool_error(f"Save model failed: {e}")
    finally:
        conn.close()


registry.register(
    name="sel_fetch_product_line",
    toolset=_TOOLSET,
    schema={
        "description": "Fetch product line data (L1+L2 categories) from Java aggregated-data API",
        "parameters": {
            "type": "object",
            "properties": {
                "marketplace": {"type": "string", "description": "Marketplace code (UK/DE)", "default": "UK"},
                "month": {"type": "string", "description": "Data month YYYYMM"},
            },
            "required": ["month"],
        },
    },
    handler=_handle_fetch_product_line,
    check_fn=_check_mysql_env,
    requires_env=["MYSQL_HOST"],
    is_async=False,
    description="Fetch product line data from Java aggregated-data API",
)

registry.register(
    name="sel_preprocess",
    toolset=_TOOLSET,
    schema={
        "description": "Preprocess a sub-category: fetch products, dedup variants, sample, tag signals",
        "parameters": {
            "type": "object",
            "properties": {
                "marketplace": {"type": "string", "description": "Marketplace code"},
                "month": {"type": "string", "description": "Data month YYYYMM"},
                "node_id": {"type": "integer", "description": "Sub-category node ID"},
                "node_name": {"type": "string", "description": "Sub-category name"},
                "node_full_path": {"type": "string", "description": "Full category path"},
                "bsr_id": {"type": "string", "description": "BSR category ID"},
            },
            "required": ["month", "node_id"],
        },
    },
    handler=_handle_preprocess,
    check_fn=_check_mysql_env,
    requires_env=["MYSQL_HOST"],
    is_async=False,
    description="Preprocess a sub-category for AI analysis",
)

registry.register(
    name="sel_analyze",
    toolset=_TOOLSET,
    schema={
        "description": "Run full AI analysis on a node: preprocess + DeepSeek AI call. Returns model JSON with filter_rules. When batch_id provided, also saves results to DB.",
        "parameters": {
            "type": "object",
            "properties": {
                "marketplace": {"type": "string", "description": "Marketplace code"},
                "month": {"type": "string", "description": "Data month YYYYMM"},
                "node_id": {"type": "integer", "description": "Sub-category node ID"},
                "node_name": {"type": "string", "description": "Sub-category name"},
                "node_full_path": {"type": "string", "description": "Full category path"},
                "bsr_id": {"type": "string", "description": "BSR category ID"},
                "model": {"type": "string", "description": "AI model name"},
                "batch_id": {"type": "string", "description": "Batch ID — saves to DB when provided, skipping duplicate AI from sel_save_model"},
            },
            "required": ["month", "node_id"],
        },
    },
    handler=_handle_analyze,
    check_fn=_check_selection_env,
    requires_env=["DEEPSEEK_API_KEY"],
    is_async=False,
    description="Run full AI analysis on a sub-category",
)

registry.register(
    name="sel_load_model",
    toolset=_TOOLSET,
    schema={
        "description": "Load cached model JSON for a node from filesystem",
        "parameters": {
            "type": "object",
            "properties": {
                "marketplace": {"type": "string", "description": "Marketplace code"},
                "node_id": {"type": "integer", "description": "Sub-category node ID"},
                "bsr_id": {"type": "string", "description": "BSR category ID (optional, speeds lookup)"},
            },
            "required": ["node_id"],
        },
    },
    handler=_handle_load_model,
    check_fn=None,
    requires_env=[],
    is_async=False,
    description="Load cached model JSON for a node",
)

registry.register(
    name="sel_save_model",
    toolset=_TOOLSET,
    schema={
        "description": "Save analysis results: preprocess + AI analyze + write to DB and files",
        "parameters": {
            "type": "object",
            "properties": {
                "marketplace": {"type": "string", "description": "Marketplace code"},
                "month": {"type": "string", "description": "Data month YYYYMM"},
                "node_id": {"type": "integer", "description": "Sub-category node ID"},
                "node_name": {"type": "string", "description": "Sub-category name"},
                "node_full_path": {"type": "string", "description": "Full category path"},
                "bsr_id": {"type": "string", "description": "BSR category ID"},
                "batch_id": {"type": "string", "description": "Analysis batch ID"},
            },
            "required": ["month", "node_id", "batch_id"],
        },
    },
    handler=_handle_save_model,
    check_fn=_check_selection_env,
    requires_env=["DEEPSEEK_API_KEY"],
    is_async=False,
    description="Save full analysis results to DB + files",
)
