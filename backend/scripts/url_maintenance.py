#!/usr/bin/env python3
"""
URL格式定期维护脚本

功能：
- 定期检查和修复URL格式问题
- 生成详细的维护报告
- 支持配置执行计划
- 实现自动修复机制

使用：
python url_maintenance.py              # 执行一次维护
python url_maintenance.py --schedule   # 配置定时执行
"""

import asyncio
import logging
import sys
import os
import argparse
import json
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))

from backend.app.repositories.mysql_repo import MySQLRepository
from backend.app.repositories.redis_repo import RedisRepository
from backend.app.services.image_service import ImageService
from backend.app.config import settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

class URLMaintenance:
    """
    URL格式维护类
    
    功能：
    - 检查URL格式问题
    - 自动修复URL格式
    - 生成维护报告
    - 支持定期执行
    """
    
    def __init__(self):
        """初始化维护类"""
        self.mysql_repo = None
        self.redis_repo = None
        self.image_service = None
        self.report = {
            'timestamp': datetime.now().isoformat(),
            'environment': settings.ENVIRONMENT,
            'database': settings.MYSQL_DATABASE,
            'checks': [],
            'fixes': [],
            'errors': [],
            'summary': {
                'total_checked': 0,
                'total_fixed': 0,
                'total_errors': 0,
                'duration': 0
            }
        }
    
    async def initialize(self):
        """初始化数据库连接"""
        try:
            # 初始化数据库连接
            self.mysql_repo = MySQLRepository(
                host=settings.MYSQL_HOST,
                port=settings.MYSQL_PORT,
                user=settings.MYSQL_USER,
                password=settings.MYSQL_PASSWORD,
                database=settings.MYSQL_DATABASE
            )
            await self.mysql_repo.connect()
            logger.info("[OK] MySQL连接成功")
            
            # 初始化Redis连接
            self.redis_repo = RedisRepository()
            try:
                await self.redis_repo.connect()
                logger.info("[OK] Redis连接成功")
            except Exception as e:
                logger.warning(f"[WARN] Redis连接失败: {e}（将不使用缓存功能）")
                self.redis_repo = None
            
            # 初始化图片服务
            self.image_service = ImageService(self.mysql_repo, self.redis_repo, None)
            logger.info("[OK] 服务初始化完成")
            
        except Exception as e:
            logger.error(f"[FAIL] 初始化失败: {e}")
            raise
    
    async def cleanup(self):
        """清理资源"""
        try:
            if self.mysql_repo:
                await self.mysql_repo.disconnect()
                logger.info("[OK] MySQL连接已关闭")
            if self.redis_repo:
                await self.redis_repo.disconnect()
                logger.info("[OK] Redis连接已关闭")
        except Exception as e:
            logger.warning(f"[WARN] 清理资源失败: {e}")
    
    async def check_url_formats(self):
        """
        检查URL格式问题
        
        Returns:
            list: 有问题的图片列表
        """
        try:
            logger.info("[SEARCH] 开始URL格式检查")
            
            # 检查包含无效参数的URL
            problematic_patterns = [
                'q-url-param-list=\u0026q-signature=',
                'q-url-param-list=\u0026',
                '\u0026q-url-param-list=\u0026',
                'q-url-param-list='
            ]
            
            # 构建查询语句
            query_parts = []
            for pattern in problematic_patterns:
                query_parts.append(f"(filepath LIKE '%{pattern}%' OR cos_url LIKE '%{pattern}%')")
            
            where_clause = ' OR '.join(query_parts)
            query = f"SELECT id, filename, filepath, cos_url, category FROM images WHERE {where_clause}"
            
            # 执行查询
            problematic_images = await self.mysql_repo.execute_query(query)
            
            logger.info(f"发现 {len(problematic_images)} 个URL格式问题")
            
            # 记录检查结果
            self.report['checks'] = problematic_images
            self.report['summary']['total_checked'] = len(problematic_images)
            
            return problematic_images
            
        except Exception as e:
            logger.error(f"[FAIL] URL格式检查失败: {e}")
            self.report['errors'].append(str(e))
            self.report['summary']['total_errors'] += 1
            return []
    
    async def fix_urls(self, problematic_images):
        """
        修复URL格式问题
        
        Args:
            problematic_images: 有问题的图片列表
        """
        try:
            if not problematic_images:
                logger.info("[OK] 没有需要修复的URL")
                return
            
            logger.info(f"[FIX] 开始修复 {len(problematic_images)} 个URL格式问题")
            
            # 提取图片ID
            image_ids = [img['id'] for img in problematic_images]
            
            # 批量刷新图片URL
            result = await self.image_service.refresh_image_urls(
                image_ids=image_ids,
                category="final",  # 默认为final分类
                limit=1000
            )
            
            # 记录修复结果
            self.report['fixes'] = result.get('details', [])
            self.report['summary']['total_fixed'] = result.get('fixed', 0)
            
            logger.info(f"修复完成: 成功 {result.get('fixed', 0)}, 失败 {result.get('failed', 0)}")
            
        except Exception as e:
            logger.error(f"[FAIL] 修复URL失败: {e}")
            self.report['errors'].append(str(e))
            self.report['summary']['total_errors'] += 1
    
    def generate_report(self, output_file=None):
        """
        生成维护报告
        
        Args:
            output_file: 报告输出文件路径
        """
        try:
            # 生成报告文件路径
            if not output_file:
                report_dir = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    'reports'
                )
                os.makedirs(report_dir, exist_ok=True)
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                output_file = os.path.join(
                    report_dir,
                    f"url_maintenance_{timestamp}.json"
                )
            
            # 写入报告
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(self.report, f, ensure_ascii=False, indent=2)
            
            logger.info(f"[DOC] 报告生成成功: {output_file}")
            
            # 输出报告摘要
            logger.info("\n=== 维护报告摘要 ===")
            logger.info(f"环境: {self.report['environment']}")
            logger.info(f"数据库: {self.report['database']}")
            logger.info(f"检查时间: {self.report['timestamp']}")
            logger.info(f"检查数量: {self.report['summary']['total_checked']}")
            logger.info(f"修复数量: {self.report['summary']['total_fixed']}")
            logger.info(f"错误数量: {self.report['summary']['total_errors']}")
            logger.info("===================")
            
        except Exception as e:
            logger.error(f"[FAIL] 生成报告失败: {e}")
    
    async def run_maintenance(self):
        """
        执行完整的维护流程
        """
        start_time = datetime.now()
        
        try:
            logger.info("[START] 开始URL格式维护")
            logger.info(f"环境: {settings.ENVIRONMENT}, 数据库: {settings.MYSQL_DATABASE}")
            
            # 初始化
            await self.initialize()
            
            # 检查URL格式
            problematic_images = await self.check_url_formats()
            
            # 修复URL格式
            await self.fix_urls(problematic_images)
            
            # 生成报告
            self.report['summary']['duration'] = (datetime.now() - start_time).total_seconds()
            self.generate_report()
            
            logger.info("[DONE] URL格式维护完成")
            
        except Exception as e:
            logger.error(f"[FAIL] 维护失败: {e}")
            raise
        finally:
            # 清理资源
            await self.cleanup()
    
    def configure_schedule(self):
        """
        配置定时执行计划
        
        功能：
        - 创建定时任务配置
        - 输出执行建议
        """
        try:
            logger.info("⏰ 配置URL维护定时执行计划")
            
            # 根据不同操作系统输出不同的定时任务配置
            if sys.platform == 'win32':
                logger.info("Windows系统定时任务配置:")
                logger.info("1. 打开 '任务计划程序'")
                logger.info("2. 创建基本任务")
                logger.info("3. 名称: URL格式维护")
                logger.info("4. 触发器: 每天")
                logger.info("5. 操作: 启动程序")
                logger.info("6. 程序或脚本: python.exe")
                logger.info("7. 添加参数: backend/scripts/url_maintenance.py")
                logger.info("8. 起始于: 项目根目录")
            else:
                logger.info("Linux/Mac系统定时任务配置:")
                logger.info("1. 运行: crontab -e")
                logger.info("2. 添加以下行（每天凌晨2点执行）:")
                logger.info("   0 2 * * * cd /path/to/project && python backend/scripts/url_maintenance.py")
                logger.info("3. 保存并退出")
            
            logger.info("[OK] 定时执行计划配置完成")
            
        except Exception as e:
            logger.error(f"[FAIL] 配置定时计划失败: {e}")

async def main():
    """主函数"""
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='URL格式定期维护脚本')
    parser.add_argument('--schedule', action='store_true', help='配置定时执行计划')
    
    args = parser.parse_args()
    
    if args.schedule:
        # 配置定时执行计划
        maintenance = URLMaintenance()
        maintenance.configure_schedule()
    else:
        # 执行一次维护
        maintenance = URLMaintenance()
        await maintenance.run_maintenance()

if __name__ == "__main__":
    try:
        asyncio.run(main())
        logger.info("URL维护脚本执行完成")
    except KeyboardInterrupt:
        logger.info("脚本被用户中断")
        sys.exit(0)
    except Exception as e:
        logger.error(f"脚本执行失败: {e}")
        sys.exit(1)
