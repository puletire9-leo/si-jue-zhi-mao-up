"""选品分析 SSE 路由 — 前端直连的核心端点。

前端通过 SSE 建立长连接，实时接收每个节点的分析进度。

SSE 事件类型：
  - start:        分析开始
  - data_ready:   数据拉取完成，知道要分析多少个小类
  - sub_start:    某个小类开始分析
  - progress:     节点完成（含摘要信息）
  - node_error:   节点失败（不阻断流程）
  - sub_complete:  某个小类分析完成
  - heartbeat:    心跳保活
  - writeback:    正在回写 Java
  - complete:     全部分析完成
  - error:        图执行整体失败
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
    """SSE 端点 — 选品分析（多小类循环 + 回写Java）。

    前端调用方式:
    ```
    const evtSource = new EventSource(
      '/selection-api/selection/analyze?batchId=20260609-001&marketplace=UK'
    );
    evtSource.onmessage = (e) => {
      const data = JSON.parse(e.data);
      // data.event: start|data_ready|sub_start|progress|
      //             node_error|sub_complete|heartbeat|
      //             writeback|complete|error
    };
    ```

    典型事件流:
    1. start       → 分析开始
    2. data_ready  → "共N个小类待分析"
    3. sub_start   → "开始分析 Nail Tips"
    4. progress ×N → "能力1完成... 能力8完成..."
    5. sub_complete → "Nail Tips 分析完成"
    6. (重复3-5, N个小类)
    7. writeback   → "正在回写结果"
    8. complete    → "全部完成, 回写成功"
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

    直接返回分析结果摘要，同时自动回写 Java 后端。
    """
    logger.info(f"[sync] 新分析请求: batchId={batch_id}")
    result = await run_and_writeback(batch_id, marketplace)
    return result
