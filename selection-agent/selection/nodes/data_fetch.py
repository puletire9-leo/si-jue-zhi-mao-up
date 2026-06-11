"""节点0: data_fetch — 从 Java 后端拉取聚合数据。

由 runner 层直接调用一次（不在分析图内）。
无 LLM 调用，纯数据操作。
"""

import logging
import time
from typing import Any, Dict

from selection.state import SelectionState
from selection.java_client import get_java_client

logger = logging.getLogger(__name__)


async def data_fetch_node(state: SelectionState) -> Dict[str, Any]:
    """从 Java 拉取郑总店铺品线聚合数据（L1品线→L2小类→样本商品）。

    数据源: deng_zong_shop 表
    结构: productLines[{bsrId, subCategories[{nodeId, nodeName, ...}]}]

    输入: state.marketplace, state 中的 month
    输出: state.raw_data, state.sub_categories（展平为 L2 小类列表，每个小类标记所属 L1 品线）

    错误处理: Java API 失败时写入 analysis_errors，不阻断后续节点。
    """
    marketplace = state.get("marketplace", "UK")
    month = state.get("month", "")

    start_time = time.time()
    logger.info(f"[data_fetch] 开始拉取郑总品线: marketplace={marketplace}, month={month}")

    try:
        client = get_java_client()
        raw_data = await client.get_aggregated_data(marketplace=marketplace, month=month)

        # 展平 L1→L2 树形结构为小类列表（Agent按小类逐个分析）
        sub_categories = []
        for product_line in raw_data.get("productLines", []):
            bsr_id = product_line.get("bsrId", "")
            for sub in product_line.get("subCategories", []):
                sub["_bsr_id"] = bsr_id
                sub["_product_line"] = product_line.get("bsrId", "")
                sub["_l1_product_count"] = product_line.get("productCount", 0)
                sub["_l1_store_count"] = product_line.get("storeCount", 0)
                sub["_l1_avg_profit_rate"] = product_line.get("avgProfitRate", 0)
                sub_categories.append(sub)

        elapsed = int((time.time() - start_time) * 1000)
        logger.info(
            f"[data_fetch] 完成 — {len(raw_data.get('productLines', []))} L1品线, "
            f"{len(sub_categories)} L2小类, {elapsed}ms"
        )

        return {
            "raw_data": raw_data,
            "sub_categories": sub_categories,
            "batch_id": raw_data.get("batchId", ""),
            "month": raw_data.get("month", month),
        }

    except Exception as e:
        elapsed = int((time.time() - start_time) * 1000)
        error_msg = f"data_fetch 失败: {e}"
        logger.error(f"[data_fetch] {error_msg} ({elapsed}ms)")

        return {
            "raw_data": {},
            "sub_categories": [],
            "analysis_errors": state.get("analysis_errors", []) + [error_msg],
        }
