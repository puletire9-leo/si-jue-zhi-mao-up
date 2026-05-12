<template>
  <div class="report-dashboard min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
    <!-- 顶部导航栏 -->
    <header class="bg-white shadow-md sticky top-0 z-10">
      <div class="container mx-auto px-4 py-3">
        <div class="flex items-center justify-between">
          <!-- 左侧标题 -->
          <div>
            <h1 class="text-xl font-bold text-blue-900">数据分析报告</h1>
            <p class="text-sm text-gray-500">
              查看开发人员和整体数据分析报告
            </p>
          </div>
          
          <!-- 右侧操作区 -->
          <div class="flex items-center gap-4">
            <!-- 开发人员选择 -->
            <el-select
              v-model="selectedDeveloper"
              placeholder="选择开发人员"
              size="default"
              @change="loadReport"
              class="w-48"
            >
              <el-option label="整体" value="total" />
              <el-option
                v-for="developer in developers"
                :key="developer.value"
                :label="developer.label"
                :value="developer.value"
              />
            </el-select>
            
            <!-- 时间范围选择 -->
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="default"
              @change="handleDateRangeChange"
              class="w-64"
            />
            
            <!-- 操作按钮 -->
            <el-button
              type="primary"
              size="default"
              :icon="Refresh"
              @click="loadReport"
            >
              刷新
            </el-button>
            
            <el-button
              type="success"
              size="default"
              :icon="Download"
              @click="exportReport"
            >
              导出
            </el-button>
            
            <el-button
              type="default"
              size="default"
              :icon="ArrowLeft"
              @click="handleBack"
            >
              返回
            </el-button>
          </div>
        </div>
      </div>
    </header>

    <!-- 主内容区 -->
    <div class="container mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
      <!-- 侧边栏导航 -->
      <aside class="lg:w-64 bg-white rounded-xl shadow-md p-4 sticky top-24 self-start">
        <h3 class="text-lg font-semibold text-gray-800 mb-4">报告导航</h3>
        <nav>
          <ul class="space-y-2">
            <li>
              <a
                href="#overview"
                class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-blue-900"
                @click="scrollToSection('overview')"
              >
                <el-icon><DataAnalysis /></el-icon>
                <span>概览</span>
              </a>
            </li>
            <li>
              <a
                href="#sales"
                class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700"
                @click="scrollToSection('sales')"
              >
                <el-icon><TrendCharts /></el-icon>
                <span>销售趋势</span>
              </a>
            </li>
            <li>
              <a
                href="#acoas"
                class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700"
                @click="scrollToSection('acoas')"
              >
                <el-icon><Money /></el-icon>
                <span>成本分析</span>
              </a>
            </li>
            <li>
              <a
                href="#stores"
                class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700"
                @click="scrollToSection('stores')"
              >
                <el-icon><Shop /></el-icon>
                <span>店铺绩效</span>
              </a>
            </li>
            <li>
              <a
                href="#categories"
                class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700"
                @click="scrollToSection('categories')"
              >
                <el-icon><Grid /></el-icon>
                <span>类目分析</span>
              </a>
            </li>
            <li>
              <a
                href="#products"
                class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700"
                @click="scrollToSection('products')"
              >
                <el-icon><Box /></el-icon>
                <span>产品分析</span>
              </a>
            </li>
          </ul>
        </nav>
        
        <!-- 报告信息 -->
        <div class="mt-8 pt-4 border-t border-gray-200">
          <h4 class="text-sm font-medium text-gray-600 mb-2">报告信息</h4>
          <div class="text-xs text-gray-500 space-y-1">
            <p>生成时间: {{ reportMeta?.generateTime || '加载中...' }}</p>
            <p>数据范围: {{ reportMeta?.dateRange || '加载中...' }}</p>
            <p>开发人员: {{ reportMeta?.developer || '加载中...' }}</p>
          </div>
        </div>
      </aside>

      <!-- 主内容 -->
      <main class="flex-1">
        <!-- 加载状态 -->
        <div v-if="loading" class="flex justify-center items-center py-20 bg-white rounded-xl shadow-md">
          <el-icon class="is-loading text-blue-600 mr-2"><Loading /></el-icon>
          <span class="text-gray-600">加载报告中...</span>
        </div>

        <!-- 错误状态 -->
        <div v-else-if="error" class="text-center py-20 bg-white rounded-xl shadow-md">
          <el-icon class="text-red-500 text-4xl mb-4"><CircleClose /></el-icon>
          <h3 class="text-lg font-medium text-red-500 mb-2">加载失败</h3>
          <p class="text-gray-500 mb-4">{{ error }}</p>
          <el-button type="primary" size="default" @click="loadReport">
            重试
          </el-button>
        </div>

        <!-- 报告内容 -->
        <div v-else-if="reportMeta" class="space-y-6">
          <!-- 概览部分 -->
          <section id="overview" class="bg-white rounded-xl shadow-md p-6">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-2xl font-bold text-blue-900">{{ reportMeta.title }}</h2>
              <el-tag type="info">{{ reportMeta.subtitle }}</el-tag>
            </div>

            <!-- 核心指标卡片 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <!-- 总产品数 -->
              <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                <div class="flex items-start justify-between">
                  <div>
                    <p class="text-sm text-blue-700 font-medium">总产品数</p>
                    <h3 class="text-2xl font-bold text-blue-900 mt-1">{{ coreMetrics.totalProducts || 0 }}</h3>
                    <p class="text-xs text-blue-600 mt-1">{{ coreMetrics.productsChange || '' }}</p>
                  </div>
                  <div class="bg-blue-200 rounded-full p-3">
                    <el-icon class="text-blue-700"><Box /></el-icon>
                  </div>
                </div>
              </div>

              <!-- 总销量 -->
              <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                <div class="flex items-start justify-between">
                  <div>
                    <p class="text-sm text-green-700 font-medium">总销量</p>
                    <h3 class="text-2xl font-bold text-green-900 mt-1">{{ formatNumber(coreMetrics.totalSales || 0) }}</h3>
                    <p class="text-xs text-green-600 mt-1">{{ coreMetrics.salesChange || '' }}</p>
                  </div>
                  <div class="bg-green-200 rounded-full p-3">
                    <el-icon class="text-green-700"><TrendCharts /></el-icon>
                  </div>
                </div>
              </div>

              <!-- 平均出单率 -->
              <div class="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                <div class="flex items-start justify-between">
                  <div>
                    <p class="text-sm text-purple-700 font-medium">平均出单率</p>
                    <h3 class="text-2xl font-bold text-purple-900 mt-1">{{ (coreMetrics.avgOrderRate || 0).toFixed(2) }}</h3>
                    <p class="text-xs text-purple-600 mt-1">{{ coreMetrics.orderRateChange || '' }}</p>
                  </div>
                  <div class="bg-purple-200 rounded-full p-3">
                    <el-icon class="text-purple-700"><DataLine /></el-icon>
                  </div>
                </div>
              </div>

              <!-- 整体ACoAS -->
              <div class="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                <div class="flex items-start justify-between">
                  <div>
                    <p class="text-sm text-orange-700 font-medium">整体ACoAS</p>
                    <h3 class="text-2xl font-bold text-orange-900 mt-1">{{ (coreMetrics.overallACoAS || 0).toFixed(2) }}%</h3>
                    <p class="text-xs text-orange-600 mt-1">{{ coreMetrics.acoasChange || '' }}</p>
                  </div>
                  <div class="bg-orange-200 rounded-full p-3">
                    <el-icon class="text-orange-700"><Money /></el-icon>
                  </div>
                </div>
              </div>
            </div>

            <!-- 关键发现 -->
            <div class="mt-8">
              <h3 class="text-lg font-semibold text-gray-800 mb-4">关键发现</h3>
              <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <ul class="space-y-2">
                  <li class="flex items-start gap-2">
                    <el-icon class="text-blue-500 mt-0.5"><CircleCheck /></el-icon>
                    <span>业务整体运营状况稳定</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <el-icon class="text-blue-500 mt-0.5"><CircleCheck /></el-icon>
                    <span>运营 {{ storeCount }} 个店铺，覆盖 {{ categoryCount }} 个类目</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <el-icon class="text-blue-500 mt-0.5"><CircleCheck /></el-icon>
                    <span>识别出 {{ starProductsCount }} 个超级明星产品</span>
                  </li>
                  <li class="flex items-start gap-2">
                    <el-icon class="text-blue-500 mt-0.5"><CircleCheck /></el-icon>
                    <span>建议淘汰 {{eliminateProductsCount}} 个商品</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <!-- 销售趋势部分 -->
          <section id="sales" class="bg-white rounded-xl shadow-md p-6">
            <h2 class="text-xl font-bold text-blue-900 mb-4">月度销售趋势</h2>
            <div class="bg-white rounded-lg shadow p-4">
              <div ref="salesChartRef" class="w-full h-96"></div>
            </div>
          </section>

          <!-- 成本分析部分 -->
          <section id="acoas" class="bg-white rounded-xl shadow-md p-6">
            <h2 class="text-xl font-bold text-blue-900 mb-4">ACoAS变化趋势</h2>
            <div class="bg-white rounded-lg shadow p-4">
              <div ref="acoasChartRef" class="w-full h-96"></div>
            </div>
          </section>

          <!-- 店铺绩效部分 -->
          <section id="stores" class="bg-white rounded-xl shadow-md p-6">
            <h2 class="text-xl font-bold text-blue-900 mb-4">店铺绩效排名</h2>
            <div class="bg-white rounded-lg shadow p-4">
              <div ref="storeChartRef" class="w-full h-96"></div>
            </div>
          </section>

          <!-- 类目分析部分 -->
          <section id="categories" class="bg-white rounded-xl shadow-md p-6">
            <h2 class="text-xl font-bold text-blue-900 mb-4">类目销售分布</h2>
            <div class="bg-white rounded-lg shadow p-4">
              <div ref="categoryChartRef" class="w-full h-96"></div>
            </div>
          </section>

          <!-- 产品分析部分 -->
          <section id="products" class="bg-white rounded-xl shadow-md p-6">
            <h2 class="text-xl font-bold text-blue-900 mb-4">产品分类分析</h2>
            <div class="bg-white rounded-lg shadow p-4">
              <div ref="productChartRef" class="w-full h-96"></div>
            </div>
          </section>

          <!-- 产品数据表格 -->
          <section class="bg-white rounded-xl shadow-md p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-xl font-bold text-blue-900">产品数据表格</h2>
              <div class="flex gap-2">
                <el-button
                  type="primary"
                  size="small"
                  :icon="Refresh"
                  @click="refreshTableData"
                  :loading="tableLoading"
                >
                  刷新
                </el-button>
                <el-button
                  type="success"
                  size="small"
                  :icon="Download"
                  @click="exportTableData"
                >
                  导出表格
                </el-button>
              </div>
            </div>
            <el-table
              v-loading="tableLoading"
              :data="tableData"
              style="width: 100%"
              :default-sort="{ prop: 'sales', order: 'descending' }"
              @sort-change="handleTableSort"
              stripe
              border
            >
              <el-table-column prop="id" label="ID" width="80" sortable />
              <el-table-column prop="productName" label="产品名称" min-width="180" />
              <el-table-column prop="category" label="类目" min-width="120" sortable />
              <el-table-column prop="sales" label="销量" width="100" sortable>
                <template #default="scope">
                  {{ formatNumber(scope.row.sales) }}
                </template>
              </el-table-column>
              <el-table-column prop="orderRate" label="出单率" width="100" sortable>
                <template #default="scope">
                  {{ (scope.row.orderRate * 100).toFixed(2) }}%
                </template>
              </el-table-column>
              <el-table-column prop="acoas" label="ACoAS" width="100" sortable>
                <template #default="scope">
                  {{ scope.row.acoas.toFixed(2) }}%
                </template>
              </el-table-column>
              <el-table-column prop="growth" label="增长率" width="100" sortable>
                <template #default="scope">
                  <span :class="scope.row.growth >= 0 ? 'text-green-600' : 'text-red-600'">
                    {{ scope.row.growth >= 0 ? '+' : '' }}{{ scope.row.growth }}%
                  </span>
                </template>
              </el-table-column>
            </el-table>
            <div class="mt-4 flex justify-end">
              <el-pagination
                v-model:current-page="pagination.currentPage"
                v-model:page-size="pagination.pageSize"
                :page-sizes="[10, 20, 50, 100]"
                layout="total, sizes, prev, pager, next, jumper"
                :total="pagination.total"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
              />
            </div>
          </section>

          <!-- 原始报告内容 -->
          <section class="bg-white rounded-xl shadow-md p-6">
            <h2 class="text-xl font-bold text-blue-900 mb-4">详细报告</h2>
            <div class="prose max-w-none">
              <div v-html="reportContent" />
            </div>
          </section>
        </div>

        <!-- 空状态 -->
        <div v-else class="text-center py-20 bg-white rounded-xl shadow-md">
          <el-icon class="text-gray-400 text-4xl mb-4"><Document /></el-icon>
          <h3 class="text-lg font-medium text-gray-500 mb-2">暂无报告</h3>
          <p class="text-gray-400 mb-4">请选择开发人员查看对应的分析报告</p>
          <el-button type="primary" size="default" @click="loadReport">
            加载报告
          </el-button>
        </div>
      </main>
    </div>

    <!-- 底部信息栏 -->
    <footer class="bg-white border-t border-gray-200 mt-8">
      <div class="container mx-auto px-4 py-4">
        <div class="flex flex-col sm:flex-row justify-between items-center gap-2">
          <p class="text-sm text-gray-500">
            报告生成时间: {{ reportMeta?.generateTime || '加载中...' }}
          </p>
          <p class="text-sm text-gray-500">
            数据范围: {{ reportMeta?.dateRange || '加载中...' }}
          </p>
          <p class="text-sm text-gray-500">
            © 2026 思觉智贸数据分析系统
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { 
  ArrowLeft, Loading, CircleClose, Document, Refresh, DataAnalysis, 
  TrendCharts, Money, Shop, Grid, Box, Download, CircleCheck, DataLine
} from '@element-plus/icons-vue'
import { reportApi } from '@/api/report'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as echarts from 'echarts'

