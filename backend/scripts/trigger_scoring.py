#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
触发产品评分计算
"""
import requests
import sys

def trigger_scoring(base_url="http://localhost:8000", scope="all"):
    """
    触发评分计算
    scope: "all" - 所有数据, "current_week" - 仅本周数据
    """
    url = f"{base_url}/api/v1/scoring/recalculate"
    
    try:
        response = requests.post(url, json={"scope": scope}, timeout=300)
        if response.status_code == 200:
            result = response.json()
            print(f"评分完成！")
            print(f"总共评分产品数: {result.get('totalScored', 0)}")
            print("\n等级分布:")
            for stat in result.get('gradeStats', []):
                print(f"  {stat['grade']}: {stat['count']} 个产品")
            return True
        else:
            print(f"评分失败: {response.status_code}")
            print(f"错误信息: {response.text}")
            return False
    except Exception as e:
        print(f"请求失败: {e}")
        return False

if __name__ == "__main__":
    scope = sys.argv[1] if len(sys.argv) > 1 else "all"
    base_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8000"
    
    print(f"正在触发评分计算 (scope: {scope})...")
    trigger_scoring(base_url, scope)
