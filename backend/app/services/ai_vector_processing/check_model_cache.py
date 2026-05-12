#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
检查AI模型缓存目录
"""
import os
from config.config import MODEL_CACHE_DIR

print(f'模型缓存目录: {MODEL_CACHE_DIR}')
print(f'目录存在: {os.path.exists(MODEL_CACHE_DIR)}')

if os.path.exists(MODEL_CACHE_DIR):
    contents = os.listdir(MODEL_CACHE_DIR)
    print(f'目录内容数量: {len(contents)}')
    if contents:
        print(f'目录内容: {contents[:10]}')
else:
    print('目录不存在，需要下载模型')