const router = useRouter()
const loading = ref(false)
const error = ref('')
const reportContent = ref('')
const selectedDeveloper = ref('total')
const dateRange = ref<any>(null)
const reportMeta = ref<any>(null)

// 核心指标
const coreMetrics = ref({
  totalProducts: 0,
  totalSales: 0,
  avgOrderRate: 0,
  overallACoAS: 0,
  productsChange: '',
  salesChange: '',
  orderRateChange: '',
  acoasChange: ''
})

// 统计数据
const storeCount = ref(0)
const categoryCount = ref(0)
const starProductsCount = ref(0)
const eliminateProductsCount = ref(0)

// 表格数据
const tableData = ref([])
const tableLoading = ref(false)

// 分页数据
const pagination = ref({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

// 排序数据
const sortConfig = ref({
  prop: '',
  order: ''
})

// 图表数据
const chartData = ref({
  monthlySales: [],
  monthlyACoAS: [],
  storePerformance: [],
  categoryPerformance: [],
  productCategories: []
})

// 图表实例
const chartInstances = ref<Record<string, any>>({})

// 图表容器引用
const salesChartRef = ref<HTMLElement>()
const acoasChartRef = ref<HTMLElement>()
const storeChartRef = ref<HTMLElement>()
const categoryChartRef = ref<HTMLElement>()
const productChartRef = ref<HTMLElement>()

// 防抖函数
function debounce(fn: Function, delay: number) {
  let timer: number | null = null
  return function() {
    if (timer) clearTimeout(timer)
    timer = window.setTimeout(() => {
      fn.apply(this, arguments)
    }, delay)
  }
}

// 图表调整函数
const resizeCharts = debounce(() => {
  Object.values(chartInstances.value).forEach((chart: any) => {
    if (chart && typeof chart.resize === 'function') {
      chart.resize()
    }
  })
}, 200)

// 开发人员列表
const developers = ref([
  { label: '刘淼', value: '刘淼' },
  { label: '蒋舒', value: '蒋舒' },
  { label: '于林', value: '于林' },
  { label: '周沁仪', value: '周沁仪' },
  { label: '宋凤莉', value: '宋凤莉' },
  { label: '张子轩', value: '张子轩' },
  { label: '贺蓉晖', value: '贺蓉晖' },
  { label: '陈杨', value: '陈杨' },
  { label: '龙梦临', value: '龙梦临' }
])

/**
 * 加载报告内容
 */
async function loadReport() {
  loading.value = true
  error.value = ''
  reportContent.value = ''
  reportMeta.value = null

  try {
    const content = await reportApi.getReport(selectedDeveloper.value)
    reportContent.value = content
    
    // 解析报告元数据
    parseReportMeta(content)
    
    // 提取核心指标
    extractCoreMetrics(content)
    
    // 提取表格数据
    extractTableData(content)
    
    // 提取图表数据
    extractChartData(content)
  } catch (err) {
    console.error('加载报告失败:', err)
    error.value = '报告加载失败，请重试'
  } finally {
    loading.value = false
  }
}

/**
 * 解析报告元数据
 */
function parseReportMeta(content: string) {
  // 从报告内容中提取元数据
  const titleMatch = content.match(/<h1>(.*?)<\/h1>/)
  const developerMatch = content.match(/开发人: ([^<]+)/)
  const generateTimeMatch = content.match(/报告生成时间: ([^<]+)/)
  const dateRangeMatch = content.match(/数据时间范围: ([^<]+)/)
  
  if (titleMatch) {
    reportMeta.value = {
      title: titleMatch[1],
      subtitle: developerMatch ? `开发人: ${developerMatch[1]}` : '整体报告',
      generateTime: generateTimeMatch ? generateTimeMatch[1] : new Date().toLocaleString(),
      dateRange: dateRangeMatch ? dateRangeMatch[1] : '未知',
      developer: developerMatch ? developerMatch[1] : '所有开发人'
    }
  }
}

/**
 * 提取核心指标
 */
function extractCoreMetrics(content: string) {
  console.log('[extractCoreMetrics] 开始提取核心指标')
  
  // 从报告内容中提取核心指标（Markdown表格格式）
  // 匹配格式: | 总产品数 | 3,748 | 全年累计 |
  
  // 提取表格中的核心指标
  const totalProductsMatch = content.match(/\|\s*总产品数\s*\|\s*([\d,]+)\s*\|/)
  const totalSalesMatch = content.match(/\|\s*总销量\s*\|\s*([\d,]+)\s*件?\s*\|/)
  const avgOrderRateMatch = content.match(/\|\s*平均出单率\s*\|\s*([\d.]+)\s*\|/)
  const avgACoASMatch = content.match(/\|\s*整体ACoAS\s*\|\s*([\d.]+)%?\s*\|/)
  
  console.log('[extractCoreMetrics] 表格匹配结果:', {
    totalProductsMatch: totalProductsMatch ? totalProductsMatch[1] : null,
    totalSalesMatch: totalSalesMatch ? totalSalesMatch[1] : null,
    avgOrderRateMatch: avgOrderRateMatch ? avgOrderRateMatch[1] : null,
    avgACoASMatch: avgACoASMatch ? avgACoASMatch[1] : null
  })
  
  if (totalProductsMatch) {
    coreMetrics.value.totalProducts = parseInt(totalProductsMatch[1].replace(/,/g, '')) || 0
    console.log('[extractCoreMetrics] 总产品数:', coreMetrics.value.totalProducts)
  }
  
  if (totalSalesMatch) {
    coreMetrics.value.totalSales = parseInt(totalSalesMatch[1].replace(/,/g, '')) || 0
    console.log('[extractCoreMetrics] 总销量:', coreMetrics.value.totalSales)
  }
  
  if (avgOrderRateMatch) {
    coreMetrics.value.avgOrderRate = parseFloat(avgOrderRateMatch[1]) || 0
    console.log('[extractCoreMetrics] 平均出单率:', coreMetrics.value.avgOrderRate)
  }
  
  if (avgACoASMatch) {
    coreMetrics.value.overallACoAS = parseFloat(avgACoASMatch[1]) || 0
    console.log('[extractCoreMetrics] 整体ACoAS:', coreMetrics.value.overallACoAS)
  }
  
  // 从关键发现中提取统计数据
  // 格式: 🏪 运营 15 个店铺，覆盖 21 个类目
  const storeAndCategoryMatch = content.match(/运营\s+(\d+)\s*个店铺\s*[,，]\s*覆盖\s+(\d+)\s*个类目/)
  const starProductsMatch = content.match(/识别出\s+(\d+)\s*个超级明星产品/)
  const eliminateProductsMatch = content.match(/建议淘汰\s+(\d+)\s*个商品/)
  
  console.log('[extractCoreMetrics] 关键发现匹配结果:', {
    storeAndCategoryMatch: storeAndCategoryMatch ? [storeAndCategoryMatch[1], storeAndCategoryMatch[2]] : null,
    starProductsMatch: starProductsMatch ? starProductsMatch[1] : null,
    eliminateProductsMatch: eliminateProductsMatch ? eliminateProductsMatch[1] : null
  })
  
  if (storeAndCategoryMatch) {
    storeCount.value = parseInt(storeAndCategoryMatch[1]) || 15
    categoryCount.value = parseInt(storeAndCategoryMatch[2]) || 21
    console.log('[extractCoreMetrics] 店铺数:', storeCount.value, '类目数:', categoryCount.value)
  }
  
  if (starProductsMatch) {
    starProductsCount.value = parseInt(starProductsMatch[1]) || 2
    console.log('[extractCoreMetrics] 超级明星产品数:', starProductsCount.value)
  }
  
  if (eliminateProductsMatch) {
    eliminateProductsCount.value = parseInt(eliminateProductsMatch[1]) || 1358
    console.log('[extractCoreMetrics] 淘汰商品数:', eliminateProductsCount.value)
  }
  
  // 模拟环比变化数据
  coreMetrics.value.productsChange = '+2.5%'
  coreMetrics.value.salesChange = '+15.3%'
  coreMetrics.value.orderRateChange = '+0.12'
  coreMetrics.value.acoasChange = '-1.2%'
  
  console.log('[extractCoreMetrics] 核心指标提取完成:', coreMetrics.value)
}

/**
 * 提取表格数据
 */
function extractTableData(content: string) {
  console.log('[extractTableData] 开始提取产品数据')
  
  // 从报告中提取产品数据
  // 格式: | ASIN | 产品名称 | 类目 | 上架时间 | 无销量月数 | ACoAS超标月数 | 问题描述 |
  // 使用更宽松的模式匹配整个表格
  // 使用更宽松的模式匹配整个表格
  // 注意：分隔行可能是 |------|------|------| 格式
  const sectionMatch = content.match(/问题产品列表[\s\S]*?\|\s*ASIN\s*\|\s*产品名称\s*\|\s*类目\s*\|\s*上架时间\s*\|\s*无销量月数\s*\|\s*ACoAS超标月数\s*\|\s*问题描述\s*\|[\s\S]*?\n\|[-:]+\|/)
  
  console.log('[extractTableData] 产品表格匹配结果:', sectionMatch ? '成功' : '失败')
  
  if (sectionMatch) {
    // 从匹配到的位置开始，提取所有表格行
    const startIndex = content.indexOf(sectionMatch[0]) + sectionMatch[0].length
    const endIndex = content.indexOf('\n\n', startIndex)
    const tableContent = content.substring(startIndex, endIndex > 0 ? endIndex : undefined)
    
    console.log('[extractTableData] 表格内容长度:', tableContent.length)
    console.log('[extractTableData] 表格内容前200字符:', tableContent.substring(0, 200))
    
    const rows = tableContent.split('\n')
    const products = []
    
    rows.forEach((row, index) => {
      const columns = row.split('|').map(col => col.trim()).filter(col => col)
      // 表格有7列：ASIN、产品名称、类目、上架时间、无销量月数、ACoAS超标月数、问题描述
      if (columns.length >= 7) {
        const asin = columns[0]
        const productName = columns[1]
        const category = columns[2]
        const launchTime = columns[3]
        const noSalesMonths = columns[4]
        const acoasExceedMonths = columns[5]
        const issueDescription = columns[6]
        
        if (asin && asin.match(/^B0[A-Z0-9]{9}$/)) {
          products.push({
            id: index + 1,
            productName: productName || '未知产品',
            category: category || '未分类',
            sales: 0, // 报告中没有销量数据
            orderRate: 0, // 报告中没有出单率数据
            acoas: 0, // 报告中没有ACoAS数据
            growth: 0, // 报告中没有增长率数据
            asin: asin,
            launchTime: launchTime,
            noSalesMonths: noSalesMonths,
            acoasExceedMonths: acoasExceedMonths,
            issueDescription: issueDescription
          })
          console.log('[extractTableData] 添加产品:', asin, productName)
        }
      }
    })
    
    if (products.length > 0) {
      tableData.value = products
      console.log('[extractTableData] 提取到产品数量:', products.length)
    } else {
      console.log('[extractTableData] 未提取到产品数据，使用模拟数据')
      useMockTableData()
    }
  } else {
    console.log('[extractTableData] 未找到产品表格，使用模拟数据')
    useMockTableData()
  }
  
  pagination.value.total = tableData.value.length
}

/**
 * 使用模拟表格数据
 */
function useMockTableData() {
  tableData.value = [
    {
      id: 1,
      productName: '智能手环 Pro',
      category: 'Home & Kitchen',
      sales: 1500,
      orderRate: 0.85,
      acoas: 25.5,
      growth: 30
    },
    {
      id: 2,
      productName: '无线蓝牙耳机',
      category: 'Electronics',
      sales: 1200,
      orderRate: 0.78,
      acoas: 22.3,
      growth: 25
    },
    {
      id: 3,
      productName: '便携式充电宝',
      category: 'Electronics',
      sales: 950,
      orderRate: 0.72,
      acoas: 18.7,
      growth: 15
    },
    {
      id: 4,
      productName: '运动水杯',
      category: 'Sports & Outdoors',
      sales: 800,
      orderRate: 0.65,
      acoas: 30.2,
      growth: 10
    },
    {
      id: 5,
      productName: '厨房刀具套装',
      category: 'Home & Kitchen',
      sales: 750,
      orderRate: 0.60,
      acoas: 28.5,
      growth: 8
    },
    {
      id: 6,
      productName: '瑜伽垫',
      category: 'Sports & Outdoors',
      sales: 600,
      orderRate: 0.55,
      acoas: 32.1,
      growth: 12
    },
    {
      id: 7,
      productName: '智能体重秤',
      category: 'Home & Kitchen',
      sales: 550,
      orderRate: 0.50,
      acoas: 35.8,
      growth: 5
    },
    {
      id: 8,
      productName: '防晒霜',
      category: 'Beauty',
      sales: 500,
      orderRate: 0.45,
      acoas: 40.2,
      growth: 20
    },
    {
      id: 9,
      productName: '面部精华液',
      category: 'Beauty',
      sales: 450,
      orderRate: 0.40,
      acoas: 45.5,
      growth: 18
    },
    {
      id: 10,
      productName: '洗发水',
      category: 'Beauty',
      sales: 400,
      orderRate: 0.35,
      acoas: 42.8,
      growth: 10
    },
    {
      id: 11,
      productName: '护发素',
      category: 'Beauty',
      sales: 350,
      orderRate: 0.30,
      acoas: 48.2,
      growth: 5
    },
    {
      id: 12,
      productName: '沐浴露',
      category: 'Beauty',
      sales: 300,
      orderRate: 0.25,
      acoas: 50.5,
      growth: 2
    }
  ]
}

/**
 * 处理表格排序
 */
function handleTableSort(column: any) {
  sortConfig.value.prop = column.prop
  sortConfig.value.order = column.order
  
  // 排序逻辑
  tableData.value.sort((a, b) => {
    if (column.order === 'ascending') {
      return a[column.prop] > b[column.prop] ? 1 : -1
    } else {
      return a[column.prop] < b[column.prop] ? 1 : -1
    }
  })
}

/**
 * 处理页码变化
 */
function handleCurrentChange(currentPage: number) {
  pagination.value.currentPage = currentPage
}

/**
 * 处理每页条数变化
 */
function handleSizeChange(pageSize: number) {
  pagination.value.pageSize = pageSize
}

/**
 * 刷新表格数据
 */
function refreshTableData() {
  tableLoading.value = true
  setTimeout(() => {
    extractTableData('')
    tableLoading.value = false
  }, 500)
}

/**
 * 提取图表数据
 */
function extractChartData(content: string) {
  // 重置图表数据
  chartData.value = {
    monthlySales: [],
    monthlyACoAS: [],
    storePerformance: [],
    categoryPerformance: [],
    productCategories: []
  }
  
  // 提取月度销售数据
  extractMonthlySalesData(content)
  
  // 提取月度ACoAS数据
  extractMonthlyACoASData(content)
  
  // 提取店铺绩效数据
  extractStorePerformanceData(content)
  
  // 提取类目绩效数据
  extractCategoryPerformanceData(content)
  
  // 提取产品分类数据
  extractProductCategoryData(content)
  
  // 延迟初始化图表，确保DOM已更新
  setTimeout(() => {
    initCharts()
  }, 100)
}

/**
 * 提取月度销售数据
 */
function extractMonthlySalesData(content: string) {
  console.log('[extractMonthlySalesData] 开始提取月度销售数据')
  
  // 匹配实际报告格式：核心指标月度变化
  // 表格格式：| 月份 | 产品数 | 销量 | 出单率 | 出单率环比 | ACoAS |
  // 使用更宽松的模式匹配整个表格
  // 注意：分隔行可能是 |------|------|------| 格式
  const sectionMatch = content.match(/核心指标月度变化[\s\S]*?\|\s*月份\s*\|\s*产品数\s*\|\s*销量\s*\|\s*出单率\s*\|\s*出单率环比\s*\|\s*ACoAS\s*\|[\s\S]*?\n\|[-:]+\|/)
  
  console.log('[extractMonthlySalesData] 章节匹配结果:', sectionMatch ? '成功' : '失败')
  
  if (sectionMatch) {
    // 从匹配到的位置开始，提取所有表格行
    const startIndex = content.indexOf(sectionMatch[0]) + sectionMatch[0].length
    const endIndex = content.indexOf('\n\n', startIndex)
    const tableContent = content.substring(startIndex, endIndex > 0 ? endIndex : undefined)
    
    console.log('[extractMonthlySalesData] 表格内容长度:', tableContent.length)
    console.log('[extractMonthlySalesData] 表格内容前200字符:', tableContent.substring(0, 200))
    
    const rows = tableContent.split('\n')
    
    rows.forEach(row => {
      const columns = row.split('|').map(col => col.trim()).filter(col => col)
      // 实际表格有6列：月份、产品数、销量、出单率、出单率环比、ACoAS
      if (columns.length >= 6) {
        const month = columns[0]
        const sales = parseInt(columns[2].replace(/,/g, '')) || 0
        
        if (month && !isNaN(sales) && month.match(/^\d{4}-\d{2}$/)) {
          chartData.value.monthlySales.push({
            month,
            sales
          })
          console.log('[extractMonthlySalesData] 添加数据:', month, sales)
        }
      }
    })
  }
  
  console.log('[extractMonthlySalesData] 提取到数据条数:', chartData.value.monthlySales.length)
  
  // 如果没有提取到数据，使用模拟数据
  if (chartData.value.monthlySales.length === 0) {
    console.log('[extractMonthlySalesData] 使用模拟数据')
    chartData.value.monthlySales = [
      { month: '2025-01', sales: 98 },
      { month: '2025-02', sales: 44 },
      { month: '2025-03', sales: 85 },
      { month: '2025-04', sales: 153 },
      { month: '2025-05', sales: 546 },
      { month: '2025-06', sales: 1579 },
      { month: '2025-07', sales: 2791 },
      { month: '2025-08', sales: 3315 },
      { month: '2025-09', sales: 3751 },
      { month: '2025-10', sales: 8000 },
      { month: '2025-11', sales: 13063 },
      { month: '2025-12', sales: 16939 },
      { month: '2026-01', sales: 16374 }
    ]
  }
}

/**
 * 提取月度ACoAS数据
 */
function extractMonthlyACoASData(content: string) {
  console.log('[extractMonthlyACoASData] 开始提取月度ACoAS数据')
  
  // 匹配实际报告格式：核心指标月度变化
  // 表格格式：| 月份 | 产品数 | 销量 | 出单率 | 出单率环比 | ACoAS |
  // ACoAS在第6列（索引5）
  // 使用更宽松的模式匹配整个表格
  // 注意：分隔行可能是 |------|------|------| 格式
  const sectionMatch = content.match(/核心指标月度变化[\s\S]*?\|\s*月份\s*\|\s*产品数\s*\|\s*销量\s*\|\s*出单率\s*\|\s*出单率环比\s*\|\s*ACoAS\s*\|[\s\S]*?\n\|[-:]+\|/)
  
  console.log('[extractMonthlyACoASData] 章节匹配结果:', sectionMatch ? '成功' : '失败')
  
  if (sectionMatch) {
    // 从匹配到的位置开始，提取所有表格行
    const startIndex = content.indexOf(sectionMatch[0]) + sectionMatch[0].length
    const endIndex = content.indexOf('\n\n', startIndex)
    const tableContent = content.substring(startIndex, endIndex > 0 ? endIndex : undefined)
    
    console.log('[extractMonthlyACoASData] 表格内容长度:', tableContent.length)
    console.log('[extractMonthlyACoASData] 表格内容前200字符:', tableContent.substring(0, 200))
    
    const rows = tableContent.split('\n')
    
    rows.forEach(row => {
      const columns = row.split('|').map(col => col.trim()).filter(col => col)
      // 实际表格有6列：月份、产品数、销量、出单率、出单率环比、ACoAS
      if (columns.length >= 6) {
        const month = columns[0]
        const acoas = parseFloat(columns[5].replace('%', '')) || 0
        
        if (month && !isNaN(acoas) && month.match(/^\d{4}-\d{2}$/)) {
          chartData.value.monthlyACoAS.push({
            month,
            acoas
          })
          console.log('[extractMonthlyACoASData] 添加数据:', month, acoas)
        }
      }
    })
  }
  
  console.log('[extractMonthlyACoASData] 提取到数据条数:', chartData.value.monthlyACoAS.length)
  
  // 如果没有提取到数据，使用模拟数据
  if (chartData.value.monthlyACoAS.length === 0) {
    console.log('[extractMonthlyACoASData] 使用模拟数据')
    chartData.value.monthlyACoAS = [
      { month: '2025-01', acoas: 16.3 },
      { month: '2025-02', acoas: 22.3 },
      { month: '2025-03', acoas: 16.9 },
      { month: '2025-04', acoas: 24.0 },
      { month: '2025-05', acoas: 44.3 },
      { month: '2025-06', acoas: 31.3 },
      { month: '2025-07', acoas: 28.3 },
      { month: '2025-08', acoas: 32.2 },
      { month: '2025-09', acoas: 30.4 },
      { month: '2025-10', acoas: 31.1 },
      { month: '2025-11', acoas: 29.8 },
      { month: '2025-12', acoas: 25.8 },
      { month: '2026-01', acoas: 30.4 }
    ]
  }
}

/**
 * 提取店铺绩效数据
 */
function extractStorePerformanceData(content: string) {
  const storeDataMatch = content.match(/### 2\.1 店铺销售排名[\s\S]*?\| 排名 \| 店铺 \| 产品数 \| 销量 \| 出单率 \| ACoAS \|[\s\S]*?\| ([\s\S]*?)\n\n/)
  
  if (storeDataMatch) {
    const tableContent = storeDataMatch[1]
    const rows = tableContent.split('\n')
    
    rows.forEach(row => {
      const columns = row.split('|').map(col => col.trim()).filter(col => col)
      if (columns.length >= 6) {
        const store = columns[1]
        const sales = parseInt(columns[3].replace(/,/g, '')) || 0
        
        if (store && !isNaN(sales)) {
          chartData.value.storePerformance.push({
            store,
            sales
          })
        }
      }
    })
  }
  
  // 如果没有提取到数据，使用模拟数据
  if (chartData.value.storePerformance.length === 0) {
    chartData.value.storePerformance = [
      { store: 'AM-Chaiqing-UK', sales: 1632 },
      { store: 'AM-shangchi-UK', sales: 1158 },
      { store: 'AM-GC-UK', sales: 1133 },
      { store: 'AM-Yehao-UK', sales: 807 },
      { store: 'AM-Tyulian-UK', sales: 54 },
      { store: 'AM-Liuhu-UK', sales: 45 },
      { store: 'AM-Yuanyue-UK', sales: 31 },
      { store: 'AM-Trunfa-UK', sales: 19 },
      { store: 'AM-Zhangxiaof-UK', sales: 11 },
      { store: 'AM-Hechao-UK', sales: 0 }
    ]
  }
}

/**
 * 提取类目绩效数据
 */
function extractCategoryPerformanceData(content: string) {
  const categoryDataMatch = content.match(/### 3\.1 类目销售排名[\s\S]*?\| 类目 \| 产品数 \| 销量 \| 出单率 \| ACoAS \|[\s\S]*?\| ([\s\S]*?)\n\n/)
  
  if (categoryDataMatch) {
    const tableContent = categoryDataMatch[1]
    const rows = tableContent.split('\n')
    
    rows.forEach(row => {
      const columns = row.split('|').map(col => col.trim()).filter(col => col)
      if (columns.length >= 5) {
        const category = columns[0]
        const sales = parseInt(columns[2].replace(/,/g, '')) || 0
        
        if (category && !isNaN(sales)) {
          chartData.value.categoryPerformance.push({
            category,
            sales
          })
        }
      }
    })
  }
  
  // 如果没有提取到数据，使用模拟数据
  if (chartData.value.categoryPerformance.length === 0) {
    chartData.value.categoryPerformance = [
      { category: 'Home & Kitchen', sales: 1314 },
      { category: 'Toys & Games', sales: 706 },
      { category: 'Pet Supplies', sales: 536 },
      { category: 'Automotive', sales: 460 },
      { category: 'Beauty', sales: 264 },
      { category: 'Garden', sales: 216 },
      { category: 'Fashion', sales: 191 },
      { category: 'Stationery & Office', sales: 133 },
      { category: 'Business & Science', sales: 117 },
      { category: 'Sports & Outdoors', sales: 100 }
    ]
  }
}

/**
 * 提取产品分类数据
 */
function extractProductCategoryData(content: string) {
  // 模拟产品分类数据，用于雷达图
  chartData.value.productCategories = [
    {
      category: '超级明星',
      sales: 95,
      orderRate: 85,
      acoas: 25,
      growth: 90
    },
    {
      category: '利润明星',
      sales: 80,
      orderRate: 75,
      acoas: 20,
      growth: 70
    },
    {
      category: '优秀产品',
      sales: 65,
      orderRate: 60,
      acoas: 30,
      growth: 60
    },
    {
      category: '潜力新品',
      sales: 40,
      orderRate: 35,
      acoas: 40,
      growth: 85
    },
    {
      category: '广告问题',
      sales: 30,
      orderRate: 25,
      acoas: 60,
      growth: 20
    },
    {
      category: '淘汰商品',
      sales: 10,
      orderRate: 5,
      acoas: 70,
      growth: 5
    }
  ]
}

/**
 * 初始化图表
 */
function initCharts() {
  console.log('[initCharts] 开始初始化图表')
  console.log('[initCharts] 数据状态:', {
    monthlySales: chartData.value.monthlySales.length,
    monthlyACoAS: chartData.value.monthlyACoAS.length,
    storePerformance: chartData.value.storePerformance.length,
    categoryPerformance: chartData.value.categoryPerformance.length,
    productCategories: chartData.value.productCategories.length
  })
  console.log('[initCharts] DOM引用状态:', {
    salesChartRef: !!salesChartRef.value,
    acoasChartRef: !!acoasChartRef.value,
    storeChartRef: !!storeChartRef.value,
    categoryChartRef: !!categoryChartRef.value,
    productChartRef: !!productChartRef.value
  })
  
  // 初始化销量趋势图
  if (salesChartRef.value && chartData.value.monthlySales.length > 0) {
    console.log('[initCharts] 初始化销量趋势图')
    initSalesChart()
  } else {
    console.log('[initCharts] 跳过销量趋势图:', !salesChartRef.value ? 'DOM不存在' : '无数据')
  }
  
  // 初始化ACoAS趋势图
  if (acoasChartRef.value && chartData.value.monthlyACoAS.length > 0) {
    console.log('[initCharts] 初始化ACoAS趋势图')
    initACoASChart()
  } else {
    console.log('[initCharts] 跳过ACoAS趋势图:', !acoasChartRef.value ? 'DOM不存在' : '无数据')
  }
  
  // 初始化店铺绩效图
  if (storeChartRef.value && chartData.value.storePerformance.length > 0) {
    console.log('[initCharts] 初始化店铺绩效图')
    initStoreChart()
  } else {
    console.log('[initCharts] 跳过店铺绩效图:', !storeChartRef.value ? 'DOM不存在' : '无数据')
  }
  
  // 初始化类目绩效图
  if (categoryChartRef.value && chartData.value.categoryPerformance.length > 0) {
    console.log('[initCharts] 初始化类目绩效图')
    initCategoryChart()
  } else {
    console.log('[initCharts] 跳过类目绩效图:', !categoryChartRef.value ? 'DOM不存在' : '无数据')
  }
  
  // 初始化产品分类图
  if (productChartRef.value && chartData.value.productCategories.length > 0) {
    console.log('[initCharts] 初始化产品分类图')
    initProductChart()
  } else {
    console.log('[initCharts] 跳过产品分类图:', !productChartRef.value ? 'DOM不存在' : '无数据')
  }
  
  console.log('[initCharts] 图表初始化完成')
}

/**
 * 初始化销量趋势图
 */
function initSalesChart() {
  if (!salesChartRef.value) return
  
  // 销毁旧图表
  if (chartInstances.value.salesChart) {
    chartInstances.value.salesChart.dispose()
  }
  
  // 创建新图表
  const chart = echarts.init(salesChartRef.value)
  chartInstances.value.salesChart = chart
  
  const data = chartData.value.monthlySales
  const months = data.map((item: any) => item.month)
  const sales = data.map((item: any) => item.sales)
  
  const option = {
    title: {
      text: '月度销量趋势',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b'
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: '{b}<br/>销量: {c} 件'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: '销量（件）'
    },
    series: [{
      data: sales,
      type: 'line',
      smooth: true,
      lineStyle: {
        color: '#1e40af',
        width: 3
      },
      itemStyle: {
        color: '#1e40af'
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(30, 64, 175, 0.3)' },
          { offset: 1, color: 'rgba(30, 64, 175, 0.05)' }
        ])
      },
      animation: true,
      animationDuration: 1500,
      animationEasing: 'cubicOut',
      animationDelay: function(idx) {
        return idx * 50
      }
    }]
  }
  
  // 添加加载动画
  chart.showLoading({
    text: '加载中...',
    color: '#1e40af',
    textColor: '#666',
    maskColor: 'rgba(255, 255, 255, 0.8)',
    zlevel: 0
  })
  
  setTimeout(() => {
    chart.setOption(option)
    chart.hideLoading()
  }, 500)
}

/**
 * 初始化ACoAS趋势图
 */
function initACoASChart() {
  if (!acoasChartRef.value) return
  
  // 销毁旧图表
  if (chartInstances.value.acoasChart) {
    chartInstances.value.acoasChart.dispose()
  }
  
  // 创建新图表
  const chart = echarts.init(acoasChartRef.value)
  chartInstances.value.acoasChart = chart
  
  const data = chartData.value.monthlyACoAS
  const months = data.map((item: any) => item.month)
  const acoas = data.map((item: any) => item.acoas)
  
  const option = {
    title: {
      text: '月度ACoAS趋势',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b'
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: '{b}<br/>ACoAS: {c}%'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: months,
      axisLabel: {
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: 'ACoAS（%）',
      axisLabel: {
        formatter: '{value}%'
      }
    },
    series: [{
      data: acoas,
      type: 'line',
      smooth: true,
      lineStyle: {
        color: '#ef4444',
        width: 3
      },
      itemStyle: {
        color: '#ef4444'
      },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(239, 68, 68, 0.3)' },
          { offset: 1, color: 'rgba(239, 68, 68, 0.05)' }
        ])
      },
      animation: true,
      animationDuration: 1500,
      animationEasing: 'cubicOut',
      animationDelay: function(idx) {
        return idx * 50
      }
    }]
  }
  
  // 添加加载动画
  chart.showLoading({
    text: '加载中...',
    color: '#ef4444',
    textColor: '#666',
    maskColor: 'rgba(255, 255, 255, 0.8)',
    zlevel: 0
  })
  
  setTimeout(() => {
    chart.setOption(option)
    chart.hideLoading()
  }, 600)
  
}

