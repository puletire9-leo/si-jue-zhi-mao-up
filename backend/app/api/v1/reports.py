"""
[参考] 报表管理API - 待废弃
=========================

[WARN] 此模块已迁移到 Java 后端: ReportController.java

最终删除日期：项目稳定运行后
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
import subprocess
import os
import json
from typing import Dict, Any, Optional

router = APIRouter()

# 脚本路径
REPORT_SCRIPT_PATH = r"e:\项目\开发\主系统-mysql\scripts\analysis\generate_liumiao_report_final.py"
# 报告目录
REPORTS_DIR = r"e:\项目\开发\主系统-mysql\docs\reports"


from fastapi.responses import JSONResponse

@router.post("/generate", response_model=Dict[str, Any])
async def generate_reports(background_tasks: BackgroundTasks):
    """
    生成报告
    异步执行报告生成脚本，避免长时间阻塞
    """
    try:
        # 检查脚本文件是否存在
        if not os.path.exists(REPORT_SCRIPT_PATH):
            raise HTTPException(status_code=404, detail="报告生成脚本不存在")
        
        # 异步执行脚本
        background_tasks.add_task(_execute_report_script)
        
        response_data = {
            "code": 200,
            "message": "报告生成任务已启动，请稍候查看结果",
            "data": {
                "status": "started",
                "message": "报告生成中，请耐心等待..."
            }
        }
        
        # 显式设置响应头，确保UTF-8编码
        return JSONResponse(
            content=response_data,
            headers={"Content-Type": "application/json; charset=utf-8"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"启动报告生成任务失败: {str(e)}")


def _execute_report_script():
    """
    执行报告生成脚本
    注意：此函数在后台执行，不会阻塞API响应
    """
    try:
        # 执行脚本
        result = subprocess.run(
            ["python", REPORT_SCRIPT_PATH],
            capture_output=True,
            text=True,
            encoding='utf-8',  # 显式指定编码为UTF-8，避免UnicodeDecodeError
            errors='replace',  # 处理无效的UTF-8字符，用替换字符代替
            timeout=600  # 10分钟超时
        )
        
        # 记录执行结果
        print(f"报告生成脚本执行完成，返回码: {result.returncode}")
        print(f"标准输出: {result.stdout}")
        print(f"标准错误: {result.stderr}")
        
    except subprocess.TimeoutExpired:
        print("报告生成脚本执行超时")
    except Exception as e:
        print(f"执行报告生成脚本时发生错误: {str(e)}")


@router.get("/{developer}", response_model=Dict[str, Any])
async def get_report(developer: str):
    """
    获取报告内容
    
    Args:
        developer: 开发人员名称，'total'表示整体报告
    """
    try:
        # 构建文件路径
        if developer == "total":
            file_name = "思觉智贸总结_总.md"
        else:
            file_name = f"思觉智贸总结_{developer}.md"
        
        report_path = os.path.join(REPORTS_DIR, file_name)
        
        # 检查文件是否存在
        if not os.path.exists(report_path):
            raise HTTPException(status_code=404, detail=f"报告文件不存在: {file_name}")
        
        # 读取文件内容
        with open(report_path, "r", encoding="utf-8") as f:
            content = f.read()
        
        response_data = {
            "code": 200,
            "message": "获取报告成功",
            "data": {
                "content": content,
                "developer": developer,
                "file_name": file_name
            }
        }
        
        # 显式设置响应头，确保UTF-8编码
        return JSONResponse(
            content=response_data,
            headers={"Content-Type": "application/json; charset=utf-8"}
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取报告失败: {str(e)}")


@router.get("/list/files", response_model=Dict[str, Any])
async def list_report_files():
    """
    获取报告文件列表
    """
    try:
        # 检查报告目录是否存在
        if not os.path.exists(REPORTS_DIR):
            response_data = {
                "code": 200,
                "message": "报告目录不存在",
                "data": {
                    "files": []
                }
            }
            return JSONResponse(
                content=response_data,
                headers={"Content-Type": "application/json; charset=utf-8"}
            )
        
        # 列出报告文件
        files = []
        for file_name in os.listdir(REPORTS_DIR):
            if file_name.endswith(".md"):
                file_path = os.path.join(REPORTS_DIR, file_name)
                files.append({
                    "name": file_name,
                    "size": os.path.getsize(file_path),
                    "modified": os.path.getmtime(file_path)
                })
        
        response_data = {
            "code": 200,
            "message": "获取报告文件列表成功",
            "data": {
                "files": files
            }
        }
        
        # 显式设置响应头，确保UTF-8编码
        return JSONResponse(
            content=response_data,
            headers={"Content-Type": "application/json; charset=utf-8"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取报告文件列表失败: {str(e)}")
