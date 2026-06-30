"""
英国以图识图 — 独立实验（不碰任何 Docker 容器，只调八爪鱼 API）
登录 → 生成 stylesnap 链接 → updateLoopItems 写进英国任务 → 启动 → 轮询 → 拉结果打印首行 JSON。
凭证从 config/secrets/prod.env 读，taskId 从 config/public/prod.env 的映射读。
"""
import json
import os
import sys
import time
from urllib.parse import quote

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "产品数据", "八爪鱼api"))
from bazhuayu_api import BazhuayuClient  # noqa: E402

# 实验输入：真实英国 ASIN 的图（来自 competitor_products）
ASIN = "178824432X"
IMAGE_URL = "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL._AC_US200_.jpg"
UK_TASK_ID = "5c2ae37f-3128-4c82-84d6-70ad6d3d3655"  # yitushitu.UK


def read_env(path, key):
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:]
    return None


def main():
    base = os.path.join(os.path.dirname(__file__), "..")
    secrets = os.path.join(base, "config", "secrets", "prod.env")
    username = read_env(secrets, "BAZHUAYU_USERNAME")
    password = read_env(secrets, "BAZHUAYU_PASSWORD")
    if not username or not password:
        print("缺少八爪鱼凭证")
        return

    search_url = "https://www.amazon.co.uk/stylesnap?q=" + quote(IMAGE_URL, safe="")
    print("[1] stylesnap 链接：")
    print("   ", search_url)

    client = BazhuayuClient(username=username, password=password)
    print("[2] 登录中…")
    client.get_access_token()
    print("    token OK")

    print("[3] updateLoopItems 写入英国任务…")
    client.update_loop_items(task_id=UK_TASK_ID, loop_type="UrlList", loop_items=[search_url])
    print("    写入成功")

    print("[4] 启动云采集…")
    resp = client.start_extraction(UK_TASK_ID)
    print("    start resp:", json.dumps(resp, ensure_ascii=False))

    print("[5] 轮询状态（最多 20 分钟）…")
    deadline = time.time() + 20 * 60
    while time.time() < deadline:
        time.sleep(15)
        st = client.get_task_statuses_v2([UK_TASK_ID])
        node = st[0] if isinstance(st, list) and st else st
        status = node.get("status") if isinstance(node, dict) else None
        cnt = node.get("currentTotalExtractCount") if isinstance(node, dict) else None
        print(f"    status={status} count={cnt}")
        if status == "Finished":
            break

    print("[6] 拉取结果…")
    result = client.get_all_data_by_offset(UK_TASK_ID, offset=0, size=20)
    rows = result.get("data", []) if isinstance(result, dict) else []
    print(f"    拉到 {len(rows)} 行")
    if rows:
        print("[7] 首行原始 JSON（字段核实用）：")
        print(json.dumps(rows[0], ensure_ascii=False, indent=2))
    else:
        print("    无结果行")


if __name__ == "__main__":
    main()
