<template>
  <div class="lingxing-baseline">
    <el-card shadow="never" class="filter-card">
      <div class="card-head">
        <div class="title-block">
          <span class="title">ASIN 基准表</span>
          <span class="hint">
            模型一/模型二 的起算主表。共 <strong>{{ total }}</strong> 个团队
            ASIN，由周同步自动维护
          </span>
        </div>
        <div class="head-actions">
          <el-button :icon="Refresh" :loading="loading" @click="fetchList"
            >刷新</el-button
          >
        </div>
      </div>

      <div class="filter-bar">
        <el-input
          v-model="filters.keyword"
          placeholder="ASIN / SKU / 标签 / 开发人"
          clearable
          style="width: 260px"
          :prefix-icon="Search"
          @change="onFilterChange"
        />
        <el-select
          v-model="filters.developer"
          placeholder="开发人"
          clearable
          filterable
          style="width: 130px"
          @change="onFilterChange"
        >
          <el-option
            v-for="d in developerOptions"
            :key="d"
            :label="d"
            :value="d"
          />
        </el-select>
        <el-select
          v-model="filters.currency"
          placeholder="币种"
          clearable
          style="width: 110px"
          @change="onFilterChange"
        >
          <el-option label="GBP (英国)" value="GBP" />
          <el-option label="EUR (欧洲)" value="EUR" />
        </el-select>
        <el-select
          v-model="filters.modelStartMonth"
          placeholder="起算月"
          clearable
          filterable
          style="width: 140px"
          @change="onFilterChange"
        >
          <el-option v-for="m in monthOptions" :key="m" :label="m" :value="m" />
        </el-select>
        <el-select
          v-model="filters.analysisStatus"
          placeholder="分析状态"
          clearable
          style="width: 180px"
          @change="onFilterChange"
        >
          <el-option
            v-for="s in statusOptions"
            :key="s"
            :label="s"
            :value="s"
          />
        </el-select>
        <el-button v-if="hasFilters" type="info" text @click="resetFilters">
          清空筛选
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table
        :data="rows"
        v-loading="loading"
        stripe
        border
        size="small"
        row-key="asin"
        highlight-current-row
        style="width: 100%"
      >
        <el-table-column label="ASIN" prop="asin" width="120" fixed>
          <template #default="{ row }">
            <span class="asin-cell" @click="openDetail(row)">{{
              row.asin
            }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="baseSku"
          label="基础 SKU"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column
          prop="baseStore"
          label="基础店铺"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column prop="developer" label="开发人" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.developer" size="small" effect="plain">{{
              row.developer
            }}</el-tag>
            <span v-else class="text-muted">未标注</span>
          </template>
        </el-table-column>
        <el-table-column label="币种" width="80">
          <template #default="{ row }">
            <el-tag :type="currencyTag(row.availableFirstCountry)" size="small">
              {{ currencyOf(row.availableFirstCountry) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="availableFirstCountry" label="国家" width="80" />
        <el-table-column
          prop="listingTags"
          label="领星标签"
          min-width="200"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <div class="tag-cell">
              <el-tag
                v-for="tag in splitTags(row.listingTags)"
                :key="tag"
                :type="tagVariant(tag)"
                size="small"
              >
                {{ tag }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="modelStartMonth"
          label="起算月"
          width="90"
          align="center"
        />
        <el-table-column
          prop="modelStartBasis"
          label="起算依据"
          width="180"
          show-overflow-tooltip
        />
        <el-table-column
          prop="fbaAvailableFirstMonthFinal"
          label="FBA 首月"
          width="90"
          align="center"
        />
        <el-table-column
          prop="analysisStatus"
          label="状态"
          width="140"
          show-overflow-tooltip
        >
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.analysisStatus)" size="small">
              {{ row.analysisStatus || "未标注" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              size="small"
              text
              type="primary"
              @click="openDetail(row)"
            >
              详情
            </el-button>
            <el-button size="small" text type="warning" @click="openEdit(row)">
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page.current"
        v-model:page-size="page.size"
        :total="total"
        :page-sizes="[20, 50, 100, 200]"
        layout="total, sizes, prev, pager, next, jumper"
        background
        class="pager"
        @size-change="fetchList"
        @current-change="fetchList"
      />
    </el-card>

    <!-- 详情抽屉 -->
    <el-drawer
      v-model="detailVisible"
      :title="detailRow ? `ASIN 详情 · ${detailRow.asin}` : '详情'"
      size="480px"
      direction="rtl"
    >
      <template v-if="detailRow">
        <div class="detail-block">
          <div class="detail-title">基础信息</div>
          <div class="detail-grid">
            <div class="detail-item">
              <label>ASIN</label><span>{{ detailRow.asin }}</span>
            </div>
            <div class="detail-item">
              <label>基础 SKU</label
              ><span>{{ detailRow.baseSku || "--" }}</span>
            </div>
            <div class="detail-item">
              <label>基础店铺</label
              ><span>{{ detailRow.baseStore || "--" }}</span>
            </div>
            <div class="detail-item">
              <label>开发人</label
              ><span>{{ detailRow.developer || "--" }}</span>
            </div>
            <div class="detail-item">
              <label>创建时间</label
              ><span>{{ detailRow.createTime || "--" }}</span>
            </div>
            <div class="detail-item full">
              <label>标签</label>
              <span class="tag-cell">
                <el-tag
                  v-for="tag in splitTags(detailRow.listingTags)"
                  :key="tag"
                  :type="tagVariant(tag)"
                  size="small"
                  >{{ tag }}</el-tag
                >
              </span>
            </div>
          </div>
        </div>

        <div class="detail-block">
          <div class="detail-title">起算判定</div>
          <div class="detail-grid">
            <div class="detail-item">
              <label>起算月</label
              ><span>{{ detailRow.modelStartMonth || "--" }}</span>
            </div>
            <div class="detail-item full">
              <label>起算依据</label
              ><span>{{ detailRow.modelStartBasis || "--" }}</span>
            </div>
            <div class="detail-item">
              <label>FBA 首月</label
              ><span>{{ detailRow.fbaAvailableFirstMonthFinal || "--" }}</span>
            </div>
            <div class="detail-item full">
              <label>FBA 判定</label
              ><span>{{ detailRow.fbaAvailableFirstBasis || "--" }}</span>
            </div>
          </div>
        </div>

        <div class="detail-block">
          <div class="detail-title">首次库存 / 首次可售</div>
          <div class="detail-grid">
            <div class="detail-item">
              <label>库存首现月</label
              ><span>{{ detailRow.fbaInventoryFirstMonth || "--" }}</span>
            </div>
            <div class="detail-item">
              <label>库存首现国家</label
              ><span>{{ detailRow.inventoryFirstCountry || "--" }}</span>
            </div>
            <div class="detail-item">
              <label>库存首现店铺</label
              ><span>{{ detailRow.inventoryFirstStore || "--" }}</span>
            </div>
            <div class="detail-item">
              <label>库存首现数量</label
              ><span>{{ detailRow.inventoryFirstQty ?? "--" }}</span>
            </div>
            <div class="detail-item">
              <label>可售首现月</label
              ><span>{{ detailRow.fbaAvailableFirstMonth || "--" }}</span>
            </div>
            <div class="detail-item">
              <label>可售首现国家</label
              ><span>{{ detailRow.availableFirstCountry || "--" }}</span>
            </div>
            <div class="detail-item">
              <label>可售首现店铺</label
              ><span>{{ detailRow.availableFirstStore || "--" }}</span>
            </div>
            <div class="detail-item">
              <label>可售首现数量</label
              ><span>{{ detailRow.availableFirstQty ?? "--" }}</span>
            </div>
          </div>
        </div>

        <div class="detail-block">
          <div class="detail-title">版本与状态</div>
          <div class="detail-grid">
            <div class="detail-item">
              <label>分析状态</label>
              <el-tag
                :type="statusTagType(detailRow.analysisStatus)"
                size="small"
              >
                {{ detailRow.analysisStatus || "未标注" }}
              </el-tag>
            </div>
            <div class="detail-item">
              <label>数据截止</label
              ><span>{{ detailRow.dataCutoffMonth || "--" }}</span>
            </div>
            <div class="detail-item full">
              <label>版本号</label
              ><span>{{ detailRow.baselineVersion || "--" }}</span>
            </div>
          </div>
        </div>
      </template>
    </el-drawer>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="editVisible"
      :title="editRow ? `编辑 · ${editRow.asin}` : '编辑'"
      width="480px"
    >
      <el-form v-if="editForm" label-position="top" :model="editForm">
        <el-form-item label="开发人">
          <el-select
            v-model="editForm.developer"
            placeholder="选择团队成员"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="developer in BASELINE_DEVELOPERS"
              :key="developer"
              :label="developer"
              :value="developer"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="领星标签（逗号分隔）">
          <el-input
            v-model="editForm.listingTags"
            type="textarea"
            :rows="2"
            maxlength="1000"
            show-word-limit
            placeholder="如：欧洲精铺2025,绿标"
          />
        </el-form-item>
        <el-form-item label="起算月 (YYYY-MM)">
          <el-select
            v-model="editForm.modelStartMonth"
            placeholder="选择起算月"
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="month in monthOptions"
              :key="month"
              :label="month"
              :value="month"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="起算依据">
          <el-input
            v-model="editForm.modelStartBasis"
            maxlength="255"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="分析状态">
          <el-select
            v-model="editForm.analysisStatus"
            placeholder="选择分析状态"
            style="width: 100%"
          >
            <el-option
              v-for="status in BASELINE_STATUSES"
              :key="status"
              :label="status"
              :value="status"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitEdit"
          >保存</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { Refresh, Search } from "@element-plus/icons-vue";
import {
  lingxingProductApi,
  type LingxingAsinBaseline,
  type BaselineListParams,
} from "@/api/lingxingProduct";
import {
  BASELINE_DEVELOPERS,
  BASELINE_STATUSES,
  buildMonthOptions,
  createLatestRequestGuard,
  normalizeBaselinePatch,
  statusTagType,
  tagVariant,
  validateBaselinePatch,
} from "./logic";

const rows = ref<LingxingAsinBaseline[]>([]);
const total = ref(0);
const loading = ref(false);

const page = reactive({ current: 1, size: 20 });
const filters = reactive<BaselineListParams>({
  keyword: "",
  developer: "",
  currency: "",
  modelStartMonth: "",
  analysisStatus: "",
});

const detailVisible = ref(false);
const detailRow = ref<LingxingAsinBaseline | null>(null);

const editVisible = ref(false);
const editRow = ref<LingxingAsinBaseline | null>(null);
const editForm = ref<LingxingAsinBaseline | null>(null);
const saving = ref(false);
const listRequestGuard = createLatestRequestGuard();

const developerOptions = BASELINE_DEVELOPERS;
const monthOptions = buildMonthOptions(new Date(), 24);
const statusOptions = BASELINE_STATUSES;

const hasFilters = computed(
  () =>
    !!(
      filters.keyword ||
      filters.developer ||
      filters.currency ||
      filters.modelStartMonth ||
      filters.analysisStatus
    ),
);

async function fetchList() {
  const requestId = listRequestGuard.begin();
  loading.value = true;
  try {
    const params: BaselineListParams = {
      current: page.current,
      size: page.size,
      ...filters,
    };
    const res = await lingxingProductApi.listBaseline(params);
    if (!listRequestGuard.isLatest(requestId)) return;
    rows.value = res.records;
    total.value = res.total;
  } catch (e: unknown) {
    if (listRequestGuard.isLatest(requestId)) {
      ElMessage.error(
        "加载失败：" + (e instanceof Error ? e.message : String(e)),
      );
    }
  } finally {
    if (listRequestGuard.finish(requestId)) loading.value = false;
  }
}

function onFilterChange() {
  page.current = 1;
  fetchList();
}

function resetFilters() {
  filters.keyword = "";
  filters.developer = "";
  filters.currency = "";
  filters.modelStartMonth = "";
  filters.analysisStatus = "";
  page.current = 1;
  fetchList();
}

// el-table slot 的 row 是 DefaultRow 死类型，这里用 any 接收再断言，
// 比逐处 as 干净。
function openDetail(row: any) {
  detailRow.value = row as LingxingAsinBaseline;
  detailVisible.value = true;
}

function openEdit(row: any) {
  const r = row as LingxingAsinBaseline;
  editRow.value = r;
  editForm.value = { ...r };
  editVisible.value = true;
}

async function submitEdit() {
  if (!editForm.value || !editRow.value) return;
  const errors = validateBaselinePatch(editForm.value);
  if (errors.length > 0) {
    ElMessage.warning(errors.join("；"));
    return;
  }

  saving.value = true;
  try {
    const patch = normalizeBaselinePatch({
      developer: editForm.value.developer,
      listingTags: editForm.value.listingTags,
      modelStartMonth: editForm.value.modelStartMonth,
      modelStartBasis: editForm.value.modelStartBasis,
      analysisStatus: editForm.value.analysisStatus,
    });
    await lingxingProductApi.updateBaseline(editRow.value.asin, patch);
    ElMessage.success("已保存");
    editVisible.value = false;
    await fetchList();
  } catch (e: unknown) {
    ElMessage.error(
      "保存失败：" + (e instanceof Error ? e.message : String(e)),
    );
  } finally {
    saving.value = false;
  }
}

/* ─── 展示辅助 ─── */

function splitTags(s: string | null): string[] {
  if (!s) return [];
  return s
    .split(/[,，、]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

const GBP_COUNTRIES = ["英国", "UK"];
const EUR_COUNTRIES = [
  "德国",
  "法国",
  "意大利",
  "西班牙",
  "荷兰",
  "DE",
  "FR",
  "IT",
  "ES",
  "NL",
];

function currencyOf(country: string | null): string {
  if (!country) return "--";
  if (GBP_COUNTRIES.includes(country)) return "GBP";
  if (EUR_COUNTRIES.includes(country)) return "EUR";
  return country;
}

function currencyTag(
  country: string | null,
): "primary" | "success" | "warning" | "info" | "danger" {
  const c = currencyOf(country);
  if (c === "GBP") return "primary";
  if (c === "EUR") return "success";
  return "info";
}

onMounted(fetchList);
</script>

<style scoped lang="scss">
.lingxing-baseline {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-card,
.table-card {
  border-radius: 8px;
}

.card-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.title-block {
  display: flex;
  align-items: baseline;
  gap: 12px;

  .title {
    font-size: 18px;
    font-weight: 600;
    color: #1f2937;
  }
  .hint {
    font-size: 12px;
    color: #6b7280;

    strong {
      color: #3b82f6;
      font-weight: 600;
    }
  }
}

.filter-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.asin-cell {
  cursor: pointer;
  color: #3b82f6;
  font-family: "Fira Code", monospace;
  font-size: 12.5px;

  &:hover {
    text-decoration: underline;
  }
}

.tag-cell {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.pager {
  margin-top: 12px;
  justify-content: flex-end;
  display: flex;
}

.text-muted {
  color: #9ca3af;
}

.detail-block {
  margin-bottom: 20px;
}

.detail-title {
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f3f4f6;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;

  label {
    font-size: 11px;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  span {
    color: #1f2937;
    word-break: break-all;
  }

  &.full {
    grid-column: 1 / -1;
  }
}
</style>
