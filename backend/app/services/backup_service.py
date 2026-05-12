"""
数据库备份服务

功能：
- 数据库全量备份
- 本地备份和腾讯云备份
- 备份文件管理
- 备份记录存储
"""

import os
import subprocess
import logging
import shutil
from typing import Optional, Tuple, Dict, Any
from datetime import datetime
import tempfile
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..repositories.mysql_repo import MySQLRepository
from ..services.cos_service import cos_service

logger = logging.getLogger(__name__)


class BackupService:
    """数据库备份服务"""
    
    def __init__(self):
        """初始化备份服务"""
        self.backup_dir = settings.BACKUP_DIR
        self.mysql_host = settings.MYSQL_HOST
        self.mysql_port = settings.MYSQL_PORT
        self.mysql_user = settings.MYSQL_USER
        self.mysql_password = settings.MYSQL_PASSWORD
        self.mysql_db = settings.MYSQL_DATABASE
        
        # 确保备份目录存在
        os.makedirs(self.backup_dir, exist_ok=True)
        logger.info(f"数据库备份服务初始化成功 - 备份目录: {self.backup_dir}")
    
    async def create_backup(
        self, 
        backup_type: str = "local",  # local 或 cos
        mysql_repo: Optional[MySQLRepository] = None
    ) -> Dict[str, Any]:
        """
        创建数据库备份
        
        Args:
            backup_type: 备份类型: local(本地备份) 或 cos(腾讯云备份)
            mysql_repo: MySQL仓库实例
            
        Returns:
            备份结果信息
        """
        logger.info(f"开始创建数据库备份 - 类型: {backup_type}")
        
        try:
            # 检查备份目录是否存在且可写
            if not os.path.exists(self.backup_dir):
                try:
                    os.makedirs(self.backup_dir, exist_ok=True)
                    logger.info(f"备份目录创建成功: {self.backup_dir}")
                except Exception as e:
                    logger.error(f"创建备份目录失败: {e}")
                    return {
                        "success": False,
                        "message": f"创建备份目录失败: {str(e)}"
                    }
            
            # 检查备份目录是否可写
            if not os.access(self.backup_dir, os.W_OK):
                logger.error(f"备份目录不可写: {self.backup_dir}")
                return {
                    "success": False,
                    "message": f"备份目录不可写: {self.backup_dir}"
                }
            
            # 1. 生成备份文件名
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"{settings.MYSQL_DATABASE}_full_{timestamp}.sql.gz"
            backup_filepath = os.path.join(self.backup_dir, backup_filename)
            
            # 2. 执行数据库备份
            success, error_msg = await self._execute_backup(backup_filepath)
            
            if not success:
                logger.error(f"数据库备份失败: {error_msg}")
                return {
                    "success": False,
                    "message": f"数据库备份失败: {error_msg}"
                }
            
            # 3. 获取备份文件信息
            file_size = os.path.getsize(backup_filepath) / (1024 * 1024)  # MB
            
            # 4. 准备备份记录
            backup_record = {
                "name": backup_filename,
                "type": "full",
                "size": round(file_size, 2),
                "status": "success",
                "storage_location": backup_type,
                "created_at": datetime.now()
            }
            
            # 5. 如果是腾讯云备份，上传到COS
            if backup_type == "cos":
                if not cos_service.is_enabled():
                    logger.error("尝试进行腾讯云备份，但COS服务未启用")
                    # 转为本地备份
                    backup_record["storage_location"] = "local"
                else:
                    # 上传到腾讯云COS
                    upload_success, object_key, cos_url = await cos_service.upload_backup_file(backup_filepath, backup_filename)
                    if upload_success:
                        backup_record["cos_object_key"] = object_key
                        backup_record["cos_url"] = cos_url
                        # 可以选择保留或删除本地备份文件
                        if settings.BACKUP_REMOVE_AFTER_COS_UPLOAD:
                            os.remove(backup_filepath)
                            logger.info(f"本地备份文件已删除: {backup_filepath}")
                    else:
                        logger.error(f"腾讯云COS上传失败: {cos_url}")
                        # 转为本地备份
                        backup_record["storage_location"] = "local"
            
            # 6. 保存备份记录到数据库
            if mysql_repo:
                await self._save_backup_record(mysql_repo, backup_record)
            
            logger.info(f"数据库备份成功 - 文件名: {backup_filename}, 大小: {backup_record['size']}MB, 存储位置: {backup_record['storage_location']}")
            return {
                "success": True,
                "message": "数据库备份成功",
                "data": backup_record
            }
            
        except Exception as e:
            logger.error(f"数据库备份过程中发生错误: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"数据库备份失败: {str(e)}"
            }
    
    async def _execute_backup(self, backup_filepath: str) -> Tuple[bool, str]:
        """
        执行数据库备份命令
        
        Args:
            backup_filepath: 备份文件路径
            
        Returns:
            (成功状态, 错误信息)
        """
        try:
            logger.info(f"执行数据库备份命令 - 目标文件: {backup_filepath}")
            
            # 检查mysqldump命令是否可用
            mysqldump_path = shutil.which("mysqldump")
            # 如果找不到，尝试使用常见的MySQL安装路径
            if not mysqldump_path:
                common_paths = [
                    "C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
                    "C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe",
                    "C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysqldump.exe",
                    "C:\\Program Files (x86)\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe",
                    "C:\\Program Files (x86)\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe",
                    "C:\\Program Files (x86)\\MySQL\\MySQL Server 5.7\\bin\\mysqldump.exe",
                    "C:\\xampp\\mysql\\bin\\mysqldump.exe",
                    "C:\\wamp\\bin\\mysql\\mysql8.0\\bin\\mysqldump.exe",
                    "C:\\wamp64\\bin\\mysql\\mysql8.0\\bin\\mysqldump.exe",
                ]
                for path in common_paths:
                    if os.path.exists(path):
                        mysqldump_path = path
                        logger.info(f"找到mysqldump路径: {mysqldump_path}")
                        break

            if not mysqldump_path:
                error_msg = "mysqldump命令不可用，请确保已安装MySQL客户端工具。常见安装路径：C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe"
                logger.error(error_msg)
                return False, error_msg
            
            # 不再依赖外部gzip命令，使用Python内置的gzip模块
            logger.info("使用Python内置gzip模块进行文件压缩")
            
            # 使用 mysqldump 命令进行备份
            mysqldump_cmd = [
                mysqldump_path,
                f"--host={self.mysql_host}",
                f"--port={self.mysql_port}",
                f"--user={self.mysql_user}",
                f"--password={self.mysql_password}",
                "--single-transaction",
                "--quick",
                "--lock-tables=false",
                "--routines",
                "--triggers",
                "--events",
                self.mysql_db,
                "--result-file", backup_filepath.replace('.gz', '')
            ]
            
            # 记录完整命令
            logger.info(f"执行mysqldump命令: {' '.join(mysqldump_cmd)}")
            
            # 执行 mysqldump
            result = subprocess.run(
                mysqldump_cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5分钟超时
            )
            
            if result.returncode != 0:
                error_msg = f"mysqldump 执行失败: {result.stderr}"
                logger.error(error_msg)
                return False, error_msg
            
            # 使用Python内置gzip模块压缩备份文件
            import gzip
            
            sql_file = backup_filepath.replace('.gz', '')
            logger.info(f"使用Python gzip模块压缩文件: {sql_file} -> {backup_filepath}")
            
            try:
                with open(sql_file, 'rb') as f_in:
                    with gzip.open(backup_filepath, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
                
                # 删除原始SQL文件
                os.remove(sql_file)
                logger.info(f"原始SQL文件已删除: {sql_file}")
            except Exception as e:
                error_msg = f"备份文件压缩失败: {str(e)}"
                logger.error(error_msg)
                return False, error_msg
            
            logger.info(f"数据库备份命令执行成功 - 目标文件: {backup_filepath}")
            return True, ""
            
        except subprocess.TimeoutExpired:
            error_msg = "数据库备份命令超时"
            logger.error(error_msg)
            return False, error_msg
        except Exception as e:
            error_msg = f"执行数据库备份命令失败: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg
    
    async def _save_backup_record(
        self, 
        mysql_repo: MySQLRepository, 
        backup_record: Dict[str, Any]
    ) -> bool:
        """
        保存备份记录到数据库
        
        Args:
            mysql_repo: MySQL仓库实例
            backup_record: 备份记录信息
            
        Returns:
            保存结果
        """
        try:
            logger.info(f"保存备份记录到数据库 - 文件名: {backup_record['name']}")
            
            query = """
            INSERT INTO backup_records 
            (name, type, size, status, storage_location, cos_object_key, cos_url, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            
            values = (
                backup_record["name"],
                backup_record["type"],
                backup_record["size"],
                backup_record["status"],
                backup_record["storage_location"],
                backup_record.get("cos_object_key", None),
                backup_record.get("cos_url", None),
                backup_record["created_at"]
            )
            
            await mysql_repo.execute_update(query, values)
            logger.info(f"备份记录保存成功 - 文件名: {backup_record['name']}")
            return True
            
        except Exception as e:
            logger.error(f"保存备份记录失败: {e}", exc_info=True)
            return False
    
    async def get_backup_records(
        self, 
        mysql_repo: MySQLRepository,
        page: int = 1,
        limit: int = 10,
        storage_location: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        获取备份记录
        
        Args:
            mysql_repo: MySQL仓库实例
            page: 页码
            limit: 每页数量
            storage_location: 存储位置过滤
            
        Returns:
            备份记录列表
        """
        try:
            offset = (page - 1) * limit
            
            # 构建查询条件
            where_clause = []
            params = []
            
            if storage_location:
                where_clause.append("storage_location = %s")
                params.append(storage_location)
            
            # 构建查询
            base_query = """
            SELECT id, name, type, size, status, storage_location, cos_object_key, cos_url, created_at
            FROM backup_records
            """
            
            if where_clause:
                base_query += " WHERE " + " AND ".join(where_clause)
            
            # 排序
            base_query += " ORDER BY created_at DESC"
            
            # 分页
            query = base_query + " LIMIT %s OFFSET %s"
            params.extend([limit, offset])
            
            # 执行查询
            records = await mysql_repo.execute_query(query, params)
            
            # 获取总数量
            count_query = "SELECT COUNT(*) as total FROM backup_records"
            if where_clause:
                count_query += " WHERE " + " AND ".join(where_clause)
            
            count_result = await mysql_repo.execute_query(count_query, params[:-2])
            total = count_result[0]["total"] if count_result else 0
            
            # 格式化记录
            formatted_records = []
            for record in records:
                formatted_records.append({
                    "id": record["id"],
                    "name": record["name"],
                    "type": record["type"],
                    "size": record["size"],
                    "status": record["status"],
                    "storageLocation": record["storage_location"],
                    "cosObjectKey": record["cos_object_key"],
                    "cosUrl": record["cos_url"],
                    "createdAt": record["created_at"]
                })
            
            return {
                "success": True,
                "data": {
                    "records": formatted_records,
                    "total": total,
                    "page": page,
                    "limit": limit
                }
            }
            
        except Exception as e:
            logger.error(f"获取备份记录失败: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"获取备份记录失败: {str(e)}"
            }
    
    async def delete_backup(
        self, 
        backup_id: int,
        mysql_repo: MySQLRepository
    ) -> Dict[str, Any]:
        """
        删除备份记录和文件
        
        Args:
            backup_id: 备份记录ID
            mysql_repo: MySQL仓库实例
            
        Returns:
            删除结果
        """
        try:
            # 1. 获取备份记录
            query = """
            SELECT name, storage_location, cos_object_key
            FROM backup_records
            WHERE id = %s
            """
            records = await mysql_repo.execute_query(query, (backup_id,))
            
            if not records:
                return {
                    "success": False,
                    "message": "备份记录不存在"
                }
            
            backup_record = records[0]
            
            # 2. 根据存储位置删除备份文件
            if backup_record["storage_location"] == "cos" and backup_record["cos_object_key"]:
                # 从COS删除
                success, error_msg = await cos_service.delete_backup_file(backup_record["cos_object_key"])
                if not success:
                    logger.warning(f"从COS删除备份文件失败: {error_msg}")
            elif backup_record["storage_location"] == "local":
                # 从本地删除
                local_filepath = os.path.join(self.backup_dir, backup_record["name"])
                if os.path.exists(local_filepath):
                    os.remove(local_filepath)
                    logger.info(f"本地备份文件已删除: {local_filepath}")
            
            # 3. 删除数据库记录
            delete_query = "DELETE FROM backup_records WHERE id = %s"
            await mysql_repo.execute_update(delete_query, (backup_id,))
            
            logger.info(f"备份记录删除成功 - ID: {backup_id}, 文件名: {backup_record['name']}")
            return {
                "success": True,
                "message": "备份记录删除成功"
            }
            
        except Exception as e:
            logger.error(f"删除备份记录失败: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"删除备份记录失败: {str(e)}"
            }
    
    async def get_backup_url(
        self, 
        backup_id: int,
        mysql_repo: MySQLRepository
    ) -> Dict[str, Any]:
        """
        获取备份文件访问URL
        
        Args:
            backup_id: 备份记录ID
            mysql_repo: MySQL仓库实例
            
        Returns:
            备份文件URL
        """
        try:
            # 获取备份记录
            query = """
            SELECT storage_location, cos_object_key, name
            FROM backup_records
            WHERE id = %s
            """
            records = await mysql_repo.execute_query(query, (backup_id,))
            
            if not records:
                return {
                    "success": False,
                    "message": "备份记录不存在"
                }
            
            backup_record = records[0]
            
            # 根据存储位置返回URL
            if backup_record["storage_location"] == "cos" and backup_record["cos_object_key"]:
                # 从COS获取URL
                url = await cos_service.get_backup_url(backup_record["cos_object_key"])
                if url:
                    return {
                        "success": True,
                        "data": {
                            "url": url
                        }
                    }
                else:
                    return {
                        "success": False,
                        "message": "获取COS备份URL失败"
                    }
            elif backup_record["storage_location"] == "local":
                # 本地备份返回错误，因为无法直接提供URL
                return {
                    "success": False,
                    "message": "本地备份文件不支持直接下载URL"
                }
            else:
                return {
                    "success": False,
                    "message": "未知的存储位置"
                }
                
        except Exception as e:
            logger.error(f"获取备份URL失败: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"获取备份URL失败: {str(e)}"
            }
    
    async def get_expired_backups(
        self, 
        mysql_repo: MySQLRepository
    ) -> Dict[str, Any]:
        """
        获取过期的备份记录（超过3天）
        
        Args:
            mysql_repo: MySQL仓库实例
            
        Returns:
            过期备份记录列表
        """
        try:
            # 构建查询，获取超过3天的备份记录
            query = """
            SELECT id, name, type, size, status, storage_location, cos_object_key, cos_url, created_at
            FROM backup_records
            WHERE created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
            ORDER BY created_at DESC
            """
            
            # 执行查询
            records = await mysql_repo.execute_query(query)
            
            # 格式化记录
            formatted_records = []
            for record in records:
                formatted_records.append({
                    "id": record["id"],
                    "name": record["name"],
                    "type": record["type"],
                    "size": record["size"],
                    "status": record["status"],
                    "storageLocation": record["storage_location"],
                    "cosObjectKey": record["cos_object_key"],
                    "cosUrl": record["cos_url"],
                    "createdAt": record["created_at"]
                })
            
            return {
                "success": True,
                "data": {
                    "records": formatted_records,
                    "total": len(formatted_records),
                    "page": 1,
                    "limit": len(formatted_records)
                }
            }
            
        except Exception as e:
            logger.error(f"获取过期备份记录失败: {e}", exc_info=True)
            return {
                "success": False,
                "message": f"获取过期备份记录失败: {str(e)}"
            }


# 全局备份服务实例
backup_service = BackupService()
