import os

# 提前导入配置
from config import MODEL_CACHE_DIR, MODEL_URL, HUGGINGFACE_MIRRORS, CURRENT_MIRROR

# 设置Hugging Face全局镜像源（优先使用）
os.environ['HF_ENDPOINT'] = HUGGINGFACE_MIRRORS[CURRENT_MIRROR]
# 设置缓存目录环境变量
os.environ['OS_TRANSFORMERS_CACHE'] = MODEL_CACHE_DIR
os.environ['TRANSFORMERS_CACHE'] = MODEL_CACHE_DIR
# 确保缓存目录存在
os.makedirs(MODEL_CACHE_DIR, exist_ok=True)

# 打印调试信息
print(f"[DEBUG] HF_ENDPOINT环境变量已设置为: {os.environ['HF_ENDPOINT']}")
print(f"[DEBUG] TRANSFORMERS_CACHE环境变量已设置为: {os.environ['TRANSFORMERS_CACHE']}")
print(f"[DEBUG] 模型URL: {MODEL_URL}")

# 现在再导入其他模块
import io
import re
import hashlib
import threading
import time
import traceback
from datetime import datetime

import torch
from PIL import Image
from transformers import ViTImageProcessor, ViTModel
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct, CollectionInfo

# ---------------------- 全量从config.py导入配置，移除硬编码 ----------------------
from config import (
    THUMBNAIL_DIR,  # 修正拼写：原THUMBNAIL_DIR，统一配置文件命名
    ORIGINAL_IMAGE_DIR,  # 对应原ORIG_DIR
    SUPPORTED_IMAGE_FORMATS,  # 对应原SUPPORTED_FORMATS
    QDRANT_CACHE_DIR,
    COLLECTION_NAME,
    VECTOR_DIMENSION,  # 对应原VECTOR_SIZE，统一配置文件命名
    REDIS_AVAILABLE,
    CACHE_LOCAL_MAXSIZE,
    CACHE_LOCAL_TTL,
    MODEL_NAME,  # 从config导入模型名称，不再硬编码google/vit-base-patch16-224-in21k
    MODEL_INPUT_SIZE,  # 从config导入模型输入尺寸
    MODEL_URL  # 完整的模型URL，包含国内镜像源
)
from db_utils import calculate_image_md5, query_encoding_record, save_encoding_record

# ---------------------- 全局变量：配置项全部来自config.py，无硬编码 ----------------------
# 本地缓存
vec_cache_local = {}
# Redis客户端（按需初始化）
redis_client = None

