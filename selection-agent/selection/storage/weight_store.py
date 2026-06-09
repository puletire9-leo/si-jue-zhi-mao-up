"""校准权重 SQLite 存储 — 审批工作流 + 动态加载。

存储内容：
  - 每次校准产出的 CalibrationResult
  - 审批状态（pending/approved/rejected）
  - 已审批的权重供 l2_scorer 动态读取

架构：单例 SQLite，与 decision_store 共用锁模式。
"""

import json
import logging
import os
import sqlite3
import threading
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

_DEFAULT_DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data", "calibrations.db",
)

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS calibrated_weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    archetype TEXT NOT NULL,
    weights_json TEXT NOT NULL,
    original_weights_json TEXT NOT NULL,
    dimension_correlations_json TEXT DEFAULT '{}',
    accuracy_before REAL DEFAULT 0,
    accuracy_after REAL DEFAULT 0,
    sample_size INTEGER DEFAULT 0,
    adjustment_reason TEXT DEFAULT '',
    is_approved INTEGER DEFAULT 0,
    approved_by TEXT,
    approved_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cw_archetype ON calibrated_weights(archetype);
CREATE INDEX IF NOT EXISTS idx_cw_approved ON calibrated_weights(is_approved);
"""


class WeightStore:
    """校准权重存储（线程安全单例）。"""

    def __init__(self, db_path: str = _DEFAULT_DB_PATH):
        self._db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _init_db(self):
        os.makedirs(os.path.dirname(self._db_path), exist_ok=True)
        with self._get_conn() as conn:
            conn.executescript(SCHEMA_SQL)
            conn.commit()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    # ── 写入 ─────────────────────────────────────────────

    def insert(self, result: Any) -> int:
        """插入校准结果（is_approved=0 待审批）。

        Args:
            result: CalibrationResult 实例或兼容 dict

        Returns:
            新记录 id
        """
        r = result if isinstance(result, dict) else result.to_dict()
        with self._lock, self._get_conn() as conn:
            cursor = conn.execute("""
                INSERT INTO calibrated_weights (
                    archetype, weights_json, original_weights_json,
                    dimension_correlations_json,
                    accuracy_before, accuracy_after, sample_size, adjustment_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                r["archetype"],
                json.dumps(r["calibrated_weights"], ensure_ascii=False),
                json.dumps(r["original_weights"], ensure_ascii=False),
                json.dumps(r.get("dimension_correlations", {}), ensure_ascii=False),
                r.get("accuracy_before", 0),
                r.get("accuracy_after", 0),
                r.get("sample_size", 0),
                r.get("adjustment_reason", ""),
            ))
            conn.commit()
            rid = cursor.lastrowid or 0
        logger.info(f"[weight_store] 插入校准: archetype={r['archetype']}, id={rid}")
        return rid

    def approve(self, calibration_id: int, approved_by: str = "admin") -> bool:
        """审批通过校准结果。

        同一原型下其他已审批记录自动标记为废弃(is_approved=2)。

        Args:
            calibration_id: 校准记录 id
            approved_by:    审批人

        Returns:
            True=成功
        """
        with self._lock, self._get_conn() as conn:
            row = conn.execute(
                "SELECT archetype FROM calibrated_weights WHERE id=?", (calibration_id,)
            ).fetchone()
            if not row:
                return False

            archetype = row["archetype"]

            # 废弃同原型的旧审批记录
            conn.execute(
                "UPDATE calibrated_weights SET is_approved=2 WHERE archetype=? AND is_approved=1",
                (archetype,),
            )

            # 审批当前记录
            conn.execute(
                "UPDATE calibrated_weights SET is_approved=1, approved_by=?, approved_at=datetime('now') WHERE id=?",
                (approved_by, calibration_id),
            )
            conn.commit()

        logger.info(f"[weight_store] 审批通过: archetype={archetype}, id={calibration_id}")
        return True

    # ── 查询 ─────────────────────────────────────────────

    def get_approved_weights(self, archetype: str) -> Optional[Dict[str, int]]:
        """获取已审批的最新权重。

        Args:
            archetype: 品类原型 DA/FH/FP/...

        Returns:
            权重 dict {"size": 10, ...} 或 None
        """
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT weights_json FROM calibrated_weights "
                "WHERE archetype=? AND is_approved=1 ORDER BY id DESC LIMIT 1",
                (archetype,),
            ).fetchone()

            if row:
                return json.loads(row["weights_json"])
            return None

    def get_all(self) -> List[Dict[str, Any]]:
        """获取全部校准历史。"""
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM calibrated_weights ORDER BY id DESC"
            ).fetchall()
            return [dict(r) for r in rows]

    def get_pending(self) -> List[Dict[str, Any]]:
        """获取待审批的校准记录。"""
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM calibrated_weights WHERE is_approved=0 ORDER BY id DESC"
            ).fetchall()
            return [dict(r) for r in rows]


# ── 单例管理 ──────────────────────────────────────────────

_weight_store: Optional[WeightStore] = None
_weight_lock = threading.Lock()


def get_weight_store(db_path: str = _DEFAULT_DB_PATH) -> WeightStore:
    """获取全局 WeightStore 单例。"""
    global _weight_store
    if _weight_store is None:
        with _weight_lock:
            if _weight_store is None:
                _weight_store = WeightStore(db_path)
    return _weight_store
