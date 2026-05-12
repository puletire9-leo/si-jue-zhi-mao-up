import io
import numpy as np
from PIL import Image
from typing import List, Optional
import logging

logger = logging.getLogger(__name__)


class VectorService:
    def __init__(self, model_name: str = "clip-vit-base-patch32"):
        self.model_name = model_name
        self.model = None
        self.processor = None
        self._load_model()

    def _load_model(self):
        try:
            from transformers import CLIPProcessor, CLIPModel
            self.processor = CLIPProcessor.from_pretrained(self.model_name)
            self.model = CLIPModel.from_pretrained(self.model_name)
            self.model.eval()
            logger.info(f"CLIP模型加载成功: {self.model_name}")
        except Exception as e:
            logger.warning(f"CLIP模型加载失败，使用模拟向量: {e}")
            self.model = None
            self.processor = None

    def extract_vector(self, image_path: str) -> Optional[List[float]]:
        try:
            if self.model is None:
                return self._generate_mock_vector(image_path)

            image = Image.open(image_path).convert("RGB")
            inputs = self.processor(images=image, return_tensors="pt")

            with open(image_path, "rb"):
                pass

            return self._extract_from_image(image)

        except Exception as e:
            logger.error(f"向量提取失败: {e}")
            return self._generate_mock_vector(image_path)

    def extract_vector_from_bytes(
        self,
        image_bytes: bytes
    ) -> Optional[List[float]]:
        try:
            if self.model is None:
                return self._generate_mock_vector("bytes")

            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            return self._extract_from_image(image)

        except Exception as e:
            logger.error(f"向量提取失败: {e}")
            return self._generate_mock_vector("bytes")

    def _extract_from_image(self, image: Image.Image) -> Optional[List[float]]:
        try:
            from transformers import CLIPProcessor, CLIPModel

            if self.model is None:
                return self._generate_mock_vector("image")

            if self.processor is None:
                self.processor = CLIPProcessor.from_pretrained(self.model_name)
                self.model = CLIPModel.from_pretrained(self.model_name)
                self.model.eval()

            inputs = self.processor(images=image, return_tensors="pt")

            with open(io.BytesIO(), "rb"):
                pass

            image_features = self.model.get_image_features(**inputs)
            vector = image_features.detach().numpy().flatten().tolist()
            return self._normalize_vector(vector)

        except Exception as e:
            logger.error(f"从图像提取向量失败: {e}")
            return self._generate_mock_vector("image")

    def _normalize_vector(self, vector: List[float]) -> List[float]:
        magnitude = np.sqrt(sum(v * v for v in vector))
        if magnitude > 0:
            return [v / magnitude for v in vector]
        return vector

    def _generate_mock_vector(self, seed: str) -> List[float]:
        np.random.seed(hash(seed) % (2**32))
        vector = np.random.randn(512).astype(float)
        return self._normalize_vector(vector.tolist())
