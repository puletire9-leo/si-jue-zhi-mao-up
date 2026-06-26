<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { ElEmpty, ElInput } from 'element-plus'
import { Search, Loading } from '@element-plus/icons-vue'
import request from '@/utils/request'

defineOptions({ name: 'GlobalSearch' })

interface SearchResult {
  asin: string
  title: string
  imageUrl?: string
  price?: number
  brand?: string
  source?: string
}

interface SearchApiResponse {
  data?: { list?: SearchResult[] }
}

const router = useRouter()

// ── state ──
const isOpen = ref(false)
const keyword = ref('')
const results = ref<SearchResult[]>([])
const loading = ref(false)
const selectedIndex = ref(-1)
const showHistory = ref(true)
const history = ref<SearchResult[]>([])

const searchInputRef = ref<InstanceType<typeof ElInput> | null>(null)
const STORAGE_KEY = 'search-history'

// ── abort controller ──
let abortController: AbortController | null = null

// ── mock data fallback ──
const mockProducts: SearchResult[] = [
  { asin: 'B0C1X2Y3Z4', title: 'Wireless Charger Pad Fast Charging Compatible iPhone Samsung Android 15W', price: 15.99, brand: 'Anker', source: 'Electronics' },
  { asin: 'B0A9B8C7D6', title: 'Bluetooth Speaker Portable Waterproof IPX7 Outdoor Wireless Speaker with Bass', price: 25.99, brand: 'JBL', source: 'Electronics' },
  { asin: 'B0D5E4F3G2', title: 'Memory Foam Travel Neck Pillow for Airplane Car Bus with Eye Mask Earplugs', price: 12.99, brand: 'TravelMate', source: 'Travel' },
  { asin: 'B0H1I2J3K4', title: 'Stainless Steel Insulated Water Bottle 32oz Double Wall Vacuum', price: 19.99, brand: 'HydroCell', source: 'Sports' },
  { asin: 'B0L5M6N7O8', title: 'LED Desk Lamp with Clamp, Gooseneck Reading Light, Dimmable Eye Protection', price: 29.99, brand: 'Brightech', source: 'Home' },
  { asin: 'B0P9Q8R7S6', title: 'Yoga Mat Premium Non Slip Exercise Mat Fitness Mat with Carrying Strap', price: 21.99, brand: 'Gaiam', source: 'Sports' },
  { asin: 'B0T5U4V3W2', title: 'Organic Cotton T-Shirt Men Women Soft Comfortable Casual Basic Tee', price: 14.99, brand: 'Hanes', source: 'Clothing' },
  { asin: 'B0X1Y2Z3A4', title: 'Smart Plug Mini WiFi Outlet Works with Alexa Google Home, No Hub Required', price: 9.99, brand: 'TP-Link', source: 'Electronics' },
  { asin: 'B0B5C4D3E2', title: 'Electric Kettle Temperature Control Stainless Steel Hot Water Boiler 1.7L', price: 34.99, brand: 'Cuisinart', source: 'Kitchen' },
  { asin: 'B0F1G2H3I4', title: 'Resistance Bands Set, Exercise Bands with Handles, Door Anchor, Ankle Straps', price: 16.99, brand: 'FitSimplify', source: 'Sports' },
  { asin: 'B0J5K4L3M2', title: 'Portable Camping Hammock Double Size with Tree Straps, Parachute Nylon', price: 27.99, brand: 'Ticket To The Moon', source: 'Outdoor' },
  { asin: 'B0N1O2P3Q4', title: 'Scented Soy Candle Gift Set 6 Pack, Aromatherapy Candles for Home', price: 23.99, brand: 'Yankee Candle', source: 'Home' },
  { asin: 'B0R5S4T3U2', title: 'Knife Sharpener Professional 3 Stage, Diamond Rod for Kitchen Knives', price: 11.99, brand: 'Work Sharp', source: 'Kitchen' },
  { asin: 'B0V1W2X3Y4', title: 'Pet Hair Remover Roller Reusable, ChomChom Roller Pet Hair Remover', price: 17.99, brand: 'ChomChom', source: 'Pets' },
  { asin: 'B0Z5A4B3C2', title: 'Microwave Popcorn Popper Bowl, Silicone Collapsible Cover, BPA Free', price: 9.99, brand: 'Presto', source: 'Kitchen' },
]

