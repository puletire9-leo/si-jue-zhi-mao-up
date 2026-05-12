"""
腾讯云图像识别服务

使用腾讯云图像分析API，支持：
- 通用图像标签（DetectLabelPro）- 识别数千种物体和场景
- 商品识别（DetectProduct）- 识别商品类别和位置
- 车辆识别（RecognizeCar）- 识别车型、品牌、颜色

文档: https://cloud.tencent.com/document/product/865
"""

import os
import json
import base64
import logging
from typing import List, Dict, Optional, Tuple
from urllib.parse import urlencode
import aiohttp
import asyncio

# 导入图片加载和处理工具
from ..utils.image_loader import load_image_data
from ..utils.image_processor import convert_to_supported_format, get_image_format, is_format_supported

logger = logging.getLogger(__name__)

# 从配置导入
import sys
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
config_path = os.path.join(project_root, 'config')
sys.path.insert(0, config_path)

# 尝试从主配置导入，如果不存在则从backend配置导入
try:
    from config import TENCENT_CLOUD_CONFIG
except ImportError:
    # 使用backend的config中的COS配置
    sys.path.insert(0, os.path.join(project_root, 'backend'))
    from app.config import settings
    
    # 构建TENCENT_CLOUD_CONFIG
    TENCENT_CLOUD_CONFIG = {
        'secret_id': settings.COS_SECRET_ID,
        'secret_key': settings.COS_SECRET_KEY,
        'region': settings.COS_REGION,
        'enabled': settings.COS_ENABLED,
    }

logger = logging.getLogger(__name__)


