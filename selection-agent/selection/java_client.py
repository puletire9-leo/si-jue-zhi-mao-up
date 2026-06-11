"""Java 后端 HTTP 客户端 — 选品Agent 专用。

职责：
  1. GET /api/v1/product-line/aggregated-data  → 拉取聚合数据（data_fetch节点调用）
  2. POST /api/v1/product-line/analysis-results → 回写分析结果（分析完成后调用）
  3. GET /api/v1/category-baseline/health       → 查询品类百分位基线
  4. POST /api/v1/category-baseline/compute      → 触发基线重新计算

参考 python-ai/app/clients/java_api_client.py 的 httpx 模式。
"""

import asyncio
import os
import logging
import threading
from typing import Any, Dict, List, Optional

import httpx
from httpx import ConnectError, TimeoutException

logger = logging.getLogger(__name__)

JAVA_BASE_URL = os.getenv("JAVA_BASE_URL", "http://localhost:8002")
REQUEST_TIMEOUT = 30.0
MAX_RETRIES = int(os.getenv("JAVA_MAX_RETRIES", "3"))
RETRY_DELAY = float(os.getenv("JAVA_RETRY_DELAY", "1.0"))


class JavaClient:
    """与 Java 后端交互的异步 HTTP 客户端。"""

    def __init__(self, base_url: str = JAVA_BASE_URL):
        self.base_url = base_url.rstrip("/")
        self.client = httpx.AsyncClient(timeout=REQUEST_TIMEOUT)
        self.max_retries = MAX_RETRIES
        self.retry_delay = RETRY_DELAY

    async def _request_with_retry(
        self, method: str, url: str, **kwargs
    ) -> httpx.Response:
        """带指数退避重试的 HTTP 请求。"""
        for attempt in range(self.max_retries):
            try:
                response = await self.client.request(method, url, **kwargs)
                response.raise_for_status()
                return response
            except (ConnectError, TimeoutException, httpx.HTTPStatusError) as e:
                if attempt < self.max_retries - 1:
                    delay = self.retry_delay * (2 ** attempt)
                    logger.warning(
                        f"请求失败(重试 {attempt+1}/{self.max_retries}, {delay}s): {url} — {e}"
                    )
                    await asyncio.sleep(delay)
                else:
                    raise
        # 不应到达这里
        raise RuntimeError(f"重试耗尽: {url}")

    async def get_aggregated_data(
        self, marketplace: str = "UK", month: str = ""
    ) -> Dict[str, Any]:
        """拉取郑总店铺品线聚合数据 — data_fetch 节点调用。

        从 deng_zong_shop 按 bsr_id (L1品线) + node_id (L2小类) 两级聚合。

        Args:
            marketplace: 站点 UK/DE
            month:       数据月份 如 202605

        Returns:
            Java 返回的完整聚合 JSON:
            {batchId, productLines: [{bsrId, subCategories: [...]}, ...]}

        Raises:
            httpx.HTTPStatusError: Java API 返回非200
            httpx.ConnectError: Java 服务不可达
        """
        url = f"{self.base_url}/api/v1/product-line/aggregated-data"
        logger.info(f"GET {url}?marketplace={marketplace}&month={month}")

        response = await self._request_with_retry("GET", url, params={
            "marketplace": marketplace,
            "month": month,
        })

        data = response.json()
        if isinstance(data, dict) and "data" in data and "code" in data:
            data = data["data"] or {}

        total_products = data.get("totalProducts", 0)
        product_lines = data.get("productLines", [])
        sub_count = sum(len(pl.get("subCategories", [])) for pl in product_lines)
        logger.info(
            f"拉取品线聚合数据成功: {len(product_lines)} L1品线, "
            f"{sub_count} L2小类, {total_products} 商品"
        )
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

        response = await self._request_with_retry(
            "POST", url, json={"batchId": batch_id, "results": results},
        )

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
            response = await self._request_with_retry("GET", url, params=params)
            data = response.json()
            # Java Result<T> 包装解包
            if isinstance(data, dict) and "data" in data and "code" in data:
                data = data["data"] or {}
            logger.info(f"获取品类基线成功: hasBaseline={data.get('hasBaseline', False)}")
            return data
        except Exception as e:
            logger.warning(f"获取品类基线失败（降级处理）: {e}")
            return {"hasBaseline": False, "error": str(e)}

    async def compute_baseline(
        self, marketplace: str, month: str
    ) -> Dict[str, Any]:
        """触发品类基线计算 — 管理员/定时任务调用。

        POST /api/v1/category-baseline/compute

        Args:
            marketplace: 站点 UK/DE/US
            month:       数据月份 如 2026-06

        Returns:
            计算摘要
        """
        url = f"{self.base_url}/api/v1/category-baseline/compute"
        params = {"marketplace": marketplace, "month": month}

        logger.info(f"触发基线计算: {marketplace}/{month}")

        try:
            response = await self._request_with_retry("POST", url, params=params)
            data = response.json()
            # Java Result<T> 包装解包
            if isinstance(data, dict) and "data" in data and "code" in data:
                data = data["data"] or {}
            logger.info(f"基线计算完成: {data}")
            return data
        except Exception as e:
            logger.error(f"触发基线计算失败: {e}")
            return {"success": False, "error": str(e)}

    async def query_competitor_products(
        self,
        marketplace: str,
        asins: List[str],
        month: str,
    ) -> List[Dict[str, Any]]:
        """批量查询竞品验证月数据 — 决策验证任务调用。

        POST /api/v1/competitor/products

        Args:
            marketplace: 站点 UK/DE/US
            asins:       ASIN 或 bsrId 列表
            month:       数据月份 如 2026-07

        Returns:
            竞品产品列表 [{"asin": "...", "bsr": ..., "units": ..., ...}, ...]

        Note:
            如 Java 端点尚未实现，返回空列表（调用方需处理降级）。
        """
        url = f"{self.base_url}/api/v1/competitor/products"
        logger.info(
            f"POST {url} — {marketplace}/{month}, {len(asins)} identifiers"
        )

        try:
            response = await self._request_with_retry(
                "POST",
                url,
                json={
                    "marketplace": marketplace,
                    "asin": asins,
                    "month": month,
                },
            )
            data = response.json()
            # Java Result<T> 包装解包
            if isinstance(data, dict) and "data" in data and "code" in data:
                data = data["data"] or []
            # PageResult 适配: {list:[...], total:N, page:N, size:N} → list
            if isinstance(data, dict) and "list" in data:
                data = data["list"]
            if isinstance(data, list):
                logger.info(
                    f"竞品查询成功: {len(data)}/{len(asins)} 条"
                )
                return data
            return []
        except Exception as e:
            logger.warning(f"竞品查询失败（返回空列表降级）: {e}")
            return []

    async def close(self):
        """关闭 httpx 客户端连接。"""
        await self.client.aclose()

    # ── 蓝海全品类扫描 API ─────────────────────────────────

    async def get_category_aggregation(
        self, marketplace: str, month: str
    ) -> List[Dict[str, Any]]:
        """获取全品类10维聚合数据 — 蓝海扫描 pipeline 调用。

        GET /api/v1/blue-ocean/category-aggregation

        Args:
            marketplace: 站点 UK/DE/US
            month:       数据月份 如 2026-06

        Returns:
            [{"category": "...", "new_ratio": 0.4, ...}, ...]

        Note:
            如 Java 端点尚未实现，抛出 AttributeError 由调用方降级。
        """
        url = f"{self.base_url}/api/v1/blue-ocean/category-aggregation"
        logger.info(f"GET {url} — {marketplace}/{month}")

        try:
            response = await self._request_with_retry(
                "GET", url,
                params={"marketplace": marketplace, "month": month},
            )
            data = response.json()
            if isinstance(data, dict) and "data" in data and "code" in data:
                data = data["data"] or []
            if isinstance(data, list):
                logger.info(f"品类聚合数据: {len(data)} 个品类")
                return data
            return []
        except Exception as e:
            logger.warning(f"品类聚合查询失败: {e}")
            raise

    async def get_category_products(
        self, marketplace: str, month: str, category: str
    ) -> List[Dict[str, Any]]:
        """获取单品类原始商品列表 — 测品推荐调用。

        GET /api/v1/blue-ocean/category-products

        Args:
            marketplace: 站点
            month:       数据月份
            category:    品类名称

        Returns:
            商品列表 [{"asin": "...", "price": ..., ...}, ...]
        """
        url = f"{self.base_url}/api/v1/blue-ocean/category-products"
        logger.debug(f"GET {url} — {marketplace}/{month}/{category}")

        try:
            response = await self._request_with_retry(
                "GET", url,
                params={
                    "marketplace": marketplace,
                    "month": month,
                    "category": category,
                },
            )
            data = response.json()
            if isinstance(data, dict) and "data" in data and "code" in data:
                data = data["data"] or []
            if isinstance(data, list):
                return data
            return []
        except Exception as e:
            logger.warning(f"品类商品查询失败({category}): {e}")
            return []

    async def post_blue_ocean_results(
        self, results: Dict[str, Any]
    ) -> bool:
        """回写蓝海扫描结果 — pipeline 完成后调用。

        POST /api/v1/blue-ocean/scan-results

        Args:
            results: 扫描结果（含 rankings + opportunity_cards）

        Returns:
            True=成功
        """
        url = f"{self.base_url}/api/v1/blue-ocean/scan-results"
        logger.info(f"POST {url} — {results.get('marketplace')}/{results.get('month')}")

        try:
            response = await self._request_with_retry(
                "POST", url, json=results,
            )
            logger.info("蓝海扫描结果回写成功")
            return True
        except Exception as e:
            logger.warning(f"蓝海扫描结果回写失败: {e}")
            return False

    # ── 卖家行为画像 API ─────────────────────────────────

    async def get_seller_raw_products(
        self, marketplace: str, month: str
    ) -> Dict[str, List[Dict[str, Any]]]:
        """获取全量卖家商品数据 — seller_scan 任务调用。

        GET /api/v1/seller/raw-products

        Args:
            marketplace: 站点 UK/DE/US
            month:       数据月份 如 2026-06

        Returns:
            {seller_name: [products]} 按卖家分组的商品数据
        """
        url = f"{self.base_url}/api/v1/seller/raw-products"
        logger.info(f"GET {url} — {marketplace}/{month}")

        try:
            response = await self._request_with_retry(
                "GET", url,
                params={"marketplace": marketplace, "month": month},
            )
            data = response.json()
            if isinstance(data, dict) and "data" in data and "code" in data:
                data = data["data"] or {}
            if isinstance(data, dict):
                logger.info(f"卖家商品数据: {len(data)} 个卖家")
                return data
            return {}
        except Exception as e:
            logger.warning(f"卖家商品数据获取失败: {e}")
            return {}

    async def get_seller_profiles_by_category(
        self, marketplace: str, category: str
    ) -> List[Dict[str, Any]]:
        """获取指定品类的卖家画像 — seller_profiling_node 调用。

        GET /api/v1/seller/profiles-by-category

        Args:
            marketplace: 站点
            category:    品类名称

        Returns:
            [{"seller_name": "...", "grade": "S", ...}, ...]
        """
        url = f"{self.base_url}/api/v1/seller/profiles-by-category"
        logger.debug(f"GET {url} — {marketplace}/{category}")

        try:
            response = await self._request_with_retry(
                "GET", url,
                params={"marketplace": marketplace, "category": category},
            )
            data = response.json()
            if isinstance(data, dict) and "data" in data and "code" in data:
                data = data["data"] or []
            if isinstance(data, list):
                return data
            return []
        except Exception as e:
            logger.warning(f"品类卖家画像获取失败({category}): {e}")
            return []

    async def post_seller_profiles(
        self, profiles: List[Dict[str, Any]]
    ) -> bool:
        """回写卖家画像 — seller_scan 完成后调用。

        POST /api/v1/seller/profiles

        Args:
            profiles: 卖家画像列表

        Returns:
            True=成功
        """
        url = f"{self.base_url}/api/v1/seller/profiles"
        logger.info(f"POST {url} — {len(profiles)} 条画像")

        try:
            response = await self._request_with_retry(
                "POST", url, json={"profiles": profiles},
            )
            logger.info("卖家画像回写成功")
            return True
        except Exception as e:
            logger.warning(f"卖家画像回写失败: {e}")
            return False

    async def post_follow_signals(
        self, signals: List[Dict[str, Any]]
    ) -> bool:
        """回写跟品信号 — seller_scan 完成后调用。

        POST /api/v1/seller/follow-signals

        Args:
            signals: 跟品信号列表

        Returns:
            True=成功
        """
        url = f"{self.base_url}/api/v1/seller/follow-signals"
        logger.info(f"POST {url} — {len(signals)} 条信号")

        try:
            response = await self._request_with_retry(
                "POST", url, json={"signals": signals},
            )
            logger.info("跟品信号回写成功")
            return True
        except Exception as e:
            logger.warning(f"跟品信号回写失败: {e}")
            return False

    async def post_heat_matrix(
        self, rows: List[Dict[str, Any]]
    ) -> bool:
        """回写品类热度矩阵 — seller_scan 完成后调用。

        POST /api/v1/seller/heat-matrix

        Args:
            rows: 品类热度行列表

        Returns:
            True=成功
        """
        url = f"{self.base_url}/api/v1/seller/heat-matrix"
        logger.info(f"POST {url} — {len(rows)} 行热度数据")

        try:
            response = await self._request_with_retry(
                "POST", url, json={"rows": rows},
            )
            logger.info("品类热度矩阵回写成功")
            return True
        except Exception as e:
            logger.warning(f"品类热度矩阵回写失败: {e}")
            return False

    async def get_dengzong_shops(
        self, marketplace: str
    ) -> List[str]:
        """获取郑总店铺名单。

        GET /api/v1/deng-zong-shop/sellers

        Args:
            marketplace: 站点

        Returns:
            ["shop_name_1", ...]
        """
        url = f"{self.base_url}/api/v1/deng-zong-shop/sellers"
        logger.debug(f"GET {url} — {marketplace}")

        try:
            response = await self._request_with_retry(
                "GET", url,
                params={"marketplace": marketplace},
            )
            data = response.json()
            if isinstance(data, dict) and "data" in data and "code" in data:
                data = data["data"] or []
            if isinstance(data, list):
                # Java 返回 List<DengZongShopSeller>，提取 sellerName
                names = [
                    d.get("sellerName", "") if isinstance(d, dict) else str(d)
                    for d in data
                ]
                logger.info(f"郑总店铺: {len(names)} 个")
                return names
            return []
        except Exception as e:
            logger.warning(f"郑总店铺名单获取失败: {e}")
            return []


# 全局单例（供各节点直接导入使用）
_java_client: Optional[JavaClient] = None
_java_client_lock = threading.Lock()


def get_java_client() -> JavaClient:
    """获取全局 JavaClient 单例（线程安全）。"""
    global _java_client
    if _java_client is None:
        with _java_client_lock:
            if _java_client is None:
                _java_client = JavaClient()
    return _java_client
