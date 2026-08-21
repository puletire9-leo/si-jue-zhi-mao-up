# -*- coding: utf-8 -*-
from __future__ import annotations

import subprocess
import time
import urllib.request
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "产品数据" / "产品表" / "理实产品开发表" / "利润助手"
EXE = SRC / "利润助手.exe"


def main() -> int:
    if not EXE.is_file():
        print("missing exe", EXE)
        return 1
    print("exe", EXE, EXE.stat().st_size)
    proc = subprocess.Popen(
        [str(EXE)],
        cwd=str(SRC),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    ping = None
    try:
        for _ in range(50):
            if proc.poll() is not None:
                out, _ = proc.communicate(timeout=2)
                print("exited", proc.returncode)
                print(out)
                return 1
            for port in range(8765, 8773):
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/ping", timeout=1) as r:
                        ping = r.read().decode("utf-8", "replace")
                        print("ping", port, ping)
                        return 0
                except Exception:
                    pass
            time.sleep(0.4)
        print("timeout waiting for ping")
        return 1
    finally:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