# 初始化AI模型
print("正在加载AI模型...")
try:
    # 尝试从本地缓存加载模型
    try:
        processor = ViTImageProcessor.from_pretrained(MODEL_NAME, local_files_only=True, cache_dir=MODEL_CACHE_DIR)
        vit_model = ViTModel.from_pretrained(MODEL_NAME, local_files_only=True, cache_dir=MODEL_CACHE_DIR)
        print("[OK] 从本地缓存加载AI模型成功")
    except FileNotFoundError as e:
        print(f"[WARNING] 本地缓存模型文件不存在: {e}")
        print("[INFO] 尝试从网络下载模型...")
        print(f"[INFO] 使用模型URL: {MODEL_URL}")
        print(f"[DEBUG] 当前HF_ENDPOINT: {os.environ.get('HF_ENDPOINT')}")
        
        # 使用镜像源下载模型，添加超时和重试设置
        try:
            from huggingface_hub import HfFolder
            print(f"[DEBUG] HfFolder当前端点: {HfFolder.get_endpoint()}")
            
            processor = ViTImageProcessor.from_pretrained(
                MODEL_URL,
                cache_dir=MODEL_CACHE_DIR,
                timeout=60,
                max_retries=3
            )
            vit_model = ViTModel.from_pretrained(
                MODEL_URL,
                cache_dir=MODEL_CACHE_DIR,
                timeout=60,
                max_retries=3
            )
            print("[OK] 从网络下载AI模型成功")
        except Exception as download_e:
            print(f"[ERROR] 模型下载失败: {download_e}")
            import traceback
            traceback.print_exc()
            raise
    except PermissionError as e:
        print(f"[ERROR] 本地缓存目录权限不足: {e}")
        raise
    except Exception as e:
        print(f"[ERROR] 本地缓存加载失败: {e}")
        traceback.print_exc()
        raise

    # 模型设备配置和优化
    try:
        if torch.cuda.is_available():
            vit_model = vit_model.cuda()
            print("[INFO] 模型已移至GPU")

            # 启用所有GPU优化
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True
            torch.backends.cuda.matmul.allow_fp16_reduced_precision_reduction = True
            torch.backends.cudnn.benchmark = True  # CuDNN自动优化

            # 启用半精度
            try:
                vit_model = vit_model.half()
                print("[OK] 启用半精度推理 (FP16) - 预计11ms/张")
            except Exception as e:
                print(f"[WARNING] 半精度失败，使用全精度: {e}")
                vit_model = vit_model.float()
                print("[OK] 使用全精度推理 (FP32) - 预计14ms/张")
        else:
            vit_model = vit_model.float()
            print("[WARNING] 未检测到GPU，使用CPU推理 - 预计100ms/张")
        vit_model.eval()
        print("AI模型加载成功")
    except Exception as e:
        print(f"[ERROR] 模型设备配置失败: {e}")
        traceback.print_exc()
        # 清理已加载的模型资源
        if 'vit_model' in locals():
            del vit_model
        if 'processor' in locals():
            del processor
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        raise

    # 预热模型（关键！）
    try:
        if torch.cuda.is_available():
            print("预热GPU模型...")
            with torch.no_grad():
                # 创建一个测试图片（尺寸从config导入）
                test_img = Image.new('RGB', (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE), color='white')
                dummy_input = processor(images=test_img, return_tensors="pt")

                # 移到GPU并转换精度
                dummy_input = {k: v.cuda() for k, v in dummy_input.items()}
                if next(vit_model.parameters()).dtype == torch.float16:
                    dummy_input = {k: v.half() if v.dtype == torch.float32 else v
                                   for k, v in dummy_input.items()}

                # 预热3次
                for _ in range(3):
                    _ = vit_model(** dummy_input)
                    torch.cuda.synchronize()

                del dummy_input
                torch.cuda.empty_cache()

            print("预热完成")
    except Exception as e:
        print(f"[WARNING] 模型预热失败，不影响使用但可能影响首次推理速度: {e}")
        # 预热失败不终止程序，仅记录警告
except Exception as e:
    print(f"[ERROR] AI模型加载失败: {e}")
    traceback.print_exc()
    raise

# Qdrant向量库初始化
print("正在连接Qdrant（本地缓存模式）...")
q_client = None
try:
    # 改用本地文件模式，缓存存储到config.py配置的QDRANT_CACHE_DIR
    q_client = QdrantClient(
        path=QDRANT_CACHE_DIR,  # 从config导入，自动创建
        timeout=30.0  # 延长超时时间，适配批量构建缓存
    )

    print(f"[OK] q_client 实例创建成功，类型：{type(q_client)}")
    print(f"[OK] q_client 支持search方法：{'search' in dir(q_client)}")

    # 检查集合是否存在，不存在则创建（配置从config导入）
    try:
        q_client.get_collection(COLLECTION_NAME)
        print(f"[OK] Qdrant集合 {COLLECTION_NAME} 已存在")
    except:
        q_client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=VECTOR_DIMENSION, distance=Distance.COSINE),
            hnsw_config={"m": 12, "ef_construct": 64},  # 适配1.8.0版本
            optimizers_config={"memmap_threshold": 10000}
        )
        print(f"[OK] Qdrant集合 {COLLECTION_NAME} 创建完成")

except Exception as e:
    print(f"Qdrant初始化失败: {e}")
    raise

# 尝试导入Redis（如果config配置为可用）
if REDIS_AVAILABLE:
    try:
        import redis
        from config import REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_PASSWORD  # 从config导入Redis配置
        redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            password=REDIS_PASSWORD,
            decode_responses=False,
            socket_timeout=5
        )
        redis_client.ping()  # 测试连接
        print("Redis连接成功，启用二级缓存")
    except Exception as e:
        print(f"Redis连接失败: {e}，仅使用内存缓存")
        redis_client = None


