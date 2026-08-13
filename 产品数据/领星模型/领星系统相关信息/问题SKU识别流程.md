# 问题SKU识别流程

> 从备货率分析结果中识别补货决策失误案例

**最后更新**: 2026-08-12  
**适用范围**: 筛选多批次补货但销量持续低迷的SKU，用于运营复盘  
**输出**: 运营策略问题清单 + CSV明细

---

## 一、识别目标

### 问题定义

**不是问题**：首批测款失败（首批采购10-15件但未出单）  
**真正问题**：**多批次补货但销量持续差** — 在首批验证不足的情况下仍连续补货

### 筛选标准

**多批次补货决策失误型**:
```
批次数 ≥ 2（不含首批）
AND 总采购量 ≥ 30件（投入成本达到关注阈值）
AND 销售率 < 40%（销量远小于采购量）
```

**分级严重性**:
- **极端失误**：≥7批补货，销售率<40%（决策机制完全失控）
- **中度失误**：4-6批补货，销售率<40%（缺乏止损机制）
- **初期失误**：2-3批补货，销售率<40%（首批验证不足即补货）

---

## 二、数据准备

### 2.1 前置条件

**依赖**: 备货率分析已完成，有以下数据：
1. 4月/5月清单SKU（从Excel读取）
2. 每个SKU的PPG批次数（从`lingxing_purchase_plan`查询）
3. 每个SKU的总采购量（`SUM(quantity_plan)`）
4. 每个SKU的总销量（从周表查询）

### 2.2 数据源

**采购批次数**:
```sql
SELECT sku,
       COUNT(DISTINCT ppg_sn) AS batch_count,
       SUM(quantity_plan) AS total_plan
FROM lingxing_purchase_plan
WHERE sku IN (清单SKU)
  AND status = -2              -- 只看已完成
  AND ppg_sn IS NOT NULL
  AND create_time IS NOT NULL
GROUP BY sku
```

**总销量**:
```sql
SELECT l.local_sku, SUM(w.volume) AS total_vol
FROM lingxing_listing l
JOIN lingxing_sku_weekly_performance w ON w.asin = l.asin
WHERE l.local_sku IN (清单SKU)
GROUP BY l.local_sku
```

**产品名称**:
```sql
SELECT sku, product_name
FROM lingxing_local_product
WHERE sku IN (清单SKU)
```

---

## 三、筛选逻辑

### 3.1 Python实现

```python
problems_2plus = []  # ≥2批问题
problems_3plus = []  # ≥3批问题

for sku in all_skus:
    info = sku_batch_purchase.get(sku)
    if not info:
        continue
    
    batch_count = info['batch_count']
    purchase = info['purchase']
    sales = sku_sales.get(sku, 0)
    
    # 过滤条件
    if purchase < 30:           # 采购量太小不算
        continue
    if batch_count < 2:         # 首批测款不算问题
        continue
    
    rate = (sales / purchase * 100) if purchase > 0 else 0
    
    if rate >= 40:              # 销售率还行，不算问题
        continue
    
    item = {
        'sku': sku,
        'name': sku_name.get(sku, ''),
        'month': sku_month.get(sku, ''),
        'batch_count': batch_count,
        'purchase': purchase,
        'sales': sales,
        'rate': rate,
        'unsold': purchase - sales
    }
    
    if batch_count >= 2:
        problems_2plus.append(item)
    if batch_count >= 3:
        problems_3plus.append(item)

# 排序：批次数倒序、销售率正序（批次多+销售率低的最严重）
problems_2plus.sort(key=lambda x: (-x['batch_count'], x['rate']))
problems_3plus.sort(key=lambda x: (-x['batch_count'], x['rate']))
```

### 3.2 阈值说明

| 参数 | 阈值 | 说明 |
|------|------|------|
| 批次数下限 | ≥2 | 首批是测款，允许失败；≥2批说明在首批反馈下仍补货 |
| 采购量下限 | ≥30件 | 总投入成本达到关注级别（<30件的小批量试错可接受） |
| 销售率上限 | <40% | 低于4成转化说明市场不认可，不应继续补货 |

