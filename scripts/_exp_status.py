"""只查英国任务当前云端状态 + 循环步骤实际内容（确认 loopType/URL 是否正确）。"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "产品数据", "八爪鱼api"))
from bazhuayu_api import BazhuayuClient  # noqa: E402

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

    st = client.get_task_statuses_v2([UK_TASK_ID])
    print("状态:", json.dumps(st, ensure_ascii=False))

    # 子任务状态（每条 URL 一个子任务）
    try:
        sub = client.get_subtask_statuses(UK_TASK_ID, page=1, size=20)
        print("\n子任务:", json.dumps(sub, ensure_ascii=False)[:800])
    except Exception as e:
        print("子任务查询:", repr(e))

    # 循环步骤实际内容
    r = client.get_task_actions([UK_TASK_ID], action_types=["LoopAction"])
    acts = r[0].get("actions", []) if isinstance(r, list) and r else []
    for a in acts:
        print(f"\n循环: loopType={a.get('loopType')} 共 {len(a.get('loopItems', []))} 条")


if __name__ == "__main__":
    main()
