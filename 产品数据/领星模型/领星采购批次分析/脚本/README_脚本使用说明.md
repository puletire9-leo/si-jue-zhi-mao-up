# 领星采购批次分析 - 脚本使用说明

> 完整工具链：从理实产品对接表提取SKU → 检查/同步数据 → 查库分析 → 生成备货率报表

**最后更新**: 2026-08-12

---

## 一、脚本清单

| 脚本 | 用途 | 必用 |
|------|------|:----:|
| `extract_sku_by_dev.py` | 提取**单个指定开发人**的SKU（命令行传参） | ✓ |
| `extract_all_devs.py` | 批量提取**所有月份所有开发人**的SKU | ✓ |
| `scan_developers.py` | 扫描某月所有开发人（确认目标存在） | 辅助 |
| `check_data_freshness.py` | 检查采购/周表数据时效 + 触发增量同步 | ✓ |
| `query_database.py` | 通用MySQL查询工具（避免高频docker exec） | ✓ |
| `explore_tables.py` | 查看领星表结构/字段/样本 | 辅助 |
| `generate_report.py` | **主脚本**：生成备货率+利润分析报表 | ✓ |
| `README_脚本使用说明.md` | 本文档 | - |

---

## 二、环境准备

### 依赖
```bash
pip install pymysql openpyxl
```

### 数据库连接
密码和端口从项目配置读，不要写在脚本里：
- `config/secrets/prod.env` 的 `MYSQL_PASSWORD`
- `config/public/prod.env` 的 `MYSQL_PORT_EXTERNAL`（宿主机映射，默认 3310）

共用入口是同目录 `query_database.py`（内部调用 `scripts/config_env.py`）。
> 端口可能变，用 `docker ps --filter "name=prod-mysql" --format "{{.Ports}}"` 确认

### 铁律（重要）
- **禁止高频 `docker exec mysql` 查数据** → 会打爆 WSL2 内存(限9GB)导致Docker崩溃
- **必须用 pymysql 直连**, 一次连接批量查（`query_database.py` / 脚本内统一封装）
- 大结果集先在SQL聚合, 别全表拉进Python

---

## 三、完整流程（5步）

### 第1步：确认目标开发人（可选）
```bash
python scan_developers.py
```
输出各月所有开发人, 确认新增开发人（黄雨珊/张子轩/夏浩宇等）存在。

### 第2步：提取SKU清单

**方式A - 全部开发人**（推荐，用于全量报表）：
```bash
python extract_all_devs.py
```
自动扫描 MONTHS_CONFIG 里所有月份, 按"开发"列提取每个开发人SKU。

**方式B - 单个开发人**（临时要看某个人）：
```bash
python extract_sku_by_dev.py 3月 "E:\...\理实产品开发表3月份" "理实产品对接表03." 宋凤莉
```

**输出**：`SKU清单/{月份}SKU明细/{月份}新建sku-{开发人简称}.xlsx`（一列SKU）

### 第3步：检查数据同步（必做）
```bash
python check_data_freshness.py
```
- 若采购计划最新日期远早于今天 → 数据过期
- 触发增量同步（脚本带 `--sync` 交互式，或手动调API）

**手动同步API**（生产 java-product 直连 8025）：
```bash
# 采购计划
POST http://127.0.0.1:8025/api/v1/modules/lingxing/purchase/plans/sync
{"startDate":"2026-06-30","endDate":"2026-08-11","searchFieldTime":"creator_time"}

# 采购单
POST http://127.0.0.1:8025/api/v1/modules/lingxing/purchase/orders/sync
{"startDate":"2026-07-01","endDate":"2026-08-11","searchFieldTime":"create_time"}
```

### 第4步：生成报表
编辑 `generate_report.py` 配置区：
```python
# 月份配置: (月份名, SKU清单目录)
MONTHS_CONFIG = [
    ("1-2月", os.path.join(SKU_BASE, "1-2月SKU明细")),
    ("3月",   os.path.join(SKU_BASE, "3月SKU明细")),
    ...
]
OUT_PATH = r"...\报表\1-7月备货分析_全部开发人.xlsx"
EMBED_IMAGE = False  # 明细Sheet是否嵌入图片(第一列)
```
运行：
```bash
python generate_report.py
```

### 第5步：查看报表
输出到 `报表/` 目录：
- **汇总Sheet**（9列无毛利）：开发人分组 → 各月 → 该人跨月合计 → 全局总计
- **明细Sheet**（按月×开发人×国家）：完整批次/采购量/销量/毛利

---

## 四、核心口径（generate_report.py）

### ⚠️ 口径修正（2026-08-14 重要）
**备货批次从"采购计划(PPG)"改为"采购单(PO)"。**
- 原因：采购计划(PPG)只是运营的采购决策，**批了不等于真的下单采购**。
- 实测：1-7月有 **701个SKU(16.7%)** 只有采购计划、从未下采购单。用PPG算把这些误算成"有备货"，高估备货率。
- 前端"领星产品详情"看的是采购单(PO)，所以之前报表和前端对不上——现在统一到PO口径。
- 影响：二次备货率 31.4%(PPG) → 26.2%(PO)。

### 批次单位 = 采购单 PO（关键）
- 用采购单 `order_sn`，**不是**采购计划 `ppg_sn`
- 只有真正下过采购单（PO）才算"有备货"
- 一个有效采购单 = 一个备货批次