**阈值调整建议**:
- 严格模式：`batch_count ≥ 3 && rate < 30%`（只看≥3批且极低销售率）
- 宽松模式：`batch_count ≥ 2 && rate < 50%`（包含销售率50%以下的）

---

## 四、结果分级

### 4.1 问题SKU分类

**输出统计**（2026-08-12实际数据）:
```
≥2批补货且销售率<40%: 217个SKU
  其中 ≥3批: 140个
  其中 ≥7批: 28个（极端失误）

总滞销库存:
  ≥2批: 12222件
  ≥3批: 10190件
```

### 4.2 TOP案例（极端失误）

| SKU | 批次数 | 采购 | 销量 | 销售率 | 滞销 | 产品 | 问题类型 |
|-----|------:|----:|----:|------:|----:|------|----------|
| 2551363 | **10批** | 225 | 88 | 39.1% | 137 | 绿色拖拉机风车 | 连续决策失控 |
| 2561288 | 9批 | 200 | 50 | 25.0% | 150 | 护腕鼠标垫黑猫 | 定制类过度补货 |
| 2561105 | 9批 | 190 | 57 | 30.0% | 133 | 22pcs农场动物蛋糕装饰 | 多件装低转化 |
| 2630680 | 6批 | 345 | 49 | **14.2%** | 296 | 基督教祈祷本 | 宗教类小众+大批量 |

### 4.3 品类模式识别

**初步观察**（需进一步统计验证）:

1. **定制类高发**（约30-40%案例）
   - 定制挂牌/化妆包/鼠标垫/铁皮画等
   - 小众市场但按标品规模补货
   - 示例：2561288（定制鼠标垫9批，25%销售率）

2. **多件装高发**（2pcs/4pcs/22pcs等）
   - 总价高导致转化率低
   - 用户更倾向单件购买
   - 示例：2561105（22pcs装，9批补货）

3. **宗教类问题**
   - 祈祷本/基督教用品受众窄
   - 但采购量大（如2630680采购345件）

4. **季节性装饰品**
   - 花盆装饰/风车/庭院灯
   - 错过旺季后全年均匀补货

---

## 五、问题清单生成

### 5.1 文档结构

**主文档**: `docs/运营策略问题清单.md`

**章节**:
```markdown
# 运营策略问题清单

## 案例索引（TOP 10重点案例）
| 案例 | SKU | 批次数 | 采购 | 销量 | 销售率 | 滞销 | 问题类型 | 状态 |

## #001 2551363 - 补货10次仍销售不佳（极端案例详细分析）
### 基本信息
### 补货时间线（需查实）
### 关键问题
### 可能原因
### 紧急验证点

## #002~#007 其他高批次案例

## 批量问题分析（217个案例）
### 问题规模
### 典型模式
### 共性原因
### 紧急处置建议
### 数据验证点

## 待补充案例
```

### 5.2 CSV明细导出

**文件**: `docs/运营策略问题清单_附件_217个2批以上问题SKU.csv`

**格式**:
```csv
sku,name,month,batch_count,purchase,sales,rate,unsold
2551363,绿色拖拉机风车造型旋转轮,4月,10,225,88,39.1,137
2561288,【定制】护腕鼠标垫【黑猫】,5月,9,200,50,25.0,150
...
```

**Python导出代码**:
```python
import csv

OUT = r"E:\项目\si-jue-zhi-mao-up\docs\运营策略问题清单_附件_217个2批以上问题SKU.csv"

with open(OUT, 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'sku','name','month','batch_count','purchase','sales','rate','unsold'
    ])
    writer.writeheader()
    writer.writerows(problems_2plus)
```

---

## 六、深度分析（可选）

### 6.1 品类聚类统计

**目标**: 识别哪些品类是高发问题品类

