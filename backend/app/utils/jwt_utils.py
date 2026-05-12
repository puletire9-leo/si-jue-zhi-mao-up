"""
JWT工具函数

提供JWT token的生成、验证和解析功能
"""

import jwt
import os
from datetime import datetime, UTC
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)

# JWT密钥，生产环境应从环境变量获取
JWT_SECRET_KEY = os.getenv('SECRET_KEY')
if not JWT_SECRET_KEY:
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
    if not JWT_SECRET_KEY:
        logger.warning('JWT_SECRET_KEY not set in environment variables, using default value. This is insecure for production.')

JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')

def create_access_token(data: Dict[str, Any]) -> str:
    """
    创建访问令牌
    
    Args:
        data: 要编码到token中的数据
    
    Returns:
        生成的JWT token字符串
    """
    to_encode = data.copy()
    # 不设置过期时间，token无期限有效
    to_encode.update({"iat": datetime.now(UTC)})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    logger.info(f"Access token created for user: {data.get('sub')}")
    return encoded_jwt

def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    创建刷新令牌
    
    Args:
        data: 要编码到token中的数据
    
    Returns:
        生成的JWT refresh token字符串
    """
    to_encode = data.copy()
    # 不设置过期时间，token无期限有效
    to_encode.update({"iat": datetime.now(UTC), "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    logger.info(f"Refresh token created for user: {data.get('sub')}")
    return encoded_jwt

def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """
    验证token
    
    Args:
        token: 要验证的JWT token
    
    Returns:
        验证成功返回解码后的数据，失败返回None
    """
    try:
        # 不检查过期时间，token无期限有效
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM], options={"verify_exp": False})
        logger.info(f"Token verified for user: {payload.get('sub')}")
        return payload
    except jwt.InvalidTokenError:
        logger.warning("Invalid token")
        return None
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return None

def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    解码token（不验证签名，仅用于解析）
    
    Args:
        token: 要解码的JWT token
    
    Returns:
        解码后的数据，失败返回None
    """
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM], options={"verify_signature": False, "verify_exp": False})
        return payload
    except Exception as e:
        logger.error(f"Token decoding error: {e}")
        return None
