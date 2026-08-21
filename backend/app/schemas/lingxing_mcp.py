"""领星 MCP 查询接口的数据契约。"""

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class LingxingProductDetailRequest(BaseModel):
    asin: str | None = Field(None, min_length=1, max_length=32)
    sku: str | None = Field(None, min_length=1, max_length=128)
    sid: int | None = Field(None, gt=0, description="领星店铺 ID")
    marketplace: str | None = Field(None, max_length=32)
    arguments: dict[str, Any] = Field(
        default_factory=dict,
        description="覆盖或补充领星 erp_listing 工具参数",
    )

    @model_validator(mode="after")
    def validate_identifier(self):
        if not self.asin and not self.sku:
            raise ValueError("asin 和 sku 至少填写一个")
        return self


class LingxingMcpToolCallRequest(BaseModel):
    arguments: dict[str, Any] = Field(default_factory=dict)


class LingxingMcpStatus(BaseModel):
    configured: bool
    protocol_version: str
    transport: Literal["streamable-http"] = "streamable-http"