**方法**:
```python
# 按产品名称关键词分类
categories = {
    '定制': [],
    '多件装': [],  # 包含pcs
    '宗教': [],    # 祈祷/基督
    '装饰': [],    # 挂牌/风车/花盆
    # ...
}

for p in problems_2plus:
    name = p['name']
    if '定制' in name:
        categories['定制'].append(p)
    if 'pcs' in name or '装' in name:
        categories['多件装'].append(p)
    # ...

# 统计各品类的平均销售率、批次数
for cat, items in categories.items():
    avg_rate = sum(i['rate'] for i in items) / len(items)
    avg_batch = sum(i['batch_count'] for i in items) / len(items)
    print(f"{cat}: {len(items)}个, 平均销售率{avg_rate:.1f}%, 平均批次{avg_batch:.1f}")
```

### 6.2 开发人/采购人分析

**目标**: 识别是个人问题还是系统问题

**方法**:
```python
# 统计每个开发人的问题SKU数
dev_problems = defaultdict(list)
for p in problems_2plus:
    dev = sku_dev_map.get(p['sku'])  # 从清单文件名推断开发人
    dev_problems[dev].append(p)

# 输出
for dev, items in dev_problems.items():
    print(f"{dev}: {len(items)}个问题SKU, 占其SKU总数{len(items)/dev_total[dev]*100:.1f}%")
```

**预期结果**:
- 如果问题集中在某1-2个开发人 → 个人选品问题
- 如果分布均匀 → 系统性问题（流程/规则缺陷）

### 6.3 补货时间线分析（深度案例）

**目标**: 还原极端案例（如10批补货）的决策时间线

**方法**:
```sql
-- 查询某SKU的完整PPG时间线
SELECT ppg_sn, creator_real_name, 
       DATE(create_time) AS ppg_date,
       quantity_plan, status_text
FROM lingxing_purchase_plan
WHERE sku = '2551363' AND status = -2
ORDER BY create_time;

-- 查询该SKU每个PPG创建时的历史销量（需手动推算）
-- 示例：PPG2创建于2026-05-10，查询截至05-10的累计销量
SELECT SUM(volume)
FROM lingxing_sku_weekly_performance w
JOIN lingxing_listing l ON l.asin = w.asin
WHERE l.local_sku = '2551363'
  AND w.week_start < '2026-05-10';
```

**输出格式**:
```
| 批次 | PPG创建时间 | 本批采购 | 累计采购 | 截至该批的销量 | 当时销售率 | 决策合理性 |
|------|------------|---------|---------|---------------|----------|----------|
| Q1   | 2026-04-10 | 20      | 20      | 0             | 0%       | 首批测款 ✓ |
| Q2   | 2026-05-05 | 30      | 50      | 5             | 25%      | 过早补货 ✗ |
| Q3   | 2026-05-20 | 25      | 75      | 12            | 24%      | 继续误判 ✗ |
| ...  | ...        | ...     | 225     | 88            | 39.1%    | 10次失误 ✗✗✗ |
```

**价值**: 识别是"一开始就错"还是"中途失控"

---

## 七、处置建议输出

### 7.1 立即止损（紧急）

**行动清单**:
1. ✅ 冻结217个SKU的所有待执行采购计划
2. ✅ 分级清货策略：
   - ≥7批低销售率（28个）：降价50% + 快速清仓
   - 4-6批（112个）：降价30% + 捆绑销售
   - 2-3批（77个）：小幅降价 + 优化Listing
3. ⬜ 成本核算：计算12222件滞销库存的总损失

**执行**:
```sql
-- 查询这些SKU的待执行采购计划（status=2待采购, 121待审批）
SELECT plan_sn, sku, quantity_plan, status_text
FROM lingxing_purchase_plan
WHERE sku IN (217个问题SKU)
  AND status IN (2, 121);

-- 手动在领星后台作废这些计划，或联系采购人李杉
```

### 7.2 流程改进（中期）

**补货审批机制（关键）**:
```
≥3批的SKU，下一批补货前必须：
1. 运营提供销售数据（周均销量、销售率、趋势）
2. 销售率<40%禁止补货，需总监签字豁免
3. 销售率<30%强制停止，启动清货
```

