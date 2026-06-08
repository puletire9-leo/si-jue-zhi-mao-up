"""选品分析 SSE 路由 — 前端直连的核心端点。

前端通过 SSE 建立长连接，实时接收每个节点的分析进度。
"""

import json
import logging

from fastapi import APIRouter, Query
from sse_starlette.sse import EventSourceResponse

from selection.runner import run_selection_stream, run_and_writeback

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/selection", tags=["选品分析"])


@router.get("/analyze")
async def analyze_selection(
    batch_id: str = Query(..., description="批次ID"),
    marketplace: str = Query("UK", description="站点 UK/DE/US"),
):
    """SSE 端点 — 选品分析。

    前端调用方式:
    ```
    const evtSource = new EventSource(
      '/selection-api/selection/analyze?batchId=20260609-001&marketplace=UK'
    );
    evtSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      // data.event: "start" | "progress" | "node_error" | "complete" | "error"
      // data.data: {node, display, elapsed_ms, ...}
    };
    ```

    SSE 事件格式:
    - event=start: 分析开始
    - event=progress: 节点完成（含摘要信息）
    - event=node_error: 节点失败（不阻断流程）
    - event=complete: 全部分析完成
    - event=error: 图执行整体失败
    """
    logger.info(f"[SSE] 新分析请求: batchId={batch_id}, marketplace={marketplace}")

    async def event_generator():
        async for event in run_selection_stream(batch_id, marketplace):
            yield {
                "event": event["event"],
                "data": json.dumps(event["data"], ensure_ascii=False),
            }

    return EventSourceResponse(event_generator())


@router.post("/analyze-sync")
async def analyze_selection_sync(
    batch_id: str = Query(..., description="批次ID"),
    marketplace: str = Query("UK", description="站点 UK/DE/US"),
):
    """同步端点 — 分析并回写（用于内部调用/定时任务）。

    直接返回分析结果，同时自动回写 Java 后端。
    """
    logger.info(f"[sync] 新分析请求: batchId={batch_id}")
    result = await run_and_writeback(batch_id, marketplace)
    return result
