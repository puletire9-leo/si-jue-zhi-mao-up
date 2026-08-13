# 艾为系统采购发货管理模块 - Service层业务逻辑分析

## 一、采购计划创建的完整流程

### 1. 创建前校验（multi-step validation）

```typescript
async createPurchasePlan(param) {
    // ① 参数提取和归一化
    const { sku, quantity_plan, wid, require_wid, manual_remark } = param;
    const currentUser = this.getCurrentAdminUser();  // 从上下文获取当前用户
    
    // ② 仓库必填校验（业务规则）
    if (require_wid && !wid) {
        const message = '缺少采购仓库，未创建采购计划';
        if (return_structured_failure) {
            return this.buildStructuredCreateFailure(message, ...);
        }
        throw new Error(message);
    }
    
    // ③ 采购备注同步（前置操作）
    try {
        purchaseRemarkSync = await this.syncPurchaseRemarkBeforeCreate(purchase_remark_update, sku);
    } catch (error) {
        // 备注同步失败阻断创建
        if (return_structured_failure) {
            return this.buildStructuredCreateFailure('采购备注处理失败', ...);
        }
        throw error;
    }
    
    // ④ 获取当前用户的领星ID（作为采购员ID）
    let cgUid;
    try {
        const user = await this.userEntity.findOne({ where: { id: currentUser.userId } });
        if (user?.lingxingID) {
            cgUid = Number(user.lingxingID);
        }
    } catch (e) {
        // 获取失败不阻断，继续创建（降级处理）
        console.warn('获取用户lingxingID失败:', e);
    }
}
```

**借鉴价值**：

1. **结构化失败响应**：`return_structured_failure` 参数决定是抛异常还是返回失败结构
   ```typescript
   // 前端可以这样调用，不用try-catch
   const result = await createPurchasePlan({ ..., return_structured_failure: true });
   if (result.success === false) {
       // 显示失败原因 result.message
       // 显示备注同步状态 result.purchase_remark_sync
   }
   ```

2. **前置依赖校验**：创建采购计划前先同步采购备注（业务约束）

3. **降级处理**：获取用户lingxingID失败不阻断主流程

**对比我们的系统**：
```java
// 我们当前直接抛异常，前端必须try-catch
public Map<String, Object> syncDaily(String startDate, String endDate, String developer) {
    if (startDate == null || endDate == null) {
        throw new IllegalArgumentException("日期参数不能为空");
    }
    // ...
}
```

**建议**：
- 加 `returnStructuredFailure` 布尔参数，允许前端选择是否需要结构化失败
- 关键业务约束（如日期必填）抛异常，次要约束（如可选字段）返回结构化失败

### 2. 调用领星API + 错误处理

```typescript
// 1. 调用领星API创建采购计划（使用原始响应避免error_details丢失）
let apiData: any;
try {
    const rawResponse = await this.lingxingUtils.httpPost(this.CREATE_PLAN_API, {
        data: [{
            sku: sku,
            quantity_plan: quantity_plan,
            ...(wid ? { wid } : {}),
            ...(cgUid ? { cg_uid: cgUid } : {}),
            ...(lingxingRemark ? { remark: lingxingRemark } : {})
        }]
    });
    
    // 解析领星响应
    apiData = rawResponse?.data?.data?.[0];
    
    if (!apiData || !apiData.plan_sn) {
        // 领星返回格式异常
        throw new Error('领星API返回格式异常: ' + JSON.stringify(rawResponse));
    }
} catch (error) {
    // API调用失败
    const message = `领星API调用失败: ${error.message}`;
    purchaseRemarkSync = this.buildPurchaseRemarkSyncRollback(
        '采购备注需要回滚：采购计划创建失败',
        purchase_remark_update,
        error
    );
    
    if (return_structured_failure) {
        return this.buildStructuredCreateFailure(message, purchaseRemarkSync);
    }
    throw new Error(message);
}
```

