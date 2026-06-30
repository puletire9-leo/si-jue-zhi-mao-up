"""启动英国以图识图采集 → 轮询 → 拉结果打印。承接 _exp_urls10.py（10 条 URL 已写入）。"""
import json
import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "产品数据", "八爪鱼api"))
from bazhuayu_api import BazhuayuClient, BazhuayuError  # noqa: E402

UK_TASK_ID = "5c2ae37f-3128-4c82-84d6-70ad6d3d3655"


def read_env(path, key):
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:]
    return None


def main():
    base = os.path.join(os.path.dirname(__file__), "..")
    secrets = os.path.join(base, "config", "secrets", "prod.env")
    client = BazhuayuClient(
        username=read_env(secrets, "BAZHUAYU_USERNAME"),
        password=read_env(secrets, "BAZHUAYU_PASSWORD"),
    )
    client.get_access_token()
    print("token OK")

    print("[1] 启动云采集…")
    try:
        resp = client.start_extraction(UK_TASK_ID)
        print("    start ->", json.dumps(resp, ensure_ascii=False))
    except BazhuayuError as e:
        print(f"    BZY-ERR code={e.code} msg={e.message}")
        return

    print("[2] 轮询（最多 25 分钟，每 15s）…")
    deadline = time.time() + 25 * 60
    finished = False
    while time.time() < deadline:
        time.sleep(15)
        try:
            st = client.get_task_statuses_v2([UK_TASK_ID])
        except Exception as e:
            print("    status err:", e)
            continue
        node = st[0] if isinstance(st, list) and st else st
        status = node.get("status") if isinstance(node, dict) else None
        cnt = node.get("currentTotalExtractCount") if isinstance(node, dict) else None
        print(f"    status={status} count={cnt}")
        if status == "Finished":
            finished = True
            break

    print(f"[3] 拉结果（finished={finished}）…")
    result = client.get_all_data_by_offset(UK_TASK_ID, offset=0, size=50)
    rows = result.get("data", []) if isinstance(result, dict) else []
    print(f"    拉到 {len(rows)} 行")
    if rows:
        print("\n[4] 首行原始 JSON（字段核实用）：")
        print(json.dumps(rows[0], ensure_ascii=False, indent=2))
        if len(rows) > 1:
            print("\n[5] 第二行：")
            print(json.dumps(rows[1], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
