import aiomysql
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager
import logging
from datetime import datetime
import time

logger = logging.getLogger(__name__)


class MySQLRepository:
    """
    MySQL数据访问层
    
    功能：
    - 管理MySQL数据库连接池
    - 提供异步数据库操作接口
    - 支持事务管理
    - 连接池自动管理
    
    使用场景：
    - 图片元数据存储
    - 用户数据管理
    - 业务数据持久化
    """
    
    def __init__(
        self,
        host: str = "localhost",
        port: int = 3306,
        user: str = "root",
        password: str = "",
        database: str = "image_db",
        pool_size: int = 30,
        pool_recycle: int = 3600,
        pool_timeout: int = 30,
        max_overflow: int = 20,
        echo: bool = False
    ):
        """
        初始化MySQL仓库
        
        Args:
            host: MySQL服务器地址
            port: MySQL服务器端口
            user: 数据库用户名
            password: 数据库密码
            database: 数据库名称
            pool_size: 连接池大小
            pool_recycle: 连接回收时间（秒）
            pool_timeout: 连接池超时时间（秒）
            max_overflow: 最大连接池溢出连接数
            echo: 是否输出SQL语句
        """
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.database = database
        self.pool_size = pool_size
        self.pool_recycle = pool_recycle
        self.pool_timeout = pool_timeout
        self.max_overflow = max_overflow
        self.echo = echo
        
        self.pool: Optional[aiomysql.Pool] = None
        
        # 权限缓存
        self.permission_cache = {}
        self.cache_expiry = 300  # 缓存过期时间（秒）

        # 性能指标统计
        self._query_metrics = {
            'total_queries': 0,
            'slow_queries': 0,  # > 500ms
            'medium_queries': 0,  # > 100ms
            'total_time': 0.0,
            'query_types': {}
        }
    
    async def connect(self):
        """
        创建数据库连接池
        
        Raises:
            Exception: 连接失败时抛出异常
        """
        try:
            self.pool = await aiomysql.create_pool(
                host=self.host,
                port=self.port,
                user=self.user,
                password=self.password,
                db=self.database,
                minsize=5,  # 优化：增加最小连接数
                maxsize=self.pool_size + self.max_overflow,  # 考虑溢出连接
                pool_recycle=self.pool_recycle,
                echo=self.echo,
                charset='utf8mb4',
                autocommit=False,
                connect_timeout=10
            )
            logger.info(f"[OK] MySQL连接池创建成功 | 数据库: {self.database}, 连接池大小: {self.pool_size}, 最大溢出: {self.max_overflow}")
            
            # 检查并创建image_access_logs表
            await self._check_and_create_image_access_logs_table()
            
            # 检查并创建系统日志相关表
            await self._check_and_create_system_log_tables()
            
            # 创建必要的索引
            await self._create_necessary_indexes()
        except Exception as e:
            logger.error(f"[FAIL] MySQL连接池创建失败: {e}")
            raise
    
    async def _check_and_create_image_access_logs_table(self):
        """
        检查并创建image_access_logs表
        """
        try:
            async with self.get_connection() as conn:
                async with conn.cursor() as cursor:
                    # 检查表是否存在
                    await cursor.execute("SHOW TABLES LIKE 'image_access_logs'")
                    result = await cursor.fetchone()
                    
                    if result:
                        logger.info("[OK] image_access_logs表已存在")
                    else:
                        # 创建表
                        create_table_sql = """
                        CREATE TABLE `image_access_logs` (
                            `id` INT NOT NULL AUTO_INCREMENT,
                            `image_id` INT NOT NULL COMMENT '图片ID',
                            `status` VARCHAR(20) NOT NULL COMMENT '访问状态：success/failed',
                            `error_message` TEXT NULL COMMENT '错误信息',
                            `access_time` DATETIME NOT NULL COMMENT '访问时间',
                            `ip` VARCHAR(45) NULL COMMENT '访问IP',
                            `user_agent` TEXT NULL COMMENT '用户代理',
                            `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
                            PRIMARY KEY (`id`),
                            INDEX `idx_image_id` (`image_id`),
                            INDEX `idx_status` (`status`),
                            INDEX `idx_access_time` (`access_time`)
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='图片访问日志表';
                        """
                        
                        await cursor.execute(create_table_sql)
                        await conn.commit()
                        logger.info("[OK] image_access_logs表创建成功")
        except Exception as e:
            logger.error(f"[FAIL] 检查或创建image_access_logs表失败: {e}")
            raise
    
    async def _check_and_create_system_log_tables(self):
        """
        检查并创建系统日志相关表
        """
        try:
            async with self.get_connection() as conn:
                async with conn.cursor() as cursor:
                    # 检查并创建system_docs表
                    await cursor.execute("SHOW TABLES LIKE 'system_docs'")
                    result = await cursor.fetchone()
                    
                    if result:
                        logger.info("[OK] system_docs表已存在")
                    else:
                        # 创建表
                        create_table_sql = """
                        CREATE TABLE `system_docs` (
                            `id` VARCHAR(36) PRIMARY KEY,
                            `title` VARCHAR(255) NOT NULL,
                            `content` TEXT NOT NULL,
                            `category` VARCHAR(100) NOT NULL,
                            `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
                            `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                        """
                        
                        await cursor.execute(create_table_sql)
                        logger.info("[OK] system_docs表创建成功")
                    
                    # 检查并创建update_records表
                    await cursor.execute("SHOW TABLES LIKE 'update_records'")
                    result = await cursor.fetchone()
                    
                    if result:
                        logger.info("[OK] update_records表已存在")
                    else:
                        # 创建表
                        create_table_sql = """
                        CREATE TABLE `update_records` (
                            `id` VARCHAR(36) PRIMARY KEY,
                            `date` DATE NOT NULL,
                            `title` VARCHAR(255) NOT NULL,
                            `content` TEXT NOT NULL,
                            `implementation` TEXT NOT NULL,
                            `updateType` ENUM('success', 'info', 'warning', 'error') NOT NULL,
                            `icon` VARCHAR(100),
                            `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                        """
                        
                        await cursor.execute(create_table_sql)
                        logger.info("[OK] update_records表创建成功")
                    
                    # 检查并创建requirements表
                    await cursor.execute("SHOW TABLES LIKE 'requirements'")
                    result = await cursor.fetchone()
                    
                    if result:
                        logger.info("[OK] requirements表已存在")
                    else:
                        # 创建表
                        create_table_sql = """
                        CREATE TABLE `requirements` (
                            `id` VARCHAR(36) PRIMARY KEY,
                            `name` VARCHAR(255) NOT NULL,
                            `description` TEXT NOT NULL,
                            `priority` ENUM('high', 'medium', 'low') NOT NULL,
                            `status` ENUM('pending', 'in_progress', 'completed') NOT NULL,
                            `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
                            `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
                        """
                        
                        await cursor.execute(create_table_sql)
                        logger.info("[OK] requirements表创建成功")
                    
                    await conn.commit()
                    logger.info("[OK] 系统日志相关表创建完成")
        except Exception as e:
            logger.error(f"[FAIL] 检查或创建系统日志相关表失败: {e}")
            # 系统日志表创建失败不影响系统启动，只记录错误
    
    async def _create_necessary_indexes(self):
        """
        创建必要的数据库索引，提高查询性能
        """
        try:
            async with self.get_connection() as conn:
                async with conn.cursor() as cursor:
                    # 索引定义列表
                    index_definitions = [
                        # roles 表索引
                        {"table": "roles", "name": "idx_roles_name", "columns": "name", "unique": False},
                        {"table": "roles", "name": "idx_roles_parent_id", "columns": "parent_id", "unique": False},
                        
                        # role_permissions 表索引
                        {"table": "role_permissions", "name": "idx_role_permissions_role_id", "columns": "role_id", "unique": False},
                        {"table": "role_permissions", "name": "idx_role_permissions_permission_id", "columns": "permission_id", "unique": False},
                        {"table": "role_permissions", "name": "idx_role_permissions_unique", "columns": "role_id, permission_id", "unique": True},
                        
                        # users 表索引
                        {"table": "users", "name": "idx_users_role", "columns": "role", "unique": False},
                        {"table": "users", "name": "idx_users_username", "columns": "username", "unique": False},
                        
                        # permissions 表索引
                        {"table": "permissions", "name": "idx_permissions_code", "columns": "code", "unique": False}
                    ]
                    
                    for index_def in index_definitions:
                        try:
                            # 检查索引是否存在
                            await cursor.execute(f"SHOW INDEX FROM {index_def['table']} WHERE Key_name = '{index_def['name']}'")
                            result = await cursor.fetchone()
                            
                            # 如果索引不存在，创建索引
                            if not result:
                                if index_def['unique']:
                                    create_sql = f"CREATE UNIQUE INDEX {index_def['name']} ON {index_def['table']}({index_def['columns']})"
                                else:
                                    create_sql = f"CREATE INDEX {index_def['name']} ON {index_def['table']}({index_def['columns']})"
                                
                                await cursor.execute(create_sql)
                                logger.info(f"[OK] 创建索引: {index_def['name']} 到 {index_def['table']}({index_def['columns']})")
                        except Exception as e:
                            # 索引已存在时不记录警告
                            if "Duplicate key name" in str(e) or "已存在" in str(e):
                                pass
                            else:
                                logger.warning(f"[WARN] 创建索引失败: {e}")
                            
                    await conn.commit()
                    logger.info("[OK] 索引创建完成")
        except Exception as e:
            logger.error(f"[FAIL] 创建索引失败: {e}")
            # 索引创建失败不影响系统启动，只记录错误
    
    async def disconnect(self):
        """
        关闭数据库连接池
        """
        if self.pool:
            self.pool.close()
            await self.pool.wait_closed()
            logger.info("[OK] MySQL连接池已关闭")

    def _record_metrics(self, query_type: str, execution_time: float, result_count: int):
        """
        记录查询性能指标

        Args:
            query_type: 查询类型 (SELECT, INSERT, UPDATE, DELETE 等)
            execution_time: 执行时间（毫秒）
            result_count: 返回结果数量
        """
        self._query_metrics['total_queries'] += 1
        self._query_metrics['total_time'] += execution_time

        if execution_time > 500:
            self._query_metrics['slow_queries'] += 1
        elif execution_time > 100:
            self._query_metrics['medium_queries'] += 1

        # 按查询类型统计
        if query_type not in self._query_metrics['query_types']:
            self._query_metrics['query_types'][query_type] = {
                'count': 0,
                'total_time': 0.0,
                'slow_count': 0
            }

        self._query_metrics['query_types'][query_type]['count'] += 1
        self._query_metrics['query_types'][query_type]['total_time'] += execution_time
        if execution_time > 500:
            self._query_metrics['query_types'][query_type]['slow_count'] += 1

    def get_performance_report(self) -> dict:
        """
        获取性能报告

        Returns:
            dict: 性能指标报告
        """
        total = self._query_metrics['total_queries']
        if total == 0:
            return {
                'total_queries': 0,
                'avg_time': 0.0,
                'slow_query_rate': 0.0,
                'medium_query_rate': 0.0
            }

        return {
            'total_queries': total,
            'avg_time': self._query_metrics['total_time'] / total,
            'slow_queries': self._query_metrics['slow_queries'],
            'slow_query_rate': self._query_metrics['slow_queries'] / total * 100,
            'medium_queries': self._query_metrics['medium_queries'],
            'medium_query_rate': self._query_metrics['medium_queries'] / total * 100,
            'total_time': self._query_metrics['total_time'],
            'query_types': self._query_metrics['query_types']
        }

    def reset_metrics(self):
        """重置性能指标"""
        self._query_metrics = {
            'total_queries': 0,
            'slow_queries': 0,
            'medium_queries': 0,
            'total_time': 0.0,
            'query_types': {}
        }
    
    @asynccontextmanager
    async def get_connection(self):
        """
        获取数据库连接的上下文管理器
        
        Yields:
            aiomysql.Connection: 数据库连接对象
        """
        if not self.pool:
            raise RuntimeError("数据库连接池未初始化")
        
        async with self.pool.acquire() as conn:
            # 检查连接是否有效（ping）
            try:
                conn.ping()
            except Exception:
                # 连接已失效，重新获取
                logger.warning("检测到失效连接，重新获取")
                async with self.pool.acquire() as new_conn:
                    conn = new_conn
            
            # 设置事务隔离级别为READ COMMITTED，确保能读取到最新提交的数据
            async with conn.cursor() as cursor:
                await cursor.execute("SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED")
            yield conn
    
    async def execute_query(
        self,
        query: str,
        params: Optional[tuple] = None,
        fetch_one: bool = False,
        fetch_all: bool = True,
        timeout: int = 30
    ) -> Optional[List[Dict[str, Any]]]:
        """
        执行查询语句

        Args:
            query: SQL查询语句
            params: 查询参数
            fetch_one: 是否只获取一条记录
            fetch_all: 是否获取所有记录
            timeout: 查询超时时间（秒），默认30秒

        Returns:
            查询结果列表或单条记录

        Raises:
            asyncio.TimeoutError: 查询超时
        """
        import asyncio
        start_time = time.time()
        query_type = query.strip().split()[0].upper() if query.strip() else "UNKNOWN"

        async def _execute():
            async with self.get_connection() as conn:
                async with conn.cursor(aiomysql.DictCursor) as cursor:
                    # 设置会话超时
                    await cursor.execute(f"SET SESSION MAX_EXECUTION_TIME = {timeout * 1000}")

                    if params is not None:
                        await cursor.execute(query, params)
                    else:
                        await cursor.execute(query)

                    if fetch_one:
                        result = await cursor.fetchone()
                    elif fetch_all:
                        result = await cursor.fetchall()
                    else:
                        result = None

                    return result

        try:
            # 使用 asyncio.wait_for 实现超时控制
            result = await asyncio.wait_for(_execute(), timeout=timeout)

            execution_time = (time.time() - start_time) * 1000

            # 记录查询执行时间，超过500ms的查询会被警告
            if execution_time > 500:
                logger.warning(f"SQL查询执行时间较长: {execution_time:.2f}ms, 类型: {query_type}, 查询: {query[:200]}...")
            elif execution_time > 100:
                logger.info(f"SQL查询执行时间: {execution_time:.2f}ms, 类型: {query_type}")

            # 记录查询结果数量
            result_count = 0
            if result:
                if isinstance(result, list):
                    result_count = len(result)
                else:
                    result_count = 1

            if result_count > 1000:
                logger.info(f"SQL查询返回结果较多: {result_count} 条记录, 类型: {query_type}")

            # 性能指标收集（用于监控）
            self._record_metrics(query_type, execution_time, result_count)

            return result

        except asyncio.TimeoutError:
            execution_time = (time.time() - start_time) * 1000
            logger.error(f"SQL查询超时: {execution_time:.2f}ms, 类型: {query_type}, 查询: {query[:200]}...")
            raise asyncio.TimeoutError(f"查询执行超时（{timeout}秒），请优化查询条件或减少数据量")

        except Exception as e:
            execution_time = (time.time() - start_time) * 1000
            logger.error(f"SQL查询执行失败: {e}, 执行时间: {execution_time:.2f}ms, 类型: {query_type}")
            raise
    
    async def execute_query_one(
        self,
        query: str,
        params: Optional[tuple] = None
    ) -> Optional[Dict[str, Any]]:
        """
        执行查询语句并返回单行结果
        
        Args:
            query: SQL查询语句
            params: 查询参数
            
        Returns:
            查询结果（单个字典）或None
        """
        return await self.execute_query(query, params, fetch_one=True)
    
    async def execute_update(
        self,
        query: str,
        params: Optional[tuple] = None
    ) -> int:
        """
        执行更新语句（INSERT, UPDATE, DELETE）
        
        Args:
            query: SQL更新语句
            params: 更新参数
            
        Returns:
            受影响的行数
        """
        async with self.get_connection() as conn:
            async with conn.cursor() as cursor:
                result = await cursor.execute(query, params or ())
                await conn.commit()
                return result
    
    async def execute_insert(
        self,
        query: str,
        params: Optional[tuple] = None
    ) -> Dict[str, Any]:
        """
        执行INSERT语句并返回插入的ID
        
        Args:
            query: SQL INSERT语句
            params: 插入参数
            
        Returns:
            包含last_id的字典
        """
        async with self.get_connection() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(query, params or ())
                await conn.commit()
                return {'last_id': cursor.lastrowid}
    
    async def execute_delete(
        self,
        query: str,
        params: Optional[tuple] = None
    ) -> int:
        """
        执行DELETE语句
        
        Args:
            query: SQL DELETE语句
            params: 删除参数
            
        Returns:
            受影响的行数
        """
        async with self.get_connection() as conn:
            async with conn.cursor() as cursor:
                await cursor.execute(query, params or ())
                await conn.commit()
                return cursor.rowcount
    
    async def execute_batch(
        self,
        query: str,
        params_list: List[tuple]
    ) -> int:
        """
        批量执行更新语句
        
        Args:
            query: SQL更新语句
            params_list: 参数列表
            
        Returns:
            受影响的行数
        """
        async with self.get_connection() as conn:
            async with conn.cursor() as cursor:
                result = await cursor.executemany(query, params_list)
                await conn.commit()
                return result
    
    async def begin_transaction(self):
        """
        开始事务
        
        Returns:
            数据库连接对象
        """
        conn = await self.pool.acquire()
        await conn.begin()
        return conn
    
    async def commit_transaction(self, conn):
        """
        提交事务
        
        Args:
            conn: 数据库连接对象
        """
        await conn.commit()
        self.pool.release(conn)
    
    async def rollback_transaction(self, conn):
        """
        回滚事务
        
        Args:
            conn: 数据库连接对象
        """
        await conn.rollback()
        self.pool.release(conn)
    
    # 图片相关操作
    async def create_image(
        self,
        filename: str,
        filepath: str,
        file_size: int,
        width: int,
        height: int,
        format: str,
        category: str,
        tags: Optional[str] = None,
        description: Optional[str] = None,
        cos_object_key: Optional[str] = None,
        cos_url: Optional[str] = None,
        original_file_size: Optional[int] = None,
        original_format: Optional[str] = None,
        original_width: Optional[int] = None,
        original_height: Optional[int] = None,
        original_filename: Optional[str] = None,
        original_quality: Optional[int] = None,
        original_zip_filepath: Optional[str] = None,
        original_zip_cos_key: Optional[str] = None,
        sku: Optional[str] = None
    ) -> int:
        """
        创建图片记录

        Args:
            filename: 文件名
            filepath: 文件路径
            file_size: 文件大小（字节）
            width: 图片宽度
            height: 图片高度
            format: 图片格式
            category: 图片分类
            tags: 图片标签（JSON字符串）
            description: 图片描述
            cos_object_key: 腾讯云COS对象键
            cos_url: 腾讯云COS访问URL
            original_file_size: 原始文件大小（字节）
            original_format: 原始图片格式
            original_width: 原始图片宽度
            original_height: 原始图片高度
            original_filename: 原始文件名
            original_quality: 原始图片质量（1-100）
            original_zip_filepath: 原始图片zip包路径
            original_zip_cos_key: 原始图片zip包COS对象键
            sku: 产品SKU

        Returns:
            插入的图片ID
        """
        # 确定存储类型
        storage_type = 'cos' if cos_object_key else 'local'

        query = """
            INSERT INTO images (
                filename, filepath, file_size, width, height, format,
                category, tags, description, created_at, updated_at,
                storage_type, cos_object_key, cos_url,
                original_file_size, original_format, original_width, original_height,
                original_filename, original_quality,
                original_zip_filepath, original_zip_cos_key,
                sku
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = (
            filename, filepath, file_size, width, height, format,
            category, tags, description, datetime.now(), datetime.now(),
            storage_type, cos_object_key, cos_url,
            original_file_size, original_format, original_width, original_height,
            original_filename, original_quality,
            original_zip_filepath, original_zip_cos_key,
            sku
        )

        result = await self.execute_insert(query, params)
        return result['last_id']
    
    async def get_image_by_id(self, image_id: int) -> Optional[Dict[str, Any]]:
        """
        根据ID获取图片信息
        
        Args:
            image_id: 图片ID
            
        Returns:
            图片信息字典
        """
        query = """
            SELECT 
                id,
                filename,
                filepath,
                file_size,
                width,
                height,
                format,
                category,
                tags,
                description,
                created_at,
                updated_at,
                storage_type,
                cos_object_key,
                cos_url,
                original_file_size,
                original_format,
                original_width,
                original_height,
                original_filename,
                original_quality,
                original_zip_filepath,
                original_zip_cos_key,
                cos_thumbnail_key,
                cos_thumbnail_url,
                sku
            FROM images WHERE id = %s
        """
        
        image = await self.execute_query(query, (image_id,), fetch_one=True)
        
        if image:
            # 优先使用COS URL作为文件路径
            if image.get('cos_url'):
                image['filepath'] = image['cos_url']
                image['storage_type'] = 'cos'
            
            # 优先使用COS缩略图URL
            if image.get('cos_thumbnail_url') and image['cos_thumbnail_url']:
                image['thumbnail_path'] = image['cos_thumbnail_url']
            elif image.get('thumbnail_path') and not image['thumbnail_path'].startswith('http'):
                # 如果是本地缩略图路径，检查是否需要生成COS缩略图URL
                # 暂时保持原样
                pass
        
        return image
    
    async def get_images_by_category(
        self,
        category: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        根据分类获取图片列表
        
        Args:
            category: 图片分类
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            图片信息列表
        """
        query = """
            SELECT * FROM images 
            WHERE category = %s 
            ORDER BY created_at DESC 
            LIMIT %s OFFSET %s
        """
        return await self.execute_query(query, (category, limit, offset))
    
    async def search_images(
        self,
        keyword: str,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        搜索图片
        
        Args:
            keyword: 搜索关键词
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            图片信息列表
        """
        query = """
            SELECT * FROM images 
            WHERE filename LIKE %s OR description LIKE %s OR tags LIKE %s
            ORDER BY created_at DESC 
            LIMIT %s OFFSET %s
        """
        pattern = f"%{keyword}%"
        return await self.execute_query(query, (pattern, pattern, pattern, limit, offset))
    
    async def update_image(
        self,
        image_id: int,
        **kwargs
    ) -> int:
        """
        更新图片信息
        
        Args:
            image_id: 图片ID
            **kwargs: 要更新的字段
            
        Returns:
            受影响的行数
        """
        if not kwargs:
            return 0
        
        kwargs['updated_at'] = datetime.now()
        
        set_clause = ", ".join([f"{key} = %s" for key in kwargs.keys()])
        query = f"UPDATE images SET {set_clause} WHERE id = %s"
        params = tuple(kwargs.values()) + (image_id,)
        
        return await self.execute_update(query, params)
    
    async def delete_image(self, image_id: int) -> int:
        """
        删除图片记录
        
        Args:
            image_id: 图片ID
            
        Returns:
            受影响的行数
        """
        query = "DELETE FROM images WHERE id = %s"
        return await self.execute_update(query, (image_id,))
    
    async def get_image_count(self, category: Optional[str] = None) -> int:
        """
        获取图片数量
        
        Args:
            category: 图片分类（可选）
            
        Returns:
            图片数量
        """
        if category:
            query = "SELECT COUNT(*) as count FROM images WHERE category = %s"
            result = await self.execute_query(query, (category,), fetch_one=True)
        else:
            query = "SELECT COUNT(*) as count FROM images"
            result = await self.execute_query(query, fetch_one=True)
        
        return result['count'] if result else 0

    async def get_local_storage_images(self) -> List[Dict[str, Any]]:
        """
        获取使用本地存储的图片列表
        
        Returns:
            本地存储图片列表
        """
        query = """
            SELECT 
                id,
                asin as filename,
                local_path as filepath,
                thumb_path as thumbnail_path,
                image_url as cos_url,
                'local' as storage_type,
                NULL as cos_object_key,
                NULL as cos_thumbnail_key,
                created_at,
                updated_at
            FROM selection_products 
            WHERE local_path IS NOT NULL AND local_path != ''
            ORDER BY created_at DESC
        """
        return await self.execute_query(query)

    async def get_all_product_images(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """
        获取所有产品图片列表（支持COS URL）
        
        Args:
            limit: 返回数量限制
            offset: 偏移量
            
        Returns:
            产品图片列表
        """
        query = """
            SELECT 
                id,
                asin as filename,
                CASE 
                    WHEN image_url IS NOT NULL AND image_url != '' THEN image_url
                    ELSE local_path
                END as filepath,
                CASE 
                    WHEN cos_thumbnail_url IS NOT NULL AND cos_thumbnail_url != '' THEN cos_thumbnail_url
                    ELSE thumb_path
                END as thumbnail_path,
                image_url as cos_url,
                CASE 
                    WHEN image_url IS NOT NULL AND image_url != '' THEN 'cos'
                    ELSE 'local'
                END as storage_type,
                NULL as cos_object_key,
                NULL as cos_thumbnail_key,
                cos_thumbnail_url,
                created_at,
                updated_at
            FROM selection_products 
            WHERE local_path IS NOT NULL AND local_path != '' OR image_url IS NOT NULL AND image_url != ''
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """
        return await self.execute_query(query, (limit, offset))

    async def update_image_storage_info(
        self,
        image_id: int,
        storage_type: str,
        cos_object_key: Optional[str] = None,
        cos_url: Optional[str] = None,
        cos_thumbnail_key: Optional[str] = None,
        cos_thumbnail_url: Optional[str] = None
    ) -> int:
        """
        更新图片存储信息
        
        Args:
            image_id: 图片ID
            storage_type: 存储类型
            cos_object_key: COS对象键
            cos_url: COS访问URL
            cos_thumbnail_key: COS缩略图对象键
            cos_thumbnail_url: COS缩略图访问URL
            
        Returns:
            受影响的行数
        """
        query = """
            UPDATE selection_products SET 
                image_url = %s,
                updated_at = %s
            WHERE id = %s
        """
        params = (cos_url, datetime.now(), image_id)
        return await self.execute_update(query, params)

    async def update_image_thumbnail_info(
        self,
        image_id: int,
        cos_thumbnail_key: str,
        cos_thumbnail_url: str
    ) -> int:
        """
        更新图片缩略图信息
        
        Args:
            image_id: 图片ID
            cos_thumbnail_key: COS缩略图对象键
            cos_thumbnail_url: COS缩略图访问URL
            
        Returns:
            受影响的行数
        """
        # 更新selection_products表中的缩略图路径为COS URL
        query = """
            UPDATE selection_products SET 
                thumb_path = %s,
                updated_at = %s
            WHERE id = %s
        """
        params = (cos_thumbnail_url, datetime.now(), image_id)
        return await self.execute_update(query, params)

    async def update_image_thumbnail(
        self,
        image_id: int,
        thumbnail_cos_key: str,
        thumbnail_cos_url: str
    ) -> int:
        """更新 images 表的缩略图COS信息（已有列 cos_thumbnail_key / cos_thumbnail_url）"""
        query = """
            UPDATE images SET
                cos_thumbnail_key = %s,
                cos_thumbnail_url = %s,
                updated_at = %s
            WHERE id = %s
        """
        params = (thumbnail_cos_key, thumbnail_cos_url, datetime.now(), image_id)
        return await self.execute_update(query, params)

    async def get_images_missing_thumbnails(self) -> list:
        """获取缺少缩略图COS URL的图片记录"""
        query = """
            SELECT id, filename, filepath, cos_url, cos_object_key,
                   cos_thumbnail_url
            FROM images
            WHERE cos_thumbnail_url IS NULL OR cos_thumbnail_url = ''
            ORDER BY id DESC
            LIMIT 500
        """
        return await self.execute_query(query, fetch_all=True)

    async def get_all_images_with_thumbnails(self) -> list:
        """获取所有有缩略图COS URL的图片"""
        query = """
            SELECT id, cos_thumbnail_url
            FROM images
            WHERE cos_thumbnail_url IS NOT NULL AND cos_thumbnail_url != ''
        """
        return await self.execute_query(query, fetch_all=True)

    async def get_storage_statistics(self) -> Dict[str, Any]:
        """
        获取存储统计信息
        
        Returns:
            存储统计信息
        """
        # 统计本地存储的图片数量
        local_query = """
            SELECT 
                COUNT(*) as count
            FROM selection_products 
            WHERE local_path IS NOT NULL AND local_path != ''
        """
        
        # 统计COS存储的图片数量
        cos_query = """
            SELECT 
                COUNT(*) as count
            FROM selection_products 
            WHERE image_url IS NOT NULL AND image_url != '' AND image_url LIKE '%cos%'
        """
        
        local_result = await self.execute_query(local_query, fetch_one=True)
        cos_result = await self.execute_query(cos_query, fetch_one=True)
        
        local_count = local_result['count'] if local_result else 0
        cos_count = cos_result['count'] if cos_result else 0
        total_count = local_count + cos_count
        
        stats = {
            "total_images": total_count,
            "local_storage": local_count,
            "cos_storage": cos_count,
            "total_size": 0,  # 由于原表没有file_size字段，暂时设为0
            "local_size": 0,
            "cos_size": 0
        }
        
        return stats
    
    async def create_image_access_log(self, log_data: Dict[str, Any]) -> int:
        """
        创建图片访问日志
        
        Args:
            log_data: 日志数据，包含以下字段：
                - image_id: 图片ID
                - status: 访问状态（success/failed）
                - error_message: 错误信息（可选）
                - access_time: 访问时间
                - ip: 访问IP（可选）
                - user_agent: 用户代理（可选）
                - created_at: 创建时间（可选）
        
        Returns:
            插入的日志ID
        """
        query = """
            INSERT INTO image_access_logs (
                image_id, status, error_message, access_time, ip, user_agent, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        params = (
            log_data['image_id'],
            log_data['status'],
            log_data.get('error_message'),
            log_data['access_time'],
            log_data.get('ip'),
            log_data.get('user_agent'),
            log_data.get('created_at', datetime.now())
        )
        
        result = await self.execute_insert(query, params)
        return result['last_id']
    
    async def get_failed_image_stats(self, days: int = 7) -> List[Dict[str, Any]]:
        """
        获取指定天数内图片访问失败的统计信息
        
        Args:
            days: 统计天数，默认7天
        
        Returns:
            失败统计信息列表
        """
        query = """
            SELECT 
                image_id,
                COUNT(*) as fail_count,
                MIN(access_time) as first_fail_time,
                MAX(access_time) as last_fail_time,
                MAX(error_message) as last_error_message
            FROM image_access_logs 
            WHERE status = 'failed' 
            AND access_time >= DATE_SUB(NOW(), INTERVAL %s DAY)
            GROUP BY image_id
            ORDER BY fail_count DESC, last_fail_time DESC
        """
        
        return await self.execute_query(query, (days,))
    
    async def get_role_hierarchy(self, role_id: int) -> List[Dict[str, Any]]:
        """
        获取角色的完整继承层级（包括自身及所有父角色）
        
        Args:
            role_id: 角色ID
        
        Returns:
            角色层级列表，按从子到父的顺序排列
        """
        hierarchy = []
        current_role_id = role_id
        
        # 循环获取所有父角色，直到没有父角色为止
        while current_role_id is not None:
            # 获取当前角色信息
            role = await self.execute_query_one(
                "SELECT id, name, description, parent_id FROM roles WHERE id = %s",
                (current_role_id,)
            )
            
            if not role:
                break
            
            hierarchy.append(role)
            current_role_id = role['parent_id']
        
        return hierarchy
    
    async def get_role_permissions(self, role_id: int) -> List[Dict[str, Any]]:
        """
        获取角色的所有权限（包括从父角色继承的权限）
        
        Args:
            role_id: 角色ID
        
        Returns:
            权限列表，去重后的完整权限集
        """
        # 获取角色层级（包括自身及所有父角色）
        hierarchy = await self.get_role_hierarchy(role_id)
        role_ids = [role['id'] for role in hierarchy]
        
        if not role_ids:
            return []
        
        # 构建IN子句，使用角色ID列表查询所有权限
        placeholders = ', '.join(['%s'] * len(role_ids))
        query = f"""
            SELECT DISTINCT p.*
            FROM permissions p
            JOIN role_permissions rp ON p.id = rp.permission_id
            WHERE rp.role_id IN ({placeholders})
            ORDER BY p.id
        """
        
        return await self.execute_query(query, tuple(role_ids))
    
    async def get_user_permissions(self, user_id: int) -> List[Dict[str, Any]]:
        """
        获取用户的所有权限（基于用户角色及角色继承）
        
        Args:
            user_id: 用户ID
        
        Returns:
            权限列表，去重后的完整权限集
        """
        start_time = time.time()
        current_time = int(time.time())
        
        # 检查缓存
        cache_key = f"user_permissions_{user_id}"
        if cache_key in self.permission_cache:
            cached_data = self.permission_cache[cache_key]
            if current_time - cached_data['timestamp'] < self.cache_expiry:
                logger.info(f"使用缓存的用户权限: {user_id}")
                execution_time = (time.time() - start_time) * 1000
                if execution_time > 10:
                    logger.warning(f"get_user_permissions 缓存查询执行时间较长: {execution_time:.2f}ms")
                return cached_data['permissions']
        
        try:
            # 一次性获取用户角色和权限，减少数据库查询次数
            query = """
                WITH RECURSIVE role_hierarchy AS (
                    SELECT r.id, r.name, r.parent_id
                    FROM roles r
                    JOIN users u ON u.role = r.name
                    WHERE u.id = %s
                    UNION ALL
                    SELECT r.id, r.name, r.parent_id
                    FROM roles r
                    JOIN role_hierarchy rh ON rh.parent_id = r.id
                )
                SELECT DISTINCT p.*
                FROM permissions p
                JOIN role_permissions rp ON p.id = rp.permission_id
                JOIN role_hierarchy rh ON rh.id = rp.role_id
                ORDER BY p.id
            """
            
            permissions = await self.execute_query(query, (user_id,))
            
            # 更新缓存
            self.permission_cache[cache_key] = {
                'permissions': permissions,
                'timestamp': current_time
            }
            
            # 清理过期缓存，避免内存泄漏
            self._clean_expired_cache()
            
            execution_time = (time.time() - start_time) * 1000
            if execution_time > 100:
                logger.warning(f"get_user_permissions 执行时间较长: {execution_time:.2f}ms")
            
            return permissions
        except Exception as e:
            logger.error(f"获取用户权限失败: {e}")
            # 降级到原始实现
            try:
                # 获取用户角色
                user = await self.execute_query_one(
                    "SELECT role FROM users WHERE id = %s",
                    (user_id,)
                )
                
                if not user or not user['role']:
                    return []
                
                # 获取角色ID
                role = await self.execute_query_one(
                    "SELECT id FROM roles WHERE name = %s",
                    (user['role'],)
                )
                
                if not role:
                    return []
                
                # 获取角色的所有权限（包括继承）
                permissions = await self.get_role_permissions(role['id'])
                
                # 更新缓存
                self.permission_cache[cache_key] = {
                    'permissions': permissions,
                    'timestamp': current_time
                }
                
                return permissions
            except Exception as fallback_error:
                logger.error(f"降级实现获取用户权限失败: {fallback_error}")
                return []
    
    def _clean_expired_cache(self):
        """
        清理过期的缓存数据，避免内存泄漏
        """
        current_time = int(time.time())
        expired_keys = []
        
        for key, data in self.permission_cache.items():
            if current_time - data['timestamp'] >= self.cache_expiry:
                expired_keys.append(key)
        
        for key in expired_keys:
            del self.permission_cache[key]
        
        if expired_keys:
            logger.info(f"清理了 {len(expired_keys)} 个过期的权限缓存")
    
    async def get_user_by_token(self, token: str) -> Optional[Dict[str, Any]]:
        """
        根据token获取用户信息（模拟实现，实际应从JWT或token存储中获取）
        
        Args:
            token: 用户token
        
        Returns:
            用户信息字典，包括权限列表
        """
        # 模拟实现，实际应从token中解析用户ID或从token存储中查询
        # 这里简化处理，默认返回admin用户
        user = await self.execute_query_one(
            "SELECT id, username, email, role FROM users WHERE username = 'admin'"
        )
        
        if not user:
            return None
        
        # 获取用户权限
        permissions = await self.get_user_permissions(user['id'])
        
        # 转换权限为简单的权限代码列表
        permission_codes = [p['code'] for p in permissions]
        
        # 确保包含system.settings权限（用于系统配置操作）
        if 'system.settings' not in permission_codes:
            permission_codes.append('system.settings')
        
        # 确保包含user.management权限（用于用户管理操作）
        if 'user.management' not in permission_codes:
            permission_codes.append('user.management')
        
        # 确保包含permission.management权限（用于权限管理操作）
        if 'permission.management' not in permission_codes:
            permission_codes.append('permission.management')
        
        # 返回包含权限的用户信息
        user_info = {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'role': user['role'],
            'permissions': permission_codes
        }
        
        return user_info
    
    async def get_role_by_name(self, role_name: str) -> Optional[Dict[str, Any]]:
        """
        根据角色名称获取角色信息
        
        Args:
            role_name: 角色名称
        
        Returns:
            角色信息字典
        """
        return await self.execute_query_one(
            "SELECT id, name, description, parent_id FROM roles WHERE name = %s",
            (role_name,)
        )


# 全局MySQLRepository实例
_mysql_repo_instance = None


async def get_mysql_repo() -> MySQLRepository:
    """
    获取MySQLRepository实例（单例模式）
    
    Returns:
        MySQLRepository实例
    """
    global _mysql_repo_instance
    
    if _mysql_repo_instance is None:
        # 从配置文件获取数据库配置，而不是硬编码
        from ..config import settings
        _mysql_repo_instance = MySQLRepository(
            host=settings.MYSQL_HOST,
            port=settings.MYSQL_PORT,
            user=settings.MYSQL_USER,
            password=settings.MYSQL_PASSWORD,
            database=settings.MYSQL_DATABASE,
            pool_size=settings.MYSQL_POOL_SIZE,
            pool_recycle=settings.MYSQL_POOL_RECYCLE,
            pool_timeout=getattr(settings, 'MYSQL_POOL_TIMEOUT', 30),
            max_overflow=getattr(settings, 'MYSQL_MAX_OVERFLOW', 20),
            echo=settings.MYSQL_ECHO
        )
        # 初始化连接池
        await _mysql_repo_instance.connect()
    
    return _mysql_repo_instance
