"""
图片分析服务模块

使用 Chinese CLIP 模型进行图片内容识别，自动提取元素标签
"""

import os
import logging
from typing import List, Tuple, Optional
from PIL import Image
import torch
from transformers import CLIPProcessor, CLIPModel
import aiohttp
import asyncio
from io import BytesIO

# 从配置中导入标签库
import sys
# 路径: backend/app/services/image_analysis_service.py -> 项目根目录 -> config/
# 层级: backend/app/services/ -> backend/app/ -> backend/ -> 项目根目录 -> config/
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
config_path = os.path.join(project_root, 'config')
sys.path.insert(0, config_path)
from config import CHINESE_CLIP_MODEL_NAME, ANALYSIS_TOP_K, ANALYSIS_MIN_CONFIDENCE, CHINESE_CLIP_CACHE_DIR

logger = logging.getLogger(__name__)


class ImageAnalysisService:
    """
    图片分析服务

    使用 Chinese CLIP 模型分析图片内容，返回匹配的元素标签
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
        if ImageAnalysisService._initialized:
            return

        self.model = None
        self.processor = None
        self.device = None
        self.model_name = CHINESE_CLIP_MODEL_NAME
        self.top_k = ANALYSIS_TOP_K
        self.min_confidence = ANALYSIS_MIN_CONFIDENCE  # 最小置信度阈值

        ImageAnalysisService._initialized = True
        logger.info(f"图片分析服务初始化完成 - 返回前{self.top_k}个标签，最小置信度阈值{self.min_confidence}%")

    async def load_model(self) -> bool:
        """
        异步加载 Chinese CLIP 模型

        Returns:
            bool: 是否加载成功
        """
        try:
            if self.model is not None:
                return True

            logger.info(f"开始加载 Chinese CLIP 模型: {self.model_name}")

            # 在后台线程中加载模型，避免阻塞事件循环
            loop = asyncio.get_event_loop()
            self.model, self.processor = await loop.run_in_executor(
                None, self._load_model_sync
            )

            logger.info("Chinese CLIP 模型加载成功")
            return True

        except Exception as e:
            logger.error(f"加载 Chinese CLIP 模型失败: {str(e)}", exc_info=True)
            return False

    def _load_model_sync(self) -> Tuple[CLIPModel, CLIPProcessor]:
        """
        同步加载模型（在后台线程中执行）

        Returns:
            Tuple[CLIPModel, CLIPProcessor]: 加载的模型和处理器
        """
        # 设置设备
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"使用设备: {self.device}")

        # 确保缓存目录存在
        os.makedirs(CHINESE_CLIP_CACHE_DIR, exist_ok=True)
        logger.info(f"模型缓存目录: {CHINESE_CLIP_CACHE_DIR}")

        # 尝试从本地加载模型
        local_model_path = os.path.join(
            CHINESE_CLIP_CACHE_DIR, 
            "models--OFA-Sys--chinese-clip-vit-base-patch16",
            "snapshots",
            "36e679e65c2a2fead755ae21162091293ad37834"
        )
        
        if os.path.exists(os.path.join(local_model_path, "pytorch_model.bin")):
            # 本地模型存在，直接加载
            logger.info(f"从本地加载模型: {local_model_path}")
            model = CLIPModel.from_pretrained(
                local_model_path,
                local_files_only=True
            )
            processor = CLIPProcessor.from_pretrained(
                local_model_path,
                local_files_only=True
            )
        else:
            # 备用路径检查
            alt_path = os.path.join(CHINESE_CLIP_CACHE_DIR, "models--OFA-Sys--chinese-clip-vit-base-patch16")
            if os.path.exists(os.path.join(alt_path, "pytorch_model.bin")):
                logger.info(f"从备用路径加载模型: {alt_path}")
                model = CLIPModel.from_pretrained(
                    alt_path,
                    local_files_only=True
                )
                processor = CLIPProcessor.from_pretrained(
                    alt_path,
                    local_files_only=True
                )
            else:
                # 本地模型不存在，使用网络下载
                logger.info("本地模型不存在，从网络下载...")
                model = CLIPModel.from_pretrained(
                    self.model_name,
                    cache_dir=CHINESE_CLIP_CACHE_DIR
                )
                processor = CLIPProcessor.from_pretrained(
                    self.model_name,
                    cache_dir=CHINESE_CLIP_CACHE_DIR
                )

        # 将模型移动到指定设备
        model = model.to(self.device)
        model.eval()

        return model, processor

    async def analyze_image(self, image_url: str = None, image_base64: str = None) -> Optional[str]:
        """
        分析图片并返回元素描述

        Args:
            image_url: 图片 URL 或本地路径
            image_base64: base64 编码的图片数据

        Returns:
            Optional[str]: 元素描述（逗号分隔的标签），分析失败返回 None
        """
        try:
            # 确保模型已加载
            if not await self.load_model():
                logger.error("模型未加载，无法分析图片")
                return None

            # 加载图片（支持 URL 或 base64）
            image = await self._load_image(image_url, image_base64)
            if image is None:
                return None

            # 分析图片
            tags = await self._analyze(image)

            # 返回逗号分隔的标签
            return ",".join(tags) if tags else None

        except Exception as e:
            logger.error(f"分析图片失败: {str(e)}", exc_info=True)
            return None

    async def analyze_image_with_scores(self, image_url: str = None, image_base64: str = None) -> List[Tuple[str, float]]:
        """
        分析图片并返回带置信度的标签列表

        Args:
            image_url: 图片 URL 或本地路径
            image_base64: base64 编码的图片数据

        Returns:
            List[Tuple[str, float]]: [(标签, 置信度), ...]
        """
        try:
            # 确保模型已加载
            if not await self.load_model():
                logger.error("模型未加载，无法分析图片")
                return []

            # 加载图片（支持 URL 或 base64）
            image = await self._load_image(image_url, image_base64)
            if image is None:
                return []

            # 分析图片并获取置信度
            return await self._analyze_with_scores(image)

        except Exception as e:
            logger.error(f"分析图片失败: {str(e)}", exc_info=True)
            return []

    async def _load_image(self, image_url: str = None, image_base64: str = None) -> Optional[Image.Image]:
        """
        加载图片

        Args:
            image_url: 图片 URL 或本地路径
            image_base64: base64 编码的图片数据

        Returns:
            Optional[Image.Image]: PIL Image 对象
        """
        try:
            # 优先使用 base64
            if image_base64:
                # 解析 base64 数据（去除 data:image/xxx;base64, 前缀）
                if ',' in image_base64:
                    image_base64 = image_base64.split(',', 1)[1]
                import base64
                image_data = base64.b64decode(image_base64)
                image = Image.open(BytesIO(image_data))
            elif image_url:
                # 判断 URL 类型
                if image_url.startswith(('http://', 'https://')):
                    # 绝对 URL - 从远程下载
                    async with aiohttp.ClientSession() as session:
                        async with session.get(image_url) as response:
                            if response.status != 200:
                                logger.error(f"下载图片失败: {image_url}, 状态码: {response.status}")
                                return None
                            image_data = await response.read()
                            image = Image.open(BytesIO(image_data))
                elif image_url.startswith('/'):
                    # 相对路径 - 需要通过本地服务下载（如 /api/v1/image-proxy/）
                    # 构造绝对 URL
                    # 从环境变量获取后端端口，默认8001
                    import os
                    # 优先使用环境变量中的后端端口
                    backend_port = os.getenv('BACKEND_PORT', os.getenv('VITE_BACKEND_PORT', '8001'))
                    base_url = f"http://localhost:{backend_port}"
                    full_url = f"{base_url}{image_url}"
                    logger.info(f"相对路径图片，构造完整URL: {full_url}")
                    
                    try:
                        async with aiohttp.ClientSession() as session:
                            async with session.get(full_url) as response:
                                if response.status != 200:
                                    logger.error(f"下载图片失败: {full_url}, 状态码: {response.status}")
                                    return None
                                image_data = await response.read()
                                image = Image.open(BytesIO(image_data))
                    except Exception as e:
                        logger.error(f"下载相对路径图片失败: {e}")
                        return None
                else:
                    # 本地文件路径
                    if not os.path.exists(image_url):
                        logger.error(f"图片文件不存在: {image_url}")
                        return None
                    image = Image.open(image_url)
            else:
                logger.error("没有提供图片数据")
                return None

            # 转换为 RGB 模式
            if image.mode != 'RGB':
                image = image.convert('RGB')

            return image

        except Exception as e:
            logger.error(f"加载图片失败: {str(e)}")
            return None

    async def _analyze(self, image: Image.Image) -> List[str]:
        """
        分析图片，返回最匹配的标签列表

        Args:
            image: PIL Image 对象

        Returns:
            List[str]: 匹配的标签列表
        """
        results = await self._analyze_with_scores(image)
        return [tag for tag, _ in results]

    async def _analyze_with_scores(self, image: Image.Image) -> List[Tuple[str, float]]:
        """
        分析图片，返回带置信度的标签列表

        Args:
            image: PIL Image 对象

        Returns:
            List[Tuple[str, float]]: [(标签, 置信度), ...]
        """
        try:
            loop = asyncio.get_event_loop()

            # 在后台线程中执行推理
            results = await loop.run_in_executor(
                None, self._inference, image
            )

            return results

        except Exception as e:
            logger.error(f"推理失败: {str(e)}", exc_info=True)
            return []

    def _get_element_tags(self) -> List[str]:
        """
        动态获取最新的元素词库

        Returns:
            List[str]: 最新的元素词列表
        """
        try:
            # 从文件加载元素词库
            element_tags_file = os.path.join(project_root, 'scripts', '元素词库', '元素词库.txt')

            if not os.path.exists(element_tags_file):
                logger.warning(f"元素词库文件不存在: {element_tags_file}")
                return ["兔子", "狗狗", "猫咪"]

            with open(element_tags_file, 'r', encoding='utf-8') as f:
                fresh_element_tags = [line.strip() for line in f if line.strip()]

            logger.info(f"动态加载元素词库 - 数量: {len(fresh_element_tags)}")
            return fresh_element_tags
        except Exception as e:
            logger.error(f"动态加载元素词库失败: {str(e)}, 使用默认词库")
            # 如果动态加载失败，返回默认的词库
            return ["兔子", "狗狗", "猫咪"]

    def _inference(self, image: Image.Image) -> List[Tuple[str, float]]:
        """
        执行模型推理（同步方法，在后台线程中执行）

        Args:
            image: PIL Image 对象

        Returns:
            List[Tuple[str, float]]: [(标签, 置信度), ...]
        """
        import torch.nn.functional as F

        # 动态获取最新的元素词库
        element_tags = self._get_element_tags()

        # 准备输入
        inputs = self.processor(
            text=element_tags,
            images=image,
            return_tensors="pt",
            padding=True
        )

        # 将输入移动到设备
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # 推理
        with torch.no_grad():
            outputs = self.model(**inputs)

        # 获取图片和文本的嵌入向量
        image_embeds = outputs.image_embeds
        text_embeds = outputs.text_embeds

        # 归一化
        image_embeds = F.normalize(image_embeds, dim=-1)
        text_embeds = F.normalize(text_embeds, dim=-1)

        # 计算相似度
        similarity = (image_embeds @ text_embeds.T)[0]

        # 获取 top-k 最匹配的标签
        probs = similarity.softmax(dim=0)
        top_probs, top_indices = probs.topk(self.top_k)

        # 构建结果，过滤低于阈值的标签
        results = []
        for prob, idx in zip(top_probs.tolist(), top_indices.tolist()):
            tag = element_tags[idx]
            confidence = round(prob * 100, 2)
            # 只添加置信度大于等于阈值的标签
            if confidence >= self.min_confidence:
                results.append((tag, confidence))

        # 如果没有标签通过阈值过滤，返回空列表
        if not results:
            logger.warning(f"所有标签的置信度都低于阈值{self.min_confidence}%，返回空结果")

        return results


# 全局服务实例
_image_analysis_service: Optional[ImageAnalysisService] = None


async def get_image_analysis_service() -> ImageAnalysisService:
    """
    获取图片分析服务实例

    Returns:
        ImageAnalysisService: 图片分析服务实例
    """
    global _image_analysis_service
    if _image_analysis_service is None:
        _image_analysis_service = ImageAnalysisService()
    return _image_analysis_service


async def analyze_image(image_url: str = None, image_base64: str = None) -> Optional[str]:
    """
    便捷函数：分析图片并返回元素描述

    Args:
        image_url: 图片 URL 或本地路径
        image_base64: base64 编码的图片数据

    Returns:
        Optional[str]: 元素描述
    """
    service = await get_image_analysis_service()
    return await service.analyze_image(image_url, image_base64)


async def analyze_image_with_scores(image_url: str = None, image_base64: str = None) -> List[Tuple[str, float]]:
    """
    便捷函数：分析图片并返回带置信度的标签列表

    Args:
        image_url: 图片 URL 或本地路径
        image_base64: base64 编码的图片数据

    Returns:
        List[Tuple[str, float]]: [(标签, 置信度), ...]
    """
    service = await get_image_analysis_service()
    return await service.analyze_image_with_scores(image_url, image_base64)
