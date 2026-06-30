"""往循环步骤写 10 条 stylesnap URL，回读确认。actionId 来自客户端新加的 LoopAction。"""
import json
import os
import sys
from urllib.parse import quote

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "产品数据", "八爪鱼api"))
from bazhuayu_api import BazhuayuClient, BazhuayuError  # noqa: E402

UK_TASK_ID = "5c2ae37f-3128-4c82-84d6-70ad6d3d3655"
LOOP_ACTION_ID = "8djrlk2mqdh"

IMAGES = [
    "https://images-na.ssl-images-amazon.com/images/I/71rQ0mPnEUL._AC_US200_.jpg",
    "https://images-na.ssl-images-amazon.com/images/I/61UwVIG9HXL._AC_US200_.jpg",
    "https://m.media-amazon.com/images/I/51nywtkl2gL._AC_US200_.jpg",
    "https://m.media-amazon.com/images/I/51bz1GQvU6L._AC_US200_.jpg",
    "https://m.media-amazon.com/images/I/31kGqfAQ2yL._AC_US200_.jpg",
    "https://m.media-amazon.com/images/I/51PXxNyDmRL._AC_US200_.jpg",
    "https://m.media-amazon.com/images/I/41FOz4EYmKL._AC_US200_.jpg",
    "https://m.media-amazon.com/images/I/41Vb0xhnRUL._AC_US200_.jpg",
    "https://images-na.ssl-images-amazon.com/images/I/71xmuE8Es-L._AC_US200_.jpg",
    "https://m.media-amazon.com/images/I/416xyneuppL._AC_US200_.jpg",
]
URLS = ["https://www.amazon.co.uk/stylesnap?q=" + quote(u, safe="") for u in IMAGES]


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

    print(f"[1] updateLoopItems 写 {len(URLS)} 条 URL（actionId={LOOP_ACTION_ID}, UrlList）…")
    try:
        r = client.update_loop_items(
            task_id=UK_TASK_ID, action_id=LOOP_ACTION_ID,
            loop_type="UrlList", loop_items=URLS, is_append=False,
        )
        print("    ->", json.dumps(r, ensure_ascii=False))
    except BazhuayuError as e:
        print(f"    BZY-ERR code={e.code} msg={e.message}")
        return

    print("[2] 回读循环步骤…")
    r = client.get_task_actions([UK_TASK_ID], action_types=["LoopAction"])
    acts = r[0].get("actions", []) if isinstance(r, list) and r else []
    for a in acts:
        items = a.get("loopItems", [])
        print(f"    actionId={a.get('actionId')} loopType={a.get('loopType')} 共 {len(items)} 条")
        for i, it in enumerate(items[:3]):
            print(f"      [{i}] {it}")


if __name__ == "__main__":
    main()
