#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""领星模型共享的只读基础事实访问。

模型只能通过本模块读取统一 ASIN 基准、数据库连接配置和采购计划事实；
本模块不生成任何模型文件，也不修改公共基础表。
"""

from __future__ import annotations

import csv
import os
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import pymysql

from lingxing_model_paths import ASIN_START_BASELINE, ROOT


TEAM_DEVELOPERS = frozenset(
    {"蒋舒", "陈杨", "宋凤莉", "刘淼", "龙梦临", "周沁仪", "张子轩", "黄雨珊"}
)


def dec(value: Any) -> Decimal:
    try:
        return Decimal(str(value or "").strip() or "0")
    except InvalidOperation:
        return Decimal(0)


def mysql_env() -> dict[str, Any]:
    values: dict[str, str] = {}
    for path in (ROOT / ".env", ROOT / "config/public/dev.env", ROOT / "config/secrets/dev.env"):
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            text = line.strip()
            if text and not text.startswith("#") and "=" in text:
                key, value = text.split("=", 1)
                values[key.strip()] = value.strip().strip('"').strip("'")
    values.update({key: value for key, value in os.environ.items() if value})
    host = values.get("MYSQL_HOST", "127.0.0.1")
    if host == "mysql":
        host = values.get("MYSQL_HOST_EXTERNAL", "127.0.0.1")
    return {
        "host": host,
        "port": int(values.get("MYSQL_PORT_EXTERNAL", values.get("MYSQL_PORT", "13338"))),
        "user": values.get("MYSQL_USERNAME", values.get("MYSQL_USER", "sijue")),
        "password": values["MYSQL_PASSWORD"],
        "database": values.get("MYSQL_DATABASE", "sijuelishi_dev"),
        "charset": "utf8mb4",
    }


def split_values(value: str) -> set[str]:
    return {item.strip() for item in str(value or "").split(" | ") if item.strip()}


def team_developer(value: str) -> str | None:
    names = {part.strip() for part in str(value or "").replace("，", ",").split(",") if part.strip()}
    found = names & TEAM_DEVELOPERS
    if len(found) == 1:
        return next(iter(found))
    return "多人归属待确认" if len(found) > 1 else None


def load_asin_baseline() -> tuple[dict[str, dict[str, Any]], dict[str, set[str]], dict[str, set[str]]]:
    """从数据库 lingxing_asin_baseline 表读取 ASIN 基准，并构建 SKU 映射索引。"""
    sql = """
        SELECT asin, developer, base_sku,
               fba_available_first_month, model_start_month,
               model_start_basis, listing_tags
        FROM lingxing_asin_baseline
    """
    asins: dict[str, dict[str, Any]] = {}
    sku_to_asins: dict[str, set[str]] = defaultdict(set)
    sku_to_developers: dict[str, set[str]] = defaultdict(set)
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            for asin, developer_raw, base_sku, first_fba, start_month, basis, label in cursor.fetchall():
                asin = str(asin or "").strip()
                developer = team_developer(str(developer_raw or ""))
                if not asin or developer is None:
                    continue
                skus = split_values(str(base_sku or ""))
                asins[asin] = {
                    "asin": asin,
                    "developer": developer,
                    "skus": skus,
                    "first_fba_month": str(first_fba or "").strip(),
                    "model_start_month": str(start_month or "").strip(),
                    "start_basis": str(basis or "").strip(),
                    "label": str(label or "").strip(),
                    "monthly_sales": defaultdict(Decimal),
                    "markets": set(),
                }
                for sku in skus:
                    sku_to_asins[sku].add(asin)
                    sku_to_developers[sku].add(developer)
    return asins, sku_to_asins, sku_to_developers


def load_completed_plans() -> dict[str, list[dict[str, Any]]]:
    """读取已完成采购计划；只提供采购量事实，不决定 ASIN 上架批次。"""
    sql = """
        SELECT sku, plan_sn, create_time, quantity_plan, status, status_text
        FROM lingxing_purchase_plan
        WHERE sku IS NOT NULL AND sku <> ''
          AND COALESCE(quantity_plan, 0) > 0
          AND (status = -2 OR status_text = '已完成')
        ORDER BY create_time, plan_sn
    """
    result: dict[str, list[dict[str, Any]]] = defaultdict(list)
    with pymysql.connect(**mysql_env()) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql)
            for sku, plan_sn, create_time, quantity, status, status_text in cursor.fetchall():
                result[str(sku).strip()].append(
                    {
                        "plan_sn": str(plan_sn or ""),
                        "create_time": create_time,
                        "quantity": dec(quantity),
                        "status": status,
                        "status_text": str(status_text or ""),
                    }
                )
    return result
