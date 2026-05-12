#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试双周期对比API
"""
import requests
import json

API_URL = "http://localhost:8002/api/products/period-comparison"

# 测试数据
test_data = {
    "asins": ["B08BZLTFPX"],
    "period_a": {
        "start_date": "2026-02-23",
        "end_date": "2026-03-01"
    },
    "period_b": {
        "start_date": "2026-03-02",
        "end_date": "2026-03-08"
    }
}

print("测试双周期对比API...")
print("=" * 60)
print(f"请求: {API_URL}")
print(f"参数: {json.dumps(test_data, indent=2, ensure_ascii=False)}")
print("=" * 60)

try:
    response = requests.post(API_URL, json=test_data, timeout=30)
    print(f"\n状态码: {response.status_code}")
    
    if response.status_code == 200:
        data = response.json()
        print("\n✅ 请求成功!")
        print("\n周期A数据:")
        print(f"  日期: {data['period_a']['date_range']}")
        print(f"  销量: {data['period_a']['sales']}")
        print(f"  销售额: £{data['period_a']['revenue']}")
        print(f"  毛利润: £{data['period_a']['gross_profit']}")
        print(f"  广告花费: £{data['period_a']['ad_spend']}")
        print(f"  退款率: {data['period_a']['refund_rate']}%")
        
        print("\n周期B数据:")
        print(f"  日期: {data['period_b']['date_range']}")
        print(f"  销量: {data['period_b']['sales']}")
        print(f"  销售额: £{data['period_b']['revenue']}")
        print(f"  毛利润: £{data['period_b']['gross_profit']}")
        print(f"  广告花费: £{data['period_b']['ad_spend']}")
        print(f"  退款率: {data['period_b']['refund_rate']}%")
        
        print("\n变化:")
        print(f"  销量变化: {data['changes']['sales']}%")
        print(f"  销售额变化: {data['changes']['revenue']}%")
        print(f"  是否下滑: {data['is_declining']}")
        if data['is_declining']:
            print(f"  下滑百分比: {data['decline_percent']}%")
    else:
        print(f"\n❌ 请求失败:")
        print(response.text)
        
except Exception as e:
    print(f"\n❌ 错误: {e}")
