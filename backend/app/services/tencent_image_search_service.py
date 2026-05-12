"""
腾讯云图像搜索服务

使用腾讯云图像搜索API，支持：
- 创建图片（CreateImage）- 将图片添加到搜索库
- 检索图片（SearchImage）- 以图搜图，查找相似图片
- 删除图片（DeleteImage）- 从搜索库删除图片

文档: https://cloud.tencent.com/document/product/1580
"""

import os
import json
import base64
import logging
from typing import List, Dict, Optional, Tuple
import aiohttp

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


class TencentImageSearchService:
    """
    腾讯云图像搜索服务
    
    使用腾讯云图像搜索API 3.0接口
    """
    
    # API 地址
    API_BASE_URL = "https://tiiame.tencentcloudapi.com"
    API_VERSION = "2021-11-17"
    
    # 默认图库名称
    DEFAULT_GROUP_ID = "material_library"
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """初始化服务"""
        if TencentImageSearchService._initialized:
            return
        
        self.secret_id = TENCENT_CLOUD_CONFIG.get('secret_id', '')
        self.secret_key = TENCENT_CLOUD_CONFIG.get('secret_key', '')
        self.region = TENCENT_CLOUD_CONFIG.get('region', 'ap-guangzhou')
        
        TencentImageSearchService._initialized = True
        logger.info(f"腾讯云图像搜索服务初始化完成 - 区域: {self.region}")
    
    def _sign_request(self, action: str, params: Dict) -> Dict:
        """
        生成腾讯云API签名 (TC3-HMAC-SHA256)
        
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
        service = "tiiame"
        host = "tiiame.tencentcloudapi.com"
        
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
                        logger.error(f"腾讯云图像搜索API返回错误: {error}")
                        return {}
                    
                    return result.get('Response', {})
                    
        except Exception as e:
            logger.error(f"腾讯云图像搜索API调用异常: {str(e)}")
            return {}
    
    async def create_image(
        self,
        image_url: str = None,
        image_base64: str = None,
        entity_id: str = None,
        custom_content: str = None,
        group_id: str = None
    ) -> bool:
        """
        创建图片（添加到搜索库）
        
        将图片添加到图像搜索库，后续可以通过以图搜图找到它
        
        Args:
            image_url: 图片URL
            image_base64: base64编码的图片
            entity_id: 图片唯一标识（如素材ID）
            custom_content: 自定义内容（如素材信息JSON）
            group_id: 图库名称，默认使用 material_library
            
        Returns:
            bool: 是否成功
        """
        try:
            params = {
                'GroupId': group_id or self.DEFAULT_GROUP_ID,
            }
            
            if entity_id:
                params['EntityId'] = str(entity_id)
            
            if custom_content:
                params['CustomContent'] = custom_content
            
            if image_url:
                params['PicUrl'] = image_url
            elif image_base64:
                # 去除data URI前缀
                if ',' in image_base64:
                    image_base64 = image_base64.split(',', 1)[1]
                params['PicImageContents'] = {'ImageBase64': image_base64}
            else:
                logger.error("没有提供图片数据")
                return False
            
            # 调用API
            response = await self._call_api('CreateImage', params)
            
            if response and 'ImageInfos' in response:
                logger.info(f"图片创建成功 - EntityId: {entity_id}")
                return True
            else:
                logger.warning(f"图片创建失败 - EntityId: {entity_id}, 响应: {response}")
                return False
                
        except Exception as e:
            logger.error(f"创建图片失败: {str(e)}")
            return False
    
    async def search_image(
        self,
        image_url: str = None,
        image_base64: str = None,
        group_id: str = None,
        limit: int = 10
    ) -> List[Dict]:
        """
        检索图片（以图搜图）
        
        根据上传的图片，在图库中搜索相似的图片
        
        Args:
            image_url: 图片URL
            image_base64: base64编码的图片
            group_id: 图库名称，默认使用 material_library
            limit: 返回结果数量限制
            
        Returns:
            List[Dict]: 相似图片列表，每个包含：
                - entity_id: 图片ID
                - similarity: 相似度（0-100）
                - custom_content: 自定义内容
        """
        try:
            params = {
                'GroupId': group_id or self.DEFAULT_GROUP_ID,
                'Limit': limit,
            }
            
            if image_url:
                params['PicUrl'] = image_url
            elif image_base64:
                # 去除data URI前缀
                if ',' in image_base64:
                    image_base64 = image_base64.split(',', 1)[1]
                params['PicImageContents'] = {'ImageBase64': image_base64}
            else:
                logger.error("没有提供图片数据")
                return []
            
            # 调用API
            response = await self._call_api('SearchImage', params)
            
            if not response:
                return []
            
            # 解析结果
            results = []
            image_infos = response.get('ImageInfos', [])
            
            for info in image_infos:
                entity_id = info.get('EntityId', '')
                similarity = info.get('Score', 0)  # 相似度
                custom_content = info.get('CustomContent', '')
                
                if entity_id:
                    results.append({
                        'entity_id': entity_id,
                        'similarity': float(similarity),
                        'custom_content': custom_content,
                    })
            
            # 按相似度排序
            results.sort(key=lambda x: x['similarity'], reverse=True)
            
            logger.info(f"图像搜索完成，找到 {len(results)} 个相似图片")
            return results
                
        except Exception as e:
            logger.error(f"图像搜索失败: {str(e)}")
            return []
    
    async def delete_image(
        self,
        entity_id: str,
        group_id: str = None
    ) -> bool:
        """
        删除图片（从搜索库移除）
        
        Args:
            entity_id: 图片唯一标识
            group_id: 图库名称，默认使用 material_library
            
        Returns:
            bool: 是否成功
        """
        try:
            params = {
                'GroupId': group_id or self.DEFAULT_GROUP_ID,
                'EntityId': str(entity_id),
            }
            
            # 调用API
            response = await self._call_api('DeleteImages', params)
            
            if response:
                logger.info(f"图片删除成功 - EntityId: {entity_id}")
                return True
            else:
                logger.warning(f"图片删除失败 - EntityId: {entity_id}")
                return False
                
        except Exception as e:
            logger.error(f"删除图片失败: {str(e)}")
            return False


# 全局服务实例
_image_search_service: Optional[TencentImageSearchService] = None


async def get_tencent_image_search_service() -> TencentImageSearchService:
    """
    获取腾讯云图像搜索服务实例
    
    Returns:
        TencentImageSearchService: 服务实例
    """
    global _image_search_service
    if _image_search_service is None:
        _image_search_service = TencentImageSearchService()
    return _image_search_service