**借鉴价值**：

1. **原始响应保留**：`httpPost` 不自动解包，避免 `error_details` 被丢失
   ```typescript
   // 错误示例（error_details会在拆包时丢失）
   const data = await this.lingxingUtils.httpPost(url).then(r => r.data.data);
   
   // 正确写法
   const rawResponse = await this.lingxingUtils.httpPost(url);
   const data = rawResponse?.data?.data?.[0];
   ```

2. **错误上下文传递**：备注同步失败后，error对象携带 `purchaseRemarkSync` 状态
   ```typescript
   const error = new Error('备注同步失败');
   error.purchaseRemarkSync = { status: 'failed', message: '...' };
   throw error;
   ```

3. **错误后的补偿逻辑**：如果采购计划创建失败，需要回滚前面的备注同步
   ```typescript
   purchaseRemarkSync = this.buildPurchaseRemarkSyncRollback(
       '采购备注需要回滚：采购计划创建失败',
       purchase_remark_update,
       error
   );
   ```

**对比我们的系统**：
```java
// 我们当前简单的异常处理
try {
    JsonNode response = lingxingClient.post(url, body);
    return response;
} catch (Exception e) {
    log.error("领星API调用失败", e);
    throw new RuntimeException("领星API调用失败: " + e.getMessage());
}
```

**建议**：
- 封装 `LingxingApiException` 携带原始响应和错误详情
- 关键操作失败后加补偿逻辑（如回滚、清理中间状态）

### 3. 本地数据库回写 + 关联记录创建

```typescript
// 2. 回写本地数据库
const localRecord = {
    plan_sn: apiData.plan_sn,
    sku: apiData.sku || sku,
    product_id: apiData.product_id,
    product_name: apiData.product_name,
    pic_url: apiData.pic_url,
    quantity_plan: apiData.quantity_plan,
    status: apiData.status,
    status_text: apiData.status_text,
    wid: apiData.wid,
    warehouse_name: apiData.warehouse_name,
    supplier_id: apiData.supplier_id,
    supplier_name: apiData.supplier_name,
    cg_uid: apiData.cg_uid || cgUid,
    cg_opt_username: apiData.cg_opt_username,
    expect_arrive_time: apiData.expect_arrive_time,
    // 创建人信息
    creator_uid: currentUser?.userId,
    creator_real_name: currentUser?.name,
    // 关联ID
    analysis_record_id: savedAnalysisRecord?.id,
    // 领星状态
    is_deleted_remote: 0,
    // 原始JSON
    raw_response_json: apiData
};

const savedPlan = await this.purchasePlanEntity.save(localRecord);

// 3. 如果有分析数据，创建关联的分析记录
let savedAnalysisRecord = null;
if (analysis_data && savedPlan) {
    const analysisRecord = {
        ...analysis_data,
        plan_sn: savedPlan.plan_sn,
        plan_id: savedPlan.id,
        created_by_user_id: currentUser?.userId,
        created_by_username: currentUser?.name
    };
    savedAnalysisRecord = await this.analysisRecordEntity.save(analysisRecord);
    
    // 回写 analysis_record_id 到采购计划
    await this.purchasePlanEntity.update(
        { id: savedPlan.id },
        { analysis_record_id: savedAnalysisRecord.id }
    );
}
```

**借鉴价值**：

1. **立即回写**：API成功后立即落库（避免数据漂移，即领星有但本地没有）

2. **raw_response_json 字段**：保存领星原始响应，方便问题排查
   ```typescript
   // 查询时可以看到领星当时返回的完整数据
   SELECT raw_response_json FROM app_amz_bsr_purchase_plan_lingxing WHERE plan_sn = 'PP123';
   ```

3. **双向关联**：采购计划 ↔ 分析记录
   ```
   purchase_plan.analysis_record_id → analysis_record.id
   analysis_record.plan_id → purchase_plan.id
   ```

