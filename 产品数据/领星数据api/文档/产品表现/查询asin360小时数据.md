# 查询 ASIN 360 小时数据

---

## 接口信息

| 项目 | 内容 |
|------|------|
| **API Path** | `/basicOpen/salesAnalysis/productPerformance/performanceTrendByHour` |
| **请求协议** | HTTPS |
| **请求方式** | POST |
| **令牌桶容量** | 1 |

---

## 请求参数

| 参数名 | 说明 | 必填 | 类型 | 示例 |
|--------|------|:----:|:----:|------|
| `sids` | 店铺 ID，多个值使用英文逗号隔开，最大上限为 200 | **是** | string | 136,139 |
| `date_start` | 开始时间，闭区间，格式：Y-m-d | **是** | string | 2024-09-24 |
| `date_end` | 结束时间，闭区间，格式：Y-m-d | **是** | string | 2024-09-24 |
| `summary_field` | 查询维度：`parent_asin`、`asin`、`msku`、`sku`、`spu` | **是** | string | spu |
| `summary_field_value` | 查询维度值 | **是** | string | 10886 |

### 请求示例

```json
{
    "sids": "136,139",
    "date_start": "2024-09-24",
    "date_end": "2024-09-24",
    "summary_field": "spu",
    "summary_field_value": "10886"
}
```

---

## 返回结果

返回格式：Json Object

### 响应参数

| 参数名 | 说明 | 必填 | 类型 | 示例 |
|--------|------|:----:|:----:|------|
| `code` | 状态码，0 成功 | 是 | number | 0 |
| `message` | 提示信息 | 是 | string | success |
| `error_details` | 错误信息 | 是 | array | |
| `request_id` | 请求链路 ID | 是 | string | a0d54debf93140f3b58d1ed81e8e3583.185.17272486226367541 |
| `response_time` | 响应时间 | 是 | string | 2024-09-25 15:17:07 |
| `data` | 响应数据 | 是 | object | |
| `data>>list` | 数据列表 | 是 | array | |
| `data>>list>>r_date` | 小时段 | 是 | string | 00 |
| `data>>list>>volume` | 销量 | 是 | int | 0 |
| `data>>list>>order_items` | 订单量 | 是 | int | 0 |
| `data>>list>>amount` | 销售额 | 是 | string | 0.00 |
| `data>>list>>price` | 价格 | 是 | string | 0.00 |
| `data>>list>>sales_rank` | 大类排名 | 是 | string | 0 |
| `data>>total` | 总计 | 是 | object | |
| `data>>total>>r_date` | 小时段 | 是 | string | -1 |
| `data>>total>>volume` | 销量 | 是 | int | 0 |
| `data>>total>>order_items` | 订单量 | 是 | int | 0 |
| `data>>total>>amount` | 销售额 | 是 | string | 0.00 |
| `data>>total>>price` | 价格 | 否 | null | |
| `data>>total>>sales_rank` | 大类排名 | 否 | null | |
| `data>>currency_icon` | 币种类型 | 是 | string | $ |
| `total` | 总数 | 是 | int | 0 |

### 成功响应示例

```json
{
    "code": 0,
    "message": "success",
    "error_details": [],
    "request_id": "a0d54debf93140f3b58d1ed81e8e3583.185.17272486226367541",
    "response_time": "2024-09-25 15:17:07",
    "data": {
        "list": [
            {"r_date": "00", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "01", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "02", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "03", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "04", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "05", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "06", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "07", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "08", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "09", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "10", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "11", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "12", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "13", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "14", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "15", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "16", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "17", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "18", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "19", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "20", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "21", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "22", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"},
            {"r_date": "23", "volume": 0, "order_items": 0, "amount": "0.00", "price": "0.00", "sales_rank": "0"}
        ],
        "total": {
            "r_date": "-1",
            "volume": 0,
            "order_items": 0,
            "amount": "0.00",
            "price": null,
            "sales_rank": null
        },
        "currency_icon": "$"
    },
    "total": 0
}
```
