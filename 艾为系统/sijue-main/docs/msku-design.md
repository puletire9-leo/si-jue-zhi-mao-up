# MSKU 表设计与实现要点

## 1. 业务约定（已定）

- **MSKU 含义**：一个商品 + 一个店铺 + 一个变体 = 一个 MSKU；多条采购记录可对应同一个 MSKU（追加采购）。
- **生成规则**：可读业务编号 = `店铺名称缩写-入库日期-产品名称5位缩写-变体名称前五位缩写`。
- **唯一性**：按「商品 + 店铺 + 变体」共用一个 MSKU，用独立表管理，采购表通过外键关联。

---

## 2. 表结构

### 2.1 MSKU 主表 `app_amz_msku`

| 字段 | 类型 | 说明 |
|------|------|------|
| msku | varchar(128) PK | MSKU 业务编号，主键 |
| seller_sku | varchar(40) NULL | 上架 SKU（运营在内容工作台填写，空则用 msku） |
| candidate_id | varchar(64) | 选品 ID |
| candidate_name | varchar(200) | 选品名称（冗余，便于查询） |
| seller_id | varchar(64) | 卖家 ID |
| seller_name | varchar(255) | 卖家账户名称 |
| selected_variant | varchar(255) | 变体名称（参与唯一：商品+店铺+变体） |
| createTime, updateTime | datetime(6) | 创建/更新时间 |

- **主键**：`msku` 业务编号即主键，无额外 id。
- **唯一约束**：`(candidate_id, seller_id, selected_variant)`，保证同一商品+店铺+变体只一条 MSKU。

### 2.2 采购表 `app_amz_bsr_candidate_purchaser` 变更

- 新增：`msku`（varchar(128)，可空），存 MSKU 业务编号，对应主表主键。
- 多条采购记录可指向同一个 `msku`（追加采购）。

---

## 3. MSKU 编号生成规则

格式：`店铺名称缩写-入库日期-产品名称5位缩写-变体名称前五位缩写`

| 部分 | 来源 | 规则 |
|------|------|------|
| 店铺名称缩写 | seller_name | 拼音首字母，取前 5 位（不足补足或截断，可先定 5 位） |
| 入库日期 | 选「做」的当天 | YYYYMMDD |
| 产品名称5位缩写 | candidate.produce_name | 拼音首字母，取 5 位 |
| 变体名称前五位缩写 | selectedVariant | 拼音首字母，取 5 位 |

- 后端已有 `pinyin`（如 bsr_candidate service），可复用 `pinyin(x, { style: pinyin.STYLE_FIRST_LETTER })` 取首字母。

---

## 4. 「选做」时逻辑（后端）

在现有「做」的流程里（更新 `is_generate=2`、更新采购行时）：

1. 对每条被标记为「做」的采购记录，取：`candidate_id`、`seller_id`、`selectedVariant`；并从选品表取 `produce_name`，从采购记录取 `seller_name`。
2. **查 MSKU 表**：`WHERE candidate_id = ? AND seller_id = ? AND selected_variant = ?`（selected_variant 空时用 `''` 或统一占位）。
3. **若已存在**：该采购记录 `msku_id = 已有.id`，不生成新 MSKU。
4. **若不存在**：  
   - 按上面规则生成 `msku` 字符串；  
   - `INSERT INTO app_amz_msku (msku, candidate_id, candidate_name, seller_id, seller_name, selected_variant)`；  
   - 该采购记录 `msku_id = 新记录.id`。
5. 更新采购记录时写入 `msku_id`（以及原有 is_generate、数量等字段）。

---

## 5. 实现清单

- [ ] Entity：新建 `AppAmzMskuEntity`，表 `app_amz_msku`。
- [ ] Entity：采购表增加 `msku_id` 字段。
- [ ] Migration：建表 `app_amz_msku` + 唯一索引 `(candidate_id, seller_id, selected_variant)`；采购表 `ADD COLUMN msku_id`。
- [ ] Service：封装「根据 candidate_id + seller_id + selectedVariant 查或建 MSKU，返回 msku_id」；内部实现拼音缩写与编号拼接。
- [ ] 「做」接口：在更新采购行时调用上述 Service，写回 `msku_id`。
- [ ] 前端（可选）：列表/详情展示 MSKU 时，用采购记录的 `msku_id` 关联查 msku 表取 `msku` 展示。

---

## 6. 已定细节

1. **店铺名称缩写**：拼音首字母最多 **12** 位；产品、变体各前 5 位，不足则短一点；整串仍控制在 40 以内（含碰撞后缀 `-99`）。
2. **入库日期**：选做操作当天 YYYYMMDD。
3. **变体**：选做时变体必选，前端做校验；后端生成 MSKU 时使用 `selected_variant`，空则用 `''` 参与唯一键。