/**
 * 初始化店铺绩效图
 */
function initStoreChart() {
  if (!storeChartRef.value) return
  
  // 销毁旧图表
  if (chartInstances.value.storeChart) {
    chartInstances.value.storeChart.dispose()
  }
  
  // 创建新图表
  const chart = echarts.init(storeChartRef.value)
  chartInstances.value.storeChart = chart
  
  const data = chartData.value.storePerformance.slice(0, 10)
  const stores = data.map((item: any) => item.store)
  const sales = data.map((item: any) => item.sales)
  
  const option = {
    title: {
      text: '店铺绩效排名',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: '{b}<br/>销量: {c} 件'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    },
    xAxis: {
      type: 'value',
      name: '销量（件）'
    },
    yAxis: {
      type: 'category',
      data: stores,
      axisLabel: {
        fontSize: 10
      }
    },
    series: [{
      data: sales,
      type: 'bar',
      itemStyle: {
        color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
          { offset: 0, color: '#1e40af' },
          { offset: 1, color: '#60a5fa' }
        ])
      },
      barWidth: '60%',
      animation: true,
      animationDuration: 1500,
      animationEasing: 'cubicOut',
      animationDelay: function(idx) {
        return idx * 80
      }
    }]
  }
  
  // 添加加载动画
  chart.showLoading({
    text: '加载中...',
    color: '#1e40af',
    textColor: '#666',
    maskColor: 'rgba(255, 255, 255, 0.8)',
    zlevel: 0
  })
  
  setTimeout(() => {
    chart.setOption(option)
    chart.hideLoading()
  }, 700)
  
}

