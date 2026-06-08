"""Java 后端 HTTP 客户端 — 选品Agent 专用。

职责：
  1. GET /api/v1/product-line/aggregated-data  → 拉取聚合数据（data_fetch节点调用）
  2. POST /api/v1/product-line/analysis-results → 回写分析结果（分析完成后调用）

参考 python-ai/app/clients/java_api_client.py 的 httpx 模式。
"""

import os
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

JAVA_BASE_URL = os.getenv("JAVA_BASE_URL", "http://localhost:8080")
REQUEST_TIMEOUT = 30.0


class JavaClient:
    """与 Java 后端交互的异步 HTTP 客户端。"""

    def __init__(self, base_url: str = JAVA_BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)

    async def get_aggregated_data(self, batch_id: str) -> Dict[str, Any]:
        """拉取聚合数据 — data_fetch 节点调用。

        Args:
            batch_id: 批次ID（如 "20260609-001"）

        Returns:
            Java 返回的完整聚合 JSON

        Raises:
            httpx.HTTPStatusError: Java API 返回非200
            httpx.ConnectError: Java 服务不可达
        """
        url = f"{self.base_url}/api/v1/product-line/aggregated-data"
        logger.info(f"GET {url}?batchId={batch_id}")

        response = await self.client.get(url, params={"batchId": batch_id})
        response.raise_for_status()

        data = response.json()
        logger.info(f"拉取聚合数据成功: {len(data.get('productLines', []))} 品线")
        return data

    async def post_analysis_results(
        self, batch_id: str, results: List[Dict[str, Any]]
    ) -> bool:
        """回写分析结果 — final_verdict 节点完成后调用。

        Args:
            batch_id: 批次ID
            results: 每个小类的分析结果列表

        Returns:
            True 表示回写成功
        """
        url = f"{self.base_url}/api/v1/product-line/analysis-results"
        logger.info(f"POST {url} — {len(results)} 条结果")

        response = await self.client.post(
            url,
            json={"batchId": batch_id, "results": results},
        )
        response.raise_for_status()

        logger.info("分析结果回写成功")
        return True

    async def get_category_baseline(
        self, marketplace: str, category_label: str, month: Optional[str] = None
    ) -> Dict[str, Any]:
        """获取品类基线数据 — final_verdict 节点调用。

        Args:
            marketplace:    站点 UK/DE/US
            category_label: 品类名称
            month:          基线月份（可选，默认取最新）

        Returns:
            品类基线数据（含百分位和健康度）
        """
        url = f"{self.base_url}/api/v1/category-baseline/health"
        params = {"marketplace": marketplace, "categoryLabel": category_label}
        if month:
            params["month"] = month

        logger.info(f"GET {url} — {marketplace}/{category_label}")

        try:
            response = await self.client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            logger.info(f"获取品类基线成功: hasBaseline={data.get('hasBaseline', False)}")
            return data
        except Exception as e:
            logger.warning(f"获取品类基线失败（降级处理）: {e}")
            return {"hasBaseline": False, "error": str(e)}

    async def close(self):
        """关闭 httpx 客户端连接。"""
        await self.client.aclose()


# 全局单例（供各节点直接导入使用）
_java_client: Optional[JavaClient] = None


def get_java_client() -> JavaClient:
    """获取全局 JavaClient 单例。"""
    global _java_client
    if _java_client is None:
        _java_client = JavaClient()
    return _java_client
