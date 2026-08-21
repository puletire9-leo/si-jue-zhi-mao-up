# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "产品数据" / "产品表" / "理实产品开发表" / "利润助手"
sys.path.insert(0, str(SRC))

from freight import calc_air_profit, calc_headhaul, match_fba  # noqa: E402


def check_sample() -> None:
    fb = match_fba("英国", 5.99, 20, 16, 1, 0.05)
    hd = calc_headhaul("英国", 20, 16, 1, 0.05)
    pr = calc_air_profit("英国", 5.99, 3.42, hd.get("air_usd"), fb.get("fee"))
    print("sample FBA", fb.get("fee"), fb.get("note"))
    print("sample air", hd.get("air_usd"))
    print("sample profit", pr.get("profit"), pr.get("margin"))
    assert fb.get("fee") not in ("", None)
    assert pr.get("profit") not in ("", None)


def wait_ping(timeout=12):
    t0 = time.time()
    last = None
    while time.time() - t0 < timeout:
        for port in range(8765, 8773):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/ping", timeout=1) as r:
                    return port, json.loads(r.read().decode("utf-8"))
            except Exception as e:
                last = e
        time.sleep(0.3)
    raise RuntimeError(f"no ping: {last}")


def main() -> int:
    check_sample()
    html = (SRC / "index.html").read_text(encoding="utf-8")
    for s in ("字段匹配", "算利润必填", "copyRow", "确认调用 AI", "从剪贴板匹配导入"):
        if s not in html:
            print("missing in html:", s)
            return 1
    if "pasteBox" in html:
        print("paste box still present")
        return 1
    proc = subprocess.Popen(
        [sys.executable, str(SRC / "app.py")],
        cwd=str(SRC),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    try:
        port, ping = wait_ping()
        print("ping", port, ping.get("model"), ping.get("has_key"))
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=3) as r:
            page = r.read().decode("utf-8")
        assert "字段匹配" in page
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/tables", timeout=3) as r:
            tables = json.loads(r.read().decode("utf-8"))
        print("fba rows", len(tables.get("fba") or []), "head", list((tables.get("head") or {}).keys()))
        assert tables.get("fba") and tables.get("head")
        body = json.dumps({
            "rows": [{"国家": "英国", "SKU": "2631281", "产品名称": "【带底座】蛋杯", "中文材质": "不锈钢", "中文报关名": "蛋杯"}]
        }, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{port}/api/enrich",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            en = json.loads(r.read().decode("utf-8"))
        print("enrich", en["rows"][0].get("英文材质"), en["rows"][0].get("海关编码"), en["rows"][0].get("产品属性"))
        assert en.get("ok")
        print("UI verify ok")
        return 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
