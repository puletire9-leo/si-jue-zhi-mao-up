"""显式按各 actionType 探测英国任务步骤。"""
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
    print("token OK")
    for at in (None, ["LoopAction"], ["NavigateAction"], ["EnterTextAction"],
               ["LoopAction", "NavigateAction", "EnterTextAction"]):
        r = client.get_task_actions([UK_TASK_ID], action_types=at)
        acts = r[0].get("actions", []) if isinstance(r, list) and r else []
        print(f"\nactionTypes={at} -> {len(acts)} 个步骤")
        print(json.dumps(acts, ensure_ascii=False))


if __name__ == "__main__":
    main()
