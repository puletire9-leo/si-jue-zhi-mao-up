import pytest

from app.config import Settings
from app.errors import UpstreamError
from app.providers.deepseek import DeepSeekProvider


@pytest.mark.asyncio
async def test_provider_without_api_key_starts_but_rejects_upstream_calls():
    provider = DeepSeekProvider(Settings(deepseek_api_key=""))
    try:
        with pytest.raises(UpstreamError, match="DEEPSEEK_API_KEY missing"):
            _ = provider.client
    finally:
        await provider.aclose()