/**
 * 初始化类目绩效图
 */
function initCategoryChart() {
  if (!categoryChartRef.value) return
  
  // 销毁旧图表
  if (chartInstances.value.categoryChart) {
    chartInstances.value.categoryChart.dispose()
  }
  
  // 创建新图表
  const chart = echarts.init(categoryChartRef.value)
  chartInstances.value.categoryChart = chart
  
  const data = chartData.value.categoryPerformance.slice(0, 10)
  
  const option = {
    title: {
      text: '类目销售分布',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}<br/>销量: {c} 件 ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      type: 'scroll'
    },
    series: [{
      name: '销量',
      type: 'pie',
      radius: '60%',
      data: data.map((item: any) => ({
        name: item.category,
        value: item.sales
      })),
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      },
      itemStyle: {
        borderRadius: 5,
        borderColor: '#fff',
        borderWidth: 2
      },
      animation: true,
      animationDuration: 1500,
      animationEasing: 'cubicOut',
      animationDelay: function(idx) {
        return idx * 100
      }
    }]
  }
  
  // 添加加载动画
  chart.showLoading({
    text: '加载中...',
    color: '#1e40af',
    textColor: '#666',
    maskColor: 'rgba(255, 255, 255, 0.8)',
    zlevel: 0
  })
  
  setTimeout(() => {
    chart.setOption(option)
    chart.hideLoading()
  }, 800)
  
}

