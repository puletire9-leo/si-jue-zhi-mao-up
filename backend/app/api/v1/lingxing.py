"""
[参考] 领星导入API - 暂留
=========================

[WARN] 前端仍在使用此模块的三个接口（upload-image/download-template/generate-import-file），
      Java 侧暂未实现，因此保留此文件。
      等 Java LingxingController 实现对应功能后再删除。

涉及前端：
  - frontend/src/api/lingxing.ts (upload-image, download-template, upload-template)
  - frontend/src/views/Lingxing/Import/index.vue (generate-import-file, download-template, upload-template)
"""

"""
领星导入模块API

提供领星导入相关的后端接口，包括：
- 图片上传到腾讯云COS
- Excel文件生成
- 模板下载
"""

import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Body
from fastapi.responses import FileResponse
from typing import Optional, List
import logging

from ...middleware.auth_middleware import require_auth
from ...services.cos_service import cos_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lingxing", tags=["领星导入"])

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
_BUNDLED_TEMPLATE = os.path.join(
    _BACKEND_ROOT, "领星", "导入领星", "读取文件信息", "产品汇总表-模版 .xlsx"
)
_OVERRIDE_DIR = os.environ.get(
    "LINGXING_TEMPLATE_DIR",
    os.path.join(_BACKEND_ROOT, "下载缓存", "lingxing_templates"),
)
_OVERRIDE_TEMPLATE = os.path.join(_OVERRIDE_DIR, "产品汇总表-模版.xlsx")
_DOWNLOAD_NAME = "产品汇总表-模版.xlsx"
_XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _resolve_template_path() -> str:
    if os.path.isfile(_OVERRIDE_TEMPLATE):
        return _OVERRIDE_TEMPLATE
    return _BUNDLED_TEMPLATE


@router.get("/download-template", summary="下载领星导入模板")
async def download_template(
    request: Request,
    user_info: dict = Depends(require_auth)
):
    """下载领星导入模板。优先用「修改模板」上传的文件，没有则用镜像内置模板。"""
    try:
        template_path = _resolve_template_path()
        if not os.path.exists(template_path):
            logger.error(f"模板文件不存在: {template_path}")
            raise HTTPException(status_code=404, detail="模板文件不存在")

        logger.info(f"下载模板文件: {template_path}")
        return FileResponse(
            path=template_path,
            filename=_DOWNLOAD_NAME,
            media_type=_XLSX_TYPE,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"下载模板失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"下载模板失败: {str(e)}")


@router.post("/upload-template", summary="上传并替换领星导入模板")
async def upload_template(
    request: Request,
    file: UploadFile = File(..., description="产品汇总表 Excel 模板"),
    user_info: dict = Depends(require_auth),
):
    """把新模板写到下载缓存卷，立刻生效，不需要重新部署。"""
    filename = (file.filename or "").strip()
    if not filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="只支持 .xlsx 模板")

    content = await file.read()
    if len(content) < 4 or content[:2] != b"PK":
        raise HTTPException(status_code=400, detail="文件不是有效的 Excel 模板")
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="模板不能超过 20MB")

    os.makedirs(_OVERRIDE_DIR, exist_ok=True)
    tmp_path = _OVERRIDE_TEMPLATE + ".tmp"
    with open(tmp_path, "wb") as f:
        f.write(content)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp_path, _OVERRIDE_TEMPLATE)
    logger.info("领星导入模板已更新: user=%s size=%s", user_info.get("username") or user_info.get("id"), len(content))
    return {
        "code": 200,
        "message": "模板已更新，下载模板将使用新文件",
        "data": {"filename": _DOWNLOAD_NAME, "size": len(content)},
    }


