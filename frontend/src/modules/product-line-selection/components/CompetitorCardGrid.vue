<template>
  <div class="card-grid-container">
    <div v-loading="loading" class="card-grid">
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
      <el-empty v-if="!loading && products.length === 0" description="点击左侧品线大类或小类查看竞品" />
    </div>
    <div class="grid-footer" v-if="total > 0">
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
import UniversalCard from '@/components/UniversalCard/index.vue'
import { ElEmpty, ElPagination } from 'element-plus'
import type { CompetitorProductRaw } from '@/api/competitor'

interface Props {
  products: CompetitorProductRaw[]
  total: number
  loading: boolean
  currentPage: number
  pageSize: number
  selectedAsins?: Set<string>
}

interface Emits {
  (e: 'cardClick', product: CompetitorProductRaw): void
  (e: 'toggleSelect', asin: string): void
  (e: 'viewDetail', product: CompetitorProductRaw): void
  (e: 'pageChange', page: number): void
  (e: 'sizeChange', size: number): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped lang="scss">
.card-grid-container {
  display: flex;
  flex-direction: column;
  flex: 1;
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
  padding: 16px;
}
</style>