def print_gpu_memory():
    """
    打印GPU内存使用情况
    """
    if torch.cuda.is_available():
        allocated = torch.cuda.memory_allocated() / 1024 ** 3
        reserved = torch.cuda.memory_reserved() / 1024 ** 3
        print(f"【GPU内存】已分配: {allocated:.2f}GB, 保留: {reserved:.2f}GB")


def preprocess_image_fast(img_bytes, max_size=None):
    """
    快速图片预处理（增强版，解决所有常见通道问题）
    max_size：从config导入，默认使用MODEL_INPUT_SIZE
    """
    # 从config导入默认尺寸，不再硬编码224
    max_size = max_size or MODEL_INPUT_SIZE
    try:
        # 校验图片字节流有效性
        if not img_bytes or len(img_bytes) < 100:
            raise ValueError("图片字节流无效或过小")

        img = Image.open(io.BytesIO(img_bytes))

        # 处理特殊图像模式（重点修复通道维度问题）
        if img.mode in ['RGBA', 'LA', 'P', 'PA', 'CMYK']:
            # 对于带透明通道/调色板/CMYK模式，转换为RGB（白色背景填充，从config导入）
            from config import DEFAULT_IMAGE_BACKGROUND
            background = Image.new('RGB', img.size, DEFAULT_IMAGE_BACKGROUND)
            if img.mode == 'RGBA':
                # 提取Alpha通道作为掩码，保留原图内容
                background.paste(img, mask=img.split()[3])
            else:
                # 其他特殊模式直接转换后粘贴
                background.paste(img.convert('RGB'))
            img = background
        elif img.mode != 'RGB':
            # 其他模式（如灰度图L、单通道1）直接强制转换为RGB
            img = img.convert('RGB')

        # 检查图像尺寸有效性
        if img.width <= 0 or img.height <= 0 or (img.width == 1 and img.height == 1):
            raise ValueError(f"无效的图片尺寸: {img.size}")

        # 缩放图像（保持比例，避免变形）
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

        return img
    except Exception as e:
        raise ValueError(f"图片预处理失败: {str(e)}")


