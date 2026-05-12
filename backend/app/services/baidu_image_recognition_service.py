"""
百度AI图像识别服务

使用百度AI开放平台的高级图像识别API，支持：
- 通用物体识别（10万+物体和场景）
- 品牌logo识别
- 植物识别
- 动物识别
- 菜品识别
- 地标识别
- 货币识别
"""

import os
import json
import base64
import logging
from typing import List, Dict, Optional, Tuple
from urllib.parse import urlencode
import aiohttp
import asyncio

# 从配置导入
import sys
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
config_path = os.path.join(project_root, 'config')
sys.path.insert(0, config_path)
from config import BAIDU_AI_CONFIG

logger = logging.getLogger(__name__)


class BaiduImageRecognitionService:
    """
    百度AI图像识别服务
    
    文档: https://ai.baidu.com/tech/imagerecognition
    """
    
    # API 地址
    API_BASE_URL = "https://aip.baidubce.com"
    
    # 各识别类型的API路径
    API_ENDPOINTS = {
        'general': '/rest/2.0/image-classify/v2/advanced_general',  # 通用物体识别
        'logo': '/rest/2.0/image-classify/v2/logo',  # Logo识别
        'plant': '/rest/2.0/image-classify/v1/plant',  # 植物识别
        'animal': '/rest/2.0/image-classify/v1/animal',  # 动物识别
        'dish': '/rest/2.0/image-classify/v2/dish',  # 菜品识别
        'landmark': '/rest/2.0/image-classify/v1/landmark',  # 地标识别
        'currency': '/rest/2.0/image-classify/v1/currency',  # 货币识别
    }
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """初始化服务"""
        if BaiduImageRecognitionService._initialized:
            return
        
        self.app_id = BAIDU_AI_CONFIG.get('app_id', '')
        self.api_key = BAIDU_AI_CONFIG.get('api_key', '')
        self.secret_key = BAIDU_AI_CONFIG.get('secret_key', '')
        self.access_token = None
        self.token_expire_time = 0
        
        BaiduImageRecognitionService._initialized = True
        logger.info("百度AI图像识别服务初始化完成")
    
    async def _get_access_token(self) -> str:
        """
        获取百度AI访问令牌
        
        Returns:
            str: access_token
        """
        # 检查token是否过期（提前5分钟刷新）
        import time
        if self.access_token and time.time() < self.token_expire_time - 300:
            return self.access_token
        
        url = f"{self.API_BASE_URL}/oauth/2.0/token"
        params = {
            'grant_type': 'client_credentials',
            'client_id': self.api_key,
            'client_secret': self.secret_key
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=params) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"获取百度AI access_token 失败: {error_text}")
                        raise Exception(f"获取access_token失败: {response.status}")
                    
                    result = await response.json()
                    
                    if 'access_token' not in result:
                        logger.error(f"百度AI返回错误: {result}")
                        raise Exception(f"获取access_token失败: {result.get('error_description', '未知错误')}")
                    
                    self.access_token = result['access_token']
                    # 设置过期时间
                    expires_in = result.get('expires_in', 2592000)  # 默认30天
                    self.token_expire_time = time.time() + expires_in
                    
                    logger.info("百度AI access_token 获取成功")
                    return self.access_token
                    
        except Exception as e:
            logger.error(f"获取百度AI access_token 异常: {str(e)}")
            raise
    
    async def _recognize(
        self, 
        image_data: bytes, 
        endpoint: str,
        extra_params: Optional[Dict] = None
    ) -> List[Dict]:
        """
        调用百度AI识别API
        
        Args:
            image_data: 图片二进制数据
            endpoint: API端点
            extra_params: 额外参数
            
        Returns:
            List[Dict]: 识别结果列表
        """
        access_token = await self._get_access_token()
        url = f"{self.API_BASE_URL}{endpoint}?access_token={access_token}"
        
        # 图片转为base64
        image_base64 = base64.b64encode(image_data).decode('utf-8')
        
        params = {'image': image_base64}
        if extra_params:
            params.update(extra_params)
        
        headers = {'Content-Type': 'application/x-www-form-urlencoded'}
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, data=params, headers=headers) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"百度AI识别请求失败: {error_text}")
                        return []
                    
                    result = await response.json()
                    
                    # 检查错误
                    if 'error_code' in result:
                        logger.error(f"百度AI返回错误: {result}")
                        return []
                    
                    return result.get('result', [])
                    
        except Exception as e:
            logger.error(f"百度AI识别异常: {str(e)}")
            return []
    
    async def recognize_general(
        self, 
        image_url: str = None, 
        image_base64: str = None
    ) -> List[Tuple[str, float]]:
        """
        通用物体识别
        
        识别图片中的物体、场景、地标等信息
        
        Args:
            image_url: 图片URL
            image_base64: base64编码的图片
            
        Returns:
            List[Tuple[str, float]]: [(标签, 置信度), ...]
        """
        try:
            # 加载图片
            image_data = await self._load_image(image_url, image_base64)
            if not image_data:
                return []
            
            # 调用通用识别API
            results = await self._recognize(
                image_data, 
                self.API_ENDPOINTS['general'],
                {'baike_num': 0}  # 不返回百科信息，减少响应大小
            )
            
            # 解析结果
            tags = []
            for item in results:
                keyword = item.get('keyword', '')
                score = item.get('score', 0)
                root = item.get('root', '')  # 分类层级
                
                if keyword:
                    # 组合分类和关键词，提高准确性
                    if root and root != keyword:
                        tag = f"{root}-{keyword}"
                    else:
                        tag = keyword
                    
                    # 转换为百分比
                    confidence = round(score * 100, 2)
                    tags.append((tag, confidence))
            
            # 按置信度排序
            tags.sort(key=lambda x: x[1], reverse=True)
            
            logger.info(f"通用物体识别完成，识别到 {len(tags)} 个标签")
            return tags
            
        except Exception as e:
            logger.error(f"通用物体识别失败: {str(e)}")
            return []
    
    async def recognize_landmark(
        self, 
        image_url: str = None, 
        image_base64: str = None
    ) -> List[Tuple[str, float]]:
        """
        地标识别
        
        识别图片中的著名地标建筑
        
        Args:
            image_url: 图片URL
            image_base64: base64编码的图片
            
        Returns:
            List[Tuple[str, float]]: [(地标名, 置信度), ...]
        """
        try:
            image_data = await self._load_image(image_url, image_base64)
            if not image_data:
                return []
            
            results = await self._recognize(image_data, self.API_ENDPOINTS['landmark'])
            
            tags = []
            for item in results:
                landmark = item.get('landmark', '')
                # 地标识别没有score，设为固定高置信度
                if landmark:
                    tags.append((landmark, 95.0))
            
            logger.info(f"地标识别完成，识别到 {len(tags)} 个地标")
            return tags
            
        except Exception as e:
            logger.error(f"地标识别失败: {str(e)}")
            return []
    
    async def recognize_logo(
        self, 
        image_url: str = None, 
        image_base64: str = None
    ) -> List[Tuple[str, float]]:
        """
        Logo识别
        
        识别图片中的品牌logo
        
        Args:
            image_url: 图片URL
            image_base64: base64编码的图片
            
        Returns:
            List[Tuple[str, float]]: [(品牌名, 置信度), ...]
        """
        try:
            image_data = await self._load_image(image_url, image_base64)
            if not image_data:
                return []
            
            results = await self._recognize(image_data, self.API_ENDPOINTS['logo'])
            
            tags = []
            for item in results:
                name = item.get('name', '')
                probability = item.get('probability', 0)
                if name:
                    confidence = round(probability * 100, 2)
                    tags.append((f"品牌-{name}", confidence))
            
            logger.info(f"Logo识别完成，识别到 {len(tags)} 个品牌")
            return tags
            
        except Exception as e:
            logger.error(f"Logo识别失败: {str(e)}")
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
            
            # 1. 通用物体识别（主要）
            general_tags = await self.recognize_general(image_url, image_base64)
            all_tags.extend(general_tags)
            
            # 2. 地标识别（补充）
            landmark_tags = await self.recognize_landmark(image_url, image_base64)
            all_tags.extend(landmark_tags)
            
            # 3. Logo识别（补充）
            logo_tags = await self.recognize_logo(image_url, image_base64)
            all_tags.extend(logo_tags)
            
            # 去重并按置信度排序
            seen = set()
            unique_tags = []
            for tag, confidence in sorted(all_tags, key=lambda x: x[1], reverse=True):
                tag_lower = tag.lower()
                if tag_lower not in seen:
                    seen.add(tag_lower)
                    unique_tags.append((tag, confidence))
            
            # 返回前5个
            return unique_tags[:5]
            
        except Exception as e:
            logger.error(f"图片综合分析失败: {str(e)}")
            return []
    
    async def _load_image(
        self, 
        image_url: str = None, 
        image_base64: str = None
    ) -> Optional[bytes]:
        """
        加载图片数据
        
        Args:
            image_url: 图片URL或本地路径
            image_base64: base64编码的图片
            
        Returns:
            Optional[bytes]: 图片二进制数据
        """
        try:
            # 优先使用base64
            if image_base64:
                # 去除data URI前缀
                if ',' in image_base64:
                    image_base64 = image_base64.split(',', 1)[1]
                return base64.b64decode(image_base64)
            
            # 从URL加载
            if image_url:
                if image_url.startswith(('http://', 'https://')):
                    # 远程URL
                    async with aiohttp.ClientSession() as session:
                        async with session.get(image_url) as response:
                            if response.status == 200:
                                return await response.read()
                            else:
                                logger.error(f"下载图片失败: {image_url}, 状态码: {response.status}")
                                return None
                elif image_url.startswith('/'):
                    # 相对路径，构造完整URL
                    backend_port = os.getenv('BACKEND_PORT', '8001')
                    full_url = f"http://localhost:{backend_port}{image_url}"
                    async with aiohttp.ClientSession() as session:
                        async with session.get(full_url) as response:
                            if response.status == 200:
                                return await response.read()
                            else:
                                logger.error(f"下载图片失败: {full_url}, 状态码: {response.status}")
                                return None
                else:
                    # 本地文件路径
                    if os.path.exists(image_url):
                        with open(image_url, 'rb') as f:
                            return f.read()
                    else:
                        logger.error(f"图片文件不存在: {image_url}")
                        return None
            
            logger.error("没有提供图片数据")
            return None
            
        except Exception as e:
            logger.error(f"加载图片失败: {str(e)}")
            return None


# 全局服务实例
_baidu_service: Optional[BaiduImageRecognitionService] = None


async def get_baidu_image_service() -> BaiduImageRecognitionService:
    """
    获取百度AI图像识别服务实例
    
    Returns:
        BaiduImageRecognitionService: 服务实例
    """
    global _baidu_service
    if _baidu_service is None:
        _baidu_service = BaiduImageRecognitionService()
    return _baidu_service


async def analyze_image_with_baidu(
    image_url: str = None, 
    image_base64: str = None
) -> List[Tuple[str, float]]:
    """
    便捷函数：使用百度AI分析图片
    
    Args:
        image_url: 图片URL
        image_base64: base64编码的图片
        
    Returns:
        List[Tuple[str, float]]: [(标签, 置信度), ...]
    """
    service = await get_baidu_image_service()
    return await service.analyze_image(image_url, image_base64)