4. **创建人信息**：从上下文自动填充（不需要前端传）
   ```typescript
   creator_uid: currentUser?.userId,
   creator_real_name: currentUser?.name
   ```

**对比我们的系统**：
```java
// 我们当前只落库批次明细，没有保存原始JSON
LingxingInventoryBatchDetail detail = new LingxingInventoryBatchDetail();
detail.setBatchNo(item.path("batch_no").asText());
detail.setSku(item.path("sku").asText());
// ... 其他字段
batchMapper.upsert(detail);
```

**建议**：
- 加 `raw_json` 字段保存领星原始响应（LONGTEXT类型）
- 加 `creator_uid` / `creator_real_name` 字段（从Spring Security上下文获取）
- 如果有关联数据（如分析记录），一并创建并双向关联

## 二、智能分页查询（Smart Page）

### 1. 自动检测过期数据并同步

```typescript
/**
 * 智能分页查询 - 自动检测并同步过期数据
 */
async smartPage(param: any) {
    const { page = 1, size = 20, status, keyword } = param;
    
    // ① 先执行普通分页查询
    const result = await this.customPage(param);
    
    // ② 检测前N条数据是否需要刷新
    const needRefreshPlanSns = [];
    const now = new Date();
    const STALE_THRESHOLD = 5 * 60 * 1000;  // 5分钟阈值
    
    for (const plan of result.records.slice(0, 10)) {  // 只检查前10条
        const syncedAt = plan.synced_at ? new Date(plan.synced_at) : null;
        if (!syncedAt || (now.getTime() - syncedAt.getTime()) > STALE_THRESHOLD) {
            needRefreshPlanSns.push(plan.plan_sn);
        }
    }
    
    // ③ 如果有过期数据，后台触发同步（不阻塞返回）
    if (needRefreshPlanSns.length > 0) {
        // 异步刷新，不等待结果
        this.syncPlansFromLingxing(needRefreshPlanSns).catch(err => {
            console.error('后台同步采购计划失败:', err);
        });
        
        // 标记这些记录正在刷新
        result.records.forEach(record => {
            if (needRefreshPlanSns.includes(record.plan_sn)) {
                record._refreshing = true;
            }
        });
    }
    
    return result;
}
```

**借鉴价值**：

1. **被动同步变主动**：用户查看数据时自动检测是否过期
   - 传统方式：用户发现数据不对→点"同步"按钮→等待同步完成
   - 智能方式：系统自动检测过期→后台静默同步→下次刷新页面就是新数据

2. **只刷新可见数据**：`slice(0, 10)` 只检查前10条（用户能看到的）

3. **非阻塞刷新**：同步操作不等待，立即返回旧数据 + `_refreshing` 标记
   ```vue
   <el-tag v-if="row._refreshing" type="info">刷新中</el-tag>
   ```

4. **时间阈值可配置**：`STALE_THRESHOLD = 5 * 60 * 1000` 提取为配置项

**对比我们的系统**：
```java
// 我们当前手动触发同步（用户主动点按钮）
@PostMapping("/inventory-batch/sync")
public Result<Map<String, Object>> syncInventoryBatch(...) {
    // 用户等待同步完成（可能几分钟）
    Map<String, Object> result = inventoryBatchService.syncDaily(...);
    return Result.success(result);
}
```

**建议**：
- 加 `synced_at` 字段记录最后同步时间
- 查询接口检测 `NOW() - synced_at > 5分钟` 的记录，后台触发同步
- 前端显示"正在刷新"提示，5秒后自动重新查询

### 2. 悬浮详情的缓存策略

