# -*- coding: utf-8 -*-
"""领星 API 链路验证：换 token → 调一个真实业务接口。

用法（凭证走环境变量，不硬编码）：
    set LINGXING_APP_ID=ak_xxxx
    set LINGXING_APP_SECRET=xxxx
    python verify_token.py

成功标准：
    [1] get_access_token 返回 code=200/0 且 data.access_token 非空
    [2] 任一业务接口返回非鉴权错误（能通到业务层即算链路通）
"""
import json
import os
import sys

from lingxing_api import LingxingAPI


def main():
    app_id = os.environ.get("LINGXING_APP_ID")
    app_secret = os.environ.get("LINGXING_APP_SECRET")
    if not app_id or not app_secret:
        print("缺少凭证：请先设置环境变量 LINGXING_APP_ID / LINGXING_APP_SECRET")
        sys.exit(1)

    api = LingxingAPI(app_id=app_id, app_secret=app_secret)

    print("[1] 获取 access_token …")
    try:
        r = api.get_access_token()
        print("    ->", json.dumps(r, ensure_ascii=False)[:600])
    except Exception as e:
        print("    换 token 失败:", repr(e))
        print("    若为 400/404『服务不存在』→ token 接口路径要按真实接口文档修正")
        sys.exit(2)

    if not api.access_token:
        print("    未拿到 access_token，停止。")
        sys.exit(3)
    print("    access_token OK:", api.access_token[:12], "…")

    print("\n[2] 调一个业务接口（关键词列表，最轻量）…")
    try:
        r = api.get_keyword_list(offset=0, length=1)
        print("    ->", json.dumps(r, ensure_ascii=False)[:600])
    except Exception as e:
        print("    业务接口异常:", repr(e))
        sys.exit(4)

    print("\n链路验证完成。")


if __name__ == "__main__":
    main()
