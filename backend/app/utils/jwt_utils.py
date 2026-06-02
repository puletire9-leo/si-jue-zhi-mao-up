"""
JWT工具函数（简化版）

Gateway 负责 JWT 验证和签发。
Python 后端仅保留 decode_token 用于解析 token（不验证签名）。
"""

import jwt
import os
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

JWT_SECRET_KEY = os.getenv('JWT_SECRET') or os.getenv('SECRET_KEY') or os.getenv('JWT_SECRET_KEY') or 'sjzm-default-secret-key-must-change-in-production-2024'
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    解码token（不验证签名，仅用于解析）
    用于 auth.py 的 /me 和 /logout 端点
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM], options={"verify_signature": False, "verify_exp": False})
        return payload
    except Exception as e:
        logger.error(f"Token decoding error: {e}")
        return None
