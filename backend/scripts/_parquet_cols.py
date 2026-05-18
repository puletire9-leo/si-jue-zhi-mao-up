import duckdb, sys
sys.stdout.reconfigure(encoding='utf-8')
conn = duckdb.connect()
path = 'e:/项目/si-jue-zhi-mao-up/产品数据/压缩数据/product_data_final.parquet'
# Get first row to understand structure
df = conn.execute(f"SELECT * FROM '{path}' LIMIT 1").fetchdf()
for c in df.columns:
    print(c)
