<template>
  <div class="selection-page">
    <!-- 顶部工具栏 -->
    <div class="topbar">
      <div class="tb-brand"><span>思觉智贸</span> · 选品</div>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>选品中心</el-breadcrumb-item>
        <el-breadcrumb-item>品线选品</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="tb-spacer" />

      <label class="tb-select">
        站点
        <el-select v-model="store.marketplace" size="small" style="width:80px">
          <el-option label="US" value="US" />
          <el-option label="UK" value="UK" />
          <el-option label="DE" value="DE" />
        </el-select>
      </label>

      <label class="tb-select">
        月份
        <el-select v-model="store.month" size="small" style="width:100px">
          <el-option label="2026-05" value="2026-05" />
          <el-option label="2026-04" value="2026-04" />
          <el-option label="2026-03" value="2026-03" />
        </el-select>
      </label>

      <label class="tb-select">
        版本
        <el-select v-model="store.batchVersion" size="small" style="width:70px">
          <el-option label="v3" value="v3" />
          <el-option label="v2" value="v2" />
          <el-option label="v1" value="v1" />
        </el-select>
      </label>

      <button class="mobile-tree-btn" @click="mobileTreeOpen = true">
        <el-icon><Menu /></el-icon> 品线
      </button>
    </div>

    <!-- 工作区 -->
    <div class="workspace">
      <!-- 品线树 -->
      <ProductLineTree
        :mobile-open="mobileTreeOpen"
        @close-mobile="mobileTreeOpen = false"
      />

      <!-- 拖拽分隔线 (桌面端) -->
      <div class="tree-resize" />

      <!-- 品线模型 + 操作栏 -->
      <div class="model-wrapper">
        <ProductLineModel />

        <!-- 筛选操作栏 -->
        <div v-if="store.selectedNodeId" class="action-bar">
          <div class="filter-tags">
            <span
              v-for="f in store.activeFilters"
              :key="f.id"
              class="filter-tag"
            >
              {{ f.label }}
              <span class="close" @click="store.removeFilter(f.id)">&times;</span>
            </span>
            <span v-if="!store.hasFilters" class="filter-hint">
              点击模型中的元素或载体加入筛选
            </span>
          </div>
          <el-button
            type="primary"
            :disabled="!store.hasFilters"
            @click="store.openResults()"
          >
            应用全部筛选
          </el-button>
        </div>
      </div>
    </div>

    <!-- 竞品结果 -->
    <CompetitorResultTable
      @batch-select="handleBatchSelect"
      @view-detail="handleViewDetail"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Menu } from '@element-plus/icons-vue'
import { useProductLineSelectionStore } from './store'
import ProductLineTree from './components/ProductLineTree.vue'
import ProductLineModel from './components/ProductLineModel.vue'
import CompetitorResultTable from './components/CompetitorResultTable.vue'

const store = useProductLineSelectionStore()
const mobileTreeOpen = ref(false)

function handleBatchSelect(rows: any[]) {
  // TODO: 弹出选择目标列表弹窗
  ElMessage.success(`已选中 ${rows.length} 个竞品，请选择目标选品列表`)
}

function handleViewDetail(row: any) {
  // TODO: 打开竞品详情面板
  ElMessage.info(`查看详情: ${row.title}`)
}
</script>

<script lang="ts">
export default { name: 'ProductLineSelection' }
</script>

<style lang="scss" scoped>
@use '@/styles/variables.scss' as *;

.selection-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

// ---- 顶部工具栏 ----
.topbar {
  height: 48px;
  min-height: 48px;
  background: $bg-color;
  border-bottom: 1px solid $border-color;
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 12px;

  .tb-brand { font-size: 13px; font-weight: 600; color: $text-secondary; letter-spacing: 0.02em; white-space: nowrap; }
  .tb-brand span { color: $text-primary; }
  .tb-spacer { flex: 1; }
}

.tb-select {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px;
  color: $text-secondary;
  white-space: nowrap;
}

.mobile-tree-btn {
  display: none;
  padding: 6px 12px;
  background: $bg-hover;
  border: 1px solid $border-color;
  border-radius: $radius-md;
  font-size: 13px;
  color: $text-secondary;
  cursor: pointer;
  font-family: inherit;

  &:hover { color: $text-primary; border-color: $primary-color; }
}

// ---- 工作区 ----
.workspace {
  display: flex;
  flex: 1;
  min-height: 0;
}

.tree-resize {
  width: 4px;
  background: transparent;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background $transition-fast;

  &:hover { background: $primary-color; }

  @media (max-width: 900px) { display: none; }
}

.model-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

// ---- 操作栏 ----
.action-bar {
  display: flex; gap: 12px; align-items: center;
  padding: 12px 20px;
  background: $bg-color;
  border-top: 1px solid $border-color;

  .filter-tags {
    flex: 1;
    display: flex; flex-wrap: wrap; gap: 6px;
  }

  .filter-tag {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px;
    background: rgba($primary-color, 0.08);
    color: $primary-color;
    border-radius: $radius-sm;
    font-size: 12px; font-weight: 500;
    border: 1px solid rgba($primary-color, 0.15);
  }

  .filter-tag .close {
    cursor: pointer; font-size: 14px; line-height: 1; opacity: 0.6;
    &:hover { opacity: 1; }
  }

  .filter-hint {
    font-size: 12px;
    color: $text-tertiary;
    font-style: italic;
  }
}

// ---- 响应式 ----
@media (max-width: 900px) {
  .mobile-tree-btn { display: inline-flex; align-items: center; gap: 4px; }

  .tb-select { display: none; }
}
</style>
