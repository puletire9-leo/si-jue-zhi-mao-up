#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试修改要求字段的更新功能
"""

import requests
import json
import sys
import os

# API配置
BASE_URL = "http://localhost:8001"
API_PREFIX = "/api/v1"

# 测试数据
TEST_SKU = "24"
INITIAL_MOD_REQ = "初始测试修改要求"
UPDATED_MOD_REQ = "更新后的测试修改要求"


def test_modification_update():
    """测试修改要求字段的更新功能"""
    print("=== 测试修改要求字段的更新功能 ===")
    
    # 1. 获取初始状态
    print(f"\n1. 获取SKU为'{TEST_SKU}'的定稿初始状态")
    get_url = f"{BASE_URL}{API_PREFIX}/final-drafts/{TEST_SKU}"
    response = requests.get(get_url)
    if response.status_code != 200:
        print(f"[FAIL] 获取定稿失败: {response.status_code} - {response.text}")
        return False
    
    initial_data = response.json()
    print(f"[OK] 获取成功")
    print(f"   当前修改要求: {initial_data['data'].get('modificationRequirement')}")
    
    # 2. 更新修改要求
    print(f"\n2. 更新修改要求为: '{UPDATED_MOD_REQ}'")
    update_url = f"{BASE_URL}{API_PREFIX}/final-drafts/sku/{TEST_SKU}"
    
    # 使用驼峰命名发送请求，模拟前端行为
    update_data = {
        "modificationRequirement": UPDATED_MOD_REQ
    }
    
    response = requests.put(update_url, json=update_data, headers={"Content-Type": "application/json"})
    if response.status_code != 200:
        print(f"[FAIL] 更新失败: {response.status_code} - {response.text}")
        return False
    
    update_result = response.json()
    print(f"[OK] 更新成功")
    print(f"   响应: {json.dumps(update_result, ensure_ascii=False, indent=2)}")
    
    # 3. 验证更新结果
    print(f"\n3. 验证更新结果")
    response = requests.get(get_url)
    if response.status_code != 200:
        print(f"[FAIL] 再次获取定稿失败: {response.status_code} - {response.text}")
        return False
    
    updated_data = response.json()
    actual_mod_req = updated_data['data'].get('modificationRequirement')
    print(f"   实际修改要求: {actual_mod_req}")
    
    if actual_mod_req == UPDATED_MOD_REQ:
        print(f"[OK] 更新验证成功: 修改要求已更新为 '{actual_mod_req}'")
    else:
        print(f"[FAIL] 更新验证失败: 预期 '{UPDATED_MOD_REQ}'，实际 '{actual_mod_req}'")
        return False
    
    # 4. 验证响应字段名格式
    print(f"\n4. 验证响应字段名格式")
    draft_data = updated_data['data']
    
    if 'modificationRequirement' in draft_data:
        print(f"[OK] 响应中包含正确的驼峰命名字段 'modificationRequirement'")
    else:
        print(f"[FAIL] 响应中缺少 'modificationRequirement' 字段")
        return False
    
    if 'modification_requirement' not in draft_data:
        print(f"[OK] 响应中不包含下划线命名字段 'modification_requirement'")
    else:
        print(f"[WARN]  响应中包含下划线命名字段 'modification_requirement'，这可能是问题所在")
    
    # 5. 测试列表接口是否包含修改要求字段
    print(f"\n5. 测试列表接口是否包含修改要求字段")
    list_url = f"{BASE_URL}{API_PREFIX}/final-drafts?search_type=sku&search_content={TEST_SKU}&page=1&size=10"
    response = requests.get(list_url)
    if response.status_code != 200:
        print(f"[FAIL] 获取列表失败: {response.status_code} - {response.text}")
        return False
    
    list_data = response.json()
    if len(list_data['data']['list']) > 0:
        list_item = list_data['data']['list'][0]
        if 'modificationRequirement' in list_item:
            print(f"[OK] 列表项包含修改要求字段: {list_item['modificationRequirement']}")
        else:
            print(f"[FAIL] 列表项缺少修改要求字段")
            return False
    else:
        print(f"[WARN]  列表中未找到测试定稿")
    
    print(f"\n[DONE] 所有测试通过！修改要求字段功能正常")
    return True


if __name__ == "__main__":
    success = test_modification_update()
    sys.exit(0 if success else 1)
