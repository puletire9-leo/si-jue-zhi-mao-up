/**
 * 产品数据业务逻辑Composable
 */
import { computed, ref } from 'vue'
import { useProductDataStore } from '../../../stores/productData'
import type { ProductListParams } from '../../../types/productData'

export function useProductData() {
  const store = useProductDataStore()
  
  // 分页状态
  const currentPage = ref(1)
  const pageSize = ref(10)
  const sortField = ref('sales_volume')
  const sortOrder = ref<'asc' | 'desc'>('desc')
  
  // 计算属性
  const products = computed(() => store.productList)
  const total = computed(() => store.productTotal)
  const loading = computed(() => store.loading.products)
  
  // 加载产品列表
  async function loadProducts() {
    const params: ProductListParams = {
      page: currentPage.value,
      pageSize: pageSize.value,
      sortField: sortField.value,
      sortOrder: sortOrder.value
    }
    await store.fetchProductList(params)
  }
  
  // 处理分页变化
  function handlePageChange(page: number) {
    currentPage.value = page
    loadProducts()
  }
  
  // 处理每页条数变化
  function handleSizeChange(size: number) {
    pageSize.value = size
    currentPage.value = 1
    loadProducts()
  }
  
  // 处理排序变化
  function handleSortChange({ prop, order }: { prop: string; order: string }) {
    if (prop) {
      sortField.value = prop
      sortOrder.value = order === 'ascending' ? 'asc' : 'desc'
      loadProducts()
    }
  }
  
  // 刷新数据
  async function refresh() {
    currentPage.value = 1
    await loadProducts()
  }
  
  return {
    // State
    currentPage,
    pageSize,
    sortField,
    sortOrder,
    
    // Computed
    products,
    total,
    loading,
    
    // Methods
    loadProducts,
    handlePageChange,
    handleSizeChange,
    handleSortChange,
    refresh
  }
}
