"""
JWT 工具函数。

Gateway 负责主要认证；Python 后端也会验证 Bearer JWT，防止绕过
Gateway 直连 Python 服务时使用伪造令牌。
"""

import jwt
import os
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

JWT_SECRET_KEY = os.getenv('JWT_SECRET') or os.getenv('SECRET_KEY') or os.getenv('JWT_SECRET_KEY') or 'sjzm-default-secret-key-must-change-in-production-2024'
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """验证并解析 Java 后端签发的 access token。"""
    try:
        payload = jwt.decode(
            token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
            options={"require": ["exp", "sub"]},
        )
        if payload.get("type") != "access":
            logger.warning("JWT 类型不是 access token")
            return None
        return payload
    except jwt.ExpiredSignatureError:
        logger.info("JWT 已过期")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning("JWT 验证失败: %s", e)
        return None