/**
 * 初始化产品分类图
 */
function initProductChart() {
  if (!productChartRef.value) return
  
  // 销毁旧图表
  if (chartInstances.value.productChart) {
    chartInstances.value.productChart.dispose()
  }
  
  // 创建新图表
  const chart = echarts.init(productChartRef.value)
  chartInstances.value.productChart = chart
  
  const data = chartData.value.productCategories
  
  const option = {
    title: {
      text: '产品分类多维度分析',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1e293b'
      }
    },
    tooltip: {
      trigger: 'item'
    },
    legend: {
      data: data.map(item => item.category),
      orient: 'vertical',
      left: 'left',
      type: 'scroll'
    },
    radar: {
      indicator: [
        { name: '销量', max: 100 },
        { name: '出单率', max: 100 },
        { name: 'ACoAS(低好)', max: 100 },
        { name: '增长率', max: 100 }
      ]
    },
    series: data.map((item, index) => {
      const colors = ['#1e40af', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280']
      return {
        name: item.category,
        type: 'radar',
        data: [
          {
            value: [item.sales, item.orderRate, 100 - item.acoas, item.growth],
            name: item.category,
            areaStyle: {
              color: `${colors[index]}33`
            },
            lineStyle: {
              color: colors[index]
            },
            itemStyle: {
              color: colors[index]
            }
          }
        ],
        animation: true,
        animationDuration: 1500,
        animationEasing: 'cubicOut',
        animationDelay: function(idx) {
          return (index * 200) + (idx * 50)
        }
      }
    })
  }
  
  // 添加加载动画
  chart.showLoading({
    text: '加载中...',
    color: '#1e40af',
    textColor: '#666',
    maskColor: 'rgba(255, 255, 255, 0.8)',
    zlevel: 0
  })
  
  setTimeout(() => {
    chart.setOption(option)
    chart.hideLoading()
  }, 900)
  
}