```typescript
/**
 * 悬浮查看计划明细（带缓存过期与降级机制）
 */
async getPlanDetailsForHover(planSns: string[]) {
    const cacheKey = `hover_details_${planSns.sort().join(',')}`;
    const CACHE_TTL = 60;  // 1分钟缓存
    
    // ① 先查缓存
    const cached = await this.cache.get(cacheKey);
    if (cached) {
        return { data: cached, from_cache: true };
    }
    
    // ② 缓存失效，查领星API（带超时）
    try {
        const apiData = await Promise.race([
            this.lingxingUtils.httpPost(this.GET_PLANS_API, { plan_sns: planSns }),
            this.timeout(3000, '领星API超时')
        ]);
        
        const plans = apiData?.data?.data?.plans || [];
        await this.cache.set(cacheKey, plans, CACHE_TTL);
        return { data: plans, from_api: true };
        
    } catch (apiError) {
        // ③ API失败，降级到本地数据库
        console.warn('领星API失败，降级到本地数据库:', apiError);
        const localPlans = await this.purchasePlanEntity.find({
            where: { plan_sn: In(planSns) }
        });
        
        // 标记数据来源
        return {
            data: localPlans.map(p => ({ ...p, _from_local: true })),
            from_local: true,
            degraded: true
        };
    }
}

private timeout(ms: number, message: string) {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new Error(message)), ms)
    );
}
```

**借鉴价值**：

1. **三级降级策略**：
   ```
   缓存（1分钟） → 领星API（3秒超时） → 本地数据库 → 空结果
   ```

2. **超时控制**：`Promise.race` + 自定义timeout，避免悬浮卡死

3. **数据来源标识**：`from_cache / from_api / from_local` 告诉前端数据新鲜度
   ```vue
   <el-tag v-if="detail._from_local" type="warning">本地缓存</el-tag>
   ```

4. **缓存键设计**：
   ```typescript
   const cacheKey = `hover_details_${planSns.sort().join(',')}`;
   // planSns排序避免 ['A','B'] 和 ['B','A'] 产生不同缓存键
   ```

**对比我们的系统**：
```java
// 我们当前没有缓存，每次都查数据库
public InventoryBatchDetail getDetail(Long id) {
    return batchMapper.selectById(id);
}
```

**建议**：
- 高频查询（如悬浮详情）加 Redis 缓存（TTL=1分钟）
- 如果有外部API调用，加超时控制 + 降级到本地数据库
- 返回数据加 `_from_cache` / `_from_db` 标识

## 三、批量操作的分组策略

### 1. 按规则自动分组

```typescript
/**
 * 构建请求分组：按运输方式+备注+仓库分组
 */
private buildRequestGroups(details: BatchShipDetailEntity[]): RequestGroup[] {
    const groupMap = new Map<string, RequestGroup>();
    
    for (const detail of details) {
        // 分组键：运输方式 + 备注 + 仓库
        const groupKey = [
            detail.shipping_method || 'unknown',
            detail.remark || '',
            detail.warehouse || ''
        ].join('||');
        
        if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, {
                key: groupKey,
                methodKey: detail.shipping_method,
                remark: detail.remark,
                detailIds: [],
                product_list: []
            });
        }
        
        const group = groupMap.get(groupKey);
        group.detailIds.push(detail.id);
        group.product_list.push({
            plan_sn: detail.purchase_plan_sn,
            order_sn: detail.purchase_order_sn,
            ship_qty: detail.ship_qty
        });
    }
    
    return Array.from(groupMap.values());
}
```

**借鉴价值**：

1. **业务规则分组**：领星API要求"同运输方式+同备注+同仓库"的才能一个批次提交

2. **分组键设计**：
   ```typescript
   const groupKey = [field1, field2, field3].join('||');
   // 优点：简单直观
   // 缺点：如果field包含'||'会冲突
   ```

3. **Map聚合模式**：
   ```typescript
   const map = new Map<string, Group>();
   for (const item of items) {
       const key = computeKey(item);
       if (!map.has(key)) {
           map.set(key, { key, items: [] });
       }
       map.get(key).items.push(item);
   }
   return Array.from(map.values());
   ```