**补货阈值提升**:
```
二批补货：首批销售率 ≥ 50%
三批补货：前两批平均销售率 ≥ 60%
四批及以上：前三批平均销售率 ≥ 70% 且周均销量持续上升
```

**自动预警系统**:
```python
# 每周自动标记异常SKU
for sku in active_skus:
    if batch_count >= 2 and sales_rate < 40:
        send_alert(f"SKU {sku} 补货{batch_count}次但销售率仅{sales_rate}%, 建议停止补货")
```

### 7.3 后续跟踪（长期）

**验证点清单**:
- [ ] 抽查20个高批次SKU的PPG时间线，确认补货决策时的销售数据
- [ ] 统计217个SKU的开发人分布
- [ ] 统计217个SKU的采购人分布（李杉占比？）
- [ ] 查询是否存在自动补货脚本/规则
- [ ] 按品类聚类分析（定制/多件装/宗教类的占比）
- [ ] 3个月后复查：这217个SKU是否停止补货、清货进度如何

---

## 八、脚本使用示例

### 8.1 快速筛选命令

```bash
# 运行问题SKU识别脚本
python E:\项目\si-jue-zhi-mao-up\tmp\find_multi_batch_problems.py

# 输出示例
找到 217 个问题SKU（≥2批 && 采购≥30 && 销售率<40%）
其中 140 个是≥3批

≥3批补货但销售率<40%的SKU（最严重，决策连续失误）
SKU        月份     批次     采购     销量     销售率      滞销     产品名
2551363    4月     10     225    88       39.1% 137    绿色拖拉机风车造型旋转轮
2561288    5月     9      200    50       25.0% 150    【定制】护腕鼠标垫【黑猫】
...

统计:
  ≥3批且销售率<40%: 140 个
  ≥2批且销售率<40%: 217 个
  总滞销库存(≥2批): 12222 件
  总滞销库存(≥3批): 10190 件
```

### 8.2 导出到CSV

```python
# 自动生成CSV附件
python E:\项目\si-jue-zhi-mao-up\tmp\export_problems.py

# 输出
已导出 217 个问题SKU到: docs/运营策略问题清单_附件_217个2批以上问题SKU.csv
```

---

## 九、与备货率分析的关系

### 9.1 数据流转

```
备货率分析（流程1）
    ↓ 输出
Excel报表（每SKU的批次数、采购量、销量）
    ↓ 读取
问题SKU识别（流程2）
    ↓ 筛选
217个多批次低销售率案例
    ↓ 输出
运营策略问题清单.md + CSV明细
```

### 9.2 复用数据

问题SKU识别**复用**备货率分析的以下数据：
- 清单SKU（4月/5月Excel）
- PPG批次统计（`sku_batch_purchase`字典）
- 周表销量（`sku_sales`字典）
- 产品名称（`sku_name`字典）

**优化**: 可以将备货率分析脚本的中间结果序列化保存（pickle/json），问题识别直接读取，避免重复查询数据库。

---

## 十、总结

### 关键发现

从4月/5月1157个新建SKU中，识别出**217个多批次补货决策失误案例**（18.8%），其中：
- 140个SKU ≥3批补货仍销售率<40%（连续决策失误）
- 28个SKU ≥7批补货（决策机制完全失控）
- 总滞销库存12222件

### 核心价值

不是找"首批测款失败"（这是精铺模式的正常成本），而是找**"明知销量差还连续补货"**的决策失误 — 这才是可优化、可避免的损失。

### 行动指南

1. **紧急**：冻结217个SKU补货计划，启动清货
2. **中期**：建立≥3批强制复盘机制，销售率<40%禁止补货
3. **长期**：优化首批验证期（至少2-4周），提升补货阈值（≥50%）

---

**文档维护**: 数据分析组  
**脚本路径**: `E:\项目\si-jue-zhi-mao-up\tmp\find_multi_batch_problems.py`  
**输出路径**: `E:\项目\si-jue-zhi-mao-up\docs\运营策略问题清单.md`
