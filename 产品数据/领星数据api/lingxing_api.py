# -*- coding: utf-8 -*-
"""
领星数据 API 封装客户端

支持功能：
- API 签名生成（MD5 + AES/ECB/PKCS5Padding）
- 关键词列表查询
- 产品表现查询
- ASIN 360 小时数据查询
- 利润统计-ASIN 查询
- 本地产品列表查询
- 本地产品详情查询
- 批量查询本地产品详情
- 编辑本地产品
- 上传本地产品图片

使用示例：
    api = LingxingAPI(app_id="your_app_id", app_secret="your_app_secret")
    api.set_access_token("your_access_token")
    result = api.get_keyword_list(mid=1, start_date="2024-08-01", end_date="2024-08-01")
"""

import base64
import hashlib
import json
import time
import urllib.parse
from typing import Any, Dict, List, Optional, Union

import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad


class LingxingAPI:
    """领星 ERP 开放平台 API 客户端"""

    BASE_URL = "https://openapi.lingxing.com"

    def __init__(self, app_id: str, app_secret: str):
        """
        初始化 API 客户端

        Args:
            app_id: 领星 APP ID (app_key)
            app_secret: 领星 APP Secret
        """
        self.app_id = app_id
        self.app_secret = app_secret
        self.access_token: Optional[str] = None

    # ------------------------------------------------------------------
    # 基础工具方法
    # ------------------------------------------------------------------

    def set_access_token(self, token: str) -> None:
        """
        设置 access_token

        Args:
            token: 通过领星授权获取的 access_token
        """
        self.access_token = token

    def _generate_sign(self, params: Dict[str, Any]) -> str:
        """
        生成接口签名

        签名规则：
        1. 所有参数按 ASCII 排序（业务参数 + access_token + app_key + timestamp）
        2. 以 key=value 格式拼接，空值不参与签名
        3. 集合类型（list/dict）先转为 JSON 字符串；bool 转为 'true'/'false'
        4. 拼接后的字符串进行 MD5（32 位）加密并转大写
        5. 使用 AES/ECB/PKCS5Padding 加密 MD5 值，密钥为 appId
        6. 最终结果转为 Base64 字符串

        Args:
            params: 参与签名的参数字典

        Returns:
            生成的签名字符串
        """
        filtered: Dict[str, Any] = {}
        for k, v in params.items():
            # 空值不参与签名
            if v == "" or v is None:
                continue
            # Boolean 统一转为小写字符串，避免 Python 的 True/False 大写问题
            if isinstance(v, bool):
                v = "true" if v else "false"
            # 集合类型转为 JSON 字符串参与签名
            elif isinstance(v, (list, dict)):
                v = json.dumps(v, ensure_ascii=False, separators=(",", ":"))
            filtered[k] = v

        # ASCII 排序并拼接
        sorted_items = sorted(filtered.items(), key=lambda x: x[0])
        pairs = [f"{k}={v}" for k, v in sorted_items]
        query_str = "&".join(pairs)

        # MD5 加密后转大写
        md5_hash = hashlib.md5(query_str.encode("utf-8")).hexdigest().upper()

        # AES/ECB/PKCS5Padding 加密
        key = self.app_id.encode("utf-8")
        cipher = AES.new(key, AES.MODE_ECB)
        padded_data = pad(md5_hash.encode("utf-8"), AES.block_size)
        encrypted = cipher.encrypt(padded_data)
        sign = base64.b64encode(encrypted).decode("utf-8")
        return sign

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[Dict[str, Any]] = None,
        query: Optional[Dict[str, Any]] = None,
        timeout: int = 30,
    ) -> Dict[str, Any]:
        """
        通用 HTTP 请求方法

        Args:
            method: 请求方式，GET / POST
            path: API 路径（不含域名）
            body: POST 请求的业务请求体（JSON 格式）
            query: GET 请求的查询参数
            timeout: 请求超时时间（秒）

        Returns:
            接口返回的 JSON 数据

        Raises:
            ValueError: access_token 未设置时抛出
            requests.HTTPError: HTTP 请求异常时抛出
        """
        if not self.access_token:
            raise ValueError("access_token 未设置，请先调用 set_access_token()")

        timestamp = str(int(time.time()))
        base_params = {
            "access_token": self.access_token,
            "app_key": self.app_id,
            "timestamp": timestamp,
        }

        method = method.upper()
        url = f"{self.BASE_URL}{path}"

        if method == "GET":
            # GET：所有参数拼接到 URL
            all_params = {**base_params, **(query or {})}
            sign = self._generate_sign(all_params)
            all_params["sign"] = sign
            response = requests.get(url, params=all_params, timeout=timeout)
        else:
            # POST：URL 上只带 4 个公共参数 + sign，业务参数放 body
            sign_params = {**base_params, **(body or {})}
            sign = self._generate_sign(sign_params)

            url_params = {
                "access_token": self.access_token,
                "app_key": self.app_id,
                "timestamp": timestamp,
                "sign": sign,
            }
            headers = {"Content-Type": "application/json"}
            response = requests.post(
                url,
                params=url_params,
                json=body,
                headers=headers,
                timeout=timeout,
            )

        response.raise_for_status()
        return response.json()

    # ------------------------------------------------------------------
    # 产品表现接口
    # ------------------------------------------------------------------

    def get_keyword_list(
        self,
        offset: int = 0,
        length: int = 20,
        mid: Optional[int] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        关键词列表查询

        接口路径：POST /erp/sc/routing/tool/toolKeywordRank/getKeywordList
        令牌桶容量：1

        Args:
            offset: 分页偏移量，默认 0
            length: 分页长度，默认 20，最大 2000
            mid: 国家 ID
            start_date: 开始日期，格式 Y-m-d
            end_date: 结束日期，格式 Y-m-d

        Returns:
            接口响应 JSON
        """
        body: Dict[str, Any] = {"offset": offset, "length": length}
        if mid is not None:
            body["mid"] = mid
        if start_date:
            body["start_date"] = start_date
        if end_date:
            body["end_date"] = end_date
        return self._request("POST", "/erp/sc/routing/tool/toolKeywordRank/getKeywordList", body=body)

    def get_product_performance(
        self,
        offset: int,
        length: int,
        sort_field: str,
        sort_type: str,
        sid: Union[str, List[int]],
        start_date: str,
        end_date: str,
        search_field: Optional[str] = None,
        search_value: Optional[List[str]] = None,
        mid: Optional[int] = None,
        extend_search: Optional[List[Dict[str, Any]]] = None,
        summary_field: str = "asin",
        currency_code: Optional[str] = None,
        is_recently_enum: Optional[bool] = None,
        purchase_status: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        查询产品表现

        接口路径：POST /bd/productPerformance/openApi/asinList
        令牌桶容量：1

        Args:
            offset: 分页偏移量
            length: 分页长度，最大 10000
            sort_field: 排序字段（volume / order_items / amount 等）
            sort_type: 排序方式 desc / asc
            sid: 店铺 ID（单店铺传 string，多店铺传 array）
            start_date: 开始日期 YYYY-MM-DD
            end_date: 结束日期 YYYY-MM-DD
            search_field: 搜索字段（asin / parent_asin / msku / local_sku / item_name）
            search_value: 搜索值，最多 50 个
            mid: 站点 ID
            extend_search: 表头筛选数组
            summary_field: 汇总行维度（asin / parent_asin / msku / sku）
            currency_code: 货币类型（USD / CNY）
            is_recently_enum: 是否仅查询活跃商品
            purchase_status: 退货退款统计方式

        Returns:
            接口响应 JSON
        """
        body: Dict[str, Any] = {
            "offset": offset,
            "length": length,
            "sort_field": sort_field,
            "sort_type": sort_type,
            "sid": sid,
            "start_date": start_date,
            "end_date": end_date,
            "summary_field": summary_field,
        }
        if search_field is not None:
            body["search_field"] = search_field
        if search_value is not None:
            body["search_value"] = search_value
        if mid is not None:
            body["mid"] = mid
        if extend_search is not None:
            body["extend_search"] = extend_search
        if currency_code is not None:
            body["currency_code"] = currency_code
        if is_recently_enum is not None:
            body["is_recently_enum"] = is_recently_enum
        if purchase_status is not None:
            body["purchase_status"] = purchase_status
        return self._request("POST", "/bd/productPerformance/openApi/asinList", body=body)

    def get_asin_360_hour(
        self,
        sids: str,
        date_start: str,
        date_end: str,
        summary_field: str,
        summary_field_value: str,
    ) -> Dict[str, Any]:
        """
        查询 ASIN 360 小时数据

        接口路径：POST /basicOpen/salesAnalysis/productPerformance/performanceTrendByHour
        令牌桶容量：1

        Args:
            sids: 店铺 ID，多个值英文逗号隔开，最大 200
            date_start: 开始时间 Y-m-d
            date_end: 结束时间 Y-m-d
            summary_field: 查询维度（parent_asin / asin / msku / sku / spu）
            summary_field_value: 查询维度值

        Returns:
            接口响应 JSON
        """
        body = {
            "sids": sids,
            "date_start": date_start,
            "date_end": date_end,
            "summary_field": summary_field,
            "summary_field_value": summary_field_value,
        }
        return self._request(
            "POST",
            "/basicOpen/salesAnalysis/productPerformance/performanceTrendByHour",
            body=body,
        )

    def get_profit_statistics_asin(
        self,
        start_date: str,
        end_date: str,
        offset: int = 0,
        length: int = 1000,
        mids: Optional[List[int]] = None,
        sids: Optional[List[int]] = None,
        search_field: Optional[str] = None,
        search_value: Optional[List[str]] = None,
        currency_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        查询利润统计-ASIN

        接口路径：POST /bd/profit/statistics/open/asin/list
        令牌桶容量：10

        Args:
            start_date: 开始时间（双闭区间，最长跨度 7 天）
            end_date: 结束时间（双闭区间，最长跨度 7 天）
            offset: 分页偏移量，默认 0
            length: 分页长度，上限 10000，默认 1000
            mids: 站点 ID 数组
            sids: 店铺 ID 数组
            search_field: 搜索值类型，目前仅支持 asin
            search_value: 搜索值数组
            currency_code: 币种 code（如 CNY）

        Returns:
            接口响应 JSON
        """
        body: Dict[str, Any] = {
            "offset": offset,
            "length": length,
            "startDate": start_date,
            "endDate": end_date,
        }
        if mids is not None:
            body["mids"] = mids
        if sids is not None:
            body["sids"] = sids
        if search_field is not None:
            body["searchField"] = search_field
        if search_value is not None:
            body["searchValue"] = search_value
        if currency_code is not None:
            body["currencyCode"] = currency_code
        return self._request("POST", "/bd/profit/statistics/open/asin/list", body=body)

    # ------------------------------------------------------------------
    # 开发产品接口
    # ------------------------------------------------------------------

    def get_local_product_list(
        self,
        offset: int = 0,
        length: int = 1000,
        update_time_start: Optional[int] = None,
        update_time_end: Optional[int] = None,
        create_time_start: Optional[int] = None,
        create_time_end: Optional[int] = None,
        sku_list: Optional[List[str]] = None,
        sku_identifier_list: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        查询本地产品列表

        接口路径：POST /erp/sc/routing/data/local_inventory/productList
        令牌桶容量：1

        Args:
            offset: 分页偏移量，默认 0
            length: 分页长度，默认 1000，上限 1000
            update_time_start: 更新时间-开始时间戳（秒）
            update_time_end: 更新时间-结束时间戳（秒）
            create_time_start: 创建时间-开始时间戳（秒）
            create_time_end: 创建时间-结束时间戳（秒）
            sku_list: 本地产品 SKU 数组
            sku_identifier_list: SKU 识别码数组

        Returns:
            接口响应 JSON
        """
        body: Dict[str, Any] = {"offset": offset, "length": length}
        if update_time_start is not None:
            body["update_time_start"] = update_time_start
        if update_time_end is not None:
            body["update_time_end"] = update_time_end
        if create_time_start is not None:
            body["create_time_start"] = create_time_start
        if create_time_end is not None:
            body["create_time_end"] = create_time_end
        if sku_list is not None:
            body["sku_list"] = sku_list
        if sku_identifier_list is not None:
            body["sku_identifier_list"] = sku_identifier_list
        return self._request(
            "POST",
            "/erp/sc/routing/data/local_inventory/productList",
            body=body,
        )

    def get_local_product_detail(
        self,
        id: Optional[int] = None,
        sku: Optional[str] = None,
        sku_identifier: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        查询本地产品详情

        接口路径：POST /erp/sc/routing/data/local_inventory/productInfo
        令牌桶容量：1

        Args:
            id: 产品 ID（id / sku / sku_identifier 三选一必填）
            sku: 产品 SKU（id / sku / sku_identifier 三选一必填）
            sku_identifier: SKU 识别码（id / sku / sku_identifier 三选一必填）

        Returns:
            接口响应 JSON
        """
        body: Dict[str, Any] = {}
        if id is not None:
            body["id"] = id
        if sku is not None:
            body["sku"] = sku
        if sku_identifier is not None:
            body["sku_identifier"] = sku_identifier
        return self._request(
            "POST",
            "/erp/sc/routing/data/local_inventory/productInfo",
            body=body,
        )

    def batch_get_local_product_detail(
        self,
        product_ids: Optional[List[str]] = None,
        skus: Optional[List[str]] = None,
        sku_identifiers: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """
        批量查询本地产品详情

        接口路径：POST /erp/sc/routing/data/local_inventory/batchGetProductInfo
        令牌桶容量：1

        Args:
            product_ids: 产品 ID 数组，上限 100
            skus: 产品 SKU 数组，上限 100
            sku_identifiers: SKU 识别码数组，上限 100

        Returns:
            接口响应 JSON
        """
        body: Dict[str, Any] = {}
        if product_ids is not None:
            body["productIds"] = product_ids
        if skus is not None:
            body["skus"] = skus
        if sku_identifiers is not None:
            body["sku_identifiers"] = sku_identifiers
        return self._request(
            "POST",
            "/erp/sc/routing/data/local_inventory/batchGetProductInfo",
            body=body,
        )

    def set_local_product(
        self,
        sku: str,
        product_name: Optional[str] = None,
        sku_identifier: Optional[str] = None,
        picture_list: Optional[List[Dict[str, Any]]] = None,
        unit: Optional[str] = None,
        category_id: Optional[int] = None,
        category: Optional[str] = None,
        model: Optional[str] = None,
        brand_id: Optional[int] = None,
        brand: Optional[str] = None,
        open_status: Optional[int] = None,
        status: Optional[int] = None,
        description: Optional[str] = None,
        group_list: Optional[List[Dict[str, Any]]] = None,
        cg_opt_uid: Optional[int] = None,
        cg_opt_username: Optional[str] = None,
        product_developer_uid: Optional[int] = None,
        product_developer: Optional[str] = None,
        purchase_remark: Optional[str] = None,
        cg_price: Optional[str] = None,
        is_related: Optional[int] = None,
        cg_delivery: Optional[int] = None,
        cg_product_material: Optional[str] = None,
        cg_product_length: Optional[str] = None,
        cg_product_width: Optional[str] = None,
        cg_product_height: Optional[str] = None,
        cg_product_net_weight: Optional[str] = None,
        cg_product_gross_weight: Optional[str] = None,
        cg_package_length: Optional[str] = None,
        cg_package_width: Optional[str] = None,
        cg_package_height: Optional[str] = None,
        cg_box_length: Optional[str] = None,
        cg_box_width: Optional[str] = None,
        cg_box_height: Optional[str] = None,
        cg_box_weight: Optional[str] = None,
        cg_box_pcs: Optional[int] = None,
        bg_customs_export_name: Optional[str] = None,
        bg_export_hs_code: Optional[str] = None,
        bg_customs_import_name: Optional[str] = None,
        currency: Optional[str] = None,
        bg_customs_import_price: Optional[str] = None,
        product_creator_uid: Optional[int] = None,
        product_duty_uids: Optional[List[int]] = None,
        is_append_product_duty: Optional[int] = None,
        qc_standard: Optional[Dict[str, Any]] = None,
        product_logistics_list: Optional[Dict[str, Any]] = None,
        supplier_quote: Optional[List[Dict[str, Any]]] = None,
        special_attr: Optional[List[int]] = None,
        declaration: Optional[Dict[str, Any]] = None,
        clearance: Optional[Dict[str, Any]] = None,
        aux_relation_list: Optional[List[Dict[str, Any]]] = None,
        spec_pack_list: Optional[List[Dict[str, Any]]] = None,
        api_spu: Optional[str] = None,
        api_spu_attribute: Optional[List[Dict[str, Any]]] = None,
        custom_fields: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        添加/编辑本地产品

        接口路径：POST /erp/sc/routing/storage/product/set
        令牌桶容量：10

        Args:
            sku: 本地产品 SKU（必填）
            product_name: 品名（添加时必填）
            sku_identifier: SKU 识别码
            picture_list: 产品图片信息数组 [{"pic_url": "xxx", "is_primary": 1}]
            unit: 单位（套、个、台）
            category_id: 分类 ID
            category: 分类名称
            model: 型号
            brand_id: 品牌 ID
            brand: 品牌名称
            open_status: 开启状态 0-停用，1-启用
            status: 状态 0-停售，1-在售，2-开发中，3-清仓
            description: 商品描述
            group_list: 组合商品列表 [{"sku": "xxx", "quantity": 1}]
            cg_opt_uid: 采购员 ID
            cg_opt_username: 采购员名
            product_developer_uid: 开发者 ID
            product_developer: 开发者名称
            purchase_remark: 采购备注
            cg_price: 采购成本（RMB）
            is_related: 是否关联单品成本 0-否，1-是
            cg_delivery: 采购交期
            cg_product_material: 商品材质
            cg_product_length: 单品规格-长（CM）
            cg_product_width: 单品规格-宽（CM）
            cg_product_height: 单品规格-高（CM）
            cg_product_net_weight: 单品净重（G）
            cg_product_gross_weight: 单品毛重（G）
            cg_package_length: 包装规格-长（CM）
            cg_package_width: 包装规格-宽（CM）
            cg_package_height: 包装规格-高（CM）
            cg_box_length: 外箱规格-长（CM）
            cg_box_width: 外箱规格-宽（CM）
            cg_box_height: 外箱规格-高（CM）
            cg_box_weight: 单箱重量（KG）
            cg_box_pcs: 单箱数量（包装数量）
            bg_customs_export_name: 报关：申报品名（中文）
            bg_export_hs_code: 报关：HS Code（中国）
            bg_customs_import_name: 报关：申报品名（英文）
            currency: 报关：申报金额的币种
            bg_customs_import_price: 报关：申报金额
            product_creator_uid: 创建人 ID
            product_duty_uids: 负责人 ID 数组
            is_append_product_duty: 负责人是否追加创建人 0-否，1-是
            qc_standard: 质检标准 {"custom_qc_template": {"qc_image": []}}
            product_logistics_list: 报关清关费用信息 {"US_cg_transport_costs": 0, ...}
            supplier_quote: 供应商报价信息数组
            special_attr: 产品特殊属性数组 [1,2,3]
            declaration: 报关数据
            clearance: 清关数据
            aux_relation_list: 辅料列表 [{"aux_sku": "", "sku_qty": 1, "aux_qty": 2}]
            spec_pack_list: 更多箱规数组
            api_spu: SPU
            api_spu_attribute: 属性列表 [{"pa_id": 1, "pai_id": 101}]
            custom_fields: 自定义字段 [{"id": "", "val": "", "character": ""}]

        Returns:
            接口响应 JSON
        """
        body: Dict[str, Any] = {"sku": sku}
        if product_name is not None:
            body["product_name"] = product_name
        if sku_identifier is not None:
            body["sku_identifier"] = sku_identifier
        if picture_list is not None:
            body["picture_list"] = picture_list
        if unit is not None:
            body["unit"] = unit
        if category_id is not None:
            body["category_id"] = category_id
        if category is not None:
            body["category"] = category
        if model is not None:
            body["model"] = model
        if brand_id is not None:
            body["brand_id"] = brand_id
        if brand is not None:
            body["brand"] = brand
        if open_status is not None:
            body["open_status"] = open_status
        if status is not None:
            body["status"] = status
        if description is not None:
            body["description"] = description
        if group_list is not None:
            body["group_list"] = group_list
        if cg_opt_uid is not None:
            body["cg_opt_uid"] = cg_opt_uid
        if cg_opt_username is not None:
            body["cg_opt_username"] = cg_opt_username
        if product_developer_uid is not None:
            body["product_developer_uid"] = product_developer_uid
        if product_developer is not None:
            body["product_developer"] = product_developer
        if purchase_remark is not None:
            body["purchase_remark"] = purchase_remark
        if cg_price is not None:
            body["cg_price"] = cg_price
        if is_related is not None:
            body["is_related"] = is_related
        if cg_delivery is not None:
            body["cg_delivery"] = cg_delivery
        if cg_product_material is not None:
            body["cg_product_material"] = cg_product_material
        if cg_product_length is not None:
            body["cg_product_length"] = cg_product_length
        if cg_product_width is not None:
            body["cg_product_width"] = cg_product_width
        if cg_product_height is not None:
            body["cg_product_height"] = cg_product_height
        if cg_product_net_weight is not None:
            body["cg_product_net_weight"] = cg_product_net_weight
        if cg_product_gross_weight is not None:
            body["cg_product_gross_weight"] = cg_product_gross_weight
        if cg_package_length is not None:
            body["cg_package_length"] = cg_package_length
        if cg_package_width is not None:
            body["cg_package_width"] = cg_package_width
        if cg_package_height is not None:
            body["cg_package_height"] = cg_package_height
        if cg_box_length is not None:
            body["cg_box_length"] = cg_box_length
        if cg_box_width is not None:
            body["cg_box_width"] = cg_box_width
        if cg_box_height is not None:
            body["cg_box_height"] = cg_box_height
        if cg_box_weight is not None:
            body["cg_box_weight"] = cg_box_weight
        if cg_box_pcs is not None:
            body["cg_box_pcs"] = cg_box_pcs
        if bg_customs_export_name is not None:
            body["bg_customs_export_name"] = bg_customs_export_name
        if bg_export_hs_code is not None:
            body["bg_export_hs_code"] = bg_export_hs_code
        if bg_customs_import_name is not None:
            body["bg_customs_import_name"] = bg_customs_import_name
        if currency is not None:
            body["currency"] = currency
        if bg_customs_import_price is not None:
            body["bg_customs_import_price"] = bg_customs_import_price
        if product_creator_uid is not None:
            body["product_creator_uid"] = product_creator_uid
        if product_duty_uids is not None:
            body["product_duty_uids"] = product_duty_uids
        if is_append_product_duty is not None:
            body["is_append_product_duty"] = is_append_product_duty
        if qc_standard is not None:
            body["qc_standard"] = qc_standard
        if product_logistics_list is not None:
            body["product_logistics_list"] = product_logistics_list
        if supplier_quote is not None:
            body["supplier_quote"] = supplier_quote
        if special_attr is not None:
            body["special_attr"] = special_attr
        if declaration is not None:
            body["declaration"] = declaration
        if clearance is not None:
            body["clearance"] = clearance
        if aux_relation_list is not None:
            body["aux_relation_list"] = aux_relation_list
        if spec_pack_list is not None:
            body["spec_pack_list"] = spec_pack_list
        if api_spu is not None:
            body["api_spu"] = api_spu
        if api_spu_attribute is not None:
            body["api_spu_attribute"] = api_spu_attribute
        if custom_fields is not None:
            body["custom_fields"] = custom_fields
        return self._request("POST", "/erp/sc/routing/storage/product/set", body=body)

    def upload_local_product_picture(
        self,
        sku: str,
        picture_list: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        上传本地产品图片

        接口路径：POST /erp/sc/routing/storage/product/uploadPictures
        令牌桶容量：1

        Args:
            sku: 本地产品 SKU（必填）
            picture_list: 产品图片信息数组（必填）
                [{"pic_url": "http://example.com/image.jpg", "is_primary": 1}]

        Returns:
            接口响应 JSON
        """
        body = {
            "sku": sku,
            "picture_list": picture_list,
        }
        return self._request(
            "POST",
            "/erp/sc/routing/storage/product/uploadPictures",
            body=body,
        ) 