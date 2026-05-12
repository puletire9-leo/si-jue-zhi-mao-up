import pandas as pd
import json

# 读取Excel文件
file_path = r'e:\项目\生产\主系统-mysql\领星\导入领星\读取文件信息\产品汇总表-刘淼 .xlsx'
df = pd.read_excel(file_path)

# 清理列名（去除换行符和空格）
df.columns = [col.strip() if isinstance(col, str) else col for col in df.columns]

# 显示列名
print('列名:')
for i, col in enumerate(df.columns):
    print(f"  {i+1}. {col}")

print(f'\n总行数: {len(df)}')

# 生成JSON格式模板
print('\n\n=== JSON模板（前3行数据） ===')
template = {
    "file_name": "产品汇总表-刘淼.xlsx",
    "total_rows": len(df),
    "columns": df.columns.tolist(),
    "data": df.head(3).fillna('').to_dict(orient='records')
}

# 保存为JSON文件
output_file = r'e:\项目\生产\主系统-mysql\领星\导入领星\读取文件信息\产品汇总表-刘淼_template.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(template, f, ensure_ascii=False, indent=2)

print(f'\nJSON模板已保存到: {output_file}')
print('\n模板内容预览:')
print(json.dumps(template, ensure_ascii=False, indent=2)[:2000] + '...')