function filterMockData(query: string): SearchResult[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return mockProducts.filter(item =>
    item.asin.toLowerCase().includes(q) ||
    item.title.toLowerCase().includes(q) ||
    (item.brand && item.brand.toLowerCase().includes(q))
  )
}

// ── localStorage history ──
function loadHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        history.value = parsed.slice(0, 10)
        return
      }
    }
  } catch {
    // corrupted data, ignore
  }
  history.value = []
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.value.slice(0, 10)))
  } catch {
    // storage quota exceeded or unavailable, silently ignore
  }
}

function addToHistory(item: SearchResult) {
  history.value = history.value.filter(h => h.asin !== item.asin)
  history.value.unshift(item)
  history.value = history.value.slice(0, 10)
  saveHistory()
}

function clearHistory() {
  history.value = []
  localStorage.removeItem(STORAGE_KEY)
}

// ── search logic ──
async function doSearch(query: string): Promise<void> {
  const trimmed = query.trim()
  if (!trimmed) {
    results.value = []
    showHistory.value = true
    return
  }

  // cancel previous in-flight request
  if (abortController) {
    abortController.abort()
  }
  abortController = new AbortController()

  loading.value = true
  showHistory.value = false
  selectedIndex.value = -1

  try {
    const res = await request<SearchApiResponse>({
      url: '/api/v1/competitor/search',
      method: 'get',
      params: { keyword: trimmed },
      signal: abortController.signal,
      timeout: 5000,
    })

    const list = res?.data?.list
    if (Array.isArray(list) && list.length > 0) {
      results.value = list.map((item: any) => ({
        asin: item.asin || '',
        title: item.title || item.productTitle || '',
        imageUrl: item.imageUrl || '',
        price: item.price,
        brand: item.brand,
        source: item.source,
      }))
    } else {
      // API returned success but no data, fallback to mock
      results.value = filterMockData(trimmed)
    }
  } catch (err: any) {
    // abort ⇒ silently ignore
    if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return
    // API unavailable ⇒ fallback to mock
    results.value = filterMockData(trimmed)
  } finally {
    loading.value = false
  }
}

// ── debounced watcher ──
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(keyword, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => doSearch(val), 300)
})

// ── navigation ──
function navigateTo(item: SearchResult): void {
  if (!item.asin) return
  addToHistory(item)
  close()
  router.push({ name: 'SelectionDetail', params: { id: item.asin } })
}

// ── open / close ──
function open(): void {
  isOpen.value = true
  keyword.value = ''
  results.value = []
  selectedIndex.value = -1
  showHistory.value = true
  loadHistory()
  nextTick(() => {
    searchInputRef.value?.focus()
  })
}

function close(): void {
  isOpen.value = false
  if (abortController) {
    abortController.abort()
  }
}

// ── keyboard handling ──
function handleKeydown(e: KeyboardEvent): void {
  const totalItems = showHistory.value ? history.value.length : results.value.length

  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      close()
      break

    case 'ArrowDown':
      e.preventDefault()
      if (totalItems > 0) {
        selectedIndex.value = selectedIndex.value < totalItems - 1 ? selectedIndex.value + 1 : 0
      }
      break

    case 'ArrowUp':
      e.preventDefault()
      if (totalItems > 0) {
        selectedIndex.value = selectedIndex.value > 0 ? selectedIndex.value - 1 : totalItems - 1
      }
      break

    case 'Enter':
      e.preventDefault()
      if (selectedIndex.value >= 0 && selectedIndex.value < totalItems) {
        const item = showHistory.value
          ? history.value[selectedIndex.value]
          : results.value[selectedIndex.value]
        if (item) navigateTo(item)
      } else if (results.value.length > 0) {
        // no item selected, pick the first result
        navigateTo(results.value[0])
      }
      break
  }
}