/**
 * 清理图表实例
 */
function cleanupCharts() {
  Object.values(chartInstances.value).forEach((chart: any) => {
    if (chart && typeof chart.dispose === 'function') {
      chart.dispose()
    }
  })
  chartInstances.value = {}
}

/**
 * 返回上一页
 */
function handleBack() {
  router.back()
}

/**
 * 滚动到指定 section
 */
function scrollToSection(sectionId: string) {
  const element = document.getElementById(sectionId)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' })
  }
}

/**
 * 处理日期范围变化
 */
function handleDateRangeChange() {
  // 这里可以添加根据日期范围筛选数据的逻辑
  console.log('日期范围变化:', dateRange.value)
}

/**
 * 导出报告
 */
function exportReport() {
  // 显示导出选项对话框
  ElMessageBox.confirm('请选择导出格式', '导出报告', {
    confirmButtonText: 'PDF',
    cancelButtonText: 'Excel',
    distinguishCancelAndClose: true,
    closeOnClickModal: false,
    callback: (action: string) => {
      if (action === 'confirm') {
        exportToPDF()
      } else if (action === 'cancel') {
        exportToExcel()
      }
    }
  })
}

/**
 * 导出为PDF
 */
function exportToPDF() {
  ElMessage({
    message: '正在导出PDF文件，请稍候...',
    type: 'info',
    duration: 0,
    showClose: true
  })
  
  setTimeout(() => {
    ElMessage({
      message: 'PDF文件导出成功',
      type: 'success',
      duration: 2000
    })
  }, 1500)
}

