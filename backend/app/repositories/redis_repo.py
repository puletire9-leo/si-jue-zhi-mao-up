from redis.asyncio import Redis as AsyncRedis
from typing import Optional, Any, List, Dict
from contextlib import asynccontextmanager
import json
import logging
from datetime import datetime, date

logger = logging.getLogger(__name__)


class DateTimeEncoder(json.JSONEncoder):
    """
    自定义JSON编码器，处理datetime和date对象
    """
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, date):
            return obj.isoformat()
        return super().default(obj)


class RedisRepository:
    """
    Redis数据访问层
    
    功能：
    - 管理Redis连接池
    - 提供异步缓存操作接口
    - 支持字符串、哈希、列表、集合、有序集合等数据结构
    - 自动序列化和反序列化JSON数据
    
    使用场景：
    - 图片元数据缓存
    - 搜索结果缓存
    - 会话管理
    - 限流和计数器
    """
    
    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        password: Optional[str] = None,
        pool_size: int = 10,
        encoding: str = "utf-8",
        decode_responses: bool = True
    ):
        """
        初始化Redis仓库
        
        Args:
            host: Redis服务器地址
            port: Redis服务器端口
            db: 数据库索引
            password: Redis密码
            pool_size: 连接池大小
            encoding: 编码格式
            decode_responses: 是否自动解码响应
        """
        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self.pool_size = pool_size
        self.encoding = encoding
        self.decode_responses = decode_responses
        
        self.redis: Optional[AsyncRedis] = None
    
    async def connect(self):
        """
        创建Redis连接池
        
        Raises:
            Exception: 连接失败时抛出异常
        """
        try:
            self.redis = AsyncRedis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password,
                max_connections=self.pool_size,
                encoding=self.encoding,
                decode_responses=self.decode_responses
            )
            
            # 测试连接
            await self.redis.ping()
            logger.info(f"[OK] Redis连接成功 | 数据库: {self.db}")
        except Exception as e:
            logger.error(f"[FAIL] Redis连接失败: {e}")
            raise
    
    async def disconnect(self):
        """
        关闭Redis连接
        """
        if self.redis:
            await self.redis.close()
            logger.info("[OK] Redis连接已关闭")
    
    # 字符串操作
    async def set(
        self,
        key: str,
        value: Any,
        expire: Optional[int] = None
    ) -> bool:
        """
        设置键值对
        
        Args:
            key: 键
            value: 值（会自动序列化为JSON）
            expire: 过期时间（秒）
            
        Returns:
            是否设置成功
        """
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False, cls=DateTimeEncoder)
            
            if expire:
                await self.redis.setex(key, expire, value)
            else:
                await self.redis.set(key, value)
            
            return True
        except Exception as e:
            logger.error(f"Redis SET失败 | 键: {key} | 错误: {e}")
            return False
    
    async def get(self, key: str) -> Optional[Any]:
        """
        获取键值
        
        Args:
            key: 键
            
        Returns:
            值（自动反序列化JSON）
        """
        try:
            value = await self.redis.get(key)
            
            if value is None:
                return None
            
            # 尝试反序列化JSON
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
                
        except Exception as e:
            logger.error(f"Redis GET失败 | 键: {key} | 错误: {e}")
            return None
    
    async def delete(self, *keys: str) -> int:
        """
        删除键
        
        Args:
            *keys: 要删除的键列表
            
        Returns:
            删除的键数量
        """
        try:
            return await self.redis.delete(*keys)
        except Exception as e:
            logger.error(f"Redis DELETE失败 | 键: {keys} | 错误: {e}")
            return 0
    
    async def exists(self, *keys: str) -> int:
        """
        检查键是否存在
        
        Args:
            *keys: 要检查的键列表
            
        Returns:
            存在的键数量
        """
        try:
            return await self.redis.exists(*keys)
        except Exception as e:
            logger.error(f"Redis EXISTS失败 | 键: {keys} | 错误: {e}")
            return 0
    
    async def expire(self, key: str, seconds: int) -> bool:
        """
        设置键的过期时间
        
        Args:
            key: 键
            seconds: 过期时间（秒）
            
        Returns:
            是否设置成功
        """
        try:
            return await self.redis.expire(key, seconds)
        except Exception as e:
            logger.error(f"Redis EXPIRE失败 | 键: {key} | 错误: {e}")
            return False
    
    async def ttl(self, key: str) -> int:
        """
        获取键的剩余生存时间
        
        Args:
            key: 键
            
        Returns:
            剩余生存时间（秒），-1表示永不过期，-2表示键不存在
        """
        try:
            return await self.redis.ttl(key)
        except Exception as e:
            logger.error(f"Redis TTL失败 | 键: {key} | 错误: {e}")
            return -2
    
    # 哈希操作
    async def hset(self, name: str, key: str, value: Any) -> bool:
        """
        设置哈希字段
        
        Args:
            name: 哈希表名
            key: 字段名
            value: 字段值
            
        Returns:
            是否设置成功
        """
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value, ensure_ascii=False, cls=DateTimeEncoder)
            
            await self.redis.hset(name, key, value)
            return True
        except Exception as e:
            logger.error(f"Redis HSET失败 | 哈希: {name} | 字段: {key} | 错误: {e}")
            return False
    
    async def hget(self, name: str, key: str) -> Optional[Any]:
        """
        获取哈希字段值
        
        Args:
            name: 哈希表名
            key: 字段名
            
        Returns:
            字段值
        """
        try:
            value = await self.redis.hget(name, key)
            
            if value is None:
                return None
            
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return value
                
        except Exception as e:
            logger.error(f"Redis HGET失败 | 哈希: {name} | 字段: {key} | 错误: {e}")
            return None
    
    async def hgetall(self, name: str) -> Dict[str, Any]:
        """
        获取哈希表所有字段和值
        
        Args:
            name: 哈希表名
            
        Returns:
            字段和值的字典
        """
        try:
            data = await self.redis.hgetall(name)
            
            result = {}
            for key, value in data.items():
                try:
                    result[key] = json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    result[key] = value
            
            return result
        except Exception as e:
            logger.error(f"Redis HGETALL失败 | 哈希: {name} | 错误: {e}")
            return {}
    
    async def hdel(self, name: str, *keys: str) -> int:
        """
        删除哈希字段
        
        Args:
            name: 哈希表名
            *keys: 要删除的字段列表
            
        Returns:
            删除的字段数量
        """
        try:
            return await self.redis.hdel(name, *keys)
        except Exception as e:
            logger.error(f"Redis HDEL失败 | 哈希: {name} | 字段: {keys} | 错误: {e}")
            return 0
    
    # 列表操作
    async def lpush(self, name: str, *values: Any) -> int:
        """
        将值推入列表左侧
        
        Args:
            name: 列表名
            *values: 要推入的值列表
            
        Returns:
            列表长度
        """
        try:
            serialized_values = []
            for value in values:
                if isinstance(value, (dict, list)):
                    value = json.dumps(value, ensure_ascii=False, cls=DateTimeEncoder)
                serialized_values.append(value)
            
            return await self.redis.lpush(name, *serialized_values)
        except Exception as e:
            logger.error(f"Redis LPUSH失败 | 列表: {name} | 错误: {e}")
            return 0
    
    async def rpush(self, name: str, *values: Any) -> int:
        """
        将值推入列表右侧
        
        Args:
            name: 列表名
            *values: 要推入的值列表
            
        Returns:
            列表长度
        """
        try:
            serialized_values = []
            for value in values:
                if isinstance(value, (dict, list)):
                    value = json.dumps(value, ensure_ascii=False, cls=DateTimeEncoder)
                serialized_values.append(value)
            
            return await self.redis.rpush(name, *serialized_values)
        except Exception as e:
            logger.error(f"Redis RPUSH失败 | 列表: {name} | 错误: {e}")
            return 0
    
    async def lrange(self, name: str, start: int = 0, end: int = -1) -> List[Any]:
        """
        获取列表范围内的元素
        
        Args:
            name: 列表名
            start: 起始索引
            end: 结束索引
            
        Returns:
            元素列表
        """
        try:
            values = await self.redis.lrange(name, start, end)
            
            result = []
            for value in values:
                try:
                    result.append(json.loads(value))
                except (json.JSONDecodeError, TypeError):
                    result.append(value)
            
            return result
        except Exception as e:
            logger.error(f"Redis LRANGE失败 | 列表: {name} | 错误: {e}")
            return []
    
    async def llen(self, name: str) -> int:
        """
        获取列表长度
        
        Args:
            name: 列表名
            
        Returns:
            列表长度
        """
        try:
            return await self.redis.llen(name)
        except Exception as e:
            logger.error(f"Redis LLEN失败 | 列表: {name} | 错误: {e}")
            return 0
    
    # 集合操作
    async def sadd(self, name: str, *values: Any) -> int:
        """
        向集合添加成员
        
        Args:
            name: 集合名
            *values: 要添加的成员列表
            
        Returns:
            新增成员数量
        """
        try:
            serialized_values = []
            for value in values:
                if isinstance(value, (dict, list)):
                    value = json.dumps(value, ensure_ascii=False, cls=DateTimeEncoder)
                serialized_values.append(value)
            
            return await self.redis.sadd(name, *serialized_values)
        except Exception as e:
            logger.error(f"Redis SADD失败 | 集合: {name} | 错误: {e}")
            return 0
    
    async def smembers(self, name: str) -> set:
        """
        获取集合所有成员
        
        Args:
            name: 集合名
            
        Returns:
            成员集合
        """
        try:
            values = await self.redis.smembers(name)
            
            result = set()
            for value in values:
                try:
                    result.add(json.loads(value))
                except (json.JSONDecodeError, TypeError):
                    result.add(value)
            
            return result
        except Exception as e:
            logger.error(f"Redis SMEMBERS失败 | 集合: {name} | 错误: {e}")
            return set()
    
    async def srem(self, name: str, *values: Any) -> int:
        """
        从集合删除成员
        
        Args:
            name: 集合名
            *values: 要删除的成员列表
            
        Returns:
            删除的成员数量
        """
        try:
            serialized_values = []
            for value in values:
                if isinstance(value, (dict, list)):
                    value = json.dumps(value, ensure_ascii=False, cls=DateTimeEncoder)
                serialized_values.append(value)
            
            return await self.redis.srem(name, *serialized_values)
        except Exception as e:
            logger.error(f"Redis SREM失败 | 集合: {name} | 错误: {e}")
            return 0
    
    # 缓存相关操作
    async def cache_get(self, key: str) -> Optional[Any]:
        """
        从缓存获取数据
        
        Args:
            key: 缓存键
            
        Returns:
            缓存数据
        """
        return await self.get(key)
    
    async def cache_set(
        self,
        key: str,
        value: Any,
        expire: int = 3600
    ) -> bool:
        """
        设置缓存数据
        
        Args:
            key: 缓存键
            value: 缓存值
            expire: 过期时间（秒，默认1小时）
            
        Returns:
            是否设置成功
        """
        return await self.set(key, value, expire)
    
    async def cache_delete(self, *keys: str) -> int:
        """
        删除缓存数据
        
        Args:
            *keys: 要删除的缓存键列表
            
        Returns:
            删除的键数量
        """
        return await self.delete(*keys)
    
    async def cache_clear(self, pattern: str = "*") -> int:
        """
        清空匹配模式的缓存
        
        Args:
            pattern: 键匹配模式（默认匹配所有键）
            
        Returns:
            删除的键数量
        """
        try:
            keys = []
            async for key in self.redis.scan_iter(match=pattern):
                keys.append(key)
            
            if keys:
                return await self.delete(*keys)
            
            return 0
        except Exception as e:
            logger.error(f"Redis缓存清理失败 | 模式: {pattern} | 错误: {e}")
            return 0
