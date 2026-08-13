# 关联统一到 seller_account_id（店铺账号）— 已实施

目标：采购人选择、MSKU 关联、图需表挂载与选择，全部以 **店铺账号（seller_account_id）** 为维度，不再用店铺（seller_id）。

**实施决策**：不保留 seller_id；MSKU 同 (candidate_id, seller_account_id, selected_variant) 合并为一条；final_shop 改为 final_account（存 seller_account_id）。

---

## 一、已完成的改动

### 1. 数据层

- **app_amz_bsr_candidate_purchaser**：`seller_id`/`seller_name` → `seller_account_id`/`account_name`
- **app_amz_msku**：`seller_id`/`seller_name` → `seller_account_id`/`account_name`，唯一约束改为 `(candidate_id, seller_account_id, selected_variant)`，同账号多站点合并为一条
- **design_task_picture**：`seller_id` → `seller_account_id`
- **design_upload_task**：`final_shop` → `final_account`（varchar 存 seller_account_id）

迁移：`1738540000000-seller-account-refactor.ts`（含老数据回填与 MSKU 合并逻辑）。

### 2. 后端

- **seller**：新增 `listAccounts()` 与 `GET /listAccounts`，按 seller_account_id 去重返回账号列表
- **msku**：`getOrCreateMsku` 入参与表字段改为 seller_account_id / account_name
- **bsr_candidate / bsr_candidate_purchaser**：采购人与 MSKU 创建/更新全改为 seller_account_id、account_name
- **design_task**：syncForCandidate 按 seller_account_id 去重生成场景图；getDetail 返回账号列表；getMskusForCandidate 返回 seller_account_id/account_name；saveRequirementSlots、401 落表、getUploadTaskDetail、saveUploadTaskDetail、pageUploadTasks 全部改为 account 维度；final_shop → final_account

### 3. 前端

- **bsr-candidate3**：采购人「账户名称」下拉用 `accountList`（来自 `seller.listAccounts()`），value 为 `seller_account_id`；行数据与提交为 seller_account_id/account_name
- **design-requirement-regenerate-dialog**：选图挂载「挂载店铺账号」、主图「变体-账号」、slots 与保存用 bindSellerAccountId / seller_account_id
- **design-upload-task-detail**：最终上传店铺账号用 finalAccount，下拉与保存为 seller_account_id

---

## 二、其他表（未改）

listing / restocking / 领星同步等表中的 `seller_id`、`seller_name` 仍为「具体站点/店铺」维度，与领星 API、listing 归属一致，未纳入本次改造。

---

## 三、部署注意

1. 执行迁移：`1738540000000-seller-account-refactor.ts`（会回填并合并 MSKU，删除 seller_id/seller_name、final_shop）
2. 前端若未自动生成 `seller.listAccounts()`，需用自定义 request 调用 `GET /admin/seller/listAccounts`