// ── global Ctrl+K / Cmd+K shortcut ──
function handleGlobalKeydown(e: KeyboardEvent): void {
  // Avoid triggering inside input elements to let native shortcuts work
  const target = e.target as HTMLElement
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
  if (isInput) return

  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    if (isOpen.value) {
      close()
    } else {
      open()
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  if (abortController) abortController.abort()
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <div class="global-search">
    <!-- Trigger button -->
    <el-tooltip content="搜索商品 (Ctrl+K)" placement="bottom">
      <el-button :icon="Search" circle @click="open" class="search-trigger icon-btn" />
    </el-tooltip>

    <!-- Modal overlay -->
    <Transition name="search-modal">
      <div v-if="isOpen" class="search-overlay" @keydown="handleKeydown" @click.self="close">
        <div class="search-panel" @click.stop>
          <!-- Input row -->
          <div class="search-input-row">
            <el-input
              ref="searchInputRef"
              v-model="keyword"
              placeholder="搜索 ASIN、商品名称、品牌..."
              clearable
              class="search-input"
            >
              <template #prefix>
                <el-icon class="search-icon"><Search /></el-icon>
              </template>
            </el-input>
            <kbd class="key-hint" @click="close">ESC</kbd>
          </div>

          <!-- Body -->
          <div class="search-body">
            <!-- Loading spinner -->
            <div v-if="loading" class="search-status">
              <el-icon class="is-loading"><Loading /></el-icon>
              <span>搜索中...</span>
            </div>

            <!-- History -->
            <div v-else-if="showHistory && history.length > 0" class="search-section">
              <div class="section-header">
                <span class="section-title">搜索历史</span>
                <button class="clear-btn" @click="clearHistory">清除</button>
              </div>
              <ul class="result-list" role="listbox">
                <li
                  v-for="(item, index) in history"
                  :key="'h-' + item.asin + '-' + index"
                  class="result-item"
                  :class="{ active: selectedIndex === index }"
                  role="option"
                  :aria-selected="selectedIndex === index"
                  @click="navigateTo(item)"
                  @mouseenter="selectedIndex = index"
                >
                  <div class="result-content">
                    <span class="result-asin">{{ item.asin }}</span>
                    <span class="result-title">{{ item.title }}</span>
                    <span class="result-meta">
                      <template v-if="item.price != null">${{ item.price.toFixed(2) }}</template>
                      <template v-if="item.brand"> &middot; {{ item.brand }}</template>
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Search results -->
            <div v-else-if="!showHistory && results.length > 0" class="search-section">
              <div class="section-header">
                <span class="section-title">搜索结果</span>
                <span class="result-count">{{ results.length }} 条</span>
              </div>
              <ul class="result-list" role="listbox">
                <li
                  v-for="(item, index) in results"
                  :key="item.asin"
                  class="result-item"
                  :class="{ active: selectedIndex === index }"
                  role="option"
                  :aria-selected="selectedIndex === index"
                  @click="navigateTo(item)"
                  @mouseenter="selectedIndex = index"
                >
                  <div class="result-content">
                    <span class="result-asin">{{ item.asin }}</span>
                    <span class="result-title">{{ item.title }}</span>
                    <span class="result-meta">
                      <template v-if="item.price != null">${{ item.price.toFixed(2) }}</template>
                      <template v-if="item.brand"> &middot; {{ item.brand }}</template>
                    </span>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Empty state -->
            <div v-else-if="!showHistory && keyword && !loading" class="search-status">
              <el-empty :image-size="72" description="未找到相关商品" />
            </div>

            <!-- Initial hint -->
            <div v-else class="search-status search-status--hint">
              <el-empty :image-size="72" description="输入关键词搜索商品" />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped lang="scss">
// ── trigger button ──
.search-trigger {
  &.icon-btn {
    width: 36px;
    height: 36px;
    background: transparent;
    color: #6b7280;
    border: none;

    &:hover {
      background: #f5f0eb;
      color: #b45309;
    }
  }
}

// ── overlay ──
.search-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  justify-content: center;
  padding-top: 120px;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(2px);
}

// ── panel ──
.search-panel {
  width: 580px;
  max-width: calc(100vw - 64px);
  max-height: 480px;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  align-self: flex-start;
}

// ── input row ──
.search-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px 0;

  .search-input {
    flex: 1;

    :deep(.el-input__wrapper) {
      background: #f5f0eb;
      border-radius: 8px;
      box-shadow: none;
      padding: 4px 12px;
      border: 1px solid transparent;
      transition: border-color 0.15s, background 0.15s;

      &:hover {
        background: #efe8e0;
      }

      &.is-focus {
        background: #ffffff;
        border-color: #b45309;
        box-shadow: 0 0 0 3px rgba(180, 83, 9, 0.1);
      }
    }

    :deep(.el-input__inner) {
      font-size: 15px;
      color: #1a1a1a;
      &::placeholder {
        color: #9ca3af;
      }
    }

    .search-icon {
      color: #9ca3af;
      font-size: 16px;
    }
  }

  .key-hint {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 26px;
    padding: 0 8px;
    font-size: 11px;
    font-family: inherit;
    color: #9ca3af;
    background: #f5f0eb;
    border: 1px solid #e5e1da;
    border-radius: 5px;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;

    &:hover {
      background: #e5e1da;
      color: #6b7280;
    }
  }
}

