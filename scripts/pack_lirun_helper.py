# -*- coding: utf-8 -*-
"""Pack 利润助手 into a one-file exe. Run from repo root: python scripts/pack_lirun_helper.py"""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "产品数据" / "产品表" / "理实产品开发表" / "利润助手"
FILES = ("app.py", "freight.py", "lookups.py", "paths.py", "index.html")


def main() -> int:
    if not (SRC / "app.py").is_file():
        print("missing", SRC)
        return 1
    work = Path(tempfile.mkdtemp(prefix="lirun_pack_"))
    print("work", work)
    try:
        for name in FILES:
            shutil.copy2(SRC / name, work / name)
        weihu = work / "weihu"
        if weihu.exists():
            shutil.rmtree(weihu)
        shutil.copytree(SRC / "维护表", weihu)
        sep = os.pathsep
        cmd = [
            sys.executable,
            "-m",
            "PyInstaller",
            "--noconfirm",
            "--clean",
            "--onefile",
            "--console",
            "--name",
            "LirunHelper",
            "--add-data",
            f"index.html{sep}.",
            "--add-data",
            f"weihu{sep}维护表",
            "--distpath",
            str(work / "dist"),
            "--workpath",
            str(work / "build"),
            "--specpath",
            str(work),
            str(work / "app.py"),
        ]
        print("run", cmd)
        subprocess.check_call(cmd, cwd=str(work))
        exe = work / "dist" / "LirunHelper.exe"
        if not exe.is_file():
            print("build failed, no exe")
            return 1
        for name in ("LirunHelper.exe", "利润助手.exe"):
            subprocess.run(
                ["taskkill", "/F", "/IM", name],
                capture_output=True,
            )
        time.sleep(0.8)
        shutil.copy2(exe, SRC / "LirunHelper.exe")
        dest = SRC / "利润助手.exe"
        last = None
        for _ in range(8):
            try:
                shutil.copy2(exe, dest)
                last = None
                break
            except PermissionError as e:
                last = e
                time.sleep(0.6)
        if last:
            print("locked", dest, "use LirunHelper.exe")
            print(last)
            return 1
        print("size", exe.stat().st_size)
        print("copied", dest)
        return 0
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