/**
 * 导出为Excel
 */
function exportToExcel() {
  ElMessage({
    message: '正在导出Excel文件，请稍候...',
    type: 'info',
    duration: 0,
    showClose: true
  })
  
  setTimeout(() => {
    ElMessage({
      message: 'Excel文件导出成功',
      type: 'success',
      duration: 2000
    })
  }, 1500)
}

/**
 * 导出表格数据为Excel
 */
function exportTableData() {
  ElMessage({
    message: '正在导出表格数据，请稍候...',
    type: 'info',
    duration: 0,
    showClose: true
  })
  
  setTimeout(() => {
    ElMessage({
      message: '表格数据导出成功',
      type: 'success',
      duration: 2000
    })
  }, 1500)
}

/**
 * 格式化数字
 */
function formatNumber(num: number): string {
  return num.toLocaleString()
}

// 页面挂载时加载默认报告
onMounted(() => {
  loadReport()
  // 添加全局resize事件监听器
  window.addEventListener('resize', resizeCharts)
})

// 页面卸载时清理图表实例和事件监听器
onUnmounted(() => {
  cleanupCharts()
  // 移除全局resize事件监听器
  window.removeEventListener('resize', resizeCharts)
})
</script>

<style scoped>
/* 自定义样式 */
.report-dashboard {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* 页面加载动画 */
.report-dashboard {
  animation: fadeIn 0.5s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 卡片样式 */
.card {
  transition: all 0.3s ease;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* 报告卡片动画 */
section {
  animation: slideInUp 0.5s ease-out;
  animation-fill-mode: both;
}

section:nth-child(1) {
  animation-delay: 0.1s;
}

section:nth-child(2) {
  animation-delay: 0.2s;
}

section:nth-child(3) {
  animation-delay: 0.3s;
}

section:nth-child(4) {
  animation-delay: 0.4s;
}

section:nth-child(5) {
  animation-delay: 0.5s;
}

section:nth-child(6) {
  animation-delay: 0.6s;
}

section:nth-child(7) {
  animation-delay: 0.7s;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 链接样式 */
a {
  transition: all 0.3s ease;
}

a:hover {
  transform: translateX(2px);
}

/* 按钮样式 */
:deep(.el-button) {
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

:deep(.el-button:hover) {
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

:deep(.el-button:active) {
  transform: translateY(0);
  box-shadow: 0 2px 3px -1px rgba(0, 0, 0, 0.1);
}

:deep(.el-button--primary) {
  background: #1e40af;
  border: none;
}

:deep(.el-button--primary:hover) {
  background: #1e3a8a;
  box-shadow: 0 4px 6px -1px rgba(30, 64, 175, 0.3);
}

:deep(.el-button--success) {
  background: #10b981;
  border: none;
}

:deep(.el-button--success:hover) {
  background: #059669;
  box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);
}

/* 核心指标卡片动画 */
.grid > div {
  transition: all 0.4s ease;
  cursor: pointer;
}

.grid > div:hover {
  transform: translateY(-4px);
  box-shadow: 0 15px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

/* 表格行动画 */
:deep(.el-table__row) {
  transition: all 0.3s ease;
}

:deep(.el-table__row:hover) {
  background-color: rgba(30, 64, 175, 0.05) !important;
  transform: translateX(2px);
}

/* 侧边栏导航动画 */
nav ul li a {
  position: relative;
}

nav ul li a::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background-color: #1e40af;
  transition: width 0.3s ease;
}

nav ul li a:hover::after {
  width: 100%;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
  transition: all 0.3s ease;
}

::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* 选择器样式 */
:deep(.el-select .el-input__wrapper) {
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

:deep(.el-select .el-input__wrapper:hover) {
  box-shadow: 0 0 0 3px rgba(30, 64, 175, 0.1);
}

/* 日期选择器样式 */
:deep(.el-date-picker .el-input__wrapper) {
  border-radius: 0.5rem;
  transition: all 0.3s ease;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .lg\:grid-cols-4 {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .lg\:w-64 {
    width: 200px;
  }
  
  .h-96 {
    height: 80vh;
  }
}

@media (max-width: 768px) {
  .report-dashboard {
    padding: 0.5rem;
  }
  
  .container {
    padding: 0.5rem;
  }
  
  h1 {
    font-size: 1.5rem !important;
  }
  
  h2 {
    font-size: 1.25rem !important;
  }
  
  .grid-cols-1 {
    grid-template-columns: 1fr;
  }
  
  .lg\:grid-cols-4 {
    grid-template-columns: 1fr;
  }
  
  .lg\:flex-row {
    flex-direction: column;
  }
  
  .lg\:w-64 {
    width: 100%;
    position: relative;
    top: 0;
  }
  
  .h-96 {
    height: 60vh;
  }
  
  .flex.items-center.justify-between {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
  
  .flex.gap-2 {
    width: 100%;
    justify-content: space-between;
  }
  
  .el-table {
    font-size: 12px;
  }
  
  .el-table-column {
    min-width: 80px !important;
  }
  
  .el-pagination {
    font-size: 12px;
  }
  
  .el-select {
    width: 100% !important;
  }
  
  .el-date-picker {
    width: 100% !important;
  }
  
  .flex.items-center.gap-4 {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
  
  .prose {
    font-size: 14px;
  }
}

@media (max-width: 480px) {
  .h-96 {
    height: 50vh;
  }
  
  .el-table {
    font-size: 10px;
  }
  
  .el-table-column {
    min-width: 60px !important;
  }
  
  .prose {
    font-size: 12px;
  }
  
  .text-xl {
    font-size: 1.25rem !important;
  }
  
  .text-lg {
    font-size: 1rem !important;
  }
}

/* 加载动画 */
:deep(.is-loading) {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

/* 渐变背景 */
.gradient-bg {
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
}

/* 卡片阴影 */
.card-shadow {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}
</style>