<template>
  <div class="inventory-arrival-dashboard">
    <el-card class="filter-card" shadow="never">
      <el-row :gutter="12">
        <el-col :span="4">
          <el-select v-model="queryParams.developer" placeholder="开发人" clearable @change="handleQuery">
            <el-option v-for="dev in developers" :key="dev" :label="dev" :value="dev" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="queryParams.operator" placeholder="运营" clearable @change="handleQuery">
            <el-option v-for="op in operators" :key="op" :label="op" :value="op" />
          </el-select>
        </el-col>
        <el-col :span="4">
          <el-select v-model="queryParams.dataDate" placeholder="数据日期" clearable @change="handleQuery">
            <el-option v-for="d in availableDates" :key="d" :label="d" :value="d" />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-input v-model="queryParams.sku" placeholder="SKU 搜索" clearable
                    @clear="handleQuery" @keyup.enter="handleQuery">
            <template #append>
              <el-button @click="handleQuery">搜索</el-button>
            </template>
          </el-input>
        </el-col>
        <el-col :span="6" style="text-align: right">
          <el-button type="primary" :loading="syncing" @click="handleSync">手动同步</el-button>
          <el-button @click="handleExport">导出Excel</el-button>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="table-card" shadow="never" v-loading="loading">
      <el-table :data="groupedData" row-key="rowKey" border
                :tree-props="{ children: 'batches', hasChildren: 'hasBatches' }"
                default-expand-all stripe>
        <el-table-column label="SKU / 品名" width="240" fixed>
          <template #default="{ row }">
            <span v-if="!row.isBatch" style="font-weight: 600">{{ row.sku }}</span>
          </template>
        </el-table-column>
        <el-table-column label="批次号" width="160">
          <template #default="{ row }">
            <span v-if="row.isBatch">{{ row.batchNo }}</span>
          </template>
        </el-table-column>
        <el-table-column label="运营" width="110">
          <template #default="{ row }">
            <span v-if="row.isBatch">{{ row.operator || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="入库时间" width="140">
          <template #default="{ row }">
            <span v-if="row.isBatch">{{ formatTime(row.purchaseInTime) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="可发货" width="100" align="right">
          <template #default="{ row }">
            <span v-if="row.isBatch">{{ row.goodNum }}</span>
          </template>
        </el-table-column>
        <el-table-column label="在途" width="100" align="right">
          <template #default="{ row }">
            <span v-if="row.isBatch">{{ row.goodTransitNum }}</span>
          </template>
        </el-table-column>
        <el-table-column label="仓库" width="140" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.isBatch">{{ row.whName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.isBatch" :type="getStatusType(row)">{{ getStatusText(row) }}</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination v-model:current-page="queryParams.current" v-model:page-size="queryParams.size"
                     :page-sizes="[20, 50, 100]" :total="total"
                     layout="total, sizes, prev, pager, next"
                     @size-change="handleQuery" @current-change="handleQuery"
                     style="margin-top: 16px; justify-content: flex-end" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import {
  listInventoryBatch,
  syncInventoryBatch,
  type InventoryBatchDetail,
} from "@/api/inventory-batch";

const loading = ref(false);
const syncing = ref(false);
const total = ref(0);
const groupedData = ref<any[]>([]);
const developers = ref<string[]>([]);
const operators = ref<string[]>([]);
const availableDates = ref<string[]>([]);

const queryParams = reactive({
  current: 1,
  size: 20,
  developer: "",
  operator: "",
  dataDate: "",
  sku: "",
});

const formatTime = (t: string) => (t ? t.substring(0, 16) : "-");

const getStatusText = (row: any) => {
  if (row.goodNum > 0) return "已到仓";
  if (row.goodTransitNum > 0) return "在途";
  return "-";
};
const getStatusType = (row: any) => {
  if (row.goodNum > 0) return "success";
  if (row.goodTransitNum > 0) return "warning";
  return "info";
};

// 按 SKU 分组，批次作为子行（最新入库在上）
const groupBySku = (list: InventoryBatchDetail[]) => {
  const map = new Map<string, any>();
  list.forEach((item) => {
    if (!map.has(item.sku)) {
      map.set(item.sku, {
        rowKey: `sku-${item.sku}`,
        sku: item.sku,
        isBatch: false,
        hasBatches: true,
        batches: [],
      });
    }
    map.get(item.sku).batches.push({
      ...item,
      rowKey: `batch-${item.id}`,
      isBatch: true,
    });
  });
  map.forEach((g) =>
    g.batches.sort((a: any, b: any) =>
      (b.purchaseInTime || "").localeCompare(a.purchaseInTime || ""),
    ),
  );
  return Array.from(map.values());
};

const handleQuery = async () => {
  loading.value = true;
  try {
    const data = await listInventoryBatch(queryParams);
    total.value = data.total || 0;
    availableDates.value = data.availableDates || [];
    let records = data.records || [];
    // 运营前端过滤（后端暂未支持 operator 参数）
    if (queryParams.operator) {
      records = records.filter((r) => r.operator === queryParams.operator);
    }
    groupedData.value = groupBySku(records);
    const devSet = new Set<string>();
    const opSet = new Set<string>();
    records.forEach((i) => {
      if (i.developer) devSet.add(i.developer);
      if (i.operator) opSet.add(i.operator);
    });
    developers.value = Array.from(devSet);
    operators.value = Array.from(opSet);
  } catch (e: any) {
    ElMessage.error(e?.message || "查询失败");
  } finally {
    loading.value = false;
  }
};

const handleSync = async () => {
  try {
    await ElMessageBox.confirm("确认手动同步？默认拉取昨天数据", "提示", {
      type: "warning",
    });
    syncing.value = true;
    const r = await syncInventoryBatch({});
    ElMessage.success(`同步完成：拉取 ${r.fetched} 行，写入 ${r.upserted} 行`);
    handleQuery();
  } catch (e: any) {
    if (e !== "cancel") ElMessage.error(e?.message || "同步失败");
  } finally {
    syncing.value = false;
  }
};

const handleExport = () => ElMessage.info("导出功能开发中");

onMounted(() => handleQuery());
</script>

<style scoped lang="scss">
.inventory-arrival-dashboard {
  padding: 16px;
  .filter-card {
    margin-bottom: 16px;
  }
  .table-card :deep(.el-table__row--level-0) {
    background-color: #f5f7fa;
    font-weight: 600;
  }
}
</style>


