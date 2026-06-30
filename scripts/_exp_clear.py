"""停掉运行中的采集 + 清空循环步骤的网址列表，解除客户端锁定。"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "产品数据", "八爪鱼api"))
from bazhuayu_api import BazhuayuClient, BazhuayuError  # noqa: E402

UK_TASK_ID = "5c2ae37f-3128-4c82-84d6-70ad6d3d3655"
LOOP_ACTION_ID = "8djrlk2mqdh"


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

    print("[1] 停止云采集…")
    try:
        r = client.stop_extraction(UK_TASK_ID)
        print("    ->", json.dumps(r, ensure_ascii=False) if r else "(已请求停止)")
    except BazhuayuError as e:
        print(f"    BZY-ERR code={e.code} msg={e.message}")
    except Exception as e:
        print("    ERR:", repr(e))

    print("[2] 清空循环网址列表（写空数组）…")
    try:
        r = client.update_loop_items(
            task_id=UK_TASK_ID, action_id=LOOP_ACTION_ID,
            loop_type="UrlList", loop_items=[], is_append=False,
        )
        print("    ->", json.dumps(r, ensure_ascii=False))
    except BazhuayuError as e:
        print(f"    BZY-ERR code={e.code} msg={e.message}")
    except Exception as e:
        print("    ERR:", repr(e))

    print("[3] 回读确认…")
    r = client.get_task_actions([UK_TASK_ID], action_types=["LoopAction"])
    acts = r[0].get("actions", []) if isinstance(r, list) and r else []
    for a in acts:
        print(f"    actionId={a.get('actionId')} 现有 {len(a.get('loopItems', []))} 条")
    st = client.get_task_statuses_v2([UK_TASK_ID])
    node = st[0] if isinstance(st, list) and st else {}
    print("    任务状态:", node.get("status"))


if __name__ == "__main__":
    main()