**对比我们的系统**：
```java
// 我们当前没有批量操作，都是单条处理
for (JsonNode item : items) {
    LingxingInventoryBatchDetail detail = parseItem(item);
    batchMapper.upsert(detail);
}
```

**建议**：
- 如果未来有批量创建/批量导入，参考这个分组模式
- 分组键用 `JSON.stringify(sortedFields)` 更安全（避免分隔符冲突）

### 2. 分批提交 + 限流

```typescript
/**
 * 提交批量发货计划
 */
async submit(params: BatchShipSubmitParams) {
    // ... 前置校验 ...
    
    const requestGroups = this.buildRequestGroups(savedDetails);
    const submitResults = [];
    
    // 逐组提交，组间延迟
    for (let index = 0; index < requestGroups.length; index += 1) {
        await this.waitBeforeLingxingRequest(index);  // 限流
        
        const group = requestGroups[index];
        const result = await this.submitSingleGroup(group);
        submitResults.push(result);
    }
    
    return this.finishBatch(batch, submitResults);
}

private async waitBeforeLingxingRequest(index: number) {
    if (index === 0) return;  // 第一批立即执行
    
    const delay = 2000;  // 2秒间隔
    await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * 提交单个分组到领星
 */
private async submitSingleGroup(group: RequestGroup) {
    try {
        const resp = await this.lingxingUtils.httpPost(this.CREATE_SHIPMENT_API, {
            shipping_method: group.methodKey,
            remark: group.remark,
            product_list: group.product_list
        });
        
        // 更新明细状态为成功
        await this.detailRepo.update(
            { id: In(group.detailIds) },
            { status: 'success', lingxing_response: resp }
        );
        
        return { success: true, group_key: group.key, detail_count: group.detailIds.length };
        
    } catch (error) {
        // 更新明细状态为失败
        await this.detailRepo.update(
            { id: In(group.detailIds) },
            { status: 'failed', error_message: error.message }
        );
        
        return { success: false, group_key: group.key, error: error.message };
    }
}
```

**借鉴价值**：

1. **串行提交**：逐组提交而非并行（避免打爆API + 保证顺序）

2. **部分失败容忍**：某组失败不影响其他组，最后汇总结果
   ```typescript
   {
       batch_no: 'B001',
       total_groups: 5,
       success_groups: 3,
       failed_groups: 2,
       results: [
           { group: 1, success: true },
           { group: 2, success: false, error: '...' },
           // ...
       ]
   }
   ```

3. **状态实时更新**：每组提交后立即更新明细状态（前端可轮询查进度）

**对比我们的系统**：
```java
// 我们当前循环翻页时有sleep，但不是分组提交
for (int pg = 1; pg <= totalPages; pg++) {
    // ... 处理本页数据
    if (pg < totalPages) {
        Thread.sleep(1500);
    }
}
```

**建议**：
- 继续保持我们的间隔策略（已经合理）
- 如果未来有批量操作，参考这个分组+串行+部分失败容忍模式

## 四、总结：Service层关键模式

### 立即可借鉴

1. **结构化失败响应**：`return_structured_failure` 参数，前端无需try-catch
2. **raw_response_json 字段**：保存外部API原始响应，方便排查
3. **创建人信息自动填充**：从上下文获取，前端不用传
4. **synced_at 字段**：记录最后同步时间，支持智能刷新

### 中期优化

5. **智能分页查询**：自动检测过期数据，后台静默同步
6. **悬浮详情缓存**：1分钟缓存 + 3秒超时 + 降级到本地数据库
7. **批量操作分组**：按业务规则自动分组，减少API调用次数

### 长期参考

8. **补偿逻辑**：关键操作失败后回滚前置操作（事务一致性）
9. **部分失败容忍**：批量操作某项失败不影响其他项
10. **状态实时更新**：长时间操作分步更新进度，前端可轮询

---

**下一步**：分析前端组件的交互细节和状态管理。
