<template>
  <div class="sst">
    <el-radio-group :model-value="modelValue.marketplace" size="small" @change="changeMarketplace">
      <el-radio-button value="UK">UK</el-radio-button>
      <el-radio-button value="DE">DE</el-radio-button>
      <el-radio-button value="US">US</el-radio-button>
    </el-radio-group>

    <el-select
      :model-value="modelValue.range.createdWeeks"
      multiple
      collapse-tags
      collapse-tags-tooltip
      placeholder="周批次（默认最新）"
      class="sst__weeks"
      @update:model-value="changeWeeks"
    >
      <el-option
        v-for="batch in batches"
        :key="batch.batchCode"
        :label="`${batch.batchCode} · ${batch.shopCount}店`"
        :value="batch.batchCode"
      />
    </el-select>

    <el-input
      :model-value="modelValue.sellerKeyword"
      clearable
      placeholder="搜索店铺名称"
      class="sst__keyword"
      @update:model-value="changeKeyword"
      @keyup.enter="emit('search')"
    >
      <template #prefix><el-icon><Search /></el-icon></template>
    </el-input>

    <el-select :model-value="modelValue.sortBy" class="sst__sort" @update:model-value="changeSort">
      <el-option label="通过商品数" value="passedProductCount" />
      <el-option label="M01 命中数" value="m01HitCount" />
      <el-option label="平均上架天数" value="avgListingDays" />
      <el-option label="店铺商品数" value="productCount" />
      <el-option label="90天新品数" value="new90Count" />
    </el-select>
    <el-select :model-value="modelValue.sortOrder" class="sst__order" @update:model-value="changeOrder">
      <el-option label="降序" value="desc" />
      <el-option label="升序" value="asc" />
    </el-select>

    <el-button type="primary" :loading="loading" @click="emit('search')">
      <el-icon><Search /></el-icon><span>查询</span>
    </el-button>
    <el-button @click="openDrawer">
      <el-icon><Filter /></el-icon><span>筛选</span>
      <el-badge v-if="activeCount" :value="activeCount" class="sst__badge" />
    </el-button>

    <FilterDrawer v-model:visible="drawerVisible" title="店铺筛选" size="760" @reset="resetDraft" @confirm="confirmDraft">
      <div class="sst__aggregate">
        <el-input v-model="draft.sellerNamesText" type="textarea" :rows="3" placeholder="批量精准店铺名，换行或逗号分隔" />
        <el-input-number v-model="draft.minProductCount" :min="0" :value-on-clear="null" placeholder="最低商品数" />
        <el-input-number v-model="draft.minPassedProductCount" :min="0" :value-on-clear="null" placeholder="最低通过数" />
        <el-input-number v-model="draft.minM01HitCount" :min="0" :value-on-clear="null" placeholder="M01 命中不少于" />
        <el-input-number v-model="draft.avgListingDaysMax" :min="0" :value-on-clear="null" placeholder="平均上架天数上限" />
        <el-checkbox v-model="draft.m01Only">通过商品仅看 M01</el-checkbox>
        <el-select v-if="showWatchlistFilters" v-model="draft.watchlistStatus" clearable placeholder="观察状态">
          <el-option label="观察中" value="WATCHING" />
          <el-option label="已抓取" value="FETCHED" />
          <el-option label="已确认" value="CONFIRMED" />
          <el-option label="已忽略" value="IGNORED" />
        </el-select>
        <el-select v-if="showWatchlistFilters" v-model="draft.sourceType" clearable placeholder="来源类型">
          <el-option label="候选确认" value="CANDIDATE_CONFIRM" />
          <el-option label="人工加入" value="MANUAL" />
          <el-option label="基线" value="BASELINE" />
          <el-option label="历史方法卡" value="METHOD_CARD" />
        </el-select>
      </div>
      <RangeFilterPanel
        v-model="draft.range"
        :country="draft.marketplace"
        snapshot-kind="shop_batch"
        :snapshot-options="snapshotOptions"
        snapshot-label-text="店铺周批次"
        snapshot-placeholder-text="选择一个或多个周批次"
        :auto-select-latest-week="false"
        embedded
      />
    </FilterDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Filter, Search } from '@element-plus/icons-vue'
import FilterDrawer from '@/components/FilterDrawer/index.vue'
import RangeFilterPanel from '@/components/RangeFilterPanel/index.vue'
import type { ShopScreeningBatch } from '@/api/shopCollection'
import {
  cloneShopScreeningFilters,
  createShopScreeningFilters,
  type ShopScreeningFilters,
} from './shopScreening'

const props = withDefaults(defineProps<{
  modelValue: ShopScreeningFilters
  batches?: ShopScreeningBatch[]
  loading?: boolean
  showWatchlistFilters?: boolean
}>(), { batches: () => [], loading: false, showWatchlistFilters: false })

const emit = defineEmits<{
  (e: 'update:modelValue', value: ShopScreeningFilters): void
  (e: 'search'): void
  (e: 'marketplace-change'): void
}>()

const drawerVisible = ref(false)
const draft = ref(cloneShopScreeningFilters(props.modelValue))
const snapshotOptions = computed(() => props.batches.map((item) => ({
  value: item.batchCode,
  label: item.batchCode,
  count: item.productCount,
})))

const activeCount = computed(() => {
  const f = props.modelValue
  const r = f.range
  return [f.sellerNamesText, f.minProductCount, f.minPassedProductCount, f.minM01HitCount,
    f.avgListingDaysMax, r.priceMin, r.priceMax, r.unitsMin, r.unitsMax, r.listingDaysMin,
    r.listingDaysMax, r.bsrMax, r.weightMax, r.variantCountMax]
    .filter((value) => value !== '' && value != null).length
    + r.fulfillment.length + r.category.length + (f.m01Only ? 1 : 0)
})

function update(patch: Partial<ShopScreeningFilters>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
function changeMarketplace(value: string | number | boolean | undefined) {
  update({ marketplace: String(value || 'UK'), range: { ...props.modelValue.range, createdWeeks: [] } })
  emit('marketplace-change')
}
function changeWeeks(value: string[]) { update({ range: { ...props.modelValue.range, createdWeeks: value } }) }
function changeKeyword(value: string) { update({ sellerKeyword: value }) }
function changeSort(value: ShopScreeningFilters['sortBy']) { update({ sortBy: value }) }
function changeOrder(value: ShopScreeningFilters['sortOrder']) { update({ sortOrder: value }) }
function openDrawer() { draft.value = cloneShopScreeningFilters(props.modelValue); drawerVisible.value = true }
function resetDraft() { draft.value = createShopScreeningFilters(props.modelValue.marketplace) }
function confirmDraft() { emit('update:modelValue', cloneShopScreeningFilters(draft.value)); drawerVisible.value = false; emit('search') }
</script>

<style scoped lang="scss">
.sst { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sst__weeks { width: 230px; }
.sst__keyword { width: 220px; }
.sst__sort { width: 150px; }
.sst__order { width: 90px; }
.sst__badge { margin-left: 4px; }
.sst__aggregate { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.sst__aggregate > :first-child { grid-column: 1 / -1; }
@media (max-width: 900px) {
  .sst__weeks, .sst__keyword, .sst__sort { width: 100%; }
  .sst__aggregate { grid-template-columns: 1fr; }
  .sst__aggregate > :first-child { grid-column: auto; }
}
</style>
