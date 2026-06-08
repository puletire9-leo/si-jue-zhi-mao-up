"""节点0: data_fetch — 从 Java 后端拉取聚合数据。

这是 Selection Graph 的入口节点（Agent主动拉取，非Java推送）。
无 LLM 调用，纯数据操作。
"""

import logging
import time
from typing import Any, Dict

from selection.state import SelectionState
from selection.java_client import get_java_client

logger = logging.getLogger(__name__)


async def data_fetch_node(state: SelectionState) -> Dict[str, Any]:
    """从 Java 拉取聚合数据，解析并填充 State。

    输入: state.batch_id, state.marketplace
    输出: state.raw_data, state.sub_categories

    错误处理: Java API 失败时写入 analysis_errors，不阻断后续节点。
    """
    batch_id = state["batch_id"]
    marketplace = state.get("marketplace", "UK")

    start_time = time.time()
    logger.info(f"[data_fetch] 开始拉取 batchId={batch_id}")

    try:
        client = get_java_client()
        raw_data = await client.get_aggregated_data(batch_id)

        # 解析小类列表
        sub_categories = []
        for product_line in raw_data.get("productLines", []):
            for sub in product_line.get("subCategories", []):
                sub["_bsr_id"] = product_line.get("bsrId", "")
                sub["_bsr_product_count"] = product_line.get("productCount", 0)
                sub_categories.append(sub)

        elapsed = int((time.time() - start_time) * 1000)
        logger.info(
            f"[data_fetch] 完成 — {len(sub_categories)} 个小类, {elapsed}ms"
        )

        return {
            "raw_data": raw_data,
            "sub_categories": sub_categories,
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
