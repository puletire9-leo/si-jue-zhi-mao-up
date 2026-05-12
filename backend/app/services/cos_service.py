"""
腾讯云COS存储服务

功能：
- 图片上传到腾讯云COS
- 图片下载和访问
- 缩略图生成和存储
- 文件删除和清理
- 存储空间管理
"""

import os
import io
import logging
from typing import Optional, Tuple, Dict, Any
from datetime import datetime, timedelta
from PIL import Image
import hashlib

# 条件导入 qcloud_cos 模块
try:
    from qcloud_cos import CosConfig, CosS3Client
    from qcloud_cos.cos_exception import CosServiceError, CosClientError
    HAS_QCLOUD_COS = True
except ImportError:
    HAS_QCLOUD_COS = False
    CosConfig = None
    CosS3Client = None
    CosServiceError = None
    CosClientError = None

from ..config import settings

logger = logging.getLogger(__name__)


class COSService:
    """腾讯云COS存储服务"""
    
    def __init__(self):
        """初始化COS客户端"""
        self.enabled = settings.COS_ENABLED
        
        logger.info(f"初始化COS服务 - 启用状态: {self.enabled}")
        
        # 检查 qcloud_cos 模块是否可用
        if not HAS_QCLOUD_COS:
            logger.warning("qcloud_cos 模块未安装，腾讯云COS存储功能不可用")
            self.enabled = False
            return
            
        if not self.enabled:
            logger.warning("腾讯云COS存储未启用")
            return
            
        try:
            logger.debug(f"COS配置详情: Region={settings.COS_REGION}, Bucket={settings.COS_BUCKET}, Scheme={settings.COS_SCHEME}, Timeout={settings.COS_TIMEOUT}")
            
            # 确保使用正确的区域配置
            region = settings.COS_REGION
            if not region:
                region = os.getenv('COS_REGION', 'ap-guangzhou')
            
            logger.info(f"使用的COS区域: {region}, 存储桶: {settings.COS_BUCKET}")
            
            config = CosConfig(
                Region=region,
                SecretId=settings.COS_SECRET_ID,
                SecretKey=settings.COS_SECRET_KEY,
                Scheme=settings.COS_SCHEME,
                Timeout=settings.COS_TIMEOUT
            )
            # 创建客户端
            self.client = CosS3Client(config)
            # 设置重试次数
            self.client._max_retries = settings.COS_MAX_RETRIES
            self.bucket = settings.COS_BUCKET
            self.region = settings.COS_REGION
            self.prefix = settings.COS_PREFIX
            self.thumbnail_prefix = settings.COS_THUMBNAIL_PREFIX
            logger.info(f"腾讯云COS客户端初始化成功 - 存储桶: {self.bucket}, 区域: {self.region}, 实例ID: {id(self)}")
        except Exception as e:
            logger.error(f"腾讯云COS客户端初始化失败: {e}", exc_info=True)
            self.enabled = False
    
    def is_enabled(self) -> bool:
        """检查COS服务是否可用"""
        return self.enabled
    
    def get_full_url(self, object_key: str) -> str:
        """
        根据对象键构建完整的COS URL
        
        Args:
            object_key: 对象键
            
        Returns:
            完整的COS URL
        """
        if not self.enabled:
            logger.warning(f"尝试构建COS URL，但COS存储未启用 - 对象键: {object_key}")
            return ""
        
        try:
            # 构建腾讯云COS的完整URL
            # 格式: {scheme}://{bucket}.cos.{region}.myqcloud.com/{object_key}
            url = f"{settings.COS_SCHEME}://{settings.COS_BUCKET}.cos.{settings.COS_REGION}.myqcloud.com/{object_key}"
            logger.info(f"成功构建COS URL: {url}")
            return url
        except Exception as e:
            logger.error(f"构建COS URL失败 - 对象键: {object_key}, 错误: {str(e)}")
            return ""
    
    def generate_object_key(self, filename: str, is_thumbnail: bool = False, image_type: str = "product") -> str:
        """
        生成COS对象键
        
        Args:
            filename: 文件名
            is_thumbnail: 是否为缩略图
            image_type: 图片类型: "product"(产品图), "selection"(选品图), "final"(定稿图), "material"(素材库)
            
        Returns:
            对象键路径
        """
        # 生成唯一文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        name, ext = os.path.splitext(filename)
        unique_name = f"{timestamp}_{hashlib.md5(name.encode()).hexdigest()[:8]}{ext}"
        
        # 根据图片类型和是否为缩略图选择前缀
        if image_type == "selection":
            # 选品图：缩略图使用选品略缩图文件夹，原图使用理实产品图文件夹
            prefix = self.thumbnail_prefix if is_thumbnail else self.prefix
        elif image_type == "final":
            # 定稿图：使用定稿图片文件夹，来自配置项
            prefix = settings.COS_FINAL_DRAFT_PREFIX
        elif image_type == "material":
            # 素材库图片：使用素材库独立文件夹
            prefix = settings.COS_MATERIAL_PREFIX
        elif image_type == "carrier":
            # 载体库图片：使用载体库独立文件夹
            prefix = settings.COS_CARRIER_PREFIX
        elif image_type == "lingxing":
            # 领星导入图片：使用领星专用文件夹
            prefix = settings.LINGXING_COS_PREFIX
        else:
            # 默认产品图：使用理实产品图文件夹
            prefix = self.prefix
        
        return f"{prefix}{unique_name}"
    
    def generate_backup_object_key(self, filename: str) -> str:
        """
        生成备份文件的COS对象键
        
        Args:
            filename: 备份文件名
            
        Returns:
            对象键路径
        """
        # 生成唯一文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        name, ext = os.path.splitext(filename)
        unique_name = f"{timestamp}_{hashlib.md5(name.encode()).hexdigest()[:8]}{ext}"
        
        # 使用备份文件夹前缀，来自配置项
        prefix = settings.COS_BACKUP_PREFIX if hasattr(settings, 'COS_BACKUP_PREFIX') else 'backups/'
        
        return f"{prefix}{unique_name}"
    
    def generate_original_zip_object_key(self, filename: str) -> str:
        """
        生成原始图片zip包的COS对象键
        
        Args:
            filename: 原始文件名
            
        Returns:
            对象键路径
        """
        # 生成唯一文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        name, ext = os.path.splitext(filename)
        unique_name = f"{timestamp}_{hashlib.md5(name.encode()).hexdigest()[:8]}.zip"
        
        # 使用原始图片zip包文件夹前缀
        prefix = 'original_zips/'
        
        return f"{prefix}{unique_name}"
    
    async def upload_original_zip(
        self, 
        zip_data: bytes, 
        filename: str
    ) -> Tuple[bool, str, str]:
        """
        上传原始图片zip包到COS
        
        Args:
            zip_data: zip包数据
            filename: 文件名
            
        Returns:
            (成功状态, 对象键, 访问URL)
        """
        if not self.enabled:
            logger.warning("尝试上传原始图片zip包，但COS存储未启用")
            return False, "", "腾讯云COS存储未启用"
        
        try:
            logger.info(f"开始上传原始图片zip包 - 文件名: {filename}, 大小: {len(zip_data)} bytes")
            
            object_key = self.generate_original_zip_object_key(filename)
            logger.debug(f"生成原始图片zip包对象键: {object_key}")
            
            # 上传zip包
            logger.debug(f"调用COS PUT_OBJECT API - 存储桶: {self.bucket}, 对象键: {object_key}")
            response = self.client.put_object(
                Bucket=self.bucket,
                Body=zip_data,
                Key=object_key
                # 多可用区存储桶不需要指定StorageClass
            )
            
            logger.debug(f"原始图片zip包上传响应: {response}")
            
            # 生成带签名的访问URL（使用腾讯云允许的最大过期时间：7天）
            url = await self.get_image_url(object_key, expires=604800)
            
            logger.info(f"原始图片zip包上传成功: {object_key}, URL: {url}")
            return True, object_key, url
            
        except CosServiceError as e:
            error_msg = f"腾讯云COS服务错误: {e.get_error_code()} - {e.get_error_msg()}"
            logger.error(f"原始图片zip包上传失败 - COS服务错误: {error_msg}, 文件名: {filename}, 对象键: {object_key if 'object_key' in locals() else '未生成'}", exc_info=True)
            return False, "", error_msg
        except CosClientError as e:
            error_msg = f"腾讯云COS客户端错误: {str(e)}"
            logger.error(f"原始图片zip包上传失败 - COS客户端错误: {error_msg}, 文件名: {filename}", exc_info=True)
            return False, "", error_msg
        except Exception as e:
            error_msg = f"上传原始图片zip包失败: {str(e)}"
            logger.error(f"原始图片zip包上传失败 - 未知错误: {error_msg}, 文件名: {filename}", exc_info=True)
            return False, "", error_msg
    
    async def upload_image(
        self, 
        image_data: bytes, 
        filename: str,
        metadata: Optional[Dict[str, Any]] = None,
        image_type: str = "product"
    ) -> Tuple[bool, str, str]:
        """
        上传图片到COS
        
        Args:
            image_data: 图片数据
            filename: 文件名
            metadata: 元数据
            image_type: 图片类型: "product"(产品图), "selection"(选品图), "final"(定稿图), "lingxing"(领星导入)
            
        Returns:
            (成功状态, 对象键, 错误信息)
        """
        if not self.enabled:
            logger.warning("尝试上传图片，但COS存储未启用")
            return False, "", "腾讯云COS存储未启用"
        
        try:
            logger.info(f"开始上传图片 - 文件名: {filename}, 类型: {image_type}, 大小: {len(image_data)} bytes")
            
            # 根据图片类型选择存储桶和区域
            if image_type == "lingxing":
                # 领星导入使用专用存储桶
                bucket = settings.LINGXING_COS_BUCKET
                region = settings.LINGXING_COS_REGION
                # 构建领星COS的访问URL
                object_key = self.generate_object_key(filename, image_type=image_type)
                url = f"{settings.COS_SCHEME}://{bucket}.cos.{region}.myqcloud.com/{object_key}"
            else:
                # 其他类型使用默认存储桶
                bucket = self.bucket
                region = self.region
                object_key = self.generate_object_key(filename, image_type=image_type)
                url = await self.get_image_url(object_key, expires=604800)
            
            logger.debug(f"生成对象键: {object_key}, 存储桶: {bucket}, 区域: {region}")
            
            # 上传图片
            logger.debug(f"调用COS PUT_OBJECT API - 存储桶: {bucket}, 对象键: {object_key}")
            response = self.client.put_object(
                Bucket=bucket,
                Body=image_data,
                Key=object_key,
                # 多可用区存储桶不需要指定StorageClass
                **metadata if metadata else {}
            )
            
            logger.debug(f"上传响应: {response}")
            
            logger.info(f"图片上传成功: {object_key}, URL: {url}")
            return True, object_key, url
            
        except CosServiceError as e:
            error_msg = f"腾讯云COS服务错误: {e.get_error_code()} - {e.get_error_msg()}"
            logger.error(f"图片上传失败 - COS服务错误: {error_msg}, 文件名: {filename}, 对象键: {object_key if 'object_key' in locals() else '未生成'}", exc_info=True)
            return False, "", error_msg
        except CosClientError as e:
            error_msg = f"腾讯云COS客户端错误: {str(e)}"
            logger.error(f"图片上传失败 - COS客户端错误: {error_msg}, 文件名: {filename}", exc_info=True)
            return False, "", error_msg
        except Exception as e:
            error_msg = f"上传图片失败: {str(e)}"
            logger.error(f"图片上传失败 - 未知错误: {error_msg}, 文件名: {filename}", exc_info=True)
            return False, "", error_msg
    
    async def upload_thumbnail(
        self, 
        thumbnail_data: bytes, 
        original_filename: str,
        image_type: str = "product"
    ) -> Tuple[bool, str, str]:
        """
        上传缩略图到COS
        
        Args:
            thumbnail_data: 缩略图数据
            original_filename: 原文件名
            image_type: 图片类型: "product"(产品图), "selection"(选品图), "final"(定稿图)
            
        Returns:
            (成功状态, 对象键, 错误信息)
        """
        if not self.enabled:
            logger.warning("尝试上传缩略图，但COS存储未启用")
            return False, "", "腾讯云COS存储未启用"
        
        try:
            logger.info(f"开始上传缩略图 - 原文件名: {original_filename}, 类型: {image_type}, 大小: {len(thumbnail_data)} bytes")
            
            object_key = self.generate_object_key(original_filename, is_thumbnail=True, image_type=image_type)
            logger.debug(f"生成缩略图对象键: {object_key}")
            
            # 上传缩略图
            logger.debug(f"调用COS PUT_OBJECT API - 存储桶: {self.bucket}, 对象键: {object_key}")
            response = self.client.put_object(
                Bucket=self.bucket,
                Body=thumbnail_data,
                Key=object_key
                # 多可用区存储桶不需要指定StorageClass
            )
            
            logger.debug(f"缩略图上传响应: {response}")
            
            # 生成带签名的访问URL（使用腾讯云允许的最大过期时间：7天）
            url = await self.get_image_url(object_key, expires=604800)
            
            logger.info(f"缩略图上传成功: {object_key}, URL: {url}")
            return True, object_key, url
            
        except CosServiceError as e:
            error_msg = f"腾讯云COS服务错误: {e.get_error_code()} - {e.get_error_msg()}"
            logger.error(f"缩略图上传失败 - COS服务错误: {error_msg}, 原文件名: {original_filename}, 对象键: {object_key}", exc_info=True)
            return False, "", error_msg
        except CosClientError as e:
            error_msg = f"腾讯云COS客户端错误: {str(e)}"
            logger.error(f"缩略图上传失败 - COS客户端错误: {error_msg}, 原文件名: {original_filename}", exc_info=True)
            return False, "", error_msg
        except Exception as e:
            error_msg = f"上传缩略图失败: {str(e)}"
            logger.error(f"缩略图上传失败 - 未知错误: {error_msg}, 原文件名: {original_filename}", exc_info=True)
            return False, "", error_msg
    
    async def delete_image(self, object_key: str) -> Tuple[bool, str]:
        """
        从COS删除图片
        
        Args:
            object_key: 对象键
            
        Returns:
            (成功状态, 错误信息)
        """
        if not self.enabled:
            logger.warning(f"尝试删除图片，但COS存储未启用 - 对象键: {object_key}")
            return False, "腾讯云COS存储未启用"
        
        try:
            logger.info(f"开始删除图片 - 对象键: {object_key}")
            logger.debug(f"调用COS DELETE_OBJECT API - 存储桶: {self.bucket}, 对象键: {object_key}")
            
            response = self.client.delete_object(
                Bucket=self.bucket,
                Key=object_key
            )
            
            logger.debug(f"删除响应: {response}")
            logger.info(f"图片删除成功: {object_key}")
            return True, ""
            
        except CosServiceError as e:
            error_msg = f"腾讯云COS服务错误: {e.get_error_code()} - {e.get_error_msg()}"
            logger.error(f"图片删除失败 - COS服务错误: {error_msg}, 对象键: {object_key}", exc_info=True)
            return False, error_msg
        except CosClientError as e:
            error_msg = f"腾讯云COS客户端错误: {str(e)}"
            logger.error(f"图片删除失败 - COS客户端错误: {error_msg}, 对象键: {object_key}", exc_info=True)
            return False, error_msg
        except Exception as e:
            error_msg = f"删除图片失败: {str(e)}"
            logger.error(f"图片删除失败 - 未知错误: {error_msg}, 对象键: {object_key}", exc_info=True)
            return False, error_msg
    
    async def delete_thumbnail(self, object_key: str) -> Tuple[bool, str]:
        """
        从COS删除缩略图
        
        Args:
            object_key: 对象键
            
        Returns:
            (成功状态, 错误信息)
        """
        logger.info(f"开始删除缩略图 - 对象键: {object_key}")
        return await self.delete_image(object_key)
    
    def _fix_url_format(self, url: str) -> str:
        """
        修复URL格式问题
        
        处理以下问题：
        - 空的q-url-param-list参数
        - 重复的&符号
        - 末尾的&符号
        - 其他URL格式问题
        
        Args:
            url: 原始URL
            
        Returns:
            修复后的URL
        """
        if not url:
            return url
        
        # 修复空的q-url-param-list参数
        if "q-url-param-list=&q-signature=" in url:
            logger.debug(f"修复URL格式：移除空的q-url-param-list参数")
            url = url.replace("q-url-param-list=&q-signature=", "q-signature=")
        
        # 修复其他空参数格式
        if "&q-url-param-list=&" in url:
            logger.debug(f"修复URL格式：移除空的q-url-param-list参数（格式2）")
            url = url.replace("&q-url-param-list=&", "&")
        
        if "q-url-param-list=&" in url:
            logger.debug(f"修复URL格式：移除空的q-url-param-list参数（格式3）")
            url = url.replace("q-url-param-list=", "")
        
        if "&q-url-param-list=" in url:
            logger.debug(f"修复URL格式：移除空的q-url-param-list参数（格式4）")
            url = url.replace("&q-url-param-list=", "")
        
        # 修复重复的&符号
        while "&&" in url:
            logger.debug(f"修复URL格式：移除重复的&符号")
            url = url.replace("&&", "&")
        
        # 修复末尾的&符号
        if url.endswith("&"):
            logger.debug(f"修复URL格式：移除末尾的&符号")
            url = url.rstrip("&")
        
        # 修复URL参数部分的其他问题
        if "?" in url:
            base, params = url.split("?", 1)
            if params and not params.endswith("="):
                # 确保参数格式正确
                pass
        
        return url
    
    async def get_image_url(self, object_key: str, expires: int = 604800, use_signature: bool = False) -> str:
        """
        获取图片访问URL
        
        Args:
            object_key: 对象键
            expires: 过期时间(秒)，默认7天（仅在use_signature=True时有效）
            use_signature: 是否使用签名URL，默认为False（使用公共访问URL）
            
        Returns:
            图片访问URL（带签名或无签名）
        """
        if not self.enabled:
            logger.warning(f"尝试获取图片URL，但COS存储未启用 - 对象键: {object_key}")
            return ""
        
        try:
            # 如果不需要签名，直接返回公共访问URL
            if not use_signature:
                url = self.get_full_url(object_key)
                logger.info(f"生成公共访问URL（无签名）: {url}")
                return url
            
            # 需要签名URL的情况
            logger.info(f"开始生成签名URL - 对象键: {object_key}, 过期时间: {expires}秒")
            logger.debug(f"调用COS get_presigned_download_url API - 存储桶: {self.bucket}, 对象键: {object_key}")
            
            # 生成预签名URL
            url = self.client.get_presigned_download_url(
                Bucket=self.bucket,
                Key=object_key,
                Expired=expires
            )
            
            # 修复URL格式问题
            url = self._fix_url_format(url)
            
            logger.info(f"签名URL生成成功: {url}")
            return url
        except CosServiceError as e:
            logger.error(f"生成图片URL失败 - COS服务错误: {e.get_error_code()} - {e.get_error_msg()}, 对象键: {object_key}", exc_info=True)
            return ""
        except CosClientError as e:
            logger.error(f"生成图片URL失败 - COS客户端错误: {str(e)}, 对象键: {object_key}", exc_info=True)
            return ""
        except Exception as e:
            logger.error(f"生成图片URL失败 - 未知错误: {str(e)}, 对象键: {object_key}", exc_info=True)
            return ""
    
    async def check_image_exists(self, object_key: str) -> bool:
        """
        检查图片是否存在
        
        Args:
            object_key: 对象键
            
        Returns:
            是否存在
        """
        if not self.enabled:
            logger.warning(f"尝试检查图片是否存在，但COS存储未启用 - 对象键: {object_key}")
            return False
        
        try:
            logger.info(f"开始检查图片是否存在 - 对象键: {object_key}")
            logger.debug(f"调用COS HEAD_OBJECT API - 存储桶: {self.bucket}, 对象键: {object_key}")
            
            self.client.head_object(
                Bucket=self.bucket,
                Key=object_key
            )
            
            logger.info(f"图片存在 - 对象键: {object_key}")
            return True
        except CosServiceError as e:
            error_code = e.get_error_code()
            error_msg = e.get_error_msg()
            if error_code == "NoSuchKey":
                logger.info(f"图片不存在 - 对象键: {object_key}")
                return False
            elif error_code == "AccessDenied":
                logger.error(f"检查图片存在失败 - 访问被拒绝: {error_msg}, 对象键: {object_key}")
                return False
            elif error_code == "SignatureDoesNotMatch":
                logger.error(f"检查图片存在失败 - 签名不匹配: {error_msg}, 对象键: {object_key}")
                return False
            else:
                logger.error(f"检查图片存在失败 - COS服务错误: {error_code} - {error_msg}, 对象键: {object_key}", exc_info=True)
                return False
        except CosClientError as e:
            logger.error(f"检查图片存在失败 - COS客户端错误: {str(e)}, 对象键: {object_key}", exc_info=True)
            return False
        except Exception as e:
            logger.error(f"检查图片存在失败 - 未知错误: {str(e)}, 对象键: {object_key}", exc_info=True)
            return False
    
    async def get_storage_info(self) -> Dict[str, Any]:
        """
        获取存储空间信息
        
        Returns:
            存储空间信息
        """
        if not self.enabled:
            logger.info("尝试获取存储空间信息，但COS存储未启用")
            return {"enabled": False}
        
        try:
            logger.info(f"开始获取存储空间信息 - 存储桶: {self.bucket}")
            logger.debug(f"调用COS HEAD_BUCKET API - 存储桶: {self.bucket}")
            
            # 获取存储桶信息
            response = self.client.head_bucket(Bucket=self.bucket)
            logger.debug(f"获取存储桶信息响应: {response}")
            
            # 获取对象数量和大致的存储使用量
            # 注意：这需要额外的API调用，可能需要优化
            
            storage_info = {
                "enabled": True,
                "bucket": self.bucket,
                "region": settings.COS_REGION,
                "status": "available"
            }
            
            logger.info(f"获取存储空间信息成功 - {storage_info}")
            return storage_info
        except Exception as e:
            logger.error(f"获取存储空间信息失败: {str(e)}", exc_info=True)
            return {"enabled": True, "status": "error", "error": str(e)}
    
    async def test_connection(self) -> bool:
        """
        测试COS连接
        
        Returns:
            连接是否成功
        """
        if not self.enabled:
            logger.warning("尝试测试COS连接，但COS存储未启用")
            return False
        
        try:
            logger.info(f"开始测试COS连接 - 存储桶: {self.bucket}")
            logger.debug(f"调用COS HEAD_BUCKET API 测试连接 - 存储桶: {self.bucket}")
            
            # 尝试获取存储桶信息来测试连接
            self.client.head_bucket(Bucket=self.bucket)
            
            logger.info(f"COS连接测试成功 - 存储桶: {self.bucket}")
            return True
        except Exception as e:
            logger.error(f"COS连接测试失败: {str(e)}", exc_info=True)
            return False
    
    async def list_objects(self, prefix: str = "", max_keys: int = 100) -> list:
        """
        列出存储桶中的对象
        
        Args:
            prefix: 对象前缀
            max_keys: 最大返回数量
            
        Returns:
            对象列表
        """
        if not self.enabled:
            logger.warning(f"尝试列出存储桶对象，但COS存储未启用 - 前缀: {prefix}")
            return []
        
        try:
            logger.info(f"开始列出存储桶对象 - 前缀: {prefix}, 最大返回数量: {max_keys}")
            logger.debug(f"调用COS LIST_OBJECTS API - 存储桶: {self.bucket}, 前缀: {prefix}, 最大返回数量: {max_keys}")
            
            response = self.client.list_objects(
                Bucket=self.bucket,
                Prefix=prefix,
                MaxKeys=max_keys
            )
            
            logger.debug(f"列出对象响应: {response}")
            
            if 'Contents' in response:
                objects = response['Contents']
                logger.info(f"成功列出存储桶对象 - 找到 {len(objects)} 个对象，前缀: {prefix}")
                return objects
            else:
                logger.info(f"存储桶中没有匹配的对象 - 前缀: {prefix}")
                return []
        except Exception as e:
            logger.error(f"列出存储桶对象失败 - 前缀: {prefix}, 错误: {str(e)}", exc_info=True)
            return []
    
    async def upload_processed_image(
        self, 
        image_data: bytes, 
        filename: str,
        image_type: str = "final"
    ) -> Tuple[bool, str, str]:
        """
        上传处理后的WebP图片到COS
        
        Args:
            image_data: 处理后的图片数据
            filename: 文件名
            image_type: 图片类型: "final"(定稿图), "material"(素材库)
            
        Returns:
            (成功状态, 对象键, 访问URL)
        """
        if not self.enabled:
            logger.warning("尝试上传处理后的图片，但COS存储未启用")
            return False, "", "腾讯云COS存储未启用"
        
        try:
            logger.info(f"开始上传处理后的图片 - 文件名: {filename}, 类型: {image_type}, 大小: {len(image_data)} bytes")
            
            object_key = self.generate_object_key(filename, image_type=image_type)
            logger.debug(f"生成处理后图片对象键: {object_key}")
            
            # 上传处理后的图片
            logger.debug(f"调用COS PUT_OBJECT API - 存储桶: {self.bucket}, 对象键: {object_key}")
            response = self.client.put_object(
                Bucket=self.bucket,
                Body=image_data,
                Key=object_key
            )
            
            logger.debug(f"处理后图片上传响应: {response}")
            
            # 生成带签名的访问URL（使用腾讯云允许的最大过期时间：7天）
            url = await self.get_image_url(object_key, expires=604800)
            
            logger.info(f"处理后图片上传成功: {object_key}, URL: {url}")
            return True, object_key, url
            
        except CosServiceError as e:
            error_msg = f"腾讯云COS服务错误: {e.get_error_code()} - {e.get_error_msg()}"
            logger.error(f"处理后图片上传失败 - COS服务错误: {error_msg}, 文件名: {filename}, 对象键: {object_key if 'object_key' in locals() else '未生成'}", exc_info=True)
            return False, "", error_msg
        except CosClientError as e:
            error_msg = f"腾讯云COS客户端错误: {str(e)}"
            logger.error(f"处理后图片上传失败 - COS客户端错误: {error_msg}, 文件名: {filename}", exc_info=True)
            return False, "", error_msg
        except Exception as e:
            error_msg = f"上传处理后图片失败: {str(e)}"
            logger.error(f"处理后图片上传失败 - 未知错误: {error_msg}, 文件名: {filename}", exc_info=True)
            return False, "", error_msg
    
    async def upload_backup_file(
        self, 
        file_path: str, 
        filename: str
    ) -> Tuple[bool, str, str]:
        """
        上传备份文件到COS
        
        Args:
            file_path: 本地文件路径
            filename: 备份文件名
            
        Returns:
            (成功状态, 对象键, 访问URL)
        """
        if not self.enabled:
            logger.warning("尝试上传备份文件，但COS存储未启用")
            return False, "", "腾讯云COS存储未启用"
        
        try:
            logger.info(f"开始上传备份文件 - 本地路径: {file_path}, 文件名: {filename}")
            
            object_key = self.generate_backup_object_key(filename)
            logger.debug(f"生成备份对象键: {object_key}")
            
            # 读取文件内容
            with open(file_path, 'rb') as f:
                file_data = f.read()
            
            # 上传备份文件
            logger.debug(f"调用COS PUT_OBJECT API - 存储桶: {self.bucket}, 对象键: {object_key}, 文件大小: {len(file_data)} bytes")
            response = self.client.put_object(
                Bucket=self.bucket,
                Body=file_data,
                Key=object_key
            )
            
            logger.debug(f"备份文件上传响应: {response}")
            
            # 生成带签名的访问URL（使用腾讯云允许的最大过期时间：7天）
            url = await self.get_backup_url(object_key, expires=604800)
            
            logger.info(f"备份文件上传成功: {object_key}, URL: {url}")
            return True, object_key, url
            
        except CosServiceError as e:
            error_msg = f"腾讯云COS服务错误: {e.get_error_code()} - {e.get_error_msg()}"
            logger.error(f"备份文件上传失败 - COS服务错误: {error_msg}, 文件名: {filename}, 对象键: {object_key if 'object_key' in locals() else '未生成'}", exc_info=True)
            return False, "", error_msg
        except CosClientError as e:
            error_msg = f"腾讯云COS客户端错误: {str(e)}"
            logger.error(f"备份文件上传失败 - COS客户端错误: {error_msg}, 文件名: {filename}", exc_info=True)
            return False, "", error_msg
        except Exception as e:
            error_msg = f"上传备份文件失败: {str(e)}"
            logger.error(f"备份文件上传失败 - 未知错误: {error_msg}, 文件名: {filename}", exc_info=True)
            return False, "", error_msg
    
    async def get_backup_url(self, object_key: str, expires: int = 604800) -> str:
        """
        获取备份文件访问URL（带签名）
        
        Args:
            object_key: 对象键
            expires: 过期时间(秒)，默认7天
            
        Returns:
            带签名的访问URL
        """
        return await self.get_image_url(object_key, expires)
    
    async def delete_backup_file(self, object_key: str) -> Tuple[bool, str]:
        """
        从COS删除备份文件
        
        Args:
            object_key: 对象键
            
        Returns:
            (成功状态, 错误信息)
        """
        return await self.delete_image(object_key)


# 全局COS服务实例
cos_service = COSService()