@router.post("/upload-image", summary="上传图片到领星COS")
async def upload_lingxing_image(
    request: Request,
    file: UploadFile = File(..., description="图片文件"),
    user_info: dict = Depends(require_auth)
):
    """
    上传图片到领星专用的腾讯云COS
    
    Args:
        file: 图片文件（支持jpg、png、jpeg、webp等格式）
        
    Returns:
        dict: 包含上传结果和图片URL
    """
    try:
        # 验证文件类型
        allowed_types = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"不支持的文件类型: {file.content_type}，请上传图片文件"
            )
        
        # 读取文件内容
        content = await file.read()
        
        # 验证文件大小（最大10MB）
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=400, 
                detail="图片大小不能超过10MB"
            )
        
        # 上传到COS - 使用lingxing专用的bucket
        # 注意：这里使用cos_service，但需要在配置中指定lingxing的bucket
        success, object_key, url = await cos_service.upload_image(
            image_data=content,
            filename=file.filename,
            image_type="lingxing"  # 使用lingxing类型，会在cos_service中处理
        )
        
        if not success:
            raise HTTPException(
                status_code=500, 
                detail="图片上传到COS失败"
            )
        
        logger.info(f"领星图片上传成功: {file.filename} -> {url}")
        
        return {
            "code": 200,
            "message": "图片上传成功",
            "data": {
                "url": url,
                "object_key": object_key,
                "filename": file.filename
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"领星图片上传失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"图片上传失败: {str(e)}"
        )


@router.post("/generate-import-file", summary="生成领星导入文件")
async def generate_import_file(
    request: Request,
    developer: str = Body('', description="开发人名称"),
    file_data: List[dict] = Body([], description="前端解析的Excel数据"),
    user_info: dict = Depends(require_auth)
):
    """
    执行导入零星.py脚本生成领星导入文件
    
    Args:
        developer: 开发人名称
        file_data: 前端解析的Excel数据数组
    
    Returns:
        FileResponse: 生成的Excel文件
    """
    import subprocess
    import tempfile
    import shutil
    import pandas as pd
    
    try:
        # Python脚本路径（动态计算项目根目录）
        _project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        script_path = os.path.join(_project_root, '领星', '导入领星', '导入零星.py')
        
        # 检查脚本是否存在
        if not os.path.exists(script_path):
            logger.error(f"脚本文件不存在: {script_path}")
            raise HTTPException(
                status_code=404,
                detail="生成脚本不存在"
            )
        
        # 检查是否有数据
        if not file_data or len(file_data) == 0:
            raise HTTPException(
                status_code=400,
                detail="没有数据可生成"
            )
        
        logger.info(f"开始生成领星导入文件, 开发人: {developer}, 数据条数: {len(file_data)}")
        logger.info(f"数据样例: {file_data[0] if file_data else '无'}")
        
        # 将前端数据转换为DataFrame并保存为临时Excel文件
        try:
            df = pd.DataFrame(file_data)
            # 源表缺列时补空列，避免脚本因「缺失关键列」直接失败
            # （例如部分开发人 Excel 没有中文/英文报关名）
            required_source_columns = [
                "SKU", "产品名称", "长cm", "宽cm", "高cm", "毛重（kg）",
                "采购费用", "供应商链接", "供应商", "英国海关编码",
                "中文报关名", "英文报关名", "图片url",
            ]
            missing_source_cols = [c for c in required_source_columns if c not in df.columns]
            if missing_source_cols:
                logger.warning(f"源数据缺少列，已补空列: {missing_source_cols}")
                for col in missing_source_cols:
                    df[col] = ""
            logger.info(f"DataFrame列: {df.columns.tolist()}")
            logger.info(f"DataFrame形状: {df.shape}")
        except Exception as e:
            logger.error(f"创建DataFrame失败: {e}")
            raise HTTPException(status_code=400, detail=f"数据格式错误: {str(e)}")
        
        # 创建项目目录下的临时目录（避免系统临时目录空间不足）
        project_temp_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'temp', 'lingxing')
        os.makedirs(project_temp_dir, exist_ok=True)
        temp_dir = tempfile.mkdtemp(dir=project_temp_dir)
        source_file = os.path.join(temp_dir, 'source_data.xlsx')
        
        # 保存为Excel，使用openpyxl引擎
        try:
            df.to_excel(source_file, index=False, engine='openpyxl')
            logger.info(f"源数据已保存到临时文件: {source_file}")
        except Exception as e:
            logger.error(f"保存Excel失败: {e}")
            # 尝试使用csv格式作为备选
            csv_file = os.path.join(temp_dir, 'source_data.csv')
            df.to_csv(csv_file, index=False, encoding='utf-8-sig')
            logger.info(f"源数据已保存为CSV: {csv_file}")
            source_file = csv_file
        
        # 创建临时文件用于存储生成的文件路径
        output_path_file = os.path.join(temp_dir, 'output_path.txt')
        
        # 构建命令行参数
        cmd_args = [
            'python', script_path,
            '--output-path-file', output_path_file,
            '--source-file', source_file
        ]

        # 如果指定了开发人，添加到参数中
        if developer:
            cmd_args.extend(['--developer', developer])

        # 读取人员名单,两层来源:
        #   1. system_config.lingxing_default_* (设置页配置的默认值)
        #   2. users 表 role LIKE 查询兜底
        # 前端 selectedDeveloper 已通过 CLI --developer 传入,若设置里有默认值则用它替换兜底
        mysql_repo = request.app.state.mysql

        try:
            cfg_rows = await mysql_repo.execute_query(
                "SELECT config_key, config_value FROM system_config "
                "WHERE config_key IN ('lingxing_default_developer', "
                "'lingxing_default_operators', 'lingxing_default_purchaser')"
            )
            cfg = {r["config_key"]: (r["config_value"] or "").strip() for r in (cfg_rows or [])}
        except Exception as e:
            logger.warning(f"读取领星默认配置失败,走 users 表兜底: {e}")
            cfg = {}

        # 开发人:优先前端选择,其次配置默认,不覆盖已通过 --developer 传入的值
        if not developer and cfg.get("lingxing_default_developer"):
            cmd_args.extend(['--developer', cfg["lingxing_default_developer"]])

        # 产品负责人:优先配置默认,否则 users 表 role LIKE '%运营%' 全量兜底
        pm_names = cfg.get("lingxing_default_operators", "")
        if not pm_names:
            try:
                pm_rows = await mysql_repo.execute_query(
                    "SELECT username FROM users WHERE role LIKE '%运营%' ORDER BY id ASC"
                )
                pm_names = ",".join(r["username"] for r in pm_rows) if pm_rows else ""
            except Exception as e:
                logger.warning(f"读取 users 表运营名单失败: {e}")
                pm_names = ""
        if pm_names:
            cmd_args.extend(['--product-manager', pm_names])

        # 采购员:优先配置默认,否则 users 表 role LIKE '%采购员%' 取第一个
        purchaser_name = cfg.get("lingxing_default_purchaser", "")
        if not purchaser_name:
            try:
                purchaser_rows = await mysql_repo.execute_query(
                    "SELECT username FROM users WHERE role LIKE '%采购员%' AND status=1 ORDER BY id ASC LIMIT 1"
                )
                if purchaser_rows:
                    purchaser_name = purchaser_rows[0]["username"]
            except Exception as e:
                logger.warning(f"读取 users 表采购员名单失败: {e}")
        if purchaser_name:
            cmd_args.extend(['--purchaser', purchaser_name])
        
        # 执行Python脚本
        result = subprocess.run(
            cmd_args,
            capture_output=True,
            cwd=os.path.dirname(script_path)
        )
        
        # 记录输出（处理编码问题）
        try:
            stdout = result.stdout.decode('utf-8') if result.stdout else ''
        except UnicodeDecodeError:
            stdout = result.stdout.decode('gbk', errors='ignore') if result.stdout else ''
        
        try:
            stderr = result.stderr.decode('utf-8') if result.stderr else ''
        except UnicodeDecodeError:
            stderr = result.stderr.decode('gbk', errors='ignore') if result.stderr else ''
        
        logger.info(f"脚本输出: {stdout}")
        if stderr:
            logger.error(f"脚本错误: {stderr}")
        
        # 检查执行结果
        if result.returncode != 0:
            # 清理临时目录
            shutil.rmtree(temp_dir, ignore_errors=True)
            error_msg = stderr if stderr else stdout
            logger.error(f"脚本执行失败: {error_msg}")
            summary = "未知错误"
            for line in reversed((error_msg or "").splitlines()):
                stripped = line.strip()
                if stripped.startswith(("ValueError:", "KeyError:", "FileNotFoundError:", "OSError:")):
                    summary = stripped.split(":", 1)[-1].strip() or stripped
                    break
            else:
                summary = (error_msg or "")[:300]
            raise HTTPException(
                status_code=500,
                detail=f"生成文件失败: {summary}"
            )
        
        # 读取生成的文件路径
        output_path = None
        if os.path.exists(output_path_file):
            with open(output_path_file, 'r') as f:
                output_path = f.read().strip()
            logger.info(f"从临时文件读取的路径: {output_path}")
        
        if not output_path or not os.path.exists(output_path):
            # 清理临时目录
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise HTTPException(
                status_code=404,
                detail="生成的文件不存在"
            )
        
        # 获取文件名（强制使用正确的文件名）
        # filename = os.path.basename(output_path)
        filename = "导入领星表.xlsx"  # 强制使用正确的文件名
        
        logger.info(f"生成文件成功: {output_path}, 使用文件名: {filename}")
        
        # 读取文件内容到内存
        with open(output_path, 'rb') as f:
            file_content = f.read()
        
        # 清理临时目录
        shutil.rmtree(temp_dir, ignore_errors=True)
        
        # 创建内存中的响应
        from fastapi.responses import StreamingResponse
        import io
        from urllib.parse import quote
        
        # 对文件名进行URL编码，避免中文编码问题
        encoded_filename = quote(filename, safe='')
        
        return StreamingResponse(
            io.BytesIO(file_content),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
        )
        
    except HTTPException:
        # 清理临时目录
        if 'temp_dir' in locals() and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as e:
        # 清理临时目录
        if 'temp_dir' in locals() and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        logger.error(f"生成领星导入文件失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"生成文件失败: {str(e)}"
        )
