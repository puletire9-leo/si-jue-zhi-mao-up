# utils.py
# 通用工具函数集合，包含数据库操作、图片处理、缓存管理等通用逻辑
import os
import re
import json
import time
import glob
import hashlib
import threading
import traceback
from io import BytesIO
from datetime import datetime
from PIL import Image

# 现在再导入torch - 优雅处理导入失败的情况
torch = None
torch_available = False
try:
    import torch
    torch_available = True
except Exception as e:
    print(f"[WARNING] PyTorch导入失败: {str(e)}")
    print("[WARNING] 系统将使用CPU模式运行，部分功能可能受限")

import pymysql
import requests
from qdrant_client.models import PointStruct

# 导入配置（修复相对导入为绝对导入）
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config.config import (
    SUPPORTED_IMAGE_FORMATS, MODEL_INPUT_SIZE, DEFAULT_IMAGE_BACKGROUND,
    SKU_PREFIX, CACHE_LOCAL_MAXSIZE, CACHE_LOCAL_TTL, REDIS_TTL
)

# ---------------------- 设备选择工具 ----------------------
def get_device():
    """
    获取可用的设备（优先GPU，回退到CPU）
    :return: torch.device 对象或None
    """
    if not torch_available or torch is None:
        print("[WARNING] PyTorch不可用，无法获取设备信息")
        return None
    
    try:
        if torch.cuda.is_available():
            return torch.device("cuda")
        elif hasattr(torch.backends, 'mps') and torch.backends.mps.is_available():
            return torch.device("mps")  # Apple Silicon
        else:
            return torch.device("cpu")
    except Exception as e:
        print(f"[WARNING] 设备检测失败，使用CPU：{str(e)}")
        return torch.device("cpu")

def get_device_info():
    """
    获取设备信息
    :return: dict 设备信息
    """
    if not torch_available or torch is None:
        return {
            "device": "N/A",
            "cuda_available": False,
            "cuda_devices": 0,
            "status": "PyTorch不可用"
        }
    
    device = get_device()
    info = {
        "device": str(device) if device else "N/A",
        "cuda_available": torch.cuda.is_available(),
        "cuda_devices": torch.cuda.device_count() if torch.cuda.is_available() else 0
    }
    
    if torch.cuda.is_available():
        info["cuda_version"] = torch.version.cuda
        info["cuda_memory"] = f"{torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f}GB"
    
    return info

# ---------------------- 数据库工具 ----------------------
class DBUtils:
    """数据库操作工具类"""
    db_pool = None

    @classmethod
    def init_pool(cls, db_config, pool_config):
        """初始化数据库连接池"""
        try:
            from DBUtils.PooledDB import PooledDB
            cls.db_pool = PooledDB(
                creator=pymysql,
                **pool_config,** db_config
            )
            print("数据库连接池初始化成功")
        except ImportError:
            print("警告: DBUtils未安装，使用普通连接")
        except Exception as e:
            print(f"数据库连接池初始化失败: {e}")

    @classmethod
    def get_db(cls):
        """获取数据库连接（兼容连接池/普通连接）"""
        if cls.db_pool:
            return cls.db_pool.connection()
        else:
            return pymysql.connect(**DB_CONFIG)  # DB_CONFIG从config导入

    @staticmethod
    def execute_query(sql, params=None, fetchone=False):
        """执行SQL查询"""
        conn = DBUtils.get_db()
        try:
            with conn.cursor() as cur:
                cur.execute(sql, params or ())
                return cur.fetchone() if fetchone else cur.fetchall()
        finally:
            conn.close()

    @staticmethod
    def normalize_sku(sku_str):
        """标准化SKU（移除前缀）"""
        if not isinstance(sku_str, str):
            return ""
        normalized = re.sub(r'^' + SKU_PREFIX, '', sku_str, flags=re.IGNORECASE).strip()
        if normalized.lower() in ["nan", "none", ""] or not re.match(r'^[0-9a-zA-Z]+$', normalized):
            return ""
        return normalized

    @staticmethod
    def format_date_string(date_str):
        """格式化日期字符串为标准格式"""
        if not date_str or str(date_str).lower() in ['nan', 'none', '']:
            return None
        date_formats = ['%Y-%m-%d', '%Y/%m/%d', '%Y-%m-%d %H:%M:%S', '%m/%d/%Y', '%d/%m/%Y', '%Y年%m月%d日']
        for fmt in date_formats:
            try:
                dt = datetime.strptime(str(date_str).strip(), fmt)
                return dt.strftime('%Y-%m-%d %H:%M:%S')
            except (ValueError, TypeError):
                continue
        return None


