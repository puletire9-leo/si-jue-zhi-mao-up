# -*- coding: utf-8 -*-
from __future__ import annotations

import sys
from pathlib import Path

SRC = Path(__file__).resolve().parents[1] / "产品数据" / "产品表" / "理实产品开发表" / "利润助手"
sys.path.insert(0, str(SRC))

from freight import calc_air_profit, calc_headhaul, match_fba, min_price_for_margin  # noqa: E402


def main() -> int:
    got = min_price_for_margin("英国", 20, 16, 1, 0.05, 3.42, target=0.20, snap=True)
    print("snap", got)
    assert got.get("price") == 4.99, got
    fb = match_fba("英国", got["price"], 20, 16, 1, 0.05)
    hd = calc_headhaul("英国", 20, 16, 1, 0.05)
    pr = calc_air_profit("英国", got["price"], 3.42, hd.get("air_usd"), fb.get("fee"))
    print("margin", pr.get("margin"), "profit", pr.get("profit"), "fba", fb.get("fee"))
    assert pr.get("margin") >= 0.20

    raw = min_price_for_margin("英国", 20, 16, 1, 0.05, 3.42, target=0.20, snap=False)
    print("nosnap", raw)
    assert raw.get("price") not in ("", None)
    assert raw["price"] <= 4.99
    from freight import snap_listing_price
    assert snap_listing_price(5.12) == 5.99
    assert snap_listing_price(6.00) == 6.99
    assert snap_listing_price(7.99) == 7.99
    html = (SRC / "index.html").read_text(encoding="utf-8")
    for s in ("按目标倒推售价", "suggestPrice", "priceAll"):
        if s not in html:
            print("missing", s)
            return 1
    print("price verify ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
