# L2 上架延迟分析

## 意义

从"创建 SKU"到"FBA 首次可售"的月数是**运营执行效率的关键指标**。同一开发人的品,如果 FBA 首现月总是拖到创建后 3+ 月,说明:
- 运营选品慢
- 供应商备货慢
- 或亚马逊 Listing 审核慢

## 数据来源

- `data/sku_full_lifecycle.csv` · L1月份 + L2 首次观察到FBA可售月
- 领星模型/基础统一表 · 创建时间 + 首次观察到FBA可售月

## 延迟分档规则

| 档 | 定义 | 含义 |
|---|---|---|
| 当月上架 | FBA 首现月 = 创建月 | 极快,通常是标品复制型 |
| 1 月内 | 差 1 个月 | 正常运营节奏 |
| 2 月内 | 差 2 个月 | 边缘,可接受 |
| 3+ 月 | 差 ≥ 3 月 | ⚠️ **偏慢**,需查原因 |
| 未上 | 全期无 FBA | 需要走"未上架 4 类原因"分析 |

## 应用场景

对候选做判断时:

1. 查候选属于哪个开发人
2. 查该开发人过去 6 个月的**平均延迟月数**
3. 如果 > 2 月,警戒;判断该品是不是季节性紧的(如秋季元素挂牌),若是则风险大

## 数据文件

由 `scripts/link_layers.py` 产出的 `data/sku_full_lifecycle.csv` 已经含:
- `L1月份` — 创建月份
- `首次观察到FBA可售月` — FBA 首现月
- `模型分析起算月` — 领星模型算的起算月

## 待补充统计

按开发人/手法/主题算延迟中位数是下一步工作,当前 references 先备好数据源和判断逻辑,具体分布可用以下 SQL 直查(在 pandas 里):

```python
import pandas as pd
df = pd.read_csv('data/sku_full_lifecycle.csv')
df['L1_ym'] = df['L1月份']
df['FBA_ym'] = df['首次观察到FBA可售月']

def delay_months(row):
    if pd.isna(row.FBA_ym) or not row.FBA_ym: return None
    y1, m1 = row.L1_ym.split('-')
    y2, m2 = row.FBA_ym.split('-')
    return (int(y2) - int(y1)) * 12 + int(m2) - int(m1)

df['delay'] = df.apply(delay_months, axis=1)
df.groupby('开发')['delay'].describe()
```
