import httpx
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class JavaAPIClient:
    def __init__(self, base_url: str, token: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.client = httpx.AsyncClient(timeout=30.0)

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    async def login(self, username: str, password: str) -> str:
        response = await self.client.post(
            f"{self.base_url}/api/v1/auth/login",
            json={"username": username, "password": password}
        )
        response.raise_for_status()
        data = response.json()
        self.token = data["data"]["accessToken"]
        return self.token

    async def get_images(self, product_id: int) -> List[Dict[str, Any]]:
        response = await self.client.get(
            f"{self.base_url}/api/v1/images",
            params={"productId": product_id},
            headers=self._get_headers()
        )
        response.raise_for_status()
        data = response.json()
        return data.get("data", {}).get("items", [])

    async def get_image_url(self, image_id: int) -> Optional[str]:
        response = await self.client.get(
            f"{self.base_url}/api/v1/images/{image_id}",
            headers=self._get_headers()
        )
        response.raise_for_status()
        data = response.json()
        return data.get("data", {}).get("url")

    async def update_image_vector_status(
        self,
        image_id: int,
        point_id: str
    ):
        response = await self.client.put(
            f"{self.base_url}/api/v1/images/{image_id}/vector",
            json={"pointId": point_id, "status": "indexed"},
            headers=self._get_headers()
        )
        response.raise_for_status()

    async def close(self):
        await self.client.aclose()
