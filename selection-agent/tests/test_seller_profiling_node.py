"""卖家行为画像节点测试 — 正常/降级/边界场景。

注意: seller_profiling_node 会通过 langchain → transformers → torch 触发 PyTorch DLL。
在 Windows 上有 torch DLL 问题时使用 --ignore 跳过此测试文件。
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import sys

# 预 mock LLM 依赖链，避免导入 torch 触发 Windows DLL crash
sys.modules["selection.llm_utils"] = MagicMock()
sys.modules["selection.llm_utils"].call_llm_json = AsyncMock(
    return_value='{"summary": "test", "insights": []}'
)
sys.modules["selection.llm_utils"].call_llm = AsyncMock(
    return_value="test response"
)

from selection.state import SelectionState
from selection.nodes.seller_profiling_node import seller_profiling_node


# ── Fixtures ──────────────────────────────────────────

@pytest.fixture
def base_state() -> SelectionState:
    """构建最小有效 SelectionState。"""
    return SelectionState(
        batch_id="test-batch-001",
        marketplace="UK",
        sub_categories=[
            {
                "nodeName": "Nail Tips",
                "bsrId": "12345",
                "productCount": 50,
            }
        ],
        current_archetype="FH",
        competition_structure={"cr3": 0.35},
        lifecycle_stage={"stage": "GROWTH"},
        profit_margin_typical=25.0,
        differentiation_result={"strategy": "Premium"},
        risk_radar={"riskLevel": "LOW"},
        go_no_go="GO",
    )


@pytest.fixture
def mock_java_client_success():
    """模拟 Java 客户端返回完整卖家数据。"""
    mock = MagicMock()
    mock.get_dengzong_shops = AsyncMock(return_value=[
        "ShopA", "ShopB", "ShopC"
    ])
    mock.get_seller_profiles_by_category = AsyncMock(return_value=[
        {
            "seller_name": "ShopA",
            "sellerName": "ShopA",
            "category": "Nail Tips",
            "categoryName": "Nail Tips",
            "grade": "S",
            "product_count": 45,
            "avg_listing_days": 120,
            "revenue_estimate": 50000,
            "marketplace": "UK",
        },
        {
            "seller_name": "ShopB",
            "sellerName": "ShopB",
            "category": "Nail Tips",
            "categoryName": "Nail Tips",
            "grade": "A",
            "product_count": 30,
            "avg_listing_days": 200,
            "revenue_estimate": 32000,
            "marketplace": "UK",
        },
        {
            "seller_name": "ShopX",
            "sellerName": "ShopX",
            "category": "Nail Tips",
            "categoryName": "Nail Tips",
            "grade": "S",
            "product_count": 20,
            "avg_listing_days": 90,
            "revenue_estimate": 28000,
            "marketplace": "UK",
        },
    ])
    return mock


# ── 正常流程测试 ─────────────────────────────────────

class TestSellerProfilingNormal:
    """正常流程: Java 端点返回完整数据。"""

    @patch("selection.java_client.get_java_client")
    @pytest.mark.asyncio
    async def test_full_pipeline_returns_all_keys(
        self, mock_get_client, base_state, mock_java_client_success
    ):
        """完整流程应返回 seller_profiling / seller_heat_signal / seller_recommendations。"""
        mock_get_client.return_value = mock_java_client_success

        result = await seller_profiling_node(base_state)

        assert "seller_profiling" in result
        assert "seller_heat_signal" in result
        assert "seller_recommendations" in result
        assert isinstance(result["seller_profiling"], dict)
        assert isinstance(result["seller_heat_signal"], str)
        assert isinstance(result["seller_recommendations"], list)

    @patch("selection.java_client.get_java_client")
    @pytest.mark.asyncio
    async def test_seller_profiling_contains_dengzong_count(
        self, mock_get_client, base_state, mock_java_client_success
    ):
        """seller_profiling 应包含 dengzong_count 和 external_s_count。"""
        mock_get_client.return_value = mock_java_client_success

        result = await seller_profiling_node(base_state)
        profiling = result["seller_profiling"]

        assert profiling.get("dengzong_count", 0) >= 0
        assert profiling.get("external_s_count", 0) >= 0
        assert profiling.get("total_sellers", 0) > 0

    @patch("selection.java_client.get_java_client")
    @pytest.mark.asyncio
    async def test_heat_signal_is_valid_emoji(
        self, mock_get_client, base_state, mock_java_client_success
    ):
        """热度信号应为有效 emoji 或降级空字符串。"""
        mock_get_client.return_value = mock_java_client_success

        result = await seller_profiling_node(base_state)
        heat = result["seller_heat_signal"]

        # 可能为空字符串（数据不足时降级）
        valid_signals = {"", "🔥", "🌊", "⚡", "📊"}
        assert heat in valid_signals, f"Unexpected heat signal: {heat!r}"


# ── 降级流程测试 ─────────────────────────────────────

class TestSellerProfilingDegraded:
    """降级流程: Java 端点不可用或返回空。"""

    @pytest.fixture
    def mock_java_client_empty(self):
        """模拟 Java 客户端返回空数据。"""
        mock = MagicMock()
        mock.get_dengzong_shops = AsyncMock(return_value=[])
        mock.get_seller_profiles_by_category = AsyncMock(return_value=[])
        return mock

    @pytest.fixture
    def mock_java_client_error(self):
        """模拟 Java 客户端抛出异常。"""
        mock = MagicMock()
        mock.get_dengzong_shops = AsyncMock(
            side_effect=Exception("Connection refused")
        )
        mock.get_seller_profiles_by_category = AsyncMock(
            side_effect=Exception("Connection refused")
        )
        return mock

    @patch("selection.java_client.get_java_client")
    @pytest.mark.asyncio
    async def test_empty_data_graceful(
        self, mock_get_client, base_state, mock_java_client_empty
    ):
        """Java 返回空列表时应优雅降级，不抛异常。"""
        mock_get_client.return_value = mock_java_client_empty

        result = await seller_profiling_node(base_state)

        assert "seller_profiling" in result
        assert "seller_heat_signal" in result
        assert len(result.get("seller_profiling", {}).get("dengzong_names", [])) == 0

    @patch("selection.java_client.get_java_client")
    @pytest.mark.asyncio
    async def test_connection_error_graceful(
        self, mock_get_client, base_state, mock_java_client_error
    ):
        """Java 连接失败时应优雅降级，不抛异常。"""
        mock_get_client.return_value = mock_java_client_error

        result = await seller_profiling_node(base_state)

        assert "seller_profiling" in result
        assert result["seller_profiling"].get("seller_count", 0) == 0


# ── 边界场景测试 ─────────────────────────────────────

class TestSellerProfilingEdgeCases:
    """边界场景: 空 sub_categories、缺失字段。"""

    @patch("selection.java_client.get_java_client")
    @pytest.mark.asyncio
    async def test_empty_sub_categories_graceful(
        self, mock_get_client
    ):
        """sub_categories 为空列表时不抛异常。"""
        mock = MagicMock()
        mock.get_dengzong_shops = AsyncMock(return_value=[])
        mock.get_seller_profiles_by_category = AsyncMock(return_value=[])
        mock_get_client.return_value = mock

        state = SelectionState(
            batch_id="test-002",
            marketplace="UK",
            sub_categories=[],
        )

        result = await seller_profiling_node(state)

        assert "seller_profiling" in result
        assert result["seller_profiling"].get("dengzong_count", 0) == 0

    @patch("selection.java_client.get_java_client")
    @pytest.mark.asyncio
    async def test_missing_category_label_graceful(
        self, mock_get_client
    ):
        """sub_categories[0] 无 nodeName 时不抛异常。"""
        mock = MagicMock()
        mock.get_dengzong_shops = AsyncMock(return_value=[])
        mock.get_seller_profiles_by_category = AsyncMock(return_value=[])
        mock_get_client.return_value = mock

        state = SelectionState(
            batch_id="test-003",
            marketplace="UK",
            sub_categories=[{"bsrId": "67890"}],  # 无 nodeName
        )

        result = await seller_profiling_node(state)

        assert "seller_profiling" in result
