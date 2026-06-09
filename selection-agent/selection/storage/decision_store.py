"""决策记录 SQLite 存储 — 记录→验证→校准全链路的数据层。

存储内容：
  - 决策快照（每次 S1/S2 级分析写入）
  - 验证结果（下月数据导入后填充）
  - 按原型/状态查询（供定时任务和 API 使用）

架构：单例 SQLite，WAL 模式并发写安全。
"""

import json
import logging
import os
import sqlite3
import threading
from typing import Any, Dict, List, Optional

from selection.algorithms.feedback_service import DecisionSnapshot, AccuracyStats
from selection.algorithms.decision_verifier import VerificationResult

logger = logging.getLogger(__name__)

# 默认存储路径
_DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data", "decisions.db",
)

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS decision_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identifier TEXT NOT NULL,
    marketplace TEXT NOT NULL DEFAULT 'UK',
    decision_month TEXT NOT NULL,
    category_label TEXT,
    category_prototype TEXT,
    -- 8维评分快照
    sel_size_score INTEGER DEFAULT 50,
    sel_volume_score INTEGER DEFAULT 50,
    sel_profit_score INTEGER DEFAULT 50,
    sel_emotion_score INTEGER DEFAULT 50,
    sel_decor_score INTEGER DEFAULT 50,
    sel_fission_score INTEGER DEFAULT 50,
    sel_culture_score INTEGER DEFAULT 50,
    sel_market_score INTEGER DEFAULT 50,
    selection_score INTEGER DEFAULT 0,
    selection_grade TEXT,
    -- 决策信息
    decision_score REAL DEFAULT 0,
    decision_status TEXT DEFAULT 'WATCH',
    signal_boosts TEXT DEFAULT '{}',
    -- 基线数据
    baseline_bsr INTEGER,
    baseline_units INTEGER,
    baseline_price REAL,
    baseline_ratings INTEGER,
    -- 验证结果
    verify_month TEXT,
    verify_bsr INTEGER,
    verify_units INTEGER,
    verify_price REAL,
    verify_ratings INTEGER,
    outcome TEXT,
    outcome_detail TEXT,
    confidence REAL,
    -- 元数据
    created_at TEXT DEFAULT (datetime('now')),
    verified_at TEXT,
    UNIQUE(identifier, decision_month)
);