### 有效单过滤
- 排除作废单 `status NOT IN (-1,124)`
- 排除删除明细 `item.is_delete=1`
- 排除 `order_time IS NULL`

### 国家归属 = 关联采购计划的创建人
```python
# PO明细.plan_sn 关联 采购计划.creator_real_name
country = "DE" if creator_real_name == "余江燕" else "UK"
# 关联不上采购计划的默认 UK
```
- 余江燕负责德国，其他运营负责英国

### 同日合并
- 同SKU同国同日多个采购单合并为1批（按 `DATE(order_time)` 去重）

### 利润归属 = 周表按批次周期分段
- 周表按 `marketplace`(英国/德国) 归 UK/DE
- 各国内部按采购单下单日划分 Q1/Q2/Q3 周期
- `week_start >= 批次i的order_time` → 归属批次i

### 组合/辅料
- 组合SKU（is_combo=1）：算入分母，明细标记
- 辅料（is_aux=1）：排除分母

### 图片（可选，EMBED_IMAGE=True）
- SKU→listing.asin→`lingxing_images`本地缓存（ASIN命名）
- 缺失从 `small_image_url` 下载；无listing的用 `local_product.pic_url` 兜底

---

## 五、报表结构

### 汇总Sheet（9列）
```
开发人 | 月份 | 国家 | 主SKU | 有采购 | ≥2批 | ≥3批 | 二次备货率 | 三次备货率
```
- 二次备货率 = ≥2批 / 有采购
- 三次备货率 = ≥3批 / 有采购
- 灰底=该开发人跨月合计, 黄底=全局总计

### 明细Sheet（24列无图 / 25列有图）
```
[图片] | SKU | 中文名称 | 类型 | 批次数 | 各批采购单日期 |
Q1量 | Q2量 | Q3量 | 备注 |
Q1销量 | Q1销售额 | Q1毛利 | Q1毛利率(%) |
Q2... | Q3... |
汇总销量 | 汇总销售额 | 汇总毛利 | 汇总毛利率(%)
```

---

## 六、常用数据库查询

**查备货批次数（PO口径）**：
```sql
SELECT i.sku, COUNT(DISTINCT o.order_sn) FROM lingxing_purchase_order_item i
JOIN lingxing_purchase_order o ON o.order_sn=i.order_sn
WHERE i.sku IN (...) AND o.status NOT IN (-1,124)
  AND (i.is_delete IS NULL OR i.is_delete=0) GROUP BY i.sku;
```

**查国家归属（PO明细关联采购计划创建人）**：
```sql
SELECT i.sku, o.order_sn, DATE(o.order_time), p.creator_real_name, SUM(i.quantity_real)
FROM lingxing_purchase_order_item i
JOIN lingxing_purchase_order o ON o.order_sn=i.order_sn
LEFT JOIN lingxing_purchase_plan p ON p.plan_sn=i.plan_sn AND p.status=-2
WHERE i.sku IN (...) AND o.status NOT IN (-1,124) AND o.order_time IS NOT NULL
GROUP BY i.sku, o.order_sn, DATE(o.order_time), p.creator_real_name;
```

**查周表利润**（经listing映射）：
```sql
SELECT l.local_sku, l.marketplace, w.week_start, w.volume, w.amount, w.gross_profit
FROM lingxing_listing l JOIN lingxing_sku_weekly_performance w ON w.asin=l.asin
WHERE l.local_sku IN (...);
```

**查组合/辅料**：
```sql
SELECT DISTINCT sku FROM lingxing_purchase_plan WHERE is_combo=1 AND sku IN (...);
SELECT DISTINCT sku FROM lingxing_purchase_plan WHERE is_aux=1 AND sku IN (...);
```

**查SKU图片**：
```sql
SELECT local_sku, asin, small_image_url FROM lingxing_listing WHERE local_sku IN (...);
SELECT sku, pic_url FROM lingxing_local_product WHERE sku IN (...);
```

---

## 七、数据源表

| 表 | 用途 |
|----|------|
| `lingxing_purchase_order(_item)` | **备货批次主源（PO口径）**：order_sn批次 / order_time下单日 / quantity_real采购量 / status / item.plan_sn关联计划 |
| `lingxing_purchase_plan` | 国家归属+组合辅料标记（plan_sn/creator_real_name/is_combo/is_aux）；不再直接算批次 |
| `lingxing_local_product` | SKU中文名、pic_url |
| `lingxing_listing` | SKU→ASIN映射（asin/marketplace/small_image_url） |
| `lingxing_sku_weekly_performance` | 周表（asin/week_start/volume/amount/gross_profit） |
| `lingxing_profit_asin` | 利润-ASIN（覆盖差，慎用） |

---

## 八、常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| 报表和前端产品详情对不上 | 报表曾用PPG计划、前端用PO订单 | 已统一到PO口径(2026-08-14) |
| SKU有计划但报表不显示 | 只有采购计划、没下采购单 | 正常——PO口径下计划未执行不算备货 |
| 批次数不对 | 同日多采购单 | 脚本已按 DATE(order_time) 去重 |
| 开发人提取为0 | 全名不匹配(宋→宋凤莉) | scan_developers 看全名 |
| 图片全缺 | EMBED_IMAGE未开 / IMG_DIR不对 | 开开关+确认图片目录 |
| 数据库连不上 | 端口变/容器停 | docker ps 确认端口 |
| Docker崩溃 | 高频docker exec | 用pymysql直连 |