// ── body ──
.search-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0 8px;
  min-height: 80px;

  // thin scrollbar
  &::-webkit-scrollbar {
    width: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #e5e1da;
    border-radius: 3px;
  }
}

// ── section header ──
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 20px 6px;

  .section-title {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .result-count {
    font-size: 12px;
    color: #9ca3af;
  }

  .clear-btn {
    font-size: 12px;
    color: #b45309;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    transition: background 0.15s;

    &:hover {
      background: #f5f0eb;
    }
  }
}

// ── result list ──
.result-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.result-item {
  cursor: pointer;
  padding: 10px 20px;
  transition: background 0.12s;
  border-left: 3px solid transparent;

  &.active,
  &:hover {
    background: #faf8f5;
    border-left-color: #b45309;
  }
}

.result-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.result-asin {
  font-size: 14px;
  font-weight: 600;
  color: #b45309;
  font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
}

.result-title {
  font-size: 13px;
  color: #1a1a1a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-meta {
  font-size: 12px;
  color: #6b7280;
}

// ── status ──
.search-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 20px;
  color: #9ca3af;
  font-size: 14px;

  .el-icon.is-loading {
    font-size: 20px;
    color: #b45309;
  }
}

// ── transition ──
.search-modal-enter-active {
  transition: opacity 0.2s ease;

  .search-panel {
    transition: opacity 0.2s ease, transform 0.2s ease;
  }
}

.search-modal-leave-active {
  transition: opacity 0.15s ease;

  .search-panel {
    transition: opacity 0.15s ease, transform 0.15s ease;
  }
}

.search-modal-enter-from,
.search-modal-leave-to {
  opacity: 0;

  .search-panel {
    opacity: 0;
    transform: translateY(-12px);
  }
}

// ═══════════════════════════════════════════
// Dark mode
// ═══════════════════════════════════════════
:deep(html.dark) {
  .search-trigger {
    &.icon-btn {
      color: #A1A1AA;
      &:hover {
        background: #252540;
        color: #d97706;
      }
    }
  }
}

:deep(html.dark) .search-panel {
  background: #1a1814;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.45);
}

:deep(html.dark) .search-input-row {
  .search-input {
    :deep(.el-input__wrapper) {
      background: #242018;
      &:hover {
        background: #2d2820;
      }
      &.is-focus {
        background: #1a1814;
        border-color: #d97706;
        box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15);
      }
    }
    :deep(.el-input__inner) {
      color: #f0ece6;
      &::placeholder {
        color: #706860;
      }
    }
    .search-icon {
      color: #706860;
    }
  }

  .key-hint {
    color: #706860;
    background: #242018;
    border-color: #2d2820;
    &:hover {
      background: #2d2820;
      color: #a09888;
    }
  }
}

:deep(html.dark) .search-section {
  .section-title {
    color: #706860;
  }
  .result-count {
    color: #706860;
  }
  .clear-btn {
    color: #d97706;
    &:hover {
      background: #242018;
    }
  }
}

:deep(html.dark) .result-item {
  &.active,
  &:hover {
    background: #242018;
    border-left-color: #d97706;
  }
}

:deep(html.dark) .result-asin {
  color: #d97706;
}

:deep(html.dark) .result-title {
  color: #f0ece6;
}

:deep(html.dark) .result-meta {
  color: #a09888;
}

:deep(html.dark) .search-status {
  color: #706860;
  .el-icon.is-loading {
    color: #d97706;
  }
}

:deep(html.dark) .search-body {
  &::-webkit-scrollbar-thumb {
    background: #2d2820;
  }
}
</style>
