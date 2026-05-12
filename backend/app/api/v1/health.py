"""
[参考] 健康检查API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: HealthController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any
import logging
import time

from ...repositories import MySQLRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["健康检查"])


def get_mysql_repo():
    """
    依赖注入：获取MySQL仓库实例
    
    Returns:
        MySQLRepository实例
    """
    from fastapi import Request
    
    def _get_repo(request: Request):
        return request.app.state.mysql
    
    return Depends(_get_repo)


@router.get("", summary="系统健康检查")
async def health_check(
    request: Request,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    系统健康检查
    
    检查系统各组件的状态，包括：
    - 数据库连接
    - 服务状态
    - 系统资源
    """
    start_time = time.time()
    
    try:
        health_status = {
            "status": "healthy",
            "timestamp": time.time(),
            "service": "image-database-system",
            "version": "2.0.0",
            "components": {
                "api": {
                    "status": "healthy",
                    "response_time": 0
                },
                "database": {
                    "status": "unknown",
                    "response_time": 0
                }
            }
        }
        
        # 检查数据库连接
        db_start_time = time.time()
        try:
            # 执行一个简单的查询来测试数据库连接
            await repo.execute_query("SELECT 1")
            health_status["components"]["database"]["status"] = "healthy"
            health_status["components"]["database"]["response_time"] = round((time.time() - db_start_time) * 1000, 2)
        except Exception as e:
            logger.error(f"数据库连接检查失败: {e}")
            health_status["components"]["database"]["status"] = "unhealthy"
            health_status["components"]["database"]["response_time"] = round((time.time() - db_start_time) * 1000, 2)
            health_status["components"]["database"]["error"] = str(e)
            health_status["status"] = "unhealthy"
        
        # 计算API响应时间
        health_status["components"]["api"]["response_time"] = round((time.time() - start_time) * 1000, 2)
        
        # 检查系统资源使用情况
        try:
            import psutil
            process = psutil.Process()
            memory_info = process.memory_info()
            cpu_percent = process.cpu_percent(interval=0.1)
            
            health_status["components"]["system"] = {
                "status": "healthy",
                "memory_usage": {
                    "rss": memory_info.rss // 1024 // 1024,  # MB
                    "vms": memory_info.vms // 1024 // 1024   # MB
                },
                "cpu_percent": cpu_percent
            }
        except ImportError:
            logger.warning("psutil库未安装，跳过系统资源检查")
        except Exception as e:
            logger.error(f"系统资源检查失败: {e}")
        
        # 检查缓存状态
        if hasattr(repo, 'permission_cache'):
            cache_size = len(repo.permission_cache)
            health_status["components"]["cache"] = {
                "status": "healthy",
                "permission_cache_size": cache_size
            }
        
        # 如果任何组件不健康，返回503状态码
        if health_status["status"] == "unhealthy":
            raise HTTPException(status_code=503, detail=health_status)
        
        return health_status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"健康检查失败: {e}")
        raise HTTPException(status_code=500, detail={
            "status": "unhealthy",
            "error": str(e)
        })


@router.get("/detailed", summary="详细健康检查")
async def detailed_health_check(
    request: Request,
    repo: MySQLRepository = get_mysql_repo()
):
    """
    详细健康检查
    
    提供更详细的系统状态信息，包括：
    - 数据库表结构检查
    - 连接池状态
    - 详细的系统资源使用情况
    """
    start_time = time.time()
    
    try:
        detailed_status = await health_check(request, repo)
        
        # 添加详细信息
        detailed_status["detailed"] = True
        
        # 检查数据库表结构
        try:
            tables = await repo.execute_query("SHOW TABLES")
            table_names = [list(table.values())[0] for table in tables]
            
            detailed_status["components"]["database"]["tables"] = {
                "count": len(table_names),
                "names": table_names[:20]  # 只返回前20个表名
            }
        except Exception as e:
            logger.error(f"数据库表检查失败: {e}")
            detailed_status["components"]["database"]["tables"] = {
                "status": "error",
                "error": str(e)
            }
        
        # 检查连接池状态
        if hasattr(repo, 'pool') and repo.pool:
            detailed_status["components"]["database"]["connection_pool"] = {
                "status": "healthy",
                "pool_size": repo.pool_size,
                "max_overflow": getattr(repo, 'max_overflow', 0)
            }
        
        # 计算详细检查的总响应时间
        detailed_status["response_time"] = round((time.time() - start_time) * 1000, 2)
        
        return detailed_status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"详细健康检查失败: {e}")
        raise HTTPException(status_code=500, detail={
            "status": "unhealthy",
            "error": str(e)
        })
