<template>
  <div class="card-grid-container">
    <div v-if="total > 0" class="grid-toolbar">
      <span class="grid-count">共 {{ total }} 件</span>
      <span v-if="selectedCount && selectedCount > 0" class="grid-selected">已选 {{ selectedCount }} 件</span>
      <span class="grid-spacer" style="flex:1" />
      <el-select v-model="sortBy" size="small" style="width:130px" @change="$emit('sortChange', sortBy)">
        <el-option label="默认排序" value="" />
        <el-option label="BSR ↑" value="bsr_asc" />
        <el-option label="BSR ↓" value="bsr_desc" />
        <el-option label="价格 ↑" value="price_asc" />
        <el-option label="价格 ↓" value="price_desc" />
        <el-option label="月销 ↑" value="units_asc" />
        <el-option label="月销 ↓" value="units_desc" />
      </el-select>
      <el-button size="small" text type="primary" @click="selectAllCurrent">
        {{ allSelectedOnPage ? '取消全选' : '全选当前页' }}
      </el-button>
    </div>
    <SkeletonWrapper :loading="loading" variant="card-grid" :count="12">
      <div class="card-grid">
        <UniversalCard
          v-for="item in products"
          :key="item.asin"
          :product="item"
          mode="selection"
          :selected="selectedAsins?.has(item.asin)"
          @click="$emit('cardClick', item)"
          @toggle-select="$emit('toggleSelect', item.asin)"
          @view="$emit('viewDetail', item)"
        />
        <el-empty v-if="!loading && products.length === 0" description="点击左侧大类浏览全部商品，点击子类加载 AI 品线模型" />
      </div>
    </SkeletonWrapper>
    <div class="grid-footer" v-if="total > 0">
      <span v-if="selectedCount && selectedCount > pageSize" class="cross-page-hint">
        已跨页选中 {{ selectedCount }} 件商品
      </span>
      <el-pagination
        :total="total"
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="[60, 100, 200, 500]"
        layout="total, sizes, prev, pager, next"
        @current-change="$emit('pageChange', $event)"
        @size-change="$emit('sizeChange', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import UniversalCard from '@/components/UniversalCard/index.vue'
import SkeletonWrapper from '@/components/SkeletonWrapper/index.vue'
import { ElEmpty, ElPagination, ElSelect, ElOption, ElButton } from 'element-plus'
import type { CompetitorProductRaw } from '@/api/competitor'

interface Props {
  products: CompetitorProductRaw[]
  total: number
  loading: boolean
  currentPage: number
  pageSize: number
  selectedAsins?: Set<string>
  selectedCount?: number
  sortBy?: string
}

interface Emits {
  (e: 'cardClick', product: CompetitorProductRaw): void
  (e: 'toggleSelect', asin: string): void
  (e: 'viewDetail', product: CompetitorProductRaw): void
  (e: 'pageChange', page: number): void
  (e: 'sizeChange', size: number): void
  (e: 'selectAllCurrent'): void
  (e: 'deselectAllCurrent'): void
  (e: 'sortChange', sortBy: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const sortBy = ref(props.sortBy || '')

function selectAllCurrent() {
  if (allSelectedOnPage.value) {
    emit('deselectAllCurrent')
  } else {
    emit('selectAllCurrent')
  }
}

const allSelectedOnPage = computed(() => {
  const set = props.selectedAsins
  if (!set || !props.products.length) return false
  return props.products.every(p => set.has(p.asin))
})
</script>

<style scoped lang="scss">
.card-grid-container {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.grid-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--el-border-color-light, #e5e1da);
  font-size: 13px;

  .grid-count { color: var(--el-text-color-secondary, #6b7280); }
  .grid-selected { color: var(--el-color-primary, #b45309); font-weight: 600; }
}

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  padding: 16px;
}

.grid-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  padding: 16px;

  .cross-page-hint {
    color: var(--el-color-primary, #b45309);
    font-size: 13px;
    font-weight: 600;
  }
}
</style>
