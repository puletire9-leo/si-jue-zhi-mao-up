#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Load public + secrets env files. Process environment wins.

Scripts must not hardcode passwords or API keys. Read them here.
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text or text.startswith("#") or "=" not in text:
            continue
        key, value = text.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def load_project_env(profile: str | None = None) -> dict[str, str]:
    """Merge config/public + config/secrets, then os.environ.

    Default profile is prod (host ops scripts talk to RDS / 领星).
    Set SJZM_ENV=dev to load the development pair first.
    """
    name = (profile or os.getenv("SJZM_ENV") or "prod").strip().lower()
    if name not in {"dev", "prod"}:
        name = "prod"
    values: dict[str, str] = {}
    values.update(read_env_file(ROOT / "config/secrets/finance_rds.env"))
    for rel in (
        f"config/public/{name}.env",
        f"config/secrets/{name}.env",
        "config/public/prod.env",
        "config/secrets/prod.env",
    ):
        values.update(read_env_file(ROOT / rel))
    values.update({key: value for key, value in os.environ.items() if value})
    return values


def require(values: dict[str, str], key: str) -> str:
    value = (values.get(key) or "").strip()
    if not value:
        raise RuntimeError(f"缺少配置 {key}，请写入 config/secrets 对应 env 文件，不要写在脚本或文档里")
    return value


def local_mysql_config() -> dict:
    """Host-side connection to Docker MySQL. Password comes from secrets."""
    values = load_project_env()
    host = values.get("MYSQL_HOST_EXTERNAL") or "127.0.0.1"
    if host in {"mysql", "prod-mysql"}:
        host = "127.0.0.1"
    database = values.get("MYSQL_DATABASE") or "sijuelishi"
    default_port = "13338" if database.endswith("_dev") else "3310"
    return {
        "host": host,
        "port": int(values.get("MYSQL_PORT_EXTERNAL") or default_port),
        "user": values.get("MYSQL_USER") or values.get("MYSQL_USERNAME") or "sijue",
        "password": require(values, "MYSQL_PASSWORD"),
        "database": database,
        "charset": "utf8mb4",
    }