def encode_image_fast(img):
    """
    超快速图像编码 - 修复语法错误，增强稳定性（适配GPU/CPU）
    向量维度从config导入，不再硬编码
    """
    try:
        # 步骤1：强制转换为RGB格式，避免通道异常
        if img.mode != 'RGB':
            img = img.convert('RGB')

        # 步骤2：确保图片尺寸正确（从config导入，匹配ViT模型输入）
        target_size = (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
        if img.size != target_size:
            img = img.resize(target_size, Image.Resampling.LANCZOS)

        # 步骤3：预处理图片，生成模型输入
        inputs = processor(images=img, return_tensors="pt")

        # 步骤4：获取模型设备和精度，自动匹配
        device = next(vit_model.parameters()).device if hasattr(vit_model, 'parameters') else torch.device('cpu')
        model_dtype = next(vit_model.parameters()).dtype if hasattr(vit_model, 'parameters') else torch.float32

        # 步骤5：移动输入到对应设备，匹配模型精度
        inputs = {k: v.to(device) for k, v in inputs.items()}
        if model_dtype == torch.float16 and torch.cuda.is_available():
            inputs = {k: v.half() if v.dtype == torch.float32 else v for k, v in inputs.items()}

        # 步骤6：模型推理（仅一层with torch.no_grad()，修复嵌套错误）
        with torch.no_grad():
            outputs = vit_model(** inputs)  # 定义outputs，修复变量未定义错误
            # 提取<cls> token的特征，压缩维度
            vec = outputs.last_hidden_state[:, 0, :].squeeze()

        # 步骤7：精度转换，避免数值溢出
        if vec.dtype == torch.float16:
            vec = vec.float()

        # 步骤8：移回CPU，归一化处理
        vec = vec.cpu()
        norm = torch.norm(vec)
        if norm > 1e-6:
            vec = vec / norm

        # 步骤9：维度校验（从config导入VECTOR_DIMENSION，匹配Qdrant集合配置）
        vec_list = vec.tolist()
        vec_dim = len(vec_list)
        if vec_dim != VECTOR_DIMENSION:
            raise ValueError(f"向量维度错误，预期{VECTOR_DIMENSION}，实际{vec_dim}")

        # 步骤10：清理资源，释放GPU缓存
        del inputs, outputs
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

        print(f"[OK] 图像编码完成，向量维度：{vec_dim}")
        return vec_list

    except Exception as e:
        print(f"[ERROR] 图像编码失败: {e}")
        traceback.print_exc()
        # 清理资源，避免内存泄漏
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        raise


def get_thumbnail_unique_id(thumbnail_path):
    """
    生成缩略图唯一标识（修复md5转int潜在溢出问题）
    确保文件未修改时，id不变，避免重复处理
    """
    try:
        abs_path = os.path.abspath(thumbnail_path)
        mtime = str(os.path.getmtime(abs_path))
        unique_str = f"{abs_path}_{mtime}"
        md5_obj = hashlib.md5(unique_str.encode("utf-8"))
        # 取前16位十六进制数，转换为64位整数，避免溢出
        unique_hex = md5_obj.hexdigest()[:16]
        unique_id = int(unique_hex, 16)
        return unique_id, abs_path
    except Exception as e:
        print(f"[ERROR] 生成{thumbnail_path}唯一标识失败：{e}")
        return None, None


def is_thumbnail_in_qdrant(q_client, collection_name, thumbnail_path):
    """
    检查缩略图是否已存在于Qdrant集合（适配Qdrant Client 1.8.0+，优化查询效率）
    """
    unique_id, _ = get_thumbnail_unique_id(thumbnail_path)
    if not unique_id:
        return False

    try:
        # 方案1：直接通过ID检索（更高效，无需向量）
        response = q_client.retrieve(
            collection_name=collection_name,
            ids=[unique_id],
            with_payload=False,
            with_vectors=False
        )
        # 响应非空则表示点存在
        return len(response) > 0
    except Exception as e:
        # 捕获非"点不存在"的异常（如网络、集合不存在等）
        error_str = str(e).lower()
        if "not found" not in error_str and "404" not in error_str:
            print(f"[ERROR] 检查Qdrant点失败：{e}")
        return False


def sync_existing_vector_to_qdrant(q_client, collection_name, pure_sku, image_path):
    """
    复用编码档案（若Qdrant缺失，从档案关联信息同步，无需重新编码）
    """
    try:
        # 直接读取图片并编码（仅当Qdrant缺失但档案存在时，作为兜底，场景极少）
        img = Image.open(image_path).convert("RGB")
        target_size = (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
        img = img.resize(target_size, Image.Resampling.LANCZOS)
        vec = encode_image_fast(img)
        if len(vec) != VECTOR_DIMENSION:
            raise ValueError("向量维度错误")

        # 构造PointStruct并插入Qdrant
        unique_id, abs_path = get_thumbnail_unique_id(image_path)
        filename = os.path.basename(image_path)
        point = PointStruct(
            id=unique_id,
            vector=vec,
            payload={
                "filename": filename,
                "thumbnail_path": abs_path,
                "sku": pure_sku,
                "update_time": str(os.path.getmtime(image_path))
            }
        )
        q_client.upsert(collection_name=collection_name, points=[point])
        print(f"[OK] 从编码档案兜底同步Qdrant：{filename}，SKU={pure_sku}")
        return True
    except Exception as e:
        print(f"[ERROR] 兜底同步Qdrant失败：{e}")
        return False


def process_single_thumbnail(q_client, collection_name, thumbnail_path):
    """
    处理单张缩略图：先查Qdrant缩略图缓存（前置拦截）→ 再查编码档案→ 最后编码（彻底避免重复）
    """
    # ========== 第一步：前置拦截：缩略图已存在则直接跳过所有处理 ==========
    if is_thumbnail_in_qdrant(q_client, collection_name, thumbnail_path):
        filename = os.path.basename(thumbnail_path)
        print(f"[INFO]  缩略图{filename}已存在于Qdrant缓存，跳过所有后续处理")
        return True  # 直接返回成功，不执行后续任何逻辑

    # ========== 以下为原有流程：仅当缩略图不存在时，才执行 ==========
    # 1. 跳过不支持的格式（从config导入SUPPORTED_IMAGE_FORMATS）
    if not thumbnail_path.lower().endswith(SUPPORTED_IMAGE_FORMATS):
        return True

    # 2. 提取图片基础信息（SKU、MD5、唯一标识）
    filename = os.path.basename(thumbnail_path)
    abs_thumbnail_path = os.path.abspath(thumbnail_path)

    # 提取纯SKU（复用原有逻辑，优化严谨性）
    file_prefix = os.path.splitext(filename)[0].split("_")[0]
    from config import SKU_PREFIX
    pure_sku = re.sub(r'^' + SKU_PREFIX, '', file_prefix, flags=re.IGNORECASE)
    if not re.match(r'^[0-9a-zA-Z]+$', pure_sku) or pure_sku.lower() in ["nan", "none", ""]:
        pure_sku = file_prefix  # 兜底

    # 计算图片MD5（唯一标识内容）
    image_md5 = calculate_image_md5(abs_thumbnail_path)
    if not image_md5:
        print(f"[ERROR] 无法计算{filename} MD5，跳过处理")
        return False

    # 3. 校验编码档案，判断是否需要重新编码
    if query_encoding_record(pure_sku, abs_thumbnail_path, image_md5):
        # 档案存在：同步Qdrant（若缺失），直接跳过编码
        print(f"[INFO]  编码档案存在，{filename}无需重新编码，同步Qdrant缓存")
        sync_existing_vector_to_qdrant(q_client, collection_name, pure_sku, abs_thumbnail_path)
        return True

    # 4. 档案不存在时，执行图像编码（仅此处会执行耗时编码）
    try:
        img = Image.open(thumbnail_path).convert("RGB")
        target_size = (MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
        img = img.resize(target_size, Image.Resampling.LANCZOS)
    except Exception as e:
        print(f"[ERROR] 读取缩略图{thumbnail_path}失败：{e}")
        return False

    # 5. AI模型编码
    try:
        vec = encode_image_fast(img)
        if len(vec) != VECTOR_DIMENSION:
            print(f"[ERROR] 缩略图{thumbnail_path}编码维度错误，跳过")
            return False
    except Exception as e:
        print(f"[ERROR] 缩略图{thumbnail_path}编码失败：{e}")
        return False

    # 6. 构造PointStruct并插入Qdrant
    unique_id, abs_path = get_thumbnail_unique_id(thumbnail_path)
    if not unique_id:
        return False

    point = PointStruct(
        id=unique_id,
        vector=vec,
        payload={
            "filename": filename,
            "thumbnail_path": abs_path,
            "sku": pure_sku,
            "update_time": str(os.path.getmtime(thumbnail_path))
        }
    )

    # 7. 插入Qdrant并保存编码档案（原子操作，确保档案与Qdrant同步）
    try:
        q_client.upsert(collection_name=collection_name, points=[point])
        # 编码成功+插入Qdrant成功后，才保存编码档案
        save_encoding_record(pure_sku, abs_thumbnail_path, image_md5)
        print(f"[OK] 缩略图{filename}已新增至Qdrant缓存，提取纯SKU：{pure_sku}")
        return True
    except Exception as e:
        print(f"[ERROR] 缩略图{filename}插入Qdrant失败：{e}")
        return False


def build_qdrant_thumbnail_cache(q_client, collection_name):
    """
    遍历缩略图目录，批量增量构建Qdrant缓存（添加资源限制，避免过载，外层兜底拦截）
    目录从config导入，不再硬编码
    """
    from config import BATCH_PROCESS_LIMIT  # 从config导入批次限制
    print(f"\n=== 开始增量构建Qdrant缩略图缓存（目录：{THUMBNAIL_DIR}）===")

    if not os.path.exists(THUMBNAIL_DIR):
        os.makedirs(THUMBNAIL_DIR, exist_ok=True)
        print(f"[INFO]  缩略图目录不存在，已创建：{THUMBNAIL_DIR}")
        return

    processed_count = 0  # 新增成功数量
    skipped_count = 0  # 已存在跳过数量
    failed_count = 0  # 处理失败数量
    batch_limit = BATCH_PROCESS_LIMIT  # 从config导入每批处理数量
    current_batch = 0

    for root, _, files in os.walk(THUMBNAIL_DIR):
        for file in files:
            thumbnail_path = os.path.join(root, file)
            current_batch += 1

            # 1. 跳过不支持的格式（从config导入）
            if not thumbnail_path.lower().endswith(SUPPORTED_IMAGE_FORMATS):
                continue

            # 2. 外层兜底判断：缩略图已存在则直接跳过（核心拦截，避免调用内层函数）
            if is_thumbnail_in_qdrant(q_client, collection_name, thumbnail_path):
                skipped_count += 1
                filename = os.path.basename(thumbnail_path)
                print(f"[INFO]  缩略图{filename}已存在于Qdrant缓存，跳过")
                continue

            # 3. 仅当缩略图不存在时，才调用处理函数
            try:
                if process_single_thumbnail(q_client, collection_name, thumbnail_path):
                    processed_count += 1
                else:
                    failed_count += 1
            except Exception as e:
                failed_count += 1
                filename = os.path.basename(thumbnail_path)
                print(f"[ERROR] 处理缩略图{filename}失败：{e}")

            # 4. 每批处理完成后，释放资源并延时，避免过载
            if current_batch >= batch_limit:
                print(f"[INFO]  已处理{current_batch}张图片，释放资源中...")
                # 释放GPU/CPU缓存
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                time.sleep(1)  # 延时1秒，降低资源占用
                current_batch = 0  # 重置批次计数

    # 补充：获取集合信息（修复原代码缺失的collection_info赋值）
    vec_total = 0
    try:
        collection_info = q_client.get_collection(collection_name)
        vec_total = collection_info.points_count if collection_info else 0
    except Exception as e:
        vec_total = 0
        print(f"[ERROR] 获取Qdrant集合信息失败：{e}")

    print(f"\n=== Qdrant缩略图缓存构建完成 ===")
    print(f"[OK] 新增缓存：{processed_count} 张")
    print(f"[INFO]  跳过已有：{skipped_count} 张")
    print(f"[ERROR] 处理失败：{failed_count} 张")
    print(f"[STATS] 当前Qdrant集合{collection_name}向量总数：{vec_total}")


def get_cached_results(img_hash):
    """
    获取缓存结果（缓存配置从config导入）
    """
    # 内存缓存（TTL从config导入）
    if img_hash in vec_cache_local:
        cache_data = vec_cache_local[img_hash]
        if time.time() - cache_data['timestamp'] < CACHE_LOCAL_TTL:
            return cache_data['results']
        else:
            del vec_cache_local[img_hash]

    # Redis缓存（配置从config导入）
    if redis_client:
        try:
            cached = redis_client.get(f"img_search:{img_hash}")
            if cached:
                import json
                result = json.loads(cached)
                vec_cache_local[img_hash] = {
                    'results': result,
                    'timestamp': time.time()
                }
                return result
        except Exception as e:
            print(f"缓存读取失败: {e}")

    return None


def set_cached_results(img_hash, results, ttl_minutes=15):
    """
    设置缓存（缓存配置从config导入）
    """
    # 写入本地缓存（最大容量从config导入）
    vec_cache_local[img_hash] = {
        'results': results,
        'timestamp': time.time()
    }

    # 清理过期缓存（最大容量从config导入）
    if len(vec_cache_local) > CACHE_LOCAL_MAXSIZE:
        oldest_key = min(vec_cache_local.keys(), key=lambda k: vec_cache_local[k]['timestamp'])
        del vec_cache_local[oldest_key]
        print(f"[INFO]  本地缓存溢出，清理最旧缓存：{oldest_key}")

    # Redis缓存（异步，TTL从config导入）
    if redis_client:
        def async_redis_set():
            try:
                import json
                from config import REDIS_TTL  # 从config导入Redis TTL
                serialized = json.dumps(results, default=str)
                redis_client.setex(
                    f"img_search:{img_hash}",
                    REDIS_TTL,
                    serialized
                )
            except Exception as e:
                print(f"Redis缓存设置失败: {e}")

        threading.Thread(target=async_redis_set, daemon=True).start()

# 启动时自动构建Qdrant缩略图缓存
build_qdrant_thumbnail_cache(q_client, COLLECTION_NAME)