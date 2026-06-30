"""探测英国以图识图任务怎么写入 URL（不启动采集，不耗额度）。
依次试：getActions 各类型 → updateLoopItems。打印 API 原始返回/报错。"""
import json
import os
import sys
from urllib.parse import quote

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "产品数据", "八爪鱼api"))
from bazhuayu_api import BazhuayuClient, BazhuayuError  # noqa: E402

UK_TASK_ID = "5c2ae37f-3128-4c82-84d6-70ad6d3d3655"
IMAGE_URL = "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL._AC_US200_.jpg"
SEARCH_URL = "https://www.amazon.co.uk/stylesnap?q=" + quote(IMAGE_URL, safe="")


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
    print("token OK\n")

    # 试各种 actionType 看任务结构
    for at in (None, ["LoopAction"], ["EnterTextAction"], ["NavigateAction"]):
        try:
            r = client.get_task_actions([UK_TASK_ID], action_types=at)
            print(f"getActions({at}) ->", json.dumps(r, ensure_ascii=False)[:600])
        except Exception as e:
            print(f"getActions({at}) ERROR:", e)
    print()

    # 试 updateLoopItems（带一个空 actionId 和不带）
    for aid in ("", "loop"):
        try:
            r = client.update_loop_items(
                task_id=UK_TASK_ID, action_id=aid,
                loop_type="UrlList", loop_items=[SEARCH_URL],
            )
            print(f"updateLoopItems(actionId={aid!r}) OK ->", json.dumps(r, ensure_ascii=False)[:400])
        except BazhuayuError as e:
            print(f"updateLoopItems(actionId={aid!r}) BZY-ERR -> code={e.code} msg={e.message}")
        except Exception as e:
            print(f"updateLoopItems(actionId={aid!r}) ERROR ->", e)


if __name__ == "__main__":
    main()
