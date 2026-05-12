/**
 * 产品数据API接口
 */
import request from '../utils/request'
import type {
  ApiResponse,
  CategoryStats,
  ProductData,
  ProductListParams,
  ProductListResponse,
  TrendData,
  TopProduct,
  AdPerformance,
  ExportParams
} from '../types/productData'

const API_BASE = '/api/v1/product-data'

export const productDataApi = {
  // 获取所有可用月份
  async getAvailableMonths(): Promise<ApiResponse<string[]>> {
    const res = (await request.get(`${API_BASE}/available-months`)) as any
    return {
      code: 200,
      message: 'success',
      data: res
    }
  },

  // 获取分类统计数据
  async getCategoryStats(params?: {
    startDate?: string;
    endDate?: string;
    month?: string;
    store?: string;
    country?: string;
    developer?: string;
  }): Promise<ApiResponse<CategoryStats[]>> {
    const apiParams = {
      start_date: params?.startDate,
      end_date: params?.endDate,
      month: params?.month,
      store: params?.store,
      country: params?.country,
      developer: params?.developer
    }
    const res = (await request.get(`${API_BASE}/category-stats`, { params: apiParams })) as any
    console.log('[API] category-stats 原始响应:', res)
    console.log('[API] category-stats stats数据:', res.stats)
    return {
      code: 200,
      message: 'success',
      data: res.stats
    }
  },

  // 获取产品明细列表
  async getProductList(params: ProductListParams): Promise<ApiResponse<ProductListResponse>> {
    const apiParams = {
      page: params.page,
      page_size: params.pageSize,
      store: params.filters?.store,
      country: params.filters?.country,
      category: params.filters?.category,
      developer: params.filters?.developer,
      search_keyword: params.filters?.searchKeyword,
      month: params.filters?.month,
      start_date: params.filters?.startDate,
      end_date: params.filters?.endDate,
      sort_field: params.sortField,
      sort_order: params.sortOrder
    }
    const res = (await request.get(`${API_BASE}/products`, { params: apiParams })) as any
    return {
      code: 200,
      message: 'success',
      data: {
        list: res.list,
        total: res.total,
        page: res.page,
        pageSize: res.page_size
      }
    }
  },

  // 获取销售趋势数据 (使用 auto-generated types from OpenAPI)
  async getSalesTrend(params: {
    category?: string;
    startDate?: string;
    endDate?: string;
    timeDimension?: string;
    months?: number;
    store?: string;
    country?: string;
    developer?: string;
  }): Promise<ApiResponse<TrendData[]>> {
    const apiParams = {
      category: params.category,
      start_date: params.startDate,
      end_date: params.endDate,
      time_dimension: params.timeDimension,
      months: params.months,
      store: params.store,
      country: params.country,
      developer: params.developer
    }
    const res = (await request.get(`${API_BASE}/sales-trend`, { params: apiParams })) as any
    return {
      code: 200,
      message: 'success',
      data: res.data
    }
  },

  // 获取TOP产品
  async getTopProducts(params: { 
    category?: string; 
    startDate?: string;
    endDate?: string;
    limit?: number;
    store?: string;
    country?: string;
    developer?: string;
  }): Promise<ApiResponse<TopProduct[]>> {
    const apiParams = {
      category: params.category,
      start_date: params.startDate,
      end_date: params.endDate,
      limit: params.limit,
      store: params.store,
      country: params.country,
      developer: params.developer
    }
    const res = (await request.get(`${API_BASE}/top-products`, { params: apiParams })) as any
    return {
      code: 200,
      message: 'success',
      data: res.items
    }
  },

  // 获取广告表现数据
  async getAdPerformance(params?: { 
    category?: string;
    startDate?: string;
    endDate?: string;
    store?: string;
    country?: string;
    developer?: string;
  }): Promise<ApiResponse<AdPerformance[]>> {
    const apiParams = {
      category: params?.category,
      start_date: params?.startDate,
      end_date: params?.endDate,
      store: params?.store,
      country: params?.country,
      developer: params?.developer
    }
    const res = (await request.get(`${API_BASE}/ad-performance`, { params: apiParams })) as any
    return {
      code: 200,
      message: 'success',
      data: res.data
    }
  },

  // 导出数据
  async exportData(params: ExportParams): Promise<Blob> {
    const apiParams = {
      store: params.filters?.store,
      country: params.filters?.country,
      category: params.filters?.category,
      developer: params.filters?.developer,
      search_keyword: params.filters?.searchKeyword,
      month: params.filters?.month,
      start_date: params.filters?.startDate,
      end_date: params.filters?.endDate,
      fields: params.fields
    }
    const res = (await request.get(`${API_BASE}/export`, { 
      params: apiParams,
      responseType: 'blob'
    })) as any
    return res
  },

  // 获取筛选选项
  async getFilterOptions(): Promise<ApiResponse<{
    stores: string[]
    countries: string[]
    developers: string[]
    categories: string[]
  }>> {
    const res = (await request.get(`${API_BASE}/filter-options`)) as any
    return {
      code: 200,
      message: 'success',
      data: res
    }
  },

  // 清除Redis缓存
  async clearCache(): Promise<ApiResponse<{ message: string; cleared_keys?: string[] }>> {
    const res = (await request.post(`${API_BASE}/clear-cache`)) as any
    return {
      code: 200,
      message: 'success',
      data: res
    }
  },

  // 获取对比数据
  async getCompareData(params: {
    currentStartDate: string;
    currentEndDate: string;
    compareStartDate: string;
    compareEndDate: string;
    category?: string;
    store?: string;
    country?: string;
    developer?: string;
  }): Promise<ApiResponse<{
    current: {
      stats: CategoryStats[];
      total: any;
      avg_acoas: number;
      avg_roas: number;
    };
    compare: {
      stats: CategoryStats[];
      total: any;
      avg_acoas: number;
      avg_roas: number;
    };
    growth_rates: {
      product_count: number;
      sales_volume: number;
      sales_amount: number;
      order_quantity: number;
      ad_spend: number;
      acoas: number;
      roas: number;
    };
  }>> {
    const apiParams = {
      current_start_date: params.currentStartDate,
      current_end_date: params.currentEndDate,
      compare_start_date: params.compareStartDate,
      compare_end_date: params.compareEndDate,
      category: params.category,
      store: params.store,
      country: params.country,
      developer: params.developer
    }
    const res = (await request.get(`${API_BASE}/compare-data`, { params: apiParams })) as any
    return {
      code: 200,
      message: 'success',
      data: res
    }
  }
}
