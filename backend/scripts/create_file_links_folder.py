"""
在腾讯云COS中创建文件链接存储文件夹

功能：
- 在COS中创建文件链接存储文件夹
- 创建不同的子文件夹用于分类管理
- 验证文件夹创建是否成功
"""

import os
import sys
import logging
from datetime import datetime

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.cos_service import COSService
from app.config import settings

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_cos_folders():
    """在COS中创建文件夹结构"""
    
    # 初始化COS服务
    cos_service = COSService()
    
    if not cos_service.is_enabled():
        logger.error("腾讯云COS服务未启用，无法创建文件夹")
        return False
    
    # 定义要创建的文件夹结构
    folders = [
        "file-links/",  # 文件链接根目录
        "file-links/prompt-library/",  # 提示词库文件
        "file-links/resource-library/",  # 资料库文件
        "file-links/feishu-xlsx/",  # 飞书XLSX文件
        "file-links/standard-url/",  # 标准链接文件
        "file-links/temp/",  # 临时文件
        "file-links/backup/",  # 备份文件
    ]
    
    success_count = 0
    total_count = len(folders)
    
    logger.info(f"开始创建COS文件夹结构，共{total_count}个文件夹")
    
    for folder_path in folders:
        try:
            # 在COS中创建文件夹（实际上是创建一个空对象，以/结尾）
            response = cos_service.client.put_object(
                Bucket=cos_service.bucket,
                Body=b'',  # 空内容
                Key=folder_path,
                ContentType='application/x-directory'
            )
            
            logger.info(f"[OK] 成功创建文件夹: {folder_path}")
            success_count += 1
            
        except Exception as e:
            logger.error(f"[FAIL] 创建文件夹失败 {folder_path}: {e}")
    
    logger.info(f"文件夹创建完成 - 成功: {success_count}/{total_count}")
    
    # 验证文件夹是否创建成功
    if success_count > 0:
        logger.info("开始验证文件夹创建结果...")
        try:
            # 列出根目录下的对象
            response = cos_service.client.list_objects(
                Bucket=cos_service.bucket,
                Prefix="file-links/"
            )
            
            if 'Contents' in response:
                created_folders = [obj['Key'] for obj in response['Contents'] if obj['Key'].endswith('/')]
                logger.info(f"[OK] 验证成功，已创建的文件夹: {created_folders}")
            else:
                logger.warning("[WARN] 未找到创建的文件夹，可能权限问题")
                
        except Exception as e:
            logger.error(f"[FAIL] 验证文件夹创建结果失败: {e}")
    
    return success_count == total_count


def check_cos_connection():
    """检查COS连接状态"""
    
    cos_service = COSService()
    
    if not cos_service.is_enabled():
        logger.error("腾讯云COS服务未启用")
        return False
    
    try:
        # 尝试列出存储桶内容
        response = cos_service.client.list_objects(
            Bucket=cos_service.bucket,
            MaxKeys=1
        )
        
        logger.info("[OK] COS连接测试成功")
        return True
        
    except Exception as e:
        logger.error(f"[FAIL] COS连接测试失败: {e}")
        return False


def main():
    """主函数"""
    
    logger.info("=== 腾讯云COS文件链接文件夹创建脚本 ===")
    
    # 检查COS连接
    logger.info("1. 检查COS连接状态...")
    if not check_cos_connection():
        logger.error("COS连接失败，请检查配置")
        return False
    
    # 创建文件夹
    logger.info("2. 开始创建文件夹结构...")
    success = create_cos_folders()
    
    if success:
        logger.info("[DONE] 所有文件夹创建成功！")
    else:
        logger.warning("[WARN]  部分文件夹创建失败，请检查日志")
    
    return success


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        logger.info("脚本被用户中断")
        sys.exit(1)
    except Exception as e:
        logger.error(f"脚本执行异常: {e}")
        sys.exit(1)