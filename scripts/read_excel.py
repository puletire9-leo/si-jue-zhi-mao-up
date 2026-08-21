# -*- coding: utf-8 -*-
import pandas as pd
import sys

excel_path = r'c:\Users\Admin\Desktop\初选上传20260817_1 - 副本.xlsx'
df = pd.read_excel(excel_path, engine='openpyxl')

with open('excel_structure.txt', 'w', encoding='utf-8') as f:
    f.write(f'总行数: {len(df)}\n\n')
    f.write(f'列名 ({len(df.columns)} 列):\n')
    for i, col in enumerate(df.columns):
        f.write(f'{i:2d}: {col}\n')
    
    f.write('\n前3行数据:\n')
    f.write(df.head(3).to_string())
    
    f.write('\n\n空值统计:\n')
    null_counts = df.isnull().sum()
    for col, count in null_counts.items():
        if count > 0:
            f.write(f'{col}: {count} 个空值\n')

print('已写入 excel_structure.txt')
