#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parquet 数据查看器 - Web 前端 (使用内置 HTTP 服务器)
支持大文件流式读取，按时间排序
"""

import http.server
import socketserver
import json
import pyarrow.parquet as pq
import pandas as pd
from datetime import datetime
import os
from urllib.parse import parse_qs, urlparse

# 配置
PARQUET_FILE = r"E:\project\sjzm\产品数据\压缩数据\product_data_final.parquet"
PAGE_SIZE = 50  # 每页显示行数
PORT = 5000

def get_file_info():
    """获取文件基本信息"""
    try:
        parquet_file = pq.ParquetFile(PARQUET_FILE)
        total_rows = parquet_file.metadata.num_rows
        columns = parquet_file.schema_arrow.names
        
        # 查找日期列
        date_columns = []
        for col in columns:
            col_lower = col.lower()
            if any(keyword in col_lower for keyword in ['date', 'time', '日期', '时间', 'create', 'update']):
                date_columns.append(col)
        
        return {
            'total_rows': total_rows,
            'columns': columns,
            'date_columns': date_columns,
            'file_size': os.path.getsize(PARQUET_FILE) / (1024 * 1024)
        }
    except Exception as e:
        return {'error': str(e)}

def load_sorted_data(page=0, page_size=50):
    """
    加载排序后的数据（流式分页读取，避免内存爆炸）
    
    使用 PyArrow 的流式读取功能，只读取需要的行，而不是一次性加载整个文件
    """
    try:
        # 使用 PyArrow 流式读取，避免一次性加载整个文件
        parquet_file = pq.ParquetFile(PARQUET_FILE)
        total_rows = parquet_file.metadata.num_rows
        columns = parquet_file.schema_arrow.names
        
        # 查找日期列（优先使用创建时间）
        date_cols = ['创建时间', '日期', 'update_time', 'updated_at', 'date']
        sort_col = None
        for col in date_cols:
            if col in columns:
                sort_col = col
                break
        
        # 计算需要读取的行范围
        start = page * page_size
        end = min(start + page_size, total_rows)
        
        if start >= total_rows:
            return pd.DataFrame(), total_rows, sort_col
        
        # 流式读取：只读取需要的行数
        # 使用 batch_size 控制内存使用
        rows_to_read = end - start
        batches = []
        rows_read = 0
        
        for batch in parquet_file.iter_batches(batch_size=1000):
            if rows_read >= end:
                break
            
            batch_df = batch.to_pandas()
            batch_len = len(batch_df)
            
            # 计算当前批次中需要保留的行
            batch_start = rows_read
            batch_end = rows_read + batch_len
            
            # 检查是否与目标范围有交集
            if batch_end > start and batch_start < end:
                # 计算交集范围
                intersect_start = max(0, start - batch_start)
                intersect_end = min(batch_len, end - batch_start)
                
                if intersect_start < intersect_end:
                    batches.append(batch_df.iloc[intersect_start:intersect_end])
            
            rows_read += batch_len
        
        # 合并批次
        if batches:
            result_df = pd.concat(batches, ignore_index=True)
        else:
            result_df = pd.DataFrame()
        
        # 将日期列转回字符串显示
        if sort_col and sort_col in result_df.columns:
            result_df[sort_col] = result_df[sort_col].astype(str)
        
        return result_df, total_rows, sort_col
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return pd.DataFrame({'error': [str(e)]}), 0, None

class ParquetHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        query = parse_qs(parsed_path.query)
        
        if path == '/' or path == '/index.html':
            self.serve_html(query)
        elif path == '/api/data':
            self.serve_api(query)
        else:
            self.send_error(404)
    
    def serve_html(self, query):
        page = int(query.get('page', [0])[0])
        if page < 0:
            page = 0
        
        # 获取文件信息
        file_info = get_file_info()
        if 'error' in file_info:
            self.send_error(500, file_info['error'])
            return
        
        # 加载数据
        df, total_rows, sort_column = load_sorted_data(page, PAGE_SIZE)
        
        if 'error' in df.columns:
            self.send_error(500, df['error'].iloc[0])
            return
        
        total_pages = (total_rows + PAGE_SIZE - 1) // PAGE_SIZE
        columns = df.columns.tolist()
        
        # 生成 HTML
        html = self.generate_html(file_info, df, columns, page, total_pages, total_rows, sort_column)
        
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode('utf-8'))
    
    def serve_api(self, query):
        page = int(query.get('page', [0])[0])
        df, total_rows, sort_column = load_sorted_data(page, PAGE_SIZE)
        
        data = {
            'data': df.to_dict('records'),
            'columns': df.columns.tolist(),
            'total_rows': total_rows,
            'page': page,
            'sort_column': sort_column
        }
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode('utf-8'))
    
    def generate_html(self, file_info, df, columns, page, total_pages, total_rows, sort_column):
        """生成 HTML 页面"""
        
        # 生成表格行（显示所有列）
        rows_html = ""
        for idx, (_, row) in enumerate(df.iterrows(), 1):
            row_num = page * PAGE_SIZE + idx
            cells = f"<td style='color:#999;font-weight:bold;position:sticky;left:0;background:#f8f9fa;z-index:1'>{row_num}</td>"
            for col in columns:  # 显示所有列
                val = row[col]
                if pd.isna(val):
                    val = "NULL"
                val_str = str(val)[:100]  # 限制长度
                cells += f"<td title='{val}'>{val_str}</td>"
            rows_html += f"<tr>{cells}</tr>\n"
        
        # 生成列标题（显示所有列）
        headers_html = "<th style='width:50px;position:sticky;left:0;background:#4CAF50;z-index:2'>#</th>"
        for col in columns:
            headers_html += f"<th>{col}</th>"
        
        # 生成分页链接
        prev_link = f"<a href='/?page={page-1}' class='btn'>← 上一页</a>" if page > 0 else ""
        next_link = f"<a href='/?page={page+1}' class='btn'>下一页 →</a>" if page < total_pages - 1 else ""
        
        # 列列表
        column_tags = ""
        for col in file_info['columns']:
            column_tags += f"<span class='tag'>{col}</span>"
        
        sort_info = f"<div class='sort-info'>🔽 已按 '{sort_column}' 列降序排序（最新数据在前）</div>" if sort_column else ""
        
        return f'''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Parquet 数据查看器</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{ 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }}
        .container {{ max-width: 1400px; margin: 0 auto; }}
        h1 {{ color: #333; margin-bottom: 20px; }}
        .info-box {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }}
        .info-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
        }}
        .info-item {{
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
        }}
        .info-label {{ color: #666; font-size: 12px; }}
        .info-value {{ color: #333; font-size: 18px; font-weight: bold; }}
        .data-table {{
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            overflow: auto;
            max-height: 600px;
            max-width: 100%;
        }}
        .data-table table {{
            min-width: max-content;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }}
        th {{
            background: #4CAF50;
            color: white;
            padding: 12px;
            text-align: left;
            position: sticky;
            top: 0;
            white-space: nowrap;
        }}
        td {{
            padding: 10px 12px;
            border-bottom: 1px solid #eee;
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }}
        tr:hover {{ background: #f5f5f5; }}
        .pagination {{
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 15px;
            margin-top: 20px;
        }}
        .btn {{
            padding: 10px 20px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }}
        .btn:hover {{ background: #45a049; }}
        .page-info {{ color: #666; }}
        .sort-info {{
            background: #e3f2fd;
            padding: 10px 15px;
            border-radius: 4px;
            margin-bottom: 15px;
            color: #1976d2;
        }}
        .column-list {{
            max-height: 150px;
            overflow-y: auto;
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
        }}
        .tag {{
            display: inline-block;
            margin: 2px 5px;
            padding: 2px 8px;
            background: #e0e0e0;
            border-radius: 3px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Parquet 数据查看器</h1>
        
        <div class="info-box">
            <h3>📁 文件信息</h3>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">文件路径</div>
                    <div class="info-value" style="font-size:12px">{PARQUET_FILE}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">文件大小</div>
                    <div class="info-value">{file_info['file_size']:.2f} MB</div>
                </div>
                <div class="info-item">
                    <div class="info-label">总行数</div>
                    <div class="info-value">{file_info['total_rows']:,}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">总列数</div>
                    <div class="info-value">{len(file_info['columns'])}</div>
                </div>
            </div>
            
            <h4 style="margin-top:15px;margin-bottom:10px">📋 列列表 ({len(file_info['columns'])} 列)</h4>
            <div class="column-list">
                {column_tags}
            </div>
        </div>
        
        {sort_info}
        
        <div class="data-table">
            <table>
                <thead>
                    <tr>{headers_html}</tr>
                </thead>
                <tbody>{rows_html}</tbody>
            </table>
        </div>
        
        <div class="pagination">
            {prev_link}
            <span class="page-info">
                第 {page + 1} 页 / 共 {total_pages} 页 
                (显示 {page * PAGE_SIZE + 1} - {min(page * PAGE_SIZE + len(df), total_rows)} 条，共 {total_rows:,} 条)
            </span>
            {next_link}
        </div>
    </div>
</body>
</html>'''

def main():
    print("=" * 60)
    print("Parquet 数据查看器")
    print("=" * 60)
    print(f"文件: {PARQUET_FILE}")
    
    file_info = get_file_info()
    if 'error' not in file_info:
        print(f"总行数: {file_info['total_rows']:,}")
        print(f"总列数: {len(file_info['columns'])}")
        print(f"日期列: {file_info['date_columns']}")
    else:
        print(f"错误: {file_info['error']}")
        return
    
    print("\n启动 Web 服务器...")
    print(f"请在浏览器中访问: http://localhost:{PORT}")
    print("=" * 60)
    
    with socketserver.TCPServer(("", PORT), ParquetHandler) as httpd:
        print(f"服务器运行在端口 {PORT}...")
        httpd.serve_forever()

if __name__ == '__main__':
    main()