CREATE INDEX IF NOT EXISTS idx_ds_outcome ON decision_snapshots(outcome);
CREATE INDEX IF NOT EXISTS idx_ds_archetype ON decision_snapshots(category_prototype);
CREATE INDEX IF NOT EXISTS idx_ds_decision_month ON decision_snapshots(decision_month);
CREATE INDEX IF NOT EXISTS idx_ds_verify_month ON decision_snapshots(verify_month);
"""


class DecisionStore:
    """决策记录 SQLite 存储（线程安全单例）。"""

    def __init__(self, db_path: str = _DEFAULT_DB_PATH):
        self._db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _init_db(self):
        """初始化数据库和表结构。"""
        os.makedirs(os.path.dirname(self._db_path), exist_ok=True)
        with self._get_conn() as conn:
            conn.executescript(SCHEMA_SQL)
            conn.commit()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    # ── 写入 ─────────────────────────────────────────────

    def insert_snapshot(self, snapshot: DecisionSnapshot) -> bool:
        """插入决策快照。重复的 (identifier, decision_month) 跳过。

        Args:
            snapshot: DecisionSnapshot 实例

        Returns:
            True=新插入, False=已存在(跳过)
        """
        d = snapshot.to_dict()
        raw_signal = d.get("signal_boosts", {})
        signal_json = json.dumps(raw_signal, ensure_ascii=False) if raw_signal else "{}"

        with self._lock, self._get_conn() as conn:
            # 检查是否已存在
            existing = conn.execute(
                "SELECT id FROM decision_snapshots WHERE identifier=? AND decision_month=?",
                (d["asin"], d["decision_month"]),
            ).fetchone()
            if existing:
                logger.debug(f"[decision_store] 重复跳过: {d['asin']}/{d['decision_month']}")
                return False

            conn.execute("""
                INSERT INTO decision_snapshots (
                    identifier, marketplace, decision_month, category_label, category_prototype,
                    sel_size_score, sel_volume_score, sel_profit_score, sel_emotion_score,
                    sel_decor_score, sel_fission_score, sel_culture_score, sel_market_score,
                    selection_score, selection_grade,
                    decision_score, decision_status, signal_boosts,
                    baseline_bsr, baseline_units, baseline_price, baseline_ratings
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                d["asin"], d["marketplace"], d["decision_month"],
                d.get("category_label", ""), d.get("category_prototype", ""),
                d.get("sel_size_score", 50), d.get("sel_volume_score", 50),
                d.get("sel_profit_score", 50), d.get("sel_emotion_score", 50),
                d.get("sel_decor_score", 50), d.get("sel_fission_score", 50),
                d.get("sel_culture_score", 50), d.get("sel_market_score", 50),
                d.get("selection_score", 0), d.get("selection_grade", ""),
                d.get("decision_score", 0), d.get("decision_status", "WATCH"),
                signal_json,
                d.get("baseline_bsr"), d.get("baseline_units"),
                d.get("baseline_price"), d.get("baseline_ratings"),
            ))
            conn.commit()

        logger.info(f"[decision_store] 写入: {d['asin']}/{d['decision_month']} "
                     f"status={d.get('decision_status')}, score={d.get('selection_score')}")
        return True

    def update_verification(
        self, identifier: str, result: VerificationResult
    ) -> bool:
        """回写验证结果。

        Args:
            identifier: 决策标识（bsrId/nodeId）
            result:    VerificationResult 实例

        Returns:
            True=成功, False=未找到记录
        """
        with self._lock, self._get_conn() as conn:
            row = conn.execute(
                "SELECT id FROM decision_snapshots WHERE identifier=? AND outcome IS NULL ORDER BY id DESC LIMIT 1",
                (identifier,),
            ).fetchone()
            if not row:
                logger.warning(f"[decision_store] 未找到待验证记录: {identifier}")
                return False

            r = result.to_dict()
            conn.execute("""
                UPDATE decision_snapshots SET
                    verify_month=?, verify_bsr=?, verify_units=?, verify_price=?, verify_ratings=?,
                    outcome=?, outcome_detail=?, confidence=?, verified_at=datetime('now')
                WHERE id=?
            """, (
                r.get("verify_month", ""),
                r.get("bsr_change_pct"),  # store change%
                r.get("units_change_pct"),
                r.get("price_change_pct"),
                r.get("ratings_change"),
                r.get("outcome", "DATA_MISSING"),
                r.get("outcome_detail", ""),
                r.get("confidence", 0),
                row["id"],
            ))
            conn.commit()

        logger.info(f"[decision_store] 验证: {identifier} → {r.get('outcome')}")
        return True

    def update_verification_manual(
        self, identifier: str, marketplace: str, outcome: str, detail: str = ""
    ) -> bool:
        """手动回写验证结果（无需 VerificationResult 实例，端点直接调用）。

        Args:
            identifier:  决策标识
            marketplace: 站点
            outcome:     结果 CONFIRMED/EXCEEDED/STABLE/DISAPPOINTED/DATA_MISSING
            detail:      说明

        Returns:
            True=成功
        """
        with self._lock, self._get_conn() as conn:
            row = conn.execute(
                "SELECT id FROM decision_snapshots WHERE identifier=? AND marketplace=? AND outcome IS NULL ORDER BY id DESC LIMIT 1",
                (identifier, marketplace),
            ).fetchone()
            if not row:
                logger.warning(f"[decision_store] manual verify: 未找到: {identifier}")
                return False

            conn.execute("""
                UPDATE decision_snapshots SET
                    outcome=?, outcome_detail=?, verified_at=datetime('now')
                WHERE id=?
            """, (outcome, detail, row["id"]))
            conn.commit()
        return True

    # ── 查询 ─────────────────────────────────────────────

    def get_snapshot(
        self, identifier: str, marketplace: str
    ) -> Optional[Dict[str, Any]]:
        """获取最近的决策快照。"""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM decision_snapshots WHERE identifier=? AND marketplace=? ORDER BY id DESC LIMIT 1",
                (identifier, marketplace),
            ).fetchone()
            return dict(row) if row else None

    def get_pending_verifications(
        self, decision_month: str, marketplace: str = "UK"
    ) -> List[Dict[str, Any]]:
        """获取待验证的决策记录。

        Args:
            decision_month: 决策月份（如 "2026-05"）
            marketplace:    站点

        Returns:
            待验证记录列表（dict 格式）
        """
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM decision_snapshots "
                "WHERE decision_month=? AND marketplace=? AND outcome IS NULL",
                (decision_month, marketplace),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_all_verified(
        self, archetype: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """获取已验证的决策记录。

        Args:
            archetype: 品类原型过滤（可选）

        Returns:
            已验证记录列表
        """
        with self._get_conn() as conn:
            if archetype:
                rows = conn.execute(
                    "SELECT * FROM decision_snapshots "
                    "WHERE outcome IS NOT NULL AND category_prototype=?",
                    (archetype,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM decision_snapshots WHERE outcome IS NOT NULL"
                ).fetchall()
            return [dict(r) for r in rows]

    def get_verified_by_archetype(
        self, archetype: str, min_count: int = 30
    ) -> List[Dict[str, Any]]:
        """获取指定原型下已验证的记录（用于权重校准）。

        Args:
            archetype: 品类原型 DA/FH/FP/...
            min_count: 最小记录数（不足返回空）

        Returns:
            已验证记录列表（不足 min_count 返回空列表）
        """
        with self._get_conn() as conn:
            # 先检查数量
            count = conn.execute(
                "SELECT COUNT(*) as cnt FROM decision_snapshots "
                "WHERE category_prototype=? AND outcome IS NOT NULL AND outcome != 'DATA_MISSING'",
                (archetype,),
            ).fetchone()
            if count and count["cnt"] < min_count:
                logger.info(f"[decision_store] {archetype} 已验证{count['cnt']}条 < {min_count}，跳过")
                return []

            rows = conn.execute(
                "SELECT * FROM decision_snapshots "
                "WHERE category_prototype=? AND outcome IS NOT NULL AND outcome != 'DATA_MISSING'",
                (archetype,),
            ).fetchall()
            return [dict(r) for r in rows]

    def get_summary_stats(self) -> Dict[str, Any]:
        """获取汇总统计（用于 API 展示）。"""
        with self._get_conn() as conn:
            total = conn.execute("SELECT COUNT(*) as cnt FROM decision_snapshots").fetchone()["cnt"]
            verified = conn.execute(
                "SELECT COUNT(*) as cnt FROM decision_snapshots WHERE outcome IS NOT NULL"
            ).fetchone()["cnt"]
            outcomes = conn.execute(
                "SELECT outcome, COUNT(*) as cnt FROM decision_snapshots "
                "WHERE outcome IS NOT NULL GROUP BY outcome"
            ).fetchall()

        stats = {r["outcome"]: r["cnt"] for r in outcomes}
        stats["total"] = total
        stats["verified"] = verified
        stats["pending"] = total - verified
        return stats


# ── 单例管理 ──────────────────────────────────────────────

_decision_store: Optional[DecisionStore] = None
_store_lock = threading.Lock()


def get_decision_store(db_path: str = _DEFAULT_DB_PATH) -> DecisionStore:
    """获取全局 DecisionStore 单例。

    Args:
        db_path: SQLite 文件路径（默认 data/decisions.db）
    """
    global _decision_store
    if _decision_store is None:
        with _store_lock:
            if _decision_store is None:
                _decision_store = DecisionStore(db_path)
    return _decision_store
