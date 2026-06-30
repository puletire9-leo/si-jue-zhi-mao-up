"""只拉刚才那批结果（不启动采集）。多种取数姿势都试，定位 0 行原因。"""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "产品数据", "八爪鱼api"))
from bazhuayu_api import BazhuayuClient  # noqa: E402

UK_TASK_ID = "5c2ae37f-3128-4c82-84d6-70ad6d3d3655"
LOT_NO = "639184129174666393"


def read_env(path, key):
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if line.startswith(key + "="):
            return line[len(key) + 1:]
    return None


def show(label, r):
    if isinstance(r, dict):
        data = r.get("data")
        n = len(data) if isinstance(data, list) else ("None" if data is None else "?")
        print(f"{label}: total={r.get('total')} restTotal={r.get('restTotal')} dataLen={n}")
        if isinstance(data, list) and data:
            print("  首行:", json.dumps(data[0], ensure_ascii=False)[:500])
    else:
        print(f"{label}: (非dict) {r!r}")


def main():
    base = os.path.join(os.path.dirname(__file__), "..")
    secrets = os.path.join(base, "config", "secrets", "prod.env")
    client = BazhuayuClient(
        username=read_env(secrets, "BAZHUAYU_USERNAME"),
        password=read_env(secrets, "BAZHUAYU_PASSWORD"),
    )
    client.get_access_token()
    print("token OK\n")

    try:
        show("offset", client.get_all_data_by_offset(UK_TASK_ID, offset=0, size=50))
    except Exception as e:
        print("offset ERR:", repr(e))

    try:
        show("by_lotno", client.get_all_data_by_lotno(UK_TASK_ID, LOT_NO, offset=0, size=50))
    except Exception as e:
        print("by_lotno ERR:", repr(e))

    try:
        show("notexported", client.get_not_exported_data(UK_TASK_ID, size=50))
    except Exception as e:
        print("notexported ERR:", repr(e))

    # 当前任务状态 + 采集网址回显
    try:
        st = client.get_task_statuses_v2([UK_TASK_ID])
        print("\nstatus v2:", json.dumps(st, ensure_ascii=False)[:400])
    except Exception as e:
        print("status ERR:", repr(e))


if __name__ == "__main__":
    main()