# ---------------------- 图片处理工具 ----------------------
class ImageUtils:
    """图片处理工具类"""
    @staticmethod
    def preprocess_image_fast(img_bytes, max_size=None):
        """快速图片预处理（处理通道/尺寸）"""
        max_size = max_size or MODEL_INPUT_SIZE
        if not img_bytes or len(img_bytes) < 100:
            raise ValueError("图片字节流无效或过小")

        img = Image.open(BytesIO(img_bytes))
        # 处理特殊图像模式（透明/调色板/CMYK）
        if img.mode in ['RGBA', 'LA', 'P', 'PA', 'CMYK']:
            background = Image.new('RGB', img.size, DEFAULT_IMAGE_BACKGROUND)
            if img.mode == 'RGBA':
                background.paste(img, mask=img.split()[3])  # 保留透明通道
            else:
                background.paste(img.convert('RGB'))
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        if img.width <= 0 or img.height <= 0 or (img.width == 1 and img.height == 1):
            raise ValueError(f"无效的图片尺寸: {img.size}")

        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        return img

    @staticmethod
    def encode_image_fast(img, model, processor, vector_dimension):
        """图像编码（适配GPU/CPU）"""
        if img.mode != 'RGB':
            img = img.convert('RGB')
        # 确保尺寸正确
        if img.size != (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE):
            img = img.resize((MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), Image.Resampling.LANCZOS)

        inputs = processor(images=img, return_tensors="pt")
        # 设备和精度匹配
        device = next(model.parameters()).device if hasattr(model, 'parameters') else torch.device('cpu')
        model_dtype = next(model.parameters()).dtype if hasattr(model, 'parameters') else torch.float32
        inputs = {k: v.to(device) for k, v in inputs.items()}
        if model_dtype == torch.float16 and torch.cuda.is_available():
            inputs = {k: v.half() if v.dtype == torch.float32 else v for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model(** inputs)
            vec = outputs.last_hidden_state[:, 0, :].squeeze()

        # 精度转换与归一化
        if vec.dtype == torch.float16:
            vec = vec.float()
        vec = vec.cpu()
        norm = torch.norm(vec)
        if norm > 1e-6:
            vec = vec / norm

        vec_list = vec.tolist()
        if len(vec_list) != vector_dimension:
            raise ValueError(f"向量维度错误，预期{vector_dimension}，实际{len(vec_list)}")

        # 清理资源
        del inputs, outputs
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        return vec_list

    @staticmethod
    def get_thumbnail_unique_id(thumbnail_path):
        """生成缩略图唯一标识（基于路径+修改时间）"""
        try:
            abs_path = os.path.abspath(thumbnail_path)
            mtime = str(os.path.getmtime(abs_path))
            unique_str = f"{abs_path}_{mtime}"
            md5_obj = hashlib.md5(unique_str.encode("utf-8"))
            unique_hex = md5_obj.hexdigest()[:16]  # 避免int溢出
            return int(unique_hex, 16), abs_path
        except Exception as e:
            print(f"生成{thumbnail_path}唯一标识失败：{e}")
            return None, None

    @staticmethod
    def is_thumbnail_in_qdrant(q_client, collection_name, thumbnail_path):
        """检查缩略图是否已存在于Qdrant"""
        unique_id, _ = ImageUtils.get_thumbnail_unique_id(thumbnail_path)
        if not unique_id:
            return False
        try:
            response = q_client.retrieve(
                collection_name=collection_name,
                ids=[unique_id],
                with_payload=False,
                with_vectors=False
            )
            return len(response) > 0
        except Exception as e:
            error_str = str(e).lower()
            if "not found" not in error_str and "404" not in error_str:
                print(f"检查Qdrant点失败：{e}")
            return False


# ---------------------- 缓存工具 ----------------------
class CacheUtils:
    """缓存管理工具类"""
    def __init__(self, redis_client=None):
        self.vec_cache_local = {}
        self.redis_client = redis_client

    def get_cached_results(self, img_hash):
        """获取缓存结果（先查本地，再查Redis）"""
        # 本地缓存
        if img_hash in self.vec_cache_local:
            cache_data = self.vec_cache_local[img_hash]
            if time.time() - cache_data['timestamp'] < CACHE_LOCAL_TTL:
                return cache_data['results']
            else:
                del self.vec_cache_local[img_hash]

        # Redis缓存
        if self.redis_client:
            try:
                cached = self.redis_client.get(f"img_search:{img_hash}")
                if cached:
                    import json
                    result = json.loads(cached)
                    self.vec_cache_local[img_hash] = {
                        'results': result,
                        'timestamp': time.time()
                    }
                    return result
            except Exception as e:
                print(f"缓存读取失败: {e}")
        return None

    def set_cached_results(self, img_hash, results):
        """设置缓存（本地+Redis）"""
        # 本地缓存（控制大小）
        self.vec_cache_local[img_hash] = {
            'results': results,
            'timestamp': time.time()
        }
        if len(self.vec_cache_local) > CACHE_LOCAL_MAXSIZE:
            oldest_key = min(self.vec_cache_local.keys(), key=lambda k: self.vec_cache_local[k]['timestamp'])
            del self.vec_cache_local[oldest_key]

        # Redis缓存（异步）
        if self.redis_client:
            def async_redis_set():
                try:
                    import json
                    serialized = json.dumps(results, default=str)
                    self.redis_client.setex(f"img_search:{img_hash}", REDIS_TTL, serialized)
                except Exception as e:
                    print(f"Redis缓存设置失败: {e}")
            threading.Thread(target=async_redis_set, daemon=True).start()


# ---------------------- 文件工具 ----------------------
class FileUtils:
    """文件操作工具类"""
    @staticmethod
    def clean_sku_duplicate_files(sku, orig_dir, thumb_dir):
        """清理SKU的重复文件"""
        try:
            orig_files = glob.glob(os.path.join(orig_dir, f"sku{sku}_*"))
            thumb_files = glob.glob(os.path.join(thumb_dir, f"sku{sku}_*"))
            for file_path in orig_files + thumb_files:
                if os.path.exists(file_path):
                    os.remove(file_path)
            print(f"SKU {sku} 重复文件已清理")
        except Exception as e:
            print(f"清理SKU {sku} 重复文件失败：{e}")

    @staticmethod
    def clean_invalid_files(file_paths):
        """清理无效文件"""
        for file_path in file_paths:
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                print(f"清理文件 {file_path} 失败：{e}")

    @staticmethod
    def is_supported_image_format(file_path):
        """检查文件是否为支持的图片格式"""
        return file_path.lower().endswith(SUPPORTED_IMAGE_FORMATS)


# ---------------------- 日志与设备工具 ----------------------
class DeviceUtils:
    """设备信息工具类"""
    @staticmethod
    def print_gpu_memory():
        """打印GPU内存使用情况"""
        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated() / 1024 **3
            reserved = torch.cuda.memory_reserved() / 1024** 3
            print(f"【GPU内存】已分配: {allocated:.2f}GB, 保留: {reserved:.2f}GB")


# ---------------------- Excel处理工具 ----------------------
class ExcelUtils:
    """Excel解析工具类"""
    @staticmethod
    def init_excel_file_stream(file_content):
        """初始化Excel文件流（校验有效性）"""
        if not file_content or len(file_content) < 100:
            raise ValueError("Excel文件为空或无效（文件大小过小）")
        return BytesIO(file_content)

    @staticmethod
    def parse_excel_file(excel_file_stream, filename):
        """解析Excel文件，提取产品和组合数据"""
        try:
            import pandas as pd
            import numpy as np
            if filename.lower().endswith('.xlsx'):
                excel = pd.ExcelFile(excel_file_stream, engine='openpyxl')
            elif filename.lower().endswith('.xls'):
                excel = pd.ExcelFile(excel_file_stream, engine='xlrd')
            else:
                raise ValueError(f"不支持的文件格式：{os.path.splitext(filename)[1]}")
        except Exception as e:
            raise Exception(f"解析Excel失败：{str(e)}") from e

        p_sheets = ['產品', '产品', 'product', 'products', '商品', 'Product', 'Products']
        b_sheets = ['包含單品', '包含单品', 'bundles', '组合', '組合', 'Bundles']

        download_tasks = []
        product_data_list = []
        bundle_data_list = []
        target_sheet = None
        total_rows = 0

        for sheet in excel.sheet_names:
            if sheet in p_sheets and not target_sheet:
                df = excel.parse(sheet).replace({np.nan: None})
                total_rows = len(df)
                target_sheet = sheet

                for idx, r in df.iterrows():
                    try:
                        # 提取SKU
                        sku = None
                        for sku_col in ['*SKU', 'SKU', 'sku', '货号', '商品编码']:
                            if sku_col in r and r[sku_col] is not None:
                                sku_str = str(r[sku_col]).strip()
                                if sku_str and sku_str.lower() not in ['nan', 'none']:
                                    sku = sku_str
                                    break
                        if not sku:
                            continue

                        # 提取名称
                        p_name = '未知品名'
                        for name_col in ['品名', '产品名称', 'name', '商品名称']:
                            if name_col in r and r[name_col] is not None:
                                name_str = str(r[name_col]).strip()
                                if name_str and name_str.lower() not in ['nan', 'none']:
                                    p_name = name_str
                                    break

                        # 提取图片URL
                        p_url = None
                        for url_col in ['圖片連結', '图片链接', 'image_url', '图片', 'image']:
                            if url_col in r and r[url_col] is not None:
                                url_str = str(r[url_col]).strip()
                                if url_str and url_str.lower() not in ['nan', 'none']:
                                    p_url = url_str
                                    break
                        if not p_url:
                            continue  # 失败SKU处理由调用方负责

                        # 其他字段
                        create_time = DBUtils.format_date_string(str(r.get('创建时间', '')))
                        product_type = str(r.get('产品类型', '普通产品')).strip()
                        developer = str(r.get('开发人员', '未知')).strip()

                        download_tasks.append((sku, p_name, p_url))
                        product_data_list.append({
                            'sku': sku, 'name': p_name, 'create_time': create_time,
                            'product_type': product_type, 'developer': developer,
                            'image_url': p_url, 'orig_path': None, 'thumb_path': None
                        })
                    except Exception as e:
                        print(f"提取产品行{idx + 1}失败：{e}")
                        continue

            if sheet in b_sheets:
                df_b = excel.parse(sheet).replace({np.nan: None})
                for idx, r in df_b.iterrows():
                    try:
                        p_sku = None
                        c_sku = None
                        quantity = 1
                        # 提取组合信息（父SKU、子SKU、数量）
                        for p_col in ['*SKU', 'SKU', 'sku', 'parent_sku', '组合SKU']:
                            if p_col in r and r[p_col] is not None:
                                p_sku_str = str(r[p_col]).strip()
                                if p_sku_str and p_sku_str.lower() not in ['nan', 'none']:
                                    p_sku = p_sku_str
                                    break
                        for c_col in ['單品SKU', '单品SKU', 'child_sku', '子SKU', 'component_sku']:
                            if c_col in r and r[c_col] is not None:
                                c_sku_str = str(r[c_col]).strip()
                                if c_sku_str and c_sku_str.lower() not in ['nan', 'none']:
                                    c_sku = c_sku_str
                                    break
                        for q_col in ['關聯數量', '关联数量', 'quantity', '数量', 'qty']:
                            if q_col in r and r[q_col] is not None:
                                try:
                                    quantity = int(r[q_col])
                                    if quantity <= 0:
                                        quantity = 1
                                except:
                                    quantity = 1
                                break
                        if p_sku and c_sku:
                            bundle_data_list.append((p_sku, c_sku, quantity))
                    except Exception as e:
                        print(f"提取组合行{idx + 1}失败：{e}")
                        continue

        if not target_sheet or len(download_tasks) == 0:
            raise ValueError("Excel中无有效产品数据或未找到目标Sheet")
        return download_tasks, product_data_list, bundle_data_list, total_rows

# ---------------------- 全局函数别名（方便导入） ----------------------
preprocess_image_fast = ImageUtils.preprocess_image_fast
get_thumbnail_unique_id = ImageUtils.get_thumbnail_unique_id
is_thumbnail_in_qdrant = ImageUtils.is_thumbnail_in_qdrant
encode_image_fast = ImageUtils.encode_image_fast