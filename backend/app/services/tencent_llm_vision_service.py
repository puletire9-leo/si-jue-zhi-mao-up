"""
腾讯云混元大模型视觉理解服务（OpenAI兼容接口）

使用腾讯云混元大模型的OpenAI兼容接口进行图像理解和详细描述
文档: https://cloud.tencent.com/document/product/1729/111007

Base URL: https://api.hunyuan.cloud.tencent.com/v1
"""

import os
import json
import base64
import logging
from typing import List, Dict, Optional, Tuple, Any
from urllib.parse import urlencode
import aiohttp
import asyncio

# 导入图片加载和处理工具
from ..utils.image_loader import load_image_data
from ..utils.image_processor import convert_to_supported_format, get_image_format, is_format_supported

logger = logging.getLogger(__name__)

# API配置
HUNYUAN_API_BASE = "https://api.hunyuan.cloud.tencent.com/v1"
HUNYUAN_API_KEY = os.getenv("HUNYUAN_API_KEY", "")  # 从环境变量读取API Key

logger = logging.getLogger(__name__)


class TencentLLMVisionService:
    """
    腾讯云混元大模型视觉理解服务（OpenAI兼容接口）
    
    使用OpenAI SDK调用混元大模型进行详细的图像理解和描述
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        """单例模式"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """初始化服务"""
        if TencentLLMVisionService._initialized:
            return
        
        self.api_key = HUNYUAN_API_KEY
        self.base_url = HUNYUAN_API_BASE
        
        # 尝试导入openai库
        try:
            from openai import AsyncOpenAI
            self.client = AsyncOpenAI(
                api_key=self.api_key,
                base_url=self.base_url
            )
            logger.info("腾讯云混元大模型视觉服务初始化完成（OpenAI兼容接口）")
        except ImportError:
            logger.warning("未安装openai库，将使用aiohttp直接调用API")
            self.client = None
        
        TencentLLMVisionService._initialized = True
    
    async def _call_api_direct(self, model: str, messages: List[Dict]) -> Dict:
        """
        直接使用aiohttp调用API（备用方案）
        
        Args:
            model: 模型名称
            messages: 消息列表
            
        Returns:
            Dict: API响应结果
        """
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        
        payload = {
            "model": model,
            "messages": messages
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=120)
                ) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        logger.error(f"API调用失败: {response.status}, {error_text}")
                        return {}
                    
                    result = await response.json()
                    return result
                    
        except Exception as e:
            logger.error(f"API调用异常: {str(e)}")
            return {}
    
    async def analyze_image_detailed(
        self, 
        image_url: str = None, 
        image_base64: str = None
    ) -> Dict[str, Any]:
        """
        详细分析图片内容
        
        使用混元大模型进行详细的图像理解和描述
        
        Args:
            image_url: 图片URL
            image_base64: base64编码的图片
            
        Returns:
            Dict: 包含详细分析结果
            {
                'product_type': '产品类型',
                'theme': '主题',
                'elements': [
                    {'name': '元素名称', 'english_name': '英文名称', 'icon': '图标'},
                    ...
                ],
                'text_content': ['文字内容1', '文字内容2'],
                'description': '整体描述'
            }
        """
        try:
            # 准备图片数据
            image_data_url = None
            
            if image_url:
                # 下载图片
                logger.info(f"下载图片用于AI分析: {image_url}")
                image_data = await load_image_data(image_url)
                if not image_data:
                    logger.error(f"无法加载图片: {image_url}")
                    return {}
                # 转换为base64
                image_base64 = base64.b64encode(image_data).decode('utf-8')
                image_data_url = f"data:image/jpeg;base64,{image_base64}"
            elif image_base64:
                # 去除data URI前缀
                if ',' in image_base64:
                    image_base64 = image_base64.split(',', 1)[1]
                image_data_url = f"data:image/jpeg;base64,{image_base64}"
            else:
                logger.error("没有提供图片数据")
                return {}
            
            # 构建提示词
            prompt = """请详细分析这张图片，并按以下JSON格式返回结果：

{
    "product_type": "产品类型，如：手提袋、帆布包、T恤、手机壳、海报、插画等",
    "theme": "主题描述，如：伦敦主题、自然风光、卡通动漫、节日庆典等",
    "elements": [
        {"name": "元素中文名称", "english_name": "英文名称", "icon": "相关emoji图标"},
        ...
    ],
    "text_content": ["图片中的文字内容1", "文字内容2"],
    "description": "整体描述，包括风格、色彩、用途等"
}

要求：
1. 尽可能识别出图片中的所有元素
2. 为每个元素提供中英文名称和emoji图标
3. 提取图片中的所有文字
4. 描述整体风格和用途
5. 必须返回有效的JSON格式"""

            # 构建消息
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": image_data_url
                            }
                        },
                        {
                            "type": "text",
                            "text": prompt
                        }
                    ]
                }
            ]
            
            # 调用API
            if self.client:
                # 使用OpenAI SDK
                completion = await self.client.chat.completions.create(
                    model="hunyuan-vision",  # 视觉理解模型
                    messages=messages,
                    temperature=0.7,
                    max_tokens=2000
                )
                content = completion.choices[0].message.content
            else:
                # 使用直接HTTP调用
                result = await self._call_api_direct("hunyuan-vision", messages)
                if not result or 'choices' not in result:
                    return {}
                content = result['choices'][0]['message']['content']
            
            # 解析JSON结果
            try:
                # 提取JSON部分
                json_start = content.find('{')
                json_end = content.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = content[json_start:json_end]
                    result = json.loads(json_str)
                    logger.info(f"混元大模型分析完成: {result.get('product_type', '未知')}")
                    return result
                else:
                    # 如果没有JSON格式，返回原始文本
                    return {
                        'description': content,
                        'product_type': '未知',
                        'theme': '',
                        'elements': [],
                        'text_content': []
                    }
            except json.JSONDecodeError as e:
                logger.error(f"解析JSON失败: {e}, 内容: {content}")
                # 返回原始文本
                return {
                    'description': content,
                    'product_type': '未知',
                    'theme': '',
                    'elements': [],
                    'text_content': []
                }
            
        except Exception as e:
            logger.error(f"混元大模型图像分析失败: {str(e)}")
            return {}


# 全局服务实例
_llm_service: Optional[TencentLLMVisionService] = None


async def get_llm_vision_service() -> TencentLLMVisionService:
    """
    获取混元大模型视觉服务实例
    
    Returns:
        TencentLLMVisionService: 服务实例
    """
    global _llm_service
    if _llm_service is None:
        _llm_service = TencentLLMVisionService()
    return _llm_service


async def analyze_image_with_llm(
    image_url: str = None, 
    image_base64: str = None
) -> Dict[str, Any]:
    """
    便捷函数：使用混元大模型分析图片
    
    Args:
        image_url: 图片URL
        image_base64: base64编码的图片
        
    Returns:
        Dict: 详细分析结果
    """
    service = await get_llm_vision_service()
    return await service.analyze_image_detailed(image_url, image_base64)
