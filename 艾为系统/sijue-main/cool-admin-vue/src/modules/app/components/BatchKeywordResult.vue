<template>
  <el-dialog
    v-model="dialogVisible"
    title="关键词查询结果"
    width="1200px"
    :close-on-click-modal="false"
    :before-close="handleClose"
    top="5vh"
    class="batch-keyword-dialog"
  >
    <!-- 来源信息 (现代化轻量视觉) -->
    <div class="source-info-modern">
      <div class="info-group">
        <span class="info-label">国家</span>
        <span class="info-value">{{ marketplaces }}</span>
      </div>
      <el-divider direction="vertical" class="info-divider" />
      <div class="info-group">
        <span class="info-label">源ASIN</span>
        <span class="info-value text-mono">{{ asin }}</span>
      </div>
      <el-divider direction="vertical" class="info-divider" />
      <div class="info-group">
        <span class="info-label">产品编码</span>
        <el-tag size="small" type="warning" effect="light" round class="code-tag">{{ productCode }}</el-tag>
      </div>
    </div>

    <!-- Loading 状态 -->
    <div v-if="loading" class="center-block">
      <el-icon class="is-loading" :size="32" color="#409EFF"><Loading /></el-icon>
      <div class="center-text muted">
        正在获取关键词，共 {{ competitorAsins.length }} 个竞品ASIN，请稍候...
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="errorMsg" class="center-block">
      <el-icon :size="32" color="#F56C6C"><Warning /></el-icon>
      <div class="center-text" style="color:#F56C6C;">{{ errorMsg }}</div>
      <el-button style="margin-top: 16px;" @click="fetchKeywords">重试</el-button>
    </div>

    <!-- 结果面板 -->
    <div v-else-if="keywordList.length > 0">
      <!-- 现代化数据控制面板 -->
      <div class="data-dashboard">
        <!-- 上层：核心操作区 (搜索 + 过滤) -->
        <div class="dashboard-primary">
          <!-- 搜索框：置左作为主导视觉 -->
          <el-input
            v-model="searchText"
            placeholder="按关键词搜索..."
            clearable
            class="search-bar"
            :prefix-icon="Search"
          />

          <!-- 右侧：筛选区域 -->
          <div class="filter-actions">
            <div class="filter-item">
              <span class="filter-label">数据范围</span>
              <el-select v-model="activeTab" class="pro-select" placeholder="选择范围">
                <el-option label="全部关键词" value="all">
                  <span class="opt-left">全部关键词</span>
                  <span class="opt-right">{{ keywordList.length }}</span>
                </el-option>
                <el-option v-for="ca in competitorAsins" :key="ca" :label="ca" :value="ca">
                  <span class="opt-left">{{ ca }}</span>
                  <span class="opt-right">{{ getCountBySource(ca) }}</span>
                </el-option>
              </el-select>
            </div>

            <div class="filter-item">
              <span class="filter-label">入库状态</span>
              <el-select v-model="statusFilter" class="pro-select" placeholder="选择状态">
                <el-option label="全部状态" value="all" />
                <el-option label="新词 (未入库)" value="new" />
                <el-option label="已有 (我入库)" value="my" />
                <el-option label="已有 (他人入库)" value="other" />
              </el-select>
            </div>
          </div>
        </div>

        <!-- 下层：数据洞察与选中状态 -->
        <div class="dashboard-secondary">
          <div class="insight-stats">
            <span class="stat-pill normal">
              <span class="label">检索总计</span>
              <span class="val">{{ summary.total }}</span>
            </span>
            <span class="stat-pill success">
              <span class="label">新词</span>
              <span class="val">{{ summary.new_count }}</span>
            </span>
            <span class="stat-pill warning">
              <span class="label">已有记录</span>
              <span class="val">{{ summary.existing_count }}</span>
            </span>
          </div>

          <div class="selection-status" v-if="isAllTab">
            当前已勾选 <span class="highlight-num">{{ selectedRows.length }}</span> 项
          </div>
        </div>
      </div>

      <!-- 表格 -->
      <el-table
        ref="tableRef"
        :data="paginatedList"
        max-height="450"
        border
        stripe
        row-key="keyword"
        :default-sort="{ prop: 'displayScore', order: 'descending' }"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column v-if="isAllTab" type="selection" width="42" align="center" :reserve-selection="true" />
        <el-table-column type="index" label="#" width="70" align="center" :index="indexMethod" />
        <el-table-column prop="keyword" label="关键词" min-width="250" show-overflow-tooltip sortable="custom" />
        <el-table-column label="翻译" min-width="310" show-overflow-tooltip>
          <template #header>
            <div class="translation-header" @click.stop>
              <span>翻译</span>
              <el-tag size="small" type="info" effect="plain">{{ currentTranslateLanguageLabel }}</el-tag>
              <el-select
                v-model="translateLanguage"
                size="small"
                class="translate-lang-select"
                @change="handleTranslateLanguageChange"
              >
                <el-option
                  v-for="item in translateLanguageOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-button
                text
                size="small"
                :icon="Refresh"
                :loading="translating"
                :disabled="paginatedList.length === 0"
                @click="retranslateCurrentPage"
              >
                重译
              </el-button>
              <el-icon v-if="translating" class="is-loading" :size="14"><Loading /></el-icon>
            </div>
          </template>
          <template #default="{ row }">
            <el-tooltip
              v-if="translationMap[row.keyword]"
              :content="`当前翻译源语言：${currentTranslateLanguageLabel}`"
              placement="top"
            >
              <span style="color:#606266;">{{ translationMap[row.keyword] }}</span>
            </el-tooltip>
            <span v-else style="color:#C0C4CC;font-size:12px">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="displayScore" label="流量得分" width="140" align="center" sortable="custom">
          <template #default="{ row }">
            <span style="font-weight:600; color:#E6A23C;">{{ formatScore(getDisplayScore(row)) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="historyScore" label="历史得分" width="140" align="center" sortable="custom">
          <template #header>
            <el-tooltip content="数据库中上次入库时的流量得分（仅供参考，计算基数可能不同）" placement="top">
              <span style="cursor:help; border-bottom:1px dashed #909399;">历史得分</span>
            </el-tooltip>
          </template>
          <template #default="{ row }">
            <el-tooltip v-if="row.exists_in_db && row.history_score != null" placement="top" :show-after="300">
              <template #content>
                <div style="line-height:1.8">
                  <div>入库时间: {{ formatDateTime(row.history_update_time || row.history_create_time) }}</div>
                  <div>入库人: {{ (row.history_bound_users || []).join('、') || '未知' }}</div>
                  <div>来源ASIN: {{ row.history_source_count ?? '—' }}个</div>
                  <div v-if="row.history_total_competitor_count">当时总ASIN: {{ row.history_total_competitor_count }}个</div>
                </div>
              </template>
              <span style="font-weight:600; color:#909399; cursor:help;">{{ formatScore(row.history_score) }}</span>
            </el-tooltip>
            <span v-else style="color:#C0C4CC;font-size:12px">—</span>
          </template>
        </el-table-column>
        <el-table-column prop="displaySearchVolume" label="搜索量" width="120" align="center" sortable="custom">
          <template #default="{ row }">
            <span style="font-weight:600; color:#E6A23C;">{{ formatSearchVolume(getDisplaySearchVolume(row)) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="130" align="center">
          <template #default="{ row }">
            <el-tooltip v-if="!row.exists_in_db" content="数据库中未记录，可入库" placement="top">
              <el-tag type="success">新</el-tag>
            </el-tooltip>
            <el-tooltip v-else-if="row.bound_by_me" content="您已入库过该词" placement="top">
              <el-tag type="warning">已有 (我)</el-tag>
            </el-tooltip>
            <el-tooltip v-else content="其他同事已入库过该词" placement="top">
              <el-tag type="info">已有 (他人)</el-tag>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-row">
        <div class="status-hint">
          <el-tag size="small" type="success">新</el-tag> 数据库中不存在 &nbsp;
          <el-tag size="small" type="warning">已有 (我)</el-tag> 我入库的 &nbsp;
          <el-tag size="small" type="info">已有 (他人)</el-tag> 其他人入库的
        </div>
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="filteredAndSearchedList.length"
          layout="total, prev, pager, next"
          small
          background
        />
      </div>
    </div>

    <!-- 空结果 -->
    <div v-else-if="!loading" class="center-block">
      <div class="center-text muted">未查询到关键词数据</div>
    </div>

    <!-- Footer -->
    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
      <el-button
        v-if="keywordList.length > 0 && isAllTab"
        type="primary"
        :loading="saving"
        :disabled="selectedRows.length === 0"
        @click="handleSave"
      >
        入库选中关键词 ({{ selectedRows.length }}个)
      </el-button>
      <el-tooltip v-if="keywordList.length > 0 && !isAllTab" content="请切换到「全部」Tab 才能入库" placement="top">
        <el-button type="info" disabled>
          入库选中关键词（请切到全部Tab）
        </el-button>
      </el-tooltip>
    </template>
  </el-dialog>
</template>

<script lang="ts" setup>
import { ref, computed, watch, nextTick } from "vue";
import { useCool } from "/@/cool";
import { ElMessage, ElMessageBox } from "element-plus";
import { Loading, Warning, Search, Refresh } from "@element-plus/icons-vue";

const props = defineProps<{
  visible: boolean;
  asin: string;
  productCode: string;
  marketplaces: string;
  competitorAsins: string[];
}>();

const emit = defineEmits<{
  (e: "update:visible", val: boolean): void;
  (e: "saved"): void;
}>();

const { service } = useCool();

// ========== 状态 ==========
const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

const loading = ref(false);
const saving = ref(false);
const errorMsg = ref("");
const keywordList = ref<any[]>([]);
const selectedRows = ref<any[]>([]);
const activeTab = ref("all");
const searchText = ref("");
const statusFilter = ref("all");
const currentPage = ref(1);
const pageSize = 50;
const tableRef = ref<any>(null);
const currentSort = ref<{ prop: string; order: string }>({ prop: "displayScore", order: "descending" });

const summary = ref({ total: 0, new_count: 0, existing_count: 0 });
const totalCompetitorCount = ref(0);

// ========== 翻译状态 ==========
const translationMap = ref<Record<string, string>>({});
const translating = ref(false);
const translateRequestVersion = ref(0);
const AUTO_TRANSLATE_LANGUAGE = "auto";
const translateLanguage = ref(AUTO_TRANSLATE_LANGUAGE);

const translateLanguageOptions = [
  { label: "自动", value: AUTO_TRANSLATE_LANGUAGE },
  { label: "英语", value: "en" },
  { label: "德语", value: "de" },
  { label: "法语", value: "fra" },
  { label: "西班牙语", value: "spa" },
  { label: "意大利语", value: "it" },
  { label: "日语", value: "jp" },
];

const translateLanguageLabelMap: Record<string, string> = {
  en: "英语",
  de: "德语",
  fra: "法语",
  spa: "西班牙语",
  it: "意大利语",
  jp: "日语",
};

const marketplaceLanguageMap: Record<string, string> = {
  "美国": "en",
  US: "en",
  "英国": "en",
  UK: "en",
  GB: "en",
  "加拿大": "en",
  CA: "en",
  "澳大利亚": "en",
  AU: "en",
  "德国": "de",
  DE: "de",
  "法国": "fra",
  FR: "fra",
  "西班牙": "spa",
  ES: "spa",
  "意大利": "it",
  IT: "it",
  "日本": "jp",
  JP: "jp",
};

// ========== 计算属性 ==========

const isAllTab = computed(() => activeTab.value === "all");

const marketplaceTranslateLanguage = computed(() => {
  const marketplace = (props.marketplaces || "").trim();
  if (!marketplace) return "en";
  return marketplaceLanguageMap[marketplace] || marketplaceLanguageMap[marketplace.toUpperCase()] || "en";
});

const activeTranslateLanguage = computed(() => {
  return translateLanguage.value === AUTO_TRANSLATE_LANGUAGE
    ? marketplaceTranslateLanguage.value
    : translateLanguage.value;
});

const currentTranslateLanguageLabel = computed(() => {
  const label = translateLanguageLabelMap[activeTranslateLanguage.value] || activeTranslateLanguage.value;
  if (translateLanguage.value === AUTO_TRANSLATE_LANGUAGE) {
    return props.marketplaces ? `${label}（按${props.marketplaces}）` : `${label}（默认）`;
  }
  return `${label}（手动）`;
});

// 根据 数据源 (Tab/Select) 过滤
const filteredBySource = computed(() => {
  if (isAllTab.value) return keywordList.value;
  return keywordList.value.filter((item) =>
    item.source_asins.includes(activeTab.value)
  );
});

// 根据 状态下拉 过滤
const filteredByStatus = computed(() => {
  let list = filteredBySource.value;
  if (statusFilter.value === "new") {
    list = list.filter((item) => !item.exists_in_db);
  } else if (statusFilter.value === "my") {
    list = list.filter((item) => item.exists_in_db && item.bound_by_me);
  } else if (statusFilter.value === "other") {
    list = list.filter((item) => item.exists_in_db && !item.bound_by_me);
  }
  return list;
});

// 根据 搜索框 过滤
const filteredAndSearchedList = computed(() => {
  const list = filteredByStatus.value;
  if (!searchText.value.trim()) return sortList(list);
  const q = searchText.value.trim().toLowerCase();
  return sortList(list.filter((item) => item.keyword.toLowerCase().includes(q)));
});

// 排序
const sortList = (list: any[]) => {
  const { prop, order } = currentSort.value;
  if (!prop || !order) return list;

  const sorted = [...list];
  const dir = order === "ascending" ? 1 : -1;

  sorted.sort((a, b) => {
    let va: any, vb: any;
    if (prop === "displayScore") {
      va = getDisplayScore(a);
      vb = getDisplayScore(b);
    } else if (prop === "historyScore") {
      va = a.history_score ?? -1;
      vb = b.history_score ?? -1;
    } else if (prop === "displaySearchVolume") {
      va = getDisplaySearchVolume(a) ?? -1;
      vb = getDisplaySearchVolume(b) ?? -1;
    } else if (prop === "keyword") {
      va = a.keyword || "";
      vb = b.keyword || "";
      return dir * va.localeCompare(vb);
    } else {
      va = a[prop];
      vb = b[prop];
    }
    va = va ?? -1;
    vb = vb ?? -1;
    return dir * (va - vb);
  });
  return sorted;
};

// 分页
const paginatedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredAndSearchedList.value.slice(start, start + pageSize);
});

// 获取某竞品查出的关键词数量
const getCountBySource = (asin: string) => {
  return keywordList.value.filter((item) =>
    item.source_asins.includes(asin)
  ).length;
};

// 获取当前 Tab 下显示的 score（使用加权得分）
const getDisplayScore = (row: any) => {
  if (isAllTab.value) {
    return row.weighted_score ?? 0;
  }
  // 单ASIN Tab：直接显示该ASIN的原始SIF得分，不做加权惩罚
  return row.score_by_source?.[activeTab.value] ?? 0;
};

// 格式化日期时间
const formatDateTime = (val: any) => {
  if (!val) return '未知';
  try {
    const d = new Date(val);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch {
    return '未知';
  }
};

// 获取当前 Tab 下显示的搜索量
const getDisplaySearchVolume = (row: any) => {
  if (isAllTab.value) {
    return row.sif_search_volume ?? null;
  }
  return row.search_volume_by_source?.[activeTab.value] ?? null;
};

// 格式化 score
const formatScore = (val: any) => {
  if (val === 0 || val == null || val === '') return "-";
  const num = Number(val);
  if (isNaN(num)) return "-";
  return num % 1 === 0 ? num.toString() : num.toFixed(2);
};

// 格式化搜索量
const formatSearchVolume = (val: number | null) => {
  if (val == null || val === 0) return "-";
  return val.toLocaleString();
};

// 序号方法
const indexMethod = (index: number) => {
  return (currentPage.value - 1) * pageSize + index + 1;
};

// ========== 获取关键词 ==========
const fetchKeywords = async () => {
  loading.value = true;
  errorMsg.value = "";
  keywordList.value = [];
  selectedRows.value = [];
  activeTab.value = "all";
  statusFilter.value = "all";
  searchText.value = "";
  currentPage.value = 1;

  try {
    const res = await (service.app as any).sifKeyword.fetchByCompetitorAsins({
      asin: props.asin,
      product_code: props.productCode,
      marketplaces: props.marketplaces,
      competitor_asins: props.competitorAsins,
    });

    keywordList.value = res.keywords || [];
    summary.value = res.summary || { total: 0, new_count: 0, existing_count: 0 };
    totalCompetitorCount.value = res.total_competitor_count || 0;

    // 默认勾选所有新词
    await nextTick();
    if (tableRef.value) {
      keywordList.value.forEach((row) => {
        if (!row.exists_in_db) {
          tableRef.value.toggleRowSelection(row, true);
        }
      });
    }
  } catch (err: any) {
    errorMsg.value = err?.message || "获取关键词失败";
    console.error("获取关键词失败:", err);
  } finally {
    loading.value = false;
    // 数据加载完成后自动翻译第一页
    if (keywordList.value.length > 0) {
      translateCurrentPage();
    }
  }
};

// ========== 入库 ==========
const handleSave = async () => {
  if (selectedRows.value.length === 0) {
    ElMessage.warning("请先勾选要入库的关键词");
    return;
  }

  try {
    await ElMessageBox.confirm(
      `确认将 ${selectedRows.value.length} 个关键词入库？`,
      "确认入库",
      { type: "info" }
    );
  } catch {
    return;
  }

  saving.value = true;
  try {
    const keywordsToSave = selectedRows.value.map(row => ({
      ...row,
      value_cn: translationMap.value[row.keyword] || undefined,
    }));

    const res = await (service.app as any).sifKeyword.batchSaveKeywordsOnly({
      asin: props.asin,
      product_code: props.productCode,
      marketplaces: props.marketplaces,
      total_competitor_count: totalCompetitorCount.value,
      keywords: keywordsToSave,
    });

    ElMessage.success(`入库成功：新增 ${res.inserted} 个，更新 ${res.updated} 个`);
    emit("saved");
    handleClose();
  } catch (err: any) {
    ElMessage.error(err?.message || "入库失败");
    console.error("入库失败:", err);
  } finally {
    saving.value = false;
  }
};

// ========== 事件 ==========
const handleSelectionChange = (rows: any[]) => {
  selectedRows.value = rows;
};

const handleSortChange = ({ prop, order }: any) => {
  currentSort.value = { prop: prop || "displayScore", order: order || "descending" };
};

const handleClose = () => {
  emit("update:visible", false);
};

// 选择数据源时重置分页
watch(activeTab, () => {
  currentPage.value = 1;
});

// 选择状态时重置分页
watch(statusFilter, () => {
  currentPage.value = 1;
});

// 搜索时重置分页
watch(searchText, () => {
  currentPage.value = 1;
});

// visible 变为 true 时自动获取数据
watch(
  () => props.visible,
  (val) => {
    if (val && props.competitorAsins.length > 0) {
      translationMap.value = {}; // 重置翻译缓存
      translateLanguage.value = AUTO_TRANSLATE_LANGUAGE;
      fetchKeywords();
    }
  }
);

// ========== 自动翻译 ==========

/**
 * 翻译当前页未翻译的关键词
 */
const buildTranslateRequest = (keywords: string[]) => {
  if (translateLanguage.value === AUTO_TRANSLATE_LANGUAGE) {
    return {
      keywords,
      marketplaces: props.marketplaces,
      to: "zh",
    };
  }
  return {
    keywords,
    from: translateLanguage.value,
    to: "zh",
  };
};

const translateCurrentPage = async (options: { force?: boolean } = {}) => {
  const currentRows = paginatedList.value;
  if (!currentRows || currentRows.length === 0) return;

  // 过滤出当前页还没翻译的关键词
  const untranslated = currentRows
    .map((row) => row.keyword)
    .filter((kw) => kw && (options.force || !translationMap.value[kw]));

  if (untranslated.length === 0) return;

  const requestVersion = ++translateRequestVersion.value;
  translating.value = true;
  try {
    const res = await (service.app as any).sifKeyword.translateKeywords(buildTranslateRequest(untranslated));

    // 合并结果到 translationMap
    if (res && typeof res === 'object' && requestVersion === translateRequestVersion.value) {
      translationMap.value = { ...translationMap.value, ...res };
    }
  } catch (err: any) {
    if (requestVersion !== translateRequestVersion.value) return;
    console.error('翻译关键词失败:', err);
    const msg = err?.message || String(err);
    if (msg.includes('recharge') || msg.includes('54004') || msg.includes('欠费')) {
      ElMessage.error('百度翻译余额不足，请充值后重试');
    } else {
      ElMessage.warning('翻译失败: ' + msg);
    }
  } finally {
    if (requestVersion === translateRequestVersion.value) {
      translating.value = false;
    }
  }
};

const retranslateCurrentPage = () => {
  translateCurrentPage({ force: true });
};

const handleTranslateLanguageChange = () => {
  translationMap.value = {};
  if (paginatedList.value.length > 0 && !loading.value) {
    translateCurrentPage({ force: true });
  }
};

// 监听分页/筛选/排序变化，自动翻译新一页
watch(
  [currentPage, activeTab, statusFilter, searchText, currentSort],
  () => {
    if (paginatedList.value.length > 0 && !loading.value) {
      translateCurrentPage();
    }
  },
  { flush: 'post' }
);
</script>

<style scoped>
/* 来源信息：现代化极简风格 */
.source-info-modern {
  display: flex;
  align-items: center;
  background: var(--el-fill-color-light);
  padding: 12px 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}
.info-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.info-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}
.text-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.info-divider {
  margin: 0 24px;
  border-color: var(--el-border-color);
}
.code-tag {
  font-weight: 600;
}

/* ============== 现代化数据控制面板 ============== */
.data-dashboard {
  background: white;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  margin-bottom: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
}

/* 上层：操作区 */
.dashboard-primary {
  display: flex;
  justify-content: flex-start;
  gap: 40px;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--el-border-color-extra-light);
  background: var(--el-fill-color-extra-light);
  border-radius: 8px 8px 0 0;
}

.search-bar {
  width: 400px;
}
.search-bar :deep(.el-input__wrapper) {
  border-radius: 6px;
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  background-color: white;
}
.search-bar :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.filter-actions {
  display: flex;
  gap: 28px;
}
.filter-item {
  display: flex;
  align-items: center;
  gap: 12px;
}
.filter-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}
.pro-select {
  width: 200px;
}
.opt-left {
  float: left;
}
.opt-right {
  float: right;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

/* 下层：数据洞察 */
.dashboard-secondary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background-color: white;
  border-radius: 0 0 8px 8px;
}

