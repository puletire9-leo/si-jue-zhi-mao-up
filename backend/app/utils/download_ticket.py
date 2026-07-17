"""Short-lived signed tickets for browser-native file downloads."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import time
from typing import Any, Dict, Optional


DOWNLOAD_TICKET_COOKIE = "sjzm_download_ticket"
DOWNLOAD_TICKET_TTL_SECONDS = 120


class DownloadTicketError(ValueError):
    """Raised when a download ticket is invalid or expired."""


def _encode_base64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _decode_base64(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def create_download_ticket(
    task_id: str,
    user_id: Any,
    secret: str,
    *,
    ttl_seconds: int = DOWNLOAD_TICKET_TTL_SECONDS,
    now: Optional[int] = None,
) -> str:
    """Create a signed, task-bound download ticket."""
    if not secret:
        raise DownloadTicketError("download ticket secret is not configured")
    if ttl_seconds <= 0:
        raise DownloadTicketError("download ticket ttl must be positive")

    issued_at = int(time.time() if now is None else now)
    payload = {
        "task_id": str(task_id),
        "user_id": str(user_id or ""),
        "issued_at": issued_at,
        "expires_at": issued_at + ttl_seconds,
        "nonce": secrets.token_urlsafe(12),
    }
    encoded_payload = _encode_base64(
        json.dumps(payload, ensure_ascii=True, separators=(",", ":"), sort_keys=True).encode("utf-8")
    )
    signature = hmac.new(secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded_payload}.{_encode_base64(signature)}"


def verify_download_ticket(
    ticket: str,
    task_id: str,
    secret: str,
    *,
    now: Optional[int] = None,
) -> Dict[str, Any]:
    """Validate a signed ticket and return its payload."""
    if not ticket or not secret:
        raise DownloadTicketError("download ticket is missing")

    try:
        encoded_payload, encoded_signature = ticket.split(".", 1)
        supplied_signature = _decode_base64(encoded_signature)
        expected_signature = hmac.new(
            secret.encode("utf-8"), encoded_payload.encode("ascii"), hashlib.sha256
        ).digest()
        if not hmac.compare_digest(supplied_signature, expected_signature):
            raise DownloadTicketError("download ticket signature is invalid")

        payload = json.loads(_decode_base64(encoded_payload).decode("utf-8"))
    except DownloadTicketError:
        raise
    except (ValueError, TypeError, json.JSONDecodeError) as exc:
        raise DownloadTicketError("download ticket is malformed") from exc

    current_time = int(time.time() if now is None else now)
    if str(payload.get("task_id", "")) != str(task_id):
        raise DownloadTicketError("download ticket does not match this task")
    if int(payload.get("expires_at", 0)) < current_time:
        raise DownloadTicketError("download ticket has expired")

    return payload
