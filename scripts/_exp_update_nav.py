"""验证：用 update_action_properties 改 NavigateAction 的 url（不启动采集，不耗额度）。"""
import json
import os
import sys
from urllib.parse import quote

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "产品数据", "八爪鱼api"))
from bazhuayu_api import BazhuayuClient, BazhuayuError  # noqa: E402

UK_TASK_ID = "5c2ae37f-3128-4c82-84d6-70ad6d3d3655"
NAV_ACTION_ID = "s6tnzlut7sp"
IMAGE_URL = "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL._AC_US200_.jpg"
NEW_URL = "https://www.amazon.co.uk/stylesnap?q=" + quote(IMAGE_URL, safe="")


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
    print("新 url:", NEW_URL, "\n")

    # 正确格式：properties 数组，name=Url
    candidates = [
        [{"actionId": NAV_ACTION_ID, "actionType": "NavigateAction",
          "properties": [{"name": "Url", "value": NEW_URL}]}],
    ]
    for actions in candidates:
        try:
            r = client.update_action_properties(UK_TASK_ID, actions)
            print("update_action_properties OK ->", json.dumps(r, ensure_ascii=False)[:400])
            break
        except BazhuayuError as e:
            print(f"BZY-ERR code={e.code} msg={e.message}")
        except Exception as e:
            print("ERROR:", e)

    # 回读确认是否写进去
    r = client.get_task_actions([UK_TASK_ID], action_types=["NavigateAction"])
    print("\n回读 NavigateAction ->", json.dumps(r, ensure_ascii=False)[:600])


if __name__ == "__main__":
    main()
