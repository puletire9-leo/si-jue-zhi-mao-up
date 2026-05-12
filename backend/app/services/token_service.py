"""
token管理服务

提供token的黑名单管理、验证和操作功能
"""

import os
import redis
import logging
from typing import Optional, Set
from datetime import datetime, timedelta

from ..utils.jwt_utils import verify_token, get_token_expiry

logger = logging.getLogger(__name__)


class TokenService:
    """token管理服务类"""
    
    def __init__(self):
        """
        初始化token服务
        
        尝试连接Redis，失败则使用内存存储作为后备
        """
        self.use_redis = False
        self.redis_client = None
        self.token_blacklist: Set[str] = set()
        
        # 尝试连接Redis
        try:
            redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            # 测试连接
            self.redis_client.ping()
            self.use_redis = True
            logger.info('Connected to Redis for token management')
        except Exception as e:
            logger.warning(f'Failed to connect to Redis: {e}. Using in-memory storage for token blacklist.')
            self.use_redis = False
    
    def add_to_blacklist(self, token: str) -> bool:
        """
        将token添加到黑名单
        
        Args:
            token: 要添加到黑名单的token
        
        Returns:
            bool: 添加成功返回True，失败返回False
        """
        try:
            logger.info(f'Attempting to add token to blacklist: {token[:20]}...')
            
            # 跳过token验证，直接添加到黑名单
            # 验证可能会因为token格式问题失败，但我们仍然需要阻止它被使用
            
            # 直接添加到黑名单
            if self.use_redis:
                # 使用Redis存储，设置一个较长的过期时间（例如24小时）
                ttl = 24 * 60 * 60  # 24小时
                self.redis_client.setex(
                    f'token:blacklist:{token}',
                    ttl,
                    '1'
                )
                logger.info(f'Token added to Redis blacklist, will expire in {ttl} seconds')
            else:
                # 使用内存存储
                self.token_blacklist.add(token)
                logger.info(f'Token added to in-memory blacklist')
            
            # 验证添加是否成功
            if self.is_blacklisted(token):
                logger.info(f'Token successfully added to blacklist: {token[:20]}...')
                return True
            else:
                logger.error(f'Failed to verify token in blacklist: {token[:20]}...')
                return False
        except Exception as e:
            logger.error(f'Error adding token to blacklist: {e}')
            return False
    
    def is_blacklisted(self, token: str) -> bool:
        """
        检查token是否在黑名单中
        
        Args:
            token: 要检查的token
        
        Returns:
            bool: 在黑名单中返回True，不在返回False
        """
        try:
            if self.use_redis:
                # 使用Redis检查
                exists = self.redis_client.exists(f'token:blacklist:{token}')
                return exists > 0
            else:
                # 使用内存存储检查
                return token in self.token_blacklist
        except Exception as e:
            logger.error(f'Error checking token blacklist: {e}')
            # 出错时默认返回False，避免误判
            return False
    
    def remove_from_blacklist(self, token: str) -> bool:
        """
        从黑名单中移除token
        
        Args:
            token: 要移除的token
        
        Returns:
            bool: 移除成功返回True，失败返回False
        """
        try:
            if self.use_redis:
                # 使用Redis移除
                deleted = self.redis_client.delete(f'token:blacklist:{token}')
                return deleted > 0
            else:
                # 使用内存存储移除
                if token in self.token_blacklist:
                    self.token_blacklist.remove(token)
                    return True
                return False
        except Exception as e:
            logger.error(f'Error removing token from blacklist: {e}')
            return False
    
    def clear_expired_tokens(self) -> int:
        """
        清理过期的token（仅用于内存存储）
        
        Returns:
            int: 清理的token数量
        """
        if not self.use_redis:
            expired_count = 0
            tokens_to_remove = []
            
            for token in self.token_blacklist:
                payload = verify_token(token)
                if not payload:
                    tokens_to_remove.append(token)
                    expired_count += 1
            
            for token in tokens_to_remove:
                self.token_blacklist.remove(token)
            
            if expired_count > 0:
                logger.info(f'Cleared {expired_count} expired tokens from blacklist')
            
            return expired_count
        return 0
    
    def get_blacklist_size(self) -> int:
        """
        获取黑名单大小
        
        Returns:
            int: 黑名单中的token数量
        """
        try:
            if self.use_redis:
                # 使用Redis的SCAN命令获取匹配的键数量
                count = 0
                cursor = 0
                while True:
                    cursor, keys = self.redis_client.scan(cursor, match='token:blacklist:*', count=100)
                    count += len(keys)
                    if cursor == 0:
                        break
                return count
            else:
                return len(self.token_blacklist)
        except Exception as e:
            logger.error(f'Error getting blacklist size: {e}')
            return 0


# 创建全局token服务实例
token_service = TokenService()