class TencentImageRecognitionService:
    """
    腾讯云图像识别服务
    
    使用腾讯云API 3.0接口进行图像分析
    """
    
    # API 地址
    API_BASE_URL = "https://tiia.tencentcloudapi.com"
    API_VERSION = "2019-05-29"
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """初始化服务"""
        if TencentImageRecognitionService._initialized:
            return
        
        self.secret_id = TENCENT_CLOUD_CONFIG.get('secret_id', '')
        self.secret_key = TENCENT_CLOUD_CONFIG.get('secret_key', '')
        self.region = TENCENT_CLOUD_CONFIG.get('region', 'ap-guangzhou')
        
        TencentImageRecognitionService._initialized = True
        logger.info(f"腾讯云图像识别服务初始化完成 - 区域: {self.region}")
    
    def _sign_request(self, action: str, params: Dict) -> Dict:
        """
        生成腾讯云API签名 (TC3-HMAC-SHA256)
        
        参考文档: https://cloud.tencent.com/document/api/213/30654
        
        Args:
            action: API动作名称
            params: 请求参数
            
        Returns:
            Dict: 包含签名的完整请求头
        """
        import hashlib
        import hmac
        import time
        
        # 时间戳和日期
        timestamp = int(time.time())
        date = time.strftime("%Y-%m-%d", time.gmtime(timestamp))
        
        # 服务名称
        service = "tiia"
        host = "tiia.tencentcloudapi.com"
        
        # HTTP方法
        http_method = "POST"
        canonical_uri = "/"
        canonical_querystring = ""
        
        # 请求体
        payload = json.dumps(params)
        payload_hash = hashlib.sha256(payload.encode('utf-8')).hexdigest()
        
        # 构建规范请求头
        content_type = "application/json"
        canonical_headers = f"content-type:{content_type}\nhost:{host}\nx-tc-action:{action.lower()}\n"
        signed_headers = "content-type;host;x-tc-action"
        
        # 构建规范请求
        canonical_request = (f"{http_method}\n"
                           f"{canonical_uri}\n"
                           f"{canonical_querystring}\n"
                           f"{canonical_headers}\n"
                           f"{signed_headers}\n"
                           f"{payload_hash}")
        
        # 构建待签名字符串
        algorithm = "TC3-HMAC-SHA256"
        credential_scope = f"{date}/{service}/tc3_request"
        canonical_request_hash = hashlib.sha256(canonical_request.encode('utf-8')).hexdigest()
        
        string_to_sign = (f"{algorithm}\n"
                         f"{timestamp}\n"
                         f"{credential_scope}\n"
                         f"{canonical_request_hash}")
        
        # 计算签名
        secret_date = hmac.new(f"TC3{self.secret_key}".encode('utf-8'), 
                               date.encode('utf-8'), hashlib.sha256).digest()
        secret_service = hmac.new(secret_date, service.encode('utf-8'), hashlib.sha256).digest()
        secret_signing = hmac.new(secret_service, "tc3_request".encode('utf-8'), hashlib.sha256).digest()
        signature = hmac.new(secret_signing, string_to_sign.encode('utf-8'), hashlib.sha256).hexdigest()
        
        # 构建Authorization头
        authorization = (f"{algorithm} "
                        f"Credential={self.secret_id}/{credential_scope}, "
                        f"SignedHeaders={signed_headers}, "
                        f"Signature={signature}")
        
        # 构建请求头
        headers = {
            'Content-Type': content_type,
            'Host': host,
            'X-TC-Action': action,
            'X-TC-Version': self.API_VERSION,
            'X-TC-Timestamp': str(timestamp),
            'X-TC-Region': self.region,
            'Authorization': authorization
        }
        
        return headers
    
    async def _call_api(self, action: str, params: Dict) -> Dict:
        """
        调用腾讯云API
        
        Args:
            action: API动作名称
            params: 请求参数
            
        Returns:
            Dict: API响应结果
        """
        # 构建请求头
        headers = self._sign_request(action, params)
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    self.API_BASE_URL,
                    headers=headers,
                    json=params,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    result = await response.json()
                    
                    # 检查错误
                    if 'Response' in result and 'Error' in result['Response']:
                        error = result['Response']['Error']
                        logger.error(f"腾讯云API返回错误: {error}")
                        return {}
                    
                    return result.get('Response', {})
                    
        except Exception as e:
            logger.error(f"腾讯云API调用异常: {str(e)}")
            return {}
    
    async def detect_label_pro(
        self, 
        image_url: str = None, 
        image_base64: str = None
    ) -> List[Tuple[str, float]]:
        """
        通用图像标签识别（高级版）
        
        识别数千种常见物体或场景，覆盖：
        - 日常物品
        - 场景
        - 动物
        - 植物
        - 食物
        - 饮品
        - 交通工具
        
        Args:
            image_url: 图片URL
            image_base64: base64编码的图片
            
        Returns:
            List[Tuple[str, float]]: [(标签, 置信度), ...]
        """
        try:
            # 使用base64传输图片数据
            # 因为腾讯云AI服务无法访问带签名的私有COS URL
            image_data = None
            
            if image_url:
                # 下载图片
                logger.info(f"下载图片用于AI分析: {image_url}")
                image_data = await load_image_data(image_url)
                if not image_data:
                    logger.error(f"无法加载图片: {image_url}")
                    return []
            elif image_base64:
                # 去除data URI前缀
                if ',' in image_base64:
                    image_base64 = image_base64.split(',', 1)[1]
                # 解码base64获取图片数据
                image_data = base64.b64decode(image_base64)
            else:
                logger.error("没有提供图片数据")
                return []
            
            # 检查图片格式，如果不支持则转换
            if image_data:
                image_format = get_image_format(image_data)
                logger.info(f"图片格式: {image_format}")
                
                if image_format and not is_format_supported(image_format):
                    logger.info(f"图片格式 {image_format} 不被腾讯云支持，转换为JPEG")
                    converted_data = await convert_to_supported_format(image_data)
                    if converted_data:
                        image_data = converted_data
                    else:
                        logger.error("图片格式转换失败")
                        return []
                
                # 转换为base64
                image_base64 = base64.b64encode(image_data).decode('utf-8')
            
            # 构建请求参数 - 使用ImageBase64
            params = {
                'ImageBase64': image_base64
            }
            
            # 调用API
            response = await self._call_api('DetectLabelPro', params)
            
            if not response:
                return []
            
            # 解析结果
            labels = response.get('Labels', [])
            tags = []
            
            for label in labels:
                name = label.get('Name', '')
                confidence = label.get('Confidence', 0)
                category = label.get('Category', '')  # 一级分类
                
                if name:
                    # 组合分类信息
                    if category and category != name:
                        tag = f"{category}-{name}"
                    else:
                        tag = name
                    
                    # 腾讯云返回的是0-100的整数
                    confidence_value = float(confidence)
                    tags.append((tag, confidence_value))
            
            # 按置信度排序
            tags.sort(key=lambda x: x[1], reverse=True)
            
            logger.info(f"腾讯云图像标签识别完成，识别到 {len(tags)} 个标签")
            return tags
            
        except Exception as e:
            logger.error(f"腾讯云图像标签识别失败: {str(e)}")
            return []
    
    async def detect_product(
        self, 
        image_url: str = None, 
        image_base64: str = None
    ) -> List[Tuple[str, float]]:
        """
        商品识别
        
        识别图片中的商品，输出商品品类、类别和位置
        涵盖25个大类、数百个细分类别
        
        Args:
            image_url: 图片URL
            image_base64: base64编码的图片
            
        Returns:
            List[Tuple[str, float]]: [(商品类别, 置信度), ...]
        """
        try:
            params = {}
            
            if image_url:
                params['ImageUrl'] = image_url
            elif image_base64:
                if ',' in image_base64:
                    image_base64 = image_base64.split(',', 1)[1]
                params['ImageBase64'] = image_base64
            else:
                return []
            
            response = await self._call_api('DetectProduct', params)
            
            if not response:
                return []
            
            products = response.get('Products', [])
            tags = []
            
            for product in products:
                name = product.get('Name', '')
                # 商品识别没有置信度，设为固定值
                if name:
                    tags.append((f"商品-{name}", 90.0))
            
            logger.info(f"腾讯云商品识别完成，识别到 {len(tags)} 个商品")
            return tags
            
        except Exception as e:
            logger.error(f"腾讯云商品识别失败: {str(e)}")
            return []
    
    async def analyze_image(
        self, 
        image_url: str = None, 
        image_base64: str = None
    ) -> List[Tuple[str, float]]:
        """
        综合分析图片
        
        组合多种识别能力，返回最全面的标签列表
        
        Args:
            image_url: 图片URL
            image_base64: base64编码的图片
            
        Returns:
            List[Tuple[str, float]]: [(标签, 置信度), ...]
        """
        try:
            all_tags = []
            
            # 1. 通用图像标签（主要）
            label_tags = await self.detect_label_pro(image_url, image_base64)
            logger.info(f"通用图像标签识别结果: {len(label_tags)} 个标签 - {label_tags}")
            all_tags.extend(label_tags)
            
            # 2. 商品识别（补充）
            product_tags = await self.detect_product(image_url, image_base64)
            logger.info(f"商品识别结果: {len(product_tags)} 个标签 - {product_tags}")
            all_tags.extend(product_tags)
            
            logger.info(f"合并后总标签数: {len(all_tags)} 个")
            
            # 去重并按置信度排序
            seen = set()
            unique_tags = []
            for tag, confidence in sorted(all_tags, key=lambda x: x[1], reverse=True):
                tag_lower = tag.lower()
                if tag_lower not in seen:
                    seen.add(tag_lower)
                    unique_tags.append((tag, confidence))
            
            logger.info(f"去重后标签数: {len(unique_tags)} 个，返回前6个")
            
            # 返回前6个
            return unique_tags[:6]
            
        except Exception as e:
            logger.error(f"腾讯云图片综合分析失败: {str(e)}")
            return []


# 全局服务实例
_tencent_service: Optional[TencentImageRecognitionService] = None


async def get_tencent_image_service() -> TencentImageRecognitionService:
    """
    获取腾讯云图像识别服务实例
    
    Returns:
        TencentImageRecognitionService: 服务实例
    """
    global _tencent_service
    if _tencent_service is None:
        _tencent_service = TencentImageRecognitionService()
    return _tencent_service


async def analyze_image_with_tencent(
    image_url: str = None, 
    image_base64: str = None
) -> List[Tuple[str, float]]:
    """
    便捷函数：使用腾讯云分析图片
    
    Args:
        image_url: 图片URL
        image_base64: base64编码的图片
        
    Returns:
        List[Tuple[str, float]]: [(标签, 置信度), ...]
    """
    service = await get_tencent_image_service()
    return await service.analyze_image(image_url, image_base64)
