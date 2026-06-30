"""英国以图识图任务 — 探测循环步骤 actionId（只登录+查步骤，不启动采集，不耗额度）。"""
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
    username = read_env(secrets, "BAZHUAYU_USERNAME")
    password = read_env(secrets, "BAZHUAYU_PASSWORD")

    client = BazhuayuClient(username=username, password=password)
    print("[1] 登录…")
    client.get_access_token()
    print("    token OK")

    print("[2] 查任务全部步骤…")
    actions = client.get_task_actions([UK_TASK_ID])
    print(json.dumps(actions, ensure_ascii=False, indent=2)[:4000])


if __name__ == "__main__":
    main()
