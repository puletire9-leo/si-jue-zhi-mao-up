"""测试一次写 10 条 stylesnap URL：用 /task/urls:file 替换采集网址。"""
import os
import sys
from urllib.parse import quote

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "产品数据", "八爪鱼api"))
from bazhuayu_api import BazhuayuClient, BazhuayuError  # noqa: E402

UK_TASK_ID = "5c2ae37f-3128-4c82-84d6-70ad6d3d3655"
NAV_ACTION_ID = "s6tnzlut7sp"

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

    # 写 URL 文件（每行一个）
    url_file = os.path.join(os.path.dirname(__file__), "_exp_urls.txt")
    with open(url_file, "w", encoding="utf-8") as f:
        f.write("\n".join(URLS))
    print(f"URL 文件已写 {len(URLS)} 条 -> {url_file}")

    # 方案A：urls:file 替换采集网址
    print("\n[A] /task/urls:file …")
    try:
        r = client.update_task_urls(UK_TASK_ID, url_file)
        print("    OK ->", r)
    except BazhuayuError as e:
        print(f"    BZY-ERR code={e.code} msg={e.message}")
    except Exception as e:
        print("    ERROR:", repr(e))

    # 回读 NavigateAction，看 url 是否变化
    import json
    r = client.get_task_actions([UK_TASK_ID], action_types=["NavigateAction"])
    print("\n回读 NavigateAction ->", json.dumps(r, ensure_ascii=False)[:800])


if __name__ == "__main__":
    main()
