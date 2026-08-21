"""领星官方 MCP 的工具发现和产品详情查询服务。"""

from __future__ import annotations

import json
from typing import Any

from ..config import Settings
from .mcp_streamable_http_client import McpClientError, McpStreamableHttpClient


class LingxingMcpConfigurationError(RuntimeError):
    pass


class LingxingMcpArgumentsError(ValueError):
    def __init__(self, message: str, schema: dict[str, Any]) -> None:
        super().__init__(message)
        self.schema = schema


class LingxingMcpService:
    PRODUCT_DETAIL_TOOL = "erp_listing"
    READ_ONLY_TOOLS = {
        "get_my_sids",
        "get_fba_stock_list",
        "erp_listing",
        "query_product_performance_asin_lists",
        "get_profit_report_msku",
        "query_order_profit_list_gross_profit",
        "query_erp_keyword_ranking_keyword",
        "query_erp_keyword_ranking_asin",
        "query_erp_competitive_monitor",
        "query_erp_follow_sale_monitor",
        "query_erp_new_monitor",
        "ad_auth_shops",
        "ad_campaign_report",
        "ad_campaign_group_report",
        "ad_campaign_keyword_report",
        "ad_campaign_search_term_report",
        "ad_campaign_targeting_report",
        "ad_campaign_product_report",
        "ad_portfolio_report_shop",
        "get_custom_report_list",
        "get_custom_report_by_id",
        "get_custom_indicator_list",
        "get_custom_indicator_field",
    }

    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def configured(self) -> bool:
        return bool(self.settings.LINGXING_MCP_URL and self.settings.LINGXING_MCP_KEY)

    def client(self) -> McpStreamableHttpClient:
        if not self.configured:
            raise LingxingMcpConfigurationError(
                "领星 MCP 未配置，请设置 LINGXING_MCP_URL 和 LINGXING_MCP_KEY"
            )
        return McpStreamableHttpClient(
            self.settings.LINGXING_MCP_URL,
            self.settings.LINGXING_MCP_KEY,
            timeout=self.settings.LINGXING_MCP_TIMEOUT,
            protocol_version=self.settings.LINGXING_MCP_PROTOCOL_VERSION,
        )

    async def list_tools(self) -> list[dict[str, Any]]:
        async with self.client() as client:
            return await client.list_tools()

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name not in self.READ_ONLY_TOOLS:
            raise McpClientError(f"工具未列入系统只读白名单：{name}")
        async with self.client() as client:
            tools = await client.list_tools()
            if not any(tool.get("name") == name for tool in tools):
                raise McpClientError(f"领星 MCP 未提供工具：{name}")
            return await client.call_tool(name, arguments)

    async def get_product_detail(
        self,
        *,
        asin: str | None,
        sku: str | None,
        sid: int | None,
        marketplace: str | None,
        arguments: dict[str, Any],
    ) -> dict[str, Any]:
        async with self.client() as client:
            tools = await client.list_tools()
            tool = next(
                (item for item in tools if item.get("name") == self.PRODUCT_DETAIL_TOOL),
                None,
            )
            if tool is None:
                raise McpClientError(
                    f"领星 MCP 未提供产品详情工具：{self.PRODUCT_DETAIL_TOOL}"
                )
            schema = tool.get("inputSchema") or {}
            resolved = self._resolve_arguments(
                schema=schema,
                asin=asin,
                sku=sku,
                sid=sid,
                marketplace=marketplace,
                overrides=arguments,
            )
            result = await client.call_tool(self.PRODUCT_DETAIL_TOOL, resolved)
            records = self._extract_matching_records(result, asin=asin, sku=sku)
            return {
                "tool": self.PRODUCT_DETAIL_TOOL,
                "arguments": resolved,
                "matchCount": len(records),
                "records": records,
                "mcpResult": result,
            }

    @classmethod
    def _extract_matching_records(
        cls,
        result: dict[str, Any],
        *,
        asin: str | None,
        sku: str | None,
    ) -> list[dict[str, Any]]:
        """Decode MCP text blocks and keep only the requested product records."""
        targets = {
            value.strip().casefold()
            for value in (asin, sku)
            if isinstance(value, str) and value.strip()
        }
        matches: list[dict[str, Any]] = []
        seen: set[str] = set()

        def walk(value: Any) -> None:
            if isinstance(value, dict):
                identifiers = {
                    str(value.get(name)).strip().casefold()
                    for name in ("asin", "sku", "msku", "local_sku", "seller_sku")
                    if value.get(name) is not None
                }
                if targets & identifiers:
                    fingerprint = json.dumps(value, sort_keys=True, ensure_ascii=False, default=str)
                    if fingerprint not in seen:
                        seen.add(fingerprint)
                        matches.append(value)
                    return
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)

        for block in result.get("content", []):
            if not isinstance(block, dict):
                continue
            value: Any = block
            if block.get("type") == "text" and isinstance(block.get("text"), str):
                try:
                    value = json.loads(block["text"])
                except json.JSONDecodeError:
                    continue
            walk(value)
        return matches

    @staticmethod
    def _resolve_arguments(
        *,
        schema: dict[str, Any],
        asin: str | None,
        sku: str | None,
        sid: int | None,
        marketplace: str | None,
        overrides: dict[str, Any],
    ) -> dict[str, Any]:
        properties = schema.get("properties") or {}
        resolved = dict(overrides)

        def set_first(names: tuple[str, ...], value: Any) -> None:
            if value is None:
                return
            for name in names:
                if name in properties and name not in resolved:
                    resolved[name] = value
                    return

        identifier = asin or sku
        identifier_field = "asin" if asin else "msku"
        set_first(("asin",), asin)
        set_first(("asins",), [asin] if asin else None)
        set_first(("sku", "msku", "sellerSku", "seller_sku"), sku)
        set_first(("search_value", "searchValue"), [identifier] if identifier else None)
        set_first(("search_field", "searchField"), identifier_field if identifier else None)
        set_first(("exact_search", "exactSearch"), "1" if identifier else None)
        set_first(("sid", "shopId", "shop_id"), sid)
        set_first(("sids",), str(sid) if sid is not None else None)
        set_first(("marketplace", "country", "station", "region"), marketplace)
        set_first(("offset", "page", "pageNo", "page_no"), 0)
        set_first(("length", "pageSize", "page_size", "limit"), 20)

        required = schema.get("required") or []
        for name in required:
            if name in resolved:
                continue
            field_schema = properties.get(name) or {}
            if "default" in field_schema:
                resolved[name] = field_schema["default"]
            elif name == "pvi_ids":
                # 领星 erp_listing 将可选属性筛选标为 required，空字符串表示不筛选。
                resolved[name] = ""
        missing = [name for name in required if name not in resolved]
        if missing:
            names = ", ".join(missing)
            raise LingxingMcpArgumentsError(
                f"领星工具仍缺少必填参数：{names}；请通过 arguments 补充",
                schema,
            )
        return resolved
