<template>
  <div class="product-tier-table">
    <el-table :data="rows" v-loading="loading" border stripe size="small">
      <el-table-column label="图片" width="76">
        <template #default="{ row }">
          <LazyImage
            v-if="row.imageUrl"
            :image-id="row.asin"
            :src="row.imageUrl"
            :width="56"
            :height="56"
            fit="contain"
            :preview-src-list="[row.imageUrl]"
          />
          <div v-else class="img-empty"><el-icon><PictureFilled /></el-icon></div>
        </template>
      </el-table-column>
      <el-table-column label="ASIN" width="128">
        <template #default="{ row }">
          <span class="mono link" @click="copyAsin(row.asin)" :title="'点击复制 ' + row.asin">{{ row.asin }}</span>
        </template>
      </el-table-column>
      <el-table-column label="父 ASIN" width="120">
        <template #default="{ row }"><span class="mono dim">{{ row.parentAsin || '—' }}</span></template>
      </el-table-column>
      <el-table-column label="标题" min-width="240" show-overflow-tooltip>
        <template #default="{ row }">{{ row.title || '—' }}</template>
      </el-table-column>
      <el-table-column label="等级" width="72" align="center">
        <template #default="{ row }">
          <el-tag :type="tierTagType(row.salesTier)" size="small" effect="light">{{ row.salesTier }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="月销量" width="90" align="right">
        <template #default="{ row }"><span class="mono">{{ num(row.units) }}</span></template>
      </el-table-column>
      <el-table-column label="BSR" width="90" align="right">
        <template #default="{ row }"><span class="mono dim">{{ row.bsr != null ? '#' + num(row.bsr) : '—' }}</span></template>
      </el-table-column>
      <el-table-column label="价格" width="90" align="right">
        <template #default="{ row }"><span class="mono">{{ money(row.price, marketplace) }}</span></template>
      </el-table-column>
      <el-table-column label="上架时间" width="108">
        <template #default="{ row }"><span class="mono dim">{{ epochToDate(row.availableDate) }}</span></template>
      </el-table-column>
      <el-table-column label="评分/评论" width="110" align="center">
        <template #default="{ row }">
          <span v-if="row.rating != null">
            <span>{{ row.rating }}</span>
            <span class="dim">({{ num(row.ratings) }})</span>
          </span>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column label="榜单类目" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <span :title="row.nodeLabelPath || ''">{{ row.categoryLeaf || row.nodeLabelPath || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="链接" width="64" align="center">
        <template #default="{ row }">
          <a :href="linkOf(row)" target="_blank" rel="noopener" class="ext-link" title="打开 Amazon 链接">
            <el-icon><Link /></el-icon>
          </a>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无商品" />
      </template>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="innerPage"
        v-model:page-size="innerSize"
        :page-sizes="[30, 60, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        size="small"
        background
        @current-change="emitChange"
        @size-change="onSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { PictureFilled, Link } from '@element-plus/icons-vue'
import LazyImage from '@/components/LazyImage/index.vue'
import type { Marketplace, ShopProfileProduct } from '@/types/shopProfile'
import { num, money, tierTagType, amazonProductUrl, epochToDate } from '../utils'

const props = defineProps<{
  rows: ShopProfileProduct[]
  loading?: boolean
  total: number
  page: number
  size: number
  marketplace: Marketplace
}>()

const emit = defineEmits<{
  (e: 'page-change', page: number, size: number): void
}>()

const innerPage = ref(props.page)
const innerSize = ref(props.size)

watch(
  () => props.page,
  (v) => (innerPage.value = v)
)
watch(
  () => props.size,
  (v) => (innerSize.value = v)
)

function emitChange() {
  emit('page-change', innerPage.value, innerSize.value)
}
function onSizeChange() {
  innerPage.value = 1
  emit('page-change', 1, innerSize.value)
}

function linkOf(row: ShopProfileProduct): string {
  return row.productUrl || amazonProductUrl(props.marketplace, row.asin)
}

async function copyAsin(asin: string) {
  try {
    await navigator.clipboard.writeText(asin)
    ElMessage.success(`已复制 ${asin}`)
  } catch {
    ElMessage.warning('复制失败，请手动选择')
  }
}
</script>

<style scoped lang="scss">
.mono {
  font-family: var(--el-font-family-mono, 'Consolas', monospace);
}
.dim {
  color: var(--el-text-color-secondary);
  margin-left: 2px;
}
.link {
  cursor: pointer;
  color: #e8621c;
  &:hover {
    text-decoration: underline;
  }
}
.ext-link {
  color: var(--el-text-color-secondary);
  &:hover {
    color: #e8621c;
  }
}
.img-empty {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  color: var(--el-text-color-placeholder);
}
.pager {
  display: flex;
  justify-content: flex-end;
  padding: 10px 12px;
}
</style>