.insight-stats {
  display: flex;
  gap: 16px;
}

/* 标签胶囊设计 (Stripe / Vercel 风格) */
.stat-pill {
  display: inline-flex;
  align-items: center;
  font-size: 13px;
  border-radius: 4px;
  border: 1px solid;
}
.stat-pill .label {
  padding: 3px 10px;
  border-right: 1px solid;
  font-weight: 500;
}
.stat-pill .val {
  padding: 3px 10px;
  font-weight: 600;
  background: white;
}

/* 胶囊状态颜色 */
.stat-pill.normal { border-color: var(--el-border-color); }
.stat-pill.normal .label {
  border-right-color: var(--el-border-color);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
}
.stat-pill.normal .val { color: var(--el-text-color-primary); }

.stat-pill.success { border-color: var(--el-color-success-light-5); }
.stat-pill.success .label {
  border-right-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}
.stat-pill.success .val { color: var(--el-color-success); }

.stat-pill.warning { border-color: var(--el-color-warning-light-5); }
.stat-pill.warning .label {
  border-right-color: var(--el-color-warning-light-5);
  background: var(--el-color-warning-light-9);
  color: var(--el-color-warning);
}
.stat-pill.warning .val { color: var(--el-color-warning); }

.selection-status {
  font-size: 13px;
  color: var(--el-text-color-regular);
}
.highlight-num {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-primary);
  margin: 0 4px;
}

.translation-header {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 24px;
}

.translate-lang-select {
  width: 96px;
}

.translation-header :deep(.el-button) {
  padding: 0 4px;
}

/* 表格与分页间距 */
.pagination-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 16px;
}
.status-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  display: flex;
  align-items: center;
  gap: 4px;
}

.center-block {
  text-align: center;
  padding: 80px 0;
}
.center-text {
  margin-top: 16px;
  font-size: 14px;
}
.muted {
  color: var(--el-text-color-secondary);
}
</style>
