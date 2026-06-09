"""共享测试 fixture。"""
import pytest


@pytest.fixture
def sample_top_brands():
    """典型 topBrands 数据（Nail Tips 品类）。"""
    return [
        {"name": "Beetles", "productCount": 8, "share": 0.16},
        {"name": "Modelones", "productCount": 6, "share": 0.12},
        {"name": "Saviland", "productCount": 5, "share": 0.10},
        {"name": "Morovan", "productCount": 4, "share": 0.08},
        {"name": "Beetles Gel", "productCount": 3, "share": 0.06},
    ]


@pytest.fixture
def sample_sub_category():
    """典型小类数据。"""
    return {
        "nodeName": "Nail Tips",
        "bsrId": "12345",
        "productCount": 50,
        "avgPrice": 7.99,
        "priceMin": 3.99,
        "priceMax": 15.99,
        "avgRating": 4.2,
        "avgRatings": 150,
        "totalUnits": 15000,
        "unitsGrowthRate": 0.15,
        "totalRevenue": 119850,
        "brandCount": 25,
        "topBrands": [
            {"name": "Beetles", "productCount": 8, "share": 0.16},
            {"name": "Modelones", "productCount": 6, "share": 0.12},
            {"name": "Saviland", "productCount": 5, "share": 0.10},
        ],
        "priceBandCounts": {"BUDGET": 5, "LOW": 15, "MID": 20, "PREMIUM": 10},
        "avgListingDays": 180,
        "bestSellerCount": 3,
        "amazonChoiceCount": 2,
        "sampleProducts": [
            {
                "asin": "B001",
                "title": "Nail Tips Set",
                "price": 7.99,
                "units": 500,
                "rating": 4.3,
                "ratings": 200,
                "weightG": 180,
                "dimensions": "20x15x3",
                "fbaFee": 2.5,
                "profit": 1.5,
            },
        ],
    }


@pytest.fixture
def sample_sample_products():
    """样本商品列表（利润计算用）。"""
    return [
        {
            "price": 7.99,
            "weightG": 180,
            "dimensions": "20x15x3cm",
            "fbaFee": 2.50,
            "profit": 1.50,
        },
        {
            "price": 8.99,
            "weightG": 200,
            "dimensions": "22x16x4",
            "fbaFee": 2.80,
            "profit": 2.00,
        },
        {
            "price": 6.99,
            "weightG": 150,
            "dimensions": "18x12x3",
            "fbaFee": 2.20,
            "profit": 0.80,
        },
    ]
